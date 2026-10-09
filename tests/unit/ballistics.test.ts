import { describe, expect, it } from 'vitest';
import { airDensity, speedOfSound } from '../../src/ballistics/atmosphere';
import { g7Cd } from '../../src/ballistics/drag';
import { buildDope, flatTrajectory, NO_WIND, solveZeroAngle, type BallisticEnv } from '../../src/ballistics/solver';
import { WindField, windClock, crossComponent } from '../../src/ballistics/wind';

const std: BallisticEnv = { density: airDensity(0, 15), soundSpeed: speedOfSound(15), gravity: 9.80665, windAt: NO_WIND };
// .308 175gr SMK: 2600fps, G7 0.243 – 공개 탄도 계산기(JBM 등) 결과와 비교
const m308 = { muzzleVelocity: 792.5, bcG7: 0.243, stability: 0 };
const YD = 0.9144;

describe('대기', () => {
  it('해수면 15°C 밀도 ≈ 1.225', () => {
    expect(airDensity(0, 15)).toBeCloseTo(1.225, 2);
  });
  it('고도 2200m는 해수면보다 약 20% 희박', () => {
    const r = airDensity(2200, 4) / airDensity(0, 15);
    expect(r).toBeGreaterThan(0.76);
    expect(r).toBeLessThan(0.84);
  });
  it('음속 15°C ≈ 340m/s', () => {
    expect(speedOfSound(15)).toBeCloseTo(340.3, 0);
  });
});

describe('G7 항력', () => {
  it('음속 근처에서 급증', () => {
    expect(g7Cd(0.5)).toBeCloseTo(0.1194, 3);
    expect(g7Cd(1.05)).toBeGreaterThan(3 * g7Cd(0.7));
    expect(g7Cd(2.0)).toBeCloseTo(0.298, 3);
  });
});

// 공개 계산기(G7 0.243 기준) 수치 대비 약 ±15% 범위를 허용한다.
// 게임에 중요한 것은 '실제와 비슷한 크기 + 거리에 따른 올바른 경향 + 결정론적 일관성'이다.
describe('.308 175gr 탄도 – 공개 탄도표 대비 오차 범위', () => {
  // 100야드 영점, 조준선 높이 1.5인치
  const sight = 1.5 * 0.0254;
  const zero = solveZeroAngle(m308, std, sight, 100 * YD);
  const pts = flatTrajectory(m308, std, sight, zero, 0, [100 * YD, 500 * YD, 1000 * YD]);

  it('영점 거리에서 조준선과 일치', () => {
    expect(Math.abs(pts[0].drop)).toBeLessThan(0.002);
  });
  it('500야드: 낙차 ≈ -55~-65인치', () => {
    const inches = pts[1].drop / 0.0254;
    expect(inches).toBeGreaterThan(-70);
    expect(inches).toBeLessThan(-50);
  });
  it('1000야드: 고각 ≈ 10.5~12mil, 속도 ≈ 1100~1250fps, 비행 ≈ 1.7초', () => {
    const p = pts[2];
    const mil = (-p.drop / p.range) * 1000;
    expect(mil).toBeGreaterThan(10);
    expect(mil).toBeLessThan(12.6);
    const fps = p.velocity / 0.3048;
    expect(fps).toBeGreaterThan(1050);
    expect(fps).toBeLessThan(1350);
    expect(p.time).toBeGreaterThan(1.55);
    expect(p.time).toBeLessThan(1.85);
  });
  it('10mph 횡풍 1000야드 편류 ≈ 2.4~3.2mil', () => {
    const windy: BallisticEnv = { ...std, windAt: (_x, _y, _z, _t, o) => ((o.x = 10 * 0.44704), (o.y = 0), (o.z = 0), o) };
    const [w] = flatTrajectory(m308, windy, sight, zero, 0, [1000 * YD]);
    const mil = (w.lateral / w.range) * 1000;
    expect(mil).toBeGreaterThan(2.2);
    expect(mil).toBeLessThan(3.3);
  });
});

describe('탄도표', () => {
  it('거리가 늘수록 고각·편류·비행시간이 단조 증가', () => {
    const zero = solveZeroAngle(m308, std, 0.045, 100);
    const rows = buildDope({ ...m308, stability: 1.8 }, 0.01134, std, 0.045, zero, [100, 200, 400, 600, 800, 1000]);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].elevationMil).toBeGreaterThan(rows[i - 1].elevationMil);
      expect(rows[i].windPerMpsMil).toBeGreaterThan(rows[i - 1].windPerMpsMil);
      expect(rows[i].time).toBeGreaterThan(rows[i - 1].time);
      expect(rows[i].energy).toBeLessThan(rows[i - 1].energy);
    }
    expect(Math.abs(rows[0].elevationMil)).toBeLessThan(0.05);
    // 스핀 드리프트 1000m ≈ 0.1~0.4mil
    expect(rows[5].spinMil).toBeGreaterThan(0.1);
    expect(rows[5].spinMil).toBeLessThan(0.4);
  });
  it('고지대에서는 같은 거리 고각이 더 작다', () => {
    const zero = solveZeroAngle(m308, std, 0.045, 100);
    const high: BallisticEnv = { ...std, density: airDensity(2200, 4), soundSpeed: speedOfSound(4) };
    const [a] = buildDope(m308, 0.01134, std, 0.045, zero, [1000]);
    const [b] = buildDope(m308, 0.01134, high, 0.045, zero, [1000]);
    expect(b.elevationMil).toBeLessThan(a.elevationMil - 0.5);
  });
});

describe('바람장', () => {
  it('결정론적: 같은 시드 → 같은 값', () => {
    const spec = { zones: [{ from: 0, speed: 3, dir: 90 }], variability: 0.1, gusts: { intervalMin: 5, intervalMax: 8, strength: 3, rise: 2, hold: 2, fall: 2 } };
    const a = new WindField(spec, 42);
    const b = new WindField(spec, 42);
    for (let t = 0; t < 60; t += 1.3) expect(a.sample(300, t)).toEqual(b.sample(300, t));
  });
  it('돌풍은 상승 시간 동안 서서히 강해진다(예고)', () => {
    const spec = { zones: [{ from: 0, speed: 3, dir: 90 }], variability: 0, gusts: { intervalMin: 5, intervalMax: 5, strength: 3, rise: 2, hold: 2, fall: 2 } };
    const w = new WindField(spec, 1);
    const start = w.nextGustIn(0);
    const g0 = w.gustAt(start + 0.2);
    const g1 = w.gustAt(start + 1.0);
    const g2 = w.gustAt(start + 2.5);
    expect(g0).toBeLessThan(g1);
    expect(g1).toBeLessThan(g2);
    expect(start).toBeGreaterThanOrEqual(6);
  });
  it('구간별 바람이 경계에서 부드럽게 바뀐다', () => {
    const spec = { zones: [{ from: 0, speed: 2, dir: 90 }, { from: 400, speed: 6, dir: 90 }], variability: 0 };
    const w = new WindField(spec, 1);
    expect(w.sample(100, 0).speed).toBeCloseTo(2);
    expect(w.sample(500, 0).speed).toBeCloseTo(6);
    const mid = w.sample(380, 0).speed;
    expect(mid).toBeGreaterThan(2);
    expect(mid).toBeLessThan(6);
  });
  it('시계 방향 표기', () => {
    expect(windClock(90)).toBe(9); // 왼쪽→오른쪽 = 9시에서 불어옴
    expect(windClock(270)).toBe(3);
    expect(windClock(180)).toBe(12); // 맞바람
    expect(crossComponent(3, 90)).toBeCloseTo(3);
  });
});
