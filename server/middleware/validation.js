import { body, param, validationResult } from 'express-validator';

// Middleware to check validation results
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(e => e.msg).join(', ');
    return res.status(400).json({ 
      message: errorMessages || 'Validation error', 
      errors: errors.array() 
    });
  }
  next();
};

// Auth validation rules
export const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

export const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// Group validation rules
export const createGroupValidation = [
  body('name').trim().notEmpty().withMessage('Group name is required').isLength({ max: 100 }).withMessage('Name too long'),
  body('members').optional().isArray().withMessage('Members must be an array'),
];

export const updateGroupValidation = [
  param('id').isMongoId().withMessage('Invalid group ID'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
];

// Expense validation rules
export const createExpenseValidation = [
  body('groupId').isMongoId().withMessage('Invalid group ID'),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 200 }).withMessage('Description too long'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  body('category').notEmpty().withMessage('Category is required'),
  body('paidBy').isMongoId().withMessage('Invalid payer ID'),
  body('date').isISO8601().withMessage('Invalid date format'),
];

// Settlement validation rules
export const createSettlementValidation = [
  body('groupId').isMongoId().withMessage('Invalid group ID'),
  body('fromUserId').isMongoId().withMessage('Invalid from user ID'),
  body('toUserId').isMongoId().withMessage('Invalid to user ID'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
];

// ID param validation
export const idValidation = [
  param('id').isMongoId().withMessage('Invalid ID format'),
];

// Group ID param validation
export const groupIdValidation = [
  param('groupId').isMongoId().withMessage('Invalid group ID format'),
];
