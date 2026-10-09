/**
 * 외부 탄도 적분기. 엔진(Three.js)과 독립된 순수 계산 코드.
 *
 *   a = g + a_drag
 *   a_drag = -(ρ · Cd_G7(M) · π / (8 · BC)) · |v_rel| · v_rel,   v_rel = v - wind
 *
 * RK4로 적분하고, 스핀 드리프트(Litz 근사식)는 위치 오프셋으로 더한다.
 */
import { BC_TO_SI, g7Cd } from './drag';

export interface V3 {
  x: number;
  y: number;
  z: number;
}

export interface BallisticEnv {
  density: number;
  soundSpeed: number;
  gravity: number;
  /** 위치·시각의 바람 속도(m/s)를 out에 기록 */
  windAt(x: number, y: number, z: number, t: number, out: V3): V3;
}

export interface ProjectileParams {
  muzzleVelocity: number;
  bcG7: number;
  /** 자이로 안정 계수 – 0이면 스핀 드리프트 없음 */
  stability: number;
}

export interface Projectile {
  pos: V3;
  vel: V3;
  t: number;
  /** 스핀 드리프트 방향(수평, 발사 방향의 오른쪽) */
  right: V3;
  spinDrift: number;
  stability: number;
  dragK: number;
}

export const NO_WIND = (_x: number, _y: number, _z: number, _t: number, out: V3): V3 => {
  out.x = 0;
  out.y = 0;
  out.z = 0;
  return out;
};

export function createProjectile(params: ProjectileParams, origin: V3, dir: V3): Projectile {
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const v = params.muzzleVelocity / len;
  // 오른쪽 = 진행 방향 × 위쪽 (y-up, 오른손 좌표계)
  const hx = -dir.z;
  const hz = dir.x;
  const hl = Math.hypot(hx, hz) || 1;
  return {
    pos: { ...origin },
    vel: { x: dir.x * v, y: dir.y * v, z: dir.z * v },
    t: 0,
    right: { x: hx / hl, y: 0, z: hz / hl },
    spinDrift: 0,
    stability: params.stability,
    dragK: Math.PI / (8 * params.bcG7 * BC_TO_SI),
  };
}

const wind: V3 = { x: 0, y: 0, z: 0 };

function accel(p: Projectile, env: BallisticEnv, px: number, py: number, pz: number, vx: number, vy: number, vz: number, t: number, out: V3): void {
  env.windAt(px, py, pz, t, wind);
  const rx = vx - wind.x;
  const ry = vy - wind.y;
  const rz = vz - wind.z;
  const speed = Math.hypot(rx, ry, rz);
  const cd = g7Cd(speed / env.soundSpeed);
  const k = env.density * cd * p.dragK * speed;
  out.x = -k * rx;
  out.y = -k * ry - env.gravity;
  out.z = -k * rz;
}

const k1v: V3 = { x: 0, y: 0, z: 0 };
const k2v: V3 = { x: 0, y: 0, z: 0 };
const k3v: V3 = { x: 0, y: 0, z: 0 };
const k4v: V3 = { x: 0, y: 0, z: 0 };

/** 스핀 드리프트(m) – Litz: 1.25·(SG+1.2)·t^1.83 (inch) */
export function spinDriftAt(stability: number, t: number): number {
  if (stability <= 0) return 0;
  return 0.0254 * 1.25 * (stability + 1.2) * Math.pow(t, 1.83);
}

/** RK4 한 스텝 */
export function stepProjectile(p: Projectile, env: BallisticEnv, dt: number): void {
  const { pos, vel, t } = p;
  accel(p, env, pos.x, pos.y, pos.z, vel.x, vel.y, vel.z, t, k1v);

  const h = dt / 2;
  accel(
    p, env,
    pos.x + vel.x * h, pos.y + vel.y * h, pos.z + vel.z * h,
    vel.x + k1v.x * h, vel.y + k1v.y * h, vel.z + k1v.z * h,
    t + h, k2v,
  );
  const v2x = vel.x + k1v.x * h, v2y = vel.y + k1v.y * h, v2z = vel.z + k1v.z * h;
  accel(
    p, env,
    pos.x + v2x * h, pos.y + v2y * h, pos.z + v2z * h,
    vel.x + k2v.x * h, vel.y + k2v.y * h, vel.z + k2v.z * h,
    t + h, k3v,
  );
  const v3x = vel.x + k2v.x * h, v3y = vel.y + k2v.y * h, v3z = vel.z + k2v.z * h;
  accel(
    p, env,
    pos.x + v3x * dt, pos.y + v3y * dt, pos.z + v3z * dt,
    vel.x + k3v.x * dt, vel.y + k3v.y * dt, vel.z + k3v.z * dt,
    t + dt, k4v,
  );
  const v4x = vel.x + k3v.x * dt, v4y = vel.y + k3v.y * dt, v4z = vel.z + k3v.z * dt;

  pos.x += (dt / 6) * (vel.x + 2 * v2x + 2 * v3x + v4x);
  pos.y += (dt / 6) * (vel.y + 2 * v2y + 2 * v3y + v4y);
  pos.z += (dt / 6) * (vel.z + 2 * v2z + 2 * v3z + v4z);
  vel.x += (dt / 6) * (k1v.x + 2 * k2v.x + 2 * k3v.x + k4v.x);
  vel.y += (dt / 6) * (k1v.y + 2 * k2v.y + 2 * k3v.y + k4v.y);
  vel.z += (dt / 6) * (k1v.z + 2 * k2v.z + 2 * k3v.z + k4v.z);
  p.t = t + dt;

  const drift = spinDriftAt(p.stability, p.t);
  const dd = drift - p.spinDrift;
  p.spinDrift = drift;
  pos.x += p.right.x * dd;
  pos.z += p.right.z * dd;
}

