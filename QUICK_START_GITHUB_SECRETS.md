# Quick Start: Fix Google OAuth client_id=undefined Error

## Problem
Your app shows: `client_id=undefined` and Google Sign-In doesn't work. This is because the build didn't include your Google OAuth credentials.

## Root Cause
React apps need `REACT_APP_GOOGLE_CLIENT_ID` to be set **at build time**. GitHub Actions builds your app, so it needs access to this secret.

## Solution (3 Steps - 2 minutes)

### Step 1: Go to GitHub Secrets
1. Open your GitHub repository: https://github.com/ShubhamPatra/split-it
2. Click **Settings** (top-right corner of repo page)
3. Click **Secrets and variables** → **Actions** (left sidebar)

### Step 2: Create ONE Secret
Click **New repository secret** and add:

```
Name:  REACT_APP_GOOGLE_CLIENT_ID
Value: [YOUR-GOOGLE-CLIENT-ID-FROM-.env]
```

Get your Google Client ID from:
- Your local `.env` file (copy from GOOGLE_CLIENT_ID value)
- OR from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

Click **Add secret**

### Step 3: Trigger Redeploy
Push any change to GitHub to trigger a rebuild:

```bash
git add .github/workflows/deploy.yml
git commit -m "Add GitHub secrets for production deployment"
git push
```

## What Happens Next
1. GitHub Actions workflow runs automatically
2. Build step now has access to `REACT_APP_GOOGLE_CLIENT_ID` secret
3. React app is rebuilt with the client ID embedded
4. Frontend deploys to split-it.live
5. You refresh the page → Google Sign-In button works ✓

## Verification

After deployment (takes ~2 min):
1. Go to https://split-it.live
2. Hard refresh: `Ctrl+Shift+Delete` (or `Cmd+Shift+Delete` on Mac)
3. Check browser console (F12) for errors
4. Google Sign-In button should now work

## If Still Not Working

**Check GitHub Actions:**
- Go to your repo → **Actions** tab
- Click the latest workflow run
- Look for **Build frontend** step
- Verify it shows: `REACT_APP_GOOGLE_CLIENT_ID: ***` (secrets are masked)

**Check Secret is Added:**
- Settings → Secrets and variables → Actions
- Confirm `REACT_APP_GOOGLE_CLIENT_ID` is in the list

**Check Browser Cache:**
- Hard refresh: `Ctrl+Shift+Delete` → Clear all
- Reload page

**Check Google Cloud Console:**
- Verify redirect URI includes: `https://split-it.live/auth/google/callback`

## Additional Secrets (Optional for Later)
If you also need backend OAuth:
```
Name:  GOOGLE_CLIENT_SECRET
Value: [YOUR-GOOGLE-CLIENT-SECRET-FROM-.env]
```

Get your Google Client Secret from your local `.env` or Google Cloud Console.

But this is only needed if you're authenticating users on the backend too.
