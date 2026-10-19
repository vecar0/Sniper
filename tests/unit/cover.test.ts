import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { findPlayerCovers, type Box } from '../../src/arena/map';

const box = (x0: number, z0: number, x1: number, z1: number, h: number): Box => ({ min: new THREE.Vector3(x0, 0, z0), max: new THREE.Vector3(x1, h, z1), kind: h < 1.4 ? 'low' : 'solid' });

describe('플레이어 엄폐 자리', () => {
  it('낮은 엄폐물은 남쪽(플레이어 쪽) 면을 따라, 높은 엄폐물은 양쪽 모서리에', () => {
    const covers = findPlayerCovers([box(-3, -30.5, 3, -29.5, 0.95), box(-23, -21, -17, -19, 2.6)]);
    const low = covers.filter((c) => c.low);
    const high = covers.filter((c) => !c.low);
    expect(low.length).toBeGreaterThanOrEqual(2);
    for (const c of low) expect(c.pos.z).toBeCloseTo(-29.5 + 0.55);
    expect(high.map((c) => c.side).sort()).toEqual([-1, 1]);
    for (const c of high) expect(c.pos.z).toBeCloseTo(-19 + 0.55);
  });

  it('다른 상자와 겹치는 자리 · 너무 작은 물체는 빼고, 같은 물체의 자리는 같은 번호', () => {
    const covers = findPlayerCovers([box(-3, -30.5, 3, -29.5, 0.95), box(-3, -29.4, 3, -28, 0.95), box(10, -30, 10.4, -29.6, 1)]);
    expect(covers.every((c) => c.box !== 0)).toBe(true); // 첫 상자 뒤는 두 번째 상자가 막고 있다
    expect(covers.some((c) => c.box === 2)).toBe(false); // 폭 0.4m는 엄폐물로 치지 않는다
  });
});
