/**
 * Configuration Validator
 * 
 * Validates that all required environment variables are present at startup
 * and provides a centralized configuration object with defaults.
 * 
 * Requirements: 2.1, 2.3
 */

/**
 * Configuration schema defining required and optional environment variables
 */
const CONFIG_SCHEMA = {
  // Server configuration
  server: {
    port: { env: 'PORT', required: false, default: 5000, type: 'number' },
    nodeEnv: { env: 'NODE_ENV', required: false, default: 'development', type: 'string' },
    serverUrl: { env: 'SERVER_URL', required: true, type: 'string' },
    clientUrl: { env: 'CLIENT_URL', required: true, type: 'string' },
  },
  
  // Database configuration
  database: {
    mongodbUri: { env: 'MONGODB_URI', required: true, type: 'string' },
  },
  
  // Authentication configuration
  auth: {
    jwtSecret: { env: 'JWT_SECRET', required: true, type: 'string' },
    jwtExpiresIn: { env: 'JWT_EXPIRES_IN', required: false, default: '7d', type: 'string' },
    googleClientId: { env: 'GOOGLE_CLIENT_ID', required: false, type: 'string' },
    googleClientSecret: { env: 'GOOGLE_CLIENT_SECRET', required: false, type: 'string' },
  },
  
  // Email configuration
  email: {
    smtpHost: { env: 'SMTP_HOST', required: false, type: 'string' },
    smtpPort: { env: 'SMTP_PORT', required: false, default: 587, type: 'number' },
    smtpUser: { env: 'SMTP_USER', required: false, type: 'string' },
    smtpPass: { env: 'SMTP_PASS', required: false, type: 'string' },
    smtpFrom: { env: 'SMTP_FROM', required: false, type: 'string' },
    smtpSecure: { env: 'SMTP_SECURE', required: false, type: 'boolean' },
  },
  
  // Push notifications configuration
  push: {
    vapidPublicKey: { env: 'VAPID_PUBLIC_KEY', required: false, type: 'string' },
    vapidPrivateKey: { env: 'VAPID_PRIVATE_KEY', required: false, type: 'string' },
    vapidEmail: { env: 'VAPID_EMAIL', required: false, type: 'string' },
  },
  
  // Redis configuration (optional)
  redis: {
    url: { env: 'REDIS_URL', required: false, type: 'string' },
    password: { env: 'REDIS_PASSWORD', required: false, type: 'string' },
    tls: { env: 'REDIS_TLS', required: false, default: false, type: 'boolean' },
  },
  
  // Debug portal configuration
  debug: {
    enabled: { env: 'DEBUG_ENABLED', required: false, default: false, type: 'boolean' },
    path: { env: 'DEBUG_PATH', required: false, default: '/__system/debug-portal-92xA', type: 'string' },
    email: { env: 'DEBUG_EMAIL', required: false, type: 'string' },
    password: { env: 'DEBUG_PASSWORD', required: false, type: 'string' },
  },
};

/**
 * Validation error class
 */
class ConfigValidationError extends Error {
  constructor(message, missingVars = []) {
    super(message);
    this.name = 'ConfigValidationError';
    this.missingVars = missingVars;
  }
}

/**
 * ConfigValidator class
 */
class ConfigValidator {
  /**
   * Parse environment variable value based on type
   */
  static parseValue(value, type) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    
    switch (type) {
      case 'number':
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(`Invalid number value: ${value}`);
        }
        return num;
      
      case 'boolean':
        if (typeof value === 'boolean') return value;
        return value === 'true' || value === '1';
      
      case 'string':
      default:
        return String(value);
    }
  }
  
  /**
   * Validate that all required environment variables are present
   * 
   * @returns {Object} Validation result with { valid: boolean, missing: string[], errors: string[] }
   */
  static validateRequired() {
    const missing = [];
    const errors = [];
    
    // Iterate through all configuration sections
    for (const [section, fields] of Object.entries(CONFIG_SCHEMA)) {
      for (const [fieldName, config] of Object.entries(fields)) {
        const envValue = process.env[config.env];
        
        // Check if required field is missing
        if (config.required && !envValue) {
          missing.push(config.env);
        }
        
        // Validate type if value is present
        if (envValue) {
          try {
            this.parseValue(envValue, config.type);
          } catch (error) {
            errors.push(`${config.env}: ${error.message}`);
          }
        }
      }
    }
    
    return {
      valid: missing.length === 0 && errors.length === 0,
      missing,
      errors,
    };
  }
  
  /**
   * Load configuration with defaults
   * 
   * @returns {Object} Configuration object with all values
   */
  static loadConfig() {
    const config = {};
    
    // Iterate through all configuration sections
    for (const [section, fields] of Object.entries(CONFIG_SCHEMA)) {
      config[section] = {};
      
      for (const [fieldName, fieldConfig] of Object.entries(fields)) {
        const envValue = process.env[fieldConfig.env];
        
        // Use environment value if present, otherwise use default
        if (envValue !== undefined && envValue !== null && envValue !== '') {
          try {
            config[section][fieldName] = this.parseValue(envValue, fieldConfig.type);
          } catch (error) {
            // If parsing fails and there's a default, use it
            if (fieldConfig.default !== undefined) {
              config[section][fieldName] = fieldConfig.default;
            } else {
              throw new ConfigValidationError(
                `Failed to parse ${fieldConfig.env}: ${error.message}`
              );
            }
          }
        } else if (fieldConfig.default !== undefined) {
          config[section][fieldName] = fieldConfig.default;
        } else {
          config[section][fieldName] = undefined;
        }
      }
    }
    
    return config;
  }
  
  /**
   * Assert that configuration is valid, fail fast if not
   * 
   * @throws {ConfigValidationError} If configuration is invalid
   */
  static assertValidConfig() {
    const validation = this.validateRequired();
    
    if (!validation.valid) {
      const errorMessages = [];
      
      if (validation.missing.length > 0) {
        errorMessages.push(
          `Missing required environment variables: ${validation.missing.join(', ')}`
        );
      }
      
      if (validation.errors.length > 0) {
        errorMessages.push(
          `Configuration errors: ${validation.errors.join('; ')}`
        );
      }
      
      throw new ConfigValidationError(
        `Configuration validation failed:\n${errorMessages.join('\n')}`,
        validation.missing
      );
    }
  }
  
  /**
   * Get a specific configuration value
   * 
   * @param {string} section - Configuration section (e.g., 'server', 'database')
   * @param {string} field - Field name within the section
   * @returns {*} Configuration value
   */
  static get(section, field) {
    const config = this.loadConfig();
    return config[section]?.[field];
  }
  
  /**
   * Check if a configuration value is set
   * 
   * @param {string} section - Configuration section
   * @param {string} field - Field name within the section
   * @returns {boolean} True if value is set (not undefined)
   */
  static has(section, field) {
    const value = this.get(section, field);
    return value !== undefined && value !== null;
  }
}

export { ConfigValidator, ConfigValidationError, CONFIG_SCHEMA };
export default ConfigValidator;
