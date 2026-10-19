import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MEDKIT, Medkits } from '../../src/arena/pickups';
import type { NavGrid } from '../../src/arena/map';

const nav = { free: () => true } as unknown as NavGrid;

describe('구급상자', () => {
  it('최대 개수까지만 놓이고, 체력이 모자랄 때 가까이 가면 주워진다', () => {
    const m = new Medkits(nav);
    m.reset(10);
    expect(m.kits.length).toBe(MEDKIT.max);
    const k = m.kits[0];
    // 체력이 가득이면 줍지 않는다
    expect(m.update(0.016, k.pos.clone(), false)).toBe(false);
    // 멀면 줍지 않는다
    expect(m.update(0.016, k.pos.clone().add(new THREE.Vector3(3, 0, 0)), true)).toBe(false);
    expect(m.update(0.016, k.pos.clone().add(new THREE.Vector3(0.5, 0, 0)), true)).toBe(true);
    expect(m.kits.length).toBe(MEDKIT.max - 1);
    // 보충하면 빈 자리에 다시 놓인다(같은 자리에 겹치지 않게)
    m.fill(MEDKIT.max);
    expect(new Set(m.kits.map((x) => x.spot)).size).toBe(MEDKIT.max);
  });

  it('옥상(높이 9m)에서는 땅 위 상자를 주울 수 없다', () => {
    const m = new Medkits(nav);
    m.reset(1);
    const p = m.kits[0].pos.clone().setY(9);
    expect(m.update(0.016, p, true)).toBe(false);
  });
});
