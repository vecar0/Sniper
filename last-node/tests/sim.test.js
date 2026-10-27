// 기획서 ⑥ 완료 기준 → headless 테스트(브라우저 없이 시뮬레이션만). 실행: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../js/sim/world.js';
import { enemyParts } from '../js/sim/enemies.js';
import { ENEMIES, WAVES, CORE, PLAYER, ECONOMY, WEAPONS, EMP } from '../js/config/balance.js';
import { SPAWNS } from '../js/config/map.js';
import { load, save, recordRun, sanitize, SAVE_KEY } from '../js/core/save.js';
import { runGame, Bot } from './bot.js';

const DT = 1 / 60;
const run = (w, sec, fn) => { for (let t = 0; t < sec; t += DT) { if (fn) fn(w, t); w.step(DT); } };
const events = (w, sec, fn) => { const out = []; for (let t = 0; t < sec; t += DT) { if (fn) fn(w, t); w.step(DT); out.push(...w.events); w.events.length = 0; } return out; };
// 적만 따로 시험할 때: 웨이브 진행·승패 판정 끄기
function sandbox(seed = 1) {
  const w = new World({ seed });
  w.noEnd = true; w.state = 'wave'; w.wave = 1;
  w.spawn = { t: 0, total: 0, left: 0, stairsT: 1e9, elevT: 1e9, dropT: 1e9, boss: false, bossSpawned: true, mechs: 0, mechTotal: 0, mechNext: 1 };
  return w;
}
const put = (w, x, z, y = 0) => { const p = w.player; p.x = p.px = x; p.z = p.pz = z; p.y = p.py = y; p.vx = p.vy = p.vz = 0; w.updatePlayerField(true); };

// ── 시작 상태 ───────────────────────────────────────────
test('시작: 체력 100, 코어 1500, 크레딧 0, 권총 14/∞, EMP 1, 웨이브 1로 시작', () => {
  const w = new World({ seed: 1 });
  const p = w.player;
  assert.equal(p.hp, 100); assert.equal(w.core.hp, 1500); assert.equal(w.credits, 0);
  assert.equal(p.weapon, 'pistol'); assert.equal(p.ammo.pistol.mag, 14); assert.equal(p.ammo.pistol.reserve, Infinity);
  assert.equal(p.emp, 1);
  w.input.ready = true; w.step(DT);
  assert.equal(w.wave, 1); assert.equal(w.state, 'wave');
});

// ── 웨이브 구성 ─────────────────────────────────────────
test('웨이브 w의 적 수 = 10 + 4w, 동시 생존 20 이하, 정해진 입구에서만 등장', () => {
  const w = new World({ seed: 3 });
  w.player.hp = 1e9; w.core.hp = w.core.max = 1e9;
  const seen = { 1: 0, 2: 0, 3: 0, 4: 0 }; let maxAlive = 0;
  const sources = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() };
  while (w.wave <= 4) {
    w.input.ready = true;
    w.step(DT);
    for (const e of w.events) if (e.t === 'spawn' && e.type !== 'boss') { seen[w.wave]++; sources[w.wave].add(e.source); }
    w.events.length = 0;
    maxAlive = Math.max(maxAlive, w.enemies.filter((e) => e.type !== 'boss').length);
    // 적을 빨리 정리(웨이브 진행용)
    for (const e of w.enemies) if (e.alive && w.spawn && w.spawn.t > 4) w.damageEnemy(e, 1e6, {});
    if (w.time > 900) break;
  }
  for (const k of [1, 2, 3, 4]) assert.equal(seen[k], WAVES.count(k), `웨이브 ${k}`);
  assert.ok(maxAlive <= 20, `동시 생존 ${maxAlive}`);
  assert.deepEqual([...sources[1]].sort(), ['stairs']);
  assert.ok(!sources[1].has('elevator') && sources[2].has('elevator'), '엘리베이터는 W2부터');
  assert.ok(!sources[3].has('dropship') && sources[4].has('dropship'), '수송기는 W4부터');
  assert.ok(sources[3].has('sky') || sources[4].has('sky'), '드론은 W3부터 하늘에서');
  assert.ok(!sources[2].has('sky'), 'W2에는 드론 없음');
});

