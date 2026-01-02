/**
 * UPI Payment Notification Helper
 */
import Notification from '../models/Notification.js';

/**
 * Create payment initiated notification
 */
export const notifyPaymentInitiated = async ({ payerId, receiverId, amount, transactionRef, paymentMethod = 'upi' }) => {
  try {
    // Notify receiver
    await Notification.create({
      userId: receiverId,
      type: 'info',
      title: `UPI Payment Incoming`,
      message: `A payment of ₹${amount.toLocaleString()} has been initiated. Transaction: ${transactionRef}`,
      actionType: 'confirm_payment',
      relatedId: transactionRef,
      actionCompleted: false,
    });

    // Notify payer (confirmation)
    await Notification.create({
      userId: payerId,
      type: 'success',
      title: 'Payment Initiated',
      message: `Your UPI payment of ₹${amount.toLocaleString()} has been initiated. Ref: ${transactionRef}`,
      actionType: 'none',
    });

    return { success: true };
  } catch (error) {
    console.error('Error creating payment initiated notifications:', error);
    return { success: false, error };
  }
};

/**
 * Create payment confirmation reminder
 */
export const notifyPaymentReminder = async ({ receiverId, payerName, amount, transactionRef, daysSinceInitiation }) => {
  try {
    await Notification.create({
      userId: receiverId,
      type: 'warning',
      title: 'Payment Confirmation Pending',
      message: `${payerName} sent you ₹${amount.toLocaleString()} ${daysSinceInitiation} day${daysSinceInitiation > 1 ? 's' : ''} ago. Please confirm if received. Ref: ${transactionRef}`,
      actionType: 'confirm_payment',
      relatedId: transactionRef,
      actionCompleted: false,
    });

    return { success: true };
  } catch (error) {
    console.error('Error creating payment reminder:', error);
    return { success: false, error };
  }
};

/**
 * Create payment confirmed notification
 */
export const notifyPaymentConfirmed = async ({ payerId, receiverName, amount, transactionRef }) => {
  try {
    await Notification.create({
      userId: payerId,
      type: 'success',
      title: 'Payment Confirmed',
      message: `${receiverName} confirmed receiving ₹${amount.toLocaleString()}. Ref: ${transactionRef}`,
      actionType: 'none',
    });

    return { success: true };
  } catch (error) {
    console.error('Error creating payment confirmed notification:', error);
    return { success: false, error };
  }
};

/**
 * Create UPI ID setup reminder
 */
export const notifyUpiSetupRequired = async ({ userId, context = 'receive payments' }) => {
  try {
    await Notification.create({
      userId,
      type: 'info',
      title: 'Set Up UPI for Quick Payments',
      message: `Add your UPI ID to ${context} quickly and easily. Go to Profile → UPI Settings.`,
      actionType: 'setup_upi',
      actionCompleted: false,
    });

    return { success: true };
  } catch (error) {
    console.error('Error creating UPI setup notification:', error);
    return { success: false, error };
  }
};

/**
 * Create payment failed notification
 */
export const notifyPaymentFailed = async ({ userId, amount, reason, transactionRef }) => {
  try {
    await Notification.create({
      userId,
      type: 'error',
      title: 'Payment Failed',
      message: `Payment of ₹${amount.toLocaleString()} could not be processed. ${reason}. Ref: ${transactionRef}`,
      actionType: 'retry_payment',
      relatedId: transactionRef,
      actionCompleted: false,
    });

    return { success: true };
  } catch (error) {
    console.error('Error creating payment failed notification:', error);
    return { success: false, error };
  }
};

/**
 * Batch send payment reminders for pending settlements
 */
export const sendPendingPaymentReminders = async () => {
  try {
    const Settlement = (await import('../models/Settlement.js')).default;

    // Find settlements pending for more than 2 days
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const pendingSettlements = await Settlement.find({
      paymentStatus: 'pending',
      paymentInitiatedAt: { $lt: twoDaysAgo },
    })
      .populate('fromUserId', 'name')
      .populate('toUserId', 'name');

    const notifications = [];
    for (const settlement of pendingSettlements) {
      const daysSince = Math.floor(
        (new Date() - new Date(settlement.paymentInitiatedAt)) / (1000 * 60 * 60 * 24)
      );

      const result = await notifyPaymentReminder({
        receiverId: settlement.toUserId._id,
        payerName: settlement.fromUserId.name,
        amount: settlement.amount,
        transactionRef: settlement.transactionRef,
        daysSinceInitiation: daysSince,
      });

      if (result.success) notifications.push(settlement._id);
    }

    return { success: true, count: notifications.length };
  } catch (error) {
    console.error('Error sending payment reminders:', error);
    return { success: false, error };
  }
};

const paymentNotifications = {
  notifyPaymentInitiated,
  notifyPaymentReminder,
  notifyPaymentConfirmed,
  notifyUpiSetupRequired,
  notifyPaymentFailed,
  sendPendingPaymentReminders,
};

export default paymentNotifications;
