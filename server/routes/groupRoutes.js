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
  getMemberRoles,
  updateMemberRole,
  getGroupBudget,
  updateGroupBudget,
  getCollaborators,
} from '../controllers/groupController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // All routes are protected

router.route('/')
  .get(getGroups)
  .post(createGroup);

// Get past collaborators (must be before /:id routes)
router.get('/collaborators', getCollaborators);

router.post('/join/:inviteCode', joinGroupByInvite);

router.route('/:id')
  .get(getGroupById)
  .put(updateGroup)
  .delete(deleteGroup);

router.post('/:id/members', addMember);
router.delete('/:id/members/:memberId', removeMember);
router.get('/:id/balances', getGroupBalances);
router.post('/:id/invite-code', generateInviteCode);

// Role management routes (Comment 10)
router.get('/:id/roles', getMemberRoles);
router.put('/:id/roles/:memberId', updateMemberRole);

// Budget management routes (Comment 4)
router.get('/:id/budget', getGroupBudget);
router.put('/:id/budget', updateGroupBudget);

export default router;
