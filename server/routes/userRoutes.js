import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  getUserById,
  searchUsers,
  getEmailPreferences,
  updateEmailPreferences,
  getBudgetSettings,
  updateBudgetSettings,
  getUserSpending,
  deleteAccount,
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // All routes are protected

router.route('/profile')
  .get(getUserProfile)
  .put(updateUserProfile);

// Alias for /profile - mobile client compatibility
router.route('/me')
  .get(getUserProfile)
  .put(updateUserProfile);

// Email preferences routes
router.route('/email-preferences')
  .get(getEmailPreferences)
  .put(updateEmailPreferences);

// Budget settings routes
router.route('/budget-settings')
  .get(getBudgetSettings)
  .put(updateBudgetSettings);

// User spending and budget status
router.get('/spending', getUserSpending);

// Account deletion route (GDPR compliance)
router.delete('/account', deleteAccount);

router.get('/search', searchUsers);
router.get('/:id', getUserById);

export default router;
