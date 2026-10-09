/** 모바일: 세로 안내 · 가로 터치 조작 */
import { expect, test } from '@playwright/test';
import { aimAndFire, boot, state, watch } from './helpers';

test('세로 화면: 가로 전환 안내 + 게임 자동 일시정지', async ({ page }) => {
  const w = watch(page);
  await boot(page);
  await expect(page.locator('.rotate.show')).toBeVisible();
  await page.setViewportSize({ width: 915, height: 412 });
  await expect(page.locator('.rotate.show')).toHaveCount(0);
  await page.click('[data-go="next"]');
  await page.click('[data-start]');
  expect(await state(page)).toBe('playing');
  await expect(page.locator('.touch')).toBeVisible();
  // 플레이 중 세로로 돌리면 일시정지
  await page.setViewportSize({ width: 412, height: 915 });
  await page.waitForFunction(() => (window as any).__longshot.game.fsm.state === 'paused', null, { timeout: 30_000 });
  expect(w.errors).toEqual([]);
});

test('가로 화면 터치: 버튼으로 스코프·숨·발사, 드래그로 조준', async ({ page }) => {
  const w = watch(page);
  await page.setViewportSize({ width: 915, height: 412 });
  await boot(page);
  await page.tap('[data-go="next"]');
  await page.tap('[data-start]');
  await page.tap('.t-scope');
  await page.waitForFunction(() => (window as any).__longshot.game.hud().scopeT > 0.9, null, { timeout: 60_000 });
  const scoped = await page.evaluate(() => (window as any).__longshot.game.hud().scopeT);
  expect(scoped).toBeGreaterThan(0.9);
  // 드래그 조준
  const yaw0 = await page.evaluate(() => (window as any).__longshot.game.yaw);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 450, y: 200 }] });
  for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 450 + i * 20, y: 200 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction((y) => (window as any).__longshot.game.yaw !== y, yaw0, { timeout: 60_000 });
  const yaw1 = await page.evaluate(() => (window as any).__longshot.game.yaw);
  expect(yaw1).not.toBe(yaw0);
  // 발사 버튼
  await aimAndFire(page, 0);
  await page.waitForFunction(() => (window as any).__longshot.game.debugStats().stats.shots === 1, null, { timeout: 60_000 });
  // 모든 버튼이 화면 안에 있고 최소 40px
  const boxes = await page.locator('.tbtn').evaluateAll((els) =>
    els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.getBoundingClientRect().toJSON()),
  );
  for (const b of boxes) {
    expect(b.width).toBeGreaterThanOrEqual(40);
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(915);
    expect(b.top).toBeGreaterThanOrEqual(0);
    expect(b.bottom).toBeLessThanOrEqual(412);
  }
  expect(w.errors).toEqual([]);
});
