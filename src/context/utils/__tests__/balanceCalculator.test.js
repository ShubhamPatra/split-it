/**
 * Unit tests for balanceCalculator utility functions
 * Tests balance calculation logic extracted from GroupContext
 */

import {
  calculateGroupBalances,
  calculateTotalExpenses,
  normalizeBalanceEvent,
  validateBalanceEvent,
} from '../balanceCalculator';

describe('balanceCalculator', () => {
  describe('calculateGroupBalances', () => {
    it('should calculate balances for equal split', () => {
      const expenses = [
        {
          paidBy: 'user1',
          amount: 100,
          splitConfig: {
            shares: {
              user1: 50,
              user2: 50,
            },
          },
        },
      ];
      const settlements = [];
      const memberIds = ['user1', 'user2'];

      const result = calculateGroupBalances({ expenses, settlements, memberIds });

      expect(result).toEqual({
        user1: 50, // Paid 100, owes 50
        user2: -50, // Owes 50
      });
    });

    it('should calculate balances with multiple expenses', () => {
      const expenses = [
        {
          paidBy: 'user1',
          amount: 100,
          splitConfig: {
            shares: { user1: 50, user2: 50 },
          },
        },
        {
          paidBy: 'user2',
          amount: 60,
          splitConfig: {
            shares: { user1: 30, user2: 30 },
          },
        },
      ];
      const settlements = [];
      const memberIds = ['user1', 'user2'];

      const result = calculateGroupBalances({ expenses, settlements, memberIds });

      expect(result).toEqual({
        user1: 20, // Paid 100, owes 80 (50+30)
        user2: -20, // Paid 60, owes 80 (50+30)
      });
    });

    it('should include confirmed settlements in balance', () => {
      const expenses = [
        {
          paidBy: 'user1',
          amount: 100,
          splitConfig: {
            shares: { user1: 50, user2: 50 },
          },
        },
      ];
      const settlements = [
        {
          fromUserId: 'user2',
          toUserId: 'user1',
          amount: 30,
          paymentStatus: 'confirmed',
        },
      ];
      const memberIds = ['user1', 'user2'];

      const result = calculateGroupBalances({ expenses, settlements, memberIds });

      expect(result).toEqual({
        user1: 20, // 50 (from expense) - 30 (received settlement)
        user2: -20, // -50 (from expense) + 30 (paid settlement)
      });
    });

    it('should ignore pending settlements', () => {
      const expenses = [
        {
          paidBy: 'user1',
          amount: 100,
          splitConfig: {
            shares: { user1: 50, user2: 50 },
          },
        },
      ];
      const settlements = [
        {
          fromUserId: 'user2',
          toUserId: 'user1',
          amount: 30,
          paymentStatus: 'pending',
        },
      ];
      const memberIds = ['user1', 'user2'];

      const result = calculateGroupBalances({ expenses, settlements, memberIds });

      expect(result).toEqual({
        user1: 50,
        user2: -50,
      });
    });

    it('should handle three-way split', () => {
      const expenses = [
        {
          paidBy: 'user1',
          amount: 90,
          splitConfig: {
            shares: {
              user1: 30,
              user2: 30,
              user3: 30,
            },
          },
        },
      ];
      const settlements = [];
      const memberIds = ['user1', 'user2', 'user3'];

      const result = calculateGroupBalances({ expenses, settlements, memberIds });

      expect(result).toEqual({
        user1: 60, // Paid 90, owes 30
        user2: -30,
        user3: -30,
      });
    });

    it('should initialize all members with zero balance', () => {
      const expenses = [];
      const settlements = [];
      const memberIds = ['user1', 'user2', 'user3'];

      const result = calculateGroupBalances({ expenses, settlements, memberIds });

      expect(result).toEqual({
        user1: 0,
        user2: 0,
        user3: 0,
      });
    });
  });

  describe('calculateTotalExpenses', () => {
    it('should sum all expense amounts', () => {
      const expenses = [
        { amount: 100 },
        { amount: 50 },
        { amount: 75.50 },
      ];

      const result = calculateTotalExpenses(expenses);

      expect(result).toBe(225.50);
    });

    it('should return 0 for empty array', () => {
      const result = calculateTotalExpenses([]);

      expect(result).toBe(0);
    });
  });

  describe('normalizeBalanceEvent', () => {
    it('should return flat balance structure as-is', () => {
      const balances = {
        user1: 100,
        user2: -50,
        user3: -50,
      };

      const result = normalizeBalanceEvent(balances);

      expect(result).toEqual(balances);
    });

    it('should extract nested balance structure', () => {
      const balances = {
        balances: {
          user1: 100,
          user2: -50,
          user3: -50,
        },
      };

      const result = normalizeBalanceEvent(balances);

      expect(result).toEqual({
        user1: 100,
        user2: -50,
        user3: -50,
      });
    });

    it('should return null for invalid input', () => {
      expect(normalizeBalanceEvent(null)).toBeNull();
      expect(normalizeBalanceEvent(undefined)).toBeNull();
      expect(normalizeBalanceEvent('invalid')).toBeNull();
      expect(normalizeBalanceEvent(123)).toBeNull();
    });
  });

  describe('validateBalanceEvent', () => {
    it('should validate correct event data', () => {
      const result = validateBalanceEvent('group123', { user1: 100 });

      expect(result).toEqual({
        valid: true,
        error: null,
      });
    });

    it('should reject invalid groupId', () => {
      expect(validateBalanceEvent('', { user1: 100 })).toEqual({
        valid: false,
        error: 'Invalid groupId: ',
      });

      expect(validateBalanceEvent(null, { user1: 100 })).toEqual({
        valid: false,
        error: 'Invalid groupId: null',
      });

      expect(validateBalanceEvent(123, { user1: 100 })).toEqual({
        valid: false,
        error: 'Invalid groupId: 123',
      });
    });

    it('should reject invalid balances', () => {
      expect(validateBalanceEvent('group123', null)).toEqual({
        valid: false,
        error: 'Invalid balances: null',
      });

      expect(validateBalanceEvent('group123', undefined)).toEqual({
        valid: false,
        error: 'Invalid balances: undefined',
      });

      expect(validateBalanceEvent('group123', 'invalid')).toEqual({
        valid: false,
        error: 'Invalid balances: invalid',
      });
    });
  });
});
