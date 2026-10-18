// 분대원 AI: 명령 수행(따라오기·대기·이동·쌓기·돌입·미러·체포) + 자동 교전·경고·체포.
import { SQUAD, MOVE, REACTION, ACCURACY, SURRENDER, FLASH, C2, CELL, BODY } from '../config/balance.js';
import { WEAPONS } from '../config/weapons.js';
import {
  findPath, blocksMove, toCell, cellCenter, resolveCircle, raycastGrid, stackCells, entryCells, roomAtWorld, cellType, T, roomAt,
} from './grid.js';
import { canSee, fireRay, eyePos, actorHeight, FRIENDLY, firstActorOnLine } from './combat.js';
import { hitChance, warnSuspect } from './ai.js';
import { yawTo, turnToward, angleWrap, rayCylinder, dist2D } from './geom.js';

let opSeq = 1;

// ───────────────────────── 명령 발행 ─────────────────────────
export function selectMembers(w, sel) {
  return w.squad.filter((m) => m.state !== 'down' && (sel === 'all' || m.team === sel));
}

export function issueCommand(w, sel, cmd, goWait = false) {
  const members = selectMembers(w, sel);
  if (!members.length) { w.notice('명령을 받을 대원이 없습니다', 'bad'); return null; }
  for (const m of members) detach(w, m);
  const label = sel === 'all' ? '전원' : sel === 'red' ? 'Red 팀' : 'Blue 팀';
  const op = { id: opSeq++, type: cmd.type, members: members.map((m) => m.id), sel, label, pending: goWait, go: false, phase: 'move', created: w.time };
  switch (cmd.type) {
    case 'follow':
      for (const m of members) m.order = { type: 'follow' };
      w.notice(`${label}: 따라와`, 'info');
      return null;
    case 'hold':
      for (const m of members) m.order = { type: 'hold', x: m.x, z: m.z, yaw: m.yaw };
      w.notice(`${label}: 대기`, 'info');
      return null;
    case 'move': {
      const spots = spreadCells(w, cmd.x, cmd.z, members.length);
      op.slots = spots;
      assignSlots(members, spots, op);
      break;
    }
    case 'stack': case 'breach': case 'mirror': {
      const door = w.g.doors[cmd.door];
      const nearIdx = cmd.nearIdx ?? nearSide(w, door, w.leader);
      op.door = cmd.door; op.nearIdx = nearIdx; op.farIdx = 1 - nearIdx; op.mode = cmd.mode || 'open';
      let slots = stackCells(w.g, door, nearIdx).map((c) => cellCenter(c.c, c.r));
      // 리더가 서 있는 칸은 비워 둔다(대원이 리더에게 막혀 대기가 안 끝나는 문제)
      const free = slots.filter((p) => dist2D(p, w.leader) > 0.7);
      if (free.length >= Math.min(members.length, slots.length)) slots = free;
      if (!slots.length) { w.notice('문 앞에 설 자리가 없습니다', 'bad'); return null; }
      const users = cmd.type === 'mirror' ? [nearestTo(members, slots[0])] : members;
      for (const m of members) if (!users.includes(m)) m.order = { type: 'hold', x: m.x, z: m.z, yaw: m.yaw };
      op.members = users.map((m) => m.id);
      op.slots = slots;
      assignSlots(users, slots, op);
      break;
    }
    case 'arrest': {
      const t = w.byId(cmd.target);
      if (!t) return null;
      const m = nearestTo(members, t);
      for (const o of members) if (o !== m) o.order = { type: 'hold', x: o.x, z: o.z, yaw: o.yaw };
      op.members = [m.id];
      op.target = t.id;
      t.claimedBy = m.id;
      m.order = { type: 'op', op: op.id };
      m.task = { type: 'arrest', target: t.id };
      break;
    }
    default:
      return null;
  }
  w.ops.push(op);
  const what = { move: '이동', stack: '문 앞 대기', breach: breachName(op.mode), mirror: '미러로 확인', arrest: '체포' }[cmd.type];
  w.notice(`${label}: ${what}${goWait ? ' (GO 대기)' : ''}`, 'info');
  return op;
}

export function breachName(mode) {
  return { open: '열고 정리', flash: '섬광 후 정리', c2: '폭파 후 정리' }[mode] || '정리';
}

