package probe

import "time"

// Protocol represents the connection protocol
type Protocol string

const (
	ProtocolSFTP  Protocol = "sftp"
	ProtocolFTP   Protocol = "ftp"
	ProtocolFTPS  Protocol = "ftps"
	ProtocolSCP   Protocol = "scp"
	ProtocolHTTP  Protocol = "http"
	ProtocolHTTPS Protocol = "https"
)

// ConnectionConfig holds the configuration for a server connection
type ConnectionConfig struct {
	Protocol Protocol `json:"protocol"`
	Host     string   `json:"host"`
	Port     int      `json:"port"`
	Username string   `json:"username"`
	Password string   `json:"password"`
	SSHKey   string   `json:"ssh_key,omitempty"` // Optional SSH private key
	RootPath string   `json:"root_path"`
}

// ProbeResult holds the results of probing a server
type ProbeResult struct {
	Success      bool              `json:"success"`
	ErrorMessage string            `json:"error_message,omitempty"`
	Protocol     Protocol          `json:"protocol"`
	Capabilities Capabilities      `json:"capabilities"`
	Performance  Performance       `json:"performance"`
	FileStats    FileStats         `json:"file_stats,omitempty"`
	Badges       []string          `json:"badges"` // e.g., ["SFTP OK", "Shell Available"]
}

// Capabilities holds the detected server capabilities
type Capabilities struct {
	// SFTP specific
	SFTPVersion      string `json:"sftp_version,omitempty"`
	ShellAvailable   bool   `json:"shell_available"`
	CompressionTypes []string `json:"compression_types,omitempty"`

	// FTP specific
	MLSDSupported bool     `json:"mlsd_supported"`
	FXPAllowed    bool     `json:"fxp_allowed"`
	FTPFeatures   []string `json:"ftp_features,omitempty"`

	// Common
	CanRead  bool `json:"can_read"`
	CanWrite bool `json:"can_write"`
	CanList  bool `json:"can_list"`
}

// Performance holds performance metrics
type Performance struct {
	Latency          time.Duration `json:"latency"`           // Round-trip time
	LatencyMs        float64       `json:"latency_ms"`        // Latency in milliseconds
	UploadSpeed      float64       `json:"upload_speed"`      // MB/s
	DownloadSpeed    float64       `json:"download_speed"`    // MB/s
	ConnectionTime   time.Duration `json:"connection_time"`   // Time to establish connection
	ConnectionTimeMs float64       `json:"connection_time_ms"` // Connection time in milliseconds
}

// FileStats holds file system statistics
type FileStats struct {
	TotalFiles  int64 `json:"total_files"`
	TotalSize   int64 `json:"total_size"`    // in bytes
	LargestFile int64 `json:"largest_file"`  // in bytes
	FileTypes   map[string]int `json:"file_types"` // extension -> count
}
