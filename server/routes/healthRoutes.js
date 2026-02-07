import express from 'express';
import { healthCheck, readinessCheck, systemInfo } from '../controllers/healthController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Health Check Routes
 * 
 * These routes are used by load balancers, orchestrators, and monitoring
 * systems to determine the health and readiness of the service.
 */

// Basic liveness check - always returns 200 if server is running
// Used by load balancers to determine if instance should receive traffic
router.get('/health', healthCheck);

// Readiness check - checks database and other dependencies
// Used by orchestrators (Kubernetes, etc.) to determine readiness
router.get('/ready', readinessCheck);

// Detailed system information - requires authentication
// Used for monitoring and debugging
router.get('/health/info', protect, systemInfo);

export default router;
