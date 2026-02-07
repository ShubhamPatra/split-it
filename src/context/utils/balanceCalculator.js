/**
 * Balance calculation utilities
 * Extracted from GroupContext.jsx for better maintainability and testability
 */

/**
 * Calculate balances for a group based on expenses and settlements
 * 
 * @param {Object} params - Calculation parameters
 * @param {Array} params.expenses - Array of expenses for the group
 * @param {Array} params.settlements - Array of settlements for the group
 * @param {Array} params.memberIds - Array of member IDs in the group
 * @returns {Object} Balance map where keys are user IDs and values are balance amounts
 *                   Positive = user is owed money, Negative = user owes money
 * 
 * @algorithm
 * 1. Initialize all group members with balance = 0
 * 2. Process expenses:
 *    - Payer gets credited: balance += expense.amount
 *    - Each participant owes their share: balance -= shares[userId]
 * 3. Process confirmed settlements:
 *    - Payer gets credited: balance += settlement.amount
 *    - Receiver gets debited: balance -= settlement.amount
 * 4. Return final balance map
 */
export const calculateGroupBalances = ({ expenses, settlements, memberIds }) => {
  const balances = {};
  
  // Initialize balances for all members
  memberIds.forEach(memberId => {
    balances[memberId] = 0;
  });
  
  // Process expenses
  expenses.forEach(expense => {
    const shares = expense.splitConfig?.shares || {};
    
    // Payer gets credited
    balances[expense.paidBy] = (balances[expense.paidBy] || 0) + expense.amount;
    
    // Each member owes their share
    Object.entries(shares).forEach(([memberId, amount]) => {
      balances[memberId] = (balances[memberId] || 0) - amount;
    });
  });
  
  // Process settlements (only count confirmed settlements for balances)
  settlements
    .filter(settlement => settlement.paymentStatus === 'confirmed')
    .forEach(settlement => {
      balances[settlement.fromUserId] = (balances[settlement.fromUserId] || 0) + settlement.amount;
      balances[settlement.toUserId] = (balances[settlement.toUserId] || 0) - settlement.amount;
    });
  
  return balances;
};

/**
 * Calculate total expenses for a group
 * @param {Array} expenses - Array of expenses
 * @returns {number} Total amount of all expenses
 */
export const calculateTotalExpenses = (expenses) => {
  return expenses.reduce((sum, exp) => sum + exp.amount, 0);
};

/**
 * Normalize balance event data from socket
 * Handles both flat and nested socket event structures
 * 
 * @param {Object} balances - Balance data from socket event
 * @returns {Object|null} Normalized balance map or null if invalid
 * 
 * @event_structures
 * 1. Flat format: { userId1: 100, userId2: -100 }
 * 2. Nested format: { balances: { userId1: 100, userId2: -100 } }
 */
export const normalizeBalanceEvent = (balances) => {
  if (!balances || typeof balances !== 'object') {
    return null;
  }
  
  // Handle nested format
  if (balances.balances && typeof balances.balances === 'object') {
    return balances.balances;
  }
  
  // Handle flat format
  return balances;
};

/**
 * Validate balance event data
 * @param {string} groupId - Group ID from event
 * @param {Object} balances - Balance data from event
 * @returns {Object} Validation result { valid: boolean, error: string|null }
 */
export const validateBalanceEvent = (groupId, balances) => {
  if (!groupId || typeof groupId !== 'string') {
    return {
      valid: false,
      error: `Invalid groupId: ${groupId}`,
    };
  }
  
  if (!balances || typeof balances !== 'object') {
    return {
      valid: false,
      error: `Invalid balances: ${balances}`,
    };
  }
  
  return { valid: true, error: null };
};
