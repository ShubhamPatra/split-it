/**
 * BullMQ Queue Configuration
 * 
 * Production-grade job queue configuration using BullMQ for:
 * - Full Redis Cluster support
 * - Proper TLS handling
 * - Robust reconnection strategies
 * - Better offline queue handling
 * - Shared Redis connections to reduce connection count
 * 
 * Migrated from Bull to BullMQ for Redis Cluster compatibility.
 */

import bullmq from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';

const { Queue, Worker, QueueEvents } = bullmq;

// Load environment variables
dotenv.config();

const isDev = process.env.NODE_ENV !== 'production';
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

// Track if queues are available
let queuesAvailable = false;

// Store queue instances
const queues = {};
const workers = {};
const queueEvents = {};

// Simple queue names without colons - Hash tags for Redis Cluster compatibility
// Hash tags {...} ensure all queue-related keys hash to the same slot
export const QUEUE_NAMES = {
  EMAIL: '{splitit}email',
  NOTIFICATION: '{splitit}notification',
  BALANCE: '{splitit}balance',
  RECURRING: '{splitit}recurring',
  DIGEST: '{splitit}digest',
  DUE_REMINDER: '{splitit}dueReminder',
};

/**
 * Build Redis connection options for BullMQ
 * Supports standalone and cluster mode
 */
const buildConnectionOptions = () => {
  const options = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: true,
    enableOfflineQueue: true, // CRITICAL: Allow commands to queue during reconnections
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10) || 10000,
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT, 10) || 5000,
    keepAlive: parseInt(process.env.REDIS_KEEP_ALIVE, 10) || 30000,
    retryStrategy: (times) => {
      // NEVER return null/undefined - always return a delay
      if (times > 20) {
        console.error(`BullMQ Redis: Max retries (${times}). Continuing with 30s delay.`);
        return 30000;
      }
      const delay = Math.min(times * 1000, 30000);
      if (times > 1) {
        console.log(`BullMQ Redis: Retrying in ${delay}ms (attempt ${times})`);
      }
      return delay;
    },
  };

  // Add password/auth token
  if (process.env.REDIS_PASSWORD || process.env.REDIS_AUTH_TOKEN) {
    options.password = process.env.REDIS_AUTH_TOKEN || process.env.REDIS_PASSWORD;
  }

  // TLS configuration for ElastiCache
  if (process.env.REDIS_TLS === 'true' || process.env.ELASTICACHE_TLS === 'true') {
    options.tls = {
      rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
      servername: process.env.REDIS_HOST || 'localhost',
    };
  }

  return options;
};

/**
 * Create a Redis connection for BullMQ
 * Returns either a cluster client or standalone client based on config
 */
const createNewConnection = () => {
  const options = buildConnectionOptions();

  if (process.env.REDIS_CLUSTER_MODE === 'true') {
    // ElastiCache Cluster Mode with enhanced configuration
    const clusterNodes = [{ host: options.host, port: options.port }];

    const clusterClient = new Redis.Cluster(clusterNodes, {
      // DNS resolution callback for ElastiCache
      dnsLookup: (address, callback) => callback(null, address),
      enableReadyCheck: true,
      // Increased timeout for ElastiCache Serverless slot refresh
      slotsRefreshTimeout: parseInt(process.env.REDIS_CLUSTER_SLOTS_REFRESH_TIMEOUT, 10) || 15000,
      slotsRefreshInterval: parseInt(process.env.REDIS_CLUSTER_SLOTS_REFRESH_INTERVAL, 10) || 5000,
      // Enable auto pipelining for better cluster performance
      enableAutoPipelining: true,
      // Redis options for each node
      redisOptions: {
        ...options,
        // Show friendly error stack in development
        showFriendlyErrorStack: isDev,
      },
      clusterRetryStrategy: (times) => {
        if (times > (parseInt(process.env.REDIS_MAX_RECONNECT_ATTEMPTS, 10) || 20)) {
          console.error(`BullMQ Redis Cluster: Max retries (${times}). Continuing with 30s delay.`);
          return 30000;
        }
        const delay = Math.min(times * 1000, 30000);
        if (times > 1) {
          console.log(`BullMQ Redis Cluster: Retrying in ${delay}ms (attempt ${times})`);
        }
        return delay;
      },
      scaleReads: 'slave',
    });

    // Add cluster-specific error handling for CLUSTERDOWN, MOVED, ASK errors
    clusterClient.on('error', (err) => {
      if (err.message?.includes('CLUSTERDOWN')) {
        console.error('BullMQ Redis Cluster: Cluster is down, waiting for recovery...');
      } else if (err.message?.includes('MOVED') || err.message?.includes('ASK')) {
        // These are typically handled automatically by ioredis, log for visibility
        if (isDev) {
          console.log('BullMQ Redis Cluster: Slot redirect detected, handled automatically');
        }
      }
    });

    clusterClient.on('node error', (err, address) => {
      console.error(`BullMQ Redis Cluster: Node ${address} error:`, err.message);
    });

    return clusterClient;
  }

  return new Redis(options);
};

