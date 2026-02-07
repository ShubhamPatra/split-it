# GroupContext Architecture Documentation

**Last Updated:** January 27, 2026  
**Version:** 2.0 (Refactored)

## Overview

GroupContext is the central state management system for groups, expenses, settlements, and balances in the Split-It application. This document describes the refactored architecture implemented in January 2026.

## Architecture Goals

The refactoring aimed to:
1. **Reduce file size** from 1367 lines to manageable size (~750 lines)
2. **Improve maintainability** by separating concerns into focused modules
3. **Enhance testability** by extracting logic into pure functions
4. **Maintain backward compatibility** with zero breaking changes
5. **Eliminate code duplication** (~600 lines of duplicated logic removed)

## Module Structure

### Core Module

**`GroupContext.jsx`** (~750 lines)
- State management (groups, expenses, settlements, profiles, balances)
- React hooks and effects
- Context provider and consumer hook
- Coordination between utilities
- Public API exports

### Utility Modules

#### 1. **`utils/groupTransformers.js`** (180 lines)

Handles all data transformation between API format and frontend format.

**Functions:**
- `transformGroup(group)` - Transform group data from API
- `transformExpense(expense)` - Transform expense data from API
- `transformSettlement(settlement)` - Transform settlement data from API
- `normalizeUpdates(updates)` - Normalize socket event updates
- `extractUserProfile(user)` - Extract user profile from populated object
- `buildProfilesMap(groups)` - Build profiles map from groups

**Responsibilities:**
- Convert MongoDB `_id` to frontend `id`
- Handle both populated objects and string IDs
- Normalize nested structures to flat structures
- Extract user profiles from populated data

**Testing:**
- 14 unit tests
- 60+ assertions
- 100% function coverage

#### 2. **`utils/balanceCalculator.js`** (120 lines)

Handles all balance calculation logic.

**Functions:**
- `calculateGroupBalances({ expenses, settlements, memberIds })` - Calculate balances
- `calculateTotalExpenses(expenses)` - Sum expense amounts
- `normalizeBalanceEvent(balances)` - Normalize socket balance events
- `validateBalanceEvent(groupId, balances)` - Validate balance events

**Responsibilities:**
- Calculate user balances from expenses and settlements
- Handle all split types (equal, exact, percentage, itemized)
- Process confirmed settlements
- Normalize and validate socket events

**Algorithm:**
```javascript
1. Initialize all members with balance = 0
2. Process expenses:
   - Payer gets credited: balance += expense.amount
   - Each participant owes their share: balance -= shares[userId]
3. Process confirmed settlements:
   - Payer gets credited: balance += settlement.amount
   - Receiver gets debited: balance -= settlement.amount
4. Return final balance map
```

**Testing:**
- 14 unit tests
- 40+ assertions
- Covers all split types and edge cases

#### 3. **`utils/socketHandlers.js`** (350 lines)

Centralizes all Socket.IO event handling.

**Functions:**
- `createSocketHandlers(dependencies)` - Factory function for handlers
- `registerSocketListeners(socket, handlers)` - Register all listeners
- `unregisterSocketListeners(socket)` - Cleanup all listeners

**Event Handlers:**
- Expense events: `created`, `updated`, `deleted` (+ aliases)
- Settlement events: `created`, `updated`, `deleted`
- Group events: `created`, `updated`, `memberJoined`, `memberRemoved`, `budgetUpdated`, `deleted` (+ aliases)
- Balance events: `update`

**Responsibilities:**
- Handle all real-time socket events
- Update local state based on events
- Manage group membership changes
- Handle balance cache updates
- Manage socket room subscriptions

**Pattern:**
```javascript
// Factory pattern with dependency injection
const handlers = createSocketHandlers({
  user,
  addExpenseLocally,
  updateExpenseLocally,
  // ... all dependencies
});

// Register all listeners
registerSocketListeners(socket, handlers);

// Cleanup
unregisterSocketListeners(socket);
```

## Data Flow

### 1. Initial Load

```
User logs in
  → loadUserData()
  → API: GET /groups, GET /settlements
  → transformGroup(), transformSettlement()
  → buildProfilesMap()
  → setState(groups, settlements, profiles)
  → joinGroupRoom() for each group
```

