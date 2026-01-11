/**
 * Bull Queue Configuration
 * 
 * Provides job queues for background processing of emails, notifications,
 * balance calculations, and recurring expenses.
 * 
 * In development, queues are optional and will gracefully degrade if Redis
 * is not available.
 */

import Bull from 'bull';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const isDev = process.env.NODE_ENV !== 'production';
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

// Track if queues are available
let queuesAvailable = false;

// Email processor function - will be set by email worker
let emailProcessor = null;

// Store queues in an object so exports always get the latest reference
const queues = {
  email: null,
  notification: null,
  balance: null,
  recurring: null,
};

/**
 * Set the email processor for direct sending when Redis is unavailable
 */
export const setEmailProcessor = (processor) => {
  emailProcessor = processor;
};

/**
 * Mock queue for when Redis is not available
 * Provides a no-op implementation that won't crash the app
 * For email queue, it will try to send directly if SMTP is configured
 */
class MockQueue {
  constructor(name) {
    this.name = name;
    this._processors = [];
  }
  
  async add(jobNameOrData, dataOrOpts, opts) {
    // Bull queue supports two signatures:
    // 1. add(data, opts) - unnamed job
    // 2. add(name, data, opts) - named job
    let jobName, data;
    if (typeof jobNameOrData === 'string') {
      jobName = jobNameOrData;
      data = dataOrOpts;
    } else {
      jobName = 'default';
      data = jobNameOrData;
    }
    
    // For email queue, try to send directly if processor is available
    if (this.name === 'email' && emailProcessor && data) {
      try {
        console.log(`[MockQueue:email] Sending email directly (Redis unavailable):`, data?.template || 'custom');
        await emailProcessor({ data });
        return { id: 'direct-' + Date.now(), name: jobName, data };
      } catch (err) {
        console.error(`[MockQueue:email] Direct send failed:`, err.message);
      }
    } else if (isDev) {
      console.log(`[MockQueue:${this.name}] Job skipped (Redis unavailable):`, jobName, data?.template || '');
    }
    
    return { id: 'mock-' + Date.now(), name: jobName, data };
  }
  
  async addBulk(jobs) {
    return jobs.map((j, i) => ({ id: 'mock-' + Date.now() + '-' + i, ...j }));
  }
  
  process(nameOrProcessor, processor) {
    // Store processor for later registration when real queue is ready
    if (typeof nameOrProcessor === 'function') {
      this._processors.push({ processor: nameOrProcessor });
    } else {
      this._processors.push({ name: nameOrProcessor, processor });
    }
  }
  
  getProcessors() {
    return this._processors;
  }
  
  on() {}
  async close() {}
  async getJobCounts() {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
  }
  async getWaitingCount() { return 0; }
  async getActiveCount() { return 0; }
  async getCompletedCount() { return 0; }
  async getFailedCount() { return 0; }
  async getDelayedCount() { return 0; }
}

/**
 * Build Redis configuration for Bull queues
 * Supports local Redis and Amazon ElastiCache
 */
const buildQueueRedisConfig = () => {
  const config = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    maxRetriesPerRequest: null, // Required for Bull - see https://github.com/OptimalBits/bull/issues/1873
    enableReadyCheck: false, // Required for Bull
    enableOfflineQueue: false, // Prevent queuing commands when disconnected (important for cluster)
    retryStrategy: (times) => {
      if (times > 3) {
        return null; // Stop retrying
      }
      return Math.min(times * 200, 1000);
    },
  };

  // Add password/auth token (ElastiCache AUTH token or Redis password)
  if (process.env.REDIS_PASSWORD || process.env.REDIS_AUTH_TOKEN) {
    config.password = process.env.REDIS_AUTH_TOKEN || process.env.REDIS_PASSWORD;
  }

  // ElastiCache TLS configuration
  if (process.env.REDIS_TLS === 'true' || process.env.ELASTICACHE_TLS === 'true') {
    config.tls = {
      rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
    };
  }

  // Keep-alive for ElastiCache connections
  config.keepAlive = parseInt(process.env.REDIS_KEEP_ALIVE, 10) || 30000;

  return config;
};

const redisConfig = buildQueueRedisConfig();

// Default job options
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: 100, // Keep last 100 completed jobs
  removeOnFail: 50, // Keep last 50 failed jobs
};

/**
 * Initialize queues with real Bull or mock implementation
 */
