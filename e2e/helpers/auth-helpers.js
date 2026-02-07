/**
 * Authentication helper functions for E2E tests
 */

const { expect } = require('@playwright/test');

/**
 * Register a new user
 * @param {import('@playwright/test').Page} page
 * @param {Object} userData - User data (name, email, password)
 */
async function registerUser(page, userData) {
  await page.goto('/signup');

  // Wait for signup form to be visible
  await expect(page.locator('h1:has-text("Sign Up")')).toBeVisible();

  // Fill in registration form
  await page.fill('input[id="name"]', userData.name);
  await page.fill('input[id="email"]', userData.email);
  await page.fill('input[id="password"]', userData.password);
  await page.fill('input[id="confirmPassword"]', userData.password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard or verification message
  await page.waitForURL(/\/(dashboard|login)/, { timeout: 10000 });
}

/**
 * Login an existing user
 * @param {import('@playwright/test').Page} page
 * @param {Object} credentials - User credentials (email, password)
 */
async function loginUser(page, credentials) {
  await page.goto('/login');

  // Wait for login form to be visible
  await expect(page.locator('h1:has-text("Sign In")')).toBeVisible();

  // Fill in login form
  await page.fill('input[id="email"]', credentials.email);
  await page.fill('input[id="password"]', credentials.password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('/dashboard', { timeout: 10000 });

  // Verify we're logged in
  await expect(page.locator('text=Dashboard')).toBeVisible();
}

/**
 * Logout the current user
 * @param {import('@playwright/test').Page} page
 */
async function logoutUser(page) {
  // Try clicking user menu first (multiple selector options)
  const userMenuClicked = await page.locator('[data-testid="user-menu"]').or(page.locator('button:has-text("Profile")')).click().then(() => true).catch(() => false);

  // Click logout (try multiple options)
  const logoutClicked = await page.locator('text=Logout').or(page.locator('text=Sign Out')).click().then(() => true).catch(() => false);

  // If neither worked, navigate directly to logout endpoint
  if (!logoutClicked) {
    await page.goto('/logout');
  }

  // Wait for redirect to login or home page
  await page.waitForURL(/\/(login|)$/, { timeout: 5000 });
}

/**
 * Check if user is logged in
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<boolean>}
 */
async function isLoggedIn(page) {
  try {
    await page.goto('/dashboard', { waitUntil: 'networkidle', timeout: 5000 });
    return page.url().includes('/dashboard');
  } catch {
    return false;
  }
}

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  isLoggedIn,
};
