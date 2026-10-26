// 헬릭스 군단 AI. 모든 공격은 예고(telegraph) 후 발동한다.
import { ENEMIES, CORE } from '../config/balance.js';

let nextId = 1;

export function makeEnemy(type, x, y, z, hpMul, dmgMul, extra = {}) {
  const c = ENEMIES[type];
  const hp = c.hp * hpMul;
  return {
    id: nextId++, type, c, x, y, z, px: x, py: y, pz: z, vx: 0, vy: 0, vz: 0,
    yaw: 0, r: c.radius, h: c.height || 1.8, grounded: false, landSpeed: 0,
    hp, maxHp: hp, dmgMul, alive: true, state: 'spawn', t: 0, stun: 0, stagger: 0, flash: 0,
    attackT: 0, cd: 0, moveSpeed: 0, anim: Math.random() * 10, hitDir: 0, ...extra,
  };
}

const angTo = (ax, az, bx, bz) => Math.atan2(-(bx - ax), -(bz - az)); // yaw 0 = −z를 봄
const turn = (a, b, max) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + Math.max(-max, Math.min(max, d));
};

export function updateEnemy(world, e, dt) {
  e.px = e.x; e.py = e.y; e.pz = e.z;
  e.flash = Math.max(0, e.flash - dt * 12);
  e.anim += dt;
  if (e.stun > 0) {
    e.stun -= dt;
    e.moveSpeed = 0;
    if (e.type === 'drone') { e.vy -= 6 * dt; e.y = Math.max(world.geom.heightAt(e.x, e.z) + 0.4, e.y + e.vy * dt); }
    else physics(world, e, 0, 0, dt);
    return;
  }
  if (e.stagger > 0) { e.stagger -= dt; physics(world, e, 0, 0, dt); return; }
  UPDATERS[e.type](world, e, dt);
  if (e.y < -12) world.removeEnemy(e, 'fell');
}

// 지상 이동: 원하는 속도로 가속 + 충돌 + 중력
function physics(world, e, wantVx, wantVz, dt, accel = 30) {
  let ex = wantVx - e.vx, ez = wantVz - e.vz;
  const el = Math.hypot(ex, ez), a = accel * dt;
  if (el > a) { ex *= a / el; ez *= a / el; }
  e.vx += ex; e.vz += ez;
  e.vy -= 22 * dt;
  const r = world.geom.move(e, e.vx * dt, e.vz * dt, dt, 0.55);
  if (r.blockedX) e.vx *= 0.2;
  if (r.blockedZ) e.vz *= 0.2;
  e.moveSpeed = Math.hypot(e.vx, e.vz);
}

// 거리장을 따라가는 방향 + 무리 분리 + 끼임 탈출(모서리에 걸려 0.4초 이상 못 움직이면 옆으로 비켜 감)
function steer(world, e, dist, speed) {
  const tgt = world.geom.follow(dist, e.x, e.z, 3);
  let dx = 0, dz = 0;
  if (tgt) { dx = tgt.x - e.x; dz = tgt.z - e.z; const l = Math.hypot(dx, dz); if (l > 0.01) { dx /= l; dz /= l; } }
  const dt = 1 / 60;
  if (e.detourT > 0) {
    e.detourT -= dt;
    dx = dx * 0.3 + e.detX; dz = dz * 0.3 + e.detZ;
  } else if (tgt && e.moveSpeed < speed * 0.15 && e.grounded) {
    e.stuckT = (e.stuckT || 0) + dt;
    if (e.stuckT > 0.4) {
      const side = world.rng.chance(0.5) ? 1 : -1;
      e.detX = -dz * side; e.detZ = dx * side; e.detourT = 0.5; e.stuckT = 0;
    }
  } else e.stuckT = 0;
  const sep = separation(world, e);
  dx += sep.x; dz += sep.z;
  const l = Math.hypot(dx, dz);
  if (l > 0.01) { dx /= l; dz /= l; }
  return { x: dx * speed, z: dz * speed };
}

function separation(world, e) {
  let sx = 0, sz = 0;
  for (const o of world.enemies) {
    if (o === e || !o.alive || o.type === 'drone' || o.type === 'boss') continue;
    const dx = e.x - o.x, dz = e.z - o.z, d2 = dx * dx + dz * dz;
    const min = e.r + o.r + 0.3;
    if (d2 < min * min && d2 > 1e-6) { const d = Math.sqrt(d2); sx += (dx / d) * (min - d) * 2; sz += (dz / d) * (min - d) * 2; }
  }
  return { x: sx, z: sz };
}

