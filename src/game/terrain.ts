/**
 * 지형 높이 함수(분석적). 렌더링 메시와 탄 충돌이 같은 함수를 쓴다.
 * 사격 회랑(사수 → 표적 방향)은 낮고 완만하게 유지해 시야가 막히지 않게 하고,
 * 회랑 밖은 언덕, 표적 뒤쪽은 배경 산으로 높여 장면을 감싼다.
 */
import type { ThemeId } from '../config/missions';

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return (a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf) * 2 - 1;
}

function fbm(x: number, y: number, seed: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq, seed + i * 17) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

export interface TerrainParams {
  theme: ThemeId;
  seed: number;
  /** 가장 먼 표적 거리(m) – 이보다 뒤에 배경 산을 세운다 */
  maxDist: number;
}

export const SHOOTER_GROUND = 6;

export class Terrain {
  readonly hillHeight: number;
  readonly backdropStart: number;
  readonly p: TerrainParams;

  constructor(p: TerrainParams) {
    this.p = p;
    this.hillHeight = p.theme === 'mountain' ? 70 : p.theme === 'desert' ? 22 : p.theme === 'snow' ? 40 : 30;
    this.backdropStart = Math.max(500, p.maxDist + 140);
  }

  /** 회랑 폭(m): 멀어질수록 넓어진다 */
  corridorHalfWidth(dist: number): number {
    return 45 + Math.max(0, dist) * 0.08;
  }

  height(x: number, z: number): number {
    const dist = -z;
    const seed = this.p.seed;
    // 회랑 바닥: 사수 둔덕(6m)에서 60m까지 내려간 뒤 ±1m의 완만한 기복
    let floor: number;
    if (dist < 60) {
      const f = Math.max(0, dist) / 60;
      floor = SHOOTER_GROUND * (1 - smooth(Math.min(1, f)));
      if (dist < 0) floor = SHOOTER_GROUND + Math.min(8, -dist * 0.15);
    } else {
      floor = 0;
    }
    const gentle = fbm(x * 0.004, z * 0.004, seed, 3) * 1.1 * Math.min(1, Math.max(0, (dist - 40) / 80));
    // 회랑 밖 언덕
    const half = this.corridorHalfWidth(dist);
    const outside = Math.max(0, Math.abs(x) - half);
    const hillMask = smooth(Math.min(1, outside / 160));
    const hills = (fbm(x * 0.0035, z * 0.0035, seed + 5, 4) * 0.5 + 0.55) * this.hillHeight * hillMask;
    // 표적 뒤 배경 산
    const back = Math.max(0, dist - this.backdropStart);
    const backMask = smooth(Math.min(1, back / 400));
    const backdrop = (fbm(x * 0.002, z * 0.002, seed + 11, 4) * 0.4 + 0.8) * this.hillHeight * 1.6 * backMask;
    return floor + gentle + hills + backdrop;
  }

  /** 법선(유한 차분) */
  normal(x: number, z: number): { x: number; y: number; z: number } {
    const e = 0.5;
    const hx = this.height(x + e, z) - this.height(x - e, z);
    const hz = this.height(x, z + e) - this.height(x, z - e);
    const nx = -hx;
    const ny = 2 * e;
    const nz = -hz;
    const l = Math.hypot(nx, ny, nz);
    return { x: nx / l, y: ny / l, z: nz / l };
  }
}
