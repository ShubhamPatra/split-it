# Split-It: Expense Sharing Made Simple

Split-It is a modern web application for splitting expenses among friends and family groups. Built with React, Express.js, MongoDB, and Redis, it provides real-time updates, multiple split methods, and seamless payment tracking.

## Features

- **Group Management**: Create groups and invite friends via shareable invite codes
- **Flexible Expense Splitting**: 
  - Equal split (divide equally among members)
  - Exact amount (specify exact amounts for each person)
  - Percentage-based (distribute by percentage)
  - Itemized (assign items to specific members)
- **Real-Time Updates**: WebSocket integration for instant expense and settlement notifications
- **Smart Settlements**: Auto-calculate optimal payment settlements to minimize transactions
- **Multiple Currencies**: Support for INR, USD, EUR, GBP (easily extensible)
- **Receipt Management**: Upload and store receipts for expense documentation
- **Google OAuth**: One-click authentication with Google
- **Recurring Expenses**: Set up recurring expenses (daily, weekly, monthly, yearly)
- **Push Notifications**: Real-time notifications for group activities
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile browsers

## Tech Stack

**Frontend:**
- React 19 with React Router v7
- Tailwind CSS for styling
- shadcn/ui component library
- Socket.IO for real-time updates

**Backend:**
- Node.js 20 with Express.js
- MongoDB for data storage (Atlas recommended for production)
- Redis for caching and session management
- Socket.IO for WebSocket communication
- Passport.js for OAuth authentication

**Infrastructure:**
- Docker & Docker Compose for containerization
- Nginx for reverse proxy and static file serving

## Getting Started Locally

### Prerequisites

- Node.js 20+ and npm
- MongoDB (local or Atlas connection string)
- Redis (local or cloud instance)
- Google OAuth credentials (optional, for authentication)

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/ShubhamPatra/split-it.git
cd split-it
```

2. **Install dependencies:**
```bash
npm run install-all
```

3. **Create environment files:**

Create `.env` in the root directory:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
```

Create `server/.env`:
```env
MONGODB_URI=mongodb://localhost:27017/splitit
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_super_secret_key_at_least_64_chars_long
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
CLIENT_URL=http://localhost:3000
NODE_ENV=development
PORT=5000
```

### Running Locally

**Development Mode** (frontend + backend concurrently):
```bash
npm run dev
```

This will start:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api
- WebSocket: ws://localhost:5000/socket.io

**Frontend only:**
```bash
npm start
```

**Backend only:**
```bash
npm run server
```

## Project Structure

```
split-it/
├── src/                          # React frontend
│   ├── components/               # React components
│   │   ├── common/              # Shared components (Navbar, etc.)
│   │   ├── expense/             # Expense-related components
│   │   ├── group/               # Group-related components
│   │   ├── layout/              # Layout components
│   │   └── ui/                  # shadcn/ui primitives
│   ├── context/                 # React Context (Auth, Group, etc.)
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # Utilities (apiClient, socketClient)
│   ├── pages/                   # Page components
│   └── utils/                   # Helper functions
│
├── server/                       # Express.js backend
│   ├── config/                  # Configuration (DB, Redis, Socket, etc.)
│   ├── controllers/             # Route handlers
│   ├── middleware/              # Custom middleware (auth, validation, etc.)
│   ├── models/                  # MongoDB schemas
│   ├── routes/                  # API routes
│   ├── utils/                   # Backend utilities
│   ├── workers/                 # Background jobs (email, notifications, etc.)
│   └── server.js                # Express app entry point
│
├── public/                       # Static files (index.html, manifest, etc.)
├── .github/workflows/           # GitHub Actions CI/CD
├── docker-compose.yml           # Local Docker setup
├── docker-compose.production.yml # Production Docker setup
├── nginx.conf                   # Local nginx config
├── nginx.production.conf        # Production nginx config
├── Dockerfile.frontend          # Frontend build Docker image
├── server/Dockerfile            # Backend Docker image
├── .deployment-archive/         # Deployment guides and scripts (not tracked by git)
└── package.json                 # Root package manifest
```

## Key Concepts

### Expense Split Types

The app supports multiple split configurations:

