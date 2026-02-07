# Contributing to Split-It

Welcome to Split-It! This guide will help you get up and running with the development environment and understand the codebase structure.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Development Environment Setup](#development-environment-setup)
3. [Architecture Overview](#architecture-overview)
4. [Project Structure](#project-structure)
5. [Development Workflow](#development-workflow)
6. [Common Development Tasks](#common-development-tasks)
7. [Testing](#testing)
8. [Code Style & Standards](#code-style--standards)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start

Get up and running in under 10 minutes:

```bash
# 1. Clone the repository
git clone <repository-url>
cd split-it

# 2. Install dependencies
npm install
cd server && npm install && cd ..

# 3. Set up environment variables
cp .env.example .env
cp server/.env.example server/.env

# 4. Configure MongoDB connection
# Edit server/.env and set MONGODB_URI

# 5. Start development servers
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend
npm start
```

Your app should now be running at:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

---

## Development Environment Setup

### Prerequisites

- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **MongoDB**: v6.0 or higher (local or Atlas)
- **Git**: Latest version

### Recommended Tools

- **VS Code** with extensions:
  - ESLint
  - Prettier
  - MongoDB for VS Code
  - Thunder Client (API testing)
- **MongoDB Compass** (GUI for MongoDB)
- **Postman** or **Thunder Client** (API testing)

### Environment Variables

#### Frontend (.env)

```env
# API endpoint
REACT_APP_API_URL=http://localhost:5000

# Google OAuth (optional)
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
```

#### Backend (server/.env)

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/split-it
# Or MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/split-it

# JWT
JWT_SECRET=your_jwt_secret_here_min_32_chars
JWT_EXPIRE=7d

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
FROM_EMAIL=noreply@split-it.com
FROM_NAME=Split-It

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Redis (optional - for horizontal scaling)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_TLS=false

# File Uploads
UPLOAD_DIR=./uploads/receipts

# Web Push (optional)
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:your_email@example.com

# Sentry (optional - for error tracking)
SENTRY_DSN=your_sentry_dsn
```

### MongoDB Setup

#### Option 1: Local MongoDB

```bash
# Install MongoDB (macOS)
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community

# Verify connection
mongosh
```

#### Option 2: MongoDB Atlas (Cloud)

1. Create account at https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Add your IP to whitelist (or allow all: 0.0.0.0/0 for development)
4. Create database user
5. Get connection string and add to `server/.env`

---

## Architecture Overview

Split-It is a full-stack MERN application with real-time capabilities.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (React)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Pages   │  │Components│  │ Contexts │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       └─────────────┼─────────────┘                     │
│                     ▼                                    │
│         ┌───────────────────────┐                       │
│         │  apiClient / Socket   │                       │
│         └───────────┬───────────┘                       │
└─────────────────────┼─────────────────────────────────┘
                      │ HTTP/WebSocket
                      ▼
┌─────────────────────────────────────────────────────────┐
│                 SERVER (Node.js/Express)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Routes  │→ │Controllers│→ │  Models  │              │
│  └──────────┘  └──────────┘  └────┬─────┘              │
│                                    │                     │
│  ┌──────────┐  ┌──────────┐       │                     │
│  │Socket.IO │  │   Jobs   │       │                     │
│  └──────────┘  └──────────┘       │                     │
└────────────────────────────────────┼─────────────────────┘
                                     ▼
                            ┌─────────────────┐
                            │    MongoDB      │
                            └─────────────────┘
```

### Technology Stack

**Frontend:**
- React 19.2.3
- React Router 7.11.0
- TailwindCSS 3.4.0
- shadcn/ui (Radix UI)
- Socket.IO Client 4.8.3
- Recharts 2.15.0

**Backend:**
- Node.js 20+
- Express.js 4.x
- MongoDB + Mongoose
- Socket.IO 4.8.x
- Passport.js (Auth)
- node-cron (Scheduling)
- Nodemailer (Email)

**Infrastructure:**
- Docker (optional)
- Nginx (reverse proxy)
- Redis (optional - for scaling)

---

## Project Structure

### Frontend Structure

```
src/
├── components/           # Reusable UI components
│   ├── common/          # Shared components (19 files)
│   │   ├── BalanceCard.jsx
│   │   ├── ExpenseCard.jsx
│   │   ├── GroupCard.jsx
│   │   ├── SettlementCard.jsx
│   │   └── ...
│   ├── group/           # Group-specific components (17 files)
│   │   ├── GroupChat.jsx
│   │   ├── InviteModal.jsx
│   │   └── ...
│   └── ui/              # shadcn/ui primitives (26 files)
│       ├── button.jsx
│       ├── card.jsx
│       ├── dialog.jsx
│       └── ...
├── context/             # React Context providers (7 files)
│   ├── AuthContext.jsx
│   ├── GroupContext.jsx
│   ├── ExpenseContext.jsx
│   └── ...
├── hooks/               # Custom React hooks (4 files)
│   ├── useOffline.js
│   ├── useGroupRoles.js
│   └── ...
├── lib/                 # Utility libraries (5 files)
│   ├── apiClient.js     # API wrapper
│   ├── socketClient.js  # Socket.IO client
│   ├── offlineStorage.js # IndexedDB wrapper
│   └── ...
├── pages/               # Page components (19 files)
│   ├── Dashboard.jsx
│   ├── Groups.jsx
│   ├── GroupDetail.jsx
│   ├── AddExpense.jsx
│   └── ...
└── utils/               # Utility functions (13 files)
    ├── helperFunctions.js
    ├── settlementOptimizer.js
    └── ...
```

### Backend Structure

```
server/
├── config/              # Configuration files (6 files)
│   ├── db.js           # MongoDB connection
│   ├── socket.js       # Socket.IO setup (714 lines)
│   ├── passport.js     # Auth strategies
│   ├── redis.js        # Redis configuration
│   └── ...
├── controllers/         # Route handlers (15 files)
│   ├── authController.js
│   ├── expenseController.js
│   ├── groupController.js
│   ├── settlementController.js
│   ├── crossGroupController.js
│   └── ...
├── jobs/               # Background jobs (10 files)
│   ├── scheduler.js    # Cron initialization
│   ├── balanceService.js
│   ├── recurringExpenseJob.js
│   ├── digestJob.js
│   └── ...
├── middleware/         # Express middleware (6 files)
│   ├── authMiddleware.js
│   ├── validation.js
│   ├── upload.js
│   └── ...
├── models/             # Mongoose schemas (9 files)
│   ├── User.js
│   ├── Group.js
│   ├── Expense.js
│   ├── Settlement.js
│   └── ...
├── routes/             # API routes (15 files)
│   ├── authRoutes.js
│   ├── expenseRoutes.js
│   ├── groupRoutes.js
│   └── ...
├── utils/              # Utility modules (15 files)
│   ├── emailTemplates.js
│   ├── logger.js
│   ├── structuredLogger.js
│   ├── metricsTracker.js
│   └── ...
└── server.js           # Entry point (351 lines)
```

---

## Development Workflow

### 1. Create a New Feature

```bash
# 1. Create a feature branch
git checkout -b feature/your-feature-name

# 2. Make your changes
# - Follow existing code patterns
# - Add comments for complex logic
# - Update documentation if needed

# 3. Test your changes
npm test                    # Frontend tests
cd server && npm test       # Backend tests

# 4. Commit your changes
git add .
git commit -m "feat: add your feature description"

# 5. Push and create PR
git push origin feature/your-feature-name
```

### 2. Commit Message Convention

Follow conventional commits:

```
feat: add new feature
fix: bug fix
docs: documentation changes
style: formatting, missing semicolons, etc.
refactor: code restructuring
test: adding tests
chore: maintenance tasks
```

### 3. Code Review Checklist

Before submitting a PR:

- [ ] Code follows existing patterns
- [ ] No console.log statements (use logger)
- [ ] Error handling implemented
- [ ] Input validation added
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
- [ ] Performance considered

---

## Common Development Tasks

### Add a New API Endpoint

1. **Create route handler** in appropriate controller:

```javascript
// server/controllers/yourController.js
import { logger } from '../utils/structuredLogger.js';

export const yourEndpoint = async (req, res) => {
  try {
    // Your logic here
    const result = await YourModel.find({ userId: req.user._id });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('yourEndpoint failed', { error: error.message, userId: req.user?._id });
    res.status(500).json({ message: 'An error occurred' }); // Don't expose internal errors
  }
};
```

2. **Add route** in routes file:

```javascript
// server/routes/yourRoutes.js
import { yourEndpoint } from '../controllers/yourController.js';
router.get('/your-path', protect, yourEndpoint);
```

3. **Register routes** in server.js:

```javascript
// server/server.js
import yourRoutes from './routes/yourRoutes.js';
app.use('/api/your-resource', yourRoutes);
```

### Add a New React Component

1. **Create component** file:

```javascript
// src/components/common/YourComponent.jsx
import React from 'react';

export const YourComponent = ({ prop1, prop2 }) => {
  return (
    <div className="p-4">
      {/* Your JSX */}
    </div>
  );
};
```

2. **Use component** in pages:

```javascript
import { YourComponent } from '../components/common/YourComponent';

function YourPage() {
  return <YourComponent prop1="value" />;
}
```

### Add a New Database Model

1. **Create model** file:

```javascript
// server/models/YourModel.js
import mongoose from 'mongoose';

const yourSchema = new mongoose.Schema({
  field1: { type: String, required: true },
  field2: { type: Number, default: 0 },
  // ... more fields
}, {
  timestamps: true, // Adds createdAt, updatedAt
});

export default mongoose.model('YourModel', yourSchema);
```

2. **Add indexes** for performance:

```javascript
yourSchema.index({ field1: 1 });
yourSchema.index({ field1: 1, field2: -1 }); // Compound index
```

### Add a Socket Event

1. **Emit from backend**:

```javascript
// In controller
const io = req.app.get('io');
io.to(`group:${groupId}`).emit('your:event', data);
```

2. **Listen on frontend**:

```javascript
// In React component or context
useEffect(() => {
  socket.on('your:event', (data) => {
    // Handle event
  });

  return () => socket.off('your:event');
}, []);
```

### Add a Background Job

1. **Create job** file:

```javascript
// server/jobs/yourJob.js
export const yourJob = async () => {
  try {
    // Your job logic
    console.log('Job executed successfully');
  } catch (error) {
    console.error('Job error:', error);
  }
};
```

2. **Schedule job** in scheduler:

```javascript
// server/jobs/scheduler.js
import { yourJob } from './yourJob.js';

cron.schedule('0 0 * * *', yourJob); // Daily at midnight
```

### Add Email Template

1. **Create template** in emailTemplates.js:

```javascript
export const yourEmailTemplate = (data) => `
  <!DOCTYPE html>
  <html>
    <body>
      <h1>${data.title}</h1>
      <p>${data.message}</p>
    </body>
  </html>
`;
```

2. **Send email**:

```javascript
import { sendEmail } from '../utils/emailUtils.js';
import { yourEmailTemplate } from '../utils/emailTemplates.js';

await sendEmail({
  to: user.email,
  subject: 'Your Subject',
  html: yourEmailTemplate({ title: 'Hello', message: 'World' }),
});
```

---

## Testing

### Running Tests

```bash
# Frontend tests
npm test

# Backend tests
cd server && npm test

# Run specific test file
npm test -- YourComponent.test.js

# Run with coverage
npm test -- --coverage
```

### Writing Tests

#### Frontend Component Test

```javascript
// src/components/__tests__/YourComponent.test.js
import { render, screen } from '@testing-library/react';
import { YourComponent } from '../YourComponent';

describe('YourComponent', () => {
  it('renders correctly', () => {
    render(<YourComponent prop1="test" />);
    expect(screen.getByText('test')).toBeInTheDocument();
  });
});
```

#### Backend API Test

```javascript
// server/tests/controllers/your.test.js
import request from 'supertest';
import app from '../../server.js';

describe('Your API', () => {
  it('should return data', async () => {
    const res = await request(app)
      .get('/api/your-endpoint')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });
});
```

---

## Code Style & Standards

### JavaScript/React Standards

- Use ES6+ features (arrow functions, destructuring, async/await)
- Use functional components with hooks (no class components)
- Use const/let (no var)
- Use template literals for strings
- Use optional chaining (?.) and nullish coalescing (??)

### Naming Conventions

- **Components**: PascalCase (`UserProfile.jsx`)
- **Functions**: camelCase (`getUserData`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_FILE_SIZE`)
- **Files**: camelCase for utils, PascalCase for components
- **CSS classes**: kebab-case or Tailwind utilities

### File Organization

- One component per file
- Group related files in folders
- Keep files under 500 lines (split if larger)
- Co-locate tests with components

### Error Handling

Always handle errors gracefully:

```javascript
// Backend - use logger, never expose internal errors
import { logger } from '../utils/structuredLogger.js';

try {
  const result = await someOperation();
  res.json(result);
} catch (error) {
  logger.error('Operation failed', { error: error.message, stack: error.stack });
  res.status(500).json({ message: 'An error occurred' });
}

// Frontend - show user-friendly messages
try {
  const data = await apiClient.get('/endpoint');
  setData(data);
} catch (error) {
  console.error('API error:', error);
  toast.error('Failed to load data. Please try again.');
}
```

### Logging

Use structured logger instead of console.log:

```javascript
// Backend
import { logger } from '../utils/structuredLogger.js';

logger.info('User logged in', { userId, email });
logger.error('Database error', { error: error.message });
logger.debug('Debug info', { data });
```

---

## Troubleshooting

### Common Issues

#### MongoDB Connection Failed

```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution:**
- Check MongoDB is running: `brew services list` (macOS)
- Verify MONGODB_URI in server/.env
- Check MongoDB Atlas IP whitelist

#### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solution:**
```bash
# Find process using port
lsof -i :5000

# Kill process
kill -9 <PID>
```

#### Module Not Found

```
Error: Cannot find module 'package-name'
```

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### Socket Connection Failed

```
WebSocket connection failed
```

**Solution:**
- Check backend is running on correct port
- Verify REACT_APP_API_URL in frontend .env
- Check CORS configuration in server.js

#### Redis Connection Failed

```
Error: Redis connection failed
```

**Solution:**
- Redis is optional - app works without it
- Check REDIS_URL in server/.env
- Verify Redis is running: `redis-cli ping`

### Getting Help

1. Check existing documentation in `server/docs/`
2. Search closed issues on GitHub
3. Ask in team chat/Slack
4. Create a new issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details

---

## Additional Resources

### Documentation

- [API Documentation](./documentation/API.md)
- [Socket Events](./documentation/SOCKET_EVENTS.md)
- [Authentication Guide](./documentation/AUTHENTICATION.md)
- [Mobile API Guide](./documentation/MOBILE_API_GUIDE.md)

### Backend Guides

- [Redis Caching](./server/docs/REDIS_CACHING.md)
- [Balance Optimization](./server/docs/BALANCE_OPTIMIZATION.md)
- [Structured Logging](./server/docs/STRUCTURED_LOGGING_GUIDE.md)
- [Metrics Guide](./server/docs/METRICS_GUIDE.md)
- [Error Tracking](./server/docs/ERROR_TRACKING_GUIDE.md)
- [Security Audit Logging](./server/docs/SECURITY_AUDIT_LOGGING.md)
- [Two-Factor Authentication](./server/docs/TWO_FACTOR_AUTHENTICATION.md)

### Installation Guides

- [Redis Installation](./server/INSTALL_REDIS.md)
- [Winston Logging](./server/INSTALL_WINSTON.md)
- [Sentry Error Tracking](./server/INSTALL_SENTRY.md)

### External Resources

- [React Documentation](https://react.dev/)
- [Express.js Guide](https://expressjs.com/)
- [MongoDB Manual](https://docs.mongodb.com/)
- [Socket.IO Documentation](https://socket.io/docs/)
- [TailwindCSS](https://tailwindcss.com/)

---

## Welcome!

You should now be ready to contribute to Split-It. If you have any questions or run into issues, don't hesitate to ask the team.

Happy coding! 🚀
