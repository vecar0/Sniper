/**
 * 사격 해(solution) 계산과 탄착 분석.
 * "왜 빗나갔는지"를 숫자로 알려줘서 실패가 다음 시도의 정보가 되게 한다.
 */
import { createProjectile, stepProjectile, type BallisticEnv, type ProjectileParams, type V3 } from '../ballistics/solver';

export interface Basis {
  f: V3;
  r: V3;
  u: V3;
}

export function basisToward(eye: V3, target: V3): Basis {
  let fx = target.x - eye.x, fy = target.y - eye.y, fz = target.z - eye.z;
  const fl = Math.hypot(fx, fy, fz) || 1;
  fx /= fl; fy /= fl; fz /= fl;
  // r = f × up
  let rx = -fz, rz = fx;
  const rl = Math.hypot(rx, rz) || 1;
  rx /= rl; rz /= rl;
  // u = r × f
  const ux = -rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy;
  return { f: { x: fx, y: fy, z: fz }, r: { x: rx, y: 0, z: rz }, u: { x: ux, y: uy, z: uz } };
}

/** 조준선 기준 고각/좌우(rad)를 적용한 총열 방향 */
export function boreDir(b: Basis, elevRad: number, windRad: number): V3 {
  const te = Math.tan(elevRad);
  const tw = Math.tan(windRad);
  const x = b.f.x + b.u.x * te + b.r.x * tw;
  const y = b.f.y + b.u.y * te + b.r.y * tw;
  const z = b.f.z + b.u.z * te + b.r.z * tw;
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
}

export function muzzleFrom(eye: V3, b: Basis, sightHeight: number): V3 {
  return { x: eye.x - b.u.x * sightHeight, y: eye.y - b.u.y * sightHeight, z: eye.z - b.u.z * sightHeight };
}

export interface SolveInput {
  params: ProjectileParams;
  env: BallisticEnv;
  sightHeight: number;
  zeroAngle: number;
  eye: V3;
  target: V3;
  targetVel: V3;
}

export interface Solution {
  /** 표적을 정조준했을 때 필요한 추가 고각(mil, +위) – 터렛+홀드 합계 */
  elevMil: number;
  /** 필요한 좌우 보정(mil, +오른쪽) */
  windMil: number;
  tof: number;
  range: number;
}

/** 움직이는 표적까지 탄을 보내기 위한 보정량을 반복 계산으로 구한다 */
export function solveFiringSolution(inp: SolveInput, iterations = 5): Solution {
  const b = basisToward(inp.eye, inp.target);
  const muzzle = muzzleFrom(inp.eye, b, inp.sightHeight);
  const range = Math.hypot(inp.target.x - inp.eye.x, inp.target.y - inp.eye.y, inp.target.z - inp.eye.z);
  let e = 0;
  let w = 0;
  let tof = 0;
  for (let it = 0; it < iterations; it++) {
    const miss = missAt(inp, b, muzzle, inp.zeroAngle + e / 1000, w / 1000, range);
    if (!miss) break;
    tof = miss.t;
    e -= miss.v;
    w -= miss.h;
    if (Math.abs(miss.v) < 0.005 && Math.abs(miss.h) < 0.005) break;
  }
  return { elevMil: e, windMil: w, tof, range };
}

/** 탄이 표적 거리 평면을 지날 때의 빗나감(mil) */
function missAt(inp: SolveInput, b: Basis, muzzle: V3, elev: number, wind: number, range: number): { v: number; h: number; t: number } | null {
  const p = createProjectile(inp.params, muzzle, boreDir(b, elev, wind));
  const dt = 0.002;
  let prevAlong = 0;
  let prev = { ...p.pos };
  let prevT = 0;
  const along = (x: number, y: number, z: number) => (x - inp.eye.x) * b.f.x + (y - inp.eye.y) * b.f.y + (z - inp.eye.z) * b.f.z;
  while (p.t < 8) {
    stepProjectile(p, inp.env, dt);
    const a = along(p.pos.x, p.pos.y, p.pos.z);
    // 표적은 탄이 날아가는 동안 움직인다
    const tx = inp.target.x + inp.targetVel.x * p.t;
    const ty = inp.target.y + inp.targetVel.y * p.t;
    const tz = inp.target.z + inp.targetVel.z * p.t;
    const targetAlong = along(tx, ty, tz);
    if (a >= targetAlong) {
      const f = (targetAlong - prevAlong) / (a - prevAlong || 1);
      const x = prev.x + (p.pos.x - prev.x) * f;
      const y = prev.y + (p.pos.y - prev.y) * f;
      const z = prev.z + (p.pos.z - prev.z) * f;
      const t = prevT + (p.t - prevT) * f;
      const mx = x - (inp.target.x + inp.targetVel.x * t);
      const my = y - (inp.target.y + inp.targetVel.y * t);
      const mz = z - (inp.target.z + inp.targetVel.z * t);
      const v = ((mx * b.u.x + my * b.u.y + mz * b.u.z) / range) * 1000;
      const h = ((mx * b.r.x + my * b.r.y + mz * b.r.z) / range) * 1000;
      return { v, h, t };
    }
    prevAlong = a;
    prev = { ...p.pos };
    prevT = p.t;
  }
  return null;
}

