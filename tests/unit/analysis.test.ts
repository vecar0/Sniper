import { describe, expect, it } from 'vitest';
import { airDensity, speedOfSound } from '../../src/ballistics/atmosphere';
import { NO_WIND, solveZeroAngle, type BallisticEnv } from '../../src/ballistics/solver';
import { analyzeShot, solveFiringSolution, type ShotRecord } from '../../src/game/analysis';

const env: BallisticEnv = { density: airDensity(100, 15), soundSpeed: speedOfSound(15), gravity: 9.80665, windAt: NO_WIND };
const params = { muzzleVelocity: 792, bcG7: 0.243, stability: 1.8 };
const zero = solveZeroAngle(params, env, 0.045, 100);
const eye = { x: 0, y: 6.45, z: 0 };

describe('사격 해 계산', () => {
  it('정지 표적: 거리가 멀수록 고각 증가, 무풍이면 좌우 ≈ 스핀 드리프트만', () => {
    const a = solveFiringSolution({ params, env, sightHeight: 0.045, zeroAngle: zero, eye, target: { x: 0, y: 1, z: -300 }, targetVel: { x: 0, y: 0, z: 0 } });
    const b = solveFiringSolution({ params, env, sightHeight: 0.045, zeroAngle: zero, eye, target: { x: 0, y: 1, z: -800 }, targetVel: { x: 0, y: 0, z: 0 } });
    expect(b.elevMil).toBeGreaterThan(a.elevMil + 3);
    expect(Math.abs(a.windMil)).toBeLessThan(0.1);
    expect(b.windMil).toBeLessThan(0); // 오른쪽 스핀 드리프트 → 왼쪽 보정
  });
  it('오른쪽으로 걷는 표적은 오른쪽 리드가 필요', () => {
    const s = solveFiringSolution({ params, env, sightHeight: 0.045, zeroAngle: zero, eye, target: { x: 0, y: 1, z: -600 }, targetVel: { x: 1.4, y: 0, z: 0 } });
    // 리드 ≈ 속도 × 비행시간 / 거리 × 1000
    const expected = (1.4 * s.tof * 1000) / 600;
    expect(s.windMil).toBeGreaterThan(expected * 0.8);
    expect(s.windMil).toBeLessThan(expected * 1.3);
  });
  it('왼쪽에서 부는 바람은 왼쪽(음수) 보정', () => {
    const windy: BallisticEnv = { ...env, windAt: (_x, _y, _z, _t, o) => ((o.x = 3), (o.y = 0), (o.z = 0), o) };
    const s = solveFiringSolution({ params, env: windy, sightHeight: 0.045, zeroAngle: zero, eye, target: { x: 0, y: 1, z: -500 }, targetVel: { x: 0, y: 0, z: 0 } });
    expect(s.windMil).toBeLessThan(-0.5);
  });
});

describe('탄착 분석', () => {
  const needed = { elevMil: 6, windMil: -1, tof: 0.9, range: 600 };
  const base: ShotRecord = { losOffsetV: 0, losOffsetH: 0, swayV: 0, swayH: 0, elevDial: 6, windDial: -1, needed, neededStatic: needed, targetLabel: 'A', moving: false };
  it('정확하면 오차 0', () => {
    const a = analyzeShot(base);
    expect(Math.abs(a.errV)).toBeLessThan(1e-9);
    expect(Math.abs(a.errH)).toBeLessThan(1e-9);
  });
  it('고각 부족 → 낮음 + 올리라는 팁', () => {
    const a = analyzeShot({ ...base, elevDial: 5.2 });
    expect(a.errV).toBeCloseTo(-0.8);
    expect(a.lines[0]).toContain('낮음');
    expect(a.tip).toContain('올리세요');
    expect(a.tip).toContain('8클릭');
  });
  it('흔들림이 원인이면 숨 참기 팁', () => {
    const a = analyzeShot({ ...base, losOffsetV: 0.6, swayV: 0.6 });
    expect(a.tip).toContain('숨');
  });
  it('이동 표적 리드 부족 → 리드 팁', () => {
    const moving = { ...needed, windMil: 1.2 };
    const st = { ...needed, windMil: -0.6 };
    const a = analyzeShot({ ...base, needed: moving, neededStatic: st, windDial: -0.6, moving: true });
    expect(a.tip).toContain('리드');
  });
});
