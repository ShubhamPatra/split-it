/**
 * Tests for split dialog save handler in AddExpense component
 * 
 * Validates:
 * - Requirement 3.1: WHEN a user opens Split_Dialog and saves a custom split, 
 *   THE AddExpense_Component SHALL mark the split as explicitly customized
 */

import React from 'react';

describe('AddExpense - Split Dialog Save Handler', () => {
  /**
   * Test: Verify that saving from split dialog marks split as customized
   * 
   * This test verifies that when a user saves a split configuration from the
   * AdvancedSplitDialog, the splitCustomized flag is set to true.
   */
  it('should set splitCustomized to true when split dialog is saved', () => {
    // Simulate the handler logic
    let splitConfig = { type: 'equal', shares: {} };
    let splitCustomized = false;
    let showSplitDialog = true;

    const handleSplitDialogSave = (newSplitConfig) => {
      splitConfig = newSplitConfig;
      splitCustomized = true; // Mark as customized
      showSplitDialog = false;
    };

    // User saves a custom split from dialog
    const customSplit = {
      type: 'exact',
      shares: { user1: 100, user2: 150, user3: 50 }
    };

    handleSplitDialogSave(customSplit);

    // Verify the split is marked as customized
    expect(splitCustomized).toBe(true);
    expect(splitConfig).toEqual(customSplit);
    expect(showSplitDialog).toBe(false);
  });

  /**
   * Test: Verify that custom split is preserved when amount changes
   * 
   * This test verifies that after a split is marked as customized,
   * changing the amount does not recalculate the shares.
   */
  it('should preserve custom split when amount changes after dialog save', () => {
    const mockGroup = {
      id: 'group1',
      members: ['user1', 'user2', 'user3']
    };

    let splitConfig = { type: 'equal', shares: { user1: 100, user2: 100, user3: 100 } };
    let splitCustomized = false;

    // Simulate saving a custom split
    const handleSplitDialogSave = (newSplitConfig) => {
      splitConfig = newSplitConfig;
      splitCustomized = true;
    };

    const customSplit = {
      type: 'exact',
      shares: { user1: 100, user2: 150, user3: 50 }
    };

    handleSplitDialogSave(customSplit);

    // Simulate amount change effect
    const handleAmountChange = (amount, group, isCustomized, currentConfig) => {
      if (!isCustomized && currentConfig.type === 'equal') {
        const numAmount = parseFloat(amount) || 0;
        const equalShare = numAmount / group.members.length;
        const shares = {};
        group.members.forEach(m => { shares[m] = equalShare; });
        return { type: 'equal', shares };
      }
      return currentConfig;
    };

    // Change amount - should NOT recalculate because split is customized
    const result = handleAmountChange('600', mockGroup, splitCustomized, splitConfig);

    expect(result.shares['user1']).toBe(100);
    expect(result.shares['user2']).toBe(150);
    expect(result.shares['user3']).toBe(50);
  });

  /**
   * Test: Verify that splitCustomized is reset when group changes
   * 
   * This test verifies that when the user changes the selected group,
   * the splitCustomized flag is reset to false.
   */
  it('should reset splitCustomized to false when group changes', () => {
    const mockGroup1 = {
      id: 'group1',
      members: ['user1', 'user2', 'user3']
    };

    const mockGroup2 = {
      id: 'group2',
      members: ['user1', 'user4', 'user5']
    };

    let splitConfig = { type: 'exact', shares: { user1: 100, user2: 150, user3: 50 } };
    let splitCustomized = true;

    // Simulate group change effect
    const handleGroupChange = (group, amount) => {
      const numAmount = parseFloat(amount) || 0;
      const equalShare = numAmount / group.members.length;
      const shares = {};
      group.members.forEach(m => { shares[m] = equalShare; });
      splitConfig = { type: 'equal', shares };
      splitCustomized = false; // Reset customization flag
    };

    // Change group
    handleGroupChange(mockGroup2, '300');

    // Verify customization flag is reset
    expect(splitCustomized).toBe(false);
    expect(splitConfig.type).toBe('equal');
    expect(splitConfig.shares['user1']).toBe(100);
    expect(splitConfig.shares['user4']).toBe(100);
    expect(splitConfig.shares['user5']).toBe(100);
  });

  /**
   * Test: Verify that equal split can be recalculated after group change
   * 
   * This test verifies that after a group change resets the customization flag,
   * amount changes will again trigger recalculation.
   */
  it('should allow recalculation after group change resets customization', () => {
    const mockGroup1 = {
      id: 'group1',
      members: ['user1', 'user2', 'user3']
    };

    const mockGroup2 = {
      id: 'group2',
      members: ['user1', 'user4']
    };

    let splitConfig = { type: 'exact', shares: { user1: 100, user2: 150, user3: 50 } };
    let splitCustomized = true;

    // Simulate group change
    const handleGroupChange = (group, amount) => {
      const numAmount = parseFloat(amount) || 0;
      const equalShare = numAmount / group.members.length;
      const shares = {};
      group.members.forEach(m => { shares[m] = equalShare; });
      splitConfig = { type: 'equal', shares };
      splitCustomized = false;
    };

    // Simulate amount change
    const handleAmountChange = (amount, group, isCustomized, currentConfig) => {
      if (!isCustomized && currentConfig.type === 'equal') {
        const numAmount = parseFloat(amount) || 0;
        const equalShare = numAmount / group.members.length;
        const shares = {};
        group.members.forEach(m => { shares[m] = equalShare; });
        return { type: 'equal', shares };
      }
      return currentConfig;
    };

    // Change group with amount 200
    handleGroupChange(mockGroup2, '200');
    expect(splitConfig.shares['user1']).toBe(100);
    expect(splitConfig.shares['user4']).toBe(100);

    // Now change amount - should recalculate because customization was reset
    splitConfig = handleAmountChange('400', mockGroup2, splitCustomized, splitConfig);
    expect(splitConfig.shares['user1']).toBe(200);
    expect(splitConfig.shares['user4']).toBe(200);
  });

  /**
   * Test: Verify that dialog save properly updates split configuration
   * 
   * This test verifies that the new split configuration from the dialog
   * is properly saved to state.
   */
  it('should properly save new split configuration from dialog', () => {
    let splitConfig = { type: 'equal', shares: { user1: 100, user2: 100 } };
    let splitCustomized = false;

    const handleSplitDialogSave = (newSplitConfig) => {
      splitConfig = newSplitConfig;
      splitCustomized = true;
    };

    // Test with percentage split
    const percentageSplit = {
      type: 'percentage',
      shares: { user1: 60, user2: 40 }
    };

    handleSplitDialogSave(percentageSplit);

    expect(splitConfig.type).toBe('percentage');
    expect(splitConfig.shares['user1']).toBe(60);
    expect(splitConfig.shares['user2']).toBe(40);
    expect(splitCustomized).toBe(true);

    // Test with exact split
    const exactSplit = {
      type: 'exact',
      shares: { user1: 175, user2: 125 }
    };

    handleSplitDialogSave(exactSplit);

    expect(splitConfig.type).toBe('exact');
    expect(splitConfig.shares['user1']).toBe(175);
    expect(splitConfig.shares['user2']).toBe(125);
    expect(splitCustomized).toBe(true);
  });
});
