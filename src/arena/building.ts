/**
 * 플레이어 건물(3층 + 옥상)과 "밟을 수 있는 면"(층 바닥 · 계단 경사로).
 *
 * 좌표: 건물 바깥 x -10~10, z -5~5(북쪽 -Z가 적 기지). 층 높이 0 / 3 / 6, 옥상 9.
 * 계단(동쪽): A줄 x 5.6~7.0, B줄 x 7.2~8.6
 *   1층→2층  A줄  z -3.2 → 2.0
 *   2층→3층  B줄  z  2.0 → -3.2
 *   3층→옥상 A줄  z  2.0 → -3.2 (옥상 계단실 북쪽 문으로 나옴)
 * 창문은 실제로 뚫려 있어(창턱 1m) 2·3층 창가에서도 숨었다 일어나 쏠 수 있다.
 */
import * as THREE from 'three';
import type { Box } from './map';

export const FLOOR_Y = [0, 3, 6, 9];
const LANE_A = { x0: 5.6, x1: 7.0 };
const LANE_B = { x0: 7.2, x1: 8.6 };
const HOLE_Z = { z0: -3.2, z1: 2.0 };

export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** 밟을 수 있는 면: 평평하거나(z0→z1로 y0→y1 경사) */
export interface Surface extends Rect {
  y0: number;
  y1: number;
  /** 경사로: z0에서 y0, z1에서 y1 */
  ramp?: boolean;
}

/** 층 사이를 오가는 경로점(계단 아래 → 위) */
export interface StairLink {
  from: THREE.Vector3;
  to: THREE.Vector3;
}

export interface BuildingInfo {
  surfaces: Surface[];
  /** stairs[k] = k층에서 k+1층으로 */
  stairs: StairLink[];
  entranceOutside: THREE.Vector3;
  entranceInside: THREE.Vector3;
  /** 옥상 계단실 문 앞 */
  roofDoor: THREE.Vector3;
}

type BlockFn = (x: number, y: number, z: number, w: number, h: number, d: number, m: THREE.Material, tile: number, opts?: { collide?: Box['kind'] | false; wall?: boolean }) => THREE.Mesh;

/** 옥상 난간 높이: 숙이면 몸이 가려지고, 점프로는 못 넘는다 */
export const PARAPET_H = 1.05;

/** 사각형에서 구멍을 뺀 나머지 사각형들 */
function minusHole(r: Rect, h: Rect): Rect[] {
  return [
    { x0: r.x0, x1: h.x0, z0: r.z0, z1: r.z1 },
    { x0: h.x1, x1: r.x1, z0: r.z0, z1: r.z1 },
    { x0: h.x0, x1: h.x1, z0: r.z0, z1: h.z0 },
    { x0: h.x0, x1: h.x1, z0: h.z1, z1: r.z1 },
  ].filter((q) => q.x1 - q.x0 > 0.01 && q.z1 - q.z0 > 0.01);
}

