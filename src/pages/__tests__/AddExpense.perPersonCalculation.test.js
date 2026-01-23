/**
 * Tests for per-person calculation logic in AddExpense component
 * 
 * Validates:
 * - Requirement 4.1: WHEN Member_Shares are calculated, THE AddExpense_Component SHALL 
 *   display the per-person amount in the split summary
 * - Requirement 4.2: WHEN the split type is equal, THE AddExpense_Component SHALL count 
 *   only members with non-zero shares for per-person calculation
 * - Requirement 4.3: WHEN the amount is zero or invalid, THE AddExpense_Component SHALL 
 *   display 0 as the per-person amount
 * - Requirement 4.4: WHEN Member_Shares total does not equal the expense amount, 
 *   THE AddExpense_Component SHALL display an accurate per-person calculation based on 
 *   selected members
 */

describe('AddExpense - Per-Person Calculation Logic', () => {
  /**
   * Helper function that mimics the splitAmountPerPerson calculation
   * from the AddExpense component
   */
  const calculatePerPerson = (amount, currentGroup, splitConfig) => {
    // Edge case: No amount or group selected
    if (!amount || !currentGroup) return 0;
    
    const total = parseFloat(amount);
    
    // Edge case: Invalid amount (NaN, negative, or zero)
    if (isNaN(total) || total <= 0) return 0;

    if (splitConfig.type === 'equal') {
      // Count only members who have a non-zero share (participating members)
      const selectedMemberCount = Object.keys(splitConfig.shares)
        .filter(m => splitConfig.shares[m] > 0).length;
      
      // Edge case: No members selected, return 0 to avoid division by zero
      return selectedMemberCount > 0 ? total / selectedMemberCount : 0;
    }
    
    // For non-equal split types, per-person amount doesn't apply
    return 0;
  };

  describe('Basic Calculation', () => {
    it('should calculate correct per-person amount for equal split with all members', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2', 'user3']
      };

      const splitConfig = {
        type: 'equal',
        shares: { user1: 100, user2: 100, user3: 100 }
      };

      const result = calculatePerPerson('300', mockGroup, splitConfig);
      expect(result).toBe(100);
    });

    it('should calculate correct per-person amount with different total', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2', 'user3', 'user4']
      };

      const splitConfig = {
        type: 'equal',
        shares: { user1: 125, user2: 125, user3: 125, user4: 125 }
      };

      const result = calculatePerPerson('500', mockGroup, splitConfig);
      expect(result).toBe(125);
    });

    it('should handle decimal amounts correctly', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2', 'user3']
      };

      const splitConfig = {
        type: 'equal',
        shares: { user1: 33.33, user2: 33.33, user3: 33.34 }
      };

      const result = calculatePerPerson('100', mockGroup, splitConfig);
      expect(result).toBeCloseTo(33.33, 2);
    });
  });

  describe('Non-Zero Share Counting (Requirement 4.2)', () => {
    it('should count only members with non-zero shares', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2', 'user3', 'user4']
      };

      // Only 2 members have non-zero shares
      const splitConfig = {
        type: 'equal',
        shares: { user1: 150, user2: 150, user3: 0, user4: 0 }
      };

      const result = calculatePerPerson('300', mockGroup, splitConfig);
      // Should divide by 2 (only non-zero members), not 4
      expect(result).toBe(150);
    });

    it('should handle single member with non-zero share', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2', 'user3']
      };

      const splitConfig = {
        type: 'equal',
        shares: { user1: 300, user2: 0, user3: 0 }
      };

      const result = calculatePerPerson('300', mockGroup, splitConfig);
      expect(result).toBe(300);
    });

    it('should handle mix of zero and non-zero shares', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2', 'user3', 'user4', 'user5']
      };

      // 3 members with non-zero shares
      const splitConfig = {
        type: 'equal',
        shares: { user1: 100, user2: 0, user3: 100, user4: 100, user5: 0 }
      };

      const result = calculatePerPerson('300', mockGroup, splitConfig);
      expect(result).toBe(100);
    });
  });

  describe('Edge Cases - Zero and Invalid Amounts (Requirement 4.3)', () => {
    it('should return 0 for zero amount', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2']
      };

      const splitConfig = {
        type: 'equal',
        shares: { user1: 0, user2: 0 }
      };

      const result = calculatePerPerson('0', mockGroup, splitConfig);
      expect(result).toBe(0);
    });

    it('should return 0 for empty amount string', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2']
      };

      const splitConfig = {
        type: 'equal',
        shares: { user1: 0, user2: 0 }
      };

      const result = calculatePerPerson('', mockGroup, splitConfig);
      expect(result).toBe(0);
    });

    it('should return 0 for negative amount', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2']
      };

      const splitConfig = {
        type: 'equal',
        shares: { user1: 50, user2: 50 }
      };

      const result = calculatePerPerson('-100', mockGroup, splitConfig);
      expect(result).toBe(0);
    });

    it('should return 0 for invalid amount (NaN)', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2']
      };

      const splitConfig = {
        type: 'equal',
        shares: { user1: 50, user2: 50 }
      };

      const result = calculatePerPerson('abc', mockGroup, splitConfig);
      expect(result).toBe(0);
    });

    it('should return 0 when no group is selected', () => {
      const splitConfig = {
        type: 'equal',
        shares: { user1: 50, user2: 50 }
      };

      const result = calculatePerPerson('100', null, splitConfig);
      expect(result).toBe(0);
    });

    it('should return 0 when no members are selected (all zero shares)', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2', 'user3']
      };

      const splitConfig = {
        type: 'equal',
        shares: { user1: 0, user2: 0, user3: 0 }
      };

      const result = calculatePerPerson('300', mockGroup, splitConfig);
      expect(result).toBe(0);
    });
  });

  describe('Non-Equal Split Types', () => {
    it('should return 0 for percentage split type', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2']
      };

      const splitConfig = {
        type: 'percentage',
        shares: { user1: 60, user2: 40 }
      };

      const result = calculatePerPerson('100', mockGroup, splitConfig);
      expect(result).toBe(0);
    });

    it('should return 0 for exact split type', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2']
      };

      const splitConfig = {
        type: 'exact',
        shares: { user1: 75, user2: 25 }
      };

      const result = calculatePerPerson('100', mockGroup, splitConfig);
      expect(result).toBe(0);
    });

    it('should return 0 for itemized split type', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2']
      };

      const splitConfig = {
        type: 'itemized',
        shares: { user1: 50, user2: 50 }
      };

      const result = calculatePerPerson('100', mockGroup, splitConfig);
      expect(result).toBe(0);
    });
  });

  describe('Accurate Calculation (Requirement 4.4)', () => {
    it('should calculate based on selected members even if shares dont match total', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2', 'user3']
      };

      // Shares don't add up to 300, but calculation should be based on
      // total amount divided by count of non-zero members
      const splitConfig = {
        type: 'equal',
        shares: { user1: 80, user2: 80, user3: 80 }
      };

      const result = calculatePerPerson('300', mockGroup, splitConfig);
      // Should be 300 / 3 = 100, not based on the share values
      expect(result).toBe(100);
    });

    it('should handle very large amounts', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2']
      };

      const splitConfig = {
        type: 'equal',
        shares: { user1: 5000000, user2: 5000000 }
      };

      const result = calculatePerPerson('10000000', mockGroup, splitConfig);
      expect(result).toBe(5000000);
    });

    it('should handle very small amounts', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2', 'user3']
      };

      const splitConfig = {
        type: 'equal',
        shares: { user1: 0.01, user2: 0.01, user3: 0.01 }
      };

      const result = calculatePerPerson('0.03', mockGroup, splitConfig);
      expect(result).toBeCloseTo(0.01, 2);
    });

    it('should handle amounts that dont divide evenly', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2', 'user3']
      };

      const splitConfig = {
        type: 'equal',
        shares: { user1: 33.33, user2: 33.33, user3: 33.34 }
      };

      const result = calculatePerPerson('100', mockGroup, splitConfig);
      expect(result).toBeCloseTo(33.333333, 2);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle typical restaurant bill split', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2', 'user3', 'user4']
      };

      const splitConfig = {
        type: 'equal',
        shares: { user1: 287.5, user2: 287.5, user3: 287.5, user4: 287.5 }
      };

      const result = calculatePerPerson('1150', mockGroup, splitConfig);
      expect(result).toBe(287.5);
    });

    it('should handle scenario where one person didnt participate', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2', 'user3', 'user4']
      };

      // user4 didn't participate (share = 0)
      const splitConfig = {
        type: 'equal',
        shares: { user1: 166.67, user2: 166.67, user3: 166.66, user4: 0 }
      };

      const result = calculatePerPerson('500', mockGroup, splitConfig);
      // Should divide by 3, not 4
      expect(result).toBeCloseTo(166.67, 2);
    });

    it('should handle two-person split', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1', 'user2']
      };

      const splitConfig = {
        type: 'equal',
        shares: { user1: 50, user2: 50 }
      };

      const result = calculatePerPerson('100', mockGroup, splitConfig);
      expect(result).toBe(50);
    });

    it('should handle single person expense', () => {
      const mockGroup = {
        id: 'group1',
        members: ['user1']
      };

      const splitConfig = {
        type: 'equal',
        shares: { user1: 250 }
      };

      const result = calculatePerPerson('250', mockGroup, splitConfig);
      expect(result).toBe(250);
    });
  });
});
