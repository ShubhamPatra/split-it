import crypto from 'crypto';
import path from 'path';

export const validateFile = (req, res, next) => {
  if (!req.file) return next();

  // Check file size
  if (req.file.size > 10 * 1024 * 1024) {
    return res.status(400).json({ message: 'File too large' });
  }

  // Validate MIME type
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimes.includes(req.file.mimetype)) {
    return res.status(400).json({ message: 'Invalid file type' });
  }

  // Generate secure filename
  const hash = crypto.randomBytes(16).toString('hex');
  const ext = path.extname(req.file.originalname);
  req.file.secureFilename = `${hash}${ext}`;

  next();
};
