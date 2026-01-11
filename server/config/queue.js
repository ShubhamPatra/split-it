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

/**
 * Mock queue for when Redis is not available
 * Provides a no-op implementation that won't crash the app
 */
class MockQueue {
  constructor(name) {
    this.name = name;
  }
  
  async add(jobName, data, opts) {
    if (isDev) {
      console.log(`[MockQueue:${this.name}] Job skipped (Redis unavailable):`, jobName);
    }
    return { id: 'mock-' + Date.now(), name: jobName, data };
  }
  
  async addBulk(jobs) {
    return jobs.map((j, i) => ({ id: 'mock-' + Date.now() + '-' + i, ...j }));
  }
  
  process() {}
  on() {}
  async close() {}
  async getJobCounts() {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
  }
}

// Redis connection configuration for Bull
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy: (times) => {
    if (times > 3) {
      return null; // Stop retrying
    }
    return Math.min(times * 200, 1000);
  },
};

// Add password if provided
if (process.env.REDIS_PASSWORD) {
  redisConfig.password = process.env.REDIS_PASSWORD;
}

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

// Initialize queues (real or mock based on Redis availability)
let emailQueue;
let notificationQueue;
let balanceQueue;
let recurringQueue;

/**
 * Initialize queues with real Bull or mock implementation
 */
const initializeQueues = async () => {
  if (!REDIS_ENABLED) {
    console.log('Queues: Disabled via REDIS_ENABLED=false');
    emailQueue = new MockQueue('email');
    notificationQueue = new MockQueue('notification');
    balanceQueue = new MockQueue('balance');
    recurringQueue = new MockQueue('recurring');
    return;
  }

  try {
    // Test Redis connection first
    const testQueue = new Bull('test-connection', { redis: redisConfig });
    await testQueue.isReady();
    await testQueue.close();
    
    queuesAvailable = true;
    console.log('Queues: Redis available, using Bull queues');

    // Create real queues
    emailQueue = new Bull('email', {
      redis: redisConfig,
      defaultJobOptions: {
        ...defaultJobOptions,
        attempts: 5,
      },
    });

    notificationQueue = new Bull('notification', {
      redis: redisConfig,
      defaultJobOptions,
      limiter: {
        max: 100,
        duration: 1000,
        bounceBack: false,
      },
    });

    balanceQueue = new Bull('balance', {
      redis: redisConfig,
      defaultJobOptions: {
        ...defaultJobOptions,
        timeout: 30000,
      },
    });

    recurringQueue = new Bull('recurring', {
      redis: redisConfig,
      defaultJobOptions: {
        ...defaultJobOptions,
        attempts: 1,
      },
    });

    // Setup event handlers
    setupQueueEvents(emailQueue, 'email');
    setupQueueEvents(notificationQueue, 'notification');
    setupQueueEvents(balanceQueue, 'balance');
    setupQueueEvents(recurringQueue, 'recurring');

  } catch (err) {
    if (isDev) {
      console.warn('Queues: Redis not available, using mock queues (jobs will be skipped)');
      emailQueue = new MockQueue('email');
      notificationQueue = new MockQueue('notification');
      balanceQueue = new MockQueue('balance');
      recurringQueue = new MockQueue('recurring');
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

// Initialize queues immediately
// Use a placeholder until async init completes
emailQueue = new MockQueue('email');
notificationQueue = new MockQueue('notification');
balanceQueue = new MockQueue('balance');
recurringQueue = new MockQueue('recurring');

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
    emailQueue?.close?.(),
    notificationQueue?.close?.(),
    balanceQueue?.close?.(),
    recurringQueue?.close?.(),
  ].filter(Boolean));
  console.log('Bull queues closed');
};

// Export queues
export { emailQueue, notificationQueue, balanceQueue, recurringQueue };

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
