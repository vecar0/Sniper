// 용의자 AI. 상태: idle(대기) → alert(경계) → engage(교전) / surrendered(항복) / arrested(체포) / down(쓰러짐)
import { SENSE, REACTION, ENEMY_WEAPON, ACCURACY, MAX_SHOOTERS_PER_TARGET, SURRENDER, MOVE } from '../config/balance.js';
import { canSee, fireRay, eyePos, actorHeight, FRIENDLY, firstActorOnLine } from './combat.js';
import { yawTo, turnToward, clamp, angleWrap } from './geom.js';
import { roomAtWorld } from './grid.js';

export function updateSuspects(w, dt) {
  // 이번 틱에 각 아군을 겨누고 사격 중인 용의자 수(한 대상 최대 2명)
  const shooters = new Map();
  for (const s of w.actors) {
    if (s.kind === 'suspect' && s.state === 'engage' && s.target != null && s.firingAt === s.target) {
      shooters.set(s.target, (shooters.get(s.target) || 0) + 1);
    }
  }
  for (const s of w.actors) {
    if (s.kind !== 'suspect') continue;
    if (s.state === 'down' || s.state === 'arrested') continue;
    if (s.state === 'surrendered') { s.firingAt = null; continue; }
    const stunned = s.stunUntil > w.time;
    if (stunned) { s.firingAt = null; s.burstLeft = 0; continue; }

    s.perceiveAt = (s.perceiveAt ?? 0) - dt;
    if (s.perceiveAt <= 0) {
      s.perceiveAt = SENSE.perceptionInterval;
      perceive(w, s);
    }

    if (s.state === 'alert' && s.lookX != null) {
      s.yaw = turnToward(s.yaw, yawTo(s.x, s.z, s.lookX, s.lookZ), MOVE.turnRate * dt);
    }
    if (s.state === 'engage') {
      const t = w.byId(s.target);
      if (!t || t.state === 'down') { s.state = 'alert'; s.target = null; s.firingAt = null; continue; }
      const aimYaw = yawTo(s.x, s.z, s.lastSeenX, s.lastSeenZ);
      s.yaw = turnToward(s.yaw, aimYaw, MOVE.turnRate * 1.5 * dt);
      const seen = w.time - s.lastSeenAt < 0.25;
      if (!seen) {
        s.firingAt = null;
        if (w.time - s.lastSeenAt > SENSE.forgetTime) { s.state = 'alert'; s.lookX = s.lastSeenX; s.lookZ = s.lastSeenZ; s.target = null; }
        continue;
      }
      const facing = Math.abs(angleWrap(s.yaw - aimYaw)) < 0.25;
      if (w.time < s.reactAt || !facing) continue;
      if (s.firingAt !== s.target) {
        const n = shooters.get(s.target) || 0;
        if (n >= MAX_SHOOTERS_PER_TARGET) continue;
        s.firingAt = s.target;
        shooters.set(s.target, n + 1);
      }
      if (w.time >= s.nextFire) enemyShoot(w, s, t);
    }
  }
}

function perceive(w, s) {
  let best = null; let bestD = Infinity; let bestVis = null;
  for (const f of w.actors) {
    if (!FRIENDLY(f) || f.state === 'down') continue;
    const vis = canSee(w, s, f, SENSE.fovDeg, SENSE.sightRange);
    if (vis && vis.dist < bestD) { best = f; bestD = vis.dist; bestVis = vis; }
  }
  if (!best) return;
  if (s.state === 'idle' || s.state === 'alert') {
    s.state = 'engage';
    s.reactAt = w.time + REACTION[s.sub];
    w.alertNearby(s, 6);
  }
  if (s.target !== best.id) {
    // 대상이 바뀌면 다시 조준할 시간
    if (s.target != null) s.reactAt = Math.max(s.reactAt, w.time + REACTION[s.sub] * 0.5);
    s.target = best.id;
    s.firingAt = null;
  }
  s.lastSeenX = best.x; s.lastSeenZ = best.z; s.lastSeenAt = w.time;
  s.targetCovered = bestVis.covered;
  s.seenBy = w.time;
}

export function hitChance(base, dist, moving, covered) {
  const k = clamp((dist - ACCURACY.near) / (ACCURACY.far - ACCURACY.near), 0, 1);
  const distMult = 1 + (ACCURACY.farMult - 1) * k;
  return base * distMult * (moving ? ACCURACY.movingMult : 1) * (covered ? ACCURACY.coverMult : 1);
}

