import { expect, test } from '@playwright/test';
import { watch } from './helpers';

async function bootArena(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/?test');
  await page.waitForSelector('.a-menu', { timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById('loading'));
}

test.describe('옥상 저격전(메인 모드)', () => {
  test('부팅: 콘솔 에러 없음 · 메뉴 · 클래식 모드 링크', async ({ page }) => {
    const w = watch(page);
    await bootArena(page);
    await expect(page).toHaveTitle(/옥상 저격전/);
    await expect(page.locator('.a-classic')).toHaveAttribute('href', './classic.html');
    expect(w.errors).toEqual([]);
  });

  test('출격 → 웨이브 시작 → 적을 저격해 처치 · 점수', async ({ page }) => {
    test.setTimeout(240_000);
    const w = watch(page);
    await bootArena(page);
    await page.click('[data-act="start"]');
    await expect(page.locator('.a-hud')).toBeVisible();
    expect(await page.evaluate(() => (window as any).__arena.game.wave)).toBe(1);
    // 엄폐 지점에 자리 잡은(보이는) 적이 생길 때까지
    await page.waitForFunction(() => (window as any).__arena.game.enemies.some((e: any) => e.alive && (e.state === 'peek' || e.state === 'hide') && e.pos.z > -100), null, { timeout: 180_000 });
    // 정확히 겨눠 스코프 → 발사(가상 입력)
    await page.evaluate(() => {
      const { game: g, input } = (window as any).__arena;
      (window as any).__aim = setInterval(() => {
        if (g.stats.kills > 0) return (input.fireDown = false);
        const t = g.enemies.filter((e: any) => e.alive && (e.state === 'peek' || e.state === 'hide')).sort((a: any, b: any) => b.pos.z - a.pos.z)[0];
        if (!t) return;
        const p = t.headPos();
        const d = p.sub(g.camera.position);
        g.yaw = Math.atan2(-d.x, -d.z);
        g.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
        g.scoped = true;
        input.fireDown = g.scopeT > 0.95 && !input.fireDown;
      }, 50);
    });
    await page.waitForFunction(() => (window as any).__arena.game.stats.kills > 0, null, { timeout: 150_000 });
    await page.evaluate(() => clearInterval((window as any).__aim));
    expect(await page.evaluate(() => (window as any).__arena.game.score)).toBeGreaterThan(0);
    await expect(page.locator('.a-feed-row').first()).toBeVisible();
    expect(w.errors).toEqual([]);
  });

  test('일시정지 · 다시 시작 · 메뉴로, 체력 0이면 결과 화면과 최고 점수 저장', async ({ page }) => {
    const w = watch(page);
    await bootArena(page);
    await page.click('[data-act="start"]');
    await page.evaluate(() => (window as any).__arena.ui.pause());
    await expect(page.locator('.a-pause')).toBeVisible();
    await page.click('[data-act="restart"]');
    await expect(page.locator('.a-hud')).toBeVisible();
    // 점수를 주고 쓰러뜨린다
    await page.evaluate(() => {
      const g = (window as any).__arena.game;
      g.score = 1234;
      g.onEnemyShot(g.enemies[0] ?? { kind: 'rifle' }, true, 500, g.camera.position.clone().add({ x: 0, y: 0, z: -50 } as any), g.camera.position.clone());
    });
    await expect(page.locator('.a-result')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.a-final')).toContainText('1,234');
    expect(await page.evaluate(() => localStorage.getItem('longshot.arena.best'))).toBe('1234');
    await page.click('[data-act="menu"]');
    await expect(page.locator('.a-menu')).toBeVisible();
    await expect(page.locator('.a-best b')).toContainText('1,234');
    expect(w.errors).toEqual([]);
  });
});
