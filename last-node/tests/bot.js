// 자동 플레이 봇: world.input(이동·시점·사격·대시·점프·카드 선택)만 쓴다. 상태는 전부 읽을 수 있다.
import { enemyParts } from '../js/sim/enemies.js';

const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export class Bot {
  constructor(world, { ignoreLeech = false, idle = false, seed = 1 } = {}) {
    this.w = world; this.ignoreLeech = ignoreLeech; this.idle = idle;
    this.r = seed * 9301 + 49297;
    this.orbit = 1; this.t = 0; this.dashCd = 0; this.lastDanger = 0;
    this.parts = [];
  }
  rnd() { this.r = (this.r * 9301 + 49297) % 233280; return this.r / 233280; }

  tick(dt) {
    const w = this.w, p = w.player, inp = w.input;
    this.t += dt; this.dashCd -= dt;
    if (this.idle) return;
    if (w.state === 'pick') { inp.pick = this.pickCard(); return; }
    if (w.state === 'intermission' || w.state === 'prep') inp.ready = true;
    // 목표 고르기
    let best = null, bs = Infinity;
    for (const e of w.enemies) {
      if (!e.alive) continue;
      if (this.ignoreLeech && e.type === 'leech') continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z);
      let s = d;
      if (e.type === 'leech') s -= 15;
      if (e.type === 'reaper' && d < 8) s -= 20;
      if (e.type === 'drone' && d < 10) s -= 12;
      if (e.type === 'boss') s += 15;
      if (s < bs) {
        const parts = enemyParts(e, this.parts);
        const q = parts.find((x) => x.kind === 'weak' || x.kind === 'engine') || parts[0];
        if (w.geom.los(p.x, p.y + p.eye, p.z, q.x, q.y, q.z)) { bs = s; best = { e, q: { ...q } }; }
      }
    }
    // 조준(회전 속도 제한 + 작은 오차)
    if (best) {
      const ex = best.q.x - p.x, ey = best.q.y - (p.y + p.eye), ez = best.q.z - p.z;
      const wantYaw = Math.atan2(-ex, -ez), wantPitch = Math.atan2(ey, Math.hypot(ex, ez));
      const max = 7 * dt;
      p.yaw += Math.max(-max, Math.min(max, wrap(wantYaw - p.yaw))) + (this.rnd() - 0.5) * 0.004;
      p.pitch += Math.max(-max, Math.min(max, wantPitch - p.pitch)) + (this.rnd() - 0.5) * 0.004;
      inp.fire = Math.abs(wrap(wantYaw - p.yaw)) < 0.06 && Math.abs(wantPitch - p.pitch) < 0.06;
      inp.ads = Math.hypot(ex, ez) > 12;
    } else { inp.fire = false; inp.ads = false; }
    const am = p.ammo[p.weapon];
    if (am.mag === 0 && am.reserve === 0) inp.slot = 'pistol';
    else if (am.mag === 0 || (!best && am.mag < 6)) inp.reload = true;
    // 무기: 가장 좋은 보유 무기(레일건은 먼 표적)
    if (p.owned.rifle && p.weapon !== 'rifle' && p.ammo.rifle.reserve + p.ammo.rifle.mag > 0) inp.slot = 'rifle';
    else if (!p.owned.rifle && p.owned.shotgun && p.weapon !== 'shotgun' && p.ammo.shotgun.reserve + p.ammo.shotgun.mag > 0) inp.slot = 'shotgun';
    // 이동: 코어 주변을 돈다 + 체력 낮으면 구슬로 + 위험하면 대시
    let tx, tz;
    const orb = p.hp < 75 ? w.pickups.filter((k) => k.kind === 'orb').sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0] : null;
    this.blind = best ? 0 : (this.blind || 0) + dt;
    const hunt = this.blind > 2 ? w.enemies.filter((e) => e.alive && e.type !== 'boss').sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0] : null;
    if (orb && Math.hypot(orb.x - p.x, orb.z - p.z) < 14) { tx = orb.x; tz = orb.z; }
    else if (hunt) { tx = hunt.x; tz = hunt.z; }
    else {
      const a = Math.atan2(p.z, p.x) + 0.5 * this.orbit;
      tx = Math.cos(a) * 8; tz = Math.sin(a) * 8;
      if (this.rnd() < dt * 0.15) this.orbit *= -1;
    }
    const dx = tx - p.x, dz = tz - p.z, l = Math.hypot(dx, dz) || 1;
    // 월드 방향 → 카메라 기준 입력
    const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
    const fx = -s, fz = -c, rx = c, rz = -s;
    inp.moveX = (dx * rx + dz * rz) / l; inp.moveZ = (dx * fx + dz * fz) / l;
    if (p.speed < 1 && p.grounded && this.rnd() < dt * 2) inp.jump = true;
    const danger = w.enemies.some((e) => e.alive && ((e.type === 'reaper' && e.state === 'windup') || (e.type === 'drone' && e.state !== 'fly') || e.missileWarn > 0) && Math.hypot(e.x - p.x, e.z - p.z) < 12);
    if (danger && this.dashCd <= 0 && p.dashCharges > 0) { inp.dash = true; this.dashCd = 0.6; }
    if (p.emp > 0 && w.enemies.filter((e) => e.alive && Math.hypot(e.x - p.x, e.z - p.z) < 6).length >= 3) inp.throwEmp = true;
  }

  // 카드: 무기(소총 > 산탄 > 레일) > 체력 > 무기 강화 > 나머지 무작위
  pickCard() {
    const o = this.w.offer;
    const pref = ['get:rifle', 'get:shotgun', 'maxhp', 'up:rifle', 'armor', 'vamp', 'get:rail'];
    for (const id of pref) { const i = o.indexOf(id); if (i >= 0) return i; }
    return Math.floor(this.rnd() * o.length);
  }
}

// 한 판 돌리기: 끝(게임 오버)까지 또는 maxTime까지
export function runGame(World, { seed, ignoreLeech = false, idle = false, maxTime = 900, untilWave = Infinity } = {}) {
  const w = new World({ seed });
  const bot = new Bot(w, { ignoreLeech, idle, seed });
  const dt = 1 / 60;
  let t = 0;
  while (t < maxTime && w.state !== 'over' && w.wave < untilWave) {
    bot.tick(dt); w.step(dt); w.events.length = 0; t += dt;
  }
  return { world: w, time: t };
}
