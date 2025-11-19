# Website Mover - Rclone Edition

A simple, powerful web UI wrapper around **rclone** for migrating websites between servers.

## Why Rclone?

Instead of building complex custom transfer logic, this tool leverages **rclone** - a mature, battle-tested tool that:

- ✅ Supports 40+ backends (SFTP, FTP, S3, etc.)
- ✅ Handles bandwidth limiting, retries, and resume
- ✅ Provides detailed progress output
- ✅ Offers flexible exclude patterns
- ✅ Includes integrity checking
- ✅ Optimizes parallel transfers

## Features

- **Remote Management**: Configure SFTP/FTP connections via web UI
- **Visual Migration Builder**: Set up migrations with form controls
- **Live Output**: See real-time rclone output in your browser
- **Migration History**: Review past migrations and their logs
- **Pre-configured Excludes**: Default patterns for WordPress caches, logs, etc.

## Architecture

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

## Prerequisites

1. **rclone** must be installed and available in PATH
   ```bash
   # macOS
   brew install rclone
   
   # Linux
   curl https://rclone.org/install.sh | sudo bash
   
   # Windows
   choco install rclone
   ```

2. **Go 1.24+** for backend
3. **Node.js 18+** for frontend

## Installation

### Backend

```bash
cd backend
go mod download
go build -o server ./cmd/server/main_simple.go
```

### Frontend

```bash
cd frontend
npm install
npm run build
```

## Running

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
go run ./cmd/server/main_simple.go
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Then open: http://localhost:5173

### Production Mode

```bash
# Build both
cd backend && go build -o server ./cmd/server/main_simple.go
cd ../frontend && npm run build

# Run backend (serves API)
cd backend && ./server

# Serve frontend with any static server
cd frontend/dist && python3 -m http.server 5173
```

## Usage

### 1. Configure Remotes

Go to the **Remotes** tab and add your source and destination servers:

- **Name**: A friendly name (e.g., `source-server`, `dest-server`)
- **Type**: SFTP or FTP
- **Host**: Server hostname or IP
- **Port**: 22 for SFTP, 21 for FTP
- **Username**: SSH/FTP username
- **Password**: Leave empty if using SSH key
- **SSH Key**: Path to private key file (optional)

Click **Test** to verify connectivity.

### 2. Start Migration

Go to the **Migration** tab:

1. **Select Source**: Choose source remote and path
2. **Select Destination**: Choose destination remote and path
3. **Configure Options**:
   - Transfers: Parallel file transfers (default: 8)
   - Checkers: Parallel file checks (default: 8)
   - Bandwidth Limit: e.g., `10M` for 10MB/s
   - Dry Run: Test without actually copying files
   - Delete Extraneous: Use `sync` instead of `copy` (removes extra files at destination)
4. **Exclude Patterns**: Pre-configured patterns for WordPress, or add your own
5. **Start Migration**

You'll see:
- The exact rclone command being executed
- Live output from rclone
- Progress statistics

### 3. View History

Go to the **History** tab to see:
- All past migrations
- Command used
- Duration and status
- Full output logs

## Configuration Files

The tool stores data in `~/.config/website-mover/`:

- `rclone/rclone.conf` - Remote configurations (rclone format)
- `history.json` - Migration history

You can also manually edit `rclone.conf` or use the `rclone config` command directly.

## Example Migration

Migrating a WordPress site:

**Source:**
- Remote: `old-server`
- Path: `/home/user/public_html`

**Destination:**
- Remote: `new-server`
- Path: `/var/www/html`

**Excludes:**
```
wp-content/cache/**
wp-content/uploads/cache/**
.well-known/acme-challenge/**
backup*.zip
*.log
```

**Generated Command:**
```bash
rclone copy \
  old-server:/home/user/public_html \
  new-server:/var/www/html \
  -vv --progress --stats=5s \
  --transfers=8 --checkers=8 \
  --exclude "wp-content/cache/**" \
  --exclude "wp-content/uploads/cache/**" \
  --exclude ".well-known/acme-challenge/**" \
  --exclude "backup*.zip" \
  --exclude "*.log"
```

## API Endpoints

### Remotes
- `GET /api/remotes` - List all remotes
- `POST /api/remotes` - Add/update remote
- `DELETE /api/remotes/{name}` - Delete remote
- `POST /api/remotes/test` - Test connectivity

### Migrations
- `POST /api/migrations` - Start migration
- `GET /api/migrations` - List active + history
- `GET /api/migrations/{id}/stream` - Stream output (SSE)
- `GET /api/migrations/active` - List running jobs

### History
- `GET /api/history` - List all history
- `GET /api/history/{id}` - Get specific history with full output

## Troubleshooting

### "rclone not found"
Ensure rclone is installed and in PATH:
```bash
which rclone
rclone version
```

### Connection fails
Test manually:
```bash
rclone ls your-remote:/ --max-depth 1
```

### Migration slow
- Increase `--transfers` for more parallel transfers
- Check network bandwidth with `--bwlimit` setting
- Use `--dry-run` first to test

### Permission denied
Ensure your SSH key or password is correct. Test:
```bash
ssh user@host
```

## Comparison to Custom Implementation

| Feature | Custom Implementation | Rclone Edition |
|---------|----------------------|----------------|
| Lines of Code | ~5000+ | ~1500 |
| Backends Supported | SFTP, FTP | 40+ protocols |
| Resume Support | Custom logic | Built-in |
| Bandwidth Limiting | Manual implementation | Built-in |
| Maturity | New | Battle-tested |
| Maintenance | High | Low (use rclone updates) |
| Performance | Good | Excellent |

## Future Enhancements

- [ ] Pre-migration file list preview
- [ ] Bandwidth usage graphs
- [ ] Email notifications on completion
- [ ] Scheduled migrations
- [ ] Database dump integration
- [ ] Multi-step migration workflows

## License

MIT

