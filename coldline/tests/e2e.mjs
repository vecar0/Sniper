// 실제 브라우저 검수(Playwright + Chromium). 실행: (정적 서버를 8765에 띄운 뒤) node tests/e2e.mjs
// 기획서 ⑥ "브라우저 실행" 항목 + 콘솔 에러 0건.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let playwright;
// 이 환경에 미리 깔린 전역 Playwright(브라우저 포함)를 먼저 쓰고, 없으면 로컬 설치본
try { playwright = require(execSync('npm root -g').toString().trim() + '/playwright'); } catch { playwright = require('playwright'); }
const URL = process.env.URL || 'http://localhost:8765/?test';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

const results = [];
const errors = [];
async function check(name, fn) {
  try { await fn(); results.push(['ok', name]); console.log('ok  ', name); }
  catch (e) { results.push(['FAIL', name, e.message]); console.log('FAIL', name, '—', e.message); }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 720 }, hasTouch: !!opts.touch, isMobile: !!opts.touch, deviceScaleFactor: opts.touch ? 2 : 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${opts.label || 'pc'}] ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${opts.label || 'pc'}] pageerror: ${e.message}`));
  await page.goto(URL);
  await page.waitForFunction(() => window.__ln && document.querySelector('#loading.done'), null, { timeout: 90000 });
  return { ctx, page };
}
const W = (page, fn, arg) => page.evaluate(fn, arg);

const browser = await playwright.chromium.launch({ args: ARGS });

// ── PC ──────────────────────────────────────────────────
{
  const { page } = await open(browser);
  await check('메인 메뉴 → 시작 → 3D 장면과 HUD가 보인다', async () => {
    assert(await page.isVisible('.menu-main'), '메인 메뉴 없음');
    await page.click('[data-a=start]');
    await sleep(1500);
    assert(await W(page, () => __ln.app.state) === 'play', '플레이 상태 아님');
    assert(!(await page.$eval('#hud', (e) => e.classList.contains('hidden'))), 'HUD 숨김');
    for (const s of ['.hud-top', '.hud-radar', '.hud-hp', '.hud-weapon', '.cross i']) assert(await page.isVisible(s), `${s} 안 보임`);
    // 화면이 검지 않다(가운데 영역 평균 밝기)
    const buf = await page.screenshot({ clip: { x: 340, y: 160, width: 600, height: 300 } });
    assert(buf.length > 20000, '렌더 결과가 비어 있음');
    const st = await W(page, () => __ln.stats());
    assert(st.calls > 20 && st.calls <= 250, `draw call ${st.calls}`);
    assert(st.tris < 500000, `삼각형 ${st.tris}`);
  });

  await check('클릭하면 포인터 잠금, 마우스로 시점이 돈다, Esc → 일시정지 → 이어하기', async () => {
    await page.mouse.click(640, 360);
    await page.waitForFunction(() => document.pointerLockElement != null, null, { timeout: 5000 });
    const y0 = await W(page, () => __ln.world.player.yaw);
    for (let i = 0; i < 8; i++) { await W(page, () => window.dispatchEvent(new MouseEvent('mousemove', { movementX: 30, movementY: 0 }))); await sleep(40); }
    await page.waitForFunction((y0) => Math.abs(__ln.world.player.yaw - y0) > 0.05, y0, { timeout: 8000 }).catch(() => {});
    const y1 = await W(page, () => __ln.world.player.yaw);
    assert(Math.abs(y1 - y0) > 0.05, `시점 변화 ${(y1 - y0).toFixed(3)}`);
    await W(page, () => document.exitPointerLock());
    await sleep(500);
    assert(await W(page, () => __ln.app.state) === 'pause', '일시정지 안 됨');
    assert(await page.isVisible('[data-a=resume]'), '일시정지 메뉴 없음');
    await page.click('[data-a=resume]');
    await sleep(500);
    assert(await W(page, () => __ln.app.state) === 'play', '이어하기 실패');
  });

  await check('WASD 이동, 엄폐물을 통과하지 못함, 계단으로 발전기 플랫폼에 오른다', async () => {
    // 소프트웨어 렌더러는 프레임이 느려 게임 시간이 실제보다 덜 흐른다 → 게임 시간으로 잰다
    const move = async (setup, key, ms) => {
      await W(page, setup);
      const t0 = await W(page, () => __ln.world.time);
      await page.keyboard.down(key);
      await page.waitForFunction(([t0, s]) => __ln.world.time - t0 >= s, [t0, ms / 1000], { timeout: 60000 });
      await page.keyboard.up(key); await sleep(200);
      return W(page, () => { const p = __ln.world.player; return { x: p.x, y: p.y, z: p.z }; });
    };
    const tp = (x, z, yaw) => `(() => { const p = __ln.world.player; p.x = p.px = ${x}; p.z = p.pz = ${z}; p.y = p.py = 0; p.vx = p.vz = 0; p.yaw = ${yaw}; p.pitch = 0; })()`;
    const a = await move(tp(-14, 4, 0), 'KeyW', 1500);
    assert(a.z < 1.5, `앞으로 안 감 z=${a.z.toFixed(2)}`);
    const b = await move(tp(11, 16, 0), 'KeyW', 2500);
    assert(b.z > 12.45 + 0.3, `컨테이너 통과 z=${b.z.toFixed(2)}`);
    const c = await move(tp(5.4, -10, -Math.PI / 2), 'KeyW', 3500);
    assert(c.y > 3.9, `헬리패드에 못 오름 y=${c.y.toFixed(2)}`);
  });

  await check('사격: 섬광·탄창 감소·소리 이벤트, 적에 맞으면 명중 표시', async () => {
    await W(page, () => {
      const w = __ln.world, p = w.player;
      p.x = p.px = 0; p.z = p.pz = 20; p.y = p.py = 0; p.yaw = 0; p.pitch = 0;
      const e = w.spawnEnemy('enforcer', 0, 0, 15); e.stun = 1e9; e.yaw = Math.PI;
      p.pitch = Math.atan2(1.3 - p.eye, 5);
      window.__hits = 0; const orig = __ln.app.hud.hitmark.bind(__ln.app.hud); __ln.app.hud.hitmark = (k) => { window.__hits++; orig(k); };
    });
    const mag0 = await W(page, () => __ln.world.player.ammo.pistol.mag);
    await page.mouse.move(640, 360);
    if (!(await W(page, () => __ln.app.input.locked))) { await page.mouse.click(640, 360); await page.waitForFunction(() => __ln.app.input.locked, null, { timeout: 3000 }).catch(() => {}); }
    // 잠금 클릭 때 마우스가 버튼 자리에서 화면 가운데로 옮겨 오며 시점이 돌 수 있다 → 움직임이 다 들어온 뒤 다시 겨눈다
    await sleep(400);
    await W(page, () => { const p = __ln.world.player; p.yaw = 0; p.pitch = Math.atan2(1.3 - p.eye, 5); __ln.app.input.lookDX = __ln.app.input.lookDY = 0; });
    await page.mouse.down(); await sleep(1100); await page.mouse.up(); await sleep(300);
    const r = await W(page, () => ({ mag: __ln.world.player.ammo.pistol.mag, shots: __ln.world.stats.shots, hits: window.__hits }));
    assert(r.mag < mag0, `탄창 그대로 ${mag0}→${r.mag}`);
    assert(r.hits > 0, '명중 표시 없음');
  });

  await check('웨이브 정리 → 카드 3장 중 키 1로 고르기 → 보급 구매 → Enter로 닫기 → 새 무기로 쏘기', async () => {
    await W(page, () => { const w = __ln.world; for (const e of w.enemies) e.alive = false; w.enemies = []; w.state = 'wave'; w.wave = 2; w.parT = 10; w.spawn = { t: 9, total: 0, left: 0, stairsT: 1e9, elevT: 1e9, dropT: 1e9, boss: false, bossSpawned: true, mechs: 0, mechTotal: 0, mechNext: 1 }; });
    await page.waitForSelector('.cards .pick', { timeout: 8000 });
    assert((await page.$$('.cards .pick')).length === 3, '카드가 3장이 아님');
    // 첫 장을 무기 카드로 바꿔 끼워 시험(무작위 제시와 무관하게)
    await W(page, () => { __ln.world.offer[0] = 'get:rifle'; });
    await page.keyboard.press('Digit1');
    await page.waitForSelector('.pick.taken', { timeout: 5000 });
    // 보급: 크레딧을 주고 체력 회복을 산 뒤 Enter로 닫는다
    await W(page, () => { __ln.world.credits = 5000; __ln.world.player.hp = 40; __ln.app.menus.renderSupply(__ln.world); });
    await page.click('.supply [data-id=heal]');
    assert(await W(page, () => __ln.world.player.hp) > 40, '보급 구매 실패');
    await page.keyboard.press('Enter');
    const closed = await page.waitForFunction(() => !document.querySelector('.cards'), null, { timeout: 5000 }).then(() => true).catch(() => false);
    assert(closed, `카드 화면이 안 닫힘 ${JSON.stringify(await W(page, () => ({ app: __ln.app.state, st: __ln.world.state, offer: __ln.world.offer, cards: !!document.querySelector('.cards') })))}`);
    const st = await W(page, () => ({ state: __ln.world.state, owned: !!__ln.world.player.owned.rifle, weapon: __ln.world.player.weapon }));
    assert(st.state === 'intermission' && st.owned && st.weapon === 'rifle', `카드 적용 실패 ${JSON.stringify(st)}`);
    // 새 무기로 쏠 수 있는지: 마우스 입력 경로는 위 '사격' 검사가 확인하므로 여기선 시뮬레이션을 직접 몇 틱 돌린다
    // (소프트웨어 렌더러에선 프레임이 느려 실시간 마우스 누름으로는 쏘는 틱 수가 들쭉날쭉하다)
    const fired = await W(page, () => {
      const app = __ln.app, w = __ln.world; app.externalSim = true;
      const m0 = w.player.ammo.rifle.mag;
      for (let i = 0; i < 80; i++) { w.input.fire = true; w.step(1 / 60); }   // 교체 동작(0.62초) 뒤에 쏜다
      w.input.fire = false; app.externalSim = false;
      return m0 - w.player.ammo.rifle.mag;
    });
    assert(fired >= 3, `소총 발사 ${fired}발`);
  });

  await check('피격 방향, 처치 점수·연속 배수, 레이더, 보스 체력 바', async () => {
    await W(page, () => { const w = __ln.world; w.state = 'wave'; w.hurtPlayer(5, { x: w.player.x + 8, z: w.player.z }, 'test'); });
    const dirOk = await page.waitForSelector('.dir', { timeout: 10000 }).then(() => true).catch(() => false);
    assert(dirOk, '피격 방향 표시 없음');
    await W(page, () => { window.__kp = 0; const h = __ln.app.hud, o = h.killPop.bind(h); h.killPop = (ev) => { window.__kp++; o(ev); }; const w = __ln.world; for (let i = 0; i < 2; i++) { const e = w.spawnEnemy('reaper', 3, 0, 3); w.damageEnemy(e, 1e6, { kind: 'weak' }); } });
    const kp = await page.waitForFunction(() => window.__kp >= 2 && document.querySelector('.mult.on'), null, { timeout: 10000 }).then(() => true).catch(() => false);
    assert(kp, `처치 점수·연속 배수 표시 없음 ${await W(page, () => window.__kp)}`);
    const radar = await page.$eval('.hud-radar canvas', (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
    assert(radar > 500, '레이더가 비어 있음');
    await W(page, () => { const w = __ln.world; w.player.hp = 1e6; w.wave = 4; w.startWave(); w.spawn.t = 3.5; });
    await page.waitForFunction(() => !document.querySelector('.hud-boss').classList.contains('hidden'), null, { timeout: 15000 });
  });

  await check('탭 전환(화면 숨김)이면 자동 일시정지', async () => {
    await W(page, () => { if (__ln.app.state !== 'play') __ln.app.resume(); });
    await W(page, () => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(300);
    assert(await W(page, () => __ln.app.state) === 'pause', '일시정지 안 됨');
    await W(page, () => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); });
  });

  await check('게임 오버 → 다시 하기 5번 반복해도 지오메트리·텍스처 수가 늘지 않는다', async () => {
    const counts = [];
    for (let i = 0; i < 6; i++) {
      // 이미 쓰러져 결과를 기다리는 중이면 상태를 되돌리지 않는다(되돌리면 결과 화면 타이머가 건너뛴다)
      await W(page, () => { if (__ln.app.state !== 'over') { __ln.app.state = 'play'; __ln.world.hurtPlayer(1e9, null, 'test', true); } });
      const shown = await page.waitForSelector('[data-a=retry]', { timeout: 30000 })   // 소프트웨어 렌더러에선 프레임이 느려 결과 화면까지 수 초~십수 초.then(() => true).catch(() => false);
      assert(shown, `다시 하기 버튼 없음 (${i}) ${JSON.stringify(await W(page, () => ({ app: __ln.app.state, w: __ln.world.state, alive: __ln.world.player.alive, hp: __ln.world.player.hp, menu: __ln.app.menus.current, body: document.body.className, ui: document.getElementById('ui').innerHTML.slice(0, 80) })))}`);
      await page.click('[data-a=retry]');
      await sleep(1200);
      await W(page, () => { const w = __ln.world; w.input.ready = true; });
      await sleep(1500);
      await W(page, () => { const w = __ln.world; for (let k = 0; k < 6; k++) { const e = w.spawnEnemy(['reaper', 'enforcer', 'leech', 'drone', 'mech', 'reaper'][k], k * 2 - 5, k === 3 ? 3 : 0, -12, 't', { target: 'player', slot: 0, alt: 2 }); w.damageEnemy(e, 1e6, {}); } });
      await sleep(1500);
      counts.push(await W(page, () => { const s = __ln.stats(); return [s.geos, s.tex]; }));
    }
    const [g1, t1] = counts[1], [g5, t5] = counts[counts.length - 1];
    assert(g5 <= g1 + 4 && t5 <= t1 + 2, `늘어남 ${JSON.stringify(counts)}`);
  });

  await check('설정: 감도·시야각 변경이 저장되고 다시 열어도 유지', async () => {
    await W(page, () => __ln.app.toMenu());
    await page.click('[data-a=settings]');
    await page.$eval('input[data-k=fov]', (r) => { r.value = '104'; r.dispatchEvent(new Event('input')); });
    await page.click('[data-a=back]');
    await page.reload();
    await page.waitForFunction(() => window.__ln && document.querySelector('#loading.done'), null, { timeout: 90000 });
    assert(await W(page, () => __ln.app.settings.fov) === 104, '설정이 저장되지 않음');
  });
  await page.context().close();
}

// ── 모바일(가로 844×390, 터치) ─────────────────────────
{
  const { page } = await open(browser, { touch: true, viewport: { width: 844, height: 390 }, label: 'mobile' });
  const touch = (sel, type, x, y, id = 1) => W(page, ([sel, type, x, y, id]) => {
    const el = document.querySelector(sel);
    const t = new Touch({ identifier: id, target: el, clientX: x, clientY: y });
    const ev = new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], targetTouches: type === 'touchend' ? [] : [t], bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
  }, [sel, type, x, y, id]);
  await check('모바일: 시작하면 터치 버튼이 보이고 HUD끼리·버튼과 겹치지 않는다', async () => {
    await page.click('[data-a=start]');
    await sleep(1500);
    assert(await page.isVisible('#touch .tbtn.fire'), '발사 버튼 없음');
    const rects = await W(page, () => {
      const r = (s) => { const e = document.querySelector(s); if (!e || e.offsetParent === null && getComputedStyle(e).position !== 'fixed') return null; const b = e.getBoundingClientRect(); return b.width ? { s, x: b.left, y: b.top, w: b.width, h: b.height } : null; };
      return { hud: ['.hud-radar', '.hud-top', '.hud-tr', '.hud-hp', '.hud-weapon'].map(r).filter(Boolean), btn: [...document.querySelectorAll('#touch .tbtn:not(.hidden)')].map((e) => { const b = e.getBoundingClientRect(); return { s: e.dataset.a, x: b.left, y: b.top, w: b.width, h: b.height }; }) };
    });
    const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    for (let i = 0; i < rects.hud.length; i++) for (let j = i + 1; j < rects.hud.length; j++) assert(!hit(rects.hud[i], rects.hud[j]), `${rects.hud[i].s} ↔ ${rects.hud[j].s} 겹침`);
    for (const b of rects.btn) for (const h of rects.hud) assert(!hit(b, h), `버튼 ${b.s} ↔ ${h.s} 겹침`);
    for (let i = 0; i < rects.btn.length; i++) for (let j = i + 1; j < rects.btn.length; j++) assert(!hit(rects.btn[i], rects.btn[j]), `버튼 ${rects.btn[i].s} ↔ ${rects.btn[j].s} 겹침`);
  });
  await check('모바일: 왼쪽 조이스틱 이동 · 오른쪽 드래그 시점 · 발사 버튼', async () => {
    await W(page, () => { const p = __ln.world.player; p.x = p.px = -14; p.z = p.pz = 4; p.yaw = 0; });
    const z0 = await W(page, () => __ln.world.player.z);
    await touch('#touch .zone.l', 'touchstart', 150, 260, 1);
    for (let i = 1; i <= 5; i++) { await touch('#touch', 'touchmove', 150, 260 - i * 12, 1); await sleep(30); }
    const t0 = await W(page, () => __ln.world.time);
    await page.waitForFunction((t0) => __ln.world.time - t0 >= 1.2, t0, { timeout: 60000 });
    await touch('#touch', 'touchend', 150, 200, 1);
    const z1 = await W(page, () => __ln.world.player.z);
    assert(z0 - z1 > 1.5, `조이스틱 이동 ${(z0 - z1).toFixed(2)}`);
    const y0 = await W(page, () => __ln.world.player.yaw);
    await touch('#touch .zone.r', 'touchstart', 600, 200, 2);
    for (let i = 1; i <= 6; i++) { await touch('#touch', 'touchmove', 600 + i * 15, 200, 2); await sleep(40); }
    await touch('#touch', 'touchend', 690, 200, 2);
    await page.waitForFunction((y0) => Math.abs(__ln.world.player.yaw - y0) > 0.1, y0, { timeout: 15000 }).catch(() => {});
    const y1 = await W(page, () => __ln.world.player.yaw);
    assert(Math.abs(y1 - y0) > 0.1, `시점 변화 ${(y1 - y0).toFixed(3)}`);
    const s0 = await W(page, () => __ln.world.stats.shots);
    const fb = await page.$eval('#touch .tbtn.fire', (e) => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
    await touch('#touch .tbtn.fire', 'touchstart', fb.x, fb.y, 3);
    await page.waitForFunction((s0) => __ln.world.stats.shots > s0, s0, { timeout: 20000 }).catch(() => {});
    await touch('#touch', 'touchend', fb.x, fb.y, 3);
    assert(await W(page, () => __ln.world.stats.shots) > s0, '발사 버튼으로 안 쏴짐');
  });
  await page.context().close();
}

await browser.close();
const ignorable = (e) => /GPU stall due to ReadPixels|GL_CLOSE_PATH_NV|Automatic fallback to software WebGL/i.test(e);
const real = errors.filter((e) => !ignorable(e));
results.push([real.length === 0 ? 'ok' : 'FAIL', `콘솔 에러·경고 0건 (${real.length})`]);
console.log(real.length === 0 ? 'ok  ' : 'FAIL', `콘솔 에러·경고 0건 (${real.length})`);
for (const e of [...new Set(real)].slice(0, 15)) console.log('     ', e);
const fails = results.filter((r) => r[0] !== 'ok').length;
console.log(`\n${results.length - fails}/${results.length} 통과`);
process.exit(fails ? 1 : 0);
