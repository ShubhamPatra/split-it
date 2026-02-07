/**
 * Utility functions for transforming API data to frontend format
 * Extracted from GroupContext.jsx for better maintainability
 */

/**
 * Transform group data from API format to frontend format
 * @param {Object} group - Group data from API
 * @returns {Object} Transformed group object
 */
export const transformGroup = (group) => {
  return {
    id: (group._id || group.id)?.toString(),
    name: group.name,
    createdBy: (group.createdBy?._id || group.createdBy)?.toString(),
    createdAt: group.createdAt,
    members: (group.members || []).map(m => (m._id || m)?.toString()),
    inviteCode: group.inviteCode,
    budget: group.budget,
  };
};

/**
 * Transform expense data from API format to frontend format
 * @param {Object} expense - Expense data from API
 * @returns {Object} Transformed expense object
 */
export const transformExpense = (expense) => {
  return {
    id: (expense._id || expense.id)?.toString(),
    groupId: (expense.groupId?._id || expense.groupId)?.toString(),
    description: expense.description,
    amount: expense.amount,
    currency: expense.currency,
    category: expense.category,
    paidBy: (expense.paidBy?._id || expense.paidBy)?.toString(),
    date: expense.date,
    splitAmong: (expense.splitAmong || []).map(s => (s._id || s)?.toString()),
    splitConfig: expense.splitConfig,
    receipts: expense.receipts || [],
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
    isOffline: expense.isOffline,
  };
};

/**
 * Transform settlement data from API format to frontend format
 * @param {Object} settlement - Settlement data from API
 * @returns {Object} Transformed settlement object
 */
export const transformSettlement = (settlement) => {
  return {
    id: (settlement._id || settlement.id)?.toString(),
    groupId: (settlement.groupId?._id || settlement.groupId)?.toString(),
    fromUserId: (settlement.fromUserId?._id || settlement.fromUserId)?.toString(),
    toUserId: (settlement.toUserId?._id || settlement.toUserId)?.toString(),
    amount: settlement.amount,
    currency: settlement.currency,
    settledAt: settlement.settledAt,
    paymentMethod: settlement.paymentMethod || 'cash',
    paymentStatus: settlement.paymentStatus || 'pending',
    transactionRef: settlement.transactionRef,
    paymentNotes: settlement.paymentNotes,
  };
};

/**
 * Normalize updates to ensure IDs are strings, not populated objects
 * Handles both flat IDs and populated objects from socket events
 * @param {Object} updates - Update data that may contain populated objects
 * @returns {Object} Normalized updates with string IDs
 */
export const normalizeUpdates = (updates) => {
  const normalized = { ...updates };
  
  // Normalize id/_id
  if (normalized._id) {
    normalized.id = normalized._id.toString();
    delete normalized._id;
  }
  
  // Normalize groupId
  if (normalized.groupId && typeof normalized.groupId === 'object') {
    normalized.groupId = (normalized.groupId._id || normalized.groupId.id)?.toString();
  } else if (normalized.groupId) {
    normalized.groupId = normalized.groupId.toString();
  }
  
  // Normalize paidBy
  if (normalized.paidBy && typeof normalized.paidBy === 'object') {
    normalized.paidBy = (normalized.paidBy._id || normalized.paidBy.id)?.toString();
  } else if (normalized.paidBy) {
    normalized.paidBy = normalized.paidBy.toString();
  }
  
  // Normalize fromUserId
  if (normalized.fromUserId && typeof normalized.fromUserId === 'object') {
    normalized.fromUserId = (normalized.fromUserId._id || normalized.fromUserId.id)?.toString();
  } else if (normalized.fromUserId) {
    normalized.fromUserId = normalized.fromUserId.toString();
  }
  
  // Normalize toUserId
  if (normalized.toUserId && typeof normalized.toUserId === 'object') {
    normalized.toUserId = (normalized.toUserId._id || normalized.toUserId.id)?.toString();
  } else if (normalized.toUserId) {
    normalized.toUserId = normalized.toUserId.toString();
  }
  
  // Normalize createdBy
  if (normalized.createdBy && typeof normalized.createdBy === 'object') {
    normalized.createdBy = (normalized.createdBy._id || normalized.createdBy.id)?.toString();
  } else if (normalized.createdBy) {
    normalized.createdBy = normalized.createdBy.toString();
  }
  
  // Normalize members array
  if (normalized.members && Array.isArray(normalized.members)) {
    normalized.members = normalized.members.map(m => 
      (m._id || m.id || m)?.toString()
    );
  }
  
  // Normalize splitAmong array
  if (normalized.splitAmong && Array.isArray(normalized.splitAmong)) {
    normalized.splitAmong = normalized.splitAmong.map(s => 
      (s._id || s.id || s)?.toString()
    );
  }
  
  return normalized;
};

/**
 * Extract user profile from populated object
 * @param {Object} user - User object (may be populated or just an ID)
 * @returns {Object|null} User profile object or null
 */
export const extractUserProfile = (user) => {
  if (!user || typeof user !== 'object') return null;
  
  const id = (user._id || user.id)?.toString();
  if (!id) return null;
  
  return {
    id,
    name: user.name || 'Unknown User',
    email: user.email || '',
    upiId: user.upiId || '',
  };
};

/**
 * Build profiles map from array of groups with populated members
 * @param {Array} groups - Array of groups with populated member data
 * @returns {Object} Map of userId -> profile
 */
export const buildProfilesMap = (groups) => {
  const profilesMap = {};
  
  groups.forEach(group => {
    // Add creator profile
    if (group.createdBy && typeof group.createdBy === 'object') {
      const profile = extractUserProfile(group.createdBy);
      if (profile) {
        profilesMap[profile.id] = profile;
      }
    }
    
    // Add member profiles
    if (group.members && Array.isArray(group.members)) {
      group.members.forEach(member => {
        const profile = extractUserProfile(member);
        if (profile) {
          profilesMap[profile.id] = profile;
        }
      });
    }
  });
  
  return profilesMap;
};
