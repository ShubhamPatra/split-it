import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

// Configure web-push with VAPID keys lazily
let vapidConfigured = false;
const configureVapid = () => {
  if (vapidConfigured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  if (publicKey && privateKey) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@split-it.app',
      publicKey,
      privateKey
    );
    vapidConfigured = true;
    console.log('Web Push VAPID configured successfully');
  }
};

let pushDisabled = false;
export const setPushDisabled = (val) => { pushDisabled = !!val; };

// Add subscription (upsert by endpoint)
export const addSubscription = async (userId, subscription) => {
  if (pushDisabled) return;
  configureVapid();
  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    { userId, subscription, endpoint: subscription.endpoint, createdAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

// Remove subscription by endpoint
export const removeSubscriptionByEndpoint = async (endpoint) => {
  if (pushDisabled) return;
  await PushSubscription.deleteOne({ endpoint });
};

// Remove all subscriptions for a user
export const removeSubscriptionsByUser = async (userId) => {
  if (pushDisabled) return;
  await PushSubscription.deleteMany({ userId });
};

// Get all subscriptions for a user
export const getSubscriptionsByUser = async (userId) => {
  if (pushDisabled) return [];
  return PushSubscription.find({ userId });
};

// Send push notification to a user
export const sendPushNotification = async (userId, payload) => {
  if (pushDisabled) return;
  configureVapid();
  const userSubs = await getSubscriptionsByUser(userId);
  if (!userSubs.length) {
    console.log(`No push subscriptions for user ${userId}`);
    return;
  }
  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/logo192.png',
    badge: payload.badge || '/logo192.png',
    tag: payload.tag || 'split-it',
    data: payload.data || {},
    actions: payload.actions || [],
  });
  const results = await Promise.allSettled(
    userSubs.map(async (subDoc) => {
      try {
        await webpush.sendNotification(subDoc.subscription, notification);
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await removeSubscriptionByEndpoint(subDoc.endpoint);
        }
        throw error;
      }
    })
  );
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  console.log(`Push notification to ${userId}: ${successful} sent, ${failed} failed`);
};

// Send push notification to multiple users
export const sendPushToUsers = async (userIds, payload) => {
  if (pushDisabled) return;
  await Promise.allSettled(
    userIds.map(userId => sendPushNotification(userId, payload))
  );
};

// Notification payloads for different events
export const pushPayloads = {
  expenseAdded: (data) => ({
    title: 'New Expense',
    body: `${data.paidByName} added "${data.description}" - ₹${data.amount.toFixed(2)}`,
    tag: `expense-${data.expenseId}`,
    data: {
      type: 'expense_added',
      groupId: data.groupId,
      expenseId: data.expenseId,
    },
    actions: [
      { action: 'view', title: 'View' },
    ],
  }),
  settlementReceived: (data) => ({
    title: 'Payment Received',
    body: `${data.fromName} sent you ₹${data.amount.toFixed(2)}`,
    tag: `settlement-${data.settlementId}`,
    data: {
      type: 'settlement',
      groupId: data.groupId,
      settlementId: data.settlementId,
    },
    actions: [
      { action: 'confirm', title: 'Confirm' },
      { action: 'view', title: 'View' },
    ],
  }),
  budgetAlert: (data) => ({
    title: '⚠️ Budget Alert',
    body: `${data.groupName} has reached ${data.percentage}% of budget`,
    tag: `budget-${data.groupId}`,
    data: {
      type: 'budget_alert',
      groupId: data.groupId,
    },
  }),
  memberJoined: (data) => ({
    title: 'New Member',
    body: `${data.newMemberName} joined ${data.groupName}`,
    tag: `member-${data.groupId}`,
    data: {
      type: 'member_joined',
      groupId: data.groupId,
    },
  }),
};

export const getVapidPublicKey = () => {
  configureVapid();
  return process.env.VAPID_PUBLIC_KEY || '';
};

export default {
  addSubscription,
  removeSubscriptionByEndpoint,
  removeSubscriptionsByUser,
  getSubscriptionsByUser,
  sendPushNotification,
  sendPushToUsers,
  pushPayloads,
  getVapidPublicKey,
};
