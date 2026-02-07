import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import apiClient from '../lib/apiClient';
import { initializeSocket, leaveGroupRoom, joinGroupRoom, forceRejoinRooms } from '../lib/socketClient';
import offlineStorage from '../lib/offlineStorage';
import syncService from '../lib/syncService';
import {
  transformGroup,
  transformExpense,
  transformSettlement,
  normalizeUpdates,
  buildProfilesMap,
} from './utils/groupTransformers';
import {
  calculateGroupBalances,
  calculateTotalExpenses,
} from './utils/balanceCalculator';
import {
  createSocketHandlers,
  registerSocketListeners,
  unregisterSocketListeners,
} from './utils/socketHandlers';

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

      // Use utility function for normalization
      const normalizedUpdates = normalizeUpdates(updates);

      return { ...g, ...normalizedUpdates };
    }));
  }, []);

  const addExpenseLocally = useCallback((expense) => {
    const transformed = transformExpense(expense);

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

      // Use utility function for normalization
      const normalizedUpdates = normalizeUpdates(updates);

      return { ...e, ...normalizedUpdates };
    }));
  }, []);

  const deleteExpenseLocally = useCallback((expenseId) => {
    setExpenses(prev => prev.filter(e => e.id !== expenseId));
  }, []);

  const addSettlementLocally = useCallback((settlement) => {
    const transformed = transformSettlement(settlement);

    // Guard: skip if settlement id already exists to prevent duplicates from multiple event handlers
    setSettlements(prev => {
      if (prev.some(s => s.id === transformed.id)) {
        return prev;
      }
      return [transformed, ...prev];
    });
  }, []);

  const addGroupLocally = useCallback((group) => {
    const transformed = transformGroup(group);
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

      // Use utility function for normalization
      const normalizedUpdates = normalizeUpdates(updates);

      return { ...s, ...normalizedUpdates };
    }));
  }, []);

  const deleteSettlementLocally = useCallback((settlementId) => {
    setSettlements(prev => prev.filter(s => s.id !== settlementId));
  }, []);

  // Load all user data from API (groups + settlements only, expenses loaded lazily)
  // Falls back to IndexedDB cache when offline
  const loadUserData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Clear balance cache to prevent stale balances after refresh
    setBalancesByGroup({});

    try {
      // Check if offline first
      if (!navigator.onLine) {
        console.log('Offline mode: loading from IndexedDB cache');

        // Load from IndexedDB cache
        const [cachedGroups, cachedSettlements, cachedExpenses] = await Promise.all([
          offlineStorage.getGroups(),
          offlineStorage.getSettlements(),
          offlineStorage.getExpenses(),
        ]);

        // Transform cached data
        const transformedGroups = (cachedGroups || []).map(transformGroup);
        const transformedSettlements = (cachedSettlements || []).map(transformSettlement);
        const transformedExpenses = (cachedExpenses || []).map(transformExpense);

        setGroups(transformedGroups);
        setSettlements(transformedSettlements);
        setExpenses(transformedExpenses);

        // Mark all groups as loaded since we loaded all expenses from cache
        loadedGroupsRef.current = new Set(transformedGroups.map(g => g.id));

        // Build profiles cache
        const profilesMap = buildProfilesMap(cachedGroups || []);
        setProfiles(profilesMap);

        setLoading(false);
        return;
      }

      // Only load groups and settlements initially - expenses are loaded per-group lazily
      const [groupsData, settlementsData] = await Promise.all([
        apiClient.get('/groups'),
        apiClient.get('/settlements'),
      ]);

      // Transform API data to match frontend format using utility functions
      const transformedGroups = groupsData.map(transformGroup);
      const transformedSettlements = settlementsData.map(transformSettlement);

      setGroups(transformedGroups);
      setSettlements(transformedSettlements);

      // Reset lazy loading state
      loadedGroupsRef.current = new Set();
      setExpenses([]);

      // Join all group rooms for real-time updates
      transformedGroups.forEach(g => {
        joinGroupRoom(g.id);
      });

      // Build profiles cache from populated data using utility function
      const profilesMap = buildProfilesMap(groupsData);
      setProfiles(profilesMap);

      // Save to IndexedDB for offline use
      try {
        await Promise.all([
          offlineStorage.syncGroupsFromServer(groupsData || []),
          offlineStorage.syncSettlementsFromServer(settlementsData || []),
        ]);
      } catch (cacheError) {
        console.warn('Failed to cache data for offline use:', cacheError);
      }
    } catch (error) {
      console.error('Error loading data:', error);

      // If API call fails, try to load from cache as fallback
      if (error.message?.includes('Network') || error.message?.includes('offline') || error.message?.includes('Failed to fetch')) {
        console.log('Network error: falling back to IndexedDB cache');
        try {
          const [cachedGroups, cachedSettlements, cachedExpenses] = await Promise.all([
            offlineStorage.getGroups(),
            offlineStorage.getSettlements(),
            offlineStorage.getExpenses(),
          ]);

          const transformedGroups = (cachedGroups || []).map(transformGroup);
          const transformedSettlements = (cachedSettlements || []).map(transformSettlement);
          const transformedExpenses = (cachedExpenses || []).map(transformExpense);

          setGroups(transformedGroups);
          setSettlements(transformedSettlements);
          setExpenses(transformedExpenses);

          loadedGroupsRef.current = new Set(transformedGroups.map(g => g.id));

          const profilesMap = buildProfilesMap(cachedGroups || []);
          setProfiles(profilesMap);
        } catch (cacheError) {
          console.error('Failed to load from cache:', cacheError);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Lazy load expenses for a specific group
  // Falls back to IndexedDB cache when offline
  const loadGroupExpenses = useCallback(async (groupId, forceReload = false) => {
    if (!groupId) return [];

    // Skip if already loaded and not forcing reload
    if (loadedGroupsRef.current.has(groupId) && !forceReload) {
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
      // Check if offline - load from cache
      if (!navigator.onLine) {
        console.log('Offline mode: loading expenses from IndexedDB cache');
        const cachedExpenses = await offlineStorage.getExpensesByGroup(groupId);
        const transformedExpenses = (cachedExpenses || []).map(transformExpense);

        setExpenses(prev => {
          const otherExpenses = prev.filter(e => e.groupId !== groupId);
          return [...otherExpenses, ...transformedExpenses];
        });

        loadedGroupsRef.current.add(groupId);
        return transformedExpenses;
      }

      const response = await apiClient.get(`/expenses/group/${groupId}?limit=${EXPENSES_PER_PAGE}`);
      const expensesData = Array.isArray(response) ? response : (response.data || []);

      // Transform expenses using utility function
      const transformedExpenses = expensesData.map(transformExpense);

      // Update expenses state - replace expenses for this group
      setExpenses(prev => {
        const otherExpenses = prev.filter(e => e.groupId !== groupId);
        return [...otherExpenses, ...transformedExpenses];
      });

      loadedGroupsRef.current.add(groupId);

      // Join socket room for real-time updates after initial load
      const { joinGroupRoom } = await import('../lib/socketClient');
      joinGroupRoom(groupId);

      // Cache expenses for offline use
      try {
        await offlineStorage.syncExpensesFromServer(expensesData);
      } catch (cacheError) {
        console.warn('Failed to cache expenses:', cacheError);
      }

      return transformedExpenses;
    } catch (error) {
      console.error('Error loading group expenses:', error);

      // Fallback to cache on network error
      if (error.message?.includes('Network') || error.message?.includes('offline') || error.message?.includes('Failed to fetch')) {
        try {
          const cachedExpenses = await offlineStorage.getExpensesByGroup(groupId);
          const transformedExpenses = (cachedExpenses || []).map(transformExpense);

          setExpenses(prev => {
            const otherExpenses = prev.filter(e => e.groupId !== groupId);
            return [...otherExpenses, ...transformedExpenses];
          });

          loadedGroupsRef.current.add(groupId);
          return transformedExpenses;
        } catch (cacheError) {
          console.error('Failed to load expenses from cache:', cacheError);
        }
      }

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
  }, [expenses]);

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
      // Check if online
      if (!navigator.onLine) {
        // Generate temporary ID for offline expense
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create offline expense object
        const offlineExpense = {
          _id: tempId,
          ...expenseData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isOffline: true, // Flag to indicate offline creation
        };

        // Add to local state immediately (optimistic UI)
        addExpenseLocally(offlineExpense);

        // Queue for sync when online
        await offlineStorage.addPendingAction({
          type: 'CREATE_EXPENSE',
          data: expenseData,
          tempId: tempId,
          timestamp: Date.now(),
          status: 'pending',
          retryCount: 0,
        });

        // Save to IndexedDB for offline viewing
        await offlineStorage.saveExpense({
          ...offlineExpense,
          syncStatus: 'pending',
        });

        // Register background sync if supported
        if (syncService.isBackgroundSyncSupported()) {
          await syncService.registerBackgroundSync();
        }

        return tempId;
      }

      // Online mode - normal API call
      const response = await apiClient.post('/expenses', expenseData);
      addExpenseLocally(response);

      // Save to IndexedDB for offline viewing
      await offlineStorage.saveExpense({
        ...response,
        syncStatus: 'synced',
      });

      return response._id;
    } catch (error) {
      console.error('Error adding expense:', error);

      // If API call fails, fall back to offline mode
      if (error.message.includes('Network') || error.message.includes('Failed to fetch')) {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const offlineExpense = {
          _id: tempId,
          ...expenseData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isOffline: true,
        };

        addExpenseLocally(offlineExpense);

        await offlineStorage.addPendingAction({
          type: 'CREATE_EXPENSE',
          data: expenseData,
          tempId: tempId,
          timestamp: Date.now(),
          status: 'pending',
          retryCount: 0,
        });

        await offlineStorage.saveExpense({
          ...offlineExpense,
          syncStatus: 'pending',
        });

        // Register background sync if supported
        if (syncService.isBackgroundSyncSupported()) {
          await syncService.registerBackgroundSync();
        }

        return tempId;
      }

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

  /**
   * Get balances for a group.
   * 
   * Returns server-calculated balances when available (from balance:update socket events),
   * or falls back to client-side calculation when server balances are unavailable.
   * 
   * @function getGroupBalances
   * @param {string} groupId - The ID of the group to get balances for
   * @returns {Object.<string, number>} Balance map where keys are user IDs and values are balance amounts
   *                                    Positive = user is owed money, Negative = user owes money
   * 
   * @behavior
   * 1. **Primary**: Returns server-provided balances from `balancesByGroup[groupId]`
   *    - Updated by `balance:update` socket events after expense operations
   *    - Ensures consistency with backend calculations
   *    - Reduces client-side computation
   * 
   * 2. **Fallback**: Calculates balances client-side when server data unavailable
   *    - Handles initial load before socket events received
   *    - Handles temporary socket disconnection
   *    - Handles cleared/invalidated balance cache
   *    - Ensures UI always displays accurate balances
   * 
   * @calculation Client-side fallback algorithm:
   * 1. Initialize all group members with balance = 0
   * 2. Process expenses:
   *    - Payer gets credited: balance += expense.amount
   *    - Each participant owes their share: balance -= shares[userId]
   * 3. Process confirmed settlements:
   *    - Payer gets credited: balance += settlement.amount
   *    - Receiver gets debited: balance -= settlement.amount
   * 4. Return final balance map
   * 
   * @reactivity
   * This function is wrapped in useCallback with critical dependencies:
   * - `balancesByGroup`: When server emits balance:update, triggers re-render
   * - `getGroupExpenses`: When expenses change, fallback uses latest data
   * - `groups`: When group membership changes, recalculates balances
   * - `settlements`: When settlements added/updated, reflects in balances
   * 
   * @example
   * // Server balances available (after socket event)
   * const balances = getGroupBalances('group123');
   * // Returns: { user1: 150.50, user2: -75.25, user3: -75.25 }
   * 
   * @example
   * // Fallback calculation (socket unavailable)
   * const balances = getGroupBalances('group123');
   * // Calculates from expenses and settlements
   * // Returns: { user1: 150.50, user2: -75.25, user3: -75.25 }
   * 
   * @see socket listener 'balance:update' for server balance updates
   * @see Balance_Tab in GroupDetail.jsx for UI usage
   * @see Settlement_Tab in GroupDetail.jsx for settlement suggestions
   */
  const getGroupBalances = useCallback((groupId) => {
    // FIX: Return server-provided balances if available
    // The backend emits balance:update events after expense operations, which update balancesByGroup state.
    // Using server-calculated balances ensures consistency and reduces client-side computation.
    if (balancesByGroup[groupId]) {
      return balancesByGroup[groupId];
    }

    // FIX: Fallback to client-side calculation when server balances are unavailable
    // This handles cases where:
    // 1. Socket events haven't been received yet (initial load)
    // 2. Socket connection is temporarily unavailable
    // 3. Balance cache was cleared or invalidated
    // The fallback ensures the UI always displays accurate balances even without real-time updates.
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

    // Process settlements (only count confirmed settlements for balances)
    groupSettlements
      .filter(settlement => settlement.paymentStatus === 'confirmed')
      .forEach(settlement => {
        balances[settlement.fromUserId] = (balances[settlement.fromUserId] || 0) + settlement.amount;
        balances[settlement.toUserId] = (balances[settlement.toUserId] || 0) - settlement.amount;
      });

    return balances;
    // FIX: Dependencies are critical for React to detect when balances need recalculation
    // - balancesByGroup: When server emits balance:update, this state changes and triggers re-render
    // - getGroupExpenses: When expenses change, fallback calculation needs to use latest data
    // - groups: When group membership changes, balance calculations need to update
    // - settlements: When settlements are added/updated, balances need to reflect changes
    // Without these dependencies, components using getGroupBalances would display stale data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balancesByGroup, getGroupExpenses, groups, settlements]);

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

    // Create socket event handlers with all dependencies
    const handlers = createSocketHandlers({
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
    });

    // Register all socket event listeners
    registerSocketListeners(socket, handlers);

    // After all listeners are set up, re-join all tracked rooms to ensure we receive events
    // This handles the case where socket connected before listeners were registered
    if (socket.connected) {
      forceRejoinRooms();
    }

    // Cleanup: unregister all listeners on unmount
    return () => {
      unregisterSocketListeners(socket);
      // Note: Socket disconnection is now managed by AuthContext
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
