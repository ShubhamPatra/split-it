/**
 * Settlement Engine Test Suite
 * 
 * Comprehensive tests for the optimal settlement algorithm.
 * Run with: npm test -- --testPathPattern=settlementEngine
 * 
 * @jest-environment node
 */

import {
  generateOptimalSettlements,
  validateSettlementInput,
  getSettlementStats,
  formatSettlement
} from './settlementEngine.js';

import {
  convertToPaise,
  convertToRupees,
  validateBalances,
  normalizeBalances
} from './settlementHelpers.js';

import { exactBacktrackingSolver } from './exactSolver.js';
import { greedySolver, enhancedGreedySolver } from './greedySolver.js';

describe('Settlement Helpers', () => {
  describe('convertToPaise', () => {
    test('converts whole rupees', () => {
      expect(convertToPaise(100)).toBe(10000);
      expect(convertToPaise(1)).toBe(100);
      expect(convertToPaise(0)).toBe(0);
    });

    test('converts paise correctly', () => {
      expect(convertToPaise(33.33)).toBe(3333);
      expect(convertToPaise(33.34)).toBe(3334);
      expect(convertToPaise(0.01)).toBe(1);
      expect(convertToPaise(0.99)).toBe(99);
    });

    test('handles floating-point edge cases', () => {
      // 66.67 * 100 = 6666.999999999999 in JS
      expect(convertToPaise(66.67)).toBe(6667);
      expect(convertToPaise(33.33 + 33.34)).toBe(6667);
    });

    test('handles negative amounts', () => {
      expect(convertToPaise(-50)).toBe(-5000);
      expect(convertToPaise(-33.33)).toBe(-3333);
    });
  });

  describe('convertToRupees', () => {
    test('converts paise to rupees', () => {
      expect(convertToRupees(10000)).toBe(100);
      expect(convertToRupees(3333)).toBe(33.33);
      expect(convertToRupees(1)).toBe(0.01);
    });

    test('rounds to 2 decimal places', () => {
      expect(convertToRupees(3333)).toBe(33.33);
      expect(convertToRupees(3334)).toBe(33.34);
    });
  });

  describe('validateBalances', () => {
    test('accepts valid balances', () => {
      const result = validateBalances({ alice: 100, bob: -100 });
      expect(result.valid).toBe(true);
      expect(result.empty).toBe(false);
    });

    test('accepts empty balances', () => {
      const result = validateBalances({});
      expect(result.valid).toBe(true);
      expect(result.empty).toBe(true);
    });

    test('accepts all-zero balances', () => {
      const result = validateBalances({ alice: 0, bob: 0 });
      expect(result.valid).toBe(true);
      expect(result.empty).toBe(true);
    });

    test('throws on single person', () => {
      expect(() => validateBalances({ alice: 100 }))
        .toThrow('Need at least 2 people to settle');
    });

    test('throws on unbalanced amounts', () => {
      expect(() => validateBalances({ alice: 100, bob: -50 }))
        .toThrow(/Balances don't sum to zero/);
    });

    test('throws on all debtors', () => {
      expect(() => validateBalances({ alice: -100, bob: -100 }))
        .toThrow(/Balances don't sum to zero/);
    });

    test('throws on all creditors', () => {
      expect(() => validateBalances({ alice: 100, bob: 100 }))
        .toThrow(/Balances don't sum to zero/);
    });

    test('accepts small imbalance within tolerance', () => {
      // 0.01 tolerance
      const result = validateBalances({ alice: 100.005, bob: -100 });
      expect(result.valid).toBe(true);
    });
  });

  describe('normalizeBalances', () => {
    test('converts to paise and filters zeros', () => {
      const result = normalizeBalances({ alice: 100, bob: 0, charlie: -100 });
      expect(result).toHaveLength(2);
      expect(result.find(p => p.id === 'alice').balance).toBe(10000);
      expect(result.find(p => p.id === 'charlie').balance).toBe(-10000);
    });

    test('filters near-zero balances', () => {
      const result = normalizeBalances({ alice: 100, bob: 0.001, charlie: -100 });
      expect(result).toHaveLength(2);
    });
  });
});

describe('Exact Solver', () => {
  test('handles simple 2-person case', () => {
    const people = [
      { id: 'alice', balance: 10000 },
      { id: 'bob', balance: -10000 }
    ];
    const result = exactBacktrackingSolver(people);
    
    expect(result.settlements).toHaveLength(1);
    expect(result.settlements[0]).toMatchObject({
      from: 'bob',
      to: 'alice',
      amount: 10000
    });
  });

  test('finds optimal for 3-person case', () => {
    const people = [
      { id: 'alice', balance: 15000 },
      { id: 'bob', balance: -5000 },
      { id: 'charlie', balance: -10000 }
    ];
    const result = exactBacktrackingSolver(people);
    
    expect(result.settlements).toHaveLength(2);
    expect(result.timedOut).toBe(false);
  });

  test('finds optimal for 4-person case with exact matches', () => {
    // A: +50, B: +50, C: -50, D: -50
    // Optimal: 2 transactions (C→A, D→B)
    const people = [
      { id: 'alice', balance: 5000 },
      { id: 'bob', balance: 5000 },
      { id: 'charlie', balance: -5000 },
      { id: 'diana', balance: -5000 }
    ];
    const result = exactBacktrackingSolver(people);
    
    expect(result.settlements).toHaveLength(2);
  });

  test('handles complex case optimally', () => {
    // A: +100, B: +50, C: -75, D: -75
    // Without optimization: could be 3 transactions
    // Optimal: 3 transactions minimum
    const people = [
      { id: 'alice', balance: 10000 },
      { id: 'bob', balance: 5000 },
      { id: 'charlie', balance: -7500 },
      { id: 'diana', balance: -7500 }
    ];
    const result = exactBacktrackingSolver(people);
    
    expect(result.settlements.length).toBeLessThanOrEqual(3);
  });

  test('empty input returns empty settlements', () => {
    const result = exactBacktrackingSolver([]);
    expect(result.settlements).toHaveLength(0);
  });
});

describe('Greedy Solver', () => {
  test('handles simple case', () => {
    const people = [
      { id: 'alice', balance: 10000 },
      { id: 'bob', balance: -10000 }
    ];
    const result = greedySolver(people);
    
    expect(result.settlements).toHaveLength(1);
  });

  test('matches largest first', () => {
    const people = [
      { id: 'alice', balance: 15000 },
      { id: 'bob', balance: -5000 },
      { id: 'charlie', balance: -10000 }
    ];
    const result = greedySolver(people);
    
    // Should match charlie (largest debtor) with alice first
    expect(result.settlements[0].from).toBe('charlie');
    expect(result.settlements[0].to).toBe('alice');
  });

  test('handles large groups efficiently', () => {
    // Generate 50 people with random balances
    const people = [];
    let total = 0;
    
    for (let i = 0; i < 49; i++) {
      const balance = Math.floor(Math.random() * 20000) - 10000;
      people.push({ id: `person${i}`, balance });
      total += balance;
    }
    
    // Add balancing person
    people.push({ id: 'person49', balance: -total });
    
    const start = performance.now();
    const result = greedySolver(people);
    const elapsed = performance.now() - start;
    
    expect(elapsed).toBeLessThan(50); // Should be very fast
    expect(result.settlements.length).toBeGreaterThan(0);
  });
});

describe('Enhanced Greedy Solver', () => {
  test('prioritizes exact matches', () => {
    // A: +100, B: -100, C: +50, D: -50
    // Should find exact matches: B→A, D→C
    const people = [
      { id: 'alice', balance: 10000 },
      { id: 'bob', balance: -10000 },
      { id: 'charlie', balance: 5000 },
      { id: 'diana', balance: -5000 }
    ];
    const result = enhancedGreedySolver(people);
    
    expect(result.settlements).toHaveLength(2);
  });
});

describe('Main Settlement Engine', () => {
  describe('Edge Cases', () => {
    test('empty balances returns empty array', () => {
      const result = generateOptimalSettlements({});
      expect(result.settlements).toEqual([]);
      expect(result.method).toBe('none');
    });

    test('all zeros returns empty array', () => {
      const result = generateOptimalSettlements({ alice: 0, bob: 0 });
      expect(result.settlements).toEqual([]);
    });

    test('single person throws error', () => {
      expect(() => generateOptimalSettlements({ alice: 100 }))
        .toThrow('Need at least 2 people to settle');
    });

    test('unbalanced throws error', () => {
      expect(() => generateOptimalSettlements({ alice: 100, bob: -50 }))
        .toThrow(/Balances don't sum to zero/);
    });
  });

  describe('Small Groups (Exact Solver)', () => {
    test('2-person settlement', () => {
      const result = generateOptimalSettlements({
        alice: 100,
        bob: -100
      });
      
      expect(result.settlements).toHaveLength(1);
      expect(result.method).toBe('exact');
      expect(result.settlements[0]).toMatchObject({
        from: 'bob',
        to: 'alice',
        amount: 100
      });
    });

    test('3-person settlement', () => {
      const result = generateOptimalSettlements({
        alice: 150,
        bob: -50,
        charlie: -100
      });
      
      expect(result.settlements).toHaveLength(2);
      expect(result.method).toBe('exact');
      
      // Verify total amounts
      const totalToAlice = result.settlements
        .filter(s => s.to === 'alice')
        .reduce((sum, s) => sum + s.amount, 0);
      expect(totalToAlice).toBe(150);
    });

    test('4-person with exact matches', () => {
      const result = generateOptimalSettlements({
        alice: 50,
        bob: 50,
        charlie: -50,
        diana: -50
      });
      
      expect(result.settlements).toHaveLength(2);
      expect(result.method).toBe('exact');
    });

    test('handles paise precision', () => {
      const result = generateOptimalSettlements({
        alice: 33.33,
        bob: 33.34,
        charlie: -66.67
      });
      
      expect(result.settlements.length).toBeLessThanOrEqual(2);
      
      // Verify precision
      const totalFromCharlie = result.settlements
        .filter(s => s.from === 'charlie')
        .reduce((sum, s) => sum + s.amount, 0);
      expect(totalFromCharlie).toBeCloseTo(66.67, 2);
    });

    test('real-world split scenario', () => {
      // Alice paid ₹250 for 4 people (each owes ₹62.50)
      // But we store as: Alice is owed ₹187.50, others owe ₹62.50 each
      const result = generateOptimalSettlements({
        alice: 250 - 62.50, // 187.50 owed to Alice
        bob: -62.50,
        charlie: -62.50,
        diana: -62.50
      });
      
      expect(result.settlements).toHaveLength(3);
      
      // All payments should go to Alice
      for (const settlement of result.settlements) {
        expect(settlement.to).toBe('alice');
        expect(settlement.amount).toBe(62.5);
      }
    });
  });

  describe('Large Groups (Greedy Solver)', () => {
    test('uses greedy for >10 people', () => {
      const balances = {};
      let total = 0;
      
      // 14 people with ₹100 each
      for (let i = 0; i < 14; i++) {
        balances[`person${i}`] = -100;
        total -= 100;
      }
      
      // 1 person owed the total
      balances['creditor'] = -total;
      
      const result = generateOptimalSettlements(balances);
      
      expect(result.method).toBe('greedy');
      expect(result.settlements.length).toBe(14);
    });

    test('performance: 50 people <50ms', () => {
      const balances = {};
      let total = 0;
      
      for (let i = 0; i < 49; i++) {
        const amount = Math.floor(Math.random() * 200) - 100;
        balances[`person${i}`] = amount;
        total += amount;
      }
      
      balances['balancer'] = -total;
      
      const start = performance.now();
      const result = generateOptimalSettlements(balances);
      const elapsed = performance.now() - start;
      
      expect(elapsed).toBeLessThan(50);
      expect(result.method).toBe('greedy');
    });

    test('performance: 100 people <100ms', () => {
      const balances = {};
      let total = 0;
      
      for (let i = 0; i < 99; i++) {
        const amount = Math.floor(Math.random() * 200) - 100;
        balances[`person${i}`] = amount;
        total += amount;
      }
      
      balances['balancer'] = -total;
      
      const start = performance.now();
      const result = generateOptimalSettlements(balances);
      const elapsed = performance.now() - start;
      
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('Validation Functions', () => {
    test('validateSettlementInput returns valid for good input', () => {
      const result = validateSettlementInput({ alice: 100, bob: -100 });
      expect(result.valid).toBe(true);
    });

    test('validateSettlementInput returns error for bad input', () => {
      const result = validateSettlementInput({ alice: 100 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('2 people');
    });
  });

  describe('Statistics Functions', () => {
    test('getSettlementStats returns correct counts', () => {
      const stats = getSettlementStats({
        alice: 100,
        bob: -50,
        charlie: -50,
        diana: 0
      });
      
      expect(stats.totalPeople).toBe(4);
      expect(stats.activePeople).toBe(3);
      expect(stats.debtorCount).toBe(2);
      expect(stats.creditorCount).toBe(1);
      expect(stats.totalDebt).toBe(100);
      expect(stats.willUseExactSolver).toBe(true);
    });
  });

  describe('Formatting Functions', () => {
    test('formatSettlement with IDs', () => {
      const settlement = { from: 'bob', to: 'alice', amount: 50.5 };
      const formatted = formatSettlement(settlement);
      expect(formatted).toBe('bob pays alice ₹50.50');
    });

    test('formatSettlement with name map', () => {
      const settlement = { from: 'user1', to: 'user2', amount: 100 };
      const nameMap = { user1: 'Bob', user2: 'Alice' };
      const formatted = formatSettlement(settlement, nameMap);
      expect(formatted).toBe('Bob pays Alice ₹100.00');
    });
  });
});

describe('Integration Tests', () => {
  test('settlements fully settle all debts', () => {
    const balances = {
      alice: 200,
      bob: -50,
      charlie: -75,
      diana: -75
    };
    
    const result = generateOptimalSettlements(balances);
    
    // Apply settlements to a copy of balances
    const settled = { ...balances };
    
    for (const { from, to, amount } of result.settlements) {
      settled[from] += amount;
      settled[to] -= amount;
    }
    
    // All balances should be ~0
    for (const balance of Object.values(settled)) {
      expect(Math.abs(balance)).toBeLessThan(0.01);
    }
  });

  test('no self-payments', () => {
    const balances = {
      alice: 100,
      bob: -30,
      charlie: -70
    };
    
    const result = generateOptimalSettlements(balances);
    
    for (const settlement of result.settlements) {
      expect(settlement.from).not.toBe(settlement.to);
    }
  });

  test('all amounts are positive', () => {
    const balances = {
      alice: 150,
      bob: -50,
      charlie: -100
    };
    
    const result = generateOptimalSettlements(balances);
    
    for (const settlement of result.settlements) {
      expect(settlement.amount).toBeGreaterThan(0);
    }
  });
});
