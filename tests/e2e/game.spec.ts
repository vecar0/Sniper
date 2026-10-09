/**
 * 평가표 2-2절의 스트레스 시나리오를 자동화한 E2E 테스트.
 */
import { expect, test } from '@playwright/test';
import { BALANCE } from '../../src/config/balance';
import { aimAndFire, boot, state, stats, unlockedSave, waitGameTime, waitReady, watch } from './helpers';

test.describe('기본 흐름', () => {
  test('부팅: 콘솔 에러 없음, 제목·파비콘, 로딩 화면 제거', async ({ page }) => {
    const w = watch(page);
    await boot(page);
    await expect(page).toHaveTitle(/LONG SHOT/);
    expect(await page.locator('link[rel="icon"]').getAttribute('href')).toContain('favicon.svg');
    const fav = await page.request.get('/favicon.svg');
    expect(fav.ok()).toBe(true);
    await expect(page.locator('#loading')).toHaveCount(0);
    await expect(page.locator('.screen-menu h1')).toHaveText('LONG SHOT');
    expect(w.errors).toEqual([]);
  });

  test('타이틀 → 플레이까지 클릭 2번', async ({ page }) => {
    await boot(page);
    await page.click('[data-go="next"]');
    await page.click('[data-start]');
    expect(await state(page)).toBe('playing');
  });

  test('미션 1을 끝까지 클리어하고 결과·별·저장 확인', async ({ page }) => {
    const w = watch(page);
    await boot(page);
    await page.click('[data-go="next"]');
    await page.click('[data-start]');
    await aimAndFire(page, 0);
    await page.waitForFunction(() => (window as any).__longshot.game.debugStats().stats.hits === 1, null, { timeout: 60_000 });
    await waitReady(page);
    await aimAndFire(page, 1);
    await page.waitForSelector('.screen-result', { timeout: 120_000 });
    await expect(page.locator('.result h2')).toHaveText('임무 완료');
    await expect(page.locator('.result-stars .star.on')).toHaveCount(3);
    // 새로고침 후에도 진행 유지
    await page.reload();
    await page.waitForSelector('.screen-menu');
    await expect(page.locator('.menu-foot')).toContainText('★ 3');
    expect(w.errors).toEqual([]);
  });

  test('빗나가면 탄착 분석 카드가 원인과 팁을 보여준다', async ({ page }) => {
    await boot(page);
    await page.click('[data-go="next"]');
    await page.click('[data-start]');
    await page.evaluate(() => {
      const g = (window as any).__longshot.game;
      g.testAimAt(1);
      g.rifle.elevMil = 0; // 350m인데 고각 보정을 안 함 → 낮게 빗나감
    });
    await page.evaluate(() => (window as any).__longshot.input.tapVirtual('fire'));
    await expect(page.locator('.hud-analysis.show')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('.hud-analysis')).toContainText('낮음');
    await expect(page.locator('.ha-tip')).toContainText('고각');
  });
});

