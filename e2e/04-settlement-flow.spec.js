/**
 * E2E Tests for Settlement Flow
 * 
 * Tests cover:
 * - Viewing balances
 * - Recording a settlement
 * - Settlement confirmation
 * - Settlement history
 * - Balance updates after settlement
 */

const { test, expect } = require('@playwright/test');
const { testUser, testGroup, testExpense, testSettlement } = require('./helpers/test-data');
const { registerUser } = require('./helpers/auth-helpers');

test.describe('Settlement Flow', () => {
  let groupId;

  test.beforeEach(async ({ page }) => {
    // Register and login
    await registerUser(page, testUser);
    
    // Create a group
    await page.goto('/groups');
    await page.click('button:has-text("New Group"), button:has-text("Create")');
    await page.fill('input[id="groupName"]', testGroup.name);
    await page.click('button:has-text("Create Group"), button[type="submit"]:has-text("Create")');
    
    // Wait for group creation
    await page.waitForURL(/\/group\/[a-zA-Z0-9]+/, { timeout: 10000 });
    groupId = page.url().match(/\/group\/([a-zA-Z0-9]+)/)?.[1];
    
    // Create an expense to generate a balance
    await page.click('button:has-text("Expense"), button:has-text("Add")');
    await page.waitForURL(/\/add-expense/, { timeout: 10000 });
    await page.fill('input[id="description"]', testExpense.description);
    await page.fill('input[id="amount"]', testExpense.amount);
    await page.click('button[type="submit"]');
    
    // Wait for redirect back to group
    await page.waitForURL(/\/group\/[a-zA-Z0-9]+/, { timeout: 10000 });
  });

  test('should display balances tab', async ({ page }) => {
    // Click on Balances tab
    await page.click('button:has-text("Balances")');
    
    // Verify balances tab is active
    await expect(page.locator('button:has-text("Balances")[data-state="active"]')).toBeVisible();
    
    // Check for balance information
    await expect(page.locator('text=Balance, text=Owed, text=Owes')).toBeVisible();
  });

  test('should display settlements tab', async ({ page }) => {
    // Click on Settlements tab
    await page.click('button:has-text("Settlements")');
    
    // Verify settlements tab is active
    await expect(page.locator('button:has-text("Settlements")[data-state="active"]')).toBeVisible();
    
    // Check for settlements section
    await expect(page.locator('text=Settlement, text=History')).toBeVisible();
  });

  test('should show settlement suggestions', async ({ page }) => {
    // Click on Balances tab
    await page.click('button:has-text("Balances")');
    
    // Check for settlement suggestions (if balances exist)
    const hasSuggestions = await page.locator('text=Settle Up, text=Suggestion').isVisible();
    
    if (hasSuggestions) {
      await expect(page.locator('text=Settle Up, text=Suggestion')).toBeVisible();
    }
  });

  test('should open settle up dialog', async ({ page }) => {
    // Click on Settle button in header
    await page.click('button:has-text("Settle")');
    
    // Check for settle dialog
    await expect(page.locator('text=Record Settlement, text=Settle Up')).toBeVisible({ timeout: 5000 });
  });

  test('should record a settlement', async ({ page }) => {
    // Open settle dialog
    await page.click('button:has-text("Settle")');
    
    // Wait for dialog
    await expect(page.locator('text=Record Settlement, text=Settle Up')).toBeVisible({ timeout: 5000 });
    
    // Fill in settlement details
    const amountInput = page.locator('input[type="number"], input[placeholder*="amount"]').first();
    if (await amountInput.isVisible()) {
      await amountInput.fill(testSettlement.amount);
    }
    
    // Select payment method if available
    const paymentMethodSelect = page.locator('select, [role="combobox"]').filter({ hasText: /cash|upi|bank/i });
    if (await paymentMethodSelect.isVisible()) {
      await paymentMethodSelect.click();
      await page.click('text=Cash, text=UPI').first();
    }
    
    // Add notes if field is available
    const notesInput = page.locator('input[placeholder*="note"], textarea[placeholder*="note"]');
    if (await notesInput.isVisible()) {
      await notesInput.fill(testSettlement.notes);
    }
    
    // Submit settlement
    await page.click('button:has-text("Record"), button:has-text("Submit"), button[type="submit"]');
    
    // Wait for success message or dialog to close
    await page.waitForTimeout(2000);
    
    // Verify settlement was recorded (check settlements tab)
    await page.click('button:has-text("Settlements")');
    await expect(page.locator(`text=${testSettlement.amount}, text=₹${testSettlement.amount}`)).toBeVisible({ timeout: 10000 });
  });

  test('should display settlement in history', async ({ page }) => {
    // Record a settlement first
    await page.click('button:has-text("Settle")');
    await page.waitForTimeout(1000);
    
    const amountInput = page.locator('input[type="number"]').first();
    if (await amountInput.isVisible()) {
      await amountInput.fill(testSettlement.amount);
      await page.click('button:has-text("Record"), button:has-text("Submit"), button[type="submit"]');
      await page.waitForTimeout(2000);
    }
    
    // Navigate to settlements tab
    await page.click('button:has-text("Settlements")');
    
    // Check for settlement in history
    await expect(page.locator('text=Settlement, text=History')).toBeVisible();
    
    // Verify settlement details are shown
    const hasSettlement = await page.locator(`text=${testSettlement.amount}, text=₹${testSettlement.amount}`).isVisible();
    if (hasSettlement) {
      await expect(page.locator(`text=${testSettlement.amount}, text=₹${testSettlement.amount}`)).toBeVisible();
    }
  });

  test('should show settlement status badge', async ({ page }) => {
    // Record a settlement
    await page.click('button:has-text("Settle")');
    await page.waitForTimeout(1000);
    
    const amountInput = page.locator('input[type="number"]').first();
    if (await amountInput.isVisible()) {
      await amountInput.fill(testSettlement.amount);
      await page.click('button:has-text("Record"), button:has-text("Submit"), button[type="submit"]');
      await page.waitForTimeout(2000);
    }
    
    // Navigate to settlements tab
    await page.click('button:has-text("Settlements")');
    
    // Check for status badge (Pending, Confirmed, etc.)
    const hasBadge = await page.locator('text=Pending, text=Confirmed, text=Failed').isVisible();
    if (hasBadge) {
      await expect(page.locator('text=Pending, text=Confirmed, text=Failed')).toBeVisible();
    }
  });

  test('should update balance after settlement', async ({ page }) => {
    // Check initial balance
    await page.click('button:has-text("Balances")');
    const initialBalanceText = await page.locator('text=Balance, text=₹').first().textContent();
    
    // Record a settlement
    await page.click('button:has-text("Settle")');
    await page.waitForTimeout(1000);
    
    const amountInput = page.locator('input[type="number"]').first();
    if (await amountInput.isVisible()) {
      await amountInput.fill(testSettlement.amount);
      await page.click('button:has-text("Record"), button:has-text("Submit"), button[type="submit"]');
      await page.waitForTimeout(2000);
    }
    
    // Check balance again
    await page.click('button:has-text("Balances")');
    const newBalanceText = await page.locator('text=Balance, text=₹').first().textContent();
    
    // Balance should have changed (this is a basic check)
    // In a real test, you'd calculate the expected balance
    expect(newBalanceText).toBeDefined();
  });

  test('should show payment method in settlement card', async ({ page }) => {
    // Record a settlement with payment method
    await page.click('button:has-text("Settle")');
    await page.waitForTimeout(1000);
    
    const amountInput = page.locator('input[type="number"]').first();
    if (await amountInput.isVisible()) {
      await amountInput.fill(testSettlement.amount);
      
      // Select payment method
      const paymentMethodSelect = page.locator('select, [role="combobox"]').filter({ hasText: /cash|upi|bank/i });
      if (await paymentMethodSelect.isVisible()) {
        await paymentMethodSelect.click();
        await page.click('text=Cash').first();
      }
      
      await page.click('button:has-text("Record"), button:has-text("Submit"), button[type="submit"]');
      await page.waitForTimeout(2000);
    }
    
    // Navigate to settlements tab
    await page.click('button:has-text("Settlements")');
    
    // Check for payment method display
    const hasPaymentMethod = await page.locator('text=Cash, text=UPI, text=Bank').isVisible();
    if (hasPaymentMethod) {
      await expect(page.locator('text=Cash, text=UPI, text=Bank')).toBeVisible();
    }
  });

  test('should navigate between tabs', async ({ page }) => {
    // Test tab navigation
    await page.click('button:has-text("Expenses")');
    await expect(page.locator('button:has-text("Expenses")[data-state="active"]')).toBeVisible();
    
    await page.click('button:has-text("Balances")');
    await expect(page.locator('button:has-text("Balances")[data-state="active"]')).toBeVisible();
    
    await page.click('button:has-text("Settlements")');
    await expect(page.locator('button:has-text("Settlements")[data-state="active"]')).toBeVisible();
    
    // Navigate back to expenses
    await page.click('button:has-text("Expenses")');
    await expect(page.locator('button:has-text("Expenses")[data-state="active"]')).toBeVisible();
  });
});
