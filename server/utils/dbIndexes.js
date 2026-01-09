import User from '../models/User.js';
import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import Notification from '../models/Notification.js';
import Message from '../models/Message.js';

// Create database indexes for better query performance
export const createIndexes = async () => {
  try {
    // User indexes
    await User.collection.createIndex({ email: 1 }, { unique: true });
    // googleId index - match existing MongoDB Atlas index (unique + sparse)
    await User.collection.createIndex({ googleId: 1 }, { unique: true, sparse: true, background: true }).catch(err => {
      // Ignore if index already exists
      if (err.code === 86) {
        console.log('ℹ️  googleId index already exists, skipping creation');
      } else {
        throw err;
      }
    });
    
    // Group indexes
    await Group.collection.createIndex({ members: 1 });
    await Group.collection.createIndex({ createdBy: 1 });
    await Group.collection.createIndex({ createdAt: -1 });
    await Group.collection.createIndex({ members: 1, createdAt: -1 });
    await Group.collection.createIndex({ inviteCode: 1 }, { sparse: true });
    
    // Expense indexes - optimized for common queries
    await Expense.collection.createIndex({ groupId: 1, date: -1 });
    await Expense.collection.createIndex({ paidBy: 1, date: -1 });
    await Expense.collection.createIndex({ splitAmong: 1 });
    await Expense.collection.createIndex({ groupId: 1, date: -1, paidBy: 1 });
    await Expense.collection.createIndex({ groupId: 1, splitAmong: 1, date: -1 });
    // Index for recurring expense queries
    await Expense.collection.createIndex(
      { 'recurrence.enabled': 1, 'recurrence.nextRunAt': 1 },
      { partialFilterExpression: { 'recurrence.enabled': true } }
    );
    // Index for budget calculations (amount aggregation by date)
    await Expense.collection.createIndex({ groupId: 1, date: 1, amount: 1 });
    
    // Settlement indexes - comprehensive coverage for all query patterns
    await Settlement.collection.createIndex({ groupId: 1, settledAt: -1 });
    await Settlement.collection.createIndex({ groupId: 1, fromUserId: 1, settledAt: -1 });
    await Settlement.collection.createIndex({ groupId: 1, toUserId: 1, settledAt: -1 });
    await Settlement.collection.createIndex({ fromUserId: 1, settledAt: -1 });
    await Settlement.collection.createIndex({ toUserId: 1, settledAt: -1 });
    await Settlement.collection.createIndex({ groupId: 1, paymentStatus: 1, settledAt: -1 });
    await Settlement.collection.createIndex({ toUserId: 1, paymentStatus: 1, settledAt: -1 });
    await Settlement.collection.createIndex({ transactionRef: 1 }, { sparse: true });
    
    // Notification indexes - optimized for unread queries and cleanup
    await Notification.collection.createIndex({ userId: 1, timestamp: -1 });
    await Notification.collection.createIndex({ userId: 1, read: 1, timestamp: -1 });
    await Notification.collection.createIndex(
      { userId: 1, read: 1 },
      { partialFilterExpression: { read: false } }
    );
    await Notification.collection.createIndex({ actionType: 1, relatedId: 1 });
    // TTL index for auto-cleanup after 30 days
    await Notification.collection.createIndex(
      { timestamp: 1 },
      { expireAfterSeconds: 2592000 }
    );
    
    // Message indexes - pagination with _id cursor
    await Message.collection.createIndex({ groupId: 1, _id: -1 });
    // Message indexes - unread count scans (partial on non-deleted messages)
    await Message.collection.createIndex(
      { groupId: 1, deletedAt: 1, senderId: 1, readBy: 1, createdAt: -1 },
      { partialFilterExpression: { deletedAt: null } }
    );
    // Message indexes - createdAt-based queries
    await Message.collection.createIndex({ groupId: 1, createdAt: -1 });
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