// ── 적 AI ───────────────────────────────────────────────
test('리퍼: 컨테이너를 돌아 플레이어에게 와서 근접 피해를 준다', () => {
  const w = sandbox(2);
  put(w, 11, 14);                         // 컨테이너(8~14.1, 10~12.45) 남쪽
  w.spawnEnemy('reaper', 11, 0, 7);       // 북쪽
  const ev = events(w, 10);
  assert.ok(ev.some((e) => e.t === 'playerHurt' && e.kind === 'blade'), '칼날 피해 없음');
  assert.ok(w.player.hp < 100);
});

test('리치: 플레이어를 무시하고 코어에 접속해 초당 18씩 흡수, 맞으면 0.4초 멈춤', () => {
  const w = sandbox(4);
  put(w, -15, -2);
  const e = w.spawnEnemy('leech', SPAWNS.stairs.x, 0, SPAWNS.stairs.z);
  let t = 0;
  while (e.state !== 'attach' && t < 20) { w.step(DT); t += DT; }
  assert.equal(e.state, 'attach', '20초 안에 접속 못 함');
  assert.equal(w.player.hp, 100, '플레이어는 공격하지 않는다');
  const before = w.core.hp;
  run(w, 1);
  assert.ok(Math.abs(before - w.core.hp - ENEMIES.leech.drain) < 0.6, `1초 흡수량 ${before - w.core.hp}`);
  w.damageEnemy(e, 1, { kind: 'body', dir: { x: 1, z: 0 } });
  const h0 = w.core.hp;
  run(w, 0.3);
  assert.equal(w.core.hp, h0, '맞은 직후 0.4초는 흡수 멈춤');
});

test('집행관: 엄폐점으로 이동한 뒤 사격하고, 엄폐물 뒤의 플레이어는 맞지 않는다', () => {
  const w = sandbox(5);
  put(w, 0, 16);
  const e = w.spawnEnemy('enforcer', SPAWNS.stairs.x, 0, SPAWNS.stairs.z);
  const x0 = e.x, z0 = e.z;
  const ev = events(w, 12);
  assert.ok(Math.hypot(e.x - x0, e.z - z0) > 2, '엄폐점으로 이동하지 않음');
  assert.ok(ev.some((q) => q.t === 'enemyShot'), '사격하지 않음');
  // 엄폐: 컨테이너 뒤에 숨은 플레이어에게 쏜 탄은 벽에 막힌다
  const w2 = sandbox(6);
  put(w2, 11, 13.5);                       // 컨테이너 남쪽에 붙음
  w2.player.crouch = true; w2.player.h = PLAYER.crouchHeight;
  const s = w2.spawnEnemy('enforcer', 11, 0, 4); s.stun = 1e9; // AI는 멈추고 사격만 직접
  for (let i = 0; i < 30; i++) { w2.enemyShoot(s, { ...ENEMIES.enforcer, accuracy: 1 }); run(w2, 0.1, (ww) => { ww.player.crouch = true; ww.player.h = PLAYER.crouchHeight; }); }
  run(w2, 1);
  assert.equal(w2.player.hp, 100, '엄폐물 뒤인데 맞음');
  // 같은 사격, 엄폐 없음 → 맞는다
  const w3 = sandbox(6);
  put(w3, 11, 0);
  const s3 = w3.spawnEnemy('enforcer', 11, 0, -8); s3.stun = 1e9;
  for (let i = 0; i < 10; i++) { w3.enemyShoot(s3, { ...ENEMIES.enforcer, accuracy: 1 }); run(w3, 0.1); }
  run(w3, 1);
  assert.ok(w3.player.hp < 100, '열린 곳인데 안 맞음');
});

test('스웜 드론: 하나가 터지면 1.5m 안 드론도 연쇄 폭발', () => {
  const w = sandbox(7);
  const a = w.spawnEnemy('drone', 0, 6, 15, 'test', { target: 'player', slot: 0, alt: 3 });
  const b = w.spawnEnemy('drone', 1.0, 6, 15, 'test', { target: 'player', slot: 1, alt: 3 });
  const c = w.spawnEnemy('drone', 5, 6, 15, 'test', { target: 'player', slot: 2, alt: 3 });
  w.damageEnemy(a, 999, { kind: 'body' });
  assert.equal(a.alive, false); assert.equal(b.alive, false, '1m 옆 드론이 연쇄 폭발하지 않음'); assert.equal(c.alive, true, '5m 떨어진 드론까지 터짐');
});

