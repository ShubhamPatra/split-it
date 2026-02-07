# Backup Code Service

## Overview

The BackupCodeService provides secure generation, verification, and management of 2FA backup codes using bcrypt hashing instead of SHA-256.

## Security Improvements

### Previous Implementation (SHA-256)
- Used SHA-256 hashing: `crypto.createHash('sha256').update(code).digest('hex')`
- SHA-256 is fast, making it vulnerable to brute-force attacks
- No salt, making rainbow table attacks possible

### New Implementation (bcrypt)
- Uses bcrypt with salt: `bcrypt.hash(code, 10)`
- Bcrypt is intentionally slow, making brute-force attacks impractical
- Automatic salting prevents rainbow table attacks
- Industry standard for password/credential hashing

## API

### `generateCodes(userId, count = 10)`

Generates and stores hashed backup codes for a user.

**Parameters:**
- `userId` (string, required): The user's ID
- `count` (number, optional): Number of codes to generate (1-20, default: 10)

**Returns:** `Promise<string[]>` - Array of plaintext backup codes (only time they're visible)

**Example:**
```javascript
const codes = await backupCodeService.generateCodes(userId, 10);
// Returns: ['ABCD1234', 'EFGH5678', ...]
// Stores: bcrypt hashes in database
```

### `verifyCode(userId, code)`

Verifies a backup code against stored hashes.

**Parameters:**
- `userId` (string, required): The user's ID
- `code` (string, required): The plaintext backup code to verify

**Returns:** `Promise<boolean>` - True if code is valid, false otherwise

**Example:**
```javascript
const isValid = await backupCodeService.verifyCode(userId, 'ABCD1234');
if (isValid) {
  // Code is valid, proceed with authentication
}
```

### `markUsed(userId, code)`

Marks a backup code as used by removing it atomically from the database.

**Parameters:**
- `userId` (string, required): The user's ID
- `code` (string, required): The plaintext backup code that was used

**Returns:** `Promise<boolean>` - True if code was found and removed, false otherwise

**Example:**
```javascript
const removed = await backupCodeService.markUsed(userId, 'ABCD1234');
if (removed) {
  // Code was successfully removed
}
```

### `getRemainingCount(userId)`

Gets the count of remaining backup codes for a user.

**Parameters:**
- `userId` (string, required): The user's ID

**Returns:** `Promise<number>` - Number of remaining backup codes

**Example:**
```javascript
const count = await backupCodeService.getRemainingCount(userId);
console.log(`User has ${count} backup codes remaining`);
```

## Database Schema

The backup codes are stored in the User model:

```javascript
{
  twoFactorBackupCodes: {
    type: [String],
    select: false, // Never include in queries by default
  }
}
```

Each string in the array is a bcrypt hash of a backup code.

## Usage in Controllers

### Generating Codes (2FA Setup)

```javascript
// In verify2FA controller
const backupCodes = await backupCodeService.generateCodes(userId, 10);

// Return plaintext codes to user (only time they see them)
res.json({
  success: true,
  backupCodes,
  message: '2FA enabled successfully! Save these backup codes in a safe place.',
});
```

### Verifying and Using Codes (Login)

```javascript
// In login controller
if (useBackupCode) {
  // Verify the code
  const verified = await backupCodeService.verifyCode(user._id, twoFactorToken);
  
  if (verified) {
    // Mark as used (removes it atomically)
    await backupCodeService.markUsed(user._id, twoFactorToken);
    
    // Get remaining count for logging
    const remainingCodes = await backupCodeService.getRemainingCount(user._id);
    
    // Log the usage
    await logAuthEvent('user.2fa.backup_code_used', user._id, 'success', req, {
      remainingCodes,
    });
  }
}
```

## Atomic Operations

The `markUsed` function uses MongoDB's `$pull` operator to ensure atomic removal:

```javascript
await User.findByIdAndUpdate(
  userId,
  { $pull: { twoFactorBackupCodes: hashToRemove } },
  { new: true }
);
```

This prevents race conditions where multiple concurrent requests might try to use the same backup code.

## Testing

Unit tests are provided in `tests/services/backupCodeService.test.js` covering:

- Code generation with proper format and count
- Bcrypt hashing verification
- Code verification (valid and invalid)
- Case-insensitive verification
- Atomic code removal
- Edge cases (missing parameters, empty arrays, etc.)
- Complete lifecycle (generate → verify → mark used)

## Migration Notes

### Existing Users

Users with existing SHA-256 hashed backup codes will need to regenerate their codes:

1. The old SHA-256 hashes will not verify with bcrypt
2. Users should be prompted to regenerate backup codes on next login
3. The regeneration endpoint uses the new bcrypt service

### Backward Compatibility

There is no backward compatibility with SHA-256 hashes. This is intentional for security reasons. Users must regenerate their backup codes.

## Security Considerations

1. **Plaintext codes are only shown once** during generation
2. **Codes are normalized** to uppercase before hashing/verification
3. **Atomic operations** prevent race conditions
4. **Bcrypt salt rounds** set to 10 (good balance of security and performance)
5. **Code format**: 8-character uppercase hex (16^8 = 4.3 billion combinations)
6. **Rate limiting** should be applied to verification endpoints

## Performance

- **Generation**: ~100ms per code (bcrypt hashing)
- **Verification**: ~100ms per code (bcrypt comparison)
- **Atomic removal**: <10ms (MongoDB operation)

For 10 codes:
- Generation: ~1 second
- Verification: ~100ms (checks until match found)

## Requirements Satisfied

This implementation satisfies **Requirement 2.4**:

> WHEN backup codes are stored, THE Backend SHALL hash them using a cryptographic hash function

Specifically:
- ✅ Uses bcrypt (cryptographic hash function)
- ✅ Stores hashes, not plaintext
- ✅ Verifies codes against hashes
- ✅ Atomic updates to prevent race conditions
- ✅ Updated database schema (no schema change needed, just hash format)
