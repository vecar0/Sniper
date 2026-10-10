import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../../src/config/missions';
import { validateLayout } from '../../src/game/interior';

describe('잠입 건물 배치도', () => {
  const withInterior = MISSIONS.filter((m) => m.interior);
  it('작전 미션 4개 이상이 잠입 구간을 가진다', () => {
    expect(withInterior.length).toBeGreaterThanOrEqual(4);
  });
  for (const m of withInterior) {
    it(`${m.id} ${m.interior!.name}: 길이 이어지고 경비 경로가 벽을 지나지 않는다`, () => {
      expect(validateLayout(m.interior!)).toEqual([]);
    });
    it(`${m.id}: 모든 행의 길이가 같다`, () => {
      const lens = new Set(m.interior!.layout.map((l) => l.length));
      expect(lens.size).toBe(1);
    });
  }
});

import * as THREE from 'three';
import { HumanMaterials } from '../../src/game/models/human';
import { INTERIOR, Interior } from '../../src/game/interior';

const TUNE = { reaction: 0.5, interval: 0.5, hitBase: 0.4, damage: 10 };

describe('실내 규칙', () => {
  // 작은 시험용 건물: N(저격 위치) 아래로 복도, 오른쪽 방에 경비
  const spec = {
    name: '시험',
    layout: [
      '###w#####',
      '#..N....#',
      '#.c.#...#',
      '#...#...#',
      '#S#####E#',
    ],
    guards: [{ path: [[6, 2]] as [number, number][], yaw: 180 }],
  };
  const make = () => {
    const it = new Interior(spec, 0, { wall: 0x888888, floor: 0x555555, trim: 0x333333 }, false);
    it.spawnGuards(new HumanMaterials(), 'guard');
    return it;
  };
  const w = (it: Interior, c: number, r: number) => it.toWorld({ c, r });

  it('벽은 시야를 막고, 낮은 상자는 숙인 사람만 가린다', () => {
    const it = make();
    const a = w(it, 1, 3), b = w(it, 3, 1);
    expect(it.los(a.x, a.y, b.x, b.y, false)).toBe(true); // (2,2) 상자 너머 서 있는 사람은 보임
    expect(it.los(a.x, a.y, b.x, b.y, true)).toBe(false); // 숙이면 가려짐
    const c = w(it, 6, 2);
    expect(it.los(a.x, a.y, c.x, c.y, false)).toBe(false); // (4,2)(4,3) 벽
  });

  it('벽 모서리 대각선 틈으로는 보이지 않는다', () => {
    const it = make();
    // (3,3)→(5,1): (4,2) 벽과 (4,1)/(3,2) 사이 모서리를 스치는 선
    const a = w(it, 3, 3), b = w(it, 5, 1);
    expect(it.los(a.x + 0.3, a.y + 0.3, b.x - 0.3, b.y - 0.3, false)).toBe(false);
  });

  it('플레이어는 벽을 통과하지 못한다', () => {
    const it = make();
    const n = w(it, 3, 1);
    const p = new THREE.Vector3(n.x, 0, n.y - 0.9); // 창문 벽 안쪽으로 밀어 넣음
    it.collide(p, INTERIOR.playerRadius);
    expect(p.z).toBeGreaterThanOrEqual(n.y - 0.5 + INTERIOR.playerRadius - 1e-6);
  });

  it('제압은 경비 뒤에서만 된다(눈치챈 경비는 불가)', () => {
    const it = make();
    const g = it.guards[0]; // 위(창문 쪽)를 보고 있음
    const behind = { x: g.pos.x, z: g.pos.z + 1.0 }; // 뒤(아래쪽)
    expect(it.takedownCandidate(behind.x, behind.z, 0)).toBe(g); // yaw 0 = 위를 봄 → 경비를 바라봄
    g.meter = 0.6;
    const front = { x: g.pos.x, z: g.pos.z - 1.0 };
    expect(it.takedownCandidate(front.x, front.z, Math.PI)).toBeNull();
  });

  it('경비 정면 시야 안에 서 있으면 게이지가 차서 발각된다', () => {
    const it = make();
    const g = it.guards[0];
    let detected = false;
    for (let i = 0; i < 600 && !detected; i++) {
      const r = it.update(1 / 60, { x: g.pos.x, z: g.pos.z - 2.5, hx: g.pos.x, hz: g.pos.z - 2.5, crouched: false, moving: false, hidden: false, detectMul: 1 }, 1, TUNE);
      detected = !!r.detectedBy || r.combat;
    }
    expect(detected).toBe(true);
  });

  it('뒤에 숙여 있으면 들키지 않는다', () => {
    const it = make();
    const g = it.guards[0];
    let max = 0;
    for (let i = 0; i < 300; i++) max = Math.max(max, it.update(1 / 60, { x: g.pos.x, z: g.pos.z + 1.6, hx: g.pos.x, hz: g.pos.z + 1.6, crouched: true, moving: true, hidden: false, detectMul: 1 }, 1, TUNE).maxMeter);
    expect(max).toBe(0);
  });

  it('길찾기는 벽을 돌아간다', () => {
    const it = make();
    const from = w(it, 1, 3), to = w(it, 6, 3);
    const path = it.path(from, to);
    expect(path.length).toBeGreaterThan(1);
    let prev = from;
    for (const p of path) {
      expect(it.clearLine(prev, p)).toBe(true);
      prev = p;
    }
  });
});
