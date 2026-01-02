import { useState, useCallback, useMemo } from 'react';

// Store roles per group - in a real app this would come from backend
const groupRolesStore = {};

export const useGroupRoles = (groupId, createdBy) => {
  const [roles, setRoles] = useState(() => {
    // Initialize with creator as admin
    if (!groupRolesStore[groupId]) {
      groupRolesStore[groupId] = { [createdBy]: 'admin' };
    }
    return groupRolesStore[groupId];
  });

  const getMemberRole = useCallback((memberId) => {
    return roles[memberId] || 'member';
  }, [roles]);

  const isAdmin = useCallback((memberId) => {
    return getMemberRole(memberId) === 'admin';
  }, [getMemberRole]);

  const setMemberRole = useCallback((memberId, role) => {
    setRoles(prev => {
      const updated = { ...prev, [memberId]: role };
      groupRolesStore[groupId] = updated;
      return updated;
    });
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
    return isAdmin(userId);
  }, [isAdmin]);

  const adminCount = useMemo(() => {
    return Object.values(roles).filter(r => r === 'admin').length;
  }, [roles]);

  return {
    roles,
    getMemberRole,
    isAdmin,
    setMemberRole,
    canEditExpense,
    canDeleteExpense,
    canManageMembers,
    canManageRoles,
    adminCount,
  };
};
