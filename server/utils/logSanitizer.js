/**
 * Log Sanitizer for Split-It
 * 
 * Provides PII (Personally Identifiable Information) sanitization for logs
 * to maintain user privacy and regulatory compliance.
 * 
 * Redacts:
 * - Email addresses
 * - Device tokens (64+ character hex strings)
 * - JWT tokens
 * - Phone numbers
 * 
 * Usage:
 *   const sanitizer = new LogSanitizer();
 *   const safe = sanitizer.sanitize('User email@example.com logged in');
 *   // => 'User [REDACTED_EMAIL] logged in'
 */

/**
 * PII patterns for detection and redaction
 */
const PII_PATTERNS = {
  // Email addresses: user@domain.com
  email: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[REDACTED_EMAIL]'
  },
  
  // Device tokens: 64+ character hexadecimal strings
  deviceToken: {
    pattern: /\b[A-Fa-f0-9]{64,}\b/g,
    replacement: '[REDACTED_TOKEN]'
  },
  
  // JWT tokens: eyJ... format
  jwt: {
    pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    replacement: '[REDACTED_JWT]'
  },
  
  // Phone numbers: various formats (123-456-7890, 123.456.7890, 1234567890)
  phone: {
    pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    replacement: '[REDACTED_PHONE]'
  }
};

/**
 * Sensitive field names that should be redacted in objects
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'authorization',
  'auth',
  'apiKey',
  'api_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'deviceToken',
  'device_token',
  'twoFactorSecret',
  'two_factor_secret',
  'backupCode',
  'backup_code',
  'ssn',
  'creditCard',
  'credit_card',
  'cvv',
  'pin'
];

/**
 * LogSanitizer Class
 * 
 * Sanitizes log messages and objects to remove PII
 */
class LogSanitizer {
  constructor() {
    this.patterns = PII_PATTERNS;
    this.sensitiveFields = SENSITIVE_FIELDS;
  }

  /**
   * Sanitize a string message by redacting PII patterns
   * 
   * @param {string} message - The message to sanitize
   * @returns {string} Sanitized message with PII redacted
   * 
   * @example
   * sanitizer.sanitize('User email@example.com logged in')
   * // => 'User [REDACTED_EMAIL] logged in'
   */
  sanitize(message) {
    if (typeof message !== 'string') {
      return message;
    }

    let sanitized = message;

    // Apply all PII patterns
    for (const [key, { pattern, replacement }] of Object.entries(this.patterns)) {
      sanitized = sanitized.replace(pattern, replacement);
    }

    return sanitized;
  }

  /**
   * Sanitize an object by redacting PII in values and sensitive fields
   * 
   * @param {any} obj - The object to sanitize (can be any type)
   * @param {WeakSet} [seen] - Set to track visited objects (for circular reference detection)
   * @returns {any} Sanitized object with PII redacted
   * 
   * @example
   * sanitizer.sanitizeObject({ email: 'user@example.com', name: 'John' })
   * // => { email: '[REDACTED_EMAIL]', name: 'John' }
   */
  sanitizeObject(obj, seen = new WeakSet()) {
    // Handle null/undefined
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Handle primitives
    if (typeof obj !== 'object') {
      if (typeof obj === 'string') {
        return this.sanitize(obj);
      }
      return obj;
    }

    // Handle special object types (Date, RegExp, etc.)
    if (obj instanceof Date) {
      return obj;
    }
    if (obj instanceof RegExp) {
      return obj;
    }
    if (typeof obj === 'function') {
      return obj;
    }

    // Check for circular references
    if (seen.has(obj)) {
      return '[Circular]';
    }
    seen.add(obj);

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, seen));
    }

    // Handle objects
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      // Check if field name is sensitive
      const isSensitiveField = this.sensitiveFields.some(
        field => lowerKey.includes(field.toLowerCase())
      );
      
      if (isSensitiveField) {
        // Redact entire field value
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        // Sanitize string values
        sanitized[key] = this.sanitize(value);
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = this.sanitizeObject(value, seen);
      } else {
        // Keep other types as-is
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize a stack trace by redacting PII
   * 
   * Stack traces may contain PII in error messages or file paths.
   * This method sanitizes the stack trace while preserving structure.
   * 
   * @param {string} stack - The stack trace to sanitize
   * @returns {string} Sanitized stack trace
   * 
   * @example
   * sanitizer.sanitizeStackTrace('Error: Invalid email user@example.com\n  at ...')
   * // => 'Error: Invalid email [REDACTED_EMAIL]\n  at ...'
   */
  sanitizeStackTrace(stack) {
    if (typeof stack !== 'string') {
      return stack;
    }

    // Sanitize each line of the stack trace
    const lines = stack.split('\n');
    const sanitizedLines = lines.map(line => this.sanitize(line));
    
    return sanitizedLines.join('\n');
  }

  /**
   * Check if a string contains PII
   * 
   * @param {string} text - Text to check
   * @returns {boolean} True if PII is detected
   */
  containsPII(text) {
    if (typeof text !== 'string') {
      return false;
    }

    for (const { pattern } of Object.values(this.patterns)) {
      // Reset regex lastIndex to avoid state issues with global regexes
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Add a custom PII pattern
   * 
   * @param {string} name - Pattern name
   * @param {RegExp} pattern - Regular expression to match PII
   * @param {string} replacement - Replacement text
   */
  addPattern(name, pattern, replacement) {
    this.patterns[name] = { pattern, replacement };
  }

  /**
   * Add a custom sensitive field name
   * 
   * @param {string} fieldName - Field name to treat as sensitive
   */
  addSensitiveField(fieldName) {
    if (!this.sensitiveFields.includes(fieldName)) {
      this.sensitiveFields.push(fieldName);
    }
  }
}

// Export singleton instance
const sanitizer = new LogSanitizer();

// Export class and instance
export { LogSanitizer, PII_PATTERNS, SENSITIVE_FIELDS };
export default sanitizer;
