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

// MigrationJob represents a running migration
type MigrationJob struct {
	ID          string    `json:"id"`
	Options     MigrationOptions `json:"options"`
	Command     string    `json:"command"`
	StartTime   time.Time `json:"start_time"`
	Status      string    `json:"status"` // running, completed, failed
	Output      []string  `json:"-"`
	outputMux   sync.RWMutex
	subscribers []chan string
	subMux      sync.RWMutex
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
		subscribers: []chan string{},
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
		}
	}()

	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			job.addOutput(line)
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
		case ch <- line:
		default:
			// Subscriber not ready, skip
		}
	}
}

// Subscribe returns a channel that receives output lines
func (j *MigrationJob) Subscribe() chan string {
	ch := make(chan string, 100)
	
	j.subMux.Lock()
	j.subscribers = append(j.subscribers, ch)
	j.subMux.Unlock()

	// Send only last 100 lines of historical output to avoid overwhelming browser
	j.outputMux.RLock()
	startIdx := 0
	if len(j.Output) > 100 {
		startIdx = len(j.Output) - 100
		ch <- fmt.Sprintf("... (showing last 100 of %d lines) ...", len(j.Output))
	}
	for _, line := range j.Output[startIdx:] {
		ch <- line
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

