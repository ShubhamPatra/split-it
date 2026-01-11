/**
 * Utility Functions for Split-It App
 * 
 * Common helper functions used throughout the application
 */

/**
 * Format currency amount with proper locale
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: 'INR')
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = 'INR') => {
  const symbols = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
  };

  const symbol = symbols[currency] || currency;
  return `${symbol}${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

/**
 * Format date to readable string
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Calculate split amounts based on split configuration
 * @param {number} totalAmount - Total expense amount
 * @param {object} splitConfig - Split configuration object
 * @param {Array} members - Array of member IDs
 * @returns {object} Object mapping member IDs to their share amounts
 */
export const calculateSplitShares = (totalAmount, splitConfig, members) => {
  const { type, shares = {} } = splitConfig;
  const result = {};

  switch (type) {
    case 'equal':
      const equalShare = totalAmount / members.length;
      members.forEach((memberId) => {
        result[memberId] = equalShare;
      });
      break;

    case 'percentage':
      members.forEach((memberId) => {
        const percentage = shares[memberId] || 0;
        result[memberId] = (percentage / 100) * totalAmount;
      });
      break;

    case 'exact':
      members.forEach((memberId) => {
        result[memberId] = shares[memberId] || 0;
      });
      break;

    default:
      // Default to equal split
      const defaultShare = totalAmount / members.length;
      members.forEach((memberId) => {
        result[memberId] = defaultShare;
      });
  }

  return result;
};

/**
 * Validate UPI ID format
 * @param {string} upiId - UPI ID to validate
 * @returns {boolean} Whether UPI ID is valid
 */
export const validateUpiId = (upiId) => {
  if (!upiId) return false;
  // Basic UPI ID format: username@bankname
  const upiRegex = /^[\w.-]+@[\w.-]+$/;
  return upiRegex.test(upiId);
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Whether email is valid
 */
export const validateEmail = (email) => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Generate a simplified balance suggestion for settlements
 * @param {object} balances - Object mapping user IDs to balances
 * @returns {Array} Array of suggested transactions
 */
export const generateSettlementSuggestions = (balances) => {
  const suggestions = [];
  
  // Separate debtors and creditors
  const debtors = Object.entries(balances)
    .filter(([_, balance]) => balance < -0.01)
    .map(([userId, balance]) => ({ userId, amount: Math.abs(balance) }))
    .sort((a, b) => b.amount - a.amount);

  const creditors = Object.entries(balances)
    .filter(([_, balance]) => balance > 0.01)
    .map(([userId, balance]) => ({ userId, amount: balance }))
    .sort((a, b) => b.amount - a.amount);

  let i = 0, j = 0;
  
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    
    const settleAmount = Math.min(debtor.amount, creditor.amount);
    
    suggestions.push({
      from: debtor.userId,
      to: creditor.userId,
      amount: settleAmount,
    });

    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return suggestions;
};

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length (default: 50)
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

/**
 * Get initials from name
 * @param {string} name - Full name
 * @returns {string} Initials (max 2 characters)
 */
export const getInitials = (name) => {
  if (!name || typeof name !== 'string') return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || 'U';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Debounce function for performance optimization
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Group array of objects by a key
 * @param {Array} array - Array to group
 * @param {string} key - Key to group by
 * @returns {object} Grouped object
 */
export const groupBy = (array, key) => {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {});
};

/**
 * Calculate percentage change
 * @param {number} oldValue - Old value
 * @param {number} newValue - New value
 * @returns {number} Percentage change
 */
export const calculatePercentageChange = (oldValue, newValue) => {
  if (oldValue === 0) return newValue === 0 ? 0 : 100;
  return ((newValue - oldValue) / oldValue) * 100;
};
