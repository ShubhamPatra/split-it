import User from '../models/User.js';
import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import Notification from '../models/Notification.js';
import Message from '../models/Message.js';

// Helper function to safely create indexes, ignoring conflicts
const safeCreateIndex = async (collection, spec, options = {}) => {
  try {
    await collection.createIndex(spec, options);
  } catch (error) {
    // Ignore index conflict errors (code 86)
    if (error.code === 86 || error.codeName === 'IndexKeySpecsConflict') {
      console.log(`ℹ️  Index already exists with different specs, skipping: ${JSON.stringify(spec)}`);
    } else {
      throw error;
    }
  }
};

// Create database indexes for better query performance
export const createIndexes = async () => {
  try {
    // User indexes
    await safeCreateIndex(User.collection, { email: 1 }, { unique: true });
    await safeCreateIndex(User.collection, { googleId: 1 }, { unique: true, sparse: true, background: true });
    
    // Group indexes
    await safeCreateIndex(Group.collection, { members: 1 });
    await safeCreateIndex(Group.collection, { createdBy: 1 });
    await safeCreateIndex(Group.collection, { createdAt: -1 });
    await safeCreateIndex(Group.collection, { members: 1, createdAt: -1 });
    await safeCreateIndex(Group.collection, { inviteCode: 1 }, { unique: true, sparse: true, background: true });
    
    // Expense indexes - optimized for common queries
    await safeCreateIndex(Expense.collection, { groupId: 1, date: -1 });
    await safeCreateIndex(Expense.collection, { paidBy: 1, date: -1 });
    await safeCreateIndex(Expense.collection, { splitAmong: 1 });
    await safeCreateIndex(Expense.collection, { groupId: 1, date: -1, paidBy: 1 });
    await safeCreateIndex(Expense.collection, { groupId: 1, splitAmong: 1, date: -1 });
    // Index for recurring expense queries
    await safeCreateIndex(
      Expense.collection,
      { 'recurrence.enabled': 1, 'recurrence.nextRunAt': 1 },
      { partialFilterExpression: { 'recurrence.enabled': true } }
    );
    // Index for budget calculations (amount aggregation by date)
    await safeCreateIndex(Expense.collection, { groupId: 1, date: 1, amount: 1 });
    
    // SetsafeCreateIndex(Settlement.collection, { groupId: 1, settledAt: -1 });
    await safeCreateIndex(Settlement.collection, { groupId: 1, fromUserId: 1, settledAt: -1 });
    await safeCreateIndex(Settlement.collection, { groupId: 1, toUserId: 1, settledAt: -1 });
    await safeCreateIndex(Settlement.collection, { fromUserId: 1, settledAt: -1 });
    await safeCreateIndex(Settlement.collection, { toUserId: 1, settledAt: -1 });
    await safeCreateIndex(Settlement.collection, { groupId: 1, paymentStatus: 1, settledAt: -1 });
    await safeCreateIndex(Settlement.collection, { toUserId: 1, paymentStatus: 1, settledAt: -1 });
    await safeCreateIndex(Settlement.collection, { toUserId: 1, paymentStatus: 1, settledAt: -1 });
    await Settlement.collection.createIndex({ transactionRef: 1 }, { sparse: true });
    
    // NotsafeCreateIndex(Notification.collection, { userId: 1, timestamp: -1 });
    await safeCreateIndex(Notification.collection, { userId: 1, read: 1, timestamp: -1 });
    await safeCreateIndex(
      Notification.collection,
      { userId: 1, read: 1 },
      { partialFilterExpression: { read: false } }
    );
    await safeCreateIndex(Notification.collection, { actionType: 1, relatedId: 1 });
    // TTL index for auto-cleanup after 30 days
    await safeCreateIndex(
      Notification.collection,s
    await Notification.collection.createIndex(
      { timestamp: 1 },
      { expireAfterSeconds: 2592000 }
    );
    safeCreateIndex(Message.collection, { groupId: 1, _id: -1 });
    // Message indexes - unread count scans (partial on non-deleted messages)
    await safeCreateIndex(
      Message.collection,
      { groupId: 1, deletedAt: 1, senderId: 1, readBy: 1, createdAt: -1 },
      { partialFilterExpression: { deletedAt: null } }
    );
    // Message indexes - createdAt-based queries
    await safeCreateIndex(Message.collection, { groupId: 1, createdAt: -1 });
    // Message indexes - unread count optimization
    await safeCreateIndex(
      Message.collection,{ groupId: 1, createdAt: -1 });
    // Message indexes - unread count optimization
    await Message.collection.createIndex(
      { groupId: 1, senderId: 1, readBy: 1 },
      { partialFilterExpression: { deletedAt: null } }
    );
    
    console.log('✅ Database indexes created successfully');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  }
};
