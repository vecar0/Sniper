// 기획서 ⑥ 완료 기준 → 헤드리스 시뮬레이션 테스트. 실행: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS } from '../js/config/missions.js';
import { CELL, SURRENDER, FLASH, SCORE, SQUAD, BODY } from '../js/config/balance.js';
import { parseMap, roomAt, toCell, blocksMove, cellCenter, T } from '../js/sim/grid.js';
import { surrenderChance, warnSuspect } from '../js/sim/ai.js';
import { eyePos, canSee } from '../js/sim/combat.js';
import { World } from '../js/sim/world.js';
import { makeRng } from '../js/sim/rng.js';
import * as Save from '../js/core/save.js';
import { testWorld, place, face, run, suspects, hold, aimAt, benchSquad, ROOM2 } from './helpers.js';

// ───────── 맵 데이터 ─────────
test('작전 5개 맵: 해석·모든 방 도달 가능·필수 요소 존재', () => {
  assert.equal(MISSIONS.length, 5);
  for (const m of MISSIONS) {
    const g = parseMap(m.map);
    const start = roomAt(g, g.entries['1'].c, g.entries['1'].r);
    const seen = new Set([start]); const q = [start];
    while (q.length) { const r = q.shift(); for (const d of g.rooms[r].doors) for (const x of g.doors[d].rooms) if (x >= 0 && !seen.has(x)) { seen.add(x); q.push(x); } }
    assert.equal(seen.size, g.rooms.length, `${m.id}: 도달 못 하는 방 있음`);
    const w = new World(m);
    assert.ok(w.countKind('suspect') + w.countKind('dummy') > 0, `${m.id}: 적/표적 없음`);
    for (const a of w.actors) assert.ok(!blocksMove(g, w.doors, toCell(a.x, a.z).c, toCell(a.x, a.z).r), `${m.id}: ${a.name}가 막힌 칸에 있음`);
  }
});

// ───────── 기본 동작 ─────────
test('이동: 벽을 향해 계속 걸어도 벽 칸에 들어가지 않는다', () => {
  const w = testWorld(ROOM2);
  benchSquad(w);
  const L = w.leader;
  place(L, 2, 2);
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.7]) {
    L.yaw = yaw;
    run(w, 4, () => { w.input.mz = 1; w.input.sprint = true; });
    const c = toCell(L.x, L.z);
    assert.ok(!blocksMove(w.g, w.doors, c.c, c.r), `벽 안에 들어감 yaw=${yaw}`);
    // 몸 반지름만큼 벽에서 떨어져 있어야 한다
    for (const [dx, dz] of [[0.29, 0], [-0.29, 0], [0, 0.29], [0, -0.29]]) {
      const cc = toCell(L.x + dx, L.z + dz);
      assert.ok(!blocksMove(w.g, w.doors, cc.c, cc.r), '몸이 벽에 파묻힘');
    }
  }
});

test('숙이기: 시점이 낮아지고, 낮은 엄폐물 뒤에서는 적 시야에 걸리지 않는다', () => {
  const map = [
    '###########',
    '#1........#',
    '#.........#',
    '#...=.....#',
    '#.........#',
    '#...p.....#',
    '###########',
  ];
  const w = testWorld(map);
  benchSquad(w);
  const L = w.leader; const s = suspects(w)[0];
  place(L, 4, 2); place(s, 4, 6 - 1); // 엄폐물(4,3) 사이에 둠
  face(s, L);
  L.crouch = false;
  assert.ok(canSee(w, s, L, 60, 18), '선 리더는 보여야 함');
  w.input.crouch = true; w.step();
  assert.ok(eyePos(L).y < 1.1, '숙이면 시점이 내려가야 함');
  assert.equal(canSee(w, s, L, 60, 18), null, '숙인 리더는 엄폐물에 가려야 함');
});

