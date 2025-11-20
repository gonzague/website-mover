# Docker Deployment Guide

Website Mover provides Docker images for easy deployment and distribution.

## 🚀 Quick Start

### Using Pre-built Images

The easiest way to get started:

```bash
# Clone the repository
git clone https://github.com/gonzague/website-mover.git
cd website-mover

# Start the application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

Access the application:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080

## 📦 Available Images

Docker images are automatically built and published via GitHub Actions:

| Image | Description | Tags |
|-------|-------------|------|
| `gonzague/website-mover-frontend` | React frontend | `latest`, `main`, `v*` |
| `gonzague/website-mover-backend` | Go backend | `latest`, `main`, `v*` |

### Image Sizes

- Frontend: ~50MB (nginx + static files)
- Backend: ~30MB (Go binary + rclone)

## 🔧 Configuration

### Environment Variables

#### Backend
```yaml
environment:
  - PORT=8080
  - RCLONE_CONFIG=/root/.config/rclone/rclone.conf
```

#### Frontend
```yaml
environment:
  - VITE_API_BASE=http://localhost:8080/api
```

### Volume Mounts

The Docker setup uses two important volume mounts:

```yaml
volumes:
  # Rclone configuration (remotes)
  - ~/.config/rclone:/root/.config/rclone
  
  # Migration history
  - ~/.config/website-mover:/root/.config/website-mover
```

## 🏗️ Building from Source

### Build All Images

```bash
# Build both frontend and backend
docker-compose build

# Build specific service
docker-compose build frontend
docker-compose build backend
```

### Build Individual Images

**Frontend:**
```bash
cd frontend
docker build -t website-mover-frontend .
```

**Backend:**
```bash
cd backend
docker build -t website-mover-backend .
```

## 🔄 GitHub Actions CI/CD

Images are automatically built and pushed to Docker Hub on:

- **Push to `main`**: Builds and tags as `latest` and `main`
- **Version tags** (`v1.0.0`): Builds and tags with version numbers
- **Pull requests**: Builds but doesn't push

### Workflow File

`.github/workflows/docker-build.yml` contains the automated build pipeline.

### Required Secrets

To enable Docker Hub publishing, add these secrets to your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add the following secrets:
   - `DOCKER_USERNAME`: Your Docker Hub username
   - `DOCKER_PASSWORD`: Your Docker Hub access token

### Build Status

Check the build status:
- Actions tab: https://github.com/gonzague/website-mover/actions
- Docker Hub: https://hub.docker.com/r/gonzague/website-mover-frontend

## 📝 docker-compose.yml

### Default Configuration

```yaml
version: '3.8'

services:
  backend:
    image: gonzague/website-mover-backend:latest
    # OR build from source:
    # build: ./backend
    container_name: website-mover-backend
    ports:
      - "8080:8080"
    volumes:
      - ~/.config/rclone:/root/.config/rclone
      - ~/.config/website-mover:/root/.config/website-mover
    environment:
      - PORT=8080
    restart: unless-stopped

  frontend:
    image: gonzague/website-mover-frontend:latest
    # OR build from source:
    # build: ./frontend
    container_name: website-mover-frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped
```

### Custom Ports

To use different ports:

```yaml
services:
  backend:
    ports:
      - "8081:8080"  # Access backend on port 8081

  frontend:
    ports:
      - "8000:80"    # Access frontend on port 8000
```

### Production Configuration

For production deployment:

```yaml
version: '3.8'

services:
  backend:
    image: gonzague/website-mover-backend:latest
    container_name: website-mover-backend
    ports:
      - "127.0.0.1:8080:8080"  # Only expose to localhost
    volumes:
      - ~/.config/rclone:/root/.config/rclone
      - ~/.config/website-mover:/root/.config/website-mover
    environment:
      - PORT=8080
    restart: always
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  frontend:
    image: gonzague/website-mover-frontend:latest
    container_name: website-mover-frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: always
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## 🔐 Security Best Practices

### 1. Rclone Configuration

Ensure your rclone config has proper permissions:

```bash
chmod 600 ~/.config/rclone/rclone.conf
```

### 2. Network Isolation

For production, use a reverse proxy (nginx, Traefik):

```yaml
services:
  backend:
    networks:
      - internal
    # Don't expose ports directly

  frontend:
    networks:
      - internal
    # Only frontend exposed via reverse proxy
```

### 3. Use Secrets for Credentials

Instead of mounting config files, use Docker secrets:

```yaml
services:
  backend:
    secrets:
      - rclone_config
    environment:
      - RCLONE_CONFIG=/run/secrets/rclone_config

secrets:
  rclone_config:
    file: ~/.config/rclone/rclone.conf
```

## 🐛 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Check container status
docker-compose ps

# Restart services
docker-compose restart
```

### Rclone Not Found

The backend image includes rclone. If you see "rclone not found":

```bash
# Verify rclone is in the image
docker-compose exec backend rclone version

# Rebuild the backend image
docker-compose build backend
```

### Permission Issues

If you get permission errors with mounted volumes:

```bash
# Fix ownership of config directories
sudo chown -R $USER:$USER ~/.config/rclone
sudo chown -R $USER:$USER ~/.config/website-mover

# Set proper permissions
chmod 700 ~/.config/rclone
chmod 600 ~/.config/rclone/rclone.conf
```

### Frontend Can't Connect to Backend

Check that both services are on the same network:

```bash
# Inspect networks
docker network ls
docker network inspect website-mover_default

# Test connectivity
docker-compose exec frontend ping backend
```

## 🔄 Updating

### Update to Latest Images

```bash
# Pull latest images
docker-compose pull

# Restart with new images
docker-compose up -d

# Remove old images
docker image prune
```

### Update Specific Version

```yaml
services:
  backend:
    image: gonzague/website-mover-backend:v1.2.0
  frontend:
    image: gonzague/website-mover-frontend:v1.2.0
```

## 📊 Monitoring

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Resource Usage

```bash
# Container stats
docker stats

# Disk usage
docker system df

# Clean up unused resources
docker system prune -a
```

## 🌐 Production Deployment

### With Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # SSE support for live migration output
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        chunked_transfer_encoding off;
    }
}
```

### With Traefik

```yaml
version: '3.8'

services:
  backend:
    image: gonzague/website-mover-backend:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`yourdomain.com`) && PathPrefix(`/api`)"
      - "traefik.http.services.backend.loadbalancer.server.port=8080"

  frontend:
    image: gonzague/website-mover-frontend:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`yourdomain.com`)"
      - "traefik.http.services.frontend.loadbalancer.server.port=80"
```

## 📖 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker Hub - Website Mover](https://hub.docker.com/r/gonzague/website-mover-frontend)
- [Rclone in Docker](https://rclone.org/docker/)
- [GitHub Actions Workflow](.github/workflows/docker-build.yml)

## 💡 Tips

### Development vs Production

**Development:**
```bash
# Build from source for faster iteration
docker-compose -f docker-compose.dev.yml up --build
```

**Production:**
```bash
# Use pre-built images
docker-compose up -d
```

### Multi-Platform Builds

The GitHub Actions workflow builds for multiple platforms:
- `linux/amd64` (Intel/AMD)
- `linux/arm64` (ARM - Raspberry Pi, Apple Silicon)

### Health Checks

Add health checks to docker-compose:

```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

**Need help?** Open an issue on [GitHub](https://github.com/gonzague/website-mover/issues)!