function faceMove(e, dt, rate = 10) {
  if (e.moveSpeed > 0.4) e.yaw = turn(e.yaw, Math.atan2(-e.vx, -e.vz), rate * dt);
}

function chest(p) { return { x: p.x, y: p.y + p.h * 0.62, z: p.z }; }

// ── 리퍼: 추적 → 웅크림(예고) → 도약 → 베기 ─────────────
function reaper(world, e, dt) {
  const p = world.player, c = e.c;
  const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz), dy = p.y - e.y;
  e.t += dt; e.cd -= dt;
  switch (e.state) {
    case 'spawn': case 'chase': {
      e.state = 'chase';
      const v = steer(world, e, world.fieldPlayer, c.speed);
      physics(world, e, v.x, v.z, dt);
      faceMove(e, dt);
      if (d < 1.4 && Math.abs(dy) < 1.4) { e.state = 'melee'; e.t = 0; e.cd = 0.25; }
      else if (d < c.leapRange && Math.abs(dy) < 1.2 && e.cd <= 0 && e.grounded &&
        world.geom.los(e.x, e.y + 1.2, e.z, p.x, p.y + 1, p.z)) {
        e.state = 'windup'; e.t = 0; world.events.push({ t: 'tele', kind: 'leap', id: e.id });
      }
      break;
    }
    case 'windup':
      physics(world, e, 0, 0, dt, 60);
      e.yaw = turn(e.yaw, angTo(e.x, e.z, p.x, p.z), 12 * dt);
      if (e.t >= c.leapWindup) {
        const sp = Math.min(12, Math.max(6, d / c.leapTime));
        e.vx = (dx / (d || 1)) * sp; e.vz = (dz / (d || 1)) * sp; e.vy = 3.2;
        e.state = 'leap'; e.t = 0; world.events.push({ t: 'leap', id: e.id });
      }
      break;
    case 'leap':
      e.vy -= 22 * dt;
      { const r = world.geom.move(e, e.vx * dt, e.vz * dt, dt); if (r.blockedX) e.vx = 0; if (r.blockedZ) e.vz = 0; }
      e.moveSpeed = Math.hypot(e.vx, e.vz);
      if (d < c.hitRange && Math.abs(dy) < 1.5) {
        world.hurtPlayer(c.meleeDmg * e.dmgMul, e, 'blade');
        e.state = 'melee'; e.t = 0; e.cd = c.meleeRate; e.attackT = 0.3;
      } else if (e.t >= c.leapTime && e.grounded) {
        e.state = 'chase'; e.stagger = c.leapStagger; e.cd = 1.2;
      }
      break;
    case 'melee':
      physics(world, e, (dx / (d || 1)) * (d > 1.1 ? 3 : 0), (dz / (d || 1)) * (d > 1.1 ? 3 : 0), dt);
      e.yaw = turn(e.yaw, angTo(e.x, e.z, p.x, p.z), 10 * dt);
      e.attackT -= dt;
      if (d > 2.6 || Math.abs(dy) > 1.6) { e.state = 'chase'; e.cd = 0.5; break; }
      if (e.cd <= 0.25 && e.cd + dt > 0.25) world.events.push({ t: 'tele', kind: 'slash', id: e.id });
      if (e.cd <= 0) {
        e.cd = c.meleeRate; e.attackT = 0.3;
        if (d < 1.9) world.hurtPlayer(c.meleeDmg * e.dmgMul, e, 'blade');
        world.events.push({ t: 'slash', id: e.id, hit: d < 1.9 });
      }
      break;
  }
}

