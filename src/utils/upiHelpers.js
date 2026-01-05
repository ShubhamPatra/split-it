/**
 * UPI Helpers - Utilities for UPI payment processing
 */

// UPI provider configurations
export const UPI_PROVIDERS = {
  PAYTM: { id: 'paytm', name: 'Paytm', domains: ['paytm'] },
  PHONEPE: { id: 'phonepe', name: 'PhonePe', domains: ['ybl', 'ibl', 'axl'] },
  GPAY: { id: 'gpay', name: 'Google Pay', domains: ['okaxis', 'okhdfcbank', 'okicici', 'oksbi'] },
  BHIM: { id: 'bhim', name: 'BHIM', domains: ['upi'] },
  AMAZON: { id: 'amazonpay', name: 'Amazon Pay', domains: ['apl'] },
  WHATSAPP: { id: 'whatsapp', name: 'WhatsApp Pay', domains: ['wa'] },
  CRED: { id: 'cred', name: 'CRED', domains: ['axisbank'] },
  FREECHARGE: { id: 'freecharge', name: 'Freecharge', domains: ['freecharge'] },
  MOBIKWIK: { id: 'mobikwik', name: 'MobiKwik', domains: ['mobikwik'] },
};

// Bank UPI domains
export const BANK_DOMAINS = [
  { bank: 'State Bank of India', domains: ['sbi', 'oksbi'] },
  { bank: 'HDFC Bank', domains: ['hdfcbank', 'okhdfcbank'] },
  { bank: 'ICICI Bank', domains: ['icici', 'okicici'] },
  { bank: 'Axis Bank', domains: ['axisbank', 'axl', 'okaxis'] },
  { bank: 'Kotak Mahindra Bank', domains: ['kotak'] },
  { bank: 'Punjab National Bank', domains: ['pnb'] },
  { bank: 'Bank of Baroda', domains: ['barodampay'] },
  { bank: 'Canara Bank', domains: ['cnrb'] },
  { bank: 'Union Bank of India', domains: ['unionbank'] },
  { bank: 'Yes Bank', domains: ['ybl', 'yesbankltd'] },
  { bank: 'IDFC First Bank', domains: ['idfcfirstbank'] },
  { bank: 'IndusInd Bank', domains: ['indus'] },
];

/**
 * Comprehensive UPI ID validation with provider detection
 * @param {string} upiId - UPI ID to validate
 * @returns {Object} Validation result with isValid, provider, bank, username
 */
