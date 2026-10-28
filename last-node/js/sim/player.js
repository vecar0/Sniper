// 요원(플레이어): 이동(대시·더블 점프·슬라이드) · 무기 · 근접 · EMP 투척
import { PLAYER as P, WEAPONS, WEAPON_ORDER, UPGRADE, EMP, TICK } from '../config/balance.js';
import { PLAYER_START } from '../config/map.js';

const DEG = Math.PI / 180;

export function makePlayer() {
  const ammo = {};
  for (const id of WEAPON_ORDER) ammo[id] = { mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
  return {
    x: PLAYER_START.x, y: PLAYER_START.y, z: PLAYER_START.z, px: PLAYER_START.x, py: PLAYER_START.y, pz: PLAYER_START.z,
    vx: 0, vy: 0, vz: 0, r: P.radius, h: P.height, grounded: true, landSpeed: 0,
    yaw: PLAYER_START.yaw, pitch: 0,
    hp: P.hp, maxHp: P.hp, armor: 0, alive: true, perks: {},
    dashMax: P.dashCharges, dashCdMul: 1, empMax: P.empMax,
    dashCharges: P.dashCharges, dashRecharge: 0, dashT: 0, dashDx: 0, dashDz: 0,
    airJumps: 1, crouch: false, slideT: 0, slideCd: 0, eye: P.eye,
    weapon: 'pistol', lastWeapon: 'pistol', owned: { pistol: true }, levels: { pistol: 0, shotgun: 0, rifle: 0, rail: 0 }, ammo,
    fireCd: 0, reloadT: -1, switchT: 0, charge: 0, sustain: 0, lastShot: -9, recoilDebt: 0,
    ads: 0, meleeCd: 0, meleeT: 0, meleeHitT: 0, emp: P.empStart, hurtT: 9, bob: 0, speed: 0,
  };
}

export function weaponStat(p, id) {
  const w = WEAPONS[id], lv = p.levels[id] || 0;
  return {
    dmg: w.dmg * (lv >= 1 ? 1 + UPGRADE.dmg : 1),
    mag: lv >= 2 ? Math.round(w.mag * (1 + UPGRADE.mag)) : w.mag,
    reload: w.reload * (lv >= 3 ? 1 - UPGRADE.reload : 1),
  };
}

export function forward(p) {
  const cp = Math.cos(p.pitch);
  return { x: -Math.sin(p.yaw) * cp, y: Math.sin(p.pitch), z: -Math.cos(p.yaw) * cp };
}

export function eyePos(p) {
  return { x: p.x, y: p.y + p.eye, z: p.z };
}

export function updatePlayer(world, p, inp, dt) {
  p.px = p.x; p.py = p.y; p.pz = p.z;
  if (!p.alive) return;
  const ev = world.events;
  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
  // 이동 입력(카메라 기준)
  let mx = inp.moveX || 0, mz = inp.moveZ || 0;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  let wx = cy * mx - sy * mz, wz = -sy * mx - cy * mz;
  const wl = Math.hypot(wx, wz);

  // 숙이기 / 슬라이드
  const hSpeed = Math.hypot(p.vx, p.vz);
  p.slideCd = Math.max(0, p.slideCd - dt);
  if (inp.crouch && !p.crouch && p.grounded && hSpeed > 5 && p.slideCd <= 0 && p.slideT <= 0) {
    const s = Math.max(hSpeed, P.slideBoost);
    p.vx = (p.vx / hSpeed) * s; p.vz = (p.vz / hSpeed) * s;
    p.slideT = P.slideTime; p.slideCd = P.slideTime + P.slideCooldown;
    ev.push({ t: 'slide' });
  }
  p.crouch = !!inp.crouch || p.slideT > 0;
  if (p.slideT > 0) { p.slideT -= dt; if (!inp.crouch && p.slideT < P.slideTime - 0.25) p.slideT = Math.min(p.slideT, 0); }
  p.h = p.crouch ? P.crouchHeight : P.height;
  const targetEye = p.crouch ? P.crouchEye : P.eye;
  p.eye += (targetEye - p.eye) * Math.min(1, dt * 14);

  // 대시
  if (p.dashCharges < p.dashMax) {
    p.dashRecharge += dt;
    if (p.dashRecharge >= P.dashRecharge * p.dashCdMul) { p.dashCharges++; p.dashRecharge = 0; }
  } else p.dashRecharge = 0;
  if (inp.dash && p.dashCharges > 0 && p.dashT <= 0) {
    let dx = wx, dz = wz;
    if (wl < 0.1) { dx = -sy; dz = -cy; }
    const l = Math.hypot(dx, dz);
    p.dashDx = dx / l; p.dashDz = dz / l;
    p.dashT = P.dashTime; p.dashCharges--; p.slideT = 0; p.dashHit = new Set();
    ev.push({ t: 'dash', dx: p.dashDx, dz: p.dashDz });
  }

  if (p.dashT > 0) {
    const sp = P.dashDist / P.dashTime;
    p.vx = p.dashDx * sp; p.vz = p.dashDz * sp; p.vy = 0;
    p.dashT -= dt;
    // 강화 '충격 돌파': 대시로 스친 적 기절
    if (p.perks.dashStun) for (const e of world.enemies) {
      if (!e.alive || e.type === 'boss' || p.dashHit.has(e.id)) continue;
      if (Math.hypot(e.x - p.x, e.z - p.z) < 1.4 + e.r && Math.abs(e.y - p.y) < 2) { p.dashHit.add(e.id); e.stun = Math.max(e.stun, 1.0); world.events.push({ t: 'dashStun', id: e.id, x: e.x, y: e.y + 0.8, z: e.z }); }
    }
    if (p.dashT <= 0) { p.vx = p.dashDx * P.speed; p.vz = p.dashDz * P.speed; }
  } else if (p.slideT > 0) {
    const f = Math.max(0, 1 - dt * 1.6);
    p.vx *= f; p.vz *= f;
    p.vy -= P.gravity * dt;
  } else {
    const max = p.crouch ? P.crouchSpeed : P.speed;
    const tx = wx * max, tz = wz * max;
    const acc = (p.grounded ? P.groundAccel : P.airAccel) * dt;
    if (p.grounded || wl > 0.1) {
      let ex = tx - p.vx, ez = tz - p.vz;
      const el = Math.hypot(ex, ez);
      if (el > acc) { ex *= acc / el; ez *= acc / el; }
      p.vx += ex; p.vz += ez;
    }
    p.vy -= P.gravity * dt;
  }

  // 점프 / 더블 점프
  if (inp.jump) {
    const jv = Math.sqrt(2 * P.gravity * P.jumpHeight);
    if (p.grounded) { p.vy = jv; p.grounded = false; p.airJumps = 1; ev.push({ t: 'jump', double: false }); }
    else if (p.airJumps > 0) {
      p.vy = jv; p.airJumps = 0; p.dashT = 0;
      if (wl > 0.1) { const s = Math.max(Math.hypot(p.vx, p.vz), P.speed * 0.8); p.vx = wx * s; p.vz = wz * s; }
      ev.push({ t: 'jump', double: true });
    }
  }

  const wasGrounded = p.grounded;
  const res = world.geom.move(p, p.vx * dt, p.vz * dt, dt, P.stepUp);
  if (res.blockedX) p.vx = 0;
  if (res.blockedZ) p.vz = 0;
  if (p.grounded) { p.airJumps = 1; if (!wasGrounded && p.landSpeed > 7) ev.push({ t: 'land', speed: p.landSpeed }); }
  p.speed = Math.hypot(p.vx, p.vz);
  if (p.grounded) p.bob += p.speed * dt;

  // 추락
  if (p.y < P.fallY) {
    p.x = P.respawn.x; p.y = P.respawn.y; p.z = P.respawn.z; p.px = p.x; p.py = p.y; p.pz = p.z;
    p.vx = p.vy = p.vz = 0; p.dashT = 0; p.slideT = 0;
    ev.push({ t: 'fall' });
    world.hurtPlayer(P.fallDamage, null, 'fall', true);
  }

  updateWeapons(world, p, inp, dt);

  // 근접
  p.meleeCd -= dt; p.meleeT -= dt;
  if (inp.melee && p.meleeCd <= 0 && p.switchT <= 0 && p.reloadT < 0) {
    p.meleeCd = P.meleeCooldown; p.meleeT = P.meleeDuration; p.meleeHitT = P.meleeWindup;
    world.events.push({ t: 'meleeStart', w: p.weapon });
  }
  if (p.meleeHitT > 0) { p.meleeHitT -= dt; if (p.meleeHitT <= 0) world.melee(); }   // 개머리판이 닿는 순간 판정

  // EMP 투척(떼는 순간)
  if (inp.throwEmp && p.emp > 0) {
    const f = forward(p);
    p.emp--;
    world.throwEmp(p.x + f.x * 0.5, p.y + p.eye - 0.2, p.z + f.z * 0.5,
      f.x * EMP.throwSpeed + p.vx * 0.4, f.y * EMP.throwSpeed + EMP.upSpeed, f.z * EMP.throwSpeed + p.vz * 0.4);
  }
  p.hurtT += dt;
}

function updateWeapons(world, p, inp, dt) {
  const ev = world.events;
  const id = p.weapon, w = WEAPONS[id], st = weaponStat(p, id), am = p.ammo[id];
  p.fireCd -= dt;
  p.ads += ((inp.ads && p.dashT <= 0 ? 1 : 0) - p.ads) * Math.min(1, dt * 12);

  // 무기 교체
  let want = null;
  if (inp.slot && p.owned[inp.slot] && inp.slot !== id) want = inp.slot;
  if (inp.cycle) {
    const owned = WEAPON_ORDER.filter((k) => p.owned[k]);
    const i = owned.indexOf(id);
    want = owned[(i + (inp.cycle > 0 ? 1 : owned.length - 1)) % owned.length];
    if (want === id) want = null;
  }
  if (inp.lastWeapon && p.owned[p.lastWeapon] && p.lastWeapon !== id) want = p.lastWeapon;
  if (want) {
    p.lastWeapon = id; p.weapon = want; p.switchT = 0.32; p.reloadT = -1; p.charge = 0; p.sustain = 0;
    ev.push({ t: 'switch', w: want });
    return;
  }
  if (p.switchT > 0) { p.switchT -= dt; return; }
  if (p.meleeT > 0) { p.charge = 0; return; }   // 근접 동작 중에는 쏘지도 재장전하지도 않는다

  // 재장전
  const canReload = am.mag < st.mag && am.reserve > 0;
  if (inp.reload && canReload && p.reloadT < 0) startReload(p, w, st, ev);
  if (p.reloadT >= 0) {
    p.reloadT -= dt;
    if (w.perShell) {
      // 산탄: 한 발씩. 쏘면 중단
      if (inp.fire && am.mag > 0) { p.reloadT = -1; }
      else if (p.reloadT <= 0) {
        am.mag++; if (am.reserve !== Infinity) am.reserve--;
        ev.push({ t: 'shell' });
        if (am.mag < st.mag && am.reserve > 0) p.reloadT = st.reload; else { p.reloadT = -1; ev.push({ t: 'reloadEnd', w: id }); }
      }
      if (p.reloadT >= 0) return;
    } else {
      if (p.reloadT <= 0) {
        const need = st.mag - am.mag;
        const take = am.reserve === Infinity ? need : Math.min(need, am.reserve);
        am.mag += take; if (am.reserve !== Infinity) am.reserve -= take;
        p.reloadT = -1; ev.push({ t: 'reloadEnd', w: id });
      }
      return;
    }
  }

  // 반동 회복
  if (p.recoilDebt > 0 && world.time - p.lastShot > 0.12) {
    const r = Math.min(p.recoilDebt, 9 * DEG * dt);
    p.pitch -= r; p.recoilDebt -= r;
  }
  if (world.time - p.lastShot > 0.25) p.sustain = 0;

  if (!inp.fire || p.dashT > 0) { p.charge = 0; return; }
  if (am.mag <= 0) {
    if (p.fireCd <= 0) { ev.push({ t: 'empty' }); p.fireCd = 0.3; if (am.reserve > 0) startReload(p, w, st, ev); }
    return;
  }
  if (w.charge) {
    if (p.fireCd > 0) return;
    if (p.charge === 0) ev.push({ t: 'charge' });
    p.charge += dt;
    if (p.charge < w.charge) return;
    p.charge = 0;
  }
  if (p.fireCd > 0) return;
  p.fireCd = 1 / w.rate;
  am.mag--;
  if (world.time - p.lastShot < 0.2) p.sustain += 1 / w.rate; else p.sustain = 0;
  p.lastShot = world.time;
  let dmg = st.dmg;
  if (w.sustainTime && p.sustain >= w.sustainTime) dmg *= 1 + w.sustainBonus;
  world.fireHitscan(id, w, dmg);
  // 반동(실제 조준이 조금 올라가고, 멈추면 대부분 돌아온다)
  const kick = w.recoil * DEG * (1 - 0.4 * p.ads) * 0.35;
  p.pitch = Math.min(1.45, p.pitch + kick); p.recoilDebt += kick * 0.7;
  p.yaw += (world.rng.next() - 0.5) * kick * 0.4;
  if (am.mag === 0 && am.reserve > 0) p.fireCd = Math.max(p.fireCd, 0.15);
}

function startReload(p, w, st, ev) {
  p.reloadT = w.perShell ? (w.reloadStart || 0) + st.reload : st.reload;
  p.charge = 0;
  ev.push({ t: 'reloadStart', w: p.weapon, time: p.reloadT });
}

// 퍼짐 적용 방향(원뿔 안 균일)
export function spreadDir(rng, f, deg) {
  if (deg <= 0) return { x: f.x, y: f.y, z: f.z };
  const a = rng.next() * Math.PI * 2, r = Math.sqrt(rng.next()) * Math.tan(deg * DEG);
  // f에 수직인 두 축
  let ux = -f.z, uy = 0, uz = f.x;
  let ul = Math.hypot(ux, uz);
  if (ul < 1e-6) { ux = 1; uz = 0; ul = 1; }
  ux /= ul; uz /= ul;
  const vx = f.y * uz - f.z * uy, vy = f.z * ux - f.x * uz, vz = f.x * uy - f.y * ux;
  const dx = f.x + (ux * Math.cos(a) + vx * Math.sin(a)) * r;
  const dy = f.y + (uy * Math.cos(a) + vy * Math.sin(a)) * r;
  const dz = f.z + (uz * Math.cos(a) + vz * Math.sin(a)) * r;
  const l = Math.hypot(dx, dy, dz);
  return { x: dx / l, y: dy / l, z: dz / l };
}

export const PLAYER_TICK = TICK;
