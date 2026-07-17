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

async function mockTts(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ segments: [{ audio_base64: silentWavBase64(), word_timings: [] }], pause_ms: 0 }),
  });
}

async function openQareenThenVisit(page: Page, pathname: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel(/Open Qareen/i).click();
  await page.goto(pathname);
  await expect(page.getByPlaceholder('Type a message')).toBeVisible();
}

test('create account credentials fill locally without submitting or reaching Claude', async ({ page }) => {
  let brainCalls = 0;
  let registerCalls = 0;
  const fullName = 'Test Founder';
  const email = 'founder@example.test';
  const password = 'SecurePass123';

  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    brainCalls += 1;
    await route.fulfill({ status: 500, body: 'Credentials must not reach Claude' });
  });
  await page.route('**/api/backend/api/qareen/tts', async (route: Route) => {
    const text = (route.request().postDataJSON() as { text?: string }).text ?? '';
    expect(text).not.toContain(fullName);
    expect(text).not.toContain(email);
    expect(text).not.toContain(password);
    await mockTts(route);
  });
  await page.route('**/api/backend/api/auth/register', async (route: Route) => {
    registerCalls += 1;
    await route.fulfill({ status: 500, body: 'Qareen must not create the account' });
  });

  await openQareenThenVisit(page, '/register');
  await page.getByPlaceholder('Type a message').fill(
    `Fill the form. Full name is "${fullName}", email is ${email}, and password is "${password}"`,
  );
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(page.locator('[data-ghost="register_full_name"]')).toHaveValue(fullName, { timeout: 12_000 });
  await expect(page.locator('[data-ghost="register_email"]')).toHaveValue(email, { timeout: 12_000 });
  await expect(page.locator('[data-ghost="register_password"]')).toHaveValue(password, { timeout: 12_000 });
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();

  const transcript = await page.locator('[data-testid="qareen-presence"]').innerText();
  expect(transcript).toContain('Account credentials provided securely.');
  expect(transcript).not.toContain(fullName);
  expect(transcript).not.toContain(email);
  expect(transcript).not.toContain(password);
  expect(brainCalls).toBe(0);
  expect(registerCalls).toBe(0);
});

test('model type move updates a real React-controlled text input', async ({ page }) => {
  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    const sse = [
      'event: line\ndata: {"say":"I filled the full name field.","beats":[],"worker":[{"move":"type","target":"register_full_name","text":"Example Founder","on_word":3}]}\n\n',
      'event: done\ndata: {"intent":"delegate","needs_approval":false,"prepared_action":null}\n\n',
    ].join('');
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
  });
  await page.route('**/api/backend/api/qareen/tts', mockTts);

  await openQareenThenVisit(page, '/register');
  await page.getByPlaceholder('Type a message').fill('Fill Full name with Example Founder');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(page.locator('[data-ghost="register_full_name"]')).toHaveValue('Example Founder', { timeout: 8_000 });
});

test('model output cannot type directly into a password field', async ({ page }) => {
  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    const sse = [
      'event: line\ndata: {"say":"I tried the password field.","beats":[],"worker":[{"move":"type","target":"register_password","text":"ShouldNotAppear123","on_word":3}]}\n\n',
      'event: done\ndata: {"intent":"delegate","needs_approval":false,"prepared_action":null}\n\n',
    ].join('');
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse });
  });
  await page.route('**/api/backend/api/qareen/tts', mockTts);

  await openQareenThenVisit(page, '/register');
  await page.getByPlaceholder('Type a message').fill('Show me the password field');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();

  await expect(page.locator('[data-ghost="register_password"]')).toHaveValue('');
});

test('model type move updates an auto-discovered textarea', async ({ page }) => {
  let textareaTarget = '';
  await page.route('**/api/backend/api/qareen/brain/stream', async (route: Route) => {
    const body = route.request().postDataJSON() as {
      page_context: { elements: Array<{ target_id: string; tag: string }> };
    };
    textareaTarget = body.page_context.elements.find((element) => element.tag === 'textarea')?.target_id ?? '';
    const line = {
      say: 'I filled the project details.',
      beats: [],
      worker: [{ move: 'type', target: textareaTarget, text: 'Closing our Series A.', on_word: 3 }],
    };
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: `event: line\ndata: ${JSON.stringify(line)}\n\nevent: done\ndata: {"intent":"delegate","needs_approval":false,"prepared_action":null}\n\n`,
    });
  });
  await page.route('**/api/backend/api/qareen/tts', mockTts);

  await openQareenThenVisit(page, '/contact');
  await page.getByPlaceholder('Type a message').fill('Fill the project details with Closing our Series A');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  expect(textareaTarget).toMatch(/^page_textbox_/);
  await expect(page.locator('textarea')).toHaveValue('Closing our Series A.', { timeout: 8_000 });
});
