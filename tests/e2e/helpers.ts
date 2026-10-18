import type { Page } from '@playwright/test';

export interface Watch {
  errors: string[];
}

/** 콘솔 에러·페이지 예외 수집 */
export function watch(page: Page): Watch {
  const w: Watch = { errors: [] };
  page.on('console', (m) => {
    if (m.type() === 'error') w.errors.push(m.text());
  });
  page.on('pageerror', (e) => w.errors.push(`pageerror: ${e.message}`));
  return w;
}

export async function boot(page: Page, opts: { save?: unknown } = {}): Promise<void> {
  if (opts.save !== undefined) {
    await page.addInitScript((data) => {
      if (!sessionStorage.getItem('__seeded')) {
        localStorage.setItem('longshot.save', typeof data === 'string' ? data : JSON.stringify(data));
        sessionStorage.setItem('__seeded', '1');
      }
    }, opts.save);
  }
  await page.goto('/classic.html?test');
  await page.waitForSelector('.screen-menu', { timeout: 30_000 });
  await page.waitForFunction(() => !document.getElementById('loading'));
}

export async function state(page: Page): Promise<string> {
  return page.evaluate(() => (window as any).__longshot.game.fsm.state);
}

export async function stats(page: Page): Promise<any> {
  return page.evaluate(() => (window as any).__longshot.game.debugStats());
}

/** 표적 정조준 후 가상 입력으로 발사(실제 입력 경로 사용) */
export async function aimAndFire(page: Page, index: number): Promise<void> {
  await page.evaluate((i) => (window as any).__longshot.game.testAimAt(i), index);
  await page.waitForTimeout(50);
  await page.evaluate((i) => (window as any).__longshot.game.testAimAt(i), index);
  await page.evaluate(() => (window as any).__longshot.input.tapVirtual('fire'));
}

/** 장전될 때까지 대기 */
export async function waitReady(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as any).__longshot.game.rifle.canFire(), null, { timeout: 60_000 });
}

/** 게임 시간 기준 대기(느린 테스트 환경에서도 같은 의미가 되도록) */
export async function waitGameTime(page: Page, seconds: number): Promise<void> {
  const start = await page.evaluate(() => (window as any).__longshot.game.debugStats().time);
  await page.waitForFunction((t) => (window as any).__longshot.game.debugStats().time >= t, start + seconds, { timeout: 200_000 });
}

/** 모든 미션 해금(테스트용 저장 데이터) */
export function unlockedSave(): unknown {
  const missions: Record<string, unknown> = {};
  for (const id of ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8']) missions[id] = { stars: [true, true, true], bestTime: 60, cleared: true };
  return { version: 1, progress: { missions, daily: {}, stats: { shots: 0, hits: 0, kills: 0, headshots: 0, longestHit: 0, playSeconds: 0 }, firstRun: false } };
}
