import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const emailPreferencesSchema = new mongoose.Schema({
  // Digest emails
  weeklyDigest: { type: Boolean, default: false },
  monthlyDigest: { type: Boolean, default: false },
  
  // Transaction emails
  expenseAdded: { type: Boolean, default: true },
  settlementConfirmation: { type: Boolean, default: true },
  paymentReminders: { type: Boolean, default: true },
  
  // Recurring expense emails
  recurringExpenseReminder: { type: Boolean, default: true },
  recurringExpenseGenerated: { type: Boolean, default: false },
  
  // Group emails
  memberJoined: { type: Boolean, default: true },
  groupInvite: { type: Boolean, default: true },
  
  // Budget & Reports
  budgetAlerts: { type: Boolean, default: true },
  exportReports: { type: Boolean, default: true },
  
  // Account emails (always enabled, not user-configurable)
  // welcome, password reset, security alerts - handled separately
}, { _id: false });

const budgetSettingsSchema = new mongoose.Schema({
  monthlyLimit: { type: Number, default: 0 }, // 0 means no limit
  categoryLimits: { type: Map, of: Number, default: {} },
  alertThreshold: { type: Number, default: 80 }, // Alert at 80% of limit
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: function() {
      // Password is only required if not using Google OAuth
      return !this.googleId;
    },
    minlength: 6,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true, // Allow multiple null values
  },
  upiId: {
    type: String,
    trim: true,
    default: '',
  },
  emailPreferences: {
    type: emailPreferencesSchema,
    default: () => ({}),
  },
  budgetSettings: {
    type: budgetSettingsSchema,
    default: () => ({}),
  },
  lastDigestSent: {
    weekly: { type: Date },
    monthly: { type: Date },
  },
  resetPasswordToken: {
    type: String,
    select: false, // Don't include in queries by default
  },
  resetPasswordExpire: {
    type: Date,
    select: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Skip hashing if no password (Google OAuth users)
  if (!this.password || !this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Don't return password in JSON responses
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

const User = mongoose.model('User', userSchema);

export default User;
