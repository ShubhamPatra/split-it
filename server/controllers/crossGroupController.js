import { getCrossGroupBalances, invalidateCrossGroupCache } from '../jobs/crossGroupBalanceService.js';
import Settlement from '../models/Settlement.js';
import Group from '../models/Group.js';
import Notification from '../models/Notification.js';
import { createAuditLog } from '../middleware/auditMiddleware.js';
import { validateSettlementParticipants, validateSettlementAction } from '../utils/settlementHelpers.js';

// @desc    Get cross-group balances for current user
// @route   GET /api/cross-group/balances
// @access  Private
export const getCrossGroupBalancesForUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const { refresh } = req.query;

    const forceRefresh = refresh === 'true';

    // Invalidate cache first
    invalidateCrossGroupCache(userId);

    const balances = await getCrossGroupBalances(userId, forceRefresh);

    res.json(balances);
  } catch (error) {
    console.error('Get cross-group balances error:', error);
    res.status(500).json({
      message: 'Error calculating cross-group balances',
      error: error.message,
    });
  }
};

// @desc    Get person-to-person balance breakdown
// @route   GET /api/cross-group/person/:personId
// @access  Private
export const getPersonBalance = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { personId } = req.params;
    const { refresh } = req.query;

    const forceRefresh = refresh === 'true';

    const balances = await getCrossGroupBalances(userId, forceRefresh);

    const balance = balances.balances[personId] || 0;
    const person = balances.people[personId];
    const breakdown = balances.groupBreakdown[personId] || [];

    if (!person) {
      return res.status(404).json({ message: 'Person not found in your groups' });
    }

    res.json({
      person,
      balance,
      breakdown,
      calculatedAt: balances.calculatedAt,
    });
  } catch (error) {
    console.error('Get person balance error:', error);
    res.status(500).json({
      message: 'Error getting person balance',
      error: error.message,
    });
  }
};

