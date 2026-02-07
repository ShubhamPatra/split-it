import { calculateGroupBalances, invalidateBalanceCache } from '../jobs/balanceService.js';
import Group from '../models/Group.js';

/**
 * Balance Reconciliation Controller
 * 
 * Provides diagnostic endpoints for balance verification and reconciliation.
 * Useful for detecting and fixing balance inconsistencies.
 */

/**
 * @desc    Force recalculate balances for a group and compare with cached values
 * @route   POST /api/balances/reconcile/:groupId
 * @access  Private (Group Admin or Creator)
 */
export const reconcileGroupBalances = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { fix = false } = req.body;

    // Verify group exists
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    if (!group.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized - must be a group member' });
    }

    // Check if user is admin or creator
    const isCreator = group.createdBy.toString() === req.user._id.toString();
    const isAdmin = group.admins?.some(admin => admin.toString() === req.user._id.toString());

    if (!isCreator && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized - must be group admin or creator' });
    }

    // Get cached balances (if any)
    const cachedResult = await calculateGroupBalances(groupId, false);
    const cachedBalances = cachedResult.balances;
    const wasCached = cachedResult.fromCache;

    // Force fresh calculation
    await invalidateBalanceCache(groupId);
    const freshResult = await calculateGroupBalances(groupId, true);
    const freshBalances = freshResult.balances;

    // Compare cached vs fresh
    const discrepancies = [];
    const allUserIds = new Set([
      ...Object.keys(cachedBalances),
      ...Object.keys(freshBalances)
    ]);

    for (const userId of allUserIds) {
      const cachedBalance = cachedBalances[userId] || 0;
      const freshBalance = freshBalances[userId] || 0;
      const difference = Math.abs(cachedBalance - freshBalance);

      if (difference > 0.01) { // Allow for floating point precision
        discrepancies.push({
          userId,
          cachedBalance: cachedBalance.toFixed(2),
          freshBalance: freshBalance.toFixed(2),
          difference: difference.toFixed(2),
        });
      }
    }

    const hasDiscrepancies = discrepancies.length > 0;

    // If fix=true and there are discrepancies, emit socket event with fresh balances
    if (fix && hasDiscrepancies) {
      const io = req.app.get('io');
      if (io) {
        try {
          const { emitBalanceUpdate } = await import('../utils/socketEmitter.js');
          emitBalanceUpdate(io, groupId, freshBalances);
        } catch (socketError) {
          console.error('Error emitting balance update during reconciliation:', socketError);
        }
      }
    }

    res.json({
      groupId,
      groupName: group.name,
      wasCached,
      hasDiscrepancies,
      discrepancyCount: discrepancies.length,
      discrepancies,
      cachedBalances,
      freshBalances,
      fixed: fix && hasDiscrepancies,
      message: hasDiscrepancies
        ? `Found ${discrepancies.length} balance discrepanc${discrepancies.length === 1 ? 'y' : 'ies'}${fix ? ' - fixed and broadcasted' : ''}`
        : 'All balances are consistent',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Balance reconciliation error:', error);
    res.status(500).json({
      message: 'Error reconciling balances'
    });
  }
};

/**
 * @desc    Get balance calculation details for a group (diagnostic)
 * @route   GET /api/balances/details/:groupId
 * @access  Private (Group Member)
 */
export const getBalanceDetails = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Verify group exists
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    if (!group.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized - must be a group member' });
    }

    // Get balance calculation with details
    const result = await calculateGroupBalances(groupId, false);

    res.json({
      groupId,
      groupName: group.name,
      balances: result.balances,
      fromCache: result.fromCache,
      calculatedAt: result.calculatedAt,
      memberCount: group.members.length,
      totalExpenses: result.totalExpenses || 0,
      totalSettlements: result.totalSettlements || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get balance details error:', error);
    res.status(500).json({
      message: 'Error getting balance details'
    });
  }
};

/**
 * @desc    Invalidate balance cache for a group
 * @route   POST /api/balances/invalidate/:groupId
 * @access  Private (Group Admin or Creator)
 */
export const invalidateGroupBalanceCache = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Verify group exists
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    if (!group.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized - must be a group member' });
    }

    // Check if user is admin or creator
    const isCreator = group.createdBy.toString() === req.user._id.toString();
    const isAdmin = group.admins?.some(admin => admin.toString() === req.user._id.toString());

    if (!isCreator && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized - must be group admin or creator' });
    }

    // Invalidate cache
    await invalidateBalanceCache(groupId);

    // Recalculate fresh balances
    const result = await calculateGroupBalances(groupId, true);

    // Emit socket event with fresh balances
    const io = req.app.get('io');
    if (io) {
      try {
        const { emitBalanceUpdate } = await import('../utils/socketEmitter.js');
        emitBalanceUpdate(io, groupId, result.balances);
      } catch (socketError) {
        console.error('Error emitting balance update during cache invalidation:', socketError);
      }
    }

    res.json({
      message: 'Balance cache invalidated and recalculated',
      groupId,
      groupName: group.name,
      balances: result.balances,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Invalidate balance cache error:', error);
    res.status(500).json({
      message: 'Error invalidating balance cache'
    });
  }
};

const balanceController = {
  reconcileGroupBalances,
  getBalanceDetails,
  invalidateGroupBalanceCache,
};

export default balanceController;