function detach(w, m) {
  for (const op of w.ops) {
    const i = op.members.indexOf(m.id);
    if (i >= 0) op.members.splice(i, 1);
  }
  w.ops = w.ops.filter((op) => op.members.length > 0 || op.keep);
  if (m.task && m.task.target != null) { const t = w.byId(m.task.target); if (t && t.claimedBy === m.id) t.claimedBy = null; }
  m.task = null; m.path = null;
}

function nearSide(w, door, ref) {
  const a = cellCenter(door.sides[0].c, door.sides[0].r);
  const b = cellCenter(door.sides[1].c, door.sides[1].r);
  return dist2D(ref, a) <= dist2D(ref, b) ? 0 : 1;
}

function nearestTo(list, p) {
  let best = list[0]; let bd = Infinity;
  for (const m of list) { const d = dist2D(m, p); if (d < bd) { bd = d; best = m; } }
  return best;
}

function assignSlots(members, slots, op) {
  const free = slots.slice();
  // 가까운 대원부터 가장 가까운 자리로(앞자리 = 돌입 순서)
  const order = members.slice().sort((a, b) => dist2D(a, slots[0]) - dist2D(b, slots[0]));
  order.forEach((m, k) => {
    const s = free[Math.min(k, free.length - 1)] || slots[0];
    m.order = { type: 'op', op: op.id };
    m.slot = { x: s.x, z: s.z };
    m.entryIndex = k;
  });
  op.members = order.map((m) => m.id);
}

function spreadCells(w, x, z, n) {
  const c0 = toCell(x, z);
  const out = [];
  for (let ring = 0; ring < 4 && out.length < n; ring++) {
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue;
        const c = c0.c + dc; const r = c0.r + dr;
        if (cellType(w.g, c, r) === T.FLOOR && !out.some((p) => p.c === c && p.r === r)) out.push({ c, r });
        if (out.length >= n) break;
      }
      if (out.length >= n) break;
    }
  }
  if (!out.length) out.push(c0);
  return out.map((p) => cellCenter(p.c, p.r));
}

// GO 코드: 대기 중인 명령 전부 실행
export function goCode(w) {
  const pend = w.ops.filter((op) => op.pending && !op.go);
  if (!pend.length) { w.notice('GO 대기 중인 명령이 없습니다', 'info'); return 0; }
  for (const op of pend) op.go = true;
  w.emit({ type: 'go' });
  w.notice('GO! GO! GO!', 'good');
  return pend.length;
}

// ───────────────────────── 매 틱 갱신 ─────────────────────────
export function updateSquad(w, dt) {
  for (const m of w.squad) m.moving = false;
  for (const op of w.ops) updateOp(w, op, dt);
  w.ops = w.ops.filter((op) => !op.done);
  for (const m of w.squad) {
    if (m.state === 'down') { m.vx = m.vz = 0; continue; }
    combat(w, m, dt);
    if (!m.task) autoTask(w, m);
    if (m.task) doTask(w, m, dt);
    else if (m.order.type === 'follow') doFollow(w, m, dt);
    else if (m.order.type === 'hold') { m.vx = m.vz = 0; faceIdle(w, m, m.order.yaw, dt); }
    else if (m.order.type === 'op') { /* updateOp 이 이동을 지시 */ }
    if (!m.moving) { m.vx = 0; m.vz = 0; }
  }
}

function opMembers(w, op) { return op.members.map((id) => w.byId(id)).filter((m) => m && m.state !== 'down'); }