test('메크: 정면 방패 ×0.3, 등 코어 ×2.5, EMP 맞으면 4초간 방패 꺼짐', () => {
  const w = sandbox(8);
  const m = w.spawnEnemy('mech', 0, 0, -12); m.yaw = 0; // −z(북쪽)을 봄
  const front = { x: 0, z: 1 };                         // 북쪽에서 남쪽으로 날아오는 탄 = 정면
  let hp = m.hp; w.damageEnemy(m, 100, { kind: 1, dir: front }); assert.ok(Math.abs(hp - m.hp - 30) < 1e-6, `정면 ${hp - m.hp}`);
  hp = m.hp; w.damageEnemy(m, 100, { kind: 1, dir: { x: 0, z: -1 } }); assert.ok(Math.abs(hp - m.hp - 100) < 1e-6, '뒤에서 맞으면 방패 없음');
  hp = m.hp; w.damageEnemy(m, 100, { kind: 'back', dir: { x: 0, z: -1 } }); assert.ok(Math.abs(hp - m.hp - 250) < 1e-6, `등 코어 ${hp - m.hp}`);
  w.empBlast(m.x, m.y + 1, m.z);
  assert.ok(m.shieldOff >= EMP.shieldOff - 1e-6 && m.stun > 0);
  hp = m.hp; w.damageEnemy(m, 100, { kind: 1, dir: front }); assert.ok(Math.abs(hp - m.hp - 100) < 1e-6, 'EMP 후에도 방패');
});

test('약점 ×2, 레일건이 일렬로 선 적 3기를 관통', () => {
  const w = sandbox(9);
  const e = w.spawnEnemy('enforcer', 0, 0, 0);
  const hp = e.hp; w.damageEnemy(e, 20, { kind: 'weak' }); assert.equal(hp - e.hp, 40);
  // 레일건: 플레이어 앞(−z)에 4기 일렬
  const w2 = sandbox(10);
  put(w2, 2, 26);
  const line = [0, 1, 2, 3].map((i) => { const q = w2.spawnEnemy('enforcer', 2, 0, 20 - i * 1.5); q.yaw = Math.PI; q.stun = 1e9; return q; });
  const p = w2.player; p.owned.rail = true; p.weapon = 'rail'; p.yaw = 0;
  const part = enemyParts(line[0])[1];
  p.pitch = Math.atan2(part.y - (p.y + p.eye), Math.hypot(part.x - p.x, part.z - p.z));
  p.ads = 1;
  w2.fireHitscan('rail', WEAPONS.rail, 240);
  const hits = w2.events.filter((q) => q.t === 'hit');
  assert.equal(hits.length, 3, `관통 ${hits.length}`);
  assert.equal(line[3].hp, line[3].maxHp, '4번째는 맞지 않는다');
});

test('EMP: 반경 5m 기계 적 2.5초 기절, 기절한 적 근접 처치 = 체력 +25', () => {
  const w = sandbox(11);
  put(w, 0, 16);
  const near = w.spawnEnemy('reaper', 0, 0, 14.5); near.yaw = 0;
  const far = w.spawnEnemy('reaper', 8, 0, 6);
  w.empBlast(0, 1, 13);
  assert.ok(Math.abs(near.stun - EMP.stun) < 1e-6); assert.equal(far.stun, 0);
  w.player.hp = 50; w.player.yaw = 0; w.player.pitch = 0;
  w.input.melee = true; w.step(DT);
  assert.equal(near.alive, false, '근접 처치 실패');
  assert.ok(w.player.hp >= 75, `회복 ${w.player.hp}`);
});

// ── 이동 ────────────────────────────────────────────────
test('대시: 2회 충전, 1.4초마다 1회 회복, 대시 중 피해 50%', () => {
  const w = sandbox(12);
  put(w, 0, 16);
  const p = w.player;
  w.input.dash = true; w.step(DT);
  assert.equal(p.dashCharges, 1);
  run(w, 0.25); w.input.dash = true; w.step(DT);
  assert.equal(p.dashCharges, 0);
  w.input.dash = true; w.step(DT);
  assert.equal(p.dashCharges, 0, '충전 없이 대시됨');
  run(w, 1.45); assert.equal(p.dashCharges, 1);
  w.input.dash = true; w.step(DT);
  const hp = p.hp; w.hurtPlayer(20, null, 'test', true); assert.equal(hp - p.hp, 10);
});