test('사격: 탄약이 줄고, 0이면 못 쏘며, 재장전하면 채워진다', () => {
  const w = testWorld(ROOM2);
  benchSquad(w);
  const L = w.leader; const gun = L.weapons.primary;
  L.pitch = -0.3;
  run(w, 0.5, () => { w.input.fire = true; });
  assert.ok(gun.mag < gun.magSize, '탄약이 줄어야 함');
  run(w, 4, () => { w.input.fire = true; });
  assert.ok(gun.mag === 0 || L.reloadUntil, '다 쏘면 0이 되거나 자동 재장전');
  // 재장전 중엔 발사 없음
  const shots = w.stats.shotsFired;
  gun.mag = 0; gun.reserve = 2; L.reloadUntil = 0;
  run(w, 0.3, () => { w.input.fire = false; });
  w.input.reload = true;
  run(w, 0.5, () => { w.input.fire = true; });
  assert.equal(w.stats.shotsFired, shots, '재장전 중 발사됨');
  run(w, 3, () => { w.input.fire = false; });
  assert.equal(gun.mag, gun.magSize, '재장전 후 가득');
  assert.equal(gun.reserve, 1, '예비 탄창 1개 소모');
  gun.mag = 0; gun.reserve = 0;
  const before = w.stats.shotsFired;
  run(w, 1, () => { w.input.fire = !w.input.fire; });
  assert.equal(w.stats.shotsFired, before, '탄 0이면 발사 불가');
});

test('부위 판정: 머리 피해는 몸통의 2.5배', () => {
  const w = testWorld(ROOM2);
  benchSquad(w);
  const L = w.leader; const s = suspects(w)[0];
  w.doors[0].open = true;
  place(L, 5, 3); place(s, 5, 7);
  L.weapons.primary.magSize = L.weapons.primary.mag = 999;
  const shoot = (y) => {
    s.hp = 1000; s.state = 'idle'; L.bloom = 0;
    const n = w.stats.damageLog.length;
    aimAt(w, s, y);
    L.nextFire = 0; w.input.fire = true; L.fireLatch = false; w.step(); w.input.fire = false; w.step();
    return w.stats.damageLog.slice(n).filter((d) => d.target === s.id);
  };
  // 산포 0으로 정확하게
  const spec = { ...L.weapons.primary };
  const orig = L.spread;
  w.rng = makeRng(3);
  const head = shoot(BODY.standH - 0.1).find((d) => d.zone === 'head');
  const torso = shoot(1.2).find((d) => d.zone === 'torso');
  assert.ok(head && torso, `머리/몸통 둘 다 맞아야 함 (${JSON.stringify({ head, torso })})`);
  assert.equal(head.dmg / torso.dmg, 2.5);
  void spec; void orig;
});

test('문: 일반 문은 F 길게로 열리고, 잠긴 문은 F로 안 열리며 산탄총·폭약으로만 열린다', () => {
  const map = [
    '###########',
    '#1........#',
    '#.........#',
    '####D###L##',
    '#....#....#',
    '###########',
  ];
  const lo = { members: [{ primary: 'shotgun', items: { c2: 1 } }, { primary: 'm4', items: {} }, { primary: 'm4', items: {} }, { primary: 'm4', items: {} }] };
  const w = testWorld(map, { loadout: lo });
  benchSquad(w);
  const L = w.leader;
  const dN = w.g.doors.findIndex((d) => !d.locked); const dL = w.g.doors.findIndex((d) => d.locked);
  const gd = w.g.doors[dN]; const gl = w.g.doors[dL];
  // 일반 문
  place(L, gd.c, gd.r - 1); face(L, cellCenter(gd.c, gd.r));
  run(w, 0.2, () => { w.input.fDown = true; });
  assert.equal(w.doors[dN].open, false, '0.5초 전에는 안 열림');
  run(w, 0.5, () => { w.input.fDown = true; });
  assert.equal(w.doors[dN].open, true, '길게 누르면 열림');
  w.input.fDown = false; w.step();
  // 잠긴 문: F로 안 열림 (폭약이 있으면 설치로 바뀌므로 폭약을 잠시 뺀다)
  L.items.c2 = 0;
  place(L, gl.c, gl.r - 1); face(L, cellCenter(gl.c, gl.r));
  run(w, 1.5, () => { w.input.fDown = true; });
  w.input.fDown = false; w.step();
  assert.equal(w.doors[dL].open, false, '잠긴 문이 F로 열림');
  // 산탄총 사격으로 부숨
  L.pitch = -0.05;
  run(w, 0.1, () => { w.input.fire = true; });
  w.input.fire = false;
  assert.equal(w.doors[dL].open, true, '산탄총으로 안 열림');
  assert.equal(w.doors[dL].broken, true);
  // 바리케이드: 산탄총 X, 폭약 O
  const map2 = ['#########', '#1......#', '####X####', '#.......#', '#########'];
  const w2 = testWorld(map2, { loadout: lo });
  benchSquad(w2);
  const L2 = w2.leader; const gx = w2.g.doors[0];
  place(L2, gx.c, gx.r - 1); face(L2, cellCenter(gx.c, gx.r)); L2.pitch = -0.05;
  run(w2, 0.1, () => { w2.input.fire = true; }); w2.input.fire = false;
  assert.equal(w2.doors[0].open, false, '바리케이드가 산탄총에 열림');
  place(L2, gx.c, gx.r - 1); face(L2, cellCenter(gx.c, gx.r));
  run(w2, 1.2, () => { w2.input.fDown = true; }); w2.input.fDown = false;
  run(w2, 2.5);
  assert.equal(w2.doors[0].broken, true, '폭약으로 바리케이드가 부서져야 함');
});

