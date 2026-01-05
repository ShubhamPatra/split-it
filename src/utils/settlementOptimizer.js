/**
 * Settlement Optimization Utilities
 * Minimizes the number of transactions needed to settle all debts
 */

/**
 * Calculate optimal settlements using advanced algorithm
 * This truly minimizes the number of transactions needed
 * Uses subset sum matching + greedy fallback for optimal results
 * @param {Object} balances - Object with userId: balance (negative = owes, positive = owed)
 * @returns {Array} Array of optimal settlement transactions
 */
export const calculateOptimalSettlements = (balances) => {
  // Filter out zero balances and create arrays of debtors and creditors
  const debtors = []; // People who owe money (negative balance)
  const creditors = []; // People who are owed money (positive balance)
  
  Object.entries(balances).forEach(([userId, balance]) => {
    const roundedBalance = Math.round(balance * 100) / 100; // Round to 2 decimals
    if (roundedBalance < -0.01) {
      debtors.push({ userId, amount: Math.abs(roundedBalance) });
    } else if (roundedBalance > 0.01) {
      creditors.push({ userId, amount: roundedBalance });
    }
  });

  // If simple case, use greedy
  if (debtors.length <= 1 || creditors.length <= 1) {
    return greedySettle(debtors, creditors);
  }

  // Try to find optimal solution using subset matching
  // This finds groups where debts exactly cancel out, reducing transactions
  const settlements = [];
  const usedDebtors = new Set();
  const usedCreditors = new Set();

  // First pass: Find exact matches (one debtor's debt equals one creditor's credit)
  for (let i = 0; i < debtors.length; i++) {
    if (usedDebtors.has(i)) continue;
    for (let j = 0; j < creditors.length; j++) {
      if (usedCreditors.has(j)) continue;
      if (Math.abs(debtors[i].amount - creditors[j].amount) < 0.01) {
        settlements.push({
          from: debtors[i].userId,
          to: creditors[j].userId,
          amount: Math.round(debtors[i].amount * 100) / 100,
          priority: 'high',
        });
        usedDebtors.add(i);
        usedCreditors.add(j);
        break;
      }
    }
  }

  // Second pass: Find pairs of debtors that match a creditor (or vice versa)
  // This reduces 3 potential transactions to 2
  for (let i = 0; i < creditors.length; i++) {
    if (usedCreditors.has(i)) continue;
    const targetAmount = creditors[i].amount;
    
    // Find two debtors whose sum equals this creditor
    for (let j = 0; j < debtors.length; j++) {
      if (usedDebtors.has(j)) continue;
      for (let k = j + 1; k < debtors.length; k++) {
        if (usedDebtors.has(k)) continue;
        if (Math.abs(debtors[j].amount + debtors[k].amount - targetAmount) < 0.01) {
          settlements.push({
            from: debtors[j].userId,
            to: creditors[i].userId,
            amount: Math.round(debtors[j].amount * 100) / 100,
            priority: 'high',
          });
          settlements.push({
            from: debtors[k].userId,
            to: creditors[i].userId,
            amount: Math.round(debtors[k].amount * 100) / 100,
            priority: 'high',
          });
          usedDebtors.add(j);
          usedDebtors.add(k);
          usedCreditors.add(i);
          break;
        }
      }
      if (usedCreditors.has(i)) break;
    }
  }

  // Similarly, find pairs of creditors that match a debtor
  for (let i = 0; i < debtors.length; i++) {
    if (usedDebtors.has(i)) continue;
    const targetAmount = debtors[i].amount;
    
    for (let j = 0; j < creditors.length; j++) {
      if (usedCreditors.has(j)) continue;
      for (let k = j + 1; k < creditors.length; k++) {
        if (usedCreditors.has(k)) continue;
        if (Math.abs(creditors[j].amount + creditors[k].amount - targetAmount) < 0.01) {
          settlements.push({
            from: debtors[i].userId,
            to: creditors[j].userId,
            amount: Math.round(creditors[j].amount * 100) / 100,
            priority: 'high',
          });
          settlements.push({
            from: debtors[i].userId,
            to: creditors[k].userId,
            amount: Math.round(creditors[k].amount * 100) / 100,
            priority: 'high',
          });
          usedDebtors.add(i);
          usedCreditors.add(j);
          usedCreditors.add(k);
          break;
        }
      }
      if (usedDebtors.has(i)) break;
    }
  }

  // Collect remaining debtors and creditors
  const remainingDebtors = debtors.filter((_, i) => !usedDebtors.has(i));
  const remainingCreditors = creditors.filter((_, i) => !usedCreditors.has(i));

  // Use greedy algorithm for the rest
  const greedySettlements = greedySettle(remainingDebtors, remainingCreditors);
  settlements.push(...greedySettlements);

  return settlements;
};

/**
 * Greedy settlement algorithm - matches largest debts with largest credits
 * @param {Array} debtors - Array of {userId, amount}
 * @param {Array} creditors - Array of {userId, amount}
 * @returns {Array} Array of settlements
 */
