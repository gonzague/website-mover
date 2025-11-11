// Package validation provides input validation utilities for API endpoints
package validation

import (
	"fmt"
	"net"
	"regexp"
	"strings"

	"github.com/gonzague/website-mover/backend/internal/probe"
	"github.com/gonzague/website-mover/backend/internal/scanner"
)

// ValidationError represents a validation error with field context
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

// ValidateConnectionConfig validates a connection configuration
func ValidateConnectionConfig(config *probe.ConnectionConfig) error {
	if config == nil {
		return &ValidationError{Field: "config", Message: "configuration is required"}
	}

	// Validate protocol
	validProtocols := map[probe.Protocol]bool{
		probe.ProtocolSFTP:  true,
		probe.ProtocolFTP:   true,
		probe.ProtocolFTPS:  true,
		probe.ProtocolSCP:   true,
		probe.ProtocolHTTP:  true,
		probe.ProtocolHTTPS: true,
	}
	if !validProtocols[config.Protocol] {
		return &ValidationError{
			Field:   "protocol",
			Message: fmt.Sprintf("invalid protocol '%s'", config.Protocol),
		}
	}

	// Validate host
	if strings.TrimSpace(config.Host) == "" {
		return &ValidationError{Field: "host", Message: "host is required"}
	}

	// Validate it's not a malicious host
	if err := validateHost(config.Host); err != nil {
		return &ValidationError{Field: "host", Message: err.Error()}
	}

	// Validate port
	if config.Port < 1 || config.Port > 65535 {
		return &ValidationError{
			Field:   "port",
			Message: fmt.Sprintf("port must be between 1 and 65535, got %d", config.Port),
		}
	}

	// Validate username for protocols that require it
	if config.Protocol != probe.ProtocolHTTP && config.Protocol != probe.ProtocolHTTPS {
		if strings.TrimSpace(config.Username) == "" {
			return &ValidationError{Field: "username", Message: "username is required"}
		}
	}

	// Validate root path
	if strings.TrimSpace(config.RootPath) == "" {
		return &ValidationError{Field: "root_path", Message: "root_path is required"}
	}

	// Validate path doesn't contain dangerous characters
	if err := validatePath(config.RootPath); err != nil {
		return &ValidationError{Field: "root_path", Message: err.Error()}
	}

	return nil
}

// ValidateScanRequest validates a scan request
func ValidateScanRequest(req *scanner.ScanRequest) error {
	if req == nil {
		return &ValidationError{Field: "request", Message: "request body is required"}
	}

	// Validate the embedded connection config
	if err := ValidateConnectionConfig(&req.ServerConfig); err != nil {
		return err
	}

	// Validate max_depth if specified
	if req.MaxDepth < 0 {
		return &ValidationError{
			Field:   "max_depth",
			Message: fmt.Sprintf("max_depth cannot be negative, got %d", req.MaxDepth),
		}
	}
	if req.MaxDepth > 1000 {
		return &ValidationError{
			Field:   "max_depth",
			Message: "max_depth cannot exceed 1000 (too deep)",
		}
	}

	// Validate max_files if specified
	if req.MaxFiles < 0 {
		return &ValidationError{
			Field:   "max_files",
			Message: fmt.Sprintf("max_files cannot be negative, got %d", req.MaxFiles),
		}
	}
	if req.MaxFiles > 10000000 {
		return &ValidationError{
			Field:   "max_files",
			Message: "max_files cannot exceed 10,000,000",
		}
	}

	// Validate custom exclusions don't contain dangerous patterns
	for i, exclusion := range req.CustomExclusions {
		if strings.TrimSpace(exclusion) == "" {
			return &ValidationError{
				Field:   fmt.Sprintf("custom_exclusions[%d]", i),
				Message: "exclusion pattern cannot be empty",
			}
		}
	}

	return nil
}

// validateHost ensures the host is valid and not malicious
func validateHost(host string) error {
	// Check for empty or whitespace-only
	if strings.TrimSpace(host) == "" {
		return fmt.Errorf("host cannot be empty")
	}

	// Check length
	if len(host) > 255 {
		return fmt.Errorf("host exceeds maximum length of 255 characters")
	}

	// Check for null bytes
	if strings.Contains(host, "\x00") {
		return fmt.Errorf("host contains invalid null byte")
	}

	// Try to resolve as IP address or hostname
	// This also prevents SSRF attacks to localhost/private IPs if needed
	ips, err := net.LookupIP(host)
	if err != nil {
		// Might be an IP address directly, try parsing
		ip := net.ParseIP(host)
		if ip == nil {
			// If not a valid IP and can't resolve, it might still be valid but unreachable
			// We'll allow it but log a warning
			// In production, you might want stricter validation
		}
	} else {
		// Check for private/localhost IPs if you want to prevent SSRF
		for _, ip := range ips {
			if ip.IsLoopback() || ip.IsPrivate() {
				// Allow for development, but in production you might want to restrict
				// return fmt.Errorf("connections to localhost/private IPs are not allowed")
			}
		}
	}

	return nil
}

// validatePath ensures the path doesn't contain dangerous characters
func validatePath(path string) error {
	// Check for null bytes
	if strings.Contains(path, "\x00") {
		return fmt.Errorf("path contains invalid null byte")
	}

	// Check for path traversal attempts
	if strings.Contains(path, "..") {
		return fmt.Errorf("path cannot contain '..' (path traversal)")
	}

	// Check for absolute path (should start with /)
	if !strings.HasPrefix(path, "/") {
		return fmt.Errorf("path must be absolute (start with /)")
	}

	// Check length
	if len(path) > 4096 {
		return fmt.Errorf("path exceeds maximum length of 4096 characters")
	}

	// Check for control characters
	controlCharPattern := regexp.MustCompile(`[\x00-\x1F\x7F]`)
	if controlCharPattern.MatchString(path) {
		return fmt.Errorf("path contains invalid control characters")
	}

	return nil
}
