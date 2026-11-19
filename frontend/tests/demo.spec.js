import { test, expect } from '@playwright/test';

test('offline demo filters fictional accounts without API calls or token changes', async ({ page }) => {
  const calls = [];
  await page.route('**/api/**', route => { calls.push(route.request().url()); return route.abort(); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Acceso de Trader' })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('mt5_auth_token', 'existing-session'));
  await page.getByRole('button', { name: 'Ver demo sin conexión' }).click();
  await expect(page.getByRole('heading', { name: 'Panel de demostración' })).toBeVisible();
  await expect(page.getByText('Datos ficticios · Sin operaciones reales')).toBeVisible();
  await expect(page.getByRole('button', { name: /Ver detalles de/ })).toHaveCount(6);
  await page.screenshot({ path: 'output/playwright/demo-desktop.png', fullPage: true });
  await page.getByLabel('Fase').selectOption('F2');
  await expect(page.getByRole('button', { name: /Ver detalles de/ })).toHaveCount(2);
  await page.getByLabel('Buscar cuenta').fill('Aurora');
  await expect(page.getByRole('button', { name: /Ver detalles de/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Ver detalles de Demo Aurora' }).click();
  await expect(page.getByText('Servidor: Demo-MT5')).toBeVisible();
  await page.getByLabel('Buscar cuenta').fill('no existe');
  await expect(page.getByText('No hay cuentas que coincidan con los filtros.')).toBeVisible();
  expect(calls).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('mt5_auth_token'))).toBe('existing-session');
  await page.getByRole('button', { name: 'Volver al acceso' }).click();
  await expect(page.getByRole('heading', { name: 'Acceso de Trader' })).toBeVisible();
});

test('demo remains accessible while an old session verification hangs', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mt5_auth_token', 'existing-session'));
  await page.route('**/api/auth/verify', () => new Promise(() => {}));
  await page.goto('/');
  await expect(page.getByText('Cargando...')).toBeVisible();
  await page.getByRole('button', { name: 'Ver demo sin conexión' }).click();
  await expect(page.getByRole('heading', { name: 'Panel de demostración' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('mt5_auth_token'))).toBe('existing-session');
  await page.getByRole('button', { name: 'Volver al acceso' }).click();
  await expect(page.getByRole('heading', { name: 'Acceso de Trader' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('mt5_auth_token'))).toBe('existing-session');
});

test('demo cannot interrupt a pending live login that may write a token', async ({ page }) => {
  await page.route('**/api/auth/login', () => new Promise(() => {}));
  await page.goto('/');
  await page.getByLabel('Clave de Seguridad / Contraseña').fill('test-password');
  await page.getByRole('button', { name: 'Conectar Terminal' }).click();
  await expect(page.getByText('Cargando...')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver demo sin conexión' })).toHaveCount(0);
});

test('successful server login still opens the live dashboard', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.fulfill({ json: { success: true, token: 'test-session' } }));
  await page.route('**/api/accounts*', route => route.fulfill({ json: { total_accounts: 0, accounts: [], last_refresh: '2026-11-18T12:00:00Z' } }));
  await page.route('**/api/versus/feature-status', route => route.fulfill({ json: { enabled: false } }));
  await page.goto('/');
  await page.getByLabel('Clave de Seguridad / Contraseña').fill('test-password');
  await page.getByRole('button', { name: 'Conectar Terminal' }).click();
  await expect(page.getByRole('heading', { name: 'Cuentas Activas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Panel de demostración' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('mt5_auth_token'))).toBe('test-session');
});

test('mobile demo fits the viewport and resets after reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ver demo sin conexión' }).click();
  await expect(page.getByRole('heading', { name: 'Panel de demostración' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'output/playwright/demo-mobile.png', fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Acceso de Trader' })).toBeVisible();
});

test('live login still needs a successful backend response', async ({ page }) => {
  await page.route('**/api/auth/login', route => route.fulfill({ status: 401, json: { success: false, message: 'Invalid password' } }));
  await page.goto('/');
  await page.getByLabel('Clave de Seguridad / Contraseña').fill('wrong-password');
  await page.getByRole('button', { name: 'Conectar Terminal' }).click();
  await expect(page.getByText('Invalid password')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Panel de demostración' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('mt5_auth_token'))).toBeNull();
});