test('더블 점프로 블록 계단을 밟아 발전기 플랫폼(4m)에 오른다', () => {
  const w = sandbox(13);
  put(w, 21.25, 6.5);
  const p = w.player; p.yaw = 0; p.pitch = 0;
  let top = 0, lastJump = -1;
  run(w, 8, (ww, t) => {
    ww.input.moveZ = 1;
    if (p.grounded && t - lastJump > 0.2) { ww.input.jump = true; lastJump = t; }
    else if (!p.grounded && p.vy < 1 && p.airJumps > 0) ww.input.jump = true;
    top = Math.max(top, p.y);
  });
  assert.ok(top >= 3.99, `최고 높이 ${top.toFixed(2)}`);
});

test('발전기 플랫폼 위에서 동쪽으로 달려도 난간에 막혀 떨어지지 않는다', () => {
  const w = sandbox(30);
  put(w, 20, -5, 4);
  const p = w.player; p.yaw = -Math.PI / 2; // +x(동쪽)
  run(w, 3, (ww) => { ww.input.moveZ = 1; });
  assert.ok(p.y > 3.9 && p.x < 25, `x=${p.x.toFixed(2)} y=${p.y.toFixed(2)}`);
});

test('둘레 옹벽: 대시·더블 점프로 달려도 광장 밖으로 나가지 못한다', () => {
  for (const [x, z, yaw] of [[6.5, 24, Math.PI], [0, -20, 0], [24, 8, -Math.PI / 2], [-24, 22, Math.PI / 2]]) {
    const w = sandbox(14);
    put(w, x, z);
    const p = w.player; p.yaw = yaw; p.pitch = 0;
    let t0 = -1;
    run(w, 4, (ww, t) => { ww.input.moveZ = 1; if (p.grounded && t - t0 > 0.3) { ww.input.jump = true; ww.input.dash = true; t0 = t; } else if (!p.grounded && p.airJumps > 0 && p.vy < 0) ww.input.jump = true; });
    assert.ok(Math.abs(p.x) < 27.6 && Math.abs(p.z) < 27.6 && p.y > -0.5, `밖으로 나감 ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`);
  }
});

// ── 경제 ────────────────────────────────────────────────
test('처치 크레딧: 약점 +50%, 근접 +30%, 2연속 +10%, 5연속 +25%', () => {
  const w = sandbox(15);
  const k = (type, info) => { const e = w.spawnEnemy(type, 0, 0, -10); const c0 = w.credits; w.damageEnemy(e, 1e6, info); return w.credits - c0; };
  assert.equal(k('reaper', { kind: 'body' }), 50);
  w.comboT = 99; assert.equal(k('reaper', { kind: 'weak' }), 75);
  w.comboT = 99; assert.equal(k('enforcer', { kind: 'body', melee: true }), Math.round(80 * 1.3));
  w.comboT = 99; k('reaper', {});
  assert.equal(k('reaper', {}), Math.round(50 * 1.1), '2연속');
  k('reaper', {}); k('reaper', {});
  assert.equal(k('reaper', {}), Math.round(50 * 1.25), '5연속');
});

test('웨이브 정리 → 보너스(코어 무피해 +300) → 코어 +150 → 20초 정비 → 다음 웨이브', () => {
  const w = new World({ seed: 16 });
  w.core.hp = 1000;
  w.input.ready = true; w.step(DT);
  assert.equal(w.state, 'wave');
  let t = 0;
  const ev = [];
  while (w.state === 'wave' && t < 120) { for (const e of w.enemies) w.damageEnemy(e, 1e6, {}); w.step(DT); ev.push(...w.events); w.events.length = 0; t += DT; }
  assert.equal(w.state, 'intermission');
  const clear = ev.find((e) => e.t === 'waveClear');
  assert.equal(clear.bonus, ECONOMY.waveBonus(1)); assert.equal(clear.perfect, true);
  assert.equal(w.core.hp, 1000 + CORE.repairBetween);
  assert.ok(Math.abs(w.timer - WAVES.intermission) < 0.1);
  run(w, WAVES.intermission + 0.1);
  assert.equal(w.wave, 2); assert.equal(w.state, 'wave');
});

