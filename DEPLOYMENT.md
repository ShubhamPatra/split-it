# Split-It Deployment Guide

This guide covers deploying Split-It to production on AWS EC2 with Docker.

---

## Quick Start

```bash
# 1. Clone and setup
git clone https://github.com/ShubhamPatra/split-it.git
cd split-it

# 2. Configure environment
cp .env.example .env
nano .env  # Fill in your values

# 3. Update nginx.conf with your domain
sed -i 's/YOUR_DOMAIN/yourdomain.com/g' nginx.conf

# 4. Build frontend
npm install
npm run build

# 5. Deploy
docker compose up -d
```

That's it! Your app is now running.

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| AWS EC2 | Ubuntu 22.04, t2.micro or better |
| Domain | DNS pointing to EC2 public IP |
| MongoDB Atlas | Free M0 or production M10+ cluster |
| SMTP | Gmail App Password or SendGrid |
| Docker | Installed on EC2 (see below) |

---

## EC2 Setup

### 1. Launch Instance

1. Choose **Ubuntu Server 22.04 LTS**
2. Instance type: t2.micro (free tier) or t2.small (production)
3. Security Group:
   - SSH (22): Your IP
   - HTTP (80): Anywhere
   - HTTPS (443): Anywhere
4. Create SSH key pair

### 2. Install Docker

```bash
# Connect to EC2
ssh -i your-key.pem ubuntu@<ec2-ip>

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu

# Log out and back in
exit
ssh -i your-key.pem ubuntu@<ec2-ip>

# Verify
docker --version
```

### 3. Install Node.js (for building frontend)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## Configuration

### Environment Variables

Create `.env` from the template:

```bash
cp .env.example .env
```

Fill in these required values:

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Random 32+ character string |
| `SERVER_URL` | Your domain (https://yourdomain.com) |
| `CLIENT_URL` | Same as SERVER_URL |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `SMTP_*` | Gmail App Password credentials |

### Nginx Domain Setup

Replace `YOUR_DOMAIN` in nginx.conf:

```bash
# Linux/Mac
sed -i 's/YOUR_DOMAIN/yourdomain.com/g' nginx.conf

# Or manually edit
nano nginx.conf
```

---

## SSL Certificate

### Install Certbot

```bash
sudo apt install certbot -y
```

### Get Certificate

```bash
# Stop nginx temporarily
docker compose down

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Start services
docker compose up -d
```

### Auto-Renewal

Certbot automatically creates a cron job. Verify with:

```bash
sudo certbot renew --dry-run
```

---

## Common Commands

| Action | Command |
|--------|---------|
| **Start** | `docker compose up -d` |
| **Stop** | `docker compose down` |
| **Restart** | `docker compose restart` |
| **View logs** | `docker compose logs -f` |
| **API logs only** | `docker compose logs -f api` |
| **Rebuild** | `docker compose up -d --build` |
| **Check status** | `docker compose ps` |
| **Health check** | `curl localhost:5000/api/health` |

---

## Updating

```bash
# Pull latest code
git pull origin main

# Rebuild frontend
npm run build

# Restart with new code
docker compose up -d --build
```

---

## Troubleshooting

### 502 Bad Gateway

API not running:

```bash
docker compose ps           # Check status
docker compose logs api     # Check errors
docker compose restart api  # Restart
```

### MongoDB Connection Error

- Verify IP whitelist in MongoDB Atlas (add EC2 IP)
- Check connection string format in `.env`
- URL-encode special characters in password

### Emails Not Sending

- Verify 2FA is enabled on Gmail
- Regenerate App Password if needed
- Check SMTP settings in `.env`

### WebSocket Not Connecting

- Verify nginx.conf has `/socket.io/` location block
- Check browser console for errors
- Ensure `CLIENT_URL` matches your domain

---

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Browser   │────▶│    Nginx    │────▶│   Node.js API   │
│             │◀────│  (SSL/Proxy)│◀────│   (Port 5000)   │
└─────────────┘     └─────────────┘     └────────┬────────┘
                           │                     │
                           ▼                     ▼
                    ┌─────────────┐       ┌─────────────┐
                    │ React Build │       │ MongoDB Atlas│
                    │ (Static)    │       └─────────────┘
                    └─────────────┘
```

**Key Points:**
- Single EC2 instance runs everything
- Nginx handles SSL and static files
- Node.js API runs in Docker container
- MongoDB Atlas for database (no self-hosting)
- No Redis required (in-memory caching)

---

## File Structure

```
split-it/
├── docker-compose.yml  # Service definitions
├── Dockerfile          # API container build
├── nginx.conf          # Reverse proxy config
├── .env.example        # Environment template
├── .env                # Your configuration (git-ignored)
├── build/              # React production build
└── server/             # Node.js API code
```

---

## Support

- **Local Development**: See [SETUP.md](./SETUP.md)
- **GitHub Issues**: [github.com/ShubhamPatra/split-it/issues](https://github.com/ShubhamPatra/split-it/issues)
