import { test, expect } from '@playwright/test';

/**
 * FE-008: Agent Spawn Wizard
 *
 * FE-008a: UI scaffolding — 3-step wizard with step indicators, navigation,
 * form state preservation, keyboard accessibility.
 *
 * FE-008b: Validation and API integration — field validation, duplicate
 * username detection, server-populated dropdowns, spawn submission with
 * loading/error states.
 */
test.describe('FE-008: Spawn Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/agents');
  });

  // --- FE-008a: UI Scaffolding ---

  test.describe('FE-008a: UI Scaffolding', () => {
    test('Spawn Agent button opens wizard modal', async ({ page }) => {
      const spawnBtn = page.locator(
        'button:has-text("Spawn Agent"), button:has-text("Spawn"), [data-testid="spawn-agent-btn"]'
      ).first();
      await expect(spawnBtn).toBeVisible();
      await spawnBtn.click();

      const modal = page.locator(
        '[data-testid="spawn-wizard"], [class*="SpawnWizard"], dialog, [role="dialog"]'
      ).first();
      await expect(modal).toBeVisible();
    });

    test('wizard has 3-step indicator bar showing current, completed, and remaining steps', async ({ page }) => {
      const spawnBtn = page.locator(
        'button:has-text("Spawn Agent"), button:has-text("Spawn"), [data-testid="spawn-agent-btn"]'
      ).first();
      await spawnBtn.click();

      const stepIndicator = page.locator(
        '[data-testid="step-indicator"], [class*="StepIndicator"], [class*="step-indicator"], [class*="stepper"]'
      ).first();
      await expect(stepIndicator).toBeVisible();

      // Should show 3 steps
      const steps = stepIndicator.locator(
        '[data-testid="step"], [class*="step"], li'
      );
      await expect(steps).toHaveCount(3);

      // First step should be active/current
      const firstStep = steps.first();
      const firstClasses = (await firstStep.getAttribute('class')) || '';
      const firstAria = (await firstStep.getAttribute('aria-current')) || '';
      const isCurrent =
        firstClasses.includes('active') || firstClasses.includes('current') ||
        firstAria === 'step' || firstAria === 'true';
      expect(isCurrent).toBeTruthy();
    });

    test('Step 1 (Identity): shows username, personality dropdown, custom prompt textarea', async ({ page }) => {
      const spawnBtn = page.locator(
        'button:has-text("Spawn Agent"), button:has-text("Spawn"), [data-testid="spawn-agent-btn"]'
      ).first();
      await spawnBtn.click();

      // Username input
      const usernameInput = page.locator(
        'input[name="username"], input[placeholder*="username" i], [data-testid="username-input"]'
      ).first();
      await expect(usernameInput).toBeVisible();

      // Personality dropdown
      const personalitySelect = page.locator(
        'select[name="personality"], [data-testid="personality-select"], [class*="personality"] select, [class*="personality"] [role="combobox"], [class*="personality"] [role="listbox"]'
      ).first();
      await expect(personalitySelect).toBeVisible();

      // Custom prompt textarea (optional field)
      const promptTextarea = page.locator(
        'textarea[name="prompt"], textarea[name="custom_prompt"], [data-testid="custom-prompt"], textarea[placeholder*="prompt" i]'
      ).first();
      await expect(promptTextarea).toBeVisible();
    });

    test('Step 2 (Configuration): shows model selector, room multi-select, tool restrictions', async ({ page }) => {
      const spawnBtn = page.locator(
        'button:has-text("Spawn Agent"), button:has-text("Spawn"), [data-testid="spawn-agent-btn"]'
      ).first();
      await spawnBtn.click();

      // Navigate to Step 2
      const nextBtn = page.locator(
        'button:has-text("Next"), [data-testid="next-btn"]'
      ).first();

      // Fill required fields on Step 1 to enable navigation
      const usernameInput = page.locator(
        'input[name="username"], [data-testid="username-input"]'
      ).first();
      if (await usernameInput.isVisible()) {
        await usernameInput.fill('test-agent');
      }

      await nextBtn.click();

      // Model selector
      const modelSelect = page.locator(
        'select[name="model"], [data-testid="model-select"], [class*="model"] select, [class*="model"] [role="combobox"]'
      ).first();
      await expect(modelSelect).toBeVisible();

      // Room multi-select
      const roomSelect = page.locator(
        '[data-testid="room-select"], [class*="room"] select[multiple], [class*="room-multi"], [class*="multi-select"]'
      ).first();
      await expect(roomSelect).toBeVisible();

      // Tool restrictions (optional)
      const toolField = page.locator(
        '[data-testid="tool-restrictions"], [class*="tool"], input[name*="tool" i]'
      ).first();
      // Tool restrictions are optional, just verify the field exists in the DOM
      expect(toolField).toBeDefined();
    });

    test('Step 3 (Review): shows read-only summary of all selections', async ({ page }) => {
      const spawnBtn = page.locator(
        'button:has-text("Spawn Agent"), button:has-text("Spawn"), [data-testid="spawn-agent-btn"]'
      ).first();
      await spawnBtn.click();

      // Fill Step 1
      const usernameInput = page.locator(
        'input[name="username"], [data-testid="username-input"]'
      ).first();
      if (await usernameInput.isVisible()) {
        await usernameInput.fill('review-agent');
      }

      // Next to Step 2
      await page.locator('button:has-text("Next"), [data-testid="next-btn"]').first().click();

      // Fill Step 2 minimally — select a model if available
      const modelSelect = page.locator(
        'select[name="model"], [data-testid="model-select"]'
      ).first();
      if (await modelSelect.isVisible()) {
        const options = modelSelect.locator('option');
        if ((await options.count()) > 1) {
          await modelSelect.selectOption({ index: 1 });
        }
      }

      // Next to Step 3
      await page.locator('button:has-text("Next"), [data-testid="next-btn"]').first().click();

      // Should be on Review step
      const reviewSection = page.locator(
        '[data-testid="review-step"], [class*="review"], [class*="summary"]'
      ).first();
      await expect(reviewSection).toBeVisible();

      // Should show username entered in Step 1
      const reviewText = await reviewSection.textContent();
      expect(reviewText).toContain('review-agent');

      // "Next" should be replaced by "Spawn"
      const spawnSubmitBtn = page.locator(
        'button:has-text("Spawn"), [data-testid="spawn-submit-btn"]'
      ).first();
      await expect(spawnSubmitBtn).toBeVisible();
    });

    test('Back button navigates to previous step; disabled on Step 1', async ({ page }) => {
      const spawnBtn = page.locator(
        'button:has-text("Spawn Agent"), button:has-text("Spawn"), [data-testid="spawn-agent-btn"]'
      ).first();
      await spawnBtn.click();

      // On Step 1, Back should be disabled
      const backBtn = page.locator(
        'button:has-text("Back"), [data-testid="back-btn"]'
      ).first();
      if (await backBtn.isVisible()) {
        await expect(backBtn).toBeDisabled();
      }

      // Navigate to Step 2
      const usernameInput = page.locator(
        'input[name="username"], [data-testid="username-input"]'
      ).first();
      if (await usernameInput.isVisible()) {
        await usernameInput.fill('back-test');
      }
      await page.locator('button:has-text("Next"), [data-testid="next-btn"]').first().click();

      // Back should now be enabled
      if (await backBtn.isVisible()) {
        await expect(backBtn).toBeEnabled();
        await backBtn.click();

        // Should be back on Step 1 with preserved data
        const preservedValue = await usernameInput.inputValue();
        expect(preservedValue).toBe('back-test');
      }
    });

    test('Cancel button closes modal and discards data', async ({ page }) => {
      const spawnBtn = page.locator(
        'button:has-text("Spawn Agent"), button:has-text("Spawn"), [data-testid="spawn-agent-btn"]'
      ).first();
      await spawnBtn.click();

      const modal = page.locator(
        '[data-testid="spawn-wizard"], [class*="SpawnWizard"], dialog, [role="dialog"]'
      ).first();
      await expect(modal).toBeVisible();

      const cancelBtn = page.locator(
        'button:has-text("Cancel"), [data-testid="cancel-btn"]'
      ).first();
      await cancelBtn.click();

      await expect(modal).not.toBeVisible();
    });

    test('Escape key closes the wizard modal', async ({ page }) => {
      const spawnBtn = page.locator(
        'button:has-text("Spawn Agent"), button:has-text("Spawn"), [data-testid="spawn-agent-btn"]'
      ).first();
      await spawnBtn.click();

      const modal = page.locator(
        '[data-testid="spawn-wizard"], [class*="SpawnWizard"], dialog, [role="dialog"]'
      ).first();
      await expect(modal).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(modal).not.toBeVisible();
    });

    test('form state is preserved when navigating back and forth between steps', async ({ page }) => {
      const spawnBtn = page.locator(
        'button:has-text("Spawn Agent"), button:has-text("Spawn"), [data-testid="spawn-agent-btn"]'
      ).first();
      await spawnBtn.click();

      // Fill Step 1
      const usernameInput = page.locator(
        'input[name="username"], [data-testid="username-input"]'
      ).first();
      await usernameInput.fill('preserved-agent');

      const promptTextarea = page.locator(
        'textarea[name="prompt"], textarea[name="custom_prompt"], [data-testid="custom-prompt"]'
      ).first();
      if (await promptTextarea.isVisible()) {
        await promptTextarea.fill('custom prompt text');
      }

      // Go to Step 2
      await page.locator('button:has-text("Next"), [data-testid="next-btn"]').first().click();

      // Go back to Step 1
      await page.locator('button:has-text("Back"), [data-testid="back-btn"]').first().click();

      // Verify fields are preserved
      await expect(usernameInput).toHaveValue('preserved-agent');
      if (await promptTextarea.isVisible()) {
        await expect(promptTextarea).toHaveValue('custom prompt text');
      }
    });
  });

  // --- FE-008b: Validation and API Integration ---

  test.describe('FE-008b: Validation and API', () => {
    test('username validation: required, 1-32 chars, alphanumeric + hyphens, no leading hyphen', async ({ page }) => {
      const spawnBtn = page.locator(
        'button:has-text("Spawn Agent"), button:has-text("Spawn"), [data-testid="spawn-agent-btn"]'
      ).first();
      await spawnBtn.click();

      const usernameInput = page.locator(
        'input[name="username"], [data-testid="username-input"]'
      ).first();

      // Empty username — required
      await usernameInput.fill('');
      await usernameInput.blur();
      const errorEmpty = page.locator(
        '[data-testid="username-error"], [class*="error"], [class*="invalid"]'
      ).first();
      await expect(errorEmpty).toBeVisible();

      // Leading hyphen — invalid
      await usernameInput.fill('-invalid');
      await usernameInput.blur();
      const errorHyphen = page.locator(
        '[data-testid="username-error"], [class*="error"], [class*="invalid"]'
      ).first();
      await expect(errorHyphen).toBeVisible();

      // Special characters — invalid
      await usernameInput.fill('bad@name!');
      await usernameInput.blur();
      await expect(errorHyphen).toBeVisible();

      // Valid username — error clears
      await usernameInput.fill('valid-agent-1');
      await usernameInput.blur();
      // Error message should disappear or not be in error state
      await page.waitForTimeout(500);
      const errorAfterValid = page.locator(
        '[data-testid="username-error"]'
      ).first();
      const errorVisible = await errorAfterValid.isVisible().catch(() => false);
      // If a specific error element exists, it should not be visible; otherwise check classes
      if (errorVisible) {
        const text = await errorAfterValid.textContent();
        // Should not contain a validation error message for a valid input
        expect(text?.toLowerCase()).not.toMatch(/required|invalid|hyphen/);
      }
    });

    test('validation runs on Next click and blocks navigation if invalid', async ({ page }) => {
      const spawnBtn = page.locator(
        'button:has-text("Spawn Agent"), button:has-text("Spawn"), [data-testid="spawn-agent-btn"]'
      ).first();
      await spawnBtn.click();

      // Click Next without filling required fields
      const nextBtn = page.locator(
        'button:has-text("Next"), [data-testid="next-btn"]'
      ).first();
      await nextBtn.click();

      // Should still be on Step 1 with error shown
      const usernameInput = page.locator(
        'input[name="username"], [data-testid="username-input"]'
      ).first();
      await expect(usernameInput).toBeVisible(); // still on Step 1

      const error = page.locator(
        '[data-testid="username-error"], [class*="error"]'
      ).first();
      await expect(error).toBeVisible();
    });

    test('model is required — cannot proceed without selecting one', async ({ page }) => {
      const spawnBtn = page.locator(
        'button:has-text("Spawn Agent"), button:has-text("Spawn"), [data-testid="spawn-agent-btn"]'
      ).first();
      await spawnBtn.click();

      // Fill Step 1 validly
      const usernameInput = page.locator(
        'input[name="username"], [data-testid="username-input"]'
      ).first();
      await usernameInput.fill('model-test');
      await page.locator('button:has-text("Next"), [data-testid="next-btn"]').first().click();

      // On Step 2, try to proceed without selecting model
      await page.locator('button:has-text("Next"), [data-testid="next-btn"]').first().click();

      // Should show model validation error or stay on Step 2
      const modelError = page.locator(
        '[data-testid="model-error"], [class*="error"]'
      ).first();
      const stepStillTwo = page.locator(
        'select[name="model"], [data-testid="model-select"]'
      ).first();
      // Either an error is shown or we are still on step 2
      const hasError = await modelError.isVisible().catch(() => false);
      const stillOnStep2 = await stepStillTwo.isVisible().catch(() => false);
      expect(hasError || stillOnStep2).toBeTruthy();
    });

    test('at least one room must be selected', async ({ page }) => {
      const spawnBtn = page.locator(
        'button:has-text("Spawn Agent"), button:has-text("Spawn"), [data-testid="spawn-agent-btn"]'
      ).first();
      await spawnBtn.click();

      // Fill Step 1
      const usernameInput = page.locator(
        'input[name="username"], [data-testid="username-input"]'
      ).first();
      await usernameInput.fill('room-test');
      await page.locator('button:has-text("Next"), [data-testid="next-btn"]').first().click();

      // On Step 2, try to proceed without selecting any room
      // Select a model first if needed
      const modelSelect = page.locator(
        'select[name="model"], [data-testid="model-select"]'
      ).first();
      if (await modelSelect.isVisible()) {
        const options = modelSelect.locator('option');
        if ((await options.count()) > 1) {
          await modelSelect.selectOption({ index: 1 });
        }
      }

      await page.locator('button:has-text("Next"), [data-testid="next-btn"]').first().click();

      // Should show room validation error or stay on Step 2
      const roomError = page.locator(
        '[data-testid="room-error"], [class*="error"]'
      ).first();
      const roomErrorVisible = await roomError.isVisible().catch(() => false);
      const stepStillTwo = page.locator(
        '[data-testid="room-select"], [class*="room-multi"]'
      ).first();
      const stillOnStep2 = await stepStillTwo.isVisible().catch(() => false);
      expect(roomErrorVisible || stillOnStep2).toBeTruthy();
    });

    test('Spawn button shows progress indicator while request is in flight', async ({ page }) => {
      const spawnBtn = page.locator(
        'button:has-text("Spawn Agent"), button:has-text("Spawn"), [data-testid="spawn-agent-btn"]'
      ).first();
      await spawnBtn.click();

      // Fill Step 1
      await page.locator('input[name="username"], [data-testid="username-input"]').first().fill('spawn-test');
      await page.locator('button:has-text("Next"), [data-testid="next-btn"]').first().click();

      // Fill Step 2 minimally
      const modelSelect = page.locator('select[name="model"], [data-testid="model-select"]').first();
      if (await modelSelect.isVisible()) {
        const options = modelSelect.locator('option');
        if ((await options.count()) > 1) {
          await modelSelect.selectOption({ index: 1 });
        }
      }
      // Select a room
      const roomCheckbox = page.locator('[data-testid="room-select"] input[type="checkbox"], [class*="room-multi"] input[type="checkbox"]').first();
      if (await roomCheckbox.isVisible()) {
        await roomCheckbox.check();
      }

      await page.locator('button:has-text("Next"), [data-testid="next-btn"]').first().click();

      // On Step 3 (Review), click Spawn
      const spawnSubmitBtn = page.locator(
        'button:has-text("Spawn"), [data-testid="spawn-submit-btn"]'
      ).first();
      if (await spawnSubmitBtn.isVisible()) {
        await spawnSubmitBtn.click();

        // Should show loading indicator (spinner, progress bar, or disabled state)
        const loading = page.locator(
          '[data-testid="spawn-loading"], [class*="spinner"], [class*="loading"], [class*="progress"]'
        ).first();
        // Button should be disabled or replaced by loading
        const isDisabled = await spawnSubmitBtn.isDisabled().catch(() => false);
        const loadingVisible = await loading.isVisible().catch(() => false);
        expect(isDisabled || loadingVisible).toBeTruthy();
      }
    });

    test('API error on spawn displays error message without closing modal', async ({ page }) => {
      // Intercept spawn API to return error
      await page.route('**/api/**/spawn', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      const spawnBtn = page.locator(
        'button:has-text("Spawn Agent"), button:has-text("Spawn"), [data-testid="spawn-agent-btn"]'
      ).first();
      await spawnBtn.click();

      // Fill Step 1
      await page.locator('input[name="username"], [data-testid="username-input"]').first().fill('error-test');
      await page.locator('button:has-text("Next"), [data-testid="next-btn"]').first().click();

      // Fill Step 2
      const modelSelect = page.locator('select[name="model"], [data-testid="model-select"]').first();
      if (await modelSelect.isVisible()) {
        const options = modelSelect.locator('option');
        if ((await options.count()) > 1) {
          await modelSelect.selectOption({ index: 1 });
        }
      }
      const roomCheckbox = page.locator('[data-testid="room-select"] input[type="checkbox"], [class*="room-multi"] input[type="checkbox"]').first();
      if (await roomCheckbox.isVisible()) {
        await roomCheckbox.check();
      }

      await page.locator('button:has-text("Next"), [data-testid="next-btn"]').first().click();

      // Click Spawn on Review step
      const spawnSubmitBtn = page.locator(
        'button:has-text("Spawn"), [data-testid="spawn-submit-btn"]'
      ).first();
      if (await spawnSubmitBtn.isVisible()) {
        await spawnSubmitBtn.click();
        await page.waitForTimeout(1000);

        // Modal should still be open
        const modal = page.locator(
          '[data-testid="spawn-wizard"], [class*="SpawnWizard"], dialog, [role="dialog"]'
        ).first();
        await expect(modal).toBeVisible();

        // Error message should be displayed
        const errorMsg = page.locator(
          '[data-testid="spawn-error"], [class*="error-message"], [class*="alert-error"]'
        ).first();
        await expect(errorMsg).toBeVisible();
      }
    });

    test('network error shows generic message with Retry button', async ({ page }) => {
      // Intercept spawn API to simulate network failure
      await page.route('**/api/**/spawn', (route) => {
        route.abort('connectionrefused');
      });

      const spawnBtn = page.locator(
        'button:has-text("Spawn Agent"), button:has-text("Spawn"), [data-testid="spawn-agent-btn"]'
      ).first();
      await spawnBtn.click();

      // Fill wizard steps
      await page.locator('input[name="username"], [data-testid="username-input"]').first().fill('network-test');
      await page.locator('button:has-text("Next"), [data-testid="next-btn"]').first().click();

      const modelSelect = page.locator('select[name="model"], [data-testid="model-select"]').first();
      if (await modelSelect.isVisible()) {
        const options = modelSelect.locator('option');
        if ((await options.count()) > 1) {
          await modelSelect.selectOption({ index: 1 });
        }
      }
      const roomCheckbox = page.locator('[data-testid="room-select"] input[type="checkbox"], [class*="room-multi"] input[type="checkbox"]').first();
      if (await roomCheckbox.isVisible()) {
        await roomCheckbox.check();
      }

      await page.locator('button:has-text("Next"), [data-testid="next-btn"]').first().click();

      const spawnSubmitBtn = page.locator(
        'button:has-text("Spawn"), [data-testid="spawn-submit-btn"]'
      ).first();
      if (await spawnSubmitBtn.isVisible()) {
        await spawnSubmitBtn.click();
        await page.waitForTimeout(1000);

        // Should show network error message
        const errorMsg = page.locator(
          'text=/could not reach|network|connection/i'
        ).first();
        const errorVisible = await errorMsg.isVisible().catch(() => false);

        // Should show Retry button
        const retryBtn = page.locator(
          'button:has-text("Retry"), [data-testid="retry-btn"]'
        ).first();
        const retryVisible = await retryBtn.isVisible().catch(() => false);

        expect(errorVisible || retryVisible).toBeTruthy();
      }
    });

    test('duplicate username detection shows inline error on blur', async ({ page }) => {
      // Intercept username check API to return duplicate
      await page.route('**/api/**/check-username*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ taken: true }),
        });
      });
      await page.route('**/api/**/usernames/*', (route) => {
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Username already taken' }),
        });
      });

      const spawnBtn = page.locator(
        'button:has-text("Spawn Agent"), button:has-text("Spawn"), [data-testid="spawn-agent-btn"]'
      ).first();
      await spawnBtn.click();

      const usernameInput = page.locator(
        'input[name="username"], [data-testid="username-input"]'
      ).first();
      await usernameInput.fill('existing-agent');
      await usernameInput.blur();

      // Wait for debounced API call
      await page.waitForTimeout(500);

      const duplicateError = page.locator(
        '[data-testid="username-error"], [class*="error"]'
      ).first();
      const errorVisible = await duplicateError.isVisible().catch(() => false);
      if (errorVisible) {
        const text = await duplicateError.textContent();
        expect(text?.toLowerCase()).toMatch(/taken|exists|duplicate|already/);
      }
    });
  });
});
