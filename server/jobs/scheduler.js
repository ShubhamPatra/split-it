/**
 * Cron Scheduler
 * 
 * Initializes and manages all scheduled cron jobs for the application.
 * Uses node-cron for scheduling instead of Redis/BullMQ.
 * All jobs are wrapped with jobRunner for timeout/retry isolation.
 */

import cron from 'node-cron';
import { processRecurringExpenses, sendRecurringExpenseReminders } from './recurringExpenseJob.js';
import { processWeeklyDigest, processMonthlyDigest } from './digestJob.js';
import { processDueReminders } from './dueReminderJob.js';
import { executeJob } from './jobRunner.js';

// Debug log helper (lazy loaded)
const logJobEvt = async (jobName, status, data = {}) => {
  if (process.env.DEBUG_ENABLED === 'true') {
    try {
      const { logJobEvent } = await import('../internal/debug/logCollector.js');
      logJobEvent(jobName, status, data);
    } catch (e) {
      // Debug portal not available, ignore
    }
  }
};

// Store all cron jobs for cleanup
let cronJobs = [];
let isInitialized = false;

// Job state tracking: prevents overlap and tracks execution time
const jobStates = new Map(); // jobName -> { isRunning: boolean, startedAt: Date | null }

// Job-specific timeout configurations (in ms)
// Set to null to disable timeout (relies on mutex guard + MAX_RUNTIME_MS stuck detection)
const JOB_TIMEOUTS = {
    'recurring-expenses': null,      // Long-running batch job, has mutex guard
    'recurring-reminders': 5 * 60 * 1000,     // 5 minutes
    'weekly-digest': null,           // Long-running batch job, has mutex guard
    'monthly-digest': null,          // Long-running batch job, has mutex guard
    'due-reminders': null,           // Long-running batch job, has mutex guard
};

// Maximum runtime before force-skip (job considered stuck)
const MAX_RUNTIME_MS = 15 * 60 * 1000; // 15 minutes

// Default job execution options
const DEFAULT_JOB_OPTIONS = {
    maxRetries: 3,
    timeout: 30000, // 30 seconds (used for non-batch jobs)
};

/**
 * Wrap job execution with jobRunner for timeout/retry isolation
 * Also checks if job is already running and skips if so
 * @param {string} jobName - Name of the job for logging
 * @param {Function} handler - Async function to execute
 * @param {Object} options - Optional execution options (maxRetries, timeout)
 */
const executeScheduledJob = async (jobName, handler, options = {}) => {
    // Check if job is already running
    const state = jobStates.get(jobName) || { isRunning: false, startedAt: null };

    if (state.isRunning) {
        const runtime = state.startedAt ? Date.now() - state.startedAt.getTime() : 0;

        if (runtime > MAX_RUNTIME_MS) {
            console.warn(`[Scheduler] ${jobName} exceeded max runtime (${Math.round(runtime / 1000)}s), resetting state`);
            // Reset stuck job state
            jobStates.set(jobName, { isRunning: false, startedAt: null });
        } else {
            console.log(`[Scheduler] Skipping ${jobName}: previous run still active (${Math.round(runtime / 1000)}s)`);
            return { success: false, skipped: true, reason: 'already_running' };
        }
    }

    // Mark job as running
    jobStates.set(jobName, { isRunning: true, startedAt: new Date() });

    console.log(`[Scheduler] Starting: ${jobName}`);
    logJobEvt(jobName, 'started');

    // Get job-specific timeout or use default
    const timeout = JOB_TIMEOUTS[jobName] || 5 * 60 * 1000; // Default to 5 minutes if not specified
    const jobOptions = { maxRetries: 3, timeout, ...options };

    try {
        const result = await executeJob(jobName, handler, undefined, jobOptions);

        if (result.success) {
            console.log(`[Scheduler] Completed: ${jobName} in ${result.duration}ms`, result.data);
            logJobEvt(jobName, 'completed', { duration: result.duration });
        } else {
            console.error(`[Scheduler] Failed: ${jobName} after ${result.duration}ms (${result.attempt} attempts):`, result.error);
            logJobEvt(jobName, 'failed', { duration: result.duration, error: result.error, attempts: result.attempt });
        }

        return result;
    } finally {
        // Always mark job as not running when done
        jobStates.set(jobName, { isRunning: false, startedAt: null });
    }
};

/**
 * Initialize all cron jobs
 * Should be called after MongoDB connection is established
 */
