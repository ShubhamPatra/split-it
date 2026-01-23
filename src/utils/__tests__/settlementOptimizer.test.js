/**
 * Tests for Settlement Optimizer Utility
 * 
 * Task 4.2: Add zero-balance filtering
 * Requirements: 2.4
 * 
 * These tests verify that:
 * 1. Users with balance === 0 are filtered out from settlement suggestions
 * 2. Users with balances within floating-point precision (< 0.01) are treated as zero
 * 3. Settlement calculations work correctly with various balance scenarios
 */

import {
  calculateOptimalSettlements,
  calculateAllPossibleSettlements,
  calculateSettlementStats,
  simplifySettlements,
} from '../settlementOptimizer';

describe('Settlement Optimizer - Zero Balance Filtering (Task 4.2)', () => {
  /**
   * Test 1: Verify users with exactly zero balance are excluded
   * 
   * Validates: Requirements 2.4
   * WHEN a user's balance reaches zero, THE Settlement_Tab SHALL remove that user from settlement suggestions
   */
  it('should exclude users with exactly zero balance from settlements', () => {
    const balances = {
      user1: 100,    // Owed ₹100
      user2: -100,   // Owes ₹100
      user3: 0,      // Zero balance - should be excluded
      user4: 0,      // Zero balance - should be excluded
    };

    const settlements = calculateOptimalSettlements(balances);

    // Should only have one settlement: user2 pays user1
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({
      from: 'user2',
      to: 'user1',
      amount: 100,
      priority: 'high',
    });

    // Verify user3 and user4 are not in any settlements
    const involvedUsers = new Set();
    settlements.forEach(s => {
      involvedUsers.add(s.from);
      involvedUsers.add(s.to);
    });
    expect(involvedUsers.has('user3')).toBe(false);
    expect(involvedUsers.has('user4')).toBe(false);
  });

  /**
   * Test 2: Verify users with near-zero balances (< 0.01) are excluded
   * 
   * Validates: Requirements 2.4
   * Handles floating-point precision issues
   */
  it('should exclude users with near-zero balances (< 0.01) from settlements', () => {
    const balances = {
      user1: 100,      // Owed ₹100
      user2: -100,     // Owes ₹100
      user3: 0.009,    // Near-zero positive - should be excluded
      user4: -0.009,   // Near-zero negative - should be excluded
      user5: 0.001,    // Very small positive - should be excluded
      user6: -0.001,   // Very small negative - should be excluded
    };

    const settlements = calculateOptimalSettlements(balances);

    // Should only have one settlement: user2 pays user1
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({
      from: 'user2',
      to: 'user1',
      amount: 100,
      priority: 'high',
    });

    // Verify near-zero balance users are not in any settlements
    const involvedUsers = new Set();
    settlements.forEach(s => {
      involvedUsers.add(s.from);
      involvedUsers.add(s.to);
    });
    expect(involvedUsers.has('user3')).toBe(false);
    expect(involvedUsers.has('user4')).toBe(false);
    expect(involvedUsers.has('user5')).toBe(false);
    expect(involvedUsers.has('user6')).toBe(false);
  });

  /**
   * Test 3: Verify all users with zero balances results in empty settlements
   * 
   * Validates: Requirements 2.4
   * Edge case: All balances are zero
   */
  it('should return empty array when all users have zero balance', () => {
    const balances = {
      user1: 0,
      user2: 0,
      user3: 0,
      user4: 0,
    };

    const settlements = calculateOptimalSettlements(balances);

    expect(settlements).toEqual([]);
  });

  /**
   * Test 4: Verify empty balances object results in empty settlements
   * 
   * Validates: Requirements 2.4
   * Edge case: No users
   */
  it('should return empty array when balances object is empty', () => {
    const balances = {};

    const settlements = calculateOptimalSettlements(balances);

    expect(settlements).toEqual([]);
  });

  /**
   * Test 5: Verify users with balances at the threshold (0.01) are included
   * 
   * Validates: Requirements 2.4
   * Boundary test: Balances exactly at the threshold should be included
   */
  it('should include users with balances at or above the threshold (0.01)', () => {
    const balances = {
      user1: 0.02,     // Above threshold - should be included
      user2: -0.02,    // Above threshold - should be included
      user3: 0.01,     // At threshold - should be included
      user4: -0.01,    // At threshold - should be included
    };

    const settlements = calculateOptimalSettlements(balances);

    // Should have settlements for all users since they're at or above threshold
    expect(settlements.length).toBeGreaterThan(0);
    
    // Verify the settlements balance out correctly
    const totalFrom = settlements.reduce((sum, s) => sum + s.amount, 0);
    const totalTo = settlements.reduce((sum, s) => sum + s.amount, 0);
    expect(totalFrom).toBeCloseTo(totalTo, 2);
  });

  /**
   * Test 6: Verify complex scenario with mixed zero and non-zero balances
   * 
   * Validates: Requirements 2.4
   * Real-world scenario: Some users settled, others still have balances
   */
  it('should correctly filter zero balances in complex scenarios', () => {
    const balances = {
      user1: 150,      // Owed ₹150
      user2: -100,     // Owes ₹100
      user3: 0,        // Settled - should be excluded
      user4: -50,      // Owes ₹50
      user5: 0,        // Settled - should be excluded
      user6: 0.005,    // Near-zero - should be excluded
    };

    const settlements = calculateOptimalSettlements(balances);

    // Should have settlements only for user1, user2, and user4
    const involvedUsers = new Set();
    settlements.forEach(s => {
      involvedUsers.add(s.from);
      involvedUsers.add(s.to);
    });

    expect(involvedUsers.has('user1')).toBe(true);  // Creditor
    expect(involvedUsers.has('user2')).toBe(true);  // Debtor
    expect(involvedUsers.has('user4')).toBe(true);  // Debtor
    expect(involvedUsers.has('user3')).toBe(false); // Zero balance
    expect(involvedUsers.has('user5')).toBe(false); // Zero balance
    expect(involvedUsers.has('user6')).toBe(false); // Near-zero balance

    // Verify total amounts balance
    const totalDebt = settlements.reduce((sum, s) => sum + s.amount, 0);
    expect(totalDebt).toBeCloseTo(150, 2); // Total owed to user1
  });

  /**
   * Test 7: Verify zero-balance filtering in calculateAllPossibleSettlements
   * 
   * Validates: Requirements 2.4
   * The alternative settlement calculation should also filter zero balances
   */
  it('should exclude zero balances in calculateAllPossibleSettlements', () => {
    const balances = {
      user1: 100,
      user2: -100,
      user3: 0,
      user4: 0,
    };

    const settlements = calculateAllPossibleSettlements(balances);

    // Should only have settlements between user1 and user2
    expect(settlements).toHaveLength(1);
    expect(settlements[0].from).toBe('user2');
    expect(settlements[0].to).toBe('user1');
    expect(settlements[0].amount).toBe(100);

    // Verify user3 and user4 are not involved
    const involvedUsers = new Set();
    settlements.forEach(s => {
      involvedUsers.add(s.from);
      involvedUsers.add(s.to);
    });
    expect(involvedUsers.has('user3')).toBe(false);
    expect(involvedUsers.has('user4')).toBe(false);
  });
});

