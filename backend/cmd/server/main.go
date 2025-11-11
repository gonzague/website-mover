package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gonzague/website-mover/backend/internal/probe"
	"github.com/gonzague/website-mover/backend/internal/scanner"
	"github.com/gonzague/website-mover/backend/internal/transfer"
	"github.com/gonzague/website-mover/backend/internal/validation"
)

type HealthResponse struct {
	Status  string `json:"status"`
	Version string `json:"version"`
}

// writeJSON writes a JSON response with proper error handling
func writeJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		// Log the encoding error but can't change response at this point
		log.Printf("ERROR: Failed to encode JSON response: %v", err)
	}
}

// writeJSONError writes an error response with proper error handling
func writeJSONError(w http.ResponseWriter, statusCode int, message string) {
	writeJSON(w, statusCode, map[string]string{"error": message})
}

func main() {
	// Get port from environment variable or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Setup routes
	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/api/probe", probeHandler)
	http.HandleFunc("/api/scan", scanHandler)
	http.HandleFunc("/api/scan/stream", scanStreamHandler)
	http.HandleFunc("/api/plan", planHandler)
	http.HandleFunc("/api/transfer/stream", transferStreamHandler)

	// Enable CORS for local development
	handler := corsMiddleware(http.DefaultServeMux)

	// Start server
	addr := fmt.Sprintf("127.0.0.1:%s", port)
	log.Printf("Starting Website Mover backend server on %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, HealthResponse{
		Status:  "ok",
		Version: "0.1.0",
	})
}

func probeHandler(w http.ResponseWriter, r *http.Request) {
	// Only accept POST requests
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Parse request body
	var config probe.ConnectionConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		writeJSONError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request body: %v", err))
		return
	}

	// Set default ports based on protocol if not specified
	if config.Port == 0 {
		switch config.Protocol {
		case probe.ProtocolSFTP, probe.ProtocolSCP:
			config.Port = 22
		case probe.ProtocolFTP:
			config.Port = 21
		case probe.ProtocolFTPS:
			config.Port = 990
		default:
			config.Port = 22
		}
	}

	// Validate configuration
	if err := validation.ValidateConnectionConfig(&config); err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Run probe
	log.Printf("Probing %s://%s@%s:%d%s", config.Protocol, config.Username, config.Host, config.Port, config.RootPath)
	result, err := probe.Probe(config)

	if err != nil && result == nil {
		// Fatal error (couldn't even create result)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": fmt.Sprintf("Probe failed: %v", err),
		})
		return
	}

	// Return result (even if probe failed, we return partial results)
	json.NewEncoder(w).Encode(result)
}

func scanHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Parse request
	var scanReq scanner.ScanRequest
	if err := json.NewDecoder(r.Body).Decode(&scanReq); err != nil {
		writeJSONError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request body: %v", err))
		return
	}

	// Validate request
	if err := validation.ValidateScanRequest(&scanReq); err != nil {
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Validate required fields
	if scanReq.ServerConfig.Host == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Server host is required",
		})
		return
	}

	// Create scanner
	log.Printf("Starting scan of %s@%s:%d%s",
		scanReq.ServerConfig.Username,
		scanReq.ServerConfig.Host,
		scanReq.ServerConfig.Port,
		scanReq.ServerConfig.RootPath)

	scan := scanner.NewScanner(scanReq.ServerConfig)

	// Perform scan
	result, err := scan.Scan(scanReq)
	if err != nil && result == nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": fmt.Sprintf("Scan failed: %v", err),
		})
		return
	}

	// Return result (even if partial)
	json.NewEncoder(w).Encode(result)
}

func scanStreamHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Parse request
	var scanReq scanner.ScanRequest
	if err := json.NewDecoder(r.Body).Decode(&scanReq); err != nil {
		writeJSONError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request body: %v", err))
		return
	}

	// Validate
	if scanReq.ServerConfig.Host == "" {
		writeJSONError(w, http.StatusBadRequest, "Server host is required")
		return
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	// Create scanner with progress callback
	scan := scanner.NewScanner(scanReq.ServerConfig)

	// Set up progress callback to send SSE events
	scan.SetProgressCallback(func(progress scanner.ScanProgress) {
		data, _ := json.Marshal(progress)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	})

	log.Printf("Starting streaming scan of %s@%s:%d%s",
		scanReq.ServerConfig.Username,
		scanReq.ServerConfig.Host,
		scanReq.ServerConfig.Port,
		scanReq.ServerConfig.RootPath)

	// Perform scan
	result, err := scan.Scan(scanReq)

	// Send final result
	if err != nil && result == nil {
		errorData, _ := json.Marshal(map[string]string{
			"error": fmt.Sprintf("Scan failed: %v", err),
		})
		fmt.Fprintf(w, "event: error\ndata: %s\n\n", errorData)
	} else {
		resultData, _ := json.Marshal(result)
		fmt.Fprintf(w, "event: complete\ndata: %s\n\n", resultData)
	}
	flusher.Flush()
}

func planHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Parse request - expects scan result + both probe results + connection configs
	var planReq struct {
		ScanResult   *scanner.ScanResult     `json:"scan_result"`
		SourceProbe  *probe.ProbeResult      `json:"source_probe"`
		DestProbe    *probe.ProbeResult      `json:"dest_probe"`
		SourceConfig *probe.ConnectionConfig `json:"source_config"`
		DestConfig   *probe.ConnectionConfig `json:"dest_config"`
	}

	if err := json.NewDecoder(r.Body).Decode(&planReq); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": fmt.Sprintf("Invalid request body: %v", err),
		})
		return
	}

	// Validate
	if planReq.ScanResult == nil || planReq.SourceProbe == nil || planReq.DestProbe == nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "scan_result, source_probe, and dest_probe are required",
		})
		return
	}

	log.Printf("Generating migration plan...")

	// Generate plan
	plan := scanner.GeneratePlan(planReq.ScanResult, planReq.SourceProbe, planReq.DestProbe, planReq.SourceConfig, planReq.DestConfig)

	json.NewEncoder(w).Encode(plan)
}

func transferStreamHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Parse request
	var transferReq transfer.TransferRequest
	if err := json.NewDecoder(r.Body).Decode(&transferReq); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": fmt.Sprintf("Invalid request body: %v", err),
		})
		return
	}

	// Validate
	if transferReq.SourceConfig.Host == "" || transferReq.DestConfig.Host == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Source and destination configs are required",
		})
		return
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	log.Printf("Starting transfer from %s to %s using %s",
		transferReq.SourceConfig.Host,
		transferReq.DestConfig.Host,
		transferReq.Method)

	// Create executor with progress callback
	executor := transfer.NewSFTPExecutor(transferReq, func(progress transfer.TransferProgress) {
		data, _ := json.Marshal(progress)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	})

	// Execute transfer
	result, err := executor.Execute()

	// Send final result
	if err != nil && result == nil {
		errorData, _ := json.Marshal(map[string]string{
			"error": fmt.Sprintf("Transfer failed: %v", err),
		})
		fmt.Fprintf(w, "event: error\ndata: %s\n\n", errorData)
	} else {
		resultData, _ := json.Marshal(result)
		fmt.Fprintf(w, "event: complete\ndata: %s\n\n", resultData)
	}
	flusher.Flush()
}

// corsMiddleware enables CORS for local development
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
