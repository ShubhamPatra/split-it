import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  inviteCode: {
    type: String,
    unique: true,
    sparse: true,
  },
  createdAt: {
    type: String,
    default: () => new Date().toISOString().split('T')[0],
  },
  // Budget limits
  budget: {
    enabled: {
      type: Boolean,
      default: false,
    },
    limit: {
      type: Number,
      default: 0,
    },
    period: {
      type: String,
      enum: ['weekly', 'monthly', 'yearly', 'custom'],
      default: 'monthly',
    },
    alertThreshold: {
      type: Number,
      default: 80, // Alert when 80% of budget is used
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
  },
  // Email notification preferences
  emailNotifications: {
    enabled: {
      type: Boolean,
      default: true,
    },
    onExpenseAdded: {
      type: Boolean,
      default: true,
    },
    onSettlement: {
      type: Boolean,
      default: true,
    },
    onBudgetAlert: {
      type: Boolean,
      default: true,
    },
  },
  // Group description
  description: {
    type: String,
    maxlength: 200,
  },
  // Group icon/avatar
  icon: {
    type: String,
    default: 'Users',
  },
}, {
  timestamps: true,
});

// Ensure creator is always in members
groupSchema.pre('save', function(next) {
  if (!this.members.includes(this.createdBy)) {
    this.members.unshift(this.createdBy);
  }
  next();
});

// Method to generate unique invite code
groupSchema.methods.generateInviteCode = function() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  this.inviteCode = code;
  return code;
};

const Group = mongoose.model('Group', groupSchema);

export default Group;
