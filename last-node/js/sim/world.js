// 게임 월드: 웨이브 · 경제 · 코어 · 포탑 · 투사체 · 드롭 · 상점 · 승패. Three.js 없음.
import {
  TICK, PLAYER, WEAPONS, WEAPON_ORDER, UPGRADE, WEAK_MUL, EMP, ENEMIES, CORE, TURRET, WAVES,
  ECONOMY, SHOP, DROPS, BATTERY, BROADCAST,
} from '../config/balance.js';
import { BOXES, SPAWNS, TURRET_SLOTS, TERMINALS, BATTERIES, ROOF } from '../config/map.js';
import { Geometry, raySphere } from './geom.js';
import { Rng } from './rng.js';
import { makePlayer, updatePlayer, forward, spreadDir } from './player.js';
import { makeEnemy, updateEnemy, enemyParts } from './enemies.js';

const DEG = Math.PI / 180;
let sharedGeom = null; // 격자 계산은 무거우니 한 번만

export function emptyInput() {
  return {
    moveX: 0, moveZ: 0, fire: false, ads: false, crouch: false,
    jump: false, dash: false, melee: false, reload: false, slot: null, cycle: 0, lastWeapon: false,
    throwEmp: false, interact: false, ready: false,
  };
}
const EDGES = ['jump', 'dash', 'melee', 'reload', 'lastWeapon', 'throwEmp', 'interact', 'ready'];

export class World {
  constructor({ seed = 1, startWave = 0 } = {}) {
    this.geom = sharedGeom || (sharedGeom = new Geometry(BOXES));
    this.rng = new Rng(seed);
    this.time = 0;
    this.events = [];
    this.input = emptyInput();
    this.player = makePlayer();
    this.enemies = [];
    this.projectiles = [];
    this.grenades = [];
    this.pickups = [];
    this.core = { hp: CORE.hp, max: CORE.hp, shield: 0, shieldLevel: 0, pulse: false, pulseT: CORE.pulseEvery, hurtT: 9, said50: false, said25: false };
    this.turrets = TURRET_SLOTS.map((s) => ({ ...s, built: false, yaw: 0, pitch: 0, cd: 0, target: null, fireT: 0 }));
    this.batteries = BATTERIES.map((b) => ({ ...b, alive: true }));
    this.wave = startWave;
    this.state = 'prep';                // prep → wave ⇄ intermission → over
    this.timer = WAVES.firstDelay;
    this.credits = 0;
    this.score = 0;
    this.combo = 0; this.comboT = 99;
    this.bossCount = 0;
    this.shopOpen = false;
    this.overReason = null;
    this.stats = { kills: 0, shots: 0, hits: 0, weakHits: 0, coreDamage: 0, wavesCleared: 0, meleeKills: 0, time: 0 };
    this.spawn = null;
    this.waveCoreDamage = 0;
    this.noEnd = false;                 // 테스트: 승패 판정 끄기
    this.fieldPlayer = new Float32Array(this.geom.n * this.geom.n);
    this.fieldPlayerCell = -2;
    this.fieldPlayerT = 0;
    // 코어 거리장: 코어 링 안쪽 둘레 칸
    const tgts = [];
    for (let k = 0; k < this.geom.n * this.geom.n; k++) {
      if (!this.geom.clear[k]) continue;
      const c = this.geom.cellCenter(k);
      const d = Math.hypot(c.x, c.z);
      if (d < CORE.radius + 1.9 && c.y < 0.3) tgts.push(k);
    }
    this.fieldCore = this.geom.field(tgts);
    this._parts = [];
    this.updatePlayerField(true);
  }

  // ── 진행 ──────────────────────────────────────────────
  step(dt = TICK) {
    if (this.state === 'over') { this.clearEdges(); return; }
    this.time += dt;
    this.stats.time += dt;
    const inp = this.input;

    if (inp.interact) this.toggleShop();
    if (this.shopOpen) {
      // 상점이 열려 있으면 이동·사격 무시
      const keep = { ...inp };
      Object.assign(inp, emptyInput());
      updatePlayer(this, this.player, inp, dt);
      Object.assign(inp, keep);
    } else updatePlayer(this, this.player, inp, dt);

    this.updatePlayerField(false, dt);
    this.updateWaves(dt, inp.ready);
    for (const e of this.enemies) if (e.alive) updateEnemy(this, e, dt);
    this.enemies = this.enemies.filter((e) => e.alive);
    this.resolveCrowd();
    this.updateTurrets(dt);
    this.updateProjectiles(dt);
    this.updateGrenades(dt);
    this.updatePickups(dt);
    this.updateCore(dt);
    this.comboT += dt;
    this.core.hurtT += dt;
    this.clearEdges();
  }

