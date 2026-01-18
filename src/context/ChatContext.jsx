import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext';
import apiClient from '../lib/apiClient';
import { getSocket, initializeSocket } from '../lib/socketClient';
import { debounce, createRequestDeduplicator } from '../lib/debounce';

// Create the context
const ChatContext = createContext(undefined);

// Constants for memory management
const MAX_MESSAGES_PER_GROUP = 200; // Keep only the most recent messages per group
const MAX_GROUPS_IN_MEMORY = 5; // Keep messages for at most N groups
const MESSAGE_EVICTION_THRESHOLD = 300; // Start evicting when total messages exceed this

// ChatProvider component
export const ChatProvider = ({ children }) => {
  // State for messages, unread counts, and typing indicators
  const [messages, setMessages] = useState({}); // Map<groupId, Message[]>
  const [unreadCounts, setUnreadCounts] = useState({}); // Map<groupId, number>
  const [typingUsers, setTypingUsers] = useState({}); // Map<groupId, Set<{userId, userName}>>
  const [onlineUsers, setOnlineUsers] = useState({}); // Map<groupId, Set<userId>>
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState({}); // Map<groupId, boolean>
  
  const { user } = useAuth();
  const typingTimeoutRef = useRef({});
  // Comment 4: Use Map<groupId, count> for reference-counted subscriptions
  // This prevents leave:group from being emitted when multiple components subscribe to same group
  const subscribedGroupsRef = useRef(new Map()); // Map<groupId, subscriptionCount>
  // Track group access order for LRU eviction
  const groupAccessOrderRef = useRef([]);
  // Deduplication for unread count fetches
  const unreadDeduplicatorRef = useRef(createRequestDeduplicator());

  // LRU eviction helper - evicts messages from least recently accessed groups
  const evictOldMessages = useCallback((currentMessages, accessedGroupId = null) => {
    // Update access order (move accessed group to front)
    if (accessedGroupId) {
      const order = groupAccessOrderRef.current.filter(id => id !== accessedGroupId);
      order.unshift(accessedGroupId);
      groupAccessOrderRef.current = order;
    }

    let totalMessages = Object.values(currentMessages).reduce((sum, msgs) => sum + (msgs?.length || 0), 0);
    
    // Only evict if we exceed threshold
    if (totalMessages <= MESSAGE_EVICTION_THRESHOLD) {
      return currentMessages;
    }

    const evictedMessages = { ...currentMessages };
    const accessOrder = groupAccessOrderRef.current;
    
    // First pass: trim each group to max messages (keep most recent)
    Object.keys(evictedMessages).forEach(groupId => {
      const groupMsgs = evictedMessages[groupId] || [];
      if (groupMsgs.length > MAX_MESSAGES_PER_GROUP) {
        evictedMessages[groupId] = groupMsgs.slice(-MAX_MESSAGES_PER_GROUP);
      }
    });

    // Recalculate total
    totalMessages = Object.values(evictedMessages).reduce((sum, msgs) => sum + (msgs?.length || 0), 0);

    // Second pass: if still over threshold, evict least recently accessed groups
    if (totalMessages > MESSAGE_EVICTION_THRESHOLD) {
      const groupsToKeep = accessOrder.slice(0, MAX_GROUPS_IN_MEMORY);
      
      Object.keys(evictedMessages).forEach(groupId => {
        if (!groupsToKeep.includes(groupId)) {
          delete evictedMessages[groupId];
        }
      });
    }

    return evictedMessages;
  }, []);

  // Load messages for a group with debouncing for rapid calls
  const loadMessagesImpl = useCallback(async (groupId, before = null) => {
    if (!groupId) return;
    
    setIsLoadingMessages(true);
    try {
      const endpoint = before 
        ? `/groups/${groupId}/messages?before=${before}&limit=50`
        : `/groups/${groupId}/messages?limit=50`;
      
      const response = await apiClient.get(endpoint);
      
      setMessages(prev => {
        const existingMessages = prev[groupId] || [];
        let updatedMessages;
        
        if (before) {
          // Prepend older messages (avoid duplicates)
          const existingIds = new Set(existingMessages.map(m => m._id));
          const newMessages = response.messages.filter(m => !existingIds.has(m._id));
          updatedMessages = {
            ...prev,
            [groupId]: [...newMessages, ...existingMessages],
          };
        } else {
          // Replace with fresh messages
          updatedMessages = {
            ...prev,
            [groupId]: response.messages,
          };
        }
        
        // Apply LRU eviction
        return evictOldMessages(updatedMessages, groupId);
      });
      
      setHasMoreMessages(prev => ({
        ...prev,
        [groupId]: response.hasMore,
      }));
      
      return response;
    } catch (error) {
      console.error('Error loading messages:', error);
      throw error;
    } finally {
      setIsLoadingMessages(false);
    }
  }, [evictOldMessages]);

  // Debounced version of loadMessages - coalesces rapid calls within 300ms window
  const loadMessages = useRef(debounce(loadMessagesImpl, 300, { trailing: true })).current;

  // Send a message via WebSocket with REST fallback
  const sendMessage = useCallback(async (groupId, content, type = 'text', metadata = null) => {
    if (!groupId || !content.trim()) return null;
    
    // Create optimistic message
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage = {
      _id: tempId,
      groupId,
      senderId: {
        _id: user?.id,
        name: user?.name,
        email: user?.email,
      },
      content: content.trim(),
      type: 'text', // Security: Always text for client messages
      readBy: [user?.id],
      createdAt: new Date().toISOString(),
      _status: 'sending',
    };
    
    // Add optimistic message to state
    setMessages(prev => ({
      ...prev,
      [groupId]: [...(prev[groupId] || []), optimisticMessage],
    }));
    
    // Try WebSocket first for real-time delivery with ack
    const socket = getSocket();
    if (socket && socket.connected) {
      try {
        const ackResponse = await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Socket ack timeout'));
          }, 5000); // 5 second timeout for ack
          
          socket.emit('chat:send', {
            groupId,
            content: content.trim(),
            tempId,
          }, (response) => {
            clearTimeout(timeoutId);
            if (response.success) {
              resolve(response);
            } else {
              reject(new Error(response.error || 'Socket send failed'));
            }
          });
        });
        
        // Socket send succeeded - update optimistic message with real data
        // Note: chat:new event will also fire, but we handle dedup in the listener
        setMessages(prev => ({
          ...prev,
          [groupId]: (prev[groupId] || []).map(m => 
            m._id === tempId ? { ...ackResponse.message, _status: 'sent' } : m
          ),
        }));
        
        return ackResponse.message;
      } catch (socketError) {
        console.warn('Socket send failed, falling back to REST:', socketError.message);
        // Fall through to REST fallback
      }
    }
    
    // REST fallback for offline or socket failure
    try {
      const body = {
        content: content.trim(),
      };
      const response = await apiClient.post(`/groups/${groupId}/messages`, body);
      
      // Replace optimistic message with real one
      setMessages(prev => ({
        ...prev,
        [groupId]: (prev[groupId] || []).map(m => 
          m._id === tempId ? { ...response, _status: 'sent' } : m
        ),
      }));
      
      return response;
    } catch (error) {
      // Mark message as failed
      setMessages(prev => ({
        ...prev,
        [groupId]: (prev[groupId] || []).map(m => 
          m._id === tempId ? { 
            ...m, 
            _status: 'failed',
            _error: error.message,
            _retryAfter: error.message.includes('Too many requests') ? 3000 : null
          } : m
        ),
      }));
      console.error('Error sending message:', error);
      throw error;
    }
  }, [user]);

  // Retry sending a failed message via WebSocket with REST fallback
  const retryMessage = useCallback(async (groupId, tempId) => {
    const groupMessages = messages[groupId] || [];
    const failedMessage = groupMessages.find(m => m._id === tempId && m._status === 'failed');
    
    if (!failedMessage) return;
    
    // Update status to sending
    setMessages(prev => ({
      ...prev,
      [groupId]: (prev[groupId] || []).map(m => 
        m._id === tempId ? { ...m, _status: 'sending' } : m
      ),
    }));
    
    // Try WebSocket first
    const socket = getSocket();
    if (socket && socket.connected) {
      try {
        const ackResponse = await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Socket ack timeout'));
          }, 5000);
          
          socket.emit('chat:send', {
            groupId,
            content: failedMessage.content,
            tempId,
          }, (response) => {
            clearTimeout(timeoutId);
            if (response.success) {
              resolve(response);
            } else {
              reject(new Error(response.error || 'Socket send failed'));
            }
          });
        });
        
        // Replace with real message
        setMessages(prev => ({
          ...prev,
          [groupId]: (prev[groupId] || []).map(m => 
            m._id === tempId ? { ...ackResponse.message, _status: 'sent' } : m
          ),
        }));
        
        return ackResponse.message;
      } catch (socketError) {
        console.warn('Socket retry failed, falling back to REST:', socketError.message);
        // Fall through to REST fallback
      }
    }
    
    // REST fallback
    try {
      const body = {
        content: failedMessage.content,
      };
      const response = await apiClient.post(`/groups/${groupId}/messages`, body);
      
      // Replace with real message
      setMessages(prev => ({
        ...prev,
        [groupId]: (prev[groupId] || []).map(m => 
          m._id === tempId ? { ...response, _status: 'sent' } : m
        ),
      }));
      
      return response;
    } catch (error) {
      // Mark as failed again
      setMessages(prev => ({
        ...prev,
        [groupId]: (prev[groupId] || []).map(m => 
          m._id === tempId ? { ...m, _status: 'failed' } : m
        ),
      }));
      throw error;
    }
  }, [messages]);

  // Edit a message
  const editMessage = useCallback(async (groupId, messageId, content) => {
    if (!groupId || !messageId || !content.trim()) return false;
    
    try {
      const response = await apiClient.put(`/groups/${groupId}/messages/${messageId}`, {
        content: content.trim(),
      });
      
      // Update message in state
      setMessages(prev => ({
        ...prev,
        [groupId]: (prev[groupId] || []).map(m => 
          m._id === messageId ? response : m
        ),
      }));
      
      return true;
    } catch (error) {
      console.error('Error editing message:', error);
      throw error;
    }
  }, []);

  // Delete a message
  const deleteMessage = useCallback(async (groupId, messageId) => {
    if (!groupId || !messageId) return false;
    
    try {
      await apiClient.delete(`/groups/${groupId}/messages/${messageId}`);
      
      // Mark message as deleted in state
      setMessages(prev => ({
        ...prev,
        [groupId]: (prev[groupId] || []).map(m => 
          m._id === messageId 
            ? { ...m, deletedAt: new Date().toISOString(), content: '[Message deleted]' }
            : m
        ),
      }));
      
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }, []);

  // Mark messages as read
  const markAsRead = useCallback(async (groupId, messageIds) => {
    if (!groupId || !messageIds.length) return;
    
    try {
      await apiClient.post(`/groups/${groupId}/messages/read`, {
        messageIds,
      });
      
      // Update read status in state
      setMessages(prev => ({
        ...prev,
        [groupId]: (prev[groupId] || []).map(m => {
          if (messageIds.includes(m._id)) {
            const readBy = m.readBy || [];
            if (!readBy.includes(user?.id)) {
              return { ...m, readBy: [...readBy, user?.id] };
            }
          }
          return m;
        }),
      }));
      
      // Update unread count
      setUnreadCounts(prev => ({
        ...prev,
        [groupId]: Math.max(0, (prev[groupId] || 0) - messageIds.length),
      }));
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [user]);

  // Fetch unread count for a group with deduplication
  const fetchUnreadCount = useCallback(async (groupId) => {
    if (!groupId) return 0;
    
    // Use deduplicator to prevent multiple in-flight requests for same groupId
    const deduplicator = unreadDeduplicatorRef.current;
    const key = `unread:${groupId}`;
    
    try {
      const response = await deduplicator.track(key, async () => {
        return apiClient.get(`/groups/${groupId}/messages/unread`);
      });
      
      setUnreadCounts(prev => ({
        ...prev,
        [groupId]: response.count,
      }));
      return response.count;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
  }, []);

  // Fetch unread counts for multiple groups (batch) with debouncing
  const fetchUnreadCountsForGroupsImpl = useCallback(async (groupIds) => {
    if (!groupIds || groupIds.length === 0) return {};
    
    // Use deduplicator to prevent multiple in-flight batch requests
    const deduplicator = unreadDeduplicatorRef.current;
    const key = `unread:batch:${groupIds.sort().join(',')}`;
    
    try {
      const response = await deduplicator.track(key, async () => {
        return apiClient.post('/groups/batch/unread-counts', { groupIds });
      });
      
      const counts = response.counts || {};
      
      setUnreadCounts(prev => ({
        ...prev,
        ...counts,
      }));
      
      return counts;
    } catch (error) {
      console.error('Error fetching batch unread counts:', error);
      return {};
    }
  }, []);

  // Debounced batch unread count fetcher - coalesces rapid batch calls within 250ms window
  const fetchUnreadCountsForGroups = useRef(
    debounce(fetchUnreadCountsForGroupsImpl, 250, { trailing: true })
  ).current;

  // Send typing indicator
  const sendTypingIndicator = useCallback((groupId, isTyping) => {
    const socket = getSocket();
    if (!socket || !groupId) return;
    
    socket.emit('chat:typing', {
      groupId,
      isTyping,
      userName: user?.name,
    });
  }, [user]);

  // Subscribe to a group's chat events
  // Comment 4: Reference-counted subscriptions - increments count if already subscribed
  const subscribeToGroup = useCallback((groupId) => {
    if (!groupId) return;
    
    const currentCount = subscribedGroupsRef.current.get(groupId) || 0;
    subscribedGroupsRef.current.set(groupId, currentCount + 1);
    
    // Only emit join:group if this is the first subscription
    if (currentCount === 0) {
      const socket = initializeSocket();
      if (!socket) return;
      
      // Join the group room
      socket.emit('join:group', groupId);
      
      // Fetch initial unread count
      fetchUnreadCount(groupId);
    }
  }, [fetchUnreadCount]);

  // Unsubscribe from a group's chat events
  // Comment 4: Reference-counted subscriptions - only emits leave:group when count reaches 0
  const unsubscribeFromGroup = useCallback((groupId) => {
    if (!groupId) return;
    
    const currentCount = subscribedGroupsRef.current.get(groupId) || 0;
    
    if (currentCount <= 1) {
      // Last subscription, actually leave the group
      subscribedGroupsRef.current.delete(groupId);
      
      const socket = getSocket();
      if (socket) {
        socket.emit('leave:group', groupId);
      }
      
      // Clear typing timeout
      if (typingTimeoutRef.current[groupId]) {
        clearTimeout(typingTimeoutRef.current[groupId]);
        delete typingTimeoutRef.current[groupId];
      }
    } else {
      // Decrement count, don't actually leave
      subscribedGroupsRef.current.set(groupId, currentCount - 1);
    }
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!user) return;
    
    const socket = initializeSocket();
    if (!socket) return;
    
    // New message received
    const handleNewMessage = (message) => {
      const groupId = message.groupId?._id || message.groupId;
      const messageId = message._id;
      const senderId = message.senderId?._id || message.senderId;
      
      setMessages(prev => {
        const existingMessages = prev[groupId] || [];
        
        // Check for exact duplicate by _id
        if (existingMessages.some(m => m._id === messageId)) {
          return prev;
        }
        
        // Check if this is from current user and we have an optimistic message
        // that was already updated via ack (same content, recent timestamp)
        if (senderId === user?.id) {
          const recentThreshold = 10000; // 10 seconds
          const msgTime = new Date(message.createdAt).getTime();
          const hasSimilarRecentMessage = existingMessages.some(m => {
            // Skip temp messages (not yet confirmed)
            if (m._id?.startsWith?.('temp-')) return false;
            // Check if it's a recent message with same content from same sender
            const mTime = new Date(m.createdAt).getTime();
            return m.content === message.content && 
                   Math.abs(mTime - msgTime) < recentThreshold &&
                   (m.senderId?._id || m.senderId) === senderId;
          });
          if (hasSimilarRecentMessage) {
            return prev;
          }
        }
        
        const updatedMessages = {
          ...prev,
          [groupId]: [...existingMessages, message],
        };
        
        // Apply LRU eviction to prevent memory bloat
        return evictOldMessages(updatedMessages, groupId);
      });
      
      // Increment unread count if not from current user
      if (senderId !== user.id) {
        setUnreadCounts(prev => ({
          ...prev,
          [groupId]: (prev[groupId] || 0) + 1,
        }));
      }
    };
    
    // Message edited
    const handleEditMessage = (message) => {
      const groupId = message.groupId?._id || message.groupId;
      
      setMessages(prev => ({
        ...prev,
        [groupId]: (prev[groupId] || []).map(m => 
          m._id === message._id ? message : m
        ),
      }));
    };
    
    // Message deleted
    const handleDeleteMessage = (data) => {
      const { messageId } = data;
      
      // Find which group this message belongs to
      setMessages(prev => {
        const updated = { ...prev };
        for (const groupId of Object.keys(updated)) {
          updated[groupId] = updated[groupId].map(m => 
            m._id === messageId 
              ? { ...m, deletedAt: new Date().toISOString(), content: '[Message deleted]' }
              : m
          );
        }
        return updated;
      });
    };
    
    // Read receipt
    const handleReadReceipt = (data) => {
      const { userId, messageIds, groupId } = data;
      
      setMessages(prev => ({
        ...prev,
        [groupId]: (prev[groupId] || []).map(m => {
          if (messageIds.includes(m._id)) {
            const readBy = m.readBy || [];
            if (!readBy.includes(userId)) {
              return { ...m, readBy: [...readBy, userId] };
            }
          }
          return m;
        }),
      }));
    };
    
    // Typing indicator
    const handleTyping = (data) => {
      const { userId, userName, isTyping, groupId } = data;
      
      setTypingUsers(prev => {
        const groupTyping = new Map(prev[groupId] || []);
        
        if (isTyping) {
          groupTyping.set(userId, { userId, userName });
        } else {
          groupTyping.delete(userId);
        }
        
        return {
          ...prev,
          [groupId]: groupTyping,
        };
      });
      
      // Auto-clear typing after 5 seconds
      if (isTyping) {
        if (typingTimeoutRef.current[`${groupId}-${userId}`]) {
          clearTimeout(typingTimeoutRef.current[`${groupId}-${userId}`]);
        }
        typingTimeoutRef.current[`${groupId}-${userId}`] = setTimeout(() => {
          setTypingUsers(prev => {
            const groupTyping = new Map(prev[groupId] || []);
            groupTyping.delete(userId);
            return {
              ...prev,
              [groupId]: groupTyping,
            };
          });
        }, 5000);
      }
    };
    
    // User online
    const handleUserOnline = (data) => {
      const { userId, groupId } = data;
      
      setOnlineUsers(prev => {
        const groupOnline = new Set(prev[groupId] || []);
        groupOnline.add(userId);
        return {
          ...prev,
          [groupId]: groupOnline,
        };
      });
    };
    
    // User offline
    const handleUserOffline = (data) => {
      const { userId, groupId } = data;
      
      setOnlineUsers(prev => {
        const groupOnline = new Set(prev[groupId] || []);
        groupOnline.delete(userId);
        return {
          ...prev,
          [groupId]: groupOnline,
        };
      });
    };
    
    // Online users list
    const handleOnlineUsers = (data) => {
      const { groupId, users } = data;
      
      setOnlineUsers(prev => ({
        ...prev,
        [groupId]: new Set(users),
      }));
    };
    
    // Register event listeners
    socket.on('chat:new', handleNewMessage);
    socket.on('chat:edit', handleEditMessage);
    socket.on('chat:delete', handleDeleteMessage);
    socket.on('chat:read', handleReadReceipt);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:userOnline', handleUserOnline);
    socket.on('chat:userOffline', handleUserOffline);
    socket.on('chat:onlineUsers', handleOnlineUsers);
    
    // Handle reconnection - rejoin all subscribed groups
    const handleReconnect = () => {
      console.log('Socket reconnected, rejoining groups...');
      // Comment 4: Iterate over Map keys instead of Set
      subscribedGroupsRef.current.forEach((count, groupId) => {
        if (count > 0) {
          socket.emit('join:group', groupId);
        }
      });
    };
    socket.on('connect', handleReconnect);
    
    return () => {
      socket.off('chat:new', handleNewMessage);
      socket.off('chat:edit', handleEditMessage);
      socket.off('chat:delete', handleDeleteMessage);
      socket.off('chat:read', handleReadReceipt);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:userOnline', handleUserOnline);
      socket.off('chat:userOffline', handleUserOffline);
      socket.off('chat:onlineUsers', handleOnlineUsers);
      socket.off('connect', handleReconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Clear state when user logs out
  useEffect(() => {
    if (!user) {
      setMessages({});
      setUnreadCounts({});
      setTypingUsers({});
      setOnlineUsers({});
      setHasMoreMessages({});
      subscribedGroupsRef.current.clear(); // Works for both Set and Map
    }
  }, [user]);

  // Get messages for a group
  const getGroupMessages = useCallback((groupId) => {
    return messages[groupId] || [];
  }, [messages]);

  // Get unread count for a group
  const getUnreadCount = useCallback((groupId) => {
    return unreadCounts[groupId] || 0;
  }, [unreadCounts]);

  // Get typing users for a group
  const getTypingUsers = useCallback((groupId) => {
    const typing = typingUsers[groupId];
    return typing ? Array.from(typing.values()) : [];
  }, [typingUsers]);

  // Check if a user is online in a group
  const isUserOnline = useCallback((groupId, userId) => {
    const online = onlineUsers[groupId];
    return online ? online.has(userId) : false;
  }, [onlineUsers]);

  // Get online users for a group
  const getOnlineUsers = useCallback((groupId) => {
    return Array.from(onlineUsers[groupId] || []);
  }, [onlineUsers]);

  // Memoize context value
  const contextValue = useMemo(() => ({
    messages,
    unreadCounts,
    typingUsers,
    onlineUsers,
    isLoadingMessages,
    hasMoreMessages,
    loadMessages, // Debounced function
    sendMessage,
    retryMessage,
    editMessage,
    deleteMessage,
    markAsRead,
    fetchUnreadCount,
    fetchUnreadCountsForGroups, // Debounced function
    sendTypingIndicator,
    subscribeToGroup,
    unsubscribeFromGroup,
    getGroupMessages,
    getUnreadCount,
    getTypingUsers,
    isUserOnline,
    getOnlineUsers,
  }), [
    messages,
    unreadCounts,
    typingUsers,
    onlineUsers,
    isLoadingMessages,
    hasMoreMessages,
    sendMessage,
    retryMessage,
    editMessage,
    deleteMessage,
    markAsRead,
    fetchUnreadCount,
    sendTypingIndicator,
    subscribeToGroup,
    unsubscribeFromGroup,
    getGroupMessages,
    getUnreadCount,
    getTypingUsers,
    isUserOnline,
    getOnlineUsers,
    // Note: loadMessages and fetchUnreadCountsForGroups are debounced refs
    // and don't need to be in deps as they maintain stable reference
  ]);

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

// Custom hook to use the Chat Context
export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
