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
sed -i 's/YOUR_DOMAIN/split-it.live/g' nginx.conf

# 4. Build frontend
npm install
npm run build

# 5. Deploy
docker compose up -d
```

That's it! Your app is now running.

---

## Vercel / Cloudinary Checklist

Use this checklist if you are deploying Split-It with the frontend on GitHub Pages and the backend on Vercel.

### Required Environment Variables

- Set `REACT_APP_API_URL` to your Vercel backend URL.
- Set `REALTIME_PROVIDER=polling`.
- Set `ENABLE_IN_PROCESS_SCHEDULER=false`.
- Set `ENABLE_PERSISTENT_TIMERS=false`.
- Set `OCR_PROCESSING_MODE=async`.
- Set `CRON_SECRET` to a long random secret.
- Configure Cloudinary with `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_UPLOAD_PRESET`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.

### Verification Steps

1. Upload a receipt from the expense form and confirm the image URL persists after reload.
2. Open the bill scanner, submit an image, and confirm the UI polls until the OCR job completes.
3. Confirm `GET /api/ocr/jobs/:jobId` returns `queued`, `processing`, or `completed` as expected.
4. Confirm `POST /api/jobs/ocr/process` can be called by your external scheduler.
5. Confirm the realtime polling endpoint returns new events for group activity.

### Example Vercel Cron / Worker Call

```bash
curl -X POST "https://your-api.vercel.app/api/jobs/ocr/process?secret=YOUR_CRON_SECRET"
```

If you prefer a header instead of a query string:

```bash
curl -X POST "https://your-api.vercel.app/api/jobs/ocr/process" \
   -H "x-cron-secret: YOUR_CRON_SECRET"
```

---

## Vercel Backend + GitHub Pages Frontend

This repository also supports a split deployment:

- Backend: deploy the `server/` folder as a Vercel project.
- Frontend: deploy the root React app to GitHub Pages.

### Backend on Vercel

Set the Vercel project root to `server/` so it uses `server/package.json` and the API entrypoints in `server/api/`.

Required environment variables:

- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_URL=https://shubhampatra.github.io/split-it`
- `SERVER_URL=https://your-api.vercel.app`
- `REALTIME_PROVIDER=polling`
- `ENABLE_IN_PROCESS_SCHEDULER=false`
- `ENABLE_PERSISTENT_TIMERS=false`
- `OCR_PROCESSING_MODE=async`
- `CRON_SECRET`
- Cloudinary credentials for receipt uploads

### Frontend on GitHub Pages

The root `package.json` includes a GitHub Pages deploy script.

```bash
npm install
npm run deploy:gh-pages
```

Before deploying, set `REACT_APP_API_URL` to your Vercel backend URL so the static site can call the API cross-origin.

The frontend includes a GitHub Pages fallback page so direct refreshes on deep links keep working.

---

## Prerequisites

| Requirement | Details |
| --- | --- |
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
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Random 32+ character string |
| `SERVER_URL` | Backend URL |
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
| --- | --- |
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

```text
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

### Key Points

- Single EC2 instance runs everything
- Nginx handles SSL and static files
- Node.js API runs in Docker container
- MongoDB Atlas for database (no self-hosting)
- No Redis required (in-memory caching)

---

## File Structure

```text
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
