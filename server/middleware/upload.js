import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import fs from 'fs';
import crypto from 'crypto';

// Ensure uploads directory exists
// Use UPLOAD_DIR env var if set, otherwise default to ./uploads/receipts
// This allows flexibility: either use named Docker volume or tmp directory
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'receipts');

// Create directory if it doesn't exist
const ensureUploadDir = () => {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    return true;
  } catch (error) {
    // Directory might already exist or user doesn't have permissions
    // This is fine - we'll handle it when actually writing files
    if (error.code !== 'EEXIST') {
      console.warn('Warning: Could not create uploads directory at', UPLOAD_DIR, ':', error.message);
    }
    return false;
  }
};

// Attempt to create directory on module load
ensureUploadDir();

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
  // This is critical when using Docker volumes that may not exist yet
  if (!ensureUploadDir()) {
    // Log a warning but continue - error will be caught during file write
    console.warn('Could not ensure upload directory exists, continuing with file operations');
  }
  
  for (const file of files) {
    try {
      // Process image for optimization
      const processedBuffer = await processImage(file.buffer);
      
      // Generate unique filename
      const uniqueId = crypto.randomBytes(8).toString('hex');
      const filename = `${expenseId}_${uniqueId}.jpg`;
      const filepath = path.join(UPLOAD_DIR, filename);
      
      // Write file to disk with proper error handling
      // This will fail with EACCES if directory is not writable
      try {
        await fs.promises.writeFile(filepath, processedBuffer);
      } catch (writeError) {
        if (writeError.code === 'EACCES') {
          console.error(`EACCES: Permission denied writing to ${filepath}. Check that UPLOAD_DIR (${UPLOAD_DIR}) is writable by the container user.`);
        } else if (writeError.code === 'ENOENT') {
          console.error(`ENOENT: Upload directory does not exist: ${UPLOAD_DIR}. Check UPLOAD_DIR environment variable and Docker volume configuration.`);
        }
        throw writeError;
      }
      
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
      if (error.code !== 'ENOENT') {
        console.error('Error deleting receipt file:', error.message);
      }
    }
  }
};
