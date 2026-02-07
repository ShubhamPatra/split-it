/**
 * E2E Tests for Group Management Flow
 * 
 * Tests cover:
 * - Creating a group
 * - Viewing groups list
 * - Viewing group details
 * - Inviting members
 * - Group navigation
 */

const { test, expect } = require('@playwright/test');
const { testUser, testGroup } = require('./helpers/test-data');
const { registerUser } = require('./helpers/auth-helpers');

test.describe('Group Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Register and login before each test
    await registerUser(page, testUser);
    
    // Navigate to groups page if not already there
    if (!page.url().includes('/groups') && !page.url().includes('/dashboard')) {
      await page.goto('/groups');
    }
  });

  test('should display groups page', async ({ page }) => {
    await page.goto('/groups');
    
    // Check for groups page elements
    await expect(page.locator('h1:has-text("Your Groups"), h1:has-text("Groups")')).toBeVisible();
    await expect(page.locator('button:has-text("New Group"), button:has-text("Create")')).toBeVisible();
  });

  test('should open create group dialog', async ({ page }) => {
    await page.goto('/groups');
    
    // Click on "New Group" or "Create Group" button
    await page.click('button:has-text("New Group"), button:has-text("Create")');
    
    // Check for dialog
    await expect(page.locator('text=Create New Group, text=Create Group')).toBeVisible();
    await expect(page.locator('input[id="groupName"]')).toBeVisible();
  });

  test('should create a new group successfully', async ({ page }) => {
    await page.goto('/groups');
    
    // Click on "New Group" button
    await page.click('button:has-text("New Group"), button:has-text("Create")');
    
    // Wait for dialog to open
    await expect(page.locator('input[id="groupName"]')).toBeVisible();
    
    // Fill in group name
    await page.fill('input[id="groupName"]', testGroup.name);
    
    // Submit form
    await page.click('button:has-text("Create Group"), button[type="submit"]:has-text("Create")');
    
    // Wait for success message or redirect
    await expect(page.locator(`text=${testGroup.name}`)).toBeVisible({ timeout: 10000 });
    
    // Verify group appears in the list
    const groupCard = page.locator(`text=${testGroup.name}`).first();
    await expect(groupCard).toBeVisible();
  });

  test('should show validation error for empty group name', async ({ page }) => {
    await page.goto('/groups');
    
    // Click on "New Group" button
    await page.click('button:has-text("New Group"), button:has-text("Create")');
    
    // Wait for dialog
    await expect(page.locator('input[id="groupName"]')).toBeVisible();
    
    // Try to submit without entering name
    await page.click('button:has-text("Create Group"), button[type="submit"]:has-text("Create")');
    
    // Check for validation error
    await expect(page.locator('text=required, text=name')).toBeVisible({ timeout: 3000 });
  });

  test('should navigate to group detail page', async ({ page }) => {
    await page.goto('/groups');
    
    // Create a group first
    await page.click('button:has-text("New Group"), button:has-text("Create")');
    await page.fill('input[id="groupName"]', testGroup.name);
    await page.click('button:has-text("Create Group"), button[type="submit"]:has-text("Create")');
    
    // Wait for group to be created
    await expect(page.locator(`text=${testGroup.name}`)).toBeVisible({ timeout: 10000 });
    
    // Click on the group card
    await page.click(`text=${testGroup.name}`);
    
    // Wait for navigation to group detail page
    await page.waitForURL(/\/group\/[a-zA-Z0-9]+/, { timeout: 10000 });
    
    // Verify we're on the group detail page
    await expect(page.locator(`h1:has-text("${testGroup.name}")`)).toBeVisible();
    await expect(page.locator('text=Expenses, text=Balances, text=Settlements')).toBeVisible();
  });

  test('should display group tabs', async ({ page }) => {
    await page.goto('/groups');
    
    // Create a group
    await page.click('button:has-text("New Group"), button:has-text("Create")');
    await page.fill('input[id="groupName"]', testGroup.name);
    await page.click('button:has-text("Create Group"), button[type="submit"]:has-text("Create")');
    
    // Navigate to group
    await page.click(`text=${testGroup.name}`);
    await page.waitForURL(/\/group\/[a-zA-Z0-9]+/, { timeout: 10000 });
    
    // Check for tabs
    await expect(page.locator('button:has-text("Expenses")')).toBeVisible();
    await expect(page.locator('button:has-text("Balances")')).toBeVisible();
    await expect(page.locator('button:has-text("Settlements")')).toBeVisible();
  });

  test('should open invite member dialog', async ({ page }) => {
    await page.goto('/groups');
    
    // Create a group
    await page.click('button:has-text("New Group"), button:has-text("Create")');
    await page.fill('input[id="groupName"]', testGroup.name);
    await page.click('button:has-text("Create Group"), button[type="submit"]:has-text("Create")');
    
    // Navigate to group
    await page.click(`text=${testGroup.name}`);
    await page.waitForURL(/\/group\/[a-zA-Z0-9]+/, { timeout: 10000 });
    
    // Click on "Invite" button
    await page.click('button:has-text("Invite")');
    
    // Check for invite dialog
    await expect(page.locator('text=Invite, text=Join')).toBeVisible();
  });

  test('should display empty state when no groups exist', async ({ page }) => {
    await page.goto('/groups');
    
    // Check for empty state message
    const emptyState = page.locator('text=No groups yet, text=Create your first group');
    
    // If groups exist, this test is not applicable
    const hasGroups = await page.locator('text=Your Groups').isVisible();
    if (!hasGroups) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('should navigate back to groups from group detail', async ({ page }) => {
    await page.goto('/groups');
    
    // Create a group
    await page.click('button:has-text("New Group"), button:has-text("Create")');
    await page.fill('input[id="groupName"]', testGroup.name);
    await page.click('button:has-text("Create Group"), button[type="submit"]:has-text("Create")');
    
    // Navigate to group
    await page.click(`text=${testGroup.name}`);
    await page.waitForURL(/\/group\/[a-zA-Z0-9]+/, { timeout: 10000 });
    
    // Click back button
    await page.click('button:has-text("Back"), a:has-text("Back")');
    
    // Verify we're back on groups page
    await page.waitForURL('/groups', { timeout: 5000 });
    await expect(page.locator('h1:has-text("Your Groups"), h1:has-text("Groups")')).toBeVisible();
  });
});
