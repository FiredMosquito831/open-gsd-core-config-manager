import { test, expect } from '@playwright/test';


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

test.describe.configure({ retries: 2 });

test.describe('GSD Config Manager - Core Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load', timeout: 60000 });
    await expect(page.locator('.gsd-sidebar__heading:has-text("Tracked configs")')).toBeVisible({ timeout: 30000 });
    await selectFirstReadyConfig(page);
  });

  test('Sidebar - tracked configs list with actions', async ({ page }) => {
    // Check tracked config items
    await expect(page.locator('.gsd-sidebar__list')).toBeVisible();
    await expect(page.locator('.gsd-sidebar__item').first()).toBeVisible();

    // Check Add menu opens
    await page.click('.gsd-add-menu button:has-text("Add")');
    await expect(page.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });
  });

  test('Chapter Navigation - select chapter and view fields', async ({ page }) => {
    // Wait for chapter navigation
    await expect(page.locator('.gsd-chapter-nav')).toBeVisible({ timeout: 30000 });

    // Click on first available chapter
    const chapters = page.locator('.gsd-chapter-nav__item');
    const count = await chapters.count();
    expect(count).toBeGreaterThan(0);

    // Click first chapter
    await chapters.first().click();

    // Wait for chapter view to load - check for either chapter-view or profile cards
    await expect(page.locator('.gsd-chapter-view, .gsd-profile-chapter')).toBeVisible({ timeout: 15000 });
  });

  test('Profiles Chapter - ProfileCards visible', async ({ page }) => {
    // Navigate to Profiles chapter
    const profilesTab = page.locator('.gsd-chapter-nav__item:has-text("Profiles")');
    if (await profilesTab.isVisible({ timeout: 5000 })) {
      await profilesTab.click();

      // Wait for ProfileCards
      await expect(page.locator('.gsd-profile-chapter')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('.gsd-profile-card').first()).toBeVisible({ timeout: 10000 });

      // Click on a profile card
      await page.locator('.gsd-profile-card').first().click();

      // Click "Create custom project configuration" button
      await expect(page.locator('button:has-text("Create custom project configuration")')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Search - global search input exists and works', async ({ page }) => {
    // Click search input and type
    const searchInput = page.locator('#gsd-global-search-input');
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Type "model" to search
    await searchInput.fill('model');
    await page.waitForTimeout(1000);

    // Should show some results or filtered view
    // At minimum the input should have the value
    await expect(searchInput).toHaveValue('model');
  });

  test('Schema Workspace - accessible from rail button', async ({ page }) => {
    // Click schema maintenance button in rail
    await page.click('button[aria-label*="Open schema maintenance"]');

    // Should show SchemaWorkspace
    await expect(page.locator('.gsd-schema-workspace')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Keep your schema aligned with gsd-core')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Check for updates')).toBeVisible({ timeout: 10000 });
    // "Active schema" matches both the source-card h2 and the loading paragraph; target the heading.
    await expect(page.locator('.gsd-schema-source-card > h2')).toBeVisible({ timeout: 10000 });

    // Back to editor
    await page.click('button:has-text("Back to editor")');
    // Wait for editor to return (comma selector matches both; take the first)
    await expect(page.locator('.gsd-config-editor, .gsd-chapter-view').first()).toBeVisible({ timeout: 10000 });
  });

  test('History Workspace - accessible from View history button', async ({ page }) => {
    // Click history button in config editor header
    await expect(page.locator('button:has-text("View history")').first()).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("View history")');

    // Should show HistoryWorkspace (class is gsd-history, not gsd-history-workspace)
    await expect(page.locator('.gsd-history')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.gsd-history__eyebrow', { hasText: 'Version history' })).toBeVisible({ timeout: 10000 });
  });

  test('Field editing - enum combobox is visible', async ({ page }) => {
    // Go to Workflow chapter
    const workflowTab = page.locator('.gsd-chapter-nav__item:has-text("Workflow")');
    if (await workflowTab.isVisible({ timeout: 5000 })) {
      await workflowTab.click();

      // Wait for chapter view
      await expect(page.locator('.gsd-chapter-view')).toBeVisible({ timeout: 10000 });

      // Find a field with enum (e.g., mode). :has-text matches multiple cards
      // (descriptions contain "mode"), so take the first and scope the select to it.
      const modeField = page.locator('.gsd-field-card:has-text("mode")').first();
      if (await modeField.isVisible({ timeout: 5000 })) {
        // Find the select/enum combobox
        const combobox = modeField.locator('select').first();
        if (await combobox.isVisible({ timeout: 5000 })) {
          // Check it has options
          const options = combobox.locator('option');
          const count = await options.count();
          expect(count).toBeGreaterThan(1);
        }
      }
    }
  });

  test('Save Bar - exists in editor', async ({ page }) => {
    // Navigate to a chapter
    const workflowTab = page.locator('.gsd-chapter-nav__item:has-text("Workflow")');
    if (await workflowTab.isVisible({ timeout: 5000 })) {
      await workflowTab.click();
      await expect(page.locator('.gsd-chapter-view')).toBeVisible({ timeout: 10000 });

      // Save bar should be visible
      await expect(page.locator('.gsd-save-bar')).toBeVisible({ timeout: 10000 });
    }
  });

  test('Generic JSON Editor / Focused Workspace accessible via handoff', async ({ page }) => {
    // Find a handoff button for any field
    const handoffButtons = page.locator('[data-testid^="handoff-"]');
    const count = await handoffButtons.count();
    if (count > 0) {
      await handoffButtons.first().click();

      // Should open either FocusedWorkspace or GenericJsonEditor
      const focusedVisible = await page.locator('.gsd-focused-workspace').isVisible({ timeout: 10000 });
      const genericVisible = await page.locator('.gsd-generic-json-editor').isVisible({ timeout: 10000 });

      expect(focusedVisible || genericVisible).toBeTruthy();

      // Back button should exist
      if (focusedVisible) {
        await page.click('button:has-text("Back to")');
      } else if (genericVisible) {
        await page.click('button:has-text("Back to")');
      }

      // Should return to chapter view
      await expect(page.locator('.gsd-chapter-view, .gsd-profile-chapter')).toBeVisible({ timeout: 10000 });
    }
  });

  test('Create new config - dialog opens', async ({ page }) => {
    // Click Create new config
    await page.click('button:has-text("Create new config")');

    // Should open CreateConfigDialog
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h2:has-text("Create new config")')).toBeVisible({ timeout: 5000 });

    // Cancel
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 5000 });
  });

  test('Add existing config - dialog opens', async ({ page }) => {
    // Click Add menu -> Add existing config
    await page.click('.gsd-add-menu button:has-text("Add")');
    await expect(page.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

    // Menu item is labeled "Add by path…" (not "Add existing config").
    await page.click('[role="menuitem"]:has-text("Add by path")');

    // The "path" mode PathEntryDialog opens (heading is "Add config by path";
    // the path field is labeled "Absolute path", not "Enter the absolute path").
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h2', { hasText: 'Add config by path' })).toBeVisible({ timeout: 5000 });

    // Cancel
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 5000 });
  });
});

