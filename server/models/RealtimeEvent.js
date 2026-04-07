import mongoose from 'mongoose';

const realtimeEventSchema = new mongoose.Schema({
  channel: {
    type: String,
    required: true,
    index: true,
  },
  event: {
    type: String,
    required: true,
    index: true,
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  audience: {
    type: String,
    enum: ['user', 'group', 'broadcast'],
    default: 'broadcast',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    index: { expires: 0 },
  },
}, {
  timestamps: true,
  versionKey: false,
});

realtimeEventSchema.index({ channel: 1, createdAt: 1 });

const RealtimeEvent = mongoose.model('RealtimeEvent', realtimeEventSchema);

export default RealtimeEvent;