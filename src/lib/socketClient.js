const API_ROOT = (process.env.REACT_APP_API_URL || 'http://localhost:5000')
  .replace(/\/$/, '')
  .replace(/\/api$/, '');
const POLL_INTERVAL_MS = Number(process.env.REACT_APP_REALTIME_POLL_INTERVAL_MS || 2000);

class PollingRealtimeClient {
  constructor() {
    this.listeners = new Map();
    this.joinedRooms = new Set();
    this.connected = false;
    this.pollCursor = null;
    this.pollTimer = null;
    this.pollInFlight = false;
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event).add(handler);
    return this;
  }

  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }

    return this;
  }

  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) {
      return false;
    }

    handlers.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Realtime handler error for event ${event}:`, error);
      }
    });

    return true;
  }

  async pollOnce() {
    if (!this.connected || this.pollInFlight) {
      return;
    }

    this.pollInFlight = true;

    try {
      const params = new URLSearchParams();
      if (this.joinedRooms.size > 0) {
        params.set('channels', Array.from(this.joinedRooms).map((groupId) => `group:${groupId}`).join(','));
      }
      if (this.pollCursor) {
        params.set('cursor', this.pollCursor);
      }
      params.set('limit', '100');

      const response = await fetch(`${API_ROOT}/api/realtime/events?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const events = Array.isArray(data.events) ? data.events : [];

      for (const event of events) {
        this.pollCursor = event.id || this.pollCursor;
        this.emit(event.event, event.payload);
      }

      if (data.nextCursor) {
        this.pollCursor = data.nextCursor;
      }
    } catch (error) {
      console.warn('Realtime polling failed:', error.message);
    } finally {
      this.pollInFlight = false;
    }
  }

  startPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    this.pollTimer = setInterval(() => {
      void this.pollOnce();
    }, POLL_INTERVAL_MS);

    void this.pollOnce();
  }

  connect() {
    if (this.connected) {
      return this;
    }

    this.connected = true;
    queueMicrotask(() => this.emit('connect'));
    this.startPolling();
    return this;
  }

  disconnect() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.connected = false;
    queueMicrotask(() => this.emit('disconnect'));
    return this;
  }

  join(groupId) {
    if (!groupId) {
      return;
    }

    this.joinedRooms.add(groupId);
    if (this.connected) {
      void this.pollOnce();
    }
  }

  leave(groupId) {
    if (!groupId) {
      return;
    }

    this.joinedRooms.delete(groupId);
    if (this.connected) {
      void this.pollOnce();
    }
  }

  getJoinedRooms() {
    return Array.from(this.joinedRooms);
  }

  forceRejoinRooms() {
    void this.pollOnce();
  }
}

let socket = null;

export const initializeSocket = () => {
  if (socket) {
    return socket;
  }

  socket = new PollingRealtimeClient();
  socket.connect();

  socket.on('connect', () => {
    console.log('Realtime client connected');
  });

  socket.on('disconnect', () => {
    console.log('Realtime client disconnected');
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

export const joinGroup = (groupId) => {
  socket?.join(groupId);
};

export const leaveGroup = (groupId) => {
  socket?.leave(groupId);
};

// Join group room and track for refresh polling
export const joinGroupRoom = (groupId) => {
  if (!groupId) return;
  const realtimeClient = socket || initializeSocket();
  realtimeClient.join(groupId);
};

// Leave group room and stop tracking
export const leaveGroupRoom = (groupId) => {
  if (!groupId) return;
  socket?.leave(groupId);
};

// Get all joined rooms (for debugging or re-joining)
export const getJoinedRooms = () => socket?.getJoinedRooms() || [];

// Force re-join all tracked rooms (useful when listeners are set up after connection)
export const forceRejoinRooms = () => {
  socket?.forceRejoinRooms();
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
