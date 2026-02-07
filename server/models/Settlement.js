import mongoose from 'mongoose';

const settlementSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
  },
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  toUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'upi', 'bank', 'card', 'other'],
    default: 'cash',
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'pending',
  },
  settledAt: {
    type: Date,
    default: Date.now,
  },
  transactionRef: {
    type: String,
    trim: true,
    index: true,
  },
  paymentInitiatedAt: {
    type: Date,
  },
  paymentConfirmedAt: {
    type: Date,
  },
  paymentNotes: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  // Reminder tracking
  lastReminderSentAt: {
    type: Date,
  },
  // Cross-group settlement fields
  isCrossGroup: {
    type: Boolean,
    default: false,
    index: true,
  },
  affectedGroups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
  }],
  // Breakdown of how much applies to each group
  groupBreakdown: [{
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
    },
    amount: {
      type: Number,
      min: 0,
    },
  }],
}, {
  timestamps: true,
});

// Index for cross-group queries
settlementSchema.index({ isCrossGroup: 1, fromUserId: 1 });
settlementSchema.index({ isCrossGroup: 1, toUserId: 1 });

// Method to check if settlement is cross-group
settlementSchema.methods.isCrossGroupSettlement = function () {
  return this.isCrossGroup === true;
};

// Method to get affected group IDs
settlementSchema.methods.getAffectedGroups = function () {
  return this.affectedGroups || [];
};

// Static method to create cross-group settlement
settlementSchema.statics.createCrossGroupSettlement = async function (data) {
  const {
    fromUserId,
    toUserId,
    amount,
    currency = 'INR',
    paymentMethod = 'cash',
    paymentNotes,
    transactionRef,
    affectedGroups,
    groupBreakdown,
    primaryGroupId, // The main group to associate with (for display)
  } = data;

  // Validate that users share groups
  const Group = mongoose.model('Group');
  const sharedGroups = await Group.find({
    _id: { $in: affectedGroups },
    members: { $all: [fromUserId, toUserId] },
  });

  if (sharedGroups.length === 0) {
    throw new Error('Users do not share any of the specified groups');
  }

  // Validate primaryGroupId is in sharedGroups
  const sharedGroupIds = sharedGroups.map(g => g._id.toString());
  if (primaryGroupId && !sharedGroupIds.includes(primaryGroupId.toString())) {
    throw new Error('Primary group must be one of the shared groups');
  }

  // Validate groupBreakdown structure and amounts
  if (groupBreakdown && Array.isArray(groupBreakdown)) {
    const breakdownTotal = groupBreakdown.reduce((sum, item) => {
      if (!item.groupId || typeof item.amount !== 'number' || item.amount < 0) {
        throw new Error('Invalid groupBreakdown item structure');
      }
      if (!sharedGroupIds.includes(item.groupId.toString())) {
        throw new Error('groupBreakdown contains group not in sharedGroups');
      }
      return sum + item.amount;
    }, 0);

    // Allow small floating point tolerance
    if (Math.abs(breakdownTotal - amount) > 0.01) {
      throw new Error('groupBreakdown amounts must sum to settlement amount');
    }
  }

  // Use validated group IDs instead of raw affectedGroups
  const validatedAffectedGroups = sharedGroups.map(g => g._id);

  // Create settlement
  const settlement = await this.create({
    groupId: primaryGroupId || sharedGroups[0]._id,
    fromUserId,
    toUserId,
    amount,
    currency,
    paymentMethod,
    paymentStatus: 'pending',
    paymentNotes,
    transactionRef,
    isCrossGroup: true,
    affectedGroups: validatedAffectedGroups,
    groupBreakdown,
    paymentInitiatedAt: new Date(),
  });

  return settlement;
};

const Settlement = mongoose.model('Settlement', settlementSchema);

export default Settlement;
