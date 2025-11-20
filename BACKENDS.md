# Supported Backends

Website Mover supports multiple backend types through rclone. Each backend has its own use case and configuration requirements.

## 🔌 Available Backends

### 1. SFTP (Secure FTP)
**Most common for website migration**

- **Port:** 22 (default)
- **Authentication:** Password or SSH key
- **Best for:** Standard website migrations, managed hosting
- **Pros:** Secure, widely supported, works with standard SSH
- **Cons:** Not as fast as Rsync for large repeated syncs

**Configuration:**
```
Type: SFTP
Host: example.com
Port: 22
Username: your-username
Password: your-password (or leave empty)
SSH Key: ~/.ssh/id_rsa (optional, more secure)
```

---

### 2. FTP (File Transfer Protocol)
**Traditional, less secure**

- **Port:** 21 (default)
- **Authentication:** Username and password
- **Best for:** Old hosting that doesn't support SFTP
- **Pros:** Universal support, simple
- **Cons:** Not encrypted, less secure

**Configuration:**
```
Type: FTP
Host: ftp.example.com
Port: 21
Username: your-username
Password: your-password
```

---

### 3. Rsync
**Efficient for large repeated syncs** ⚡

- **Port:** 873 (default) or 22 (over SSH)
- **Authentication:** Password or SSH key
- **Best for:** Large sites, repeated syncs, delta transfers
- **Pros:** Only transfers changed portions of files, very efficient
- **Cons:** Requires rsync installed on both servers

**Configuration:**
```
Type: Rsync
Host: example.com
Port: 873 (or 22 for rsync over SSH)
Username: your-username
Password: your-password (optional)
```

**How Rsync Works:**
- Compares files between source and destination
- Only transfers the **changed parts** of files
- Much faster for repeated syncs (e.g., daily backups)
- Can reduce bandwidth usage by 70-90% on subsequent syncs

**Example Use Case:**
```
Initial migration: 10GB (full transfer)
Daily sync #1:     200MB (only changes)
Daily sync #2:     150MB (only changes)
```

---

### 4. Amazon S3 & Compatible
**Cloud storage and backups** ☁️

- **Authentication:** Access keys
- **Best for:** Backups, static site hosting, disaster recovery
- **Pros:** Scalable, versioning, geo-replication, cheap for cold storage
- **Cons:** Different path structure (buckets), egress costs

**Supported Providers:**
- **AWS S3** - Amazon Web Services
- **DigitalOcean Spaces** - Simple object storage
- **Wasabi** - Hot cloud storage (faster, cheaper)
- **Backblaze B2** - Cost-effective backups
- **Minio** - Self-hosted S3-compatible
- **Any S3-compatible service**

**Configuration:**
```
Type: S3
Provider: AWS (or DigitalOcean, Wasabi, etc.)
Region: us-east-1
Access Key ID: AKIAIOSFODNN7EXAMPLE
Secret Access Key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Endpoint: (optional, for non-AWS providers)
ACL: private (or public-read, public-read-write)
```

**Example Endpoints:**
- **AWS S3:** Leave empty (automatic)
- **DigitalOcean Spaces:** `https://nyc3.digitaloceanspaces.com`
- **Wasabi:** `https://s3.us-east-1.wasabisys.com`
- **Backblaze B2:** `https://s3.us-west-000.backblazeb2.com`
- **Minio:** `https://minio.example.com:9000`

**S3 Path Format:**
```
Remote: my-s3-remote
Path: mybucket/websites/mysite/
```

**Common S3 Use Cases:**

1. **Website Backup to S3:**
   - Source: SFTP server
   - Destination: S3 bucket
   - Benefit: Off-site backup, versioning

2. **Static Site Deployment:**
   - Source: Local or SFTP
   - Destination: S3 bucket (with public-read ACL)
   - Benefit: Direct hosting from S3 + CloudFront

3. **Archive Old Sites:**
   - Source: SFTP server
   - Destination: S3 Glacier (cold storage)
   - Benefit: Very cheap long-term storage

---

## 🎯 Which Backend Should You Use?

### For Website Migration
```
SFTP > Rsync > FTP
```
- **SFTP:** Best default choice (secure, standard)
- **Rsync:** If you need repeated syncs or very large sites
- **FTP:** Only if SFTP isn't available

### For Backups
```
S3 > Rsync > SFTP
```
- **S3:** Best for off-site, versioned backups
- **Rsync:** Good for local/remote server backups
- **SFTP:** Simple remote backup option

