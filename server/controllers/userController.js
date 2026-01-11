import User from '../models/User.js';

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      upiId: user.upiId || '',
      emailPreferences: user.emailPreferences || {},
      budgetSettings: user.budgetSettings || {},
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, email, upiId } = req.body;

    if (name) user.name = name;
    if (email) {
      // Check if email is already taken by another user
      const emailExists = await User.findOne({ email, _id: { $ne: user._id } });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = email;
    }
    if (upiId !== undefined) user.upiId = upiId;

    await user.save();

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      upiId: user.upiId || '',
      emailPreferences: user.emailPreferences || {},
      budgetSettings: user.budgetSettings || {},
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get email preferences
// @route   GET /api/users/email-preferences
// @access  Private
export const getEmailPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('emailPreferences');
    res.json(user.emailPreferences || {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update email preferences
// @route   PUT /api/users/email-preferences
// @access  Private
export const updateEmailPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const validPreferences = [
      'weeklyDigest', 'monthlyDigest',
      'expenseAdded', 'settlementConfirmation', 'paymentReminders',
      'recurringExpenseReminder', 'recurringExpenseGenerated',
      'memberJoined', 'groupInvite',
      'budgetAlerts', 'exportReports'
    ];

    // Update only valid preference fields
    for (const key of validPreferences) {
      if (req.body[key] !== undefined) {
        user.emailPreferences[key] = Boolean(req.body[key]);
      }
    }

    await user.save();
    res.json(user.emailPreferences);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get budget settings
// @route   GET /api/users/budget-settings
// @access  Private
export const getBudgetSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('budgetSettings');
    res.json(user.budgetSettings || {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update budget settings
// @route   PUT /api/users/budget-settings
// @access  Private
export const updateBudgetSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { monthlyLimit, categoryLimits, alertThreshold } = req.body;

    if (monthlyLimit !== undefined) {
      user.budgetSettings.monthlyLimit = Math.max(0, Number(monthlyLimit));
    }
    if (categoryLimits !== undefined) {
      user.budgetSettings.categoryLimits = categoryLimits;
    }
    if (alertThreshold !== undefined) {
      user.budgetSettings.alertThreshold = Math.min(100, Math.max(1, Number(alertThreshold)));
    }

    await user.save();
    res.json(user.budgetSettings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user by ID (for group members)
// @route   GET /api/users/:id
// @access  Private
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      upiId: user.upiId || '',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Search users by email or name
// @route   GET /api/users/search?q=query
// @access  Private
export const searchUsers = async (req, res) => {
  try {
    const query = req.query.q;

    if (!query) {
      return res.status(400).json({ message: 'Search query required' });
    }

    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
    })
      .select('-password')
      .limit(10);

    res.json(users.map(u => ({
      id: u._id,
      name: u.name,
      email: u.email,
      upiId: u.upiId || '',
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