export function buildBuilding(
  block: BlockFn,
  mats: { wall: THREE.Material; floor: THREE.Material; trim: THREE.Material; glassDark: THREE.Material; wood: THREE.Material; steel: THREE.Material },
  group: THREE.Group,
  boxes: Box[],
  lights: boolean,
): BuildingInfo {
  const surfaces: Surface[] = [];
  const T = 0.3; // 벽 두께
  const W = 10, D = 5;
  const inner: Rect = { x0: -W + T, x1: W - T, z0: -D + T, z1: D - T };

  // ── 바깥벽 ──
  // 북쪽(적 쪽): 층마다 창문, 1층 가운데는 정문
  const winXs = [-7, -3.5, 3.2];
  for (let f = 0; f < 3; f++) {
    const y0 = FLOOR_Y[f];
    const openings: { x0: number; x1: number; b: number; t: number }[] = winXs.map((x) => ({ x0: x - 0.8, x1: x + 0.8, b: 0.95, t: 2.3 }));
    if (f === 0) openings.push({ x0: -1.1, x1: 1.1, b: 0, t: 2.4 });
    else openings.push({ x0: -0.8, x1: 0.8, b: 0.95, t: 2.3 });
    openings.sort((a, b) => a.x0 - b.x0);
    let cx = -W;
    for (const o of openings) {
      if (o.x0 > cx + 0.01) block((cx + o.x0) / 2, y0, -D + T / 2, o.x0 - cx, 3, T, mats.wall, 4);
      if (o.b > 0) block((o.x0 + o.x1) / 2, y0, -D + T / 2, o.x1 - o.x0, o.b, T, mats.wall, 4);
      block((o.x0 + o.x1) / 2, y0 + o.t, -D + T / 2, o.x1 - o.x0, 3 - o.t, T, mats.wall, 4);
      if (o.b > 0) block((o.x0 + o.x1) / 2, y0 + o.b, -D + T / 2 - 0.05, o.x1 - o.x0 + 0.1, 0.06, T + 0.15, mats.trim, 2, { collide: false });
      cx = o.x1;
    }
    if (cx < W) block((cx + W) / 2, y0, -D + T / 2, W - cx, 3, T, mats.wall, 4);
  }
  // 나머지 벽(창문 모양만)
  block(0, 0, D - T / 2, 2 * W, 9, T, mats.wall, 4);
  block(-W + T / 2, 0, 0, T, 9, 2 * D - 2 * T, mats.wall, 4);
  block(W - T / 2, 0, 0, T, 9, 2 * D - 2 * T, mats.wall, 4);
  for (let f = 0; f < 3; f++) for (const x of [-6, -1, 4]) block(x, FLOOR_Y[f] + 1.1, D + 0.01, 1.4, 1.3, 0.04, mats.glassDark, 2, { collide: false });

  // ── 바닥판(2·3층 · 옥상), 계단 구멍 ──
  const holeA: Rect = { x0: LANE_A.x0, x1: LANE_A.x1, z0: HOLE_Z.z0, z1: HOLE_Z.z1 };
  const holeB: Rect = { x0: LANE_B.x0, x1: LANE_B.x1, z0: HOLE_Z.z0, z1: HOLE_Z.z1 };
  const slab = (y: number, rects: Rect[]) => {
    for (const r of rects) {
      block((r.x0 + r.x1) / 2, y - 0.25, (r.z0 + r.z1) / 2, r.x1 - r.x0, 0.25, r.z1 - r.z0, mats.floor, 3);
      surfaces.push({ ...r, y0: y, y1: y });
    }
  };
  slab(3, minusHole(inner, holeA));
  slab(6, minusHole(inner, holeB));
  slab(9, minusHole({ x0: -W, x1: W, z0: -D, z1: D }, holeA));
  // 1층 바닥(밖의 땅과 같은 높이 – 콘크리트로 덮기만)
  block(0, -0.04, 0, 2 * W - 2 * T, 0.05, 2 * D - 2 * T, mats.floor, 3, { collide: false });

  // ── 계단: 경사로(밟는 면) + 계단 모양(보이기만) ──
  const ramp = (lane: { x0: number; x1: number }, zFrom: number, zTo: number, yFrom: number, yTo: number) => {
    surfaces.push({ x0: lane.x0, x1: lane.x1, z0: zFrom, z1: zTo, y0: yFrom, y1: yTo, ramp: true });
    const steps = 12;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps, t1 = (i + 1) / steps;
      const za = zFrom + (zTo - zFrom) * t0, zb = zFrom + (zTo - zFrom) * t1;
      const yTop = yFrom + (yTo - yFrom) * t1;
      block((lane.x0 + lane.x1) / 2, yTop - 0.28, (za + zb) / 2, lane.x1 - lane.x0, 0.28, Math.abs(zb - za) + 0.02, mats.floor, 2, { collide: false });
      // 계단 밑으로 걸어 들어가지 못하게 막는 상자: 윗면을 경사면보다 0.3m 낮춰 계단 위를 걷는 데는 걸리지 않는다
      const base = Math.min(yFrom, yTo);
      const top = yFrom + (yTo - yFrom) * t0 - 0.3;
      if (top - base > 0.05) {
        boxes.push({
          min: new THREE.Vector3(lane.x0, base, Math.min(za, zb)),
          max: new THREE.Vector3(lane.x1, top, Math.max(za, zb)),
          kind: 'solid',
        });
      }
    }
  };
  ramp(LANE_A, HOLE_Z.z0, HOLE_Z.z1, 0, 3);
  ramp(LANE_B, HOLE_Z.z1, HOLE_Z.z0, 3, 6);
  ramp(LANE_A, HOLE_Z.z1, HOLE_Z.z0, 6, 9);
  // 난간: 구멍으로 떨어지지 않게(경사로 끝은 열어 둔다)
  const rail = (x0: number, x1: number, z0: number, z1: number, y: number) => block((x0 + x1) / 2, y, (z0 + z1) / 2, Math.max(0.08, x1 - x0), 1.05, Math.max(0.08, z1 - z0), mats.steel, 1);
  // 2층: A줄 구멍(1층에서 올라오는 경사로) – 서쪽·동쪽·북쪽 끝
  rail(LANE_A.x0 - 0.1, LANE_A.x0, HOLE_Z.z0, HOLE_Z.z1, 3);
  rail(LANE_A.x1, LANE_A.x1 + 0.1, HOLE_Z.z0, HOLE_Z.z1 - 1.2, 3);
  rail(LANE_A.x0, LANE_A.x1, HOLE_Z.z0 - 0.1, HOLE_Z.z0, 3);
  // 3층: B줄 구멍 – 서쪽·남쪽 끝
  rail(LANE_B.x0 - 0.1, LANE_B.x0, HOLE_Z.z0 + 1.2, HOLE_Z.z1, 6);
  rail(LANE_B.x0, LANE_B.x1, HOLE_Z.z1, HOLE_Z.z1 + 0.1, 6);
  // 옥상 계단실(A줄 구멍을 덮고 북쪽에 문)
  const hx0 = LANE_A.x0 - 0.25, hx1 = LANE_A.x1 + 0.25, hz0 = HOLE_Z.z0 - 0.35, hz1 = HOLE_Z.z1 + 0.25;
  block(hx0 + 0.1, 9, (hz0 + hz1) / 2, 0.2, 2.6, hz1 - hz0, mats.wall, 4);
  block(hx1 - 0.1, 9, (hz0 + hz1) / 2, 0.2, 2.6, hz1 - hz0, mats.wall, 4);
  block((hx0 + hx1) / 2, 9, hz1 - 0.1, hx1 - hx0, 2.6, 0.2, mats.wall, 4);
  block((hx0 + hx1) / 2, 9 + 2.6, (hz0 + hz1) / 2, hx1 - hx0 + 0.3, 0.2, hz1 - hz0 + 0.3, mats.trim, 2);
  block((hx0 + hx1) / 2, 9 + 2.2, hz0 + 0.1, hx1 - hx0, 0.4, 0.2, mats.wall, 4);

  // 옥상 난간(북쪽은 엄폐용, 나머지는 떨어지지 않게)
  block(0, 9, -D + 0.15, 2 * W, PARAPET_H, 0.3, mats.trim, 3, { collide: 'low', wall: true });
  block(-W + 0.15, 9, 0, 0.3, PARAPET_H, 2 * D, mats.trim, 3, { collide: 'low', wall: true });
  block(W - 0.15, 9, 0, 0.3, PARAPET_H, 2 * D, mats.trim, 3, { collide: 'low', wall: true });
  block(0, 9, D - 0.15, 2 * W, PARAPET_H, 0.3, mats.trim, 3, { collide: 'low', wall: true });

  // ── 실내 소품(엄폐) ──
  const crate = (x: number, y: number, z: number, s = 1.1) => block(x, y, z, s, s * 0.9, s, mats.wood, 1.2, { collide: 'low' });
  crate(-7.8, 0, 2.6);
  crate(-6.6, 0, 3.4, 0.9);
  crate(-2.5, 0, -2.2);
  crate(2.2, 0, 2.8, 1.3);
  block(-4.5, 3, 1.5, 2.2, 0.8, 1.0, mats.wood, 1.2, { collide: 'low' }); // 2층 탁자
  crate(1.5, 3, -2.0);
  crate(-8, 3, -1.5, 0.9);
  block(-1.5, 6, 2.6, 3.0, 0.9, 0.9, mats.wood, 1.2, { collide: 'low' });
  crate(-6.5, 6, -2.4);
  crate(3.0, 6, 0.5, 1.0);

  // 실내 조명(층마다 따뜻한 등)
  if (lights) {
    for (const y of [2.6, 5.6, 8.6]) {
      const l = new THREE.PointLight(0xffd9a0, 8, 14, 2);
      l.position.set(-2, y, 0);
      group.add(l);
    }
  }

  return {
    surfaces,
    stairs: [
      { from: new THREE.Vector3((LANE_A.x0 + LANE_A.x1) / 2, 0, HOLE_Z.z0 - 0.4), to: new THREE.Vector3((LANE_A.x0 + LANE_A.x1) / 2, 3, HOLE_Z.z1 + 0.5) },
      { from: new THREE.Vector3((LANE_B.x0 + LANE_B.x1) / 2, 3, HOLE_Z.z1 + 0.5), to: new THREE.Vector3((LANE_B.x0 + LANE_B.x1) / 2, 6, HOLE_Z.z0 - 0.4) },
      { from: new THREE.Vector3((LANE_A.x0 + LANE_A.x1) / 2, 6, HOLE_Z.z1 + 0.5), to: new THREE.Vector3((LANE_A.x0 + LANE_A.x1) / 2, 9, HOLE_Z.z0 - 0.45) },
    ],
    entranceOutside: new THREE.Vector3(0, 0, -6.2),
    entranceInside: new THREE.Vector3(0, 0, -3.8),
    roofDoor: new THREE.Vector3((LANE_A.x0 + LANE_A.x1) / 2, 9, -4.2),
  };
}