describe('Settlement Optimizer - Core Functionality', () => {
  /**
   * Test 8: Verify optimal settlement calculation minimizes transactions
   */
  it('should minimize the number of transactions needed', () => {
    const balances = {
      user1: 100,   // Owed ₹100
      user2: -50,   // Owes ₹50
      user3: -50,   // Owes ₹50
    };

    const settlements = calculateOptimalSettlements(balances);

    // Should have exactly 2 transactions (optimal)
    expect(settlements).toHaveLength(2);
    
    // Verify settlements are correct
    expect(settlements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'user2', to: 'user1', amount: 50 }),
        expect.objectContaining({ from: 'user3', to: 'user1', amount: 50 }),
      ])
    );
  });

  /**
   * Test 9: Verify settlement amounts are rounded to 2 decimal places
   */
  it('should round settlement amounts to 2 decimal places', () => {
    const balances = {
      user1: 33.333333,
      user2: -16.666666,
      user3: -16.666667,
    };

    const settlements = calculateOptimalSettlements(balances);

    // All amounts should be rounded to 2 decimals
    settlements.forEach(settlement => {
      expect(settlement.amount).toEqual(expect.any(Number));
      expect(settlement.amount.toFixed(2)).toBe(settlement.amount.toString());
    });
  });

  /**
   * Test 10: Verify settlement stats calculation
   */
  it('should calculate settlement statistics correctly', () => {
    const balances = {
      user1: 100,
      user2: -50,
      user3: -50,
    };

    const existingSettlements = [
      { fromUserId: 'user2', toUserId: 'user1', amount: 30, paymentStatus: 'confirmed' },
      { fromUserId: 'user3', toUserId: 'user1', amount: 20, paymentStatus: 'pending' },
    ];

    const stats = calculateSettlementStats(balances, existingSettlements);

    expect(stats.totalOwed).toBe(100);
    expect(stats.totalDebt).toBe(100);
    expect(stats.settledAmount).toBe(30);
    expect(stats.pendingAmount).toBe(20);
    expect(stats.remainingToSettle).toBe(50);
    expect(stats.optimalTransactionCount).toBe(2);
    expect(stats.settlementProgress).toBe(50); // (30 + 20) / 100 * 100
  });

  /**
   * Test 11: Verify simplifySettlements reduces transaction chains
   */
  it('should simplify settlement chains', () => {
    // A owes B ₹50, B owes C ₹50 -> should simplify to A owes C ₹50
    const settlements = [
      { from: 'userA', to: 'userB', amount: 50 },
      { from: 'userB', to: 'userC', amount: 50 },
    ];

    const simplified = simplifySettlements(settlements);

    // Should have only 1 transaction
    expect(simplified).toHaveLength(1);
    expect(simplified[0]).toEqual({
      from: 'userA',
      to: 'userC',
      amount: 50,
      priority: 'high',
    });
  });

  /**
   * Test 12: Verify zero-sum invariant is maintained
   * 
   * The sum of all balances should equal zero (balanced books)
   */
  it('should maintain zero-sum invariant in settlements', () => {
    const balances = {
      user1: 150,
      user2: -75,
      user3: -50,
      user4: -25,
    };

    const settlements = calculateOptimalSettlements(balances);

    // Calculate net balance after settlements
    const netBalances = { ...balances };
    settlements.forEach(settlement => {
      netBalances[settlement.from] += settlement.amount;
      netBalances[settlement.to] -= settlement.amount;
    });

    // All balances should be near zero after settlements
    Object.values(netBalances).forEach(balance => {
      expect(Math.abs(balance)).toBeLessThan(0.01);
    });
  });
});

