/**
 * Debug Portal Routes
 * 
 * All routes are protected by multi-layer security middleware.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  validateCredentials,
  debugRateLimiter,
  logAccessMiddleware,
} from './debug.middleware.js';
import {
  getHealth,
  getLogs,
  getErrors,
  getPM2Logs,
  getSystemInfo,
  getConfigStatus,
  getAccessLog,
  handleTestEmail,
  handleTestSocket,
  handleTestDatabase,
  handleTestNotification,
  handleTestAll,
  handleTriggerJob,
} from './debug.controller.js';

const router = express.Router();

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve dashboard HTML at root (no auth required - login form needs to load)
// The dashboard itself handles authentication via API calls with headers
router.get('/', (req, res) => {
  // Check if debug portal is enabled (basic gate without requiring credentials)
  if (process.env.DEBUG_ENABLED !== 'true') {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Apply security middleware to all API routes (everything except /)
router.use(validateCredentials);
router.use(debugRateLimiter);
router.use(logAccessMiddleware);

// Health and monitoring
router.get('/health', getHealth);
router.get('/logs', getLogs);
router.get('/logs/errors', getErrors);
router.get('/logs/pm2', getPM2Logs);
router.get('/system', getSystemInfo);
router.get('/config', getConfigStatus);
router.get('/access-log', getAccessLog);

// Test actions
router.post('/test/email', handleTestEmail);
router.post('/test/socket', handleTestSocket);
router.post('/test/database', handleTestDatabase);
router.post('/test/notification', handleTestNotification);
router.post('/test/all', handleTestAll);

// Job management
router.post('/trigger-job/:jobName', handleTriggerJob);

export default router;
