import { test, expect, type Route } from '@playwright/test';

function silentWavBase64(durationMs = 40): string {
  const sampleRate = 8_000;
  const samples = Math.ceil(sampleRate * durationMs / 1_000);
  const dataBytes = samples * 2;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataBytes, 40);
  return wav.toString('base64');
}
import { generateUniqueEmail, registerUser, setSessionCookie, verifyEmailViaDevAPI } from '../helpers/auth';
import { uniqueCrNumber } from '../helpers/company';

test.setTimeout(60_000);

const GUIDE_SSE = [
  'event: line\ndata: {"say":"Here is your capital summary.","beats":[],"worker":[{"move":"press","target":"app_captable_summary","text":null,"on_word":null}]}\n\n',
  'event: line\ndata: {"say":"These are the stakeholders.","beats":[],"worker":[{"move":"press","target":"app_stakeholders_headline","text":null,"on_word":null}]}\n\n',
  'event: line\ndata: {"say":"Here is the filings tracker.","beats":[],"worker":[{"move":"press","target":"app_filings_headline","text":null,"on_word":null}]}\n\n',
  'event: line\ndata: {"say":"Press Add to open the pro-rata form.","beats":[],"worker":[{"move":"press","target":"app_prorata_add","text":null,"on_word":null}]}\n\n',
  'event: done\ndata: {"intent":"howto","needs_approval":false,"prepared_action":null}\n\n',
].join('');

async function createTestCompany(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/companies/new');
  await page.locator('button:has-text("LLC")').click();
  await page.getByPlaceholder('Acme Saudi LLC').fill('Qareen Browser Test LLC');
  await page.locator('input[dir="rtl"]').fill('شركة اختبار قرين');
  await page.getByPlaceholder('10-digit number').fill(uniqueCrNumber());
  await page.locator('input[type="date"]').fill('2026-01-15');
  await page.locator('button:has-text("Continue to Capital")').click();

  const numbers = page.locator('input[type="number"]');
  await numbers.nth(0).fill('1000000');
  await numbers.nth(1).fill('500000');
  await numbers.nth(2).fill('10');
  await page.locator('select').selectOption('1');
  await page.locator('button:has-text("Continue to Governance")').click();
  await page.locator('button:has-text("Create company")').click();
  await page.waitForURL(/\/companies\/[0-9a-f-]+$/);
  return new URL(page.url()).pathname.split('/').at(-1)!;
}

test('signed-in user is guided across real company pages without losing tenant context', async ({ page }) => {
  const email = await generateUniqueEmail();
  await registerUser(page, email, 'ValidPass123', 'Qareen Browser Tester');
  await verifyEmailViaDevAPI(page, email);
  const mfaResponse = await page.request.post('/api/backend/api/auth/dev/enable-mfa');
  expect(mfaResponse.ok()).toBeTruthy();
  const { access_token: mfaToken } = await mfaResponse.json() as { access_token: string };
  await setSessionCookie(page, mfaToken);
  const companyId = await createTestCompany(page);

  let sentPathname: string | undefined;
  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    sentPathname = (route.request().postDataJSON() as { current_pathname?: string }).current_pathname;
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: GUIDE_SSE });
  });
  await page.route('**/api/backend/api/qareen/tts', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ segments: [{ audio_base64: silentWavBase64(), word_timings: [] }], pause_ms: 0 }),
    });
  });

  await expect(page.locator('[data-ghost="app_captable_summary"]')).toBeVisible();
  await page.getByLabel(/Open Qareen/i).click();
  const guideToggle = page.getByTestId('guide-mode-toggle');
  if (await guideToggle.getAttribute('aria-pressed') !== 'true') await guideToggle.click();
  await page.screenshot({ path: '../output/playwright/qareen-authenticated-start.png', fullPage: false });

  await page.getByPlaceholder('Type a message').fill('Walk me through this company workspace');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(page).toHaveURL(`/companies/${companyId}/pro-rata`, { timeout: 20_000 });
  await expect(page.locator('[data-ghost="app_prorata_headline"]')).toBeVisible();
  await expect(page.getByText('Press Add to open the pro-rata form.', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Series A')).toBeVisible();
  expect(sentPathname).toBe(`/companies/${companyId}`);
  await expect(page.locator('[data-ghost="app_prorata_add"]')).toHaveText('Cancel');

  await page.screenshot({ path: '../output/playwright/qareen-authenticated-finish.png', fullPage: false });
  await expect(page.getByTestId('worker-hand-anchor')).toBeAttached();
  await expect(page.getByTestId('guide-mode-toggle')).toHaveText('Guided');
});
