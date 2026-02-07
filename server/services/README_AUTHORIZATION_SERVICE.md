# Authorization Service

## Overview

The `AuthorizationService` provides centralized authorization logic to ensure users can only access resources they own or have permission to access. This service is part of the Phase 1: Critical Security Fixes implementation.

## Purpose

This service addresses the following security requirements:
- **Requirement 4.1**: Verify expense ownership/access
- **Requirement 4.2**: Verify group membership  
- **Requirement 4.3**: Verify settlement participation

## API Reference

### `canAccessExpense(userId, expenseId)`

Checks if a user can access an expense.

**Access Rules:**
- User must be a member of the group the expense belongs to

**Parameters:**
- `userId` (string|ObjectId): The user ID to check
- `expenseId` (string|ObjectId): The expense ID to check

**Returns:** `Promise<boolean>` - True if user can access, false otherwise

**Example:**
```javascript
import authorizationService from './services/authorizationService.js';

const canAccess = await authorizationService.canAccessExpense(
  req.user._id,
  expenseId
);

if (!canAccess) {
  return res.status(403).json({ message: 'Access denied' });
}
```

### `canAccessGroup(userId, groupId)`

Checks if a user can access a group.

**Access Rules:**
- User must be a member of the group

**Parameters:**
- `userId` (string|ObjectId): The user ID to check
- `groupId` (string|ObjectId): The group ID to check

**Returns:** `Promise<boolean>` - True if user can access, false otherwise

**Example:**
```javascript
const canAccess = await authorizationService.canAccessGroup(
  req.user._id,
  groupId
);

if (!canAccess) {
  return res.status(403).json({ message: 'Access denied' });
}
```

### `canAccessSettlement(userId, settlementId)`

Checks if a user can access a settlement.

**Access Rules:**
- User is a participant (fromUserId or toUserId) in the settlement, OR
- User is a member of the group the settlement belongs to
- For cross-group settlements, user must be a member of at least one affected group

**Parameters:**
- `userId` (string|ObjectId): The user ID to check
- `settlementId` (string|ObjectId): The settlement ID to check

**Returns:** `Promise<boolean>` - True if user can access, false otherwise

**Example:**
```javascript
const canAccess = await authorizationService.canAccessSettlement(
  req.user._id,
  settlementId
);

if (!canAccess) {
  return res.status(403).json({ message: 'Access denied' });
}
```

### `checkOwnership(userId, resource)`

Generic ownership check for resources. Provides a flexible way to check resource ownership based on the resource type and ownership rules.

**Parameters:**
- `userId` (string|ObjectId): The user ID to check
- `resource` (Object): Resource ownership information
  - `resourceType` (string): Type of resource ('expense', 'group', 'settlement')
  - `resourceId` (string|ObjectId): ID of the resource
  - `ownerId` (string|ObjectId, optional): Direct owner ID
  - `sharedWith` (Array<string|ObjectId>, optional): Array of user IDs with access

**Returns:** `Promise<boolean>` - True if user has access, false otherwise

**Example:**
```javascript
const canAccess = await authorizationService.checkOwnership(
  req.user._id,
  {
    resourceType: 'expense',
    resourceId: expenseId,
    ownerId: expense.paidBy,
    sharedWith: expense.splitAmong
  }
);

if (!canAccess) {
  return res.status(403).json({ message: 'Access denied' });
}
```

## Usage in Controllers

### Basic Pattern

```javascript
import authorizationService from '../services/authorizationService.js';

export const getExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    
    // Check authorization
    const canAccess = await authorizationService.canAccessExpense(
      req.user._id,
      expenseId
    );
    
    if (!canAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Proceed with the operation
    const expense = await Expense.findById(expenseId);
    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
```

### Using Middleware (Recommended)

For consistent authorization across routes, use the `requireAuthorization` middleware (see task 4.2):

```javascript
import { requireAuthorization } from '../middleware/authorizationMiddleware.js';

router.get(
  '/expenses/:expenseId',
  authenticate,
  requireAuthorization('expense', (req) => req.params.expenseId),
  getExpense
);
```

## Security Considerations

### Error Handling

The service returns `false` for any errors during authorization checks. This ensures that:
- Database errors don't leak information about resource existence
- Authorization failures are handled consistently
- The system fails closed (denies access on error)

### Resource Existence

The service returns `false` if a resource doesn't exist, which prevents information leakage about whether resources exist in the system.

### Logging

Errors during authorization checks are logged to the console for debugging, but the service always returns `false` to the caller. In production, these logs should be sent to a secure logging system.

## Testing

Unit tests for the AuthorizationService are located in:
- `server/tests/services/authorizationService.test.js`

Property-based tests are covered in task 4.4.

## Integration

This service is used by:
- **Task 4.2**: Authorization middleware factory
- **Task 4.3**: Protected route implementations
- All controllers that handle resource access

## Future Enhancements

Potential improvements for future iterations:
- Role-based access control (RBAC) support
- Permission caching to reduce database queries
- Audit logging for authorization failures
- Support for custom authorization rules per resource type
- Batch authorization checks for multiple resources

## Related Documentation

- [Design Document](../../.kiro/specs/code-quality-security-fixes/design.md) - Section 4: Authorization System
- [Requirements](../../.kiro/specs/code-quality-security-fixes/requirements.md) - Requirement 4: Authorization Enforcement
- [Tasks](../../.kiro/specs/code-quality-security-fixes/tasks.md) - Phase 1, Task 4
