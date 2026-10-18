// 실제 브라우저 검수(Playwright). 정적 서버를 직접 띄우고 PC·모바일 환경에서 완료 기준을 확인한다.
// 실행: node tests/e2e.mjs   (CHROMIUM=경로 로 브라우저 지정 가능)
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SHOTS || null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const f = path.join(ROOT, u === '/' ? 'index.html' : u);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(browser, opts, base, errors) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`${base}/index.html?test`);
  await page.waitForFunction(() => window.__breach && window.__breach.state === 'menu');
  return { ctx, page };
}

// 봇으로 리더를 조종하며 n틱 진행(렌더 프레임도 계속 돈다)
async function botPlay(page, seconds, chunk = 30) {
  return page.evaluate(async ({ seconds, chunk }) => {
    const { makeBot } = await import('/tests/bot.js');
    const B = window.__breach;
    const tick = makeBot(B.world);
    const app = B.app;
    app.externalSim = true;
    const total = Math.round(seconds * 60);
    for (let i = 0; i < total && B.world && !B.world.result; i += chunk) {
      for (let k = 0; k < chunk && !B.world.result; k++) { for (const a of B.world.actors) { a.px = a.x; a.pz = a.z; } tick(B.world); B.world.step(); }
      await new Promise((r) => requestAnimationFrame(r));
      if (app.state !== 'play') break;
    }
    app.externalSim = false;
    return B.world ? (B.world.result ? { win: B.world.result.win, reason: B.world.result.reason } : { time: B.world.time }) : null;
  }, { seconds, chunk });
}

