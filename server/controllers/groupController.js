import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

// @desc    Get all groups for user
// @route   GET /api/groups
// @access  Private
export const getGroups = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate('createdBy', 'name email upiId')
      .populate('members', 'name email upiId')
      .sort({ createdAt: -1 });
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
// @access  Private
export const addMember = async (req, res) => {
  try {
    const { memberId } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    if (!group.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
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

    const expenses = await Expense.find({ groupId: req.params.id });
    const settlements = await Settlement.find({ groupId: req.params.id });

    // Calculate balances
    const balances = {};
    group.members.forEach(memberId => {
      balances[memberId.toString()] = 0;
    });

    // Process expenses
    expenses.forEach(expense => {
      const paidById = expense.paidBy.toString();
      balances[paidById] = (balances[paidById] || 0) + expense.amount;

      const shares = expense.splitConfig?.shares || {};
      for (const [memberId, amount] of shares.entries()) {
        balances[memberId] = (balances[memberId] || 0) - amount;
      }
    });

    // Process settlements
    settlements.forEach(settlement => {
      const fromId = settlement.fromUserId.toString();
      const toId = settlement.toUserId.toString();
      balances[fromId] = (balances[fromId] || 0) + settlement.amount;
      balances[toId] = (balances[toId] || 0) - settlement.amount;
    });

    res.json(balances);
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

    res.json(updatedGroup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
