package rclone

import (
	"bufio"
	"context"
	"fmt"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// buildDisplayCommand creates a properly quoted command string for display/copy-paste
func buildDisplayCommand(parts []string) string {
	quoted := make([]string, len(parts))
	for i, part := range parts {
		// Quote if contains special characters
		if strings.ContainsAny(part, " *[]{}$();&|<>\"'`\\") {
			quoted[i] = fmt.Sprintf("'%s'", strings.ReplaceAll(part, "'", "'\\''"))
		} else {
			quoted[i] = part
		}
	}
	return strings.Join(quoted, " ")
}

// TestResult represents the result of a connectivity test
type TestResult struct {
	Success bool     `json:"success"`
	Message string   `json:"message"`
	Files   []string `json:"files,omitempty"`
	Error   string   `json:"error,omitempty"`
}

// MigrationOptions represents options for a migration
type MigrationOptions struct {
	SourceRemote      string   `json:"source_remote"`
	SourcePath        string   `json:"source_path"`
	DestRemote        string   `json:"dest_remote"`
	DestPath          string   `json:"dest_path"`
	Excludes          []string `json:"excludes"`
	Transfers         int      `json:"transfers"`
	Checkers          int      `json:"checkers"`
	BandwidthLimit    string   `json:"bandwidth_limit,omitempty"`
	DryRun            bool     `json:"dry_run"`
	DeleteExtraneous  bool     `json:"delete_extraneous"` // sync instead of copy
}

// JobStats represents live migration statistics
type JobStats struct {
	TotalBytes    int64  `json:"total_bytes"`
	TotalFiles    int64  `json:"total_files"`
	TransferSpeed string `json:"transfer_speed"`
}

// StreamEvent represents an event in the migration stream
type StreamEvent struct {
	Type  string    `json:"type"` // "output" or "stats"
	Line  string    `json:"line,omitempty"`
	Stats *JobStats `json:"stats,omitempty"`
}

// MigrationJob represents a running migration
type MigrationJob struct {
	ID          string    `json:"id"`
	Options     MigrationOptions `json:"options"`
	Command     string    `json:"command"`
	StartTime   time.Time `json:"start_time"`
	Status      string    `json:"status"` // running, completed, failed
	Output      []string  `json:"-"`
	outputMux   sync.RWMutex
	subscribers []chan StreamEvent
	subMux      sync.RWMutex
	
	// Live Stats
	Stats JobStats
}

// Executor handles rclone command execution
type Executor struct {
	configPath string
}

// NewExecutor creates a new executor
func NewExecutor(configPath string) *Executor {
	return &Executor{
		configPath: configPath,
	}
}

// TestRemote tests connectivity to a remote
func (e *Executor) TestRemote(ctx context.Context, remoteName, path string) TestResult {
	remotePath := fmt.Sprintf("%s:%s", remoteName, path)
	
	cmd := exec.CommandContext(ctx, "rclone", "ls", remotePath, "--max-depth", "1")
	if e.configPath != "" {
		cmd.Args = append(cmd.Args, "--config", e.configPath)
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return TestResult{
			Success: false,
			Message: "Failed to connect",
			Error:   fmt.Sprintf("%v: %s", err, string(output)),
		}
	}

	// Parse output to get file list
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	files := []string{}
	for _, line := range lines {
		if line != "" {
			// rclone ls format: "size filename"
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				files = append(files, strings.Join(parts[1:], " "))
			}
		}
	}

	if len(files) > 10 {
		files = files[:10]
	}

	return TestResult{
		Success: true,
		Message: fmt.Sprintf("Successfully connected. Found %d items", len(lines)),
		Files:   files,
	}
}

// FileItem represents a file or directory
type FileItem struct {
	Name  string `json:"name"`
	IsDir bool   `json:"is_dir"`
	Size  int64  `json:"size"`
}

