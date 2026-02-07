/**
 * Settlement Helper Functions
 * 
 * Utilities for handling settlement edge cases and validation.
 */

import Group from '../models/Group.js';
import User from '../models/User.js';

/**
 * Validate settlement participants and groups
 * @param {Object} params - Validation parameters
 * @returns {Promise<Object>} Validation result
 */
export const validateSettlementParticipants = async ({ fromUserId, toUserId, groupIds }) => {
  const issues = [];
  const warnings = [];

  // Check if users exist
  const users = await User.find({ _id: { $in: [fromUserId, toUserId] } })
    .select('_id name email')
    .lean();

  if (users.length < 2) {
    const missingUser = users.length === 0 ? 'both users' : 
      users[0]._id.toString() === fromUserId.toString() ? 'receiver' : 'payer';
    issues.push(`Settlement involves deleted user: ${missingUser}`);
  }

  // Check if groups exist
  const groups = await Group.find({ _id: { $in: groupIds } })
    .select('_id name members budget')
    .lean();

  if (groups.length < groupIds.length) {
    const deletedCount = groupIds.length - groups.length;
    warnings.push(`${deletedCount} group(s) no longer exist`);
  }

  // Check if users are still members of groups
  const sharedGroups = groups.filter(g => 
    g.members.some(m => m.toString() === fromUserId.toString()) &&
    g.members.some(m => m.toString() === toUserId.toString())
  );

  if (sharedGroups.length === 0 && groups.length > 0) {
    warnings.push('Users are no longer in any shared groups');
  } else if (sharedGroups.length < groups.length) {
    const removedCount = groups.length - sharedGroups.length;
    warnings.push(`Users removed from ${removedCount} group(s)`);
  }

  // Check for currency mismatches
  const currencies = groups
    .map(g => g.budget?.currency || 'INR')
    .filter((v, i, a) => a.indexOf(v) === i);

  if (currencies.length > 1) {
    issues.push(`Multiple currencies detected: ${currencies.join(', ')}`);
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
    validGroups: sharedGroups,
    currency: currencies[0] || 'INR',
  };
};

/**
 * Check if a settlement can be confirmed/rejected
 * @param {Object} settlement - Settlement document
 * @param {string} userId - User attempting the action
 * @returns {Promise<Object>} Action validation result
 */
export const validateSettlementAction = async (settlement, userId) => {
  const issues = [];
  const warnings = [];

  // Check if user is the receiver
  if (settlement.toUserId._id.toString() !== userId.toString()) {
    issues.push('Only the payment receiver can perform this action');
  }

  // Check if already processed
  if (settlement.paymentStatus === 'confirmed') {
    issues.push('Payment already confirmed');
  }

  // Check if users still exist
  const users = await User.find({ 
    _id: { $in: [settlement.fromUserId._id, settlement.toUserId._id] } 
  }).select('_id');

  if (users.length < 2) {
    warnings.push('One or both users have been deleted');
  }

  // Check if groups still exist (for cross-group settlements)
  if (settlement.isCrossGroup && settlement.affectedGroups?.length > 0) {
    const groups = await Group.find({ 
      _id: { $in: settlement.affectedGroups } 
    }).select('_id');

    if (groups.length < settlement.affectedGroups.length) {
      const deletedCount = settlement.affectedGroups.length - groups.length;
      warnings.push(`${deletedCount} group(s) have been deleted`);
    }

    // Check if users are still in groups
    const sharedGroups = await Group.find({
      _id: { $in: settlement.affectedGroups },
      members: { $all: [settlement.fromUserId._id, settlement.toUserId._id] },
    }).select('_id');

    if (sharedGroups.length === 0) {
      warnings.push('Users are no longer in any shared groups');
    }
  }

  return {
    canProceed: issues.length === 0,
    issues,
    warnings,
  };
};

/**
 * Format user display name (handle deleted users)
 * @param {Object} user - User object or null
 * @param {string} userId - User ID as fallback
 * @returns {string} Display name
 */
export const formatUserDisplayName = (user, userId) => {
  if (!user) {
    const userIdShort = userId.substring(userId.length - 6);
    return `[Deleted User ${userIdShort}]`;
  }
  return user.name || user.email || '[Unknown User]';
};

/**
 * Get settlement status with edge case indicators
 * @param {Object} settlement - Settlement document
 * @returns {Promise<Object>} Status information
 */
export const getSettlementStatus = async (settlement) => {
  const status = {
    paymentStatus: settlement.paymentStatus,
    hasIssues: false,
    issues: [],
    warnings: [],
  };

  // Check for deleted users
  const users = await User.find({ 
    _id: { $in: [settlement.fromUserId, settlement.toUserId] } 
  }).select('_id');

  if (users.length < 2) {
    status.hasIssues = true;
    status.warnings.push('One or both users have been deleted');
  }

  // Check for deleted groups
  if (settlement.isCrossGroup && settlement.affectedGroups?.length > 0) {
    const groups = await Group.find({ 
      _id: { $in: settlement.affectedGroups } 
    }).select('_id');

    if (groups.length < settlement.affectedGroups.length) {
      status.warnings.push('Some groups have been deleted');
    }
  }

  return status;
};

const settlementHelpers = {
  validateSettlementParticipants,
  validateSettlementAction,
  formatUserDisplayName,
  getSettlementStatus,
};

export default settlementHelpers;
