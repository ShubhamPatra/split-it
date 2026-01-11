/**
 * Jest Configuration for Split-It Server
 * Configured for ES Modules and MongoDB integration tests
 */

export default {
  // Use ESM
  transform: {},
  
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js',
  ],
  
  // Files to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/build/',
  ],
  
  // Module file extensions
  moduleFileExtensions: ['js', 'mjs', 'json'],
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Coverage settings
  collectCoverageFrom: [
    'controllers/**/*.js',
    'models/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    '!**/node_modules/**',
  ],
  
  coverageDirectory: 'coverage',
  
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  
  // Timeouts
  testTimeout: 30000,
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Force exit after tests complete
  forceExit: true,
  
  // Detect open handles
  detectOpenHandles: true,
  
  // Max workers for parallel testing (limit for MongoDB tests)
  maxWorkers: 1,
};
