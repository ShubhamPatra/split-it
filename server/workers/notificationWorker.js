/**
 * Notification Worker
 * 
 * Processes notification jobs from the notification queue.
 * Creates in-app notifications and emits real-time socket events.
 */

import { notificationQueue } from '../config/queue.js';
import Notification from '../models/Notification.js';

// Reference to Socket.IO instance (set during initialization)
let ioInstance = null;

// Metrics tracking
let processedCount = 0;
let failedCount = 0;
let totalProcessingTime = 0;

/**
 * Initialize the notification worker processor
 * @param {Object} io - Socket.IO server instance
 */
export const initNotificationWorker = (io) => {
  ioInstance = io;

  // Process with concurrency of 8 to handle chat/push notifications under load
  notificationQueue.process(8, async (job) => {
    const startTime = Date.now();
    const { userId, type, title, message, data } = job.data;

    if (!userId || !title || !message) {
      throw new Error('Missing required notification fields: userId, title, message');
    }

    try {
      // Create notification in database
      const notification = await Notification.create({
        userId,
        type: type || 'info',
        title,
        message,
        actionType: data?.actionType || 'none',
        relatedId: data?.groupId || data?.expenseId || data?.settlementId || data?.messageId,
        data: data || null,
      });

      // Emit real-time notification via Socket.IO
      if (ioInstance) {
        ioInstance.to(`user:${userId}`).emit('notification:new', {
          id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          timestamp: notification.timestamp,
          read: notification.read,
          actionType: notification.actionType,
          data,
        });
      }

      // Handle chat message notifications - send push notification if user is offline
      if (data?.actionType === 'chat_message') {
        try {
          const { sendPushToUser } = await import('../utils/pushNotifier.js');
          await sendPushToUser(userId, {
            title: title,
            body: message,
            icon: '/logo192.png',
            badge: '/logo192.png',
            tag: `chat-${data.groupId}`, // Group notifications together
            data: {
              url: `/group/${data.groupId}?tab=chat`,
              groupId: data.groupId,
              messageId: data.messageId,
            },
          });
        } catch (pushError) {
          // Push notification failures shouldn't fail the job
          console.error('Push notification failed for chat message:', pushError.message);
        }
      }

      // Handle expense notifications - send push for new expenses
      if (data?.actionType === 'expense_added' || data?.actionType === 'expense_updated') {
        try {
          const { sendPushToUser } = await import('../utils/pushNotifier.js');
          await sendPushToUser(userId, {
            title: title,
            body: message,
            icon: '/logo192.png',
            badge: '/logo192.png',
            tag: `expense-${data.groupId}`,
            data: {
              url: `/group/${data.groupId}`,
              groupId: data.groupId,
              expenseId: data.expenseId,
            },
          });
        } catch (pushError) {
          console.error('Push notification failed for expense:', pushError.message);
        }
      }

      // Handle settlement notifications - send push for payment requests/confirmations
      if (data?.actionType === 'settlement_created' || data?.actionType === 'settlement_confirmed') {
        try {
          const { sendPushToUser } = await import('../utils/pushNotifier.js');
          await sendPushToUser(userId, {
            title: title,
            body: message,
            icon: '/logo192.png',
            badge: '/logo192.png',
            tag: `settlement-${data.groupId}`,
            requireInteraction: true, // Keep visible until user interacts
            data: {
              url: `/group/${data.groupId}?tab=settlements`,
              groupId: data.groupId,
              settlementId: data.settlementId,
            },
          });
        } catch (pushError) {
          console.error('Push notification failed for settlement:', pushError.message);
        }
      }

      // Handle payment reminders
      if (data?.actionType === 'payment_reminder') {
        try {
          const { sendPushToUser } = await import('../utils/pushNotifier.js');
          await sendPushToUser(userId, {
            title: title,
            body: message,
            icon: '/logo192.png',
            badge: '/logo192.png',
            tag: `reminder-${data.groupId || 'general'}`,
            requireInteraction: true,
            data: {
              url: data.groupId ? `/group/${data.groupId}?tab=settlements` : '/summary',
            },
          });
        } catch (pushError) {
          console.error('Push notification failed for payment reminder:', pushError.message);
        }
      }

      console.log(`Notification created for user ${userId}: ${title}`);

      // Track metrics
      const processingTime = Date.now() - startTime;
      processedCount++;
      totalProcessingTime += processingTime;

      return {
        success: true,
        notificationId: notification._id,
        userId,
        title,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      failedCount++;
      console.error(`Notification worker failed for user ${userId}:`, error.message);
      throw error; // Rethrow to trigger Bull retry
    }
  });

  // Log queue metrics periodically (every 60 seconds)
  setInterval(async () => {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        notificationQueue.getWaitingCount(),
        notificationQueue.getActiveCount(),
        notificationQueue.getCompletedCount(),
        notificationQueue.getFailedCount(),
      ]);
      
      const avgProcessingTime = processedCount > 0 
        ? Math.round(totalProcessingTime / processedCount) 
        : 0;
      
      console.log(
        `[NotificationQueue] Depth: waiting=${waiting}, active=${active}, ` +
        `completed=${completed}, failed=${failed}, ` +
        `avgProcessingTime=${avgProcessingTime}ms, ` +
        `processed=${processedCount}, errors=${failedCount}`
      );
    } catch (err) {
      console.error('Failed to get notification queue metrics:', err.message);
    }
  }, 60000);

  console.log('Notification worker initialized (concurrency: 8)');
};

