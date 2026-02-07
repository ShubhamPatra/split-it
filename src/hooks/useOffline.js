/**
 * useOffline Hook
 * 
 * React hook for offline functionality and sync status.
 * Provides offline state, sync controls, and cached data access.
 */

import { useState, useEffect, useCallback } from 'react';
import offlineStorage from '../lib/offlineStorage';
import syncService from '../lib/syncService';

export const useOffline = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [pendingActions, setPendingActions] = useState(0);
  const [lastSync, setLastSync] = useState(null);

  // Update online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen to sync state changes
  useEffect(() => {
    let statusTimeoutId = null;

    const unsubscribe = syncService.onSyncStateChange((state) => {
      if (state.syncing !== undefined) {
        setIsSyncing(state.syncing);
      }
      if (state.success !== undefined) {
        setSyncStatus(state.success ? 'success' : 'error');
        // Clear previous timeout if any
        if (statusTimeoutId) {
          clearTimeout(statusTimeoutId);
        }
        // Clear status after 3 seconds
        statusTimeoutId = setTimeout(() => setSyncStatus(null), 3000);
      }
    });

    return () => {
      unsubscribe();
      // Clear timeout on unmount
      if (statusTimeoutId) {
        clearTimeout(statusTimeoutId);
      }
    };
  }, []);

  // Load sync status
  const loadSyncStatus = useCallback(async () => {
    try {
      const status = await syncService.getSyncStatus();
      setPendingActions(status.pendingActions);
      setLastSync(status.lastSync);
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  }, []);

  // Load sync status on mount and when online status changes
  useEffect(() => {
    loadSyncStatus();
  }, [loadSyncStatus, isOnline]);

  // Manual sync trigger
  const triggerSync = useCallback(async () => {
    if (!isOnline) {
      return { success: false, error: 'offline' };
    }

    try {
      const result = await syncService.performFullSync();
      await loadSyncStatus();
      return result;
    } catch (error) {
      console.error('Sync failed:', error);
      return { success: false, error: error.message };
    }
  }, [isOnline, loadSyncStatus]);

  // Get cached data
  const getCachedGroups = useCallback(async () => {
    return offlineStorage.getGroups();
  }, []);

  const getCachedExpenses = useCallback(async (groupId) => {
    if (groupId) {
      return offlineStorage.getExpensesByGroup(groupId);
    }
    return offlineStorage.getExpenses();
  }, []);

  const getCachedSettlements = useCallback(async (groupId) => {
    if (groupId) {
      return offlineStorage.getSettlementsByGroup(groupId);
    }
    return offlineStorage.getSettlements();
  }, []);

  // Get storage stats
  const getStorageStats = useCallback(async () => {
    return offlineStorage.getStorageStats();
  }, []);

  return {
    // Status
    isOnline,
    isOffline: !isOnline,
    isSyncing,
    syncStatus,
    pendingActions,
    lastSync,

    // Actions
    triggerSync,
    loadSyncStatus,

    // Data access
    getCachedGroups,
    getCachedExpenses,
    getCachedSettlements,
    getStorageStats,
  };
};

export default useOffline;
