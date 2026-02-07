import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  // Action details
  action: {
    type: String,
    required: true,
    enum: [
      // Expense actions
      'expense.create',
      'expense.update',
      'expense.delete',
      'expense.receipt.add',
      'expense.receipt.delete',
      // Settlement actions
      'settlement.create',
      'settlement.confirm',
      'settlement.reject',
      'settlement.update',
      'settlement.delete',
      // Group actions
      'group.create',
      'group.update',
      'group.delete',
      'group.member.add',
      'group.member.remove',
      'group.member.role.change',
      'group.budget.update',
      // User actions
      'user.register',
      'user.login',
      'user.logout',
      'user.update',
      'user.delete',
      'user.password.change',
      'user.password.reset.request',
      'user.password.reset.complete',
      'user.email.verify',
      // Two-Factor Authentication actions
      'user.2fa.enabled',
      'user.2fa.disabled',
      'user.2fa.verified',
      'user.2fa.backup_code_used',
      'user.2fa.backup_codes_regenerated',
      // Auth actions
      'auth.failed.login',
      'auth.failed.verification',
      'auth.failed.password.reset',
      'auth.failed.2fa',
      'auth.failed.2fa_disable',
      'auth.token.refresh',
      'auth.session.invalidated',
    ],
  },
  
  // Entity information
  entityType: {
    type: String,
    required: true,
    enum: ['User', 'Group', 'Expense', 'Settlement', 'Invite', 'Message'],
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  
  // User who performed the action
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  
  // Related entities (e.g., groupId for expense actions)
  relatedEntities: {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      index: true,
    },
    expenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
    },
    settlementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Settlement',
    },
  },
  
  // Changes made (before/after state)
  changes: {
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Fields that were modified
    modifiedFields: [{
      type: String,
    }],
  },
  
  // Request metadata
  metadata: {
    ipAddress: {
      type: String,
      index: true,
    },
    userAgent: {
      type: String,
    },
    requestId: {
      type: String,
      index: true,
    },
    // API endpoint called
    endpoint: {
      type: String,
    },
    // HTTP method
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
  },
  
  // Result of the action
  result: {
    type: String,
    enum: ['success', 'failure', 'partial'],
    default: 'success',
  },
  
  // Error information (if action failed)
  error: {
    message: {
      type: String,
    },
    code: {
      type: String,
    },
    stack: {
      type: String,
      select: false, // Don't include in queries by default
    },
  },
  
  // Additional context
  notes: {
    type: String,
    maxlength: 1000,
  },
  
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: false, // Using custom timestamp field
});

// Compound indexes for common queries
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
auditLogSchema.index({ 'relatedEntities.groupId': 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ result: 1, timestamp: -1 });

// TTL index - automatically delete logs older than 2 years (730 days)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 730 * 24 * 60 * 60 });

// Static method: Create audit log entry
auditLogSchema.statics.log = async function(data) {
  try {
    const log = await this.create(data);
    return log;
  } catch (error) {
    // Don't throw error - audit logging should not break the main flow
    console.error('Audit log creation failed:', error);
    return null;
  }
};

// Static method: Get audit trail for an entity
auditLogSchema.statics.getEntityHistory = async function(entityType, entityId, options = {}) {
  const { limit = 50, skip = 0 } = options;
  
  return this.find({ entityType, entityId })
    .populate('userId', 'name email')
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

// Static method: Get user activity
auditLogSchema.statics.getUserActivity = async function(userId, options = {}) {
  const { limit = 100, skip = 0, startDate, endDate } = options;
  
  const query = { userId };
  
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

// Static method: Get group activity
auditLogSchema.statics.getGroupActivity = async function(groupId, options = {}) {
  const { limit = 100, skip = 0, actions } = options;
  
  const query = { 'relatedEntities.groupId': groupId };
  
  if (actions && actions.length > 0) {
    query.action = { $in: actions };
  }
  
  return this.find(query)
    .populate('userId', 'name email')
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

// Static method: Get failed actions (security monitoring)
auditLogSchema.statics.getFailedActions = async function(options = {}) {
  const { limit = 100, skip = 0, startDate } = options;
  
  const query = { result: 'failure' };
  
  if (startDate) {
    query.timestamp = { $gte: new Date(startDate) };
  }
  
  return this.find(query)
    .populate('userId', 'name email')
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
};

// Static method: Get suspicious activity (multiple failed attempts)
auditLogSchema.statics.getSuspiciousActivity = async function(options = {}) {
  const { hours = 24, threshold = 5 } = options;
  
  const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        result: 'failure',
        timestamp: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          userId: '$userId',
          ipAddress: '$metadata.ipAddress',
        },
        count: { $sum: 1 },
        actions: { $push: '$action' },
        lastAttempt: { $max: '$timestamp' },
      },
    },
    {
      $match: {
        count: { $gte: threshold },
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);
};

// Instance method: Format for display
auditLogSchema.methods.toDisplayFormat = function() {
  return {
    id: this._id,
    action: this.action,
    entity: {
      type: this.entityType,
      id: this.entityId,
    },
    user: this.userId,
    timestamp: this.timestamp,
    result: this.result,
    changes: this.changes?.modifiedFields || [],
    metadata: {
      ipAddress: this.metadata?.ipAddress,
      endpoint: this.metadata?.endpoint,
    },
  };
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
