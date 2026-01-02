import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import apiClient from '../lib/apiClient';

const NotificationContext = createContext(undefined);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const { user } = useAuth();

  // Load notifications from API
  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    try {
      const data = await apiClient.get('/notifications');
      // Transform API data to match frontend format
      const transformed = data.map(n => ({
        id: n._id,
        type: n.type,
        title: n.title,
        message: n.message,
        timestamp: new Date(n.timestamp),
        read: n.read,
        actionType: n.actionType || 'none',
        relatedId: n.relatedId,
        actionCompleted: n.actionCompleted || false,
      }));
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
  }, [user]);

  useEffect(() => {
    loadNotifications();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    
    return () => clearInterval(interval);
  }, [loadNotifications]);

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