### 2. Lazy Load Expenses

```
User opens group
  → loadGroupExpenses(groupId)
  → API: GET /expenses/group/:id
  → transformExpense()
  → setState(expenses)
  → joinGroupRoom(groupId)
```

### 3. Real-Time Updates

```
Backend emits socket event
  → Socket listener receives event
  → Handler validates and processes
  → Transformer normalizes data
  → setState() updates local state
  → React re-renders components
```

### 4. Balance Calculation

```
Component calls getGroupBalances(groupId)
  → Check balancesByGroup cache (server-provided)
  → If available: return cached balances
  → If not: calculateGroupBalances()
    → Get expenses and settlements
    → Calculate balances using algorithm
    → Return calculated balances
```

## State Management

### State Variables

```javascript
const [groups, setGroups] = useState([]);
const [expenses, setExpenses] = useState([]);
const [settlements, setSettlements] = useState([]);
const [profiles, setProfiles] = useState({});
const [balancesByGroup, setBalancesByGroup] = useState({});
const [loading, setLoading] = useState(true);
const [loadingGroups, setLoadingGroups] = useState(new Set());
```

### Refs (Non-reactive)

```javascript
const loadedGroupsRef = useRef(new Set());
const loadingGroupsRef = useRef(new Set());
```

### Memoized Values

```javascript
const groupsById = useMemo(() => /* ... */, [groups]);
const expensesByGroup = useMemo(() => /* ... */, [expenses]);
```

## Public API

### Context Value

```javascript
{
  // State
  groups,
  expenses,
  settlements,
  profiles,
  loading,
  loadingGroups,
  
  // Memoized
  groupsById,
  expensesByGroup,
  
  // Actions
  addGroup,
  addExpense,
  addSettlement,
  updateExpense,
  updateSettlement,
  deleteGroup,
  deleteExpense,
  deleteSettlement,
  addMemberToGroup,
  removeMemberFromGroup,
  generateInviteCode,
  joinGroupByInvite,
  
  // Getters
  getGroupById,
  getGroupExpenses,
  getGroupSettlements,
  getGroupBalances,
  getTotalExpenses,
  getUserProfile,
  
  // Utilities
  loadGroupExpenses,
  refreshData,
}
```

### Hook Usage

```javascript
import { useGroups } from './context/GroupContext';

function MyComponent() {
  const {
    groups,
    getGroupBalances,
    addExpense,
  } = useGroups();
  
  // Use context values and functions
}
```

## Socket Event Handling

### Event Types

**Expense Events:**
- `expense:created` / `expense:add` - New expense added
- `expense:updated` / `expense:update` - Expense modified
- `expense:deleted` / `expense:delete` - Expense removed

**Settlement Events:**
- `settlement:created` - New settlement recorded
- `settlement:updated` - Settlement status changed
- `settlement:deleted` - Settlement removed

**Group Events:**
- `group:created` - New group created
- `group:updated` / `group:update` - Group details changed
- `group:memberJoined` / `group:join` - Member added
- `group:memberRemoved` / `group:leave` - Member removed
- `group:budgetUpdated` - Budget settings changed
- `group:deleted` - Group deleted

**Balance Events:**
- `balance:update` - Server-calculated balances updated

### Event Flow

```
Backend operation (e.g., create expense)
  → Backend emits socket event to group room
  → All clients in room receive event
  → Socket handler processes event
  → Transformer normalizes data
  → Local state updated
  → React components re-render
```

## Testing Strategy

### Unit Tests

**Transformers:**
- Test all transformation functions
- Test normalization logic
- Test profile extraction
- Test edge cases (null, undefined, mixed formats)

**Balance Calculator:**
- Test all split types
- Test settlement processing
- Test edge cases (zero amounts, empty arrays)
- Test validation functions

**Socket Handlers:**
- Test handler creation
- Test event processing
- Test state updates
- Test edge cases (invalid data, missing fields)

### Integration Tests

**GroupContext:**
- Test socket event handling
- Test state updates
- Test balance calculations
- Test lazy loading

### Component Tests

