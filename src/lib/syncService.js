/**
 * Sync Service
 * 
 * Handles synchronization between IndexedDB and server.
 * Manages offline queue and conflict resolution.
 */

import apiClient from './apiClient';
import offlineStorage, { SYNC_STATUS } from './offlineStorage';

// Sync state
let isSyncing = false;
let syncListeners = [];
let onlineTimerId = null; // Track online sync timer for cleanup

/**
 * Register sync listener
 */
export const onSyncStateChange = (callback) => {
  syncListeners.push(callback);
  return () => {
    syncListeners = syncListeners.filter(cb => cb !== callback);
  };
};

/**
 * Notify sync state change
 */
const notifySyncStateChange = (state) => {
  syncListeners.forEach(cb => cb(state));
};

/**
 * Check if online
 */
export const isOnline = () => navigator.onLine;

/**
 * Perform full sync from server to IndexedDB
 */
export const syncFromServer = async () => {
  if (!isOnline()) {
    console.log('Offline - skipping sync from server');
    return { success: false, error: 'offline' };
  }

  try {
    notifySyncStateChange({ syncing: true, direction: 'download' });

    // Fetch all data from server
    const [groupsData, settlementsData] = await Promise.all([
      apiClient.get('/groups'),
      apiClient.get('/settlements'),
    ]);

    // Guard against missing groups data
    const groups = Array.isArray(groupsData) ? groupsData : (groupsData.groups || []);
    const settlements = Array.isArray(settlementsData) ? settlementsData : (settlementsData.settlements || []);

    // Fetch expenses for each group (skip if no groups)
    let allExpenses = [];
    if (groups.length > 0) {
      const expensesPromises = groups.map(group =>
        apiClient.get(`/expenses?groupId=${group._id}`).catch(err => {
          console.warn(`Failed to fetch expenses for group ${group._id}:`, err);
          return { expenses: [] }; // Graceful fallback
        })
      );
      const expensesResults = await Promise.all(expensesPromises);
      allExpenses = expensesResults.flatMap(result =>
        Array.isArray(result) ? result : (result.expenses || [])
      );
    }

    // Save to IndexedDB
    await Promise.all([
      offlineStorage.syncGroupsFromServer(groups),
      offlineStorage.syncExpensesFromServer(allExpenses),
      offlineStorage.syncSettlementsFromServer(settlements),
    ]);

    // Update sync metadata
    await offlineStorage.setSyncMetadata('lastFullSync', new Date().toISOString());

    notifySyncStateChange({ syncing: false, direction: null, success: true });

    return { success: true };
  } catch (error) {
    console.error('Sync from server failed:', error);
    notifySyncStateChange({ syncing: false, direction: null, success: false, error });
    return { success: false, error: error.message };
  }
};

/**
 * Sync pending actions to server
 */
export const syncToServer = async () => {
  if (!isOnline()) {
    console.log('Offline - skipping sync to server');
    return { success: false, error: 'offline' };
  }

  if (isSyncing) {
    console.log('Sync already in progress');
    return { success: false, error: 'already_syncing' };
  }

  try {
    isSyncing = true;
    notifySyncStateChange({ syncing: true, direction: 'upload' });

    const pendingActions = await offlineStorage.getPendingActions();

    if (pendingActions.length === 0) {
      notifySyncStateChange({ syncing: false, direction: null, success: true });
      return { success: true, synced: 0 };
    }

    console.log(`Syncing ${pendingActions.length} pending actions`);

    let synced = 0;
    let failed = 0;

    // Process actions in order
    for (const action of pendingActions) {
      try {
        await offlineStorage.updatePendingAction(action.id, {
          status: SYNC_STATUS.SYNCING,
        });

        // Execute action based on type
        let result;
        switch (action.type) {
          case 'CREATE_EXPENSE':
            result = await apiClient.post('/expenses', action.data);
            // Update local expense with server ID
            if (result._id) {
              // Remove temp expense from IndexedDB
              if (action.tempId) {
                await offlineStorage.remove(offlineStorage.STORES.EXPENSES, action.tempId);
              }
              // Save server expense
              await offlineStorage.saveExpense({
                ...result,
                syncStatus: SYNC_STATUS.SYNCED,
              });
            }
            break;

          case 'UPDATE_EXPENSE':
            result = await apiClient.put(`/expenses/${action.data._id}`, action.data);
            if (result.expense) {
              await offlineStorage.saveExpense(result.expense);
            }
            break;

          case 'DELETE_EXPENSE':
            await apiClient.delete(`/expenses/${action.data._id}`);
            await offlineStorage.remove(offlineStorage.STORES.EXPENSES, action.data._id);
            break;

          case 'CREATE_SETTLEMENT':
            result = await apiClient.post('/settlements', action.data);
            if (result.settlement) {
              await offlineStorage.remove(offlineStorage.STORES.SETTLEMENTS, action.data._id);
              await offlineStorage.saveSettlement(result.settlement);
            }
            break;

          case 'UPDATE_SETTLEMENT':
            result = await apiClient.put(`/settlements/${action.data._id}`, action.data);
            if (result.settlement) {
              await offlineStorage.saveSettlement(result.settlement);
            }
            break;

          default:
            console.warn('Unknown action type:', action.type);
        }

        // Mark as synced and remove
        await offlineStorage.removePendingAction(action.id);
        synced++;

      } catch (error) {
        console.error('Failed to sync action:', action.id, error);

        // Update retry count
        const retryCount = (action.retryCount || 0) + 1;
        const maxRetries = 3;

        if (retryCount >= maxRetries) {
          // Mark as failed after max retries
          await offlineStorage.updatePendingAction(action.id, {
            status: SYNC_STATUS.FAILED,
            retryCount,
            lastError: error.message,
          });
        } else {
          // Reset to pending for retry
          await offlineStorage.updatePendingAction(action.id, {
            status: SYNC_STATUS.PENDING,
            retryCount,
            lastError: error.message,
          });
        }

        failed++;
      }
    }

    // Sync fresh data from server after successful upload
    if (synced > 0) {
      await syncFromServer();
    }

    notifySyncStateChange({
      syncing: false,
      direction: null,
      success: true,
      synced,
      failed,
    });

    return { success: true, synced, failed };

  } catch (error) {
    console.error('Sync to server failed:', error);
    notifySyncStateChange({ syncing: false, direction: null, success: false, error });
    return { success: false, error: error.message };
  } finally {
    isSyncing = false;
  }
};

