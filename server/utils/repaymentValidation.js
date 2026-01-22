import RepaymentRequest from '../models/RepaymentRequest.js';
import { calculatePersonBalance } from '../jobs/crossGroupBalanceService.js';

/**
 * Validate repayment amount against owed amount
 * @param {string} requesterId - User ID of the person requesting payment
 * @param {string} receiverId - User ID of the person who owes money
 * @param {number} amount - Amount being requested
 * @returns {Promise<{isValid: boolean, error?: string, owedAmount?: number}>}
 */
export const validateRepaymentAmount = async (requesterId, receiverId, amount) => {
  try {
    // Calculate current balance between users from requester's perspective
    const personBalance = await calculatePersonBalance(requesterId, receiverId);

    if (!personBalance || personBalance.netBalance <= 0) {
      return {
        isValid: false,
        error: 'This person does not owe you money',
        owedAmount: 0
      };
    }

    const owedAmount = personBalance.netBalance;

    // Validate amount doesn't exceed owed amount (with small tolerance for floating point)
    if (amount > owedAmount + 0.01) {
      return {
        isValid: false,
        error: `Amount ₹${amount} exceeds what is owed (₹${owedAmount.toFixed(2)})`,
        owedAmount
      };
    }

    // Validate minimum amount
    if (amount < 0.01) {
      return {
        isValid: false,
        error: 'Amount must be at least ₹0.01',
        owedAmount
      };
    }

    return {
      isValid: true,
      owedAmount
    };
  } catch (error) {
    console.error('Error validating repayment amount:', error);
    return {
      isValid: false,
      error: 'Failed to validate amount',
      owedAmount: 0
    };
  }
};

/**
 * Check cooldown period between repayment requests
 * @param {string} requesterId - User ID of the person requesting payment
 * @param {string} receiverId - User ID of the person who owes money
 * @returns {Promise<{canRequest: boolean, hoursRemaining?: number, lastRequestAt?: Date}>}
 */
export const checkCooldownPeriod = async (requesterId, receiverId) => {
  try {
    const lastRequest = await RepaymentRequest.findOne({
      requesterId,
      receiverId,
      status: { $in: ['pending', 'partially_paid'] },
    }).sort({ requestedAt: -1 });

    if (!lastRequest) {
      return { canRequest: true };
    }

    const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const timeSinceLastRequest = Date.now() - lastRequest.requestedAt.getTime();

    if (timeSinceLastRequest >= cooldownPeriod) {
      return { canRequest: true };
    }

    const hoursRemaining = Math.ceil((cooldownPeriod - timeSinceLastRequest) / (60 * 60 * 1000));

    return {
      canRequest: false,
      hoursRemaining,
      lastRequestAt: lastRequest.requestedAt
    };
  } catch (error) {
    console.error('Error checking cooldown period:', error);
    return { canRequest: false, error: 'Failed to check cooldown period' };
  }
};

/**
 * Combined validation for repayment requests
 * @param {string} requesterId - User ID of the person requesting payment
 * @param {string} receiverId - User ID of the person who owes money
 * @param {number} amount - Amount being requested
 * @returns {Promise<{isValid: boolean, errors: string[], warnings: string[], data?: any}>}
 */
