package transfer

import (
	"time"

	"github.com/gonzague/website-mover/backend/internal/probe"
	"github.com/gonzague/website-mover/backend/internal/scanner"
)

// TransferMethod represents the transfer strategy
type TransferMethod string

const (
	MethodSFTPStream TransferMethod = "sftp_stream"
	MethodRsyncSSH   TransferMethod = "rsync_ssh"
	MethodLFTP       TransferMethod = "lftp"
	MethodTarStream  TransferMethod = "tar_stream"
	MethodFXP        TransferMethod = "fxp"
)

// TransferRequest contains all information needed to start a transfer
type TransferRequest struct {
	SourceConfig      probe.ConnectionConfig         `json:"source_config"`
	DestConfig        probe.ConnectionConfig         `json:"dest_config"`
	Method            TransferMethod                 `json:"method"`
	Exclusions        []scanner.ExclusionPattern     `json:"exclusions"`
	BandwidthLimit    *int                           `json:"bandwidth_limit,omitempty"` // MB/s
	EnableResume      bool                           `json:"enable_resume"`
	VerifyAfterTransfer bool                         `json:"verify_after_transfer"`
	SkipLargeFiles    *int                           `json:"skip_large_files,omitempty"` // MB
	DryRun            bool                           `json:"dry_run"`
	Files             []scanner.FileEntry            `json:"files,omitempty"` // Pre-scanned files (avoids re-scanning)
}

// TransferProgress represents the current state of a transfer
type TransferProgress struct {
	Status           string    `json:"status"` // initializing, transferring, paused, completed, failed
	FilesTransferred int       `json:"files_transferred"`
	TotalFiles       int       `json:"total_files"`
	BytesTransferred int64     `json:"bytes_transferred"`
	TotalBytes       int64     `json:"total_bytes"`
	CurrentFile      string    `json:"current_file"`
	Speed            float64   `json:"speed"` // MB/s
	ETA              int64     `json:"eta"` // seconds
	PercentComplete  float64   `json:"percent_complete"`
	ErrorsCount      int       `json:"errors_count"`
	LastError        string    `json:"last_error,omitempty"`
	StartTime        time.Time `json:"start_time"`
	ElapsedSeconds   int64     `json:"elapsed_seconds"`
}

// TransferResult represents the final result of a transfer
type TransferResult struct {
	Success          bool              `json:"success"`
	ErrorMessage     string            `json:"error_message,omitempty"`
	FilesTransferred int               `json:"files_transferred"`
	BytesTransferred int64             `json:"bytes_transferred"`
	Duration         time.Duration     `json:"duration"`
	AverageSpeed     float64           `json:"average_speed"` // MB/s
	ErrorsCount      int               `json:"errors_count"`
	SkippedFiles     []string          `json:"skipped_files,omitempty"`
	FailedFiles      []string          `json:"failed_files,omitempty"`
	VerificationResult *VerificationResult `json:"verification_result,omitempty"`
}

// VerificationResult contains post-transfer verification data
type VerificationResult struct {
	Success       bool   `json:"success"`
	SourceFiles   int    `json:"source_files"`
	DestFiles     int    `json:"dest_files"`
	SourceSize    int64  `json:"source_size"`
	DestSize      int64  `json:"dest_size"`
	MissingFiles  int    `json:"missing_files"`
	Message       string `json:"message"`
}
