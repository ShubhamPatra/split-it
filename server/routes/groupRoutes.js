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
import { rateLimiter } from '../middleware/security.js';
import { auditMutation, captureBeforeState } from '../middleware/auditMiddleware.js';
import Group from '../models/Group.js';

const router = express.Router();

router.use(protect); // All routes are protected

// Rate limiting for group creation (10 per hour per user)
const groupCreateRateLimit = rateLimiter({
  max: 10,
  windowMs: 60 * 60 * 1000,
  message: 'Too many groups created. Please try again later.',
});

// Rate limiting for invite generation (20 per hour per user)
const inviteGenerateRateLimit = rateLimiter({
  max: 20,
  windowMs: 60 * 60 * 1000,
  message: 'Too many invite codes generated. Please try again later.',
});

router.route('/')
  .get(getGroups)
  .post(groupCreateRateLimit, auditMutation('group.create', 'Group'), createGroup);

// Get past collaborators (must be before /:id routes)
router.get('/collaborators', getCollaborators);

router.post('/join/:inviteCode', joinGroupByInvite);

router.route('/:id')
  .get(getGroupById)
  .put(captureBeforeState(Group), auditMutation('group.update', 'Group'), updateGroup)
  .delete(captureBeforeState(Group), auditMutation('group.delete', 'Group'), deleteGroup);

router.post('/:id/members', auditMutation('group.member.add', 'Group'), addMember);
router.delete('/:id/members/:memberId', auditMutation('group.member.remove', 'Group'), removeMember);
router.get('/:id/balances', getGroupBalances);
router.post('/:id/invite-code', inviteGenerateRateLimit, generateInviteCode);

// Role management routes (Comment 10)
router.get('/:id/roles', getMemberRoles);
router.put('/:id/roles/:memberId', captureBeforeState(Group), auditMutation('group.member.role.change', 'Group'), updateMemberRole);

// Budget management routes (Comment 4)
router.get('/:id/budget', getGroupBudget);
router.put('/:id/budget', captureBeforeState(Group), auditMutation('group.budget.update', 'Group'), updateGroupBudget);

export default router;