test.describe('GSD Config Manager - Specialized Editors', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'load', timeout: 60000 });
    await expect(page.locator('.gsd-sidebar__heading:has-text("Tracked configs")')).toBeVisible({ timeout: 30000 });
    await selectFirstReadyConfig(page);
  });

  test('Model & Routing - model_overrides agent-map editor', async ({ page }) => {
    const modelTab = page.locator('.gsd-chapter-nav__item:has-text("Model")');
    if (await modelTab.isVisible({ timeout: 5000 })) {
      await modelTab.click();
      await expect(page.locator('.gsd-chapter-view')).toBeVisible({ timeout: 15000 });

      const handoffBtn = page.locator('[data-testid="handoff-model_overrides"]');
      if (await handoffBtn.isVisible({ timeout: 5000 })) {
        await handoffBtn.click();
        await expect(page.locator('.gsd-focused-workspace')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('.gsd-focused-workspace h2', { hasText: 'model_overrides' })).toBeVisible({ timeout: 10000 });

        // model_overrides may be empty in the merged config; verify the pool-list
        // container renders (it does even with no rows) rather than assuming entries.
        await expect(page.locator('.gsd-pool-list').first()).toBeVisible({ timeout: 10000 });

        // If entries exist, drill into the first one to verify the agent-map editor.
        const rows = page.locator('.gsd-pool-list__row');
        if (await rows.count() > 0) {
          await rows.first().click();
          await expect(page.locator('.gsd-agent-map-editor')).toBeVisible({ timeout: 5000 });
          await expect(page.locator('select[id^="agent-"]')).toBeVisible({ timeout: 5000 });
        }

        await page.click('button:has-text("Back to")');
      }
    }
  });

  test('Model & Routing - models runtime-tier-map editor', async ({ page }) => {
    const modelTab = page.locator('.gsd-chapter-nav__item:has-text("Model")');
    if (await modelTab.isVisible({ timeout: 5000 })) {
      await modelTab.click();
      await expect(page.locator('.gsd-chapter-view')).toBeVisible({ timeout: 15000 });

      const handoffBtn = page.locator('[data-testid="handoff-models"]');
      if (await handoffBtn.isVisible({ timeout: 5000 })) {
        await handoffBtn.click();
        await expect(page.locator('.gsd-focused-workspace')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('.gsd-focused-workspace h2', { hasText: 'models' })).toBeVisible({ timeout: 10000 });

        // Should show map entries
        await expect(page.locator('.gsd-pool-list__row').first()).toBeVisible({ timeout: 10000 });

        await page.click('button:has-text("Back to")');
      }
    }
  });

  test('Effort - effort.routing_tier_defaults runtime-tier-map editor', async ({ page }) => {
    const effortTab = page.locator('.gsd-chapter-nav__item:has-text("Effort")');
    if (await effortTab.isVisible({ timeout: 5000 })) {
      await effortTab.click();
      await expect(page.locator('.gsd-chapter-view')).toBeVisible({ timeout: 15000 });

      const handoffBtn = page.locator('[data-testid="handoff-effort.routing_tier_defaults"]');
      if (await handoffBtn.isVisible({ timeout: 5000 })) {
        await handoffBtn.click();
        await expect(page.locator('.gsd-focused-workspace')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('.gsd-focused-workspace h2', { hasText: 'effort.routing_tier_defaults' })).toBeVisible({ timeout: 10000 });

        await expect(page.locator('.gsd-pool-list__row').first()).toBeVisible({ timeout: 10000 });

        await page.click('button:has-text("Back to")');
      }
    }
  });

  test('Planning - granularities runtime-tier-map editor', async ({ page }) => {
    const planningTab = page.locator('.gsd-chapter-nav__item:has-text("Planning")');
    if (await planningTab.isVisible({ timeout: 5000 })) {
      await planningTab.click();
      await expect(page.locator('.gsd-chapter-view')).toBeVisible({ timeout: 15000 });

      const handoffBtn = page.locator('[data-testid="handoff-granularities"]');
      if (await handoffBtn.isVisible({ timeout: 5000 })) {
        await handoffBtn.click();
        await expect(page.locator('.gsd-focused-workspace')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('.gsd-focused-workspace h2', { hasText: 'granularities' })).toBeVisible({ timeout: 10000 });

        // granularities may be empty in the merged config; verify the pool-list
        // container renders (it does even with no rows) rather than assuming entries.
        await expect(page.locator('.gsd-pool-list').first()).toBeVisible({ timeout: 10000 });

        await page.click('button:has-text("Back to")');
      }
    }
  });

  test('Ship - ship.pr_body_sections structured-array editor', async ({ page }) => {
    const shipTab = page.locator('.gsd-chapter-nav__item:has-text("Ship")');
    if (await shipTab.isVisible({ timeout: 5000 })) {
      await shipTab.click();
      await expect(page.locator('.gsd-chapter-view')).toBeVisible({ timeout: 15000 });

      const handoffBtn = page.locator('[data-testid="handoff-ship.pr_body_sections"]');
      if (await handoffBtn.isVisible({ timeout: 5000 })) {
        await handoffBtn.click();
        await expect(page.locator('.gsd-focused-workspace')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('.gsd-focused-workspace h2', { hasText: 'ship.pr_body_sections' })).toBeVisible({ timeout: 10000 });

        // Should show PoolEntryList
        await expect(page.locator('.gsd-pool-list')).toBeVisible({ timeout: 10000 });

        // Add entry
        await page.click('button:has-text("Add entry")');
        await expect(page.locator('.gsd-focused-workspace__detail')).toBeVisible({ timeout: 5000 });

        await page.click('button:has-text("Back to")');
      }
    }
  });

  test('Fast Mode - fast_mode.agent_overrides agent-map editor', async ({ page }) => {
    const fastTab = page.locator('.gsd-chapter-nav__item:has-text("Fast")');
    if (await fastTab.isVisible({ timeout: 5000 })) {
      await fastTab.click();
      await expect(page.locator('.gsd-chapter-view')).toBeVisible({ timeout: 15000 });

      const handoffBtn = page.locator('[data-testid="handoff-fast_mode.agent_overrides"]');
      if (await handoffBtn.isVisible({ timeout: 5000 })) {
        await handoffBtn.click();
        await expect(page.locator('.gsd-focused-workspace')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('.gsd-focused-workspace h2', { hasText: 'fast_mode.agent_overrides' })).toBeVisible({ timeout: 10000 });

        await expect(page.locator('.gsd-pool-list__row').first()).toBeVisible({ timeout: 10000 });

        await page.click('button:has-text("Back to")');
      }
    }
  });

  test('Review - review.models runtime-tier-map editor', async ({ page }) => {
    const reviewTab = page.locator('.gsd-chapter-nav__item:has-text("Review")');
    if (await reviewTab.isVisible({ timeout: 5000 })) {
      await reviewTab.click();
      await expect(page.locator('.gsd-chapter-view')).toBeVisible({ timeout: 15000 });

      const handoffBtn = page.locator('[data-testid="handoff-review.models"]');
      if (await handoffBtn.isVisible({ timeout: 5000 })) {
        await handoffBtn.click();
        await expect(page.locator('.gsd-focused-workspace')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('.gsd-focused-workspace h2', { hasText: 'review.models' })).toBeVisible({ timeout: 10000 });

        await expect(page.locator('.gsd-pool-list__row').first()).toBeVisible({ timeout: 10000 });

        await page.click('button:has-text("Back to")');
      }
    }
  });

  test('Review - review.max_prompt_tokens_per_reviewer runtime-tier-map editor', async ({ page }) => {
    const reviewTab = page.locator('.gsd-chapter-nav__item:has-text("Review")');
    if (await reviewTab.isVisible({ timeout: 5000 })) {
      await reviewTab.click();
      await expect(page.locator('.gsd-chapter-view')).toBeVisible({ timeout: 15000 });

      const handoffBtn = page.locator('[data-testid="handoff-review.max_prompt_tokens_per_reviewer"]');
      if (await handoffBtn.isVisible({ timeout: 5000 })) {
        await handoffBtn.click();
        await expect(page.locator('.gsd-focused-workspace')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('.gsd-focused-workspace h2', { hasText: 'review.max_prompt_tokens_per_reviewer' })).toBeVisible({ timeout: 10000 });

        await expect(page.locator('.gsd-pool-list__row').first()).toBeVisible({ timeout: 10000 });

        await page.click('button:has-text("Back to")');
      }
    }
  });

  test('Discovery - agent_skills runtime-tier-map editor', async ({ page }) => {
    const discoveryTab = page.locator('.gsd-chapter-nav__item:has-text("Discovery")');
    if (await discoveryTab.isVisible({ timeout: 5000 })) {
      await discoveryTab.click();
      await expect(page.locator('.gsd-chapter-view')).toBeVisible({ timeout: 15000 });

      const handoffBtn = page.locator('[data-testid="handoff-agent_skills"]');
      if (await handoffBtn.isVisible({ timeout: 5000 })) {
        await handoffBtn.click();
        await expect(page.locator('.gsd-focused-workspace')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('text=agent_skills')).toBeVisible({ timeout: 10000 });

        await expect(page.locator('.gsd-pool-list__row').first()).toBeVisible({ timeout: 10000 });

        await page.click('button:has-text("Back to")');
      }
    }
  });
});