function updateOp(w, op, dt) {
  const ms = opMembers(w, op);
  if (!ms.length) { op.done = true; return; }
  if (op.type === 'move') {
    if (op.pending && !op.go) { for (const m of ms) { m.vx = m.vz = 0; } return; }
    let all = true;
    ms.forEach((m, k) => {
      if (m.task) { all = false; return; }
      const s = op.slots[Math.min(k, op.slots.length - 1)];
      if (!moveTo(w, m, s.x, s.z, MOVE.squadRun, dt)) all = false;
    });
    if (all) finish(w, op, ms);
    return;
  }
  if (op.type === 'arrest') {
    const m = ms[0];
    if (!m.task) finish(w, op, ms);
    return;
  }
  const door = w.g.doors[op.door];
  const dstate = w.doors[op.door];
  if (op.phase === 'move') {
    let arrived = 0;
    for (const m of ms) {
      if (m.task) continue;
      const there = moveTo(w, m, m.slot.x, m.slot.z, MOVE.squadWalk, dt, true);
      // 거의 도착했는데 누군가에게 막혀 있으면 그 자리에서 대기한 것으로 친다
      if (there || (w.time - op.created > 2.5 && dist2D(m, m.slot) < 1.3)) {
        arrived++;
        faceDoor(w, m, door, dt);
      }
    }
    if (arrived === ms.length || w.time - op.created > SQUAD.stackTimeout) {
      op.phase = 'ready';
      op.readyAt = w.time;
      if (op.type === 'stack') w.notice(`${op.label} 문 앞 대기`, 'info');
      else if (op.pending) w.notice(`${op.label} 준비 완료 — GO 대기`, 'info');
    }
    return;
  }
  if (op.phase === 'ready') {
    for (const m of ms) { if (!m.task) { moveTo(w, m, m.slot.x, m.slot.z, MOVE.squadWalk, dt, true); faceDoor(w, m, door, dt); } }
    if (op.type === 'stack') return; // 쌓기만: 다음 명령 때까지 대기
    if (op.type === 'mirror') {
      if (!op.mirrorAt) { op.mirrorAt = w.time + SQUAD.mirrorTime; w.notice(`${ms[0].name}: 미러 확인 중…`, 'info'); }
      if (w.time >= op.mirrorAt) {
        const room = door.rooms[op.farIdx];
        w.revealRoom(room, SQUAD.mirrorReveal, ms[0]);
        finish(w, op, ms);
      }
      return;
    }
    if (op.pending && !op.go) return;
    execute(w, op, ms, door, dstate);
    return;
  }
  if (op.phase === 'exec') {
    for (const m of ms) { if (!m.task) { moveTo(w, m, m.slot.x, m.slot.z, MOVE.squadWalk, dt, true); faceDoor(w, m, door, dt); } }
    if (op.c2At && w.time >= op.c2At && !op.c2Done) {
      op.c2Done = true;
      w.detonateC2(op.door, op.farIdx);
    }
    if (op.flashThrowAt && w.time >= op.flashThrowAt && !op.flashDone) {
      op.flashDone = true;
      const far = door.sides[op.farIdx];
      const fx = cellCenter(far.c, far.r);
      const dx = (far.c - door.c) * CELL; const dz = (far.r - door.r) * CELL;
      const thrower = ms[0];
      w.spawnGrenade('flash', thrower, { x: (door.c + 0.5) * CELL, y: 1.2, z: (door.r + 0.5) * CELL }, { x: dx * 2.2, y: 1.5, z: dz * 2.2 }, 0.55, fx);
    }
    if (w.time >= op.entryAt) { op.phase = 'entry'; op.entryStart = w.time; }
    return;
  }
  if (op.phase === 'entry') {
    if (!dstate.open) { op.phase = 'ready'; op.go = false; op.pending = false; return; }
    const targets = op.entryTargets;
    let all = true;
    ms.forEach((m, k) => {
      if (m.task) { all = false; return; }
      if (w.time < op.entryStart + k * SQUAD.entryInterval) { all = false; faceDoor(w, m, door, dt); return; }
      const tgt = targets[Math.min(k, targets.length - 1)];
      if (!moveTo(w, m, tgt.x, tgt.z, MOVE.squadRun, dt)) all = false;
      else if (!m.combatTarget) m.yaw = turnToward(m.yaw, yawTo(m.x, m.z, op.roomCenter.x, op.roomCenter.z), MOVE.turnRate * dt);
    });
    if (all || w.time - op.entryStart > 7) {
      finish(w, op, ms, op.roomCenter);
      w.notice(`${op.label}: 방 정리 완료`, 'info');
    }
  }
}

