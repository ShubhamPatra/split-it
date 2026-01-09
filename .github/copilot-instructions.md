# Split-It Copilot Instructions

## Architecture Overview

**Monorepo Structure**: React frontend (root `src/`) + Express.js backend (`server/`) with shared deployment via Docker Compose.

- **Frontend**: React 19 + React Router v7 + Tailwind CSS + shadcn/ui components
- **Backend**: Express.js (ES modules) + MongoDB (Mongoose) + Redis (caching/sessions) + Socket.IO (real-time)
- **Auth**: HttpOnly cookie JWT auth with Google OAuth support via Passport.js

## Key Patterns

### API Communication
- Use `apiClient` from `src/lib/apiClient.js` for all HTTP requests—it handles auth cookies, caching, retries, and error standardization
- Backend endpoints at `/api/*` always return JSON; error responses include `{ message: string }`
- Mutations (POST/PUT/DELETE) auto-clear frontend cache; GET requests deduplicate concurrent calls

### State Management
- **Context-first**: Auth, Groups, Currency, Notifications via React Context in `src/context/`
- `GroupContext` is the main data hub—manages groups, expenses, settlements with local-first updates + Socket.IO sync
- Pattern: Optimistic update locally → API call → Socket broadcasts to other clients

```javascript
// Example: Adding expense with optimistic update
const response = await apiClient.post('/expenses', expenseData);
addExpenseLocally(response); // Updates state immediately
// Socket.IO broadcasts 'expense:created' to group members
```

### Component Structure
- UI primitives in `src/components/ui/` (shadcn/ui with Radix)—use these for buttons, dialogs, inputs
- Feature components in `src/components/{expense,common,layout}/`
- Pages are lazy-loaded in `App.js`

### Expense Split System
Three split types stored in `splitConfig`: `equal`, `exact`, `percentage`
```javascript
// splitConfig structure
{ type: 'equal' | 'exact' | 'percentage', shares: { [userId]: number } }
// shares map: userId → amount (exact), percentage (%), or equal share
```
Use `calculateSplitShares()` from `src/utils/helperFunctions.js` for calculations.

### Backend Conventions
- Controllers in `server/controllers/` follow pattern: validate → authorize → execute → emit socket event
- Authorization: Group membership check required; only payer or group admin can modify expenses
- Socket events: `expense:created`, `expense:updated`, `settlement:created` etc., emitted via `emitToGroup()`

## Commands

```bash
npm run dev          # Start frontend + backend concurrently
npm start            # Frontend only (port 3000)
npm run server       # Backend only with nodemon (port 5000)
npm run install-all  # Install deps for both frontend and backend
```

## Environment Variables

**Frontend (`.env`):**
- `REACT_APP_API_URL` - Backend API URL (default: `http://localhost:5000/api`)
- `REACT_APP_GOOGLE_CLIENT_ID` - Google OAuth client ID

**Backend (`server/.env`):**
- `MONGODB_URI`, `REDIS_HOST`, `JWT_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `CLIENT_URL` - Frontend URL for CORS

## Important Files

| Purpose | File |
|---------|------|
| API client with caching | [src/lib/apiClient.js](../src/lib/apiClient.js) |
| Main data context | [src/context/GroupContext.jsx](../src/context/GroupContext.jsx) |
| Split calculations | [src/utils/helperFunctions.js](../src/utils/helperFunctions.js) |
| Auth middleware | [server/middleware/authMiddleware.js](../server/middleware/authMiddleware.js) |
| Expense model/schema | [server/models/Expense.js](../server/models/Expense.js) |
| Socket setup | [server/config/socket.js](../server/config/socket.js) |

## Data Flow

1. User action → Context method (e.g., `addExpense`)
2. `apiClient.post()` → Backend controller
3. Controller validates, saves to MongoDB, emits Socket.IO event
4. Other clients receive socket event → `*Locally()` update methods

## Conventions

- **IDs**: Backend uses `_id` (MongoDB), frontend transforms to `id` in Context
- **Dates**: Stored as ISO strings, formatted with `formatDate()` helper
- **Currency**: Default `INR`, stored per expense, symbol lookup in `formatCurrency()`
- **Toast notifications**: Use `toast()` from `src/hooks/use-toast.js`

## Testing & Debugging

- Backend logs requests in dev mode (timestamp + method + path)
- Health check: `GET /api/health`
- Metrics: `GET /metrics` (Prometheus format)
- Socket connection issues: Check `withCredentials: true` in socket config
