import { test, expect, type Page, type Route } from '@playwright/test';

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

async function fingertipDistanceTo(page: Page, selector: string): Promise<number> {
  return page.evaluate((targetSelector) => {
    const target = document.querySelector<HTMLElement>(targetSelector);
    const fingertip = document.querySelector<HTMLElement>('[data-testid="worker-fingertip"]');
    if (!target || !fingertip) return Number.POSITIVE_INFINITY;
    const targetRect = target.getBoundingClientRect();
    const fingertipRect = fingertip.getBoundingClientRect();
    return Math.hypot(
      fingertipRect.left + fingertipRect.width / 2 - (targetRect.left + targetRect.width / 2),
      fingertipRect.top + fingertipRect.height / 2 - (targetRect.top + targetRect.height / 2),
    );
  }, selector);
}

test('credentials stay local while the hand fills both real login fields', async ({ page }) => {
  let brainCalls = 0;
  let loginCalls = 0;
  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    brainCalls += 1;
    await route.fulfill({ status: 500, body: 'Credential message must not reach Claude' });
  });
  await page.route('**/api/backend/api/qareen/tts', async (route: Route) => {
    const requestText = (route.request().postDataJSON() as { text?: string }).text ?? '';
    expect(requestText).not.toContain('owner@example.test');
    expect(requestText).not.toContain('local-only-password');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ segments: [{ audio_base64: silentWavBase64(), word_timings: [] }], pause_ms: 0 }),
    });
  });
  await page.route('**/api/backend/api/auth/login', async (route: Route) => {
    loginCalls += 1;
    await route.fulfill({ status: 500, body: 'Qareen must not submit login' });
  });

  await page.goto('/');
  await page.getByLabel(/Open Qareen/i).click();
  await page.goto('/login');
  await expect(page.getByPlaceholder('Type a message')).toBeVisible();

  const email = 'owner@example.test';
  const password = 'local-only-password';
  await page.getByPlaceholder('Type a message').fill(
    `Fill the login form. My email is ${email} and password is "${password}"`,
  );
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(page.locator('[data-ghost="login_email"]')).toHaveValue(email, { timeout: 10_000 });
  await expect(page.locator('[data-ghost="login_password"]')).toHaveValue(password, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
  expect(await fingertipDistanceTo(page, '[data-ghost="login_password"]')).toBeLessThanOrEqual(24);

  const transcript = await page.locator('[data-testid="qareen-presence"]').innerText();
  expect(transcript).toContain('Account credentials provided securely.');
  expect(transcript).not.toContain(email);
  expect(transcript).not.toContain(password);
  expect(brainCalls).toBe(0);
  expect(loginCalls).toBe(0);
});

test('an incomplete credential message is also withheld from Claude', async ({ page }) => {
  let brainCalls = 0;
  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    brainCalls += 1;
    await route.fulfill({ status: 500, body: 'Partial credential must not reach Claude' });
  });
  await page.route('**/api/backend/api/qareen/tts', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ segments: [{ audio_base64: silentWavBase64(), word_timings: [] }], pause_ms: 0 }),
    });
  });

  await page.goto('/');
  await page.getByLabel(/Open Qareen/i).click();
  await page.goto('/login');
  await page.getByPlaceholder('Type a message').fill('Use partial-person@example.test for my login');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(page.getByText(/Include both email and password/i)).toBeVisible();
  const transcript = await page.locator('[data-testid="qareen-presence"]').innerText();
  expect(transcript).not.toContain('partial-person@example.test');
  expect(brainCalls).toBe(0);
});