// ───────── 분대 명령 ─────────
test('따라오기: 대원 3명이 리더 뒤 2~3m(+간격) 안으로 따라온다', () => {
  const map = ['##################', '#1...............#', '#................#', '#................#', '##################'];
  const w = testWorld(map);
  const L = w.leader;
  L.yaw = -Math.PI / 2; // +x 방향
  run(w, 3, () => { w.input.mz = 1; });
  run(w, 3, () => { w.input.mz = 0; });
  for (const m of w.squad) {
    const d = Math.hypot(m.x - L.x, m.z - L.z);
    assert.ok(d >= 0.6 && d <= SQUAD.followMax + 2 * 0.9 + 0.5, `${m.name} 거리 ${d.toFixed(2)}`);
  }
});

function doorWorld() {
  const map = [
    '##############',
    '#1...........#',
    '#............#',
    '#............#',
    '######D#######',
    '#............#',
    '#....p.......#',
    '#............#',
    '##############',
  ];
  return testWorld(map);
}

test('쌓기: 문을 보고 "문 앞 대기"를 명령하면 팀이 문 양옆에 붙어 대기한다', () => {
  const w = doorWorld();
  const d = w.g.doors[0];
  w.command('all', { type: 'stack', door: 0 });
  run(w, 6);
  const dc = cellCenter(d.c, d.r);
  for (const m of w.squad) {
    const dd = Math.hypot(m.x - dc.x, m.z - dc.z);
    assert.ok(dd < 3.2, `${m.name} 문에서 ${dd.toFixed(2)}m`);
    assert.ok(m.z < dc.z, `${m.name}가 문 너머로 감`);
  }
  assert.equal(w.doors[0].open, false, '쌓기만으로 문이 열리면 안 됨');
});

test('섬광 후 정리: 문이 열리고 섬광탄이 들어간 뒤 대원이 0.4초 간격으로 진입한다', () => {
  const w = doorWorld();
  const s = suspects(w)[0];
  const ev = [];
  const op = w.command('all', { type: 'breach', door: 0, mode: 'flash' });
  const entered = {};
  const doorZ = (w.g.doors[0].r + 1) * CELL;
  run(w, 10, (ww) => {
    for (const e of ww.events) ev.push(e);
    ww.events.length = 0;
    for (const m of ww.squad) if (entered[m.id] == null && m.z > doorZ + 0.2) entered[m.id] = ww.time;
  });
  assert.ok(w.doors[0].open, '문이 열려야 함');
  const flash = ev.find((e) => e.type === 'flash');
  assert.ok(flash, '섬광탄이 터져야 함');
  assert.ok(s.state === 'surrendered' || s.state === 'arrested' || s.state === 'down' || s.stunUntil > 0, '용의자가 섬광에 걸렸어야 함');
  const times = Object.values(entered).sort((a, b) => a - b);
  assert.equal(times.length, 3, `3명 모두 진입해야 함 (${times.length})`);
  assert.ok(times[0] >= flash.t - 0.05, '섬광 전에 진입함');
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 0.3, `진입 간격 ${(times[i] - times[i - 1]).toFixed(2)}초`);
  void op;
});