export const canRequestRepayment = async (requesterId, receiverId, amount) => {
  const errors = [];
  const warnings = [];
  const data = {};

  try {
    // Validate amount
    const amountValidation = await validateRepaymentAmount(requesterId, receiverId, amount);
    if (!amountValidation.isValid) {
      errors.push(amountValidation.error);
    } else {
      data.owedAmount = amountValidation.owedAmount;
    }

    // Check cooldown period
    const cooldownValidation = await checkCooldownPeriod(requesterId, receiverId);
    if (!cooldownValidation.canRequest) {
      if (cooldownValidation.hoursRemaining) {
        errors.push(`Please wait ${cooldownValidation.hoursRemaining} hours before sending another request`);
      } else {
        errors.push('Cannot send request at this time');
      }
    }

    // Check pending requests limit
    const pendingCount = await RepaymentRequest.getPendingRequestsCount(requesterId, receiverId);
    if (pendingCount >= 3) {
      errors.push('Maximum 3 pending requests allowed per person');
    }
    data.pendingRequestsCount = pendingCount;

    // Check daily request limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dailyCount = await RepaymentRequest.countDocuments({
      requesterId,
      requestedAt: {
        $gte: today,
        $lt: tomorrow
      }
    });

    if (dailyCount >= 10) {
      errors.push('Maximum 10 requests per day allowed');
    }
    data.dailyRequestsCount = dailyCount;

    // Add warnings for existing requests
    if (pendingCount > 0) {
      warnings.push(`You have ${pendingCount} pending request${pendingCount > 1 ? 's' : ''} to this person`);
    }

    if (dailyCount >= 5) {
      warnings.push(`You've sent ${dailyCount} requests today. Consider consolidating requests.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      data
    };
  } catch (error) {
    console.error('Error validating repayment request:', error);
    return {
      isValid: false,
      errors: ['Failed to validate request'],
      warnings: [],
      data: {}
    };
  }
};

/**
 * Calculate the amount owed between two users
 * @param {string} requesterId - User ID of the person requesting payment
 * @param {string} receiverId - User ID of the person who owes money
 * @returns {Promise<{amount: number, currency: string, groups: Array}>}
 */
export const calculateOwedAmount = async (requesterId, receiverId) => {
  try {
    const personBalance = await calculatePersonBalance(requesterId, receiverId);

    if (!personBalance || personBalance.netBalance <= 0) {
      return {
        amount: 0,
        currency: 'INR',
        groups: []
      };
    }

    return {
      amount: personBalance.netBalance,
      currency: 'INR',
      groups: personBalance.groups || []
    };
  } catch (error) {
    console.error('Error calculating owed amount:', error);
    return {
      amount: 0,
      currency: 'INR',
      groups: []
    };
  }
};

/**
 * Auto-cancel old repayment requests (older than 90 days)
 * @returns {Promise<number>} Number of cancelled requests
 */
export const autoCancelOldRequests = async () => {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const result = await RepaymentRequest.updateMany(
      {
        status: { $in: ['pending', 'partially_paid'] },
        requestedAt: { $lt: ninetyDaysAgo }
      },
      {
        status: 'cancelled',
        notes: 'Auto-cancelled due to age (90 days)'
      }
    );

    return result.modifiedCount;
  } catch (error) {
    console.error('Error auto-cancelling old requests:', error);
    return 0;
  }
};

/**
 * Get repayment request statistics for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Statistics object
 */
export const getRepaymentRequestStats = async (userId) => {
  try {
    const [
      totalSent,
      totalReceived,
      pendingSent,
      pendingReceived,
      settledSent,
      settledReceived
    ] = await Promise.all([
      RepaymentRequest.countDocuments({ requesterId: userId }),
      RepaymentRequest.countDocuments({ receiverId: userId }),
      RepaymentRequest.countDocuments({ requesterId: userId, status: { $in: ['pending', 'partially_paid'] } }),
      RepaymentRequest.countDocuments({ receiverId: userId, status: { $in: ['pending', 'partially_paid'] } }),
      RepaymentRequest.countDocuments({ requesterId: userId, status: 'settled' }),
      RepaymentRequest.countDocuments({ receiverId: userId, status: 'settled' })
    ]);

    return {
      totalSent,
      totalReceived,
      pendingSent,
      pendingReceived,
      settledSent,
      settledReceived,
      activeRequests: pendingSent + pendingReceived,
      completionRate: totalSent > 0 ? Math.round((settledSent / totalSent) * 100) : 0
    };
  } catch (error) {
    console.error('Error getting repayment request stats:', error);
    return {
      totalSent: 0,
      totalReceived: 0,
      pendingSent: 0,
      pendingReceived: 0,
      settledSent: 0,
      settledReceived: 0,
      activeRequests: 0,
      completionRate: 0
    };
  }
};

export default {
  validateRepaymentAmount,
  checkCooldownPeriod,
  canRequestRepayment,
  calculateOwedAmount,
  autoCancelOldRequests,
  getRepaymentRequestStats
};
