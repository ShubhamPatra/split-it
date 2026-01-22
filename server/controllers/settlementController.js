/**
 * Settlement Controller
 * 
 * Handles settlement creation, confirmation, and cross-group settlements
 */

import Settlement from '../models/Settlement.js';
import RepaymentRequest from '../models/RepaymentRequest.js';
import Group from '../models/Group.js';
import { calculateGroupBalances, invalidateBalanceCache } from '../jobs/balanceService.js';
import {
    calculateCrossGroupBalances,
    calculatePersonBalance,
    distributeSettlementAmount,
    getGroupsWithBalances as getGroupsWithBalancesService,
    invalidateCrossGroupCache,
} from '../jobs/crossGroupBalanceService.js';
// Socket emitter functions are imported dynamically when needed

/**
 * Get all settlements for the current user
 * @route GET /api/settlements
 */
export const getSettlements = async (req, res) => {
    try {
        const userId = req.user._id;

        const settlements = await Settlement.find({
            $or: [{ fromUserId: userId }, { toUserId: userId }],
        })
            .populate('fromUserId', 'name email')
            .populate('toUserId', 'name email')
            .populate('groupId', 'name')
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        res.json(settlements);
    } catch (error) {
        console.error('Error fetching settlements:', error);
        res.status(500).json({ message: 'Failed to fetch settlements', error: error.message });
    }
};

/**
 * Get settlements by group
 * @route GET /api/settlements/group/:groupId
 */
export const getSettlementsByGroup = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        // Verify user is a member of the group
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        if (!group.members.includes(userId)) {
            return res.status(403).json({ message: 'Not authorized to view this group' });
        }

        const settlements = await Settlement.find({ groupId })
            .populate('fromUserId', 'name email')
            .populate('toUserId', 'name email')
            .sort({ createdAt: -1 })
            .lean();

        res.json(settlements);
    } catch (error) {
        console.error('Error fetching group settlements:', error);
        res.status(500).json({ message: 'Failed to fetch settlements', error: error.message });
    }
};

/**
 * Create a new settlement
 * @route POST /api/settlements
 */
export const createSettlement = async (req, res) => {
    try {
        const { groupId, fromUserId, toUserId, amount, paymentMethod, paymentNotes, transactionRef, idempotencyKey } = req.body;
        const currentUserId = req.user._id;

        // Validation
        if (!groupId || !fromUserId || !toUserId || !amount) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        if (amount <= 0) {
            return res.status(400).json({ message: 'Amount must be greater than 0' });
        }

        // Verify group exists and user is a member
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        if (!group.members.includes(currentUserId)) {
            return res.status(403).json({ message: 'Not authorized to create settlement in this group' });
        }

        // Verify both users are members
        if (!group.members.includes(fromUserId) || !group.members.includes(toUserId)) {
            return res.status(400).json({ message: 'Both users must be members of the group' });
        }

        // Check for duplicate settlement (within 1 minute with same amount)
        const oneMinuteAgo = new Date(Date.now() - 60000);
        const duplicateSettlement = await Settlement.findOne({
            groupId,
            fromUserId,
            toUserId,
            amount,
            createdAt: { $gte: oneMinuteAgo },
        });

        if (duplicateSettlement) {
            return res.status(409).json({
                message: 'Duplicate settlement detected. Please wait before creating another identical settlement.',
                existingSettlement: duplicateSettlement,
            });
        }

        // Get current balances to validate
        const balanceResult = await calculateGroupBalances(groupId);
        const fromUserBalance = balanceResult.balances[fromUserId.toString()] || 0;

        // Check if settlement amount exceeds balance (with some tolerance)
        if (fromUserBalance >= 0 && amount > fromUserBalance + 0.01) {
            return res.status(400).json({
                message: 'Settlement amount exceeds balance',
                currentBalance: fromUserBalance,
            });
        }

        // Create settlement
        const settlement = new Settlement({
            groupId,
            fromUserId,
            toUserId,
            amount,
            paymentMethod: paymentMethod || 'cash',
            paymentNotes,
            transactionRef,
            idempotencyKey,
            paymentStatus: 'pending',
            paymentInitiatedAt: new Date(),
        });

        await settlement.save();

        // Populate for response
        await settlement.populate('fromUserId', 'name email');
        await settlement.populate('toUserId', 'name email');
        await settlement.populate('groupId', 'name');

        // Invalidate cache
        invalidateBalanceCache(groupId);

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            const { emitToGroup } = await import('../utils/socketEmitter.js');
            emitToGroup(io, groupId, 'settlement:created', settlement);
        }

        res.status(201).json(settlement);
    } catch (error) {
        console.error('Error creating settlement:', error);
        res.status(500).json({ message: 'Failed to create settlement', error: error.message });
    }
};

