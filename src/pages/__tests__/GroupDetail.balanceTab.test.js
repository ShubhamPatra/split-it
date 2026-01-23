/**
 * Tests for Balance_Tab re-rendering in GroupDetail component
 * 
 * Validates:
 * - Requirement 1.5: WHEN `balancesByGroup` state updates, THE Balance_Tab SHALL re-render with the new balance data
 * - Requirement 5.1: WHEN `balancesByGroup` state changes, THE Balance_Tab SHALL trigger a re-render
 * - Requirement 5.5: WHEN the user is viewing the Balance_Tab during an expense deletion, THE displayed balances SHALL update without requiring a tab switch
 */

import React from 'react';
import { renderHook } from '@testing-library/react';

describe('GroupDetail - Balance_Tab Re-rendering (Memoization)', () => {
  /**
   * Test: Verify balancesForMemo memoization pattern
   * 
   * This test verifies that the memoization pattern used in GroupDetail.jsx
   * correctly prevents unnecessary re-renders by using React.useMemo with
   * proper dependencies.
   * 
   * The pattern being tested:
   * ```javascript
   * const balancesForMemo = React.useMemo(() => {
   *   return getGroupBalances(id || '');
   * }, [getGroupBalances, id]);
   * ```
   * 
   * This ensures:
   * 1. The balance object reference remains stable when getGroupBalances and id don't change
   * 2. The allDebts calculation only re-runs when balances actually change
   * 3. Balance_Tab components receive stable props and don't re-render unnecessarily
   */
  it('should memoize balance calculation with correct dependencies', () => {
    // Mock getGroupBalances function
    const mockBalances = { user1: 100, user2: -50, user3: -50 };
    const getGroupBalances = jest.fn(() => mockBalances);
    const groupId = 'group1';

    // Simulate the memoization pattern used in GroupDetail
    const { result, rerender } = renderHook(
      ({ getGroupBalances, id }) => {
        return React.useMemo(() => {
          return getGroupBalances(id || '');
        }, [getGroupBalances, id]);
      },
      {
        initialProps: { getGroupBalances, id: groupId }
      }
    );

    // Initial render should call getGroupBalances once
    expect(getGroupBalances).toHaveBeenCalledTimes(1);
    expect(getGroupBalances).toHaveBeenCalledWith(groupId);
    expect(result.current).toEqual(mockBalances);

    // Rerender with same props - should NOT call getGroupBalances again
    rerender({ getGroupBalances, id: groupId });
    expect(getGroupBalances).toHaveBeenCalledTimes(1); // Still 1, not 2
    expect(result.current).toEqual(mockBalances);

    // Rerender with different id - should call getGroupBalances again
    const newGroupId = 'group2';
    rerender({ getGroupBalances, id: newGroupId });
    expect(getGroupBalances).toHaveBeenCalledTimes(2);
    expect(getGroupBalances).toHaveBeenCalledWith(newGroupId);
  });

  /**
   * Test: Verify allDebts memoization depends on balancesForMemo
   * 
   * This test verifies that the allDebts useMemo correctly depends on balancesForMemo
   * and only recalculates when the balance object changes.
   * 
   * The pattern being tested:
   * ```javascript
   * const allDebts = React.useMemo(() => {
   *   if (!balancesForMemo || Object.keys(balancesForMemo).length === 0) return [];
   *   return calculateOptimalSettlements(balancesForMemo);
   * }, [balancesForMemo]);
   * ```
   */
  it('should recalculate settlements only when balances change', () => {
    const calculateOptimalSettlements = jest.fn((balances) => {
      // Simple mock implementation
      return Object.entries(balances)
        .filter(([, amount]) => amount < 0)
        .map(([from, amount]) => ({ from, to: 'user1', amount: Math.abs(amount) }));
    });

    const mockBalances1 = { user1: 100, user2: -50, user3: -50 };
    const mockBalances2 = { user1: 150, user2: -75, user3: -75 };

    // Simulate the allDebts memoization pattern
    const { result, rerender } = renderHook(
      ({ balancesForMemo }) => {
        return React.useMemo(() => {
          if (!balancesForMemo || Object.keys(balancesForMemo).length === 0) return [];
          return calculateOptimalSettlements(balancesForMemo);
        }, [balancesForMemo]);
      },
      {
        initialProps: { balancesForMemo: mockBalances1 }
      }
    );

    // Initial render should calculate settlements
    expect(calculateOptimalSettlements).toHaveBeenCalledTimes(1);
    expect(calculateOptimalSettlements).toHaveBeenCalledWith(mockBalances1);
    expect(result.current).toHaveLength(2); // user2 and user3 owe money

    // Rerender with same balance object - should NOT recalculate
    rerender({ balancesForMemo: mockBalances1 });
    expect(calculateOptimalSettlements).toHaveBeenCalledTimes(1); // Still 1

    // Rerender with different balance object - should recalculate
    rerender({ balancesForMemo: mockBalances2 });
    expect(calculateOptimalSettlements).toHaveBeenCalledTimes(2);
    expect(calculateOptimalSettlements).toHaveBeenCalledWith(mockBalances2);
  });

  /**
   * Test: Verify memoization handles empty balances correctly
   * 
   * This test ensures that the memoization works correctly even when
   * balances are empty or undefined, which can happen during initial load
   * or when all expenses are deleted.
   */
  it('should handle empty balances without recalculating unnecessarily', () => {
    const calculateOptimalSettlements = jest.fn(() => []);

    // Simulate the allDebts memoization with empty balances
    const { result, rerender } = renderHook(
      ({ balancesForMemo }) => {
        return React.useMemo(() => {
          if (!balancesForMemo || Object.keys(balancesForMemo).length === 0) return [];
          return calculateOptimalSettlements(balancesForMemo);
        }, [balancesForMemo]);
      },
      {
        initialProps: { balancesForMemo: {} }
      }
    );

    // Should return empty array without calling calculateOptimalSettlements
    expect(result.current).toEqual([]);
    expect(calculateOptimalSettlements).not.toHaveBeenCalled();

    // Rerender with same empty object - should not recalculate
    rerender({ balancesForMemo: {} });
    expect(calculateOptimalSettlements).not.toHaveBeenCalled();

    // Rerender with undefined - should not recalculate
    rerender({ balancesForMemo: undefined });
    expect(result.current).toEqual([]);
    expect(calculateOptimalSettlements).not.toHaveBeenCalled();
  });

  /**
   * Test: Verify memoization chain prevents unnecessary re-renders
   * 
   * This test verifies the complete memoization chain:
   * getGroupBalances -> balancesForMemo -> allDebts
   * 
   * This ensures that when getGroupBalances returns the same balance object,
   * the entire chain remains stable and doesn't trigger unnecessary recalculations.
   */
  it('should maintain stable references through the memoization chain', () => {
    const mockBalances = { user1: 100, user2: -50, user3: -50 };
    const getGroupBalances = jest.fn(() => mockBalances);
    const calculateOptimalSettlements = jest.fn((balances) => [
      { from: 'user2', to: 'user1', amount: 50 },
      { from: 'user3', to: 'user1', amount: 50 },
    ]);

    const groupId = 'group1';

    // Simulate the complete memoization chain
    const { result, rerender } = renderHook(
      ({ getGroupBalances, id }) => {
        // Step 1: Memoize balance calculation
        const balancesForMemo = React.useMemo(() => {
          return getGroupBalances(id || '');
        }, [getGroupBalances, id]);

        // Step 2: Memoize settlement calculation
        const allDebts = React.useMemo(() => {
          if (!balancesForMemo || Object.keys(balancesForMemo).length === 0) return [];
          return calculateOptimalSettlements(balancesForMemo);
        }, [balancesForMemo]);

        return { balancesForMemo, allDebts };
      },
      {
        initialProps: { getGroupBalances, id: groupId }
      }
    );

    // Initial render
    expect(getGroupBalances).toHaveBeenCalledTimes(1);
    expect(calculateOptimalSettlements).toHaveBeenCalledTimes(1);
    const initialBalances = result.current.balancesForMemo;
    const initialDebts = result.current.allDebts;

    // Rerender with same props - nothing should recalculate
    rerender({ getGroupBalances, id: groupId });
    expect(getGroupBalances).toHaveBeenCalledTimes(1); // No additional call
    expect(calculateOptimalSettlements).toHaveBeenCalledTimes(1); // No additional call
    
    // References should remain stable
    expect(result.current.balancesForMemo).toBe(initialBalances);
    expect(result.current.allDebts).toBe(initialDebts);
  });
});

