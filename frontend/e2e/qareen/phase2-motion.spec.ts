import { test, expect } from '@playwright/test';

/**
 * Qareen now mounts globally on the real site (ADR-0010) and starts
 * dismissed — the debug panel only exists once summoned, so every test
 * here opens the landing page and clicks the nav icon first.
 *
 * Press/glide-to-real-target coverage was removed along with the isolated
 * demo pages: GHOST_ROUTES is currently empty (see ghostRegistry.ts) since
 * no real production component has a data-ghost attribute yet. That
 * coverage returns once real elements are tagged.
 */
async function summonQareen(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/?debug=1');
  await page.getByLabel(/Open Qareen/i).click();
}

test('debug panel is hidden until Qareen is summoned', async ({ page }) => {
  await page.goto('/?debug=1');
  await expect(page.getByTestId('debug-panel')).toHaveCount(0);
});

test('summoning Qareen enables guided movement by default', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(/Open Qareen/i).click();
  await expect(page.getByTestId('guide-mode-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('guide-mode-toggle')).toHaveText('Guided');
});

test('idle motion is continuously live (transform changes between frames)', async ({ page }) => {
  await summonQareen(page);
  const worker = page.getByTestId('worker-hand-anchor');
  await expect(worker).toBeAttached();

  const t1 = await worker.evaluate((el) => (el as HTMLElement).style.transform);
  await page.waitForTimeout(400);
  const t2 = await worker.evaluate((el) => (el as HTMLElement).style.transform);
  expect(t1).not.toBe(t2);
});

test('freeze halts all procedural motion; unfreeze resumes it', async ({ page }) => {
  await summonQareen(page);
  await page.getByTestId('debug-freeze').click();

  const worker = page.getByTestId('worker-hand-anchor');
  // freeze() is immediate, but the transform that removes the previous
  // frame's idle drift is committed on the next rAF.
  await page.waitForTimeout(50);
  const f1 = await worker.evaluate((el) => (el as HTMLElement).style.transform);
  await page.waitForTimeout(500);
  const f2 = await worker.evaluate((el) => (el as HTMLElement).style.transform);
  expect(f1).toBe(f2);

  await page.getByTestId('debug-unfreeze').click();
  const u1 = await worker.evaluate((el) => (el as HTMLElement).style.transform);
  await page.waitForTimeout(500);
  const u2 = await worker.evaluate((el) => (el as HTMLElement).style.transform);
  expect(u1).not.toBe(u2);
});

test('left speaker hand is not rendered', async ({ page }) => {
  await summonQareen(page);
  await expect(page.getByTestId('speaker-hand')).toHaveCount(0);
  await expect(page.getByTestId('speaker-hand-anchor')).toHaveCount(0);
  await expect(page.getByTestId('worker-hand')).toBeVisible();
});
