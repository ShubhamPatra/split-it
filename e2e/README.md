# Split-It E2E Tests

End-to-end tests for Split-It application using Playwright.

## Overview

This test suite covers critical user flows:

1. **Authentication Flow** (`01-authentication.spec.js`)
   - User registration
   - User login
   - Form validation
   - Logout
   - Protected route access

2. **Group Management Flow** (`02-group-management.spec.js`)
   - Creating groups
   - Viewing groups list
   - Group navigation
   - Inviting members
   - Group details

3. **Expense Management Flow** (`03-expense-management.spec.js`)
   - Adding expenses
   - Expense form validation
   - Viewing expenses
   - Category selection
   - Expense details

4. **Settlement Flow** (`04-settlement-flow.spec.js`)
   - Viewing balances
   - Recording settlements
   - Settlement confirmation
   - Settlement history
   - Balance updates

## Prerequisites

- Node.js 16+ installed
- Split-It application running locally
- Backend server running on `http://localhost:5000`
- Frontend running on `http://localhost:3000`

## Installation

Install Playwright and browsers:

```bash
npm install
npx playwright install
```

## Running Tests

### Run all tests

```bash
npm run test:e2e
```

### Run tests in headed mode (see browser)

```bash
npm run test:e2e:headed
```

### Run tests in UI mode (interactive)

```bash
npm run test:e2e:ui
```

### Run specific test file

```bash
npx playwright test e2e/01-authentication.spec.js
```

### Run tests in specific browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Debug tests

```bash
npm run test:e2e:debug
```

## Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

## Configuration

Test configuration is in `playwright.config.js`:

- **Base URL**: `http://localhost:3000` (configurable via `REACT_APP_BASE_URL`)
- **Timeout**: 30 seconds per test
- **Retries**: 2 retries on CI, 0 locally
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Screenshots**: Captured on failure
- **Videos**: Recorded on failure
- **Traces**: Captured on first retry

## Writing Tests

### Test Structure

```javascript
const { test, expect } = require('@playwright/test');

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
  });

  test('should do something', async ({ page }) => {
    // Test implementation
  });
});
```

### Helper Functions

Use helper functions from `e2e/helpers/`:

```javascript
const { registerUser, loginUser } = require('./helpers/auth-helpers');
const { testUser, testGroup } = require('./helpers/test-data');

// Register a user
await registerUser(page, testUser);

// Login a user
await loginUser(page, testUser);
```

### Best Practices

1. **Use data-testid attributes** for stable selectors
2. **Wait for elements** before interacting
3. **Use meaningful test names** that describe the behavior
4. **Keep tests independent** - each test should work in isolation
5. **Clean up test data** after tests (if applicable)
6. **Use page object pattern** for complex pages (future improvement)

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Troubleshooting

### Tests fail with "Timeout"

- Increase timeout in `playwright.config.js`
- Check if backend/frontend servers are running
- Check network connectivity

### Tests fail with "Element not found"

- Check if selectors are correct
- Add explicit waits: `await page.waitForSelector('selector')`
- Check if element is visible: `await expect(element).toBeVisible()`

### Tests are flaky

- Add explicit waits instead of `waitForTimeout`
- Use `waitForLoadState('networkidle')` for dynamic content
- Check for race conditions

### Browser doesn't launch

- Install browsers: `npx playwright install`
- Check system dependencies: `npx playwright install-deps`

## Future Improvements

- [ ] Add page object models for better maintainability
- [ ] Add visual regression tests
- [ ] Add API mocking for isolated tests
- [ ] Add performance tests
- [ ] Add accessibility tests
- [ ] Add cross-browser compatibility tests
- [ ] Add mobile-specific tests
- [ ] Add test data cleanup utilities

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
