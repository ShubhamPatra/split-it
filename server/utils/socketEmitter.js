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
