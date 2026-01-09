import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import fs from 'fs';
import crypto from 'crypto';

// Ensure uploads directory exists
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'receipts');
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (error) {
  // Directory might already exist or user doesn't have permissions
  // This is fine - we'll handle it when actually writing files
  if (error.code !== 'EEXIST') {
    console.warn('Warning: Could not create uploads directory:', error.message);
  }
}

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
  
  // Ensure directory exists before trying to write
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.error('Failed to create uploads directory:', error);
      throw new Error('Unable to save receipts - directory creation failed');
    }
  }
  
  for (const file of files) {
    try {
      // Process image for optimization
      const processedBuffer = await processImage(file.buffer);
      
      // Generate unique filename
      const uniqueId = crypto.randomBytes(8).toString('hex');
      const filename = `${expenseId}_${uniqueId}.jpg`;
      const filepath = path.join(UPLOAD_DIR, filename);
      
      // Write file to disk
      await fs.promises.writeFile(filepath, processedBuffer);
      
      // Generate URL path (relative to server)
      const url = `/uploads/receipts/${filename}`;
      
      savedReceipts.push({
        url,
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
      const filename = path.basename(receipt.url);
      const filepath = path.join(UPLOAD_DIR, filename);
      await fs.promises.unlink(filepath);
    } catch (error) {
      // File may not exist, ignore errors
      console.error('Error deleting receipt file:', error.message);
    }
  }
};
