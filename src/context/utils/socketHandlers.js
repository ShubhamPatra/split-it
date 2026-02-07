/**
 * Socket event handlers for GroupContext
 * Extracted from GroupContext.jsx for better organization and maintainability
 */

import { normalizeBalanceEvent, validateBalanceEvent } from './balanceCalculator';
import { extractUserProfile } from './groupTransformers';

/**
 * Create socket event handlers for group context
 * @param {Object} params - Handler dependencies
 * @returns {Object} Object containing all socket event handlers
 */
export const createSocketHandlers = ({
  user,
  addExpenseLocally,
  updateExpenseLocally,
  deleteExpenseLocally,
  addSettlementLocally,
  updateSettlementLocally,
  deleteSettlementLocally,
  updateGroupLocally,
  addMemberToGroupLocally,
  deleteGroupLocally,
  setGroups,
  setProfiles,
  setBalancesByGroup,
  loadedGroupsRef,
  loadingGroupsRef,
  setLoadingGroups,
  joinGroupRoom,
  leaveGroupRoom,
}) => {
  /**
   * Handle expense:created event
   */
  const handleExpenseCreated = (expense) => {
    addExpenseLocally(expense);
  };

  /**
   * Handle expense:updated event
   */
  const handleExpenseUpdated = (expense) => {
    updateExpenseLocally(expense._id || expense.id, expense);
  };

  /**
   * Handle expense:deleted event
   */
  const handleExpenseDeleted = (data) => {
    deleteExpenseLocally(data.expenseId || data);
  };

  /**
   * Handle settlement:created event
   */
  const handleSettlementCreated = (settlement) => {
    addSettlementLocally(settlement);
  };

  /**
   * Handle settlement:updated event
   */
  const handleSettlementUpdated = (settlement) => {
    updateSettlementLocally(settlement._id || settlement.id, settlement);
  };

  /**
   * Handle settlement:deleted event
   */
  const handleSettlementDeleted = (data) => {
    deleteSettlementLocally(data.settlementId || data);
  };

  /**
   * Handle group:updated event
   */
  const handleGroupUpdated = (group) => {
    const groupId = (group._id || group.id)?.toString();
    updateGroupLocally(groupId, group);
    
    // Update profiles from populated members if present
    if (group.members && Array.isArray(group.members)) {
      group.members.forEach(m => {
        const profile = extractUserProfile(m);
        if (profile) {
          setProfiles(prev => ({
            ...prev,
            [profile.id]: profile,
          }));
        }
      });
    }
  };

  /**
   * Handle group:created event
   */
  const handleGroupCreated = (group) => {
    const groupId = (group._id || group.id)?.toString();
    
    // Only add if not already in state (avoid duplicates from API response)
    setGroups(prev => {
      if (prev.some(g => g.id === groupId)) {
        return prev;
      }
      
      const transformed = {
        id: groupId,
        name: group.name,
        createdBy: (group.createdBy?._id || group.createdBy)?.toString(),
        createdAt: group.createdAt,
        members: (group.members || []).map(m => (m._id || m)?.toString()),
        inviteCode: group.inviteCode,
      };
      
      return [transformed, ...prev];
    });
    
    // Join socket room immediately
    joinGroupRoom(groupId);
    
    // Update profiles from populated members
    if (group.members && Array.isArray(group.members)) {
      group.members.forEach(m => {
        const profile = extractUserProfile(m);
        if (profile) {
          setProfiles(prev => ({
            ...prev,
            [profile.id]: profile,
          }));
        }
      });
    }
    
    // Update profile for creator if populated
    const creatorProfile = extractUserProfile(group.createdBy);
    if (creatorProfile) {
      setProfiles(prev => ({
        ...prev,
        [creatorProfile.id]: creatorProfile,
      }));
    }
  };

  /**
   * Handle group:memberJoined event
   */
  const handleMemberJoined = ({ groupId, member }) => {
    addMemberToGroupLocally(groupId, member);
    
    // Add new member with zero balance to keep balance view consistent
    const memberId = (member.id || member._id || member)?.toString();
    setBalancesByGroup(prev => {
      if (!prev[groupId]) return prev;
      return {
        ...prev,
        [groupId]: {
          ...prev[groupId],
          [memberId]: 0,
        },
      };
    });
    
    // If the current user is the one being added, join the socket room
    if (memberId === user?.id) {
      joinGroupRoom(groupId);
    }
  };

  /**
   * Handle group:memberRemoved event
   */
  const handleMemberRemoved = ({ groupId, memberId }) => {
    // Check if the current user was removed from the group
    if (memberId === user?.id) {
      // Remove the group from local state
      deleteGroupLocally(groupId);
      
      // Clear stored balances for this group
      setBalancesByGroup(prev => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
      
      // Clear lazy-load tracking
      loadedGroupsRef.current.delete(groupId);
      loadingGroupsRef.current.delete(groupId);
      setLoadingGroups(prev => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
      
      // Leave the socket room
      leaveGroupRoom(groupId);
    } else {
      // Another member was removed, just update the members list
      setGroups(prev => prev.map(g => 
        g.id === groupId 
          ? { ...g, members: g.members.filter(m => m !== memberId) }
          : g
      ));
      
      // Remove the member from balance cache
      setBalancesByGroup(prev => {
        if (!prev[groupId]) return prev;
        const updatedBalances = { ...prev[groupId] };
        delete updatedBalances[memberId];
        return {
          ...prev,
          [groupId]: updatedBalances,
        };
      });
    }
  };

  /**
   * Handle group:budgetUpdated event
   */
  const handleBudgetUpdated = ({ groupId, budget }) => {
    updateGroupLocally(groupId, { budget });
  };

  /**
   * Handle group:deleted event
   */
  const handleGroupDeleted = ({ groupId }) => {
    // Remove group from local state
    deleteGroupLocally(groupId);
    
    // Clear balance cache for this group
    setBalancesByGroup(prev => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
    
    // Clear lazy-load tracking
    loadedGroupsRef.current.delete(groupId);
    loadingGroupsRef.current.delete(groupId);
    setLoadingGroups(prev => {
      const next = new Set(prev);
      next.delete(groupId);
      return next;
    });
    
    // Leave the socket room
    leaveGroupRoom(groupId);
  };

  /**
   * Handle balance:update event
   * 
   * Handles real-time balance updates from the backend after expense operations.
   * Validates event data, normalizes balance structure, and updates state.
   */
  const handleBalanceUpdate = ({ groupId, balances }) => {
    try {
      // Validate event data
      const validation = validateBalanceEvent(groupId, balances);
      if (!validation.valid) {
        console.error('[SOCKET] balance:update validation failed:', validation.error);
        return;
      }
      
      // Normalize balance structure (handles both flat and nested formats)
      const balanceMap = normalizeBalanceEvent(balances);
      if (!balanceMap) {
        console.error('[SOCKET] Failed to normalize balances:', balances);
        return;
      }
      
      // Update state
      setBalancesByGroup(prev => ({
        ...prev,
        [groupId]: balanceMap,
      }));
    } catch (error) {
      console.error('[SOCKET] Error processing balance:update:', error);
    }
  };

  return {
    handleExpenseCreated,
    handleExpenseUpdated,
    handleExpenseDeleted,
    handleSettlementCreated,
    handleSettlementUpdated,
    handleSettlementDeleted,
    handleGroupUpdated,
    handleGroupCreated,
    handleMemberJoined,
    handleMemberRemoved,
    handleBudgetUpdated,
    handleGroupDeleted,
    handleBalanceUpdate,
  };
};

/**
 * Register all socket event listeners
 * @param {Object} socket - Socket.IO client instance
 * @param {Object} handlers - Event handlers object from createSocketHandlers
 */
export const registerSocketListeners = (socket, handlers) => {
  // Expense events
  socket.on('expense:created', handlers.handleExpenseCreated);
  socket.on('expense:add', handlers.handleExpenseCreated); // Alias
  socket.on('expense:updated', handlers.handleExpenseUpdated);
  socket.on('expense:update', handlers.handleExpenseUpdated); // Alias
  socket.on('expense:deleted', handlers.handleExpenseDeleted);
  socket.on('expense:delete', handlers.handleExpenseDeleted); // Alias
  
  // Settlement events
  socket.on('settlement:created', handlers.handleSettlementCreated);
  socket.on('settlement:updated', handlers.handleSettlementUpdated);
  socket.on('settlement:deleted', handlers.handleSettlementDeleted);
  
  // Group events
  socket.on('group:created', handlers.handleGroupCreated);
  socket.on('group:updated', handlers.handleGroupUpdated);
  socket.on('group:update', handlers.handleGroupUpdated); // Alias
  socket.on('group:memberJoined', handlers.handleMemberJoined);
  socket.on('group:join', handlers.handleMemberJoined); // Alias
  socket.on('group:memberRemoved', handlers.handleMemberRemoved);
  socket.on('group:leave', handlers.handleMemberRemoved); // Alias
  socket.on('group:budgetUpdated', handlers.handleBudgetUpdated);
  socket.on('group:deleted', handlers.handleGroupDeleted);
  
  // Balance events
  socket.on('balance:update', handlers.handleBalanceUpdate);
};

/**
 * Unregister all socket event listeners
 * @param {Object} socket - Socket.IO client instance
 */
export const unregisterSocketListeners = (socket) => {
  // Expense events
  socket.off('expense:created');
  socket.off('expense:add');
  socket.off('expense:updated');
  socket.off('expense:update');
  socket.off('expense:deleted');
  socket.off('expense:delete');
  
  // Settlement events
  socket.off('settlement:created');
  socket.off('settlement:updated');
  socket.off('settlement:deleted');
  
  // Group events
  socket.off('group:created');
  socket.off('group:updated');
  socket.off('group:update');
  socket.off('group:memberJoined');
  socket.off('group:join');
  socket.off('group:memberRemoved');
  socket.off('group:leave');
  socket.off('group:budgetUpdated');
  socket.off('group:deleted');
  
  // Balance events
  socket.off('balance:update');
};
