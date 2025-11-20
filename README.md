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

### Docker Deployment 🐳

The easiest way to run Website Mover is using Docker:

```bash
# Build and start the application
docker-compose up --build

# Or run in detached mode
docker-compose up -d

# Stop the application
docker-compose down
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080

**Note**: The Docker setup automatically mounts your local `~/.config/rclone` directory, so your existing rclone remotes will be available in the container.

## 📖 Usage

### First-Time Users

On your first visit, you'll see a **welcome tour** that walks you through:
- What Website Mover does
- The 4-step migration process
- Important tips for safe migrations

### Standard Workflow

1. **Configure Remotes**: Add your source and destination servers (SFTP/FTP)
   - Hover over help icons (?) for explanations of each field
   - Use the "Test" button to verify connectivity
2. **Start Migration**: Configure your migration options
   - Quick Start Guide provides best practices and common use cases
   - All options have contextual help explaining their purpose
3. **Monitor Progress**: Watch real-time statistics including transfer speed, file count, and total size
4. **View History**: Check past migrations with detailed logs and statistics

**💡 Tip**: The Migration tab is disabled until you configure at least 2 remotes. The step indicator at the top shows your progress!

## 🎨 Features

- **Modern UI**: Built with React 19, TypeScript, and Shadcn UI components
- **Guided Onboarding**: Interactive welcome tour and step-by-step workflow guidance
- **Contextual Help**: Inline tooltips explaining technical concepts and options
- **Live Statistics**: Real-time transfer speed, file count, and size tracking
- **File Browser**: Visual directory navigation for selecting source/destination paths
- **Migration History**: Track all past migrations with detailed statistics
- **Flexible Configuration**: Customize transfers, checkers, bandwidth limits, and exclude patterns
- **Smart Empty States**: Helpful guidance when getting started
- **Docker Ready**: One-command deployment with Docker Compose

## 🔧 Configuration

### Environment Variables

Frontend supports the following environment variable:

- `VITE_API_BASE`: Backend API URL (default: `http://localhost:8080/api`)

Create a `.env` file in the `frontend` directory:

```bash
VITE_API_BASE=http://your-backend-url:8080/api
```

## 📁 Data Storage

- **Rclone Config**: `~/.config/rclone/rclone.conf`
- **Migration History**: `~/.config/website-mover/history.json`

## 🛠️ Development

See the Quick Start section above for development setup.

## 🔧 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/remotes` | GET/POST | Manage rclone remotes |
| `/api/remotes/test` | POST | Test connection |
| `/api/remotes/{name}` | DELETE | Delete a remote |
| `/api/remotes/{name}/list` | GET | List files in a path |
| `/api/migrations` | POST | Start a migration |
| `/api/migrations/{id}/stream` | GET | SSE stream of logs |
| `/api/history` | GET | View past jobs |
| `/api/history/{id}` | GET | Get specific job details |
| `/api/history` | DELETE | Clear history |

## 🏗️ Architecture

```
┌─────────────────┐
│  React Frontend │  Configure remotes & migrations
│   (Port 5173)   │  View live output & history
└────────┬────────┘
         │ HTTP + SSE
┌────────▼────────┐
│   Go Backend    │  Manage rclone config
│   (Port 8080)   │  Execute rclone commands
└────────┬────────┘
         │
┌────────▼────────┐
│     rclone      │  Actual file transfers
│   (subprocess)  │
└─────────────────┘
```

## 🔍 Why Rclone?

This tool leverages **rclone** - a mature, battle-tested file transfer tool that:

- ✅ Supports 40+ backends (SFTP, FTP, S3, etc.)
- ✅ Handles bandwidth limiting, retries, and resume
- ✅ Provides detailed progress output
- ✅ Offers flexible exclude patterns
- ✅ Includes integrity checking
- ✅ Optimizes parallel transfers

## 🆚 Comparison to Custom Implementation

| Feature | Custom Implementation | Rclone Edition |
|---------|----------------------|----------------|
| Lines of Code | ~5000+ | ~1500 |
| Backends Supported | SFTP, FTP | 40+ protocols |
| Resume Support | Custom logic | Built-in |
| Bandwidth Limiting | Manual implementation | Built-in |
| Maturity | New | Battle-tested |
| Maintenance | High | Low (use rclone updates) |

## 🚀 Future Enhancements

- [ ] Pre-migration file list preview
- [ ] Bandwidth usage graphs
- [ ] Email notifications on completion
- [ ] Scheduled migrations
- [ ] Database dump integration
- [ ] Multi-step migration workflows

## 📝 License

MIT

## 🤝 Contribution

Contributions welcome! Please ensure you have `rclone` installed locally for development.
