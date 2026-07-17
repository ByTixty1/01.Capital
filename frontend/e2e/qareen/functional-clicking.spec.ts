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

const CLICK_SSE = [
  'event: line\ndata: {"say":"Open registration from the ESOP page.","beats":[],"worker":[{"move":"press","target":"esop_page_cta","text":null,"on_word":null}]}\n\n',
  'event: done\ndata: {"intent":"howto","needs_approval":false,"prepared_action":null}\n\n',
].join('');

test('worker press activates the real CTA link at impact and navigates', async ({ page }) => {
  // Playwright's own trusted clicks do not call HTMLElement.click(). Recording
  // this method therefore proves the navigation came from Qareen's impact
  // activation, rather than the test or the route resolver.
  await page.addInitScript(() => {
    const nativeClick = HTMLElement.prototype.click;
    HTMLElement.prototype.click = function qareenRecordedClick() {
      const clicks = JSON.parse(sessionStorage.getItem('qareen-programmatic-clicks') ?? '[]') as string[];
      clicks.push(this instanceof HTMLAnchorElement ? this.getAttribute('href') ?? '' : this.tagName);
      sessionStorage.setItem('qareen-programmatic-clicks', JSON.stringify(clicks));
      nativeClick.call(this);
    };
  });

  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: CLICK_SSE });
  });
  await page.route('**/api/backend/api/qareen/tts', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ segments: [{ audio_base64: silentWavBase64(), word_timings: [] }], pause_ms: 0 }),
    });
  });

  await page.goto('/cap-table');
  await page.getByLabel(/Open Qareen/i).click();
  await page.getByPlaceholder('Type a message').fill('Take me to registration');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  // The destination target lives on /esop. Only its real child CTA points to
  // /register, so reaching /register proves the hand activated the control.
  await expect(page).toHaveURL(/\/register$/, { timeout: 10_000 });
  const clicks = await page.evaluate(() => JSON.parse(
    sessionStorage.getItem('qareen-programmatic-clicks') ?? '[]',
  ) as string[]);
  expect(clicks).toContain('/esop');
  expect(clicks).toContain('/register');
});

test('worker press activates the English and Arabic language switch', async ({ page }) => {
  const sse = [
    'event: line\ndata: {"say":"Switch the page to Arabic.","beats":[],"worker":[{"move":"press","target":"nav_language_toggle","text":null,"on_word":4}]}\n\n',
    'event: done\ndata: {"intent":"delegate","needs_approval":false,"prepared_action":null}\n\n',
  ].join('');
  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
  });
  await page.route('**/api/backend/api/qareen/tts', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ segments: [{ audio_base64: silentWavBase64(), word_timings: [] }], pause_ms: 0 }),
    });
  });

  await page.goto('/');
  const languageToggle = page.locator('[data-ghost="nav_language_toggle"]');
  await expect(languageToggle).toHaveAttribute('aria-pressed', 'false');
  await expect(languageToggle.locator('#lp-lang-active-label')).toHaveText('EN');

  await page.getByLabel(/Open Qareen/i).click();
  await page.getByPlaceholder('Type a message').fill('Switch the website to Arabic');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(languageToggle).toHaveAttribute('aria-pressed', 'true', { timeout: 8_000 });
  await expect(languageToggle.locator('#lp-lang-active-label')).toHaveText('AR');
  await expect(page.locator('body')).toHaveClass(/lp-ar-mode/);

  await page.getByPlaceholder('Type a message').fill('Switch the website back to English');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(languageToggle).toHaveAttribute('aria-pressed', 'false', { timeout: 8_000 });
  await expect(languageToggle.locator('#lp-lang-active-label')).toHaveText('EN');
  await expect(page.locator('body')).not.toHaveClass(/lp-ar-mode/);
});

test('pressing an explanatory target remains visual-only', async ({ page }) => {
  const sse = [
    'event: line\ndata: {"say":"This is the ESOP headline.","beats":[],"worker":[{"move":"press","target":"esop_page_headline","text":null,"on_word":null}]}\n\n',
    'event: done\ndata: {"intent":"explain","needs_approval":false,"prepared_action":null}\n\n',
  ].join('');
  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
  });
  await page.route('**/api/backend/api/qareen/tts', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ segments: [{ audio_base64: silentWavBase64(), word_timings: [] }], pause_ms: 0 }),
    });
  });

  await page.goto('/esop');
  await page.getByLabel(/Open Qareen/i).click();
  await page.getByPlaceholder('Type a message').fill('Show the headline');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect
    .poll(
      async () => page.locator('[data-ghost="esop_page_headline"]').evaluate((el) => (el as HTMLElement).style.outline),
      { timeout: 3_000, intervals: [20] },
    )
    .toContain('rgb(34, 211, 238)');
  await expect(page).toHaveURL(/\/esop$/);
});
