# Quick Start Guide - Rclone Edition

## TL;DR

```bash
# Terminal 1 - Start backend
cd backend
go run ./cmd/server/main_simple.go

# Terminal 2 - Start frontend
cd frontend
npm run dev

# Open browser
open http://localhost:5173
```

## Step-by-Step

### 1. Start the Backend (Terminal 1)

```bash
cd backend
go run ./cmd/server/main_simple.go
```

You should see:
```
Server starting on :8080
Rclone config: /Users/your-name/.config/rclone/rclone.conf
```

### 2. Start the Frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

You should see:
```
  VITE v7.x.x  ready in xxx ms
  
  ➜  Local:   http://localhost:5173/
```

### 3. Open in Browser

Visit: http://localhost:5173

## Your First Migration

Supports **SFTP**, **FTP**, **Rsync**, and **Amazon S3** backends!

### Step 1: Add Remotes

1. Click the **Remotes** tab
2. Click **Add Remote**
3. Choose your backend type:
   - **SFTP** - Standard secure migration
   - **FTP** - Traditional file transfer
   - **Rsync** - Efficient delta sync (large sites)
   - **S3** - Cloud storage backup
4. Fill in your connection details
   - For SFTP/FTP/Rsync: Host, Port, Username, Password
   - For S3: Provider, Region, Access Keys
5. Click **Save Remote**
6. Click **Test** to verify connection
7. Repeat for destination remote

### Step 2: Configure Migration

1. Click the **Migration** tab
2. Select **Source Remote** and enter path (e.g., `/home/user/public_html`)
3. Select **Destination Remote** and enter path (e.g., `/var/www/html`)
4. Review **Exclude Patterns** (pre-configured for WordPress)
5. Optionally enable **Dry Run** to test first
6. Click **Start Migration**

### Step 3: Monitor Progress

Watch the live output showing:
- Files being transferred
- Progress statistics
- Transfer speed
- Errors (if any)

### Step 4: Review History

Click the **History** tab to see:
- Completed migrations
- Commands used
- Full output logs

## Examples

### Example 1: Migrate WordPress Site (SFTP)

**Remotes:**
- Source: `OldServer` (SFTP - old-server.com:22)
- Destination: `NewServer` (SFTP - new-server.com:22)

**Migration:**
- Source: `OldServer:/var/www/mysite`
- Destination: `NewServer:/home/sites/mysite`
- Transfers: 8
- Dry Run: ✅ (first time)

### Example 2: Large Site with Rsync

**Remotes:**
- Source: `Production` (Rsync - prod-server.com:873)
- Destination: `Staging` (Rsync - staging-server.com:873)

**Why Rsync:** Only transfers changed file portions - perfect for 10GB+ sites with frequent updates!

### Example 3: Backup to Cloud (S3)

**Remotes:**
- Source: `WebServer` (SFTP - mysite.com:22)
- Destination: `S3Backup` (S3 - AWS us-east-1)

**Migration:**
- Source: `WebServer:/var/www/html`
- Destination: `S3Backup:mybucket/backups/mysite/`
- ACL: private

**Why S3:** Off-site backup with versioning and disaster recovery!

## Tips

### First Time Setup
- Choose the right backend: **SFTP** (standard), **Rsync** (large/repeated), **S3** (backups)
- Always use **Dry Run** first to preview what will happen
- **Test** both remotes before starting migration
- Review the generated command before executing

### Performance
- Increase **Transfers** for faster migration (8-16 is good)
- Use **Bandwidth Limit** if you need to throttle (e.g., `10M`)
- Enable **Delete Extraneous** only if you want to mirror exactly (removes extra files)

### Safety
- Take a backup before migration
- Test with a small directory first
- Review exclude patterns carefully

## Troubleshooting

### Backend won't start
```bash
# Check if port 8080 is in use
lsof -i :8080

# Kill the process if needed
kill -9 <PID>
```

### Frontend won't connect to backend
- Check that backend is running on port 8080
- Check CORS settings in browser console
- Try: http://localhost:5173 (not 127.0.0.1)

### Rclone errors
Test the command manually:
```bash
# Copy the command from the UI, then run it in terminal
rclone copy source:/path dest:/path --dry-run -vv
```

### Connection timeout
- Verify SSH access: `ssh user@host`
- Check firewall settings
- Test rclone directly: `rclone ls RemoteName:/`

## What's Happening Behind the Scenes?

When you start a migration, the backend:

1. Generates an rclone command based on your settings
2. Executes rclone as a subprocess
3. Streams the output back to your browser in real-time (via SSE)
4. Saves the migration to history when complete

Example generated command:
```bash
rclone copy \
  OldServer:/var/www/mysite \
  NewServer:/home/sites/mysite \
  -vv --progress --stats=5s \
  --transfers=8 --checkers=8 \
  --exclude "wp-content/cache/**" \
  --exclude "*.log"
```

## Next Steps

- Read the full [README_RCLONE.md](./README_RCLONE.md) for advanced usage
- Explore rclone documentation: https://rclone.org/docs/
- Configure additional remotes for different projects
- Set up SSH keys for passwordless authentication

## Need Help?

- Check rclone logs in the browser output
- Run commands manually to debug
- Review migration history for patterns
- Test connectivity with `rclone ls RemoteName:/`

---

**Pro Tip**: Save common migration configurations by taking screenshots or copying the generated rclone commands for future reference!

