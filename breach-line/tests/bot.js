// 자동 플레이 봇: 리더를 실제 입력(world.input)으로만 조종해 작전을 끝까지 수행한다.
// 위치 정보는 전부 알고 있지만(해답 검증용), 이동·조준·사격·경고·체포는 사람과 같은 규칙을 따른다.
import { DT, CELL, SURRENDER } from '../js/config/balance.js';
import { findPath, toCell, cellCenter, cellType, T, doorAtCell } from '../js/sim/grid.js';
import { canSee, eyePos, actorHeight } from '../js/sim/combat.js';
import { yawTo, angleWrap, clamp, dist2D } from '../js/sim/geom.js';

const TURN = 9; // rad/s, 사람 손 속도 정도로 제한

export function makeBot(w) {
  const b = { lastShout: -9, warned: new Map(), path: null, pathGoal: null, repathAt: 0, stuckT: 0, lastPos: { x: w.leader.x, z: w.leader.z }, fHold: 0 };
  return (ww) => botTick(ww, b);
}

function aimToward(w, x, y, z) {
  const L = w.leader; const e = eyePos(L);
  const yaw = yawTo(e.x, e.z, x, z);
  const pitch = Math.atan2(y - e.y, Math.hypot(x - e.x, z - e.z));
  const dy = angleWrap(yaw - L.yaw); const dp = pitch - L.pitch;
  const m = TURN * DT;
  w.input.dyaw = clamp(dy, -m, m); w.input.dpitch = clamp(dp, -m, m);
  return Math.abs(dy) + Math.abs(dp);
}

function passable(w, allowLocked) {
  return (c, r) => {
    const t = cellType(w.g, c, r);
    if (t === T.FLOOR) return true;
    if (t !== T.DOOR) return false;
    const d = w.doors[doorAtCell(w.g, c, r)];
    if (d.open || d.broken) return true;
    return allowLocked || (!d.locked && !d.barricade);
  };
}

function botTick(w, b) {
  const L = w.leader; const inp = w.input;
  inp.mx = 0; inp.mz = 0; inp.fire = false; inp.fDown = false; inp.sprint = false; inp.dyaw = 0; inp.dpitch = 0;
  if (L.state === 'down') return;
  const gun = L.weapons[L.slot];
  if (gun.mag === 0 && gun.reserve > 0 && !L.reloadUntil) inp.reload = true;
  if (gun.mag === 0 && gun.reserve === 0 && L.slot === 'primary') inp.slot = 'secondary';

  // 1) 보이는 용의자 처리
  let tgt = null; let td = Infinity;
  for (const s of w.actors) {
    if (s.kind !== 'suspect' && s.kind !== 'dummy') continue;
    if (s.state === 'down' || s.state === 'arrested' || s.state === 'surrendered') continue;
    const v = canSee(w, L, s, 180, 22);
    if (v && v.dist < td) { td = v.dist; tgt = s; }
  }
  if (tgt) {
    const h = actorHeight(tgt);
    const warned = b.warned.get(tgt.id) || 0;
    const threat = tgt.kind === 'dummy' || (tgt.state === 'engage' && !(tgt.stunUntil > w.time)) || w.time - (tgt.firedAt ?? -9) < 2;
    if (threat || warned >= 3 || tgt.sub === 'heavy') {
      const err = aimToward(w, tgt.x, h - 0.12, tgt.z);
      if (err < 0.03) inp.fire = !(L.fireLatch && !(gunAuto(L)));
      return;
    }
    if (td <= SURRENDER.shoutRange - 0.5) {
      aimToward(w, tgt.x, h * 0.6, tgt.z);
      if (w.time - b.lastShout > SURRENDER.cooldown + 0.05) { inp.shout = true; b.lastShout = w.time; b.warned.set(tgt.id, warned + 1); }
      return;
    }
    // 멀면 다가간다(아래 이동 로직으로)
  }

  // 2) 체포·확보할 대상, 3) 남은 목표
  let goal = null; let restrain = null; let gd = Infinity;
  for (const a of w.actors) {
    const r = (a.kind === 'suspect' && a.state === 'surrendered') || (a.kind === 'hostage' && a.state === 'captive');
    const remaining = ((a.kind === 'suspect' || a.kind === 'dummy') && a.state !== 'down' && a.state !== 'arrested');
    if (!r && !remaining) continue;
    const d = dist2D(a, L) * (r ? 0.6 : 1);
    if (d < gd) { gd = d; goal = a; restrain = r ? a : null; }
  }
  if (!goal) return;
  if (restrain && dist2D(restrain, L) < 1.25) {
    aimToward(w, restrain.x, 0.6, restrain.z);
    inp.fDown = true;
    return;
  }
  // 이동
  const start = toCell(L.x, L.z); const end = toCell(goal.x, goal.z);
  const gkey = end.r * w.g.w + end.c;
  if (!b.path || b.pathGoal !== gkey || w.time >= b.repathAt) {
    b.path = findPath(w.g, start, end, passable(w, false)) || findPath(w.g, start, end, passable(w, true)) || [];
    b.pathGoal = gkey; b.repathAt = w.time + 0.5;
  }
  while (b.path.length && toCell(L.x, L.z).c === b.path[0].c && toCell(L.x, L.z).r === b.path[0].r) b.path.shift();
  const next = b.path[0];
  if (!next) return;
  const di = doorAtCell(w.g, next.c, next.r);
  if (di >= 0 && !w.doors[di].open && !w.doors[di].broken) {
    const dc = cellCenter(next.c, next.r);
    if (dist2D(L, dc) > 1.5) { stepToward(w, dc); return; }
    aimToward(w, dc.x, 1.0, dc.z);
    if (w.doors[di].locked || w.doors[di].barricade) {
      if (!b.breachOrdered) { w.command('all', { type: 'breach', door: di, mode: 'c2' }); b.breachOrdered = true; }
      return;
    }
    inp.fDown = true;
    return;
  }
  stepToward(w, cellCenter(next.c, next.r));
  // 막힘 감지
  if (dist2D(L, b.lastPos) > 0.3) { b.lastPos = { x: L.x, z: L.z }; b.stuckT = 0; } else { b.stuckT += DT; if (b.stuckT > 1.5) { inp.mx = Math.sin(w.time * 3) > 0 ? 1 : -1; b.repathAt = 0; } }
}

function gunAuto(L) { return L.weapons[L.slot].id !== 'shotgun' && L.weapons[L.slot].id !== 'pistol'; }

function stepToward(w, p) {
  const L = w.leader;
  const e = eyePos(L);
  const err = aimToward(w, p.x, e.y, p.z);
  w.input.mz = err < 0.6 ? 1 : 0.2;
}

export function playMission(w, maxSeconds = 900) {
  const tick = makeBot(w);
  const n = maxSeconds * 60;
  for (let i = 0; i < n && !w.result; i++) { tick(w); w.step(); }
  return w.result;
}

void CELL;