// ListPath lists contents of a remote path
func (e *Executor) ListPath(ctx context.Context, remoteName, path string) ([]FileItem, error) {
	remotePath := fmt.Sprintf("%s:%s", remoteName, path)
	
	// Use lsf for machine readable listing of both files and dirs
	// -F "ps" : path, size
	// --dir-slash : add slash to dir names
	// --separator : use pipe as separator
	cmd := exec.CommandContext(ctx, "rclone", "lsf", remotePath, "-F", "ps", "--dir-slash", "--separator", "|")
	if e.configPath != "" {
		cmd.Args = append(cmd.Args, "--config", e.configPath)
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("rclone lsf failed: %v: %s", err, string(output))
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	items := []FileItem{}
	
	for _, line := range lines {
		if line == "" {
			continue
		}
		
		parts := strings.Split(line, "|")
		if len(parts) < 2 {
			continue
		}
		
		name := parts[0]
		sizeStr := strings.TrimSpace(parts[1])
		
		isDir := strings.HasSuffix(name, "/")
		cleanName := strings.TrimSuffix(name, "/")
		
		var size int64
		fmt.Sscanf(sizeStr, "%d", &size)
		
		items = append(items, FileItem{
			Name:  cleanName,
			IsDir: isDir,
			Size:  size,
		})
	}
	
	return items, nil
}

// StartMigration starts a migration job
func (e *Executor) StartMigration(ctx context.Context, opts MigrationOptions) (*MigrationJob, error) {
	// Build rclone command
	cmdParts := []string{"rclone"}
	
	// Use sync if delete_extraneous, otherwise copy
	if opts.DeleteExtraneous {
		cmdParts = append(cmdParts, "sync")
	} else {
		cmdParts = append(cmdParts, "copy")
	}

	// Source and destination
	sourcePath := fmt.Sprintf("%s:%s", opts.SourceRemote, opts.SourcePath)
	destPath := fmt.Sprintf("%s:%s", opts.DestRemote, opts.DestPath)
	cmdParts = append(cmdParts, sourcePath, destPath)

	// Options (use -v instead of -vv to reduce verbosity)
	cmdParts = append(cmdParts, "-v", "--progress", "--stats=10s")
	
	if opts.Transfers > 0 {
		cmdParts = append(cmdParts, fmt.Sprintf("--transfers=%d", opts.Transfers))
	}
	if opts.Checkers > 0 {
		cmdParts = append(cmdParts, fmt.Sprintf("--checkers=%d", opts.Checkers))
	}
	if opts.BandwidthLimit != "" {
		cmdParts = append(cmdParts, fmt.Sprintf("--bwlimit=%s", opts.BandwidthLimit))
	}
	if opts.DryRun {
		cmdParts = append(cmdParts, "--dry-run")
	}

	// Excludes
	for _, exclude := range opts.Excludes {
		cmdParts = append(cmdParts, "--exclude", exclude)
	}

	if e.configPath != "" {
		cmdParts = append(cmdParts, "--config", e.configPath)
	}

	// Create job with properly quoted command string for display
	displayCmd := buildDisplayCommand(cmdParts)
	job := &MigrationJob{
		ID:          fmt.Sprintf("mig-%d", time.Now().Unix()),
		Options:     opts,
		Command:     displayCmd,
		StartTime:   time.Now(),
		Status:      "running",
		Output:      []string{},
		subscribers: []chan StreamEvent{},
	}

	// Start command
	cmd := exec.CommandContext(ctx, cmdParts[0], cmdParts[1:]...)
	
	// Log command being executed
	job.addOutput(fmt.Sprintf("Executing: %s", displayCmd))
	job.addOutput(fmt.Sprintf("Working directory: %s", cmd.Dir))
	job.addOutput("---")
	
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to get stdout pipe: %w", err)
	}
	
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to get stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start command: %w", err)
	}
	
	job.addOutput(fmt.Sprintf("Process started with PID: %d", cmd.Process.Pid))

	// Read output in goroutine
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			job.addOutput(line)
			job.parseStats(line)
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			job.addOutput(line)
			// Rclone sends some info to stderr too
		}
	}()

	// Wait for completion in goroutine
	go func() {
		err := cmd.Wait()
		if err != nil {
			job.Status = "failed"
			job.addOutput(fmt.Sprintf("ERROR: %v", err))
		} else {
			job.Status = "completed"
			job.addOutput("Migration completed successfully")
		}
		job.closeSubscribers()
	}()

	return job, nil
}

