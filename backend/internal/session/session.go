// Package session provides job tracking and session management for migrations
package session

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gonzague/website-mover/backend/internal/probe"
	"github.com/gonzague/website-mover/backend/internal/scanner"
	"github.com/gonzague/website-mover/backend/internal/transfer"
)

// JobType represents the type of operation
type JobType string

const (
	JobTypeScan     JobType = "scan"
	JobTypePlan     JobType = "plan"
	JobTypeTransfer JobType = "transfer"
)

// JobStatus represents the current state of a job
type JobStatus string

const (
	JobStatusPending     JobStatus = "pending"
	JobStatusRunning     JobStatus = "running"
	JobStatusCompleted   JobStatus = "completed"
	JobStatusFailed      JobStatus = "failed"
	JobStatusCancelled   JobStatus = "cancelled"
	JobStatusPaused      JobStatus = "paused"
)

// Job represents a migration operation
type Job struct {
	ID          string                  `json:"id"`
	Type        JobType                 `json:"type"`
	Status      JobStatus               `json:"status"`
	CreatedAt   time.Time               `json:"created_at"`
	UpdatedAt   time.Time               `json:"updated_at"`
	CompletedAt *time.Time              `json:"completed_at,omitempty"`
	
	// Source and destination
	SourceConfig *probe.ConnectionConfig `json:"source_config"`
	DestConfig   *probe.ConnectionConfig `json:"dest_config,omitempty"`
	
	// Results
	ScanResult     *scanner.ScanResult   `json:"scan_result,omitempty"`
	PlanResult     *scanner.PlanResult   `json:"plan_result,omitempty"`
	TransferResult *transfer.TransferResult `json:"transfer_result,omitempty"`
	
	// Progress tracking
	Progress interface{} `json:"progress,omitempty"`
	
	// Error tracking
	ErrorMessage string `json:"error_message,omitempty"`
	
	// Metadata
	UserAgent string `json:"user_agent,omitempty"`
	ClientIP  string `json:"client_ip,omitempty"`
}

// SessionManager manages all active and historical jobs
type SessionManager struct {
	jobs   map[string]*Job
	mu     sync.RWMutex
	maxAge time.Duration // How long to keep completed jobs
}

var (
	globalManager *SessionManager
	once          sync.Once
)

// GetManager returns the singleton session manager
func GetManager() *SessionManager {
	once.Do(func() {
		globalManager = &SessionManager{
			jobs:   make(map[string]*Job),
			maxAge: 24 * time.Hour, // Keep jobs for 24 hours
		}
		// Start cleanup routine
		go globalManager.cleanupRoutine()
	})
	return globalManager
}

// CreateJob creates a new job and returns its ID
func (sm *SessionManager) CreateJob(jobType JobType, sourceConfig *probe.ConnectionConfig, destConfig *probe.ConnectionConfig) string {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	
	id := uuid.New().String()
	job := &Job{
		ID:           id,
		Type:         jobType,
		Status:       JobStatusPending,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		SourceConfig: sourceConfig,
		DestConfig:   destConfig,
	}
	
	sm.jobs[id] = job
	log.Printf("Created job %s (type: %s)", id, jobType)
	
	return id
}

// GetJob retrieves a job by ID
func (sm *SessionManager) GetJob(id string) (*Job, error) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	
	job, exists := sm.jobs[id]
	if !exists {
		return nil, fmt.Errorf("job not found: %s", id)
	}
	
	return job, nil
}

// UpdateJobStatus updates a job's status
func (sm *SessionManager) UpdateJobStatus(id string, status JobStatus) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	
	job, exists := sm.jobs[id]
	if !exists {
		return fmt.Errorf("job not found: %s", id)
	}
	
	job.Status = status
	job.UpdatedAt = time.Now()
	
	if status == JobStatusCompleted || status == JobStatusFailed || status == JobStatusCancelled {
		now := time.Now()
		job.CompletedAt = &now
	}
	
	log.Printf("Job %s status updated: %s", id, status)
	
	return nil
}