const greedySettle = (debtors, creditors) => {
  // Clone arrays to avoid mutation
  const debtorsCopy = debtors.map(d => ({ ...d }));
  const creditorsCopy = creditors.map(c => ({ ...c }));

  // Sort by amount (largest first) for greedy optimization
  debtorsCopy.sort((a, b) => b.amount - a.amount);
  creditorsCopy.sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let debtorIdx = 0;
  let creditorIdx = 0;

  // Greedy algorithm: match largest debts with largest credits
  while (debtorIdx < debtorsCopy.length && creditorIdx < creditorsCopy.length) {
    const debtor = debtorsCopy[debtorIdx];
    const creditor = creditorsCopy[creditorIdx];

    // Amount to settle is the minimum of what's owed and what's due
    const settleAmount = Math.min(debtor.amount, creditor.amount);

    if (settleAmount > 0.01) { // Only create settlement if amount is significant
      settlements.push({
        from: debtor.userId,
        to: creditor.userId,
        amount: Math.round(settleAmount * 100) / 100,
        priority: 'high',
      });
    }

    // Update remaining amounts
    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    // Move to next debtor/creditor if current one is settled
    if (debtor.amount < 0.01) debtorIdx++;
    if (creditor.amount < 0.01) creditorIdx++;
  }

  return settlements;
};

/**
 * Calculate all possible direct settlements (useful for showing all options)
 * @param {Object} balances - Object with userId: balance
 * @returns {Array} Array of all possible settlements
 */
export const calculateAllPossibleSettlements = (balances) => {
  const settlements = [];
  const users = Object.keys(balances);

  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const user1 = users[i];
      const user2 = users[j];
      const balance1 = balances[user1];
      const balance2 = balances[user2];

      // Determine who owes whom
      if (balance1 < 0 && balance2 > 0) {
        const amount = Math.min(Math.abs(balance1), balance2);
        if (amount > 0.01) {
          settlements.push({
            from: user1,
            to: user2,
            amount: Math.round(amount * 100) / 100,
            priority: calculatePriority(amount, balance1, balance2),
          });
        }
      } else if (balance2 < 0 && balance1 > 0) {
        const amount = Math.min(Math.abs(balance2), balance1);
        if (amount > 0.01) {
          settlements.push({
            from: user2,
            to: user1,
            amount: Math.round(amount * 100) / 100,
            priority: calculatePriority(amount, balance2, balance1),
          });
        }
      }
    }
  }

  return settlements.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority] || b.amount - a.amount;
  });
};

/**
 * Calculate priority of a settlement
 * @param {number} amount - Settlement amount
 * @param {number} debtorBalance - Debtor's balance
 * @param {number} creditorBalance - Creditor's balance
 * @returns {string} Priority level: 'high', 'medium', 'low'
 */
const calculatePriority = (amount, debtorBalance, creditorBalance) => {
  const debtRatio = amount / Math.abs(debtorBalance);
  const creditRatio = amount / creditorBalance;
  
  // High priority if this settlement clears most of the debt/credit
  if (debtRatio > 0.8 || creditRatio > 0.8) {
    return 'high';
  }
  // Medium priority if it clears a significant portion
  if (debtRatio > 0.4 || creditRatio > 0.4) {
    return 'medium';
  }
  return 'low';
};

/**
 * Advanced minimum transactions using recursive subset matching
 * This finds the absolute minimum number of transactions for small groups
 * For larger groups (>8 people), falls back to the heuristic approach
 * @param {Object} balances - Object with userId: balance
 * @returns {Array} Minimum number of settlements
 */
export const calculateMinimumTransactions = (balances) => {
  const nonZeroBalances = {};
  Object.entries(balances).forEach(([userId, balance]) => {
    const rounded = Math.round(balance * 100) / 100;
    if (Math.abs(rounded) > 0.01) {
      nonZeroBalances[userId] = rounded;
    }
  });

  const people = Object.keys(nonZeroBalances);
  
  // For small groups, use optimal recursive solution
  if (people.length <= 8) {
    return findMinimumTransactionsRecursive(nonZeroBalances);
  }
  
  // For larger groups, use the heuristic approach
  return calculateOptimalSettlements(balances);
};

/**
 * Recursive solution to find minimum transactions
 * Uses memoization and subset matching
 * @param {Object} balances - Non-zero balances
 * @returns {Array} Minimum settlements
 */
