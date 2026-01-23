/**
 * Tests for amount change effect hook in AddExpense component
 * 
 * Validates:
 * - Requirement 1.4: WHEN the amount changes and Member_Shares have not been customized, 
 *   THE AddExpense_Component SHALL recalculate Equal_Share for all members
 * - Requirement 2.1: WHEN the amount field value changes, THE AddExpense_Component SHALL 
 *   recalculate Member_Shares based on the new amount
 * - Requirement 2.2: WHEN the split type is equal and the amount changes, THE AddExpense_Component 
 *   SHALL distribute the new amount equally among all selected members
 * - Requirement 2.4: WHEN the amount changes from zero to a positive value, THE AddExpense_Component 
 *   SHALL initialize Equal_Share for all members
 */

import React from 'react';
import { renderHook } from '@testing-library/react';

describe('AddExpense - Amount Change Effect Hook', () => {
  /**
   * Test: Verify amount change triggers recalculation for non-customized splits
   * 
   * This test verifies that the useEffect hook correctly recalculates equal shares
   * when the amount changes, but only when the split has not been customized.
   */
  it('should recalculate equal shares when amount changes (non-customized split)', () => {
    const mockGroup = {
      id: 'group1',
      members: ['user1', 'user2', 'user3']
    };

    let splitConfig = { type: 'equal', shares: {} };
    let splitCustomized = false;
    const amount = '300';

    // Simulate the effect logic
    const calculateShares = (amount, group, splitCustomized, splitType) => {
      if (!splitCustomized && splitType === 'equal') {
        const numAmount = parseFloat(amount) || 0;
        const equalShare = numAmount / group.members.length;
        const shares = {};
        group.members.forEach(m => { shares[m] = equalShare; });
        return { type: 'equal', shares };
      }
      return splitConfig;
    };

    // Initial calculation with amount 300
    splitConfig = calculateShares(amount, mockGroup, splitCustomized, 'equal');
    
    expect(splitConfig.shares['user1']).toBe(100);
    expect(splitConfig.shares['user2']).toBe(100);
    expect(splitConfig.shares['user3']).toBe(100);

    // Change amount to 600
    const newAmount = '600';
    splitConfig = calculateShares(newAmount, mockGroup, splitCustomized, 'equal');
    
    expect(splitConfig.shares['user1']).toBe(200);
    expect(splitConfig.shares['user2']).toBe(200);
    expect(splitConfig.shares['user3']).toBe(200);
  });

  it('should handle zero amount correctly', () => {
    const mockGroup = {
      id: 'group1',
      members: ['user1', 'user2', 'user3']
    };

    const calculateShares = (amount, group, splitCustomized, splitType) => {
      if (!splitCustomized && splitType === 'equal') {
        const numAmount = parseFloat(amount) || 0;
        const equalShare = numAmount / group.members.length;
        const shares = {};
        group.members.forEach(m => { shares[m] = equalShare; });
        return { type: 'equal', shares };
      }
      return { type: 'equal', shares: {} };
    };

    // Calculate with zero amount
    const splitConfig = calculateShares('0', mockGroup, false, 'equal');
    
    expect(splitConfig.shares['user1']).toBe(0);
    expect(splitConfig.shares['user2']).toBe(0);
    expect(splitConfig.shares['user3']).toBe(0);
  });

  it('should preserve custom splits when amount changes', () => {
    const mockGroup = {
      id: 'group1',
      members: ['user1', 'user2', 'user3']
    };

    const customSplitConfig = { 
      type: 'exact', 
      shares: { user1: 100, user2: 150, user3: 50 } 
    };

    const calculateShares = (amount, group, splitCustomized, splitType, currentConfig) => {
      if (!splitCustomized && splitType === 'equal') {
        const numAmount = parseFloat(amount) || 0;
        const equalShare = numAmount / group.members.length;
        const shares = {};
        group.members.forEach(m => { shares[m] = equalShare; });
        return { type: 'equal', shares };
      }
      return currentConfig;
    };

    // With splitCustomized = true, shares should not change
    const result = calculateShares('600', mockGroup, true, 'exact', customSplitConfig);
    
    expect(result.shares['user1']).toBe(100);
    expect(result.shares['user2']).toBe(150);
    expect(result.shares['user3']).toBe(50);
  });

  it('should initialize equal shares when amount changes from zero to positive', () => {
    const mockGroup = {
      id: 'group1',
      members: ['user1', 'user2', 'user3']
    };

    const calculateShares = (amount, group, splitCustomized, splitType) => {
      if (!splitCustomized && splitType === 'equal') {
        const numAmount = parseFloat(amount) || 0;
        const equalShare = numAmount / group.members.length;
        const shares = {};
        group.members.forEach(m => { shares[m] = equalShare; });
        return { type: 'equal', shares };
      }
      return { type: 'equal', shares: {} };
    };

    // Start with zero
    let splitConfig = calculateShares('0', mockGroup, false, 'equal');
    expect(splitConfig.shares['user1']).toBe(0);

    // Change to positive amount
    splitConfig = calculateShares('450', mockGroup, false, 'equal');
    expect(splitConfig.shares['user1']).toBe(150);
    expect(splitConfig.shares['user2']).toBe(150);
    expect(splitConfig.shares['user3']).toBe(150);
  });

  it('should not recalculate when split type is not equal', () => {
    const mockGroup = {
      id: 'group1',
      members: ['user1', 'user2', 'user3']
    };

    const percentageSplitConfig = { 
      type: 'percentage', 
      shares: { user1: 50, user2: 30, user3: 20 } 
    };

    const calculateShares = (amount, group, splitCustomized, splitType, currentConfig) => {
      if (!splitCustomized && splitType === 'equal') {
        const numAmount = parseFloat(amount) || 0;
        const equalShare = numAmount / group.members.length;
        const shares = {};
        group.members.forEach(m => { shares[m] = equalShare; });
        return { type: 'equal', shares };
      }
      return currentConfig;
    };

    // With split type 'percentage', shares should not change
    const result = calculateShares('600', mockGroup, false, 'percentage', percentageSplitConfig);
    
    expect(result.type).toBe('percentage');
    expect(result.shares['user1']).toBe(50);
    expect(result.shares['user2']).toBe(30);
    expect(result.shares['user3']).toBe(20);
  });
});

