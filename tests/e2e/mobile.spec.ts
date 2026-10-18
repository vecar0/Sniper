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

test('옥상 저격전 터치: 조이스틱으로 이동 · 숙이기 · 스코프 · 무기 교체', async ({ page }) => {
  await page.goto('/?test');
  await page.waitForSelector('.a-menu', { timeout: 30_000 });
  await page.tap('[data-act="start"]');
  await expect(page.locator('.a-touch')).toBeVisible();
  const before = await page.evaluate(() => (window as any).__arena.game.pos.x);
  // 화면 왼쪽을 눌러 오른쪽으로 끌기(가상 조이스틱)
  const cdp = await page.context().newCDPSession(page);
  const vp = page.viewportSize()!;
  const y = vp.height * 0.6;
  const x0 = vp.width * 0.18;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + i * 10, y }] });
  }
  await expect(page.locator('.a-stick')).toBeVisible();
  await page.waitForFunction((b) => (window as any).__arena.game.pos.x > b + 0.3, before, { timeout: 30_000 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.tap('.a-touch .a-crouch');
  await page.waitForFunction(() => (window as any).__arena.game.crouched === true, null, { timeout: 30_000 });
  await page.tap('.a-touch .a-scope');
  await page.waitForFunction(() => (window as any).__arena.game.scopeT > 0.9, null, { timeout: 30_000 });
  await expect(page.locator('.a-touch .a-zoom')).toBeVisible();
  await page.tap('.a-touch .a-swap');
  await page.waitForFunction(() => (window as any).__arena.game.weapon === 'pistol', null, { timeout: 30_000 });
});
