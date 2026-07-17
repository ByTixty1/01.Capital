import { test, expect, type Page } from '@playwright/test';

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

async function fingertipDistanceToAuthorized(page: import('@playwright/test').Page): Promise<number> {
  return fingertipDistanceTo(page, '[data-ghost="captable_authorized"]');
}

test.skip(process.env.QAREEN_LIVE !== '1', 'Set QAREEN_LIVE=1 to call the configured Claude and Edge TTS services.');
test.setTimeout(90_000);

test('real Claude response speaks and guides on the live site', async ({ page }) => {
  await page.addInitScript(`
    window.__qareenRealAudioStarts = [];
    window.__qareenRealMediaPlays = [];
    const nativeCreateBufferSource = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const context = this;
      const source = nativeCreateBufferSource.call(context);
      const nativeStart = source.start.bind(source);
      source.start = function (...args) {
        window.__qareenRealAudioStarts.push({ duration: source.buffer ? source.buffer.duration : 0, state: context.state });
        return nativeStart(...args);
      };
      return source;
    };
    const nativeMediaPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      window.__qareenRealMediaPlays.push({ srcLength: this.src.length, muted: this.muted, volume: this.volume });
      return nativeMediaPlay.call(this);
    };
  `);

  await page.goto('/');
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.getByLabel(/Open Qareen/i).click();
  const guideToggle = page.getByTestId('guide-mode-toggle');
  if (await guideToggle.getAttribute('aria-pressed') !== 'true') await guideToggle.click();

  const brainResponse = page.waitForResponse((response) => response.url().includes('/qareen/brain/stream'));
  const firstTtsResponse = page.waitForResponse((response) => response.url().includes('/qareen/tts'));
  const workerBefore = await page.getByTestId('worker-hand-anchor').getAttribute('style');

  await page.getByPlaceholder('Type a message').fill('Show me the authorized shares and explain the ownership breakdown.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect((await brainResponse).status()).toBe(200);
  await expect((await firstTtsResponse).status()).toBe(200);
  await expect(page.locator('[data-testid="voice-output-state"]')).not.toHaveAttribute('data-state', 'unavailable');
  await expect(page.getByText(/ten million|authorized shares/i).first()).toBeVisible({ timeout: 30_000 });

  await expect.poll(
    () => fingertipDistanceToAuthorized(page),
    { timeout: 30_000, intervals: [20] },
  ).toBeLessThanOrEqual(24);
  await page.screenshot({ path: '/tmp/qareen-live-exact-target.png', fullPage: false });

  await expect
    .poll(async () => page.evaluate(() => {
      const plays = (window as unknown as { __qareenRealMediaPlays: { srcLength: number; muted: boolean; volume: number }[] }).__qareenRealMediaPlays;
      return plays.some((play) => play.srcLength > 1_000 && !play.muted && play.volume === 1);
    }), { timeout: 30_000 })
    .toBe(true);

  await expect
    .poll(async () => (await page.getByTestId('worker-hand-anchor').getAttribute('style')) !== workerBefore, { timeout: 30_000 })
    .toBe(true);

  // Finish the entire streamed turn, not merely the first line. The Send
  // button is re-enabled only after all line audio and motion dispatches end.
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled({ timeout: 80_000 });
  await expect(page.getByTestId('voice-output-state')).toHaveAttribute('data-state', 'idle');

  await page.screenshot({ path: '/tmp/qareen-live-claude.png', fullPage: false });
});

test('real Claude worker press activates the registration CTA', async ({ page }) => {
  await page.goto('/cap-table');
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.getByLabel(/Open Qareen/i).click();

  const brainResponse = page.waitForResponse((response) => response.url().includes('/qareen/brain/stream'));
  const ttsResponse = page.waitForResponse((response) => response.url().includes('/qareen/tts'));
  await page.getByPlaceholder('Type a message').fill('Take me to registration and click Get started.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect((await brainResponse).status()).toBe(200);
  await expect((await ttsResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/register$/, { timeout: 60_000 });
  await page.screenshot({ path: '/tmp/qareen-live-functional-click.png', fullPage: false });
});

test('real Claude uses live page context to locate Sign in accurately', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.getByLabel(/Open Qareen/i).click();

  const brainResponse = page.waitForResponse((response) => response.url().includes('/qareen/brain/stream'));
  const ttsResponse = page.waitForResponse((response) => response.url().includes('/qareen/tts'));
  await page.getByPlaceholder('Type a message').fill('Where is the sign button?');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect((await brainResponse).status()).toBe(200);
  await expect((await ttsResponse).status()).toBe(200);
  const reply = page.getByTestId('qareen-assistant-message').last();
  await expect(reply).toContainText(/sign in/i, { timeout: 30_000 });
  await expect(reply).toContainText(/top.*right|right.*top/i);
  await expect(reply).not.toContainText(/blue/i);
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled({ timeout: 80_000 });
  expect(await fingertipDistanceTo(page, '[data-ghost="nav_sign_in"]')).toBeLessThanOrEqual(24);
  await page.screenshot({ path: '/tmp/qareen-live-sign-in-context.png', fullPage: false });
});
