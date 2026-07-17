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

/**
 * Proves the core ADR-0010 mechanism against REAL tagged elements: a
 * same-page (anchor-scrolled) press with scroll-into-view, and a real
 * cross-route navigation + press, driven by a mocked brain response.
 */
const GUIDE_SSE = [
  // captable_kpis lives on `/` but is below the fold — proves scroll-into-view.
  'event: line\ndata: {"say":"Here are the headline numbers.","beats":[],"worker":[{"move":"press","target":"captable_kpis","text":null,"on_word":null}]}\n\n',
  // esop_page_headline lives on the separate /esop route — proves real cross-page nav.
  'event: line\ndata: {"say":"And here is the ESOP page.","beats":[],"worker":[{"move":"press","target":"esop_page_headline","text":null,"on_word":null}]}\n\n',
  'event: done\ndata: {"intent":"howto","needs_approval":false,"prepared_action":null}\n\n',
].join('');

async function mockBrainStream(route: Route): Promise<void> {
  await route.fulfill({ status: 200, contentType: 'text/event-stream', body: GUIDE_SSE });
}

async function mockTtsFast(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ segments: [{ audio_base64: silentWavBase64(), word_timings: [] }], pause_ms: 0 }),
  });
}

test('guides across a same-page section (with scroll) and a real cross-page route', async ({ page }) => {
  await page.route('**/api/backend/api/qareen/brain/stream', mockBrainStream);
  await page.route('**/api/backend/api/qareen/tts', mockTtsFast);

  await page.goto('/');
  await page.getByLabel(/Open Qareen/i).click();
  const guideToggle = page.getByTestId('guide-mode-toggle');
  if (await guideToggle.getAttribute('aria-pressed') !== 'true') await guideToggle.click();

  const scrollBefore = await page.evaluate(() => window.scrollY);
  expect(scrollBefore).toBe(0);

  await page.getByPlaceholder('Type a message').fill('show me the numbers');
  await page.getByRole('button', { name: 'Send' }).click();

  // Same-page target: scrolled into view and pressed, no navigation.
  // The impact pulse's outline holds for only ~120ms — Playwright's default
  // poll intervals escalate (100/250/500ms) and can step right over a
  // window that narrow, so force tight fixed polling (see phase2-motion).
  await expect
    .poll(async () => page.evaluate(() => window.scrollY), { timeout: 5000 })
    .toBeGreaterThan(0);
  await expect(page).toHaveURL(/\/$/);

  await expect
    .poll(
      async () => page.locator('[data-ghost="captable_kpis"]').evaluate((el) => (el as HTMLElement).style.outline),
      { timeout: 3000, intervals: [20] }
    )
    .toContain('rgb(34, 211, 238)');

  // Cross-page target: real navigation to /esop, then pressed there.
  await expect(page).toHaveURL(/\/esop$/, { timeout: 10000 });
  await expect(page.getByText('And here is the ESOP page.')).toBeVisible();

  await expect
    .poll(
      async () =>
        page.locator('[data-ghost="esop_page_headline"]').evaluate((el) => (el as HTMLElement).style.outline),
      { timeout: 3000, intervals: [20] }
    )
    .toContain('rgb(34, 211, 238)');

  // Qareen survived the real navigation — still summoned, still guided.
  // (qareen-presence itself is a zero-size wrapper around fixed-position
  // children, so check a real visible child instead of the wrapper.)
  await expect(page.getByTestId('worker-hand-anchor')).toBeAttached();
  await expect(page.getByTestId('guide-mode-toggle')).toHaveText('Guided');
});
