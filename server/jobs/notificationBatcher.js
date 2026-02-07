/**
 * Notification Batcher
 * 
 * Groups multiple notifications from the same user/group within a time window
 * to reduce notification noise and improve UX.
 * 
 * Example: Instead of 3 separate "expense added" notifications,
 * send one "Alice added 3 expenses to GroupName" notification.
 */

import { createNotification, sendPushNotification } from './notificationService.js';

// In-memory batch storage
// Structure: Map<batchKey, { notifications: [], timer: NodeJS.Timeout }>
const batchStore = new Map();

// Configuration
const BATCH_WINDOW_MS = 60000; // 1 minute window for batching
const MAX_BATCH_SIZE = 10; // Flush batch if it reaches this size

/**
 * Generate a unique key for batching notifications
 * Groups by: userId, actorId (who performed action), groupId, actionType
 */
const generateBatchKey = (userId, actorId, groupId, actionType) => {
  return `${userId}:${actorId}:${groupId || 'none'}:${actionType}`;
};

/**
 * Flush a batch of notifications - create a single grouped notification
 */
const flushBatch = async (batchKey) => {
  const batch = batchStore.get(batchKey);
  if (!batch || batch.notifications.length === 0) {
    return;
  }

  // Clear the timer
  if (batch.timer) {
    clearTimeout(batch.timer);
  }

  // Get batch details
  const notifications = batch.notifications;
  const count = notifications.length;
  const firstNotif = notifications[0];
  
  // Remove from store
  batchStore.delete(batchKey);

  // If only one notification, send it as-is
  if (count === 1) {
    await createNotification(firstNotif);
    return;
  }

  // Create grouped notification
  const { userId, actorName, groupName, groupId, actionType } = firstNotif.batchMeta;
  
  let title, message, data;

  if (actionType === 'expense_added') {
    title = 'Multiple Expenses Added';
    message = groupName 
      ? `${actorName} added ${count} expenses to ${groupName}`
      : `${actorName} added ${count} expenses`;
    data = {
      actionType: 'navigate',
      groupId,
      batchedCount: count,
      batchedType: 'expense_added',
    };
  } else if (actionType === 'expense_updated') {
    title = 'Multiple Expenses Updated';
    message = groupName
      ? `${actorName} updated ${count} expenses in ${groupName}`
      : `${actorName} updated ${count} expenses`;
    data = {
      actionType: 'navigate',
      groupId,
      batchedCount: count,
      batchedType: 'expense_updated',
    };
  } else if (actionType === 'chat_message') {
    title = 'New Messages';
    message = `${actorName} sent ${count} messages in ${groupName}`;
    data = {
      actionType: 'chat_message',
      groupId,
      batchedCount: count,
      batchedType: 'chat_message',
    };
  } else {
    // Fallback for other action types
    title = 'Multiple Updates';
    message = `${actorName} made ${count} updates${groupName ? ` in ${groupName}` : ''}`;
    data = {
      actionType: 'navigate',
      groupId,
      batchedCount: count,
      batchedType: actionType,
    };
  }

  // Create the grouped notification
  await createNotification({
    userId,
    type: firstNotif.type,
    title,
    message,
    data,
  });

  // Send push notification for batched notifications
  const pushData = {
    title,
    body: message,
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: `batch-${groupId || 'general'}`,
    data: {
      url: groupId ? `/group/${groupId}` : '/dashboard',
      groupId,
      batchedCount: count,
    },
  };

  await sendPushNotification(userId, pushData);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[NotificationBatcher] Flushed batch: ${count} notifications for ${batchKey}`);
  }
};

/**
 * Add a notification to a batch
 * If batch reaches max size or timer expires, flush it
 */
export const addToBatch = async (notificationData) => {
  const { userId, batchMeta } = notificationData;
  
  if (!batchMeta) {
    // Not batchable, send immediately
    await createNotification(notificationData);
    return;
  }

  const { actorId, groupId, actionType } = batchMeta;
  const batchKey = generateBatchKey(userId, actorId, groupId, actionType);

  // Get or create batch
  let batch = batchStore.get(batchKey);
  if (!batch) {
    batch = {
      notifications: [],
      timer: null,
    };
    batchStore.set(batchKey, batch);
  }

  // Add notification to batch
  batch.notifications.push(notificationData);

  // Clear existing timer
  if (batch.timer) {
    clearTimeout(batch.timer);
  }

  // Check if batch is full
  if (batch.notifications.length >= MAX_BATCH_SIZE) {
    // Flush immediately
    await flushBatch(batchKey);
  } else {
    // Set timer to flush after window
    batch.timer = setTimeout(() => {
      flushBatch(batchKey).catch(err => {
        console.error(`[NotificationBatcher] Error flushing batch ${batchKey}:`, err);
      });
    }, BATCH_WINDOW_MS);
  }
};

/**
 * Flush all pending batches (useful for shutdown)
 */
export const flushAllBatches = async () => {
  const keys = Array.from(batchStore.keys());
  await Promise.all(keys.map(key => flushBatch(key)));
  console.log(`[NotificationBatcher] Flushed ${keys.length} batches`);
};

/**
 * Get batch statistics (for monitoring)
 */
export const getBatchStats = () => {
  const batches = Array.from(batchStore.values());
  return {
    activeBatches: batches.length,
    totalPendingNotifications: batches.reduce((sum, b) => sum + b.notifications.length, 0),
    batchSizes: batches.map(b => b.notifications.length),
  };
};

/**
 * Clear all batches (for testing)
 */
export const clearAllBatches = () => {
  batchStore.forEach(batch => {
    if (batch.timer) {
      clearTimeout(batch.timer);
    }
  });
  batchStore.clear();
};
