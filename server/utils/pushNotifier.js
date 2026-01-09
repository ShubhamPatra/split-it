import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

export const sendPushToUser = async (userId, payload) => {
  try {
    const subscriptions = await PushSubscription.find({ userId });
    
    const results = await Promise.allSettled(
      subscriptions.map(sub => 
        webpush.sendNotification(sub, JSON.stringify(payload))
          .catch(async (error) => {
            // Remove expired subscriptions
            if (error.statusCode === 410 || error.statusCode === 404) {
              await PushSubscription.deleteOne({ _id: sub._id });
            }
            throw error;
          })
      )
    );

    return results.filter(r => r.status === 'fulfilled').length;
  } catch (error) {
    console.error('Push notification error:', error);
    return 0;
  }
};

export const sendPushToGroup = async (groupId, payload) => {
  const Group = (await import('../models/Group.js')).default;
  const group = await Group.findById(groupId).lean();
  
  if (!group) return 0;

  const results = await Promise.all(
    group.members.map(memberId => sendPushToUser(memberId, payload))
  );

  return results.reduce((sum, count) => sum + count, 0);
};
