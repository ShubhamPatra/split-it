import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import redis, { closeRedis } from './config/redis.js';
import { initializeSocket, createRedisAdapter } from './config/socket.js';
import { createIndexes } from './utils/dbIndexes.js';
import { securityHeaders, sanitizeInput, rateLimiter } from './middleware/security.js';
import authRoutes from './routes/authRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import settlementRoutes from './routes/settlementRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import userRoutes from './routes/userRoutes.js';
import pushRoutes from './routes/pushRoutes.js';
import ocrRoutes from './routes/ocrRoutes.js';
import inviteRoutes from './routes/inviteRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { initializeVapid } from './config/vapid.js';

// Worker imports
import { initEmailWorker } from './workers/emailWorker.js';
import { initNotificationWorker } from './workers/notificationWorker.js';
import { initBalanceWorker } from './workers/balanceWorker.js';
import { initRecurringExpenseWorker } from './workers/recurringExpenseWorker.js';
import { initDigestWorker } from './workers/digestWorker.js';
import { initDueReminderWorker } from './workers/dueReminderWorker.js';
import { closeQueues } from './config/queue.js';

// Load environment variables
dotenv.config();

// Initialize VAPID for web push notifications
const vapidInitialized = initializeVapid();
if (vapidInitialized) {
  console.log('VAPID: Web push notifications configured');
} else {
  console.warn('VAPID: Push notifications disabled (keys not configured)');
}

// Connect to MongoDB and create indexes
connectDB().then(() => {
  createIndexes();
});

// Verify Redis connection on startup
redis.ping().then(() => {
  console.log('Redis: Connection verified');
}).catch((err) => {
  console.error('Redis: Failed to verify connection:', err.message);
});

// Initialize Express app
const app = express();

// Create HTTP server
const httpServer = createServer(app);

// Create Redis adapter for Socket.IO horizontal scaling (optional in dev)
const redisAdapterResult = createRedisAdapter();
const pubClient = redisAdapterResult?.pubClient;
const subClient = redisAdapterResult?.subClient;
const redisAdapter = redisAdapterResult?.adapter;

if (redisAdapter) {
  console.log('Socket.IO: Redis adapter created for horizontal scaling');
}

// Initialize Socket.IO with Redis adapter (if available)
const io = initializeSocket(httpServer, redisAdapter);

// Store io instance on app for use in controllers
app.set('io', io);

// Pass io to notification controller
import { setIo } from './controllers/notificationController.js';
setIo(io);

// Initialize Bull queue workers
console.log('Initializing background workers...');
initEmailWorker();
initNotificationWorker(io);
initBalanceWorker();
initRecurringExpenseWorker();
initDigestWorker();
initDueReminderWorker();
console.log('Background workers initialized');

// Security middleware (should be first)
app.use(securityHeaders);

// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Cookie parser middleware (must be before auth routes)
app.use(cookieParser());

// Body parsing middleware
app.use(express.json({ limit: '10mb' })); // Limit payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
app.use(sanitizeInput);

// Global rate limiting (100 requests per 15 minutes)
app.use(rateLimiter());

// Request logging middleware (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/groups', chatRoutes); // Chat routes nested under groups
app.use('/api/messages', chatRoutes); // Messages routes for batch operations like /api/messages/unread-counts
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/invites', inviteRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Log error details (in production, use proper logging service)
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error occurred:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  } else {
    // In production, log only essential info
    console.error(`Error: ${err.message} - Path: ${req.path}`);
  }

  // Don't leak error details in production
  const isDev = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    message: err.status === 500 && !isDev ? 'Internal Server Error' : err.message,
    ...(isDev && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  try {
    // Close HTTP server
    httpServer.close(() => {
      console.log('HTTP server closed');
    });

    // Close Bull queues
    await closeQueues();
    
    // Close Socket.IO Redis adapter pub/sub clients (if they exist)
    if (pubClient) await pubClient.quit().catch(() => {});
    if (subClient) await subClient.quit().catch(() => {});
    if (pubClient || subClient) {
      console.log('Socket.IO Redis adapter connections closed');
    }
    
    // Close Redis connection
    await closeRedis();
    console.log('Redis connection closed');
    
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Export for tests
export { app, httpServer, io };
