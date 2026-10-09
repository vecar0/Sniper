/**
 * 바람장. 거리 구간별 기본 바람 + 느린 변동 + 예고되는 돌풍.
 * 결정론적(시드 기반): 같은 미션·같은 시각 → 같은 바람. 리플레이·분석·테스트 재현이 가능하다.
 */
import type { WindSpec } from '../config/missions';
import { seededRandom } from '../config/missions';
import type { V3 } from './solver';

/** 구간 경계에서 바람이 섞이는 폭(m). 급격한 단절 대신 자연스러운 변화. */
const ZONE_BLEND = 40;

interface Gust {
  start: number;
  rise: number;
  hold: number;
  fall: number;
  strength: number;
}

export class WindField {
  private readonly spec: WindSpec;
  private readonly gusts: Gust[] = [];
  private readonly phase: number[];

  constructor(spec: WindSpec, seed: number) {
    this.spec = spec;
    const rnd = seededRandom(seed);
    this.phase = [rnd() * 100, rnd() * 100, rnd() * 100];
    const g = spec.gusts;
    if (g) {
      // 미션 시작 직후에는 돌풍 없음(첫 관측 시간 보장)
      let t = 6 + rnd() * (g.intervalMax - g.intervalMin);
      while (t < 1800) {
        this.gusts.push({ start: t, rise: g.rise, hold: g.hold, fall: g.fall, strength: g.strength * (0.75 + rnd() * 0.5) });
        t += g.rise + g.hold + g.fall + g.intervalMin + rnd() * (g.intervalMax - g.intervalMin);
      }
    }
  }

  /** 돌풍 세기(0~1 배율 × strength, m/s) */
  gustAt(t: number): number {
    for (const g of this.gusts) {
      if (t < g.start) break;
      const local = t - g.start;
      const total = g.rise + g.hold + g.fall;
      if (local > total) continue;
      let f: number;
      if (local < g.rise) f = local / g.rise;
      else if (local < g.rise + g.hold) f = 1;
      else f = 1 - (local - g.rise - g.hold) / g.fall;
      // 부드러운 곡선
      return g.strength * (f * f * (3 - 2 * f));
    }
    return 0;
  }

  /** 다음 돌풍까지 남은 시간(없으면 Infinity) – 테스트·디버그용 */
  nextGustIn(t: number): number {
    for (const g of this.gusts) if (g.start > t) return g.start - t;
    return Infinity;
  }

  private zoneAt(dist: number): { speed: number; dir: number } {
    const zones = this.spec.zones;
    let i = 0;
    while (i + 1 < zones.length && dist >= zones[i + 1].from) i++;
    const z = zones[i];
    const next = zones[i + 1];
    if (next && dist > next.from - ZONE_BLEND) {
      const f = (dist - (next.from - ZONE_BLEND)) / ZONE_BLEND;
      return { speed: z.speed + (next.speed - z.speed) * f, dir: lerpAngle(z.dir, next.dir, f) };
    }
    const prev = zones[i - 1];
    if (prev && dist < z.from + ZONE_BLEND && i > 0) {
      // 이전 구간 블렌드는 위에서 처리되므로 여기선 현재 값 그대로
      return { speed: z.speed, dir: z.dir };
    }
    return { speed: z.speed, dir: z.dir };
  }

  /** 거리·시각에서의 풍속(m/s)과 방향(도) */
  sample(dist: number, t: number): { speed: number; dir: number } {
    const z = this.zoneAt(Math.max(0, dist));
    const v = this.spec.variability;
    const p = this.phase;
    const noise = Math.sin(t * 0.21 + p[0] + dist * 0.004) * 0.6 + Math.sin(t * 0.53 + p[1]) * 0.4;
    const speed = Math.max(0, z.speed * (1 + v * noise) + (z.speed > 0 ? this.gustAt(t) : 0));
    const dir = z.dir + v * 25 * Math.sin(t * 0.17 + p[2]);
    return { speed, dir };
  }

  windAt(_x: number, _y: number, z: number, t: number, out: V3): V3 {
    const s = this.sample(-z, t);
    const r = (s.dir * Math.PI) / 180;
    out.x = Math.sin(r) * s.speed;
    out.y = 0;
    out.z = -Math.cos(r) * s.speed;
    return out;
  }
}

function lerpAngle(a: number, b: number, f: number): number {
  let d = ((b - a + 540) % 360) - 180;
  return a + d * f;
}

/** 바람 방향(불어가는 방향, 도) → 바람이 오는 시계 방향(1~12시) */
export function windClock(dir: number): number {
  const from = (((dir + 180) % 360) + 360) % 360;
  const h = Math.round(from / 30) % 12;
  return h === 0 ? 12 : h;
}

/** 직각 횡풍 성분(+ = 왼쪽→오른쪽) */
export function crossComponent(speed: number, dir: number): number {
  return speed * Math.sin((dir * Math.PI) / 180);
}
