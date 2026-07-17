import { test, expect, type Page, type Route } from '@playwright/test';

interface ContextElement {
  target_id: string;
  role: string;
  label: string;
  href: string | null;
  position: string;
  appearance: string;
  action: string;
}

interface CapturedPageContext {
  pathname: string;
  title: string;
  elements: ContextElement[];
}

function silentWavBase64(durationMs = 300): string {
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

test('every turn sends real sign-in position and appearance, then points to it', async ({ page }) => {
  let captured: CapturedPageContext | null = null;
  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    const body = route.request().postDataJSON() as { page_context?: CapturedPageContext };
    captured = body.page_context ?? null;
    const sse = [
      'event: line\ndata: {"say":"Sign in is at the top right.","beats":[],"worker":[{"move":"glide","target":"nav_sign_in","text":null,"on_word":0}]}\n\n',
      'event: done\ndata: {"intent":"howto","needs_approval":false,"prepared_action":null}\n\n',
    ].join('');
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
  await page.getByLabel(/Open Qareen/i).click();
  await page.getByPlaceholder('Type a message').fill('Where is the sign button?');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled({ timeout: 8_000 });

  expect(captured).not.toBeNull();
  expect(captured!.pathname).toBe('/');
  const signIn = captured!.elements.find((element) => element.target_id === 'nav_sign_in');
  expect(signIn).toMatchObject({
    role: 'link',
    label: 'Sign in',
    href: '/login',
    action: 'navigate:/login',
    position: 'top right',
  });
  expect(signIn!.appearance).not.toContain('blue');

  // The language switch is a stable, explicitly safe functional target.
  const languageToggle = captured!.elements.find((element) => element.label === 'Toggle language');
  expect(languageToggle?.target_id).toBe('nav_language_toggle');
  expect(languageToggle?.role).toBe('button');

  expect(await fingertipDistanceTo(page, '[data-ghost="nav_sign_in"]')).toBeLessThanOrEqual(24);
});

test('live auto-target from page context can be guided without a static registry entry', async ({ page }) => {
  let autoTarget = '';
  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    const body = route.request().postDataJSON() as { page_context: CapturedPageContext };
    autoTarget = body.page_context.elements.find((element) => element.label === 'Toggle lens')?.target_id ?? '';
    const line = {
      say: 'The lens control is at the top right.',
      beats: [],
      worker: [{ move: 'glide', target: autoTarget, text: null, on_word: 1 }],
    };
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: `event: line\ndata: ${JSON.stringify(line)}\n\nevent: done\ndata: {"intent":"howto","needs_approval":false,"prepared_action":null}\n\n`,
    });
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
  await page.getByPlaceholder('Type a message').fill('Where is the lens control?');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled({ timeout: 8_000 });

  expect(autoTarget).toBe('page_button_toggle_lens');
  expect(await fingertipDistanceTo(page, `[data-qareen-target="${autoTarget}"]`)).toBeLessThanOrEqual(24);
});

test('page context excludes authenticated row contents and typed values', async ({ page }) => {
  let serializedContext = '';
  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    const body = route.request().postDataJSON() as { page_context: CapturedPageContext };
    serializedContext = JSON.stringify(body.page_context);
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'event: line\ndata: {"say":"The page structure is available.","beats":[],"worker":[]}\n\nevent: done\ndata: {"intent":"knowledge","needs_approval":false,"prepared_action":null}\n\n',
    });
  });
  await page.route('**/api/backend/api/qareen/tts', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ segments: [{ audio_base64: silentWavBase64(), word_timings: [] }], pause_ms: 0 }),
    });
  });

  await page.goto('/');
  await page.evaluate(() => {
    const list = document.createElement('div');
    list.dataset.ghost = 'app_stakeholders_list';
    list.style.cssText = 'display:block;width:200px;height:40px';
    const record = document.createElement('a');
    record.href = '/companies/demo/stakeholders/private-id';
    record.textContent = 'Highly Sensitive Customer Name';
    list.appendChild(record);
    document.body.appendChild(list);

    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Email address');
    input.value = 'secret-person@example.test';
    input.style.cssText = 'display:block;width:200px;height:30px';
    document.body.appendChild(input);
  });

  await page.getByLabel(/Open Qareen/i).click();
  await page.getByPlaceholder('Type a message').fill('What can you see?');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled({ timeout: 8_000 });

  expect(serializedContext).not.toContain('Highly Sensitive Customer Name');
  expect(serializedContext).not.toContain('secret-person@example.test');
  expect(serializedContext).toContain('stakeholders list');
  expect(serializedContext).toContain('Email address');
});
