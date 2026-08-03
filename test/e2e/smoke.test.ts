import { test, expect } from '@playwright/test';

test.describe('GSD Config Manager - Smoke Tests', () => {
  test('app loads and shows sidebar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Config files')).toBeVisible();
    await expect(page.locator('text=Add')).toBeVisible();
  });

  test('add config via path entry', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Add")');
    await page.click('text=Enter absolute path');
    await page.fill('input[type="text"]', '/tmp/nonexistent/.planning/config.json');
    await page.click('button:has-text("Add config")');
    // Should show error for nonexistent file
    await expect(page.locator('text=not found')).toBeVisible({ timeout: 5000 });
  });

  test('schema workspace accessible', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Schema');
    await expect(page.locator('text=Schema maintenance')).toBeVisible();
    await expect(page.locator('text=Check for updates')).toBeVisible();
  });
});