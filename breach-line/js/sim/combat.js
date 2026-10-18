// 사격·피해·시선 판정. 모든 탄은 즉시 판정(히트스캔)이고, 빗나간 탄도 끝까지 날아가 뒤에 있는 사람을 맞힐 수 있다.
import { BODY, ZONE_MULT, SCORE, CELL } from '../config/balance.js';
import { raycastGrid, cellType, T } from './grid.js';
import { rayCylinder, segmentHitsSphere } from './geom.js';

export const FRIENDLY = (a) => a.kind === 'leader' || a.kind === 'squad';
export const INNOCENT = (a) => a.kind === 'hostage' || a.kind === 'civilian';

export function isDown(a) { return a.state === 'down'; }

export function actorHeight(a) {
  if (a.state === 'down') return 0.35;
  if (a.kind === 'dummy') return BODY.standH;
  if (a.state === 'surrendered' || a.state === 'arrested' || a.state === 'captive' || a.state === 'secured') return BODY.kneelH;
  return a.crouch ? BODY.crouchH : BODY.standH;
}
export function eyeHeight(a) {
  const h = actorHeight(a);
  return a.crouch ? BODY.eyeCrouch : h - 0.15;
}
// 기울이기 반영한 눈 위치
export function eyePos(a) {
  const lean = a.lean || 0;
  return {
    x: a.x + Math.cos(a.yaw) * lean * 0.35,
    y: eyeHeight(a),
    z: a.z - Math.sin(a.yaw) * lean * 0.35,
  };
}

// 두 점 사이 시야가 트였는지(벽·문·엄폐물·연막)
export function clearLine(w, p0, p1, ignoreSmoke = false) {
  if (raycastGrid(w.g, w.doors, p0.x, p0.y, p0.z, p1.x, p1.y, p1.z)) return false;
  if (!ignoreSmoke) {
    for (const s of w.smokes) {
      if (s.until > w.time && segmentHitsSphere(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, s.x, 1.0, s.z, s.r)) return false;
    }
  }
  return true;
}

// 관찰자가 대상을 볼 수 있는지: 머리·몸통 두 점 중 하나라도 보이면 true. covered = 몸통은 가려지고 머리만 보임.
export function canSee(w, viewer, target, fovDeg, range) {
  const dx = target.x - viewer.x; const dz = target.z - viewer.z;
  const d = Math.hypot(dx, dz);
  if (d > range) return null;
  if (fovDeg < 180 && d > 0.8) {
    const fwdX = -Math.sin(viewer.yaw); const fwdZ = -Math.cos(viewer.yaw);
    const cos = (dx * fwdX + dz * fwdZ) / d;
    if (cos < Math.cos((fovDeg * Math.PI) / 180)) return null;
  }
  const eye = eyePos(viewer);
  // 낮은 엄폐물 바로 뒤(1.6m 이내)에 숙인 사람은 보이지 않는다 — 기획서 규칙
  if (target.crouch && coverNear(w, target, viewer, 1.6)) return null;
  const th = actorHeight(target);
  const head = { x: target.x, y: th - 0.12, z: target.z };
  const torso = { x: target.x, y: th * 0.6, z: target.z };
  const headOk = clearLine(w, eye, head);
  const torsoOk = clearLine(w, eye, torso);
  if (!headOk && !torsoOk) return null;
  return { dist: d, covered: headOk && !torsoOk };
}

function coverNear(w, target, viewer, len) {
  const dx = viewer.x - target.x; const dz = viewer.z - target.z;
  const d = Math.hypot(dx, dz) || 1;
  const n = Math.ceil(len / 0.2);
  for (let i = 1; i <= n; i++) {
    const t = Math.min(len, d) * (i / n);
    const c = Math.floor((target.x + (dx / d) * t) / CELL); const r = Math.floor((target.z + (dz / d) * t) / CELL);
    if (cellType(w.g, c, r) === T.COVER) return true;
  }
  return false;
}

// 탄 경로에 처음 걸리는 사람(같은 편·무고한 사람 오사 방지 확인용)
export function firstActorOnLine(w, shooter, o, p) {
  const dx = p.x - o.x; const dy = p.y - o.y; const dz = p.z - o.z;
  const L = Math.hypot(dx, dy, dz);
  const dir = { x: dx / L, y: dy / L, z: dz / L };
  let best = null; let bt = L + 0.5;
  for (const a of w.actors) {
    if (a === shooter || a.state === 'down') continue;
    const r = rayCylinder(o, dir, bt, a.x, a.z, BODY.radius + 0.08, actorHeight(a));
    if (r && r.t < bt) { bt = r.t; best = a; }
  }
  return best;
}

function zoneFor(a, y) {
  const h = actorHeight(a);
  if (a.state === 'down') return 'torso';
  if (y > h - BODY.headR * 2) return 'head';
  if (y > h * 0.45) return 'torso';
  return 'limb';
}

