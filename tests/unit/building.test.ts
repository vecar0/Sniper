import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildBuilding, FLOOR_Y, groundAt, moveWithCollision } from '../../src/arena/building';
import { BUILDING, NavGrid, planRoute, type Box } from '../../src/arena/map';

/** 화면 없이 건물의 충돌 상자 · 밟는 면만 만든다 */
function makeBuilding() {
  const boxes: Box[] = [];
  const block = (x: number, y: number, z: number, w: number, h: number, d: number, _m: THREE.Material, _t: number, opts: { collide?: Box['kind'] | false } = {}) => {
    if (opts.collide !== false) boxes.push({ min: new THREE.Vector3(x - w / 2, y, z - d / 2), max: new THREE.Vector3(x + w / 2, y + h, z + d / 2), kind: opts.collide ?? 'solid' });
    return new THREE.Mesh();
  };
  const m = new THREE.MeshBasicMaterial();
  const info = buildBuilding(block, { wall: m, floor: m, trim: m, glassDark: m, wood: m, steel: m }, new THREE.Group(), boxes, false);
  const floors = FLOOR_Y.map((y) => new NavGrid(boxes, { minX: BUILDING.minX, minZ: BUILDING.minZ, cols: 40, rows: 20, cell: 0.5, pad: 0.3, y, surfaces: y > 0 ? info.surfaces : undefined }));
  const nav = new NavGrid(boxes);
  return { boxes, info, floors, nav };
}

/** 경유점을 따라 플레이어처럼 걷는다(벽 충돌 + 발밑 높이 + 낙하) */
function walk(b: ReturnType<typeof makeBuilding>, start: THREE.Vector3, goal: THREE.Vector3) {
  const pos = start.clone();
  const route = planRoute(b.nav, b.floors, b.info.stairs, b.info.entranceOutside, b.info.entranceInside, pos, goal);
  for (const wp of route) {
    for (let i = 0; i < 2000; i++) {
      const dx = wp.x - pos.x, dz = wp.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.06) break;
      const s = Math.min(0.05, d);
      moveWithCollision(b.boxes, pos, (dx / d) * s, (dz / d) * s, 0.3);
      const f = groundAt(b.boxes, b.info.surfaces, pos.x, pos.z, pos.y);
      pos.y = f < pos.y ? Math.max(f, pos.y - 0.1) : f;
    }
  }
  return pos;
}

describe('플레이어 건물', () => {
  it('정문 안에서 계단으로 옥상까지 걸어 올라간다', () => {
    const b = makeBuilding();
    const end = walk(b, b.info.entranceInside, new THREE.Vector3(0, 9, -4));
    expect(end.y).toBeCloseTo(9, 1);
    expect(Math.hypot(end.x - 0, end.z + 4)).toBeLessThan(0.3);
  });

  it('옥상에서 3층 · 2층 · 1층을 거쳐 밖으로 나간다', () => {
    const b = makeBuilding();
    for (const [goal, y] of [[new THREE.Vector3(-6, 6, 0), 6], [new THREE.Vector3(-6, 3, 0), 3], [new THREE.Vector3(-4, 0, 0), 0]] as const) {
      const end = walk(b, new THREE.Vector3(0, 9, -4), goal);
      expect(end.y).toBeCloseTo(y, 1);
      expect(Math.hypot(end.x - goal.x, end.z - goal.z)).toBeLessThan(0.3);
    }
    const out = walk(b, new THREE.Vector3(0, 9, -4), new THREE.Vector3(0, 0, -12));
    expect(out.y).toBe(0);
    expect(Math.hypot(out.x, out.z + 12)).toBeLessThan(0.3);
  });

  it('계단 밑으로는 걸어 들어갈 수 없다', () => {
    const b = makeBuilding();
    // 1층에서 서쪽으로부터 A줄 계단 높은 쪽(z 1) 밑으로 걸어 들어가 본다
    const pos = new THREE.Vector3(4.5, 0, 1);
    for (let i = 0; i < 60; i++) moveWithCollision(b.boxes, pos, 0.05, 0, 0.3);
    expect(pos.x).toBeLessThan(5.6);
  });

  it('옥상 난간 없이도 창턱 · 벽이 바깥으로 못 나가게 막는다(2층 창문)', () => {
    const b = makeBuilding();
    const pos = new THREE.Vector3(-3.5, 3, -3);
    for (let i = 0; i < 80; i++) moveWithCollision(b.boxes, pos, 0, -0.05, 0.3);
    expect(pos.z).toBeGreaterThan(-4.8);
  });

  it('계단 가장자리로 붙어 걸어도 끼지 않는다(머리 위 천장 끝)', () => {
    const b = makeBuilding();
    for (const x of [5.85, 6.75]) {
      const pos = new THREE.Vector3(x, 6, 2.6);
      for (let i = 0; i < 200; i++) {
        moveWithCollision(b.boxes, pos, 0, -0.05, 0.3);
        pos.y = groundAt(b.boxes, b.info.surfaces, pos.x, pos.z, pos.y);
      }
      expect(pos.y).toBeCloseTo(9, 1);
    }
  });

  it('건물 어디서 아무렇게나 걸어도 갇히는 곳이 없다', () => {
    const b = makeBuilding();
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let run = 0; run < 40; run++) {
      const f = run % 4;
      const pos = new THREE.Vector3(-8 + rnd() * 6, FLOOR_Y[f], -3 + rnd() * 6);
      let vy = 0;
      for (let step = 0; step < 1500; step++) {
        if (step % 60 === 0) seed += 1;
        const a = rnd() < 0.05 ? rnd() * Math.PI * 2 : Math.floor(step / 60) * 2.1 + run;
        moveWithCollision(b.boxes, pos, Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0.3);
        const g = groundAt(b.boxes, b.info.surfaces, pos.x, pos.z, pos.y);
        if (g >= pos.y - 0.02) { pos.y = g; vy = 0; } else { vy -= 22 / 120; pos.y = Math.max(g, pos.y + vy / 120); }
      }
      // 끝난 자리에서 8방향 중 어디로든 움직일 수 있어야 한다
      let free = 0;
      for (let k = 0; k < 8; k++) {
        const p = pos.clone();
        moveWithCollision(b.boxes, p, Math.cos((k * Math.PI) / 4) * 0.05, Math.sin((k * Math.PI) / 4) * 0.05, 0.3);
        if (p.distanceTo(pos) > 0.01) free++;
      }
      expect(free, `갇힘: ${pos.toArray().map((v) => v.toFixed(2))}`).toBeGreaterThan(0);
    }
  });

  it('옥상 난간은 점프해도 넘을 수 없다', () => {
    const b = makeBuilding();
    const pos = new THREE.Vector3(0, 9.7, -4.2); // 점프 꼭대기
    for (let i = 0; i < 30; i++) moveWithCollision(b.boxes, pos, 0, -0.05, 0.3);
    expect(pos.z).toBeGreaterThan(-4.41);
  });
});
