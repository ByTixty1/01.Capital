import { test, expect, type Page, type Route } from '@playwright/test';

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

const AUDIO_TRACKING_SCRIPT = `
window.__qareenAudioStarts = [];
window.__qareenMediaPlays = [];
const nativeCreateBufferSource = AudioContext.prototype.createBufferSource;
AudioContext.prototype.createBufferSource = function () {
  const context = this;
  const source = nativeCreateBufferSource.call(context);
  const nativeStart = source.start.bind(source);
  source.start = function (...args) {
    window.__qareenAudioStarts.push({
      duration: source.buffer ? source.buffer.duration : 0,
      state: context.state,
    });
    return nativeStart(...args);
  };
  return source;
};
const nativeMediaPlay = HTMLMediaElement.prototype.play;
HTMLMediaElement.prototype.play = function () {
  window.__qareenMediaPlays.push({ srcLength: this.src.length, muted: this.muted, volume: this.volume, loop: this.loop });
  return nativeMediaPlay.call(this);
};
`;

async function openGuidedQareen(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel(/Open Qareen/i).click();
  const guideToggle = page.getByTestId('guide-mode-toggle');
  if (await guideToggle.getAttribute('aria-pressed') !== 'true') await guideToggle.click();
}

async function fingertipDistanceTo(page: Page, ghostId: string): Promise<number> {
  return page.evaluate((targetId) => {
    const targetElement = document.querySelector<HTMLElement>(`[data-ghost="${targetId}"]`);
    const fingertipElement = document.querySelector<HTMLElement>('[data-testid="worker-fingertip"]');
    if (!targetElement || !fingertipElement) return Number.POSITIVE_INFINITY;

    const targetRect = targetElement.getBoundingClientRect();
    const fingertipRect = fingertipElement.getBoundingClientRect();
    return Math.hypot(
      fingertipRect.left + fingertipRect.width / 2 - (targetRect.left + targetRect.width / 2),
      fingertipRect.top + fingertipRect.height / 2 - (targetRect.top + targetRect.height / 2),
    );
  }, ghostId);
}

test('real pointing fingertip lands on the target center within 24px', async ({ page }) => {
  const sse = [
    'event: line\ndata: {"say":"Ten million authorized shares.","beats":[],"worker":[{"move":"press","target":"captable_authorized","text":null,"on_word":null}]}\n\n',
    'event: done\ndata: {"intent":"howto","needs_approval":false,"prepared_action":null}\n\n',
  ].join('');

  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
  });
  await page.route('**/api/backend/api/qareen/tts', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        segments: [{ audio_base64: silentWavBase64(1_000), word_timings: [] }],
        pause_ms: 0,
      }),
    });
  });

  await openGuidedQareen(page);
  await page.getByPlaceholder('Type a message').fill('show me');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  const target = page.locator('[data-ghost="captable_authorized"]');
  await expect
    .poll(
      async () => target.evaluate((element) => (element as HTMLElement).style.outline),
      { timeout: 4_000, intervals: [20] },
    )
    .toContain('rgb(34, 211, 238)');

  // Measure only after the press/rebound has completed and the hand is pinned.
  // Sampling during the 90ms impact pose reads a changing 3D transform.
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();

  const distance = await fingertipDistanceTo(page, 'captable_authorized');

  // One quarter of the 96px glyph. The observed parallel-suite maximum is
  // ~21px while the rebound is in flight; the pre-fix wrapper-corner landing
  // missed by more than 60px.
  expect(distance).toBeLessThanOrEqual(24);

  const workerAnchor = page.getByTestId('worker-hand-anchor');
  const readAnchorPosition = async () => workerAnchor.evaluate((element) => {
    const transform = (element as HTMLElement).style.transform;
    const match = transform.match(/translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/);
    return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
  });

  const pinnedBefore = await readAnchorPosition();
  await page.waitForTimeout(400);
  const pinnedAfter = await readAnchorPosition();
  expect(pinnedBefore).not.toBeNull();
  expect(pinnedAfter).not.toBeNull();
  expect(Math.hypot(
    pinnedAfter!.x - pinnedBefore!.x,
    pinnedAfter!.y - pinnedBefore!.y,
  )).toBeLessThanOrEqual(0.05);
});