/**
 * Update a settlement
 * @route PUT /api/settlements/:id
 */
export const updateSettlement = async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentMethod, paymentNotes, transactionRef } = req.body;
        const userId = req.user._id;

        const settlement = await Settlement.findById(id);
        if (!settlement) {
            return res.status(404).json({ message: 'Settlement not found' });
        }

        // Only the payer can update
        if (settlement.fromUserId.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this settlement' });
        }

        // Update fields
        if (paymentMethod) settlement.paymentMethod = paymentMethod;
        if (paymentNotes !== undefined) settlement.paymentNotes = paymentNotes;
        if (transactionRef !== undefined) settlement.transactionRef = transactionRef;

        await settlement.save();

        await settlement.populate('fromUserId', 'name email');
        await settlement.populate('toUserId', 'name email');
        await settlement.populate('groupId', 'name');

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            const { emitToGroup } = await import('../utils/socketEmitter.js');
            emitToGroup(io, settlement.groupId, 'settlement:updated', settlement);
        }

        res.json(settlement);
    } catch (error) {
        console.error('Error updating settlement:', error);
        res.status(500).json({ message: 'Failed to update settlement', error: error.message });
    }
};

/**
 * Delete a settlement
 * @route DELETE /api/settlements/:id
 */
export const deleteSettlement = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const settlement = await Settlement.findById(id);
        if (!settlement) {
            return res.status(404).json({ message: 'Settlement not found' });
        }

        // Only the payer can delete, and only if not confirmed
        if (settlement.fromUserId.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this settlement' });
        }

        if (settlement.paymentStatus === 'confirmed') {
            return res.status(400).json({ message: 'Cannot delete confirmed settlement' });
        }

        const groupId = settlement.groupId;
        await Settlement.findByIdAndDelete(id);

        // Invalidate cache
        invalidateBalanceCache(groupId);

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            const { emitToGroup } = await import('../utils/socketEmitter.js');
            emitToGroup(io, groupId, 'settlement:deleted', { settlementId: id });
        }

        res.json({ message: 'Settlement deleted successfully' });
    } catch (error) {
        console.error('Error deleting settlement:', error);
        res.status(500).json({ message: 'Failed to delete settlement', error: error.message });
    }
};

/**
 * Confirm payment receipt
 * @route POST /api/settlements/:id/confirm
 */
export const confirmPaymentReceipt = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const settlement = await Settlement.findById(id);
        if (!settlement) {
            return res.status(404).json({ message: 'Settlement not found' });
        }

        // Only the receiver can confirm
        if (settlement.toUserId.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized to confirm this settlement' });
        }

        if (settlement.paymentStatus === 'confirmed') {
            return res.status(400).json({ message: 'Settlement already confirmed' });
        }

        settlement.paymentStatus = 'confirmed';
        settlement.paymentConfirmedAt = new Date();
        await settlement.save();

        await settlement.populate('fromUserId', 'name email');
        await settlement.populate('toUserId', 'name email');
        await settlement.populate('groupId', 'name');

        // Invalidate cache
        invalidateBalanceCache(settlement.groupId);
        if (settlement.isCrossGroup) {
            invalidateCrossGroupCache(settlement.fromUserId);
            invalidateCrossGroupCache(settlement.toUserId);
        }

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            const { emitToGroup } = await import('../utils/socketEmitter.js');
            emitToGroup(io, settlement.groupId, 'settlement:confirmed', settlement);
        }

        res.json(settlement);
    } catch (error) {
        console.error('Error confirming settlement:', error);
        res.status(500).json({ message: 'Failed to confirm settlement', error: error.message });
    }
};

