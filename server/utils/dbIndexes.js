import User from '../models/User.js';
import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import Notification from '../models/Notification.js';

// Create database indexes for better query performance
export const createIndexes = async () => {
  try {
    // User indexes
    await User.collection.createIndex({ email: 1 }, { unique: true });
    
    // Group indexes
    await Group.collection.createIndex({ members: 1 });
    await Group.collection.createIndex({ createdBy: 1 });
    await Group.collection.createIndex({ createdAt: -1 });
    
    // Expense indexes
    await Expense.collection.createIndex({ groupId: 1, date: -1 });
    await Expense.collection.createIndex({ paidBy: 1 });
    await Expense.collection.createIndex({ splitAmong: 1 });
    
    // Settlement indexes
    await Settlement.collection.createIndex({ groupId: 1, settledAt: -1 });
    await Settlement.collection.createIndex({ fromUserId: 1 });
    await Settlement.collection.createIndex({ toUserId: 1 });
    
    // Notification indexes
    await Notification.collection.createIndex({ userId: 1, timestamp: -1 });
    await Notification.collection.createIndex({ userId: 1, read: 1 });
    
    console.log('✅ Database indexes created successfully');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  }
};
