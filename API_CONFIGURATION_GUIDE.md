# API Configuration Guide - Production Deployment

## Issue Fixed
Your React app was hitting `http://localhost:5000` instead of your production API at `https://api.split-it.live`, causing authentication and all API calls to fail with `ERR_CONNECTION_REFUSED`.

## Root Cause
The GitHub Actions build didn't have `REACT_APP_API_URL` environment variable, so the app defaulted to localhost.

## Solution Applied

### 1. GitHub Actions Workflow Updated
**File:** [.github/workflows/deploy.yml](.github/workflows/deploy.yml)

Added environment variable to build step:
```yaml
- name: Build frontend
  env:
    CI: false
    REACT_APP_GOOGLE_CLIENT_ID: ${{ secrets.REACT_APP_GOOGLE_CLIENT_ID }}
    REACT_APP_API_URL: https://api.split-it.live  # ← ADDED
  run: npm run build
```

This ensures React apps bundles with the correct production API URL.

### 2. Files That Use REACT_APP_API_URL

These files read the environment variable during build/runtime:
- [src/lib/apiClient.js](src/lib/apiClient.js) - All API calls
- [src/lib/socketClient.js](src/lib/socketClient.js) - WebSocket fallback
- [src/components/expense/BillScanner.jsx](src/components/expense/BillScanner.jsx) - OCR uploads
- [src/components/expense/EditExpenseDialog.jsx](src/components/expense/EditExpenseDialog.jsx) - Expense edits
- [src/pages/AddExpense.jsx](src/pages/AddExpense.jsx) - Expense creation

All default to `http://localhost:5000/api` if the environment variable is not set.

### 3. Environment Variable Locations

| Environment | Variable Set | Value |
|-------------|--------------|-------|
| Local dev | `.env` file | `http://localhost:5000/api` |
| GitHub Actions build | Workflow env | `https://api.split-it.live` |
| Production deploy | Built into bundle | `https://api.split-it.live` |

### 4. Verifying the Fix

After GitHub Actions completes:

1. **Check Network Requests (DevTools F12):**
   - Go to Network tab
   - Attempt Google Sign-In
   - Look for POST request to `https://api.split-it.live/api/auth/google`
   - Should get 200 or 400 (not connection refused)

2. **Check Console Errors:**
   - Should NOT see: `localhost:5000`
   - Should NOT see: `ERR_CONNECTION_REFUSED`
   - May see: CORS errors (backend issue), 401 (auth issue), etc.

3. **Check if API calls work:**
   - If you see `https://api.split-it.live/...` requests → ✓ Frontend fixed
   - If you still see `localhost:5000` → Hard refresh didn't pick up new build

### 5. CORS Configuration on Backend

If you see CORS errors after frontend fix, update [server/config/db.js](server/config/db.js) or wherever CORS is configured:

```javascript
cors({
  origin: [
    'https://split-it.live',
    'https://www.split-it.live',
    'http://localhost:3000'  // for local testing
  ],
  credentials: true
})
```

### 6. Checklist for Production Deployment

- ✓ GitHub Secret added: `REACT_APP_GOOGLE_CLIENT_ID`
- ✓ GitHub Actions workflow includes `REACT_APP_API_URL` env var
- ✓ Backend API deployed on Vercel at `api.split-it.live`
- ✓ DNS records configured (A record + CNAME for www)
- ✓ GitHub Pages custom domain set to `split-it.live`
- [ ] CORS origins include `https://split-it.live` on backend
- [ ] Google Cloud Console redirect URIs include `https://split-it.live/auth/google/callback`
- [ ] Test Google Sign-In on production domain
- [ ] Verify API calls reach backend (DevTools Network tab)

### 7. Troubleshooting

**Still hitting localhost:5000?**
- Hard refresh: `Ctrl+Shift+Delete` (clear cache)
- Check GitHub Actions > Build step output
- Verify build shows: `REACT_APP_API_URL: https://api.split-it.live`

**CORS errors?**
- Backend CORS config missing split-it.live origin
- Check server console for CORS rejection logs

**Connection timeout to api.split-it.live?**
- DNS not propagated yet (wait up to 24 hours)
- Vercel deployment not complete
- Check Vercel dashboard for deploy status

**Google OAuth still fails?**
- Redirect URI mismatch in Google Cloud Console
- `REACT_APP_GOOGLE_CLIENT_ID` secret not added to GitHub
- Hard refresh browser cache

## Summary of Changes

1. Updated `.github/workflows/deploy.yml` to pass `REACT_APP_API_URL: https://api.split-it.live` during build
2. All frontend API calls now target production backend
3. Committed and pushed - GitHub Actions is redeploy now