// @desc    Create cross-group settlement
// @route   POST /api/cross-group/settlements
// @access  Private
export const createCrossGroupSettlement = async (req, res) => {
  try {
    const fromUserId = req.user._id;
    const {
      toUserId,
      amount,
      currency = 'INR',
      paymentMethod = 'cash',
      paymentNotes,
      transactionRef,
      affectedGroups, // Array of group IDs
      groupBreakdown, // Optional: breakdown per group
    } = req.body;

    // Validation
    if (!toUserId || !amount) {
      return res.status(400).json({ message: 'To user and amount are required' });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }

    if (fromUserId.toString() === toUserId) {
      return res.status(400).json({ message: 'Cannot settle with yourself' });
    }

    // Get cross-group balances to verify
    const balances = await getCrossGroupBalances(fromUserId);
    const currentBalance = balances.balances[toUserId] || 0;

    // Determine direction
    let actualFromUser, actualToUser;
    if (currentBalance < 0) {
      // I owe them
      actualFromUser = fromUserId;
      actualToUser = toUserId;
    } else if (currentBalance > 0) {
      // They owe me (I'm receiving)
      actualFromUser = toUserId;
      actualToUser = fromUserId;
    } else {
      return res.status(400).json({ message: 'No balance exists with this person' });
    }

    // Get affected groups (from breakdown if not provided)
    let groups = affectedGroups;
    let breakdown = groupBreakdown;

    if (!groups || groups.length === 0) {
      const balanceBreakdown = balances.groupBreakdown[toUserId] || [];
      groups = balanceBreakdown.map(b => b.groupId);
    }

    if (groups.length === 0) {
      return res.status(400).json({ message: 'No shared groups found' });
    }

    // Verify all groups exist and both users are members
    const sharedGroups = await Group.find({
      _id: { $in: groups },
      members: { $all: [actualFromUser, actualToUser] },
    }).select('_id name budget');

    if (sharedGroups.length === 0) {
      return res.status(400).json({ message: 'Users do not share any of the specified groups' });
    }

    // Edge case: Some groups may have been deleted or user removed
    if (sharedGroups.length < groups.length) {
      // Filter to only include valid groups
      groups = sharedGroups.map(g => g._id);

      // Update breakdown to only include valid groups
      if (breakdown && breakdown.length > 0) {
        const validGroupIds = groups.map(id => id.toString());
        breakdown = breakdown.filter(b => validGroupIds.includes(b.groupId.toString()));
      }
    }

    // Edge case: Check for currency mismatches
    const currencies = sharedGroups
      .map(g => g.budget?.currency || 'INR')
      .filter((v, i, a) => a.indexOf(v) === i); // unique currencies

    if (currencies.length > 1) {
      return res.status(400).json({
        message: 'Cannot create cross-group settlement with mixed currencies',
        currencies,
        hint: 'Please settle within each currency group separately',
      });
    }

    // Use the group's currency if not specified
    let settlementCurrency = currency;
    if (!settlementCurrency || settlementCurrency === 'INR') {
      settlementCurrency = currencies[0] || 'INR';
    }

    // Validate participants and groups (edge case handling)
    const validation = await validateSettlementParticipants({
      fromUserId: actualFromUser,
      toUserId: actualToUser,
      groupIds: groups,
    });

    // Log warnings but allow settlement creation
    if (validation.warnings.length > 0) {
      console.warn('[Cross-Group Settlement] Warnings:', validation.warnings);
    }

    // Block if there are critical issues
    if (!validation.isValid) {
      return res.status(400).json({
        message: 'Cannot create settlement due to validation errors',
        issues: validation.issues,
      });
    }

    // Create breakdown if not provided
    if (!breakdown || breakdown.length === 0) {
      const personBreakdown = balances.groupBreakdown[toUserId] || [];
      breakdown = personBreakdown.map(b => ({
        groupId: b.groupId,
        amount: Math.abs(b.balance),
      }));
    }

    // Create cross-group settlement
    const settlement = await Settlement.createCrossGroupSettlement({
      fromUserId: actualFromUser,
      toUserId: actualToUser,
      amount,
      currency: settlementCurrency,
      paymentMethod,
      paymentNotes,
      transactionRef,
      affectedGroups: groups,
      groupBreakdown: breakdown,
      primaryGroupId: groups[0], // Use first group as primary
    });

    // Populate user details
    await settlement.populate([
      { path: 'fromUserId', select: 'name email' },
      { path: 'toUserId', select: 'name email' },
      { path: 'groupId', select: 'name' },
    ]);

    // Invalidate cache for both users
    invalidateCrossGroupCache(actualFromUser);
    invalidateCrossGroupCache(actualToUser);

    // Create notification for receiver
    try {
      const { notifyUser, NotificationTypes } = await import('../jobs/notificationService.js');
      const fromUser = await import('../models/User.js').then(m => m.default.findById(actualFromUser).select('name'));

      await notifyUser(actualToUser.toString(), {
        type: NotificationTypes.SETTLEMENT_CREATED,
        title: 'Cross-Group Settlement',
        message: `${fromUser.name} recorded a ₹${amount} cross-group settlement. Please confirm receipt.`,
        data: {
          actionType: 'confirm_payment',
          settlementId: settlement._id,
          fromUserId: actualFromUser,
          amount,
          isCrossGroup: true,
          affectedGroups: groups,
        },
      });
    } catch (notifError) {
      console.error('Failed to send notification:', notifError);
      // Don't fail the request if notification fails
    }

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      try {
        // Emit to both users
        io.to(`user:${actualFromUser}`).emit('settlement:created', settlement);
        io.to(`user:${actualToUser}`).emit('settlement:created', settlement);

        // Emit balance update to both users
        io.to(`user:${actualFromUser}`).emit('balance:invalidate', { isCrossGroup: true });
        io.to(`user:${actualToUser}`).emit('balance:invalidate', { isCrossGroup: true });
      } catch (socketError) {
        console.error('Failed to emit socket events:', socketError);
        // Don't fail the request if socket emission fails
      }
    }

    // Audit log
    await createAuditLog({
      action: 'settlement.create',
      entityType: 'Settlement',
      entityId: settlement._id,
      userId: req.user._id,
      relatedEntities: {
        groupId: settlement.groupId,
        settlementId: settlement._id,
      },
      changes: {
        after: {
          amount: settlement.amount,
          isCrossGroup: true,
          affectedGroups: groups.length,
        },
      },
      notes: `Cross-group settlement across ${groups.length} groups`,
      req,
    });

    res.status(201).json({
      success: true,
      settlement,
      message: 'Cross-group settlement created successfully',
    });
  } catch (error) {
    console.error('Create cross-group settlement error:', error);
    res.status(500).json({
      message: 'Error creating cross-group settlement',
      error: error.message,
    });
  }
};

