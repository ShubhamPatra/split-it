import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import apiClient from '../lib/apiClient';

// Create the context
const GroupContext = createContext(undefined);

// GroupProvider component
export const GroupProvider = ({ children }) => {
  // State for groups, expenses, and settlements
  const [groups, setGroups] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [profiles, setProfiles] = useState({}); // Cache user profiles
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Load all user data from API
  const loadUserData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [groupsData, expensesData, settlementsData] = await Promise.all([
        apiClient.get('/groups'),
        apiClient.get('/expenses'),
        apiClient.get('/settlements'),
      ]);

      // Transform API data to match frontend format
      const transformedGroups = groupsData.map(g => ({
        id: g._id,
        name: g.name,
        createdBy: g.createdBy._id || g.createdBy,
        createdAt: g.createdAt,
        members: g.members.map(m => m._id || m),
        inviteCode: g.inviteCode,
      }));

      const transformedExpenses = expensesData.map(e => ({
        id: e._id,
        groupId: e.groupId._id || e.groupId,
        description: e.description,
        amount: e.amount,
        currency: e.currency,
        category: e.category,
        paidBy: e.paidBy._id || e.paidBy,
        date: e.date,
        splitAmong: e.splitAmong.map(s => s._id || s),
        splitConfig: e.splitConfig,
      }));

      const transformedSettlements = settlementsData.map(s => ({
        id: s._id,
        groupId: s.groupId._id || s.groupId,
        fromUserId: s.fromUserId._id || s.fromUserId,
        toUserId: s.toUserId._id || s.toUserId,
        amount: s.amount,
        currency: s.currency,
        settledAt: s.settledAt,
        paymentMethod: s.paymentMethod || 'cash',
        paymentStatus: s.paymentStatus || 'pending',
      }));

      setGroups(transformedGroups);
      setExpenses(transformedExpenses);
      setSettlements(transformedSettlements);

      // Build profiles cache from populated data
      const profilesMap = {};
      groupsData.forEach(g => {
        if (g.createdBy && typeof g.createdBy === 'object') {
          profilesMap[g.createdBy._id] = { 
            id: g.createdBy._id, 
            name: g.createdBy.name, 
            email: g.createdBy.email,
            upiId: g.createdBy.upiId || ''
          };
        }
        g.members.forEach(m => {
          if (m && typeof m === 'object') {
            profilesMap[m._id] = { 
              id: m._id, 
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

  // Load data when user changes
  useEffect(() => {
    if (user) {
      loadUserData();
    } else {
      setGroups([]);
      setExpenses([]);
      setSettlements([]);
      setLoading(false);
    }
  }, [user, loadUserData]);

  // Add a new group
  const addGroup = async (name, members) => {
    if (!user) return null;
    try {
      const response = await apiClient.post('/groups', { name, members });
      await loadUserData();
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
      await loadUserData();
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
      await loadUserData();
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
      await loadUserData();
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
      await loadUserData();
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
      await loadUserData();
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
      await loadUserData();
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
      await loadUserData();
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
      await loadUserData();
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
      await loadUserData();
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
      await loadUserData();
      return response.inviteCode;
    } catch (error) {
      console.error('Error generating invite code:', error);
      return null;
    }
  };

  // Join a group via invite code
  const joinGroupByInvite = async (inviteCode) => {
    try {
      await apiClient.post(`/groups/join/${inviteCode}`);
      await loadUserData();
      return true;
    } catch (error) {
      console.error('Error joining group:', error);
      throw error;
    }
  };

  // Get a specific group by ID
  const getGroupById = (id) => {
    return groups.find(g => g.id === id);
  };

  // Get all expenses for a group
  const getGroupExpenses = (groupId) => {
    return expenses.filter(exp => exp.groupId === groupId);
  };

  // Get all settlements for a group
  const getGroupSettlements = (groupId) => {
    return settlements.filter(set => set.groupId === groupId);
  };

  // Get balances for a group (client-side calculation)
  const getGroupBalances = (groupId) => {
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
  };

  // Get total expenses for a group
  const getTotalExpenses = (groupId) => {
    return getGroupExpenses(groupId).reduce((sum, exp) => sum + exp.amount, 0);
  };

  // Get user profile by ID
  const getUserProfile = (userId) => {
    return profiles[userId] || { id: userId, name: 'Unknown User' };
  };

  return (
    <GroupContext.Provider
      value={{
        groups,
        expenses,
        settlements,
        profiles,
        loading,
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
        refreshData: loadUserData
      }}
    >
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
