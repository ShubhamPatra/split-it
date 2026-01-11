/**
 * Settlement Helper Functions
 * 
 * Utility functions for balance normalization, validation, and currency conversion.
 * Uses integer arithmetic (paise) internally to avoid floating-point precision issues.
 */

/**
 * Converts rupee amount to paise (integer)
 * @param {number} amount - Amount in rupees
 * @returns {number} Amount in paise (integer)
 */
export function convertToPaise(amount) {
  // Use Math.round to handle floating-point precision issues
  // e.g., 33.33 * 100 might give 3332.9999999999995
  return Math.round(amount * 100);
}

/**
 * Converts paise amount back to rupees
 * @param {number} paise - Amount in paise
 * @returns {number} Amount in rupees (2 decimal places)
 */
export function convertToRupees(paise) {
  return Number((paise / 100).toFixed(2));
}

/**
 * Validates balance object for settlement
 * @param {Object<string, number>} balances - User balances (positive = owed, negative = owes)
 * @throws {Error} If validation fails
 */
export function validateBalances(balances) {
  // Check for null/undefined input
  if (!balances || typeof balances !== 'object') {
    throw new Error('Invalid balances input');
  }

  const entries = Object.entries(balances);
  
  // Filter out zero balances for validation purposes
  const nonZeroEntries = entries.filter(([_, balance]) => Math.abs(balance) > 0.001);
  
  // Empty or all-zero balances are valid but result in no settlements
  if (nonZeroEntries.length === 0) {
    return { valid: true, empty: true };
  }

  // Need at least 2 people with non-zero balances
  if (nonZeroEntries.length < 2) {
    throw new Error('Need at least 2 people to settle');
  }

  // Calculate sum to verify it's approximately zero
  const sum = entries.reduce((acc, [_, balance]) => acc + balance, 0);
  const tolerance = 0.01; // 1 paisa tolerance
  
  if (Math.abs(sum) > tolerance) {
    const offBy = Math.abs(sum).toFixed(2);
    throw new Error(`Balances don't sum to zero (off by ₹${offBy})`);
  }

  // Check for at least one debtor (negative) and one creditor (positive)
  const hasDebtor = nonZeroEntries.some(([_, balance]) => balance < 0);
  const hasCreditor = nonZeroEntries.some(([_, balance]) => balance > 0);
  
  if (!hasDebtor || !hasCreditor) {
    throw new Error('Need at least one debtor and one creditor');
  }

  return { valid: true, empty: false };
}

/**
 * Normalizes balances to integer paise and filters out zeros
 * @param {Object<string, number>} balances - User balances in rupees
 * @returns {Array<{id: string, balance: number}>} Array of people with non-zero paise balances
 */
export function normalizeBalances(balances) {
  const people = [];
  
  for (const [id, balance] of Object.entries(balances)) {
    const paiseBalance = convertToPaise(balance);
    
    // Filter out zero or near-zero balances (< 1 paisa)
    if (Math.abs(paiseBalance) >= 1) {
      people.push({ id, balance: paiseBalance });
    }
  }
  
  return people;
}

/**
 * Consolidates settlements and converts amounts back to rupees
 * @param {Array<{from: string, to: string, amount: number}>} settlements - Settlements in paise
 * @returns {Array<{from: string, to: string, amount: number}>} Settlements in rupees
 */
export function consolidateAndConvert(settlements) {
  // Consolidate any duplicate from-to pairs (shouldn't happen but safety first)
  const consolidated = new Map();
  
  for (const { from, to, amount } of settlements) {
    const key = `${from}|${to}`;
    const reverseKey = `${to}|${from}`;
    
    if (consolidated.has(reverseKey)) {
      // Handle reverse direction - net out the amounts
      const existing = consolidated.get(reverseKey);
      const netAmount = existing - amount;
      
      if (netAmount > 0) {
        consolidated.set(reverseKey, netAmount);
      } else if (netAmount < 0) {
        consolidated.delete(reverseKey);
        consolidated.set(key, -netAmount);
      } else {
        consolidated.delete(reverseKey);
      }
    } else {
      consolidated.set(key, (consolidated.get(key) || 0) + amount);
    }
  }
  
  // Convert to rupees and return
  const result = [];
  
  for (const [key, amount] of consolidated) {
    if (amount > 0) {
      const [from, to] = key.split('|');
      result.push({
        from,
        to,
        amount: convertToRupees(amount)
      });
    }
  }
  
  // Sort by amount descending for consistent output
  result.sort((a, b) => b.amount - a.amount);
  
  return result;
}

/**
 * Generates a state key for memoization based on current balances
 * Uses only balance values (sorted) to reduce memo size and exploit symmetry
 * @param {Array<{id: string, balance: number}>} people - People with balances
 * @returns {string} State key for memoization
 */
export function generateStateKey(people) {
  // Extract non-zero balances and sort them
  const balances = people
    .map(p => p.balance)
    .filter(b => b !== 0)
    .sort((a, b) => a - b);
  
  return balances.join(',');
}

/**
 * Deep clones a people array (used sparingly for safety)
 * @param {Array<{id: string, balance: number}>} people 
 * @returns {Array<{id: string, balance: number}>}
 */
export function clonePeople(people) {
  return people.map(p => ({ ...p }));
}
