# Split-It - Expense Sharing App 💰

<p align="center">
  <img src="public/banner.png" alt="Split-It Banner" width="100%" />
</p>

A modern, full-stack expense sharing application built with React, Express.js, MongoDB, Redis, and Socket.IO. Split bills effortlessly with friends and track who owes what.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.x-green.svg)
![React](https://img.shields.io/badge/react-19.x-61DAFB.svg)

## ✨ Features

- 👥 **Group Management** - Create groups and invite friends via shareable links
- 💰 **Smart Expense Splitting** - Equal, exact amounts, or percentage-based splits
- ⚡ **Real-time Updates** - Socket.IO powered live synchronization
- 📊 **Visual Analytics** - Charts and graphs for spending insights
- 💳 **Settlement Optimization** - Minimize transactions with smart algorithms
- 🔐 **Secure Auth** - JWT + HttpOnly cookies with Google OAuth support
- 💬 **Group Chat** - Real-time messaging within expense groups
- 🔔 **Push Notifications** - Stay updated on group activities
- 📱 **PWA Ready** - Install as a mobile app
- 🌙 **Dark Mode** - Eye-friendly dark theme support

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, React Router v7, Tailwind CSS, shadcn/ui, Recharts |
| **Backend** | Node.js, Express.js, Socket.IO, Passport.js |
| **Database** | MongoDB (Mongoose ODM) |
| **Caching** | Redis |
| **Auth** | JWT, Google OAuth 2.0, bcrypt |
| **DevOps** | Docker, Docker Compose, Nginx |

## 📋 Prerequisites

- **Node.js** v16.x or higher
- **MongoDB** (Atlas or local)
- **Redis** (local or cloud)
- **npm** or **yarn**

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/ShubhamPatra/split-it.git
cd split-it
```

### 2. Install Dependencies

```bash
npm run install-all
```

### 3. Configure Environment Variables

**Frontend (`.env`):**
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
```

**Backend (`server/.env`):**
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/splitit
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_super_secret_jwt_key
CLIENT_URL=http://localhost:3000
SERVER_URL=http://localhost:5000
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 4. Start Development Servers

```bash
npm run dev
```

This starts both frontend (port 3000) and backend (port 5000) concurrently.

## 📁 Project Structure

```
split-it/
├── src/                    # React frontend
│   ├── components/         # Reusable UI components
│   │   ├── ui/            # Base components (shadcn/ui)
│   │   ├── common/        # Shared components
│   │   ├── expense/       # Expense-related components
│   │   └── group/         # Group-related components
│   ├── context/           # React Context providers
│   ├── pages/             # Page components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities (apiClient, socketClient)
│   └── utils/             # Helper functions
│
├── server/                 # Express.js backend
│   ├── config/            # DB, Redis, Socket.IO config
│   ├── controllers/       # Route handlers
│   ├── middleware/        # Auth, validation, security
│   ├── models/            # Mongoose schemas
│   ├── routes/            # API route definitions
│   ├── utils/             # Backend utilities
│   └── workers/           # Background job processors
│
├── docs/                   # Documentation
├── scripts/               # Deployment scripts
└── docker-compose.yml     # Docker configuration
```

## 🔧 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend + backend (development) |
| `npm start` | Start frontend only |
| `npm run server` | Start backend only (with nodemon) |
| `npm run build` | Build frontend for production |
| `npm run install-all` | Install all dependencies |

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/google` | Google OAuth |
| POST | `/api/auth/logout` | Logout user |
| POST | `/api/auth/refresh` | Refresh access token |

### Groups
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | Get user's groups |
| POST | `/api/groups` | Create group |
| GET | `/api/groups/:id` | Get group details |
| DELETE | `/api/groups/:id` | Delete group |
| POST | `/api/invites/create` | Generate invite link |
| POST | `/api/invites/join` | Join via invite |

### Expenses
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/expenses/group/:groupId` | Get group expenses |
| POST | `/api/expenses` | Create expense |
| PUT | `/api/expenses/:id` | Update expense |
| DELETE | `/api/expenses/:id` | Delete expense |

### Settlements
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settlements` | Get settlements |
| POST | `/api/settlements` | Record settlement |
| PUT | `/api/settlements/:id` | Update settlement |

## � Deployment to AWS

### ⚡ Quick Deploy (30 minutes)
Deploy to AWS EC2 with a single script:

```bash
# See the quick start guide
cat docs/QUICK_START_DEPLOYMENT.md

# Or run automated deployment
./scripts/deploy-to-ec2.sh
```

**Cost**: ~$40/month (t3.small EC2 + Route 53)

### 📖 Deployment Documentation

| Document | Purpose |
|----------|---------|
| **[QUICK_START_DEPLOYMENT.md](docs/QUICK_START_DEPLOYMENT.md)** | 30-min EC2 quickstart ⭐ START HERE |
| **[AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md)** | All AWS options (EC2, ECS, Elastic Beanstalk) |
| **[ROUTE53_SETUP.md](docs/ROUTE53_SETUP.md)** | Custom domain DNS configuration |
| **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** | Step-by-step checklist |
| **[DEPLOYMENT_TROUBLESHOOTING.md](docs/DEPLOYMENT_TROUBLESHOOTING.md)** | Fix common issues |
| **[COMMAND_REFERENCE.md](docs/COMMAND_REFERENCE.md)** | Copy-paste AWS/Docker commands |
| **[ARCHITECTURE_DIAGRAMS.md](docs/ARCHITECTURE_DIAGRAMS.md)** | Visual architecture overview |
| **[DEPLOYMENT_PACKAGE.md](DEPLOYMENT_PACKAGE.md)** | What's included in deployment |

### 🐳 Docker Deployment

#### Development
```bash
docker-compose up
```

#### Production
```bash
docker-compose -f docker-compose.production.yml --env-file .env.production up -d
```

## 🔒 Security Features

- **HttpOnly Cookies** - JWT tokens stored securely
- **Token Refresh** - Automatic token rotation
- **Rate Limiting** - Protection against abuse
- **Input Sanitization** - XSS prevention
- **CORS Configuration** - Controlled cross-origin access
- **bcrypt Hashing** - Secure password storage

## 🧪 Health Check

- **Backend**: `GET /api/health`
- **Metrics**: `GET /metrics` (Prometheus format)

## 📱 Split Methods

| Type | Description |
|------|-------------|
| **Equal** | Divide amount equally among members |
| **Exact** | Specify exact amount per person |
| **Percentage** | Split by percentage shares |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components
- [Lucide](https://lucide.dev/) - Icon library
- [Recharts](https://recharts.org/) - Chart library
- [Tailwind CSS](https://tailwindcss.com/) - Styling framework

---

**Made with ❤️ for splitting expenses with friends**
