import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MessageSquare, Loader2, WifiOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useGroups } from '../../context/GroupContext';
import { Button } from '../ui/button';
import MessageGroup from './MessageGroup';
import MessageInput from './MessageInput';
import DateSeparator from './DateSeparator';
import TypingIndicator from './TypingIndicator';
import NewMessageIndicator from './NewMessageIndicator';
import EmptyState from './EmptyState';
import { SkeletonMessageList } from './SkeletonMessage';

const GroupChat = ({ groupId }) => {
  const { user } = useAuth();
  const { getGroupById, getUserProfile } = useGroups();
  const { 
    loadMessages, 
    sendMessage, 
    editMessage, 
    deleteMessage,
    retryMessage,
    markAsRead,
    sendTypingIndicator,
    // Comment 4: Removed subscribeToGroup/unsubscribeFromGroup - managed by GroupDetail.jsx
    getGroupMessages,
    getTypingUsers,
    hasMoreMessages,
  } = useChat();

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false);

  const messages = getGroupMessages(groupId);
  const typingUsers = getTypingUsers(groupId);
  const group = getGroupById(groupId);
  const hasMore = hasMoreMessages[groupId] ?? true;

  // Check if user is a group member
  const isGroupMember = group?.members?.includes(user?.id);

  // Ref for the scrollable container
  const parentRef = useRef(null);
  
  // Track if we should auto-scroll to bottom
  const shouldAutoScrollRef = useRef(true);
  const prevMessagesLengthRef = useRef(0);
  // Track the newest message ID to distinguish new messages from loaded history
  const newestMessageIdRef = useRef(null);
  // Track if we just finished loading older messages
  const justLoadedOlderRef = useRef(false);
  // Track countdown interval for rate-limit retry cleanup
  const countdownIntervalRef = useRef(null);

  // Comment 4: Removed subscription effect - GroupDetail.jsx already manages chat subscriptions
  // This prevents double subscription/unsubscription that could stop unread updates

  // Group consecutive messages from the same sender within 5 minutes
  const groupMessages = useCallback((msgs) => {
    const groups = [];
    let currentGroup = null;

    msgs.forEach((message, index) => {
      const senderId = message.senderId?._id || message.senderId;
      const prevMessage = index > 0 ? msgs[index - 1] : null;
      const prevSenderId = prevMessage ? (prevMessage.senderId?._id || prevMessage.senderId) : null;
      
      // Check if we should start a new group
      const timeDiff = prevMessage 
        ? new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime()
        : Infinity;
      
      const shouldStartNewGroup = 
        !currentGroup ||
        senderId !== prevSenderId ||
        timeDiff > 5 * 60 * 1000 || // More than 5 minutes apart
        message.type === 'system' ||
        prevMessage?.type === 'system' ||
        new Date(message.createdAt).toDateString() !== new Date(prevMessage?.createdAt || 0).toDateString();

      if (shouldStartNewGroup) {
        currentGroup = {
          id: `group-${message._id}`,
          senderId,
          messages: [message],
          firstMessageDate: message.createdAt,
        };
        groups.push(currentGroup);
      } else {
        currentGroup.messages.push(message);
      }
    });

    return groups;
  }, []);
  
  // Build list items with date separators and message groups integrated
  const listItems = useMemo(() => {
    const items = [];
    const messageGroups = groupMessages(messages);
    
    messageGroups.forEach((messageGroup, index) => {
      const firstMessage = messageGroup.messages[0];
      const previousGroup = index > 0 ? messageGroups[index - 1] : null;
      const previousFirstMessage = previousGroup?.messages[0];
      
      // Check if we need a date separator
      if (!previousFirstMessage || 
          new Date(firstMessage.createdAt).toDateString() !== new Date(previousFirstMessage.createdAt).toDateString()) {
        items.push({ 
          type: 'date', 
          date: firstMessage.createdAt, 
          key: `date-${firstMessage.createdAt}` 
        });
      }
      
      // Add the message group
      items.push({
        type: 'messageGroup',
        group: messageGroup,
        key: messageGroup.id,
      });
    });
    
    return items;
  }, [messages, groupMessages]);

  // Virtualizer setup
  const virtualizer = useVirtualizer({
    count: listItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = listItems[index];
      if (item?.type === 'date') return 56; // Date separator height
      if (item?.type === 'messageGroup') {
        // Estimate based on number of messages in group
        const msgCount = item.group.messages.length;
        return 60 + (msgCount - 1) * 40; // Base height + additional messages
      }
      return 80;
    },
    overscan: 5,
  });

  // Comment 4: Subscription effect removed - GroupDetail.jsx manages chat subscriptions
  // This prevents the issue where closing the chat panel would unsubscribe and stop unread updates
  // Reference counting in ChatContext ensures proper cleanup when ALL components unsubscribe

  // Reset unread tracking state when switching groups
  useEffect(() => {
    // Clear any existing countdown interval to prevent stale retries
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    
    prevMessagesLengthRef.current = 0;
    newestMessageIdRef.current = null;
    justLoadedOlderRef.current = false;
    shouldAutoScrollRef.current = true;
    setShowNewMessageIndicator(false);
    setUnreadCount(0);
    setIsRateLimited(false);
    setRetryCountdown(0);
    setError(null);
    
    // Cleanup on unmount or group change
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [groupId]);

  // Load initial messages
  useEffect(() => {
    // Clear any existing countdown interval before starting new load
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    
    const loadInitialMessages = async () => {
      if (!groupId) return;
      
      setIsInitialLoading(true);
      setError(null);
      setIsRateLimited(false);
      
      try {
        await loadMessages(groupId);
      } catch (err) {
        // Check if it's a rate limit error
        if (err.message?.includes('Too many requests') || err.status === 429) {
          setIsRateLimited(true);
          const retryAfter = err.retryAfter || 3;
          setRetryCountdown(retryAfter);
          setError(`Too many requests. Retrying in ${retryAfter} seconds...`);
          
          // Start countdown and auto-retry, store interval ID in ref for cleanup
          countdownIntervalRef.current = setInterval(() => {
            setRetryCountdown(prev => {
              if (prev <= 1) {
                // Clear interval when countdown completes
                if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current);
                  countdownIntervalRef.current = null;
                }
                // Auto-retry after countdown
                loadInitialMessages();
                return 0;
              }
              setError(`Too many requests. Retrying in ${prev - 1} seconds...`);
              return prev - 1;
            });
          }, 1000);
          
          return;
        }
        
        setError('Failed to load messages. Please try again.');
        console.error('Error loading messages:', err);
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadInitialMessages();
    
    // Cleanup interval on effect re-run or unmount
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [groupId, loadMessages]);

  // Scroll to bottom on new messages (only if already at bottom)
  useEffect(() => {
    if (!isLoadingMore && listItems.length > 0 && parentRef.current) {
      // Get the newest message (last in the array)
      const newestMessage = messages.length > 0 ? messages[messages.length - 1] : null;
      const newestMsgId = newestMessage?._id;
      
      // Check if we just finished loading older messages (prepended history)
      if (justLoadedOlderRef.current) {
        // This was a load-more operation, just update refs without triggering indicator
        justLoadedOlderRef.current = false;
        prevMessagesLengthRef.current = messages.length;
        // Don't update newestMessageIdRef - it should stay the same since we loaded older msgs
        return;
      }
      
      // Check if new messages were actually appended (not prepended history)
      const hasNewMessages = messages.length > prevMessagesLengthRef.current && 
        newestMsgId !== newestMessageIdRef.current;
      
      if (hasNewMessages) {
        if (shouldAutoScrollRef.current) {
          virtualizer.scrollToIndex(listItems.length - 1, { align: 'end', behavior: 'smooth' });
          setUnreadCount(0);
          setShowNewMessageIndicator(false);
        } else {
          // User is scrolled up, show indicator
          const newMsgCount = messages.length - prevMessagesLengthRef.current;
          setUnreadCount(prev => prev + newMsgCount);
          setShowNewMessageIndicator(true);
        }
      }
      
      prevMessagesLengthRef.current = messages.length;
      newestMessageIdRef.current = newestMsgId;
    }
  }, [listItems.length, messages.length, messages, isLoadingMore, virtualizer]);

  // Track scroll position to determine if auto-scroll should happen
  const handleScroll = useCallback(() => {
    if (!parentRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    // Auto-scroll if within 100px of bottom
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    shouldAutoScrollRef.current = isNearBottom;
    
    // Hide new message indicator when user scrolls to bottom
    if (isNearBottom) {
      setShowNewMessageIndicator(false);
      setUnreadCount(0);
    }
  }, []);

  // Scroll to bottom handler
  const scrollToBottom = useCallback(() => {
    virtualizer.scrollToIndex(listItems.length - 1, { align: 'end', behavior: 'smooth' });
    setShowNewMessageIndicator(false);
    setUnreadCount(0);
    shouldAutoScrollRef.current = true;
  }, [virtualizer, listItems.length]);

  // Track online status
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

  // Mark visible messages as read (triggered by virtualizer range changes)
  const markAsReadTimeoutRef = useRef(null);
  const lastVisibleRangeRef = useRef({ start: -1, end: -1 });
  
  useEffect(() => {
    if (!user?.id || !listItems.length) return;
    
    // Get currently visible items from virtualizer
    const virtualItems = virtualizer.getVirtualItems();
    if (virtualItems.length === 0) return;
    
    const startIndex = virtualItems[0].index;
    const endIndex = virtualItems[virtualItems.length - 1].index;
    
    // Only run if the visible range actually changed
    if (lastVisibleRangeRef.current.start === startIndex && 
        lastVisibleRangeRef.current.end === endIndex) {
      return;
    }
    lastVisibleRangeRef.current = { start: startIndex, end: endIndex };
    
    // Debounce mark as read to avoid excessive calls
    if (markAsReadTimeoutRef.current) {
      clearTimeout(markAsReadTimeoutRef.current);
    }
    
    markAsReadTimeoutRef.current = setTimeout(() => {
      // Get visible message items (not date separators)
      const visibleMessages = [];
      for (let i = startIndex; i <= endIndex; i++) {
        const item = listItems[i];
        if (item?.type === 'messageGroup') {
          item.group.messages.forEach(message => {
            const senderId = message.senderId?._id || message.senderId;
            const readBy = message.readBy || [];
            if (senderId !== user.id && !readBy.includes(user.id)) {
              visibleMessages.push(message._id);
            }
          });
        }
      }
      
      if (visibleMessages.length > 0) {
        markAsRead(groupId, visibleMessages.slice(0, 50));
      }
    }, 300);
    
    return () => {
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
      }
    };
  }, [virtualizer, listItems, user?.id, groupId, markAsRead]);

  // Load more messages
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || messages.length === 0) return;

    // Store current scroll offset from top
    const scrollOffset = virtualizer.scrollOffset;
    const oldTotalSize = virtualizer.getTotalSize();

    setIsLoadingMore(true);
    try {
      const oldestMessage = messages[0];
      await loadMessages(groupId, oldestMessage._id);
      
      // Mark that we just loaded older messages (prepended history)
      justLoadedOlderRef.current = true;
      
      // After loading, adjust scroll to maintain position
      // New messages are prepended, so we need to scroll down by the difference
      requestAnimationFrame(() => {
        const newTotalSize = virtualizer.getTotalSize();
        const sizeDiff = newTotalSize - oldTotalSize;
        if (sizeDiff > 0 && parentRef.current) {
          parentRef.current.scrollTop = scrollOffset + sizeDiff;
        }
      });
    } catch (err) {
      console.error('Error loading more messages:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Send message handler
  const handleSend = async (content) => {
    if (!content.trim()) return;
    
    try {
      await sendMessage(groupId, content);
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  // Edit message handler
  const handleEdit = async (messageId, content) => {
    await editMessage(groupId, messageId, content);
  };

  // Delete message handler
  const handleDelete = async (messageId) => {
    await deleteMessage(groupId, messageId);
  };

  // Retry failed message
  const handleRetry = async (tempId) => {
    await retryMessage(groupId, tempId);
  };

  // Typing indicator handler
  const handleTyping = (isTyping) => {
    sendTypingIndicator(groupId, isTyping);
  };

  // Loading state with skeleton
  if (isInitialLoading) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-1 overflow-hidden min-h-0 px-4">
          <SkeletonMessageList count={8} />
        </div>
        <MessageInput
          onSend={() => {}}
          onTyping={() => {}}
          disabled={true}
          placeholder="Loading messages..."
        />
      </div>
    );
  }

  // Error state
  if (error && !isRateLimited) {
    return (
      <div className="flex flex-col h-full min-h-0 items-center justify-center gap-3 text-muted-foreground">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <MessageSquare className="h-8 w-8 text-destructive" />
        </div>
        <p className="text-sm font-medium">{error}</p>
        <Button variant="outline" onClick={() => loadMessages(groupId)} className="mt-2">
          Try Again
        </Button>
      </div>
    );
  }
  
  // Rate limited state with auto-retry
  if (isRateLimited && retryCountdown > 0) {
    return (
      <div className="flex flex-col h-full min-h-0 items-center justify-center gap-3 text-muted-foreground">
        <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-warning animate-spin" />
        </div>
        <p className="text-sm font-medium text-warning">{error}</p>
        <p className="text-xs text-muted-foreground">High traffic detected. Auto-retrying...</p>
      </div>
    );
  }

  // Check if user is admin (for delete permissions)
  const isAdmin = group?.createdBy === user?.id;

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* Offline indicator */}
      {!isOnline && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-warning/10 text-warning text-sm border-b border-warning/20 animate-fade-in">
          <WifiOff size={16} />
          <span className="font-medium">You're offline.</span>
          <span className="text-warning/80">Messages will be sent when you reconnect.</span>
        </div>
      )}

      {/* Messages area - virtualized */}
      <div 
        ref={parentRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 scrollbar-hide"
        onScroll={handleScroll}
      >
        <div className="py-4">
          {/* Load more button */}
          {hasMore && messages.length > 0 && (
            <div className="flex justify-center mb-6">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="shadow-sm hover:shadow-md transition-shadow"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  'Load older messages'
                )}
              </Button>
            </div>
          )}

          {/* Empty state */}
          {messages.length === 0 && <EmptyState />}

          {/* Virtualized messages list */}
          {listItems.length > 0 && (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const item = listItems[virtualItem.index];
                
                if (item.type === 'date') {
                  return (
                    <div
                      key={item.key}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <DateSeparator date={item.date} />
                    </div>
                  );
                }
                
                if (item.type === 'messageGroup') {
                  const { group: messageGroup } = item;
                  const senderId = messageGroup.senderId;
                  const isOwn = senderId === user?.id;
                  const senderName = messageGroup.messages[0]?.senderId?.name || 
                    getUserProfile(senderId)?.name || 'Unknown User';
                  const senderInitial = senderName.charAt(0).toUpperCase();
                  
                  return (
                    <div
                      key={item.key}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                      data-index={virtualItem.index}
                      ref={virtualizer.measureElement}
                    >
                      <MessageGroup
                        messages={messageGroup.messages}
                        senderId={senderId}
                        senderName={senderName}
                        senderInitial={senderInitial}
                        isOwn={isOwn}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onRetry={handleRetry}
                        isAdmin={isAdmin}
                        getUserProfile={getUserProfile}
                      />
                    </div>
                  );
                }
                
                return null;
              })}
            </div>
          )}

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <TypingIndicator users={typingUsers} />
          )}
        </div>
      </div>

      {/* New message indicator */}
      {showNewMessageIndicator && (
        <NewMessageIndicator 
          unreadCount={unreadCount} 
          onClick={scrollToBottom} 
        />
      )}

      {/* Message input - sticky bottom */}
      <MessageInput
        onSend={handleSend}
        onTyping={handleTyping}
        disabled={!isGroupMember || !isOnline}
        placeholder={
          !isOnline 
            ? "You're offline..." 
            : !isGroupMember 
              ? "You must be a member to chat"
              : "Type a message..."
        }
      />
    </div>
  );
};

export default GroupChat;
