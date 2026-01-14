import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import crypto from 'crypto';

// Refresh token settings
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
const ACCESS_TOKEN_EXPIRY = '7d';

// In-memory token stores (single instance deployment)
// Exported for use in authController logout and socket auth
export const tokenBlacklist = new Map(); // token -> expiry timestamp
export const refreshTokens = new Map(); // refreshToken -> { userId, jti, createdAt, expiry }

/**
 * Verify a token and check if it's blacklisted
 * Shared helper for HTTP auth and WebSocket auth
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload if valid
 * @throws {Error} If token is blacklisted, invalid, or expired
 */
export const verifyTokenWithBlacklist = (token) => {
  // Check if token is blacklisted
  const blacklistExpiry = tokenBlacklist.get(token);
  if (blacklistExpiry && blacklistExpiry > Date.now()) {
    const error = new Error('Token revoked');
    error.code = 'TOKEN_REVOKED';
    throw error;
  }

  // Verify JWT signature and expiry
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return decoded;
};

// Cleanup expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of tokenBlacklist.entries()) {
    if (expiry < now) tokenBlacklist.delete(token);
  }
  for (const [token, data] of refreshTokens.entries()) {
    if (data.expiry < now) refreshTokens.delete(token);
  }
}, 5 * 60 * 1000);

export const protect = async (req, res, next) => {
  let token;

  // Check for HttpOnly cookie first (preferred)
  if (req.cookies && req.cookies.auth_token) {
    token = req.cookies.auth_token;
  }
  // Fallback to Authorization header for backwards compatibility
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    // Use shared verification helper (checks blacklist + verifies JWT)
    const decoded = verifyTokenWithBlacklist(token);

    // Get user from token
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }

    next();
  } catch (error) {
    if (error.code === 'TOKEN_REVOKED') {
      return res.status(401).json({ message: 'Token revoked' });
    }
    console.error(error);
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

export const authMiddleware = protect; // Alias for consistency

export const logout = async (req, res) => {
  const token = req.cookies?.auth_token || req.headers.authorization?.split(' ')[1];
  if (token) {
    // Blacklist token until expiry
    try {
      const decoded = jwt.decode(token);
      if (decoded?.exp) {
        const expiryTime = decoded.exp * 1000; // Convert to ms
        if (expiryTime > Date.now()) {
          tokenBlacklist.set(token, expiryTime);
        }
      }
    } catch (e) {
      console.error('Token blacklist error:', e);
    }
  }

  // Clear refresh token
  const refreshToken = req.cookies?.refresh_token;
  if (refreshToken) {
    refreshTokens.delete(refreshToken);
  }

  // Clear cookies
  res.cookie('auth_token', '', { httpOnly: true, expires: new Date(0) });
  res.cookie('refresh_token', '', { httpOnly: true, expires: new Date(0) });

  res.json({ success: true });
};

// Generate JWT Token
export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
};

// Generate Refresh Token
export const generateRefreshToken = async (userId) => {
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const jti = crypto.randomBytes(16).toString('hex');

  // Store in memory with user ID and expiry
  refreshTokens.set(refreshToken, {
    userId: userId.toString(),
    jti,
    createdAt: Date.now(),
    expiry: Date.now() + REFRESH_TOKEN_EXPIRY,
  });

  return refreshToken;
};

// Refresh access token
export const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }

    // Get refresh token data from memory
    const tokenData = refreshTokens.get(refreshToken);
    if (!tokenData || tokenData.expiry < Date.now()) {
      refreshTokens.delete(refreshToken);
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const { userId } = tokenData;

    // Verify user still exists
    const user = await User.findById(userId).select('-password');
    if (!user) {
      refreshTokens.delete(refreshToken);
      return res.status(401).json({ message: 'User not found' });
    }

    // Rotate refresh token (delete old, create new)
    refreshTokens.delete(refreshToken);
    const newRefreshToken = await generateRefreshToken(userId);

    // Generate new access token
    const accessToken = generateToken(userId);

    // Set new cookies
    res.cookie('auth_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        upiId: user.upiId || '',
      },
      // Tokens returned for mobile client (uses Bearer auth since cookies don't work in RN)
      token: accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ message: 'Failed to refresh token' });
  }
};
