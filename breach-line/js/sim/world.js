// 게임 월드: 작전 하나의 전체 상태와 고정 틱 갱신. DOM·three.js를 쓰지 않는다(헤드리스 테스트 가능).
import {
  DT, CELL, HP, MOVE, SENSE, FLASH, SMOKE, C2, INTERACT_HOLD, SHOUT_TAP, SURRENDER, HOSTAGE_DEATHS_TO_FAIL, BODY, COVER_H,
} from '../config/balance.js';
import { WEAPONS } from '../config/weapons.js';
import { parseMap, cellCenter, resolveCircle, roomAtWorld, roomAt, blocksMove, cellType, T, toCell, doorAtCell } from './grid.js';
import { fireRay, eyePos, clearLine, canSee, FRIENDLY, INNOCENT, breakDoor } from './combat.js';
import { updateSuspects, hearNoise, warnSuspect } from './ai.js';
import { updateSquad, issueCommand, goCode } from './squad.js';
import { makeRng } from './rng.js';
import { clamp, dirFromYawPitch, yawTo, angleWrap, dist2D } from './geom.js';
import { computeScore } from './rules.js';

const SUSPECT_NAMES = { pistol: '용의자(권총)', rifle: '용의자(소총)', heavy: '용의자(중무장)' };
const SQUAD_DEF = [
  { name: '알파', call: 'Red-1', team: 'red' },
  { name: '브라보', call: 'Red-2', team: 'red' },
  { name: '찰리', call: 'Blue-1', team: 'blue' },
];

export function defaultLoadout() {
  return {
    members: [
      { primary: 'm4', items: { flash: 1 }, team: 'red' },                 // 리더
      { primary: 'm4', items: { flash: 1 }, team: 'red' },
      { primary: 'mp5', items: { flash: 1 }, team: 'red' },
      { primary: 'shotgun', items: { c2: 1, flash: 1 }, team: 'blue' },
    ],
  };
}

export function emptyInput() {
  return {
    mx: 0, mz: 0, dyaw: 0, dpitch: 0, sprint: false, crouch: false, lean: 0,
    fire: false, aim: false, reload: false, slot: null, cycleGrenade: false, throwG: false,
    fDown: false, shout: false, interact: false, go: false,
  };
}

export class World {
  constructor(mission, opts = {}) {
    this.mission = mission;
    this.g = parseMap(mission.map);
    this.rng = makeRng(opts.seed ?? 12345);
    this.time = 0;
    this.tick = 0;
    this.events = [];
    this.notices = [];
    this.actors = [];
    this.byIdMap = new Map();
    this.ops = [];
    this.projectiles = [];
    this.smokes = [];
    this.evidence = [];
    this.reveals = [];
    this.visited = new Set();
    this.trail = [];
    this.result = null;
    this.paused = false;
    this.doors = this.g.doors.map((d) => ({ open: false, broken: false, locked: d.locked, barricade: d.barricade, amt: 0 }));
    this.stats = {
      kills: 0, arrests: 0, dummies: 0, hostagesSecured: 0, hostageDeaths: 0, civilianDeaths: 0, squadInjured: 0,
      unjustified: 0, innocentShots: 0, evidence: 0, violations: [], damageLog: [], execLog: [], shotsFired: 0,
    };
    this.input = emptyInput();
    const loadout = opts.loadout || defaultLoadout();
    this.spawn(loadout);
    this.c2Plant = null;
  }

  // ───────────── 생성 ─────────────
  addActor(a) {
    a.id = this.actors.length;
    a.vx = 0; a.vz = 0; a.pitch = a.pitch || 0; a.lean = 0; a.crouch = false; a.stunUntil = 0;
    this.actors.push(a);
    this.byIdMap.set(a.id, a);
    return a;
  }

