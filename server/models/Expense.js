import mongoose from 'mongoose';

// Line item schema for itemized bill splitting (Comment 5)
const lineItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true,
  },
  quantity: {
    type: Number,
    default: 1,
    min: 0,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  // Members assigned to this line item
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
}, { _id: true });

// Receipt metadata schema (Comment 6)
const receiptSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  filename: {
    type: String,
  },
  mimeType: {
    type: String,
    default: 'image/jpeg',
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

const expenseSchema = new mongoose.Schema({
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
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  splitAmong: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  splitConfig: {
    type: {
      type: String,
      enum: ['equal', 'exact', 'percentage', 'itemized'],
      default: 'equal',
    },
    shares: {
      type: Map,
      of: Number,
    },
  },
  // Line items for itemized bill splitting (Comment 5)
  lineItems: [lineItemSchema],
  // Multiple receipt support (Comment 6)
  receipts: [receiptSchema],
  // Legacy single receipt URL (for backwards compatibility)
  receiptUrl: {
    type: String,
  },
  // Recurring expense fields (Comment 3)
  recurrence: {
    enabled: {
      type: Boolean,
      default: false,
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly', 'yearly'],
    },
    interval: {
      type: Number,
      default: 1,
      min: 1,
    },
    nextRunAt: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    lastGeneratedAt: {
      type: Date,
    },
    // ID of the original recurring expense (for generated instances)
    parentExpenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
    },
    // Number of times this recurring expense has generated instances
    generatedCount: {
      type: Number,
      default: 0,
    },
  },
}, {
  timestamps: true,
});

// Method to calculate next run date for recurring expenses
expenseSchema.methods.calculateNextRunDate = function() {
  if (!this.recurrence.enabled || !this.recurrence.frequency) {
    return null;
  }

  const baseDate = this.recurrence.lastGeneratedAt || this.date;
  const date = new Date(baseDate);
  const interval = this.recurrence.interval || 1;

  switch (this.recurrence.frequency) {
    case 'daily':
      date.setDate(date.getDate() + interval);
      break;
    case 'weekly':
      date.setDate(date.getDate() + (7 * interval));
      break;
    case 'biweekly':
      date.setDate(date.getDate() + (14 * interval));
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + interval);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + interval);
      break;
    default:
      return null;
  }

  // Check if past end date
  if (this.recurrence.endDate && date > this.recurrence.endDate) {
    return null;
  }

  return date;
};

// Method to calculate split from line items
expenseSchema.methods.calculateSplitFromItems = function() {
  if (!this.lineItems || this.lineItems.length === 0) {
    return null;
  }

  const shares = {};
  
  for (const item of this.lineItems) {
    if (item.assignedTo && item.assignedTo.length > 0) {
      const perPersonAmount = item.totalPrice / item.assignedTo.length;
      for (const userId of item.assignedTo) {
        const userIdStr = userId.toString();
        shares[userIdStr] = (shares[userIdStr] || 0) + perPersonAmount;
      }
    }
  }

  return { type: 'itemized', shares: new Map(Object.entries(shares)) };
};

// Index for recurring expense queries
expenseSchema.index({ 'recurrence.enabled': 1, 'recurrence.nextRunAt': 1 });
expenseSchema.index({ groupId: 1, date: -1 });

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;
