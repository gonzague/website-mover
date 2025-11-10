package scanner

import (
	"time"

	"github.com/gonzague/website-mover/backend/internal/probe"
)

// FileEntry represents a single file or directory
type FileEntry struct {
	Path         string    `json:"path"`
	Name         string    `json:"name"`
	Size         int64     `json:"size"`
	IsDir        bool      `json:"is_dir"`
	ModTime      time.Time `json:"mod_time"`
	Permissions  string    `json:"permissions"`
	MimeType     string    `json:"mime_type,omitempty"`
	Extension    string    `json:"extension,omitempty"`
	IsSymlink    bool      `json:"is_symlink"`
	LinkTarget   string    `json:"link_target,omitempty"`
	ShouldExclude bool     `json:"should_exclude"`
	ExcludeReason string   `json:"exclude_reason,omitempty"`
}

// ScanProgress represents real-time scanning progress
type ScanProgress struct {
	Status           string  `json:"status"` // scanning, analyzing, complete, error
	CurrentPath      string  `json:"current_path"`
	FilesScanned     int     `json:"files_scanned"`
	DirsScanned      int     `json:"dirs_scanned"`
	TotalSize        int64   `json:"total_size"`
	EstimatedTotal   int     `json:"estimated_total,omitempty"`
	PercentComplete  float64 `json:"percent_complete"`
	ErrorsEncountered int    `json:"errors_encountered"`
	Message          string  `json:"message,omitempty"`
}

// FileStatistics contains aggregated file information
type FileStatistics struct {
	TotalFiles      int                `json:"total_files"`
	TotalDirs       int                `json:"total_dirs"`
	TotalSize       int64              `json:"total_size"`
	TotalSizeHuman  string             `json:"total_size_human"`
	LargestFiles    []FileEntry        `json:"largest_files"`
	FilesByType     map[string]int     `json:"files_by_type"`
	FilesByTypeSize map[string]int64   `json:"files_by_type_size"`
	DirectoryDepth  int                `json:"directory_depth"`
	SymlinksCount   int                `json:"symlinks_count"`
	ExcludedCount   int                `json:"excluded_count"`
	ExcludedSize    int64              `json:"excluded_size"`
}

// CMSType represents detected CMS
type CMSType string

const (
	CMSWordPress   CMSType = "wordpress"
	CMSPrestaShop  CMSType = "prestashop"
	CMSDrupal      CMSType = "drupal"
	CMSJoomla      CMSType = "joomla"
	CMSMagento     CMSType = "magento"
	CMSUnknown     CMSType = "unknown"
)

// DatabaseConfig contains parsed database credentials
type DatabaseConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Database string `json:"database"`
	Username string `json:"username"`
	Password string `json:"password"`
	Prefix   string `json:"prefix,omitempty"`
}

// CMSDetection contains detected CMS information
type CMSDetection struct {
	Detected       bool           `json:"detected"`
	Type           CMSType        `json:"type"`
	Version        string         `json:"version,omitempty"`
	RootPath       string         `json:"root_path"`
	ConfigFile     string         `json:"config_file,omitempty"`
	DatabaseConfig *DatabaseConfig `json:"database_config,omitempty"`
	Confidence     float64        `json:"confidence"` // 0.0 to 1.0
	Indicators     []string       `json:"indicators"` // What files/folders were found
}

// ExclusionPattern represents a pattern to exclude
type ExclusionPattern struct {
	Pattern     string `json:"pattern"`
	Type        string `json:"type"` // glob, regex, exact
	Reason      string `json:"reason"`
	IsAutomatic bool   `json:"is_automatic"`
	Enabled     bool   `json:"enabled"`
}

// ScanResult is the complete result of scanning
type ScanResult struct {
	Success         bool              `json:"success"`
	ErrorMessage    string            `json:"error_message,omitempty"`
	StartTime       time.Time         `json:"start_time"`
	EndTime         time.Time         `json:"end_time"`
	Duration        time.Duration     `json:"duration"`
	Statistics      FileStatistics    `json:"statistics"`
	CMSDetection    *CMSDetection     `json:"cms_detection,omitempty"`
	Files           []FileEntry       `json:"files,omitempty"` // Can be large, consider pagination
	Exclusions      []ExclusionPattern `json:"exclusions"`
	ServerConfig    probe.ConnectionConfig `json:"server_config"`
}

// ScanRequest is the request to start a scan
type ScanRequest struct {
	ServerConfig     probe.ConnectionConfig `json:"server_config"`
	MaxDepth         int                    `json:"max_depth,omitempty"`          // 0 = unlimited
	MaxFiles         int                    `json:"max_files,omitempty"`          // 0 = unlimited
	FollowSymlinks   bool                   `json:"follow_symlinks"`
	DetectCMS        bool                   `json:"detect_cms"`
	CustomExclusions []string               `json:"custom_exclusions,omitempty"`
	IncludeHidden    bool                   `json:"include_hidden"`
}

// TransferMethod represents a transfer strategy
type TransferMethod string

const (
	MethodFXP          TransferMethod = "fxp"           // FTP server-to-server
	MethodRsyncSSH     TransferMethod = "rsync_ssh"     // rsync over SSH
	MethodSFTPStream   TransferMethod = "sftp_stream"   // Direct SFTP transfer
	MethodLFTP         TransferMethod = "lftp"          // lftp mirror
	MethodSCP          TransferMethod = "scp"           // SCP recursive
	MethodRclone       TransferMethod = "rclone"        // rclone sync
	MethodTarStream    TransferMethod = "tar_stream"    // tar over SSH pipe
)

// TransferStrategy represents a scored transfer method
type TransferStrategy struct {
	Method            TransferMethod `json:"method"`
	Score             float64        `json:"score"` // 0.0 to 100.0
	EstimatedTime     time.Duration  `json:"estimated_time"`
	EstimatedTimeStr  string         `json:"estimated_time_str"`
	Command           string         `json:"command"`
	CommandExplanation string        `json:"command_explanation"`
	Pros              []string       `json:"pros"`
	Cons              []string       `json:"cons"`
	Requirements      []string       `json:"requirements"`
	IsRecommended     bool           `json:"is_recommended"`
	CanResume         bool           `json:"can_resume"`
	SupportsProgress  bool           `json:"supports_progress"`
}

// PlanResult contains the complete migration plan
type PlanResult struct {
	Success         bool               `json:"success"`
	ErrorMessage    string             `json:"error_message,omitempty"`
	ScanResult      *ScanResult        `json:"scan_result"`
	SourceProbe     *probe.ProbeResult `json:"source_probe"`
	DestProbe       *probe.ProbeResult `json:"dest_probe"`
	Strategies      []TransferStrategy `json:"strategies"`
	RecommendedStrategy *TransferStrategy `json:"recommended_strategy"`
	Warnings        []string           `json:"warnings,omitempty"`
	RequiresDatabase bool              `json:"requires_database"`
	EstimatedTotalTime time.Duration   `json:"estimated_total_time"`
}
