import { test, expect } from '@playwright/test';

const TEST_TOKEN = 'test-token-12345';

// The editor renders chapter content only once a tracked config is selected, so
// every test that touches the editor must first select a "Ready" config from the
// sidebar. On a fresh load nothing is selected and the editor shows
// "Choose a tracked config from the sidebar to begin editing."
async function selectFirstReadyConfig(page: import('@playwright/test').Page) {
  const firstReady = page
    .locator('.gsd-sidebar__item:has(.gsd-sidebar__status--ok) .gsd-sidebar__button')
    .first();
  if (await firstReady.isVisible({ timeout: 10000 })) {
    await firstReady.click();
    await page.waitForTimeout(500);
  }
}

test.describe('GSD Config Manager - Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/?t=${TEST_TOKEN}`, { waitUntil: 'networkidle', timeout: 60000 });
    await expect(page.locator('.gsd-sidebar__heading:has-text("Tracked configs")')).toBeVisible({ timeout: 30000 });
    await selectFirstReadyConfig(page);
  });

  test('app loads and shows sidebar', async ({ page }) => {
    await expect(page.locator('.gsd-sidebar__heading:has-text("Tracked configs")')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.gsd-add-menu button:has-text("Add")')).toBeVisible({ timeout: 30000 });
  });

  test('schema workspace accessible', async ({ page }) => {
    // Capture console messages
    page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', error => console.log(`[PAGE ERROR] ${error.message}`));

    await page.goto(`/?t=${TEST_TOKEN}`, { waitUntil: 'networkidle', timeout: 60000 });
    await expect(page.locator('button[aria-label*="Open schema maintenance"]')).toBeVisible({ timeout: 30000 });
    await page.click('button[aria-label*="Open schema maintenance"]', { force: true });
    // Debug: wait and print HTML
    await page.waitForTimeout(3000);
    const html = await page.content();
    console.log('HTML after click:', html.substring(0, 10000));
    // Wait for schema workspace heading
    await expect(page.locator('text=Keep your schema aligned with gsd-core')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Check for updates')).toBeVisible({ timeout: 15000 });
  });
});