  // 지상 적끼리, 적과 플레이어가 겹치지 않게 밀어낸다(벽 충돌은 다시 처리)
  resolveCrowd() {
    const list = this.enemies.filter((e) => e.type !== 'drone' && e.type !== 'boss');
    const p = this.player;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (Math.abs(a.y - b.y) > 1.5) continue;
        const dx = b.x - a.x, dz = b.z - a.z, min = a.r + b.r, d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.01, push = (min - d) / 2;
        const nx = d2 > 1e-8 ? dx / d : 1, nz = d2 > 1e-8 ? dz / d : 0;
        const wa = a.type === 'mech' ? 0.1 : b.type === 'mech' ? 1.9 : 1, wb = 2 - wa;
        this.geom.move(a, -nx * push * wa, -nz * push * wa, 0, 0.55);
        this.geom.move(b, nx * push * wb, nz * push * wb, 0, 0.55);
      }
      // 플레이어는 밀리지 않고 적만 비킨다
      if (p.alive && Math.abs(a.y - p.y) < 1.5) {
        const dx = a.x - p.x, dz = a.z - p.z, min = a.r + p.r, d2 = dx * dx + dz * dz;
        if (d2 < min * min) {
          const d = Math.sqrt(d2) || 0.01;
          if (a.type === 'mech') this.geom.move(p, -(dx / d) * (min - d), -(dz / d) * (min - d), 0, 0.55);
          else this.geom.move(a, (dx / d) * (min - d), (dz / d) * (min - d), 0, 0.55);
        }
      }
    }
  }

  clearEdges() {
    for (const k of EDGES) this.input[k] = false;
    this.input.slot = null; this.input.cycle = 0;
  }

  drainEvents() { const e = this.events; this.events = []; return e; }

  updatePlayerField(force, dt = 0) {
    this.fieldPlayerT -= dt;
    const p = this.player;
    if (!force && this.fieldPlayerT > 0) return;
    this.fieldPlayerT = 0.25;
    const k = this.geom.nearestClear(p.x, p.z, p.y + 0.6);
    if (!force && k === this.fieldPlayerCell) return;
    this.fieldPlayerCell = k;
    if (k >= 0) this.geom.field([k], this.fieldPlayer);
  }

  // ── 웨이브 ────────────────────────────────────────────
  isBossWave(w = this.wave) { return w > 0 && w % WAVES.bossEvery === 0; }

  updateWaves(dt, ready) {
    if (this.state === 'prep' || this.state === 'intermission') {
      this.timer -= dt;
      if (ready && this.timer > 0.5) this.timer = 0;
      if (this.timer <= 0) this.startWave();
      return;
    }
    if (this.state !== 'wave') return;
    const s = this.spawn;
    s.t += dt;
    const alive = this.enemies.filter((e) => e.type !== 'boss').length;
    const cap = s.boss ? WAVES.bossAliveCap : WAVES.aliveCap;
    // 계단실: 0.6~1.0초마다 1기
    s.stairsT -= dt;
    if (s.stairsT <= 0 && s.left > 0 && alive < cap) {
      s.stairsT = this.rng.range(...WAVES.stairsEvery);
      this.spawnFrom('stairs', 1);
    }
    // 엘리베이터: 12초마다 4~6기 한꺼번에
    if (this.wave >= WAVES.elevatorFrom) {
      s.elevT -= dt;
      if (s.elevT <= 0 && s.left > 0) {
        s.elevT = WAVES.elevatorEvery;
        const room = cap - alive;
        if (room >= 2) {
          this.events.push({ t: 'elevator' });
          this.spawnFrom('elevator', Math.min(room, this.rng.int(...WAVES.elevatorGroup)));
        }
      }
    }
    // 수송기 강하: 18초마다 3기(1.5초 예고)
    if (this.wave >= WAVES.dropshipFrom) {
      s.dropT -= dt;
      if (s.dropT <= WAVES.dropshipWarn && !s.dropWarned && s.left > 0) { s.dropWarned = true; this.events.push({ t: 'tele', kind: 'dropship', x: SPAWNS.dropship.x, y: SPAWNS.dropship.y, z: SPAWNS.dropship.z, time: WAVES.dropshipWarn }); }
      if (s.dropT <= 0) {
        s.dropT = WAVES.dropshipEvery; s.dropWarned = false;
        const room = cap - alive;
        if (room > 0 && s.left > 0) this.spawnFrom('dropship', Math.min(room, WAVES.dropshipGroup));
      }
    }
    // 메크: 웨이브 진행도에 맞춰 엘리베이터로
    if (s.mechs > 0 && s.left > 0) {
      const frac = 1 - s.left / s.total;
      if (frac >= s.mechNext) {
        s.mechs--; s.mechNext += 1 / (s.mechTotal + 1);
        this.spawnEnemy('mech', SPAWNS.elevator.x, 0, SPAWNS.elevator.z, 'elevator');
        s.left--;
        this.events.push({ t: 'elevator' });
      }
    }
    // 보스
    if (s.boss && !s.bossSpawned && s.t > 3) {
      s.bossSpawned = true;
      this.spawnBoss();
    }
    if (s.left <= 0 && this.enemies.length === 0 && (!s.boss || s.bossSpawned) && !this.noEnd) this.clearWave();
  }

  startWave() {
    this.wave++;
    const w = this.wave, boss = this.isBossWave(w);
    let total = WAVES.count(w);
    if (boss) total = Math.floor(total / 2);
    const mechTotal = w >= WAVES.mechFrom ? WAVES.mechMax(w) : 0;
    this.spawn = {
      t: 0, total, left: total, stairsT: 0.5, elevT: 4, dropT: 7, dropWarned: false,
      boss, bossSpawned: false, mechs: mechTotal, mechTotal, mechNext: 1 / (mechTotal + 1),
    };
    this.state = 'wave';
    this.shopOpen = false;
    this.waveCoreDamage = 0;
    this.core.shield = this.core.shieldLevel ? CORE.shieldLevels[this.core.shieldLevel - 1] : 0;
    for (const b of this.batteries) b.alive = true;
    this.events.push({ t: 'waveStart', wave: w, boss, total });
    this.broadcast(boss ? BROADCAST.boss : BROADCAST.waveStart[(w - 1) % BROADCAST.waveStart.length]);
  }

  clearWave() {
    const w = this.wave;
    const bonus = ECONOMY.waveBonus(w);
    const perfect = this.waveCoreDamage < 0.5;
    const total = bonus + (perfect ? ECONOMY.perfectBonus : 0);
    this.credits += total; this.score += total;
    this.core.hp = Math.min(this.core.max, this.core.hp + CORE.repairBetween);
    this.stats.wavesCleared++;
    this.state = 'intermission';
    this.timer = WAVES.intermission;
    this.events.push({ t: 'waveClear', wave: w, bonus, perfect, perfectBonus: perfect ? ECONOMY.perfectBonus : 0 });
  }

  pickType() {
    const w = this.wave, m = WAVES.mix;
    const opts = [['reaper', m.reaper], ['enforcer', m.enforcer]];
    if (w >= WAVES.leechFrom) opts.push(['leech', m.leech]);
    if (w >= WAVES.droneFrom) opts.push(['drone', m.drone]);
    let sum = 0; for (const o of opts) sum += o[1];
    let r = this.rng.next() * sum;
    for (const o of opts) { r -= o[1]; if (r <= 0) return o[0]; }
    return 'reaper';
  }

  spawnFrom(source, n) {
    const s = this.spawn;
    for (let i = 0; i < n && s.left > 0; i++) {
      const type = this.pickType();
      if (type === 'drone') { this.spawnSwarm(); continue; }
      const sp = SPAWNS[source];
      const jx = source === 'elevator' ? this.rng.range(-2.4, 2.4) : this.rng.range(-0.4, 0.4);
      const jz = source === 'stairs' ? this.rng.range(-1.2, 1.2) : this.rng.range(-0.4, 0.4);
      const dx = source === 'dropship' ? this.rng.range(-2, 2) : 0;
      this.spawnEnemy(type, sp.x + jx + dx, sp.y + (source === 'dropship' ? 0.1 : 0), sp.z + jz, source);
      s.left--;
    }
  }

  spawnSwarm() {
    const s = this.spawn;
    const n = Math.min(s.left, this.rng.int(...WAVES.swarm));
    const a = this.rng.next() * Math.PI * 2;
    const cx = Math.cos(a) * (ROOF + 8), cz = Math.sin(a) * (ROOF + 8), cy = this.rng.range(7, 10);
    const target = this.rng.chance(0.7) ? 'player' : 'core';
    for (let i = 0; i < n; i++) {
      this.spawnEnemy('drone', cx + this.rng.range(-1.5, 1.5), cy + this.rng.range(-1, 1), cz + this.rng.range(-1.5, 1.5), 'sky',
        { target, slot: i, alt: this.rng.range(ENEMIES.drone.flyMin, ENEMIES.drone.flyMax) });
      s.left--;
    }
  }

  spawnEnemy(type, x, y, z, source, extra = {}) {
    const w = Math.max(1, this.wave);
    const e = makeEnemy(type, x, y, z, WAVES.hpMul(w), WAVES.dmgMul(w), extra);
    e.yaw = Math.atan2(x, z); // 대략 중앙을 본다
    this.enemies.push(e);
    this.events.push({ t: 'spawn', id: e.id, type, source, x, y, z });
    return e;
  }

  spawnBoss() {
    const c = ENEMIES.boss;
    const hpMul = 1 + c.perAppear * this.bossCount;
    this.bossCount++;
    const e = makeEnemy('boss', 0, 30, -70, hpMul, WAVES.dmgMul(this.wave), {});
    e.engines = [c.engineHp * hpMul, c.engineHp * hpMul];
    e.engineMax = c.engineHp * hpMul;
    e.r = c.radius; e.h = 3;
    this.enemies.push(e);
    this.boss = e;
    this.events.push({ t: 'spawn', id: e.id, type: 'boss', source: 'sky', x: e.x, y: e.y, z: e.z });
  }

  bossDrop(e) {
    for (const t of ENEMIES.boss.drop) {
      const sp = SPAWNS.dropship;
      this.spawnEnemy(t, sp.x + this.rng.range(-2.5, 2.5), sp.y + 0.1, sp.z + this.rng.range(-2.5, 2.5), 'dropship');
    }
    this.events.push({ t: 'bossDrop', id: e.id });
  }

  leechSlotsFree() {
    const used = this.enemies.filter((e) => e.type === 'leech' && e.state === 'attach').length;
    return WAVES.leechSlots(Math.max(1, this.wave)) - used;
  }

  // ── 피해 ──────────────────────────────────────────────
  hurtPlayer(dmg, src, kind, ignoreArmor = false, silent = false) {
    const p = this.player;
    if (!p.alive || this.state === 'over') return;
    if (p.dashT > 0) dmg *= PLAYER.dashDamageMul;
    if (!ignoreArmor && p.armor > 0) {
      const a = Math.min(p.armor, dmg * PLAYER.armorAbsorb);
      p.armor -= a; dmg -= a;
    }
    p.hp -= dmg;
    p.hurtT = 0;
    if (!silent || this.time - (this._lastHurtEv || 0) > 0.15) {
      this._lastHurtEv = this.time;
      this.events.push({ t: 'playerHurt', dmg, kind, fx: src ? src.x : null, fz: src ? src.z : null });
    }
    if (p.hp <= 0) { p.hp = 0; p.alive = false; this.gameOver('player'); }
  }

  damageCore(dmg, src, kind) {
    if (this.state === 'over') return;
    const c = this.core;
    if (c.shield > 0) {
      const s = Math.min(c.shield, dmg);
      c.shield -= s; dmg -= s;
      if (s > 0 && c.hurtT > 0.12) this.events.push({ t: 'shieldHit', kind, fx: src ? src.x : 0, fz: src ? src.z : 0 });
    }
    if (dmg <= 0) return;
    c.hp -= dmg;
    this.waveCoreDamage += dmg;
    this.stats.coreDamage += dmg;
    if (c.hurtT > 0.25) this.events.push({ t: 'coreHurt', dmg, kind, fx: src ? src.x : 0, fz: src ? src.z : 0 });
    c.hurtT = 0;
    if (!c.said50 && c.hp < c.max * 0.5) { c.said50 = true; this.broadcast(BROADCAST.core50); }
    if (!c.said25 && c.hp < c.max * 0.25) { c.said25 = true; this.broadcast(BROADCAST.core25); }
    if (c.hp <= 0) { c.hp = 0; this.gameOver('core'); }
  }

  gameOver(reason) {
    if (this.noEnd || this.state === 'over') return;
    this.state = 'over';
    this.overReason = reason;
    this.shopOpen = false;
    this.events.push({ t: 'gameOver', reason });
  }

  broadcast(text) { this.events.push({ t: 'broadcast', text }); }

  // 적에게 피해. info: {kind:'weak'|'back'|..., dir:{x,z}, melee, weapon, emp}
  damageEnemy(e, dmg, info = {}) {
    if (!e.alive) return 0;
    const c = e.c;
    let mul = 1;
    if (e.type === 'boss') return this.damageBoss(e, dmg, info);
    if (info.kind === 'weak') mul = info.weakMul || WEAK_MUL;
    if (e.type === 'mech') {
      if (info.kind === 'back') mul = c.backMul;
      else if (!(e.shieldOff > 0) && info.dir && !info.emp) {
        // 정면에서 맞으면 방패
        const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
        if (info.dir.x * fx + info.dir.z * fz < -0.2) { mul *= c.shieldMul; info.shield = true; }
      }
    }
    const d = dmg * mul;
    e.hp -= d;
    e.flash = 1;
    if (e.type === 'leech' && e.state === 'attach') e.interrupt = c.interrupt;
    if (e.type !== 'mech' && !info.emp && e.type !== 'drone') e.stagger = Math.max(e.stagger, info.melee ? 0.3 : 0.1);
    if (info.knock && e.type !== 'mech') { e.vx += info.dir.x * info.knock; e.vz += info.dir.z * info.knock; }
    if (e.hp <= 0) this.killEnemy(e, info);
    return d;
  }

  damageBoss(e, dmg, info) {
    const c = e.c;
    let mul = 1;
    if (info.part && info.part.kind === 'engine') {
      const i = info.part.idx;
      e.engines[i] -= dmg;
      if (e.engines[i] <= 0) { e.engines[i] = 0; this.events.push({ t: 'engineDown', id: e.id, idx: i }); this.events.push({ t: 'explode', x: info.part.x, y: info.part.y, z: info.part.z, r: 3, kind: 'big' }); }
    }
    if (info.part && info.part.kind === 'cockpit' && e.engines[0] <= 0 && e.engines[1] <= 0) mul = c.cockpitMul;
    const d = dmg * mul;
    e.hp -= d; e.flash = 1;
    if (e.hp <= 0) this.killEnemy(e, info);
    return d;
  }

  killEnemy(e, info = {}) {
    if (!e.alive) return;
    e.alive = false;
    e.hp = 0;
    const weak = info.kind === 'weak' || info.kind === 'back' || (info.part && info.part.kind === 'cockpit');
    let cr = e.c.credits;
    let mul = 1;
    if (weak) mul += ECONOMY.weakBonus;
    if (info.melee) mul += ECONOMY.meleeBonus;
    if (this.comboT <= ECONOMY.comboWindow) this.combo++; else this.combo = 1;
    this.comboT = 0;
    if (this.combo >= 5) mul += ECONOMY.combo5; else if (this.combo >= 2) mul += ECONOMY.combo2;
    cr = Math.round(cr * mul);
    if (!info.noCredit) { this.credits += cr; this.score += cr; }
    this.stats.kills++;
    if (info.melee) this.stats.meleeKills++;
    this.events.push({ t: 'kill', id: e.id, type: e.type, x: e.x, y: e.y, z: e.z, weak, melee: !!info.melee, credits: info.noCredit ? 0 : cr, combo: this.combo, yaw: e.yaw, dir: info.dir || null });
    if (e.type === 'drone') this.droneExplode(e, false);
    if (e.type === 'boss') {
      this.boss = null;
      this.events.push({ t: 'explode', x: e.x, y: e.y, z: e.z, r: 8, kind: 'boss' });
      for (let i = 0; i < 6; i++) this.dropOrb(e.x + this.rng.range(-4, 4), 4, e.z + this.rng.range(-4, 4));
    }
    if (e.type === 'mech') this.events.push({ t: 'explode', x: e.x, y: e.y + 2, z: e.z, r: 3.5, kind: 'big' });
    // 드롭
    if (e.type !== 'boss') {
      const groundY = Math.max(0, this.geom.heightAt(e.x, e.z));
      const n = info.melee ? 3 : this.rng.int(DROPS.orbMin, DROPS.orbMax) + (e.type === 'mech' ? 3 : 0);
      for (let i = 0; i < n; i++) this.dropOrb(e.x, Math.max(groundY, e.y) + 1, e.z, info.melee ? PLAYER.meleeHeal / 3 : DROPS.orbHeal);
      if (this.rng.chance(DROPS.ammoChance) || e.type === 'mech') this.pickups.push({ kind: 'ammo', x: e.x, y: Math.max(groundY, e.y) + 0.8, z: e.z, vx: 0, vy: 3, vz: 0, life: 14, id: this.rng.next() });
    }
  }

  removeEnemy(e) { e.alive = false; }

  dropOrb(x, y, z, heal = DROPS.orbHeal) {
    const a = this.rng.next() * Math.PI * 2, s = this.rng.range(1, 3);
    this.pickups.push({ kind: 'orb', x, y, z, vx: Math.cos(a) * s, vy: this.rng.range(3, 5), vz: Math.sin(a) * s, life: DROPS.orbLife, heal, id: this.rng.next() });
  }

  droneExplode(e, contact) {
    const c = ENEMIES.drone;
    if (e.alive) { e.alive = false; this.events.push({ t: 'kill', id: e.id, type: 'drone', x: e.x, y: e.y, z: e.z, weak: false, credits: 0, self: true }); }
    this.events.push({ t: 'explode', x: e.x, y: e.y, z: e.z, r: c.boomRadius, kind: 'drone' });
    if (contact) {
      const p = this.player;
      const d = Math.hypot(p.x - e.x, p.y + 1 - e.y, p.z - e.z);
      if (d < c.boomRadius) this.hurtPlayer(c.boomDmg * e.dmgMul, e, 'drone');
      const dc = Math.hypot(e.x, e.z) - CORE.radius;
      if (dc < c.boomRadius && e.y < 7) this.damageCore(c.boomDmg * e.dmgMul, e, 'drone');
    }
    // 연쇄
    for (const o of this.enemies) {
      if (o.alive && o.type === 'drone' && o !== e && Math.hypot(o.x - e.x, o.y - e.y, o.z - e.z) < c.chain) {
        o.chainT = 0.08;
        this.damageEnemy(o, 999, { chain: true, noCredit: false });
      }
    }
  }

  // ── 플레이어 사격 ─────────────────────────────────────
  fireHitscan(id, w, dmg) {
    const p = this.player;
    const eye = { x: p.x, y: p.y + p.eye, z: p.z };
    let f = forward(p);
    const moveBloom = Math.min(1, p.speed / PLAYER.speed) * 0.9 + (p.grounded ? 0 : 1.2);
    const spread = (w.spreadHip + (w.spreadAds - w.spreadHip) * p.ads) + moveBloom * (1 - 0.6 * p.ads) * (w.pellets > 1 ? 0.3 : 1);
    if (w.homing && p.ads > 0.6) f = this.homingDir(eye, f, w.homing);
    this.stats.shots++;
    const ends = [];
    let anyHit = false, anyWeak = false, anyKill = false;
    for (let i = 0; i < w.pellets; i++) {
      const d = spreadDir(this.rng, f, spread);
      const r = this.trace(eye, d, w.range, w.pierce || 1);
      ends.push({ x: eye.x + d.x * r.end, y: eye.y + d.y * r.end, z: eye.z + d.z * r.end, wall: !!r.wall, nx: r.wall?.nx, ny: r.wall?.ny, nz: r.wall?.nz, surf: r.wall?.box?.kind || (r.wall ? 'floor' : null) });
      for (const h of r.hits) {
        let dd = dmg;
        if (w.falloffStart && h.t > w.falloffStart) dd *= 1 - (1 - w.falloffMin) * Math.min(1, (h.t - w.falloffStart) / (w.falloffEnd - w.falloffStart));
        if (h.battery) { this.explodeBattery(h.battery); continue; }
        const e = h.e;
        const info = { kind: h.part.kind, part: h.part, dir: { x: d.x, z: d.z }, weapon: id, weakMul: w.weakMul, knock: w.knockback };
        const before = e.alive;
        const done = this.damageEnemy(e, dd, info);
        anyHit = true;
        if (h.part.kind === 'weak' || h.part.kind === 'back' || h.part.kind === 'cockpit') anyWeak = true;
        if (before && !e.alive) anyKill = true;
        this.events.push({ t: 'hit', id: e.id, x: h.x, y: h.y, z: h.z, weak: h.part.kind === 'weak' || h.part.kind === 'back', shield: !!info.shield, dmg: done, kill: before && !e.alive, type: e.type, part: h.part.kind });
      }
    }
    if (anyHit) this.stats.hits++;
    if (anyWeak) this.stats.weakHits++;
    this.events.push({ t: 'shot', w: id, x: eye.x, y: eye.y, z: eye.z, ends, hit: anyHit, weak: anyWeak, kill: anyKill });
  }

  // 광선 추적: 벽에서 멈추고, 그 앞의 적(관통 수만큼)·배터리를 순서대로
  trace(o, d, range, pierce = 1) {
    const wall = this.geom.raycast(o.x, o.y, o.z, d.x, d.y, d.z, range);
    const end = wall ? wall.t : range;
    const cands = [];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      // 대략 거리 거르기
      const cx = e.x - o.x, cy = e.y + 1 - o.y, cz = e.z - o.z;
      const along = cx * d.x + cy * d.y + cz * d.z;
      if (along < -4 || along > end + 4) continue;
      let best = null;
      for (const q of enemyParts(e, this._parts)) {
        const t = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, q.x, q.y, q.z, q.r);
        if (t >= 0 && t < end && (!best || t < best.t)) best = { t, part: { ...q } };
      }
      if (best) cands.push({ t: best.t, e, part: best.part, x: o.x + d.x * best.t, y: o.y + d.y * best.t, z: o.z + d.z * best.t });
    }
    for (const b of this.batteries) {
      if (!b.alive) continue;
      const t = raySphere(o.x, o.y, o.z, d.x, d.y, d.z, b.x, b.y + 0.6, b.z, 0.55);
      if (t >= 0 && t < end) cands.push({ t, battery: b });
    }
    cands.sort((a, b) => a.t - b.t);
    const hits = [];
    let n = 0;
    for (const c of cands) {
      hits.push(c);
      if (c.battery) continue;
      if (++n >= pierce) break;
    }
    const stopT = n >= pierce && hits.length ? hits[hits.length - 1].t : end;
    return { hits, end: stopT, wall: n >= pierce ? null : wall };
  }

  homingDir(eye, f, deg) {
    let best = null, bestCos = Math.cos(deg * DEG);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      for (const q of enemyParts(e, this._parts)) {
        if (q.kind !== 'weak' && q.kind !== 'cockpit' && q.kind !== 'engine') continue;
        const dx = q.x - eye.x, dy = q.y - eye.y, dz = q.z - eye.z, l = Math.hypot(dx, dy, dz);
        const c = (dx * f.x + dy * f.y + dz * f.z) / l;
        if (c > bestCos && this.geom.los(eye.x, eye.y, eye.z, q.x, q.y, q.z)) { bestCos = c; best = { x: dx / l, y: dy / l, z: dz / l }; }
      }
    }
    return best || f;
  }

  // 조준 보조(모바일)용: 시선 원뿔 안 가장 가까운 적 부위 방향
  aimAssist(coneDeg) {
    const p = this.player, eye = { x: p.x, y: p.y + p.eye, z: p.z }, f = forward(p);
    let best = null, bestCos = Math.cos(coneDeg * DEG);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const parts = enemyParts(e, this._parts);
      const q = parts.find((x) => x.kind === 'weak') || parts[0];
      const dx = q.x - eye.x, dy = q.y - eye.y, dz = q.z - eye.z, l = Math.hypot(dx, dy, dz);
      if (l > 60) continue;
      const c = (dx * f.x + dy * f.y + dz * f.z) / l;
      if (c > bestCos && this.geom.los(eye.x, eye.y, eye.z, q.x, q.y, q.z)) { bestCos = c; best = { x: dx / l, y: dy / l, z: dz / l, e }; }
    }
    return best;
  }

  // ── 근접 ──────────────────────────────────────────────
  melee() {
    const p = this.player, f = forward(p);
    const fl = Math.hypot(f.x, f.z) || 1, fx = f.x / fl, fz = f.z / fl;
    let best = null, bd = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || e.type === 'boss') continue;
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) - e.r;
      const dy = e.y + 0.9 - (p.y + 1);
      if (d > PLAYER.meleeRange || Math.abs(dy) > 1.8) continue;
      const c = (dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1);
      if (c < PLAYER.meleeCone && d > 0.4) continue;
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) { this.events.push({ t: 'melee', hit: false }); return; }
    const stunned = best.stun > 0;
    const dir = { x: fx, z: fz };
    if (stunned) {
      // 기절한 적 근접 = 즉시 처치 + 회복
      p.hp = Math.min(PLAYER.hp, p.hp + PLAYER.meleeHeal);
      this.events.push({ t: 'melee', hit: true, finisher: true, id: best.id, x: best.x, y: best.y + 1, z: best.z });
      this.damageEnemy(best, 99999, { melee: true, dir, kind: 'body' });
    } else {
      this.events.push({ t: 'melee', hit: true, finisher: false, id: best.id, x: best.x, y: best.y + 1, z: best.z });
      this.damageEnemy(best, PLAYER.meleeDamage, { melee: true, dir, kind: 'body', knock: 4 });
    }
  }

  // ── 적 사격 ───────────────────────────────────────────
  enemyShoot(e, c) {
    const p = this.player;
    const ox = e.x - Math.sin(e.yaw) * 0.5 + Math.cos(e.yaw) * 0.25, oy = e.y + 1.45, oz = e.z - Math.cos(e.yaw) * 0.5 - Math.sin(e.yaw) * 0.25;
    const tx = p.x, ty = p.y + p.h * 0.6, tz = p.z;
    const dist = Math.hypot(tx - ox, tz - oz);
    let acc = c.accuracy;
    if (p.dashT > 0 || !p.grounded) acc -= 0.25;
    if (dist > 30) acc -= 0.15;
    let ax = tx, ay = ty, az = tz;
    if (!this.rng.chance(acc)) {
      const a = this.rng.next() * Math.PI * 2, r = this.rng.range(0.7, 1.6);
      ax += Math.cos(a) * r; ay += Math.sin(a) * r * 0.6; az += Math.sin(a) * r;
    }
    const dx = ax - ox, dy = ay - oy, dz = az - oz, l = Math.hypot(dx, dy, dz);
    const sp = c.bulletSpeed;
    this.projectiles.push({ kind: 'bullet', x: ox, y: oy, z: oz, vx: dx / l * sp, vy: dy / l * sp, vz: dz / l * sp, dmg: c.dmg * e.dmgMul, splash: 0, life: 1.2, src: e, id: this.rng.next() });
    this.events.push({ t: 'enemyShot', id: e.id, x: ox, y: oy, z: oz });
  }

  mechMissile(e) {
    const c = e.c;
    const ox = e.x + Math.cos(e.yaw) * 0.9, oy = e.y + 3.3, oz = e.z - Math.sin(e.yaw) * 0.9;
    const dx = e.aimX - ox, dy = e.aimY - oy, dz = e.aimZ - oz, l = Math.hypot(dx, dy, dz) || 1;
    this.projectiles.push({ kind: 'missile', x: ox, y: oy, z: oz, vx: dx / l * c.missileSpeed, vy: dy / l * c.missileSpeed, vz: dz / l * c.missileSpeed, dmg: c.missileDmg * e.dmgMul, splash: c.missileRadius, life: 4, src: e, id: this.rng.next() });
    this.events.push({ t: 'missile', id: e.id, x: ox, y: oy, z: oz });
  }

  bossMissileImpact(e, q) {
    const c = e.c;
    this.splash(q.x, q.y + 0.3, q.z, c.missileRadius, c.missileDmg * e.dmgMul, e, 'mortar');
  }

  splash(x, y, z, r, dmg, src, kind) {
    const p = this.player;
    const d = Math.hypot(p.x - x, p.y + 0.9 - y, p.z - z);
    if (d < r) this.hurtPlayer(dmg * (1 - 0.5 * d / r), { x, z }, kind);
    const dc = Math.hypot(x, z) - CORE.radius;
    if (dc < r && y < 7) this.damageCore(dmg * (1 - 0.5 * Math.max(0, dc) / r), src, kind);
    this.events.push({ t: 'explode', x, y, z, r, kind });
  }

  updateProjectiles(dt) {
    const p = this.player;
    for (const b of this.projectiles) {
      b.life -= dt;
      const sp = Math.hypot(b.vx, b.vy, b.vz), step = sp * dt;
      const dx = b.vx / sp, dy = b.vy / sp, dz = b.vz / sp;
      // 플레이어(세로 선분)와의 거리
      const hitP = segToCapsule(b.x, b.y, b.z, dx, dy, dz, step, p.x, p.y + 0.3, p.z, p.y + p.h - 0.15, p.r + 0.12);
      const wall = this.geom.raycast(b.x, b.y, b.z, dx, dy, dz, step);
      if (hitP >= 0 && (!wall || hitP < wall.t) && p.alive) {
        const hx = b.x + dx * hitP, hy = b.y + dy * hitP, hz = b.z + dz * hitP;
        if (b.splash) this.splash(hx, hy, hz, b.splash, b.dmg, b.src, b.kind);
        else this.hurtPlayer(b.dmg, b.src, b.kind);
        b.life = -1; continue;
      }
      if (wall) {
        const hx = b.x + dx * wall.t, hy = b.y + dy * wall.t, hz = b.z + dz * wall.t;
        if (b.splash) this.splash(hx, hy, hz, b.splash, b.dmg, b.src, b.kind);
        else {
          if (wall.box && wall.box.kind === 'core') this.damageCore(b.dmg, b.src, 'bullet');
          this.events.push({ t: 'impact', x: hx, y: hy, z: hz, nx: wall.nx, ny: wall.ny, nz: wall.nz, kind: 'enemy' });
        }
        b.life = -1; continue;
      }
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (b.kind === 'missile') b.vy -= 1.5 * dt;
      if (b.life <= 0 && b.splash) this.splash(b.x, b.y, b.z, b.splash, b.dmg, b.src, b.kind);
    }
    this.projectiles = this.projectiles.filter((b) => b.life > 0);
  }

  // ── EMP ───────────────────────────────────────────────
  throwEmp(x, y, z, vx, vy, vz) {
    this.grenades.push({ x, y, z, px: x, py: y, pz: z, vx, vy, vz, fuse: EMP.fuse, id: this.rng.next() });
    this.events.push({ t: 'throw' });
  }

  updateGrenades(dt) {
    for (const g of this.grenades) {
      g.px = g.x; g.py = g.y; g.pz = g.z;
      g.vy -= 18 * dt;
      const sp = Math.hypot(g.vx, g.vy, g.vz);
      if (sp > 0.01) {
        const dx = g.vx / sp, dy = g.vy / sp, dz = g.vz / sp;
        const hit = this.geom.raycast(g.x, g.y, g.z, dx, dy, dz, sp * dt + 0.08);
        if (hit) {
          g.x += dx * Math.max(0, hit.t - 0.08); g.y += dy * Math.max(0, hit.t - 0.08); g.z += dz * Math.max(0, hit.t - 0.08);
          const dot = g.vx * hit.nx + g.vy * hit.ny + g.vz * hit.nz;
          g.vx = (g.vx - 2 * dot * hit.nx) * EMP.restitution; g.vy = (g.vy - 2 * dot * hit.ny) * EMP.restitution; g.vz = (g.vz - 2 * dot * hit.nz) * EMP.restitution;
          if (hit.ny > 0.5) { g.vx *= 0.7; g.vz *= 0.7; }
          if (sp > 3) this.events.push({ t: 'bounce', x: g.x, y: g.y, z: g.z });
        } else { g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt; }
      }
      g.fuse -= dt;
      if (g.fuse <= 0 || g.y < -20) this.empBlast(g.x, g.y, g.z);
    }
    this.grenades = this.grenades.filter((g) => g.fuse > 0 && g.y >= -20);
  }

  empBlast(x, y, z) {
    this.events.push({ t: 'emp', x, y, z, r: EMP.radius });
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const cy = e.type === 'boss' ? e.y : e.y + 1;
      const d = Math.hypot(e.x - x, cy - y, e.z - z);
      if (d > EMP.radius + (e.type === 'boss' ? 2 : 0)) continue;
      if (e.type !== 'boss') {
        e.stun = Math.max(e.stun, EMP.stun);
        if (e.type === 'mech') e.shieldOff = EMP.shieldOff;
        if (e.type === 'reaper' || e.type === 'enforcer' || e.type === 'leech') e.state = e.type === 'leech' ? 'move' : 'chase';
        if (e.type === 'enforcer') e.state = 'seek';
        if (e.type === 'drone') { e.state = 'fly'; e.vy = 0; }
      }
      this.damageEnemy(e, EMP.damage, { emp: true, kind: 'body', dir: { x: e.x - x, z: e.z - z } });
    }
  }

  // ── 배터리 ────────────────────────────────────────────
  explodeBattery(b) {
    if (!b.alive) return;
    b.alive = false;
    const R = BATTERY.radius;
    this.events.push({ t: 'explode', x: b.x, y: b.y + 0.6, z: b.z, r: R, kind: 'battery' });
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - b.x, e.y + 0.8 - b.y, e.z - b.z);
      if (d < R + e.r) this.damageEnemy(e, BATTERY.damage * (1 - 0.5 * Math.min(1, d / R)), { kind: 'body', dir: { x: e.x - b.x, z: e.z - b.z }, knock: 6 });
    }
    const p = this.player;
    const d = Math.hypot(p.x - b.x, p.y + 0.9 - b.y, p.z - b.z);
    if (d < R) this.hurtPlayer(BATTERY.damage * 0.5 * (1 - 0.5 * d / R), b, 'battery');
    for (const o of this.batteries) if (o.alive && Math.hypot(o.x - b.x, o.z - b.z) < R * 0.6) { this._chainBattery = o; }
    if (this._chainBattery) { const o = this._chainBattery; this._chainBattery = null; this.explodeBattery(o); }
  }

  // ── 코어 · 포탑 · 드롭 ───────────────────────────────
  updateCore(dt) {
    const c = this.core;
    if (c.pulse && this.state === 'wave') {
      c.pulseT -= dt;
      if (c.pulseT <= 0) {
        c.pulseT = CORE.pulseEvery;
        this.events.push({ t: 'corePulse' });
        for (const e of this.enemies) {
          if (e.alive && e.type !== 'boss' && Math.hypot(e.x, e.z) < CORE.pulseRadius + e.r) {
            e.stun = Math.max(e.stun, CORE.pulseStun);
            if (e.type === 'leech' && e.state === 'attach') e.state = 'move';
          }
        }
      }
    }
  }

  updateTurrets(dt) {
    for (const t of this.turrets) {
      if (!t.built) continue;
      t.cd -= dt; t.fireT -= dt;
      const mx = t.x, my = t.y + 1.0, mz = t.z;
      // 목표: 리치 > 드론 > 가까운 적
      let best = null, bs = Infinity;
      for (const e of this.enemies) {
        if (!e.alive || e.type === 'boss') continue;
        const ty = e.type === 'drone' ? e.y : e.y + 1.1;
        const d = Math.hypot(e.x - mx, ty - my, e.z - mz);
        if (d > TURRET.range) continue;
        const pri = e.type === 'leech' ? 0 : e.type === 'drone' ? 100 : 200;
        const s = pri + d;
        if (s < bs && this.geom.los(mx, my, mz, e.x, ty, e.z)) { bs = s; best = e; }
      }
      t.target = best;
      if (!best) continue;
      const ty = best.type === 'drone' ? best.y : best.y + 1.1;
      const want = Math.atan2(-(best.x - mx), -(best.z - mz));
      let d = want - t.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      t.yaw += Math.max(-TURRET.turn * dt, Math.min(TURRET.turn * dt, d));
      t.pitch = Math.atan2(ty - my, Math.hypot(best.x - mx, best.z - mz));
      if (Math.abs(d) < 0.15 && t.cd <= 0) {
        t.cd = 1 / TURRET.rate; t.fireT = 0.06;
        const parts = enemyParts(best, this._parts);
        const q = parts[Math.min(1, parts.length - 1)];
        this.events.push({ t: 'turretFire', x: mx, y: my, z: mz, tx: q.x, ty: q.y, tz: q.z });
        this.damageEnemy(best, TURRET.dmg, { kind: 'body', dir: { x: best.x - mx, z: best.z - mz } });
      }
    }
  }

  updatePickups(dt) {
    const p = this.player;
    for (const k of this.pickups) {
      k.life -= dt;
      const dx = p.x - k.x, dy = p.y + 1 - k.y, dz = p.z - k.z, d = Math.hypot(dx, dy, dz);
      const want = k.kind === 'ammo' || p.hp < PLAYER.hp;
      if (p.alive && want && d < DROPS.magnet) {
        const s = 14 * dt / (d || 1);
        k.x += dx * Math.min(1, s); k.y += dy * Math.min(1, s); k.z += dz * Math.min(1, s);
        k.vx = k.vy = k.vz = 0;
        if (d < DROPS.collect) { this.collect(k); k.life = -1; }
        continue;
      }
      k.vy -= 14 * dt;
      k.x += k.vx * dt; k.z += k.vz * dt;
      k.vx *= 1 - dt * 2; k.vz *= 1 - dt * 2;
      const gy = this.geom.supportAt(k.x, k.z, 0.05, k.y + 0.3) + 0.35;
      k.y += k.vy * dt;
      if (k.y < gy) { k.y = gy; k.vy = Math.abs(k.vy) > 2 ? -k.vy * 0.3 : 0; }
      if (k.y < -15) k.life = -1;
    }
    this.pickups = this.pickups.filter((k) => k.life > 0);
  }

  collect(k) {
    const p = this.player;
    if (k.kind === 'orb') { p.hp = Math.min(PLAYER.hp, p.hp + k.heal); }
    else {
      let id = p.weapon;
      if (id === 'pistol') id = WEAPON_ORDER.filter((w) => p.owned[w] && w !== 'pistol').sort((a, b) => this.ammoFrac(a) - this.ammoFrac(b))[0] || 'pistol';
      if (id !== 'pistol') p.ammo[id].reserve = Math.min(WEAPONS[id].reserve * 1.5, p.ammo[id].reserve + Math.ceil(WEAPONS[id].mag / 2));
    }
    this.events.push({ t: 'pickup', kind: k.kind, x: k.x, y: k.y, z: k.z });
  }

  ammoFrac(id) { const w = WEAPONS[id]; return this.player.ammo[id].reserve / w.reserve; }

  // ── 상점 ──────────────────────────────────────────────
  canShop() { return this.state === 'prep' || this.state === 'intermission'; }

  nearTerminal() {
    const p = this.player;
    return TERMINALS.some((t) => Math.hypot(p.x - t.x, p.z - t.z) < 2.6 && Math.abs(p.y - t.y) < 1.5);
  }

  toggleShop() {
    if (this.shopOpen) { this.shopOpen = false; this.events.push({ t: 'shop', open: false }); return; }
    if (this.canShop() && this.nearTerminal()) { this.shopOpen = true; this.events.push({ t: 'shop', open: true }); }
  }

  shopItems() {
    const p = this.player, c = this.core, w = Math.max(1, this.wave), cr = this.credits;
    const items = [];
    const st = (price, extra = {}) => ({ price, state: price == null ? 'max' : cr >= price ? 'ok' : 'poor', ...extra });
    for (const id of ['shotgun', 'rifle', 'rail']) {
      const W = WEAPONS[id];
      items.push({ id, tab: 'weapon', name: W.name, desc: weaponDesc(id), ...(p.owned[id] ? { price: null, state: 'owned' } : st(W.price)) });
    }
    for (const id of WEAPON_ORDER) {
      const lv = p.levels[id], base = id === 'pistol' ? UPGRADE.pistolBase : WEAPONS[id].price;
      const price = lv >= 3 ? null : Math.round(base * UPGRADE.priceMul[lv]);
      const next = ['피해 +15%', '탄창 +30%', '재장전 −25%'][lv] || '최대';
      items.push({ id: 'up:' + id, tab: 'weapon', name: `${WEAPONS[id].name} 강화 ${lv}/3`, desc: next, level: lv, ...(!p.owned[id] ? { price, state: 'locked' } : st(price)) });
    }
    items.push({ id: 'armor', tab: 'gear', name: '방어구 +25', desc: `피해의 60%를 대신 받음 (${Math.round(p.armor)}/50)`, ...(p.armor >= PLAYER.armorMax ? { price: null, state: 'max' } : st(SHOP.armor.price)) });
    items.push({ id: 'heal', tab: 'gear', name: '체력 완전 회복', desc: `${Math.ceil(p.hp)}/100`, ...(p.hp >= PLAYER.hp ? { price: null, state: 'max' } : st(SHOP.heal.price(w))) });
    items.push({ id: 'emp', tab: 'gear', name: 'EMP 수류탄 +1', desc: `기계 적 2.5초 기절 (${p.emp}/3)`, ...(p.emp >= PLAYER.empMax ? { price: null, state: 'max' } : st(SHOP.emp.price)) });
    items.push({ id: 'ammo', tab: 'gear', name: '탄약 보충', desc: '모든 무기 예비탄 가득', ...st(SHOP.ammo.price) });
    items.push({ id: 'coreRepair', tab: 'core', name: '코어 수리 +300', desc: `${Math.ceil(c.hp)}/${c.max}`, ...(c.hp >= c.max ? { price: null, state: 'max' } : st(SHOP.coreRepair.price)) });
    const sl = c.shieldLevel;
    items.push({ id: 'coreShield', tab: 'core', name: `코어 실드 ${sl}/3`, desc: sl < 3 ? `웨이브마다 실드 ${CORE.shieldLevels[sl]}` : '최대', level: sl, ...(sl >= 3 ? { price: null, state: 'max' } : st(SHOP.coreShield.price[sl])) });
    const nt = this.turrets.filter((t) => t.built).length;
    items.push({ id: 'turret', tab: 'core', name: `자동 포탑 ${nt}/2`, desc: '리치·드론 우선 사격', level: nt, ...(nt >= 2 ? { price: null, state: 'max' } : st(SHOP.turret.price[nt])) });
    items.push({ id: 'corePulse', tab: 'core', name: '코어 EMP 펄스', desc: '15초마다 코어 주변 적 기절', ...(c.pulse ? { price: null, state: 'owned' } : st(SHOP.corePulse.price)) });
    return items;
  }

  buy(id) {
    if (!this.canShop()) return { ok: false, reason: 'closed' };
    const item = this.shopItems().find((i) => i.id === id);
    if (!item) return { ok: false, reason: 'unknown' };
    if (item.state !== 'ok') return { ok: false, reason: item.state };
    this.credits -= item.price;
    const p = this.player, c = this.core;
    if (WEAPONS[id]) {
      p.owned[id] = true;
      p.ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
      p.lastWeapon = p.weapon; p.weapon = id; p.switchT = 0.3; p.reloadT = -1;
    } else if (id.startsWith('up:')) {
      const w = id.slice(3);
      p.levels[w]++;
      if (p.levels[w] === 2) p.ammo[w].mag = Math.round(WEAPONS[w].mag * (1 + UPGRADE.mag));
    } else if (id === 'armor') p.armor = Math.min(PLAYER.armorMax, p.armor + SHOP.armor.amount);
    else if (id === 'heal') p.hp = PLAYER.hp;
    else if (id === 'emp') p.emp++;
    else if (id === 'ammo') { for (const w of WEAPON_ORDER) if (p.owned[w] && w !== 'pistol') p.ammo[w].reserve = WEAPONS[w].reserve; }
    else if (id === 'coreRepair') c.hp = Math.min(c.max, c.hp + SHOP.coreRepair.amount);
    else if (id === 'coreShield') { c.shieldLevel++; c.shield = CORE.shieldLevels[c.shieldLevel - 1]; }
    else if (id === 'turret') { const t = this.turrets.find((q) => !q.built); t.built = true; this.events.push({ t: 'turretBuilt', x: t.x, y: t.y, z: t.z }); }
    else if (id === 'corePulse') c.pulse = true;
    this.events.push({ t: 'buy', id, price: item.price });
    return { ok: true };
  }

  // 집행관 엄폐점: 플레이어와 10~26m, 시선 있음, 다른 집행관과 4m 이상, 가까울수록 좋음
  pickCover(e) {
    const g = this.geom, p = this.player, c = e.c;
    if (!this._covers) this._covers = buildCovers(g);
    const here = g.nearestClear(e.x, e.z, e.y + 0.6);
    if (here < 0) return -1;
    const dist = g.field([here], this._coverField || (this._coverField = new Float32Array(g.n * g.n)));
    let best = -1, bs = Infinity;
    const py = p.y + 1.2;
    for (let i = 0; i < this._covers.length; i++) {
      const k = this._covers[i];
      if (!isFinite(dist[k]) || dist[k] > 70 || dist[k] < 4) continue;
      const cc = g.cellCenter(k);
      const d = Math.hypot(cc.x - p.x, cc.z - p.z);
      if (d < c.rangeMin || d > c.rangeMax) continue;
      let crowd = false;
      for (const o of this.enemies) if (o !== e && o.type === 'enforcer' && o.coverK >= 0 && o.alive) {
        const oc = g.cellCenter(o.coverK); if (Math.hypot(oc.x - cc.x, oc.z - cc.z) < 4) { crowd = true; break; }
      }
      if (crowd) continue;
      const s = dist[k] * 0.15 + Math.abs(d - 17) * 0.4 + this.rng.next() * 3;
      if (s >= bs) continue;
      if (!g.los(cc.x, cc.y + 1.6, cc.z, p.x, py, p.z)) continue;
      bs = s; best = k;
    }
    return best;
  }
}

