import Settlement from '../models/Settlement.js';
import Group from '../models/Group.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import { validateUpiId, validatePaymentAmount, generateTransactionRef } from '../utils/upiValidation.js';
import { sendPreferenceEmail } from '../utils/emailUtils.js';
import { invalidateBalanceCache } from '../jobs/balanceService.js';

// @desc    Get all settlements for user's groups
// @route   GET /api/settlements
// @access  Private
export const getSettlements = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id });
    const groupIds = groups.map(g => g._id);

    const settlements = await Settlement.find({ groupId: { $in: groupIds } })
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email')
      .populate('groupId', 'name')
      .sort({ settledAt: -1 });

    res.json(settlements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get settlements by group
// @route   GET /api/settlements/group/:groupId
// @access  Private
export const getSettlementsByGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if user is a member
    if (!group.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const settlements = await Settlement.find({ groupId: req.params.groupId })
      .populate('fromUserId', 'name email')  // Remove upiId from populate
      .populate('toUserId', 'name email')
      .sort({ settledAt: -1 })
      .lean()
      .limit(50);

    res.json(settlements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new settlement
// @route   POST /api/settlements
// @access  Private
export const createSettlement = async (req, res) => {
  try {
    const { groupId, fromUserId, toUserId, amount, currency, settledAt, paymentMethod, paymentStatus, transactionRef } = req.body;

    // Validate amount
    const amountValidation = validatePaymentAmount(amount);
    if (!amountValidation.isValid) {
      return res.status(400).json({ message: amountValidation.error });
    }

    // Verify group exists and user is a member
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Validate both parties are group members
    const memberStrings = group.members.map(m => m.toString());
    if (!memberStrings.includes(fromUserId.toString())) {
      return res.status(400).json({ message: 'Payer (fromUser) must be a group member' });
    }
    if (!memberStrings.includes(toUserId.toString())) {
      return res.status(400).json({ message: 'Receiver (toUser) must be a group member' });
    }

    // Caller must be a participant (fromUser or toUser) or group admin
    const isFromUser = fromUserId.toString() === req.user._id.toString();
    const isToUser = toUserId.toString() === req.user._id.toString();
    const isAdmin = group.createdBy.toString() === req.user._id.toString();
    if (!isFromUser && !isToUser && !isAdmin) {
      return res.status(403).json({ message: 'Only settlement participants or group admin can create this settlement' });
    }

    // If payment method is UPI, validate receiver's UPI ID
    if (paymentMethod === 'upi') {
      const receiver = await User.findById(toUserId);
      if (!receiver) {
        return res.status(404).json({ message: 'Receiver not found' });
      }

      if (!receiver.upiId) {
        return res.status(400).json({ message: 'Receiver has not set up UPI ID' });
      }

      const upiValidation = validateUpiId(receiver.upiId);
      if (!upiValidation.isValid) {
        return res.status(400).json({
          message: 'Receiver has invalid UPI ID',
          error: upiValidation.error
        });
      }
    }

    // Generate transaction reference if not provided
    const finalTransactionRef = transactionRef || generateTransactionRef();

    const settlement = await Settlement.create({
      groupId,
      fromUserId,
      toUserId,
      amount,
      currency: currency || 'INR',
      settledAt: settledAt || new Date().toISOString().split('T')[0],
      paymentMethod: paymentMethod || 'cash',
      paymentStatus: paymentStatus || 'pending',
      transactionRef: finalTransactionRef,
      paymentInitiatedAt: paymentMethod === 'upi' ? new Date() : undefined,
    });

    const populatedSettlement = await Settlement.findById(settlement._id)
      .populate('fromUserId', 'name email upiId')
      .populate('toUserId', 'name email upiId')
      .populate('groupId', 'name');

    // Create notification for the receiver
    const payer = await User.findById(fromUserId);
    await Notification.create({
      userId: toUserId,
      type: 'info',
      title: paymentMethod === 'upi' ? 'UPI Payment Received' : 'Payment Received',
      message: `${payer.name} has sent you ₹${amount} payment${paymentMethod === 'upi' ? ' via UPI' : ''}. Please confirm once you receive it.`,
      actionType: 'confirm_payment',
      relatedId: settlement._id,
      actionCompleted: false,
    });

    // Send settlement confirmation emails to both parties
    const receiver = await User.findById(toUserId);

    // Email to payer
    await sendPreferenceEmail(fromUserId, 'settlementConfirmation', {
      to: payer.email,
      template: 'settlementConfirmation',
      data: {
        payerName: payer.name,
        receiverName: receiver.name,
        amount,
        groupName: group.name,
        transactionRef: finalTransactionRef,
        paymentMethod,
        isReceiver: false,
        currency: currency || 'INR',
      },
    });

    // Email to receiver
    await sendPreferenceEmail(toUserId, 'settlementConfirmation', {
      to: receiver.email,
      template: 'settlementConfirmation',
      data: {
        payerName: payer.name,
        receiverName: receiver.name,
        amount,
        groupName: group.name,
        transactionRef: finalTransactionRef,
        paymentMethod,
        isReceiver: true,
        currency: currency || 'INR',
      },
    });

    // Emit socket event to group members
    const io = req.app.get('io');
    if (io) {
      const { emitToGroup } = await import('../utils/socketEmitter.js');
      emitToGroup(io, groupId, 'settlement:created', populatedSettlement);

      // Create system message for chat
      try {
        const systemMessage = await Message.create({
          groupId,
          senderId: fromUserId,
          content: `${payer.name} paid ${receiver.name} ${currency || 'INR'}${amount}${paymentMethod === 'upi' ? ' via UPI' : ''}`,
          type: 'system',
          metadata: {
            settlementId: settlement._id,
            action: 'created',
          },
          readBy: [fromUserId, toUserId],
        });

        const populatedSystemMessage = await Message.findById(systemMessage._id)
          .populate('senderId', 'name email')
          .lean();

        emitToGroup(io, groupId, 'chat:new', populatedSystemMessage);
      } catch (msgError) {
        console.error('Error creating system message for settlement:', msgError);
        // Don't fail the request if message creation fails
      }
    }

    // Invalidate balance cache for this group
    invalidateBalanceCache(groupId);

    res.status(201).json(populatedSettlement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update settlement
// @route   PUT /api/settlements/:id
// @access  Private
export const updateSettlement = async (req, res) => {
  try {
    const settlement = await Settlement.findById(req.params.id).populate('groupId');

    if (!settlement) {
      return res.status(404).json({ message: 'Settlement not found' });
    }

    // Check if user is a group member
    if (!settlement.groupId.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Only participants (fromUser or toUser) or group admin can modify
    const isFromUser = settlement.fromUserId.toString() === req.user._id.toString();
    const isToUser = settlement.toUserId.toString() === req.user._id.toString();
    const isAdmin = settlement.groupId.createdBy.toString() === req.user._id.toString();
    if (!isFromUser && !isToUser && !isAdmin) {
      return res.status(403).json({ message: 'Only settlement participants or group admin can modify this settlement' });
    }

    const { amount, currency, settledAt, paymentMethod, paymentStatus } = req.body;

    if (amount !== undefined) settlement.amount = amount;
    if (currency !== undefined) settlement.currency = currency;
    if (settledAt !== undefined) settlement.settledAt = settledAt;
    if (paymentMethod !== undefined) settlement.paymentMethod = paymentMethod;
    if (paymentStatus !== undefined) settlement.paymentStatus = paymentStatus;

    await settlement.save();

    const updatedSettlement = await Settlement.findById(settlement._id)
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email')
      .populate('groupId', 'name');

    // Emit socket event to group members
    const io = req.app.get('io');
    if (io) {
      const { emitToGroup } = await import('../utils/socketEmitter.js');
      emitToGroup(io, settlement.groupId._id.toString(), 'settlement:updated', updatedSettlement);
    }

    // Invalidate balance cache for this group
    invalidateBalanceCache(settlement.groupId._id.toString());

    res.json(updatedSettlement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete settlement
// @route   DELETE /api/settlements/:id
// @access  Private
export const deleteSettlement = async (req, res) => {
  try {
    const settlement = await Settlement.findById(req.params.id).populate('groupId');

    if (!settlement) {
      return res.status(404).json({ message: 'Settlement not found' });
    }

    // Check if user is a group member
    if (!settlement.groupId.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Only participants (fromUser or toUser) or group admin can delete
    const isFromUser = settlement.fromUserId.toString() === req.user._id.toString();
    const isToUser = settlement.toUserId.toString() === req.user._id.toString();
    const isAdmin = settlement.groupId.createdBy.toString() === req.user._id.toString();
    if (!isFromUser && !isToUser && !isAdmin) {
      return res.status(403).json({ message: 'Only settlement participants or group admin can delete this settlement' });
    }

    const groupId = settlement.groupId._id.toString();
    await Settlement.findByIdAndDelete(req.params.id);

    // Emit socket event to group members
    const io = req.app.get('io');
    if (io) {
      const { emitToGroup } = await import('../utils/socketEmitter.js');
      emitToGroup(io, groupId, 'settlement:deleted', { settlementId: req.params.id });
    }

    // Invalidate balance cache for this group
    invalidateBalanceCache(groupId);

    res.json({ message: 'Settlement deleted successfully', success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Confirm payment receipt (receiver only)
// @route   POST /api/settlements/:id/confirm
// @access  Private
export const confirmPaymentReceipt = async (req, res) => {
  try {
    const settlement = await Settlement.findById(req.params.id)
      .populate('groupId')
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email');

    if (!settlement) {
      return res.status(404).json({ message: 'Settlement not found' });
    }

    // Only the receiver can confirm payment receipt
    if (settlement.toUserId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the payment receiver can confirm receipt' });
    }

    // Check if already confirmed
    if (settlement.paymentStatus === 'confirmed') {
      return res.status(400).json({ message: 'Payment already confirmed' });
    }

    // Update settlement status
    settlement.paymentStatus = 'confirmed';
    settlement.paymentConfirmedAt = new Date();
    await settlement.save();

    // Mark notification as completed
    await Notification.updateOne(
      { relatedId: settlement._id, actionType: 'confirm_payment', userId: req.user._id },
      { actionCompleted: true, read: true }
    );

    // Notify the payer that payment was confirmed
    await Notification.create({
      userId: settlement.fromUserId._id,
      type: 'success',
      title: 'Payment Confirmed',
      message: `${settlement.toUserId.name} confirmed receiving ₹${settlement.amount} payment.`,
      actionType: 'none',
    });

    const updatedSettlement = await Settlement.findById(settlement._id)
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email')
      .populate('groupId', 'name');

    // Emit socket event to group members for real-time update
    const io = req.app.get('io');
    if (io) {
      const { emitToGroup } = await import('../utils/socketEmitter.js');
      emitToGroup(io, settlement.groupId._id.toString(), 'settlement:updated', updatedSettlement);
    }

    // Send push notification to the payer about confirmation
    try {
      const { sendPushToUser } = await import('../utils/pushNotifier.js');
      await sendPushToUser(settlement.fromUserId._id.toString(), {
        title: 'Payment Confirmed',
        body: `${settlement.toUserId.name} confirmed receiving ₹${settlement.amount} payment.`,
        icon: '/logo192.png',
        data: { url: `/groups/${settlement.groupId._id}` },
      });
    } catch (pushError) {
      console.error('Push notification failed:', pushError);
      // Don't fail the request if push fails
    }

    // Invalidate balance cache for this group
    invalidateBalanceCache(settlement.groupId._id.toString());

    res.json(updatedSettlement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
