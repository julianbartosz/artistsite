// End-to-End User Journey Tests
import { test, expect } from '@playwright/test';

test.describe('Critical User Journeys', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test environment
    await page.goto('/');
  });

  test('Complete purchase flow', async ({ page }) => {
    // Navigate to shop
    await page.click('text=Shop');
    await expect(page).toHaveURL(/\/shop/);

    // Add item to cart
    await page.click('[data-testid="add-to-cart"]:first-child');
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('1');

    // Go to checkout
    await page.click('[data-testid="cart-icon"]');
    await page.click('text=Checkout');

    // Fill checkout form
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="firstName"]', 'John');
    await page.fill('[name="lastName"]', 'Doe');
    await page.fill('[name="address"]', '123 Test St');
    await page.fill('[name="city"]', 'Test City');
    await page.fill('[name="zipCode"]', '12345');

    // Complete purchase (mock payment)
    await page.click('[data-testid="complete-order"]');
    
    // Verify success
    await expect(page).toHaveURL(/\/order-confirmation/);
    await expect(page.locator('text=Order confirmed')).toBeVisible();
  });

  test('Newsletter signup flow', async ({ page }) => {
    // Find newsletter signup
    await page.fill('[data-testid="newsletter-email"]', 'newsletter@example.com');
    await page.click('[data-testid="newsletter-submit"]');

    // Verify success message
    await expect(page.locator('[data-testid="newsletter-success"]')).toBeVisible();
  });

  test('Contact form submission', async ({ page }) => {
    await page.goto('/contact');

    // Fill contact form
    await page.fill('[name="name"]', 'Test User');
    await page.fill('[name="email"]', 'contact@example.com');
    await page.fill('[name="subject"]', 'Test Subject');
    await page.fill('[name="message"]', 'Test message content');

    // Submit form
    await page.click('[type="submit"]');

    // Verify success
    await expect(page.locator('text=Message sent successfully')).toBeVisible();
  });

  test('Portfolio browsing and filtering', async ({ page }) => {
    await page.goto('/portfolio');

    // Test category filtering
    await page.click('[data-testid="filter-paintings"]');
    await expect(page.locator('[data-testid="portfolio-item"]')).toHaveCount({ min: 1 });

    // Test search
    await page.fill('[data-testid="portfolio-search"]', 'landscape');
    await page.press('[data-testid="portfolio-search"]', 'Enter');
    
    // Verify filtered results
    await expect(page.locator('[data-testid="portfolio-item"]')).toHaveCount({ min: 0 });
  });

  test('Mobile responsiveness', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Test mobile navigation
    await page.click('[data-testid="mobile-menu-toggle"]');
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();

    // Test mobile shop functionality
    await page.goto('/shop');
    await page.click('[data-testid="add-to-cart"]:first-child');
    await expect(page.locator('[data-testid="cart-count"]')).toContainText('1');
  });

  test('Performance and accessibility', async ({ page }) => {
    // Test page load performance
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // 3 second max load time

    // Test accessibility
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[alt]')).toHaveCount({ min: 1 }); // Images have alt text
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
  });

  test('Error handling', async ({ page }) => {
    // Test 404 page
    await page.goto('/non-existent-page');
    await expect(page.locator('text=404')).toBeVisible();

    // Test form validation
    await page.goto('/contact');
    await page.click('[type="submit"]');
    await expect(page.locator('[data-testid="form-errors"]')).toBeVisible();

    // Test network error handling
    await page.route('**/api/**', route => route.abort());
    await page.goto('/shop');
    await expect(page.locator('text=Unable to load')).toBeVisible();
  });
});

test.describe('Analytics and Tracking', () => {
  test('Google Analytics tracking', async ({ page }) => {
    // Mock GA tracking
    await page.addInitScript(() => {
      window.gtag = jest.fn();
    });

    await page.goto('/');
    
    // Verify page view tracking
    await page.evaluate(() => {
      expect(window.gtag).toHaveBeenCalledWith('config', expect.any(String));
    });
  });

  test('Conversion tracking', async ({ page }) => {
    // Test purchase conversion
    await page.goto('/shop');
    await page.click('[data-testid="add-to-cart"]:first-child');
    
    // Complete mock purchase
    await page.goto('/checkout');
    await page.fill('[name="email"]', 'test@example.com');
    await page.click('[data-testid="complete-order"]');

    // Verify conversion event
    await page.waitForFunction(() => 
      window.gtag && window.gtag.calls?.some(call => 
        call.args?.[0] === 'event' && call.args?.[1] === 'purchase'
      )
    );
  });
});