import { test, expect, type Route } from '@playwright/test';

/**
 * Real microphone input cannot be exercised headlessly. This stub validates
 * Qareen's explicit dictation state machine: recognition updates the chat
 * composer, pauses/end events reopen listening without sending, and a manual
 * master-mic stop submits exactly once. Real-world recognition still needs a
 * manual microphone pass, especially in Safari.
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

async function summonQareen(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel(/Open Qareen/i).click();
}

async function emitSpeech(
  page: import('@playwright/test').Page,
  transcript: string,
  isFinal = false
): Promise<void> {
  await page.evaluate(
    ({ text, final }) => {
      const recognitions = (window as unknown as {
        __qareenRecognitions: { onresult?: (event: unknown) => void }[];
      }).__qareenRecognitions;
      recognitions[recognitions.length - 1]?.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: final, 0: { transcript: text } }],
      });
    },
    { text: transcript, final: isFinal }
  );
}

async function recognitionCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(
    () => ((window as unknown as { __qareenRecognitions?: unknown[] }).__qareenRecognitions ?? []).length
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(FAKE_SPEECH_RECOGNITION_SCRIPT);
  await page.route('**/api/backend/api/qareen/brain/stream', mockBrainDoneOnly);
});

test('turning dictation on starts listening and exposes the listening composer', async ({ page }) => {
  await summonQareen(page);
  await page.getByTestId('mic-toggle').click();

  await expect(page.getByTestId('mic-dot')).toHaveAttribute('data-state', 'live');
  await expect(page.getByTestId('qareen-message-input')).toHaveAttribute(
    'placeholder',
    'Listening… stop the mic to send'
  );
  expect(await recognitionCount(page)).toBeGreaterThan(0);
});

test('speech writes into the composer and a pause never auto-submits', async ({ page }) => {
  await summonQareen(page);
  await page.getByTestId('mic-toggle').click();
  await emitSpeech(page, 'how do I check my profit');

  await expect(page.getByTestId('qareen-message-input')).toHaveValue('how do I check my profit');
  await page.waitForTimeout(700);
  await expect(page.getByTestId('qareen-user-message')).toHaveCount(0);
  await expect(page.getByTestId('qareen-message-input')).toHaveValue('how do I check my profit');
});

test('a natural recognition end reopens and captures the next spoken segment', async ({ page }) => {
  await summonQareen(page);
  await page.getByTestId('mic-toggle').click();
  await emitSpeech(page, 'first part', true);

  const beforeEnd = await recognitionCount(page);
  await page.evaluate(() => {
    const recognitions = (window as unknown as { __qareenRecognitions: { onend?: () => void }[] })
      .__qareenRecognitions;
    recognitions[recognitions.length - 1]?.onend?.();
  });

  await expect.poll(() => recognitionCount(page), { timeout: 2000 }).toBeGreaterThan(beforeEnd);
  await emitSpeech(page, 'second part', true);
  await expect(page.getByTestId('qareen-message-input')).toHaveValue('first part second part');
  await expect(page.getByTestId('qareen-user-message')).toHaveCount(0);
});

test('stopping dictation sends the complete draft and creates the turn', async ({ page }) => {
  await summonQareen(page);
  await page.getByTestId('mic-toggle').click();
  await emitSpeech(page, 'show me the ownership chart', true);

  await page.getByTestId('mic-toggle').click();
  await expect(page.getByTestId('mic-dot')).toHaveAttribute('data-state', 'muted');
  await expect(page.getByTestId('qareen-user-message')).toHaveText('show me the ownership chart');
  await expect(page.getByTestId('qareen-message-input')).toHaveValue('');
});

test('pressing Send while listening stops the microphone before Qareen responds', async ({ page }) => {
  await summonQareen(page);
  await page.getByTestId('mic-toggle').click();
  await emitSpeech(page, 'explain this page', true);

  await page.getByRole('button', { name: 'Send' }).click();

  await expect(page.getByTestId('mic-toggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('mic-dot')).toHaveAttribute('data-state', 'muted');
  await expect(page.getByTestId('qareen-user-message')).toHaveText('explain this page');
});

test('push-to-talk writes a draft but releasing Space does not send it', async ({ page }) => {
  await summonQareen(page);
  await expect(page.getByTestId('mic-toggle')).toBeVisible();
  const before = await recognitionCount(page);

  await page.keyboard.down('Space');
  await expect.poll(() => recognitionCount(page)).toBeGreaterThan(before);
  await expect(page.getByTestId('mic-dot')).toHaveAttribute('data-state', 'live');
  await emitSpeech(page, 'add a stakeholder');
  await page.keyboard.up('Space');

  await expect(page.getByTestId('mic-dot')).toHaveAttribute('data-state', 'muted');
  await expect(page.getByTestId('qareen-message-input')).toHaveValue('add a stakeholder');
  await expect(page.getByTestId('qareen-user-message')).toHaveCount(0);
});

test('spacebar inside the chat input does not trigger push-to-talk', async ({ page }) => {
  await summonQareen(page);
  const before = await recognitionCount(page);

  await page.getByTestId('qareen-message-input').click();
  await page.keyboard.press('Space');

  expect(await recognitionCount(page)).toBe(before);
});

test('composer accepts multiple lines and Ctrl+Enter sends the complete message', async ({ page }) => {
  await summonQareen(page);
  const composer = page.getByTestId('qareen-message-input');

  await composer.fill('first line');
  await composer.press('Enter');
  await composer.type('second line');
  await expect(composer).toHaveValue('first line\nsecond line');
  await expect(page.getByTestId('qareen-user-message')).toHaveCount(0);

  await composer.press('Control+Enter');
  await expect(page.getByTestId('qareen-user-message')).toHaveText(/first line\s+second line/);
  await expect(composer).toHaveValue('');
});
