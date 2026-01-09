import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
    index: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    maxlength: [2000, 'Message cannot exceed 2000 characters'],
    trim: true,
  },
  type: {
    type: String,
    enum: ['text', 'system', 'expense', 'settlement'],
    default: 'text',
  },
  metadata: {
    expenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
    },
    settlementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Settlement',
    },
    action: {
      type: String,
      enum: ['created', 'updated', 'deleted'],
    },
  },
  editedAt: {
    type: Date,
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  deletedAt: {
    type: Date,
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Compound index for efficient pagination queries using _id cursor
messageSchema.index({ groupId: 1, _id: -1 });

// Compound index for unread count scans (partial on non-deleted messages)
messageSchema.index(
  { groupId: 1, deletedAt: 1, senderId: 1, readBy: 1, createdAt: -1 },
  { partialFilterExpression: { deletedAt: null } }
);

// Legacy index for createdAt-based queries
messageSchema.index({ groupId: 1, createdAt: -1 });

// Sparse indexes for metadata references
messageSchema.index({ 'metadata.expenseId': 1 }, { sparse: true });
messageSchema.index({ 'metadata.settlementId': 1 }, { sparse: true });

// Sparse index for soft-deleted messages
messageSchema.index({ deletedAt: 1 }, { sparse: true });

// Virtual to check if message is deleted
messageSchema.virtual('isDeleted').get(function() {
  return !!this.deletedAt;
});

// Virtual for read count
messageSchema.virtual('readCount').get(function() {
  return this.readBy?.length || 0;
});

// Ensure virtuals are included in JSON output
messageSchema.set('toJSON', { virtuals: true });
messageSchema.set('toObject', { virtuals: true });

// Instance method: Check if user can edit this message (sender only, within 15 minutes)
messageSchema.methods.isEditable = function(userId) {
  if (!userId) return false;
  
  // Must be the sender
  const isSender = this.senderId.toString() === userId.toString();
  if (!isSender) return false;
  
  // Cannot be deleted
  if (this.deletedAt) return false;
  
  // Must be within 15 minutes of creation
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  return this.createdAt > fifteenMinutesAgo;
};

// Instance method: Check if user can delete this message (sender or admin)
messageSchema.methods.isDeletable = function(userId, isAdmin = false) {
  if (!userId) return false;
  
  // Already deleted
  if (this.deletedAt) return false;
  
  // Sender can always delete their own messages
  const isSender = this.senderId.toString() === userId.toString();
  if (isSender) return true;
  
  // Admins can delete any message
  return isAdmin;
};

// Instance method: Mark message as read by a user
messageSchema.methods.markAsRead = function(userId) {
  if (!userId) return false;
  
  const userIdStr = userId.toString();
  const alreadyRead = this.readBy.some(id => id.toString() === userIdStr);
  
  if (!alreadyRead) {
    this.readBy.push(userId);
    return true;
  }
  return false;
};

// Instance method: Return sanitized message object (hide deleted content)
messageSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  
  if (this.deletedAt) {
    obj.content = '[Message deleted]';
    obj.metadata = {};
  }
  
  return obj;
};

// Static method: Get messages for a group with pagination
messageSchema.statics.getGroupMessages = async function(groupId, options = {}) {
  const { limit = 50, before = null } = options;
  
  const query = {
    groupId,
    deletedAt: null,
  };
  
  if (before) {
    query._id = { $lt: before };
  }
  
  const messages = await this.find(query)
    .populate('senderId', 'name email')
    .populate('metadata.expenseId', 'description amount currency')
    .populate('metadata.settlementId', 'amount currency')
    .sort({ _id: -1 })
    .limit(limit + 1) // Fetch one extra to check hasMore
    .lean();
  
  const hasMore = messages.length > limit;
  if (hasMore) {
    messages.pop(); // Remove the extra one
  }
  
  return {
    messages: messages.reverse(), // Return in chronological order
    hasMore,
    oldestMessageId: messages.length > 0 ? messages[0]._id : null,
  };
};

// Static method: Get unread count for a user in a group
messageSchema.statics.getUnreadCount = async function(groupId, userId) {
  return this.countDocuments({
    groupId,
    deletedAt: null,
    senderId: { $ne: userId },
    readBy: { $ne: userId },
  });
};

// Static method: Mark multiple messages as read
messageSchema.statics.markManyAsRead = async function(messageIds, userId) {
  const result = await this.updateMany(
    {
      _id: { $in: messageIds },
      readBy: { $ne: userId },
    },
    {
      $addToSet: { readBy: userId },
    }
  );
  return result.modifiedCount;
};

const Message = mongoose.model('Message', messageSchema);

export default Message;