/**
 * Reject payment receipt
 * @route POST /api/settlements/:id/reject
 */
export const rejectPaymentReceipt = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const settlement = await Settlement.findById(id);
        if (!settlement) {
            return res.status(404).json({ message: 'Settlement not found' });
        }

        // Only the receiver can reject
        if (settlement.toUserId.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized to reject this settlement' });
        }

        settlement.paymentStatus = 'failed';
        await settlement.save();

        await settlement.populate('fromUserId', 'name email');
        await settlement.populate('toUserId', 'name email');
        await settlement.populate('groupId', 'name');

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            const { emitToGroup } = await import('../utils/socketEmitter.js');
            emitToGroup(io, settlement.groupId, 'settlement:rejected', settlement);
        }

        res.json(settlement);
    } catch (error) {
        console.error('Error rejecting settlement:', error);
        res.status(500).json({ message: 'Failed to reject settlement', error: error.message });
    }
};

/**
 * Get people with balances (cross-group)
 * @route GET /api/settlements/people
 */
export const getPeopleWithBalances = async (req, res) => {
    try {
        const userId = req.user._id;

        const result = await calculateCrossGroupBalances(userId);

        res.json(result);
    } catch (error) {
        console.error('Error fetching people with balances:', error);
        res.status(500).json({ message: 'Failed to fetch balances', error: error.message });
    }
};

/**
 * Get balance with a specific person
 * @route GET /api/settlements/people/:otherUserId
 */
export const getPersonBalance = async (req, res) => {
    try {
        const { otherUserId } = req.params;
        const userId = req.user._id;

        const result = await calculatePersonBalance(userId, otherUserId);

        res.json(result);
    } catch (error) {
        console.error('Error fetching person balance:', error);
        res.status(500).json({ message: 'Failed to fetch balance', error: error.message });
    }
};

/**
 * Create cross-group settlement
 * @route POST /api/settlements/cross-group
 */
export const createCrossGroupSettlement = async (req, res) => {
    try {
        const { toUserId, amount, paymentMethod, paymentNotes, transactionRef, idempotencyKey, paymentStatus, isReceiverInitiated } = req.body;
        const currentUserId = req.user._id;

        // Validation
        if (!toUserId || !amount) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        if (amount <= 0) {
            return res.status(400).json({ message: 'Amount must be greater than 0' });
        }

        // Determine the actual payer and receiver based on who initiated
        // If receiver initiated (marking as paid), swap the direction
        // because toUserId is actually the payer in this case
        let actualFromUserId, actualToUserId;
        
        if (isReceiverInitiated) {
            // Current user is the receiver marking payment as received
            // toUserId is the person who paid (the debtor)
            actualFromUserId = toUserId;
            actualToUserId = currentUserId;
        } else {
            // Current user is the payer
            // toUserId is the receiver
            actualFromUserId = currentUserId;
            actualToUserId = toUserId;
        }

        // Get distribution plan using the actual payer's perspective
        const distribution = await distributeSettlementAmount(actualFromUserId, actualToUserId, amount);

        if (!distribution || distribution.distributions.length === 0) {
            return res.status(400).json({ message: 'No balances found to settle' });
        }

        // Create settlements for each affected group
        const settlements = [];
        const affectedGroupIds = [];

        for (const dist of distribution.distributions) {
            const settlement = new Settlement({
                groupId: dist.groupId,
                fromUserId: actualFromUserId,
                toUserId: actualToUserId,
                amount: dist.amount,
                paymentMethod: paymentMethod || 'cash',
                paymentNotes,
                transactionRef,
                paymentStatus: paymentStatus || 'pending',
                paymentInitiatedAt: new Date(),
                paymentConfirmedAt: paymentStatus === 'confirmed' ? new Date() : undefined,
                isCrossGroup: true,
                affectedGroups: distribution.distributions.map(d => d.groupId),
                distributionDetails: distribution.distributions.map(d => ({
                    groupId: d.groupId,
                    amount: d.amount,
                    originalBalance: d.originalBalance,
                })),
                crossGroupMetadata: {
                    totalGroupsInvolved: distribution.affectedGroupCount,
                    settlementStrategy: distribution.strategy,
                    isReceiverInitiated: isReceiverInitiated || false,
                },
                // Only set idempotencyKey if provided (to avoid null duplicate key errors)
                ...(idempotencyKey && { idempotencyKey: `${idempotencyKey}-${dist.groupId}` }),
            });

            await settlement.save();
            settlements.push(settlement);
            affectedGroupIds.push(dist.groupId);
        }

        // Populate settlements
        for (const settlement of settlements) {
            await settlement.populate('fromUserId', 'name email');
            await settlement.populate('toUserId', 'name email');
            await settlement.populate('groupId', 'name');
        }

        // Invalidate caches
        affectedGroupIds.forEach(groupId => invalidateBalanceCache(groupId));
        invalidateCrossGroupCache(actualFromUserId);
        invalidateCrossGroupCache(actualToUserId);

        // Emit socket events
        const io = req.app.get('io');
        if (io) {
            const { emitToGroup } = await import('../utils/socketEmitter.js');
            affectedGroupIds.forEach(groupId => {
                emitToGroup(io, groupId, 'settlement:created', settlements.find(s => s.groupId._id.toString() === groupId));
            });
        }

        res.status(201).json({
            settlements,
            distribution,
            totalAmount: amount,
            affectedGroups: distribution.affectedGroupCount,
        });
    } catch (error) {
        console.error('Error creating cross-group settlement:', error);
        res.status(500).json({ message: 'Failed to create settlement', error: error.message });
    }
};

