/**
 * Offline Storage using IndexedDB
 * 
 * Provides offline data storage and sync capabilities for Split-It.
 * Stores groups, expenses, settlements, and user data locally.
 * Syncs with server when connection is restored.
 */

const DB_NAME = 'splitit_offline';
const DB_VERSION = 1;

// Store names
const STORES = {
  GROUPS: 'groups',
  EXPENSES: 'expenses',
  SETTLEMENTS: 'settlements',
  USERS: 'users',
  PENDING_ACTIONS: 'pending_actions',
  SYNC_METADATA: 'sync_metadata',
};

// Sync status constants
export const SYNC_STATUS = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  FAILED: 'failed',
};

/**
 * Initialize IndexedDB database
 */
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Groups store
      if (!db.objectStoreNames.contains(STORES.GROUPS)) {
        const groupStore = db.createObjectStore(STORES.GROUPS, { keyPath: '_id' });
        groupStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        groupStore.createIndex('syncStatus', 'syncStatus', { unique: false });
      }

      // Expenses store
      if (!db.objectStoreNames.contains(STORES.EXPENSES)) {
        const expenseStore = db.createObjectStore(STORES.EXPENSES, { keyPath: '_id' });
        expenseStore.createIndex('groupId', 'groupId', { unique: false });
        expenseStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        expenseStore.createIndex('syncStatus', 'syncStatus', { unique: false });
      }

      // Settlements store
      if (!db.objectStoreNames.contains(STORES.SETTLEMENTS)) {
        const settlementStore = db.createObjectStore(STORES.SETTLEMENTS, { keyPath: '_id' });
        settlementStore.createIndex('groupId', 'groupId', { unique: false });
        settlementStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        settlementStore.createIndex('syncStatus', 'syncStatus', { unique: false });
      }

      // Users store (for profile caching)
      if (!db.objectStoreNames.contains(STORES.USERS)) {
        const userStore = db.createObjectStore(STORES.USERS, { keyPath: '_id' });
        userStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Pending actions store (for offline operations)
      if (!db.objectStoreNames.contains(STORES.PENDING_ACTIONS)) {
        const actionStore = db.createObjectStore(STORES.PENDING_ACTIONS, {
          keyPath: 'id',
          autoIncrement: true
        });
        actionStore.createIndex('timestamp', 'timestamp', { unique: false });
        actionStore.createIndex('type', 'type', { unique: false });
        actionStore.createIndex('status', 'status', { unique: false });
      }

      // Sync metadata store
      if (!db.objectStoreNames.contains(STORES.SYNC_METADATA)) {
        db.createObjectStore(STORES.SYNC_METADATA, { keyPath: 'key' });
      }
    };
  });
};

/**
 * Get database instance
 */
let dbInstance = null;
const getDB = async () => {
  if (!dbInstance) {
    dbInstance = await initDB();
  }
  return dbInstance;
};

/**
 * Generic CRUD operations
 */

// Get all items from a store
export const getAll = async (storeName) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Get item by ID
export const getById = async (storeName, id) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Get items by index
export const getByIndex = async (storeName, indexName, value) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Save item (add or update)
export const save = async (storeName, item) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Save multiple items
export const saveMany = async (storeName, items) => {
  // Guard against empty arrays to prevent transaction issues
  if (!items || items.length === 0) {
    return { success: true, errors: [] };
  }

  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    let completed = 0;
    const errors = [];

    items.forEach((item, index) => {
      const request = store.put(item);

      request.onsuccess = () => {
        completed++;
        if (completed === items.length) {
          resolve({ success: true, errors });
        }
      };

      request.onerror = () => {
        errors.push({ index, error: request.error });
        completed++;
        if (completed === items.length) {
          resolve({ success: errors.length === 0, errors });
        }
      };
    });
  });
};

// Delete item
export const remove = async (storeName, id) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

// Clear all items from a store
export const clear = async (storeName) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Domain-specific operations
 */

// Groups
export const saveGroup = (group) => save(STORES.GROUPS, {
  ...group,
  syncStatus: SYNC_STATUS.SYNCED,
  lastSyncedAt: new Date().toISOString(),
});

export const getGroups = () => getAll(STORES.GROUPS);

export const getGroup = (id) => getById(STORES.GROUPS, id);

// Expenses
export const saveExpense = (expense) => save(STORES.EXPENSES, {
  ...expense,
  syncStatus: SYNC_STATUS.SYNCED,
  lastSyncedAt: new Date().toISOString(),
});

export const getExpenses = () => getAll(STORES.EXPENSES);

export const getExpensesByGroup = (groupId) => getByIndex(STORES.EXPENSES, 'groupId', groupId);

