import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { generateToken, generateRefreshToken } from '../middleware/authMiddleware.js';

// Helper to create UPI reminder notification
const createUpiReminderIfNeeded = async (user) => {
  if (!user.upiId) {
    // Check if we already sent a reminder in the last 7 days
    const existingReminder = await Notification.findOne({
      userId: user._id,
      title: 'Add Your UPI ID',
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });
    
    if (!existingReminder) {
      await Notification.create({
        userId: user._id,
        type: 'warning',
        title: 'Add Your UPI ID',
        message: 'Add your UPI ID to receive payments directly from group members. Go to Settings → Profile to add it.',
        actionType: 'navigate',
        data: { url: '/settings' },
      });
    }
  }
};
import { OAuth2Client } from 'google-auth-library';
import { emailQueue } from '../config/queue.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'This email is already registered. Try logging in instead.' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      const token = generateToken(user._id);
      const refreshToken = await generateRefreshToken(user._id);
      
      // Set HttpOnly cookies
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      // Send welcome email (Comment 2)
      emailQueue.add({
        to: user.email,
        subject: 'Welcome to Split-It!',
        html: `<h1>Welcome ${user.name}!</h1><p>Thank you for joining Split-It. Start splitting expenses with your friends and family today.</p>`,
      }).catch(err => console.error('Email queue error:', err));

      res.status(201).json({
        success: true,
        needsConfirmation: false,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          upiId: user.upiId || '',
        },
        // Tokens returned for mobile client (uses Bearer auth since cookies don't work in RN)
        token,
        refreshToken,
      });
    }
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: error.message || 'Error creating user' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);
    
    // Set HttpOnly cookies
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Send UPI reminder notification if not set
    createUpiReminderIfNeeded(user).catch(err => console.error('UPI reminder error:', err));

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        upiId: user.upiId || '',
      },
      // Tokens returned for mobile client (uses Bearer auth since cookies don't work in RN)
      token,
      refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message || 'Error logging in' });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      upiId: user.upiId || '',
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching user' });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
  try {
    // Clear the HttpOnly cookie
    res.cookie('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: new Date(0),
    });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error logging out' });
  }
};

// @desc    Google OAuth Login
// @route   POST /api/auth/google
// @access  Public
export const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: 'No credential provided' });
    }

    // Verify the ID token with Google's library
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (verifyError) {
      console.error('Google token verification failed:', verifyError);
      return res.status(401).json({ message: 'Invalid Google credential' });
    }

    const payload = ticket.getPayload();

    // Verify issuer
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) {
      return res.status(401).json({ message: 'Invalid token issuer' });
    }

    // Verify audience
    if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(401).json({ message: 'Invalid token audience' });
    }

    // Verify token expiry
    if (payload.exp * 1000 < Date.now()) {
      return res.status(401).json({ message: 'Token expired' });
    }

    // Verify email is verified
    if (!payload.email_verified) {
      return res.status(401).json({ message: 'Email not verified with Google' });
    }

    const { email, name, sub: googleId } = payload;

    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      // User exists, update googleId if not set
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    } else {
      // Create new user
      user = await User.create({
        googleId,
        name,
        email,
      });
    }

    // Generate token and set as HttpOnly cookie
    const token = generateToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);
    
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Send UPI reminder notification if not set
    createUpiReminderIfNeeded(user).catch(err => console.error('UPI reminder error:', err));

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        upiId: user.upiId || '',
      },
      // Tokens returned for mobile client (uses Bearer auth since cookies don't work in RN)
      token,
      refreshToken,
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ message: error.message || 'Error authenticating with Google' });
  }
};