// 히트스캔 1발. 맞은 대상/지점을 돌려주고 피해까지 적용한다.
export function fireRay(w, shooter, origin, dir, range, damage, opts = {}) {
  const end = { x: origin.x + dir.x * range, y: origin.y + dir.y * range, z: origin.z + dir.z * range };
  // 바닥·천장
  let maxT = range;
  if (dir.y < -1e-4) maxT = Math.min(maxT, -origin.y / dir.y);
  if (dir.y > 1e-4) maxT = Math.min(maxT, (2.8 - origin.y) / dir.y);
  const gh = raycastGrid(w.g, w.doors, origin.x, origin.y, origin.z, end.x, end.y, end.z);
  let wallT = gh ? gh.t * range : Infinity;
  let hitActor = null; let hitT = Math.min(maxT, wallT); let hitY = 0;
  for (const a of w.actors) {
    if (a === shooter) continue;
    if (a.state === 'down' && a.kind !== 'dummy') continue;
    if (a.kind === 'dummy' && a.state === 'down') continue;
    const r = rayCylinder(origin, dir, hitT, a.x, a.z, BODY.radius, actorHeight(a));
    if (r && r.t < hitT) { hitT = r.t; hitActor = a; hitY = r.y; }
  }
  const point = { x: origin.x + dir.x * hitT, y: origin.y + dir.y * hitT, z: origin.z + dir.z * hitT };
  if (hitActor) {
    const zone = zoneFor(hitActor, hitY);
    applyDamage(w, hitActor, damage, zone, shooter);
    return { actor: hitActor, zone, point };
  }
  if (gh && hitT >= wallT - 1e-6) {
    if (gh.kind === 'door') {
      const di = w.g.doorAt[gh.r * w.g.w + gh.c];
      if (opts.breaksLock && hitT <= 3.2) breakDoor(w, di, 'shotgun');
    }
    return { actor: null, wall: gh.kind, point };
  }
  return { actor: null, point };
}

export function breakDoor(w, di, how) {
  const d = w.doors[di];
  if (d.open && d.broken) return;
  if (d.barricade && how !== 'c2') return;
  d.locked = false; d.barricade = false; d.open = true; d.broken = true;
  w.emit({ type: 'door', id: di, open: true, broken: true, how });
  const dd = w.g.doors[di];
  w.noise((dd.c + 0.5) * CELL, (dd.r + 0.5) * CELL, 15, null);
}

export function applyDamage(w, a, damage, zone, shooter) {
  let dmg = damage * ZONE_MULT[zone];
  if (a.sub === 'heavy' && zone === 'torso') dmg *= 0.5;
  if (a.kind === 'dummy') dmg = 999;
  const wasState = a.state;
  a.hp -= dmg;
  w.stats.damageLog.push({ t: w.time, target: a.id, zone, dmg, by: shooter ? shooter.id : null });
  w.emit({ type: 'hit', id: a.id, zone, dmg, by: shooter ? shooter.id : null, x: a.x, z: a.z });
  const friendlyShooter = shooter && FRIENDLY(shooter);
  // 교전 규칙: 무고한 사람·항복한 사람을 쏘면 처음 맞힌 순간 감점
  if (friendlyShooter && !a.penalized) {
    if (INNOCENT(a)) {
      a.penalized = true;
      w.stats.innocentShots++;
      w.stats.violations.push({ t: w.time, by: shooter.name, what: `${a.name}을(를) 쐈습니다`, pts: SCORE.innocentShot });
      w.notice(`민간인·인질 피격! (${SCORE.innocentShot}점)`, 'bad');
    } else if (a.kind === 'suspect' && (wasState === 'surrendered' || wasState === 'arrested')) {
      a.penalized = true;
      w.stats.unjustified++;
      w.stats.violations.push({ t: w.time, by: shooter.name, what: `항복한 ${a.name}을(를) 쐈습니다`, pts: SCORE.unjustified });
      w.notice(`정당하지 않은 사살! (${SCORE.unjustified}점)`, 'bad');
    }
  }
  if (a.kind === 'suspect' && wasState !== 'surrendered' && wasState !== 'arrested' && wasState !== 'down') {
    // 맞으면 바로 교전 상태로
    if (shooter && FRIENDLY(shooter)) { a.target = shooter.id; a.lastSeenX = shooter.x; a.lastSeenZ = shooter.z; }
    if (wasState === 'idle' || wasState === 'alert') { a.state = 'engage'; a.reactAt = w.time + 0.25; }
  }
  if (a.hp <= 0 && wasState !== 'down') kill(w, a, shooter, wasState);
}

function kill(w, a, shooter, wasState) {
  a.hp = 0;
  a.state = 'down';
  a.firingAt = null;
  a.downAt = w.time;
  w.emit({ type: 'down', id: a.id, kind: a.kind });
  if (a.kind === 'suspect') {
    if (wasState !== 'surrendered' && wasState !== 'arrested') {
      w.stats.kills++;
      w.dropEvidence(a);
    }
    w.notice(`${a.name} 무력화`, 'info');
  } else if (a.kind === 'dummy') {
    w.stats.dummies++;
    w.notice(`표적 ${w.stats.dummies}/${w.countKind('dummy')}`, 'info');
  } else if (a.kind === 'hostage') {
    w.stats.hostageDeaths++;
    w.notice('인질 사망!', 'bad');
  } else if (a.kind === 'civilian') {
    w.stats.civilianDeaths++;
    w.notice('민간인 사망!', 'bad');
  } else if (a.kind === 'squad') {
    w.stats.squadInjured++;
    w.notice(`${a.name} 부상 — 행동 불가`, 'bad');
  } else if (a.kind === 'leader') {
    w.notice('리더 쓰러짐', 'bad');
  }
}
