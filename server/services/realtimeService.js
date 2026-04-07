import RealtimeEvent from '../models/RealtimeEvent.js';

const DEFAULT_EVENT_TTL_HOURS = 24;

const safeSerialize = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value?.toObject === 'function') {
    return value.toObject({ virtuals: true });
  }

  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
  }

  return value;
};

export const groupChannel = (groupId) => `group:${groupId}`;

export const userChannel = (userId) => `user:${userId}`;

export const normalizeChannels = (channels = []) => {
  return channels
    .filter(Boolean)
    .map(channel => String(channel).trim())
    .filter(Boolean);
};

const buildEventDocument = ({ channel, event, payload, audience, createdBy, ttlHours }) => ({
  channel,
  event,
  payload: safeSerialize(payload),
  audience: audience || 'broadcast',
  createdBy: createdBy || null,
  expiresAt: new Date(Date.now() + (ttlHours || DEFAULT_EVENT_TTL_HOURS) * 60 * 60 * 1000),
});

export const publishRealtimeEvent = async ({
  channels = [],
  event,
  payload = null,
  audience = 'broadcast',
  createdBy = null,
  ttlHours = DEFAULT_EVENT_TTL_HOURS,
  io = null,
}) => {
  const normalizedChannels = normalizeChannels(channels);

  if (!event || normalizedChannels.length === 0) {
    return [];
  }

  if (io?.to) {
    normalizedChannels.forEach(channel => {
      io.to(channel).emit(event, payload);
    });
  }

  const documents = normalizedChannels.map(channel => buildEventDocument({
    channel,
    event,
    payload,
    audience,
    createdBy,
    ttlHours,
  }));

  try {
    return await RealtimeEvent.insertMany(documents, { ordered: false });
  } catch (error) {
    console.error('[Realtime] Failed to persist event log:', error.message);
    return [];
  }
};

export const publishToGroup = async (groupId, event, payload = null, options = {}) => {
  return publishRealtimeEvent({
    channels: [groupChannel(groupId)],
    event,
    payload,
    audience: 'group',
    ...options,
  });
};

export const publishToUser = async (userId, event, payload = null, options = {}) => {
  return publishRealtimeEvent({
    channels: [userChannel(userId)],
    event,
    payload,
    audience: 'user',
    ...options,
  });
};