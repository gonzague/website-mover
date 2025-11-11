// Package transfer handles file transfers between servers with support for
// bandwidth limiting, progress tracking, and verification.
package transfer

import (
	"fmt"
	"io"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/gonzague/website-mover/backend/internal/scanner"
	"github.com/gonzague/website-mover/backend/internal/sshutil"
	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

// ProgressCallback is called with progress updates
type ProgressCallback func(progress TransferProgress)

// SFTPExecutor handles SFTP file transfers
type SFTPExecutor struct {
	request          TransferRequest
	progress         TransferProgress
	progressCallback ProgressCallback
	sourceClient     *sftp.Client
	sourceSSH        *ssh.Client
	destClient       *sftp.Client
	destSSH          *ssh.Client
	paused           bool
	cancelled        bool
	startTime        time.Time
	lastProgressTime time.Time
	bytesAtLastUpdate int64
}

// NewSFTPExecutor creates a new SFTP executor
func NewSFTPExecutor(request TransferRequest, callback ProgressCallback) *SFTPExecutor {
	return &SFTPExecutor{
		request:          request,
		progressCallback: callback,
		progress: TransferProgress{
			Status:    "initializing",
			StartTime: time.Now(),
		},
	}
}

// Execute performs the SFTP transfer
func (e *SFTPExecutor) Execute() (*TransferResult, error) {
	e.startTime = time.Now()
	e.lastProgressTime = e.startTime

	// Connect to source
	e.progress.Status = "connecting"
	e.sendProgress()

	if err := e.connectSource(); err != nil {
		return &TransferResult{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Failed to connect to source: %v", err),
		}, err
	}
	defer e.closeSource()

	// Connect to destination
	if err := e.connectDest(); err != nil {
		return &TransferResult{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Failed to connect to destination: %v", err),
		}, err
	}
	defer e.closeDest()

	// Scan source to get file list
	e.progress.Status = "scanning"
	e.sendProgress()

	files, err := e.scanSource()
	if err != nil {
		return &TransferResult{
			Success:      false,
			ErrorMessage: fmt.Sprintf("Failed to scan source: %v", err),
		}, err
	}

	e.progress.TotalFiles = len(files)
	e.progress.TotalBytes = e.calculateTotalSize(files)

	// Transfer files
	e.progress.Status = "transferring"
	e.sendProgress()

	var skippedFiles, failedFiles []string

	for _, file := range files {
		if e.cancelled {
			return &TransferResult{
				Success:          false,
				ErrorMessage:     "Transfer cancelled by user",
				FilesTransferred: e.progress.FilesTransferred,
				BytesTransferred: e.progress.BytesTransferred,
				Duration:         time.Since(e.startTime),
			}, fmt.Errorf("cancelled")
		}

		// Wait if paused
		for e.paused && !e.cancelled {
			time.Sleep(100 * time.Millisecond)
		}

		// Skip if excluded
		if e.shouldExclude(file.Path) {
			skippedFiles = append(skippedFiles, file.Path)
			continue
		}

		// Skip large files if configured
		if e.request.SkipLargeFiles != nil && file.Size > int64(*e.request.SkipLargeFiles)*1024*1024 {
			skippedFiles = append(skippedFiles, file.Path)
			continue
		}

		e.progress.CurrentFile = file.Path

		if file.IsDir {
			if err := e.transferDirectory(file); err != nil {
				e.progress.ErrorsCount++
				e.progress.LastError = fmt.Sprintf("Failed to create directory %s: %v", file.Path, err)
				failedFiles = append(failedFiles, file.Path)
			}
		} else {
			if err := e.transferFile(file); err != nil {
				e.progress.ErrorsCount++
				e.progress.LastError = fmt.Sprintf("Failed to transfer %s: %v", file.Path, err)
				failedFiles = append(failedFiles, file.Path)
			} else {
				e.progress.FilesTransferred++
				e.progress.BytesTransferred += file.Size
			}
		}

		e.updateProgress()
	}

	e.progress.Status = "completed"
	e.progress.PercentComplete = 100.0
	e.sendProgress()

	duration := time.Since(e.startTime)
	avgSpeed := float64(e.progress.BytesTransferred) / 1024 / 1024 / duration.Seconds()

	result := &TransferResult{
		Success:          true,
		FilesTransferred: e.progress.FilesTransferred,
		BytesTransferred: e.progress.BytesTransferred,
		Duration:         duration,
		AverageSpeed:     avgSpeed,
		ErrorsCount:      e.progress.ErrorsCount,
		SkippedFiles:     skippedFiles,
		FailedFiles:      failedFiles,
	}

	// Verify if requested
	if e.request.VerifyAfterTransfer && !e.request.DryRun {
		e.progress.Status = "verifying"
		e.sendProgress()
		result.VerificationResult = e.verify()
	}

	return result, nil
}

// connectSource establishes SFTP connection to source
func (e *SFTPExecutor) connectSource() error {
	sftpClient, sshClient, err := sshutil.CreateSFTPClient(sshutil.ConnectionConfig{
		Host:     e.request.SourceConfig.Host,
		Port:     e.request.SourceConfig.Port,
		Username: e.request.SourceConfig.Username,
		Password: e.request.SourceConfig.Password,
		SSHKey:   e.request.SourceConfig.SSHKey,
		Timeout:  30 * time.Second,
	})
	if err != nil {
		return err
	}

	e.sourceSSH = sshClient
	e.sourceClient = sftpClient

	return nil
}

// connectDest establishes SFTP connection to destination
func (e *SFTPExecutor) connectDest() error {
	sftpClient, sshClient, err := sshutil.CreateSFTPClient(sshutil.ConnectionConfig{
		Host:     e.request.DestConfig.Host,
		Port:     e.request.DestConfig.Port,
		Username: e.request.DestConfig.Username,
		Password: e.request.DestConfig.Password,
		SSHKey:   e.request.DestConfig.SSHKey,
		Timeout:  30 * time.Second,
	})
	if err != nil {
		return err
	}

	e.destSSH = sshClient
	e.destClient = sftpClient

	// Create destination root path if it doesn't exist
	if err := e.destClient.MkdirAll(e.request.DestConfig.RootPath); err != nil {
		return fmt.Errorf("failed to create destination root: %w", err)
	}

	return nil
}

// scanSource recursively scans source directory
func (e *SFTPExecutor) scanSource() ([]scanner.FileEntry, error) {
	var files []scanner.FileEntry
	walker := e.sourceClient.Walk(e.request.SourceConfig.RootPath)

	for walker.Step() {
		if err := walker.Err(); err != nil {
			continue
		}

		stat := walker.Stat()
		relativePath := strings.TrimPrefix(walker.Path(), e.request.SourceConfig.RootPath)
		if relativePath == "" {
			continue
		}

		files = append(files, scanner.FileEntry{
			Path:  walker.Path(),
			Name:  path.Base(walker.Path()),
			Size:  stat.Size(),
			IsDir: stat.IsDir(),
		})
	}

	return files, nil
}

// transferFile transfers a single file
func (e *SFTPExecutor) transferFile(file scanner.FileEntry) error {
	if e.request.DryRun {
		// Simulate transfer time
		time.Sleep(10 * time.Millisecond)
		return nil
	}

	// Calculate destination path
	relativePath := strings.TrimPrefix(file.Path, e.request.SourceConfig.RootPath)
	destPath := path.Join(e.request.DestConfig.RootPath, relativePath)

	// Ensure parent directory exists
	destDir := path.Dir(destPath)
	if err := e.destClient.MkdirAll(destDir); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Open source file
	srcFile, err := e.sourceClient.Open(file.Path)
	if err != nil {
		return fmt.Errorf("failed to open source: %w", err)
	}
	defer srcFile.Close()

	// Create destination file
	destFile, err := e.destClient.Create(destPath)
	if err != nil {
		return fmt.Errorf("failed to create destination: %w", err)
	}
	defer destFile.Close()

	// Copy with progress tracking
	buffer := make([]byte, 32*1024) // 32KB buffer
	for {
		if e.cancelled {
			return fmt.Errorf("cancelled")
		}

		n, err := srcFile.Read(buffer)
		if n > 0 {
			if _, writeErr := destFile.Write(buffer[:n]); writeErr != nil {
				return fmt.Errorf("write error: %w", writeErr)
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("read error: %w", err)
		}

		// Apply bandwidth limit
		if e.request.BandwidthLimit != nil && *e.request.BandwidthLimit > 0 {
			// Simple throttling - sleep proportionally to maintain target speed
			// Convert MB/s to bytes/second with overflow protection
			limitMBps := *e.request.BandwidthLimit
			if limitMBps > 10000 { // Sanity check: cap at 10 GB/s
				limitMBps = 10000
			}
			bytesPerSecond := int64(limitMBps) * 1024 * 1024

			// Calculate sleep time with safe arithmetic
			// sleepTime = (bytes transferred / target bytes per second) * 1 second
			if bytesPerSecond > 0 && n > 0 {
				sleepNanos := (int64(n) * int64(time.Second)) / bytesPerSecond
				if sleepNanos > 0 {
					time.Sleep(time.Duration(sleepNanos))
				}
			}
		}
	}

	// Preserve permissions
	srcStat, _ := srcFile.Stat()
	if srcStat != nil {
		e.destClient.Chmod(destPath, srcStat.Mode())
	}

	return nil
}

// transferDirectory creates a directory at the destination
func (e *SFTPExecutor) transferDirectory(file scanner.FileEntry) error {
	if e.request.DryRun {
		return nil
	}

	relativePath := strings.TrimPrefix(file.Path, e.request.SourceConfig.RootPath)
	destPath := path.Join(e.request.DestConfig.RootPath, relativePath)

	return e.destClient.MkdirAll(destPath)
}

// shouldExclude checks if a file should be excluded
func (e *SFTPExecutor) shouldExclude(filePath string) bool {
	basename := filepath.Base(filePath)

	for _, exclusion := range e.request.Exclusions {
		if !exclusion.Enabled {
			continue
		}

		switch exclusion.Type {
		case "exact":
			if basename == exclusion.Pattern || filePath == exclusion.Pattern {
				return true
			}
		case "glob":
			matched, _ := filepath.Match(exclusion.Pattern, basename)
			if matched {
				return true
			}
			if strings.Contains(filePath, exclusion.Pattern) {
				return true
			}
		}
	}

	return false
}

// calculateTotalSize sums up the size of all files
func (e *SFTPExecutor) calculateTotalSize(files []scanner.FileEntry) int64 {
	var total int64
	for _, file := range files {
		if !file.IsDir && !e.shouldExclude(file.Path) {
			if e.request.SkipLargeFiles == nil || file.Size <= int64(*e.request.SkipLargeFiles)*1024*1024 {
				total += file.Size
			}
		}
	}
	return total
}

// updateProgress calculates and updates progress metrics
func (e *SFTPExecutor) updateProgress() {
	now := time.Now()
	elapsed := now.Sub(e.lastProgressTime).Seconds()

	// Update every second
	if elapsed >= 1.0 {
		bytesSinceLast := e.progress.BytesTransferred - e.bytesAtLastUpdate
		e.progress.Speed = float64(bytesSinceLast) / 1024 / 1024 / elapsed

		if e.progress.TotalBytes > 0 {
			e.progress.PercentComplete = float64(e.progress.BytesTransferred) / float64(e.progress.TotalBytes) * 100.0

			if e.progress.Speed > 0 {
				bytesRemaining := e.progress.TotalBytes - e.progress.BytesTransferred
				e.progress.ETA = int64(float64(bytesRemaining) / (e.progress.Speed * 1024 * 1024))
			}
		}

		e.progress.ElapsedSeconds = int64(time.Since(e.startTime).Seconds())

		e.sendProgress()

		e.lastProgressTime = now
		e.bytesAtLastUpdate = e.progress.BytesTransferred
	}
}

// sendProgress sends a progress update via callback
func (e *SFTPExecutor) sendProgress() {
	if e.progressCallback != nil {
		e.progressCallback(e.progress)
	}
}

// verify performs post-transfer verification
func (e *SFTPExecutor) verify() *VerificationResult {
	// Simple file count verification
	sourceFiles, sourceSize := e.countFiles(e.sourceClient, e.request.SourceConfig.RootPath)
	destFiles, destSize := e.countFiles(e.destClient, e.request.DestConfig.RootPath)

	result := &VerificationResult{
		SourceFiles: sourceFiles,
		DestFiles:   destFiles,
		SourceSize:  sourceSize,
		DestSize:    destSize,
	}

	if destFiles >= e.progress.FilesTransferred {
		result.Success = true
		result.Message = "Transfer verified successfully"
	} else {
		result.Success = false
		result.MissingFiles = e.progress.FilesTransferred - destFiles
		result.Message = fmt.Sprintf("%d files missing at destination", result.MissingFiles)
	}

	return result
}

// countFiles counts files and calculates total size
func (e *SFTPExecutor) countFiles(client *sftp.Client, rootPath string) (int, int64) {
	var count int
	var size int64

	walker := client.Walk(rootPath)
	for walker.Step() {
		if walker.Err() != nil {
			continue
		}
		if !walker.Stat().IsDir() {
			count++
			size += walker.Stat().Size()
		}
	}

	return count, size
}

// Pause pauses the transfer
func (e *SFTPExecutor) Pause() {
	e.paused = true
	e.progress.Status = "paused"
	e.sendProgress()
}

// Resume resumes the transfer
func (e *SFTPExecutor) Resume() {
	e.paused = false
	e.progress.Status = "transferring"
	e.sendProgress()
}

// Cancel cancels the transfer
func (e *SFTPExecutor) Cancel() {
	e.cancelled = true
	e.progress.Status = "cancelled"
	e.sendProgress()
}

// closeSource closes source connections
func (e *SFTPExecutor) closeSource() {
	if e.sourceClient != nil {
		e.sourceClient.Close()
	}
	if e.sourceSSH != nil {
		e.sourceSSH.Close()
	}
}

// closeDest closes destination connections
func (e *SFTPExecutor) closeDest() {
	if e.destClient != nil {
		e.destClient.Close()
	}
	if e.destSSH != nil {
		e.destSSH.Close()
	}
}
