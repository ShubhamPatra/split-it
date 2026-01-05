import Settlement from '../models/Settlement.js';
import Group from '../models/Group.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { validateUpiId, validatePaymentAmount, generateTransactionRef } from '../utils/upiValidation.js';
import { sendPushNotification, pushPayloads } from '../utils/pushNotifications.js';

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
      .populate('fromUserId', 'name email upiId')
      .populate('toUserId', 'name email upiId')
      .sort({ settledAt: -1 });

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

    // Send push notification to the receiver
    try {
      await sendPushNotification(toUserId.toString(), pushPayloads.settlementReceived({
        fromName: payer.name,
        amount: amount,
        groupId: groupId,
        settlementId: settlement._id.toString(),
      }));
    } catch (pushError) {
      console.error('Push notification error:', pushError);
      // Don't fail the request if push fails
    }

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

    await Settlement.findByIdAndDelete(req.params.id);

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

    res.json(updatedSettlement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
