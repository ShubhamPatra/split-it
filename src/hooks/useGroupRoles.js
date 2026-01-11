import { useState, useCallback, useMemo, useEffect } from 'react';
import apiClient from '../lib/apiClient';

// Local cache for roles to reduce API calls
const roleCache = new Map();

export const useGroupRoles = (groupId, createdBy) => {
  const [roles, setRoles] = useState(() => {
    // Initialize with cached data or creator as admin
    const cached = roleCache.get(groupId);
    if (cached) return cached;
    return { [createdBy]: 'admin' };
  });
  const [loading, setLoading] = useState(false);

  // Fetch roles from backend on mount
  useEffect(() => {
    if (!groupId) return;

    const fetchRoles = async () => {
      setLoading(true);
      try {
        const response = await apiClient.get(`/groups/${groupId}/roles`);
        const newRoles = response.roles || {};
        // Ensure creator always has admin role
        if (createdBy && !newRoles[createdBy]) {
          newRoles[createdBy] = 'admin';
        }
        setRoles(newRoles);
        roleCache.set(groupId, newRoles);
      } catch (error) {
        console.error('Error fetching roles:', error);
        // Fall back to local state
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, [groupId, createdBy]);

  const getMemberRole = useCallback((memberId) => {
    // Creator is always admin
    if (memberId === createdBy) return 'admin';
    return roles[memberId] || 'member';
  }, [roles, createdBy]);

  const isAdmin = useCallback((memberId) => {
    return getMemberRole(memberId) === 'admin';
  }, [getMemberRole]);

  const isCreator = useCallback((memberId) => {
    return memberId === createdBy;
  }, [createdBy]);

  const setMemberRole = useCallback(async (memberId, role) => {
    // Optimistically update local state
    setRoles(prev => {
      const updated = { ...prev, [memberId]: role };
      roleCache.set(groupId, updated);
      return updated;
    });

    // Persist to backend
    try {
      await apiClient.put(`/groups/${groupId}/roles/${memberId}`, { role });
    } catch (error) {
      console.error('Error updating role:', error);
      // Revert on failure
      setRoles(prev => {
        const reverted = { ...prev };
        delete reverted[memberId];
        roleCache.set(groupId, reverted);
        return reverted;
      });
      throw error;
    }
  }, [groupId]);

  const canEditExpense = useCallback((userId, expensePaidBy) => {
    // Admins can edit any expense, members can only edit their own
    return isAdmin(userId) || userId === expensePaidBy;
  }, [isAdmin]);

  const canDeleteExpense = useCallback((userId, expensePaidBy) => {
    // Same as edit permissions
    return isAdmin(userId) || userId === expensePaidBy;
  }, [isAdmin]);

  const canManageMembers = useCallback((userId) => {
    return isAdmin(userId);
  }, [isAdmin]);

  const canManageRoles = useCallback((userId) => {
    // Only creator can manage roles
    return isCreator(userId);
  }, [isCreator]);

  const canDeleteGroup = useCallback((userId) => {
    // Only creator can delete the group
    return isCreator(userId);
  }, [isCreator]);

  const adminCount = useMemo(() => {
    return Object.values(roles).filter(r => r === 'admin').length;
  }, [roles]);

  return {
    roles,
    loading,
    getMemberRole,
    isAdmin,
    isCreator,
    setMemberRole,
    canEditExpense,
    canDeleteExpense,
    canManageMembers,
    canManageRoles,
    canDeleteGroup,
    adminCount,
  };
};