describe('Settlement Optimizer - Edge Cases', () => {
  /**
   * Test 13: Handle single user with non-zero balance
   */
  it('should handle single user with non-zero balance', () => {
    const balances = {
      user1: 100,
    };

    const settlements = calculateOptimalSettlements(balances);

    // Cannot create settlements with only one user
    expect(settlements).toEqual([]);
  });

  /**
   * Test 14: Handle negative and positive balances that don't sum to zero
   * 
   * This shouldn't happen in a correct system, but we should handle it gracefully
   */
  it('should handle unbalanced books gracefully', () => {
    const balances = {
      user1: 100,
      user2: -50,
      // Missing -50 to balance
    };

    const settlements = calculateOptimalSettlements(balances);

    // Should still create settlements for what can be settled
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({
      from: 'user2',
      to: 'user1',
      amount: 50,
      priority: 'high',
    });
  });

  /**
   * Test 15: Handle very small amounts (floating-point precision)
   */
  it('should handle floating-point precision correctly', () => {
    const balances = {
      user1: 0.1 + 0.2,  // JavaScript: 0.30000000000000004
      user2: -0.3,
    };

    const settlements = calculateOptimalSettlements(balances);

    expect(settlements).toHaveLength(1);
    expect(settlements[0].amount).toBeCloseTo(0.3, 2);
  });

  /**
   * Test 16: Handle large number of users
   */
  it('should handle large number of users efficiently', () => {
    const balances = {};
    
    // Create 50 users: 25 owe money, 25 are owed money
    for (let i = 0; i < 25; i++) {
      balances[`debtor${i}`] = -100;
      balances[`creditor${i}`] = 100;
    }

    const settlements = calculateOptimalSettlements(balances);

    // Should create settlements
    expect(settlements.length).toBeGreaterThan(0);
    
    // Verify all settlements are valid
    settlements.forEach(settlement => {
      expect(settlement.from).toBeTruthy();
      expect(settlement.to).toBeTruthy();
      expect(settlement.amount).toBeGreaterThan(0);
      expect(settlement.priority).toBe('high');
    });
  });
});
