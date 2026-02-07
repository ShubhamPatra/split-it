# LogSanitizer

## Overview

The LogSanitizer is a utility class that provides PII (Personally Identifiable Information) sanitization for log messages and objects. It helps maintain user privacy and regulatory compliance by automatically redacting sensitive information from logs.

## Features

- **String Sanitization**: Redacts PII patterns from log messages
- **Object Sanitization**: Recursively sanitizes objects and arrays
- **Stack Trace Sanitization**: Cleans error stack traces while preserving structure
- **Circular Reference Handling**: Safely handles objects with circular references
- **Custom Patterns**: Allows adding custom PII patterns
- **Sensitive Field Detection**: Automatically redacts fields with sensitive names

## PII Patterns

The LogSanitizer detects and redacts the following PII patterns:

| Pattern | Description | Replacement |
|---------|-------------|-------------|
| Email | Email addresses (user@domain.com) | `[REDACTED_EMAIL]` |
| Device Token | 64+ character hexadecimal strings | `[REDACTED_TOKEN]` |
| JWT | JSON Web Tokens (eyJ...) | `[REDACTED_JWT]` |
| Phone | Phone numbers (various formats) | `[REDACTED_PHONE]` |

## Sensitive Fields

The following field names are automatically redacted:

- `password`, `token`, `secret`, `authorization`, `auth`
- `apiKey`, `api_key`, `accessToken`, `access_token`
- `refreshToken`, `refresh_token`, `deviceToken`, `device_token`
- `twoFactorSecret`, `two_factor_secret`, `backupCode`, `backup_code`
- `ssn`, `creditCard`, `credit_card`, `cvv`, `pin`

## Usage

### Basic String Sanitization

```javascript
import sanitizer from './utils/logSanitizer.js';

const message = 'User john@example.com logged in with token eyJhbGci...';
const safe = sanitizer.sanitize(message);
// => 'User [REDACTED_EMAIL] logged in with token [REDACTED_JWT]'
```

### Object Sanitization

```javascript
const data = {
  user: {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'secret123'
  },
  token: 'abc123xyz'
};

const safe = sanitizer.sanitizeObject(data);
// => {
//   user: {
//     name: 'John Doe',
//     email: '[REDACTED_EMAIL]',
//     password: '[REDACTED]'
//   },
//   token: '[REDACTED]'
// }
```

### Stack Trace Sanitization

```javascript
try {
  // Some operation that fails
} catch (error) {
  const safeStack = sanitizer.sanitizeStackTrace(error.stack);
  logger.error('Operation failed', { stack: safeStack });
}
```

### Integration with Logger

```javascript
import logger from './utils/structuredLogger.js';
import sanitizer from './utils/logSanitizer.js';

// Sanitize log messages
logger.info(sanitizer.sanitize('User john@example.com logged in'));

// Sanitize metadata objects
logger.error('Request failed', sanitizer.sanitizeObject({
  user: req.user,
  headers: req.headers,
  body: req.body
}));
```

### Check for PII

```javascript
const text = 'Contact us at support@example.com';
if (sanitizer.containsPII(text)) {
  console.log('Warning: PII detected in message');
}
```

### Custom Patterns

```javascript
// Add custom PII pattern
const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g;
sanitizer.addPattern('ssn', ssnPattern, '[REDACTED_SSN]');

// Add custom sensitive field
sanitizer.addSensitiveField('customSecret');
```

## API Reference

### `sanitize(message: string): string`

Sanitizes a string message by redacting PII patterns.

**Parameters:**
- `message` - The message to sanitize

**Returns:** Sanitized message with PII redacted

### `sanitizeObject(obj: any): any`

Sanitizes an object by redacting PII in values and sensitive fields.

**Parameters:**
- `obj` - The object to sanitize (can be any type)

**Returns:** Sanitized object with PII redacted

**Features:**
- Recursively sanitizes nested objects and arrays
- Handles circular references safely
- Preserves Date, RegExp, and function objects
- Redacts fields with sensitive names

### `sanitizeStackTrace(stack: string): string`

Sanitizes a stack trace by redacting PII while preserving structure.