export const validateUpiId = (upiId) => {
  const result = {
    isValid: false,
    provider: null,
    bank: null,
    username: null,
    displayName: null,
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
  for (const provider of Object.values(UPI_PROVIDERS)) {
    if (provider.domains.some(domain => handle.includes(domain))) {
      result.provider = provider.name;
      break;
    }
  }

  // Detect bank
  for (const bankInfo of BANK_DOMAINS) {
    if (bankInfo.domains.some(domain => handle.includes(domain))) {
      result.bank = bankInfo.bank;
      break;
    }
  }

  // Generate display name
  if (result.provider) {
    result.displayName = `${username} (${result.provider})`;
  } else if (result.bank) {
    result.displayName = `${username} (${result.bank})`;
  } else {
    result.displayName = upiId;
  }

  return result;
};

/**
 * Generate UPI deep link URL
 * @param {Object} params - Payment parameters
 * @returns {string} UPI URL
 */
export const generateUpiUrl = ({ 
  receiverUpiId, 
  receiverName, 
  amount, 
  note = '', 
  transactionId = '',
  scheme = 'upi://pay' 
}) => {
  const params = new URLSearchParams({
    pa: receiverUpiId,
    pn: receiverName,
    am: amount.toFixed(2),
    cu: 'INR',
  });

  if (note) params.append('tn', note);
  if (transactionId) params.append('tr', transactionId);

  return `${scheme}?${params.toString()}`;
};

/**
 * Generate UPI intent for specific apps
 */
export const UPI_APP_INTENTS = {
  gpay: (params) => generateUpiUrl({ ...params, scheme: 'gpay://upi/pay' }),
  phonepe: (params) => generateUpiUrl({ ...params, scheme: 'phonepe://pay' }),
  paytm: (params) => generateUpiUrl({ ...params, scheme: 'paytmmp://pay' }),
  bhim: (params) => generateUpiUrl({ ...params, scheme: 'bhim://pay' }),
  amazonpay: (params) => generateUpiUrl({ ...params, scheme: 'amazonpay://pay' }),
  whatsapp: (params) => generateUpiUrl({ ...params, scheme: 'whatsapp://pay' }),
  default: (params) => generateUpiUrl(params),
};

/**
 * Detect user's device and recommend UPI apps
 * @returns {Object} Device info and recommended apps
 */
export const detectDeviceAndApps = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isAndroid = /android/i.test(userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(userAgent);

  const recommendedApps = [];
  
  if (isAndroid) {
    recommendedApps.push('gpay', 'phonepe', 'paytm', 'bhim');
  } else if (isIOS) {
    recommendedApps.push('gpay', 'phonepe', 'paytm', 'whatsapp');
  } else {
    recommendedApps.push('default'); // Show QR code
  }

  return {
    isMobile,
    isAndroid,
    isIOS,
    recommendedApps,
    showQRCode: !isMobile,
  };
};

/**
 * Format UPI ID for display
 * @param {string} upiId - UPI ID to format
 * @returns {string} Formatted UPI ID
 */
export const formatUpiIdForDisplay = (upiId) => {
  if (!upiId) return '';
  
  const validation = validateUpiId(upiId);
  if (validation.displayName) {
    return validation.displayName;
  }
  
  return upiId;
};

/**
 * Extract username from UPI ID
 * @param {string} upiId - UPI ID
 * @returns {string} Username portion
 */
export const getUpiUsername = (upiId) => {
  if (!upiId) return '';
  const parts = upiId.split('@');
  return parts[0] || '';
};

/**
 * Get UPI provider icon/emoji
 * @param {string} upiId - UPI ID
 * @returns {string} Icon emoji
 */
export const getUpiProviderIcon = (upiId) => {
  const validation = validateUpiId(upiId);
  
  const iconMap = {
    'Google Pay': '💚',
    'PhonePe': '💜',
    'Paytm': '💙',
    'BHIM': '🧡',
    'Amazon Pay': '🧡',
    'WhatsApp Pay': '💚',
    'CRED': '🖤',
    'Freecharge': '💛',
    'MobiKwik': '💙',
  };

  return iconMap[validation.provider] || '💰';
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

  if (!/^\d+(\.\d{1,2})?$/.test(amount.toString())) {
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

/**
 * Check if UPI payment is supported
 * @returns {boolean} Whether UPI is supported
 */
export const isUpiSupported = () => {
  // UPI is primarily supported in India
  // Check if running in supported environment
  try {
    const hasClipboard = !!navigator.clipboard;
    const canOpenLinks = typeof window !== 'undefined';
    return hasClipboard && canOpenLinks;
  } catch {
    return false;
  }
};

/**
 * Get payment method icon
 * @param {string} method - Payment method
 * @returns {string} Icon component name
 */
export const getPaymentMethodIcon = (method) => {
  const iconMap = {
    upi: 'Smartphone',
    cash: 'Wallet',
    bank: 'Building2',
    card: 'CreditCard',
    other: 'DollarSign',
  };
  return iconMap[method] || 'DollarSign';
};

export const upiHelpers = {
  validateUpiId,
  generateUpiUrl,
  UPI_APP_INTENTS,
  detectDeviceAndApps,
  formatUpiIdForDisplay,
  getUpiUsername,
  getUpiProviderIcon,
  validatePaymentAmount,
  generateTransactionRef,
  isUpiSupported,
  getPaymentMethodIcon,
  UPI_PROVIDERS,
  BANK_DOMAINS,
};

export default upiHelpers;
