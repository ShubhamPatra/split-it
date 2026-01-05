import mongoose from 'mongoose';

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
    type: String,
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
  // Multiple receipt images
  receipts: [{
    id: String,
    name: String,
    data: String, // Base64 encoded image
    size: Number,
    type: String,
    uploadedAt: Date,
  }],
  // Recurring expense reference
  recurringExpenseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RecurringExpense',
  },
  // Notes/comments
  notes: {
    type: String,
    maxlength: 500,
  },
}, {
  timestamps: true,
});

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;