  spawn(loadout) {
    const g = this.g;
    const entries = this.mission.entries || { red: 1, blue: 1 };
    const lead = loadout.members[0];
    // 팀별 진입 지점 주변 칸에 배치
    const spotsFor = (entryKey) => {
      const e = g.entries[String(entryKey)] || g.entries['1'];
      const room = roomAt(g, e.c, e.r);
      const cells = [];
      for (let rad = 0; rad < 4; rad++) {
        for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
          const c = e.c + dc; const r = e.r + dr;
          if (cellType(g, c, r) === T.FLOOR && roomAt(g, c, r) === room) cells.push({ c, r });
        }
      }
      return cells;
    };
    const used = new Set();
    // 진입 지점에서 바라볼 방향(가까운 문)의 반대쪽 칸부터 채워 대원이 리더 뒤에 서게 한다
    const take = (entryKey) => {
      const e = g.entries[String(entryKey)] || g.entries['1'];
      const ec = cellCenter(e.c, e.r);
      const fy = this.facingFrom(ec);
      const fx = -Math.sin(fy); const fz = -Math.cos(fy);
      const spots = spotsFor(entryKey).map((p, i) => {
        const cc = cellCenter(p.c, p.r);
        return { p, k: i === 0 ? -99 : (cc.x - ec.x) * fx + (cc.z - ec.z) * fz + Math.hypot(cc.x - ec.x, cc.z - ec.z) * 0.3 };
      }).sort((a, b) => a.k - b.k).map((o) => o.p);
      for (const p of spots) {
        const k = p.r * g.w + p.c;
        if (!used.has(k)) { used.add(k); return cellCenter(p.c, p.r); }
      }
      return cellCenter(g.entries['1'].c, g.entries['1'].r);
    };
    const leadPos = take(entries.red);
    const leader = this.addActor({
      kind: 'leader', name: '리더', team: 'red', x: leadPos.x, z: leadPos.z, yaw: 0,
      hp: HP.leader + (lead.items.armor ? HP.armorBonus : 0), state: 'ok',
    });
    leader.maxHp = leader.hp;
    leader.weapons = {
      primary: makeGun(lead.primary, lead.items.extmag),
      secondary: makeGun('pistol', false),
    };
    leader.slot = 'primary';
    leader.items = { flash: lead.items.flash || 0, smoke: lead.items.smoke || 0, c2: lead.items.c2 || 0 };
    leader.grenade = leader.items.flash > 0 ? 'flash' : 'smoke';
    leader.bloom = 0; leader.nextFire = 0; leader.reloadUntil = 0; leader.fHeld = 0; leader.fUsed = false;
    this.leader = leader;
    this.squad = [];
    for (let i = 0; i < 3; i++) {
      const def = SQUAD_DEF[i];
      const lo = loadout.members[i + 1];
      const team = lo.team || def.team;
      const p = take(team === 'red' ? entries.red : entries.blue);
      const m = this.addActor({
        kind: 'squad', name: def.name, call: def.call, team, x: p.x, z: p.z, yaw: 0,
        hp: HP.squad + (lo.items.armor ? HP.armorBonus : 0), state: 'ok',
        weapon: lo.primary, items: { flash: lo.items.flash || 0, smoke: lo.items.smoke || 0, c2: lo.items.c2 || 0 },
        order: { type: 'follow' },
      });
      m.maxHp = m.hp;
      this.squad.push(m);
    }
    // 같은 팀이 리더와 떨어진 곳에서 시작하면 그 자리에서 대기
    for (const m of this.squad) if (m.team === 'blue' && entries.blue !== entries.red) m.order = { type: 'hold', x: m.x, z: m.z, yaw: 0 };
    leader.yaw = this.facingFrom(leader);
    for (const m of this.squad) m.yaw = leader.yaw;

