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
  // Member roles - stores role per user ID (Comment 10)
  memberRoles: {
    type: Map,
    of: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member',
    },
    default: new Map(),
  },
  // Legacy invite code field - deprecated, use Invite model instead
  inviteCode: {
    type: String,
    unique: true,
    sparse: true,
  },
  // Budget limit fields (Comment 4)
  budget: {
    monthlyLimit: {
      type: Number,
      default: 0, // 0 means no limit
      min: 0,
    },
    alertThreshold: {
      type: Number,
      default: 80, // Alert at 80% of budget
      min: 0,
      max: 100,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    // Category-specific budget limits
    categoryLimits: {
      type: Map,
      of: {
        limit: {
          type: Number,
          min: 0,
          default: 0, // 0 means no limit for this category
        },
        alertThreshold: {
          type: Number,
          min: 0,
          max: 100,
          default: 80, // Alert at 80% of category budget
        },
      },
      default: new Map(),
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual to populate active invites (for backward compatibility reference)
groupSchema.virtual('activeInvites', {
  ref: 'Invite',
  localField: '_id',
  foreignField: 'groupId',
  match: { status: 'pending', expiresAt: { $gt: new Date() } },
});

// Ensure creator is always in members and has admin role
groupSchema.pre('save', function(next) {
  if (!this.members.includes(this.createdBy)) {
    this.members.unshift(this.createdBy);
  }
  // Ensure creator always has admin role
  if (!this.memberRoles.get(this.createdBy.toString())) {
    this.memberRoles.set(this.createdBy.toString(), 'admin');
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

// Method to check if user is admin
groupSchema.methods.isAdmin = function(userId) {
  const role = this.memberRoles.get(userId.toString());
  return role === 'admin' || this.createdBy.toString() === userId.toString();
};

// Method to check if user is the creator
groupSchema.methods.isCreator = function(userId) {
  return this.createdBy.toString() === userId.toString();
};

// Method to get member role
groupSchema.methods.getMemberRole = function(userId) {
  if (this.createdBy.toString() === userId.toString()) {
    return 'admin';
  }
  return this.memberRoles.get(userId.toString()) || 'member';
};

// Method to set member role
groupSchema.methods.setMemberRole = function(userId, role) {
  this.memberRoles.set(userId.toString(), role);
};

// Method to set category budget limit
groupSchema.methods.setCategoryLimit = function(categoryId, limit, alertThreshold = 80) {
  if (!this.budget.categoryLimits) {
    this.budget.categoryLimits = new Map();
  }
  this.budget.categoryLimits.set(categoryId, {
    limit: limit || 0,
    alertThreshold: alertThreshold || 80,
  });
};

// Method to get category budget limit
groupSchema.methods.getCategoryLimit = function(categoryId) {
  if (!this.budget.categoryLimits) {
    return null;
  }
  return this.budget.categoryLimits.get(categoryId) || null;
};

// Method to remove category budget limit
groupSchema.methods.removeCategoryLimit = function(categoryId) {
  if (this.budget.categoryLimits) {
    this.budget.categoryLimits.delete(categoryId);
  }
};

// Method to get all category limits as plain object
groupSchema.methods.getCategoryLimitsObject = function() {
  if (!this.budget.categoryLimits) {
    return {};
  }
  const limits = {};
  this.budget.categoryLimits.forEach((value, key) => {
    limits[key] = value;
  });
  return limits;
};

const Group = mongoose.model('Group', groupSchema);

export default Group;
