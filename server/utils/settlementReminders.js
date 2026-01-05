import Settlement from '../models/Settlement.js';
import User from '../models/User.js';
import Group from '../models/Group.js';
import Notification from '../models/Notification.js';
import { sendEmail } from './emailService.js';
import { sendPushNotification, pushPayloads } from './pushNotifications.js';
import { emitToUser } from './socketManager.js';

// Check for overdue settlements (unpaid for more than 24 hours)
export const checkOverdueSettlements = async () => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Find pending settlements older than 24 hours that haven't had a recent reminder
    const overdueSettlements = await Settlement.find({
      paymentStatus: 'pending',
      createdAt: { $lt: twentyFourHoursAgo },
      $or: [
        { reminderSentAt: { $exists: false } },
        { reminderSentAt: null },
        { reminderSentAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // Don't send more than once per 24 hours
      ]
    })
    .populate('fromUserId', 'name email')
    .populate('toUserId', 'name email')
    .populate('groupId', 'name emailNotifications');

    console.log(`Found ${overdueSettlements.length} overdue settlements`);

    for (const settlement of overdueSettlements) {
      await sendSettlementReminder(settlement);
    }

    return overdueSettlements.length;
  } catch (error) {
    console.error('Error checking overdue settlements:', error);
    throw error;
  }
};

// Send reminder for a specific settlement
const sendSettlementReminder = async (settlement) => {
  try {
    const fromUser = settlement.fromUserId;
    const toUser = settlement.toUserId;
    const group = settlement.groupId;

    if (!fromUser || !toUser || !group) {
      console.error('Missing user or group data for settlement:', settlement._id);
      return;
    }

    const hoursOverdue = Math.floor((Date.now() - new Date(settlement.createdAt).getTime()) / (1000 * 60 * 60));
    const daysOverdue = Math.floor(hoursOverdue / 24);

    // Create in-app notification for the person who owes money
    const notification = new Notification({
      userId: fromUser._id,
      type: 'payment_reminder',
      title: 'Payment Reminder',
      message: `You have an unsettled payment of ₹${settlement.amount.toFixed(2)} to ${toUser.name} in "${group.name}" (${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue)`,
      actionType: 'navigate',
      relatedId: `/group/${group._id}`,
    });
    await notification.save();

    // Emit real-time notification
    emitToUser(fromUser._id.toString(), 'notification', {
      id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      timestamp: notification.timestamp,
    });

    // Send push notification
    try {
      await sendPushNotification(fromUser._id.toString(), {
        title: '⏰ Payment Reminder',
        body: `You owe ₹${settlement.amount.toFixed(2)} to ${toUser.name} - ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue`,
        tag: `reminder-${settlement._id}`,
        data: {
          type: 'payment_reminder',
          groupId: group._id.toString(),
          settlementId: settlement._id.toString(),
        },
      });
    } catch (pushError) {
      console.log('Push notification not sent:', pushError.message);
    }

    // Send email if group has email notifications enabled
    if (group.emailNotifications?.enabled && group.emailNotifications?.onSettlement) {
      try {
        await sendEmail(fromUser.email, 'paymentReminder', {
          recipientName: fromUser.name,
          toName: toUser.name,
          amount: settlement.amount,
          groupName: group.name,
          groupId: group._id,
          daysOverdue,
        });
      } catch (emailError) {
        console.log('Email not sent:', emailError.message);
      }
    }

    // Update settlement reminder tracking
    await Settlement.findByIdAndUpdate(settlement._id, {
      reminderSentAt: new Date(),
      $inc: { reminderCount: 1 },
    });

    console.log(`Sent reminder for settlement ${settlement._id} to ${fromUser.email}`);
  } catch (error) {
    console.error('Error sending settlement reminder:', error);
  }
};

// Start the reminder scheduler (runs every hour)
export const startReminderScheduler = () => {
  console.log('Starting settlement reminder scheduler...');
  
  // Run immediately on startup
  setTimeout(() => {
    checkOverdueSettlements().catch(console.error);
  }, 10000); // Wait 10 seconds after startup
  
  // Then run every hour
  setInterval(() => {
    checkOverdueSettlements().catch(console.error);
  }, 60 * 60 * 1000); // Every hour
};

// Manual trigger for testing or admin use
export const triggerReminderCheck = async () => {
  return await checkOverdueSettlements();
};

export default {
  checkOverdueSettlements,
  startReminderScheduler,
  triggerReminderCheck,
};
