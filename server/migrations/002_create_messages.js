/**
 * Migration: Create Messages Collection and Indexes
 * 
 * This migration sets up the messages collection with proper indexes
 * and optionally creates system messages for existing expenses/settlements.
 * 
 * Run: node server/migrations/002_create_messages.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import models after dotenv config
import Message from '../models/Message.js';
import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import Group from '../models/Group.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/splitit';

// Feature flag to control system message creation for existing data
const CREATE_SYSTEM_MESSAGES = process.env.MIGRATION_CREATE_SYSTEM_MESSAGES === 'true';

const up = async () => {
  console.log('Starting migration: 002_create_messages');
  console.log('Connecting to MongoDB...');
  
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
  
  // Create indexes on Message collection
  console.log('Creating indexes on Message collection...');
  await Message.createIndexes();
  console.log('Indexes created successfully');
  
  // Verify indexes
  const indexes = await Message.collection.indexes();
  console.log('Current indexes:', indexes.map(i => i.name));
  
  if (CREATE_SYSTEM_MESSAGES) {
    console.log('\nCreating system messages for existing expenses...');
    
    // Get all expenses with populated data
    const expenses = await Expense.find()
      .populate('paidBy', 'name')
      .populate('groupId', 'name')
      .lean();
    
    let expenseMessagesCreated = 0;
    for (const expense of expenses) {
      // Check if system message already exists for this expense
      const existingMessage = await Message.findOne({
        'metadata.expenseId': expense._id,
        type: 'system',
      });
      
      if (!existingMessage && expense.paidBy && expense.groupId) {
        await Message.create({
          groupId: expense.groupId._id,
          senderId: expense.paidBy._id,
          content: `${expense.paidBy.name} added expense "${expense.description}" for ${expense.currency || 'INR'}${expense.amount}`,
          type: 'system',
          metadata: {
            expenseId: expense._id,
            action: 'created',
          },
          createdAt: expense.createdAt,
          readBy: [expense.paidBy._id],
        });
        expenseMessagesCreated++;
      }
    }
    console.log(`Created ${expenseMessagesCreated} system messages for expenses`);
    
    console.log('\nCreating system messages for existing settlements...');
    
    // Get all settlements with populated data
    const settlements = await Settlement.find()
      .populate('fromUserId', 'name')
      .populate('toUserId', 'name')
      .populate('groupId', 'name')
      .lean();
    
    let settlementMessagesCreated = 0;
    for (const settlement of settlements) {
      // Check if system message already exists for this settlement
      const existingMessage = await Message.findOne({
        'metadata.settlementId': settlement._id,
        type: 'system',
      });
      
      if (!existingMessage && settlement.fromUserId && settlement.toUserId && settlement.groupId) {
        await Message.create({
          groupId: settlement.groupId._id,
          senderId: settlement.fromUserId._id,
          content: `${settlement.fromUserId.name} paid ${settlement.toUserId.name} ${settlement.currency || 'INR'}${settlement.amount}`,
          type: 'system',
          metadata: {
            settlementId: settlement._id,
            action: 'created',
          },
          createdAt: settlement.createdAt || settlement.settledAt,
          readBy: [settlement.fromUserId._id, settlement.toUserId._id],
        });
        settlementMessagesCreated++;
      }
    }
    console.log(`Created ${settlementMessagesCreated} system messages for settlements`);
  } else {
    console.log('\nSkipping system message creation (set MIGRATION_CREATE_SYSTEM_MESSAGES=true to enable)');
  }
  
  console.log('\nMigration completed successfully!');
};

const down = async () => {
  console.log('Rolling back migration: 002_create_messages');
  console.log('Connecting to MongoDB...');
  
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
  
  // Drop the messages collection
  console.log('Dropping messages collection...');
  try {
    await Message.collection.drop();
    console.log('Messages collection dropped');
  } catch (error) {
    if (error.code === 26) {
      console.log('Messages collection does not exist, nothing to drop');
    } else {
      throw error;
    }
  }
  
  console.log('Rollback completed successfully!');
};

// Main execution
const action = process.argv[2];

const run = async () => {
  try {
    if (action === 'down') {
      await down();
    } else {
      await up();
    }
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

run();
