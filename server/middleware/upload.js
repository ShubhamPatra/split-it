import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import { deleteCloudinaryAsset, uploadBufferToCloudinary } from '../services/cloudinaryStorage.js';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Only image files are allowed'));
};

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter,
});

// Multiple receipts upload (up to 5 files)
export const uploadReceipts = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter,
}).array('receipts', 5);

export const processImage = async (buffer) => {
  return sharp(buffer)
    .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
};

/**
 * Process and save receipt files to disk
 * @param {Array} files - Array of multer file objects
 * @param {string} expenseId - Expense ID for organizing files
 * @returns {Promise<Array>} Array of receipt metadata with URLs
 */
export const saveReceiptFiles = async (files, expenseId) => {
  const savedReceipts = [];

  for (const file of files) {
    try {
      // Process image for optimization
      const processedBuffer = await processImage(file.buffer);

      const uploadResult = await uploadBufferToCloudinary({
        buffer: processedBuffer,
        filename: file.originalname,
        mimeType: 'image/jpeg',
        folder: `split-it/expenses/${expenseId}`,
      });
      
      savedReceipts.push({
        url: uploadResult.url,
        storageId: uploadResult.storageId,
        filename: file.originalname,
        mimeType: 'image/jpeg', // Always jpeg after processing
        uploadedAt: new Date(),
      });
    } catch (error) {
      console.error('Error saving receipt file:', error);
      // Continue with other files even if one fails
    }
  }
  
  return savedReceipts;
};

/**
 * Delete receipt files from disk
 * @param {Array} receipts - Array of receipt objects with url property
 */
export const deleteReceiptFiles = async (receipts) => {
  for (const receipt of receipts) {
    try {
      if (receipt.storageId) {
        await deleteCloudinaryAsset(receipt.storageId, 'image');
      }
    } catch (error) {
      console.error('Error deleting receipt file:', error.message);
    }
  }
};