// addOutput adds a line to the job output and notifies subscribers
func (j *MigrationJob) addOutput(line string) {
	j.outputMux.Lock()
	j.Output = append(j.Output, line)
	
	// Keep only last 1000 lines to prevent memory issues
	if len(j.Output) > 1000 {
		j.Output = j.Output[len(j.Output)-1000:]
	}
	j.outputMux.Unlock()

	j.subMux.RLock()
	defer j.subMux.RUnlock()
	
	for _, ch := range j.subscribers {
		select {
		case ch <- StreamEvent{Type: "output", Line: line}:
		default:
			// Subscriber not ready, skip
		}
	}
}

// Subscribe returns a channel that receives output lines
func (j *MigrationJob) Subscribe() chan StreamEvent {
	ch := make(chan StreamEvent, 100)
	
	j.subMux.Lock()
	j.subscribers = append(j.subscribers, ch)
	j.subMux.Unlock()

	// Send only last 100 lines of historical output to avoid overwhelming browser
	j.outputMux.RLock()
	startIdx := 0
	if len(j.Output) > 100 {
		startIdx = len(j.Output) - 100
		ch <- StreamEvent{
			Type: "output",
			Line: fmt.Sprintf("... (showing last 100 of %d lines) ...", len(j.Output)),
		}
	}
	for _, line := range j.Output[startIdx:] {
		ch <- StreamEvent{Type: "output", Line: line}
	}
	j.outputMux.RUnlock()

	return ch
}

// closeSubscribers closes all subscriber channels
func (j *MigrationJob) closeSubscribers() {
	j.subMux.Lock()
	defer j.subMux.Unlock()
	
	for _, ch := range j.subscribers {
		close(ch)
	}
	j.subscribers = nil
}

// GetOutput returns all output lines
func (j *MigrationJob) GetOutput() []string {
	j.outputMux.RLock()
	defer j.outputMux.RUnlock()
	
	output := make([]string, len(j.Output))
	copy(output, j.Output)
	return output
}

// parseStats extracts stats from rclone output
func (j *MigrationJob) parseStats(line string) {
	line = strings.TrimSpace(line)
	updated := false
	
	// Example: Transferred: 115.477 MiB / 115.477 MiB, 100%, 9.623 MiB/s, ETA 0s
	if strings.HasPrefix(line, "Transferred:") {
		if strings.Contains(line, ",") {
			parts := strings.Split(line, ",")
			if len(parts) >= 3 {
				// Extract Speed
				speed := strings.TrimSpace(parts[2])
				if strings.Contains(speed, "/s") {
					j.Stats.TransferSpeed = speed
					updated = true
				}
				
				// Extract Total Bytes
				byteParts := strings.Split(parts[0], "/")
				if len(byteParts) == 2 {
					totalStr := strings.TrimSpace(byteParts[1])
					j.Stats.TotalBytes = parseSizeString(totalStr)
					updated = true
				}
			}
		}
		
		if !strings.Contains(line, "/s") && strings.Contains(line, "/") {
			// Likely files: Transferred: 0 / 1, 0%
			parts := strings.Split(line, ",")
			if len(parts) >= 1 {
				fileParts := strings.Split(parts[0], "/")
				if len(fileParts) == 2 {
					totalFilesStr := strings.TrimSpace(fileParts[1])
					var totalFiles int64
					fmt.Sscanf(totalFilesStr, "%d", &totalFiles)
					if totalFiles > 0 {
						j.Stats.TotalFiles = totalFiles
						updated = true
					}
				}
			}
		}
	}

	if updated {
		j.subMux.RLock()
		defer j.subMux.RUnlock()
		
		statsCopy := j.Stats // Copy struct
		event := StreamEvent{
			Type:  "stats",
			Stats: &statsCopy,
		}
		
		for _, ch := range j.subscribers {
			select {
			case ch <- event:
			default:
			}
		}
	}
}

func parseSizeString(s string) int64 {
	var val float64
	var unit string
	fmt.Sscanf(s, "%f %s", &val, &unit)
	
	multiplier := int64(1)
	switch strings.ToUpper(unit) {
	case "KIB": multiplier = 1024
	case "MIB": multiplier = 1024 * 1024
	case "GIB": multiplier = 1024 * 1024 * 1024
	case "TIB": multiplier = 1024 * 1024 * 1024 * 1024
	case "KB": multiplier = 1000
	case "MB": multiplier = 1000 * 1000
	case "GB": multiplier = 1000 * 1000 * 1000
	}
	
	return int64(val * float64(multiplier))
}