    let sn = 0; let hn = 0; let cn = 0; let tn = 0;
    for (const e of g.entities) {
      const p = cellCenter(e.c, e.r);
      if ('prh'.includes(e.ch)) {
        const sub = e.ch === 'p' ? 'pistol' : e.ch === 'r' ? 'rifle' : 'heavy';
        const a = this.addActor({
          kind: 'suspect', sub, name: `${SUSPECT_NAMES[sub]} ${++sn}`, x: p.x, z: p.z, yaw: 0, hp: HP[sub], state: 'idle',
          reactAt: 0, nextFire: 0, target: null, lastSeenAt: -99,
        });
        a.maxHp = a.hp;
        a.yaw = this.facingFrom(a);
      } else if (e.ch === 't') {
        const a = this.addActor({ kind: 'dummy', name: `표적 ${++tn}`, x: p.x, z: p.z, yaw: 0, hp: HP.dummy, state: 'idle' });
        a.maxHp = 1;
        a.yaw = this.facingFrom(a);
      } else if (e.ch === 'H' || e.ch === 'C') {
        const kind = e.ch === 'H' ? 'hostage' : 'civilian';
        const a = this.addActor({ kind, name: kind === 'hostage' ? `인질 ${++hn}` : `민간인 ${++cn}`, x: p.x, z: p.z, yaw: this.rng() * 6.28, hp: HP[kind], state: 'captive' });
        a.maxHp = a.hp;
      }
    }
  }

  // 방에서 가장 가까운 문 쪽을 바라보게
  facingFrom(a) {
    const room = roomAtWorld(this.g, a.x, a.z);
    if (room < 0) return 0;
    let best = null; let bd = Infinity;
    for (const di of this.g.rooms[room].doors) {
      const d = this.g.doors[di];
      const p = cellCenter(d.c, d.r);
      const dd = Math.hypot(p.x - a.x, p.z - a.z);
      if (dd < bd) { bd = dd; best = p; }
    }
    return best ? yawTo(a.x, a.z, best.x, best.z) : 0;
  }

  // ───────────── 조회 ─────────────
  byId(id) { return this.byIdMap.get(id); }
  countKind(kind) { return this.actors.filter((a) => a.kind === kind).length; }
  emit(e) { e.t = this.time; this.events.push(e); }
  drainEvents() { const e = this.events; this.events = []; return e; }
  notice(text, tone = 'info') { this.notices.push({ text, tone, t: this.time }); this.emit({ type: 'notice', text, tone }); }

  noise(x, z, radius, source) {
    for (const s of this.actors) {
      if (s.kind !== 'suspect' || s === source) continue;
      if (Math.hypot(s.x - x, s.z - z) <= radius) hearNoise(this, s, x, z);
    }
  }
  alertNearby(s, radius) {
    for (const o of this.actors) {
      if (o === s || o.kind !== 'suspect' || o.state !== 'idle') continue;
      if (Math.hypot(o.x - s.x, o.z - s.z) <= radius) hearNoise(this, o, s.x, s.z);
    }
  }

  dropEvidence(s) {
    if (s.droppedWeapon) return;
    s.droppedWeapon = true;
    this.evidence.push({ id: this.evidence.length, x: s.x + 0.35, z: s.z + 0.2, of: s.id, sub: s.sub, collected: false });
  }

  restrain(t, by) {
    if (t.kind === 'suspect') {
      t.state = 'arrested';
      this.stats.arrests++;
      // 체포한 대원이 떨어진 총도 회수
      const ev = this.evidence.find((e) => e.of === t.id && !e.collected);
      if (ev) this.collectEvidence(ev);
      this.notice(`${by.name}: ${t.name} 체포`, 'good');
      this.emit({ type: 'arrest', id: t.id, by: by.id });
    } else {
      t.state = 'secured';
      if (t.kind === 'hostage') this.stats.hostagesSecured++;
      this.notice(`${by.name}: ${t.name} 확보`, 'good');
      this.emit({ type: 'secure', id: t.id, by: by.id });
    }
    t.claimedBy = null;
  }
  collectEvidence(ev) {
    ev.collected = true;
    this.stats.evidence++;
    this.emit({ type: 'evidence', id: ev.id });
  }

  revealRoom(room, dur, by) {
    this.reveals.push({ room, until: this.time + dur });
    let s = 0; let h = 0;
    for (const a of this.actors) {
      if (roomAtWorld(this.g, a.x, a.z) !== room || a.state === 'down') continue;
      if (a.kind === 'suspect' && a.state !== 'arrested') { s++; a.knownUntil = this.time + dur; }
      if ((a.kind === 'hostage' || a.kind === 'civilian') && a.state === 'captive') { h++; a.knownUntil = this.time + dur; }
    }
    this.notice(`${by.name}: 용의자 ${s} · 인질/민간인 ${h}`, 'info');
    this.emit({ type: 'mirror', room, suspects: s, others: h });
  }

  setDoor(di, open, by) {
    const d = this.doors[di];
    if (d.open === open || d.broken) return;
    d.open = open;
    this.emit({ type: 'door', id: di, open });
    const gd = this.g.doors[di];
    this.noise((gd.c + 0.5) * CELL, (gd.r + 0.5) * CELL, SENSE.hearQuietDoor, by);
  }

  detonateC2(di, farIdx) {
    const gd = this.g.doors[di];
    breakDoor(this, di, 'c2');
    const far = cellCenter(gd.sides[farIdx].c, gd.sides[farIdx].r);
    const dp = cellCenter(gd.c, gd.r);
    this.emit({ type: 'explosion', x: dp.x, y: 1.0, z: dp.z });
    this.noise(dp.x, dp.z, 999, null);
    for (const a of this.actors) {
      if (a.state === 'down' || FRIENDLY(a)) continue;
      if (Math.hypot(a.x - far.x, a.z - far.z) <= C2.stunRadius) a.stunUntil = Math.max(a.stunUntil, this.time + C2.stun);
    }
    // 문 바로 뒤에 서 있던 아군은 피해
    for (const a of this.actors) {
      if (a.state === 'down' || !FRIENDLY(a)) continue;
      if (Math.hypot(a.x - dp.x, a.z - dp.z) < 0.9) { a.hp -= 30; this.emit({ type: 'hit', id: a.id, zone: 'torso', dmg: 30 }); }
    }
  }

  spawnGrenade(kind, owner, pos, vel, fuse, landAt = null) {
    this.projectiles.push({ kind, owner: owner.id, x: pos.x, y: pos.y, z: pos.z, vx: vel.x, vy: vel.y, vz: vel.z, fuseAt: this.time + fuse, landAt });
    this.emit({ type: 'throw', kind, by: owner.id });
  }

  // ───────────── 명령 (UI에서 호출) ─────────────
  command(sel, cmd, goWait = false) { return issueCommand(this, sel, cmd, goWait); }
  go() { return goCode(this); }

  // ───────────── 고정 틱 ─────────────
  step() {
    if (this.result) return;
    const dt = DT;
    this.time += dt;
    this.tick++;
    this.updateLeader(dt);
    updateSquad(this, dt);
    updateSuspects(this, dt);
    this.integrate(dt);
    this.updateProjectiles(dt);
    this.updateDoorsAnim(dt);
    this.updateC2(dt);
    const lr = roomAtWorld(this.g, this.leader.x, this.leader.z);
    if (lr >= 0) this.visited.add(lr);
    this.checkEnd();
  }

  integrate(dt) {
    for (const a of this.actors) {
      if (a.state === 'down' || a.kind === 'dummy') continue;
      if (!a.vx && !a.vz) continue;
      a.x += a.vx * dt; a.z += a.vz * dt;
      // 아군끼리 밀어내기: 리더가 지나가면 대원이 비켜서고, 대원끼리는 서로 조금씩 비킨다(좁은 문 앞 교착 방지)
      if (FRIENDLY(a)) {
        for (const o of this.actors) {
          if (o === a || o.state === 'down' || !FRIENDLY(o)) continue;
          const dx = a.x - o.x; const dz = a.z - o.z; const d = Math.hypot(dx, dz);
          if (d <= 0 || d >= 0.55) continue;
          const push = 0.55 - d;
          if (a.kind === 'leader') { o.x -= (dx / d) * push; o.z -= (dz / d) * push; resolveCircle(this.g, this.doors, o); }
          else if (o.kind !== 'leader') { a.x += (dx / d) * push * 0.5; a.z += (dz / d) * push * 0.5; }
          // 대원은 움직이는 동안 리더를 잠깐 스쳐 지나갈 수 있다(좁은 곳에서 리더에게 막혀 명령이 멈추는 것 방지)
        }
      }
      resolveCircle(this.g, this.doors, a);
    }
  }

  updateLeader(dt) {
    const L = this.leader; const inp = this.input;
    if (L.state === 'down') return;
    if (L.hp <= 0) { L.state = 'down'; return; }
    L.yaw = angleWrap(L.yaw + inp.dyaw);
    L.pitch = clamp(L.pitch + inp.dpitch, -1.35, 1.35);
    inp.dyaw = 0; inp.dpitch = 0;
    L.crouch = !!inp.crouch;
    L.lean = inp.lean;
    L.aiming = !!inp.aim;
    const sprint = inp.sprint && inp.mz > 0.3 && !L.crouch && !L.aiming;
    L.sprinting = sprint;
    let speed = L.crouch ? MOVE.crouch : sprint ? MOVE.sprint : MOVE.walk;
    if (L.aiming) speed *= 0.7;
    const mlen = Math.hypot(inp.mx, inp.mz);
    const mx = mlen > 1 ? inp.mx / mlen : inp.mx; const mz = mlen > 1 ? inp.mz / mlen : inp.mz;
    const fx = -Math.sin(L.yaw); const fz = -Math.cos(L.yaw);
    const rx = Math.cos(L.yaw); const rz = -Math.sin(L.yaw);
    L.vx = (fx * mz + rx * mx) * speed; L.vz = (fz * mz + rz * mx) * speed;
    L.moving = mlen > 0.1;
    // 발소리
    if (L.moving) {
      L.stepAcc = (L.stepAcc || 0) + dt;
      if (L.stepAcc > 0.4) {
        L.stepAcc = 0;
        this.noise(L.x, L.z, L.crouch ? SENSE.hearCrouch : sprint ? SENSE.hearSprint : SENSE.hearWalk, L);
        this.emit({ type: 'step', id: L.id });
      }
    }
    // 이동 경로 기록(대원 따라오기용)
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(last.x - L.x, last.z - L.z) > 0.4) {
      this.trail.push({ x: L.x, z: L.z });
      if (this.trail.length > 60) this.trail.shift();
    }

    // 무기
    const gun = L.weapons[L.slot];
    const spec = WEAPONS[gun.id];
    if (inp.slot && inp.slot !== L.slot && L.weapons[inp.slot]) {
      L.slot = inp.slot; L.reloadUntil = 0; L.nextFire = Math.max(L.nextFire, this.time + 0.35);
      this.emit({ type: 'swap', slot: L.slot });
    }
    inp.slot = null;
    if (inp.cycleGrenade) {
      inp.cycleGrenade = false;
      L.grenade = L.grenade === 'flash' ? 'smoke' : 'flash';
      this.emit({ type: 'grenadeSel', kind: L.grenade });
    }
    if (L.reloadUntil && this.time >= L.reloadUntil) {
      const g2 = L.weapons[L.slot];
      if (g2.reserve > 0) { g2.reserve--; g2.mag = g2.magSize; }
      L.reloadUntil = 0;
      this.emit({ type: 'reloaded' });
    }
    const cur = L.weapons[L.slot];
    if (inp.reload) {
      inp.reload = false;
      if (!L.reloadUntil && cur.mag < cur.magSize && cur.reserve > 0) {
        L.reloadUntil = this.time + WEAPONS[cur.id].reload;
        this.emit({ type: 'reload', dur: WEAPONS[cur.id].reload });
      }
    }
    const moveBloom = L.moving ? (sprint ? 0.06 : 0.02 * (spec.moveSpreadMult || 1)) : 0;
    L.bloom = Math.max(0, L.bloom - dt * 0.25);
    L.spread = clamp(spec.spreadMin + L.bloom + moveBloom, spec.spreadMin, spec.spreadMax + 0.06) * (L.aiming ? 0.5 : 1) * (L.crouch ? 0.8 : 1);
    const wantFire = inp.fire && (spec.auto || !L.fireLatch);
    if (!inp.fire) L.fireLatch = false;
    if (wantFire && !sprint && !L.reloadUntil && this.time >= L.nextFire) {
      if (cur.mag > 0) this.leaderShoot(L, cur, spec);
      else if (!L.fireLatch) { this.emit({ type: 'dry' }); L.fireLatch = true; if (cur.reserve > 0) { L.reloadUntil = this.time + spec.reload; this.emit({ type: 'reload', dur: spec.reload }); } }
    }
    // 투척
    if (inp.throwG) {
      inp.throwG = false;
      const kind = L.items[L.grenade] > 0 ? L.grenade : (L.items.flash > 0 ? 'flash' : L.items.smoke > 0 ? 'smoke' : null);
      if (kind) {
        L.items[kind]--;
        const d = dirFromYawPitch(L.yaw, L.pitch + 0.12);
        const e = eyePos(L);
        this.spawnGrenade(kind, L, { x: e.x + d.x * 0.4, y: e.y - 0.1, z: e.z + d.z * 0.4 }, { x: d.x * FLASH.throwSpeed, y: d.y * FLASH.throwSpeed + 1.2, z: d.z * FLASH.throwSpeed }, kind === 'flash' ? FLASH.fuse : SMOKE.fuse);
      } else this.notice('투척물이 없습니다', 'bad');
    }
    // F: 짧게 = 경고, 길게 = 상호작용 (터치는 [손들어!]=shout, 상황 버튼=interact 로 따로 들어온다)
    if (inp.shout) { inp.shout = false; this.leaderShout(); }
    if (inp.fDown || inp.interact) {
      L.fHeld += dt;
      L.fFromTouch = !!inp.interact;
      const tgt = this.interactTarget();
      L.interact = tgt ? { ...tgt, progress: Math.min(1, L.fHeld / (tgt.hold || INTERACT_HOLD)) } : null;
      if (tgt && !L.fUsed && L.fHeld >= (tgt.hold || INTERACT_HOLD)) { L.fUsed = true; this.doInteract(tgt); }
    } else {
      if (L.fHeld > 0 && L.fHeld < SHOUT_TAP && !L.fUsed && !L.fFromTouch) this.leaderShout();
      L.fHeld = 0; L.fUsed = false; L.interact = null;
    }
    if (inp.go) { inp.go = false; this.go(); }
  }

  leaderShoot(L, gun, spec) {
    gun.mag--;
    this.stats.shotsFired++;
    L.nextFire = this.time + spec.interval;
    L.fireLatch = true;
    const eye = eyePos(L);
    for (let i = 0; i < spec.pellets; i++) {
      const sp = L.spread * (spec.pellets > 1 ? 1 : 1);
      const a = this.rng() * Math.PI * 2; const r = Math.sqrt(this.rng()) * sp;
      const dir = dirFromYawPitch(L.yaw + Math.cos(a) * r, L.pitch + Math.sin(a) * r);
      const res = fireRay(this, L, eye, dir, spec.range, spec.damage, { breaksLock: spec.breaksLock });
      if (i === 0 || res.actor) this.emit({ type: 'shot', by: L.id, weapon: gun.id, from: eye, to: res.point, hit: !!res.actor, zone: res.zone, leader: true, actor: res.actor ? res.actor.id : null });
    }
    L.bloom = Math.min(spec.spreadMax, L.bloom + spec.spreadPerShot);
    this.emit({ type: 'recoil', amount: spec.recoil });
    L.pitch = clamp(L.pitch + spec.recoil * (L.crouch ? 0.7 : 1), -1.35, 1.35);
    L.yaw += (this.rng() - 0.5) * spec.recoil * 0.6;
    this.noise(L.x, L.z, 999, L);
  }

  leaderShout() {
    const L = this.leader;
    this.emit({ type: 'shout', id: L.id, leader: true });
    let any = false;
    for (const s of this.actors) {
      if (s.kind !== 'suspect') continue;
      if (Math.hypot(s.x - L.x, s.z - L.z) > SURRENDER.shoutRange) continue;
      if (!canSee(this, L, s, 180, SURRENDER.shoutRange) && !canSee(this, s, L, 180, SURRENDER.shoutRange)) continue;
      warnSuspect(this, s, L);
      any = true;
    }
    this.noise(L.x, L.z, SENSE.hearShout, L);
    return any;
  }

  // 리더 앞 1.6m 안의 상호작용 대상(체포·확보 > 증거 > 문)
  interactTarget() {
    const L = this.leader;
    const fx = -Math.sin(L.yaw); const fz = -Math.cos(L.yaw);
    const inCone = (x, z, maxD) => {
      const dx = x - L.x; const dz = z - L.z; const d = Math.hypot(dx, dz);
      if (d > maxD) return false;
      return d < 0.5 || (dx * fx + dz * fz) / d > 0.6;
    };
    let best = null; let bd = Infinity;
    for (const a of this.actors) {
      const ok = (a.kind === 'suspect' && a.state === 'surrendered') || ((a.kind === 'hostage' || a.kind === 'civilian') && a.state === 'captive');
      if (!ok || !inCone(a.x, a.z, 1.7)) continue;
      const d = dist2D(a, L);
      if (d < bd) { bd = d; best = { type: a.kind === 'suspect' ? 'arrest' : 'secure', id: a.id, label: a.kind === 'suspect' ? `${a.name} 체포` : `${a.name} 확보`, hold: a.kind === 'suspect' ? 0.9 : 0.6 }; }
    }
    if (best) return best;
    for (const ev of this.evidence) {
      if (ev.collected || !inCone(ev.x, ev.z, 1.5)) continue;
      return { type: 'evidence', id: ev.id, label: '증거물(무기) 회수' };
    }
    // 바라보는 방향 1.6m 안의 문
    for (let k = 1; k <= 6; k++) {
      const px = L.x + fx * k * 0.3; const pz = L.z + fz * k * 0.3;
      const c = toCell(px, pz);
      const di = doorAtCell(this.g, c.c, c.r);
      if (di < 0) continue;
      const d = this.doors[di];
      if (d.broken) return null;
      if (!d.open && (d.locked || d.barricade)) {
        if (this.leader.items.c2 > 0 && !this.c2Plant) return { type: 'c2', id: di, label: '폭약 설치', hold: 1.0 };
        return { type: 'locked', id: di, label: d.barricade ? '바리케이드 (폭약 필요)' : '잠김 (산탄총·폭약)', hold: 99 };
      }
      return { type: 'door', id: di, label: d.open ? '문 닫기' : '문 열기' };
    }
    return null;
  }

  doInteract(tgt) {
    const L = this.leader;
    if (tgt.type === 'arrest' || tgt.type === 'secure') this.restrain(this.byId(tgt.id), L);
    else if (tgt.type === 'evidence') { this.collectEvidence(this.evidence[tgt.id]); this.notice('증거물 회수', 'good'); }
    else if (tgt.type === 'door') this.setDoor(tgt.id, !this.doors[tgt.id].open, L);
    else if (tgt.type === 'c2') {
      L.items.c2--;
      const gd = this.g.doors[tgt.id];
      const a = cellCenter(gd.sides[0].c, gd.sides[0].r); const b = cellCenter(gd.sides[1].c, gd.sides[1].r);
      const farIdx = dist2D(L, a) <= dist2D(L, b) ? 1 : 0;
      this.c2Plant = { door: tgt.id, farIdx, at: this.time + C2.plantTime };
      this.emit({ type: 'c2plant', door: tgt.id });
      this.notice('폭약 설치 — 2초 뒤 폭발, 물러서세요!', 'info');
    }
  }

  updateC2() {
    if (this.c2Plant && this.time >= this.c2Plant.at) {
      const p = this.c2Plant; this.c2Plant = null;
      this.detonateC2(p.door, p.farIdx);
    }
  }

  updateDoorsAnim(dt) {
    for (const d of this.doors) d.amt = clamp(d.amt + (d.open ? dt * 4 : -dt * 4), 0, 1);
  }

  updateProjectiles(dt) {
    const g = this.g;
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.vy -= 9.8 * dt;
      const nx = p.x + p.vx * dt; const ny = p.y + p.vy * dt; const nz = p.z + p.vz * dt;
      const solidAt = (x, y, z) => {
        const c = toCell(x, z);
        const t = cellType(g, c.c, c.r);
        if (t === T.COVER) return y < COVER_H;
        return blocksMove(g, this.doors, c.c, c.r) && t !== T.COVER;
      };
      if (solidAt(nx, ny, p.z)) { p.vx = -p.vx * 0.4; } else p.x = nx;
      if (solidAt(p.x, ny, nz)) { p.vz = -p.vz * 0.4; } else p.z = nz;
      if (ny < 0.06) { p.y = 0.06; p.vy = Math.abs(p.vy) * 0.3; p.vx *= 0.6; p.vz *= 0.6; if (Math.abs(p.vy) < 0.4) p.vy = 0; } else if (ny > 2.7) { p.vy = -Math.abs(p.vy) * 0.3; } else p.y = ny;
      if (this.time >= p.fuseAt) { p.dead = true; this.detonate(p); }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    this.smokes = this.smokes.filter((s) => s.until > this.time);
  }

  detonate(p) {
    const at = { x: p.x, y: Math.max(0.3, p.y), z: p.z };
    if (p.kind === 'flash') {
      this.emit({ type: 'flash', x: at.x, y: at.y, z: at.z });
      this.noise(at.x, at.z, 999, null);
      for (const a of this.actors) {
        if (a.state === 'down') continue;
        const d = Math.hypot(a.x - at.x, a.z - at.z);
        if (d > FLASH.radius) continue;
        const head = { x: a.x, y: 1.4, z: a.z };
        if (!clearLine(this, at, head, true)) continue;
        if (a.kind === 'leader') {
          // 바라보는 방향이면 더 하얗게
          const fx = -Math.sin(a.yaw); const fz = -Math.cos(a.yaw);
          const dot = d > 0.1 ? ((at.x - a.x) * fx + (at.z - a.z) * fz) / d : 1;
          this.emit({ type: 'flashed', amount: clamp((1 - d / FLASH.radius) * 0.6 + Math.max(0, dot) * 0.5, 0.15, 1) });
        } else if (a.kind !== 'squad') {
          a.stunUntil = Math.max(a.stunUntil, this.time + FLASH.stun);
          a.firingAt = null;
        }
      }
    } else if (p.kind === 'smoke') {
      this.smokes.push({ x: at.x, z: at.z, r: SMOKE.radius, until: this.time + SMOKE.duration, born: this.time });
      this.emit({ type: 'smoke', x: at.x, z: at.z });
    }
  }

  // ───────────── 승패 ─────────────
  objectives() {
    let hostages = 0; let hostagesDone = 0; let suspects = 0; let suspectsDone = 0;
    for (const a of this.actors) {
      if (a.kind === 'hostage') { hostages++; if (a.state === 'secured') hostagesDone++; }
      if (a.kind === 'suspect' || a.kind === 'dummy') { suspects++; if (a.state === 'down' || a.state === 'arrested') suspectsDone++; }
    }
    return { hostages, hostagesDone, suspects, suspectsDone, hostageDeaths: this.stats.hostageDeaths };
  }

  timeLeft() { return this.mission.timeLimit ? Math.max(0, this.mission.timeLimit - this.time) : null; }

  checkEnd() {
    if (this.noEnd) return null; // 단위 테스트에서 일부 규칙만 시험할 때
    const L = this.leader;
    if (L.state === 'down' || L.hp <= 0) return this.end(false, '리더가 쓰러졌습니다');
    if (this.stats.hostageDeaths >= HOSTAGE_DEATHS_TO_FAIL) return this.end(false, `인질 ${this.stats.hostageDeaths}명 사망`);
    if (this.mission.timeLimit && this.time >= this.mission.timeLimit) {
      return this.end(false, this.countKind('hostage') ? '시간 초과 — 인질이 처형되었습니다' : '시간 초과');
    }
    const o = this.objectives();
    const aliveHostages = o.hostages - o.hostageDeaths;
    if (o.suspectsDone === o.suspects && o.hostagesDone === aliveHostages) return this.end(true, '작전 성공');
    return null;
  }

  end(win, reason) {
    if (this.result) return this.result;
    const score = computeScore(this, win);
    this.result = { win, reason, time: this.time, ...score };
    this.emit({ type: 'end', win, reason });
    return this.result;
  }
}

function makeGun(id, ext) {
  const s = WEAPONS[id];
  const magSize = s.mag + (ext && id !== 'shotgun' ? 10 : ext ? 2 : 0);
  return { id, mag: magSize, magSize, reserve: s.reserveMags };
}