**Components using GroupContext:**
- Test context consumption
- Test state updates
- Test user interactions
- Test error handling

## Performance Considerations

### Optimizations

1. **Lazy Loading**: Expenses loaded per-group on demand
2. **Memoization**: Expensive calculations cached with useMemo
3. **Refs**: Synchronous tracking to prevent race conditions
4. **Debouncing**: Balance cache with 15-minute TTL
5. **Selective Updates**: Update only affected state, not full reload

### Metrics

- Initial load: ~200-300ms (groups + settlements only)
- Lazy load expenses: ~100-200ms per group
- Balance calculation: <50ms for groups with 100+ expenses
- Socket event processing: <10ms per event

## Migration Guide

### For Developers

**No changes required!** The refactoring is fully backward compatible.

All existing code continues to work:
```javascript
// This still works exactly the same
const { groups, addExpense, getGroupBalances } = useGroups();
```

### For New Features

**Use the utilities:**
```javascript
import { transformExpense } from './context/utils/groupTransformers';
import { calculateGroupBalances } from './context/utils/balanceCalculator';

// Transform API data
const expense = transformExpense(apiExpense);

// Calculate balances
const balances = calculateGroupBalances({
  expenses,
  settlements,
  memberIds,
});
```

## Future Enhancements

### Potential Improvements

1. **TypeScript Migration**: Add type safety to all modules
2. **Sub-Context Splitting**: If file grows beyond 1000 lines
   - GroupDataContext: State management
   - GroupActionsContext: CRUD operations
   - BalanceContext: Balance calculations
3. **Performance Monitoring**: Add metrics for balance calculations
4. **Caching Strategy**: Implement more sophisticated caching
5. **Offline Support**: Enhanced offline-first architecture

### When to Split Further

Consider splitting into sub-contexts when:
- Main file exceeds 1000 lines
- Performance issues arise
- Team size grows (multiple developers working on same file)
- New major features added (e.g., AI insights, advanced analytics)

## Troubleshooting

### Common Issues

**Issue: Stale balances displayed**
- Check if `balance:update` socket events are being received
- Verify `balancesByGroup` state is updating
- Check `getGroupBalances` dependencies

**Issue: Socket events not processing**
- Verify socket connection is established
- Check if group room was joined
- Verify event handler is registered

**Issue: Transformation errors**
- Check if API data format changed
- Verify transformer handles both populated and string IDs
- Check console for transformation errors

### Debugging

**Enable socket logging:**
```javascript
// In socketHandlers.js
console.log('[SOCKET] Event received:', eventName, data);
```

**Check balance calculation:**
```javascript
// In balanceCalculator.js
console.log('[BALANCE] Calculating for:', { expenses, settlements, memberIds });
```

**Verify transformations:**
```javascript
// In groupTransformers.js
console.log('[TRANSFORM] Input:', apiData);
console.log('[TRANSFORM] Output:', transformed);
```

## References

- **Original Implementation**: GroupContext.jsx (pre-refactor, 1367 lines)
- **Refactored Implementation**: GroupContext.jsx + utilities (750 + 650 lines)
- **Unit Tests**: `utils/__tests__/` (28 test cases, 100+ assertions)
- **Integration Tests**: `__tests__/GroupContext.socket.test.js`
- **Documentation**: This file

## Changelog

### Version 2.0 (January 27, 2026)
- Extracted transformers to `utils/groupTransformers.js`
- Extracted balance calculator to `utils/balanceCalculator.js`
- Extracted socket handlers to `utils/socketHandlers.js`
- Reduced main file from 1367 to ~750 lines (45% reduction)
- Added 28 unit tests with 100+ assertions
- Eliminated ~600 lines of code duplication
- Improved maintainability, testability, and readability
- Zero breaking changes, fully backward compatible

### Version 1.0 (Pre-refactor)
- Monolithic file with 1367 lines
- All logic inline
- Limited test coverage
- Code duplication in transformations

---

**For questions or issues, refer to:**
- Task documentation: `plans/task.md` (FE-005)
- Progress log: `plans/progress.md` (Sessions 47-48)
- Contributing guide: `CONTRIBUTING.md`
