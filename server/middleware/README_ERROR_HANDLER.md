# ErrorHandler Middleware

## Overview

The ErrorHandler middleware provides secure error handling with sanitization to prevent information leakage. It implements Requirements 1.1, 1.3, 1.4, and 1.5 from the code-quality-security-fixes specification.

## Features

### 1. Error Sanitization
- Removes stack traces from client responses
- Redacts database collection names and field names
- Removes internal file paths (Unix and Windows)
- Sanitizes MongoDB query details
- Removes connection strings and IP addresses
- Prevents exposure of internal implementation details

### 2. Status Code Mapping
- Automatically maps error types to appropriate HTTP status codes
- Supports common error types: ValidationError, NotFoundError, ConflictError, etc.
- Defaults to 500 for unknown errors

### 3. Standard Error Response Format
All error responses follow a consistent format:
```json
{
  "code": "ERROR_CODE",
  "message": "User-friendly message",
  "requestId": "unique-request-id",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 4. Error Code Registry
- `AUTH_FAILED`: Authentication failure (401)
- `FORBIDDEN`: Authorization failure (403)
- `VALIDATION_ERROR`: Input validation failure (400)
- `NOT_FOUND`: Resource not found (404)
- `CONFLICT`: Optimistic lock or race condition (409)
- `INTERNAL_ERROR`: Unexpected server error (500)
- `BAD_REQUEST`: Bad request (400)
- `SERVICE_UNAVAILABLE`: Service unavailable (503)

### 5. Server-Side Logging
- Logs full error details including stack traces
- Includes request context (path, method, user ID, IP)
- Integrates with debug portal when enabled
- Uses appropriate log levels for production vs development

## Usage

### Basic Usage

The middleware is automatically applied to all routes in `server.js`:

```javascript
import { errorHandler } from './middleware/errorHandler.js';

// After all routes
app.use(errorHandler);
```

### Creating Custom Errors

Use the `createError` helper to create errors with specific status codes:

```javascript
import { createError } from './middleware/errorHandler.js';

// In a controller
if (!user) {
  throw createError('User not found', 404);
}

if (!authorized) {
  throw createError('Access denied', 403);
}
```

### Error Types

The middleware automatically recognizes these error types:

```javascript
// Authentication errors (401)
throw new Error('Unauthorized access');
error.name = 'UnauthorizedError';

// Authorization errors (403)
throw new Error('Forbidden');
error.name = 'ForbiddenError';

// Not found errors (404)
throw new Error('Resource not found');
error.name = 'NotFoundError';

// Validation errors (400)
throw new Error('Validation failed');
error.name = 'ValidationError';

// Conflict errors (409)
throw new Error('Version conflict');
error.name = 'ConflictError';
```

## Security Considerations

### What Gets Sanitized

The middleware removes the following from error messages:
- Stack traces
- Database collection names (e.g., "collection 'users'")
- Field names (e.g., "field 'email'")
- MongoDB operators (e.g., "$or", "$and")
- File paths (e.g., "/var/app/server/file.js")
- Connection strings (e.g., "mongodb://...")
- IP addresses (e.g., "192.168.1.1")
- Port numbers in context

### Generic Messages for 5xx Errors

All 500-level errors return a generic message to clients:
```
"An internal server error occurred. Please try again later."
```

This prevents leaking internal implementation details while still providing useful information for 4xx client errors.

### Request ID Tracking

Each error response includes a unique request ID that can be used for:
- Support ticket tracking
- Log correlation
- Debugging without exposing sensitive information

## Testing

### Unit Tests

Run the unit tests:
```bash
cd server
npm test tests/middleware/errorHandler.test.js
```

The test suite covers:
- Status code mapping for all error types
- Error sanitization (removing sensitive data)
- Standard error response format
- Server-side logging with full details
- Edge cases (no message, multiline messages, etc.)

### Integration Testing

To test the error handler in your controllers:

```javascript
import { createError } from '../middleware/errorHandler.js';

// In a controller
export const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw createError('User not found', 404);
    }
    res.json(user);
  } catch (error) {
    next(error); // Pass to error handler
  }
};
```

## Examples

### Example 1: Database Error

**Internal Error:**
```
Error: Query failed in collection "users" with field "email"
Stack: at Object.<anonymous> (/var/app/server/controllers/user.js:10:15)
```

**Client Response:**
```json
{
  "code": "INTERNAL_ERROR",
  "message": "An internal server error occurred. Please try again later.",
  "requestId": "1234567890-abc123",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Server Log:**
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "error": {
    "name": "Error",
    "message": "Query failed in collection \"users\" with field \"email\"",
    "stack": "at Object.<anonymous> (/var/app/server/controllers/user.js:10:15)",
    "status": 500
  },
  "context": {
    "requestId": "1234567890-abc123",
    "path": "/api/users/123",
    "method": "GET",
    "userId": "user123",
    "ip": "192.168.1.1"
  }
}
```

### Example 2: Validation Error

**Internal Error:**
```
ValidationError: Email is required
```

**Client Response:**
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Email is required",
  "requestId": "1234567890-def456",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Example 3: Not Found Error

**Internal Error:**
```
NotFoundError: User not found
```

**Client Response:**
```json
{
  "code": "NOT_FOUND",
  "message": "User not found",
  "requestId": "1234567890-ghi789",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Migration from Old Error Handler

The new error handler is a drop-in replacement for the old error handling code in `server.js`. The key differences:

### Old Approach
```javascript
app.use((err, req, res, next) => {
  console.error('Error occurred:', err);
  res.status(err.status || 500).json({
    message: err.message,
    stack: err.stack // ❌ Leaked in development
  });
});
```

### New Approach
```javascript
import { errorHandler } from './middleware/errorHandler.js';
app.use(errorHandler);
```

Benefits:
- ✅ Automatic sanitization of sensitive data
- ✅ Standard error response format
- ✅ Request ID tracking
- ✅ Proper status code mapping
- ✅ Comprehensive server-side logging
- ✅ No stack traces or internal details in client responses

## Maintenance

### Adding New Error Codes

To add a new error code:

1. Add to the `ERROR_CODES` object:
```javascript
const ERROR_CODES = {
  // ... existing codes
  NEW_ERROR: 'NEW_ERROR'
};
```

2. Update `getErrorCode()` to map status codes:
```javascript
function getErrorCode(statusCode) {
  switch (statusCode) {
    // ... existing cases
    case 418:
      return ERROR_CODES.NEW_ERROR;
    // ...
  }
}
```

3. Update tests to cover the new error code.

### Adding New Sanitization Patterns

To add new patterns to sanitize:

1. Add to `SENSITIVE_PATTERNS` array:
```javascript
const SENSITIVE_PATTERNS = [
  // ... existing patterns
  /new-pattern-to-redact/gi
];
```

2. Add tests to verify the pattern is sanitized.

## Related Files

- `server/middleware/errorHandler.js` - Main implementation
- `server/tests/middleware/errorHandler.test.js` - Unit tests
- `server/server.js` - Integration point
- `.kiro/specs/code-quality-security-fixes/requirements.md` - Requirements
- `.kiro/specs/code-quality-security-fixes/design.md` - Design document
