import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { calculateGroupBalances } from '../jobs/balanceService.js';
import { invalidateGroupMembershipCache } from '../config/socket.js';
import crypto from 'crypto';

// Helper to generate ETag from data
const generateETag = (data) => {
  const hash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  return `"${hash}"`;
};

// Helper to check if user is admin (enforces server-side role check - Comment 10)
const requireAdmin = (group, userId) => {
  return group.isAdmin(userId);
};

// Helper to check if user is a member
const isMember = (group, userId) => {
  return group.members.some(m => m.toString() === userId.toString() || m._id?.toString() === userId.toString());
};

// @desc    Get all groups for user
// @route   GET /api/groups
// @access  Private
export const getGroups = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate('createdBy', 'name email upiId')
      .populate('members', 'name email upiId')
      .sort({ createdAt: -1 })
      .lean()  // Convert to plain JS objects (faster)
      .limit(50);  // Add pagination

    // Generate ETag for caching
    const etag = generateETag(groups);

    // Check If-None-Match header
    const clientETag = req.headers['if-none-match'];
    if (clientETag && clientETag === etag) {
      return res.status(304).end(); // Not Modified
    }

    // Set ETag header and send response
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minutes
    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single group
// @route   GET /api/groups/:id
// @access  Private
export const getGroupById = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('createdBy', 'name email upiId')
      .populate('members', 'name email upiId');

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    if (!group.members.some(member => member._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized to access this group' });
    }

    // Generate ETag for caching
    const etag = generateETag(group);

    // Check If-None-Match header
    const clientETag = req.headers['if-none-match'];
    if (clientETag && clientETag === etag) {
      return res.status(304).end(); // Not Modified
    }

    // Set ETag header and send response
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minutes
    res.json(group);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new group
// @route   POST /api/groups
// @access  Private
export const createGroup = async (req, res) => {
  try {
    const { name, members } = req.body;

    const group = await Group.create({
      name,
      createdBy: req.user._id,
      members: members || [req.user._id],
    });

    const populatedGroup = await Group.findById(group._id)
      .populate('createdBy', 'name email upiId')
      .populate('members', 'name email upiId');

    // Emit real-time event to all members (including creator) so they see the new group instantly
    const io = req.app.get('io');
    if (io) {
      try {
        const { emitToUser, emitToGroup } = await import('../utils/socketEmitter.js');

        // Emit to each member's user room so they receive the group even before joining the group room
        const memberIds = populatedGroup.members.map(m => m._id.toString());
        for (const memberId of memberIds) {
          emitToUser(io, memberId, 'group:created', populatedGroup);
        }

        // Also emit to the new group room for any listeners
        emitToGroup(io, group._id.toString(), 'group:updated', populatedGroup);
      } catch (socketError) {
        console.error('Error emitting group creation event:', socketError);
        // Don't fail the request if socket emission fails
      }
    }

    res.status(201).json(populatedGroup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update group
// @route   PUT /api/groups/:id
// @access  Private
export const updateGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is the creator
    if (group.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this group' });
    }

    const { name, members } = req.body;
    if (name) group.name = name;

    // Track member changes before updating
    const membersChanged = !!members;
    let addedMembers = [];
    let removedMembers = [];

    if (members) {
      const oldMemberIds = group.members.map(m => m.toString());
      const newMemberIds = members.map(m => m.toString());

      addedMembers = newMemberIds.filter(id => !oldMemberIds.includes(id));
      removedMembers = oldMemberIds.filter(id => !newMemberIds.includes(id));

      group.members = members;
    }

    await group.save();

    // Invalidate socket group membership cache if members were updated
    if (membersChanged) {
      invalidateGroupMembershipCache(group._id.toString());

      // Comment 1: Invalidate balance cache when members change
      const { invalidateBalanceCache } = await import('../jobs/balanceService.js');
      invalidateBalanceCache(group._id.toString());
    }

    const updatedGroup = await Group.findById(group._id)
      .populate('createdBy', 'name email upiId')
      .populate('members', 'name email upiId');

    // Emit socket event to group members
    const io = req.app.get('io');
    if (io) {
      try {
        const { emitToGroup, emitToUser, emitBalanceUpdate } = await import('../utils/socketEmitter.js');
        emitToGroup(io, group._id.toString(), 'group:updated', updatedGroup);
        // Emit alias event for contract alignment
        emitToGroup(io, group._id.toString(), 'group:update', updatedGroup);

        // Notify about added members
        for (const memberId of addedMembers) {
          const memberData = updatedGroup.members.find(m => m._id.toString() === memberId);
          if (memberData) {
            // Emit to the new member's user room so they receive the group
            emitToUser(io, memberId, 'group:created', updatedGroup);

            // Emit member joined event to group room
            emitToGroup(io, group._id.toString(), 'group:memberJoined', {
              groupId: group._id.toString(),
              member: memberData
            });
            // Comment 3: Emit aliased event for contract alignment
            emitToGroup(io, group._id.toString(), 'group:join', {
              groupId: group._id.toString(),
              member: memberData
            });
          }
        }

        // Notify about removed members
        for (const memberId of removedMembers) {
          // Force the removed member's sockets to leave the group room BEFORE emitting group-room events
          // so they don't receive broadcasts intended for remaining members
          const { forceLeaveGroupRoom } = await import('../utils/socketEmitter.js');
          await forceLeaveGroupRoom(io, memberId, group._id.toString());

          // Emit member removed event to group room (removed member won't receive this)
          emitToGroup(io, group._id.toString(), 'group:memberRemoved', {
            groupId: group._id.toString(),
            memberId
          });
          // Comment 3: Emit aliased event for contract alignment
          emitToGroup(io, group._id.toString(), 'group:leave', {
            groupId: group._id.toString(),
            memberId
          });

          // Notify the removed member via their user room so they still receive the removal notice
          emitToUser(io, memberId, 'group:memberRemoved', {
            groupId: group._id.toString(),
            memberId
          });
        }

        // Comment 1: Recalculate and emit fresh balances after member changes
        if (membersChanged) {
          try {
            const result = await calculateGroupBalances(group._id.toString());
            emitBalanceUpdate(io, group._id.toString(), result.balances);
            // Comment 3: Also emit balance:update to each newly added member's user room
            for (const newMemberId of addedMembers) {
              emitToUser(io, newMemberId, 'balance:update', { groupId: group._id.toString(), balances: result.balances });
            }
          } catch (balanceError) {
            console.error('Error emitting balance update for group update:', balanceError);
          }
        }
      } catch (socketError) {
        console.error('Error emitting group update event:', socketError);
        // Don't fail the request if socket emission fails
      }
    }

    res.json(updatedGroup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete group
// @route   DELETE /api/groups/:id
// @access  Private
export const deleteGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is the creator
    if (group.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this group' });
    }

    // Invalidate socket group membership cache before deletion
    invalidateGroupMembershipCache(req.params.id);

    // Store member IDs before deletion for socket notifications
    const memberIds = group.members.map(m => m.toString());

    // Delete associated expenses and settlements
    await Expense.deleteMany({ groupId: req.params.id });
    await Settlement.deleteMany({ groupId: req.params.id });

    await Group.findByIdAndDelete(req.params.id);

    // Emit socket event to notify all members about group deletion
    const io = req.app.get('io');
    if (io) {
      try {
        const { emitToGroup, emitToUser } = await import('../utils/socketEmitter.js');

        // Emit to group room (for members currently viewing the group)
        emitToGroup(io, req.params.id, 'group:deleted', { groupId: req.params.id });

        // Also emit to each member's user room so dashboards update even if they haven't joined the group room
        for (const memberId of memberIds) {
          emitToUser(io, memberId, 'group:deleted', { groupId: req.params.id });
        }

        // Force all members' sockets to leave the deleted group room
        const { forceLeaveGroupRoom } = await import('../utils/socketEmitter.js');
        for (const memberId of memberIds) {
          await forceLeaveGroupRoom(io, memberId, req.params.id);
        }
      } catch (socketError) {
        console.error('Error emitting group deletion event:', socketError);
        // Don't fail the request if socket emission fails
      }
    }

    res.json({ message: 'Group deleted successfully', success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add member to group
// @route   POST /api/groups/:id/members
// @access  Private (creator/admin only)
export const addMember = async (req, res) => {
  try {
    const { memberId } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only the group creator (admin) can add members
    if (group.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the group creator can add members' });
    }

    // Check if member already exists
    if (group.members.includes(memberId)) {
      return res.status(400).json({ message: 'Member already in group' });
    }

    group.members.push(memberId);
    await group.save();

    const updatedGroup = await Group.findById(group._id)
      .populate('createdBy', 'name email upiId')
      .populate('members', 'name email upiId');

    // Create notification for the new member
    await Notification.create({
      userId: memberId,
      type: 'info',
      title: 'Added to Group',
      message: `${req.user.name} added you to the group "${group.name}"`,
      actionType: 'navigate',
      data: { url: `/groups/${req.params.id}` },
    });

    // Invalidate socket group membership cache
    invalidateGroupMembershipCache(req.params.id);

    // Comment 1: Invalidate balance cache and emit fresh balances
    const { invalidateBalanceCache } = await import('../jobs/balanceService.js');
    invalidateBalanceCache(req.params.id);

    // Emit socket event to group members
    const io = req.app.get('io');
    if (io) {
      try {
        const { emitToGroup, emitToUser, emitBalanceUpdate } = await import('../utils/socketEmitter.js');
        const memberData = updatedGroup.members.find(m => m._id.toString() === memberId.toString());

        // Emit to the new member's user room so they receive the group before joining the group room
        emitToUser(io, memberId, 'group:created', updatedGroup);

        emitToGroup(io, req.params.id, 'group:memberJoined', {
          groupId: req.params.id,
          member: memberData
        });
        // Comment 3: Emit aliased event for contract alignment
        emitToGroup(io, req.params.id, 'group:join', {
          groupId: req.params.id,
          member: memberData
        });
        emitToGroup(io, req.params.id, 'group:updated', updatedGroup);
        // Comment 3: Emit group:update alias for contract alignment
        emitToGroup(io, req.params.id, 'group:update', updatedGroup);

        // Comment 1: Recalculate and emit fresh balances after member addition
        try {
          const result = await calculateGroupBalances(req.params.id);
          emitBalanceUpdate(io, req.params.id, result.balances);
          // Comment 3: Also emit balance:update to the new member's user room so they receive initial balance state
          emitToUser(io, memberId, 'balance:update', { groupId: req.params.id, balances: result.balances });
        } catch (balanceError) {
          console.error('Error emitting balance update for member addition:', balanceError);
        }
      } catch (socketError) {
        console.error('Error emitting member join event:', socketError);
        // Don't fail the request if socket emission fails
      }
    }

    res.json(updatedGroup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove member from group
// @route   DELETE /api/groups/:id/members/:memberId
// @access  Private
export const removeMember = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is the creator
    if (group.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Cannot remove the creator
    if (req.params.memberId === group.createdBy.toString()) {
      return res.status(400).json({ message: 'Cannot remove the creator' });
    }

    group.members = group.members.filter(m => m.toString() !== req.params.memberId);
    await group.save();

    const updatedGroup = await Group.findById(group._id)
      .populate('createdBy', 'name email upiId')
      .populate('members', 'name email upiId');

    // Invalidate socket group membership cache
    invalidateGroupMembershipCache(req.params.id);

    // Comment 1: Invalidate balance cache and emit fresh balances
    const { invalidateBalanceCache } = await import('../jobs/balanceService.js');
    invalidateBalanceCache(req.params.id);

    // Emit socket event to group members
    const io = req.app.get('io');
    if (io) {
      try {
        const { emitToGroup, emitToUser, emitBalanceUpdate, forceLeaveGroupRoom } = await import('../utils/socketEmitter.js');

        // Force the removed member's sockets to leave the group room BEFORE emitting group-room events
        // so they don't receive broadcasts intended for remaining members
        await forceLeaveGroupRoom(io, req.params.memberId, req.params.id);

        emitToGroup(io, req.params.id, 'group:memberRemoved', {
          groupId: req.params.id,
          memberId: req.params.memberId
        });
        // Comment 3: Emit aliased event for contract alignment
        emitToGroup(io, req.params.id, 'group:leave', {
          groupId: req.params.id,
          memberId: req.params.memberId
        });
        emitToGroup(io, req.params.id, 'group:updated', updatedGroup);
        // Comment 3: Emit group:update alias for contract alignment
        emitToGroup(io, req.params.id, 'group:update', updatedGroup);

        // Notify the removed member via their user room so they still receive the removal notice
        emitToUser(io, req.params.memberId, 'group:memberRemoved', {
          groupId: req.params.id,
          memberId: req.params.memberId
        });

        // Comment 1: Recalculate and emit fresh balances after member removal
        try {
          const result = await calculateGroupBalances(req.params.id);
          emitBalanceUpdate(io, req.params.id, result.balances);
        } catch (balanceError) {
          console.error('Error emitting balance update for member removal:', balanceError);
        }
      } catch (socketError) {
        console.error('Error emitting member removal event:', socketError);
        // Don't fail the request if socket emission fails
      }
    }

    res.json(updatedGroup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get group balances
// @route   GET /api/groups/:id/balances
// @access  Private
export const getGroupBalances = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    if (!group.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Use the in-memory cached balance service
    const result = await calculateGroupBalances(req.params.id);

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Generate invite code for group
// @route   POST /api/groups/:id/invite-code
// @access  Private
export const generateInviteCode = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    if (!group.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Generate new invite code
    let isUnique = false;
    let inviteCode;

    while (!isUnique) {
      inviteCode = group.generateInviteCode();
      const existing = await Group.findOne({ inviteCode, _id: { $ne: group._id } });
      if (!existing) {
        isUnique = true;
      }
    }

    await group.save();

    res.json({ inviteCode: group.inviteCode });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Join group via invite code
// @route   POST /api/groups/join/:inviteCode
// @access  Private
export const joinGroupByInvite = async (req, res) => {
  try {
    const group = await Group.findOne({ inviteCode: req.params.inviteCode });

    if (!group) {
      return res.status(404).json({ message: 'Invalid invite code' });
    }

    // Check if user is already a member
    if (group.members.includes(req.user._id)) {
      return res.status(400).json({ message: 'You are already a member of this group' });
    }

    // Add user to group
    group.members.push(req.user._id);
    await group.save();

    const updatedGroup = await Group.findById(group._id)
      .populate('createdBy', 'name email upiId')
      .populate('members', 'name email upiId');

    // Create notification for existing members
    const creator = await User.findById(group.createdBy);
    await Notification.create({
      userId: group.createdBy,
      type: 'info',
      title: 'New Member Joined',
      message: `${req.user.name} joined the group "${group.name}" via invite link`,
    });

    // Invalidate socket group membership cache
    invalidateGroupMembershipCache(group._id.toString());

    // Comment 1: Invalidate balance cache and emit fresh balances
    const { invalidateBalanceCache } = await import('../jobs/balanceService.js');
    invalidateBalanceCache(group._id.toString());

    // Emit socket event to group members
    const io = req.app.get('io');
    if (io) {
      try {
        const { emitToGroup, emitToUser, emitBalanceUpdate } = await import('../utils/socketEmitter.js');
        const memberData = updatedGroup.members.find(m => m._id.toString() === req.user._id.toString());

        // Emit to the joining user's room so they see the new group in real time
        emitToUser(io, req.user._id.toString(), 'group:created', updatedGroup);

        emitToGroup(io, group._id.toString(), 'group:memberJoined', {
          groupId: group._id.toString(),
          member: memberData
        });
        // Comment 3: Emit aliased event for contract alignment
        emitToGroup(io, group._id.toString(), 'group:join', {
          groupId: group._id.toString(),
          member: memberData
        });
        emitToGroup(io, group._id.toString(), 'group:updated', updatedGroup);
        // Comment 3: Emit group:update alias for contract alignment
        emitToGroup(io, group._id.toString(), 'group:update', updatedGroup);

        // Comment 1: Recalculate and emit fresh balances after member joins via invite
        try {
          const result = await calculateGroupBalances(group._id.toString());
          emitBalanceUpdate(io, group._id.toString(), result.balances);
          // Comment 3: Also emit balance:update to the joining user's room so they receive initial balance state
          emitToUser(io, req.user._id.toString(), 'balance:update', { groupId: group._id.toString(), balances: result.balances });
        } catch (balanceError) {
          console.error('Error emitting balance update for invite join:', balanceError);
        }
      } catch (socketError) {
        console.error('Error emitting invite join event:', socketError);
        // Don't fail the request if socket emission fails
      }
    }

    res.json(updatedGroup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get member roles for a group
// @route   GET /api/groups/:id/roles
// @access  Private (Comment 10)
export const getMemberRoles = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    if (!isMember(group, req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Build roles object
    const roles = {};
    for (const memberId of group.members) {
      roles[memberId.toString()] = group.getMemberRole(memberId);
    }

    res.json({ roles, createdBy: group.createdBy });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update member role
// @route   PUT /api/groups/:id/roles/:memberId
// @access  Private (Admin only - Comment 10)
export const updateMemberRole = async (req, res) => {
  try {
    const { role } = req.body;
    const { id: groupId, memberId } = req.params;

    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be "admin" or "member"' });
    }

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only the creator can change roles
    if (group.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the group creator can modify member roles' });
    }

    // Cannot change creator's role
    if (memberId === group.createdBy.toString()) {
      return res.status(400).json({ message: 'Cannot change the creator\'s role' });
    }

    // Check if member exists in group
    if (!isMember(group, memberId)) {
      return res.status(400).json({ message: 'User is not a member of this group' });
    }

    group.setMemberRole(memberId, role);
    await group.save();

    // Notify the member about role change
    await Notification.create({
      userId: memberId,
      type: 'info',
      title: role === 'admin' ? 'You are now an admin' : 'Role changed',
      message: `Your role in "${group.name}" has been changed to ${role} by ${req.user.name}`,
    });

    res.json({ success: true, role });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get group budget settings
// @route   GET /api/groups/:id/budget
// @access  Private (Comment 4)
export const getGroupBudget = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    if (!isMember(group, req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Calculate current month spending
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const expenses = await Expense.find({
      groupId: group._id,
      date: { $gte: startOfMonth },
    });

    const currentSpending = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Calculate spending per category
    const categorySpending = {};
    expenses.forEach(expense => {
      const category = expense.category || 'other';
      categorySpending[category] = (categorySpending[category] || 0) + expense.amount;
    });

    // Calculate category budget status
    const categoryBudgetStatus = {};
    // Guard against null/undefined categoryLimits
    if (group.budget?.categoryLimits && typeof group.budget.categoryLimits.forEach === 'function') {
      group.budget.categoryLimits.forEach((limitData, categoryId) => {
        const spent = categorySpending[categoryId] || 0;
        const limit = limitData.limit || 0;
        const percentUsed = limit > 0 ? (spent / limit) * 100 : 0;
        const threshold = limitData.alertThreshold || 80;

        categoryBudgetStatus[categoryId] = {
          limit,
          spent,
          remaining: Math.max(0, limit - spent),
          percentUsed,
          alertThreshold: threshold,
          isOverBudget: limit > 0 && spent > limit,
          isNearLimit: limit > 0 && percentUsed >= threshold && percentUsed <= 100,
        };
      });
    }

    res.json({
      budget: group.budget,
      currentSpending,
      percentUsed: group.budget.monthlyLimit > 0
        ? (currentSpending / group.budget.monthlyLimit) * 100
        : 0,
      categorySpending,
      categoryBudgetStatus,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get past collaborators from all user's groups
// @route   GET /api/groups/collaborators
// @access  Private
export const getCollaborators = async (req, res) => {
  try {
    // Find all groups where user is a member
    const groups = await Group.find({ members: req.user._id })
      .populate('members', 'name email')
      .select('name members')
      .lean();

    // Build collaborator map with mutual group tracking
    const collaboratorMap = new Map();

    for (const group of groups) {
      for (const member of group.members) {
        // Skip current user
        if (member._id.toString() === req.user._id.toString()) continue;

        const memberId = member._id.toString();
        if (collaboratorMap.has(memberId)) {
          const existing = collaboratorMap.get(memberId);
          existing.mutualGroups.push(group.name);
          existing.collaborationCount++;
        } else {
          collaboratorMap.set(memberId, {
            id: member._id,
            name: member.name,
            email: member.email,
            mutualGroups: [group.name],
            collaborationCount: 1,
          });
        }
      }
    }

    // Convert to array and sort by collaboration frequency
    const collaborators = Array.from(collaboratorMap.values())
      .sort((a, b) => b.collaborationCount - a.collaborationCount);

    res.json({ collaborators });
  } catch (error) {
    console.error('Get collaborators error:', error);
    res.status(500).json({ message: 'Failed to fetch collaborators' });
  }
};

// @desc    Update group budget settings
// @route   PUT /api/groups/:id/budget
// @access  Private (Admin only - Comment 4)
export const updateGroupBudget = async (req, res) => {
  try {
    const { monthlyLimit, alertThreshold, currency, enabled, categoryLimits } = req.body;

    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Only admins can update budget
    if (!requireAdmin(group, req.user._id)) {
      return res.status(403).json({ message: 'Only admins can modify budget settings' });
    }

    // Validate inputs
    if (monthlyLimit !== undefined) {
      if (typeof monthlyLimit !== 'number' || monthlyLimit < 0) {
        return res.status(400).json({ message: 'Monthly limit must be a non-negative number' });
      }
      group.budget.monthlyLimit = monthlyLimit;
    }

    if (alertThreshold !== undefined) {
      if (typeof alertThreshold !== 'number' || alertThreshold < 0 || alertThreshold > 100) {
        return res.status(400).json({ message: 'Alert threshold must be between 0 and 100' });
      }
      group.budget.alertThreshold = alertThreshold;
    }

    if (currency !== undefined) {
      group.budget.currency = currency;
    }

    if (enabled !== undefined) {
      group.budget.enabled = enabled;
    }

    // Handle category limits update
    if (categoryLimits !== undefined) {
      // Validate category limits structure
      if (typeof categoryLimits !== 'object') {
        return res.status(400).json({ message: 'Category limits must be an object' });
      }

      // Clear existing category limits if provided as empty object
      if (Object.keys(categoryLimits).length === 0) {
        group.budget.categoryLimits = new Map();
      } else {
        // Update category limits
        for (const [categoryId, limitData] of Object.entries(categoryLimits)) {
          if (limitData === null) {
            // Remove category limit
            group.removeCategoryLimit(categoryId);
          } else {
            // Validate limit data
            const limit = limitData.limit !== undefined ? limitData.limit : 0;
            const threshold = limitData.alertThreshold !== undefined ? limitData.alertThreshold : 80;

            if (typeof limit !== 'number' || limit < 0) {
              return res.status(400).json({
                message: `Category limit for ${categoryId} must be a non-negative number`
              });
            }

            if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
              return res.status(400).json({
                message: `Alert threshold for ${categoryId} must be between 0 and 100`
              });
            }

            // Set category limit
            group.setCategoryLimit(categoryId, limit, threshold);
          }
        }
      }
    }

    await group.save();

    // Emit socket event to group members
    const io = req.app.get('io');
    if (io) {
      try {
        const { emitToGroup } = await import('../utils/socketEmitter.js');
        emitToGroup(io, req.params.id, 'group:budgetUpdated', {
          groupId: req.params.id,
          budget: group.budget
        });

        // Populate group for full update events
        const updatedGroup = await Group.findById(req.params.id)
          .populate('createdBy', 'name email upiId')
          .populate('members', 'name email upiId');

        // Emit group:updated so generic group-update listeners stay in sync
        emitToGroup(io, req.params.id, 'group:updated', updatedGroup);
        // Emit group:update alias for contract alignment
        emitToGroup(io, req.params.id, 'group:update', updatedGroup);
      } catch (socketError) {
        console.error('Error emitting budget update event:', socketError);
        // Don't fail the request if socket emission fails
      }
    }

    res.json({ success: true, budget: group.budget });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