test('spoken fact deterministically overrides a vague model target', async ({ page }) => {
  const sse = [
    'event: line\ndata: {"say":"Ten million authorized shares.","beats":[],"worker":[{"move":"press","target":"captable_ownership","text":null,"on_word":null}]}\n\n',
    'event: done\ndata: {"intent":"knowledge","needs_approval":false,"prepared_action":null}\n\n',
  ].join('');
  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
  });
  await page.route('**/api/backend/api/qareen/tts', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        segments: [{ audio_base64: silentWavBase64(700), word_timings: [] }],
        pause_ms: 0,
      }),
    });
  });

  await openGuidedQareen(page);
  await page.getByPlaceholder('Type a message').fill('show authorized shares');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  const exactCard = page.locator('[data-ghost="captable_authorized"]');
  await expect.poll(
    async () => exactCard.evaluate((element) => (element as HTMLElement).style.outline),
    { timeout: 8_000, intervals: [20] },
  ).toContain('rgb(34, 211, 238)');
  await expect(page.locator('[data-ghost="captable_ownership"]')).not.toHaveCSS('outline-color', 'rgb(34, 211, 238)');
});

test('two spoken facts visit both exact rows and finish on the second', async ({ page }) => {
  const sse = [
    'event: line\ndata: {"say":"Founders hold forty-six percent. Series A investors hold twenty-two percent.","beats":[],"worker":[]}\n\n',
    'event: done\ndata: {"intent":"knowledge","needs_approval":false,"prepared_action":null}\n\n',
  ].join('');
  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
  });
  await page.route('**/api/backend/api/qareen/tts', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        segments: [{
          audio_base64: silentWavBase64(2_500),
          word_timings: [
            { word: 'Founders', ms: 0 },
            { word: 'hold', ms: 200 },
            { word: 'forty-six', ms: 400 },
            { word: 'percent', ms: 600 },
            { word: 'Series', ms: 900 },
            { word: 'A', ms: 1_050 },
          ],
        }],
        pause_ms: 0,
      }),
    });
  });

  await openGuidedQareen(page);
  await page.getByPlaceholder('Type a message').fill('explain ownership');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled({ timeout: 6_000 });

  expect(await fingertipDistanceTo(page, 'ownership_series_a')).toBeLessThanOrEqual(24);
});

test('typed TTS repairs a stale silent loop then plays audible media', async ({ page }) => {
  await page.addInitScript(AUDIO_TRACKING_SCRIPT);
  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'event: line\ndata: {"say":"Voice is working.","beats":[],"worker":[]}\n\nevent: done\ndata: {"intent":"knowledge","needs_approval":false,"prepared_action":null}\n\n',
    });
  });
  await page.route('**/api/backend/api/qareen/tts', async (route: Route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        segments: [{ audio_base64: silentWavBase64(600), word_timings: [] }],
        pause_ms: 0,
      }),
    });
  });

  await page.goto('/');
  await page.evaluate(() => {
    const staleAudio = new Audio();
    staleAudio.dataset.qareenAudio = 'true';
    staleAudio.dataset.qareenPrimeHold = 'true';
    staleAudio.loop = true;
    document.body.appendChild(staleAudio);
  });
  await page.getByLabel(/Open Qareen/i).click();
  await page.getByPlaceholder('Type a message').fill('talk to me');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(page.getByText('Voice is working.')).toBeVisible();
  await expect
    .poll(async () => page.evaluate(() => {
      const plays = (window as unknown as {
        __qareenMediaPlays: { srcLength: number; muted: boolean; volume: number; loop: boolean }[];
      }).__qareenMediaPlays;
      const prime = plays.find((play) => play.srcLength < 1_000);
      const speech = plays.find((play) => play.srcLength > 1_000);
      return Boolean(
        prime && !prime.loop
        && speech && !speech.loop && !speech.muted && speech.volume === 1
      );
    }), { timeout: 4_000 })
    .toBe(true);
  await expect(page.locator('audio[data-qareen-audio="true"]')).toHaveCount(1);
  await expect(page.getByTestId('voice-output-state')).toHaveAttribute('data-state', 'idle');
});