### For Static Site Hosting
```
S3 (with CloudFront) > S3 > DigitalOcean Spaces
```
- Direct hosting from cloud storage
- Add CDN for global distribution

---

## 🔧 Technical Details

### Rclone Backend Names

These are the internal rclone backend names:

| UI Name | Rclone Type | Common Port |
|---------|-------------|-------------|
| SFTP | `sftp` | 22 |
| FTP | `ftp` | 21 |
| Rsync | `rsync` | 873 |
| S3 | `s3` | N/A (HTTPS) |

### Required rclone Version

- **Minimum:** rclone v1.53+
- **Recommended:** Latest stable version

Check your version:
```bash
rclone version
```

Update rclone:
```bash
# macOS
brew upgrade rclone

# Linux
sudo curl https://rclone.org/install.sh | sudo bash

# Windows
choco upgrade rclone
```

---

## 📊 Performance Comparison

Based on typical use cases:

| Backend | Initial Transfer | Repeat Sync | CPU Usage | Bandwidth |
|---------|-----------------|-------------|-----------|-----------|
| SFTP | Fast | Medium | Low | High |
| FTP | Fast | Medium | Low | High |
| Rsync | Fast | **Very Fast** | Medium | **Low** |
| S3 | Fast | Fast | Low | Medium |

**Legend:**
- **Initial Transfer:** First full migration
- **Repeat Sync:** Subsequent updates
- **CPU Usage:** Server resource usage
- **Bandwidth:** Network data transferred

---

## 💡 Best Practices

### SFTP/FTP
- ✅ Use SSH keys instead of passwords when possible
- ✅ Test connection before migrating
- ✅ Use appropriate port (22 for SFTP, 21 for FTP)
- ⚠️ Don't use FTP if SFTP is available (security)

### Rsync
- ✅ Perfect for large sites with frequent updates
- ✅ Use rsync over SSH for security
- ✅ Ideal for dev → staging → production workflows
- ⚠️ Ensure rsync is installed on both servers

### S3
- ✅ Great for long-term backups
- ✅ Use lifecycle policies to archive old data
- ✅ Enable versioning for important data
- ✅ Set appropriate ACLs (usually "private")
- ⚠️ Watch egress costs for large data transfers out
- ⚠️ Remember bucket names must be globally unique

---

## 🔐 Security Notes

### Password Storage
All passwords and secrets are **obscured** using rclone's built-in encryption before being stored in the config file. This is not encryption, but prevents casual viewing.

### SSH Keys (SFTP)
SSH key authentication is more secure than passwords:
```bash
# Generate a key pair
ssh-keygen -t ed25519 -C "website-mover"

# Copy public key to server
ssh-copy-id user@server.com

# Use in Website Mover
SSH Key File: ~/.ssh/id_ed25519
```

### S3 Security
- Never commit access keys to version control
- Use IAM roles with minimal permissions
- Enable MFA for S3 console access
- Rotate access keys regularly

---

## 🚀 Advanced: Combining Backends

You can combine backends for advanced workflows:

### Example: SFTP → S3 Backup
1. Migrate from old server (SFTP) to new server (SFTP)
2. Backup new server (SFTP) to S3 periodically
3. Keep versioned backups in S3

### Example: Multi-Cloud Strategy
1. Primary: SFTP server
2. Backup 1: S3 (AWS)
3. Backup 2: DigitalOcean Spaces
4. Archive: Backblaze B2 (cold storage)

---

## 📞 Troubleshooting

### SFTP Connection Issues
```bash
# Test manually
ssh user@host

# Check SFTP specifically
sftp user@host
```

### Rsync Not Found
```bash
# Install rsync
# Ubuntu/Debian
sudo apt-get install rsync

# macOS
brew install rsync

# Test it works
rsync --version
```

### S3 Access Denied
- Verify access key and secret are correct
- Check IAM permissions (need s3:PutObject, s3:GetObject)
- Verify bucket name and region
- Check endpoint URL for non-AWS providers

---

## 📖 References

- [Rclone Documentation](https://rclone.org/docs/)
- [SFTP Backend](https://rclone.org/sftp/)
- [FTP Backend](https://rclone.org/ftp/)
- [Rsync](https://rsync.samba.org/)
- [S3 Backend](https://rclone.org/s3/)
- [AWS S3 Documentation](https://aws.amazon.com/s3/)

---

**Need another backend?** Check [rclone's full list of 40+ backends](https://rclone.org/overview/) - most can be added with minimal configuration!

