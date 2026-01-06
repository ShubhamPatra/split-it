import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(undefined);

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const { user, isAuthenticated } = useAuth();
  const listenersRef = useRef(new Map());

  // Initialize socket connection
  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const serverUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    
    // Disconnect existing socket before creating new one
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    socketRef.current = io(serverUrl, {
      auth: {
        userId: user.id,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      forceNew: true,
    });

    socketRef.current.on('connect', () => {
      console.log('WebSocket connected:', socketRef.current.id);
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    socketRef.current.on('connect_error', (error) => {
      // Only log if it's not a namespace error (often caused by devtools)
      if (!error.message?.includes('namespace')) {
        console.error('WebSocket connection error:', error.message);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isAuthenticated, user]);

  // Subscribe to a specific event
  const subscribe = useCallback((event, callback) => {
    if (!socketRef.current) return () => {};
    
    socketRef.current.on(event, callback);
    
    // Track listener for cleanup
    const listeners = listenersRef.current.get(event) || [];
    listeners.push(callback);
    listenersRef.current.set(event, listeners);

    // Return unsubscribe function
    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
      const currentListeners = listenersRef.current.get(event) || [];
      listenersRef.current.set(event, currentListeners.filter(l => l !== callback));
    };
  }, []);

  // Join a group room for real-time updates
  const joinGroup = useCallback((groupId) => {
    if (socketRef.current) {
      socketRef.current.emit('join_group', groupId);
    }
  }, []);

  // Leave a group room
  const leaveGroup = useCallback((groupId) => {
    if (socketRef.current) {
      socketRef.current.emit('leave_group', groupId);
    }
  }, []);

  // Emit an event
  const emit = useCallback((event, data) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  }, []);

  return (
    <SocketContext.Provider value={{ 
      socket: socketRef.current,
      subscribe,
      joinGroup,
      leaveGroup,
      emit,
      isConnected: socketRef.current?.connected || false
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
