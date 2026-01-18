/**
 * Test Action Implementations
 * 
 * Provides test actions for debugging and verifying service functionality.
 */

import mongoose from 'mongoose';

/**
 * Execute a test action with timing
 * @param {string} actionName - Name of the action
 * @param {Function} actionFn - Async function to execute
 * @returns {Promise<Object>} Test result
 */
const executeTest = async (actionName, actionFn) => {
  const startTime = Date.now();
  
  try {
    const result = await Promise.race([
      actionFn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Test action timeout (30s)')), 30000)
      ),
    ]);

    return {
      action: actionName,
      success: true,
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      result,
      error: null,
    };
  } catch (error) {
    return {
      action: actionName,
      success: false,
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      result: null,
      error: error.message,
    };
  }
};

/**
 * Test email sending
 * @param {string} to - Email recipient (optional, defaults to DEBUG_EMAIL)
 * @returns {Promise<Object>} Test result
 */
export const testEmail = async (to = null) => {
  return executeTest('test_email', async () => {
    const recipient = to || process.env.DEBUG_EMAIL;
    
    if (!recipient) {
      throw new Error('No recipient email provided and DEBUG_EMAIL not configured');
    }

    // Check if SMTP is configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      return {
        skipped: true,
        reason: 'SMTP not configured',
        to: recipient,
      };
    }

    const { sendEmail } = await import('../../jobs/emailService.js');
    
    const result = await sendEmail({
      to: recipient,
      subject: `[Split-It Debug] Test Email - ${new Date().toISOString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Debug Portal Test Email</h2>
          <p>This is a test email sent from the Split-It Debug Portal.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
          <p>If you received this email, the email service is working correctly.</p>
        </div>
      `,
    });

    return {
      to: recipient,
      subject: result.subject || 'Test Email',
      messageId: result.messageId,
      skipped: result.skipped || false,
    };
  });
};

/**
 * Test Socket.IO event emission
 * @param {Object} options - Test options
 * @param {string} options.room - Room to emit to (optional)
 * @param {string} options.event - Event name (default: 'debug:test')
 * @param {Object} options.data - Event data (optional)
 * @returns {Promise<Object>} Test result
 */
export const testSocket = async ({ room, event = 'debug:test', data = {} } = {}) => {
  return executeTest('test_socket', async () => {
    const { getSocketIO } = await import('../../config/socket.js');
    const io = getSocketIO();

    if (!io) {
      throw new Error('Socket.IO not initialized');
    }

    const testData = {
      ...data,
      debugTest: true,
      timestamp: new Date().toISOString(),
    };

    let targetClients = 0;

    if (room) {
      // Emit to specific room
      const roomSockets = await io.in(room).fetchSockets();
      targetClients = roomSockets.length;
      io.to(room).emit(event, testData);
    } else {
      // Emit to all connected clients
      targetClients = io.sockets.sockets.size;
      io.emit(event, testData);
    }

    return {
      event,
      room: room || 'all',
      targetClients,
      data: testData,
    };
  });
};

/**
 * Test database read/write operations
 * @returns {Promise<Object>} Test result
 */
export const testDatabase = async () => {
  return executeTest('test_database', async () => {
    const testCollectionName = '_debug_test';
    const testDoc = {
      testId: `test-${Date.now()}`,
      timestamp: new Date(),
      data: { test: true },
    };

    const results = {
      write: { success: false, time: 0 },
      read: { success: false, time: 0 },
      delete: { success: false, time: 0 },
    };

    // Get or create test collection
    const db = mongoose.connection.db;
    const collection = db.collection(testCollectionName);

    // Test write
    const writeStart = Date.now();
    const writeResult = await collection.insertOne(testDoc);
    results.write = {
      success: writeResult.acknowledged,
      time: Date.now() - writeStart,
      insertedId: writeResult.insertedId?.toString(),
    };

    // Test read
    const readStart = Date.now();
    const readResult = await collection.findOne({ testId: testDoc.testId });
    results.read = {
      success: !!readResult,
      time: Date.now() - readStart,
      found: !!readResult,
    };

    // Test delete
    const deleteStart = Date.now();
    const deleteResult = await collection.deleteOne({ testId: testDoc.testId });
    results.delete = {
      success: deleteResult.deletedCount === 1,
      time: Date.now() - deleteStart,
      deletedCount: deleteResult.deletedCount,
    };

    return {
      collection: testCollectionName,
      operations: results,
      totalTime: results.write.time + results.read.time + results.delete.time,
    };
  });
};

/**
 * Test notification system
 * @param {string} userId - User ID to send notification to (optional)
 * @returns {Promise<Object>} Test result
 */
export const testNotification = async (userId = null) => {
  return executeTest('test_notification', async () => {
    if (!userId) {
      // If no user ID provided, just test the notification creation flow
      // without actually persisting
      const { getSocketIO } = await import('../../jobs/notificationService.js');
      const socketAvailable = !!getSocketIO();
      
      return {
        dryRun: true,
        socketIOAvailable: socketAvailable,
        message: 'No userId provided - dry run completed',
      };
    }

    const { notifyUser } = await import('../../jobs/notificationService.js');
    
    const result = await notifyUser(userId, {
      type: 'info',
      title: 'Debug Test Notification',
      message: `Test notification from Debug Portal at ${new Date().toISOString()}`,
      data: {
        actionType: 'none',
        debugTest: true,
      },
    });

    return {
      dryRun: false,
      userId,
      notificationId: result.data?.notificationId?.toString(),
      success: result.success,
    };
  });
};

/**
 * Run all tests
 * @returns {Promise<Object>} Combined test results
 */
export const testAll = async () => {
  const startTime = Date.now();

  const [email, socket, database, notification] = await Promise.all([
    testEmail(),
    testSocket(),
    testDatabase(),
    testNotification(), // Dry run without userId
  ]);

  const results = { email, socket, database, notification };

  // Calculate overall success
  const allSuccessful = Object.values(results).every(r => r.success);

  return {
    overallSuccess: allSuccessful,
    timestamp: new Date().toISOString(),
    totalExecutionTime: Date.now() - startTime,
    tests: results,
  };
};

export default {
  testEmail,
  testSocket,
  testDatabase,
  testNotification,
  testAll,
};
