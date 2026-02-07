/**
 * Backup Code Service
 * 
 * Handles generation, hashing, and verification of 2FA backup codes.
 * Uses bcrypt for secure hashing instead of SHA-256.
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';

/**
 * Generate random backup codes
 * @param {number} count - Number of codes to generate
 * @returns {string[]} Array of unhashed backup codes
 */
function generateRandomCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Hash a single backup code using bcrypt
 * @param {string} code - The plaintext backup code
 * @returns {Promise<string>} The bcrypt hash
 */
async function hashCode(code) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(code.toUpperCase(), salt);
}

/**
 * Generate and hash backup codes for a user
 * @param {string} userId - The user's ID
 * @param {number} count - Number of codes to generate (default: 10)
 * @returns {Promise<string[]>} Array of plaintext backup codes (to show to user)
 */
export async function generateCodes(userId, count = 10) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  if (count < 1 || count > 20) {
    throw new Error('Code count must be between 1 and 20');
  }

  // Generate random codes
  const codes = generateRandomCodes(count);

  // Hash all codes
  const hashedCodes = await Promise.all(
    codes.map(code => hashCode(code))
  );

  // Store hashed codes in user document
  await User.findByIdAndUpdate(userId, {
    twoFactorBackupCodes: hashedCodes
  });

  // Return plaintext codes to show to user (only time they'll see them)
  return codes;
}

/**
 * Verify a backup code against stored hashes
 * @param {string} userId - The user's ID
 * @param {string} code - The plaintext backup code to verify
 * @returns {Promise<boolean>} True if code is valid, false otherwise
 */
export async function verifyCode(userId, code) {
  if (!userId || !code) {
    return false;
  }

  // Get user with backup codes
  const user = await User.findById(userId).select('+twoFactorBackupCodes');

  if (!user || !user.twoFactorBackupCodes || user.twoFactorBackupCodes.length === 0) {
    return false;
  }

  // Normalize the code
  const normalizedCode = code.toUpperCase().trim();

  // Check against each stored hash
  for (const hash of user.twoFactorBackupCodes) {
    const isMatch = await bcrypt.compare(normalizedCode, hash);
    if (isMatch) {
      return true;
    }
  }

  return false;
}

/**
 * Atomically verify and consume a backup code (fixes TOCTOU race condition)
 * This is the preferred method - verifies and removes the code in a single transaction
 * @param {string} userId - The user's ID
 * @param {string} code - The plaintext backup code to consume
 * @returns {Promise<{valid: boolean, remainingCodes: number}>} Result with validity and remaining count
 */
export async function consumeBackupCode(userId, code) {
  if (!userId || !code) {
    return { valid: false, remainingCodes: 0 };
  }

  // Get user with backup codes
  const user = await User.findById(userId).select('+twoFactorBackupCodes');

  if (!user || !user.twoFactorBackupCodes || user.twoFactorBackupCodes.length === 0) {
    return { valid: false, remainingCodes: 0 };
  }

  // Normalize the code
  const normalizedCode = code.toUpperCase().trim();

  // Find which hash matches
  let matchingHash = null;
  for (const hash of user.twoFactorBackupCodes) {
    const isMatch = await bcrypt.compare(normalizedCode, hash);
    if (isMatch) {
      matchingHash = hash;
      break;
    }
  }

  if (!matchingHash) {
    return { valid: false, remainingCodes: user.twoFactorBackupCodes.length };
  }

  // Atomically remove the code using findOneAndUpdate with the hash in query
  // This ensures another request can't use the same code between verify and remove
  const result = await User.findOneAndUpdate(
    {
      _id: userId,
      twoFactorBackupCodes: matchingHash  // Only match if hash still exists
    },
    {
      $pull: { twoFactorBackupCodes: matchingHash }
    },
    { new: true, select: '+twoFactorBackupCodes' }
  );

  // If result is null, the code was already consumed by another request
  if (!result) {
    return { valid: false, remainingCodes: 0 };
  }

  return {
    valid: true,
    remainingCodes: result.twoFactorBackupCodes?.length || 0
  };
}

/**
 * Mark a backup code as used (remove it atomically)
 * @deprecated Use consumeBackupCode instead to avoid TOCTOU race
 * @param {string} userId - The user's ID
 * @param {string} code - The plaintext backup code that was used
 * @returns {Promise<boolean>} True if code was found and removed, false otherwise
 */
export async function markUsed(userId, code) {
  if (!userId || !code) {
    return false;
  }

  // Get user with backup codes
  const user = await User.findById(userId).select('+twoFactorBackupCodes');

  if (!user || !user.twoFactorBackupCodes || user.twoFactorBackupCodes.length === 0) {
    return false;
  }

  // Normalize the code
  const normalizedCode = code.toUpperCase().trim();

  // Find which hash matches
  let matchingHashIndex = -1;
  for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
    const isMatch = await bcrypt.compare(normalizedCode, user.twoFactorBackupCodes[i]);
    if (isMatch) {
      matchingHashIndex = i;
      break;
    }
  }

  if (matchingHashIndex === -1) {
    return false;
  }

  // Remove the used code atomically using $pull
  // We need to pull the exact hash value
  const hashToRemove = user.twoFactorBackupCodes[matchingHashIndex];

  const result = await User.findByIdAndUpdate(
    userId,
    {
      $pull: { twoFactorBackupCodes: hashToRemove }
    },
    { new: true }
  );

  return result !== null;
}

/**
 * Get the count of remaining backup codes for a user
 * @param {string} userId - The user's ID
 * @returns {Promise<number>} Number of remaining backup codes
 */
export async function getRemainingCount(userId) {
  if (!userId) {
    return 0;
  }

  const user = await User.findById(userId).select('+twoFactorBackupCodes');

  if (!user || !user.twoFactorBackupCodes) {
    return 0;
  }

  return user.twoFactorBackupCodes.length;
}

const backupCodeService = {
  generateCodes,
  verifyCode,
  consumeBackupCode,
  markUsed,
  getRemainingCount,
};

export default backupCodeService;
