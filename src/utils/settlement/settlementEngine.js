/**
 * Optimal Settlement Engine
 * 
 * Main orchestrator for debt settlement that minimizes the number of transactions
 * needed to settle all debts within a group.
 * 
 * Features:
 * - Hybrid algorithm: exact solver for small groups (≤10), greedy for large groups (>10)
 * - Integer arithmetic to avoid floating-point precision issues
 * - Comprehensive input validation
 * - Performance optimized for groups up to 100+ people
 * 
 * @module settlementEngine
 */

import { exactBacktrackingSolver } from './exactSolver.js';
import { enhancedGreedySolver } from './greedySolver.js';
import {
  validateBalances,
  normalizeBalances,
  consolidateAndConvert
} from './settlementHelpers.js';

/** Threshold for switching from exact to greedy solver */
const EXACT_SOLVER_THRESHOLD = 10;

/** Timeout for exact solver in milliseconds */
const EXACT_SOLVER_TIMEOUT = 5000;

/**
 * Generates optimal settlements to balance all debts in a group
 * 
 * @param {Object<string, number>} balances - Object mapping user IDs to their balance
 *   - Positive balance = amount owed TO this person (creditor)
 *   - Negative balance = amount owed BY this person (debtor)
 *   - Must sum to approximately zero (within 0.01 tolerance)
 * 
 * @returns {Object} Settlement result
 * @returns {Array<{from: string, to: string, amount: number}>} result.settlements - Array of transactions
 * @returns {string} result.method - 'exact' or 'greedy'
 * @returns {number} result.executionTime - Time taken in milliseconds
 * 
 * @throws {Error} 'Need at least 2 people to settle' - If fewer than 2 non-zero balances
 * @throws {Error} 'Balances don\'t sum to zero (off by ₹X.XX)' - If balances don't balance
 * @throws {Error} 'Need at least one debtor and one creditor' - If all same sign
 * 
 * @example
 * // Simple 3-person settlement
 * const balances = {
 *   alice: 150,    // Alice is owed ₹150
 *   bob: -50,      // Bob owes ₹50
 *   charlie: -100  // Charlie owes ₹100
 * };
 * 
 * const result = generateOptimalSettlements(balances);
 * // {
 * //   settlements: [
 * //     { from: 'charlie', to: 'alice', amount: 100 },
 * //     { from: 'bob', to: 'alice', amount: 50 }
 * //   ],
 * //   method: 'exact',
 * //   executionTime: 2
 * // }
 * 
 * @example
 * // Handling paise precision
 * const balances = {
 *   alice: 33.33,
 *   bob: 33.34,
 *   charlie: -66.67
 * };
 * 
 * const result = generateOptimalSettlements(balances);
 * // Correctly handles 2 decimal place precision
 */
export function generateOptimalSettlements(balances) {
  const startTime = performance.now();
  
  // Step 1: Validate input
  const validation = validateBalances(balances);
  
  // Handle empty/all-zero balances
  if (validation.empty) {
    return {
      settlements: [],
      method: 'none',
      executionTime: Math.round(performance.now() - startTime)
    };
  }
  
  // Step 2: Normalize to integer paise and filter zeros
  const people = normalizeBalances(balances);
  
  // Double-check we have people to settle (shouldn't fail after validation)
  if (people.length < 2) {
    return {
      settlements: [],
      method: 'none',
      executionTime: Math.round(performance.now() - startTime)
    };
  }
  
  // Step 3: Choose solver based on group size
  let result;
  let method;
  
  if (people.length <= EXACT_SOLVER_THRESHOLD) {
    // Use exact solver for small groups (guaranteed optimal)
    const exactResult = exactBacktrackingSolver(people, {
      timeout: EXACT_SOLVER_TIMEOUT
    });
    
    result = exactResult.settlements;
    method = exactResult.timedOut ? 'greedy-fallback' : 'exact';
    
    // If exact solver timed out, fall back to greedy
    if (exactResult.timedOut) {
      const greedyResult = enhancedGreedySolver(people);
      result = greedyResult.settlements;
    }
  } else {
    // Use greedy solver for large groups (fast, near-optimal)
    const greedyResult = enhancedGreedySolver(people);
    result = greedyResult.settlements;
    method = 'greedy';
  }
  
  // Step 4: Consolidate and convert back to rupees
  const settlements = consolidateAndConvert(result);
  
  // Step 5: Return result
  return {
    settlements,
    method,
    executionTime: Math.round(performance.now() - startTime)
  };
}

/**
 * Validates balances without generating settlements
 * Useful for form validation before submission
 * 
 * @param {Object<string, number>} balances - User balances
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validateSettlementInput(balances) {
  try {
    validateBalances(balances);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Calculates settlement statistics for a given balance set
 * 
 * @param {Object<string, number>} balances - User balances
 * @returns {Object} Statistics about the settlement
 */
export function getSettlementStats(balances) {
  const people = normalizeBalances(balances);
  const nonZero = people.filter(p => p.balance !== 0);
  
  const debtors = nonZero.filter(p => p.balance < 0);
  const creditors = nonZero.filter(p => p.balance > 0);
  
  const totalDebt = debtors.reduce((sum, p) => sum + Math.abs(p.balance), 0) / 100;
  
  return {
    totalPeople: Object.keys(balances).length,
    activePeople: nonZero.length,
    debtorCount: debtors.length,
    creditorCount: creditors.length,
    totalDebt,
    minTransactions: Math.max(debtors.length, creditors.length),
    maxTransactions: Math.max(0, nonZero.length - 1),
    willUseExactSolver: nonZero.length <= EXACT_SOLVER_THRESHOLD
  };
}

/**
 * Formats a settlement for display
 * 
 * @param {{from: string, to: string, amount: number}} settlement - Settlement object
 * @param {Object<string, string>} [nameMap] - Optional map of IDs to display names
 * @returns {string} Formatted string like "Bob pays Alice ₹50.00"
 */
export function formatSettlement(settlement, nameMap = {}) {
  const from = nameMap[settlement.from] || settlement.from;
  const to = nameMap[settlement.to] || settlement.to;
  const amount = settlement.amount.toFixed(2);
  
  return `${from} pays ${to} ₹${amount}`;
}

/**
 * Groups settlements by payer for UI display
 * 
 * @param {Array<{from: string, to: string, amount: number}>} settlements - Settlements array
 * @returns {Map<string, Array<{to: string, amount: number}>>} Grouped by payer
 */
export function groupSettlementsByPayer(settlements) {
  const grouped = new Map();
  
  for (const { from, to, amount } of settlements) {
    if (!grouped.has(from)) {
      grouped.set(from, []);
    }
    grouped.get(from).push({ to, amount });
  }
  
  return grouped;
}

/**
 * Groups settlements by receiver for UI display
 * 
 * @param {Array<{from: string, to: string, amount: number}>} settlements - Settlements array
 * @returns {Map<string, Array<{from: string, amount: number}>>} Grouped by receiver
 */
export function groupSettlementsByReceiver(settlements) {
  const grouped = new Map();
  
  for (const { from, to, amount } of settlements) {
    if (!grouped.has(to)) {
      grouped.set(to, []);
    }
    grouped.get(to).push({ from, amount });
  }
  
  return grouped;
}

// Export configuration constants for testing
export const CONFIG = {
  EXACT_SOLVER_THRESHOLD,
  EXACT_SOLVER_TIMEOUT
};
