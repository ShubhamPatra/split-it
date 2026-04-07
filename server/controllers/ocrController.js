import OcrJob from '../models/OcrJob.js';
import { extractReceiptData, processPendingOcrJobs } from '../services/ocrService.js';
import { uploadBufferToCloudinary } from '../services/cloudinaryStorage.js';

/**
 * Submit receipt for OCR processing
 * POST /api/ocr/scan
 */
export const scanReceipt = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        message: 'Invalid file type. Only JPEG, PNG, and WebP images are supported.'
      });
    }

    const uploadedReceipt = await uploadBufferToCloudinary({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      folder: `split-it/ocr/${req.user._id}`,
    });

    const job = await OcrJob.create({
      userId: req.user._id,
      sourceUrl: uploadedReceipt.url,
      storageId: uploadedReceipt.storageId,
      originalFilename: uploadedReceipt.filename,
      mimeType: uploadedReceipt.mimeType,
      status: 'queued',
    });

    const processingMode = (process.env.OCR_PROCESSING_MODE || (process.env.VERCEL ? 'async' : 'inline')).toLowerCase();

    if (processingMode === 'inline') {
      const inlineResult = await extractReceiptData(req.file.buffer);
      job.status = 'completed';
      job.result = inlineResult;
      job.error = null;
      job.processedAt = new Date();
      await job.save();

      return res.json({
        success: true,
        mode: 'inline',
        jobId: job._id,
        result: inlineResult,
      });
    }

    res.status(202).json({
      success: true,
      mode: 'async',
      jobId: job._id,
      status: job.status,
      statusUrl: `/api/ocr/jobs/${job._id}`,
      receipt: {
        url: uploadedReceipt.url,
        storageId: uploadedReceipt.storageId,
      },
    });
  } catch (error) {
    console.error('OCR error:', error);
    res.status(500).json({
      message: 'Failed to submit receipt for OCR',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getOcrJobStatus = async (req, res) => {
  try {
    const job = await OcrJob.findById(req.params.jobId).lean();

    if (!job) {
      return res.status(404).json({ message: 'OCR job not found' });
    }

    if (job.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    return res.json({
      jobId: job._id.toString(),
      status: job.status,
      result: job.result,
      error: job.error,
      attempts: job.attempts,
      sourceUrl: job.sourceUrl,
      processedAt: job.processedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (error) {
    console.error('OCR job status error:', error);
    res.status(500).json({ message: 'Failed to load OCR job status' });
  }
};

export const processOcrQueue = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 20);
    const results = await processPendingOcrJobs(limit);

    res.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('OCR queue processing error:', error);
    res.status(500).json({ message: 'Failed to process OCR queue' });
  }
};
