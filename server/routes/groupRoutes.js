import express from 'express';
import {
  getGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
  getGroupBalances,
  generateInviteCode,
  joinGroupByInvite,
} from '../controllers/groupController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // All routes are protected

router.route('/')
  .get(getGroups)
  .post(createGroup);

router.post('/join/:inviteCode', joinGroupByInvite);

router.route('/:id')
  .get(getGroupById)
  .put(updateGroup)
  .delete(deleteGroup);

router.post('/:id/members', addMember);
router.delete('/:id/members/:memberId', removeMember);
router.get('/:id/balances', getGroupBalances);
router.post('/:id/invite-code', generateInviteCode);

export default router;
