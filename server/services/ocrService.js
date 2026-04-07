import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import OcrJob from '../models/OcrJob.js';

const preprocessImage = async (imageBuffer) => {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    let processedImage = image;
    if (metadata.width < 800) {
      processedImage = processedImage.resize({ width: 800 });
    }

    processedImage = processedImage
      .grayscale()
      .normalize()
      .sharpen();

    return await processedImage.toBuffer();
  } catch (error) {
    console.error('Image preprocessing error:', error);
    return imageBuffer;
  }
};

const extractMerchantName = (text) => {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    if (line.length >= 3 && line.length <= 50 &&
      !line.match(/^\d+/) &&
      !line.match(/\d{10}/) &&
      !line.match(/\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/)) {
      return line;
    }
  }
  return null;
};

const extractDate = (text) => {
  const datePatterns = [
    /(\d{1,2}[-/]\d{1,2}[-/]\d{4})/,
    /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
};

const extractTotalAmount = (text) => {
  const totalPatterns = [
    /(?:grand\s+)?total[:\s]*(?:rs\.?|₹)?\s*([\d.,]+)/i,
    /(?:amount|sum)[:\s]*(?:rs\.?|₹)?\s*([\d.,]+)/i,
    /(?:net\s+)?payable[:\s]*(?:rs\.?|₹)?\s*([\d.,]+)/i,
  ];

  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) {
      let amountStr = match[1].trim();
      const lastComma = amountStr.lastIndexOf(',');
      const lastDot = amountStr.lastIndexOf('.');

      if (lastComma > lastDot) {
        amountStr = amountStr.replace(/\./g, '').replace(',', '.');
      } else {
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

const extractLineItems = (text) => {
  const lines = text.split('\n');
  const items = [];

  const itemPattern = /^(.+?)\s+(?:x\s*)?(\d+)\s+(?:rs\.?|₹)?\s*(\d+(?:[.,]\d{2})?)/i;
  const simpleItemPattern = /^(.+?)\s+(?:rs\.?|₹)?\s*(\d+(?:[.,]\d{2})?)\s*$/i;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.length === 0 ||
      trimmedLine.match(/^(?:total|subtotal|tax|discount|thank you|visit)/i)) {
      continue;
    }

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

const calculateConfidence = (extracted) => {
  let score = 0;
  let maxScore = 0;

  maxScore += 0.2;
  if (extracted.merchantName) score += 0.2;

  maxScore += 0.2;
  if (extracted.date) score += 0.2;

  maxScore += 0.4;
  if (extracted.amount) score += 0.4;

  maxScore += 0.2;
  if (extracted.lineItems && extracted.lineItems.length > 0) score += 0.2;

  return maxScore > 0 ? score / maxScore : 0;
};

export const extractReceiptData = async (imageBuffer) => {
  const preprocessedImage = await preprocessImage(imageBuffer);

  const { data: { text, confidence } } = await Tesseract.recognize(
    preprocessedImage,
    'eng',
    {
      logger: process.env.NODE_ENV === 'development' ? (m) => console.log(m) : undefined,
    }
  );

  const extracted = {
    merchantName: extractMerchantName(text),
    date: extractDate(text),
    amount: extractTotalAmount(text),
    lineItems: extractLineItems(text),
  };

  const extractionConfidence = calculateConfidence(extracted);

  return {
    rawText: text,
    ocrConfidence: confidence / 100,
    extractionConfidence,
    extracted,
  };
};

export const processPendingOcrJobs = async (limit = 5) => {
  const jobs = await OcrJob.find({ status: 'queued' })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();

  const results = [];

  for (const job of jobs) {
    const claimed = await OcrJob.findOneAndUpdate(
      { _id: job._id, status: 'queued' },
      { $set: { status: 'processing' }, $inc: { attempts: 1 } },
      { new: true }
    ).lean();

    if (!claimed) {
      continue;
    }

    try {
      const response = await fetch(job.sourceUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch receipt image: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const result = await extractReceiptData(buffer);

      await OcrJob.findByIdAndUpdate(job._id, {
        status: 'completed',
        result,
        error: null,
        processedAt: new Date(),
      });

      results.push({ jobId: job._id.toString(), status: 'completed' });
    } catch (error) {
      await OcrJob.findByIdAndUpdate(job._id, {
        status: 'failed',
        error: error.message,
        processedAt: new Date(),
      });

      results.push({ jobId: job._id.toString(), status: 'failed', error: error.message });
    }
  }

  return results;
};