// ── 집행관: 엄폐점 선택 → 이동 → 조준(예고) → 3점사 → 재배치 ─────
function enforcer(world, e, dt) {
  const p = world.player, c = e.c, g = world.geom;
  e.t += dt; e.cd -= dt; e.attackT -= dt; e.holdT = (e.holdT || 0) + dt;
  const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz);
  const eyeY = e.y + 1.6;
  const pc = chest(p);
  const sees = () => g.los(e.x, eyeY, e.z, pc.x, pc.y, pc.z);
  if (e.state === 'spawn') { e.state = 'seek'; e.repos = 0; }
  if (e.state !== 'evade' && d < c.tooClose && e.state !== 'aim' && e.state !== 'burst') {
    // 너무 가까우면 옆으로 피한다
    const side = world.rng.chance(0.5) ? 1 : -1;
    e.evx = (-dz / (d || 1)) * side * 5 - (dx / (d || 1)) * 2; e.evz = (dx / (d || 1)) * side * 5 - (dz / (d || 1)) * 2;
    e.state = 'evade'; e.t = 0;
  }
  switch (e.state) {
    case 'seek': {
      const cover = world.pickCover(e);
      if (cover >= 0) { e.coverK = cover; e.field = g.field([cover], e.field); e.state = 'move'; }
      else { e.state = 'hold'; e.coverK = -1; }
      e.t = 0; e.holdT = 0; e.repos = c.repositionMin + world.rng.next() * (c.repositionMax - c.repositionMin);
      break;
    }
    case 'move': {
      const k = g.cellOf(e.x, e.z);
      const v = steer(world, e, e.field, c.speed);
      physics(world, e, v.x, v.z, dt);
      faceMove(e, dt, 8);
      const cc = g.cellCenter(e.coverK);
      if (k === e.coverK || Math.hypot(cc.x - e.x, cc.z - e.z) < 0.5 || e.t > 9) { e.state = 'hold'; e.t = 0; }
      // 이동 중에도 기회가 되면 쏜다
      if (e.cd <= 0 && d < 30 && sees()) { e.state = 'aim'; e.t = 0; e.after = 'move'; world.events.push({ t: 'tele', kind: 'aim', id: e.id }); }
      break;
    }
    case 'hold': {
      physics(world, e, 0, 0, dt);
      e.yaw = turn(e.yaw, angTo(e.x, e.z, p.x, p.z), 5 * dt);
      const vis = sees();
      if (vis) e.blind = 0; else e.blind = (e.blind || 0) + dt;
      if (e.cd <= 0 && vis) { e.state = 'aim'; e.t = 0; e.after = 'hold'; world.events.push({ t: 'tele', kind: 'aim', id: e.id }); }
      if (e.holdT > e.repos || e.blind > 2) { e.state = 'seek'; e.blind = 0; }
      break;
    }
    case 'aim':
      physics(world, e, 0, 0, dt, 60);
      e.yaw = turn(e.yaw, angTo(e.x, e.z, p.x, p.z), 8 * dt);
      if (e.t >= c.aimTime) { e.state = 'burst'; e.t = 0; e.shots = 0; }
      break;
    case 'burst':
      physics(world, e, 0, 0, dt, 60);
      e.yaw = turn(e.yaw, angTo(e.x, e.z, p.x, p.z), 8 * dt);
      if (e.t >= e.shots * c.burstGap) {
        world.enemyShoot(e, c);
        e.shots++; e.attackT = 0.15;
        if (e.shots >= c.burst) { e.cd = c.fireEvery; e.state = e.after === 'move' ? 'move' : 'hold'; e.t = e.after === 'move' ? e.t : 0; }
      }
      break;
    case 'evade':
      physics(world, e, e.evx, e.evz, dt, 50);
      e.yaw = turn(e.yaw, angTo(e.x, e.z, p.x, p.z), 8 * dt);
      if (e.t > 0.8) e.state = 'seek';
      break;
  }
}

// ── 리치: 플레이어 무시하고 코어로 → 접속 → 흡수 ─────────────
function leech(world, e, dt) {
  const c = e.c;
  e.t += dt;
  const dCore = Math.hypot(e.x, e.z) - CORE.radius;
  if (e.state === 'spawn') e.state = 'move';
  if (e.state === 'attach') {
    physics(world, e, 0, 0, dt, 60);
    e.yaw = turn(e.yaw, angTo(e.x, e.z, 0, 0), 6 * dt);
    if (e.interrupt > 0) e.interrupt -= dt;
    else world.damageCore(c.drain * e.dmgMul * dt, e, 'drain');
    return;
  }
  if (dCore <= c.attachDist) {
    if (world.leechSlotsFree() > 0) { e.state = 'attach'; e.interrupt = 0; world.events.push({ t: 'leechAttach', id: e.id }); return; }
    // 자리가 없으면 코어 주변을 맴돈다
    const a = Math.atan2(e.z, e.x) + 0.6;
    const tx = Math.cos(a) * 4.0, tz = Math.sin(a) * 4.0;
    const l = Math.hypot(tx - e.x, tz - e.z) || 1;
    physics(world, e, ((tx - e.x) / l) * 2, ((tz - e.z) / l) * 2, dt);
    faceMove(e, dt);
    return;
  }
  const v = steer(world, e, world.fieldCore, c.speed);
  physics(world, e, v.x, v.z, dt);
  faceMove(e, dt);
}

