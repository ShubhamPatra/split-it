module.exports = {
  apps: [{
    name: 'split-it-api',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }, {
    name: 'balance-worker',
    script: './workers/balanceWorker.js',
    instances: 2,
  }, {
    name: 'notification-worker',
    script: './workers/notificationWorker.js',
    instances: 2,
  }, {
    name: 'email-worker',
    script: './workers/emailWorker.js',
    instances: 1,
  }, {
    name: 'recurring-expense-worker',
    script: './workers/recurringExpenseWorker.js',
    instances: 1, // Only one instance to avoid duplicate processing
    env: {
      NODE_ENV: 'production',
    },
    error_file: './logs/recurring-expense-err.log',
    out_file: './logs/recurring-expense-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    cron_restart: '0 */6 * * *', // Restart every 6 hours for health
  }],
};
