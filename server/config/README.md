# Configuration Management

## ConfigValidator

The `ConfigValidator` class provides centralized configuration validation and management for the Split-It application. It ensures all required environment variables are present at startup and provides type-safe access to configuration values.

### Features

- **Fail-fast validation**: Server won't start if required environment variables are missing
- **Type safety**: Automatic parsing and validation of number and boolean values
- **Default values**: Sensible defaults for optional configuration
- **Centralized schema**: Single source of truth for all configuration requirements

### Usage

#### Startup Validation

The ConfigValidator is automatically invoked during server startup in `server.js`:

```javascript
import { ConfigValidator } from './config/configValidator.js';

try {
  ConfigValidator.assertValidConfig();
  console.log('✓ Configuration validation passed');
} catch (error) {
  console.error('✗ Configuration validation failed:');
  console.error(error.message);
  process.exit(1);
}
```

#### Loading Configuration

```javascript
import { ConfigValidator } from './config/configValidator.js';

// Load entire configuration
const config = ConfigValidator.loadConfig();
console.log(config.database.mongodbUri);
console.log(config.server.port);

// Get specific value
const jwtSecret = ConfigValidator.get('auth', 'jwtSecret');
const port = ConfigValidator.get('server', 'port');

// Check if value is set
if (ConfigValidator.has('redis', 'url')) {
  // Redis is configured
}
```

#### Validating Configuration

```javascript
import { ConfigValidator } from './config/configValidator.js';

// Check validation status
const validation = ConfigValidator.validateRequired();
if (!validation.valid) {
  console.error('Missing variables:', validation.missing);
  console.error('Errors:', validation.errors);
}

// Assert valid (throws on failure)
ConfigValidator.assertValidConfig(); // Throws ConfigValidationError if invalid
```

### Configuration Schema

The configuration is organized into logical sections:

#### Server Configuration
- `PORT` (optional, default: 5000) - Server port
- `NODE_ENV` (optional, default: 'development') - Environment
- `SERVER_URL` (required) - Server URL
- `CLIENT_URL` (required) - Client URL

#### Database Configuration
- `MONGODB_URI` (required) - MongoDB connection string

#### Authentication Configuration
- `JWT_SECRET` (required) - JWT signing secret
- `JWT_EXPIRES_IN` (optional, default: '7d') - JWT expiration
- `GOOGLE_CLIENT_ID` (optional) - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` (optional) - Google OAuth client secret

#### Email Configuration
- `SMTP_HOST` (optional) - SMTP server host
- `SMTP_PORT` (optional, default: 587) - SMTP server port
- `SMTP_USER` (optional) - SMTP username
- `SMTP_PASS` (optional) - SMTP password
- `SMTP_FROM` (optional) - From email address
- `SMTP_SECURE` (optional) - Use TLS

#### Push Notifications Configuration
- `VAPID_PUBLIC_KEY` (optional) - VAPID public key
- `VAPID_PRIVATE_KEY` (optional) - VAPID private key
- `VAPID_EMAIL` (optional) - VAPID email

#### Redis Configuration
- `REDIS_URL` (optional) - Redis connection URL
- `REDIS_PASSWORD` (optional) - Redis password
- `REDIS_TLS` (optional, default: false) - Enable TLS

#### Debug Portal Configuration
- `DEBUG_ENABLED` (optional, default: false) - Enable debug portal
- `DEBUG_PATH` (optional) - Debug portal path
- `DEBUG_EMAIL` (optional) - Debug portal email
- `DEBUG_PASSWORD` (optional) - Debug portal password

### Error Handling

When validation fails, a `ConfigValidationError` is thrown with:
- `message`: Detailed error message
- `missingVars`: Array of missing required variables

Example:
```javascript
try {
  ConfigValidator.assertValidConfig();
} catch (error) {
  if (error instanceof ConfigValidationError) {
    console.error('Missing variables:', error.missingVars);
    // ['MONGODB_URI', 'JWT_SECRET']
  }
}
```

### Testing

Unit tests are provided in `tests/config/configValidator.test.js` covering:
- Required variable validation
- Default value application
- Type parsing (string, number, boolean)
- Error handling
- Startup failure scenarios

Run tests:
```bash
npm test tests/config/configValidator.test.js
```

### Requirements

This implementation satisfies:
- **Requirement 2.1**: Backend SHALL load all credentials from environment variables
- **Requirement 2.3**: Backend SHALL validate that all required environment variables are present at startup

### See Also

- `.env.example` - Example environment configuration
- `SETUP.md` - Setup instructions
- `DEPLOYMENT.md` - Deployment guide