// ── 스웜 드론: 무리 비행 → 깜빡임(예고) → 돌진 자폭 ─────────────
function drone(world, e, dt) {
  const c = e.c, p = world.player;
  e.t += dt;
  const tgtCore = e.target === 'core';
  const tx = tgtCore ? 0 : p.x, tz = tgtCore ? 0 : p.z, ty = tgtCore ? 1.8 : p.y + 1.1;
  const dx = tx - e.x, dz = tz - e.z, dy = ty - e.y;
  const dh = Math.hypot(dx, dz);
  const dist3 = tgtCore ? Math.max(0, dh - CORE.radius) : Math.hypot(dx, dy, dz);
  if (e.state === 'spawn') e.state = 'fly';
  let wvx, wvy, wvz;
  if (e.state === 'fly') {
    // 무리 대형: 목표 주위를 도는 오프셋
    const a = e.anim * 0.9 + e.slot * 2.1;
    const ox = Math.cos(a) * 2.2, oz = Math.sin(a) * 2.2;
    const gx = tx + ox * Math.min(1, dh / 8), gz = tz + oz * Math.min(1, dh / 8);
    const alt = Math.max(ty + e.alt * Math.min(1, dh / 10), world.geom.heightAt(e.x, e.z) + 1.2);
    let vx = gx - e.x, vz = gz - e.z, vy = alt - e.y;
    const l = Math.hypot(vx, vz) || 1;
    wvx = (vx / l) * c.speed; wvz = (vz / l) * c.speed; wvy = Math.max(-4, Math.min(5, vy * 2));
    // 앞이 막히면 위로
    const ahead = world.geom.raycast(e.x, e.y, e.z, wvx / c.speed, 0, wvz / c.speed, 2.0);
    if (ahead) wvy = 6;
    if (dist3 < c.triggerDist) { e.state = 'windup'; e.t = 0; world.events.push({ t: 'tele', kind: 'drone', id: e.id }); }
  } else if (e.state === 'windup') {
    const l = Math.hypot(dx, dy, dz) || 1;
    wvx = (dx / l) * 2; wvy = (dy / l) * 2; wvz = (dz / l) * 2;
    if (e.t >= c.windup) { e.state = 'dive'; e.t = 0; }
  } else { // dive
    const l = Math.hypot(dx, dy, dz) || 1;
    wvx = (dx / l) * 15; wvy = (dy / l) * 15; wvz = (dz / l) * 15;
    if (dist3 < 1.0 || e.t > 1.2) { world.droneExplode(e, true); return; }
  }
  const k = Math.min(1, dt * (e.state === 'dive' ? 12 : 4));
  e.vx += (wvx - e.vx) * k; e.vy += (wvy - e.vy) * k; e.vz += (wvz - e.vz) * k;
  const sp = Math.hypot(e.vx, e.vy, e.vz);
  if (sp > 0.01) {
    const hit = world.geom.raycast(e.x, e.y, e.z, e.vx / sp, e.vy / sp, e.vz / sp, sp * dt + 0.3);
    if (hit) {
      if (e.state === 'dive') { world.droneExplode(e, true); return; }
      // 미끄러지듯 비켜 간다
      const dot = e.vx * hit.nx + e.vy * hit.ny + e.vz * hit.nz;
      e.vx -= hit.nx * dot; e.vy -= hit.ny * dot - 1; e.vz -= hit.nz * dot;
    }
  }
  e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
  e.moveSpeed = sp;
  e.yaw = turn(e.yaw, Math.atan2(-dx, -dz), 6 * dt);
}