export const getExpense = (id) => getById(STORES.EXPENSES, id);

// Settlements
export const saveSettlement = (settlement) => save(STORES.SETTLEMENTS, {
  ...settlement,
  syncStatus: SYNC_STATUS.SYNCED,
  lastSyncedAt: new Date().toISOString(),
});

export const getSettlements = () => getAll(STORES.SETTLEMENTS);

export const getSettlementsByGroup = (groupId) => getByIndex(STORES.SETTLEMENTS, 'groupId', groupId);

export const getSettlement = (id) => getById(STORES.SETTLEMENTS, id);

// Users (profile caching)
export const saveUser = (user) => save(STORES.USERS, {
  ...user,
  cachedAt: new Date().toISOString(),
});

export const getUser = (id) => getById(STORES.USERS, id);

export const getUsers = () => getAll(STORES.USERS);

/**
 * Pending actions (for offline operations)
 */

export const addPendingAction = async (action) => {
  const pendingAction = {
    ...action,
    timestamp: new Date().toISOString(),
    status: SYNC_STATUS.PENDING,
    retryCount: 0,
  };
  return save(STORES.PENDING_ACTIONS, pendingAction);
};

export const getPendingActions = async () => {
  const actions = await getAll(STORES.PENDING_ACTIONS);
  return actions.filter(a => a.status === SYNC_STATUS.PENDING);
};

export const updatePendingAction = async (id, updates) => {
  const action = await getById(STORES.PENDING_ACTIONS, id);
  if (!action) return null;

  return save(STORES.PENDING_ACTIONS, {
    ...action,
    ...updates,
  });
};

export const removePendingAction = (id) => remove(STORES.PENDING_ACTIONS, id);

/**
 * Sync metadata
 */

export const setSyncMetadata = (key, value) => save(STORES.SYNC_METADATA, { key, value });

export const getSyncMetadata = async (key) => {
  const result = await getById(STORES.SYNC_METADATA, key);
  return result?.value;
};

/**
 * Bulk operations for initial sync
 */

export const syncGroupsFromServer = async (groups) => {
  return saveMany(STORES.GROUPS, groups.map(g => ({
    ...g,
    syncStatus: SYNC_STATUS.SYNCED,
    lastSyncedAt: new Date().toISOString(),
  })));
};

export const syncExpensesFromServer = async (expenses) => {
  return saveMany(STORES.EXPENSES, expenses.map(e => ({
    ...e,
    syncStatus: SYNC_STATUS.SYNCED,
    lastSyncedAt: new Date().toISOString(),
  })));
};

export const syncSettlementsFromServer = async (settlements) => {
  return saveMany(STORES.SETTLEMENTS, settlements.map(s => ({
    ...s,
    syncStatus: SYNC_STATUS.SYNCED,
    lastSyncedAt: new Date().toISOString(),
  })));
};

/**
 * Clear all offline data (on logout)
 */

export const clearAllData = async () => {
  await clear(STORES.GROUPS);
  await clear(STORES.EXPENSES);
  await clear(STORES.SETTLEMENTS);
  await clear(STORES.USERS);
  await clear(STORES.PENDING_ACTIONS);
  await clear(STORES.SYNC_METADATA);
};

/**
 * Check if offline storage is available
 */

export const isOfflineStorageAvailable = () => {
  return 'indexedDB' in window;
};

/**
 * Get storage statistics
 */

export const getStorageStats = async () => {
  const groups = await getGroups();
  const expenses = await getExpenses();
  const settlements = await getSettlements();
  const users = await getUsers();
  const pendingActions = await getPendingActions();

  return {
    groups: groups.length,
    expenses: expenses.length,
    settlements: settlements.length,
    users: users.length,
    pendingActions: pendingActions.length,
    lastSyncedAt: await getSyncMetadata('lastFullSync'),
  };
};

export default {
  // Generic operations
  getAll,
  getById,
  getByIndex,
  save,
  saveMany,
  remove,
  clear,

  // Domain operations
  saveGroup,
  getGroups,
  getGroup,
  saveExpense,
  getExpenses,
  getExpensesByGroup,
  getExpense,
  saveSettlement,
  getSettlements,
  getSettlementsByGroup,
  getSettlement,
  saveUser,
  getUser,
  getUsers,

  // Pending actions
  addPendingAction,
  getPendingActions,
  updatePendingAction,
  removePendingAction,

  // Sync metadata
  setSyncMetadata,
  getSyncMetadata,

  // Bulk sync
  syncGroupsFromServer,
  syncExpensesFromServer,
  syncSettlementsFromServer,

  // Utilities
  clearAllData,
  isOfflineStorageAvailable,
  getStorageStats,

  // Constants
  STORES,
  SYNC_STATUS,
};
