// 기지 방어 로봇 AI. 모든 공격은 예고(telegraph) 후 발동한다.
import { ENEMIES } from '../config/balance.js';

let nextId = 1;

export function makeEnemy(type, x, y, z, hpMul, dmgMul, extra = {}) {
  const c = ENEMIES[type];
  const hp = c.hp * hpMul;
  return {
    id: nextId++, type, c, x, y, z, px: x, py: y, pz: z, vx: 0, vy: 0, vz: 0,
    yaw: 0, r: c.radius, h: c.height || 1.8, grounded: false, landSpeed: 0,
    hp, maxHp: hp, dmgMul, alive: true, state: 'spawn', t: 0, stun: 0, stagger: 0, flash: 0,
    attackT: 0, cd: 0, moveSpeed: 0, anim: (((x * 12.9898 + z * 78.233) % 1) + 1) % 1 * 10, hitDir: 0, ...extra,
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

// ── 수리 로봇: 아군 뒤에 숨어 가장 많이 다친 로봇을 고친다. 맞으면 잠깐 끊긴다 ──
function woundedAlly(world, e, range) {
  let best = null, bf = 0.999;
  for (const o of world.enemies) {
    if (!o.alive || o === e || o.type === 'boss' || o.type === 'drone') continue;
    const f = o.hp / o.maxHp;
    if (f >= bf) continue;
    if (range && Math.hypot(o.x - e.x, o.z - e.z) > range) continue;
    best = o; bf = f;
  }
  return best;
}

function leech(world, e, dt) {
  const c = e.c, p = world.player;
  e.t += dt;
  if (e.interrupt > 0) e.interrupt -= dt;
  if (e.state === 'spawn') e.state = 'move';
  const dP = Math.hypot(p.x - e.x, p.z - e.z);
  if (e.state === 'heal') {
    const o = e.healTarget;
    physics(world, e, 0, 0, dt, 40);
    if (!o || !o.alive || o.hp >= o.maxHp || Math.hypot(o.x - e.x, o.z - e.z) > c.healRange + 1 || !world.geom.los(e.x, e.y + 1, e.z, o.x, o.y + 0.8, o.z)) {
      e.state = 'move'; e.healTarget = null; e.healId = 0; return;
    }
    e.yaw = turn(e.yaw, angTo(e.x, e.z, o.x, o.z), 6 * dt);
    e.healing = e.interrupt <= 0;
    if (e.healing) o.hp = Math.min(o.maxHp, o.hp + c.heal * dt);
    if (dP < c.keepDist * 0.5) { e.state = 'move'; e.healTarget = null; e.healId = 0; }
    return;
  }
  e.healing = false;
  // 고칠 아군이 근처에 있으면 수리 시작
  const near = woundedAlly(world, e, c.healRange);
  if (near && dP > c.keepDist * 0.5 && world.geom.los(e.x, e.y + 1, e.z, near.x, near.y + 0.8, near.z)) {
    e.state = 'heal'; e.healTarget = near; e.healId = near.id; e.interrupt = 0;
    world.events.push({ t: 'medicLink', id: e.id, target: near.id });
    return;
  }
  // 지켜 줄 아군이 하나도 없으면 숨지 않고 플레이어 쪽으로 나온다(웨이브가 끝나지 않는 교착 방지)
  const allies = world.enemies.some((o) => o.alive && o !== e && o.type !== 'leech' && o.type !== 'drone');
  if (!allies) {
    // 7 m 안이라도 플레이어가 못 보는 곳(높은 단 위·벽 뒤)이면 보일 때까지 계속 다가온다
    const seen = world.geom.los(e.x, e.y + 1, e.z, p.x, p.y + 1.4, p.z);
    const go = dP > 7 || !seen;
    const v = go ? steer(world, e, world.fieldPlayer, c.speed * 0.7) : { x: 0, z: 0 };
    physics(world, e, v.x, v.z, dt);
    if (go) faceMove(e, dt); else e.yaw = turn(e.yaw, angTo(e.x, e.z, p.x, p.z), 4 * dt);
    return;
  }
  // 아니면: 다친 아군 쪽으로 / 플레이어와 거리를 유지(가까우면 물러나고 멀면 다가감)
  const far = woundedAlly(world, e, 0);
  let vx = 0, vz = 0;
  if (far && dP > c.keepDist * 0.6) {
    const dx = far.x - e.x, dz = far.z - e.z, l = Math.hypot(dx, dz) || 1;
    vx = (dx / l) * c.speed; vz = (dz / l) * c.speed;
  } else if (dP < c.keepDist) {
    const v = steer(world, e, world.fieldPlayer, c.speed);
    vx = -v.x; vz = -v.z;                       // 거리장 반대 = 플레이어에게서 멀어짐
  } else if (dP > c.keepDist + 6) {
    const v = steer(world, e, world.fieldPlayer, c.speed * 0.8);
    vx = v.x; vz = v.z;
  }
  physics(world, e, vx, vz, dt);
  if (Math.hypot(vx, vz) > 0.3) faceMove(e, dt); else e.yaw = turn(e.yaw, angTo(e.x, e.z, p.x, p.z), 4 * dt);
}

// ── 스웜 드론: 무리 비행 → 깜빡임(예고) → 돌진 자폭 ─────────────
function drone(world, e, dt) {
  const c = e.c, p = world.player;
  e.t += dt;
  const tx = p.x, tz = p.z, ty = p.y + 1.1;
  const dx = tx - e.x, dz = tz - e.z, dy = ty - e.y;
  const dh = Math.hypot(dx, dz);
  const dist3 = Math.hypot(dx, dy, dz);
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
    if (e.t >= c.windup) { const l2 = Math.hypot(dx, dy, dz) || 1; e.state = 'dive'; e.t = 0; e.dvx = dx / l2; e.dvy = dy / l2; e.dvz = dz / l2; }
  } else { // dive: 시작할 때 정한 방향으로 곧게(옆으로 비키면 빗나간다)
    wvx = e.dvx * c.diveSpeed; wvy = e.dvy * c.diveSpeed; wvz = e.dvz * c.diveSpeed;
    if (dist3 < 1.0 || e.t > 0.9) { world.droneExplode(e, true); return; }
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

// ── 무인 전투차량: 플레이어에게 다가가 장갑판을 돌려 대고, 가까우면 들이받기 / 멀면 미사일(레이저 예고) ──
function mech(world, e, dt) {
  const c = e.c, p = world.player;
  e.t += dt; e.cd -= dt; e.mcd = (e.mcd ?? 3) - dt; e.shieldOff = Math.max(0, (e.shieldOff || 0) - dt);
  e.attackT -= dt;
  if (e.state === 'spawn') e.state = 'advance';
  const dP = Math.hypot(p.x - e.x, p.z - e.z);
  // 장갑판(정면)은 플레이어를 향해 천천히 돈다(돌아 들어가면 뒤 엔진을 칠 수 있다)
  e.yaw = turn(e.yaw, angTo(e.x, e.z, p.x, p.z), c.turnRate * dt);
  const sees = world.geom.los(e.x, e.y + 2, e.z, p.x, p.y + 1.2, p.z);
  if (e.state === 'advance') {
    if (dP <= c.punchRange) { e.state = 'punch'; e.cd = 0.8; }
    else if (dP > c.holdDist || !sees) { const v = steer(world, e, world.fieldPlayer, c.speed); physics(world, e, v.x, v.z, dt, 8); }
    else physics(world, e, 0, 0, dt, 8);
  } else if (e.state === 'punch') {
    // 들이받기: 짧게 돌진
    const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
    physics(world, e, fx * (e.cd < 0.3 ? 5 : 0), fz * (e.cd < 0.3 ? 5 : 0), dt, 20);
    if (dP > c.punchRange + 1.5) e.state = 'advance';
    if (e.cd <= 0.6 && e.cd + dt > 0.6) world.events.push({ t: 'tele', kind: 'punch', id: e.id });
    if (e.cd <= 0) {
      e.cd = c.punchEvery; e.attackT = 0.5;
      if (dP <= c.punchRange + 0.4 && Math.abs(p.y - e.y) < 1.5) world.hurtPlayer(c.punchDmg * e.dmgMul, e, 'ram');
      world.events.push({ t: 'punch', id: e.id });
    }
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
        const r = i === 0 ? 0.5 : 1 + world.rng.next() * 5, a = world.rng.next() * Math.PI * 2;
        const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
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