/**
 * Get groups with balances
 * @route GET /api/settlements/groups
 */
export const getGroupsWithBalances = async (req, res) => {
    try {
        const userId = req.user._id;

        const groups = await getGroupsWithBalancesService(userId);

        res.json(groups);
    } catch (error) {
        console.error('Error fetching groups with balances:', error);
        res.status(500).json({ message: 'Failed to fetch groups', error: error.message });
    }
};

/**
 * Get settlement history
 * @route GET /api/settlements/history
 */
export const getSettlementHistory = async (req, res) => {
    try {
        const userId = req.user._id;
        const { limit = 50, skip = 0 } = req.query;

        const settlements = await Settlement.find({
            $or: [{ fromUserId: userId }, { toUserId: userId }],
            paymentStatus: 'confirmed',
        })
            .populate('fromUserId', 'name email')
            .populate('toUserId', 'name email')
            .populate('groupId', 'name')
            .sort({ paymentConfirmedAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .lean();

        const total = await Settlement.countDocuments({
            $or: [{ fromUserId: userId }, { toUserId: userId }],
            paymentStatus: 'confirmed',
        });

        res.json({
            settlements,
            total,
            limit: parseInt(limit),
            skip: parseInt(skip),
        });
    } catch (error) {
        console.error('Error fetching settlement history:', error);
        res.status(500).json({ message: 'Failed to fetch history', error: error.message });
    }
};

/**
 * Create repayment request
 * @route POST /api/settlements/repayment-request
 */
export const createRepaymentRequest = async (req, res) => {
    try {
        const { receiverId, amount, message } = req.body;
        const requesterId = req.user._id;

        // Validation
        if (!receiverId || !amount) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        if (amount <= 0) {
            return res.status(400).json({ message: 'Amount must be greater than 0' });
        }

        if (requesterId.toString() === receiverId.toString()) {
            return res.status(400).json({ message: 'Cannot request payment from yourself' });
        }

        // Check cooldown period
        const canRequest = await RepaymentRequest.checkCooldownPeriod(requesterId, receiverId);
        if (!canRequest) {
            return res.status(429).json({
                message: 'Please wait 24 hours before sending another request to this person',
            });
        }

        // Get balance details
        const personBalance = await calculatePersonBalance(requesterId, receiverId);

        if (personBalance.netBalance <= 0) {
            return res.status(400).json({ message: 'This person does not owe you money' });
        }

        if (amount > personBalance.netBalance) {
            return res.status(400).json({
                message: 'Request amount exceeds balance',
                currentBalance: personBalance.netBalance,
            });
        }

        // Create repayment request
        const request = new RepaymentRequest({
            requesterId,
            receiverId,
            amount,
            message,
            relatedGroups: personBalance.groupBreakdown.map(g => g.groupId),
            groupBreakdown: personBalance.groupBreakdown.map(g => ({
                groupId: g.groupId,
                amount: g.balance,
                originalBalance: g.balance,
            })),
        });

        await request.save();

        await request.populate('requesterId', 'name email');
        await request.populate('receiverId', 'name email');

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            const { emitToUser } = await import('../utils/socketEmitter.js');
            emitToUser(io, receiverId, 'repayment:request', request);
        }

        res.status(201).json(request);
    } catch (error) {
        console.error('Error creating repayment request:', error);
        res.status(500).json({ message: 'Failed to create request', error: error.message });
    }
};

/**
 * Get repayment request history with a person
 * @route GET /api/settlements/repayment-request/history/:otherUserId
 */
export const getRepaymentRequestHistory = async (req, res) => {
    try {
        const { otherUserId } = req.params;
        const userId = req.user._id;

        const requests = await RepaymentRequest.find({
            $or: [
                { requesterId: userId, receiverId: otherUserId },
                { requesterId: otherUserId, receiverId: userId },
            ],
        })
            .populate('requesterId', 'name email')
            .populate('receiverId', 'name email')
            .sort({ requestedAt: -1 })
            .lean();

        res.json(requests);
    } catch (error) {
        console.error('Error fetching repayment request history:', error);
        res.status(500).json({ message: 'Failed to fetch history', error: error.message });
    }
};

/**
 * Cancel repayment request
 * @route DELETE /api/settlements/repayment-request/:requestId
 */
export const cancelRepaymentRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const userId = req.user._id;

        const request = await RepaymentRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Only requester can cancel
        if (request.requesterId.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized to cancel this request' });
        }

        if (request.status === 'settled' || request.status === 'cancelled') {
            return res.status(400).json({ message: 'Cannot cancel this request' });
        }

        request.status = 'cancelled';
        request.cancelledAt = new Date();
        await request.save();

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            const { emitToUser } = await import('../utils/socketEmitter.js');
            emitToUser(io, request.receiverId, 'repayment:cancelled', request);
        }

        res.json({ message: 'Request cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling repayment request:', error);
        res.status(500).json({ message: 'Failed to cancel request', error: error.message });
    }
};

