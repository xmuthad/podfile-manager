import { test, expect } from '@playwright/test';

test.describe('PodFile Manager - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Application Loading', () => {
    test('should load the application successfully', async ({ page }) => {
      await expect(page).toHaveTitle(/Pod/);
    });

    test('should display the header with title', async ({ page }) => {
      const header = page.locator('h1');
      await expect(header).toBeVisible({ timeout: 10000 });
    });

    test('should display the subtitle', async ({ page }) => {
      const subtitle = page.locator('h1 + p');
      await expect(subtitle).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Kubernetes Tab', () => {
    test('should have Kubernetes tab active by default', async ({ page }) => {
      const k8sTab = page.locator('button:has-text("Kubernetes")');
      await expect(k8sTab).toHaveClass(/active/, { timeout: 10000 });
    });

    test('should display the sidebar header', async ({ page }) => {
      await expect(page.locator('h3:has-text("集群导航")')).toBeVisible({ timeout: 10000 });
    });

    test('should switch tabs correctly', async ({ page }) => {
      const dockerTab = page.locator('button:has-text("Docker")');

      await dockerTab.click();
      await expect(dockerTab).toHaveClass(/active/, { timeout: 10000 });
      await expect(page.locator('h3:has-text("Docker 镜像")')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Docker Tab', () => {
    test('should switch to Docker tab', async ({ page }) => {
      await page.locator('button:has-text("Docker")').click();
      await expect(page.locator('h3:has-text("Docker 镜像")')).toBeVisible({ timeout: 10000 });
    });

    test('should display Docker search input', async ({ page }) => {
      await page.locator('button:has-text("Docker")').click();
      await expect(page.locator('input[placeholder*="搜索"]')).toBeVisible({ timeout: 10000 });
    });

    test('should filter Docker images by search term', async ({ page }) => {
      await page.locator('button:has-text("Docker")').click();
      const searchInput = page.locator('input[placeholder*="搜索"]');
      await expect(searchInput).toBeVisible({ timeout: 10000 });
      await searchInput.fill('nginx');
      await expect(searchInput).toHaveValue('nginx');
    });
  });

  test.describe('File Browser', () => {
    test('should show empty state when no container is selected', async ({ page }) => {
      await expect(page.locator('.empty-state h2')).toContainText('开始管理', { timeout: 10000 });
    });
  });

  test.describe('Layout Structure', () => {
    test('should have proper layout structure', async ({ page }) => {
      await expect(page.locator('.app')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.header')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.main-content')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.file-browser')).toBeVisible({ timeout: 10000 });
    });

    test('should display sidebar tabs', async ({ page }) => {
      await expect(page.locator('.sidebar-tabs')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.sidebar-tab')).toHaveCount(2, { timeout: 10000 });
    });
  });

  test.describe('Visual Elements', () => {
    test('should display tree view', async ({ page }) => {
      await expect(page.locator('.tree-view')).toBeVisible({ timeout: 10000 });
    });
  });
});
