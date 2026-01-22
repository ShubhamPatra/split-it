/**
 * Notification Service
 * 
 * Direct notification creation service.
 * Replaces the notification queue/worker system with simple async calls.
 */

import Notification from '../models/Notification.js';
import { executeJob } from './jobRunner.js';

// Reference to Socket.IO instance (set during initialization)
let ioInstance = null;

/**
 * Set the Socket.IO instance for real-time notifications
 * @param {Object} io - Socket.IO server instance
 */
export const setSocketIO = (io) => {
    ioInstance = io;
};

/**
 * Get the Socket.IO instance
 * @returns {Object|null} Socket.IO server instance
 */
export const getSocketIO = () => ioInstance;

/**
 * Create a notification in the database and emit via Socket.IO
 * @param {Object} notificationData - Notification data
 * @returns {Promise<Object>} Created notification
 */
export const createNotification = async (notificationData) => {
    const { userId, type, title, message, data } = notificationData;

    if (!userId || !title || !message) {
        throw new Error('Missing required notification fields: userId, title, message');
    }

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

    return notification;
};

/**
 * Send push notification to a user
 * @param {string} userId - User ID
 * @param {Object} pushData - Push notification data
 * @returns {Promise<void>}
 */
export const sendPushNotification = async (userId, pushData) => {
    try {
        const { sendPushToUser } = await import('../utils/pushNotifier.js');
        await sendPushToUser(userId, pushData);
    } catch (error) {
        // Push notification failures shouldn't crash the system
        console.error(`[Notification] Push failed for user ${userId}:`, error.message);
    }
};

/**
 * Create notification and optionally send push notification based on action type
 * @param {Object} notificationData - Notification data
 * @returns {Promise<Object>} Result object
 */
const createNotificationWithPush = async (notificationData) => {
    const { userId, type, title, message, data } = notificationData;

    // Create the notification
    const notification = await createNotification(notificationData);

    // Determine if we should send a push notification
    const actionType = data?.actionType;
    const shouldSendPush = [
        'chat_message',
        'expense_added',
        'expense_updated',
        'settlement_created',
        'settlement_confirmed',
        'payment_reminder',
        'repayment_request',
    ].includes(actionType);

    if (shouldSendPush) {
        const pushData = {
            title,
            body: message,
            icon: '/logo192.png',
            badge: '/logo192.png',
            data: {},
        };

        // Configure push notification based on action type
        if (actionType === 'chat_message') {
            pushData.tag = `chat-${data.groupId}`;
            pushData.data = {
                url: `/group/${data.groupId}?tab=chat`,
                groupId: data.groupId,
                messageId: data.messageId,
            };
        } else if (actionType === 'expense_added' || actionType === 'expense_updated') {
            pushData.tag = `expense-${data.groupId}`;
            pushData.data = {
                url: `/group/${data.groupId}`,
                groupId: data.groupId,
                expenseId: data.expenseId,
            };
        } else if (actionType === 'settlement_created' || actionType === 'settlement_confirmed') {
            pushData.tag = `settlement-${data.groupId}`;
            pushData.requireInteraction = true;
            pushData.data = {
                url: `/group/${data.groupId}?tab=settlements`,
                groupId: data.groupId,
                settlementId: data.settlementId,
            };
        } else if (actionType === 'payment_reminder') {
            pushData.tag = `reminder-${data.groupId || 'general'}`;
            pushData.requireInteraction = true;
            pushData.data = {
                url: data.groupId ? `/group/${data.groupId}?tab=settlements` : '/summary',
            };
        } else if (actionType === 'repayment_request') {
            pushData.tag = `repayment-${data.requesterId}`;
            pushData.requireInteraction = true;
            pushData.data = {
                url: '/settlements?tab=people',
                requestId: data.requestId,
            };
        }

        await sendPushNotification(userId, pushData);
    }

    if (process.env.NODE_ENV !== 'production') {
        console.log(`[Notification] Created for user ${userId}: ${title}`);
    }

    return {
        success: true,
        notificationId: notification._id,
        userId,
        title,
    };
};

/**
 * Notify a single user with retry logic
 * @param {string} userId - User ID
 * @param {Object} notificationData - Notification data (type, title, message, data)
 * @returns {Promise<Object>} Result object
 */
export const notifyUser = async (userId, notificationData) => {
    const result = await executeJob(
        'Notification',
        createNotificationWithPush,
        { userId, ...notificationData },
        { maxRetries: 3, timeout: 10000 }
    );

    return result;
};

/**
 * Send notifications to multiple users
 * @param {Array<string>} userIds - Array of user IDs
 * @param {Object} notificationData - Notification data (type, title, message, data)
 * @returns {Promise<Array<Object>>} Array of results
 */
export const notifyUsers = async (userIds, notificationData) => {
    const results = await Promise.all(
        userIds.map(userId => notifyUser(userId, notificationData))
    );

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    if (process.env.NODE_ENV !== 'production') {
        console.log(`[Notification] Bulk: ${successCount} succeeded, ${failCount} failed`);
    }

    return results;
};

/**
 * Send a notification to all members of a group
 * @param {Object} group - Group document with members array
 * @param {Object} notificationData - Notification data
 * @param {string} excludeUserId - User ID to exclude (e.g., the action performer)
 * @returns {Promise<Array<Object>>} Array of results
 */
export const notifyGroupMembers = async (group, notificationData, excludeUserId = null) => {
    const memberIds = group.members
        .map(m => m._id?.toString() || m.toString())
        .filter(id => id !== excludeUserId);

    return notifyUsers(memberIds, notificationData);
};

/**
 * Send instant notification via socket (faster, for time-sensitive notifications)
 * Creates a temporary notification immediately, then persists to database
 * @param {Object} notificationData - Notification data { userId, type, title, message, data }
 * @returns {Promise<Object>} Result object
 */
export const sendInstantNotification = async (notificationData) => {
    const { userId, type, title, message, data } = notificationData;

    // Emit immediately via socket (before database write)
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

    // Persist to database
    return notifyUser(userId, notificationData);
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
    REPAYMENT_REQUEST: 'warning',
};

export default {
    setSocketIO,
    getSocketIO,
    createNotification,
    sendPushNotification,
    notifyUser,
    notifyUsers,
    notifyGroupMembers,
    sendInstantNotification,
    NotificationTypes,
};