async function main() {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--expose-gc', '--enable-precise-memory-info'],
  });

  // ───────── PC ─────────
  {
    const errors = [];
    const { ctx, page } = await newPage(browser, { viewport: { width: 1280, height: 720 } }, base, errors);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => window.__breach && window.__breach.state === 'menu');

    // 메뉴 → 작전 선택 → 브리핑 → 작전 (버튼만으로)
    await page.click('#btn-play');
    await page.waitForSelector('#screen-select:not(.hidden)');
    const locked = await page.$$eval('.mission-card.locked', (els) => els.length);
    check('작전 선택: 처음엔 1번만 열려 있음', locked === 4, `잠김 ${locked}`);
    await page.click('.mission-card[data-id="m1"]');
    await page.waitForSelector('#screen-briefing:not(.hidden)');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/pc-briefing.png` });
    await page.click('#btn-brief-start');
    await page.waitForFunction(() => window.__breach.state === 'play');
    check('메뉴 → 선택 → 브리핑 → 작전: 버튼만으로 진입', await page.isVisible('#hud'));

    // 이동(키보드)
    const p0 = await page.evaluate(() => ({ x: __breach.world.leader.x, z: __breach.world.leader.z, t: __breach.world.time }));
    await page.keyboard.down('KeyW'); await sleep(700); await page.keyboard.up('KeyW');
    const p1 = await page.evaluate(() => ({ x: __breach.world.leader.x, z: __breach.world.leader.z, t: __breach.world.time }));
    // 소프트웨어 렌더러는 프레임이 느려 게임 시간이 실제보다 덜 흐르므로 게임 시간 기준 속도로 판정
    const sp = Math.hypot(p1.x - p0.x, p1.z - p0.z) / Math.max(1e-3, p1.t - p0.t);
    check('W 키로 리더가 움직인다(걷기 속도)', sp > 2.0, `${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(2)}m / 게임 ${(p1.t - p0.t).toFixed(2)}초 = ${sp.toFixed(2)}m/s`);

    // 명령 휠
    await page.keyboard.down('KeyV');
    await sleep(100);
    const items = await page.$$eval('#wheel .wheel-item', (els) => els.map((e) => e.textContent));
    check('V를 누르면 명령 휠이 열리고 항목이 보인다', items.length >= 2, items.join(' / '));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/pc-wheel.png` });
    await page.keyboard.up('KeyV');
    await sleep(100);
    check('V를 떼면 휠이 닫힌다', await page.isHidden('#wheel'));

    // 포인터 락 해제 → 자동 일시정지
    const hadLock = await page.evaluate(() => !!document.pointerLockElement);
    await page.evaluate(() => (document.pointerLockElement ? document.exitPointerLock() : document.dispatchEvent(new Event('pointerlockchange'))));
    await sleep(200);
    console.log(`      (포인터 락 실제 획득: ${hadLock})`);
    check('포인터 락이 풀리면 자동 일시정지', (await page.evaluate(() => __breach.state)) === 'pause');
    await page.click('#btn-resume');
    await sleep(100);
    check('일시정지 → 계속', (await page.evaluate(() => __breach.state)) === 'play');

    // 탭 전환
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    const t0 = await page.evaluate(() => __breach.world.time);
    await sleep(1000);
    const t1 = await page.evaluate(() => __breach.world.time);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });
    check('탭 전환: 자동 일시정지되고 시간이 흐르지 않는다', (await page.evaluate(() => __breach.state)) === 'pause' && t1 === t0, `Δt=${(t1 - t0).toFixed(3)}`);
    await page.click('#btn-resume');

    // 훈련장 끝까지(봇) → 결과 → 해금 저장
    await sleep(200);
    const r1 = await botPlay(page, 300);
    await page.waitForSelector('#screen-result:not(.hidden)', { timeout: 10000 });
    const title = await page.textContent('#res-title');
    const stars = await page.$eval('#res-stars', (e) => (e.textContent.match(/★/g) || []).length - (e.querySelector('span')?.textContent.length || 0));
    check('훈련장 자동 플레이 → 승리 화면 + 별', title === '작전 성공' && stars >= 1, `${title} 별 ${stars} ${JSON.stringify(r1)}`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/pc-result.png` });
    await page.reload();
    await page.waitForFunction(() => window.__breach && window.__breach.state === 'menu');
    await page.click('#btn-play');
    const unlockedM2 = await page.$eval('.mission-card[data-id="m2"]', (e) => !e.classList.contains('locked'));
    check('별 1개 이상 → 다음 작전 해금, 새로고침 후에도 유지', unlockedM2);

    // 주유소 1회 전체 플레이(봇) — 콘솔 에러 수집 구간
    await page.click('.mission-card[data-id="m2"]');
    await page.click('#btn-brief-start');
    await page.waitForFunction(() => window.__breach.state === 'play');
    await sleep(300);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/pc-play-m2.png` });
    const r2 = await botPlay(page, 480);
    await page.waitForSelector('#screen-result:not(.hidden)', { timeout: 10000 });
    check('주유소 강도 전체 플레이 → 결과 화면', !!r2 && r2.win, JSON.stringify(r2));

    // 실패 화면
    await page.click('#btn-res-retry');
    await page.waitForFunction(() => window.__breach.state === 'play');
    await page.evaluate(() => { __breach.world.leader.hp = 0; });
    await page.waitForSelector('#screen-result:not(.hidden)', { timeout: 5000 });
    check('리더 체력 0 → 실패 화면', (await page.textContent('#res-title')) === '작전 실패', await page.textContent('#res-reason'));

    // 손상된 저장 → 정상 시작
    await page.evaluate(() => localStorage.setItem('breachline.save', '{{{깨진 데이터'));
    await page.reload();
    await page.waitForFunction(() => window.__breach && window.__breach.state === 'menu');
    check('손상된 저장 데이터 → 초기화 후 정상 시작', (await page.evaluate(() => __breach.save().unlocked.join(','))) === 'm1');

    // 성능: 최악 장면(작전 5 복도, 모든 문 열림, 섬광 + 사격)
    await page.evaluate(() => __breach.start('m5'));
    await page.waitForFunction(() => window.__breach.state === 'play');
    const perf = await page.evaluate(async () => {
      const B = window.__breach; const w = B.world;
      w.doors.forEach((d) => { d.open = true; d.amt = 1; d.locked = false; });
      w.leader.x = 17 * 1.2; w.leader.z = 7.5 * 1.2; w.leader.yaw = Math.PI / 2;
      let maxCalls = 0; let maxTris = 0; const times = [];
      for (let f = 0; f < 120; f++) {
        if (f % 20 === 0) w.spawnGrenade('flash', w.leader, { x: w.leader.x - 3, y: 1, z: w.leader.z }, { x: 0, y: 0, z: 0 }, 0.05);
        w.input.fire = f % 2 === 0;
        w.leader.hp = 100;
        const t = performance.now();
        await new Promise((r) => requestAnimationFrame(r));
        times.push(performance.now() - t);
        const i = B.renderInfo(); maxCalls = Math.max(maxCalls, i.calls); maxTris = Math.max(maxTris, i.triangles);
      }
      times.sort((a, b) => a - b);
      let sceneTris = 0;
      B.app.renderer.scene.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && o.visible) { const g = o.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / 3; sceneTris += n * (o.isInstancedMesh ? o.count : 1); } });
      maxTris = Math.max(maxTris, sceneTris);
      return { maxCalls, maxTris, p50: times[60], p95: times[114] };
    });
    check('최악 장면 draw call ≤ 250 (PC 예산)', perf.maxCalls <= 250, `최대 ${perf.maxCalls}`);
    check('최악 장면 삼각형 ≤ 40만 (PC 예산)', perf.maxTris <= 400000, `최대 ${perf.maxTris}`);
    console.log(`      (참고: 소프트웨어 렌더러 프레임 시간 p50 ${perf.p50.toFixed(1)}ms / p95 ${perf.p95.toFixed(1)}ms — 실기기 FPS 아님)`);

    // 메모리: 게임 시간 10분 연속 진행
    const mem = await page.evaluate(async () => {
      const B = window.__breach;
      B.start('m5');
      window.gc && window.gc();
      await new Promise((r) => setTimeout(r, 100));
      const m0 = performance.memory.usedJSHeapSize;
      let rounds = 0;
      B.app.externalSim = true;
      const { makeBot } = await import('/tests/bot.js');
      while (rounds < 600) { // 1라운드 = 게임 1초
        if (!B.world || B.world.result || B.state !== 'play') { B.start(['m2', 'm3', 'm4', 'm5'][rounds % 4]); }
        const tick = makeBot(B.world);
        for (let k = 0; k < 60 && !B.world.result; k++) { tick(B.world); B.world.step(); }
        await new Promise((r) => requestAnimationFrame(r));
        rounds++;
      }
      B.app.externalSim = false;
      window.gc && window.gc();
      await new Promise((r) => setTimeout(r, 300));
      window.gc && window.gc();
      const m1 = performance.memory.usedJSHeapSize;
      return { m0, m1 };
    });
    const grow = (mem.m1 - mem.m0) / mem.m0;
    check('10분(게임 시간) 연속 진행 후 JS 힙 증가 50% 미만', grow < 0.5, `${(mem.m0 / 1e6).toFixed(1)}MB → ${(mem.m1 / 1e6).toFixed(1)}MB (${(grow * 100).toFixed(0)}%)`);

    check('PC: 콘솔 에러·경고 0건', errors.length === 0, errors.slice(0, 5).join(' | '));
    await ctx.close();
  }

  // ───────── 모바일(가로 844×390, 터치) ─────────
  {
    const errors = [];
    const { ctx, page } = await newPage(browser, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, base, errors);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/m-menu.png` });
    await page.tap('#btn-play');
    await page.tap('.mission-card[data-id="m1"]');
    await page.waitForSelector('#screen-briefing:not(.hidden)');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/m-briefing.png` });
    await page.tap('#btn-brief-start');
    await page.waitForFunction(() => window.__breach.state === 'play');
    // 버튼이 모두 보이게: GO 대기 명령과 상호작용 대상 만들기
    await page.evaluate(() => { const w = __breach.world; w.command('all', { type: 'stack', door: 0 }, true); });
    await sleep(400);
    await page.evaluate(() => {
      // 상호작용 버튼 강제 표시(위치·크기 검사용)
      document.querySelector('[data-btn="interact"]').classList.remove('hidden');
      document.querySelector('[data-btn="go"]').classList.remove('hidden');
    });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/m-play.png` });
    const rects = await page.$$eval('#touch .tbtn', (els) => els.filter((e) => !e.classList.contains('hidden')).map((e) => { const r = e.getBoundingClientRect(); return { id: e.id, x: r.x, y: r.y, w: r.width, h: r.height }; }));
    const inside = rects.every((r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= 844 && r.y + r.h <= 390);
    const big = rects.every((r) => r.w >= 56 && r.h >= 56);
    let overlap = [];
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]; const b = rects[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlap.push(`${a.id}×${b.id}`);
    }
    // HUD 정보 영역(미니맵·분대 패널)과도 겹치지 않아야 함
    const hudR = await page.$$eval('#mapbox, #squad-panel, #obj', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.id, x: r.x, y: r.y, w: r.width, h: r.height }; }));
    for (const a of rects) for (const b of hudR) if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlap.push(`${a.id}×${b.id}`);
    check('모바일: 버튼 전부 화면 안', inside, rects.filter((r) => !(r.x >= 0 && r.y >= 0 && r.x + r.w <= 844 && r.y + r.h <= 390)).map((r) => r.id).join(','));
    check('모바일: 버튼 전부 56px 이상', big, rects.filter((r) => r.w < 56 || r.h < 56).map((r) => `${r.id} ${r.w}×${r.h}`).join(','));
    check('모바일: 버튼끼리·HUD와 겹치지 않음', overlap.length === 0, overlap.join(', '));

    // 멀티터치: 조이스틱 + 시점 드래그 동시
    const cdp = await ctx.newCDPSession(page);
    const before = await page.evaluate(() => ({ x: __breach.world.leader.x, z: __breach.world.leader.z, yaw: __breach.world.leader.yaw }));
    const tp = (pts) => pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 5, radiusY: 5, force: 1 }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp([[150, 300], [560, 200]]) });
    for (let k = 1; k <= 12; k++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp([[150, 300 - Math.min(50, k * 8)], [560 + k * 6, 200]]) });
      await sleep(50);
    }
    const mid = await page.evaluate(() => ({ mz: __breach.app.input.touchMove.z }));
    await sleep(300);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const after = await page.evaluate(() => ({ x: __breach.world.leader.x, z: __breach.world.leader.z, yaw: __breach.world.leader.yaw }));
    const moved = Math.hypot(after.x - before.x, after.z - before.z);
    const dyaw = Math.abs(Math.atan2(Math.sin(after.yaw - before.yaw), Math.cos(after.yaw - before.yaw)));
    check('모바일: 조이스틱 이동과 시점 드래그를 동시에', moved > 0.3 && dyaw > 0.05 && mid.mz > 0.5, `이동 ${moved.toFixed(2)}m, 회전 ${dyaw.toFixed(2)}rad`);

    // 명령 휠(터치)
    // 실제 손가락처럼 버튼 중심에 터치 이벤트를 보낸다
    const cb = await page.$eval('#tb-cmd', (e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp([cb]) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(150);
    const wItems = await page.$$eval('#wheel .wheel-item', (els) => els.length);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/m-wheel.png` });
    check('모바일: [명령] → 휠 열림', wItems >= 2, `${wItems}개`);
    const cl = await page.$eval('#wheel [data-act="close"]', (e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp([cl]) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(100);
    check('모바일: 휠 [닫기]로 닫힘', await page.isHidden('#wheel'));

    // 세로 전환 → 자동 일시정지 + 안내
    await page.setViewportSize({ width: 390, height: 844 });
    await sleep(300);
    const st = await page.evaluate(() => __breach.state);
    check('모바일: 세로로 돌리면 자동 일시정지 + 안내', st === 'pause' && await page.isVisible('#rotate-notice'));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/m-portrait.png` });
    await page.setViewportSize({ width: 844, height: 390 });
    await sleep(600);
    const rn = await page.evaluate(() => [document.getElementById('rotate-notice').className, innerWidth, innerHeight]);
    check('모바일: 가로로 돌아오면 안내가 사라진다', await page.isHidden('#rotate-notice'), JSON.stringify(rn));

    // 모바일 최악 장면 draw call
    await page.evaluate(() => __breach.start('m5'));
    const mperf = await page.evaluate(async () => {
      const B = window.__breach; const w = B.world;
      w.doors.forEach((d) => { d.open = true; d.amt = 1; });
      w.leader.x = 17 * 1.2; w.leader.z = 7.5 * 1.2; w.leader.yaw = Math.PI / 2;
      let maxCalls = 0; let maxTris = 0;
      for (let f = 0; f < 3; f++) await new Promise((r) => requestAnimationFrame(r));
      let sceneTris = 0;
      B.app.renderer.scene.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && o.visible) { const g = o.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / 3; sceneTris += n * (o.isInstancedMesh ? o.count : 1); } });
      maxTris = Math.max(maxTris, sceneTris);
      for (let f = 0; f < 60; f++) { if (f % 20 === 0) w.spawnGrenade('flash', w.leader, { x: w.leader.x - 3, y: 1, z: w.leader.z }, { x: 0, y: 0, z: 0 }, 0.05); w.leader.hp = 100; w.input.fire = f % 2 === 0; await new Promise((r) => requestAnimationFrame(r)); const i = B.renderInfo(); maxCalls = Math.max(maxCalls, i.calls); maxTris = Math.max(maxTris, i.triangles); }
      return { maxCalls, maxTris, q: B.app.renderer.qualityName, pr: B.app.renderer.renderer.getPixelRatio() };
    });
    check('모바일 최악 장면 draw call ≤ 150', mperf.maxCalls <= 150, `최대 ${mperf.maxCalls} (품질 ${mperf.q}, 픽셀 배율 ${mperf.pr})`);
    check('모바일 최악 장면 삼각형 ≤ 15만', mperf.maxTris <= 150000, `최대 ${mperf.maxTris}`);

    check('모바일: 콘솔 에러·경고 0건', errors.length === 0, errors.slice(0, 5).join(' | '));
    await ctx.close();
  }

  await browser.close();
  srv.close();
  const fail = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fail.length}/${results.length} 통과`);
  process.exit(fail.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
