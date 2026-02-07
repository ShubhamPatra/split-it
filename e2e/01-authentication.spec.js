/**
 * E2E Tests for Authentication Flow
 * 
 * Tests cover:
 * - User registration
 * - User login
 * - Login validation
 * - Logout
 * - Protected route access
 */

const { test, expect } = require('@playwright/test');
const { testUser } = require('./helpers/test-data');
const { registerUser, loginUser, logoutUser } = require('./helpers/auth-helpers');

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto('/');
  });

  test('should display login page', async ({ page }) => {
    await page.goto('/login');

    // Check for login form elements
    await expect(page.locator('h1:has-text("Sign In")')).toBeVisible();
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Check for signup link
    await expect(page.locator('text=Sign up')).toBeVisible();
  });

  test('should display signup page', async ({ page }) => {
    await page.goto('/signup');

    // Check for signup form elements
    await expect(page.locator('h1:has-text("Sign Up")')).toBeVisible();
    await expect(page.locator('input[id="name"]')).toBeVisible();
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
    await expect(page.locator('input[id="confirmPassword"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show validation errors for invalid login', async ({ page }) => {
    await page.goto('/login');

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Check for validation errors (using regex for flexible text matching)
    await expect(page.locator('text=/Email.*required|required/i')).toBeVisible({ timeout: 3000 });
  });

  test('should show validation errors for invalid signup', async ({ page }) => {
    await page.goto('/signup');

    // Fill in mismatched passwords
    await page.fill('input[id="name"]', 'Test User');
    await page.fill('input[id="email"]', 'test@example.com');
    await page.fill('input[id="password"]', 'password123');
    await page.fill('input[id="confirmPassword"]', 'different123');

    // Submit form
    await page.click('button[type="submit"]');

    // Check for password mismatch error (using regex for flexible text matching)
    await expect(page.locator('text=/Passwords do not match|match/i')).toBeVisible({ timeout: 3000 });
  });

  test('should register a new user successfully', async ({ page }) => {
    await registerUser(page, testUser);

    // Should redirect to dashboard or show verification message
    const url = page.url();
    expect(url).toMatch(/\/(dashboard|login)/);

    // If redirected to login, check for verification message
    if (url.includes('/login')) {
      await expect(page.locator('text=/verify.*email|email.*verify/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should login with valid credentials', async ({ page }) => {
    // First register the user
    await registerUser(page, testUser);

    // If verification is required, we'll skip the login test
    // In a real scenario, you'd verify the email first
    const url = page.url();
    if (url.includes('/dashboard')) {
      // Already logged in after registration
      await expect(page.locator('text=Dashboard')).toBeVisible();
    } else {
      // Try to login
      await loginUser(page, testUser);

      // Verify we're on the dashboard
      await expect(page.locator('text=Dashboard')).toBeVisible();
    }
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in invalid credentials
    await page.fill('input[id="email"]', 'nonexistent@example.com');
    await page.fill('input[id="password"]', 'wrongpassword');

    // Submit form
    await page.click('button[type="submit"]');

    // Check for error message (using regex for flexible text matching)
    await expect(page.locator('text=/Invalid|failed|incorrect/i')).toBeVisible({ timeout: 5000 });
  });

  test('should logout successfully', async ({ page }) => {
    // First register and login
    await registerUser(page, testUser);

    // If we're on dashboard, try to logout
    if (page.url().includes('/dashboard')) {
      await logoutUser(page);

      // Verify we're logged out (redirected to login or home)
      const url = page.url();
      expect(url).toMatch(/\/(login|)$/);
    }
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    // Try to access dashboard without logging in
    await page.goto('/dashboard');

    // Should redirect to login
    await page.waitForURL('/login', { timeout: 5000 });
    await expect(page.locator('h1:has-text("Sign In")')).toBeVisible();
  });

  test('should redirect to login when accessing groups page', async ({ page }) => {
    // Try to access groups without logging in
    await page.goto('/groups');

    // Should redirect to login
    await page.waitForURL('/login', { timeout: 5000 });
    await expect(page.locator('h1:has-text("Sign In")')).toBeVisible();
  });
});