// ── 메크: 코어로 전진하며 방패를 플레이어 쪽으로 → 주먹 / 미사일(레이저 예고) ──
function mech(world, e, dt) {
  const c = e.c, p = world.player;
  e.t += dt; e.cd -= dt; e.mcd = (e.mcd ?? 3) - dt; e.shieldOff = Math.max(0, (e.shieldOff || 0) - dt);
  e.attackT -= dt;
  if (e.state === 'spawn') e.state = 'advance';
  const dP = Math.hypot(p.x - e.x, p.z - e.z);
  const dCore = Math.hypot(e.x, e.z) - CORE.radius;
  // 방패(몸통)는 플레이어를 향해 돈다(돌아 들어가면 등을 칠 수 있다)
  const faceTarget = dP < 32 ? angTo(e.x, e.z, p.x, p.z) : angTo(e.x, e.z, 0, 0);
  e.yaw = turn(e.yaw, faceTarget, c.turnRate * dt);
  if (e.state === 'advance') {
    if (dCore <= c.punchRange - 0.6) { e.state = 'punch'; e.cd = 0.8; }
    else { const v = steer(world, e, world.fieldCore, c.speed); physics(world, e, v.x, v.z, dt, 8); }
  } else if (e.state === 'punch') {
    physics(world, e, 0, 0, dt, 20);
    if (dCore > c.punchRange + 0.5) e.state = 'advance';
    if (e.cd <= 0.6 && e.cd + dt > 0.6) world.events.push({ t: 'tele', kind: 'punch', id: e.id });
    if (e.cd <= 0) { e.cd = c.punchEvery; e.attackT = 0.5; world.damageCore(c.punchDmg * e.dmgMul, e, 'punch'); world.events.push({ t: 'punch', id: e.id }); }
  }
  // 미사일
  if (e.missileWarn > 0) {
    e.missileWarn -= dt;
    e.aimX = p.x; e.aimY = p.y + 1; e.aimZ = p.z;
    if (e.missileWarn <= 0) world.mechMissile(e);
  } else if (e.mcd <= 0 && dP < c.missileRange && world.geom.los(e.x, e.y + 3, e.z, p.x, p.y + 1.2, p.z)) {
    e.missileWarn = c.missileWarn; e.mcd = c.missileEvery;
    world.events.push({ t: 'tele', kind: 'missile', id: e.id });
  }
}

