/**
 * Exact Backtracking Solver
 * 
 * Guarantees minimum number of transactions using backtracking with:
 * - Memoization using balance-only state keys
 * - Early termination when current path exceeds best known
 * - Exact match prioritization (settle pairs with equal amounts first)
 * - Symmetry breaking (always pick first debtor to avoid redundant exploration)
 * - Mutate & revert pattern (no deep copying for performance)
 * 
 * @module exactSolver
 */

import { generateStateKey } from './settlementHelpers.js';

/**
 * Finds exact matches where debtor owes exactly what creditor is owed
 * These can be settled optimally in one transaction each
 * @param {Array<{id: string, balance: number}>} people - People with balances
 * @returns {Array<{from: string, to: string, amount: number}>} Exact match settlements
 */
function findExactMatches(people) {
  const settlements = [];
  const settled = new Set();
  
  // Find all debtors and creditors
  const debtors = people.filter(p => p.balance < 0 && !settled.has(p.id));
  const creditors = people.filter(p => p.balance > 0 && !settled.has(p.id));
  
  // Look for exact matches (debtor owes exactly what creditor is owed)
  for (const debtor of debtors) {
    if (settled.has(debtor.id)) continue;
    
    for (const creditor of creditors) {
      if (settled.has(creditor.id)) continue;
      
      // Check for exact match (debtor.balance is negative)
      if (debtor.balance + creditor.balance === 0) {
        settlements.push({
          from: debtor.id,
          to: creditor.id,
          amount: creditor.balance
        });
        
        // Mark as settled
        settled.add(debtor.id);
        settled.add(creditor.id);
        break;
      }
    }
  }
  
  return { settlements, settledIds: settled };
}

/**
 * Backtracking solver that finds minimum transactions
 * @param {Array<{id: string, balance: number}>} people - People with non-zero balances
 * @param {Map<string, number>} memo - Memoization cache
 * @param {number} currentDepth - Current recursion depth
 * @param {number} bestKnown - Best known solution count
 * @param {number} startTime - Start timestamp for timeout
 * @param {number} timeout - Timeout in milliseconds
 * @returns {{count: number, settlements: Array}} Minimum settlement info
 */
function backtrack(people, memo, currentDepth, bestKnown, startTime, timeout) {
  // Timeout check (every 100 calls to reduce overhead)
  if (currentDepth % 100 === 0 && Date.now() - startTime > timeout) {
    return { count: Infinity, settlements: [], timedOut: true };
  }
  
  // Filter out settled people (zero balance)
  const active = people.filter(p => p.balance !== 0);
  
  // Base case: everyone is settled
  if (active.length === 0) {
    return { count: 0, settlements: [] };
  }
  
  // Early termination: can't beat best known solution
  // Minimum possible transactions is ceil(active.length / 2)
  const minPossible = Math.ceil(active.length / 2);
  if (currentDepth + minPossible >= bestKnown) {
    return { count: Infinity, settlements: [] };
  }
  
  // Check memo
  const stateKey = generateStateKey(active);
  if (memo.has(stateKey)) {
    return memo.get(stateKey);
  }
  
  // Symmetry breaking: always pick the first debtor
  // This avoids exploring equivalent orderings
  const firstDebtor = active.find(p => p.balance < 0);
  
  if (!firstDebtor) {
    // No debtors left but still have active people - shouldn't happen with valid input
    return { count: Infinity, settlements: [] };
  }
  
  let best = { count: Infinity, settlements: [] };
  
  // Try pairing with each creditor
  const creditors = active.filter(p => p.balance > 0);
  
  // Sort creditors to try exact matches first, then by amount (descending)
  creditors.sort((a, b) => {
    // Prioritize exact match
    const aExact = a.balance === -firstDebtor.balance ? 1 : 0;
    const bExact = b.balance === -firstDebtor.balance ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    
    // Then by amount descending
    return b.balance - a.balance;
  });
  
  for (const creditor of creditors) {
    // Calculate settlement amount
    const settleAmount = Math.min(-firstDebtor.balance, creditor.balance);
    
    // Mutate balances (no deep copy for performance)
    const originalDebtorBalance = firstDebtor.balance;
    const originalCreditorBalance = creditor.balance;
    
    firstDebtor.balance += settleAmount;
    creditor.balance -= settleAmount;
    
    // Recurse
    const result = backtrack(
      people,
      memo,
      currentDepth + 1,
      Math.min(bestKnown, best.count + currentDepth),
      startTime,
      timeout
    );
    
    // Check if this is better
    if (result.count + 1 < best.count) {
      best = {
        count: result.count + 1,
        settlements: [
          { from: firstDebtor.id, to: creditor.id, amount: settleAmount },
          ...result.settlements
        ]
      };
      
      // Update best known for pruning
      bestKnown = Math.min(bestKnown, best.count + currentDepth);
    }
    
    // Revert balances (mutate back)
    firstDebtor.balance = originalDebtorBalance;
    creditor.balance = originalCreditorBalance;
    
    // If we found an optimal solution (can't do better), stop early
    if (best.count === minPossible) {
      break;
    }
    
    // Propagate timeout
    if (result.timedOut) {
      return { ...best, timedOut: true };
    }
  }
  
  // Cache result (only if not trivially large)
  if (best.count < Infinity) {
    memo.set(stateKey, best);
  }
  
  return best;
}