**Parameters:**
- `stack` - The stack trace to sanitize

**Returns:** Sanitized stack trace

### `containsPII(text: string): boolean`

Checks if a string contains PII.

**Parameters:**
- `text` - Text to check

**Returns:** `true` if PII is detected, `false` otherwise

### `addPattern(name: string, pattern: RegExp, replacement: string): void`

Adds a custom PII pattern.

**Parameters:**
- `name` - Pattern name
- `pattern` - Regular expression to match PII
- `replacement` - Replacement text

### `addSensitiveField(fieldName: string): void`

Adds a custom sensitive field name.

**Parameters:**
- `fieldName` - Field name to treat as sensitive

## Best Practices

### 1. Sanitize All User Data

Always sanitize user data before logging:

```javascript
// ❌ Bad - logs raw user data
logger.info('User logged in', { user: req.user });

// ✅ Good - sanitizes user data
logger.info('User logged in', sanitizer.sanitizeObject({ user: req.user }));
```

### 2. Sanitize Error Details

Sanitize error messages and stack traces:

```javascript
// ❌ Bad - may contain PII in error message
logger.error('Error occurred', { error: error.message, stack: error.stack });

// ✅ Good - sanitizes error details
logger.error(sanitizer.sanitize('Error occurred'), {
  error: sanitizer.sanitize(error.message),
  stack: sanitizer.sanitizeStackTrace(error.stack)
});
```

### 3. Sanitize Request/Response Data

Always sanitize HTTP request and response data:

```javascript
// ❌ Bad - logs raw headers and body
logger.http('Request received', {
  headers: req.headers,
  body: req.body
});

// ✅ Good - sanitizes request data
logger.http('Request received', sanitizer.sanitizeObject({
  headers: req.headers,
  body: req.body
}));
```

### 4. Use in Middleware

Create middleware to automatically sanitize logs:

```javascript
export const sanitizedLoggingMiddleware = (req, res, next) => {
  // Override logger methods to auto-sanitize
  const originalLogger = req.logger;
  req.logger = {
    info: (msg, meta) => originalLogger.info(
      sanitizer.sanitize(msg),
      sanitizer.sanitizeObject(meta)
    ),
    error: (msg, meta) => originalLogger.error(
      sanitizer.sanitize(msg),
      sanitizer.sanitizeObject(meta)
    ),
    // ... other methods
  };
  next();
};
```

## Performance Considerations

- **String Sanitization**: O(n) where n is the string length
- **Object Sanitization**: O(n) where n is the number of properties (recursive)
- **Circular Reference Detection**: Uses WeakSet for O(1) lookup
- **Regex Matching**: Global regexes are reset after each use to avoid state issues

## Testing

The LogSanitizer includes comprehensive unit tests covering:

- String sanitization for all PII patterns
- Object sanitization with nested structures
- Stack trace sanitization
- Edge cases (circular references, special objects, unicode)
- Custom patterns and sensitive fields

Run tests:

```bash
npm test -- logSanitizer.test.js
```

## Security Notes

1. **Defense in Depth**: LogSanitizer is one layer of security. Always follow secure coding practices.
2. **Pattern Limitations**: Regex patterns may not catch all PII variations. Review and update patterns regularly.
3. **False Positives**: Some legitimate data may be redacted. Balance security with usability.
4. **Performance**: Sanitization adds overhead. Use judiciously in high-throughput scenarios.

## Related Documentation

- [Structured Logging Guide](../docs/STRUCTURED_LOGGING_GUIDE.md)
- [Security Audit Logging](../docs/SECURITY_AUDIT_LOGGING.md)
- [Error Tracking Guide](../docs/ERROR_TRACKING_GUIDE.md)

## Requirements Validation

This implementation validates the following requirements:

- **Requirement 3.1**: Redacts email addresses, device tokens, and authentication credentials
- **Requirement 3.2**: Sanitizes stack traces to remove PII
- **Requirement 3.3**: Implements log sanitization function applied to all log outputs
- **Requirement 3.4**: Excludes authorization headers and sensitive body fields

## License

Part of the Split-It expense tracking application.