test('상점: 정비 중에만, 돈 부족하면 안 되고 크레딧은 음수가 되지 않음, 강화 3단계까지', () => {
  const w = new World({ seed: 17 });
  w.credits = 500;
  assert.equal(w.buy('shotgun').reason, 'poor');
  assert.equal(w.credits, 500);
  w.credits = 100000;
  assert.ok(w.buy('shotgun').ok);
  assert.equal(w.player.owned.shotgun, true);
  for (let i = 0; i < 3; i++) assert.ok(w.buy('up:shotgun').ok, `강화 ${i + 1}`);
  assert.equal(w.buy('up:shotgun').reason, 'max');
  assert.equal(w.player.levels.shotgun, 3);
  w.input.ready = true; w.step(DT);
  assert.equal(w.state, 'wave');
  assert.equal(w.buy('armor').reason, 'closed');
  assert.ok(w.credits >= 0);
  // 단말에서만 열린다
  const w2 = new World({ seed: 17 });
  put(w2, 0, 0); w2.input.interact = true; w2.step(DT); assert.equal(w2.shopOpen, false, '멀리서 열림');
  put(w2, 0, 12.6); w2.input.interact = true; w2.step(DT); assert.equal(w2.shopOpen, true, '단말 앞에서 안 열림');
});

test('포탑: 사면 자리에 생기고 리치·드론을 우선 쏜다', () => {
  const w = new World({ seed: 18 });
  w.credits = 10000;
  assert.ok(w.buy('turret').ok);
  assert.equal(w.turrets.filter((t) => t.built).length, 1);
  w.noEnd = true; w.state = 'wave'; w.wave = 3; w.spawn = { t: 0, total: 0, left: 0, stairsT: 1e9, elevT: 1e9, dropT: 1e9, mechs: 0, mechNext: 1 };
  put(w, -20, 20);
  const t0 = w.turrets.find((t) => t.built);
  const r = w.spawnEnemy('reaper', t0.x + 3, 0, t0.z + 1); r.stun = 99;
  const l = w.spawnEnemy('leech', t0.x + 6, 0, t0.z - 3); l.stun = 99;
  run(w, 1);
  assert.ok(l.hp < l.maxHp, '리치를 쏘지 않음');
  assert.equal(r.hp, r.maxHp, '리치보다 리퍼를 먼저 쐈음');
});

test('코어 실드가 먼저 피해를 받고, 웨이브 시작 때 가득 찬다', () => {
  const w = new World({ seed: 19 });
  w.credits = 10000;
  assert.ok(w.buy('coreShield').ok);
  w.input.ready = true; w.step(DT);
  assert.equal(w.core.shield, CORE.shieldLevels[0]);
  w.damageCore(100, null, 'test');
  assert.equal(w.core.hp, CORE.hp); assert.equal(w.core.shield, CORE.shieldLevels[0] - 100);
  w.damageCore(400, null, 'test');
  assert.equal(w.core.shield, 0); assert.equal(w.core.hp, CORE.hp - 200);
  w.clearWave(); w.startWave();
  assert.equal(w.core.shield, CORE.shieldLevels[0]);
});

test('재장전: 탄창이 비면 못 쏘고, 재장전 뒤 탄창이 차고 예비탄이 준다(권총은 무한)', () => {
  const w = sandbox(20);
  put(w, -20, 20);
  const p = w.player; p.owned.rifle = true; p.weapon = 'rifle'; p.ammo.rifle = { mag: 0, reserve: 100 };
  const ev = events(w, 0.2, (ww) => { ww.input.fire = true; });
  assert.ok(!ev.some((e) => e.t === 'shot'), '빈 탄창으로 발사됨');
  w.input.fire = false;
  run(w, WEAPONS.rifle.reload + 0.1);
  assert.equal(p.ammo.rifle.mag, WEAPONS.rifle.mag); assert.equal(p.ammo.rifle.reserve, 100 - WEAPONS.rifle.mag);
  p.weapon = 'pistol'; p.ammo.pistol.mag = 0; w.input.reload = true;
  run(w, WEAPONS.pistol.reload + 0.1);
  assert.equal(p.ammo.pistol.mag, WEAPONS.pistol.mag); assert.equal(p.ammo.pistol.reserve, Infinity);
});