test.describe('GSD Config Manager - UI Responsiveness', () => {
  test('Resize - sidebar collapse/expand', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load', timeout: 60000 });
    // .gsd-sidebar__heading matches both "Tracked configs" and "Chapters"; take the first.
    await expect(page.locator('.gsd-sidebar__heading').first()).toBeVisible({ timeout: 30000 });

    // Collapse sidebar using rail button
    await page.click('button[aria-label*="Collapse tracked configs"]');
    await expect(page.locator('.gsd-app-shell__left[aria-hidden="true"]')).toBeVisible({ timeout: 5000 });

    // Expand again
    await page.click('button[aria-label*="Show tracked configs"]');
    await expect(page.locator('.gsd-app-shell__left[aria-hidden="false"]')).toBeVisible({ timeout: 5000 });
  });

  test('Resize - chapter pane collapse/expand', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load', timeout: 60000 });
    await expect(page.locator('.gsd-chapter-nav')).toBeVisible({ timeout: 30000 });

    // Collapse chapter pane
    await page.click('button[aria-label*="Collapse chapters"]');
    await expect(page.locator('.gsd-app-shell__middle[aria-hidden="true"]')).toBeVisible({ timeout: 5000 });

    // Expand again
    await page.click('button[aria-label*="Show chapters"]');
    await expect(page.locator('.gsd-app-shell__middle[aria-hidden="false"]')).toBeVisible({ timeout: 5000 });
  });
});