function execute(w, op, ms, door, dstate) {
  op.phase = 'exec';
  op.execAt = w.time;
  w.stats.execLog.push({ op: op.id, label: op.label, t: w.time });
  const far = door.sides[op.farIdx];
  const room = w.g.rooms[door.rooms[op.farIdx]];
  op.roomCenter = room.center;
  op.entryTargets = entryCells(w.g, door, op.farIdx).map((c) => cellCenter(c.c, c.r));
  if (!op.entryTargets.length) op.entryTargets = [cellCenter(far.c, far.r)];
  let mode = op.mode;
  if (mode === 'flash' && !takeItem(w, ms, 'flash')) { w.notice(`${op.label}: 섬광탄이 없어 그냥 진입합니다`, 'bad'); mode = 'open'; }
  if (mode === 'c2' && !takeItem(w, ms, 'c2')) { w.notice(`${op.label}: 폭약이 없습니다`, 'bad'); blocked(op); return; }
  if (mode !== 'c2' && !dstate.open && (dstate.locked || dstate.barricade)) {
    w.notice(dstate.barricade ? '바리케이드 — 폭약이 필요합니다' : '잠긴 문 — 폭약 또는 산탄총이 필요합니다', 'bad');
    blocked(op);
    return;
  }
  if (mode === 'c2') {
    op.c2At = w.time + C2.plantTime;
    op.entryAt = op.c2At + 0.35;
    w.emit({ type: 'c2plant', door: op.door });
    w.notice(`${op.label}: 폭약 설치 — 물러서!`, 'info');
    return;
  }
  if (!dstate.open) w.setDoor(op.door, true, ms[0]);
  if (mode === 'flash') {
    op.flashThrowAt = w.time + 0.2;
    op.entryAt = w.time + 0.2 + 0.55 + 0.35;
  } else {
    op.entryAt = w.time + 0.25;
  }
}

function blocked(op) { op.phase = 'ready'; op.pending = false; op.go = false; op.type = 'stack'; }

function takeItem(w, ms, item) {
  for (const m of ms) if (m.items[item] > 0) { m.items[item]--; return true; }
  // 같은 명령에 없는 대원 소지품도 쓴다(분대 공용)
  for (const m of w.squad) if (m.state !== 'down' && m.items[item] > 0) { m.items[item]--; return true; }
  return false;
}

function finish(w, op, ms, faceAt) {
  op.done = true;
  for (const m of ms) {
    if (m.order.type === 'op' && m.order.op === op.id) {
      const yaw = faceAt ? yawTo(m.x, m.z, faceAt.x, faceAt.z) : m.yaw;
      m.order = { type: 'hold', x: m.x, z: m.z, yaw };
    }
  }
}

// ───────────────────────── 이동 ─────────────────────────
function passableFn(w) { return (c, r) => !blocksMove(w.g, w.doors, c, r); }

function straightClear(w, ax, az, bx, bz) {
  // 대원 몸 폭을 고려해 좌우 두 줄로 확인
  const d = Math.hypot(bx - ax, bz - az) || 1;
  const px = -(bz - az) / d * 0.22; const pz = (bx - ax) / d * 0.22;
  for (const s of [-1, 1]) {
    if (raycastGrid(w.g, w.doors, ax + px * s, 0.3, az + pz * s, bx + px * s, 0.3, bz + pz * s)) return false;
  }
  return true;
}

// 목표까지 이동. 도착하면 true.
export function moveTo(w, m, gx, gz, speed, dt, precise = false) {
  const d = Math.hypot(gx - m.x, gz - m.z);
  const tol = precise ? 0.12 : 0.3;
  if (d < tol) { m.vx = m.vz = 0; return true; }
  let tx = gx; let tz = gz;
  if (!straightClear(w, m.x, m.z, gx, gz)) {
    const goalCell = toCell(gx, gz);
    if (!m.path || m.pathGoal !== goalCell.r * w.g.w + goalCell.c || w.time >= m.repathAt) {
      m.path = findPath(w.g, toCell(m.x, m.z), goalCell, passableFn(w)) || [];
      m.pathGoal = goalCell.r * w.g.w + goalCell.c;
      m.repathAt = w.time + 0.6;
    }
    // 바로 보이는 가장 먼 경유점을 노린다
    while (m.path.length > 1) {
      const nxt = cellCenter(m.path[1].c, m.path[1].r);
      if (straightClear(w, m.x, m.z, nxt.x, nxt.z)) m.path.shift(); else break;
    }
    if (m.path.length) {
      const p = cellCenter(m.path[0].c, m.path[0].r);
      if (Math.hypot(p.x - m.x, p.z - m.z) < 0.3 && m.path.length > 1) m.path.shift();
      const q = cellCenter(m.path[0].c, m.path[0].r);
      tx = q.x; tz = q.z;
    } else { m.vx = m.vz = 0; return false; }
  } else m.path = null;
  const dd = Math.hypot(tx - m.x, tz - m.z) || 1;
  const sp = Math.min(speed, (precise ? d : d + 0.5) / dt);
  m.vx = ((tx - m.x) / dd) * sp; m.vz = ((tz - m.z) / dd) * sp;
  m.moving = true;
  return false;
}

