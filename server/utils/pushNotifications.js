import webpush from 'web-push';

// Configure web-push with VAPID keys lazily
// Generate keys with: npx web-push generate-vapid-keys
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

// Store subscriptions (in production, store in database)
const subscriptions = new Map(); // userId -> subscription[]

// Add subscription
export const addSubscription = (userId, subscription) => {
  configureVapid();
  const userSubs = subscriptions.get(userId) || [];
  // Check if subscription already exists
  const exists = userSubs.some(s => s.endpoint === subscription.endpoint);
  if (!exists) {
    userSubs.push(subscription);
    subscriptions.set(userId, userSubs);
  }
};

// Remove subscription
export const removeSubscription = (userId, endpoint) => {
  const userSubs = subscriptions.get(userId) || [];
  subscriptions.set(userId, userSubs.filter(s => s.endpoint !== endpoint));
};

// Remove subscription by endpoint (for any user)
export const removeSubscriptionByEndpoint = (endpoint) => {
  for (const [userId, subs] of subscriptions.entries()) {
    subscriptions.set(userId, subs.filter(s => s.endpoint !== endpoint));
  }
};

// Send push notification to a user
export const sendPushNotification = async (userId, payload) => {
  configureVapid();
  const userSubs = subscriptions.get(userId) || [];
  
  if (userSubs.length === 0) {
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
    userSubs.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription, notification);
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          // Subscription expired or invalid, remove it
          removeSubscription(userId, subscription.endpoint);
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
  removeSubscription,
  removeSubscriptionByEndpoint,
  sendPushNotification,
  sendPushToUsers,
  pushPayloads,
  getVapidPublicKey,
};