// Shared Redis connections (declared at module scope for ES module compatibility)
let sharedConnection = null;
let sharedBlockingConnection = null;

/**
 * Initialize shared Redis connections at module load
 * All Queues, QueueSchedulers, and QueueEvents share one connection.
 * Workers share a separate blocking connection.
 */
const initializeSharedConnections = () => {
  if (!REDIS_ENABLED) return;

  try {
    // Main shared connection for Queue, QueueScheduler, QueueEvents
    sharedConnection = createNewConnection();
    setupConnectionEventListeners(sharedConnection, 'shared');

    // Separate blocking connection for Workers (they use blocking commands like BRPOPLPUSH)
    sharedBlockingConnection = createNewConnection();
    setupConnectionEventListeners(sharedBlockingConnection, 'shared-blocking');

    console.log('BullMQ: Shared Redis connections initialized');
  } catch (error) {
    console.error('BullMQ: Failed to create shared connections:', error.message);
    sharedConnection = null;
    sharedBlockingConnection = null;
  }
};

/**
 * Set up event listeners for connection monitoring and reconnection
 */
const setupConnectionEventListeners = (connection, name) => {
  if (!connection) return;

  connection.on('error', (error) => {
    if (isDev && error.code === 'ECONNREFUSED') return;
    console.error(`BullMQ ${name} connection error:`, error.message);
  });

  connection.on('close', () => {
    console.warn(`BullMQ ${name} connection: Closed, attempting reconnection...`);
    // ioredis handles reconnection automatically via retryStrategy
  });

  connection.on('reconnecting', (delay) => {
    console.log(`BullMQ ${name} connection: Reconnecting in ${delay}ms...`);
  });

  connection.on('end', () => {
    console.error(`BullMQ ${name} connection: Permanently disconnected (end event)`);
    // Trigger reconnection attempt if circuit breaker allows
    if (canAttemptReconnection()) {
      scheduleReconnection();
    }
  });

  connection.on('ready', () => {
    console.log(`BullMQ ${name} connection: Ready`);
    recordReconnectionSuccess();
  });
};

// Circuit breaker state for reconnection attempts
let reconnectionScheduled = false;
const circuitBreaker = {
  failures: [],
  maxFailures: 10,
  windowMs: 60000, // 60 second window
};

/**
 * Check if circuit breaker allows a reconnection attempt
 */
const canAttemptReconnection = () => {
  const now = Date.now();
  // Clean up old failures
  circuitBreaker.failures = circuitBreaker.failures.filter(
    (time) => now - time < circuitBreaker.windowMs
  );
  return circuitBreaker.failures.length < circuitBreaker.maxFailures;
};

/**
 * Record a reconnection failure
 */
const recordReconnectionFailure = () => {
  circuitBreaker.failures.push(Date.now());
  if (circuitBreaker.failures.length >= circuitBreaker.maxFailures) {
    console.error(`BullMQ: Circuit breaker OPEN - Too many reconnection failures (${circuitBreaker.failures.length})`);
  }
};