/**
 * Perform bidirectional sync
 */
export const performFullSync = async () => {
  if (!isOnline()) {
    return { success: false, error: 'offline' };
  }

  // First sync pending actions to server
  // Note: syncToServer already calls syncFromServer for any successfully synced items
  const uploadResult = await syncToServer();

  // Only fetch from server if syncToServer didn't already sync
  // (i.e., when there were no pending actions to upload)
  let downloadResult = { success: true, synced: 0 };
  if (uploadResult.synced === 0) {
    downloadResult = await syncFromServer();
  }

  return {
    success: uploadResult.success && downloadResult.success,
    upload: uploadResult,
    download: downloadResult,
  };
};

/**
 * Register background sync
 * Uses Background Sync API to sync even when app is closed
 */
export const registerBackgroundSync = async () => {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
    console.warn('Background Sync API not supported');
    return { success: false, error: 'not_supported' };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register('sync-pending-actions');
    console.log('Background sync registered');
    return { success: true };
  } catch (error) {
    console.error('Failed to register background sync:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if background sync is supported
 */
export const isBackgroundSyncSupported = () => {
  return 'serviceWorker' in navigator && 'SyncManager' in window;
};

/**
 * Unregister background sync (called during logout to prevent pending actions
 * from syncing under a different user)
 */
export const unregisterBackgroundSync = async () => {
  if (!isBackgroundSyncSupported()) {
    return { success: true, reason: 'not_supported' };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    // Get all registered sync tags
    const tags = await registration.sync.getTags();
    // Unregister the pending actions sync tag if it exists
    if (tags.includes('sync-pending-actions')) {
      // Note: There's no direct unregister method for Background Sync,
      // however clearing the pending_actions store (done separately) 
      // will cause the sync to bail out with no actions to process
      console.log('Background sync tag found, pending_actions will be cleared');
    }
    return { success: true };
  } catch (error) {
    console.warn('Failed to check background sync registration:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Initialize sync on app start
 */
export const initializeSync = async () => {
  if (!offlineStorage.isOfflineStorageAvailable()) {
    console.warn('IndexedDB not available - offline mode disabled');
    return { success: false, error: 'not_available' };
  }

  // Sync from server on startup if online
  if (isOnline()) {
    await syncFromServer();
  }

  // Register background sync if supported
  if (isBackgroundSyncSupported()) {
    await registerBackgroundSync();
  }

  // Set up online/offline listeners
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Listen for service worker messages
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
  }

  return { success: true };
};

/**
 * Cleanup sync listeners
 */
export const cleanupSync = () => {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
  }

  // Clear any pending online sync timer
  if (onlineTimerId) {
    clearTimeout(onlineTimerId);
    onlineTimerId = null;
  }

  syncListeners = [];
};

/**
 * Handle service worker messages
 */
const handleServiceWorkerMessage = (event) => {
  const { data } = event;

  if (data.type === 'SYNC_COMPLETE') {
    console.log('Background sync completed:', data.success);

    if (data.success) {
      // Refresh data from server
      syncFromServer();

      // Notify listeners
      notifySyncStateChange({
        syncing: false,
        direction: null,
        success: true,
        backgroundSync: true,
      });
    } else {
      // Notify listeners of failure
      notifySyncStateChange({
        syncing: false,
        direction: null,
        success: false,
        error: data.error,
        backgroundSync: true,
      });
    }
  }
};

/**
 * Handle online event
 */
const handleOnline = async () => {
  console.log('Connection restored - syncing...');
  notifySyncStateChange({ online: true });

  // Register background sync for any pending actions
  if (isBackgroundSyncSupported()) {
    await registerBackgroundSync();
  }

  // Clear any existing timer before setting a new one
  if (onlineTimerId) {
    clearTimeout(onlineTimerId);
  }

  // Wait a bit for connection to stabilize
  onlineTimerId = setTimeout(async () => {
    await performFullSync();
    onlineTimerId = null;
  }, 1000);
};

/**
 * Handle offline event
 */
const handleOffline = () => {
  console.log('Connection lost - offline mode active');
  notifySyncStateChange({ online: false });
};

/**
 * Get sync status
 */
export const getSyncStatus = async () => {
  const stats = await offlineStorage.getStorageStats();
  const lastSync = await offlineStorage.getSyncMetadata('lastFullSync');

  return {
    online: isOnline(),
    syncing: isSyncing,
    lastSync,
    pendingActions: stats.pendingActions,
    cachedGroups: stats.groups,
    cachedExpenses: stats.expenses,
    cachedSettlements: stats.settlements,
  };
};

export default {
  isOnline,
  syncFromServer,
  syncToServer,
  performFullSync,
  initializeSync,
  cleanupSync,
  getSyncStatus,
  onSyncStateChange,
  registerBackgroundSync,
  unregisterBackgroundSync,
  isBackgroundSyncSupported,
};