test('웨이브 5 보스: 등장, 엔진 2개 파괴 시 조종석 ×3, 보스가 살아 있으면 웨이브가 안 끝남', () => {
  const w = new World({ seed: 21, startWave: 4 });
  w.player.hp = 1e9;
  w.input.ready = true; w.step(DT);
  assert.equal(w.wave, 5); assert.ok(w.isBossWave());
  let t = 0;
  while (!w.boss && t < 10) { w.step(DT); t += DT; }
  assert.ok(w.boss, '보스가 나오지 않음');
  const b = w.boss;
  // 일반 적은 전부 정리해도 보스가 살아 있으면 계속
  run(w, 3, (ww) => { ww.spawn.left = 0; for (const e of ww.enemies) if (e.type !== 'boss') ww.damageEnemy(e, 1e6, {}); });
  assert.equal(w.state, 'wave');
  let hp = b.hp; w.damageEnemy(b, 100, { part: { kind: 'cockpit' } }); assert.equal(hp - b.hp, 100);
  w.damageEnemy(b, b.engineMax, { part: { kind: 'engine', idx: 0, x: 0, y: 0, z: 0 } });
  w.damageEnemy(b, b.engineMax, { part: { kind: 'engine', idx: 1, x: 0, y: 0, z: 0 } });
  assert.ok(b.alive && b.engines[0] <= 0 && b.engines[1] <= 0);
  hp = b.hp; w.damageEnemy(b, 100, { part: { kind: 'cockpit' } }); assert.equal(hp - b.hp, 300);
  w.damageEnemy(b, 1e6, { part: { kind: 'hull' } });
  run(w, 1, (ww) => { for (const e of ww.enemies) ww.damageEnemy(e, 1e6, {}); });
  assert.equal(w.state, 'intermission');
});

test('패배: 체력 0 = 러너 사망, 코어 0 = 코어 함락', () => {
  const a = new World({ seed: 22 }); a.hurtPlayer(500, null, 'test', true);
  assert.equal(a.state, 'over'); assert.equal(a.overReason, 'player');
  const b = new World({ seed: 22 }); b.damageCore(5000, null, 'test');
  assert.equal(b.state, 'over'); assert.equal(b.overReason, 'core');
});

// ── 저장 ────────────────────────────────────────────────
function memStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; }
test('저장: 최고 점수·웨이브가 저장되고 다시 불러와도 남는다', () => {
  const st = memStorage();
  const d = load(st);
  assert.equal(recordRun(d, 1234, 6), true);
  save(d, st);
  const d2 = load(st);
  assert.equal(d2.best.score, 1234); assert.equal(d2.best.wave, 6);
  assert.equal(recordRun(d2, 10, 1), false);
});
test('저장: 손상된 데이터면 기본값으로 시작', () => {
  for (const bad of ['{', 'null', '[]', '{"best":{"score":"abc","wave":-5},"settings":{"fov":9999,"quality":"ultra"}}']) {
    const st = memStorage(); st.setItem(SAVE_KEY, bad);
    const d = load(st);
    assert.equal(d.best.score, 0); assert.ok(d.best.wave >= 0);
    assert.ok(d.settings.fov >= 75 && d.settings.fov <= 110); assert.equal(d.settings.quality, 'auto');
  }
  assert.deepEqual(sanitize(undefined).best, { score: 0, wave: 0 });
});

// ── 밸런스(자동 플레이 봇) ──────────────────────────────
test('밸런스: 봇이 8시드 모두 웨이브 4 이상 도달', () => {
  const res = [];
  for (let seed = 1; seed <= 8; seed++) { const r = runGame(World, { seed, maxTime: 600, untilWave: 5 }); res.push(r.world.wave); }
  assert.ok(res.every((x) => x >= 4), `도달 웨이브 ${res.join(',')}`);
});
test('밸런스: 리치를 무시하는 봇은 코어 함락으로 진다', () => {
  for (let seed = 1; seed <= 4; seed++) {
    const r = runGame(World, { seed, ignoreLeech: true, maxTime: 900 });
    assert.equal(r.world.overReason, 'core', `seed ${seed}: ${r.world.state} ${r.world.overReason}`);
  }
});
test('밸런스: 아무것도 안 하면 웨이브 1~2에서 진다', () => {
  for (let seed = 1; seed <= 4; seed++) {
    const r = runGame(World, { seed, idle: true, maxTime: 300 });
    assert.equal(r.world.state, 'over'); assert.ok(r.world.wave <= 2);
  }
});
test('교착 없음: 봇 8판 동안 한 웨이브가 4분을 넘지 않는다', () => {
  for (let seed = 11; seed <= 18; seed++) {
    const w = new World({ seed });
    const b = new Bot(w, { seed });
    let t = 0, waveStart = 0, last = w.wave;
    while (t < 700 && w.state !== 'over') {
      b.tick(DT); w.step(DT); w.events.length = 0; t += DT;
      if (w.wave !== last) { last = w.wave; waveStart = t; }
      assert.ok(t - waveStart < 240 || w.state !== 'wave', `seed ${seed} 웨이브 ${w.wave}가 4분 넘게 안 끝남`);
    }
  }
});
