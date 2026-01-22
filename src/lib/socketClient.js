import { io } from 'socket.io-client';

let socket = null;
let joinedRooms = new Set(); // Track joined rooms for reconnection

export const initializeSocket = () => {
  // Return existing socket if already created (connecting or connected)
  // This prevents multiple socket instances across providers
  if (socket) return socket;

  socket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
    // Use cookie-based auth instead of token in auth header
    withCredentials: true,
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('Socket connected');
    // Rejoin all rooms after reconnection
    joinedRooms.forEach(groupId => {
      socket.emit('join:group', groupId);
    });
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    joinedRooms.clear();
  }
};

export const getSocket = () => socket;

export const joinGroup = (groupId) => {
  socket?.emit('join:group', groupId);
};

export const leaveGroup = (groupId) => {
  socket?.emit('leave:group', groupId);
};

// Join group room and track for reconnection
export const joinGroupRoom = (groupId) => {
  if (!groupId) return;
  // Guard: skip if already joined to prevent duplicate room joins and repeated presence broadcasts
  if (joinedRooms.has(groupId)) return;
  joinedRooms.add(groupId);
  // Ensure socket is initialized before emitting
  const s = socket || initializeSocket();
  if (s && s.connected) {
    s.emit('join:group', groupId);
  }
  // If not connected, the 'connect' event handler will rejoin all rooms
};

// Leave group room and stop tracking
export const leaveGroupRoom = (groupId) => {
  if (!groupId) return;
  // Guard: skip if not in room to prevent duplicate leave events and unnecessary socket traffic
  if (!joinedRooms.has(groupId)) return;
  joinedRooms.delete(groupId);
  socket?.emit('leave:group', groupId);
};

// Get all joined rooms (for debugging or re-joining)
export const getJoinedRooms = () => Array.from(joinedRooms);

// Force re-join all tracked rooms (useful when listeners are set up after connection)
export const forceRejoinRooms = () => {
  if (socket && socket.connected) {
    joinedRooms.forEach(groupId => {
      socket.emit('join:group', groupId);
    });
  }
};

// Analytics event listeners
const analyticsListeners = new Map();

/**
 * Subscribe to analytics events for real-time chart/analytics updates
 * @param {string} groupId - The group ID to subscribe to
 * @param {Function} callback - Callback function that receives analytics data
 * @returns {Function} Unsubscribe function
 */
export const subscribeToAnalytics = (groupId, callback) => {
  if (!socket || !groupId || typeof callback !== 'function') return () => { };

  // Create unique listener key
  const listenerKey = `${groupId}_${Date.now()}`;

  // Define event handlers
  const handlers = {
    'analytics:expenseAdded': (data) => {
      if (data.groupId === groupId || !data.groupId) {
        callback({ type: 'expenseAdded', ...data });
      }
    },
    'analytics:expenseRemoved': (data) => {
      if (data.groupId === groupId || !data.groupId) {
        callback({ type: 'expenseRemoved', ...data });
      }
    },
    'analytics:balanceUpdated': (data) => {
      if (data.groupId === groupId || !data.groupId) {
        callback({ type: 'balanceUpdated', ...data });
      }
    },
    'analytics:categoryUpdated': (data) => {
      if (data.groupId === groupId || !data.groupId) {
        callback({ type: 'categoryUpdated', ...data });
      }
    },
  };

  // Attach all handlers
  Object.entries(handlers).forEach(([event, handler]) => {
    socket.on(event, handler);
  });

  // Store handlers for cleanup
  analyticsListeners.set(listenerKey, handlers);

  // Return unsubscribe function
  return () => {
    const storedHandlers = analyticsListeners.get(listenerKey);
    if (storedHandlers) {
      Object.entries(storedHandlers).forEach(([event, handler]) => {
        socket?.off(event, handler);
      });
      analyticsListeners.delete(listenerKey);
    }
  };
};

/**
 * Subscribe to specific expense events (created, updated, deleted)
 * Useful for updating analytics when expenses change
 * @param {string} groupId - The group ID to subscribe to
 * @param {Function} callback - Callback function that receives expense event data
 * @returns {Function} Unsubscribe function
 */