test('a transient TTS failure retries once and still speaks', async ({ page }) => {
  let ttsRequests = 0;
  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'event: line\ndata: {"say":"Voice recovered.","beats":[],"worker":[]}\n\nevent: done\ndata: {"intent":"knowledge","needs_approval":false,"prepared_action":null}\n\n',
    });
  });
  await page.route('**/api/backend/api/qareen/tts', async (route: Route) => {
    ttsRequests += 1;
    if (ttsRequests === 1) {
      await route.fulfill({ status: 503, body: 'temporarily unavailable' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        segments: [{ audio_base64: silentWavBase64(400), word_timings: [] }],
        pause_ms: 0,
      }),
    });
  });

  await page.goto('/');
  await page.getByLabel(/Open Qareen/i).click();
  await page.getByPlaceholder('Type a message').fill('try the voice');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(page.getByText('Voice recovered.')).toBeVisible();
  await expect.poll(() => ttsRequests).toBe(2);
  await expect(page.getByTestId('voice-output-state')).toHaveAttribute('data-state', 'idle');
});

test('Web Audio speaks when Safari-style media playback rejects', async ({ page }) => {
  await page.addInitScript(`
    window.__qareenFallbackStarts = [];
    const nativeCreateBufferSource = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = nativeCreateBufferSource.call(this);
      const nativeStart = source.start.bind(source);
      source.start = function (...args) {
        window.__qareenFallbackStarts.push(source.buffer ? source.buffer.duration : 0);
        return nativeStart(...args);
      };
      return source;
    };
    const nativeMediaPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.src.length > 1000) {
        return Promise.reject(new DOMException('simulated Safari rejection', 'NotAllowedError'));
      }
      return nativeMediaPlay.call(this);
    };
  `);
  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'event: line\ndata: {"say":"Fallback voice works.","beats":[],"worker":[]}\n\nevent: done\ndata: {"intent":"knowledge","needs_approval":false,"prepared_action":null}\n\n',
    });
  });
  await page.route('**/api/backend/api/qareen/tts', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        segments: [{ audio_base64: silentWavBase64(400), word_timings: [] }],
        pause_ms: 0,
      }),
    });
  });

  await page.goto('/');
  await page.getByLabel(/Open Qareen/i).click();
  await page.getByPlaceholder('Type a message').fill('test fallback');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(page.getByText('Fallback voice works.')).toBeVisible();
  await expect.poll(async () => page.evaluate(() => (
    (window as unknown as { __qareenFallbackStarts: number[] }).__qareenFallbackStarts
      .some((duration) => duration > 0.2)
  ))).toBe(true);
  await expect(page.getByTestId('voice-output-state')).toHaveAttribute('data-state', 'idle');
});

test('TTS failure is visible while the text answer and guidance continue', async ({ page }) => {
  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'event: line\ndata: {"say":"The visual guide still works.","beats":[],"worker":[]}\n\nevent: done\ndata: {"intent":"knowledge","needs_approval":false,"prepared_action":null}\n\n',
    });
  });
  await page.route('**/api/backend/api/qareen/tts', async (route: Route) => {
    await route.fulfill({ status: 503, body: 'unavailable' });
  });

  await page.goto('/');
  await page.getByLabel(/Open Qareen/i).click();
  await page.getByPlaceholder('Type a message').fill('show me anyway');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(page.getByText('The visual guide still works.')).toBeVisible();
  await expect(page.getByTestId('voice-output-state')).toHaveAttribute('data-state', 'unavailable');
  await expect(page.getByText('Voice unavailable')).toBeVisible();
});
