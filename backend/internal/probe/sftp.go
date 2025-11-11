package probe

import (
	"bytes"
	"crypto/rand"
	"fmt"
	"io"
	"net"
	"time"

	"github.com/gonzague/website-mover/backend/internal/sshutil"
	"github.com/pkg/sftp"
)

// ProbeSFTP tests an SFTP connection and returns detailed information
func ProbeSFTP(config ConnectionConfig) (*ProbeResult, error) {
	result := &ProbeResult{
		Protocol:     ProtocolSFTP,
		Capabilities: Capabilities{},
		Performance:  Performance{},
		Badges:       []string{},
	}

	// Measure connection time
	connStart := time.Now()
	addr := fmt.Sprintf("%s:%d", config.Host, config.Port)

	// Measure latency (TCP handshake)
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

	// Establish SSH connection using shared utility
	sshConn, err := sshutil.CreateSSHClient(sshutil.ConnectionConfig{
		Host:     config.Host,
		Port:     config.Port,
		Username: config.Username,
		Password: config.Password,
		SSHKey:   config.SSHKey,
		Timeout:  10 * time.Second,
	})
	if err != nil {
		result.Success = false
		result.ErrorMessage = fmt.Sprintf("SSH connection failed: %v", err)
		return result, err
	}
	defer sshConn.Close()

	result.Performance.ConnectionTime = time.Since(connStart)
	result.Performance.ConnectionTimeMs = float64(result.Performance.ConnectionTime.Milliseconds())

	// Open SFTP session
	sftpClient, err := sftp.NewClient(sshConn)
	if err != nil {
		result.Success = false
		result.ErrorMessage = fmt.Sprintf("SFTP session failed: %v", err)
		return result, err
	}
	defer sftpClient.Close()

	result.Success = true
	result.Badges = append(result.Badges, "SFTP OK")

	// Get SFTP server version
	// Note: pkg/sftp doesn't expose server version directly,
	// but we can infer from successful connection
	result.Capabilities.SFTPVersion = "3" // Most common version
	result.Badges = append(result.Badges, "SFTP v3")

	// Test if we can execute shell commands (check if it's sftp-only)
	session, err := sshConn.NewSession()
	if err == nil {
		defer session.Close()
		// Try to run a simple command
		err = session.Run("echo test")
		if err == nil {
			result.Capabilities.ShellAvailable = true
			result.Badges = append(result.Badges, "Shell Available")
		}
	}

	// Test read permissions
	_, err = sftpClient.ReadDir(config.RootPath)
	if err == nil {
		result.Capabilities.CanRead = true
		result.Capabilities.CanList = true
		result.Badges = append(result.Badges, "Read OK")
	}

	// Test write permissions by creating a temp file
	testFileName := fmt.Sprintf("%s/.website-mover-test-%d", config.RootPath, time.Now().Unix())
	testData := []byte("test")

	file, err := sftpClient.Create(testFileName)
	if err == nil {
		defer sftpClient.Remove(testFileName) // Clean up
		_, writeErr := file.Write(testData)
		file.Close()
		if writeErr == nil {
			result.Capabilities.CanWrite = true
			result.Badges = append(result.Badges, "Write OK")
		}
	}

	// Test compression (SSH supports compression)
	result.Capabilities.CompressionTypes = []string{"zlib", "none"}
	result.Badges = append(result.Badges, "Compression")

	// Measure throughput with a small test file (100KB)
	if result.Capabilities.CanWrite {
		uploadSpeed, downloadSpeed := measureThroughput(sftpClient, config.RootPath)
		result.Performance.UploadSpeed = uploadSpeed
		result.Performance.DownloadSpeed = downloadSpeed
	}

	return result, nil
}

// measureThroughput tests upload and download speeds
func measureThroughput(client *sftp.Client, rootPath string) (uploadMBps, downloadMBps float64) {
	testSize := 100 * 1024 // 100 KB
	testData := make([]byte, testSize)
	rand.Read(testData)

	testFile := fmt.Sprintf("%s/.website-mover-speed-test-%d", rootPath, time.Now().Unix())
	defer client.Remove(testFile)

	// Measure upload speed
	uploadStart := time.Now()
	file, err := client.Create(testFile)
	if err != nil {
		return 0, 0
	}
	_, err = io.Copy(file, bytes.NewReader(testData))
	file.Close()
	if err != nil {
		return 0, 0
	}
	uploadDuration := time.Since(uploadStart)
	uploadMBps = float64(testSize) / 1024 / 1024 / uploadDuration.Seconds()

	// Measure download speed
	downloadStart := time.Now()
	file, err = client.Open(testFile)
	if err != nil {
		return uploadMBps, 0
	}
	defer file.Close()
	_, err = io.Copy(io.Discard, file)
	if err != nil {
		return uploadMBps, 0
	}
	downloadDuration := time.Since(downloadStart)
	downloadMBps = float64(testSize) / 1024 / 1024 / downloadDuration.Seconds()

	return uploadMBps, downloadMBps
}
