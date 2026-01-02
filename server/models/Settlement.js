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
    type: String,
    default: () => new Date().toISOString().split('T')[0],
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
}, {
  timestamps: true,
});

const Settlement = mongoose.model('Settlement', settlementSchema);

export default Settlement;
