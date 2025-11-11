// Package sshutil provides utilities for establishing and managing SSH/SFTP connections
// with improved security measures including host key consistency checking.
package sshutil

import (
	"crypto/subtle"
	"fmt"
	"log"
	"net"
	"sync"
	"time"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

// ConnectionConfig holds SSH/SFTP connection parameters
type ConnectionConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	SSHKey   string
	Timeout  time.Duration
}

// hostKeyStore tracks host keys seen during the session for consistency checking
var (
	hostKeyStore = make(map[string]string)
	hostKeyMutex sync.RWMutex
)

// HostKeyCallback returns a callback that performs basic host key verification.
// This implementation accepts any host key on first connection but verifies
// consistency on subsequent connections to the same host.
//
// SECURITY NOTE: This is not as secure as proper known_hosts validation,
// but is necessary for a migration tool that connects to arbitrary servers.
// Users should ensure they're on a trusted network when using this tool.
func HostKeyCallback() ssh.HostKeyCallback {
	return func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		hostKeyMutex.Lock()
		defer hostKeyMutex.Unlock()

		keyStr := string(key.Marshal())
		storedKey, exists := hostKeyStore[hostname]

		if !exists {
			// First time seeing this host - store the key and accept it
			hostKeyStore[hostname] = keyStr
			log.Printf("INFO: Accepting host key for %s (fingerprint: %s)", hostname, ssh.FingerprintSHA256(key))
			return nil
		}

		// Verify the key matches what we saw before using constant-time comparison
		if subtle.ConstantTimeCompare([]byte(storedKey), []byte(keyStr)) != 1 {
			return fmt.Errorf("host key mismatch for %s: potential MITM attack detected", hostname)
		}

		return nil
	}
}

// CreateSSHClient creates an SSH client with the given configuration
func CreateSSHClient(config ConnectionConfig) (*ssh.Client, error) {
	// Build auth methods
	var authMethods []ssh.AuthMethod
	if config.SSHKey != "" {
		signer, err := ssh.ParsePrivateKey([]byte(config.SSHKey))
		if err != nil {
			return nil, fmt.Errorf("failed to parse SSH key: %w", err)
		}
		authMethods = []ssh.AuthMethod{ssh.PublicKeys(signer)}
	} else {
		authMethods = []ssh.AuthMethod{ssh.Password(config.Password)}
	}

	// Set default timeout if not specified
	timeout := config.Timeout
	if timeout == 0 {
		timeout = 10 * time.Second
	}

	// Build SSH client config with improved host key verification
	sshConfig := &ssh.ClientConfig{
		User:            config.Username,
		Auth:            authMethods,
		HostKeyCallback: HostKeyCallback(),
		Timeout:         timeout,
	}

	// Connect
	addr := fmt.Sprintf("%s:%d", config.Host, config.Port)
	return ssh.Dial("tcp", addr, sshConfig)
}

// CreateSFTPClient creates an SFTP client with the given configuration
func CreateSFTPClient(config ConnectionConfig) (*sftp.Client, *ssh.Client, error) {
	sshClient, err := CreateSSHClient(config)
	if err != nil {
		return nil, nil, err
	}

	sftpClient, err := sftp.NewClient(sshClient)
	if err != nil {
		sshClient.Close()
		return nil, nil, fmt.Errorf("failed to create SFTP session: %w", err)
	}

	return sftpClient, sshClient, nil
}

// ClearHostKeyStore clears the in-memory host key store.
// Useful for testing or when starting a fresh session.
func ClearHostKeyStore() {
	hostKeyMutex.Lock()
	defer hostKeyMutex.Unlock()
	hostKeyStore = make(map[string]string)
}
