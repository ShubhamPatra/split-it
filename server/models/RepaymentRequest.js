import mongoose from 'mongoose';

const repaymentRequestSchema = new mongoose.Schema({
  requesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  message: {
    type: String,
    maxlength: 500,
    trim: true,
  },
  status: {
    type: String,
    enum: ['pending', 'partially_paid', 'settled', 'cancelled'],
    default: 'pending',
  },
  relatedGroups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
  }],
  groupBreakdown: [{
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
    },
    amount: {
      type: Number,
      min: 0,
    },
    originalBalance: {
      type: Number,
    },
  }],
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  lastReminderAt: {
    type: Date,
  },
  reminderCount: {
    type: Number,
    default: 0,
  },
  settledAt: {
    type: Date,
  },
  cancelledAt: {
    type: Date,
  },
  settledAmount: {
    type: Number,
    default: 0,
  },
  notes: {
    type: String,
    trim: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
});

// Indexes
repaymentRequestSchema.index({ requesterId: 1, receiverId: 1, status: 1 });
repaymentRequestSchema.index({ receiverId: 1, status: 1, requestedAt: -1 });
repaymentRequestSchema.index({ requesterId: 1, status: 1, requestedAt: -1 });

// Validation methods
repaymentRequestSchema.methods.canSendReminder = function() {
  if (!this.lastReminderAt) return true;
  
  const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const timeSinceLastReminder = Date.now() - this.lastReminderAt.getTime();
  
  return timeSinceLastReminder >= cooldownPeriod;
};

repaymentRequestSchema.methods.updateStatus = function(settledAmount) {
  this.settledAmount = settledAmount;
  
  if (settledAmount >= this.amount) {
    this.status = 'settled';
    this.settledAt = new Date();
  } else if (settledAmount > 0) {
    this.status = 'partially_paid';
    this.settledAt = new Date();
  }
  
  return this.save();
};

repaymentRequestSchema.methods.addSettledAmount = function(deltaAmount) {
  // Ensure we don't exceed the total amount
  const newSettledAmount = Math.min(this.settledAmount + deltaAmount, this.amount);
  this.settledAmount = newSettledAmount;
  
  if (newSettledAmount >= this.amount) {
    this.status = 'settled';
    this.settledAt = new Date();
  } else if (newSettledAmount > 0) {
    this.status = 'partially_paid';
    this.settledAt = new Date();
  }
  
  return this.save();
};

// Static method to check cooldown period
repaymentRequestSchema.statics.checkCooldownPeriod = async function(requesterId, receiverId) {
  const lastRequest = await this.findOne({
    requesterId,
    receiverId,
    status: { $in: ['pending', 'partially_paid'] },
  }).sort({ requestedAt: -1 });
  
  if (!lastRequest) return true;
  
  const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours
  const timeSinceLastRequest = Date.now() - lastRequest.requestedAt.getTime();
  
  return timeSinceLastRequest >= cooldownPeriod;
};

// Static method to get pending requests count
repaymentRequestSchema.statics.getPendingRequestsCount = async function(requesterId, receiverId) {
  return await this.countDocuments({
    requesterId,
    receiverId,
    status: { $in: ['pending', 'partially_paid'] },
  });
};

const RepaymentRequest = mongoose.model('RepaymentRequest', repaymentRequestSchema);

export default RepaymentRequest;