/**
 * Record a successful reconnection
 */
const recordReconnectionSuccess = () => {
  circuitBreaker.failures = [];
};

/**
 * Schedule a reconnection attempt with delay
 */
const scheduleReconnection = () => {
  if (reconnectionScheduled) return;
  reconnectionScheduled = true;

  const delay = Math.min(circuitBreaker.failures.length * 5000, 30000);
  console.log(`BullMQ: Scheduling reconnection attempt in ${delay}ms...`);

  setTimeout(async () => {
    reconnectionScheduled = false;
    await reconnectSharedConnections();
  }, delay);
};

/**
 * Attempt to recreate shared connections after permanent disconnection
 */
const reconnectSharedConnections = async () => {
  if (!canAttemptReconnection()) {
    console.error('BullMQ: Circuit breaker preventing reconnection attempt');
    return false;
  }

  console.log('BullMQ: Attempting to reconnect shared connections...');

  try {
    // Close existing connections gracefully
    if (sharedConnection) {
      await sharedConnection.quit().catch(() => { });
    }
    if (sharedBlockingConnection) {
      await sharedBlockingConnection.quit().catch(() => { });
    }

    // Reinitialize connections
    initializeSharedConnections();

    // Wait for connections to be ready
    if (sharedConnection && sharedBlockingConnection) {
      await Promise.all([
        waitForConnectionReady(sharedConnection, 10000),
        waitForConnectionReady(sharedBlockingConnection, 10000),
      ]);
      console.log('BullMQ: Shared connections reconnected successfully');
      recordReconnectionSuccess();
      return true;
    }
  } catch (error) {
    console.error('BullMQ: Reconnection failed:', error.message);
    recordReconnectionFailure();
  }

  return false;
};

/**
 * Wait for a connection to be ready
 */
const waitForConnectionReady = (connection, timeout = 10000) => {
  return new Promise((resolve, reject) => {
    if (connection.status === 'ready') {
      resolve();
      return;
    }

    const timeoutId = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, timeout);

    connection.once('ready', () => {
      clearTimeout(timeoutId);
      resolve();
    });

    connection.once('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
};

// Initialize shared connections immediately
initializeSharedConnections();

/**
 * Get the shared connection for non-blocking operations (Queue, QueueScheduler, QueueEvents)
 */
export const getSharedConnection = () => sharedConnection;

/**
 * Get the shared blocking connection for Workers
 */
export const getSharedBlockingConnection = () => sharedBlockingConnection;

/**
 * Legacy export for backward compatibility - creates new connection
 * @deprecated Use getSharedConnection() or getSharedBlockingConnection() instead
 */
export const createConnection = () => createNewConnection();

/**
 * Default job options for all queues
 */
export const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    count: 100,
    age: 86400, // 24 hours
  },
  removeOnFail: {
    count: 50,
    age: 604800, // 7 days
  },
};

/**
 * Create a BullMQ Queue instance with shared prefix
 * Uses shared connection to reduce connection count
 */
const createQueue = (name, options = {}) => {
  if (!REDIS_ENABLED || !sharedConnection) {
    return createMockQueue(name);
  }

  try {
    const queue = new Queue(name, {
      connection: sharedConnection,
      prefix: 'splitit', // Shared prefix for all queues in this app
      defaultJobOptions: {
        ...defaultJobOptions,
        ...options.defaultJobOptions,
      },
    });

    queue.on('error', (error) => {
      if (isDev && error.code === 'ECONNREFUSED') return;
      console.error(`Queue ${name} error:`, error.message);
    });

    return queue;
  } catch (error) {
    console.error(`Failed to create queue ${name}:`, error.message);
    return createMockQueue(name);
  }
};

/**
 * Create a BullMQ Worker instance
 * Uses shared blocking connection (Workers use blocking commands like BRPOPLPUSH)
 */
