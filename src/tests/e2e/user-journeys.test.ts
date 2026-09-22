// End-to-End User Journey Tests
import { test, expect, type Page } from '@playwright/test';

async function addVisibleProductToCart(page: Page) {
  await page.locator('[data-testid="add-to-cart"]:visible').first().click();
}

async function openCheckoutFromCart(page: Page) {
  const proceed = page.getByTestId('proceed-to-checkout');
  if (!(await proceed.isVisible())) {
    await page.getByTestId('cart-icon').click();
  }
  await expect(proceed).toBeVisible();
  await proceed.click();
}

test.describe('Critical User Journeys', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Complete purchase flow', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/shop');
    await expect(page).toHaveURL(/\/shop/);
    await page.waitForSelector('[data-testid="product-card-link"]', { timeout: 15000 });

    await page.locator('[data-testid="product-card-link"]').first().click();
    await expect(page.locator('[data-testid="add-to-cart"]:visible').first()).toBeVisible();
    await addVisibleProductToCart(page);
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('1');

    await openCheckoutFromCart(page);
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByTestId('proceed-to-checkout')).toHaveCount(0);

    await page.fill('[name="email"]', 'test@example.com');
    await page.locator('main').getByRole('button', { name: 'Continue' }).click();

    await page.fill('[name="firstName"]', 'John');
    await page.fill('[name="lastName"]', 'Doe');
    await page.fill('[name="address"]', '123 Test St');
    await page.fill('[name="city"]', 'Test City');
    await page.fill('[name="state"]', 'NY');
    await page.fill('[name="postalCode"]', '12345');
    await page.fill('[name="phone"]', '5551234567');
    await page.locator('main').getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByTestId('complete-order')).toBeEnabled({ timeout: 10_000 });

    await page.getByTestId('complete-order').click();
    await expect(page).toHaveURL(/\/checkout\/success/, { timeout: 20000 });
    await expect(page.locator('text=Order Confirmed')).toBeVisible();
  });

  test('Newsletter signup flow', async ({ page }) => {
    await page.fill('[data-testid="newsletter-email"]', 'newsletter@example.com');
    await page.click('[data-testid="newsletter-submit"]');
    await expect(page.locator('[data-testid="newsletter-success"]')).toBeVisible();
  });

  test('Contact form submission', async ({ page }) => {
    await page.goto('/contact');

    await page.fill('[name="name"]', 'Test User');
    await page.fill('[name="email"]', 'contact@example.com');
    await page.fill('[name="subject"]', 'Test Subject');
    await page.fill('[name="message"]', 'Test message content');

    await page.click('[type="submit"]');
    await expect(page.locator('[data-testid="contact-form-success"]')).toBeVisible();
  });

  test('Portfolio browsing and filtering', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForSelector('[data-testid="portfolio-item"]');

    await page.click('[data-testid="filter-all"]');
    const portfolioItems = page.locator('[data-testid="portfolio-item"]');
    await expect(portfolioItems.first()).toBeVisible();
  });

  test('Mobile responsiveness', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.click('[data-testid="mobile-menu-toggle"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();

    await page.goto('/shop');
    await page.waitForSelector('[data-testid="product-card-link"]', { timeout: 15000 });
    await page.locator('[data-testid="product-card-link"]').first().click();
    await addVisibleProductToCart(page);
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('1');
  });

  test('Shop mobile filters open sort controls', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/shop');
    await page.waitForSelector('[data-testid="product-card-link"]', { timeout: 15000 });
    await page.getByRole('button', { name: /Filters & sort/i }).click();
    const mobileSort = page.getByRole('dialog', { name: 'Shop filters' }).locator('#shop-sort-sheet');
    await expect(mobileSort).toBeVisible();
    await mobileSort.selectOption('newest');
    await expect(page).toHaveURL(/sort=newest/);
  });

  test('Admin dashboard tab deep links', async ({ page }) => {
    await page.goto('/auth/signin?callbackUrl=%2Fadmin%3Ftab%3Dorders');
    await page.getByLabel('Email address').fill('artist@artistsite.com');
    await page.getByLabel('Password').fill('AdminPass123!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\?tab=orders/, { timeout: 15000 });
    await expect(page.getByRole('tab', { name: 'Orders', selected: true })).toBeVisible();
    await expect(page.locator('#admin-panel-orders')).toBeVisible();
    await expect(page.getByPlaceholder('Order number or customer email')).toBeVisible();

    await page.goto('/admin?tab=inbox');
    await expect(page.getByRole('tab', { name: 'Inbox', selected: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hidden comments' })).toBeVisible();
  });

  test('Performance and accessibility', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(10000);

    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
  });
});