function doFollow(w, m, dt) {
  const L = w.leader;
  const followers = w.squad.filter((s) => s.state !== 'down' && !s.task && s.order.type === 'follow');
  const k = followers.indexOf(m);
  const back = SQUAD.followMin + 0.3 + k * 0.9;
  const dLeader = dist2D(m, L);
  const target = trailPoint(w, back);
  const seeLeader = straightClear(w, m.x, m.z, L.x, L.z);
  if (dLeader <= SQUAD.followMax + k * 0.9 && seeLeader) {
    m.vx = m.vz = 0;
    faceIdle(w, m, L.yaw + (k === 0 ? 0.9 : k === 1 ? -0.9 : Math.PI), dt);
    return;
  }
  moveTo(w, m, target.x, target.z, dLeader > 6 ? MOVE.squadRun : MOVE.squadWalk, dt);
}

function trailPoint(w, back) {
  const tr = w.trail;
  let acc = 0;
  let prev = { x: w.leader.x, z: w.leader.z };
  for (let i = tr.length - 1; i >= 0; i--) {
    const p = tr[i];
    const seg = Math.hypot(p.x - prev.x, p.z - prev.z);
    if (acc + seg >= back) {
      const t = (back - acc) / (seg || 1);
      return { x: prev.x + (p.x - prev.x) * t, z: prev.z + (p.z - prev.z) * t };
    }
    acc += seg; prev = p;
  }
  return prev;
}

function faceDoor(w, m, door, dt) {
  if (m.combatTarget || m.aimAt) return;
  const c = cellCenter(door.c, door.r);
  m.yaw = turnToward(m.yaw, yawTo(m.x, m.z, c.x, c.z), MOVE.turnRate * dt);
}
function faceIdle(w, m, yaw, dt) {
  if (m.combatTarget || m.aimAt) return;
  if (yaw != null) m.yaw = turnToward(m.yaw, yaw, MOVE.turnRate * 0.5 * dt);
}

// ───────────────────────── 자동 체포·인질 확보 ─────────────────────────
function autoTask(w, m) {
  if (m.order.type === 'op') return;
  if (m.combatTarget) return;
  let best = null; let bd = SQUAD.autoArrestRange;
  for (const t of w.actors) {
    const want = (t.kind === 'suspect' && t.state === 'surrendered') || ((t.kind === 'hostage' || t.kind === 'civilian') && t.state === 'captive');
    if (!want || (t.claimedBy != null && t.claimedBy !== m.id)) continue;
    const d = dist2D(m, t);
    if (d < bd && canSee(w, m, t, 180, bd)) { bd = d; best = t; }
  }
  if (best) {
    best.claimedBy = m.id;
    m.task = { type: 'arrest', target: best.id, resume: m.order };
  }
}

function doTask(w, m, dt) {
  const t = w.byId(m.task.target);
  const done = () => { if (t && t.claimedBy === m.id) t.claimedBy = null; m.task = null; m.path = null; };
  if (!t || t.state === 'down' || t.state === 'arrested' || t.state === 'secured') { done(); return; }
  const d = dist2D(m, t);
  if (d > 1.0) {
    const ang = Math.atan2(m.z - t.z, m.x - t.x);
    moveTo(w, m, t.x + Math.cos(ang) * 0.7, t.z + Math.sin(ang) * 0.7, MOVE.squadRun, dt);
    m.task.progress = 0;
    return;
  }
  m.vx = m.vz = 0;
  m.yaw = turnToward(m.yaw, yawTo(m.x, m.z, t.x, t.z), MOVE.turnRate * dt);
  m.task.progress = (m.task.progress || 0) + dt;
  const need = t.kind === 'suspect' ? SQUAD.arrestTime : SQUAD.secureTime;
  if (m.task.progress >= need) {
    w.restrain(t, m);
    done();
  }
}

