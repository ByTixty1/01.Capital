import { test, expect, type Route } from '@playwright/test';

function silentWavBase64(durationMs: number): string {
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

const SYNC_SSE = [
  'event: line\ndata: {"say":"Here is ownership.","beats":[{"pose":"point","tilt":null,"lean":null,"emph":true,"raise":false,"drift":null,"on_word":2}],"worker":[{"move":"press","target":"hero_headline","text":null,"on_word":2}]}\n\n',
  'event: done\ndata: {"intent":"explain","needs_approval":false,"prepared_action":null}\n\n',
].join('');

test('hand gesture waits for the spoken word selected by on_word', async ({ page }) => {
  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: SYNC_SSE });
  });
  await page.route('**/api/backend/api/qareen/tts', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        segments: [{
          audio_base64: silentWavBase64(1_500),
          word_timings: [
            { word: 'Here', ms: 0 },
            { word: 'is', ms: 300 },
            { word: 'ownership', ms: 900 },
          ],
        }],
        pause_ms: 0,
      }),
    });
  });

  await page.goto('/');
  await page.getByLabel(/Open Qareen/i).click();
  const guideToggle = page.getByTestId('guide-mode-toggle');
  if (await guideToggle.getAttribute('aria-pressed') !== 'true') await guideToggle.click();
  await page.getByPlaceholder('Type a message').fill('Explain ownership');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  const target = page.locator('[data-ghost="hero_headline"]');
  await page.waitForTimeout(600);
  await expect(target).not.toHaveCSS('outline-color', 'rgb(34, 211, 238)');

  await expect
    .poll(
      async () => target.evaluate((element) => (element as HTMLElement).style.outline),
      { timeout: 3_000, intervals: [20] },
    )
    .toContain('rgb(34, 211, 238)');
});
