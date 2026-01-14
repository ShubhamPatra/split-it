# Split-It Local Development Setup Guide

This guide will help you set up Split-It on your local machine for development.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Prerequisites](#prerequisites)
4. [Environment Setup](#environment-setup)
5. [Environment Variables](#environment-variables)
6. [MongoDB Setup](#mongodb-setup)
7. [Google OAuth Setup](#google-oauth-setup-optional)
8. [SMTP Setup](#smtp-setup-optional)
9. [Running the Application](#running-the-application)
10. [How Cron Jobs Work](#how-cron-jobs-work)
11. [Testing](#testing)
12. [Common Errors & Fixes](#common-errors--fixes)
13. [Development Tips](#development-tips)
14. [Project Scripts](#project-scripts)

---

## Project Overview

**Split-It** is a full-featured expense sharing application that makes it easy to track shared costs, settle debts, and manage group finances. Whether you're splitting rent with roommates, tracking trip expenses, or managing shared household costs, Split-It handles the complexity.

**Key Features:**
- Multiple split types (equal, exact, percentage, itemized)
- Real-time updates with WebSocket
- Multi-currency support (INR, USD, EUR, GBP)
- Recurring expenses with automatic processing
- Push notifications and email digests
- PWA support with offline mode

**Live Demo:** [https://split-it.live](https://split-it.live)

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, Tailwind CSS, shadcn/ui, Socket.IO Client, Chart.js |
| **Backend** | Node.js 20, Express, MongoDB, Socket.IO, node-cron, Nodemailer |
| **Architecture** | Single-instance, in-memory scheduling (no Redis required) |

---

## Prerequisites

Before you begin, ensure you have the following installed:

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Node.js | 20+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | Any | `git --version` |

You'll also need:
- **MongoDB Atlas account** (free tier available) OR local MongoDB installation
- **Code editor** (VS Code recommended)

---

## Folder Structure

```
split-it/
├── docker-compose.yml      # Production deployment
├── Dockerfile              # API container build
├── nginx.conf              # Nginx reverse proxy config
├── .env.example            # Environment template
├── public/                 # Static assets (favicon, manifest, icons)
├── src/                    # React frontend source
│   ├── components/         # Reusable UI components
│   ├── context/            # React context providers
│   ├── data/               # Static data files
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Library utilities (shadcn/ui)
│   ├── pages/              # Page components (routes)
│   └── utils/              # Utility functions
├── server/                 # Node.js backend
│   ├── config/             # Configuration (database, socket, etc.)
│   ├── controllers/        # Route handlers
│   ├── jobs/               # Cron job definitions (scheduler, handlers)
│   ├── middleware/         # Express middleware
│   ├── migrations/         # Database migration scripts
│   ├── models/             # Mongoose schemas
│   ├── routes/             # API route definitions
│   ├── utils/              # Utility functions
│   └── server.js           # Entry point
├── build/                  # Production frontend build (generated)
├── SETUP.md                # Local development guide (this file)
├── DEPLOYMENT.md           # Production deployment guide
└── README.md               # Project overview
```

---

## Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/ShubhamPatra/split-it.git
cd split-it
```

### 2. Install Dependencies

```bash
# Install root (frontend) dependencies
npm install

# Install server (backend) dependencies
cd server
npm install
cd ..
```

Or use the convenience script:
```bash
npm run install-all
```

### 3. Create Environment File

```bash
# Copy the example environment file
cd server
cp .env.example .env
```

Now edit `server/.env` with your actual values (see next section).

---

## Environment Variables

Edit `server/.env` with these values:

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `PORT` | Backend server port | `5000` | Yes |
| `NODE_ENV` | Environment mode | `development` | Yes |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://...` | Yes |
| `JWT_SECRET` | Secret for signing tokens | Random 32+ char string | Yes |
| `JWT_EXPIRES_IN` | Token expiration | `7d` | Yes |
| `SERVER_URL` | Backend URL | `http://localhost:5000` | Yes |
| `CLIENT_URL` | Frontend URL | `http://localhost:3000` | Yes |
| `ALLOWED_ORIGINS` | Additional CORS origins (comma-separated) | `http://localhost:3001` | No |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `xxx.apps.googleusercontent.com` | No |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | `GOCSPX-xxx` | No |
| `SMTP_HOST` | Email server host | `smtp.gmail.com` | No |
| `SMTP_PORT` | Email server port | `587` | No |
| `SMTP_USER` | Email account | `your_email@gmail.com` | No |
| `SMTP_PASS` | Email password/app password | `xxxx xxxx xxxx xxxx` | No |
| `SMTP_FROM` | Sender email address | `your_email@gmail.com` | No |

> **Note**: `ALLOWED_ORIGINS` allows additional CORS origins beyond `CLIENT_URL`. Leave blank for single-origin setups.

**Generate a secure JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## MongoDB Setup

### Option A: MongoDB Atlas (Recommended)

1. **Create Account**: Go to [cloud.mongodb.com](https://cloud.mongodb.com/) and sign up
2. **Create Free Cluster**: Click "Build a Cluster" → Choose M0 (Free tier)
3. **Create Database User**:
   - Go to Database Access → Add New Database User
   - Set username and password (save these!)
   - Set privileges to "Read and Write to any database"
4. **Configure Network Access**:
   - Go to Network Access → Add IP Address
   - For development: Click "Allow Access from Anywhere" (`0.0.0.0/0`)
5. **Get Connection String**:
   - Go to Clusters → Connect → Connect your application
   - Copy the connection string
   - Replace `<password>` with your database user's password
   - Add database name: `...mongodb.net/splitit?retryWrites=true&w=majority`

Example connection string:
```
mongodb+srv://myuser:mypassword@cluster0.abc123.mongodb.net/splitit?retryWrites=true&w=majority
```

### Option B: Local MongoDB

1. **Install MongoDB Community Edition**: [Download here](https://www.mongodb.com/try/download/community)
2. **Start MongoDB service**:
   ```bash
   # Windows
   net start MongoDB
   
   # macOS
   brew services start mongodb-community
   
   # Linux
   sudo systemctl start mongod
   ```
3. **Use local connection string**:
   ```
   MONGODB_URI=mongodb://localhost:27017/splitit
   ```

---

## Google OAuth Setup (Optional)

To enable "Sign in with Google":

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure the consent screen if prompted
6. Set Application Type: **Web application**
7. Add **Authorized JavaScript origins**:
   ```
   http://localhost:3000
   ```
8. Add **Authorized redirect URIs**:
   ```
   http://localhost:3000
   http://localhost:5000/api/auth/google/callback
   ```
9. Copy **Client ID** and **Client Secret** to your `.env`:
   ```
   GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-your_client_secret
   ```

---

## SMTP Setup (Optional)

For email features (password reset, notifications):

### Gmail Setup

1. **Enable 2-Factor Authentication**:
   - Go to [myaccount.google.com/security](https://myaccount.google.com/security)
   - Enable 2-Step Verification
2. **Generate App Password**:
   - Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and your device
   - Copy the 16-character password
3. **Update `.env`**:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=xxxx xxxx xxxx xxxx
   SMTP_FROM=your_email@gmail.com
   ```

### Alternative: Mailtrap (Testing)

For testing emails without sending real ones:
1. Sign up at [mailtrap.io](https://mailtrap.io/)
2. Get SMTP credentials from your inbox
3. Use Mailtrap's SMTP host/port/credentials

---

## Running the Application

### Development Mode (Recommended)

Run both frontend and backend simultaneously:

```bash
npm run dev
```

This starts:
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend**: [http://localhost:5000](http://localhost:5000)

### Frontend Only

```bash
npm start
```

### Backend Only

```bash
npm run server
```

---

## How Cron Jobs Work

Split-It uses **node-cron** for scheduled jobs. All jobs run in-process (no external queue like Redis/BullMQ).

| Job | Schedule | Purpose |
|-----|----------|---------|
| Recurring Expenses | Every hour at :00 | Process due recurring expenses |
| Recurring Reminders | Daily at 9:00 AM | Send upcoming recurring expense reminders |
| Weekly Digest | Monday at 9:00 AM | Send weekly activity summary |
| Monthly Digest | 1st of month at 9:00 AM | Send monthly activity summary |
| Due Reminders | Daily at 10:00 AM | Send payment due reminders |

**Local Development Notes:**
- Jobs start automatically when the server starts
- Check terminal logs for job execution messages
- Jobs respect `NODE_ENV` (less verbose in production)
- Scheduler file: `server/jobs/scheduler.js`

---

## Testing

### Run All Tests

```bash
cd server
npm test
```

### Run with Coverage

```bash
cd server
npm run test:coverage
```

### Run Specific Test Suites

```bash
cd server
npm run test:controllers
npm run test:models
npm run test:middleware
```

---

## Common Errors & Fixes

### MongoDB Connection Failed

**Error**: `MongoNetworkError` or `ECONNREFUSED`

**Solutions**:
- Verify `MONGODB_URI` is correct in `.env`
- Check MongoDB Atlas network access (whitelist your IP)
- Ensure credentials are correct (no special characters in password without encoding)
- Test connection: `mongosh "your_connection_string"`

### Port Already in Use

**Error**: `EADDRINUSE: address already in use`

**Solutions**:
```bash
# Find process using port (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Find process using port (macOS/Linux)
lsof -i :3000
kill -9 <PID>

# Or change PORT in .env
```

### Google OAuth Error

**Error**: Redirect URI mismatch

**Solutions**:
- Ensure authorized redirect URIs in Google Console match exactly:
  - `http://localhost:3000`
  - `http://localhost:5000/api/auth/google/callback`
- No trailing slashes
- HTTP (not HTTPS) for localhost

### SMTP Authentication Failed

**Error**: `Invalid login` or `Authentication failed`

**Solutions**:
- Regenerate App Password (Gmail)
- Ensure 2FA is enabled on Gmail account
- Use `your_email@gmail.com` format (not just username)
- Check SMTP_HOST and SMTP_PORT values

### Module Not Found

**Error**: `Cannot find module`

**Solutions**:
```bash
# Reinstall all dependencies
rm -rf node_modules
npm install
cd server
rm -rf node_modules
npm install
```

---

## Development Tips

1. **Auto-restart**: Backend uses `nodemon` for automatic restart on file changes
2. **Startup logs**: Check `server/server.js` for initialization messages
3. **Query monitoring**: Enable via `server/utils/queryMonitor.js`
4. **Socket debugging**: Use browser DevTools → Network → WS tab
5. **Clear cache**: Hard refresh (`Ctrl+Shift+R`) if UI doesn't update
6. **VS Code extensions**:
   - ESLint
   - Prettier
   - MongoDB for VS Code
   - Tailwind CSS IntelliSense

---

## Project Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start React development server |
| `npm run build` | Build production frontend |
| `npm run server` | Start backend with nodemon |
| `npm run dev` | Run frontend + backend concurrently |
| `npm run install-all` | Install all dependencies |
| `cd server && npm test` | Run backend tests |
| `cd server && npm run test:coverage` | Run tests with coverage |

---

## Next Steps

- Read [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment
- Explore the [API Endpoints](./README.md#-api-endpoints)
- Contribute to the project on [GitHub](https://github.com/ShubhamPatra/split-it)
