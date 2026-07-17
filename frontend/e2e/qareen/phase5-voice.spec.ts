import { test, expect, type Route } from '@playwright/test';

/**
 * Real microphone input cannot be exercised headlessly, so this stubs
 * window.SpeechRecognition to validate the endpointing/turn-taking STATE
 * MACHINE deterministically: 350ms-stable interim -> auto-submit, mic
 * states, and push-to-talk. It does not prove real-world recognition
 * accuracy — that needs a manual pass with a real microphone.
 */
const FAKE_SPEECH_RECOGNITION_SCRIPT = `
class FakeSpeechRecognition {
  constructor() {
    this.lang = '';
    this.continuous = false;
    this.interimResults = false;
    this.onresult = null;
    this.onend = null;
    this.onerror = null;
    window.__qareenRecognitions = window.__qareenRecognitions || [];
    window.__qareenRecognitions.push(this);
  }
  start() {}
  stop() { if (this.onend) this.onend(); }
  abort() { if (this.onend) this.onend(); }
}
window.SpeechRecognition = FakeSpeechRecognition;
`;

const DONE_ONLY_SSE = 'event: done\ndata: {"intent":"knowledge","needs_approval":false,"prepared_action":null}\n\n';

async function mockBrainDoneOnly(route: Route): Promise<void> {
  await route.fulfill({ status: 200, contentType: 'text/event-stream', body: DONE_ONLY_SSE });
}

// Qareen now mounts globally and starts dismissed (ADR-0010) — every test
// summons it from the real landing page nav icon first.
async function summonQareen(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel(/Open Qareen/i).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(FAKE_SPEECH_RECOGNITION_SCRIPT);
  await page.route('**/api/backend/api/qareen/brain/stream', mockBrainDoneOnly);
});

test('turning mic master on starts continuous listening (LIVE state)', async ({ page }) => {
  await summonQareen(page);
  await page.getByTestId('mic-toggle').click();
  await expect(page.getByTestId('mic-dot')).toHaveAttribute('data-state', 'live');

  const recognitionCount = await page.evaluate(() => (window as unknown as { __qareenRecognitions: unknown[] }).__qareenRecognitions.length);
  expect(recognitionCount).toBeGreaterThan(0);
});

test('stable interim speech for 350ms auto-submits as a user turn', async ({ page }) => {
  await summonQareen(page);
  await page.getByTestId('mic-toggle').click();
  await expect(page.getByTestId('mic-dot')).toHaveAttribute('data-state', 'live');

  await page.evaluate(() => {
    const recognitions = (window as unknown as { __qareenRecognitions: { onresult?: (e: unknown) => void }[] }).__qareenRecognitions;
    const latest = recognitions[recognitions.length - 1];
    latest?.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: 'how do I check my profit' } }],
    });
  });

  // Endpointing fires ~350ms after the interim text stops changing.
  await expect(page.getByText('how do I check my profit')).toBeVisible({ timeout: 2000 });
  // The mocked brain response has no lines, so the turn resolves almost
  // immediately — 'thinking' is only guaranteed for REOPEN_DELAY_MS
  // (300ms). Playwright's default poll intervals escalate (100/250/500ms)
  // and can step right over a window that narrow, so force tight polling.
  await expect
    .poll(async () => (await page.getByTestId('mic-dot').getAttribute('data-state')) ?? '', {
      timeout: 1000,
      intervals: [20],
    })
    .toBe('thinking');
});

test('mic reopens to LIVE after the turn completes', async ({ page }) => {
  await summonQareen(page);
  await page.getByTestId('mic-toggle').click();

  await page.evaluate(() => {
    const recognitions = (window as unknown as { __qareenRecognitions: { onresult?: (e: unknown) => void }[] }).__qareenRecognitions;
    recognitions[recognitions.length - 1]?.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: 'hello' } }],
    });
  });

  await expect(page.getByTestId('mic-dot')).toHaveAttribute('data-state', 'thinking', { timeout: 2000 });
  await expect(page.getByTestId('mic-dot')).toHaveAttribute('data-state', 'live', { timeout: 5000 });
});

test('push-to-talk: holding space opens the mic and starts a fresh recognition instance', async ({ page }) => {
  await summonQareen(page);
  await expect(page.getByTestId('mic-toggle')).toBeVisible(); // wait for FloatingControls (and its keydown listener) to mount
  const before = await page.evaluate(() => ((window as unknown as { __qareenRecognitions?: unknown[] }).__qareenRecognitions ?? []).length);

  await page.keyboard.down('Space');
  const after = await page.evaluate(() => ((window as unknown as { __qareenRecognitions?: unknown[] }).__qareenRecognitions ?? []).length);
  expect(after).toBeGreaterThan(before);
  await expect(page.getByTestId('mic-dot')).toHaveAttribute('data-state', 'live');

  await page.evaluate(() => {
    const recognitions = (window as unknown as { __qareenRecognitions: { onresult?: (e: unknown) => void }[] }).__qareenRecognitions;
    recognitions[recognitions.length - 1]?.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: 'add a stakeholder' } }],
    });
  });
  await page.keyboard.up('Space');

  await expect(page.getByText('add a stakeholder')).toBeVisible();
});

test('spacebar inside the chat input does not trigger push-to-talk', async ({ page }) => {
  await summonQareen(page);
  const before = await page.evaluate(() => ((window as unknown as { __qareenRecognitions?: unknown[] }).__qareenRecognitions ?? []).length);

  await page.getByPlaceholder('Type a message').click();
  await page.keyboard.press('Space');

  const after = await page.evaluate(() => ((window as unknown as { __qareenRecognitions?: unknown[] }).__qareenRecognitions ?? []).length);
  expect(after).toBe(before);
});
