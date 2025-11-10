.PHONY: help build-backend run-backend stop-backend dev-frontend dev build clean install

SHELL := /bin/bash

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build-backend: ## Build Go backend binary
	@echo "Building backend binary..."
	@cd backend && go build -o bin/server cmd/server/main.go
	@echo "Backend built: backend/bin/server"

build-frontend: ## Build frontend for production
	@echo "Building frontend..."
	@cd frontend && npm run build
	@echo "Frontend built: frontend/dist"

build: build-backend build-frontend ## Build both backend and frontend for production

run-backend: ## Run Go backend server locally
	@echo "Starting backend server on http://127.0.0.1:8080"
	@cd backend && go run cmd/server/main.go

stop-backend: ## Stop running backend server
	@pkill -f "go run cmd/server/main.go" || echo "No backend server running"

dev-frontend: ## Run Vite dev server (frontend only, needs backend running separately)
	@cd frontend && npm run dev

dev: ## Run full development environment (frontend + backend)
	@echo "Starting development environment..."
	@echo "Backend: http://127.0.0.1:8080"
	@echo "Frontend: http://localhost:5173"
	@make -j2 run-backend dev-frontend

clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	@rm -rf backend/bin
	@rm -rf frontend/dist
	@echo "Clean complete!"

install: ## Install all dependencies
	@echo "Installing Go dependencies..."
	@cd backend && go mod download
	@echo "Installing frontend dependencies..."
	@cd frontend && npm install
	@echo "All dependencies installed!"
