# 🚀 Split-It Complete Setup Guide

Welcome! This guide will walk you through setting up the Split-It expense sharing application on your local machine. Follow each step carefully, and you'll have the app running in no time!

## 📑 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Installation](#project-installation)
3. [MongoDB Atlas Setup](#mongodb-atlas-setup)
4. [Google OAuth Setup](#google-oauth-setup)
5. [Environment Configuration](#environment-configuration)
6. [Running the Application](#running-the-application)
7. [Verification](#verification)
8. [Common Issues](#common-issues)
9. [Next Steps](#next-steps)

---

## Prerequisites

Before starting, ensure you have the following installed and ready:

### Required Software

#### 1. Node.js (v16 or higher)

**Download & Install:**
- Visit: https://nodejs.org/
- Download the **LTS version** (Long Term Support)
- Run the installer
- Accept default settings

**Verify Installation:**
```bash
node --version
# Should show: v16.x.x or higher

npm --version
# Should show: 8.x.x or higher
```

#### 2. Git (Optional but Recommended)

**Download & Install:**
- Visit: https://git-scm.com/downloads
- Download for your OS
- Run installer with default settings

**Verify Installation:**
```bash
git --version
# Should show: git version 2.x.x
```

#### 3. Code Editor (Recommended: VS Code)

- Download: https://code.visualstudio.com/
- Install with default settings
- Recommended extensions:
  - ESLint
  - Prettier
  - ES7+ React/Redux/React-Native snippets

### Required Accounts (Free)

1. **MongoDB Atlas Account** - For database
   - Sign up at: https://www.mongodb.com/cloud/atlas
   
2. **Google Cloud Account** - For Google Sign-In (optional but recommended)
   - Access console at: https://console.cloud.google.com/

---

## Project Installation

### Step 1: Get the Project Files

**Option A: If you have the project folder**
```bash
# Navigate to the project directory
cd D:\Projects\split-it
```

**Option B: Clone from Git (if applicable)**
```bash
cd D:\Projects
git clone <repository-url>
cd split-it
```

### Step 2: Install Dependencies

Open a terminal/command prompt in the project root directory:

```bash
# Install frontend dependencies
npm install
```

You should see output like:
```
added 1476 packages in 45s
```

Now install backend dependencies:

```bash
# Navigate to server folder
cd server

# Install backend dependencies
npm install
```

You should see:
```
added 138 packages in 12s
```

Return to root:
```bash
cd ..
```

**Alternative: Install All at Once**
```bash
npm run install-all
```

✅ **Checkpoint:** You should now have two `node_modules` folders:
- `D:\Projects\split-it\node_modules` (frontend)
- `D:\Projects\split-it\server\node_modules` (backend)

---

## MongoDB Atlas Setup

MongoDB Atlas is a cloud database service. We'll use the free tier (M0) which is perfect for development.

### Step 1: Create MongoDB Account

1. Go to https://www.mongodb.com/cloud/atlas
2. Click **"Try Free"**
3. Fill in your details:
   - Email address
   - First name & Last name
   - Password (save this!)
4. Click **"Create your Atlas account"**
5. Check your email and verify your account

### Step 2: Create a Cluster

1. After logging in, click **"Build a Database"**

2. **Choose a Path:**
   - Select **"M0 FREE"** (first option)
   - Click **"Create"**

3. **Cloud Provider & Region:**
   - Provider: AWS (or any)
   - Region: Choose closest to your location
   - Cluster Name: `Cluster0` (default is fine)
   - Click **"Create Cluster"**

⏳ Wait 3-5 minutes for cluster creation.

### Step 3: Create Database User

1. While cluster is creating, you'll see **"Security Quickstart"**

2. **Authentication Method:**
   - Choose **"Username and Password"**
   - Username: `splitit_user` (or any name you prefer)
   - Password: Click **"Autogenerate Secure Password"**
   
   **⚠️ IMPORTANT:** 
   - Click the **"Copy"** button next to the password
   - Save this password in a text file (you'll need it soon!)
   - Example: `aB3$xY9mK2pL5qR8`

3. Click **"Create User"**

### Step 4: Configure Network Access

1. Click **"Add My Current IP Address"**
   - This allows your computer to access the database

2. **For Development (Recommended):**
   - Click **"Allow Access from Anywhere"**
   - This adds `0.0.0.0/0` (accessible from any IP)
   - ⚠️ This is fine for development, but for production, restrict to specific IPs

3. Click **"Finish and Close"**

### Step 5: Get Connection String

1. Click **"Go to Databases"**
2. Wait for cluster status to show **"Active"** (green dot)
3. Click the **"Connect"** button on your cluster
4. Choose **"Connect your application"**
5. **Driver:** Node.js
6. **Version:** 4.1 or later
7. Copy the connection string (looks like this):

```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

8. **Modify the connection string:**
   - Replace `<username>` with your database username (`splitit_user`)
   - Replace `<password>` with the password you saved earlier
   - Example result:
   ```
   mongodb+srv://splitit_user:aB3$xY9mK2pL5qR8@cluster0.ljjyjmi.mongodb.net/?retryWrites=true&w=majority
   ```

9. **Save this modified connection string** - you'll need it in Step 5!

✅ **Checkpoint:** You should have:
- MongoDB Atlas account created ✓
- Cluster active ✓
- Database user created ✓
- Network access configured ✓
- Connection string copied ✓

---

## Google OAuth Setup

Google OAuth allows users to sign in with their Google accounts. This is optional but highly recommended for better user experience.

### Step 1: Access Google Cloud Console

1. Go to https://console.cloud.google.com/
2. Sign in with your Google account
3. Accept terms if prompted

### Step 2: Create a New Project

1. Click the **project dropdown** (top left, next to "Google Cloud")
2. Click **"New Project"** (top right)
3. **Project name:** `Split-It` (or any name)
4. **Organization:** Leave as "No organization"
5. Click **"Create"**
6. Wait for project creation (~10 seconds)
7. Click **"Select Project"** in the notification

### Step 3: Enable Google+ API

1. In the left sidebar, click **"APIs & Services"** → **"Library"**
2. Search for: `Google+ API`
3. Click on **"Google+ API"**
4. Click **"Enable"**
5. Wait for it to enable (~5 seconds)

### Step 4: Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. User Type: Select **"External"**
3. Click **"Create"**

**OAuth consent screen (Page 1):**
- App name: `Split-It`
- User support email: Your email
- App logo: (optional - skip for now)
- Application home page: `http://localhost:3000` (for now)
- Authorized domains: (leave empty for development)
- Developer contact information: Your email
- Click **"Save and Continue"**

**Scopes (Page 2):**
- Click **"Save and Continue"** (no changes needed)

**Test users (Page 3):**
- Click **"Add Users"**
- Add your email address (for testing)
- Click **"Add"**
- Click **"Save and Continue"**

**Summary (Page 4):**
- Review and click **"Back to Dashboard"**

### Step 5: Create OAuth Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ Create Credentials"** (top)
3. Select **"OAuth client ID"**

**Configure OAuth Client:**
- Application type: **"Web application"**
- Name: `Split-It Local Development`

**Authorized JavaScript origins:**
- Click **"+ Add URI"**
- Add: `http://localhost:3000`

**Authorized redirect URIs:**
- Click **"+ Add URI"**
- Add: `http://localhost:5000/api/auth/google/callback`

4. Click **"Create"**

### Step 6: Save Credentials

A popup will show your credentials:

1. **Client ID** (looks like): 
   ```
   247874876982-abc123def456.apps.googleusercontent.com
   ```
   - Click the **copy icon** to copy it
   - Save to a text file

2. **Client Secret** (looks like):
   ```
   GOCSPX-AbC123DeF456GhI789JkL012
   ```
   - Click the **copy icon** to copy it
   - Save to a text file

3. Click **"OK"**

✅ **Checkpoint:** You should have:
- Google Cloud project created ✓
- OAuth consent screen configured ✓
- OAuth credentials created ✓
- Client ID saved ✓
- Client Secret saved ✓

---

## Environment Configuration

Now we'll configure the application with your MongoDB and Google credentials.

### Step 1: Backend Environment File

1. **Navigate to:** `D:\Projects\split-it\server\`

2. **Create a new file:** `.env` (yes, just `.env` with no name before the dot)
   - In VS Code: Right-click server folder → New File → type `.env`
   - In Windows Explorer: Create new text file → rename to `.env` (remove the .txt)

3. **Add the following content:**

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Connection
# IMPORTANT: Replace with YOUR connection string from Step 3
MONGODB_URI=mongodb+srv://splitit_user:YOUR_PASSWORD_HERE@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority

# JWT Secret (use a random string - at least 32 characters)
# You can generate one at: https://www.grc.com/passwords.htm
JWT_SECRET=a8f5f167f44f4964e6c998dee827110c45e1a9a5f1a0a5e5f9d9e9c9b9a9d9e9

# Server & Client URLs
SERVER_URL=http://localhost:5000
CLIENT_URL=http://localhost:3000

# Google OAuth Credentials
# IMPORTANT: Replace with YOUR credentials from Step 4
GOOGLE_CLIENT_ID=247874876982-abc123def456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-AbC123DeF456GhI789JkL012
```

4. **Replace the placeholders:**
   - `MONGODB_URI`: Your complete MongoDB connection string
   - `GOOGLE_CLIENT_ID`: Your Google Client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google Client Secret

5. **Save the file** (Ctrl+S)

### Step 2: Frontend Environment File

1. **Navigate to:** `D:\Projects\split-it\` (root folder)

2. **Create a new file:** `.env`

3. **Add the following content:**

```env
# API URL (where your backend server runs)
REACT_APP_API_URL=http://localhost:5000/api

# Google OAuth Client ID (same as backend)
REACT_APP_GOOGLE_CLIENT_ID=247874876982-abc123def456.apps.googleusercontent.com
```

4. **Replace:**
   - `REACT_APP_GOOGLE_CLIENT_ID`: Your Google Client ID (same as in backend)

5. **Save the file** (Ctrl+S)

### Step 3: Verify Environment Files

**Check that you have:**
- `D:\Projects\split-it\.env` (frontend) ✓
- `D:\Projects\split-it\server\.env` (backend) ✓

**Common mistakes to avoid:**
- ❌ `.env.txt` - Wrong! Should be just `.env`
- ❌ `.env ` (with space) - Wrong! No spaces
- ❌ File inside `src/` folder - Wrong! Should be in root
- ✅ `.env` - Correct!

✅ **Checkpoint:** You should have:
- Backend `.env` file created ✓
- Frontend `.env` file created ✓
- MongoDB URI configured ✓
- Google credentials configured ✓
- JWT secret set ✓

---

## Running the Application

Now for the exciting part - let's run the app!

### Option 1: Run Both Servers Together (Recommended)

Open a terminal in the project root (`D:\Projects\split-it`):

```bash
npm run dev
```

This will start:
- ✅ Backend server on `http://localhost:5000`
- ✅ Frontend React app on `http://localhost:3000`

**Expected Output:**

```
[server] Server running on http://localhost:5000
[server] MongoDB connected successfully
[react] Compiled successfully!
[react] 
[react] You can now view split-it in the browser.
[react] 
[react]   Local:            http://localhost:3000
```

Your browser should automatically open to `http://localhost:3000` 🎉

### Option 2: Run Servers Separately

**Terminal 1 - Backend:**
```bash
cd server
npm start
```

Wait for:
```
Server running on http://localhost:5000
MongoDB connected successfully
```

**Terminal 2 - Frontend:**
```bash
# Open a new terminal
npm start
```

Browser opens to `http://localhost:3000` automatically.

### What If Ports Are Already in Use?

**Port 3000 is busy:**
- The app will ask: `Would you like to run the app on another port instead? (Y/n)`
- Type `Y` and press Enter
- App will run on port 3001 (or next available)

**Port 5000 is busy:**
```bash
# Windows - Find what's using port 5000
netstat -ano | findstr :5000

# Kill the process (replace <PID> with the number shown)
taskkill /PID <PID> /F

# Or change port in server/.env
PORT=5001
```

---

## Verification

Let's verify everything works!

### Step 1: Check Backend Health

Open a new browser tab:
```
http://localhost:5000/api
```

You should see a JSON response (or error page - that's okay if routes are protected).

### Step 2: Test Frontend

In your browser at `http://localhost:3000`:

**You should see:**
- ✅ Split-It landing page
- ✅ "Get Started" button
- ✅ "Login" and "Sign Up" buttons
- ✅ Professional UI with gradient background

### Step 3: Test Sign Up

1. Click **"Sign Up"** button
2. Fill in the form:
   - Name: Your name
   - Email: your.email@example.com
   - Password: Choose a password (min 6 characters)
3. Click **"Create Account"**

**Expected Result:**
- ✅ Toast notification: "Welcome! Account created successfully"
- ✅ Redirected to Dashboard
- ✅ You see your name in the navbar

### Step 4: Test Google Sign-In

1. Log out (click your name → Log out)
2. Go to Login page
3. Click **"Sign in with Google"** button

**Expected Result:**
- ✅ Google popup opens
- ✅ Select your Google account
- ✅ Logged in and redirected to Dashboard

**If you see console errors:**
- Check [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md) for detailed troubleshooting
- The 403 warnings don't affect functionality - authentication still works!

### Step 5: Test Core Features

**Create a Group:**
1. Click **"Groups"** in navbar
2. Click **"Create New Group"**
3. Name: "Weekend Trip"
4. Description: "Beach trip with friends"
5. Currency: USD
6. Click **"Create Group"**

**Expected Result:**
- ✅ Group created
- ✅ Shows in groups list
- ✅ You can view group details

**Add an Expense:**
1. Click **"Add Expense"** in navbar
2. Select your group
3. Description: "Hotel booking"
4. Amount: 200
5. Category: Accommodation
6. Click **"Add Expense"**

**Expected Result:**
- ✅ Expense added
- ✅ Shows in group's expense list
- ✅ Balances updated

✅ **Checkpoint:** Everything works!
- Sign up works ✓
- Login works ✓
- Google Sign-In works ✓
- Groups work ✓
- Expenses work ✓

---

## Common Issues

### Issue 1: MongoDB Connection Failed

**Error:**
```
MongoServerError: bad auth: Authentication failed
```

**Solutions:**
1. Check your `.env` file in `server/` folder
2. Verify the connection string format:
   - Should have your username
   - Should have your password (no `<` or `>` brackets)
   - Should have correct cluster URL
3. Make sure IP is whitelisted in MongoDB Atlas
4. Try regenerating database user password in MongoDB Atlas

### Issue 2: Cannot Find Module 'XXX'

**Error:**
```
Error: Cannot find module 'express'
```

**Solution:**
```bash
# Reinstall dependencies
cd server
npm install
cd ..
npm install
```

### Issue 3: Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solution:**
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Or use a different port in server/.env
PORT=5001
```

### Issue 4: React App Won't Start

**Error:**
```
Cannot find module './App'
```

**Solution:**
1. Make sure you're in the correct directory
2. Check that `src/App.js` exists
3. Try deleting `node_modules` and reinstalling:
```bash
rm -rf node_modules
npm install
```

### Issue 5: Environment Variables Not Loading

**Problem:**
- `process.env.REACT_APP_API_URL` is undefined

**Solution:**
1. Make sure `.env` file is in the ROOT directory (not in `src/`)
2. Variable names MUST start with `REACT_APP_`
3. **Restart the development server** after changing `.env`
4. No quotes needed around values in `.env` file

### Issue 6: Google Sign-In Not Working

**Error:**
```
The given origin is not allowed for the given client ID
```

**Solution:**
1. Go to Google Cloud Console → Credentials
2. Edit your OAuth 2.0 Client ID
3. Under "Authorized JavaScript origins", add:
   - `http://localhost:3000`
4. Save and wait 2-5 minutes
5. Clear browser cache or try incognito mode

### Issue 7: Database User Permissions

**Error:**
```
MongoServerError: user is not allowed to do action
```

**Solution:**
1. Go to MongoDB Atlas → Database Access
2. Edit your database user
3. Change privileges to "Atlas Admin"
4. Save and wait 30 seconds

### Need More Help?

1. Check the [README.md](README.md) troubleshooting section
2. Review [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md) for OAuth issues
3. Check your terminal/console for specific error messages
4. Verify all environment variables are set correctly

---

## Next Steps

🎉 **Congratulations!** You now have Split-It running on your machine!

### What to Do Next:

1. **Explore the App:**
   - Create more groups
   - Add expenses with different split methods
   - Try the analytics page
   - Test settlements
   - Export data as CSV/PDF

2. **Learn the Codebase:**
   - Review `src/` folder structure
   - Understand Context API usage
   - Explore the backend routes
   - Check the database models

3. **Customize:**
   - Change the color scheme in `tailwind.config.js`
   - Add new expense categories in `src/data/categories.js`
   - Modify the landing page
   - Add your own features

4. **Development Tips:**
   - Use React DevTools browser extension
   - Install MongoDB Compass to view your database
   - Use Postman to test API endpoints
   - Keep browser console open for errors

### Recommended Next Features to Build:

1. ✨ Receipt upload functionality
2. 📧 Email notifications
3. 💬 Group chat
4. 📊 More analytics charts
5. 🌙 Dark mode toggle
6. 🔄 Recurring expenses
7. 💰 Budget limits per group
8. 🔔 Payment reminders

### Resources:

- **React Docs:** https://react.dev/
- **Express Docs:** https://expressjs.com/
- **MongoDB Docs:** https://docs.mongodb.com/
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Project README:** [README.md](README.md)

### Questions or Issues?

- Review this guide again
- Check console logs for errors
- Verify all environment variables
- Test with different browsers
- Clear cache and restart servers

---

## 📝 Quick Reference

### Start the App (After Setup)
```bash
cd D:\Projects\split-it
npm run dev
```

### Environment Files Needed
- `D:\Projects\split-it\.env` (frontend)
- `D:\Projects\split-it\server\.env` (backend)

### URLs
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

### Important Accounts
- MongoDB Atlas: https://cloud.mongodb.com/
- Google Cloud Console: https://console.cloud.google.com/

---

**Happy Coding! 🚀**

If you found this guide helpful, give the project a ⭐ and share it with your friends!
