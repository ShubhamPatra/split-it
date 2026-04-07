# Vercel Backend Deployment Guide

## Problem
You're getting 404 on `api.split-it.live` because the backend has never been deployed to Vercel.

## What Needs to Happen

1. Create a Vercel account (if you don't have one)
2. Connect your GitHub repository to Vercel
3. Configure the deployment to deploy from `server/` folder
4. Set environment variables for production
5. Deploy
6. Configure custom domain `api.split-it.live`

## Step-by-Step Deployment

### Step 1: Create Vercel Account
- Go to https://vercel.com
- Sign up with GitHub (recommended - easy integration)
- Authorize Vercel to access your GitHub

### Step 2: Import Your Repository
1. Go to https://vercel.com/new
2. Click **Import your Git Repository**
3. Find and select **split-it** repository
4. Click **Import**

### Step 3: Configure Project Settings
On the import page, you'll see configuration options:

**Root Directory:**
- Change from `./` to `server/`
- This tells Vercel to deploy the backend folder

**Environment Variables:**
Add these production secrets:
```
MONGODB_URI = mongodb+srv://...
JWT_SECRET = your-32-char-secret
GOOGLE_CLIENT_ID = your-google-client-id
GOOGLE_CLIENT_SECRET = your-google-client-secret
CRON_SECRET = your-cron-secret
ALLOWED_ORIGINS = https://split-it.live,https://www.split-it.live
SERVER_URL = https://api.split-it.live
CLIENT_URL = https://split-it.live
REALTIME_PROVIDER = polling
ENABLE_IN_PROCESS_SCHEDULER = false
ENABLE_PERSISTENT_TIMERS = false
OCR_PROCESSING_MODE = async
```

Get the actual values from your local `.env` file.

### Step 4: Deploy
Click **Deploy** button. Vercel will:
1. Clone your repository
2. Install dependencies in `server/` folder
3. Build serverless functions
4. Deploy to Vercel infrastructure
5. Give you a URL like `split-it-api.vercel.app`

### Step 5: Configure Custom Domain
After deployment:
1. In Vercel dashboard, select your project
2. Go to **Settings** → **Domains**
3. Click **Add Custom Domain**
4. Enter: `api.split-it.live`
5. Follow instructions to add DNS records to your domain registrar

**DNS Records to Add:**
```
Type: CNAME
Name: api
Value: cname.vercel.com
```

(Or use the specific CNAME that Vercel provides)

### Step 6: Verify Deployment

Test your backend:
```bash
curl https://api.split-it.live/health
```

Should return a health status, not 404.

## Troubleshooting

**Still getting 404?**
- Check Vercel dashboard for deploy errors
- Verify environment variables are set
- Check that Root Directory is set to `server/`
- Wait 60 seconds for DNS to propagate

**Deployment failed?**
- Check build logs in Vercel dashboard
- Ensure `server/package.json` exists
- Verify `server/server.js` exports the app correctly

**Deployment succeeded but no endpoints work?**
- Check that environment variables are set
- Verify `server/api/index.js` and `server/api/[...path].js` exist
- Check application logs in Vercel

## Automatic GitHub Integration

After first deployment, Vercel will:
- ✓ Auto-deploy when you push to `master` branch
- ✓ Create preview deployments for pull requests
- ✓ Show deployment status in GitHub

So next time you push changes to `server/` folder, they'll automatically redeploy!

## Files That Enable Vercel Deployment

- `server/vercel.json` - Configuration for serverless functions
- `server/api/index.js` - Main API entrypoint
- `server/api/[...path].js` - Catch-all route handler
- `server/server.js` - Skips listen() when `VERCEL` env is set

These are all already in place - you just need to deploy them.
