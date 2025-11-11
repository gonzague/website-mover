// Package scanner provides file system scanning and CMS detection capabilities
// for website migration. It recursively scans directories, detects CMS platforms,
// and generates migration strategies.
package scanner

import (
	"fmt"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/gonzague/website-mover/backend/internal/probe"
	"github.com/gonzague/website-mover/backend/internal/sshutil"
	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

// ProgressCallback is called with progress updates
type ProgressCallback func(progress ScanProgress)

// Scanner handles file system scanning
type Scanner struct {
	config       probe.ConnectionConfig
	sshClient    *ssh.Client
	sftpClient   *sftp.Client
	progress     *ScanProgress
	exclusions   []ExclusionPattern
	maxDepth     int
	maxFiles     int
	followSymlinks bool
	includeHidden bool
	progressCallback ProgressCallback
}

// NewScanner creates a new scanner instance
func NewScanner(config probe.ConnectionConfig) *Scanner {
	return &Scanner{
		config:   config,
		progress: &ScanProgress{Status: "initializing"},
		exclusions: getDefaultExclusions(),
		maxDepth: 0,
		maxFiles: 0,
		followSymlinks: false,
		includeHidden: false,
	}
}

// SetProgressCallback sets the callback for progress updates
func (s *Scanner) SetProgressCallback(callback ProgressCallback) {
	s.progressCallback = callback
}

// sendProgress sends a progress update if callback is set
func (s *Scanner) sendProgress() {
	if s.progressCallback != nil {
		s.progressCallback(*s.progress)
	}
}

// Connect establishes connection to the server
func (s *Scanner) Connect() error {
	if s.config.Protocol != probe.ProtocolSFTP {
		return fmt.Errorf("only SFTP scanning is supported currently")
	}

	// Create SFTP client using shared utility
	sftpClient, sshClient, err := sshutil.CreateSFTPClient(sshutil.ConnectionConfig{
		Host:     s.config.Host,
		Port:     s.config.Port,
		Username: s.config.Username,
		Password: s.config.Password,
		SSHKey:   s.config.SSHKey,
		Timeout:  10 * time.Second,
	})
	if err != nil {
		return fmt.Errorf("connection failed: %w", err)
	}

	s.sshClient = sshClient
	s.sftpClient = sftpClient

	return nil
}

// Close closes the scanner connections
func (s *Scanner) Close() {
	if s.sftpClient != nil {
		s.sftpClient.Close()
	}
	if s.sshClient != nil {
		s.sshClient.Close()
	}
}

// Scan performs the recursive file scan
func (s *Scanner) Scan(request ScanRequest) (*ScanResult, error) {
	startTime := time.Now()

	s.maxDepth = request.MaxDepth
	s.maxFiles = request.MaxFiles
	s.followSymlinks = request.FollowSymlinks
	s.includeHidden = request.IncludeHidden

	// Add custom exclusions
	for _, pattern := range request.CustomExclusions {
		s.exclusions = append(s.exclusions, ExclusionPattern{
			Pattern:     pattern,
			Type:        "glob",
			Reason:      "User defined",
			IsAutomatic: false,
			Enabled:     true,
		})
	}

	// Connect to server
	if err := s.Connect(); err != nil {
		return &ScanResult{
			Success:      false,
			ErrorMessage: err.Error(),
			StartTime:    startTime,
			EndTime:      time.Now(),
		}, err
	}
	defer s.Close()

	// Perform scan
	s.progress.Status = "scanning"
	s.progress.Message = "Starting file scan..."
	s.sendProgress()

	var allFiles []FileEntry
	err := s.scanDirectory(s.config.RootPath, 0, &allFiles)

	endTime := time.Now()
	duration := endTime.Sub(startTime)

	if err != nil && len(allFiles) == 0 {
		return &ScanResult{
			Success:      false,
			ErrorMessage: err.Error(),
			StartTime:    startTime,
			EndTime:      endTime,
			Duration:     duration,
		}, err
	}

	// Calculate statistics
	stats := s.calculateStatistics(allFiles)

	// Detect CMS if requested
	var cmsDetection *CMSDetection
	if request.DetectCMS {
		s.progress.Status = "analyzing"
		s.progress.Message = "Detecting CMS..."
		cmsDetection = s.detectCMS(allFiles)
	}

	s.progress.Status = "complete"
	s.progress.PercentComplete = 100.0

	return &ScanResult{
		Success:      true,
		StartTime:    startTime,
		EndTime:      endTime,
		Duration:     duration,
		Statistics:   stats,
		CMSDetection: cmsDetection,
		Files:        allFiles,
		Exclusions:   s.exclusions,
		ServerConfig: s.config,
	}, nil
}

// scanDirectory recursively scans a directory
func (s *Scanner) scanDirectory(dirPath string, depth int, allFiles *[]FileEntry) error {
	// Check depth limit
	if s.maxDepth > 0 && depth > s.maxDepth {
		return nil
	}

	// Check file limit
	if s.maxFiles > 0 && len(*allFiles) >= s.maxFiles {
		return nil
	}

	s.progress.CurrentPath = dirPath
	s.progress.DirsScanned++

	// Send progress update every 10 directories
	if s.progress.DirsScanned%10 == 0 {
		s.progress.Message = fmt.Sprintf("Scanning: %s", dirPath)
		s.sendProgress()
	}

	// Read directory
	entries, err := s.sftpClient.ReadDir(dirPath)
	if err != nil {
		s.progress.ErrorsEncountered++
		return fmt.Errorf("failed to read directory %s: %w", dirPath, err)
	}

	for _, entry := range entries {
		// Check file limit again
		if s.maxFiles > 0 && len(*allFiles) >= s.maxFiles {
			break
		}

		name := entry.Name()
		fullPath := path.Join(dirPath, name)

		// Skip hidden files if not included
		if !s.includeHidden && strings.HasPrefix(name, ".") {
			continue
		}

		// Check exclusions
		excluded, reason := s.shouldExclude(fullPath, name, entry.IsDir())

		fileEntry := FileEntry{
			Path:          fullPath,
			Name:          name,
			Size:          entry.Size(),
			IsDir:         entry.IsDir(),
			ModTime:       entry.ModTime(),
			Permissions:   entry.Mode().String(),
			IsSymlink:     entry.Mode()&0o120000 != 0,
			ShouldExclude: excluded,
			ExcludeReason: reason,
		}

		// Get extension and mime type for files
		if !entry.IsDir() {
			fileEntry.Extension = strings.ToLower(filepath.Ext(name))
			fileEntry.MimeType = getMimeType(fileEntry.Extension)
		}

		*allFiles = append(*allFiles, fileEntry)
		s.progress.FilesScanned++
		s.progress.TotalSize += entry.Size()

		// Recurse into directories
		if entry.IsDir() && !excluded {
			if err := s.scanDirectory(fullPath, depth+1, allFiles); err != nil {
				// Continue scanning other directories even if one fails
				continue
			}
		}
	}

	return nil
}

// shouldExclude checks if a path should be excluded
func (s *Scanner) shouldExclude(fullPath, name string, isDir bool) (bool, string) {
	for _, exclusion := range s.exclusions {
		if !exclusion.Enabled {
			continue
		}

		switch exclusion.Type {
		case "exact":
			if name == exclusion.Pattern || fullPath == exclusion.Pattern {
				return true, exclusion.Reason
			}
		case "glob":
			matched, _ := filepath.Match(exclusion.Pattern, name)
			if matched {
				return true, exclusion.Reason
			}
			// Also check full path
			matched, _ = filepath.Match(exclusion.Pattern, fullPath)
			if matched {
				return true, exclusion.Reason
			}
			// Check if path contains pattern (for directories)
			if strings.Contains(fullPath, exclusion.Pattern) {
				return true, exclusion.Reason
			}
		}
	}
	return false, ""
}

// calculateStatistics computes file statistics
func (s *Scanner) calculateStatistics(files []FileEntry) FileStatistics {
	stats := FileStatistics{
		FilesByType:     make(map[string]int),
		FilesByTypeSize: make(map[string]int64),
	}

	var largestFiles []FileEntry
	maxDepth := 0

	for _, file := range files {
		if file.IsDir {
			stats.TotalDirs++
			// Calculate depth
			depth := strings.Count(file.Path, "/")
			if depth > maxDepth {
				maxDepth = depth
			}
		} else {
			stats.TotalFiles++
			stats.TotalSize += file.Size

			// Track by extension
			ext := file.Extension
			if ext == "" {
				ext = "no-extension"
			}
			stats.FilesByType[ext]++
			stats.FilesByTypeSize[ext] += file.Size

			// Track largest files
			largestFiles = append(largestFiles, file)
		}

		if file.IsSymlink {
			stats.SymlinksCount++
		}

		if file.ShouldExclude {
			stats.ExcludedCount++
			stats.ExcludedSize += file.Size
		}
	}

	// Sort and get top 10 largest files
	sort.Slice(largestFiles, func(i, j int) bool {
		return largestFiles[i].Size > largestFiles[j].Size
	})
	if len(largestFiles) > 10 {
		stats.LargestFiles = largestFiles[:10]
	} else {
		stats.LargestFiles = largestFiles
	}

	stats.DirectoryDepth = maxDepth
	stats.TotalSizeHuman = formatBytes(stats.TotalSize)

	return stats
}

// getDefaultExclusions returns common exclusion patterns
func getDefaultExclusions() []ExclusionPattern {
	return []ExclusionPattern{
		{Pattern: ".git", Type: "exact", Reason: "Version control", IsAutomatic: true, Enabled: true},
		{Pattern: ".svn", Type: "exact", Reason: "Version control", IsAutomatic: true, Enabled: true},
		{Pattern: "node_modules", Type: "exact", Reason: "Dependencies", IsAutomatic: true, Enabled: true},
		{Pattern: "vendor", Type: "glob", Reason: "Dependencies", IsAutomatic: true, Enabled: true},
		{Pattern: "*.log", Type: "glob", Reason: "Log files", IsAutomatic: true, Enabled: true},
		{Pattern: "*.tmp", Type: "glob", Reason: "Temporary files", IsAutomatic: true, Enabled: true},
		{Pattern: "cache", Type: "glob", Reason: "Cache directory", IsAutomatic: true, Enabled: true},
		{Pattern: "tmp", Type: "glob", Reason: "Temporary directory", IsAutomatic: true, Enabled: true},
		{Pattern: ".DS_Store", Type: "exact", Reason: "macOS metadata", IsAutomatic: true, Enabled: true},
		{Pattern: "Thumbs.db", Type: "exact", Reason: "Windows metadata", IsAutomatic: true, Enabled: true},
	}
}

// getMimeType returns mime type based on extension
func getMimeType(ext string) string {
	mimeTypes := map[string]string{
		".html": "text/html",
		".htm":  "text/html",
		".php":  "application/x-php",
		".js":   "application/javascript",
		".css":  "text/css",
		".json": "application/json",
		".xml":  "application/xml",
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
		".gif":  "image/gif",
		".svg":  "image/svg+xml",
		".pdf":  "application/pdf",
		".zip":  "application/zip",
		".tar":  "application/x-tar",
		".gz":   "application/gzip",
		".sql":  "application/sql",
		".txt":  "text/plain",
		".md":   "text/markdown",
	}

	if mime, ok := mimeTypes[ext]; ok {
		return mime
	}
	return "application/octet-stream"
}

// formatBytes converts bytes to human readable format
func formatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}