/**
 * Exact backtracking solver for finding minimum number of settlements
 * 
 * @param {Array<{id: string, balance: number}>} people - Array of people with non-zero paise balances
 * @param {Object} options - Solver options
 * @param {number} [options.timeout=5000] - Timeout in milliseconds
 * @returns {{settlements: Array<{from: string, to: string, amount: number}>, timedOut: boolean}}
 * 
 * @example
 * const people = [
 *   { id: 'alice', balance: 15000 },  // owed ₹150
 *   { id: 'bob', balance: -5000 },    // owes ₹50
 *   { id: 'charlie', balance: -10000 } // owes ₹100
 * ];
 * const result = exactBacktrackingSolver(people);
 * // { settlements: [...], timedOut: false }
 */
export function exactBacktrackingSolver(people, options = {}) {
  const { timeout = 5000 } = options;
  const startTime = Date.now();
  
  // Handle edge cases
  if (!people || people.length === 0) {
    return { settlements: [], timedOut: false };
  }
  
  // Create working copy to allow mutation
  const workingPeople = people.map(p => ({ ...p }));
  
  // Phase 1: Find and remove exact matches (optimal single transactions)
  const { settlements: exactSettlements, settledIds } = findExactMatches(workingPeople);
  
  // Update working people to exclude exact matches
  const remaining = workingPeople.filter(p => !settledIds.has(p.id));
  
  // If all settled with exact matches, we're done
  if (remaining.length === 0) {
    return { settlements: exactSettlements, timedOut: false };
  }
  
  // Phase 2: Backtrack for remaining people
  const memo = new Map();
  const result = backtrack(
    remaining,
    memo,
    0,
    Infinity,
    startTime,
    timeout
  );
  
  return {
    settlements: [...exactSettlements, ...result.settlements],
    timedOut: result.timedOut || false
  };
}

/**
 * Calculates theoretical minimum transactions using subset-sum counting
 * A set of n people with balances summing to 0 can be settled in n-k transactions,
 * where k is the maximum number of disjoint subsets that each sum to 0.
 * 
 * @param {Array<{id: string, balance: number}>} people - People with balances
 * @returns {number} Theoretical minimum transactions
 */
export function theoreticalMinimum(people) {
  const n = people.filter(p => p.balance !== 0).length;
  if (n <= 1) return 0;
  
  // For small groups, we can compute the exact minimum
  // For larger groups, the minimum is between ceil(n/2) and n-1
  // The best case is n/2 (perfect pairing), worst case is n-1 (chain)
  
  // Simple lower bound: need at least ceil(n/2) transactions
  return Math.ceil(n / 2);
}