export const createWorker = (name, processor, options = {}) => {
  if (!REDIS_ENABLED || !sharedBlockingConnection) {
    console.log(`Worker ${name}: Redis disabled, using mock worker`);
    return createMockWorker(name);
  }

  try {
    const worker = new Worker(name, processor, {
      connection: sharedBlockingConnection,
      prefix: 'splitit', // Must match queue prefix
      concurrency: options.concurrency || 5,
      limiter: options.limiter,
      ...options,
    });

    worker.on('completed', (job) => {
      if (isDev) {
        console.log(`Worker ${name}: Job ${job.id} completed`);
      }
    });

    worker.on('failed', (job, error) => {
      console.error(`Worker ${name}: Job ${job?.id} failed:`, error.message);
    });

    worker.on('error', (error) => {
      if (isDev && error.code === 'ECONNREFUSED') return;
      console.error(`Worker ${name} error:`, error.message);
    });

    workers[name] = worker;
    return worker;
  } catch (error) {
    console.error(`Failed to create worker ${name}:`, error.message);
    return createMockWorker(name);
  }
};

/**
 * Create QueueEvents for monitoring (required for some BullMQ features)
 * Uses shared connection to reduce connection count
 */
export const createQueueEvents = (name) => {
  if (!REDIS_ENABLED || !sharedConnection) return null;

  try {
    const events = new QueueEvents(name, {
      connection: sharedConnection,
      prefix: 'splitit', // Must match queue prefix
    });
    queueEvents[name] = events;
    return events;
  } catch (error) {
    console.error(`Failed to create QueueEvents for ${name}:`, error.message);
    return null;
  }
};

/**
 * Feature-detect QueueScheduler availability and create if supported
 * Newer BullMQ versions removed QueueScheduler in favor of built-in delayed/repeatable support
 * This function gracefully handles both old and new versions
 */
const createQueueSchedulerIfAvailable = (name) => {
  // Check if QueueScheduler is available in bullmq exports
  if (!bullmq.QueueScheduler) {
    if (isDev) {
      console.log(`QueueScheduler not available in BullMQ for ${name} - using built-in delayed/repeatable support`);
    }
    return null;
  }

  if (!REDIS_ENABLED || !sharedConnection) return null;

  try {
    const { QueueScheduler } = bullmq;
    const scheduler = new QueueScheduler(name, {
      connection: sharedConnection,
      prefix: 'splitit', // Must match queue prefix
    });

    scheduler.on('error', (error) => {
      if (isDev && error.code === 'ECONNREFUSED') return;
      console.error(`QueueScheduler ${name} error:`, error.message);
    });

    return scheduler;
  } catch (error) {
    console.error(`Failed to create QueueScheduler for ${name}:`, error.message);
    return null;
  }
};

/**
 * Store queue schedulers if created
 */
const queueSchedulers = {};

/**
 * Mock Queue for development when Redis is unavailable
 */
class MockQueue {
  constructor(name) {
    this.name = name;
  }

  async add(jobName, data, opts) {
    if (isDev) {
      console.log(`[MockQueue:${this.name}] Job skipped:`, jobName);
    }
    return { id: 'mock-' + Date.now(), name: jobName, data };
  }

  async addBulk(jobs) {
    return jobs.map((j, i) => ({
      id: 'mock-' + Date.now() + '-' + i,
      name: j.name,
      data: j.data
    }));
  }

  async getJobCounts() {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
  }

  async close() { }
  on() { }
}

/**
 * Mock Worker for development when Redis is unavailable
 */
class MockWorker {
  constructor(name) {
    this.name = name;
  }
  async close() { }
  on() { }
}

const createMockQueue = (name) => new MockQueue(name);
const createMockWorker = (name) => new MockWorker(name);

/**
 * Initialize all queues with retry logic
 * @param {number} attempt - Current attempt number (1-based)
 * @param {number} maxAttempts - Maximum number of attempts
 */