test('GO 코드: 두 팀을 각각 다른 문에 GO 대기로 걸고 GO를 누르면 0.2초 안에 동시에 실행한다', () => {
  const map = [
    '################',
    '#1.............#',
    '#..............#',
    '#..............#',
    '###D#######D####',
    '#..............#',
    '#......p.......#',
    '################',
  ];
  const w = testWorld(map);
  const a = w.command('red', { type: 'breach', door: 0, mode: 'open' }, true);
  const b = w.command('blue', { type: 'breach', door: 1, mode: 'open' }, true);
  run(w, 9);
  assert.equal(a.phase, 'ready'); assert.equal(b.phase, 'ready');
  assert.equal(w.doors[0].open || w.doors[1].open, false, 'GO 전에 실행됨');
  w.input.go = true;
  run(w, 0.3);
  assert.ok(a.execAt != null && b.execAt != null, '둘 다 실행돼야 함');
  assert.ok(Math.abs(a.execAt - b.execAt) <= SQUAD.goSyncWindow, `동시성 ${Math.abs(a.execAt - b.execAt)}`);
  assert.ok(w.doors[0].open && w.doors[1].open);
});

test('체포 명령: 항복한 용의자를 체포 명령하면 대원이 가서 수갑을 채우고 카운트가 오른다', () => {
  const w = doorWorld();
  const s = suspects(w)[0];
  w.doors[0].open = true;
  s.state = 'surrendered';
  const before = w.objectives().suspectsDone;
  w.command('all', { type: 'arrest', target: s.id });
  run(w, 10);
  assert.equal(s.state, 'arrested');
  assert.equal(w.objectives().suspectsDone, before + 1);
  assert.equal(w.stats.arrests, 1);
});

// ───────── 적 AI · 교전 규칙 ─────────
test('용의자는 시야(±60°, 18m) 안의 리더를 보면 0.35~0.55초 뒤 첫 발을 쏜다', () => {
  for (const [sub, ch] of [['pistol', 'p'], ['rifle', 'r'], ['heavy', 'h']]) {
    const map = ['####################', `#1...............${ch}.#`, '####################'];
    const w = testWorld(map);
    benchSquad(w);
    const L = w.leader; const s = suspects(w)[0];
    place(L, 3, 1); face(s, L);
    const d = Math.hypot(s.x - L.x, s.z - L.z);
    assert.ok(d < 18);
    let first = null;
    run(w, 2, (ww) => { if (first == null && ww.events.some((e) => e.type === 'shot' && e.by === s.id)) first = ww.time; ww.events.length = 0; });
    assert.ok(first != null, `${sub} 사격 없음`);
    // 첫 틱(0)에 이미 보이므로 첫 발 시각 ≈ 반응 시간 (+인지 주기 0.1초)
    assert.ok(first >= 0.33 && first <= 0.7, `${sub} 첫 발 ${first.toFixed(3)}초`);
  }
  // 시야 밖(등 뒤)이면 안 쏜다
  const w = testWorld(['####################', '#1...............p.#', '####################']);
  benchSquad(w);
  const s = suspects(w)[0]; s.yaw = w.leader.yaw; // 리더와 같은 방향 = 리더에게 등을 짐
  face(s, { x: s.x + 5, z: s.z });
  run(w, 2);
  assert.equal(w.stats.damageLog.length, 0, '등 뒤 리더를 쐈음');
});

test('총성이 나면 같은 층의 대기 중인 용의자가 "경계" 상태로 바뀐다', () => {
  const w = doorWorld();
  benchSquad(w);
  const s = suspects(w)[0];
  assert.equal(s.state, 'idle');
  w.leader.pitch = -0.4;
  run(w, 0.1, () => { w.input.fire = true; });
  assert.ok(s.state === 'alert' || s.state === 'engage', `상태 ${s.state}`);
});

