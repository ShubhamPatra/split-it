/**
 * Test data and utilities for E2E tests
 */

// Generate unique test data to avoid conflicts
const timestamp = Date.now();

module.exports = {
  // Test user credentials
  testUser: {
    name: `Test User ${timestamp}`,
    email: `testuser${timestamp}@example.com`,
    password: 'TestPassword123!',
  },

  // Second test user for multi-user scenarios
  testUser2: {
    name: `Test User 2 ${timestamp}`,
    email: `testuser2${timestamp}@example.com`,
    password: 'TestPassword123!',
  },

  // Test group data
  testGroup: {
    name: `Test Group ${timestamp}`,
  },

  // Test expense data
  testExpense: {
    description: 'Test Dinner',
    amount: '500',
    category: 'food',
  },

  // Test settlement data
  testSettlement: {
    amount: '250',
    paymentMethod: 'cash',
    notes: 'Test settlement payment',
  },

  // API endpoints
  apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
};
