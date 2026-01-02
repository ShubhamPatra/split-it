/**
 * Settlement Optimization Utilities
 * Minimizes the number of transactions needed to settle all debts
 */

/**
 * Calculate optimal settlements using greedy algorithm
 * This minimizes the number of transactions needed
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

  // Sort by amount (largest first) for greedy optimization
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let debtorIdx = 0;
  let creditorIdx = 0;

  // Greedy algorithm: match largest debts with largest credits
  while (debtorIdx < debtors.length && creditorIdx < creditors.length) {
    const debtor = debtors[debtorIdx];
    const creditor = creditors[creditorIdx];

    // Amount to settle is the minimum of what's owed and what's due
    const settleAmount = Math.min(debtor.amount, creditor.amount);

    if (settleAmount > 0.01) { // Only create settlement if amount is significant
      settlements.push({
        from: debtor.userId,
        to: creditor.userId,
        amount: Math.round(settleAmount * 100) / 100,
        priority: 'high', // All optimized settlements are high priority
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

  const optimalSettlements = calculateOptimalSettlements(balances);

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
};

export default settlementUtils;