test('항복률: 권총 용의자 기본 항복률이 1000회 중 50~60%', () => {
  const w = doorWorld();
  benchSquad(w);
  const s = suspects(w)[0];
  // 보정 조건이 없도록: 시야 밖 리더, 체력 가득, 섬광 없음
  place(w.leader, 1, 1);
  assert.equal(surrenderChance(w, s), SURRENDER.base.pistol);
  let ok = 0;
  for (let i = 0; i < 1000; i++) {
    s.state = 'idle'; s.lastWarned = -99; s.droppedWeapon = true;
    w.time += 2;
    if (warnSuspect(w, s, w.leader)) ok++;
  }
  assert.ok(ok >= 500 && ok <= 600, `항복 ${ok}/1000`);
  // 섬광 보정 +35%p
  s.stunUntil = w.time + 10;
  assert.ok(Math.abs(surrenderChance(w, s) - (SURRENDER.base.pistol + SURRENDER.flashed)) < 1e-9);
});

test('섬광탄: 반경 6m 안의 적은 4초 동안 쏘지 않는다', () => {
  const map = ['####################', '#1.........r.......#', '####################'];
  const w = testWorld(map);
  benchSquad(w);
  const s = suspects(w)[0];
  face(s, w.leader);
  w.spawnGrenade('flash', w.leader, { x: s.x - 1, y: 0.5, z: s.z }, { x: 0, y: 0, z: 0 }, 0.01);
  w.step(); w.step();
  assert.ok(s.stunUntil - w.time > FLASH.stun - 0.1, '기절 4초');
  let shot = false;
  run(w, FLASH.stun - 0.1, (ww) => { if (ww.events.some((e) => e.type === 'shot' && e.by === s.id)) shot = true; ww.events.length = 0; });
  assert.equal(shot, false, '기절 중 사격');
  // 6m 밖은 안 걸림
  const w2 = testWorld(map); benchSquad(w2);
  const s2 = suspects(w2)[0];
  w2.spawnGrenade('flash', w2.leader, { x: s2.x - 7, y: 0.5, z: s2.z }, { x: 0, y: 0, z: 0 }, 0.01);
  w2.step(); w2.step();
  assert.equal(s2.stunUntil, 0, '6m 밖이 기절함');
});

test('교전 규칙: 항복한 용의자를 쏘면 −15, 민간인을 쏘면 −25가 기록되고 알림이 뜬다', () => {
  const map = ['############', '#1...p..C..#', '############'];
  const w = testWorld(map);
  benchSquad(w);
  const s = suspects(w)[0]; const c = w.actors.find((a) => a.kind === 'civilian');
  s.state = 'surrendered';
  w.rng = makeRng(11);
  aimAt(w, s, 0.8); w.leader.bloom = 0;
  run(w, 0.05, () => { w.input.fire = true; }); w.input.fire = false;
  assert.equal(w.stats.unjustified, 1);
  assert.ok(w.notices.some((n) => n.text.includes('정당하지 않은 사살') && n.text.includes(String(SCORE.unjustified))));
  s.state = 'down'; s.x = -40;
  aimAt(w, c, 0.8);
  run(w, 0.3, () => { w.input.fire = true; }); w.input.fire = false;
  assert.equal(w.stats.innocentShots, 1, '민간인 피격 기록');
  assert.ok(w.notices.some((n) => n.text.includes(String(SCORE.innocentShot))));
  const r = w.end(true, 'x');
  assert.ok(r.rows.some((row) => row.pts === SCORE.unjustified));
  assert.ok(r.rows.some((row) => row.pts === SCORE.innocentShot));
});

test('한 대상을 동시에 쏘는 적은 최대 2명', () => {
  const map = ['##############', '#1...........#', '#.........ppp#', '#.........r..#', '##############'];
  const w = testWorld(map);
  benchSquad(w);
  w.leader.hp = 100000; w.leader.maxHp = 100000;
  for (const s of suspects(w)) face(s, w.leader);
  let maxShooters = 0;
  run(w, 6, (ww) => {
    const recent = new Set();
    for (const e of ww.events) if (e.type === 'shot' && e.enemy) recent.add(e.by);
    ww.events.length = 0;
    const firing = ww.actors.filter((a) => a.kind === 'suspect' && a.state === 'engage' && a.firingAt === ww.leader.id).length;
    maxShooters = Math.max(maxShooters, firing);
  });
  assert.ok(maxShooters >= 1);
  assert.ok(maxShooters <= 2, `동시 사격 ${maxShooters}명`);
  // 실제 사격자 집합도 2명 이하
  const by = new Set(w.stats.damageLog.filter((d) => d.target === w.leader.id).map((d) => d.by));
  assert.ok(by.size <= 4); // 교대는 허용되지만 한 순간 2명 제한은 위에서 확인
});

