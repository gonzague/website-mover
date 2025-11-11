package constants

import "time"

// Network and connection constants
const (
	// DefaultConnectionTimeout is the default timeout for network connections
	DefaultConnectionTimeout = 10 * time.Second

	// DefaultSFTPTimeout is the timeout for SFTP operations
	DefaultSFTPTimeout = 30 * time.Second

	// TCPDialTimeout is the timeout for TCP connection attempts
	TCPDialTimeout = 5 * time.Second
)

// File transfer constants
const (
	// DefaultBufferSize is the default buffer size for file transfers (32KB)
	DefaultBufferSize = 32 * 1024

	// SpeedTestFileSize is the size of the file used for throughput testing (100KB)
	SpeedTestFileSize = 100 * 1024

	// MaxBandwidthLimit is the maximum allowed bandwidth limit in MB/s (10 GB/s)
	MaxBandwidthLimit = 10000

	// ProgressUpdateInterval is how often to send progress updates (in directories scanned)
	ProgressUpdateInterval = 10
)

// CMS detection constants
const (
	// DatabaseSizeEstimateMin is the minimum estimated database size as % of total size
	DatabaseSizeEstimateMin = 0.05 // 5%

	// DatabaseSizeEstimateMax is the maximum estimated database size as % of total size
	DatabaseSizeEstimateMax = 0.10 // 10%
)

// Server and API constants
const (
	// DefaultServerPort is the default port for the backend server
	DefaultServerPort = "8080"

	// DefaultFrontendPort is the default port for the frontend dev server
	DefaultFrontendPort = 5173

	// ServerBindAddress is the address the server binds to (localhost only for security)
	ServerBindAddress = "127.0.0.1"
)

// Transfer scoring constants
const (
	// AssumedNetworkSpeedMBps is the assumed network speed when actual speed is unknown
	AssumedNetworkSpeedMBps = 10.0
)