test.describe('스트레스', () => {
  test.beforeEach(async ({ page }) => {
    await boot(page);
    await page.click('[data-go="next"]');
    await page.click('[data-start]');
  });

  test('입력 없이 20초(게임 시간) 방치', async ({ page }) => {
    const w = watch(page);
    await waitGameTime(page, 20);
    expect(await state(page)).toBe('playing');
    expect(w.errors).toEqual([]);
  });

  test('모든 키를 매우 빠르게 연타 + 동시 입력', async ({ page }) => {
    const w = watch(page);
    const keys = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyE', 'KeyQ', 'KeyF', 'Tab', 'KeyX', 'KeyZ', 'ShiftLeft', 'Space'];
    for (let round = 0; round < 15; round++) {
      for (const k of keys) await page.keyboard.down(k);
      for (const k of keys) await page.keyboard.up(k);
      await page.evaluate(() => (window as any).__longshot.input.tapVirtual('fire'));
    }
    await page.waitForTimeout(500);
    expect(await state(page)).toBe('playing');
    const g = await page.evaluate(() => {
      const r = (window as any).__longshot.game.rifle;
      return { elev: r.elevMil, wind: r.windMil, total: r.inMag + r.reserve };
    });
    expect(g.elev).toBeGreaterThanOrEqual(0);
    expect(g.elev).toBeLessThanOrEqual(30);
    expect(Math.abs(g.wind)).toBeLessThanOrEqual(10);
    expect(g.total).toBeGreaterThanOrEqual(0);
    expect(w.errors).toEqual([]);
  });

  test('일시정지 · 재개 · 재시작 12회 반복: 상태·메모리 안정', async ({ page }) => {
    const w = watch(page);
    const before = await stats(page);
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Escape');
      await expect(page.locator('.screen-pause')).toBeVisible();
      expect(await state(page)).toBe('paused');
      await page.waitForTimeout(450);
      if (i % 2 === 0) {
        await page.keyboard.press('Escape');
        await expect(page.locator('.screen-pause')).toHaveCount(0);
      } else {
        await page.click('[data-act="restart"]');
      }
      expect(await state(page)).toBe('playing');
      await aimAndFire(page, 0);
    }
    await waitGameTime(page, 1.5);
    const after = await stats(page);
    expect(after.sceneChildren).toBe(before.sceneChildren);
    expect(after.geometries).toBeLessThanOrEqual(before.geometries + 4);
    expect(after.bullets).toBeLessThanOrEqual(2);
    expect(w.errors).toEqual([]);
  });

  test('R 길게 누르기로 즉시 재시작', async ({ page }) => {
    // 재시작에 필요한 누름 시간은 0.5초 이하(실수 방지 + 빠름)
    expect(BALANCE.input.restartHoldTime).toBeLessThanOrEqual(0.5);
    await aimAndFire(page, 0);
    await page.waitForFunction(() => (window as any).__longshot.game.debugStats().stats.hits === 1, null, { timeout: 60_000 });
    await page.keyboard.down('KeyR');
    await page.waitForFunction(() => (window as any).__longshot.game.debugStats().stats.shots === 0, null, { timeout: 60_000 });
    await page.keyboard.up('KeyR');
    const s = await stats(page);
    expect(s.targets.every((t: any) => !t.done)).toBe(true);
  });

  test('창 크기 변경 · 탭 숨김 시 자동 일시정지', async ({ page }) => {
    const w = watch(page);
    for (const [vw, vh] of [[800, 600], [1920, 1080], [1024, 500], [1280, 720]]) {
      await page.setViewportSize({ width: vw, height: vh });
      await page.waitForTimeout(150);
      const size = await page.evaluate(() => {
        const c = document.getElementById('game-canvas') as HTMLCanvasElement;
        return { cw: c.clientWidth, ch: c.clientHeight, w: innerWidth, h: innerHeight };
      });
      expect(size.cw).toBe(size.w);
      expect(size.ch).toBe(size.h);
    }
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(await state(page)).toBe('paused');
    await expect(page.locator('.screen-pause')).toBeVisible();
    // 일시정지 중에는 게임 시간이 흐르지 않는다
    const t1 = (await stats(page)).time;
    await page.waitForTimeout(1000);
    expect((await stats(page)).time).toBe(t1);
    expect(w.errors).toEqual([]);
  });
});

