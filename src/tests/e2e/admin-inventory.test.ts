import { test, expect } from '@playwright/test'

test.describe('/admin/inventory dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript({
      content: 'window.__E2E_AUTH_BYPASS__=true;try{localStorage.setItem("AUTH_BYPASS","true")}catch{}'
    })
  })

  test('happy path: loads dashboard and navigates tabs', async ({ page }) => {
    await page.goto('/admin/inventory')
    await expect(page.locator('h1', { hasText: 'Inventory Management' })).toBeVisible()
    await page.getByRole('button', { name: /Alerts/ }).click()
    await expect(page.getByText('All clear! No recent alerts.')).toBeVisible()
    await page.getByRole('button', { name: 'Products' }).click()
    await expect(page.getByText('Product Inventory')).toBeVisible()
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
    await expect(rows.first()).toContainText(/\$|Stock|In Stock|Low Stock|Out of Stock/)
  })
})