// ── 보스 카론: 옥상 위 원 궤도 + 패턴 ①미니건 ②미사일 ③강하 ───────
function boss(world, e, dt) {
  const c = e.c, p = world.player;
  e.t += dt;
  const alt = (c.altMin + c.altMax) / 2 - (2 - e.engines.filter((x) => x > 0).length) * c.engineAltLoss;
  if (e.state === 'spawn') { e.state = 'enter'; e.ang = -Math.PI / 2; }
  if (e.state === 'enter') {
    const tx = Math.cos(e.ang) * c.orbitR, tz = Math.sin(e.ang) * c.orbitR;
    const dx = tx - e.x, dz = tz - e.z, dy = alt - e.y, l = Math.hypot(dx, dy, dz);
    const sp = Math.min(14, l * 1.2);
    if (l > 0.5) { e.x += (dx / l) * sp * dt; e.y += (dy / l) * sp * dt; e.z += (dz / l) * sp * dt; }
    e.yaw = turn(e.yaw, Math.atan2(-dx, -dz), 1.5 * dt);
    if (l < 1) { e.state = 'orbit'; e.pat = 0; e.cd = 2; }
    return;
  }
  // 궤도 이동
  e.ang += c.orbitSpeed * dt * (e.phase === 'gatling' ? 0.4 : 1);
  const tx = Math.cos(e.ang) * c.orbitR, tz = Math.sin(e.ang) * c.orbitR;
  const ty = alt + Math.sin(e.t * 0.7) * 1.2;
  e.vx = (tx - e.x) * 2; e.vy = (ty - e.y) * 2; e.vz = (tz - e.z) * 2;
  e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt;
  const tangent = Math.atan2(-(-Math.sin(e.ang)), -Math.cos(e.ang));
  e.yaw = turn(e.yaw, e.phase === 'gatling' ? angTo(e.x, e.z, p.x, p.z) : tangent, 1.2 * dt);
  e.cd -= dt;
  const rage = e.hp < e.maxHp * 0.5;
  if (!e.phase && e.cd <= 0) {
    const pats = ['gatling', 'missiles', 'drop'];
    e.phase = pats[e.pat % 3]; e.pat++; e.pt = 0;
    if (e.phase === 'gatling') {
      // 플레이어를 가로지르는 선
      const a = world.rng.next() * Math.PI;
      const ux = Math.cos(a), uz = Math.sin(a);
      e.lineA = { x: p.x - ux * 7, y: p.y, z: p.z - uz * 7 };
      e.lineB = { x: p.x + ux * 7, y: p.y, z: p.z + uz * 7 };
      world.events.push({ t: 'tele', kind: 'gatling', id: e.id, a: e.lineA, b: e.lineB, time: c.gatlingWarn });
    } else if (e.phase === 'missiles') {
      e.targets = [];
      for (let i = 0; i < c.missileCount; i++) {
        const onCore = i >= c.missileCount - 2;
        const r = onCore ? 3 : 1 + world.rng.next() * 4, a = world.rng.next() * Math.PI * 2;
        const bx = onCore ? 0 : p.x, bz = onCore ? 0 : p.z;
        const x = bx + Math.cos(a) * r, z = bz + Math.sin(a) * r;
        e.targets.push({ x, z, y: Math.max(0, world.geom.heightAt(x, z)), t: c.missileWarn + i * 0.12 });
      }
      world.events.push({ t: 'tele', kind: 'mortar', id: e.id, targets: e.targets.map((q) => ({ ...q })) });
    } else {
      world.events.push({ t: 'tele', kind: 'drop', id: e.id });
    }
  }
  if (e.phase) {
    e.pt += dt;
    if (e.phase === 'gatling') {
      if (e.pt >= c.gatlingWarn) {
        const f = Math.min(1, (e.pt - c.gatlingWarn) / c.gatlingTime);
        const x = e.lineA.x + (e.lineB.x - e.lineA.x) * f, z = e.lineA.z + (e.lineB.z - e.lineA.z) * f;
        e.gunX = x; e.gunZ = z; e.firing = true;
        const y = world.geom.heightAt(x, z);
        e.gunY = y;
        if (Math.hypot(p.x - x, p.z - z) < c.gatlingWidth + 0.35 && Math.abs(p.y - y) < 2.5) world.hurtPlayer(c.gatlingDps * e.dmgMul * dt, e, 'gatling', false, true);
        if (Math.hypot(x, z) < CORE.radius + c.gatlingWidth) world.damageCore(c.gatlingDps * e.dmgMul * dt, e, 'gatling');
        if (f >= 1) { e.phase = null; e.firing = false; e.cd = rage ? c.patternGapRage : c.patternGap; }
      }
    } else if (e.phase === 'missiles') {
      for (const q of e.targets) {
        if (!q.done && e.pt >= q.t) { q.done = true; world.bossMissileImpact(e, q); }
      }
      if (e.targets.every((q) => q.done)) { e.phase = null; e.cd = rage ? c.patternGapRage : c.patternGap; }
    } else if (e.phase === 'drop') {
      if (e.pt >= 1.2) { world.bossDrop(e); e.phase = null; e.cd = rage ? c.patternGapRage : c.patternGap; }
    }
  }
}

const UPDATERS = { reaper, enforcer, leech, drone, mech, boss };

// 부위 판정 구: 월드 좌표 [x,y,z,r,종류]
export function enemyParts(e, out = []) {
  out.length = 0;
  const s = Math.sin(e.yaw), co = Math.cos(e.yaw);
  // 앞 = (−sin, −cos), 오른쪽 = (cos, −sin)
  if (e.type === 'boss') {
    const parts = bossParts(e);
    for (const q of parts) out.push(q);
    return out;
  }
  const crouch = e.type === 'reaper' && e.state === 'windup' ? 0.8 : 1;
  for (const q of e.c.parts) {
    const [rx, uy, fz, r, kind] = q;
    out.push({ x: e.x + co * rx - s * fz, y: e.y + uy * crouch, z: e.z - s * rx - co * fz, r, kind });
  }
  return out;
}

export function bossParts(e) {
  const s = Math.sin(e.yaw), co = Math.cos(e.yaw);
  const P = (rx, uy, fz, r, kind, idx) => ({ x: e.x + co * rx - s * fz, y: e.y + uy, z: e.z - s * rx - co * fz, r, kind, idx });
  const out = [P(0, 0, 0.5, 2.0, 'hull'), P(0, 0.2, -3.2, 1.5, 'hull'), P(0, -0.2, 4.2, 1.2, 'cockpit')];
  if (e.engines[0] > 0) out.push(P(4.3, 0.3, -0.5, 1.1, 'engine', 0));
  if (e.engines[1] > 0) out.push(P(-4.3, 0.3, -0.5, 1.1, 'engine', 1));
  return out;
}
