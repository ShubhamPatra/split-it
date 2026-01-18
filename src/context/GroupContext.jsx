import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import apiClient from '../lib/apiClient';
import { initializeSocket, leaveGroupRoom, joinGroupRoom } from '../lib/socketClient';

// Create the context
const GroupContext = createContext(undefined);

// Constants for lazy loading
const EXPENSES_PER_PAGE = 50;

// GroupProvider component
export const GroupProvider = ({ children }) => {
  // State for groups, expenses, and settlements
  const [groups, setGroups] = useState([]);
  const [expenses, setExpenses] = useState([]); // Now stores expenses lazily loaded per group
  const [settlements, setSettlements] = useState([]);
  const [profiles, setProfiles] = useState({}); // Cache user profiles
  const [balancesByGroup, setBalancesByGroup] = useState({}); // Server-provided balances per group
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Track which groups have been loaded (lazy loading)
  const loadedGroupsRef = useRef(new Set());
  // Use ref for synchronous in-flight tracking to prevent race conditions
  const loadingGroupsRef = useRef(new Set());
  const [loadingGroups, setLoadingGroups] = useState(new Set());

  // Memoize expensive calculations
  const groupsById = useMemo(() => {
    return groups.reduce((acc, g) => ({ ...acc, [g.id]: g }), {});
  }, [groups]);

  const expensesByGroup = useMemo(() => {
    return expenses.reduce((acc, e) => {
      if (!acc[e.groupId]) acc[e.groupId] = [];
      acc[e.groupId].push(e);
      return acc;
    }, {});
  }, [expenses]);

  // Selective update functions instead of full reload
  const updateGroupLocally = useCallback((groupId, updates) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      
      // Normalize the updates to ensure members are ID strings, not objects
      const normalizedUpdates = { ...updates };
      
      // Normalize members array if present (handles populated objects from socket events)
      if (normalizedUpdates.members && Array.isArray(normalizedUpdates.members)) {
        normalizedUpdates.members = normalizedUpdates.members.map(m => 
          (m._id || m.id || m)?.toString()
        );
      }
      
      // Normalize createdBy if present (handles populated objects from socket events)
      if (normalizedUpdates.createdBy && typeof normalizedUpdates.createdBy === 'object') {
        normalizedUpdates.createdBy = (normalizedUpdates.createdBy._id || normalizedUpdates.createdBy.id)?.toString();
      }
      
      // Normalize id/_id
      if (normalizedUpdates._id) {
        normalizedUpdates.id = normalizedUpdates._id.toString();
        delete normalizedUpdates._id;
      }
      
      return { ...g, ...normalizedUpdates };
    }));
  }, []);

  const addExpenseLocally = useCallback((expense) => {
    const transformed = {
      id: (expense._id || expense.id)?.toString(),
      groupId: (expense.groupId._id || expense.groupId)?.toString(),
      description: expense.description,
      amount: expense.amount,
      currency: expense.currency,
      category: expense.category,
      paidBy: (expense.paidBy._id || expense.paidBy)?.toString(),
      date: expense.date,
      splitAmong: expense.splitAmong.map(s => (s._id || s)?.toString()),
      splitConfig: expense.splitConfig,
      receipts: expense.receipts || [],
    };
    // Guard: skip if expense id already exists to prevent duplicates from multiple event handlers
    setExpenses(prev => {
      if (prev.some(e => e.id === transformed.id)) {
        return prev;
      }
      return [transformed, ...prev];
    });
  }, []);

  const updateExpenseLocally = useCallback((expenseId, updates) => {
    setExpenses(prev => prev.map(e => {
      if (e.id !== expenseId) return e;
      
      // Normalize updates to ensure IDs are strings, not populated objects
      const normalizedUpdates = { ...updates };
      
      // Normalize id/_id
      if (normalizedUpdates._id) {
        normalizedUpdates.id = normalizedUpdates._id.toString();
        delete normalizedUpdates._id;
      }
      
      // Normalize groupId (handles populated object from socket events)
      if (normalizedUpdates.groupId && typeof normalizedUpdates.groupId === 'object') {
        normalizedUpdates.groupId = (normalizedUpdates.groupId._id || normalizedUpdates.groupId.id)?.toString();
      } else if (normalizedUpdates.groupId) {
        normalizedUpdates.groupId = normalizedUpdates.groupId.toString();
      }
      
      // Normalize paidBy (handles populated object from socket events)
      if (normalizedUpdates.paidBy && typeof normalizedUpdates.paidBy === 'object') {
        normalizedUpdates.paidBy = (normalizedUpdates.paidBy._id || normalizedUpdates.paidBy.id)?.toString();
      } else if (normalizedUpdates.paidBy) {
        normalizedUpdates.paidBy = normalizedUpdates.paidBy.toString();
      }
      
      // Normalize splitAmong array (handles populated objects from socket events)
      if (normalizedUpdates.splitAmong && Array.isArray(normalizedUpdates.splitAmong)) {
        normalizedUpdates.splitAmong = normalizedUpdates.splitAmong.map(s => 
          (s._id || s.id || s)?.toString()
        );
      }
      
      return { ...e, ...normalizedUpdates };
    }));
  }, []);

  const deleteExpenseLocally = useCallback((expenseId) => {
    setExpenses(prev => prev.filter(e => e.id !== expenseId));
  }, []);

  const addSettlementLocally = useCallback((settlement) => {
    const transformed = {
      id: (settlement._id || settlement.id)?.toString(),
      groupId: (settlement.groupId._id || settlement.groupId)?.toString(),
      fromUserId: (settlement.fromUserId._id || settlement.fromUserId)?.toString(),
      toUserId: (settlement.toUserId._id || settlement.toUserId)?.toString(),
      amount: settlement.amount,
      currency: settlement.currency,
      settledAt: settlement.settledAt,
      paymentMethod: settlement.paymentMethod || 'cash',
      paymentStatus: settlement.paymentStatus || 'pending',
    };
    // Guard: skip if settlement id already exists to prevent duplicates from multiple event handlers
    setSettlements(prev => {
      if (prev.some(s => s.id === transformed.id)) {
        return prev;
      }
      return [transformed, ...prev];
    });
  }, []);

  const addGroupLocally = useCallback((group) => {
    const transformed = {
      id: (group._id || group.id)?.toString(),
      name: group.name,
      createdBy: (group.createdBy._id || group.createdBy)?.toString(),
      createdAt: group.createdAt,
      members: group.members.map(m => (m._id || m)?.toString()),
      inviteCode: group.inviteCode,
    };
    setGroups(prev => [transformed, ...prev]);
  }, []);

  const deleteGroupLocally = useCallback((groupId) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
    setExpenses(prev => prev.filter(e => e.groupId !== groupId));
    setSettlements(prev => prev.filter(s => s.groupId !== groupId));
  }, []);

  const updateSettlementLocally = useCallback((settlementId, updates) => {
    setSettlements(prev => prev.map(s => {
      if (s.id !== settlementId) return s;
      
      // Normalize updates to ensure IDs are strings, not populated objects
      const normalizedUpdates = { ...updates };
      
      // Normalize id/_id
      if (normalizedUpdates._id) {
        normalizedUpdates.id = normalizedUpdates._id.toString();
        delete normalizedUpdates._id;
      }
      
      // Normalize groupId (handles populated object from socket events)
      if (normalizedUpdates.groupId && typeof normalizedUpdates.groupId === 'object') {
        normalizedUpdates.groupId = (normalizedUpdates.groupId._id || normalizedUpdates.groupId.id)?.toString();
      } else if (normalizedUpdates.groupId) {
        normalizedUpdates.groupId = normalizedUpdates.groupId.toString();
      }
      
      // Normalize fromUserId (handles populated object from socket events)
      if (normalizedUpdates.fromUserId && typeof normalizedUpdates.fromUserId === 'object') {
        normalizedUpdates.fromUserId = (normalizedUpdates.fromUserId._id || normalizedUpdates.fromUserId.id)?.toString();
      } else if (normalizedUpdates.fromUserId) {
        normalizedUpdates.fromUserId = normalizedUpdates.fromUserId.toString();
      }
      
      // Normalize toUserId (handles populated object from socket events)
      if (normalizedUpdates.toUserId && typeof normalizedUpdates.toUserId === 'object') {
        normalizedUpdates.toUserId = (normalizedUpdates.toUserId._id || normalizedUpdates.toUserId.id)?.toString();
      } else if (normalizedUpdates.toUserId) {
        normalizedUpdates.toUserId = normalizedUpdates.toUserId.toString();
      }
      
      return { ...s, ...normalizedUpdates };
    }));
  }, []);

  const deleteSettlementLocally = useCallback((settlementId) => {
    setSettlements(prev => prev.filter(s => s.id !== settlementId));
  }, []);

  // Load all user data from API (groups + settlements only, expenses loaded lazily)
  const loadUserData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    // Clear balance cache to prevent stale balances after refresh
    setBalancesByGroup({});

    try {
      // Only load groups and settlements initially - expenses are loaded per-group lazily
      const [groupsData, settlementsData] = await Promise.all([
        apiClient.get('/groups'),
        apiClient.get('/settlements'),
      ]);

      // Transform API data to match frontend format
      const transformedGroups = groupsData.map(g => ({
        id: g._id?.toString() || g._id,
        name: g.name,
        createdBy: (g.createdBy._id || g.createdBy)?.toString(),
        createdAt: g.createdAt,
        members: g.members.map(m => (m._id || m)?.toString()),
        inviteCode: g.inviteCode,
      }));

      const transformedSettlements = settlementsData.map(s => ({
        id: s._id?.toString() || s._id,
        groupId: (s.groupId._id || s.groupId)?.toString(),
        fromUserId: (s.fromUserId._id || s.fromUserId)?.toString(),
        toUserId: (s.toUserId._id || s.toUserId)?.toString(),
        amount: s.amount,
        currency: s.currency,
        settledAt: s.settledAt,
        paymentMethod: s.paymentMethod || 'cash',
        paymentStatus: s.paymentStatus || 'pending',
      }));

      setGroups(transformedGroups);
      setSettlements(transformedSettlements);
      
      // Reset lazy loading state
      loadedGroupsRef.current = new Set();
      setExpenses([]);

      // Join all group rooms for real-time updates
      transformedGroups.forEach(g => {
        joinGroupRoom(g.id);
      });

      // Build profiles cache from populated data
      const profilesMap = {};
      groupsData.forEach(g => {
        if (g.createdBy && typeof g.createdBy === 'object') {
          const id = g.createdBy._id?.toString();
          profilesMap[id] = { 
            id, 
            name: g.createdBy.name, 
            email: g.createdBy.email,
            upiId: g.createdBy.upiId || ''
          };
        }
        g.members.forEach(m => {
          if (m && typeof m === 'object') {
            const id = m._id?.toString();
            profilesMap[id] = { 
              id, 
              name: m.name, 
              email: m.email,
              upiId: m.upiId || ''
            };
          }
        });
      });
      setProfiles(profilesMap);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Lazy load expenses for a specific group
  const loadGroupExpenses = useCallback(async (groupId, forceReload = false) => {
    if (!groupId) return [];
    
    // Skip if already loaded and not forcing reload
    if (loadedGroupsRef.current.has(groupId) && !forceReload) {
      // Access expenses directly instead of using expensesByGroup
      return expenses.filter(e => e.groupId === groupId);
    }
    
    // Use ref for synchronous check to prevent race conditions between renders
    if (loadingGroupsRef.current.has(groupId)) {
      return expenses.filter(e => e.groupId === groupId);
    }
    
    // Mark as loading synchronously BEFORE any async operations
    loadingGroupsRef.current.add(groupId);
    setLoadingGroups(prev => new Set(prev).add(groupId));
    
    try {
      const response = await apiClient.get(`/expenses/group/${groupId}?limit=${EXPENSES_PER_PAGE}`);
      const expensesData = Array.isArray(response) ? response : (response.data || []);
      
      const transformedExpenses = expensesData.map(e => ({
        id: (e._id || e.id)?.toString(),
        groupId: (e.groupId?._id || e.groupId)?.toString(),
        description: e.description,
        amount: e.amount,
        currency: e.currency,
        category: e.category,
        paidBy: (e.paidBy?._id || e.paidBy)?.toString(),
        date: e.date,
        splitAmong: (e.splitAmong || []).map(s => (s._id || s)?.toString()),
        splitConfig: e.splitConfig,
        receipts: e.receipts || [],
      }));
      
      // Update expenses state - replace expenses for this group
      setExpenses(prev => {
        const otherExpenses = prev.filter(e => e.groupId !== groupId);
        return [...otherExpenses, ...transformedExpenses];
      });
      
      loadedGroupsRef.current.add(groupId);
      
      // Join socket room for real-time updates after initial load
      const { joinGroupRoom } = await import('../lib/socketClient');
      joinGroupRoom(groupId);
      
      return transformedExpenses;
    } catch (error) {
      console.error('Error loading group expenses:', error);
      return [];
    } finally {
      // Clean up both ref and state
      loadingGroupsRef.current.delete(groupId);
      setLoadingGroups(prev => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  }, [expenses]); // Only depend on expenses state, not expensesByGroup

  // Load data when user changes
  useEffect(() => {
    if (user) {
      loadUserData();
    } else {
      setGroups([]);
      setExpenses([]);
      setSettlements([]);
      setBalancesByGroup({});
      setLoading(false);
    }
  }, [user, loadUserData]);

  // Add a new group
  const addGroup = async (name, members) => {
    if (!user) return null;
    try {
      const response = await apiClient.post('/groups', { name, members });
      addGroupLocally(response);
      return response._id;
    } catch (error) {
      console.error('Error adding group:', error);
      return null;
    }
  };

  // Add a new expense
  const addExpense = async (expenseData) => {
    try {
      const response = await apiClient.post('/expenses', expenseData);
      addExpenseLocally(response);
      return response._id;
    } catch (error) {
      console.error('Error adding expense:', error);
      return null;
    }
  };

  // Add a new settlement
  const addSettlement = async (settlementData) => {
    try {
      const response = await apiClient.post('/settlements', settlementData);
      addSettlementLocally(response);
      return response._id;
    } catch (error) {
      console.error('Error adding settlement:', error);
      return null;
    }
  };

  // Update an expense
  const updateExpense = async (expenseId, updates) => {
    try {
      await apiClient.put(`/expenses/${expenseId}`, updates);
      updateExpenseLocally(expenseId, updates);
      return true;
    } catch (error) {
      console.error('Error updating expense:', error);
      return false;
    }
  };

  // Update a settlement
  const updateSettlement = async (settlementId, updates) => {
    try {
      await apiClient.put(`/settlements/${settlementId}`, updates);
      updateSettlementLocally(settlementId, updates);
      return true;
    } catch (error) {
      console.error('Error updating settlement:', error);
      return false;
    }
  };

  // Delete a group and its associated expenses and settlements
  const deleteGroup = async (groupId) => {
    try {
      await apiClient.delete(`/groups/${groupId}`);
      deleteGroupLocally(groupId);
      return true;
    } catch (error) {
      console.error('Error deleting group:', error);
      return false;
    }
  };

  // Delete an expense
  const deleteExpense = async (expenseId) => {
    try {
      await apiClient.delete(`/expenses/${expenseId}`);
      deleteExpenseLocally(expenseId);
      return true;
    } catch (error) {
      console.error('Error deleting expense:', error);
      return false;
    }
  };

  // Delete a settlement
  const deleteSettlement = async (settlementId) => {
    try {
      await apiClient.delete(`/settlements/${settlementId}`);
      deleteSettlementLocally(settlementId);
      return true;
    } catch (error) {
      console.error('Error deleting settlement:', error);
      return false;
    }
  };

  // Add a member to a group
  const addMemberToGroup = async (groupId, memberId) => {
    try {
      await apiClient.post(`/groups/${groupId}/members`, { memberId });
      // Update group locally with new member (with deduplication to prevent duplicates from socket race)
      setGroups(prev => prev.map(g => {
        if (g.id === groupId) {
          // Check if member already exists to avoid duplicates
          if (!g.members.includes(memberId)) {
            return { ...g, members: [...g.members, memberId] };
          }
        }
        return g;
      }));
      return true;
    } catch (error) {
      console.error('Error adding member:', error);
      return false;
    }
  };

  // Remove a member from a group
  const removeMemberFromGroup = async (groupId, memberId) => {
    try {
      await apiClient.delete(`/groups/${groupId}/members/${memberId}`);
      // Update group locally removing member
      setGroups(prev => prev.map(g => 
        g.id === groupId 
          ? { ...g, members: g.members.filter(m => m !== memberId) }
          : g
      ));
      return true;
    } catch (error) {
      console.error('Error removing member:', error);
      return false;
    }
  };

  // Generate invite code for a group
  const generateInviteCode = async (groupId) => {
    try {
      const response = await apiClient.post(`/groups/${groupId}/invite-code`);
      // Update group locally with new invite code
      setGroups(prev => prev.map(g => 
        g.id === groupId 
          ? { ...g, inviteCode: response.inviteCode }
          : g
      ));
      return response.inviteCode;
    } catch (error) {
      console.error('Error generating invite code:', error);
      return null;
    }
  };

  // Join a group via invite code or token
  const joinGroupByInvite = useCallback(async (code, token) => {
    try {
      // Use new invite system
      const response = await apiClient.post('/invites/join', {
        code: code || undefined,
        token: token || undefined,
      });
      
      if (response.group) {
        addGroupLocally(response.group);
        
        // Add profile for group creator
        if (response.group.createdBy && typeof response.group.createdBy === 'object') {
          const creator = response.group.createdBy;
          const creatorId = creator._id?.toString();
          setProfiles(prev => ({
            ...prev,
            [creatorId]: { 
              id: creatorId, 
              name: creator.name, 
              email: creator.email,
              upiId: creator.upiId || ''
            }
          }));
        }
        
        // Add profiles for new group members
        if (response.group.members) {
          response.group.members.forEach(m => {
            if (m && typeof m === 'object') {
              const memberId = m._id?.toString();
              setProfiles(prev => ({
                ...prev,
                [memberId]: { 
                  id: memberId, 
                  name: m.name, 
                  email: m.email,
                  upiId: m.upiId || ''
                }
              }));
            }
          });
        }
      }
      return true;
    } catch (error) {
      console.error('Error joining group:', error);
      throw error;
    }
  }, [addGroupLocally]);

  // Add member to group locally (for socket updates)
  const addMemberToGroupLocally = useCallback((groupId, member) => {
    // Ensure groupId is a string for comparison
    const groupIdStr = groupId?.toString() || groupId;
    
    setGroups(prev => prev.map(g => {
      if (g.id === groupIdStr) {
        const memberId = (member.id || member._id || member)?.toString();
        if (!g.members.includes(memberId)) {
          return { ...g, members: [...g.members, memberId] };
        }
      }
      return g;
    }));
    
    // Add profile for the new member
    if (member && typeof member === 'object') {
      const memberId = (member.id || member._id)?.toString();
      setProfiles(prev => ({
        ...prev,
        [memberId]: { 
          id: memberId, 
          name: member.name, 
          email: member.email,
          upiId: member.upiId || ''
        }
      }));
    }
  }, []);

  // Get a specific group by ID
  const getGroupById = (id) => {
    return groups.find(g => g.id === id);
  };

  // Get all expenses for a group (NO auto-loading - use loadGroupExpenses explicitly)
  const getGroupExpenses = useCallback((groupId) => {
    return expenses.filter(exp => exp.groupId === groupId);
  }, [expenses]);

  // Get all settlements for a group
  const getGroupSettlements = (groupId) => {
    return settlements.filter(set => set.groupId === groupId);
  };

  // Get balances for a group (uses server-provided balances if available, falls back to client-side calculation)
  const getGroupBalances = useCallback((groupId) => {
    // Return server-provided balances if available
    if (balancesByGroup[groupId]) {
      return balancesByGroup[groupId];
    }
    
    // Fallback to client-side calculation
    const groupExpenses = getGroupExpenses(groupId);
    const groupSettlements = getGroupSettlements(groupId);
    
    // Calculate balances
    const balances = {};
    const group = getGroupById(groupId);
    
    if (!group) return balances;

    // Initialize balances
    group.members.forEach(memberId => {
      balances[memberId] = 0;
    });

    // Process expenses
    groupExpenses.forEach(expense => {
      const shares = expense.splitConfig?.shares || {};
      
      // Payer gets credited
      balances[expense.paidBy] = (balances[expense.paidBy] || 0) + expense.amount;
      
      // Each member owes their share
      Object.entries(shares).forEach(([memberId, amount]) => {
        balances[memberId] = (balances[memberId] || 0) - amount;
      });
    });

    // Process settlements
    groupSettlements.forEach(settlement => {
      balances[settlement.fromUserId] = (balances[settlement.fromUserId] || 0) + settlement.amount;
      balances[settlement.toUserId] = (balances[settlement.toUserId] || 0) - settlement.amount;
    });

    return balances;
  }, [balancesByGroup, getGroupExpenses, groups]);

  // Get total expenses for a group
  const getTotalExpenses = (groupId) => {
    return getGroupExpenses(groupId).reduce((sum, exp) => sum + exp.amount, 0);
  };

  // Get user profile by ID
  const getUserProfile = (userId) => {
    return profiles[userId] || { id: userId, name: 'Unknown User' };
  };

  // WebSocket integration for real-time updates
  useEffect(() => {
    if (!user) return;

    // Use cookie-based auth - no token needed
    const socket = initializeSocket();

    // Listen for real-time updates
    socket.on('expense:created', (expense) => {
      addExpenseLocally(expense);
    });

    // Alias event for contract alignment
    socket.on('expense:add', (expense) => {
      addExpenseLocally(expense);
    });

    socket.on('expense:updated', (expense) => {
      updateExpenseLocally(expense._id || expense.id, expense);
    });

    // Alias event for contract alignment
    socket.on('expense:update', (expense) => {
      updateExpenseLocally(expense._id || expense.id, expense);
    });

    socket.on('expense:deleted', (data) => {
      deleteExpenseLocally(data.expenseId || data);
    });

    // Alias event for contract alignment
    socket.on('expense:delete', (data) => {
      deleteExpenseLocally(data.expenseId || data);
    });

    socket.on('settlement:created', (settlement) => {
      addSettlementLocally(settlement);
    });

    socket.on('settlement:updated', (settlement) => {
      updateSettlementLocally(settlement._id || settlement.id, settlement);
    });

    socket.on('settlement:deleted', (data) => {
      deleteSettlementLocally(data.settlementId || data);
    });

    socket.on('group:updated', (group) => {
      const groupId = (group._id || group.id)?.toString();
      updateGroupLocally(groupId, group);
      
      // Also update profiles from populated members if present
      if (group.members && Array.isArray(group.members)) {
        group.members.forEach(m => {
          if (m && typeof m === 'object' && m._id) {
            const memberId = m._id.toString();
            setProfiles(prev => ({
              ...prev,
              [memberId]: {
                id: memberId,
                name: m.name,
                email: m.email,
                upiId: m.upiId || ''
              }
            }));
          }
        });
      }
    });

    // Alias event for contract alignment
    socket.on('group:update', (group) => {
      const groupId = (group._id || group.id)?.toString();
      updateGroupLocally(groupId, group);
      
      // Also update profiles from populated members if present
      if (group.members && Array.isArray(group.members)) {
        group.members.forEach(m => {
          if (m && typeof m === 'object' && m._id) {
            const memberId = m._id.toString();
            setProfiles(prev => ({
              ...prev,
              [memberId]: {
                id: memberId,
                name: m.name,
                email: m.email,
                upiId: m.upiId || ''
              }
            }));
          }
        });
      }
    });

    // Handle new group creation (received via user room for invited members)
    socket.on('group:created', (group) => {
      const groupId = (group._id || group.id)?.toString();
      // Only add if not already in state (avoid duplicates from API response)
      setGroups(prev => {
        if (prev.some(g => g.id === groupId)) {
          return prev;
        }
        // Use addGroupLocally transformation
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
      
      // Join socket room immediately so client receives expense/settlement/chat updates
      joinGroupRoom(groupId);
      
      // Update profiles from populated members
      if (group.members && Array.isArray(group.members)) {
        group.members.forEach(m => {
          if (m && typeof m === 'object' && m._id) {
            const memberId = m._id.toString();
            setProfiles(prev => ({
              ...prev,
              [memberId]: {
                id: memberId,
                name: m.name,
                email: m.email,
                upiId: m.upiId || ''
              }
            }));
          }
        });
      }
      
      // Update profile for creator if populated
      if (group.createdBy && typeof group.createdBy === 'object' && group.createdBy._id) {
        const creatorId = group.createdBy._id.toString();
        setProfiles(prev => ({
          ...prev,
          [creatorId]: {
            id: creatorId,
            name: group.createdBy.name,
            email: group.createdBy.email,
            upiId: group.createdBy.upiId || ''
          }
        }));
      }
    });

    // New invite-related socket events
    socket.on('group:memberJoined', ({ groupId, member }) => {
      addMemberToGroupLocally(groupId, member);
      
      // Comment 3 fix: Invalidate balance cache or add new member with zero balance
      const memberId = (member.id || member._id || member)?.toString();
      setBalancesByGroup(prev => {
        if (!prev[groupId]) return prev;
        // Add new member with zero balance to keep balance view consistent
        return {
          ...prev,
          [groupId]: {
            ...prev[groupId],
            [memberId]: 0
          }
        };
      });
      
      // If the current user is the one being added, join the socket room
      if (memberId === user?.id) {
        joinGroupRoom(groupId);
      }
    });

    // Comment 3: Subscribe to aliased events for contract alignment
    socket.on('group:join', ({ groupId, member }) => {
      addMemberToGroupLocally(groupId, member);
      
      // Comment 3 fix: Invalidate balance cache or add new member with zero balance
      const memberId = (member.id || member._id || member)?.toString();
      setBalancesByGroup(prev => {
        if (!prev[groupId]) return prev;
        // Add new member with zero balance to keep balance view consistent
        return {
          ...prev,
          [groupId]: {
            ...prev[groupId],
            [memberId]: 0
          }
        };
      });
      
      // If the current user is the one being added, join the socket room
      if (memberId === user?.id) {
        joinGroupRoom(groupId);
      }
    });
    
    socket.on('group:memberRemoved', ({ groupId, memberId }) => {
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
        // Clear lazy-load tracking so rejoining triggers fresh expense fetch
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
        
        // Comment 3 fix: Remove the member from balance cache to keep balance view consistent
        setBalancesByGroup(prev => {
          if (!prev[groupId]) return prev;
          const updatedBalances = { ...prev[groupId] };
          delete updatedBalances[memberId];
          return {
            ...prev,
            [groupId]: updatedBalances
          };
        });
      }
    });

    // Comment 3: Subscribe to aliased event for contract alignment
    socket.on('group:leave', ({ groupId, memberId }) => {
      // Check if the current user was removed from the group
      if (memberId === user?.id) {
        deleteGroupLocally(groupId);
        setBalancesByGroup(prev => {
          const next = { ...prev };
          delete next[groupId];
          return next;
        });
        loadedGroupsRef.current.delete(groupId);
        loadingGroupsRef.current.delete(groupId);
        setLoadingGroups(prev => {
          const next = new Set(prev);
          next.delete(groupId);
          return next;
        });
        leaveGroupRoom(groupId);
      } else {
        setGroups(prev => prev.map(g => 
          g.id === groupId 
            ? { ...g, members: g.members.filter(m => m !== memberId) }
            : g
        ));
        setBalancesByGroup(prev => {
          if (!prev[groupId]) return prev;
          const updatedBalances = { ...prev[groupId] };
          delete updatedBalances[memberId];
          return {
            ...prev,
            [groupId]: updatedBalances
          };
        });
      }
    });

    socket.on('group:budgetUpdated', ({ groupId, budget }) => {
      updateGroupLocally(groupId, { budget });
    });

    socket.on('group:deleted', ({ groupId }) => {
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
    });

    socket.on('balance:update', ({ groupId, balances }) => {
      // Store server-provided balances for real-time updates
      // The server now sends only the userId→amount map (not the full balance object)
      // If we receive an object with a nested 'balances' property (legacy format),
      // extract just the balance map to maintain flat userId→amount structure
      const balanceMap = balances && typeof balances === 'object' && balances.balances
        ? balances.balances
        : balances;
      setBalancesByGroup(prev => ({
        ...prev,
        [groupId]: balanceMap
      }));
    });

    return () => {
      socket.off('expense:created');
      socket.off('expense:add'); // Alias event
      socket.off('expense:updated');
      socket.off('expense:update'); // Alias event
      socket.off('expense:deleted');
      socket.off('expense:delete'); // Alias event
      socket.off('settlement:created');
      socket.off('settlement:updated');
      socket.off('settlement:deleted');
      socket.off('group:created');
      socket.off('group:updated');
      socket.off('group:update'); // Alias event
      socket.off('group:memberJoined');
      socket.off('group:join'); // Alias event
      socket.off('group:memberRemoved');
      socket.off('group:leave'); // Alias event
      socket.off('group:budgetUpdated');
      socket.off('group:deleted');
      socket.off('balance:update');
      // Note: Socket disconnection is now managed by AuthContext
    };
  }, [user, addExpenseLocally, updateExpenseLocally, deleteExpenseLocally, addSettlementLocally, updateSettlementLocally, deleteSettlementLocally, updateGroupLocally, addMemberToGroupLocally]);

  // Memoize context value to prevent unnecessary re-renders
  // Functions are stable and adding all to deps would be excessive
  const contextValue = useMemo(() => ({
    groups,
    expenses,
    settlements,
    profiles,
    loading,
    loadingGroups: loadingGroups.size > 0,
    groupsById,
    expensesByGroup,
    addGroup,
    addExpense,
    addSettlement,
    updateExpense,
    updateSettlement,
    deleteGroup,
    deleteExpense,
    deleteSettlement,
    addMemberToGroup,
    removeMemberFromGroup,
    generateInviteCode,
    joinGroupByInvite,
    getGroupById,
    getGroupExpenses,
    getGroupSettlements,
    getGroupBalances,
    getTotalExpenses,
    getUserProfile,
    loadGroupExpenses, // Expose for explicit lazy loading
    refreshData: loadUserData,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [groups, expenses, settlements, profiles, loading, loadingGroups.size, groupsById, expensesByGroup, loadUserData, joinGroupByInvite, getGroupExpenses, loadGroupExpenses, getGroupBalances]);

  return (
    <GroupContext.Provider value={contextValue}>
      {children}
    </GroupContext.Provider>
  );
};

// Custom hook to use the Group Context
export const useGroups = () => {
  const context = useContext(GroupContext);
  if (context === undefined) {
    throw new Error('useGroups must be used within a GroupProvider');
  }
  return context;
};
