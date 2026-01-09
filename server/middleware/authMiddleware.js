import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import redis from '../config/redis.js';
import crypto from 'crypto';

// Refresh token settings
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30 days in seconds
const ACCESS_TOKEN_EXPIRY = '7d';

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
    // Check if token is blacklisted
    const blacklisted = await redis.get(`blacklist:${token}`);
    if (blacklisted) {
      return res.status(401).json({ message: 'Token revoked' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from token
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }

    next();
  } catch (error) {
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
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await redis.setex(`blacklist:${token}`, ttl, '1');
        }
      }
    } catch (e) {
      console.error('Token blacklist error:', e);
    }
  }
  
  // Clear refresh token
  const refreshToken = req.cookies?.refresh_token;
  if (refreshToken) {
    try {
      await redis.del(`refresh:${refreshToken}`);
    } catch (e) {
      console.error('Refresh token cleanup error:', e);
    }
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

// Generate Refresh Token (Comment 11)
export const generateRefreshToken = async (userId) => {
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const jti = crypto.randomBytes(16).toString('hex');
  
  // Store in Redis with user ID and expiry
  await redis.setex(`refresh:${refreshToken}`, REFRESH_TOKEN_EXPIRY, JSON.stringify({
    userId: userId.toString(),
    jti,
    createdAt: Date.now(),
  }));
  
  return refreshToken;
};

// Refresh access token (Comment 11)
export const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }
    
    // Get refresh token data from Redis
    const tokenData = await redis.get(`refresh:${refreshToken}`);
    if (!tokenData) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
    
    const { userId, jti } = JSON.parse(tokenData);
    
    // Verify user still exists
    const user = await User.findById(userId).select('-password');
    if (!user) {
      await redis.del(`refresh:${refreshToken}`);
      return res.status(401).json({ message: 'User not found' });
    }
    
    // Rotate refresh token (delete old, create new)
    await redis.del(`refresh:${refreshToken}`);
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