/**
 * Get my repayment requests (sent and received)
 * @route GET /api/settlements/repayment-request/my-requests
 */
export const getMyRepaymentRequests = async (req, res) => {
    try {
        const userId = req.user._id;
        const { type = 'all' } = req.query; // 'sent', 'received', or 'all'

        let query = {};
        if (type === 'sent') {
            query.requesterId = userId;
        } else if (type === 'received') {
            query.receiverId = userId;
        } else {
            query.$or = [{ requesterId: userId }, { receiverId: userId }];
        }

        const requests = await RepaymentRequest.find(query)
            .populate('requesterId', 'name email')
            .populate('receiverId', 'name email')
            .sort({ requestedAt: -1 })
            .lean();

        res.json(requests);
    } catch (error) {
        console.error('Error fetching repayment requests:', error);
        res.status(500).json({ message: 'Failed to fetch requests', error: error.message });
    }
};

/**
 * Update repayment request status
 * @route PATCH /api/settlements/repayment-request/:requestId/status
 */
export const updateRepaymentRequestStatus = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { status, settledAmount } = req.body;
        const userId = req.user._id;

        const request = await RepaymentRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Only receiver can update status
        if (request.receiverId.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this request' });
        }

        if (status) {
            request.status = status;
        }

        if (settledAmount !== undefined) {
            await request.updateStatus(settledAmount);
        }

        await request.save();

        await request.populate('requesterId', 'name email');
        await request.populate('receiverId', 'name email');

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
            const { emitToUser } = await import('../utils/socketEmitter.js');
            emitToUser(io, request.requesterId, 'repayment:updated', request);
        }

        res.json(request);
    } catch (error) {
        console.error('Error updating repayment request:', error);
        res.status(500).json({ message: 'Failed to update request', error: error.message });
    }
};
