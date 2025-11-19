# Website Mover - Rclone Edition

A simplified, powerful tool to migrate websites between servers using `rclone`.

## 🎯 Vision

Migrate websites (WordPress, PrestaShop, etc.) between hosts using SFTP/FTP without installing anything on the source or destination servers. This tool provides a modern web UI to configure and monitor `rclone` operations.

## 🏗️ Architecture

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS
- **Backend**: Go 1.25 + Rclone (as a library/CLI wrapper)

## 🚀 Quick Start

### Prerequisites

- **[rclone](https://rclone.org/install/)** must be installed and available in your PATH.
- Node.js 18+
- Go 1.25+

### Installation

```bash
git clone https://github.com/gonzague/website-mover.git
cd website-mover
```

### Development

Open two terminals:

**Terminal 1 (Backend)**
```bash
cd backend
go run cmd/server/main.go
# Server starts on http://127.0.0.1:8080
```

**Terminal 2 (Frontend)**
```bash
cd frontend
npm install
npm run dev
# UI available at http://localhost:5173
```

### Production Build

```bash
make all
# Creates:
# - backend/server (Binary)
# - frontend/dist/ (Static files)
```

## 📋 Features

1.  **Remote Management**: Configure SFTP/FTP connections easily.
2.  **Migration**:
    *   Select Source and Destination remotes.
    *   Configure excludes (e.g., `wp-content/cache/**`).
    *   Set bandwidth limits and parallel transfers.
    *   **Dry Run** mode to test before transferring.
3.  **Real-time Monitoring**: Watch the rclone output stream in real-time.
4.  **History**: View logs of past migrations.

## 🔧 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/remotes` | GET/POST | Manage rclone remotes |
| `/api/remotes/test` | POST | Test connection |
| `/api/migrations` | POST | Start a migration |
| `/api/migrations/{id}/stream` | GET | SSE stream of logs |
| `/api/history` | GET | View past jobs |

## 🤝 Contribution

Contributions welcome! Please ensure you have `rclone` installed locally for development.