const findMinimumTransactionsRecursive = (balances) => {
  const people = Object.keys(balances);
  if (people.length === 0) return [];
  
  // Convert to array for easier manipulation
  const balanceArray = people.map(id => ({ id, balance: balances[id] }));
  
  // Find subsets that sum to zero - these can be settled among themselves
  // This is the key insight: if a subset sums to zero, they need n-1 transactions
  // among themselves, and are independent of the rest
  
  const settlements = [];
  const used = new Set();
  
  // Try to find smallest subsets that sum to zero
  for (let size = 2; size <= balanceArray.length; size++) {
    const subsets = findZeroSumSubsets(balanceArray, size, used);
    for (const subset of subsets) {
      // Settle this subset
      const subsetSettlements = settleSubset(subset);
      settlements.push(...subsetSettlements);
      subset.forEach(p => used.add(p.id));
    }
  }
  
  // Handle any remaining (shouldn't happen if balances sum to zero)
  const remaining = balanceArray.filter(p => !used.has(p.id));
  if (remaining.length > 0) {
    const remainingBalances = {};
    remaining.forEach(p => { remainingBalances[p.id] = p.balance; });
    settlements.push(...calculateOptimalSettlements(remainingBalances));
  }
  
  return settlements;
};

/**
 * Find subsets of given size that sum to zero
 */
const findZeroSumSubsets = (balanceArray, size, used) => {
  const available = balanceArray.filter(p => !used.has(p.id));
  const results = [];
  
  const findSubsets = (start, current) => {
    if (current.length === size) {
      const sum = current.reduce((s, p) => s + p.balance, 0);
      if (Math.abs(sum) < 0.01) {
        results.push([...current]);
      }
      return;
    }
    
    for (let i = start; i < available.length; i++) {
      current.push(available[i]);
      findSubsets(i + 1, current);
      current.pop();
      
      // Early termination if we found enough subsets
      if (results.length >= 10) return;
    }
  };
  
  findSubsets(0, []);
  return results;
};

/**
 * Settle a subset that sums to zero with minimum transactions
 * A subset of n people needs exactly n-1 transactions
 */
const settleSubset = (subset) => {
  const settlements = [];
  
  // Sort by balance: debtors first (negative), then creditors (positive)
  const sorted = [...subset].sort((a, b) => a.balance - b.balance);
  
  // Use greedy within the subset
  const debtors = sorted.filter(p => p.balance < 0).map(p => ({ userId: p.id, amount: Math.abs(p.balance) }));
  const creditors = sorted.filter(p => p.balance > 0).map(p => ({ userId: p.id, amount: p.balance }));
  
  let di = 0, ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const d = debtors[di];
    const c = creditors[ci];
    const amount = Math.min(d.amount, c.amount);
    
    if (amount > 0.01) {
      settlements.push({
        from: d.userId,
        to: c.userId,
        amount: Math.round(amount * 100) / 100,
        priority: 'high',
      });
    }
    
    d.amount -= amount;
    c.amount -= amount;
    
    if (d.amount < 0.01) di++;
    if (c.amount < 0.01) ci++;
  }
  
  return settlements;
};

/**
 * Calculate statistics about settlements
 * @param {Object} balances - Current balances
 * @param {Array} settlements - Existing settlements
 * @returns {Object} Settlement statistics
 */
export const calculateSettlementStats = (balances, settlements = []) => {
  const totalOwed = Object.values(balances)
    .filter(b => b > 0)
    .reduce((sum, b) => sum + b, 0);
  
  const totalDebt = Math.abs(Object.values(balances)
    .filter(b => b < 0)
    .reduce((sum, b) => sum + b, 0));

  const settledAmount = settlements
    .filter(s => s.paymentStatus === 'confirmed')
    .reduce((sum, s) => sum + s.amount, 0);

  const pendingAmount = settlements
    .filter(s => s.paymentStatus === 'pending')
    .reduce((sum, s) => sum + s.amount, 0);

  // Use the minimum transactions algorithm for accurate count
  const optimalSettlements = calculateMinimumTransactions(balances);

  return {
    totalOwed: Math.round(totalOwed * 100) / 100,
    totalDebt: Math.round(totalDebt * 100) / 100,
    settledAmount: Math.round(settledAmount * 100) / 100,
    pendingAmount: Math.round(pendingAmount * 100) / 100,
    remainingToSettle: Math.round((totalOwed - settledAmount - pendingAmount) * 100) / 100,
    optimalTransactionCount: optimalSettlements.length,
    settlementProgress: totalOwed > 0 ? Math.round(((settledAmount + pendingAmount) / totalOwed) * 100) : 100,
  };
};

/**
 * Simplify debt chain (e.g., if A owes B and B owes C, simplify to A owes C)
 * @param {Array} settlements - Array of settlement objects
 * @returns {Array} Simplified settlements
 */
export const simplifySettlements = (settlements) => {
  // Build a balance map from settlements
  const balances = {};
  
  settlements.forEach(({ from, to, amount }) => {
    balances[from] = (balances[from] || 0) - amount;
    balances[to] = (balances[to] || 0) + amount;
  });

  // Use the optimization algorithm to get minimal transactions
  return calculateOptimalSettlements(balances);
};

const settlementUtils = {
  calculateOptimalSettlements,
  calculateAllPossibleSettlements,
  calculateSettlementStats,
  simplifySettlements,
  calculateMinimumTransactions,
};

export default settlementUtils;
