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
  socket?.emit('join:group', groupId);
};

// Leave group room and stop tracking
export const leaveGroupRoom = (groupId) => {
  if (!groupId) return;
  // Guard: skip if not in room to prevent duplicate leave events and unnecessary socket traffic
  if (!joinedRooms.has(groupId)) return;
  joinedRooms.delete(groupId);
  socket?.emit('leave:group', groupId);
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
  if (!socket || !groupId || typeof callback !== 'function') return () => {};

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
  if (!socket || !groupId || typeof callback !== 'function') return () => {};

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
