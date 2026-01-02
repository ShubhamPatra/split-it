/**
 * UPI Validation Middleware for Backend
 */

// UPI provider domains
const UPI_PROVIDERS = {
  PAYTM: ['paytm'],
  PHONEPE: ['ybl', 'ibl', 'axl'],
  GPAY: ['okaxis', 'okhdfcbank', 'okicici', 'oksbi'],
  BHIM: ['upi'],
  AMAZON: ['apl'],
  WHATSAPP: ['wa'],
  CRED: ['axisbank'],
  FREECHARGE: ['freecharge'],
  MOBIKWIK: ['mobikwik'],
};

// Bank domains
const BANK_DOMAINS = [
  'sbi', 'oksbi', 'hdfcbank', 'okhdfcbank', 'icici', 'okicici',
  'axisbank', 'axl', 'okaxis', 'kotak', 'pnb', 'barodampay',
  'cnrb', 'unionbank', 'ybl', 'yesbankltd', 'idfcfirstbank', 'indus'
];

/**
 * Comprehensive UPI ID validation
 * @param {string} upiId - UPI ID to validate
 * @returns {Object} Validation result
 */
export const validateUpiId = (upiId) => {
  const result = {
    isValid: false,
    provider: null,
    bank: null,
    username: null,
    error: null,
  };

  if (!upiId || typeof upiId !== 'string') {
    result.error = 'UPI ID is required';
    return result;
  }

  const trimmed = upiId.trim().toLowerCase();
  
  // Basic format validation: username@handle
  const upiRegex = /^([a-z0-9._-]+)@([a-z0-9.-]+)$/i;
  const match = trimmed.match(upiRegex);
  
  if (!match) {
    result.error = 'Invalid UPI ID format. Expected: username@handle';
    return result;
  }

  const [, username, handle] = match;
  
  // Username validation
  if (username.length < 3 || username.length > 50) {
    result.error = 'Username must be between 3-50 characters';
    return result;
  }

  // Check for invalid patterns
  if (username.startsWith('.') || username.endsWith('.') || 
      username.includes('..') || handle.includes('..')) {
    result.error = 'Invalid characters or pattern in UPI ID';
    return result;
  }

  result.isValid = true;
  result.username = username;

  // Detect provider
  for (const [providerName, domains] of Object.entries(UPI_PROVIDERS)) {
    if (domains.some(domain => handle.includes(domain))) {
      result.provider = providerName;
      break;
    }
  }

  // Detect bank
  if (BANK_DOMAINS.some(domain => handle.includes(domain))) {
    result.bank = handle;
  }

  return result;
};

/**
 * Validate payment amount
 * @param {number} amount - Amount to validate
 * @returns {Object} Validation result
 */
export const validatePaymentAmount = (amount) => {
  const result = { isValid: false, error: null };

  if (!amount || isNaN(amount)) {
    result.error = 'Invalid amount';
    return result;
  }

  const numAmount = Number(amount);

  if (numAmount <= 0) {
    result.error = 'Amount must be greater than 0';
    return result;
  }

  if (numAmount > 100000) {
    result.error = 'Amount cannot exceed ₹1,00,000 per transaction';
    return result;
  }

  // Check decimal places
  const decimalPlaces = (amount.toString().split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    result.error = 'Amount can have maximum 2 decimal places';
    return result;
  }

  result.isValid = true;
  return result;
};

/**
 * Generate transaction reference ID
 * @returns {string} Unique transaction reference
 */
export const generateTransactionRef = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SPLIT${timestamp}${random}`;
};

const upiValidation = {
  validateUpiId,
  validatePaymentAmount,
  generateTransactionRef,
};

export default upiValidation;
