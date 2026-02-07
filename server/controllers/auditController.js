import AuditLog from '../models/AuditLog.js';
import Group from '../models/Group.js';

// @desc    Get audit logs for current user
// @route   GET /api/audit/my-activity
// @access  Private
export const getMyActivity = async (req, res) => {
  try {
    const { limit = 50, skip = 0, startDate, endDate } = req.query;

    const logs = await AuditLog.getUserActivity(req.user._id, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      startDate,
      endDate,
    });

    const total = await AuditLog.countDocuments({ userId: req.user._id });

    res.json({
      logs: logs.map(log => ({
        id: log._id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        timestamp: log.timestamp,
        result: log.result,
        metadata: {
          ipAddress: log.metadata?.ipAddress,
          endpoint: log.metadata?.endpoint,
        },
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: total > parseInt(skip) + parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Get my activity error:', error);
    res.status(500).json({ message: 'Error fetching activity logs' });
  }
};

// @desc    Get audit logs for a specific entity
// @route   GET /api/audit/entity/:entityType/:entityId
// @access  Private
export const getEntityHistory = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    // Validate entity type
    const validTypes = ['User', 'Group', 'Expense', 'Settlement', 'Invite', 'Message'];
    if (!validTypes.includes(entityType)) {
      return res.status(400).json({ message: 'Invalid entity type' });
    }

    // For Group entities, verify user has access
    if (entityType === 'Group') {
      const group = await Group.findById(entityId);
      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }
      if (!group.members.includes(req.user._id)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const logs = await AuditLog.getEntityHistory(entityType, entityId, {
      limit: parseInt(limit),
      skip: parseInt(skip),
    });

    const total = await AuditLog.countDocuments({ entityType, entityId });

    res.json({
      logs: logs.map(log => ({
        id: log._id,
        action: log.action,
        user: log.userId,
        timestamp: log.timestamp,
        result: log.result,
        changes: log.changes?.modifiedFields || [],
        metadata: {
          ipAddress: log.metadata?.ipAddress,
        },
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: total > parseInt(skip) + parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Get entity history error:', error);
    res.status(500).json({ message: 'Error fetching entity history' });
  }
};

// @desc    Get audit logs for a group
// @route   GET /api/audit/group/:groupId
// @access  Private
export const getGroupActivity = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { limit = 100, skip = 0, actions } = req.query;

    // Verify user has access to group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    if (!group.members.includes(req.user._id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Parse actions filter
    const actionFilter = actions ? actions.split(',') : undefined;

    const logs = await AuditLog.getGroupActivity(groupId, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      actions: actionFilter,
    });

    const total = await AuditLog.countDocuments({ 'relatedEntities.groupId': groupId });

    res.json({
      logs: logs.map(log => ({
        id: log._id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        user: log.userId,
        timestamp: log.timestamp,
        result: log.result,
        changes: log.changes?.modifiedFields || [],
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: total > parseInt(skip) + parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Get group activity error:', error);
    res.status(500).json({ message: 'Error fetching group activity' });
  }
};

// @desc    Get failed actions (admin only - for security monitoring)
// @route   GET /api/audit/failed-actions
// @access  Private (Admin)
export const getFailedActions = async (req, res) => {
  try {
    // TODO: Add admin check when admin role is implemented
    // For now, restrict to specific users or skip this endpoint

    const { limit = 100, skip = 0, hours = 24 } = req.query;

    const startDate = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);

    const logs = await AuditLog.getFailedActions({
      limit: parseInt(limit),
      skip: parseInt(skip),
      startDate,
    });

    res.json({
      logs: logs.map(log => ({
        id: log._id,
        action: log.action,
        user: log.userId,
        timestamp: log.timestamp,
        error: log.error?.message,
        metadata: {
          ipAddress: log.metadata?.ipAddress,
          endpoint: log.metadata?.endpoint,
        },
      })),
      total: logs.length,
    });
  } catch (error) {
    console.error('Get failed actions error:', error);
    res.status(500).json({ message: 'Error fetching failed actions' });
  }
};

// @desc    Get suspicious activity (admin only - for security monitoring)
// @route   GET /api/audit/suspicious-activity
// @access  Private (Admin)
export const getSuspiciousActivity = async (req, res) => {
  try {
    // TODO: Add admin check when admin role is implemented

    const { hours = 24, threshold = 5 } = req.query;

    const activity = await AuditLog.getSuspiciousActivity({
      hours: parseInt(hours),
      threshold: parseInt(threshold),
    });

    res.json({
      activity: activity.map(item => ({
        userId: item._id.userId,
        ipAddress: item._id.ipAddress,
        failedAttempts: item.count,
        actions: item.actions,
        lastAttempt: item.lastAttempt,
      })),
      total: activity.length,
    });
  } catch (error) {
    console.error('Get suspicious activity error:', error);
    res.status(500).json({ message: 'Error fetching suspicious activity' });
  }
};

export default {
  getMyActivity,
  getEntityHistory,
  getGroupActivity,
  getFailedActions,
  getSuspiciousActivity,
};
