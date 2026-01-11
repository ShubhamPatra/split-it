import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import apiClient from '../lib/apiClient';
import { initializeSocket, disconnectSocket } from '../lib/socketClient';

const NotificationContext = createContext(undefined);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [, setSocketConnected] = useState(false);
  const { user } = useAuth();
  const socketInitialized = useRef(false);

  // Transform notification from API/socket format to frontend format
  const transformNotification = useCallback((n) => ({
    id: n._id || n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    timestamp: new Date(n.timestamp),
    read: n.read || false,
    actionType: n.actionType || 'none',
    relatedId: n.relatedId,
    data: n.data || null,
    actionCompleted: n.actionCompleted || false,
  }), []);

  // Load notifications from API
  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    try {
      const data = await apiClient.get('/notifications');
      // Transform API data to match frontend format
      const transformed = data.map(transformNotification);
      setNotifications(transformed);
    } catch (error) {
      console.error('Error loading notifications:', error);
      // Add welcome notification if fetch fails
      setNotifications([{
        id: 'welcome',
        type: 'info',
        title: 'Welcome to Split-It!',
        message: 'Start by creating a group or adding an expense.',
        timestamp: new Date(),
        read: false,
      }]);
    }
  }, [user, transformNotification]);

  // Initialize socket connection and listen for notifications
  useEffect(() => {
    if (!user) {
      // Disconnect socket when user logs out
      if (socketInitialized.current) {
        disconnectSocket();
        socketInitialized.current = false;
        setSocketConnected(false);
      }
      return;
    }

    // Initialize socket after auth
    const socket = initializeSocket();
    socketInitialized.current = true;

    // Track connection state
    const handleConnect = () => {
      console.log('Notification socket connected');
      setSocketConnected(true);
    };

    const handleDisconnect = () => {
      console.log('Notification socket disconnected');
      setSocketConnected(false);
    };

    // Handle incoming notifications via socket
    const handleNewNotification = (notification) => {
      console.log('Received notification via socket:', notification.title);
      const transformed = transformNotification(notification);
      
      // Add to notifications list, avoiding duplicates
      setNotifications(prev => {
        const exists = prev.some(n => n.id === transformed.id);
        if (exists) return prev;
        return [transformed, ...prev];
      });
    };
    
    // Handle notification read status update via socket
    const handleNotificationRead = (data) => {
      const { notificationId } = data;
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    };
    
    // Handle notification deletion via socket
    const handleNotificationDeleted = (data) => {
      const { notificationId } = data;
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    };
    
    // Handle reconnection - reload notifications for sync
    const handleReconnect = () => {
      console.log('Socket reconnected, reloading notifications for sync');
      loadNotifications();
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('notification:new', handleNewNotification);
    socket.on('notification:read', handleNotificationRead);
    socket.on('notification:deleted', handleNotificationDeleted);
    socket.on('connect', handleReconnect);

    // Set initial connection state
    if (socket.connected) {
      setSocketConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:read', handleNotificationRead);
      socket.off('notification:deleted', handleNotificationDeleted);
      socket.off('connect', handleReconnect);
    };
  }, [user, transformNotification, loadNotifications]);

  // Load notifications on mount WITHOUT polling
  useEffect(() => {
    loadNotifications();
    
    // No polling - socket is now primary mechanism for real-time updates
    // Only reload on socket reconnection for sync
  }, [loadNotifications]);

  // Check if user needs to add UPI ID and show notification every app open
  useEffect(() => {
    if (user && !user.upiId) {
      // Add a local notification to remind user to add UPI ID
      const upiReminder = {
        id: 'upi-reminder-' + Date.now(),
        type: 'warning',
        title: 'Add Your UPI ID',
        message: 'Add your UPI ID in Profile Settings to receive payments easily from group members.',
        timestamp: new Date(),
        read: false,
        actionType: 'navigate',
        relatedId: '/profile',
      };
      
      // Add to the beginning of notifications list (local only, not persisted)
      setNotifications(prev => {
        // Remove any existing UPI reminder first
        const filtered = prev.filter(n => !n.id.toString().startsWith('upi-reminder'));
        return [upiReminder, ...filtered];
      });
    }
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback(async (notification) => {
    if (!user) return;
    try {
      const response = await apiClient.post('/notifications', notification);
      const newNotification = {
        id: response._id,
        type: response.type,
        title: response.title,
        message: response.message,
        timestamp: new Date(response.timestamp),
        read: response.read,
      };
      setNotifications(prev => [newNotification, ...prev]);
    } catch (error) {
      console.error('Error adding notification:', error);
    }
  }, [user]);

  const markAsRead = useCallback(async (id) => {
    try {
      await apiClient.put(`/notifications/${id}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await apiClient.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, []);

  const clearNotifications = useCallback(async () => {
    try {
      await apiClient.delete('/notifications');
      setNotifications([]);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }, []);

  const removeNotification = useCallback(async (id) => {
    try {
      await apiClient.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error removing notification:', error);
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        removeNotification,
        refreshNotifications: loadNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
