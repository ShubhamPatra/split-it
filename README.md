# Split-It

Split expenses effortlessly with friends, family, and groups.

Split-It is an expense sharing application for tracking shared costs, settling debts, and managing group finances. Whether you're splitting rent with roommates, tracking trip expenses, or managing shared household costs, Split-It handles the complexity.

## Documentation

- [SETUP.md](./SETUP.md) - Local development setup guide
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment guide
- [API Documentation](#api-endpoints) - REST API reference

## Repository Overview

```
split-it/
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
├── SETUP.md                # Local development guide
└── README.md               # This file
```

Recent Changes:
- Added payment confirmation flow (pending/confirmed/failed settlements)
- Added settlement rejection with automatic payer notification
- Fixed real-time socket updates for chat and expenses
- Enhanced email templates with logo and branding
- Improved notification permission handling (persists across sessions)
- Fixed balance calculations to only count confirmed settlements

## Features

### Group Management
- Create unlimited groups for different scenarios (trips, roommates, events, etc.)
- Invite members via shareable invite links or codes
- Real-time member sync - see who's online and active
- Group chat for discussing expenses and settlements

### Flexible Expense Splitting
Split expenses in multiple ways to match any real-world scenario:

| Split Type | Description | Use Case |
|------------|-------------|----------|
| Equal | Divide total equally among all members | Shared meals, utilities |
| Exact Amount | Specify exact amount each person owes | Varied purchases |
| Percentage | Split by custom percentages | Income-based splits |
| Itemized | Assign specific items to specific people | Restaurant bills, shopping |

### Smart Settlements
- Optimized debt simplification - minimizes the number of transactions needed
- Settlement suggestions - see exactly who owes whom
- One-click settlement recording - mark debts as paid instantly
- Payment confirmation flow - receiver confirms payment receipt
- Rejection handling - mark payments as not received with notifications
- Payment history - track all past settlements with status

### Multi-Currency Support
- Support for INR, USD, EUR, GBP out of the box
- Per-group default currency settings
- Per-expense currency override
- Automatic currency display formatting

### Notifications & Reminders
- Push notifications for new expenses and settlements
- Email notifications for important updates
- Due date reminders for recurring expenses
- Weekly digest emails summarizing group activity

### Progressive Web App (PWA)
- Install on any device - works like a native app
- Offline support - view cached data without internet
- Push notifications - stay updated even when app is closed
- Responsive design - optimized for mobile, tablet, and desktop

### Recurring Expenses
Set up automatic recurring expenses for:
- Daily (subscriptions)
- Weekly (groceries, cleaning)
- Monthly (rent, utilities, subscriptions)
- Yearly (insurance, memberships)

### Receipt Management
- Upload receipts as images for expense documentation
- View receipts directly in the app
- Attach multiple receipts per expense

### Analytics & Insights
- Spending breakdown by category and member
- Monthly/yearly trends visualization
- Group balance summary at a glance
- Export data for personal records

## Application Pages

### Public Pages
| Page | Description |
|------|-------------|
| Home | Landing page with app overview and features |
| Login | Email/password or Google OAuth sign-in |
| Register | Create new account with email verification |
| Forgot Password | Request password reset via email |
| Reset Password | Set new password from reset link |
| Privacy Policy | Data handling and privacy information |
| Terms of Service | Usage terms and conditions |

### Authenticated Pages
| Page | Description |
|------|-------------|
| Dashboard | Overview of all groups, recent activity, and balances |
| Groups | List and manage all your expense groups |
| Group Detail | View expenses, balances, and settlements for a group |
| Add Expense | Create new expense with split configuration |
| Analytics | Detailed spending insights and charts |
| Summary | Overall financial summary across all groups |
| Profile | Manage account settings, UPI ID, and preferences |
| Notification Settings | Configure push and email notification preferences |
| Join Group | Accept invite link to join a group |

## Tech Stack

### Frontend
- React 19 - Modern UI with hooks and functional components
- React Router v7 - Client-side routing with nested layouts
- Tailwind CSS - Utility-first styling
- shadcn/ui - Beautiful, accessible component library
- Socket.IO Client - Real-time WebSocket communication
- Chart.js - Interactive analytics visualizations

### Backend
- Node.js 20 - JavaScript runtime
- Express.js - Web application framework
- MongoDB Atlas - Document database for flexible data storage
- Socket.IO - WebSocket server for real-time features (in-memory, no Redis)
- node-cron - Scheduled job processing (recurring expenses, reminders, digests)
- Passport.js - Authentication middleware (Local + Google OAuth)
- Nodemailer - Email delivery for notifications
- Web Push - Browser push notifications

### Architecture

Split-It is designed for single-instance deployment with in-process job scheduling:

- No Redis required - All caching and real-time features use in-memory storage
- No external queue - Background jobs run with node-cron scheduler
- Optimized for AWS EC2 - Single t2.micro instance can handle moderate traffic
- Graceful shutdown - Proper cleanup of connections, jobs, and resources
- Horizontal scaling - For high traffic, use load balancer with sticky sessions

See DEPLOYMENT.md for production setup instructions.

### Security
- JWT tokens in HttpOnly cookies (XSS-safe)
- bcrypt password hashing
- Rate limiting on authentication endpoints
- CORS protection
- Helmet.js security headers
- Input validation with express-validator

## Authentication

### Email & Password
1. Register with email, name, and password
2. Passwords securely hashed with bcrypt (12 rounds)
3. JWT access token stored in HttpOnly cookie
4. Automatic token refresh for seamless sessions
5. Password reset via email link

### Google OAuth
1. Click "Sign in with Google"
2. Authorize Split-It in Google consent screen
3. Account auto-created or linked if email exists
4. Profile picture and name synced from Google

## Settlement Flow

1. View Balances - Dashboard shows who owes whom in each group
2. Get Suggestions - App calculates optimal settlement path
3. Record Settlement - Mark payment with method (UPI, Cash, Bank, Card)
4. Await Confirmation - Payment shows as "pending" until receiver confirms
5. Confirm/Reject - Receiver can confirm receipt or mark as not received
6. Notification - Both parties notified of settlement status changes
7. History - All settlements tracked with timestamps and status

### Settlement Optimization Algorithm
Split-It uses a debt simplification algorithm that minimizes the total number of transactions:
- Groups debts by creditor/debtor pairs
- Nets out circular debts automatically
- Suggests minimum transactions to settle all balances

## Real-Time Features

Split-It uses WebSockets for instant updates across all connected devices:

| Event | Description |
|-------|-------------|
| `expense:created` | New expense added to group |
| `expense:updated` | Expense modified |
| `expense:deleted` | Expense removed |
| `settlement:created` | New settlement recorded |
| `member:joined` | New member joined group |
| `member:left` | Member left group |
| `chat:message` | New chat message in group |
| `user:typing` | Typing indicator in chat |

## Email Notifications

Split-It sends transactional emails for:
- Welcome email - Account creation confirmation
- Password reset - Secure reset link
- Expense added - When someone adds an expense you're part of
- Settlement received - When someone settles a debt with you
- Payment reminder - Customizable reminders for pending balances
- Weekly digest - Summary of group activity (configurable)

## Data Models

### User
```
- name, email, password (hashed)
- googleId (for OAuth users)
- upiId (for UPI payments)
- avatar, preferences
- notificationSettings
```

### Group
```
- name, description
- createdBy (owner)
- members[] with roles (admin/member)
- defaultCurrency
- inviteCode, inviteToken
```

### Expense
```
- groupId, description, amount, currency
- paidBy (user who paid)
- splitAmong[] (users involved)
- splitConfig { type, shares }
- date, receipts[], notes
- isRecurring, recurringConfig
```

### Settlement
```
- groupId
- fromUserId → toUserId
- amount, currency
- paymentMethod (upi/cash/bank/card)
- paymentStatus (pending/confirmed/failed)
- paymentNotes
- settledAt
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| POST | `/api/auth/google` | Google OAuth |
| POST | `/api/auth/forgot-password` | Request reset |
| POST | `/api/auth/reset-password` | Set new password |

### Groups
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | List user's groups |
| POST | `/api/groups` | Create group |
| GET | `/api/groups/:id` | Get group details |
| PUT | `/api/groups/:id` | Update group |
| DELETE | `/api/groups/:id` | Delete group |
| POST | `/api/groups/:id/join` | Join via invite |
| POST | `/api/groups/:id/leave` | Leave group |

### Expenses
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups/:id/expenses` | List group expenses |
| POST | `/api/expenses` | Create expense |
| GET | `/api/expenses/:id` | Get expense |
| PUT | `/api/expenses/:id` | Update expense |
| DELETE | `/api/expenses/:id` | Delete expense |

### Settlements
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups/:id/settlements` | List settlements |
| POST | `/api/settlements` | Record settlement |
| POST | `/api/settlements/:id/confirm` | Confirm payment received |
| POST | `/api/settlements/:id/reject` | Mark payment not received |
| GET | `/api/groups/:id/balances` | Get group balances |
| GET | `/api/groups/:id/suggestions` | Get settlement suggestions |

### User
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Get current user |
| PUT | `/api/users/me` | Update profile |
| PUT | `/api/users/me/notifications` | Update notification prefs |

## UI Components

Split-It uses shadcn/ui for consistent, accessible components:

- Button - Primary, secondary, outline, ghost variants
- Card - Container for expenses, groups, summaries
- Dialog - Modals for forms and confirmations
- Dropdown Menu - Context menus and settings
- Input / Textarea - Form fields with validation
- Select - Currency, split type, member selectors
- Tabs - Navigation within pages
- Toast - Success/error notifications
- Avatar - User profile pictures
- Badge - Status indicators
- Skeleton - Loading states

## Mobile Experience

Split-It is designed mobile-first:

- Bottom navigation on mobile for easy thumb access
- Swipe gestures for common actions
- Pull-to-refresh on lists
- Touch-optimized buttons and inputs
- PWA installation prompt on supported browsers
- Offline mode with cached data display

## Privacy & Security

- No ads or tracking - Your data stays yours
- Encrypted passwords - bcrypt with 12 salt rounds
- Secure cookies - HttpOnly, SameSite, Secure flags
- Rate limiting - Protection against brute force
- Input sanitization - XSS and injection prevention
- HTTPS only - All traffic encrypted in transit

## License

This project is licensed under the MIT License.

## Author

Shubham Patra

- GitHub: @ShubhamPatra
