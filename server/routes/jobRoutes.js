import express from 'express';
import {
  requireCronSecret,
  triggerDueReminders,
  triggerMonthlyDigest,
  triggerRecurringExpenses,
  triggerRecurringReminders,
  triggerWeeklyDigest,
} from '../controllers/jobController.js';
import { processOcrQueue } from '../controllers/ocrController.js';

const router = express.Router();

router.use(requireCronSecret);

router.post('/recurring-expenses', triggerRecurringExpenses);
router.post('/recurring-reminders', triggerRecurringReminders);
router.post('/weekly-digest', triggerWeeklyDigest);
router.post('/monthly-digest', triggerMonthlyDigest);
router.post('/due-reminders', triggerDueReminders);
router.post('/ocr/process', requireCronSecret, processOcrQueue);

export default router;