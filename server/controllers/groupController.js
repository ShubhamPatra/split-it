import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import redis from '../config/redis.js';
import { emailQueue, notificationQueue } from '../config/queue.js';

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
      .populate('createdBy', 'name email')  // Remove upiId unless needed
      .populate('members', 'name email')
      .sort({ createdAt: -1 })
      .lean()  // Convert to plain JS objects (faster)
      .limit(50);  // Add pagination
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
    if (members) group.members = members;

    await group.save();

    const updatedGroup = await Group.findById(group._id)
      .populate('createdBy', 'name email upiId')
      .populate('members', 'name email upiId');

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

    // Delete associated expenses and settlements
    await Expense.deleteMany({ groupId: req.params.id });
    await Settlement.deleteMany({ groupId: req.params.id });

    await Group.findByIdAndDelete(req.params.id);

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
    });

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

    // Check Redis cache first
    const cacheKey = `balances:${req.params.id}`;
    let cached;
    try {
      cached = await redis.get(cacheKey);
    } catch (e) {
      console.error('Redis cache get failed:', e);
      cached = null;
    }
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Queue balance calculation job
    const { balanceQueue } = await import('../config/queue.js');
    const job = await balanceQueue.add(
      { groupId: req.params.id, userId: req.user._id },
      { priority: 1, attempts: 3 }
    );

    // Wait for job completion
    const result = await job.finished();
    
    // Redundant cache set for defensive programming
    try {
      await redis.setex(cacheKey, 300, JSON.stringify(result));
    } catch (e) {
      console.error('Redis cache set failed:', e);
    }
    
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

    // Enqueue email notification (Comment 2 & 12)
    if (creator?.email) {
      emailQueue.add({
        to: creator.email,
        subject: `New member joined ${group.name}`,
        html: `<p>Hi ${creator.name},</p><p>${req.user.name} has joined your group "${group.name}" via invite link.</p>`,
      }).catch(err => console.error('Email queue error:', err));
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

    // Only admins can change roles
    if (!requireAdmin(group, req.user._id)) {
      return res.status(403).json({ message: 'Only admins can modify member roles' });
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

    res.json({
      budget: group.budget,
      currentSpending,
      percentUsed: group.budget.monthlyLimit > 0 
        ? (currentSpending / group.budget.monthlyLimit) * 100 
        : 0,
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
    const { monthlyLimit, alertThreshold, currency, enabled } = req.body;

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

    await group.save();

    res.json({ success: true, budget: group.budget });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
