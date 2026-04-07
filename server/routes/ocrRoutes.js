import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/upload.js';
import { getOcrJobStatus, scanReceipt } from '../controllers/ocrController.js';

const router = express.Router();

router.post('/scan', authMiddleware, upload.single('receipt'), scanReceipt);
router.get('/jobs/:jobId', authMiddleware, getOcrJobStatus);

export default router;
