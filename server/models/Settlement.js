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
  // Idempotency key for preventing duplicate submissions
  // Note: uniqueness is enforced via composite index with groupId (see below)
  idempotencyKey: {
    type: String,
    trim: true,
    sparse: true,
    index: true,
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
  distributionDetails: [{
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
  crossGroupMetadata: {
    totalGroupsInvolved: {
      type: Number,
      default: 0,
    },
    settlementStrategy: {
      type: String,
      enum: ['full', 'partial'],
      default: 'full',
    },
    isReceiverInitiated: {
      type: Boolean,
      default: false,
    },
    parentSettlementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Settlement',
    },
  },
}, {
  timestamps: true,
});

// Compound indexes for cross-group settlement queries
settlementSchema.index({ isCrossGroup: 1, fromUserId: 1, toUserId: 1 });
settlementSchema.index({ affectedGroups: 1, createdAt: -1 });

// Composite unique index for idempotency: allows multiple settlements per idempotency key
// (one per group for cross-group settlements) but prevents duplicates within the same group
// Include fromUserId to prevent cross-user collisions
settlementSchema.index({ idempotencyKey: 1, fromUserId: 1, groupId: 1 }, { unique: true, sparse: true });

const Settlement = mongoose.model('Settlement', settlementSchema);

export default Settlement;
