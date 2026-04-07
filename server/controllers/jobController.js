import { executeJobSafe } from '../jobs/jobRunner.js';
import { processRecurringExpenses, sendRecurringExpenseReminders } from '../jobs/recurringExpenseJob.js';
import { processWeeklyDigest, processMonthlyDigest } from '../jobs/digestJob.js';
import { processDueReminders } from '../jobs/dueReminderJob.js';

const JOBS = {
  'recurring-expenses': {
    handler: processRecurringExpenses,
    timeout: null,
  },
  'recurring-reminders': {
    handler: sendRecurringExpenseReminders,
    timeout: 5 * 60 * 1000,
  },
  'weekly-digest': {
    handler: processWeeklyDigest,
    timeout: null,
  },
  'monthly-digest': {
    handler: processMonthlyDigest,
    timeout: null,
  },
  'due-reminders': {
    handler: processDueReminders,
    timeout: null,
  },
};

const requireCronSecret = (req, res, next) => {
  const configuredSecret = process.env.CRON_SECRET;

  if (!configuredSecret) {
    return next();
  }

  const incomingSecret = req.header('x-cron-secret') || req.query.secret;
  if (incomingSecret !== configuredSecret) {
    return res.status(401).json({ message: 'Unauthorized cron trigger' });
  }

  return next();
};

const runJob = async (jobName, req, res) => {
  const job = JOBS[jobName];

  if (!job) {
    return res.status(404).json({ message: `Unknown job: ${jobName}` });
  }

  const result = await executeJobSafe(jobName, job.handler, null, {
    timeout: job.timeout,
    maxRetries: 1,
  });

  return res.json({
    jobName,
    ...result,
  });
};

export const triggerRecurringExpenses = (req, res) => runJob('recurring-expenses', req, res);
export const triggerRecurringReminders = (req, res) => runJob('recurring-reminders', req, res);
export const triggerWeeklyDigest = (req, res) => runJob('weekly-digest', req, res);
export const triggerMonthlyDigest = (req, res) => runJob('monthly-digest', req, res);
export const triggerDueReminders = (req, res) => runJob('due-reminders', req, res);

export { requireCronSecret };