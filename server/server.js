import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import redis, { closeRedis, isRedisAvailable } from './config/redis.js';
import { initializeSocket, createRedisAdapter } from './config/socket.js';
import { createIndexes } from './utils/dbIndexes.js';
import { securityHeaders, sanitizeInput, rateLimiter, waitForRedis } from './middleware/security.js';
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
import { closeAllQueues, waitForQueues, areQueuesAvailable } from './config/queueBullMQ.js';

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

// Track Redis readiness state for use in health checks
let redisReady = false;

// Set up Redis event listeners to track connection state
if (redis) {
  redis.on('ready', async () => {
    // Re-verify connection on ready event
    try {
      const pong = await redis.ping();
      if (pong === 'PONG') {
        redisReady = true;
        console.log('Redis: Connection ready (event)');
      }
    } catch (err) {
      redisReady = false;
      console.warn('Redis: Ready event fired but ping failed:', err.message);
    }
  });

  redis.on('error', (err) => {
    redisReady = false;
    // Avoid verbose logging for expected connection refused in dev
    if (!(process.env.NODE_ENV !== 'production' && err.code === 'ECONNREFUSED')) {
      console.error('Redis: Connection error (event):', err.message);
    }
  });

  redis.on('close', () => {
    redisReady = false;
    console.log('Redis: Connection closed (event)');
  });
}

// Verify Redis connection on startup and wait for readiness
const initRedis = async () => {
  // If Redis is disabled or not initialized, skip
  if (!redis) {
    console.warn('Redis: Client not initialized, skipping connection verification');
    return false;
  }
  
  try {
    // Wait for Redis to be ready (with timeout)
    const waitForReady = (timeout = 5000) => {
      return new Promise((resolve) => {
        // If already ready, resolve immediately
        if (redis.status === 'ready') {
          resolve(true);
          return;
        }
        
        const timeoutId = setTimeout(() => {
          resolve(false);
        }, timeout);
        
        redis.once('ready', () => {
          clearTimeout(timeoutId);
          resolve(true);
        });
        
        redis.once('error', () => {
          clearTimeout(timeoutId);
          resolve(false);
        });
      });
    };
    
    // Wait for ready state
    const isReady = await waitForReady(5000);
    if (!isReady) {
      console.warn('Redis: Not ready within timeout, rate limiting will use in-memory store');
      return false;
    }
    
    // Verify connection with ping
    const pong = await Promise.race([
      redis.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), 3000))
    ]);
    
    if (pong === 'PONG') {
      console.log('Redis: Connection verified and ready');
      redisReady = true;
      return true;
    }
    
    console.warn('Redis: Ping failed, rate limiting will use in-memory store');
    return false;
  } catch (err) {
    console.error('Redis: Failed to verify connection:', err.message);
    return false;
  }
};

// Initialize Express app
const app = express();

// Trust proxy when behind Nginx/load balancer (required for rate limiting, secure cookies)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Create HTTP server
const httpServer = createServer(app);

// Variables for Redis adapter (will be set during async initialization)
let pubClient = null;
let subClient = null;
let io = null;

/**
 * Async initialization function that ensures proper startup order:
 * 1. Connect to MongoDB
 * 2. Wait for Redis to be ready (with timeout)
 * 3. Create Redis adapter for Socket.IO
 * 4. Initialize Socket.IO
 * 5. Set up middleware (including rate limiters)
 * 6. Register routes
 * 7. Start HTTP server
 */
const initializeServer = async () => {
  // Wait for Redis to be ready before setting up middleware
  await initRedis();
  
  // Create Redis adapter for Socket.IO horizontal scaling (optional in dev)
  // This is now async to test pub/sub capability and guard against ElastiCache serverless
  const redisAdapterResult = await createRedisAdapter();
  pubClient = redisAdapterResult?.pubClient;
  subClient = redisAdapterResult?.subClient;
  const redisAdapter = redisAdapterResult?.adapter;

  if (redisAdapter) {
    console.log('Socket.IO: Redis adapter created for horizontal scaling');
  }

  // Initialize Socket.IO with Redis adapter (if available)
  io = initializeSocket(httpServer, redisAdapter);

  // Store io instance on app for use in controllers
  app.set('io', io);

  // Pass io to notification controller
  const { setIo } = await import('./controllers/notificationController.js');
  setIo(io);

  // Wait for BullMQ queues to be ready
  try {
    await waitForQueues();
  } catch (err) {
    console.error('BullMQ queue initialization failed:', err.message);
    if (process.env.NODE_ENV === 'production') {
      console.error('Exiting: Redis/BullMQ is required in production.');
      process.exit(1);
    }
  }

  // Validate queues are actually available (not just mock queues)
  if (process.env.NODE_ENV === 'production' && !areQueuesAvailable()) {
    console.error('Exiting: BullMQ queues are not available in production. Check Redis connection.');
    process.exit(1);
  }

  // Initialize BullMQ workers (store for graceful shutdown)
  console.log('Initializing background workers...');
  const emailWorker = initEmailWorker();
  const notificationWorker = initNotificationWorker(io);
  const balanceWorker = initBalanceWorker();
  const recurringWorker = await initRecurringExpenseWorker();
  const digestWorker = await initDigestWorker();
  const dueReminderWorker = await initDueReminderWorker();
  
  // Store workers for graceful shutdown
  app.set('workers', {
    emailWorker,
    notificationWorker,
    balanceWorker,
    recurringWorker,
    digestWorker,
    dueReminderWorker,
  });
  console.log('Background workers initialized (BullMQ)');

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

  // Global rate limiting (1000 requests per 15 minutes per IP)
  // Auth routes have their own stricter rate limiting
  // Chat message routes have their own rate limiting (100 req/min)
  // Lazy-initialized: starts with in-memory and auto-upgrades to Redis when available
  let _globalRateLimiter = null;
  const globalRateLimitOptions = {
    max: 1000,
    windowMs: 15 * 60 * 1000,
    message: 'Too many requests from this IP. Please try again later.',
    skip: (req) => req.path.startsWith('/api/auth/'), // Auth routes have their own rate limit
  };
  
  app.use((req, res, next) => {
    // Lazy-initialize rate limiter on first request (allows Redis to connect)
    // The rateLimiter function handles dynamic store selection per-request
    if (!_globalRateLimiter) {
      _globalRateLimiter = rateLimiter(globalRateLimitOptions);
    }
    return _globalRateLimiter(req, res, next);
  });

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

  // Health check route with Redis status
  app.get('/api/health', async (req, res) => {
    const redisStatus = redis && redis.status === 'ready' ? 'connected' : 'disconnected';
    const rateLimitStore = redisReady ? 'redis' : 'in-memory';
    
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      redis: {
        status: redisStatus,
        rateLimitStore: rateLimitStore
      }
    });
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
};

// Start the async initialization
initializeServer().catch((err) => {
  console.error('Failed to initialize server:', err);
  process.exit(1);
});

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  try {
    // Close HTTP server
    httpServer.close(() => {
      console.log('HTTP server closed');
    });

    // Close BullMQ workers first
    const workers = app.get('workers');
    if (workers) {
      console.log('Closing BullMQ workers...');
      const workerClosePromises = Object.entries(workers).map(async ([name, worker]) => {
        try {
          await worker?.close?.();
          console.log(`Worker ${name} closed`);
        } catch (err) {
          console.error(`Error closing worker ${name}:`, err.message);
        }
      });
      await Promise.all(workerClosePromises);
    }

    // Close BullMQ queues
    await closeAllQueues();
    
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
