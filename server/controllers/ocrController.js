import Tesseract from 'tesseract.js';
import { processImage } from '../middleware/upload.js';

export const scanReceipt = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    // Process image
    const processedImage = await processImage(req.file.buffer);

    // OCR processing
    const { data: { text } } = await Tesseract.recognize(processedImage, 'eng', {
      logger: m => console.log(m),
    });

    // Extract amount using regex
    const amountRegex = /(?:total|amount|sum)[:\s]*(?:rs\.?|₹)?\s*(\d+(?:\.\d{2})?)/i;
    const match = text.match(amountRegex);
    const amount = match ? parseFloat(match[1]) : null;

    // Extract date
    const dateRegex = /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/;
    const dateMatch = text.match(dateRegex);
    const date = dateMatch ? dateMatch[1] : null;

    res.json({
      success: true,
      text,
      extracted: {
        amount,
        date,
      },
    });
  } catch (error) {
    console.error('OCR error:', error);
    res.status(500).json({ message: 'Failed to process receipt' });
  }
};