```javascript
// Equal split - divide total equally
{ type: 'equal', shares: {} }

// Exact amounts - specify per-person amount
{ type: 'exact', shares: { userId1: 100, userId2: 50 } }

// Percentage - distribute by percentage
{ type: 'percentage', shares: { userId1: 60, userId2: 40 } }

// Itemized - assign items to members
{ type: 'itemized', shares: { userId1: 150, userId2: 100 } }
```

### API Communication

The frontend uses `apiClient` (in `src/lib/apiClient.js`) for all HTTP requests:
- Automatic cookie-based authentication (HttpOnly cookies)
- Built-in caching for GET requests (5-second TTL)
- Request deduplication to prevent duplicate calls
- Automatic retry logic for failed requests
- Error standardization and timeout handling

### Real-Time Updates

Socket.IO integration enables:
- Instant expense creation/updates across all group members
- Live settlement notifications
- User presence tracking
- Real-time chat in groups
- Typing indicators

### Authentication

The app supports two authentication methods:

**Email/Password:**
- Users can register with email and password
- Passwords hashed with bcrypt
- Session tokens stored in HttpOnly cookies
- Token refresh mechanism for security

**Google OAuth:**
- One-click login with Google account
- Verified with Google's authentication library
- User profile auto-populated from Google

## Available Commands

```bash
# Install dependencies for both frontend and backend
npm run install-all

# Start development (frontend + backend with hot reload)
npm run dev

# Build production frontend
npm run build

# Start frontend production build
npm start

# Start backend with nodemon (auto-reload on file changes)
npm run server

# Build Docker images and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down
```

## Database Schema

### Key Collections

**Users**
- `_id`, `name`, `email`, `password` (hashed), `upiId`, `googleId`

**Groups**
- `_id`, `name`, `createdBy`, `members`, `createdAt`, `inviteCode`

**Expenses**
- `_id`, `groupId`, `description`, `amount`, `currency`, `paidBy`, `splitAmong`, `splitConfig`, `date`, `receipts`

**Settlements**
- `_id`, `groupId`, `fromUserId`, `toUserId`, `amount`, `currency`, `paymentStatus`, `settledAt`

**Invites**
- `_id`, `groupId`, `code`, `token`, `createdBy`, `createdAt`, `expiresAt`, `usedBy`

## Development Tips

### Hot Reload
- Frontend changes auto-reload via React Fast Refresh
- Backend changes auto-reload via nodemon (when using `npm run server`)

### Debugging
- Browser DevTools for frontend debugging
- Check `docker-compose logs` for backend issues
- MongoDB connection: Test with MongoDB Compass
- Redis: Check with `redis-cli`

### Testing
- Create test groups and expenses locally
- Test split calculations with different configurations
- Try settlement suggestions with multiple users
- Test real-time updates with multiple browser tabs

## Troubleshooting

### Frontend won't connect to backend
- Check `REACT_APP_API_URL` in `.env`
- Ensure backend is running on port 5000
- Check browser console for CORS errors
- Verify backend is accessible: `curl http://localhost:5000/api/health`

### MongoDB connection failed
- Verify `MONGODB_URI` in `server/.env`
- Ensure MongoDB is running (local) or connection string is correct (Atlas)
- Check firewall rules

### Redis connection failed
- Verify `REDIS_HOST` and `REDIS_PORT` in `server/.env`
- Ensure Redis is running: `redis-cli ping`
- Check firewall rules if using remote Redis

### Google OAuth not working
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `server/.env`
- Check Google Cloud Console for correct redirect URIs
- Ensure `CLIENT_URL` matches http://localhost:3000 in development

## Production Deployment

For production deployment instructions (AWS EC2, Docker, HTTPS, CI/CD):
- See `.deployment-archive/docs/AWS_DEPLOYMENT.md`
- GitHub Actions workflow in `.github/workflows/deploy.yml`
- Docker Compose production config: `docker-compose.production.yml`
- Nginx SSL config: `nginx.production.conf`

## Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see LICENSE file for details.

## Support

For issues, feature requests, or questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review `.deployment-archive/` for deployment-specific help

## Author

Shubham Patra - [@ShubhamPatra](https://github.com/ShubhamPatra)
