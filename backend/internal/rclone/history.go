package rclone

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

// MigrationHistory represents a completed migration
type MigrationHistory struct {
	ID        string           `json:"id"`
	Options   MigrationOptions `json:"options"`
	Command   string           `json:"command"`
	StartTime time.Time        `json:"start_time"`
	EndTime   time.Time        `json:"end_time"`
	Duration  string           `json:"duration"`
	Status    string           `json:"status"`
	Output    []string         `json:"output,omitempty"`
	
	// Stats
	TotalBytes    int64  `json:"total_bytes"`
	TotalFiles    int64  `json:"total_files"`
	TransferSpeed string `json:"transfer_speed"`
}

// HistoryStore manages migration history
type HistoryStore struct {
	historyFile string
	mux         sync.RWMutex
}

// NewHistoryStore creates a new history store
func NewHistoryStore(dataDir string) (*HistoryStore, error) {
	if dataDir == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return nil, err
		}
		dataDir = filepath.Join(homeDir, ".config", "website-mover")
	}

	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}

	historyFile := filepath.Join(dataDir, "history.json")
	
	// Create empty history if it doesn't exist
	if _, err := os.Stat(historyFile); os.IsNotExist(err) {
		if err := os.WriteFile(historyFile, []byte("[]"), 0644); err != nil {
			return nil, err
		}
	}

	return &HistoryStore{
		historyFile: historyFile,
	}, nil
}

// Add adds a migration to history
func (hs *HistoryStore) Add(job *MigrationJob, endTime time.Time) error {
	hs.mux.Lock()
	defer hs.mux.Unlock()

	history := MigrationHistory{
		ID:        job.ID,
		Options:   job.Options,
		Command:   job.Command,
		StartTime: job.StartTime,
		EndTime:   endTime,
		Duration:  endTime.Sub(job.StartTime).Round(time.Second).String(),
		Status:    job.Status,
		Output:    job.GetOutput(),
		
		// Stats
		TotalBytes:    job.Stats.TotalBytes,
		TotalFiles:    job.Stats.TotalFiles,
		TransferSpeed: job.Stats.TransferSpeed,
	}

	// Read existing history
	histories, err := hs.loadHistory()
	if err != nil {
		return err
	}

	// Add new history
	histories = append(histories, history)

	// Keep only last 100
	if len(histories) > 100 {
		histories = histories[len(histories)-100:]
	}

	// Save
	return hs.saveHistory(histories)
}

// List returns all migration history
func (hs *HistoryStore) List() ([]MigrationHistory, error) {
	hs.mux.RLock()
	defer hs.mux.RUnlock()

	histories, err := hs.loadHistory()
	if err != nil {
		return nil, err
	}

	// Sort by start time descending (newest first)
	sort.Slice(histories, func(i, j int) bool {
		return histories[i].StartTime.After(histories[j].StartTime)
	})

	return histories, nil
}

// Get returns a specific migration by ID
func (hs *HistoryStore) Get(id string) (*MigrationHistory, error) {
	hs.mux.RLock()
	defer hs.mux.RUnlock()

	histories, err := hs.loadHistory()
	if err != nil {
		return nil, err
	}

	for _, h := range histories {
		if h.ID == id {
			return &h, nil
		}
	}

	return nil, os.ErrNotExist
}

func (hs *HistoryStore) loadHistory() ([]MigrationHistory, error) {
	data, err := os.ReadFile(hs.historyFile)
	if err != nil {
		return nil, err
	}

	var histories []MigrationHistory
	if err := json.Unmarshal(data, &histories); err != nil {
		return nil, err
	}

	return histories, nil
}

func (hs *HistoryStore) saveHistory(histories []MigrationHistory) error {
	data, err := json.MarshalIndent(histories, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(hs.historyFile, data, 0644)
}

// Clear clears all migration history
func (hs *HistoryStore) Clear() error {
	hs.mux.Lock()
	defer hs.mux.Unlock()

	return hs.saveHistory([]MigrationHistory{})
}

