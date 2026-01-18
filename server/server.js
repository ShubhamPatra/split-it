import dotenv from 'dotenv';
// Load environment variables FIRST (before any process.env checks)
dotenv.config();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import helmet from 'helmet';
import hpp from 'hpp';
import connectDB from './config/db.js';
import { initializeSocket, getSocketIO, stopTypingCleanup, cleanupRedisConnections } from './config/socket.js';
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

// Job system imports
import { initializeScheduler, stopScheduler } from './jobs/scheduler.js';
import { setSocketIO } from './jobs/notificationService.js';
import { initializeBalanceService, stopBalanceService } from './jobs/balanceService.js';

// Initialize log collector for debug portal (must be early)
if (process.env.DEBUG_ENABLED === 'true') {
  import('./internal/debug/logCollector.js').then(({ initializeLogInterception }) => {
    initializeLogInterception();
    console.log('Debug portal log interception initialized');
  }).catch(err => {
    console.warn('Failed to initialize debug log interception:', err.message);
  });
}

// Initialize VAPID for web push notifications
const vapidInitialized = initializeVapid();
if (vapidInitialized) {
  console.log('VAPID: Web push notifications configured');
} else {
  console.warn('VAPID: Push notifications disabled (keys not configured)');
}

// Initialize Express app
const app = express();

// Trust proxy when behind Nginx/load balancer (required for rate limiting, secure cookies)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Create HTTP server
const httpServer = createServer(app);

// Socket.IO instance
let io = null;

/**
 * Async initialization function that ensures proper startup order:
 * 1. Connect to MongoDB
 * 2. Initialize Socket.IO
 * 3. Set up middleware
 * 4. Register routes
 * 5. Initialize scheduled jobs
 * 6. Start HTTP server
 */
const initializeServer = async () => {
  // Connect to MongoDB
  await connectDB();
  await createIndexes();

  // Initialize Socket.IO (with optional Redis adapter for horizontal scaling)
  io = await initializeSocket(httpServer);

  // Store io instance on app for use in controllers
  app.set('io', io);

  // Pass io to notification service for real-time notifications
  setSocketIO(io);

  // Pass io to notification controller
  const { setIo } = await import('./controllers/notificationController.js');
  setIo(io);

  // Initialize balance service (cache cleanup intervals)
  initializeBalanceService();

  // Security middleware (should be first)
  // Helmet sets various HTTP security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", process.env.CLIENT_URL || 'http://localhost:3000'],
      },
    },
    crossOriginEmbedderPolicy: false, // Disable for compatibility
  }));

  // HPP prevents HTTP Parameter Pollution attacks
  app.use(hpp());

  // Custom security headers (supplement helmet)
  app.use(securityHeaders);

  // Parse allowed origins from environment for CORS
  const parseAllowedOrigins = () => {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : [];
    const origins = [clientUrl, ...allowedOrigins];
    // In development, also allow common dev ports
    if (process.env.NODE_ENV !== 'production') {
      origins.push('http://localhost:3000', 'http://localhost:5173');
    }
    return [...new Set(origins)]; // Deduplicate
  };

  // CORS configuration with origin allowlist
  const corsOptions = {
    origin: parseAllowedOrigins(),
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
  const globalRateLimiter = rateLimiter({
    max: 1000,
    windowMs: 15 * 60 * 1000,
    message: 'Too many requests from this IP. Please try again later.',
    skip: (req) => req.path.startsWith('/api/auth/'), // Auth routes have their own rate limit
  });

  app.use(globalRateLimiter);

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
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      mode: 'in-process',
      scheduler: 'node-cron',
    });
  });

  // Serve static assets (logos, icons) for emails
  // These need to be publicly accessible without authentication
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const buildPath = path.join(__dirname, '..', 'build');
  
  // Serve specific assets needed for emails (logos, icons)
  app.use('/assets', express.static(buildPath, {
    maxAge: '1y', // Cache for a year (versioned files)
    setHeaders: (res, filepath) => {
      // Allow cross-origin access for email clients
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }));

  // Debug portal (hidden, secured route)
  if (process.env.DEBUG_ENABLED === 'true') {
    try {
      const { default: debugRoutes } = await import('./internal/debug/debug.routes.js');
      const debugPath = process.env.DEBUG_PATH || '/__system/debug-portal-92xA';
      app.use(debugPath, debugRoutes);
      console.log(`Debug portal enabled at ${debugPath}`);
    } catch (err) {
      console.warn('Debug portal failed to initialize:', err.message);
    }
  }

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

    // Log to debug portal collector if enabled
    if (process.env.DEBUG_ENABLED === 'true') {
      import('./internal/debug/logCollector.js').then(({ logApiError }) => {
        logApiError(err, { path: req.path, method: req.method, statusCode: err.status || 500 });
      }).catch(() => {});
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

  // Initialize scheduled jobs (cron scheduler)
  initializeScheduler();
  console.log('Scheduled jobs initialized (node-cron)');

  // Start server
  const PORT = process.env.PORT || 5000;
  httpServer.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    console.log('Background job system: In-process (no Redis required)');
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

  // Overall shutdown timeout - force exit if cleanup takes too long
  const shutdownTimeout = setTimeout(() => {
    console.error('Shutdown timeout exceeded (30s), forcing exit...');
    process.exit(1);
  }, 30000);

  try {
    // Stop scheduled jobs first (prevent new job starts)
    stopScheduler();
    console.log('Scheduler stopped');

    // Stop balance service (cache cleanup intervals)
    stopBalanceService();
    console.log('Balance service stopped');

    // Stop socket typing cleanup
    stopTypingCleanup();
    console.log('Socket cleanup stopped');

    // Close Redis connections (Comment 5)
    await cleanupRedisConnections();
    console.log('Redis connections closed');

    // Close Socket.IO connections
    const socketIO = getSocketIO();
    if (socketIO) {
      await new Promise((resolve) => {
        socketIO.close(() => {
          console.log('Socket.IO closed');
          resolve();
        });
        // Timeout for Socket.IO close
        setTimeout(resolve, 5000);
      });
    }

    // Close HTTP server with timeout
    await new Promise((resolve) => {
      const serverCloseTimeout = setTimeout(() => {
        console.log('HTTP server close timeout (10s), proceeding...');
        resolve();
      }, 10000);

      httpServer.close(() => {
        clearTimeout(serverCloseTimeout);
        console.log('HTTP server closed');
        resolve();
      });
    });

    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('MongoDB connection closed');
    }

    clearTimeout(shutdownTimeout);
    console.log('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    clearTimeout(shutdownTimeout);
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Export for tests
export { app, httpServer, io };