function enemyShoot(w, s, t) {
  const wpn = ENEMY_WEAPON[s.sub];
  const eye = eyePos(s);
  const th = actorHeight(t);
  const d = Math.hypot(t.x - s.x, t.z - s.z);
  const moving = Math.hypot(t.vx || 0, t.vz || 0) > 0.5;
  const p = hitChance(ACCURACY.enemyBase, d, moving, s.targetCovered);
  const hit = w.rng() < p;
  let ax = t.x; let az = t.z; let ay;
  if (hit) {
    ay = w.rng() < 0.12 ? th - 0.12 : th * (0.5 + w.rng() * 0.3);
    if (s.targetCovered) ay = th - 0.12;
  } else {
    // 확실히 빗나가는 방향: 좌우 0.6~1.2m 또는 위로
    const side = (w.rng() < 0.5 ? -1 : 1) * (0.6 + w.rng() * 0.6);
    const px = -(t.z - s.z) / (d || 1); const pz = (t.x - s.x) / (d || 1);
    ax += px * side; az += pz * side;
    ay = th * (0.3 + w.rng() * 0.9);
  }
  const dx = ax - eye.x; const dy = ay - eye.y; const dz = az - eye.z;
  const L = Math.hypot(dx, dy, dz);
  const dir = { x: dx / L, y: dy / L, z: dz / L };
  // 같은 편이 사선에 있으면 쏘지 않고 잠깐 기다린다
  const blocker = firstActorOnLine(w, s, eye, { x: t.x, y: th * 0.6, z: t.z });
  if (blocker && blocker.kind === 'suspect') { s.nextFire = w.time + 0.3; return; }
  const res = fireRay(w, s, eye, dir, 40, wpn.damage);
  w.emit({ type: 'shot', by: s.id, weapon: s.sub, from: eye, to: res.point, hit: !!res.actor, enemy: true });
  w.noise(s.x, s.z, 999, s);
  s.firedAt = w.time;
  s.burstLeft = (s.burstLeft || wpn.burst) - 1;
  if (s.burstLeft <= 0) { s.burstLeft = wpn.burst; s.nextFire = w.time + wpn.interval + (wpn.burstPause || 0); } else s.nextFire = w.time + wpn.interval;
}

// 소리를 들으면 대기 → 경계, 소리 쪽을 본다.
export function hearNoise(w, s, x, z) {
  if (s.kind !== 'suspect' || s.state === 'down' || s.state === 'surrendered' || s.state === 'arrested') return;
  if (s.state === 'idle') { s.state = 'alert'; }
  if (s.state === 'alert') { s.lookX = x; s.lookZ = z; }
}

// 경고("손들어!") 1회에 대한 항복 판정. 성공하면 true.
export function surrenderChance(w, s) {
  let p = SURRENDER.base[s.sub];
  if (s.stunUntil > w.time) p += SURRENDER.flashed;
  if (aimersCount(w, s) >= 2) p += SURRENDER.aimedByTwo;
  if (s.hp < s.maxHp * 0.5) p += SURRENDER.lowHp;
  const room = roomAtWorld(w.g, s.x, s.z);
  if (w.actors.some((o) => o !== s && o.kind === 'suspect' && (o.state === 'down' || o.state === 'arrested' || o.state === 'surrendered') && roomAtWorld(w.g, o.x, o.z) === room)) p += SURRENDER.allyDown;
  return clamp(p, 0, 0.95);
}

export function aimersCount(w, s) {
  let n = 0;
  const cone = Math.cos((SURRENDER.aimConeDeg * Math.PI) / 180);
  for (const f of w.actors) {
    if (!FRIENDLY(f) || f.state === 'down') continue;
    const dx = s.x - f.x; const dz = s.z - f.z; const d = Math.hypot(dx, dz);
    if (d > 12 || d < 0.1) continue;
    const fx = -Math.sin(f.yaw); const fz = -Math.cos(f.yaw);
    if ((dx * fx + dz * fz) / d < cone) continue;
    if (!canSee(w, f, s, 180, 12)) continue;
    n++;
  }
  return n;
}

export function warnSuspect(w, s, shouter) {
  if (s.kind !== 'suspect') return false;
  if (s.state === 'down' || s.state === 'surrendered' || s.state === 'arrested') return false;
  if (w.time - (s.lastWarned ?? -99) < SURRENDER.cooldown) return false;
  s.lastWarned = w.time;
  s.warnedCount = (s.warnedCount || 0) + 1;
  const p = surrenderChance(w, s);
  if (w.rng() < p) {
    s.state = 'surrendered';
    s.firingAt = null;
    s.surrenderedAt = w.time;
    w.dropEvidence(s);
    w.emit({ type: 'surrender', id: s.id });
    w.notice(`${s.name} 항복`, 'good');
    return true;
  }
  // 실패: 30% 확률로 바로 사격, 아니면 경계하며 쳐다봄
  s.target = shouter.id; s.lastSeenX = shouter.x; s.lastSeenZ = shouter.z;
  if (w.rng() < SURRENDER.failShootChance) {
    s.state = 'engage';
    s.lastSeenAt = w.time;
    s.reactAt = w.time + 0.15;
  } else {
    if (s.state === 'idle') s.state = 'alert';
    s.lookX = shouter.x; s.lookZ = shouter.z;
  }
  w.emit({ type: 'refuse', id: s.id });
  return false;
}
