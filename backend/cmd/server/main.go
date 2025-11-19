package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
	
	"github.com/gonzague/website-mover/backend/internal/rclone"
)

type Server struct {
	configManager *rclone.ConfigManager
	executor      *rclone.Executor
	historyStore  *rclone.HistoryStore
	
	// Track active jobs
	activeJobs map[string]*rclone.MigrationJob
	jobsMux    sync.RWMutex
}

func main() {
	// Initialize components
	configManager, err := rclone.NewConfigManager("")
	if err != nil {
		log.Fatalf("Failed to initialize config manager: %v", err)
	}

	historyStore, err := rclone.NewHistoryStore("")
	if err != nil {
		log.Fatalf("Failed to initialize history store: %v", err)
	}

	executor := rclone.NewExecutor(configManager.GetConfigPath())

	server := &Server{
		configManager: configManager,
		executor:      executor,
		historyStore:  historyStore,
		activeJobs:    make(map[string]*rclone.MigrationJob),
	}

	// Setup router
	router := mux.NewRouter()
	
	// Remotes endpoints
	router.HandleFunc("/api/remotes", server.handleListRemotes).Methods("GET")
	router.HandleFunc("/api/remotes", server.handleAddRemote).Methods("POST")
	router.HandleFunc("/api/remotes/{name}", server.handleDeleteRemote).Methods("DELETE")
	router.HandleFunc("/api/remotes/test", server.handleTestRemote).Methods("POST")
	
	// Migration endpoints
	router.HandleFunc("/api/migrations", server.handleStartMigration).Methods("POST")
	router.HandleFunc("/api/migrations", server.handleListMigrations).Methods("GET")
	router.HandleFunc("/api/migrations/{id}/stream", server.handleStreamMigration).Methods("GET")
	router.HandleFunc("/api/migrations/active", server.handleListActiveJobs).Methods("GET")
	
	// History endpoints
	router.HandleFunc("/api/history", server.handleListHistory).Methods("GET")
	router.HandleFunc("/api/history/{id}", server.handleGetHistory).Methods("GET")

	// CORS
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	handler := c.Handler(router)

	// Start server
	port := ":8080"
	log.Printf("Server starting on %s", port)
	log.Printf("Rclone config: %s", configManager.GetConfigPath())
	
	if err := http.ListenAndServe(port, handler); err != nil {
		log.Fatal(err)
	}
}

// handleListRemotes returns all configured remotes
func (s *Server) handleListRemotes(w http.ResponseWriter, r *http.Request) {
	remotes, err := s.configManager.ListRemotes()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"remotes": remotes,
	})
}

// handleAddRemote adds or updates a remote
func (s *Server) handleAddRemote(w http.ResponseWriter, r *http.Request) {
	var remote rclone.Remote
	if err := json.NewDecoder(r.Body).Decode(&remote); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := s.configManager.AddRemote(remote); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Remote %s configured successfully", remote.Name),
	})
}

// handleDeleteRemote deletes a remote
func (s *Server) handleDeleteRemote(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	name := vars["name"]

	if err := s.configManager.DeleteRemote(name); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Remote %s deleted", name),
	})
}

// handleTestRemote tests connectivity to a remote
func (s *Server) handleTestRemote(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RemoteName string `json:"remote_name"`
		Path       string `json:"path"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	result := s.executor.TestRemote(ctx, req.RemoteName, req.Path)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// handleStartMigration starts a new migration
func (s *Server) handleStartMigration(w http.ResponseWriter, r *http.Request) {
	var opts rclone.MigrationOptions
	if err := json.NewDecoder(r.Body).Decode(&opts); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Set defaults
	if opts.Transfers == 0 {
		opts.Transfers = 8
	}
	if opts.Checkers == 0 {
		opts.Checkers = 8
	}

	// Use background context so migration continues after HTTP response
	job, err := s.executor.StartMigration(context.Background(), opts)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Track job
	s.jobsMux.Lock()
	s.activeJobs[job.ID] = job
	s.jobsMux.Unlock()

	// Monitor job completion
	go func() {
		// Wait for job to complete
		for job.Status == "running" {
			time.Sleep(1 * time.Second)
		}
		
		// Add to history
		if err := s.historyStore.Add(job, time.Now()); err != nil {
			log.Printf("Failed to add job to history: %v", err)
		}

		// Remove from active jobs
		s.jobsMux.Lock()
		delete(s.activeJobs, job.ID)
		s.jobsMux.Unlock()
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"job_id":  job.ID,
		"command": job.Command,
		"status":  job.Status,
	})
}

// handleStreamMigration streams migration output via SSE
func (s *Server) handleStreamMigration(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	jobID := vars["id"]

	// Find job
	s.jobsMux.RLock()
	job, exists := s.activeJobs[jobID]
	s.jobsMux.RUnlock()

	if !exists {
		http.Error(w, "Job not found", http.StatusNotFound)
		return
	}

	// Setup SSE
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	// Subscribe to job output
	ch := job.Subscribe()

	for {
		select {
		case <-r.Context().Done():
			return
		case line, ok := <-ch:
			if !ok {
				// Channel closed, job completed
				fmt.Fprintf(w, "data: {\"type\":\"complete\",\"status\":\"%s\"}\n\n", job.Status)
				flusher.Flush()
				return
			}
			
			// Send line
			data, _ := json.Marshal(map[string]string{
				"type": "output",
				"line": line,
			})
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}

// handleListActiveJobs lists currently running jobs
func (s *Server) handleListActiveJobs(w http.ResponseWriter, r *http.Request) {
	s.jobsMux.RLock()
	defer s.jobsMux.RUnlock()

	jobs := []map[string]interface{}{}
	for _, job := range s.activeJobs {
		jobs = append(jobs, map[string]interface{}{
			"id":         job.ID,
			"command":    job.Command,
			"start_time": job.StartTime,
			"status":     job.Status,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"jobs": jobs,
	})
}

// handleListMigrations lists all migrations (active + history)
func (s *Server) handleListMigrations(w http.ResponseWriter, r *http.Request) {
	// Get history
	history, err := s.historyStore.List()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Get active jobs
	s.jobsMux.RLock()
	activeJobs := make([]map[string]interface{}, 0, len(s.activeJobs))
	for _, job := range s.activeJobs {
		activeJobs = append(activeJobs, map[string]interface{}{
			"id":         job.ID,
			"command":    job.Command,
			"start_time": job.StartTime,
			"status":     job.Status,
			"options":    job.Options,
		})
	}
	s.jobsMux.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"active":  activeJobs,
		"history": history,
	})
}

// handleListHistory lists migration history
func (s *Server) handleListHistory(w http.ResponseWriter, r *http.Request) {
	history, err := s.historyStore.List()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"history": history,
	})
}

// handleGetHistory gets a specific history entry
func (s *Server) handleGetHistory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	history, err := s.historyStore.Get(id)
	if err != nil {
		http.Error(w, "History not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(history)
}
