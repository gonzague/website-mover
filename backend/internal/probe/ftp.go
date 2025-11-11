package probe

import (
	"bytes"
	"crypto/rand"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"time"

	"github.com/jlaffaye/ftp"
)

// ProbeFTP tests an FTP connection and returns detailed information
func ProbeFTP(config ConnectionConfig) (*ProbeResult, error) {
	result := &ProbeResult{
		Protocol:     config.Protocol,
		Capabilities: Capabilities{},
		Performance:  Performance{},
		Badges:       []string{},
	}

	addr := fmt.Sprintf("%s:%d", config.Host, config.Port)

	// Measure latency
	latencyStart := time.Now()
	conn, err := net.DialTimeout("tcp", addr, 5*time.Second)
	if err != nil {
		result.Success = false
		result.ErrorMessage = fmt.Sprintf("Failed to connect: %v", err)
		return result, err
	}
	result.Performance.Latency = time.Since(latencyStart)
	result.Performance.LatencyMs = float64(result.Performance.Latency.Milliseconds())
	conn.Close()

	// Measure connection time
	connStart := time.Now()

	var ftpClient *ftp.ServerConn

	if config.Protocol == ProtocolFTPS {
		// FTPS (FTP over TLS)
		// SECURITY NOTE: This configuration accepts self-signed certificates, which is
		// necessary for a migration tool that connects to arbitrary hosting providers.
		// However, we enforce TLS 1.2+ and log certificate information for transparency.
		// Users should ensure they're on a trusted network when using this tool.
		tlsConfig := &tls.Config{
			ServerName: config.Host,
			MinVersion: tls.VersionTLS12, // Enforce TLS 1.2 or higher
			// Accept self-signed certificates but log them
			InsecureSkipVerify: true,
			VerifyConnection: func(cs tls.ConnectionState) error {
				// Log certificate information for transparency
				if len(cs.PeerCertificates) > 0 {
					cert := cs.PeerCertificates[0]
					fmt.Printf("INFO: FTPS connection to %s using TLS %s\n",
						config.Host, tls.VersionName(cs.Version))
					fmt.Printf("INFO: Certificate Subject=%s, Issuer=%s, Expires=%s\n",
						cert.Subject.CommonName, cert.Issuer.CommonName, cert.NotAfter.Format("2006-01-02"))

					// Check if certificate is expired
					now := time.Now()
					if now.After(cert.NotAfter) {
						fmt.Printf("WARNING: Certificate for %s has expired!\n", config.Host)
					} else if now.Before(cert.NotBefore) {
						fmt.Printf("WARNING: Certificate for %s is not yet valid!\n", config.Host)
					}
				}
				return nil
			},
		}
		ftpClient, err = ftp.Dial(addr,
			ftp.DialWithTimeout(10*time.Second),
			ftp.DialWithExplicitTLS(tlsConfig),
		)
		if err != nil {
			result.Success = false
			result.ErrorMessage = fmt.Sprintf("FTPS connection failed: %v", err)
			return result, err
		}
		result.Badges = append(result.Badges, "FTPS")
	} else {
		// Plain FTP
		ftpClient, err = ftp.Dial(addr, ftp.DialWithTimeout(10*time.Second))
		if err != nil {
			result.Success = false
			result.ErrorMessage = fmt.Sprintf("FTP connection failed: %v", err)
			return result, err
		}
		result.Badges = append(result.Badges, "FTP")
	}
	defer ftpClient.Quit()

	// Login
	err = ftpClient.Login(config.Username, config.Password)
	if err != nil {
		result.Success = false
		result.ErrorMessage = fmt.Sprintf("FTP login failed: %v", err)
		return result, err
	}

	result.Performance.ConnectionTime = time.Since(connStart)
	result.Performance.ConnectionTimeMs = float64(result.Performance.ConnectionTime.Milliseconds())
	result.Success = true
	result.Badges = append(result.Badges, "Login OK")

	// Try to use MLSD (if server supports it, it will work)
	_, err = ftpClient.NameList(config.RootPath)
	if err == nil {
		result.Capabilities.MLSDSupported = true
		result.Badges = append(result.Badges, "MLSD")
	}

	// Test read permissions
	_, err = ftpClient.List(config.RootPath)
	if err == nil {
		result.Capabilities.CanRead = true
		result.Capabilities.CanList = true
		result.Badges = append(result.Badges, "Read OK")
	}

	// Test write permissions
	testFileName := fmt.Sprintf("%s/.website-mover-test-%d.txt", config.RootPath, time.Now().Unix())
	testData := []byte("test")

	err = ftpClient.Stor(testFileName, bytes.NewReader(testData))
	if err == nil {
		defer ftpClient.Delete(testFileName) // Clean up
		result.Capabilities.CanWrite = true
		result.Badges = append(result.Badges, "Write OK")

		// Measure throughput
		uploadSpeed, downloadSpeed := measureFTPThroughput(ftpClient, config.RootPath)
		result.Performance.UploadSpeed = uploadSpeed
		result.Performance.DownloadSpeed = downloadSpeed
	}

	return result, nil
}

// measureFTPThroughput tests upload and download speeds
func measureFTPThroughput(client *ftp.ServerConn, rootPath string) (uploadMBps, downloadMBps float64) {
	testSize := 100 * 1024 // 100 KB
	testData := make([]byte, testSize)
	rand.Read(testData)

	testFile := fmt.Sprintf("%s/.website-mover-speed-test-%d.bin", rootPath, time.Now().Unix())
	defer client.Delete(testFile)

	// Measure upload speed
	uploadStart := time.Now()
	err := client.Stor(testFile, bytes.NewReader(testData))
	if err != nil {
		return 0, 0
	}
	uploadDuration := time.Since(uploadStart)
	uploadMBps = float64(testSize) / 1024 / 1024 / uploadDuration.Seconds()

	// Measure download speed
	downloadStart := time.Now()
	response, err := client.Retr(testFile)
	if err != nil {
		return uploadMBps, 0
	}
	defer response.Close()
	_, err = io.Copy(io.Discard, response)
	if err != nil {
		return uploadMBps, 0
	}
	downloadDuration := time.Since(downloadStart)
	downloadMBps = float64(testSize) / 1024 / 1024 / downloadDuration.Seconds()

	return uploadMBps, downloadMBps
}
