import { groupChannel, publishRealtimeEvent, publishToGroup, publishToUser, userChannel } from '../services/realtimeService.js';

const fireAndForget = (promise) => {
  void promise.catch((error) => {
    console.error('[Realtime] Failed to publish event:', error.message);
  });
};

// Helper to emit events from controllers
export const emitToGroup = (io, groupId, event, data) => {
  fireAndForget(publishRealtimeEvent({
    channels: [groupChannel(groupId)],
    event,
    payload: data,
    audience: 'group',
    io,
  }));
};

export const emitToUser = (io, userId, event, data) => {
  fireAndForget(publishRealtimeEvent({
    channels: [userChannel(userId)],
    event,
    payload: data,
    audience: 'user',
    io,
  }));
};

// Emit notification to a specific user
export const emitNotification = (io, userId, notification) => {
  fireAndForget(publishToUser(userId, 'notification:new', notification, { io }));
};

// Emit notification read update
export const emitNotificationUpdate = (io, userId, notificationId) => {
  fireAndForget(publishToUser(userId, 'notification:read', { notificationId }, { io }));
};

// Emit notification deletion
export const emitNotificationDeleted = (io, userId, notificationId) => {
  fireAndForget(publishToUser(userId, 'notification:deleted', { notificationId }, { io }));
};

// Emit analytics update to group
// Emits specific event based on action: expenseAdded, expenseRemoved, balanceUpdated, categoryUpdated
export const emitAnalyticsUpdate = (io, groupId, analyticsData) => {
  const { action, ...data } = analyticsData;
  const eventData = { groupId, ...data };
  
  switch (action) {
    case 'expenseAdded':
      fireAndForget(publishToGroup(groupId, 'analytics:expenseAdded', eventData, { io }));
      break;
    case 'expenseRemoved':
      fireAndForget(publishToGroup(groupId, 'analytics:expenseRemoved', eventData, { io }));
      break;
    case 'expenseUpdated':
      // For updates, emit both category and balance updates
      fireAndForget(publishToGroup(groupId, 'analytics:categoryUpdated', eventData, { io }));
      fireAndForget(publishToGroup(groupId, 'analytics:balanceUpdated', eventData, { io }));
      break;
    case 'balanceUpdated':
      fireAndForget(publishToGroup(groupId, 'analytics:balanceUpdated', eventData, { io }));
      break;
    case 'categoryUpdated':
      fireAndForget(publishToGroup(groupId, 'analytics:categoryUpdated', eventData, { io }));
      break;
    default:
      // Fallback to expenseAdded for backwards compatibility
      fireAndForget(publishToGroup(groupId, 'analytics:expenseAdded', eventData, { io }));
  }
};

// Emit chat message to group
export const emitChatMessage = (io, groupId, message) => {
  fireAndForget(publishToGroup(groupId, 'chat:new', message, { io }));
};

// Emit typing indicator to group
export const emitChatTyping = (io, groupId, data) => {
  fireAndForget(publishToGroup(groupId, 'chat:typing', data, { io }));
};

// Emit message read receipt to group
export const emitChatMessageRead = (io, groupId, data) => {
  fireAndForget(publishToGroup(groupId, 'chat:read', data, { io }));
};

// Emit balance update to group
export const emitBalanceUpdate = (io, groupId, balances) => {
  fireAndForget(publishToGroup(groupId, 'balance:update', { groupId, balances }, { io }));
};

// Force a user's sockets to leave a group room (when removed from group)
// Also cleans up presence state so removed members don't appear online/typing
export const forceLeaveGroupRoom = async (io, userId, groupId) => {
  // Import presence cleanup functions from socket.js
  const { removeUserPresence, removeUserTyping } = await import('../config/socket.js');
  
  // Clean up presence state before leaving room (async for Redis support)
  await removeUserPresence(groupId, userId);
  await removeUserTyping(groupId, userId);
  
  // Emit offline event to group so other members see the user go offline
  fireAndForget(publishToGroup(groupId, 'chat:userOffline', { userId, groupId }, { io }));
  
  // Also emit typing stopped in case they were typing
  fireAndForget(publishToGroup(groupId, 'chat:typing', {
    userId,
    isTyping: false,
    groupId,
  }, { io }));
  
  // Force all user's sockets to leave the group room
  if (io?.in) {
    const sockets = await io.in(`user:${userId}`).fetchSockets();
    for (const socket of sockets) {
      socket.leave(`group:${groupId}`);
    }
  }
};
