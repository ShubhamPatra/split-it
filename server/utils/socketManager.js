import { Server } from 'socket.io';

let io = null;

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    const userId = socket.handshake.auth.userId;
    console.log(`User connected: ${userId}`);

    // Join user's personal room
    if (userId) {
      socket.join(`user_${userId}`);
    }

    // Join a group room
    socket.on('join_group', (groupId) => {
      socket.join(`group_${groupId}`);
      console.log(`User ${userId} joined group ${groupId}`);
    });

    // Leave a group room
    socket.on('leave_group', (groupId) => {
      socket.leave(`group_${groupId}`);
      console.log(`User ${userId} left group ${groupId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`User disconnected: ${userId}, reason: ${reason}`);
    });

    socket.on('error', (error) => {
      console.error(`Socket error for user ${userId}:`, error);
    });
  });

  return io;
};

// Emit to a specific group
export const emitToGroup = (groupId, event, data) => {
  if (io) {
    io.to(`group_${groupId}`).emit(event, data);
  }
};

// Emit to a specific user
export const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
};

// Emit expense updates
export const emitExpenseAdded = (groupId, expense) => {
  emitToGroup(groupId, 'expense_added', expense);
};

export const emitExpenseUpdated = (groupId, expense) => {
  emitToGroup(groupId, 'expense_updated', expense);
};

export const emitExpenseDeleted = (groupId, expenseId) => {
  emitToGroup(groupId, 'expense_deleted', { expenseId });
};

// Emit settlement updates
export const emitSettlementCreated = (groupId, settlement) => {
  emitToGroup(groupId, 'settlement_created', settlement);
};

export const emitSettlementConfirmed = (groupId, settlement) => {
  emitToGroup(groupId, 'settlement_confirmed', settlement);
};

// Emit group updates
export const emitMemberJoined = (groupId, member) => {
  emitToGroup(groupId, 'member_joined', member);
};

export const emitGroupUpdated = (groupId, group) => {
  emitToGroup(groupId, 'group_updated', group);
};

// Emit budget alerts
export const emitBudgetAlert = (groupId, data) => {
  emitToGroup(groupId, 'budget_alert', data);
};

export const getIO = () => io;

export default {
  initializeSocket,
  emitToGroup,
  emitToUser,
  emitExpenseAdded,
  emitExpenseUpdated,
  emitExpenseDeleted,
  emitSettlementCreated,
  emitSettlementConfirmed,
  emitMemberJoined,
  emitGroupUpdated,
  emitBudgetAlert,
  getIO,
};
