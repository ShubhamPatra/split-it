/**
 * Greedy Solver
 * 
 * Fast, near-optimal settlement algorithm for large groups.
 * Matches largest debtor with largest creditor iteratively.
 * 
 * Time Complexity: O(n log n) due to sorting
 * Space Complexity: O(n)
 * 
 * @module greedySolver
 */

/**
 * Greedy solver that matches largest amounts first
 * 
 * Algorithm:
 * 1. Separate people into debtors (negative balance) and creditors (positive balance)
 * 2. Sort both lists by absolute amount (largest first)
 * 3. Match largest debtor with largest creditor
 * 4. Settle the minimum of their amounts
 * 5. Update balances and resort (or use heap for O(log n) updates)
 * 6. Repeat until all settled
 * 
 * @param {Array<{id: string, balance: number}>} people - Array of people with non-zero paise balances
 * @returns {{settlements: Array<{from: string, to: string, amount: number}>}}
 * 
 * @example
 * const people = [
 *   { id: 'alice', balance: 15000 },
 *   { id: 'bob', balance: -5000 },
 *   { id: 'charlie', balance: -10000 }
 * ];
 * const result = greedySolver(people);
 * // { settlements: [...] }
 */
export function greedySolver(people) {
  // Handle edge cases
  if (!people || people.length === 0) {
    return { settlements: [] };
  }
  
  const settlements = [];
  
  // Separate into debtors and creditors with mutable copies
  // Debtors have negative balance (they owe money)
  // Creditors have positive balance (they are owed money)
  const debtors = people
    .filter(p => p.balance < 0)
    .map(p => ({ id: p.id, amount: -p.balance })) // Store as positive for easier comparison
    .sort((a, b) => b.amount - a.amount); // Largest first
  
  const creditors = people
    .filter(p => p.balance > 0)
    .map(p => ({ id: p.id, amount: p.balance }))
    .sort((a, b) => b.amount - a.amount); // Largest first
  
  // Use two-pointer approach with re-sorting after each settlement
  // For better performance with large groups, could use a heap instead
  let debtorIdx = 0;
  let creditorIdx = 0;
  
  while (debtorIdx < debtors.length && creditorIdx < creditors.length) {
    const debtor = debtors[debtorIdx];
    const creditor = creditors[creditorIdx];
    
    // Skip if either is fully settled
    if (debtor.amount === 0) {
      debtorIdx++;
      continue;
    }
    if (creditor.amount === 0) {
      creditorIdx++;
      continue;
    }
    
    // Settlement amount is the minimum of what's owed and what's due
    const settleAmount = Math.min(debtor.amount, creditor.amount);
    
    // Record the settlement
    settlements.push({
      from: debtor.id,
      to: creditor.id,
      amount: settleAmount
    });
    
    // Update amounts
    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;
    
    // Move pointers if fully settled
    if (debtor.amount === 0) {
      debtorIdx++;
    }
    if (creditor.amount === 0) {
      creditorIdx++;
    }
  }
  
  return { settlements };
}

/**
 * Enhanced greedy solver with exact match prioritization
 * 
 * First looks for exact matches (debtor owes exactly what creditor is owed),
 * then falls back to standard greedy matching.
 * 
 * @param {Array<{id: string, balance: number}>} people - Array of people with non-zero paise balances
 * @returns {{settlements: Array<{from: string, to: string, amount: number}>}}
 */
export function enhancedGreedySolver(people) {
  if (!people || people.length === 0) {
    return { settlements: [] };
  }
  
  const settlements = [];
  
  // Create mutable copies
  const debtors = people
    .filter(p => p.balance < 0)
    .map(p => ({ id: p.id, amount: -p.balance, settled: false }));
  
  const creditors = people
    .filter(p => p.balance > 0)
    .map(p => ({ id: p.id, amount: p.balance, settled: false }));
  
  // Phase 1: Find exact matches
  // This can reduce the number of transactions in cases like:
  // A: +100, B: -100, C: +50, D: -50 → 2 transactions instead of potentially 3
  const amountToCreditors = new Map();
  
  for (const creditor of creditors) {
    if (!amountToCreditors.has(creditor.amount)) {
      amountToCreditors.set(creditor.amount, []);
    }
    amountToCreditors.get(creditor.amount).push(creditor);
  }
  
  for (const debtor of debtors) {
    const matchingCreditors = amountToCreditors.get(debtor.amount);
    
    if (matchingCreditors) {
      // Find an unsettled matching creditor
      const matchingCreditor = matchingCreditors.find(c => !c.settled);
      
      if (matchingCreditor) {
        settlements.push({
          from: debtor.id,
          to: matchingCreditor.id,
          amount: debtor.amount
        });
        
        debtor.settled = true;
        debtor.amount = 0;
        matchingCreditor.settled = true;
        matchingCreditor.amount = 0;
      }
    }
  }
  
  // Phase 2: Standard greedy for remaining
  const remainingDebtors = debtors
    .filter(d => !d.settled)
    .sort((a, b) => b.amount - a.amount);
  
  const remainingCreditors = creditors
    .filter(c => !c.settled)
    .sort((a, b) => b.amount - a.amount);
  
  let debtorIdx = 0;
  let creditorIdx = 0;
  
  while (debtorIdx < remainingDebtors.length && creditorIdx < remainingCreditors.length) {
    const debtor = remainingDebtors[debtorIdx];
    const creditor = remainingCreditors[creditorIdx];
    
    if (debtor.amount === 0) {
      debtorIdx++;
      continue;
    }
    if (creditor.amount === 0) {
      creditorIdx++;
      continue;
    }
    
    const settleAmount = Math.min(debtor.amount, creditor.amount);
    
    settlements.push({
      from: debtor.id,
      to: creditor.id,
      amount: settleAmount
    });
    
    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;
    
    if (debtor.amount === 0) debtorIdx++;
    if (creditor.amount === 0) creditorIdx++;
  }
  
  return { settlements };
}

/**
 * Calculates the maximum possible transactions for comparison
 * @param {number} numPeople - Number of people with non-zero balances
 * @returns {number} Maximum transactions (n-1 in worst case)
 */
export function maxTransactions(numPeople) {
  return Math.max(0, numPeople - 1);
}
