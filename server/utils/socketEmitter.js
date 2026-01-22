// Helper to emit events from controllers
export const emitToGroup = (io, groupId, event, data) => {
  io.to(`group:${groupId}`).emit(event, data);
};

export const emitToUser = (io, userId, event, data) => {
  io.to(`user:${userId}`).emit(event, data);
};

// Emit notification to a specific user
export const emitNotification = (io, userId, notification) => {
  io.to(`user:${userId}`).emit('notification:new', notification);
};

// Emit notification read update
export const emitNotificationUpdate = (io, userId, notificationId) => {
  io.to(`user:${userId}`).emit('notification:read', { notificationId });
};

// Emit notification deletion
export const emitNotificationDeleted = (io, userId, notificationId) => {
  io.to(`user:${userId}`).emit('notification:deleted', { notificationId });
};

// Emit analytics update to group
// Emits specific event based on action: expenseAdded, expenseRemoved, balanceUpdated, categoryUpdated
export const emitAnalyticsUpdate = (io, groupId, analyticsData) => {
  const { action, ...data } = analyticsData;
  const eventData = { groupId, ...data };

  switch (action) {
    case 'expenseAdded':
      io.to(`group:${groupId}`).emit('analytics:expenseAdded', eventData);
      break;
    case 'expenseRemoved':
      io.to(`group:${groupId}`).emit('analytics:expenseRemoved', eventData);
      break;
    case 'expenseUpdated':
      // For updates, emit both category and balance updates
      io.to(`group:${groupId}`).emit('analytics:categoryUpdated', eventData);
      io.to(`group:${groupId}`).emit('analytics:balanceUpdated', eventData);
      break;
    case 'balanceUpdated':
      io.to(`group:${groupId}`).emit('analytics:balanceUpdated', eventData);
      break;
    case 'categoryUpdated':
      io.to(`group:${groupId}`).emit('analytics:categoryUpdated', eventData);
      break;
    default:
      // Fallback to expenseAdded for backwards compatibility
      io.to(`group:${groupId}`).emit('analytics:expenseAdded', eventData);
  }
};

// Emit chat message to group
export const emitChatMessage = (io, groupId, message) => {
  io.to(`group:${groupId}`).emit('chat:new', message);
};

// Emit typing indicator to group
export const emitChatTyping = (io, groupId, data) => {
  io.to(`group:${groupId}`).emit('chat:typing', data);
};

// Emit message read receipt to group
export const emitChatMessageRead = (io, groupId, data) => {
  io.to(`group:${groupId}`).emit('chat:read', data);
};

// Emit balance update to group
export const emitBalanceUpdate = (io, groupId, balances) => {
  io.to(`group:${groupId}`).emit('balance:update', { groupId, balances });
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
  io.to(`group:${groupId}`).emit('chat:userOffline', { userId, groupId });

  // Also emit typing stopped in case they were typing
  io.to(`group:${groupId}`).emit('chat:typing', {
    userId,
    isTyping: false,
    groupId,
  });

  // Force all user's sockets to leave the group room
  const sockets = await io.in(`user:${userId}`).fetchSockets();
  for (const socket of sockets) {
    socket.leave(`group:${groupId}`);
  }
};

// Emit cross-group settlement to multiple group rooms
export const emitCrossGroupSettlement = (io, groupIds, settlement) => {
  for (const groupId of groupIds) {
    io.to(`group:${groupId}`).emit('settlement:crossGroup:created', settlement);
  }
};

// Emit people balance update to a specific user
export const emitPeopleBalanceUpdate = (io, userId, balances) => {
  io.to(`user:${userId}`).emit('people:balance:update', balances);
};

// Emit settlement confirmation for cross-group settlements
export const emitCrossGroupSettlementConfirmed = (io, groupIds, settlement) => {
  for (const groupId of groupIds) {
    io.to(`group:${groupId}`).emit('settlement:crossGroup:confirmed', settlement);
  }
};

