import AuditLog from '../models/AuditLog.js';

/**
 * Extract IP address from request
 */
const getIpAddress = (req) => {
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         'unknown';
};

/**
 * Generate unique request ID
 */
const generateRequestId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Extract changed fields by comparing before and after objects
 */
const getModifiedFields = (before, after) => {
  if (!before || !after) return [];
  
  const fields = new Set();
  
  // Check all keys in after object
  for (const key of Object.keys(after)) {
    if (key === '_id' || key === '__v' || key === 'updatedAt') continue;
    
    const beforeValue = JSON.stringify(before[key]);
    const afterValue = JSON.stringify(after[key]);
    
    if (beforeValue !== afterValue) {
      fields.add(key);
    }
  }
  
  return Array.from(fields);
};

/**
 * Sanitize data for logging (remove sensitive fields)
 */
const sanitizeData = (data) => {
  if (!data) return null;
  
  const sanitized = { ...data };
  
  // Remove sensitive fields
  delete sanitized.password;
  delete sanitized.resetPasswordToken;
  delete sanitized.verificationToken;
  delete sanitized.__v;
  
  return sanitized;
};

/**
 * Create audit log entry
 */
export const createAuditLog = async (data) => {
  try {
    const {
      action,
      entityType,
      entityId,
      userId,
      relatedEntities = {},
      changes = {},
      metadata = {},
      result = 'success',
      error = null,
      notes = null,
      req = null,
    } = data;

    // Build audit log entry
    const logEntry = {
      action,
      entityType,
      entityId,
      userId,
      relatedEntities,
      changes: {
        before: sanitizeData(changes.before),
        after: sanitizeData(changes.after),
        modifiedFields: changes.modifiedFields || getModifiedFields(changes.before, changes.after),
      },
      metadata: {
        ipAddress: metadata.ipAddress || (req ? getIpAddress(req) : 'unknown'),
        userAgent: metadata.userAgent || req?.headers['user-agent'] || 'unknown',
        requestId: metadata.requestId || (req ? generateRequestId() : 'unknown'),
        endpoint: metadata.endpoint || req?.originalUrl || req?.url || 'unknown',
        method: metadata.method || req?.method || 'unknown',
      },
      result,
      error: error ? {
        message: error.message || error,
        code: error.code,
        stack: error.stack,
      } : undefined,
      notes,
      timestamp: new Date(),
    };

    // Create log entry (non-blocking)
    await AuditLog.log(logEntry);
  } catch (error) {
    // Don't throw - audit logging should not break the main flow
    console.error('Audit logging error:', error);
  }
};

/**
 * Middleware to automatically audit mutations
 * Usage: router.post('/endpoint', protect, auditMutation('expense.create', 'Expense'), handler)
 */
export const auditMutation = (action, entityType) => {
  return async (req, res, next) => {
    // Store original send function
    const originalSend = res.send;
    const originalJson = res.json;

    // Track request start time
    req.auditStartTime = Date.now();
    req.auditAction = action;
    req.auditEntityType = entityType;

    // Override res.send to capture response
    res.send = function(data) {
      res.send = originalSend;
      
      // Log after response is sent
      setImmediate(() => {
        logMutation(req, res, data);
      });
      
      return originalSend.call(this, data);
    };

    // Override res.json to capture response
    res.json = function(data) {
      res.json = originalJson;
      
      // Log after response is sent
      setImmediate(() => {
        logMutation(req, res, data);
      });
      
      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Helper function to log mutation after response
 */
const logMutation = async (req, res, responseData) => {
  try {
    // Only log if user is authenticated
    if (!req.user) return;

    // Parse response data if string
    let parsedData = responseData;
    if (typeof responseData === 'string') {
      try {
        parsedData = JSON.parse(responseData);
      } catch (e) {
        parsedData = { raw: responseData };
      }
    }

    // Determine result based on status code
    const result = res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'failure';

    // Extract entity ID from response or request
    const entityId = parsedData?.id || 
                     parsedData?._id || 
                     req.params?.id || 
                     req.body?.id ||
                     'unknown';

    // Extract related entities
    const relatedEntities = {
      groupId: parsedData?.groupId || req.body?.groupId || req.params?.groupId,
      expenseId: parsedData?.expenseId || req.body?.expenseId,
      settlementId: parsedData?.settlementId || req.body?.settlementId,
    };

    // Create audit log
    await createAuditLog({
      action: req.auditAction,
      entityType: req.auditEntityType,
      entityId,
      userId: req.user._id,
      relatedEntities,
      changes: {
        before: req.auditBefore || null,
        after: parsedData,
      },
      result,
      error: result === 'failure' ? {
        message: parsedData?.message || parsedData?.error,
        code: parsedData?.code,
      } : null,
      req,
    });
  } catch (error) {
    console.error('Mutation logging error:', error);
  }
};

/**
 * Middleware to capture "before" state for updates
 * Usage: router.put('/endpoint', protect, captureBeforeState(Model), auditMutation(...), handler)
 */
export const captureBeforeState = (Model) => {
  return async (req, res, next) => {
    try {
      const entityId = req.params.id;
      if (entityId) {
        const entity = await Model.findById(entityId).lean();
        req.auditBefore = entity;
      }
    } catch (error) {
      console.error('Capture before state error:', error);
    }
    next();
  };
};

/**
 * Log authentication events
 */
export const logAuthEvent = async (action, userId, result, req, error = null) => {
  await createAuditLog({
    action,
    entityType: 'User',
    entityId: userId || 'unknown',
    userId: userId || 'unknown',
    result,
    error,
    req,
  });
};

/**
 * Log group membership changes
 */
export const logGroupMembershipChange = async (action, groupId, userId, targetUserId, req) => {
  await createAuditLog({
    action,
    entityType: 'Group',
    entityId: groupId,
    userId,
    relatedEntities: { groupId },
    notes: `Target user: ${targetUserId}`,
    req,
  });
};

/**
 * Log settlement status changes
 */
export const logSettlementStatusChange = async (action, settlement, userId, req) => {
  await createAuditLog({
    action,
    entityType: 'Settlement',
    entityId: settlement._id,
    userId,
    relatedEntities: {
      groupId: settlement.groupId,
      settlementId: settlement._id,
    },
    changes: {
      before: { paymentStatus: settlement.paymentStatus },
      after: { paymentStatus: action.includes('confirm') ? 'confirmed' : 'failed' },
    },
    req,
  });
};

export default {
  createAuditLog,
  auditMutation,
  captureBeforeState,
  logAuthEvent,
  logGroupMembershipChange,
  logSettlementStatusChange,
};