// ───────────────────────── 교전 ─────────────────────────
function isThreat(w, s) {
  if (s.kind !== 'suspect') return false;
  if (s.state === 'down' || s.state === 'surrendered' || s.state === 'arrested') return false;
  if (s.stunUntil > w.time) return false;
  return s.state === 'engage' || w.time - (s.firedAt ?? -99) < 2;
}

function combat(w, m, dt) {
  m.perceiveAt = (m.perceiveAt ?? w.rng() * 0.1) - dt;
  if (m.perceiveAt <= 0) {
    m.perceiveAt = 0.1;
    let threat = null; let td = Infinity; let warn = null; let wd = Infinity; let threatVis = null;
    for (const s of w.actors) {
      if (s.kind !== 'suspect' || s.state === 'down' || s.state === 'arrested' || s.state === 'surrendered') continue;
      const d = dist2D(m, s);
      const vis = canSee(w, m, s, d < 5 ? 180 : 75, 20);
      if (!vis) continue;
      s.knownUntil = w.time + 3;
      if (isThreat(w, s)) { if (d < td) { td = d; threat = s; threatVis = vis; } } else if (d < SQUAD.shoutRange && d < wd) { wd = d; warn = s; }
    }
    if (threat) {
      if (m.combatTarget !== threat.id) { m.combatTarget = threat.id; m.reactAt = w.time + REACTION.squad; }
      m.targetCovered = threatVis.covered;
      m.aimAt = null;
    } else {
      m.combatTarget = null;
      m.aimAt = warn ? warn.id : null;
      if (warn && w.time - (m.lastShout ?? -9) > SURRENDER.cooldown) {
        m.lastShout = w.time;
        w.emit({ type: 'shout', id: m.id });
        warnSuspect(w, warn, m);
      }
    }
  }
  const tid = m.combatTarget ?? m.aimAt;
  if (tid == null) return;
  const t = w.byId(tid);
  if (!t || t.state === 'down') { m.combatTarget = null; m.aimAt = null; return; }
  const want = yawTo(m.x, m.z, t.x, t.z);
  m.yaw = turnToward(m.yaw, want, MOVE.turnRate * 1.6 * dt);
  if (m.combatTarget == null) return;
  if (!isThreat(w, t)) { m.combatTarget = null; return; }
  if (w.time < m.reactAt || w.time < (m.nextFire ?? 0)) return;
  if (Math.abs(angleWrap(m.yaw - want)) > 0.2) return;
  squadShoot(w, m, t);
}

function squadShoot(w, m, t) {
  const wpn = WEAPONS[m.weapon];
  const eye = eyePos(m);
  const th = actorHeight(t);
  const aimPt = { x: t.x, y: m.targetCovered ? th - 0.12 : th * 0.65, z: t.z };
  const first = firstActorOnLine(w, m, eye, aimPt);
  if (first && first !== t) { m.nextFire = w.time + 0.2; return; }
  const d = dist2D(m, t);
  const p = hitChance(ACCURACY.squadBase, d, m.moving, m.targetCovered);
  const pellets = wpn.pellets;
  for (let i = 0; i < pellets; i++) {
    let ax = aimPt.x; let ay = aimPt.y; let az = aimPt.z;
    if (w.rng() >= p) {
      const side = (w.rng() < 0.5 ? -1 : 1) * (0.55 + w.rng() * 0.5);
      ax += (-(t.z - m.z) / (d || 1)) * side; az += ((t.x - m.x) / (d || 1)) * side; ay += 0.4 + w.rng() * 0.5;
    } else if (pellets > 1) {
      ax += (w.rng() - 0.5) * 0.25; ay += (w.rng() - 0.5) * 0.25;
    }
    const dx = ax - eye.x; const dy = ay - eye.y; const dz = az - eye.z; const L = Math.hypot(dx, dy, dz);
    const res = fireRay(w, m, eye, { x: dx / L, y: dy / L, z: dz / L }, wpn.range, wpn.damage);
    if (i === 0) w.emit({ type: 'shot', by: m.id, weapon: m.weapon, from: eye, to: res.point, hit: !!res.actor });
  }
  w.noise(m.x, m.z, 999, m);
  m.nextFire = w.time + Math.max(wpn.interval * 2.5, 0.22);
}
