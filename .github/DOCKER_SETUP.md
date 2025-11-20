# Docker Hub Automated Builds Setup

## 🎯 What Was Added

GitHub Actions workflow to automatically build and publish Docker images to Docker Hub.

## 📦 Generated Images

On every push to `main`, the workflow builds and pushes:

- `gonzague/website-mover-frontend:latest`
- `gonzague/website-mover-backend:latest`

On version tags (`v1.0.0`), it also creates versioned tags:
- `gonzague/website-mover-frontend:v1.0.0`
- `gonzague/website-mover-backend:v1.0.0`

## 🔧 Setup Required

To enable automatic Docker builds, you need to add secrets to your GitHub repository:

### Step 1: Create Docker Hub Access Token

1. Go to [Docker Hub](https://hub.docker.com/)
2. Click on your username → **Account Settings**
3. Go to **Security** → **Access Tokens**
4. Click **New Access Token**
5. Name it: `github-actions-website-mover`
6. Set permissions: **Read, Write, Delete**
7. Click **Generate**
8. **Copy the token** (you won't see it again!)

### Step 2: Add GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these two secrets:

**Secret 1:**
- Name: `DOCKER_USERNAME`
- Value: Your Docker Hub username (e.g., `gonzague`)

**Secret 2:**
- Name: `DOCKER_PASSWORD`
- Value: The access token you generated in Step 1

### Step 3: Trigger First Build

Once secrets are added, push to `main` or create a version tag:

```bash
# Push to trigger build
git push origin main

# Or create a release
git tag v1.0.0
git push origin v1.0.0
```

## 🔄 How It Works

### Workflow Triggers

The workflow runs on:
- ✅ Push to `main` branch
- ✅ Version tags (`v*`)
- ✅ Pull requests (build only, no push)
- ✅ Manual trigger via Actions tab

### Build Process

1. **Checkout** - Clones the repository
2. **Setup Buildx** - Configures Docker multi-platform builds
3. **Login** - Authenticates with Docker Hub (if not PR)
4. **Metadata** - Generates image tags and labels
5. **Build & Push** - Builds and pushes images with caching

### Build Cache

The workflow uses registry caching for faster builds:
- Cache stored in Docker Hub as `:buildcache` tag
- Subsequent builds are 5-10x faster
- Automatically maintained and updated

### Multi-Platform Support

Images are built for:
- `linux/amd64` (Intel/AMD processors)
- `linux/arm64` (ARM processors - Raspberry Pi, Apple Silicon)

## 📊 Monitoring Builds

### GitHub Actions Tab

View build status and logs:
```
https://github.com/gonzague/website-mover/actions
```

### Docker Hub

View published images:
```
https://hub.docker.com/r/gonzague/website-mover-frontend
https://hub.docker.com/r/gonzague/website-mover-backend
```

### Build Status Badge

Add to README.md:
```markdown
![Docker Build](https://github.com/gonzague/website-mover/actions/workflows/docker-build.yml/badge.svg)
```

## 🎨 Usage

### Pull Latest Images

```bash
docker pull gonzague/website-mover-frontend:latest
docker pull gonzague/website-mover-backend:latest
```

### Use in docker-compose.yml

Already configured in `docker-compose.yml`:

```yaml
services:
  backend:
    image: gonzague/website-mover-backend:latest
    
  frontend:
    image: gonzague/website-mover-frontend:latest
```

### Specific Version

```yaml
services:
  backend:
    image: gonzague/website-mover-backend:v1.0.0
    
  frontend:
    image: gonzague/website-mover-frontend:v1.0.0
```

## 🔐 Security Notes

### Access Token Permissions

The Docker Hub access token only needs:
- ✅ Read
- ✅ Write
- ❌ Admin (not needed)

### Token Rotation

For security, rotate your Docker Hub token every 6-12 months:
1. Generate new token in Docker Hub
2. Update `DOCKER_PASSWORD` secret in GitHub
3. Delete old token from Docker Hub

### Secret Access

GitHub secrets are:
- Encrypted at rest
- Never exposed in logs
- Only accessible to workflows in this repo

## 🐛 Troubleshooting

### Build Fails: "Invalid credentials"

**Solution:** Check that secrets are set correctly:
```bash
# Verify secrets exist (you can't see values)
# Go to: Settings → Secrets → Actions
```

### Build Fails: "Image not found"

**Solution:** Docker Hub repository doesn't exist yet. First push creates it automatically.

### Build Takes Too Long

**Solution:** Wait for build cache to populate. First build: ~5min, subsequent: ~1min

### Multi-platform Build Fails

**Solution:** Ensure Buildx is working:
```bash
docker buildx ls
docker buildx inspect --bootstrap
```

## 📝 Workflow File

Location: `.github/workflows/docker-build.yml`

Key configurations:
```yaml
env:
  REGISTRY_IMAGE: gonzague/website-mover

jobs:
  build-frontend:  # Builds frontend image
  build-backend:   # Builds backend image
  build-complete:  # Summary job
```

## 🚀 Next Steps

1. ✅ Add Docker Hub secrets to GitHub
2. ✅ Push to `main` to trigger first build
3. ✅ Verify images appear on Docker Hub
4. ✅ Test pulling and running images
5. ✅ Create a release tag for versioned images

## 📖 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Hub](https://hub.docker.com/)
- [Docker Buildx](https://docs.docker.com/buildx/working-with-buildx/)
- [Multi-platform Builds](https://docs.docker.com/build/building/multi-platform/)

---

**Questions?** Open an issue or check the [DOCKER.md](../../DOCKER.md) guide!