/** 그 자리(x,z)에서 발 높이 yRef 기준으로 디딜 수 있는 가장 높은 면(계단 한 칸 0.6m까지 올라감) */
export function floorAt(surfaces: Surface[], x: number, z: number, yRef: number): number {
  let best = 0; // 땅
  for (const s of surfaces) {
    if (x < s.x0 || x > s.x1) continue;
    const zl = Math.min(s.z0, s.z1), zh = Math.max(s.z0, s.z1);
    if (z < zl || z > zh) continue;
    const h = s.ramp ? s.y0 + ((z - s.z0) / (s.z1 - s.z0)) * (s.y1 - s.y0) : s.y0;
    if (h <= yRef + 0.6 && h > best) best = h;
  }
  return best;
}

export function floorIndex(y: number): number {
  return y < 1.5 ? 0 : y < 4.5 ? 1 : y < 7.5 ? 2 : 3;
}

/**
 * 원기둥(반지름 r, 발 y ~ 몸통 y+h)을 벽 상자 밖으로 밀어내며 이동한다(축별로 시도해 벽을 따라 미끄러진다).
 * - 발목 높이(0.35m)까지는 걸어서 넘는다(그 위는 groundAt이 올려 준다).
 * - 머리 위 물체(계단 위 천장 끝 등)는 몸통 높이 h까지만 보므로 걸리지 않는다.
 * - 이미 겹쳐 있는 상자는 무시한다: 어쩌다 끼어도 빠져나올 수 있다.
 * - wall 상자(옥상 난간)는 높이와 상관없이 막는다(뛰어넘어 떨어지지 않게).
 */
export function moveWithCollision(boxes: Box[], pos: THREE.Vector3, dx: number, dz: number, r: number, h = 1.2): void {
  const hits = (b: Box, x: number, z: number) => {
    if (!b.wall && b.max.y <= pos.y + 0.35) return false;
    if (b.min.y >= pos.y + h) return false;
    return x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z;
  };
  const blocked = (x: number, z: number) => {
    for (const b of boxes) if (hits(b, x, z) && !hits(b, pos.x, pos.z)) return true;
    return false;
  };
  if (!blocked(pos.x + dx, pos.z)) pos.x += dx;
  if (!blocked(pos.x, pos.z + dz)) pos.z += dz;
}

/** 발밑 높이: 층 바닥 · 계단 + 올라설 수 있는 상자 윗면(상자 · 창턱 · 모래주머니) */
export function groundAt(boxes: Box[], surfaces: Surface[], x: number, z: number, yRef: number, r = 0.22): number {
  let best = floorAt(surfaces, x, z, yRef);
  for (const b of boxes) {
    if (b.wall || b.max.y <= best || b.max.y > yRef + 0.36) continue;
    if (x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z) best = b.max.y;
  }
  return best;
}