// @desc    Get cross-group settlements for current user
// @route   GET /api/cross-group/settlements
// @access  Private
export const getCrossGroupSettlements = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, limit = 50, skip = 0 } = req.query;

    const query = {
      isCrossGroup: true,
      $or: [
        { fromUserId: userId },
        { toUserId: userId },
      ],
    };

    if (status) {
      query.paymentStatus = status;
    }

    const settlements = await Settlement.find(query)
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email')
      .populate('groupId', 'name')
      .populate('affectedGroups', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await Settlement.countDocuments(query);

    res.json({
      settlements,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: total > parseInt(skip) + parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Get cross-group settlements error:', error);
    res.status(500).json({
      message: 'Error fetching cross-group settlements',
      error: error.message,
    });
  }
};

// @desc    Confirm cross-group settlement receipt
// @route   POST /api/cross-group/settlements/:id/confirm
// @access  Private
export const confirmCrossGroupSettlement = async (req, res) => {
  try {
    const settlement = await Settlement.findById(req.params.id)
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email')
      .populate('groupId', 'name')
      .populate('affectedGroups', 'name');

    if (!settlement) {
      return res.status(404).json({ message: 'Settlement not found' });
    }

    if (!settlement.isCrossGroup) {
      return res.status(400).json({ message: 'This is not a cross-group settlement' });
    }

    // Only the receiver can confirm payment receipt
    if (settlement.toUserId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the payment receiver can confirm receipt' });
    }

    // Check if already confirmed
    if (settlement.paymentStatus === 'confirmed') {
      return res.status(400).json({ message: 'Payment already confirmed' });
    }

    // Validate settlement action (edge case handling)
    const validation = await validateSettlementAction(settlement, req.user._id);

    // Log warnings but allow confirmation
    if (validation.warnings.length > 0) {
      console.warn('[Settlement Confirmation] Warnings:', validation.warnings);

      // Add warnings to settlement notes
      const warningText = validation.warnings.join('; ');
      settlement.paymentNotes = (settlement.paymentNotes || '') +
        ` [Warnings: ${warningText}]`;
    }

    // Block if there are critical issues
    if (!validation.canProceed) {
      return res.status(400).json({
        message: 'Cannot confirm settlement',
        issues: validation.issues,
      });
    }

    // Update settlement status
    settlement.paymentStatus = 'confirmed';
    settlement.paymentConfirmedAt = new Date();
    await settlement.save();

    // Invalidate cache for both users
    invalidateCrossGroupCache(settlement.fromUserId._id);
    invalidateCrossGroupCache(settlement.toUserId._id);

    // Notify the payer that payment was confirmed
    try {
      const { notifyUser, NotificationTypes } = await import('../jobs/notificationService.js');

      await notifyUser(settlement.fromUserId._id.toString(), {
        type: NotificationTypes.SETTLEMENT_CONFIRMED,
        title: 'Payment Confirmed',
        message: `${settlement.toUserId.name} confirmed receiving ₹${settlement.amount} cross-group payment.`,
        data: {
          actionType: 'none',
          settlementId: settlement._id,
          toUserId: settlement.toUserId._id,
          amount: settlement.amount,
          isCrossGroup: true,
        },
      });
    } catch (notifError) {
      console.error('Failed to send confirmation notification:', notifError);
    }

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      try {
        // Emit to both users
        io.to(`user:${settlement.fromUserId._id}`).emit('settlement:updated', settlement);
        io.to(`user:${settlement.toUserId._id}`).emit('settlement:updated', settlement);

        // Emit balance update to both users
        io.to(`user:${settlement.fromUserId._id}`).emit('balance:invalidate', { isCrossGroup: true });
        io.to(`user:${settlement.toUserId._id}`).emit('balance:invalidate', { isCrossGroup: true });
      } catch (socketError) {
        console.error('Failed to emit socket events:', socketError);
      }
    }

    // Audit log
    await createAuditLog({
      action: 'settlement.confirm',
      entityType: 'Settlement',
      entityId: settlement._id,
      userId: req.user._id,
      relatedEntities: {
        settlementId: settlement._id,
      },
      changes: {
        before: { paymentStatus: 'pending' },
        after: { paymentStatus: 'confirmed' },
      },
      notes: 'Cross-group settlement confirmed',
      req,
    });

    res.json({
      success: true,
      settlement,
      message: 'Cross-group settlement confirmed successfully',
    });
  } catch (error) {
    console.error('Confirm cross-group settlement error:', error);
    res.status(500).json({
      message: 'Error confirming cross-group settlement',
      error: error.message,
    });
  }
};