const initializeQueuesWithRetry = async (attempt = 1, maxAttempts = 3) => {
  if (!REDIS_ENABLED) {
    console.log('BullMQ: Disabled via REDIS_ENABLED=false');
    setupMockQueues();
    return;
  }

  // In production, fail fast if Redis connections are not available
  if (!sharedConnection || !sharedBlockingConnection) {
    const errorMsg = 'BullMQ: Redis connections not initialized. ' +
      `sharedConnection=${!!sharedConnection}, sharedBlockingConnection=${!!sharedBlockingConnection}`;
    if (!isDev) {
      throw new Error(errorMsg + ' - Redis is required in production.');
    }
    console.warn(errorMsg + ' - Using mock queues in development.');
    setupMockQueues();
    return;
  }

  try {
    console.log(`BullMQ: Initializing queues (attempt ${attempt}/${maxAttempts})...`);

    // Verify shared connection is ready before creating queues
    await waitForConnectionReady(sharedConnection, 10000);
    await waitForConnectionReady(sharedBlockingConnection, 10000);

    // Log cluster topology if in cluster mode
    if (process.env.REDIS_CLUSTER_MODE === 'true') {
      try {
        const nodes = sharedConnection.nodes?.('all') || [];
        console.log(`BullMQ: Connected to Redis Cluster with ${nodes.length} node(s)`);

        // Try to get cluster info
        const clusterInfo = await sharedConnection.cluster('INFO').catch(() => null);
        if (clusterInfo) {
          const stateMatch = clusterInfo.match(/cluster_state:(\w+)/);
          const slotsMatch = clusterInfo.match(/cluster_slots_assigned:(\d+)/);
          if (stateMatch) {
            console.log(`BullMQ: Cluster state: ${stateMatch[1]}`);
          }
          if (slotsMatch) {
            console.log(`BullMQ: Slot coverage: ${slotsMatch[1]}/16384`);
          }
        }
      } catch (clusterErr) {
        // Cluster info may not be available, continue anyway
        if (isDev) {
          console.log('BullMQ: Could not retrieve cluster topology info');
        }
      }
    }

    // Create queue instances
    queues.email = createQueue(QUEUE_NAMES.EMAIL, {
      defaultJobOptions: { ...defaultJobOptions, attempts: 5 },
    });

    queues.notification = createQueue(QUEUE_NAMES.NOTIFICATION);

    queues.balance = createQueue(QUEUE_NAMES.BALANCE, {
      defaultJobOptions: { ...defaultJobOptions, timeout: 30000 },
    });

    queues.recurring = createQueue(QUEUE_NAMES.RECURRING, {
      defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
    });

    queues.digest = createQueue(QUEUE_NAMES.DIGEST);

    queues.dueReminder = createQueue(QUEUE_NAMES.DUE_REMINDER);

    // Create QueueSchedulers if available (feature-detect for BullMQ version compatibility)
    // Newer versions have built-in delayed/repeatable job support without QueueScheduler
    // Store returned schedulers for graceful shutdown
    const emailScheduler = createQueueSchedulerIfAvailable(QUEUE_NAMES.EMAIL);
    if (emailScheduler) queueSchedulers[QUEUE_NAMES.EMAIL] = emailScheduler;

    const notificationScheduler = createQueueSchedulerIfAvailable(QUEUE_NAMES.NOTIFICATION);
    if (notificationScheduler) queueSchedulers[QUEUE_NAMES.NOTIFICATION] = notificationScheduler;

    const balanceScheduler = createQueueSchedulerIfAvailable(QUEUE_NAMES.BALANCE);
    if (balanceScheduler) queueSchedulers[QUEUE_NAMES.BALANCE] = balanceScheduler;

    const recurringScheduler = createQueueSchedulerIfAvailable(QUEUE_NAMES.RECURRING);
    if (recurringScheduler) queueSchedulers[QUEUE_NAMES.RECURRING] = recurringScheduler;

    const digestScheduler = createQueueSchedulerIfAvailable(QUEUE_NAMES.DIGEST);
    if (digestScheduler) queueSchedulers[QUEUE_NAMES.DIGEST] = digestScheduler;

    const dueReminderScheduler = createQueueSchedulerIfAvailable(QUEUE_NAMES.DUE_REMINDER);
    if (dueReminderScheduler) queueSchedulers[QUEUE_NAMES.DUE_REMINDER] = dueReminderScheduler;

    queuesAvailable = true;
    console.log('BullMQ: All queues initialized successfully');
  } catch (err) {
    console.error(`BullMQ: Queue initialization attempt ${attempt} failed:`, err.message);

    if (attempt < maxAttempts) {
      // Exponential backoff: 2s, 4s, 8s
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`BullMQ: Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return initializeQueuesWithRetry(attempt + 1, maxAttempts);
    }

    if (isDev) {
      console.warn('BullMQ: All retry attempts failed, using mock queues:', err.message);
      setupMockQueues();
      // queuesAvailable stays false when using mocks
    } else {
      throw new Error('Redis is required in production: ' + err.message);
    }
  }
};

/**
 * Set up mock queues for development when Redis is unavailable
 */
const setupMockQueues = () => {
  queues.email = createMockQueue(QUEUE_NAMES.EMAIL);
  queues.notification = createMockQueue(QUEUE_NAMES.NOTIFICATION);
  queues.balance = createMockQueue(QUEUE_NAMES.BALANCE);
  queues.recurring = createMockQueue(QUEUE_NAMES.RECURRING);
  queues.digest = createMockQueue(QUEUE_NAMES.DIGEST);
  queues.dueReminder = createMockQueue(QUEUE_NAMES.DUE_REMINDER);
};

/**
 * Initialize all queues (wrapper for backward compatibility)
 */
const initializeQueues = () => initializeQueuesWithRetry(1, 3);

// Initialize queues immediately
// In production, errors are propagated so server startup fails
// In development, errors are logged but startup continues with mock queues
const initPromise = initializeQueues().catch(err => {
  console.error('Failed to initialize BullMQ queues:', err.message);
  if (!isDev) {
    // Rethrow in production so waitForQueues() rejects and server.js can fail startup
    throw err;
  }
  // In development, swallow the error - mock queues are already set up by initializeQueues
});

/**
 * Wait for queues to be ready
 * In production, this will reject if initialization failed.
 * Callers should catch the rejection and exit the process.
 */
export const waitForQueues = () => initPromise;

/**
 * Check if queues are available (Redis connected)
 */
export const areQueuesAvailable = () => queuesAvailable;

/**
 * Get queue instances
 */
export const getEmailQueue = () => queues.email;
export const getNotificationQueue = () => queues.notification;
export const getBalanceQueue = () => queues.balance;
export const getRecurringQueue = () => queues.recurring;
export const getDigestQueue = () => queues.digest;
export const getDueReminderQueue = () => queues.dueReminder;

/**
 * Gracefully close all queues, workers, events, and shared connections
 */
export const closeAllQueues = async () => {
  console.log('Closing BullMQ queues and workers...');

  const closePromises = [];

  // Close workers first
  for (const [name, worker] of Object.entries(workers)) {
    closePromises.push(
      worker.close().catch(err => console.error(`Error closing worker ${name}:`, err.message))
    );
  }

  // Close queue events
  for (const [name, events] of Object.entries(queueEvents)) {
    closePromises.push(
      events.close().catch(err => console.error(`Error closing events ${name}:`, err.message))
    );
  }

  // Close queue schedulers before closing queues
  for (const [name, scheduler] of Object.entries(queueSchedulers)) {
    closePromises.push(
      scheduler.close().catch(err => console.error(`Error closing scheduler ${name}:`, err.message))
    );
  }

  // Close queues
  for (const [name, queue] of Object.entries(queues)) {
    closePromises.push(
      queue.close().catch(err => console.error(`Error closing queue ${name}:`, err.message))
    );
  }

  await Promise.all(closePromises);

  // Close shared Redis connections last
  if (sharedBlockingConnection) {
    await sharedBlockingConnection.quit().catch(err =>
      console.error('Error closing shared blocking connection:', err.message)
    );
  }
  if (sharedConnection) {
    await sharedConnection.quit().catch(err =>
      console.error('Error closing shared connection:', err.message)
    );
  }

  console.log('BullMQ: All queues, workers, and connections closed');
};

// Proxy objects for backward compatibility with existing code
export const emailQueue = {
  add: async (jobNameOrData, dataOrOpts, opts) => {
    const queue = getEmailQueue();
    // Handle both add(name, data, opts) and add(data, opts) signatures
    if (typeof jobNameOrData === 'string') {
      return queue.add(jobNameOrData, dataOrOpts, opts);
    }
    return queue.add('default', jobNameOrData, dataOrOpts);
  },
  addBulk: async (jobs) => {
    const queue = getEmailQueue();
    // BullMQ addBulk expects: [{ name, data, opts }]
    const formattedJobs = jobs.map(j => ({
      name: j.name || 'default',
      data: j.data || j,
      opts: j.opts,
    }));
    return queue.addBulk(formattedJobs);
  },
  getJobCounts: () => getEmailQueue().getJobCounts(),
  close: () => getEmailQueue().close(),
};

export const notificationQueue = {
  add: async (jobNameOrData, dataOrOpts, opts) => {
    const queue = getNotificationQueue();
    if (typeof jobNameOrData === 'string') {
      return queue.add(jobNameOrData, dataOrOpts, opts);
    }
    return queue.add('default', jobNameOrData, dataOrOpts);
  },
  addBulk: async (jobs) => {
    const queue = getNotificationQueue();
    // BullMQ addBulk expects: [{ name, data, opts }]
    const formattedJobs = jobs.map(j => ({
      name: j.name || 'default',
      data: j.data || j,
      opts: j.opts,
    }));
    return queue.addBulk(formattedJobs);
  },
  getJobCounts: () => getNotificationQueue().getJobCounts(),
  close: () => getNotificationQueue().close(),
};

export const balanceQueue = {
  add: async (jobNameOrData, dataOrOpts, opts) => {
    const queue = getBalanceQueue();
    if (typeof jobNameOrData === 'string') {
      return queue.add(jobNameOrData, dataOrOpts, opts);
    }
    return queue.add('default', jobNameOrData, dataOrOpts);
  },
  getJobCounts: () => getBalanceQueue().getJobCounts(),
  close: () => getBalanceQueue().close(),
};

export const recurringQueue = {
  add: async (jobNameOrData, dataOrOpts, opts) => {
    const queue = getRecurringQueue();
    if (typeof jobNameOrData === 'string') {
      return queue.add(jobNameOrData, dataOrOpts, opts);
    }
    return queue.add('default', jobNameOrData, dataOrOpts);
  },
  getJobCounts: () => getRecurringQueue().getJobCounts(),
  close: () => getRecurringQueue().close(),
};

export const digestQueue = {
  add: async (jobNameOrData, dataOrOpts, opts) => {
    const queue = getDigestQueue();
    if (typeof jobNameOrData === 'string') {
      return queue.add(jobNameOrData, dataOrOpts, opts);
    }
    return queue.add('default', jobNameOrData, dataOrOpts);
  },
  getJobCounts: () => getDigestQueue().getJobCounts(),
  close: () => getDigestQueue().close(),
};

export const dueReminderQueue = {
  add: async (jobNameOrData, dataOrOpts, opts) => {
    const queue = getDueReminderQueue();
    if (typeof jobNameOrData === 'string') {
      return queue.add(jobNameOrData, dataOrOpts, opts);
    }
    return queue.add('default', jobNameOrData, dataOrOpts);
  },
  getJobCounts: () => getDueReminderQueue().getJobCounts(),
  close: () => getDueReminderQueue().close(),
};

// Export for backward compatibility
export const closeQueues = closeAllQueues;

export default {
  emailQueue,
  notificationQueue,
  balanceQueue,
  recurringQueue,
  digestQueue,
  dueReminderQueue,
  closeQueues: closeAllQueues,
  waitForQueues,
  areQueuesAvailable,
  createConnection,
  createWorker,
  createQueueEvents,
  QUEUE_NAMES,
  defaultJobOptions,
};
