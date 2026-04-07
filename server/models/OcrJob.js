import mongoose from 'mongoose';

const ocrJobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  sourceUrl: {
    type: String,
    required: true,
  },
  storageId: {
    type: String,
    default: null,
  },
  originalFilename: {
    type: String,
    default: null,
  },
  mimeType: {
    type: String,
    default: 'image/jpeg',
  },
  status: {
    type: String,
    enum: ['queued', 'processing', 'completed', 'failed'],
    default: 'queued',
    index: true,
  },
  result: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  error: {
    type: String,
    default: null,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  processedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

ocrJobSchema.index({ status: 1, createdAt: 1 });

const OcrJob = mongoose.model('OcrJob', ocrJobSchema);

export default OcrJob;