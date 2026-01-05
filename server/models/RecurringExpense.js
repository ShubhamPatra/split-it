import mongoose from 'mongoose';

const recurringExpenseSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: 0,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  category: {
    type: String,
    required: true,
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  splitAmong: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  splitConfig: {
    type: {
      type: String,
      enum: ['equal', 'exact', 'percentage'],
      default: 'equal',
    },
    shares: {
      type: Map,
      of: Number,
    },
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'],
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
  },
  nextDueDate: {
    type: Date,
    required: true,
  },
  lastGeneratedDate: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  reminderDaysBefore: {
    type: Number,
    default: 1,
  },
  autoCreate: {
    type: Boolean,
    default: false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Calculate next due date based on frequency
recurringExpenseSchema.methods.calculateNextDueDate = function() {
  const currentDue = new Date(this.nextDueDate);
  let nextDue = new Date(currentDue);

  switch (this.frequency) {
    case 'daily':
      nextDue.setDate(nextDue.getDate() + 1);
      break;
    case 'weekly':
      nextDue.setDate(nextDue.getDate() + 7);
      break;
    case 'biweekly':
      nextDue.setDate(nextDue.getDate() + 14);
      break;
    case 'monthly':
      nextDue.setMonth(nextDue.getMonth() + 1);
      break;
    case 'quarterly':
      nextDue.setMonth(nextDue.getMonth() + 3);
      break;
    case 'yearly':
      nextDue.setFullYear(nextDue.getFullYear() + 1);
      break;
    default:
      nextDue.setMonth(nextDue.getMonth() + 1);
  }

  // Check if past end date
  if (this.endDate && nextDue > this.endDate) {
    this.isActive = false;
    return null;
  }

  return nextDue;
};

// Index for efficient querying
recurringExpenseSchema.index({ groupId: 1, isActive: 1 });
recurringExpenseSchema.index({ nextDueDate: 1, isActive: 1 });

const RecurringExpense = mongoose.model('RecurringExpense', recurringExpenseSchema);

export default RecurringExpense;
