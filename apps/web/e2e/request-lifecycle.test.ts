/**
 * P8.2 – Browser E2E tests for the request-to-handoff lifecycle.
 *
 * Tests the critical user journey through the Patchwork web shell:
 *   discovery shell renders → search input is interactive →
 *   "Create post" action is accessible → "Find nearby" action is accessible
 *
 * These tests validate the observable browser-level behavior for the
 * request lifecycle surfaces (map/feed/chat) as the web shell exposes them.
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shell render and accessibility
// ---------------------------------------------------------------------------

test.describe('P8.2 app shell', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('renders the Patchwork heading', async ({ page }) => {
        await expect(
            page.getByRole('heading', { name: /patchwork/i }),
        ).toBeVisible();
    });

    test('discovery shell panel is visible', async ({ page }) => {
        await expect(page.getByText(/discovery shell/i)).toBeVisible();
    });

    test('search input is present and focusable', async ({ page }) => {
        const input = page.getByPlaceholder(/e\.g\. food, shelter, transport/i);
        await expect(input).toBeVisible();
        await input.focus();
        await expect(input).toBeFocused();
    });

    test('"Find nearby" button is accessible', async ({ page }) => {
        const button = page.getByRole('button', { name: /find nearby/i });
        await expect(button).toBeVisible();
        await expect(button).toBeEnabled();
    });

    test('"Create post" button is accessible', async ({ page }) => {
        const button = page.getByRole('button', { name: /create post/i });
        await expect(button).toBeVisible();
        await expect(button).toBeEnabled();
    });
});

// ---------------------------------------------------------------------------
// Discovery shell: search input interaction
// ---------------------------------------------------------------------------

test.describe('P8.2 discovery shell interactions', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('search input accepts text entry for a pilot food scenario', async ({ page }) => {
        const input = page.getByPlaceholder(/e\.g\. food, shelter, transport/i);
        await input.fill('food');
        await expect(input).toHaveValue('food');
    });

    test('search input accepts text entry for a pilot medical scenario', async ({ page }) => {
        const input = page.getByPlaceholder(/e\.g\. food, shelter, transport/i);
        await input.fill('medical transport');
        await expect(input).toHaveValue('medical transport');
    });

    test('search input can be cleared and re-entered', async ({ page }) => {
        const input = page.getByPlaceholder(/e\.g\. food, shelter, transport/i);
        await input.fill('shelter');
        await input.clear();
        await input.fill('food');
        await expect(input).toHaveValue('food');
    });

    test('"Find nearby" button is keyboard-navigable via Tab', async ({ page }) => {
        const input = page.getByPlaceholder(/e\.g\. food, shelter, transport/i);
        await input.fill('food');
        await page.keyboard.press('Tab');
        const findNearby = page.getByRole('button', { name: /find nearby/i });
        await expect(findNearby).toBeFocused();
    });
});

// ---------------------------------------------------------------------------
// Service boundary information
// ---------------------------------------------------------------------------

test.describe('P8.2 service boundaries', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('service boundaries card is present', async ({ page }) => {
        await expect(page.getByText(/service boundaries online/i)).toBeVisible();
    });

    test('API service address is listed', async ({ page }) => {
        await expect(page.getByText(/localhost:4000/i)).toBeVisible();
    });
});

// ---------------------------------------------------------------------------
// Accessibility baseline
// ---------------------------------------------------------------------------

test.describe('P8.2 accessibility baseline', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('page has a visible main landmark', async ({ page }) => {
        await expect(page.getByRole('main')).toBeVisible();
    });

    test('all interactive buttons have accessible names', async ({ page }) => {
        const buttons = page.getByRole('button');
        const count = await buttons.count();
        expect(count).toBeGreaterThan(0);
        for (let index = 0; index < count; index++) {
            const btn = buttons.nth(index);
            const name = await btn.getAttribute('aria-label') ?? await btn.innerText();
            expect(name.trim().length).toBeGreaterThan(0);
        }
    });
});