export interface ShotRecord {
  /** 쏜 순간 조준선이 표적 중심에서 벗어난 양(mil, 터렛 미포함): +위/+오른쪽 */
  losOffsetV: number;
  losOffsetH: number;
  /** 그중 흔들림이 만든 부분(mil) */
  swayV: number;
  swayH: number;
  elevDial: number;
  windDial: number;
  needed: Solution;
  /** 정지 표적이라 가정한 필요 보정(리드 분리용) */
  neededStatic: Solution;
  targetLabel: string;
  moving: boolean;
}

export interface Analysis {
  errV: number;
  errH: number;
  range: number;
  lines: string[];
  tip: string;
}

/** 보정 단위: 버튼 1번 = 1칸 = 0.1mil (100m에서 1cm) */
const clicks = (mil: number) => Math.round(Math.abs(mil) * 10);
const vClicks = (mil: number) => (clicks(mil) === 0 ? '0칸' : `${mil > 0 ? '▲' : '▼'}${clicks(mil)}칸`);
const hClicks = (mil: number) => (clicks(mil) === 0 ? '0칸' : `${mil > 0 ? '▶' : '◀'}${clicks(mil)}칸`);

/**
 * 빗나간 원인 분석: 위아래 보정 / 바람 / 앞질러 겨누기(리드) / 흔들림 중 가장 큰 원인을 찾아 팁을 준다.
 * 화면에는 mil 대신 "cm"와 "버튼 누를 횟수(칸)"로 보여준다.
 */
export function analyzeShot(rec: ShotRecord): Analysis {
  const actualV = rec.elevDial + rec.losOffsetV;
  const actualH = rec.windDial + rec.losOffsetH;
  const errV = actualV - rec.needed.elevMil;
  const errH = actualH - rec.needed.windMil;
  const range = rec.needed.range;
  const cm = (mil: number) => Math.round((Math.abs(mil) * range) / 10);
  const lines: string[] = [];
  const parts: string[] = [];
  if (cm(errV) >= 3) parts.push(`${cm(errV)}cm ${errV > 0 ? '위' : '아래'}`);
  if (cm(errH) >= 3) parts.push(`${cm(errH)}cm ${errH > 0 ? '오른쪽' : '왼쪽'}`);
  lines.push(parts.length ? `${parts.join(' · ')}로 빗나감` : '아주 근소하게 빗나감');
  lines.push(`위아래: 필요 ${vClicks(rec.needed.elevMil)} / 쏠 때 ${vClicks(actualV)} (다이얼 ${vClicks(rec.elevDial)} + 조준 ${vClicks(rec.losOffsetV)})`);
  const lead = rec.needed.windMil - rec.neededStatic.windMil;
  if (rec.moving && Math.abs(lead) > 0.1) {
    lines.push(`좌우: 필요 ${hClicks(rec.needed.windMil)} (바람 ${hClicks(rec.neededStatic.windMil)} + 앞질러 겨누기 ${hClicks(lead)}) / 쏠 때 ${hClicks(actualH)}`);
  } else {
    lines.push(`좌우: 필요 ${hClicks(rec.needed.windMil)} / 쏠 때 ${hClicks(actualH)}`);
  }
  lines.push(`거리 ${Math.round(range)}m · 탄 도착까지 ${rec.needed.tof.toFixed(2)}초`);

  // 원인 판정: 흔들림이 만든 부분과 보정(다이얼·조준점)이 틀린 부분을 분리한다
  const swayMag = Math.hypot(rec.swayV, rec.swayH);
  const dialV = errV - rec.swayV;
  const dialH = errH - rec.swayH;
  const candidates: { score: number; tip: string }[] = [];
  if (swayMag > 0.15) candidates.push({ score: swayMag, tip: `조준이 흔들렸습니다(약 ${cm(swayMag)}cm). [숨]을 누르고 있으면 흔들림이 80% 줄어듭니다. 멈춘 순간 쏘세요.` });
  if (Math.abs(dialV) > 0.15) {
    const n = clicks(dialV);
    const tip = dialV < 0 ? `위아래 보정이 ${n}칸 모자랍니다. ▲를 ${n}번 더 누르세요.` : `위아래 보정이 ${n}칸 너무 많습니다. ▼를 ${n}번 누르세요.`;
    candidates.push({ score: Math.abs(dialV), tip: `${tip} 거리를 다시 재 보세요.` });
  }
  if (Math.abs(dialH) > 0.15) {
    const actualNoSway = actualH - rec.swayH;
    const n = clicks(dialH);
    if (rec.moving && Math.abs(lead) > 0.3 && Math.sign(dialH) !== Math.sign(lead) && Math.abs(actualNoSway - rec.neededStatic.windMil) < Math.abs(lead))
      candidates.push({ score: Math.abs(dialH), tip: `움직이는 표적입니다. 탄이 가는 동안 표적도 걷습니다. 걷는 방향으로 눈금 ${(Math.abs(lead)).toFixed(1)}개만큼 앞을 겨누세요.` });
    else
      candidates.push({
        score: Math.abs(dialH),
        tip: `바람 때문에 ${cm(dialH)}cm ${dialH > 0 ? '오른쪽' : '왼쪽'}으로 밀렸습니다. ${dialH > 0 ? '◀' : '▶'}를 ${n}번 누르세요(또는 그만큼 ${dialH > 0 ? '왼쪽' : '오른쪽'}을 겨누기).`,
      });
  }
  candidates.sort((a, b) => b.score - a.score);
  const tip = candidates[0]?.tip ?? '아주 근소한 차이입니다. 같은 보정으로 한 번 더!';
  return { errV, errH, range, lines, tip };
}