export function speedOf(p: Projectile): number {
  return Math.hypot(p.vel.x, p.vel.y, p.vel.z);
}

export interface TrajectoryPoint {
  /** 전방 수평 거리(m) */
  range: number;
  /** 조준선 기준 높이(m, +위) */
  drop: number;
  /** 조준선 기준 좌우(m, +오른쪽) */
  lateral: number;
  time: number;
  velocity: number;
}

/**
 * 평지 수평 조준선 기준 궤적. 사수는 원점, 발사 방향 -Z, 총열은 조준선 아래 sightHeight.
 * elevation/windage: 조준선 대비 총열 각도(rad).
 */
export function flatTrajectory(
  params: ProjectileParams,
  env: BallisticEnv,
  sightHeight: number,
  elevation: number,
  windage: number,
  ranges: number[],
  dt = 0.0005,
): TrajectoryPoint[] {
  const dir = { x: Math.sin(windage) * Math.cos(elevation), y: Math.sin(elevation), z: -Math.cos(windage) * Math.cos(elevation) };
  const p = createProjectile(params, { x: 0, y: -sightHeight, z: 0 }, dir);
  const out: TrajectoryPoint[] = [];
  const sorted = [...ranges].sort((a, b) => a - b);
  let idx = 0;
  let prevX = p.pos.x;
  let prevY = p.pos.y;
  let prevZ = p.pos.z;
  let prevT = 0;
  let prevV = speedOf(p);
  while (idx < sorted.length && p.t < 10) {
    stepProjectile(p, env, dt);
    const range = -p.pos.z;
    while (idx < sorted.length && range >= sorted[idx]) {
      const target = sorted[idx];
      const pr = -prevZ;
      const f = range === pr ? 1 : (target - pr) / (range - pr);
      const v = speedOf(p);
      out.push({
        range: target,
        drop: prevY + (p.pos.y - prevY) * f,
        lateral: prevX + (p.pos.x - prevX) * f,
        time: prevT + (p.t - prevT) * f,
        velocity: prevV + (v - prevV) * f,
      });
      idx++;
    }
    prevX = p.pos.x;
    prevY = p.pos.y;
    prevZ = p.pos.z;
    prevT = p.t;
    prevV = speedOf(p);
  }
  return out;
}

/** 영점: 조준선과 탄도가 zeroRange에서 만나도록 하는 총열 고각(rad) – 이분법 */
export function solveZeroAngle(params: ProjectileParams, env: BallisticEnv, sightHeight: number, zeroRange: number): number {
  const noSpin = { ...params, stability: 0 };
  const calm: BallisticEnv = { ...env, windAt: NO_WIND };
  let lo = -0.01;
  let hi = 0.05;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const [pt] = flatTrajectory(noSpin, calm, sightHeight, mid, 0, [zeroRange], 0.001);
    if (!pt || pt.drop < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface DopeRow {
  range: number;
  /** 필요 고각(mil, +위) */
  elevationMil: number;
  /** 1m/s 직각 횡풍당 좌우 보정(mil) */
  windPerMpsMil: number;
  /** 스핀 드리프트(mil, +오른쪽) */
  spinMil: number;
  time: number;
  velocity: number;
  /** 운동에너지(J) */
  energy: number;
}

/** 탄도표(DOPE 카드) 계산 */
export function buildDope(
  params: ProjectileParams,
  mass: number,
  env: BallisticEnv,
  sightHeight: number,
  zeroAngle: number,
  ranges: number[],
): DopeRow[] {
  const calm: BallisticEnv = { ...env, windAt: NO_WIND };
  const noSpin = { ...params, stability: 0 };
  const base = flatTrajectory(noSpin, calm, sightHeight, zeroAngle, 0, ranges);
  const windy: BallisticEnv = {
    ...env,
    windAt: (_x, _y, _z, _t, out) => {
      out.x = 1;
      out.y = 0;
      out.z = 0;
      return out;
    },
  };
  const wind = flatTrajectory(noSpin, windy, sightHeight, zeroAngle, 0, ranges);
  return base.map((pt, i) => {
    const w = wind[i];
    const spin = spinDriftAt(params.stability, pt.time);
    return {
      range: pt.range,
      elevationMil: (-pt.drop / pt.range) * 1000,
      windPerMpsMil: w ? (w.lateral / pt.range) * 1000 : 0,
      spinMil: (spin / pt.range) * 1000,
      time: pt.time,
      velocity: pt.velocity,
      energy: 0.5 * mass * pt.velocity * pt.velocity,
    };
  });
}
