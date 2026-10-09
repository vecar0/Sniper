import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Target, TargetMaterials } from '../../src/game/targets';
import { Terrain } from '../../src/game/terrain';

const terrain = new Terrain({ theme: 'plains', seed: 1, maxDist: 600 });
const mats = new TargetMaterials();
const person = (yawDeg: number) => {
  const t = new Target({ id: 't', kind: 'person', role: 'guard', outfit: 'guard', x: 0, dist: 300, required: true, facing: yawDeg }, terrain, mats, 1, 1, 0.6);
  return t;
};
/** 사수 쪽에서 표적의 특정 높이를 향해 짧은 선분(시뮬레이션 1스텝 ≈ 0.5m)으로 쏜다 */
const shoot = (t: Target, y: number, x = 0, len = 0.5) => {
  const p = t.position;
  const a = new THREE.Vector3(p.x + x, p.y + y, p.z + 0.45);
  const b = new THREE.Vector3(p.x + x, p.y + y, p.z + 0.45 - len);
  return t.intersect(a, b);
};

describe('사람 판정', () => {
  it('정면: 머리·흉부·복부·다리', () => {
    const t = person(0);
    expect(shoot(t, 1.66, 0, 1)?.zone).toBe('head');
    expect(shoot(t, 1.34, 0, 1)?.zone).toBe('chest');
    expect(shoot(t, 1.0, 0, 1)?.zone).toBe('abdomen');
    expect(shoot(t, 0.4, 0.1, 1)?.zone).toBe('leg');
    expect(shoot(t, 2.2, 0, 1)).toBeNull();
  });
  it('옆모습: 팔을 관통해 몸통 명중으로 본다(스텝이 팔 안에서 끝나도)', () => {
    const t = person(90);
    const h = shoot(t, 1.3, 0, 0.3);
    expect(h).not.toBeNull();
    expect(h!.zone).toBe('chest');
  });
  it('무력화되면 쓰러지고 더 이상 맞지 않으며, 재시작하면 일어선다', () => {
    const t = person(0);
    const h = shoot(t, 1.34, 0, 1)!;
    expect(t.applyHit(h, new THREE.Vector3(0, 0, -5))).toBe(true);
    expect(t.isDown).toBe(true);
    for (let i = 0; i < 120; i++) t.update(1 / 120);
    expect(shoot(t, 1.34, 0, 1)).toBeNull();
    expect(t.group.visible).toBe(true); // 시신은 남는다
    t.reset();
    expect(t.isDown).toBe(false);
    expect(t.tagged).toBe(false);
  });
  it('민간인은 탈출 지점이 없어도 경계하면 달아난다', () => {
    const c = new Target({ id: 'c', kind: 'person', role: 'civilian', outfit: 'civilian', x: 5, dist: 300, required: false }, terrain, mats, 1, 1, 0.5);
    c.alert(0.1);
    const x0 = c.position.x;
    for (let i = 0; i < 240; i++) c.update(1 / 120);
    expect(c.alerted).toBe(true);
    expect(Math.abs(c.position.x - x0)).toBeGreaterThan(3);
  });
});
