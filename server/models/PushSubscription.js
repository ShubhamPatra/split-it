import mongoose from 'mongoose';

const pushSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  // Platform type: 'web', 'ios', 'android'
  platform: {
    type: String,
    enum: ['web', 'ios', 'android'],
    required: true,
    default: 'web',
  },
  // For web push (Web Push Protocol)
  endpoint: {
    type: String,
    sparse: true, // Allow null for mobile devices
  },
  keys: {
    p256dh: { type: String },
    auth: { type: String },
  },
  // For mobile push (FCM/APNS)
  deviceToken: {
    type: String,
    sparse: true, // Allow null for web
  },
  // Device information
  deviceInfo: {
    model: String,
    osVersion: String,
    appVersion: String,
  },
  userAgent: String,
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 7776000, // 90 days TTL
  },
}, { timestamps: true });

// Compound index for efficient queries
pushSubscriptionSchema.index({ userId: 1, platform: 1 });

// Unique sparse indexes to prevent duplicate subscriptions
// sparse: true allows multiple null values (different platforms have different identifiers)
pushSubscriptionSchema.index({ endpoint: 1 }, { unique: true, sparse: true });
pushSubscriptionSchema.index({ deviceToken: 1 }, { unique: true, sparse: true });

// Ensure either endpoint (web) or deviceToken (mobile) is present
pushSubscriptionSchema.pre('validate', function (next) {
  if (this.platform === 'web') {
    if (!this.endpoint || !this.keys?.p256dh || !this.keys?.auth) {
      return next(new Error('Web push requires endpoint and keys'));
    }
  } else {
    // iOS or Android
    if (!this.deviceToken) {
      return next(new Error('Mobile push requires deviceToken'));
    }
  }
  next();
});

export default mongoose.model('PushSubscription', pushSubscriptionSchema);