/**
 * Add a notification job to the queue (convenience function)
 * @param {Object} notificationData - Notification data
 * @param {Object} options - Bull job options
 */
export const queueNotification = async (notificationData, options = {}) => {
  return notificationQueue.add(notificationData, options);
};

/**
 * Send instant notification via socket AND queue for persistence
 * Use this for time-sensitive notifications where real-time is critical
 * @param {Object} notificationData - Notification data { userId, type, title, message, data }
 */
export const sendInstantNotification = async (notificationData) => {
  const { userId, type, title, message, data } = notificationData;
  
  // Emit immediately via socket (before queue processing)
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit('notification:new', {
      id: `instant-${Date.now()}`, // Temporary ID until DB record created
      type: type || 'info',
      title,
      message,
      timestamp: new Date(),
      read: false,
      actionType: data?.actionType || 'none',
      data,
      _pending: true, // Frontend can use this to show "syncing" state
    });
  }
  
  // Queue for persistence and push notification
  return notificationQueue.add(notificationData);
};

/**
 * Send a notification to multiple users
 * @param {Array<string>} userIds - Array of user IDs
 * @param {Object} notificationData - Notification data (type, title, message, data)
 */
export const notifyUsers = async (userIds, notificationData) => {
  const jobs = userIds.map(userId => 
    notificationQueue.add({ userId, ...notificationData })
  );
  return Promise.all(jobs);
};

/**
 * Send a notification to all members of a group
 * @param {Object} group - Group document with members array
 * @param {Object} notificationData - Notification data
 * @param {string} excludeUserId - User ID to exclude (e.g., the action performer)
 */
export const notifyGroupMembers = async (group, notificationData, excludeUserId = null) => {
  const memberIds = group.members
    .map(m => m._id?.toString() || m.toString())
    .filter(id => id !== excludeUserId);
  
  return notifyUsers(memberIds, notificationData);
};

/**
 * Predefined notification types
 */
export const NotificationTypes = {
  EXPENSE_ADDED: 'expense',
  EXPENSE_UPDATED: 'expense',
  SETTLEMENT_CREATED: 'info',
  SETTLEMENT_CONFIRMED: 'success',
  GROUP_JOINED: 'info',
  MEMBER_ADDED: 'info',
  BUDGET_ALERT: 'warning',
  RECURRING_EXPENSE: 'expense',
  PAYMENT_REMINDER: 'warning',
};

export default initNotificationWorker;
