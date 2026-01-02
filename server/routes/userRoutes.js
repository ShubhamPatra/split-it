import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  getUserById,
  searchUsers,
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // All routes are protected

router.route('/profile')
  .get(getUserProfile)
  .put(updateUserProfile);

router.get('/search', searchUsers);
router.get('/:id', getUserById);

export default router;