test.describe('장시간 · 콘텐츠', () => {
  test('사격장에서 80발: 준비 구간 이후 오브젝트 수가 늘지 않는다(풀링)', async ({ page }) => {
    test.setTimeout(600_000);
    const w = watch(page);
    await boot(page);
    await page.click('[data-go="range"]');
    await page.click('[data-start]');
    const shoot = async (from: number, count: number) => {
      for (let i = from; i < from + count; i++) {
        await page.evaluate((n) => {
          const g = (window as any).__longshot.game;
          g.testAimAt(n % 15);
          if (n % 3 === 0) g.rifle.elevMil = 0; // 일부는 빗나가게
          g.rifle.boltTimer = 0;
          g.rifle.chambered = true;
          g.rifle.inMag = Math.max(1, g.rifle.inMag);
          (window as any).__longshot.input.tapVirtual('fire');
        }, i);
        await page.waitForFunction((k) => (window as any).__longshot.game.debugStats().stats.shots >= k, i + 1, { timeout: 60_000 });
      }
      await page.waitForFunction(() => (window as any).__longshot.game.debugStats().bullets === 0, null, { timeout: 120_000 });
    };
    // 준비 구간: 모든 표적·효과가 한 번씩 화면에 나와 GPU에 올라간다
    await shoot(0, 20);
    const warm = await stats(page);
    await shoot(20, 60);
    const last = await stats(page);
    expect(last.sceneChildren).toBe(warm.sceneChildren);
    expect(last.geometries).toBe(warm.geometries);
    expect(last.textures).toBe(warm.textures);
    expect(last.stats.shots).toBe(80);
    expect(last.stats.hits).toBeGreaterThan(40);
    expect(w.errors).toEqual([]);
  });

  test('8개 미션 + 일일 챌린지 모두 로드·시작 가능', async ({ page }) => {
    test.setTimeout(400_000);
    const w = watch(page);
    await boot(page, { save: unlockedSave() });
    for (let i = 0; i < 8; i++) {
      await page.click('[data-go="missions"]');
      await page.click(`[data-mission="${i}"]`);
      await page.click('[data-start]');
      expect(await state(page)).toBe('playing');
      await page.keyboard.press('Escape');
      await page.click('[data-act="quit"]');
      await page.waitForSelector('.screen-menu');
    }
    await page.click('[data-go="daily"]');
    await page.click('[data-start]');
    expect(await state(page)).toBe('playing');
    expect(w.errors).toEqual([]);
  });

  test('로봇 미션: 총성 후 다른 로봇이 경계 → 탈출하면 실패 사유 표시', async ({ page }) => {
    await boot(page, { save: unlockedSave() });
    await page.click('[data-go="missions"]');
    await page.click('[data-mission="3"]');
    await page.click('[data-start]');
    await aimAndFire(page, 0);
    await expect(page.locator('.hud-alert.show')).toBeVisible({ timeout: 90_000 });
    await page.waitForSelector('.screen-result', { timeout: 200_000 });
    await expect(page.locator('.fail-reason')).toContainText('탈출');
    await expect(page.locator('.tip')).toBeVisible();
  });

  test('메뉴 버튼 연타에도 화면이 꼬이지 않는다', async ({ page }) => {
    const w = watch(page);
    await boot(page);
    for (let i = 0; i < 10; i++) {
      await page.click('[data-go="settings"]');
      await page.keyboard.press('Escape');
      await page.click('[data-go="controls"]');
      await page.keyboard.press('Escape');
      await page.click('[data-go="missions"]');
      await page.keyboard.press('Escape');
    }
    await expect(page.locator('.screen-menu')).toBeVisible();
    expect(await state(page)).toBe('menu');
    expect(w.errors).toEqual([]);
  });
});

test.describe('저장 · 설정', () => {
  test('손상된 저장 데이터 → 초기화 안내 후 정상 실행', async ({ page }) => {
    const w = watch(page);
    await boot(page, { save: '{not json' });
    await expect(page.locator('.toast.show')).toContainText('손상');
    expect(await state(page)).toBe('menu');
    expect(w.errors).toEqual([]);
  });

  test('설정 변경(볼륨·키)이 새로고침 후 유지', async ({ page }) => {
    await boot(page);
    await page.click('[data-go="settings"]');
    await page.locator('[data-set="masterVolume"]').fill('0.3');
    await page.click('[data-key="fire"]');
    await page.keyboard.press('KeyG');
    await expect(page.locator('[data-key="fire"]')).toHaveText('G');
    await page.reload();
    await page.waitForSelector('.screen-menu');
    const s = await page.evaluate(() => (window as any).__longshot.save.data.settings);
    expect(s.masterVolume).toBeCloseTo(0.3);
    expect(s.keys.fire).toBe('KeyG');
  });
});