export const subscribeToExpenseEvents = (groupId, callback) => {
  if (!socket || !groupId || typeof callback !== 'function') return () => { };

  const listenerKey = `expense_${groupId}_${Date.now()}`;

  const handlers = {
    'expense:created': (expense) => {
      if (expense.groupId === groupId || expense.groupId?._id === groupId) {
        callback({ type: 'created', expense });
      }
    },
    // NOTE: expense:add alias listener removed to prevent duplicate analytics refreshes (Comment 2)
    'expense:updated': (expense) => {
      if (expense.groupId === groupId || expense.groupId?._id === groupId) {
        callback({ type: 'updated', expense });
      }
    },
    'expense:deleted': (data) => {
      // Filter by groupId to avoid processing deletions from other groups
      if (data.groupId === groupId) {
        callback({ type: 'deleted', expenseId: data.expenseId });
      }
    },
  };

  Object.entries(handlers).forEach(([event, handler]) => {
    socket.on(event, handler);
  });

  analyticsListeners.set(listenerKey, handlers);

  return () => {
    const storedHandlers = analyticsListeners.get(listenerKey);
    if (storedHandlers) {
      Object.entries(storedHandlers).forEach(([event, handler]) => {
        socket?.off(event, handler);
      });
      analyticsListeners.delete(listenerKey);
    }
  };
};

/**
 * Subscribe to people balance updates (for cross-group settlements)
 * @param {Function} callback - Callback function that receives balance data
 * @returns {Function} Unsubscribe function
 */
export const subscribeToPeopleBalances = (callback) => {
  if (!socket || typeof callback !== 'function') return () => { };

  const handler = (data) => {
    callback(data);
  };

  socket.on('people:balance:update', handler);

  return () => {
    socket?.off('people:balance:update', handler);
  };
};

/**
 * Subscribe to cross-group settlement events
 * @param {Function} callback - Callback function that receives settlement data
 * @returns {Function} Unsubscribe function
 */
export const subscribeToCrossGroupSettlements = (callback) => {
  if (!socket || typeof callback !== 'function') return () => { };

  const handlers = {
    'settlement:crossGroup:created': (data) => {
      callback({ type: 'created', ...data });
    },
    'settlement:crossGroup:confirmed': (data) => {
      callback({ type: 'confirmed', ...data });
    },
  };

  Object.entries(handlers).forEach(([event, handler]) => {
    socket.on(event, handler);
  });

  return () => {
    Object.entries(handlers).forEach(([event, handler]) => {
      socket?.off(event, handler);
    });
  };
};

/**
 * Subscribe to settlement events in a group
 * @param {string} groupId - The group ID to subscribe to
 * @param {Function} callback - Callback function that receives settlement event data
 * @returns {Function} Unsubscribe function
 */
export const subscribeToSettlementEvents = (groupId, callback) => {
  if (!socket || !groupId || typeof callback !== 'function') return () => { };

  const listenerKey = `settlement_${groupId}_${Date.now()}`;

  const handlers = {
    'settlement:created': (settlement) => {
      if (settlement.groupId === groupId || settlement.groupId?._id === groupId) {
        callback({ type: 'created', settlement });
      }
    },
    'settlement:updated': (settlement) => {
      if (settlement.groupId === groupId || settlement.groupId?._id === groupId) {
        callback({ type: 'updated', settlement });
      }
    },
    'settlement:deleted': (data) => {
      callback({ type: 'deleted', settlementId: data.settlementId });
    },
    'settlement:crossGroup:created': (data) => {
      // Check if this group is affected
      if (data.settlements?.some(s => s.groupId?._id === groupId || s.groupId === groupId)) {
        callback({ type: 'crossGroupCreated', ...data });
      }
    },
  };

  Object.entries(handlers).forEach(([event, handler]) => {
    socket.on(event, handler);
  });

  analyticsListeners.set(listenerKey, handlers);

  return () => {
    const storedHandlers = analyticsListeners.get(listenerKey);
    if (storedHandlers) {
      Object.entries(storedHandlers).forEach(([event, handler]) => {
        socket?.off(event, handler);
      });
      analyticsListeners.delete(listenerKey);
    }
  };
};