// UpdateJobProgress updates a job's progress
func (sm *SessionManager) UpdateJobProgress(id string, progress interface{}) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	
	job, exists := sm.jobs[id]
	if !exists {
		return fmt.Errorf("job not found: %s", id)
	}
	
	job.Progress = progress
	job.UpdatedAt = time.Now()
	
	return nil
}

// SetJobResult stores the result of a completed job
func (sm *SessionManager) SetJobResult(id string, result interface{}) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	
	job, exists := sm.jobs[id]
	if !exists {
		return fmt.Errorf("job not found: %s", id)
	}
	
	switch job.Type {
	case JobTypeScan:
		if scanResult, ok := result.(*scanner.ScanResult); ok {
			job.ScanResult = scanResult
		}
	case JobTypePlan:
		if planResult, ok := result.(*scanner.PlanResult); ok {
			job.PlanResult = planResult
		}
	case JobTypeTransfer:
		if transferResult, ok := result.(*transfer.TransferResult); ok {
			job.TransferResult = transferResult
		}
	}
	
	job.UpdatedAt = time.Now()
	
	return nil
}

// SetJobError sets an error message for a job
func (sm *SessionManager) SetJobError(id string, err error) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	
	job, exists := sm.jobs[id]
	if !exists {
		return fmt.Errorf("job not found: %s", id)
	}
	
	job.ErrorMessage = err.Error()
	job.UpdatedAt = time.Now()
	
	return nil
}

// ListJobs returns all jobs, optionally filtered by status
func (sm *SessionManager) ListJobs(statusFilter *JobStatus) []*Job {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	
	jobs := make([]*Job, 0)
	for _, job := range sm.jobs {
		if statusFilter == nil || job.Status == *statusFilter {
			jobs = append(jobs, job)
		}
	}
	
	return jobs
}

// GetActiveJobs returns all jobs that are pending or running
func (sm *SessionManager) GetActiveJobs() []*Job {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	
	jobs := make([]*Job, 0)
	for _, job := range sm.jobs {
		if job.Status == JobStatusPending || job.Status == JobStatusRunning || job.Status == JobStatusPaused {
			jobs = append(jobs, job)
		}
	}
	
	return jobs
}

// DeleteJob removes a job (only if completed/failed/cancelled)
func (sm *SessionManager) DeleteJob(id string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	
	job, exists := sm.jobs[id]
	if !exists {
		return fmt.Errorf("job not found: %s", id)
	}
	
	if job.Status == JobStatusRunning || job.Status == JobStatusPending {
		return fmt.Errorf("cannot delete active job")
	}
	
	delete(sm.jobs, id)
	log.Printf("Deleted job %s", id)
	
	return nil
}

// CancelJob attempts to cancel a job
func (sm *SessionManager) CancelJob(id string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	
	job, exists := sm.jobs[id]
	if !exists {
		return fmt.Errorf("job not found: %s", id)
	}
	
	if job.Status == JobStatusCompleted || job.Status == JobStatusFailed || job.Status == JobStatusCancelled {
		return fmt.Errorf("job already finished")
	}
	
	job.Status = JobStatusCancelled
	now := time.Now()
	job.CompletedAt = &now
	job.UpdatedAt = now
	
	log.Printf("Cancelled job %s", id)
	
	return nil
}

// cleanupRoutine removes old completed jobs
func (sm *SessionManager) cleanupRoutine() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()
	
	for range ticker.C {
		sm.cleanup()
	}
}

func (sm *SessionManager) cleanup() {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	
	now := time.Now()
	deletedCount := 0
	
	for id, job := range sm.jobs {
		if job.CompletedAt != nil {
			age := now.Sub(*job.CompletedAt)
			if age > sm.maxAge {
				delete(sm.jobs, id)
				deletedCount++
			}
		}
	}
	
	if deletedCount > 0 {
		log.Printf("Cleaned up %d old jobs", deletedCount)
	}
}

// MarshalJSON custom JSON marshaling to avoid mutex serialization
func (sm *SessionManager) MarshalJSON() ([]byte, error) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	
	return json.Marshal(sm.jobs)
}

