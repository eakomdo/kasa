import { execSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';

/** Against the real API, reset the seeded world before a test that changes it (the mock resets per browser). */
function resetRealApi() {
  if (!process.env.E2E_REAL_API) return;
  const dir = process.env.KASA_API_DIR ?? `${process.env.HOME}/Desktop/kasa-api`;
  execSync('.venv/bin/python manage.py seed_demo --reset', { cwd: dir, stdio: 'ignore' });
}

async function signInAs(page: Page, account: RegExp) {
  await page.goto('/welcome');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/welcome');
  await page.getByRole('button', { name: account }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/welcome'));
}

test('a student finishes a flashcard session', async ({ page }) => {
  await signInAs(page, /Ama, a JHS 1 student/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ama');

  await page.getByRole('link', { name: /Begin today’s review|Practise anyway/ }).click();
  await expect(page.getByRole('button', { name: 'Show answer' })).toBeVisible();
  for (let i = 0; i < 30; i++) {
    const show = page.getByRole('button', { name: 'Show answer' });
    if (!(await show.isVisible().catch(() => false))) break;
    await show.click();
    await page.getByRole('button', { name: 'Got it' }).click();
  }
  await expect(page.getByText('remembered')).toBeVisible();
  await expect(page.getByText('Ayekoo!').first()).toBeVisible();
});

test('lookup prefers teacher-verified answers', async ({ page }) => {
  await signInAs(page, /Ama, a JHS 1 student/);
  await page.goto('/lookup');
  await page.getByLabel(/Word or phrase/).fill('Thank you');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Medaase', { exact: true })).toBeVisible();
  await expect(page.getByText(/checked by teachers/).first()).toBeVisible();
});

test('the community blocks phone numbers in posts', async ({ page }) => {
  await signInAs(page, /Ama, a JHS 1 student/);
  await page.goto('/community/ask');
  await page.getByLabel(/^Title/i).fill('Can someone help me revise?');
  await page.getByLabel(/^Details/i).fill('Please call me on 024 123 4567 so we can study together.');
  await expect(page.getByText(/phone numbers/i).first()).toBeVisible();
});

test('a student asks to join a study group and an admin approves a new community', async ({ page }) => {
  resetRealApi();
  await signInAs(page, /Ama, a JHS 1 student/);
  await page.goto('/community/c/kumasi-bece');
  await expect(page.getByRole('heading', { name: 'Members only' })).toBeVisible();
  await page.getByRole('button', { name: 'Ask to join' }).first().click();
  await page.getByLabel(/Note/).fill('I am in JHS 1 at Asafo and want to revise too.');
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText('Request sent').first()).toBeVisible();

  await signInAs(page, /Efua, a community admin/);
  await page.goto('/admin/communities');
  await expect(page.getByRole('heading', { name: 'Sunyani Twi readers' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve', exact: true }).first().click();
  await expect(page.getByText(/is live/).first()).toBeVisible();
});

test('an admin sees the moderation queue', async ({ page }) => {
  await signInAs(page, /Efua, a community admin/);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await page.goto('/admin/reports');
  await expect(page.getByRole('button', { name: 'Remove post' }).first()).toBeVisible();
});