// @desc    Reject cross-group settlement receipt
// @route   POST /api/cross-group/settlements/:id/reject
// @access  Private
export const rejectCrossGroupSettlement = async (req, res) => {
  try {
    const { reason } = req.body;

    const settlement = await Settlement.findById(req.params.id)
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email')
      .populate('groupId', 'name')
      .populate('affectedGroups', 'name');

    if (!settlement) {
      return res.status(404).json({ message: 'Settlement not found' });
    }

    if (!settlement.isCrossGroup) {
      return res.status(400).json({ message: 'This is not a cross-group settlement' });
    }

    // Only the receiver can reject payment receipt
    if (settlement.toUserId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the payment receiver can reject receipt' });
    }

    // Check if already confirmed
    if (settlement.paymentStatus === 'confirmed') {
      return res.status(400).json({ message: 'Cannot reject an already confirmed payment' });
    }

    // Check if already rejected/failed
    if (settlement.paymentStatus === 'failed') {
      return res.status(400).json({ message: 'Payment already marked as not received' });
    }

    // Update settlement status to failed
    settlement.paymentStatus = 'failed';
    settlement.paymentNotes = reason || 'Payment not received by recipient';
    await settlement.save();

    // Notify the payer that payment was rejected
    try {
      const { notifyUser } = await import('../jobs/notificationService.js');

      await notifyUser(settlement.fromUserId._id.toString(), {
        type: 'warning',
        title: 'Payment Not Received',
        message: `${settlement.toUserId.name} reported not receiving the ₹${settlement.amount} cross-group payment.`,
        data: {
          actionType: 'none',
          settlementId: settlement._id,
          toUserId: settlement.toUserId._id,
          amount: settlement.amount,
          isCrossGroup: true,
          reason: reason || 'Payment not received',
        },
      });
    } catch (notifError) {
      console.error('Failed to send rejection notification:', notifError);
    }

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      try {
        // Emit to both users
        io.to(`user:${settlement.fromUserId._id}`).emit('settlement:updated', settlement);
        io.to(`user:${settlement.toUserId._id}`).emit('settlement:updated', settlement);
      } catch (socketError) {
        console.error('Failed to emit socket events:', socketError);
      }
    }

    // Audit log
    await createAuditLog({
      action: 'settlement.reject',
      entityType: 'Settlement',
      entityId: settlement._id,
      userId: req.user._id,
      relatedEntities: {
        settlementId: settlement._id,
      },
      changes: {
        before: { paymentStatus: 'pending' },
        after: { paymentStatus: 'failed', reason },
      },
      notes: 'Cross-group settlement rejected',
      req,
    });

    res.json({
      success: true,
      settlement,
      message: 'Cross-group settlement marked as not received',
    });
  } catch (error) {
    console.error('Reject cross-group settlement error:', error);
    res.status(500).json({
      message: 'Error rejecting cross-group settlement',
      error: error.message,
    });
  }
};


