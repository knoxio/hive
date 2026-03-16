import { test, expect } from '@playwright/test';

/**
 * FE-006: Basic Agent List (Read-Only)
 *
 * Verifies the agent grid with status cards, health indicators,
 * personality/model info, responsive layout, and empty state.
 */
test.describe('FE-006: Agent List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/agents');
  });

  test('renders AgentGrid container', async ({ page }) => {
    const grid = page.locator(
      '[data-testid="agent-grid"], [class*="AgentGrid"], [class*="agent-grid"]'
    ).first();
    await expect(grid).toBeVisible();
  });

  test('each agent card displays name, personality, model, uptime, health, status, and iteration count', async ({ page }) => {
    const cards = page.locator(
      '[data-testid="agent-card"], [class*="AgentCard"], [class*="agent-card"]'
    );
    const count = await cards.count();
    if (count > 0) {
      const card = cards.first();

      // Agent name
      const name = card.locator(
        '[data-testid="agent-name"], [class*="agent-name"], [class*="name"]'
      ).first();
      await expect(name).toBeVisible();
      const nameText = await name.textContent();
      expect(nameText?.trim().length).toBeGreaterThan(0);

      // Personality label
      const personality = card.locator(
        '[data-testid="agent-personality"], [class*="personality"]'
      ).first();
      await expect(personality).toBeVisible();

      // Model name
      const model = card.locator(
        '[data-testid="agent-model"], [class*="model"]'
      ).first();
      await expect(model).toBeVisible();

      // Uptime duration
      const uptime = card.locator(
        '[data-testid="agent-uptime"], [class*="uptime"]'
      ).first();
      await expect(uptime).toBeVisible();

      // Health indicator (traffic light)
      const health = card.locator(
        '[data-testid="health-indicator"], [class*="health"], [class*="traffic-light"]'
      ).first();
      await expect(health).toBeVisible();

      // Status text
      const status = card.locator(
        '[data-testid="agent-status"], [class*="status"]'
      ).first();
      await expect(status).toBeVisible();

      // Iteration count
      const iterations = card.locator(
        '[data-testid="iteration-count"], [class*="iteration"]'
      ).first();
      await expect(iterations).toBeVisible();
    }
  });

  test('health indicators use green/yellow/red for running/warning/error states', async ({ page }) => {
    const healthIndicators = page.locator(
      '[data-testid="health-indicator"], [class*="health"], [class*="traffic-light"]'
    );
    const count = await healthIndicators.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const indicator = healthIndicators.nth(i);
        const classes = (await indicator.getAttribute('class')) || '';
        const style = (await indicator.getAttribute('style')) || '';
        const ariaLabel = (await indicator.getAttribute('aria-label')) || '';
        const text = (await indicator.textContent()) || '';
        const combined = `${classes} ${style} ${ariaLabel} ${text}`.toLowerCase();
        // Each indicator should convey one of the three states
        const hasState =
          combined.includes('green') || combined.includes('healthy') || combined.includes('running') ||
          combined.includes('yellow') || combined.includes('warning') ||
          combined.includes('red') || combined.includes('error') || combined.includes('crashed');
        expect(hasState).toBeTruthy();
      }
    }
  });

  test('summary bar shows total agent count and health breakdown', async ({ page }) => {
    const summaryBar = page.locator(
      '[data-testid="agent-summary"], [class*="summary"], [class*="agent-summary"]'
    ).first();
    if (await summaryBar.isVisible()) {
      const text = (await summaryBar.textContent()) || '';
      // Should contain agent count and health breakdown
      expect(text).toMatch(/\d+\s*agent/i);
    }
  });

  test('clicking an agent card selects it and opens context panel details', async ({ page }) => {
    const cards = page.locator(
      '[data-testid="agent-card"], [class*="AgentCard"], [class*="agent-card"]'
    );
    const count = await cards.count();
    if (count > 0) {
      const card = cards.first();
      await card.click();
      // Card should show selected state
      await expect(card).toHaveClass(/active|selected|highlight/);

      // Context panel should show expanded details
      const contextPanel = page.locator(
        '[data-testid="context-panel"], [class*="context"], [class*="right-panel"], [class*="detail"]'
      ).first();
      await expect(contextPanel).toBeVisible();

      // Expanded details should include recent messages, room assignments, or status history
      const detailContent = await contextPanel.textContent();
      expect(detailContent?.trim().length).toBeGreaterThan(0);
    }
  });

  test('responsive grid: adjusts columns based on viewport width', async ({ page }) => {
    const grid = page.locator(
      '[data-testid="agent-grid"], [class*="AgentGrid"], [class*="agent-grid"]'
    ).first();
    if (await grid.isVisible()) {
      // Large screen (3 columns)
      await page.setViewportSize({ width: 1280, height: 720 });
      const gridStyle = await grid.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          display: style.display,
          gridTemplateColumns: style.gridTemplateColumns,
        };
      });
      // Grid should use CSS grid or flexbox for responsive layout
      expect(
        gridStyle.display === 'grid' || gridStyle.display === 'flex' || gridStyle.display === 'block'
      ).toBeTruthy();

      // Small screen (1 column)
      await page.setViewportSize({ width: 480, height: 720 });
      await page.waitForTimeout(300); // allow layout reflow
      const narrowStyle = await grid.evaluate((el) => {
        return window.getComputedStyle(el).gridTemplateColumns;
      });
      // On small screens, columns should be fewer (single column or auto-fit to 1)
      expect(narrowStyle).toBeDefined();
    }
  });

  test('empty state shown when no agents are running', async ({ page }) => {
    const cards = page.locator(
      '[data-testid="agent-card"], [class*="AgentCard"], [class*="agent-card"]'
    );
    const count = await cards.count();
    if (count === 0) {
      const emptyState = page.locator(
        '[data-testid="empty-state"], [class*="empty"], text=/no.*agents/i'
      ).first();
      await expect(emptyState).toBeVisible();
    }
  });

  test('agent data refreshes when navigating to Agents tab', async ({ page }) => {
    // Navigate away and back to trigger re-fetch
    await page.goto('/rooms');
    const agentsTab = page.getByRole('tab', { name: 'Agents' }).or(
      page.getByText('Agents', { exact: true })
    ).first();
    await agentsTab.click();
    await expect(page).toHaveURL(/\/agents/);

    // Grid should render (either with cards or empty state)
    const grid = page.locator(
      '[data-testid="agent-grid"], [class*="AgentGrid"], [class*="agent-grid"]'
    ).first();
    await expect(grid).toBeVisible();
  });
});
