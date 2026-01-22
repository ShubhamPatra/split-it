import mongoose from 'mongoose';
import crypto from 'crypto';

const inviteSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true,
    index: true,
  },
  inviterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  code: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true,
    trim: true,
    maxlength: 8,
  },
  token: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    maxlength: 64,
  },
  type: {
    type: String,
    enum: ['link', 'email', 'code'],
    required: true,
  },
  invitedEmail: {
    type: String,
    lowercase: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired', 'revoked'],
    default: 'pending',
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  acceptedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  acceptedAt: {
    type: Date,
  },
  // For multi-use invites (link/code type)
  maxUses: {
    type: Number,
    default: 0, // 0 = unlimited
  },
  usedCount: {
    type: Number,
    default: 0,
  },
  usedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    usedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  metadata: {
    ipAddress: String,
    userAgent: String,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
inviteSchema.index({ groupId: 1, status: 1 });
inviteSchema.index({ code: 1, status: 1 });
inviteSchema.index({ token: 1, status: 1 });

// TTL index for auto-cleanup of expired invites
inviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Instance methods
inviteSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

inviteSchema.methods.isValid = function() {
  // Check if expired
  if (this.isExpired()) return false;
  
  // For email invites, check if already accepted
  if (this.type === 'email') {
    return this.status === 'pending';
  }
  
  // For link/code invites, check if within usage limit
  // status 'pending' means still usable, maxUses 0 = unlimited
  if (this.maxUses > 0 && this.usedCount >= this.maxUses) {
    return false;
  }
  
  return this.status === 'pending';
};

inviteSchema.methods.markAccepted = async function(userId) {
  // For email invites, mark as fully accepted (single use)
  if (this.type === 'email') {
    this.status = 'accepted';
    this.acceptedBy = userId;
    this.acceptedAt = new Date();
  } else {
    // For link/code invites, track usage but keep pending
    this.usedCount += 1;
    this.usedBy.push({ userId, usedAt: new Date() });
    
    // If maxUses is set and reached, mark as accepted
    if (this.maxUses > 0 && this.usedCount >= this.maxUses) {
      this.status = 'accepted';
      this.acceptedAt = new Date();
    }
  }
  return this.save();
};

// Static methods
inviteSchema.statics.generateUniqueCode = async function() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars (I, O, 0, 1)
  let code;
  let exists = true;
  let attempts = 0;
  const maxAttempts = 10;

  while (exists && attempts < maxAttempts) {
    code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    exists = await this.findOne({ code, status: 'pending' });
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique invite code');
  }

  return code;
};

inviteSchema.statics.generateUniqueToken = async function() {
  let token;
  let exists = true;
  let attempts = 0;
  const maxAttempts = 10;

  while (exists && attempts < maxAttempts) {
    token = crypto.randomBytes(32).toString('hex');
    exists = await this.findOne({ token, status: 'pending' });
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique invite token');
  }

  return token;
};

inviteSchema.statics.cleanupExpired = async function() {
  const result = await this.updateMany(
    {
      status: 'pending',
      expiresAt: { $lt: new Date() },
    },
    {
      $set: { status: 'expired' },
    }
  );
  return result.modifiedCount;
};

// Virtual for formatted code display (ABCD-1234)
inviteSchema.virtual('formattedCode').get(function() {
  if (!this.code) return null;
  return `${this.code.slice(0, 4)}-${this.code.slice(4)}`;
});

// Ensure virtuals are included in JSON
inviteSchema.set('toJSON', { virtuals: true });
inviteSchema.set('toObject', { virtuals: true });

const Invite = mongoose.model('Invite', inviteSchema);

export default Invite;