/**
 * Send payment reminder for cross-group settlement
 * POST /api/cross-group/settlements/:id/remind
 */
export const sendCrossGroupPaymentReminder = async (req, res) => {
  try {
    const settlement = await Settlement.findById(req.params.id)
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email')
      .populate('affectedGroups', 'name');

    if (!settlement) {
      return res.status(404).json({ message: 'Settlement not found' });
    }

    // Verify it's a cross-group settlement
    if (!settlement.isCrossGroup) {
      return res.status(400).json({ message: 'Not a cross-group settlement' });
    }

    // Only the receiver can send reminders
    if (settlement.toUserId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the payment receiver can send reminders' });
    }

    // Can only remind for pending settlements
    if (settlement.paymentStatus !== 'pending') {
      return res.status(400).json({ message: 'Can only send reminders for pending settlements' });
    }

    // Rate limiting: Check if a reminder was sent in the last 24 hours
    const lastReminder = settlement.lastReminderSentAt;
    if (lastReminder) {
      const hoursSinceLastReminder = (Date.now() - new Date(lastReminder).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastReminder < 24) {
        const hoursRemaining = Math.ceil(24 - hoursSinceLastReminder);
        return res.status(429).json({
          message: `Please wait ${hoursRemaining} hour(s) before sending another reminder`,
          hoursRemaining
        });
      }
    }

    // Update last reminder timestamp
    settlement.lastReminderSentAt = new Date();
    await settlement.save();

    // Get group names for notification
    const groupNames = settlement.affectedGroups?.map(g => g.name).join(', ') || 'multiple groups';

    // Send in-app notification to payer
    await Notification.create({
      userId: settlement.fromUserId._id,
      type: 'info',
      title: 'Cross-Group Payment Reminder',
      message: `${settlement.toUserId.name} is waiting for your ₹${settlement.amount} cross-group payment (${groupNames}).`,
      actionType: 'view_settlement',
      relatedId: settlement._id,
    });

    // Send email notification
    try {
      const { sendPreferenceEmail } = await import('../utils/emailUtils.js');
      await sendPreferenceEmail(
        settlement.fromUserId.email,
        'Cross-Group Payment Reminder',
        `${settlement.toUserId.name} is waiting for your cross-group payment of ₹${settlement.amount} across ${groupNames}. Please complete the payment to settle your balance.`
      );
    } catch (emailError) {
      console.error('Error sending reminder email:', emailError);
    }

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      try {
        const { emitToUser } = await import('../utils/socketEmitter.js');
        emitToUser(io, settlement.fromUserId._id.toString(), 'notification:new', {
          type: 'info',
          title: 'Cross-Group Payment Reminder',
          message: `${settlement.toUserId.name} is waiting for your payment`,
        });
      } catch (socketError) {
        console.error('Error emitting socket event for reminder:', socketError);
      }
    }

    res.json({
      message: 'Reminder sent successfully',
      settlement: {
        id: settlement._id,
        lastReminderSentAt: settlement.lastReminderSentAt,
      }
    });
  } catch (error) {
    console.error('[Cross-Group] Error sending payment reminder:', error);
    res.status(500).json({ message: error.message });
  }
};

const crossGroupController = {
  getCrossGroupBalancesForUser,
  getPersonBalance,
  createCrossGroupSettlement,
  getCrossGroupSettlements,
  confirmCrossGroupSettlement,
  rejectCrossGroupSettlement,
  sendCrossGroupPaymentReminder,
};

export default crossGroupController;