const initializeQueues = async () => {
  if (!REDIS_ENABLED) {
    console.log('Queues: Disabled via REDIS_ENABLED=false');
    queues.email = new MockQueue('email');
    queues.notification = new MockQueue('notification');
    queues.balance = new MockQueue('balance');
    queues.recurring = new MockQueue('recurring');
    return;
  }

  try {
    // Test Redis connection first
    const testQueue = new Bull('test-connection', { redis: redisConfig });
    await testQueue.isReady();
    await testQueue.close();
    
    queuesAvailable = true;
    console.log('Queues: Redis available, using Bull queues');

    // Get processors registered on MockQueues before replacing them
    const emailProcessors = queues.email?.getProcessors?.() || [];
    const notificationProcessors = queues.notification?.getProcessors?.() || [];
    const balanceProcessors = queues.balance?.getProcessors?.() || [];
    const recurringProcessors = queues.recurring?.getProcessors?.() || [];

    // Create real queues with hash tag prefix for Redis Cluster compatibility
    // Hash tags {...} ensure all queue-related keys hash to the same slot
    queues.email = new Bull('{bull}:email', {
      redis: redisConfig,
      defaultJobOptions: {
        ...defaultJobOptions,
        attempts: 5,
      },
    });

    queues.notification = new Bull('{bull}:notification', {
      redis: redisConfig,
      defaultJobOptions,
      limiter: {
        max: 100,
        duration: 1000,
        bounceBack: false,
      },
    });

    queues.balance = new Bull('{bull}:balance', {
      redis: redisConfig,
      defaultJobOptions: {
        ...defaultJobOptions,
        timeout: 30000,
      },
    });

    queues.recurring = new Bull('{bull}:recurring', {
      redis: redisConfig,
      defaultJobOptions: {
        ...defaultJobOptions,
        attempts: 1,
      },
    });

    // Re-register processors on real Bull queues
    console.log(`Registering ${emailProcessors.length} email processors on Bull queue`);
    for (const { name, processor } of emailProcessors) {
      if (name) {
        queues.email.process(name, processor);
      } else {
        queues.email.process(processor);
      }
    }
    for (const { name, processor } of notificationProcessors) {
      if (name) {
        queues.notification.process(name, processor);
      } else {
        queues.notification.process(processor);
      }
    }
    for (const { name, processor } of balanceProcessors) {
      if (name) {
        queues.balance.process(name, processor);
      } else {
        queues.balance.process(processor);
      }
    }
    for (const { name, processor } of recurringProcessors) {
      if (name) {
        queues.recurring.process(name, processor);
      } else {
        queues.recurring.process(processor);
      }
    }

    // Setup event handlers
    setupQueueEvents(queues.email, 'email');
    setupQueueEvents(queues.notification, 'notification');
    setupQueueEvents(queues.balance, 'balance');
    setupQueueEvents(queues.recurring, 'recurring');

  } catch (err) {
    if (isDev) {
      console.warn('Queues: Redis not available, using mock queues (jobs will be skipped)');
      queues.email = new MockQueue('email');
      queues.notification = new MockQueue('notification');
      queues.balance = new MockQueue('balance');
      queues.recurring = new MockQueue('recurring');
    } else {
      throw new Error('Redis is required in production: ' + err.message);
    }
  }
};

// Queue event handlers for logging and monitoring
const setupQueueEvents = (queue, name) => {
  queue.on('error', (error) => {
    // Suppress connection refused errors in dev (too noisy)
    if (isDev && error.code === 'ECONNREFUSED') return;
    console.error(`Queue ${name} error:`, error.message);
  });

  queue.on('failed', (job, err) => {
    console.error(`Queue ${name} job ${job.id} failed:`, err.message);
  });

  if (isDev) {
    queue.on('completed', (job) => {
      console.log(`Queue ${name} job ${job.id} completed`);
    });
  }
};

// Initialize queues immediately with MockQueues
// They will be replaced by real Bull queues once Redis is connected
queues.email = new MockQueue('email');
queues.notification = new MockQueue('notification');
queues.balance = new MockQueue('balance');
queues.recurring = new MockQueue('recurring');

// Async initialization
const initPromise = initializeQueues().catch(err => {
  console.error('Failed to initialize queues:', err.message);
});

/**
 * Wait for queues to be ready
 */
export const waitForQueues = () => initPromise;

/**
 * Check if queues are available (Redis connected)
 */
export const areQueuesAvailable = () => queuesAvailable;

/**
 * Gracefully close all queues
 */
export const closeQueues = async () => {
  console.log('Closing Bull queues...');
  await Promise.all([
    queues.email?.close?.(),
    queues.notification?.close?.(),
    queues.balance?.close?.(),
    queues.recurring?.close?.(),
  ].filter(Boolean));
  console.log('Bull queues closed');
};

// Export proxy objects that always reference the current queue
export const emailQueue = {
  add: (...args) => queues.email.add(...args),
  addBulk: (...args) => queues.email.addBulk?.(...args),
  process: (...args) => queues.email.process(...args),
  on: (...args) => queues.email.on(...args),
  close: () => queues.email.close?.(),
  getJobCounts: () => queues.email.getJobCounts?.(),
};

export const notificationQueue = {
  add: (...args) => queues.notification.add(...args),
  addBulk: (...args) => queues.notification.addBulk?.(...args),
  process: (...args) => queues.notification.process(...args),
  on: (...args) => queues.notification.on(...args),
  close: () => queues.notification.close?.(),
  getJobCounts: () => queues.notification.getJobCounts?.(),
  getWaitingCount: () => queues.notification.getWaitingCount?.() || Promise.resolve(0),
  getActiveCount: () => queues.notification.getActiveCount?.() || Promise.resolve(0),
  getCompletedCount: () => queues.notification.getCompletedCount?.() || Promise.resolve(0),
  getFailedCount: () => queues.notification.getFailedCount?.() || Promise.resolve(0),
};

export const balanceQueue = {
  add: (...args) => queues.balance.add(...args),
  addBulk: (...args) => queues.balance.addBulk?.(...args),
  process: (...args) => queues.balance.process(...args),
  on: (...args) => queues.balance.on(...args),
  close: () => queues.balance.close?.(),
  getJobCounts: () => queues.balance.getJobCounts?.(),
};

export const recurringQueue = {
  add: (...args) => queues.recurring.add(...args),
  addBulk: (...args) => queues.recurring.addBulk?.(...args),
  process: (...args) => queues.recurring.process(...args),
  on: (...args) => queues.recurring.on(...args),
  close: () => queues.recurring.close?.(),
  getJobCounts: () => queues.recurring.getJobCounts?.(),
};

// Export all queues as named exports (for selective imports)
export default {
  emailQueue,
  notificationQueue,
  balanceQueue,
  recurringQueue,
  closeQueues,
  waitForQueues,
  areQueuesAvailable,
};
