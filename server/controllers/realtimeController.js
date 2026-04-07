import mongoose from 'mongoose';
import Group from '../models/Group.js';
import RealtimeEvent from '../models/RealtimeEvent.js';

const parseChannels = (rawChannels) => {
  if (!rawChannels) {
    return [];
  }

  if (Array.isArray(rawChannels)) {
    return rawChannels.flatMap(channel => String(channel).split(','));
  }

  return String(rawChannels).split(',');
};

const isUserChannel = (channel) => channel.startsWith('user:');
const isGroupChannel = (channel) => channel.startsWith('group:');

const getUserChannel = (userId) => `user:${userId}`;

export const getRealtimeEvents = async (req, res) => {
  try {
    const requestedChannels = parseChannels(req.query.channels)
      .map(channel => String(channel).trim())
      .filter(Boolean);

    const channels = new Set([getUserChannel(req.user._id)]);
    const groupChannelIds = [];

    for (const channel of requestedChannels) {
      if (isUserChannel(channel)) {
        if (channel !== getUserChannel(req.user._id)) {
          return res.status(403).json({ message: 'Not authorized to access this user channel' });
        }

        channels.add(channel);
        continue;
      }

      if (isGroupChannel(channel)) {
        const groupId = channel.slice('group:'.length);
        if (groupId) {
          groupChannelIds.push(groupId);
          channels.add(channel);
        }
      }
    }

    if (groupChannelIds.length > 0) {
      const authorizedGroups = await Group.find({
        _id: { $in: groupChannelIds },
        members: req.user._id,
      })
        .select('_id')
        .lean();

      if (authorizedGroups.length !== groupChannelIds.length) {
        return res.status(403).json({ message: 'Not authorized to access one or more group channels' });
      }
    }

    const query = {
      channel: { $in: Array.from(channels) },
    };

    if (req.query.cursor) {
      if (!mongoose.Types.ObjectId.isValid(req.query.cursor)) {
        return res.status(400).json({ message: 'Invalid cursor' });
      }

      query._id = { $gt: new mongoose.Types.ObjectId(req.query.cursor) };
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);

    const events = await RealtimeEvent.find(query)
      .sort({ _id: 1 })
      .limit(limit)
      .lean();

    res.json({
      events: events.map(event => ({
        id: event._id.toString(),
        channel: event.channel,
        event: event.event,
        payload: event.payload,
        audience: event.audience,
        createdAt: event.createdAt,
      })),
      nextCursor: events.length > 0 ? events[events.length - 1]._id.toString() : req.query.cursor || null,
    });
  } catch (error) {
    console.error('[Realtime] Failed to fetch events:', error);
    res.status(500).json({ message: 'Failed to load realtime events' });
  }
};