// ───────── 승패 · 진행 ─────────
test('승리: 모든 인질 확보 + 모든 용의자 무력화 → 승리, 점수·별 산출', () => {
  const w = new World(MISSIONS[1]);
  for (const a of w.actors) {
    if (a.kind === 'suspect') { a.state = 'arrested'; w.stats.arrests++; }
    if (a.kind === 'hostage') { a.state = 'secured'; w.stats.hostagesSecured++; }
  }
  w.step();
  assert.ok(w.result && w.result.win, '승리해야 함');
  assert.ok(w.result.score > 0 && w.result.stars >= 1);
});

test('패배: 리더 체력 0 / 인질 2명 사망 / 제한 시간 초과', () => {
  const w1 = new World(MISSIONS[1]);
  w1.leader.hp = 0; w1.step();
  assert.ok(w1.result && !w1.result.win && w1.result.reason.includes('리더'));
  const w2 = new World(MISSIONS[1]);
  w2.stats.hostageDeaths = 2; w2.step();
  assert.ok(w2.result && !w2.result.win && w2.result.reason.includes('인질'));
  const w3 = new World(MISSIONS[4]);
  benchSquad(w3);
  for (const a of w3.actors) if (a.kind === 'suspect') a.stunUntil = 1e9; // 시간만 흐르게
  w3.time = MISSIONS[4].timeLimit - 0.01; w3.step();
  assert.ok(w3.result && !w3.result.win && w3.result.reason.includes('시간'));
  assert.equal(w3.result.stars, 0);
});

test('저장: 손상된 데이터는 초기화, 해금·별은 다시 읽어도 유지', () => {
  const mem = new Map();
  const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
  const ids = MISSIONS.map((m) => m.id);
  mem.set(Save.SAVE_KEY, '{이건 JSON이 아님');
  const a = Save.load(ids, storage);
  assert.deepEqual(a.unlocked, ['m1']);
  mem.set(Save.SAVE_KEY, JSON.stringify({ version: 1, unlocked: 'oops', stars: { m1: 99 }, settings: { sens: 'x' } }));
  const b = Save.load(ids, storage);
  assert.deepEqual(b.unlocked, ['m1']); assert.equal(b.stars.m1, undefined); assert.equal(b.settings.sens, 1);
  b.unlocked.push('m2'); b.stars.m1 = 2;
  Save.store(b, storage);
  const c = Save.load(ids, storage);
  assert.deepEqual(c.unlocked, ['m1', 'm2']); assert.equal(c.stars.m1, 2);
  // 저장소 자체가 터져도 예외 없이
  const bad = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.deepEqual(Save.load(ids, bad).unlocked, ['m1']);
  assert.equal(Save.store(c, bad), false);
});

test('경고 사거리: 10m 밖 용의자는 리더 경고에 반응하지 않는다', () => {
  const map = ['########################', '#1....................p#', '########################'];
  const w = testWorld(map);
  benchSquad(w);
  const s = suspects(w)[0];
  w.input.fDown = true; w.step(); w.input.fDown = false; w.step();
  assert.equal(s.warnedCount, undefined);
});

void T; void cellCenter;

test('돌입 명령: 시작 위치에서 가장 가까운 문에 "섬광 후 정리"를 내리면 3초 안에 준비·실행된다(리더에게 막히지 않음)', () => {
  for (const m of MISSIONS) {
    const w = new World(m, { seed: 1 });
    // 같은 진입 지점에 있는 대원만(다른 입구 팀은 거리상 오래 걸리는 게 정상)
    const sel = m.entries.blue !== m.entries.red ? 'red' : 'all';
    const ds = w.g.doors.map((d, i) => [i, Math.hypot((d.c + 0.5) * CELL - w.leader.x, (d.r + 0.5) * CELL - w.leader.z)]).sort((a, b) => a[1] - b[1]);
    const op = w.command(sel, { type: 'breach', door: ds[0][0], mode: 'flash' });
    run(w, 3);
    assert.ok(op.execAt != null && op.execAt < 3, `${m.id}: 실행 시각 ${op.execAt}`);
  }
});
