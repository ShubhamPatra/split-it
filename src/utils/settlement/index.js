/**
 * Settlement Engine - Index
 * 
 * Re-exports all public APIs from the settlement module.
 * Import from this file for clean imports in components.
 * 
 * @example
 * import { generateOptimalSettlements, formatSettlement } from '@/utils/settlement';
 */

// Main API
export {
  generateOptimalSettlements,
  validateSettlementInput,
  getSettlementStats,
  formatSettlement,
  groupSettlementsByPayer,
  groupSettlementsByReceiver,
  CONFIG
} from './settlementEngine.js';

// Solvers (for advanced use cases or testing)
export { exactBacktrackingSolver, theoreticalMinimum } from './exactSolver.js';
export { greedySolver, enhancedGreedySolver, maxTransactions } from './greedySolver.js';

// Helpers (for advanced use cases or testing)
export {
  convertToPaise,
  convertToRupees,
  validateBalances,
  normalizeBalances,
  consolidateAndConvert,
  generateStateKey,
  clonePeople
} from './settlementHelpers.js';
