import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Encryption helpers for 2FA secrets
const ENCRYPTION_KEY = process.env.TWO_FACTOR_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

function encrypt2FASecret(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt2FASecret(encryptedText) {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return encryptedText;
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt 2FA secret:', error.message);
    return encryptedText;
  }
}

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
    required: function () {
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
  // User role for authorization (admin access, etc.)
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
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
  emailVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: {
    type: String,
    select: false, // Don't include in queries by default
  },
  verificationTokenExpire: {
    type: Date,
    select: false,
  },
  resetPasswordToken: {
    type: String,
    select: false, // Don't include in queries by default
  },
  resetPasswordExpire: {
    type: Date,
    select: false,
  },
  // Two-Factor Authentication fields
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },
  twoFactorSecret: {
    type: String,
    select: false, // Never include in queries by default
  },
  twoFactorBackupCodes: {
    type: [String],
    select: false, // Never include in queries by default
  },
  twoFactorVerified: {
    type: Boolean,
    default: false,
  },
  // 2FA failure tracking for account lockout
  twoFactorFailedCount: {
    type: Number,
    default: 0,
    select: false,
  },
  twoFactorLockedUntil: {
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

// Hash password before saving and encrypt 2FA secret
userSchema.pre('save', async function (next) {
  // Hash password if modified
  if (this.password && this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  // Encrypt 2FA secret if modified and not already encrypted
  if (this.twoFactorSecret && this.isModified('twoFactorSecret') && !this.twoFactorSecret.includes(':')) {
    this.twoFactorSecret = encrypt2FASecret(this.twoFactorSecret);
  }

  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Decrypt 2FA secret for runtime use
userSchema.methods.getDecryptedTwoFactorSecret = function () {
  return decrypt2FASecret(this.twoFactorSecret);
};

// Don't return sensitive fields in JSON responses
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  delete obj.twoFactorSecret;
  delete obj.twoFactorBackupCodes;
  delete obj.twoFactorFailedCount;
  delete obj.twoFactorLockedUntil;
  delete obj.verificationToken;
  delete obj.verificationTokenExpire;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpire;
  return obj;
};

const User = mongoose.model('User', userSchema);

export default User;
