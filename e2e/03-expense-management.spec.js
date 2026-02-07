/**
 * E2E Tests for Expense Management Flow
 * 
 * Tests cover:
 * - Adding an expense
 * - Viewing expenses
 * - Expense form validation
 * - Expense details
 * - Category selection
 */

const { test, expect } = require('@playwright/test');
const { testUser, testGroup, testExpense } = require('./helpers/test-data');
const { registerUser } = require('./helpers/auth-helpers');

test.describe('Expense Management Flow', () => {
  let groupId;

  test.beforeEach(async ({ page }) => {
    // Register and login
    await registerUser(page, testUser);
    
    // Create a group for testing
    await page.goto('/groups');
    await page.click('button:has-text("New Group"), button:has-text("Create")');
    await page.fill('input[id="groupName"]', testGroup.name);
    await page.click('button:has-text("Create Group"), button[type="submit"]:has-text("Create")');
    
    // Wait for group to be created and extract group ID from URL
    await page.waitForURL(/\/group\/[a-zA-Z0-9]+/, { timeout: 10000 });
    groupId = page.url().match(/\/group\/([a-zA-Z0-9]+)/)?.[1];
  });

  test('should navigate to add expense page', async ({ page }) => {
    // Click on "Add Expense" or "Expense" button
    await page.click('button:has-text("Expense"), button:has-text("Add")');
    
    // Wait for navigation
    await page.waitForURL(/\/add-expense/, { timeout: 10000 });
    
    // Verify we're on add expense page
    await expect(page.locator('h1:has-text("Add Expense")')).toBeVisible();
  });

  test('should display add expense form', async ({ page }) => {
    await page.goto(`/add-expense?groupId=${groupId}`);
    
    // Check for form elements
    await expect(page.locator('h1:has-text("Add Expense")')).toBeVisible();
    await expect(page.locator('input[id="description"]')).toBeVisible();
    await expect(page.locator('input[id="amount"]')).toBeVisible();
    await expect(page.locator('input[id="date"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show validation errors for empty expense form', async ({ page }) => {
    await page.goto(`/add-expense?groupId=${groupId}`);
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Check for validation errors
    await expect(page.locator('text=required')).toBeVisible({ timeout: 3000 });
  });

  test('should create an expense successfully', async ({ page }) => {
    await page.goto(`/add-expense?groupId=${groupId}`);
    
    // Fill in expense form
    await page.fill('input[id="description"]', testExpense.description);
    await page.fill('input[id="amount"]', testExpense.amount);
    
    // Select category if visible
    const categorySelect = page.locator('select, [role="combobox"]').first();
    if (await categorySelect.isVisible()) {
      await categorySelect.click();
      await page.click(`text=${testExpense.category}, text=Food`);
    }
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for redirect back to group page
    await page.waitForURL(/\/group\/[a-zA-Z0-9]+/, { timeout: 10000 });
    
    // Verify expense appears in the list
    await expect(page.locator(`text=${testExpense.description}`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=₹${testExpense.amount}, text=${testExpense.amount}`)).toBeVisible();
  });

  test('should validate amount is positive', async ({ page }) => {
    await page.goto(`/add-expense?groupId=${groupId}`);
    
    // Fill in form with negative amount
    await page.fill('input[id="description"]', 'Test Expense');
    await page.fill('input[id="amount"]', '-100');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Check for validation error
    await expect(page.locator('text=greater than 0, text=positive')).toBeVisible({ timeout: 3000 });
  });

  test('should validate description length', async ({ page }) => {
    await page.goto(`/add-expense?groupId=${groupId}`);
    
    // Fill in form with very short description
    await page.fill('input[id="description"]', 'AB');
    await page.fill('input[id="amount"]', '100');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Check for validation error
    await expect(page.locator('text=at least 3 characters, text=too short')).toBeVisible({ timeout: 3000 });
  });

  test('should display expense in group expenses tab', async ({ page }) => {
    // Create an expense
    await page.goto(`/add-expense?groupId=${groupId}`);
    await page.fill('input[id="description"]', testExpense.description);
    await page.fill('input[id="amount"]', testExpense.amount);
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await page.waitForURL(/\/group\/[a-zA-Z0-9]+/, { timeout: 10000 });
    
    // Click on Expenses tab if not already active
    await page.click('button:has-text("Expenses")').catch(() => {});
    
    // Verify expense is displayed
    await expect(page.locator(`text=${testExpense.description}`)).toBeVisible();
    await expect(page.locator(`text=₹${testExpense.amount}, text=${testExpense.amount}`)).toBeVisible();
  });

  test('should show expense category icon', async ({ page }) => {
    // Create an expense
    await page.goto(`/add-expense?groupId=${groupId}`);
    await page.fill('input[id="description"]', testExpense.description);
    await page.fill('input[id="amount"]', testExpense.amount);
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await page.waitForURL(/\/group\/[a-zA-Z0-9]+/, { timeout: 10000 });
    
    // Verify expense card has category icon (svg or icon element)
    const expenseCard = page.locator(`text=${testExpense.description}`).locator('..').locator('..');
    await expect(expenseCard.locator('svg, [data-icon]').first()).toBeVisible();
  });

  test('should navigate back to group from add expense', async ({ page }) => {
    await page.goto(`/add-expense?groupId=${groupId}`);
    
    // Click back button
    await page.click('button:has-text("Back"), a:has-text("Back")');
    
    // Verify we're back on group page
    await page.waitForURL(/\/group\/[a-zA-Z0-9]+/, { timeout: 5000 });
    await expect(page.locator(`h1:has-text("${testGroup.name}")`)).toBeVisible();
  });

  test('should pre-select group when navigating from group page', async ({ page }) => {
    // Navigate to add expense from group page
    await page.click('button:has-text("Expense"), button:has-text("Add")');
    await page.waitForURL(/\/add-expense/, { timeout: 10000 });
    
    // Verify group is pre-selected (check if group name appears in select or is already selected)
    const groupSelect = page.locator('select, [role="combobox"]').first();
    const selectedValue = await groupSelect.textContent();
    expect(selectedValue).toContain(testGroup.name);
  });
});
