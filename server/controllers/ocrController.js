import Tesseract from 'tesseract.js';
import sharp from 'sharp';

/**
 * Preprocess image for better OCR accuracy
 * - Convert to grayscale
 * - Increase contrast
 * - Sharpen
 * - Resize if too small
 */
const preprocessImage = async (imageBuffer) => {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    // Resize if image is too small (min 800px width for better OCR)
    let processedImage = image;
    if (metadata.width < 800) {
      processedImage = processedImage.resize({ width: 800 });
    }

    // Apply preprocessing: grayscale, normalize, sharpen
    processedImage = processedImage
      .grayscale()
      .normalize()
      .sharpen();

    return await processedImage.toBuffer();
  } catch (error) {
    console.error('Image preprocessing error:', error);
    // Return original buffer if preprocessing fails
    return imageBuffer;
  }
};

/**
 * Extract merchant name from receipt text
 * Usually appears at the top of the receipt
 */
const extractMerchantName = (text) => {
  const lines = text.split('\n').filter(line => line.trim().length > 0);

  // Merchant name is typically in the first few lines
  // Look for lines with reasonable length (not too short, not too long)
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    // Skip lines that look like addresses, phone numbers, or dates
    if (line.length >= 3 && line.length <= 50 &&
      !line.match(/^\d+/) &&
      !line.match(/\d{10}/) &&
      !line.match(/\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/)) {
      return line;
    }
  }

  return null;
};

/**
 * Extract date from receipt text
 * Supports multiple date formats
 */
const extractDate = (text) => {
  // Try different date formats
  const datePatterns = [
    /(\d{1,2}[-/]\d{1,2}[-/]\d{4})/,           // DD-MM-YYYY or DD/MM/YYYY
    /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/,           // YYYY-MM-DD
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i, // DD Mon YYYY
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
};

/**
 * Extract total amount from receipt text
 * Looks for keywords like "total", "amount", "grand total"
 * Supports amounts with thousand separators (e.g., 1,234.00 or 1.234,00)
 */
const extractTotalAmount = (text) => {
  // Patterns for total amount (support thousand separators with commas or dots)
  // Matches formats like: 1234, 1,234, 1.234, 1,234.56, 1.234,56
  const totalPatterns = [
    /(?:grand\s+)?total[:\s]*(?:rs\.?|₹)?\s*([\d.,]+)/i,
    /(?:amount|sum)[:\s]*(?:rs\.?|₹)?\s*([\d.,]+)/i,
    /(?:net\s+)?payable[:\s]*(?:rs\.?|₹)?\s*([\d.,]+)/i,
  ];

  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) {
      let amountStr = match[1].trim();

      // Normalize amount string to handle different locale formats
      // Detect format: if comma comes after dot, comma is decimal separator (European: 1.234,56)
      // If dot comes after comma, or there's only comma, comma is thousand separator (US: 1,234.56)
      const lastComma = amountStr.lastIndexOf(',');
      const lastDot = amountStr.lastIndexOf('.');

      if (lastComma > lastDot) {
        // European format: 1.234,56 - comma is decimal separator
        amountStr = amountStr.replace(/\./g, '').replace(',', '.');
      } else {
        // US format: 1,234.56 - comma is thousand separator
        amountStr = amountStr.replace(/,/g, '');
      }

      const parsed = parseFloat(amountStr);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
};

/**
 * Extract line items from receipt text
 * Attempts to parse item name, quantity, and price
 */
const extractLineItems = (text) => {
  const lines = text.split('\n');
  const items = [];

  // Pattern: Item name followed by quantity and price
  // Example: "Coffee 2 50.00" or "Tea x2 30"
  const itemPattern = /^(.+?)\s+(?:x\s*)?(\d+)\s+(?:rs\.?|₹)?\s*(\d+(?:[.,]\d{2})?)/i;

  // Alternative pattern: Item name and price only
  const simpleItemPattern = /^(.+?)\s+(?:rs\.?|₹)?\s*(\d+(?:[.,]\d{2})?)\s*$/i;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and lines that look like headers/footers
    if (trimmedLine.length === 0 ||
      trimmedLine.match(/^(?:total|subtotal|tax|discount|thank you|visit)/i)) {
      continue;
    }

    // Try pattern with quantity
    let match = trimmedLine.match(itemPattern);
    if (match) {
      const itemName = match[1].trim();
      const quantity = parseInt(match[2]);
      const price = parseFloat(match[3].replace(',', '.'));

      if (itemName.length > 0 && quantity > 0 && price > 0) {
        items.push({
          description: itemName,
          quantity,
          unitPrice: price / quantity,
          totalPrice: price,
        });
        continue;
      }
    }

    // Try simple pattern (item and price only)
    match = trimmedLine.match(simpleItemPattern);
    if (match) {
      const itemName = match[1].trim();
      const price = parseFloat(match[2].replace(',', '.'));

      if (itemName.length > 2 && price > 0) {
        items.push({
          description: itemName,
          quantity: 1,
          unitPrice: price,
          totalPrice: price,
        });
      }
    }
  }

  return items.length > 0 ? items : null;
};

/**
 * Calculate confidence score based on extracted data
 * Returns a score from 0 to 1
 */
const calculateConfidence = (extracted) => {
  let score = 0;
  let maxScore = 0;

  // Merchant name (weight: 0.2)
  maxScore += 0.2;
  if (extracted.merchantName) {
    score += 0.2;
  }

  // Date (weight: 0.2)
  maxScore += 0.2;
  if (extracted.date) {
    score += 0.2;
  }

  // Total amount (weight: 0.4 - most important)
  maxScore += 0.4;
  if (extracted.amount) {
    score += 0.4;
  }

  // Line items (weight: 0.2)
  maxScore += 0.2;
  if (extracted.lineItems && extracted.lineItems.length > 0) {
    score += 0.2;
  }

  return maxScore > 0 ? score / maxScore : 0;
};

/**
 * Scan receipt and extract structured data
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

    // Preprocess image for better OCR accuracy
    const preprocessedImage = await preprocessImage(req.file.buffer);

    // OCR processing with Tesseract
    const { data: { text, confidence } } = await Tesseract.recognize(
      preprocessedImage,
      'eng',
      {
        logger: process.env.NODE_ENV === 'development' ? (m) => console.log(m) : undefined,
      }
    );

    // Extract structured data from OCR text
    const merchantName = extractMerchantName(text);
    const date = extractDate(text);
    const amount = extractTotalAmount(text);
    const lineItems = extractLineItems(text);

    const extracted = {
      merchantName,
      date,
      amount,
      lineItems,
    };

    // Calculate confidence score
    const extractionConfidence = calculateConfidence(extracted);

    res.json({
      success: true,
      rawText: text,
      ocrConfidence: confidence / 100, // Tesseract confidence (0-1)
      extractionConfidence, // Our extraction confidence (0-1)
      extracted,
    });
  } catch (error) {
    console.error('OCR error:', error);
    res.status(500).json({
      message: 'Failed to process receipt',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