export const initializeScheduler = () => {
    if (isInitialized) {
        console.log('[Scheduler] Already initialized, skipping...');
        return;
    }

    console.log('[Scheduler] Initializing cron scheduler...');

    // Initialize job states
    Object.keys(JOB_TIMEOUTS).forEach(jobName => {
        jobStates.set(jobName, { isRunning: false, startedAt: null });
    });

    // ============================================
    // RECURRING EXPENSES
    // ============================================

    // Process recurring expenses - Every hour at minute 0
    const recurringExpenseJob = cron.schedule('0 * * * *', () => {
        executeScheduledJob('recurring-expenses', processRecurringExpenses);
    }, { scheduled: true });
    cronJobs.push({ name: 'recurring-expenses', job: recurringExpenseJob });
    console.log('[Scheduler] Scheduled: Recurring expenses (hourly at :00)');

    // Send recurring expense reminders - Daily at 9:00 AM
    const recurringReminderJob = cron.schedule('0 9 * * *', () => {
        executeScheduledJob('recurring-reminders', sendRecurringExpenseReminders);
    }, { scheduled: true });
    cronJobs.push({ name: 'recurring-reminders', job: recurringReminderJob });
    console.log('[Scheduler] Scheduled: Recurring expense reminders (daily 9:00 AM)');

    // ============================================
    // DIGESTS
    // ============================================

    // Weekly digest - Monday at 9:00 AM
    const weeklyDigestJob = cron.schedule('0 9 * * 1', () => {
        executeScheduledJob('weekly-digest', processWeeklyDigest);
    }, { scheduled: true });
    cronJobs.push({ name: 'weekly-digest', job: weeklyDigestJob });
    console.log('[Scheduler] Scheduled: Weekly digest (Monday 9:00 AM)');

    // Monthly digest - 1st of month at 9:00 AM
    const monthlyDigestJob = cron.schedule('0 9 1 * *', () => {
        executeScheduledJob('monthly-digest', processMonthlyDigest);
    }, { scheduled: true });
    cronJobs.push({ name: 'monthly-digest', job: monthlyDigestJob });
    console.log('[Scheduler] Scheduled: Monthly digest (1st of month 9:00 AM)');

    // ============================================
    // DUE REMINDERS
    // ============================================

    // Due reminders - Daily at 10:00 AM
    const dueReminderJob = cron.schedule('0 10 * * *', () => {
        executeScheduledJob('due-reminders', processDueReminders);
    }, { scheduled: true });
    cronJobs.push({ name: 'due-reminders', job: dueReminderJob });
    console.log('[Scheduler] Scheduled: Due reminders (daily 10:00 AM)');

    isInitialized = true;
    console.log(`[Scheduler] Initialized with ${cronJobs.length} scheduled jobs`);
};

/**
 * Stop all cron jobs
 * Should be called during graceful shutdown
 */
export const stopScheduler = () => {
    console.log('[Scheduler] Stopping all cron jobs...');

    for (const { name, job } of cronJobs) {
        try {
            job.stop();
            console.log(`[Scheduler] Stopped: ${name}`);
        } catch (error) {
            console.error(`[Scheduler] Error stopping ${name}:`, error.message);
        }
    }

    cronJobs = [];
    isInitialized = false;
    console.log('[Scheduler] All cron jobs stopped');
};

/**
 * Get status of all scheduled jobs
 * @returns {Array} Array of job status objects
 */
export const getSchedulerStatus = () => {
    return cronJobs.map(({ name, job }) => ({
        name,
        running: job.running || false,
    }));
};

/**
 * Manually trigger a specific job (for testing/admin purposes)
 * @param {string} jobName - Name of the job to trigger
 * @returns {Promise<Object>} Result of the job execution
 */
export const triggerJob = async (jobName) => {
    const handlers = {
        'recurring-expenses': processRecurringExpenses,
        'recurring-reminders': sendRecurringExpenseReminders,
        'weekly-digest': processWeeklyDigest,
        'monthly-digest': processMonthlyDigest,
        'due-reminders': processDueReminders,
    };

    const handler = handlers[jobName];
    if (!handler) {
        throw new Error(`Unknown job: ${jobName}. Available: ${Object.keys(handlers).join(', ')}`);
    }

    console.log(`[Scheduler] Manually triggering: ${jobName}`);

    // Use executeJob for consistent timeout/retry behavior
    const result = await executeJob(jobName, handler, undefined, DEFAULT_JOB_OPTIONS);

    if (result.success) {
        console.log(`[Scheduler] Manual trigger completed: ${jobName} in ${result.duration}ms`);
    } else {
        console.error(`[Scheduler] Manual trigger failed: ${jobName} after ${result.duration}ms:`, result.error);
    }

    return result;
};

export default {
    initializeScheduler,
    stopScheduler,
    getSchedulerStatus,
    triggerJob,
};