function weaponDesc(id) {
  return {
    shotgun: '근거리 압도 · 10펠릿 · 맞은 적이 밀려남',
    rifle: '만능 연사 · 3초 연사하면 피해 +20%',
    rail: '0.35초 충전 · 적 3기 관통 · 한 방 240',
  }[id];
}

// 엄폐점: 높이 1m 이상 장애물 옆의 통과 가능 칸
function buildCovers(g) {
  const out = [], n = g.n;
  for (let k = 0; k < n * n; k++) {
    if (!g.clear[k] || g.h[k] > 0.3) continue;
    const i = k % n, j = (k / n) | 0;
    let near = false;
    for (let dj = -2; dj <= 2 && !near; dj++) for (let di = -2; di <= 2; di++) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
      if (g.h[jj * n + ii] - g.h[k] >= 0.95) { near = true; break; }
    }
    if (near && (i + j) % 2 === 0) out.push(k);
  }
  return out;
}

// 선분(o + d·t, 0≤t≤len) vs 세로 캡슐(x, y0~y1, z, r): 처음 닿는 t 또는 −1 (근사: 샘플링)
function segToCapsule(ox, oy, oz, dx, dy, dz, len, cx, y0, cz, y1, r) {
  const n = Math.max(1, Math.ceil(len / (r * 0.8)));
  for (let i = 0; i <= n; i++) {
    const t = (len * i) / n;
    const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
    const yy = Math.max(y0, Math.min(y1, y));
    if ((x - cx) ** 2 + (y - yy) ** 2 + (z - cz) ** 2 < r * r) return t;
  }
  return -1;
}
