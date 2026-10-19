/**
 * 옥상 저격전 맵: 남쪽 3층 건물 옥상(플레이어) → 북쪽으로 펼쳐진 적 기지.
 * 좌표: 옥상 중앙 = (0, ROOF_Y, 0), 적은 -Z(북쪽)에서 온다. 1단위 = 1m.
 * 맵이 돌려주는 것: 충돌 상자(탄·시야 판정), 엄폐 지점, 적 등장 지점, 적 저격수 자리, 옥상 출입구.
 */
import * as THREE from 'three';
import { buildBuilding, floorAt, floorIndex, FLOOR_Y, type StairLink, type Surface } from './building';
import { fitTransform, getModel, instancedModel } from './models';
import { addCity, addMountains, addPalms, gableEndGeometry, gableRoofGeometry, SandbagStacks, type SceneryCtx } from './scenery';
import { surfaceMaterial, worldUvBox, worldUvPlane, type SurfaceId } from './textures';

export const ROOF_Y = 9;
/**
 * 하늘: Poly Haven의 실사 노을 하늘 사진(kloppenheim_06_puresky, CC0)을 배경 · 주변광으로 쓴다.
 * 사진 속 해의 위치(u, v)를 재 두었고, 하늘을 yaw만큼 돌려 해가 플레이어 앞쪽 왼편에 오게 한다.
 */
export const SKY = { url: './textures/sky.jpg', sunU: 0.585, sunV: 0.432, yaw: 2.89 };
/** 해 방향 – 하늘 사진의 해와 같은 쪽(그림자 방향이 사진과 맞는다) */
export const SUN_DIR = (() => {
  const phi = (SKY.sunU - 0.5) * Math.PI * 2; // three.js 등장방형 지도: u = atan2(z, x) / 2π + 0.5
  const el = (0.5 - SKY.sunV) * Math.PI;
  const d = new THREE.Vector3(Math.cos(phi) * Math.cos(el), Math.sin(el), Math.sin(phi) * Math.cos(el));
  return d.applyAxisAngle(new THREE.Vector3(0, 1, 0), SKY.yaw).normalize();
})();
/** 플레이어 건물 바닥 넓이(바깥벽 기준) */
export const BUILDING = { minX: -10, maxX: 10, minZ: -5, maxZ: 5 };
/** 플레이어가 돌아다닐 수 있는 범위 */
export const WORLD = { minX: -70, maxX: 70, minZ: -124, maxZ: 9 };
export { PARAPET_H } from './building';

export interface Box {
  min: THREE.Vector3;
  max: THREE.Vector3;
  /** 엄폐물 높이 분류: low = 숙이면 숨는 높이 */
  kind: 'solid' | 'low';
  /** 플레이어가 뛰어넘거나 올라설 수 없는 벽(옥상 난간) */
  wall?: boolean;
}

export interface CoverPoint {
  pos: THREE.Vector3;
  /** 낮은 엄폐물(앉았다 일어나며 쏨) / 높은 엄폐물(옆으로 나와서 쏨) */
  low: boolean;
  /** 높은 엄폐물에서 몸을 내밀 방향(x축 ±1) */
  side: number;
  taken: boolean;
}

export interface ArenaMap {
  group: THREE.Group;
  boxes: Box[];
  covers: CoverPoint[];
  spawns: THREE.Vector3[];
  perches: THREE.Vector3[];
  /** 건물 1층 정문 바깥 · 안쪽, 옥상 계단실 문 앞 */
  entrance: THREE.Vector3;
  entranceInside: THREE.Vector3;
  roofDoor: THREE.Vector3;
  sun: THREE.DirectionalLight;
  /** 지상 길찾기 격자 */
  nav: NavGrid;
  /** 건물 층별(0~3 = 1층~옥상) 길찾기 격자 */
  floorNav: NavGrid[];
  /** 밟을 수 있는 면(층 바닥 · 계단) */
  surfaces: Surface[];
  stairs: StairLink[];
  /** (x,z)에서 발 높이 yRef 기준으로 디딜 높이 */
  floorAt(x: number, z: number, yRef: number): number;
  /** 어디서든(밖 · 건물 몇 층) 어디로든 가는 경유점 – 계단을 거친다 */
  plan(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[];
  dispose(): void;
}

/**
 * 지상 길찾기: 1m 격자, 장애물(높이 1.5m 아래까지 닿는 상자)을 0.5m 부풀려 막는다.
 * 경로는 8방향 BFS 후 곧게 갈 수 있는 경유점은 건너뛴다.
 */
export interface NavOpts {
  minX: number;
  minZ: number;
  cols: number;
  rows: number;
  /** 칸 크기(m) */
  cell: number;
  /** 장애물 부풀림(m) */
  pad: number;
  /** 이 격자가 덮는 바닥 높이 */
  y: number;
  /** 있으면: 그 칸의 디딜 면이 y가 아니면(계단 구멍 등) 막힌 칸 */
  surfaces?: Surface[];
}

const GROUND_NAV: NavOpts = { minX: -90, minZ: -140, cols: 180, rows: 136, cell: 1, pad: 0.5, y: 0 };

export class NavGrid {
  readonly minX: number;
  readonly minZ: number;
  readonly cols: number;
  readonly rows: number;
  readonly cell: number;
  readonly y: number;
  private readonly blocked: Uint8Array;

  constructor(boxes: Box[], o: NavOpts = GROUND_NAV) {
    this.minX = o.minX;
    this.minZ = o.minZ;
    this.cols = o.cols;
    this.rows = o.rows;
    this.cell = o.cell;
    this.y = o.y;
    this.blocked = new Uint8Array(this.cols * this.rows);
    const pad = o.pad, cs = o.cell;
    for (const b of boxes) {
      if (b.min.y > o.y + 1.5 || b.max.y < o.y + 0.2) continue;
      const c0 = Math.floor((b.min.x - pad - this.minX) / cs), c1 = Math.ceil((b.max.x + pad - this.minX) / cs);
      const r0 = Math.floor((b.min.z - pad - this.minZ) / cs), r1 = Math.ceil((b.max.z + pad - this.minZ) / cs);
      for (let r = Math.max(0, r0); r < Math.min(this.rows, r1); r++) {
        for (let c = Math.max(0, c0); c < Math.min(this.cols, c1); c++) {
          const x = (c + 0.5) * cs + this.minX, z = (r + 0.5) * cs + this.minZ;
          if (x > b.min.x - pad && x < b.max.x + pad && z > b.min.z - pad && z < b.max.z + pad) this.blocked[r * this.cols + c] = 1;
        }
      }
    }
    if (o.surfaces) {
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
        const x = (c + 0.5) * cs + this.minX, z = (r + 0.5) * cs + this.minZ;
        if (Math.abs(floorAt(o.surfaces, x, z, o.y) - o.y) > 0.1) this.blocked[r * this.cols + c] = 1;
      }
    }
  }

  private cellOf(x: number, z: number): [number, number] {
    return [Math.max(0, Math.min(this.cols - 1, Math.floor((x - this.minX) / this.cell))), Math.max(0, Math.min(this.rows - 1, Math.floor((z - this.minZ) / this.cell)))];
  }

  free(x: number, z: number): boolean {
    const [c, r] = this.cellOf(x, z);
    return !this.blocked[r * this.cols + c];
  }

  private walkable(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(d / (this.cell * 0.5)));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (!this.free(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }

  path(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
    if (this.walkable(from, to)) return [to.clone()];
    const [sc, sr] = this.cellOf(from.x, from.z);
    let [gc, gr] = this.cellOf(to.x, to.z);
    if (this.blocked[gr * this.cols + gc]) {
      // 목적지가 막혀 있으면 가장 가까운 빈 칸
      let best = Infinity;
      for (let r = gr - 3; r <= gr + 3; r++) for (let c = gc - 3; c <= gc + 3; c++) {
        if (r < 0 || c < 0 || r >= this.rows || c >= this.cols || this.blocked[r * this.cols + c]) continue;
        const d = (r - gr) ** 2 + (c - gc) ** 2;
        if (d < best) {
          best = d;
          [gc, gr] = [c, r];
        }
      }
    }
    const prev = new Int32Array(this.cols * this.rows).fill(-1);
    const start = sr * this.cols + sc, goal = gr * this.cols + gc;
    prev[start] = start;
    const q = new Int32Array(this.cols * this.rows);
    let qh = 0, qt = 0;
    q[qt++] = start;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (qh < qt) {
      const cur = q[qh++];
      if (cur === goal) break;
      const cr = Math.floor(cur / this.cols), cc = cur % this.cols;
      for (const [dc, dr] of dirs) {
        const nc = cc + dc, nr = cr + dr;
        if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
        const ni = nr * this.cols + nc;
        if (prev[ni] !== -1 || this.blocked[ni]) continue;
        // 대각선은 모서리를 깎지 않게
        if (dc && dr && (this.blocked[cr * this.cols + nc] || this.blocked[nr * this.cols + cc])) continue;
        prev[ni] = cur;
        q[qt++] = ni;
      }
    }
    if (prev[goal] === -1) return [to.clone()];
    const cells: THREE.Vector3[] = [];
    for (let i = goal; i !== start; i = prev[i]) cells.push(new THREE.Vector3(((i % this.cols) + 0.5) * this.cell + this.minX, this.y, (Math.floor(i / this.cols) + 0.5) * this.cell + this.minZ));
    cells.reverse();
    cells[cells.length - 1] = to.clone();
    const out: THREE.Vector3[] = [];
    let anchor = from;
    let i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.walkable(anchor, cells[j])) j--;
      out.push(cells[j]);
      anchor = cells[j];
      i = j + 1;
    }
    return out;
  }
}

export function buildMap(quality: 'high' | 'medium' | 'low'): ArenaMap {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const boxes: Box[] = [];
  const covers: CoverPoint[] = [];
  const mats = new Map<string, THREE.Material>();
  const mat = (id: SurfaceId, tint = 0xffffff) => {
    const key = `${id}:${tint}`;
    let m = mats.get(key);
    if (!m) {
      m = surfaceMaterial(id, { tint });
      mats.set(key, m);
      disposables.push(m);
    }
    return m;
  };
  const plain = (color: number, rough = 0.85, metal = 0.05) => {
    const key = `p:${color}:${rough}:${metal}`;
    let m = mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
      mats.set(key, m);
      disposables.push(m);
    }
    return m;
  };
  const shadows = quality !== 'low';

  /** 텍스처 상자 + 충돌 상자 */
  const block = (x: number, y: number, z: number, w: number, h: number, d: number, m: THREE.Material, tile: number, opts: { collide?: Box['kind'] | false; rotY?: number; wall?: boolean } = {}) => {
    const g = worldUvBox(w, h, d, tile);
    disposables.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y + h / 2, z);
    mesh.rotation.y = opts.rotY ?? 0;
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    group.add(mesh);
    if (opts.collide !== false) {
      // 회전한 상자는 90° 단위만 쓰므로 축을 바꿔 AABB로
      const swap = Math.abs(Math.sin(opts.rotY ?? 0)) > 0.5;
      const hw = (swap ? d : w) / 2, hd = (swap ? w : d) / 2;
      boxes.push({ min: new THREE.Vector3(x - hw, y, z - hd), max: new THREE.Vector3(x + hw, y + h, z + hd), kind: opts.collide ?? 'solid', wall: opts.wall });
    }
    return mesh;
  };
  /** 엄폐물 북쪽(적 쪽) 면을 따라 엄폐 지점 생성 */
  const coverBehind = (x: number, z: number, w: number, d: number, h: number) => {
    const low = h < 1.4;
    const n = Math.max(1, Math.floor(w / 2.2));
    for (let i = 0; i < n; i++) {
      const px = x - w / 2 + (w / n) * (i + 0.5);
      // 높은 엄폐물은 플레이어(x≈0) 쪽 모서리에서 몸을 내민다 – 반대쪽이면 서로 안 보여 교착된다
      const side = low ? 0 : x > 0 ? -1 : 1;
      covers.push({ pos: new THREE.Vector3(low ? px : side < 0 ? x - w / 2 + 0.5 : x + w / 2 - 0.5, 0, z - d / 2 - 0.7), low, side, taken: false });
      if (!low) break;
    }
  };

  // ── 바닥 · 도로 ──
  const ground = new THREE.Mesh(worldUvPlane(2400, 2400, 5), mat('ground')); // 지평선 끝까지(하늘 사진의 아래쪽이 보이지 않게)
  disposables.push(ground.geometry);
  ground.position.z = -100;
  ground.receiveShadow = shadows;
  group.add(ground);
  const road = new THREE.Mesh(worldUvPlane(260, 7, 7), mat('asphalt'));
  disposables.push(road.geometry);
  road.position.set(0, 0.05, -17);
  layerOnTop(road.material as THREE.Material, 2);
  road.receiveShadow = shadows;
  group.add(road);

  // ── 플레이어 건물(1~3층 + 옥상, 안으로 들어가 계단으로 오르내린다) ──
  const concrete = mat('concrete');
  const plaster = mat('plaster');
  const info = buildBuilding(
    block,
    { wall: plaster, floor: concrete, trim: mat('concrete', 0xcfc8bc), glassDark: plain(0x1e262c, 0.25, 0.4), wood: plain(0x8a6a44, 0.9), steel: plain(0x5b5f63, 0.6, 0.5) },
    group,
    boxes,
    quality !== 'low',
  );
  // 옥상 소품: 에어컨 실외기 · 물탱크(낮은 엄폐)
  if (getModel('aircon')) {
    // 실외기 두 대(Poly Haven) – 남쪽 난간 앞
    boxes.push({ min: new THREE.Vector3(-5.7, ROOF_Y, 4.05), max: new THREE.Vector3(-3.5, ROOF_Y + 1.0, 4.55), kind: 'low' });
    group.add(instancedModel('aircon', [new THREE.Matrix4().makeTranslation(-4.6, ROOF_Y, 4.3).multiply(new THREE.Matrix4().makeRotationY(Math.PI)).multiply(fitTransform('aircon', 2.2, 1.05, 0.45))], undefined, shadows));
  } else {
    block(-6.5, ROOF_Y, 2.4, 1.6, 1.0, 1.0, plain(0xb9bcbd, 0.5, 0.4), 2);
    block(-3.4, ROOF_Y, 3.1, 1.2, 0.9, 0.9, plain(0xb9bcbd, 0.5, 0.4), 2);
  }

  // ── 적 기지 ──
  // 컨테이너 색(빨강 · 파랑 · 청록 · 녹슨 주황) – 회색 골함석 텍스처에 색을 입힌다
  const metalTints = [0xf08a72, 0x8cb0e6, 0x86cbb8, 0xeab07a];
  const sctx: SceneryCtx = { group, disposables, shadows, quality };
  /** 보이지 않는 충돌 상자(모양은 따로 그린 것) */
  const collider = (x: number, y: number, z: number, w: number, h: number, d: number, kind: Box['kind']) =>
    boxes.push({ min: new THREE.Vector3(x - w / 2, y, z - d / 2), max: new THREE.Vector3(x + w / 2, y + h, z + d / 2), kind });
  // 기지 마당: 콘크리트 바닥
  const yard = new THREE.Mesh(worldUvPlane(124, 104, 5), mat('concrete', 0xf0ebe2));
  disposables.push(yard.geometry);
  yard.position.set(0, 0.03, -74);
  layerOnTop(yard.material as THREE.Material, 1);
  yard.receiveShadow = shadows;
  group.add(yard);
  // 모래주머니 줄(낮은 엄폐) – 둥근 자루를 벽돌처럼 쌓은 모양
  const bags = new SandbagStacks();
  const bagFit = getModel('sandbags') ? fitTransform('sandbags', 2.3, 0.95, 1.0) : null;
  const bagSpots: THREE.Matrix4[] = [];
  for (const [x, z, w] of [[-12, -28, 9], [11, -30, 10], [-30, -46, 7], [2, -50, 8], [34, -62, 7], [-14, -78, 8], [12, -92, 8], [-46, -32, 6], [44, -36, 6], [-2, -100, 8], [-24, -60, 5]] as const) {
    collider(x, 0, z, w, 0.95, 1.1, 'low');
    if (bagFit) {
      // 3D 모래주머니 벽 조각(약 2.3m)을 이어 붙인다
      const n = Math.max(1, Math.round(w / 2.3));
      for (let i = 0; i < n; i++) {
        bagSpots.push(new THREE.Matrix4().makeTranslation(x - w / 2 + ((i + 0.5) * w) / n, 0, z).multiply(new THREE.Matrix4().makeScale(w / n / 2.3, 1, 1)).multiply(bagFit));
      }
    } else bags.row(x, z, w, 0.95, 1.1);
    coverBehind(x, z, w, 1.1, 0.95);
  }
  if (bagFit) group.add(instancedModel('sandbags', bagSpots, undefined, shadows));
  // 콘크리트 방호벽(낮은 엄폐)
  const barrier = mat('concrete', 0xd9d3c8);
  const barrierSpots: THREE.Matrix4[] = [];
  for (const [x, z, w] of [[-34, -24, 6], [36, -24, 6], [-52, -50, 4], [20, -112, 5]] as const) {
    if (getModel('barrier')) {
      // 실사 콘크리트 방호벽(Poly Haven)을 약 1.6m씩 이어 놓는다
      collider(x, 0, z, w, 0.9, 0.7, 'low');
      const n = Math.max(1, Math.round(w / 1.6));
      for (let i = 0; i < n; i++) barrierSpots.push(new THREE.Matrix4().makeTranslation(x - w / 2 + ((i + 0.5) * w) / n, 0, z).multiply(fitTransform('barrier', w / n - 0.04, 0.9, 0.7)));
    } else {
      block(x, 0, z, w, 0.85, 0.7, barrier, 2, { collide: 'low' });
      block(x, 0.85, z, w, 0.15, 0.35, barrier, 2, { collide: false });
    }
    coverBehind(x, z, w, 0.7, 1.0);
  }
  if (barrierSpots.length) group.add(instancedModel('barrier', barrierSpots, undefined, shadows));
  // 컨테이너(높은 엄폐) + 문짝 쪽 테두리
  const frame = plain(0x2b2a28, 0.7, 0.4);
  // 3D 모델이 있으면 사실적인 컨테이너(색만 입힘)를 한 번에 그리고, 없으면 상자 + 철골 모서리
  const containerFit = getModel('container') ? fitTransform('container', 6, 2.6, 2.4) : null;
  const containerSpots: THREE.Matrix4[] = [];
  const containerColors: THREE.Color[] = [];
  const container = (x: number, y: number, z: number, rot: number, t: number, collide = true) => {
    const rotated = Math.abs(Math.sin(rot)) > 0.5;
    if (containerFit) {
      const [w, d] = rotated ? [2.4, 6] : [6, 2.4];
      if (collide) collider(x, y, z, w, 2.6, d, 'solid');
      containerSpots.push(new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(rot)).multiply(containerFit));
      containerColors.push(new THREE.Color(metalTints[t]).lerp(new THREE.Color(0xffffff), 0.15));
      return rotated;
    }
    block(x, y, z, 6, 2.6, 2.4, mat('metalg', metalTints[t]), 2.6, { rotY: rot, collide: collide ? 'solid' : false });
    // 네 모서리 기둥(어두운 철골)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const lx = sx * 2.95, lz = sz * 1.15;
      const [wx, wz] = rotated ? [lz, lx] : [lx, lz];
      block(x + wx, y, z + wz, 0.14, 2.6, 0.14, frame, 1, { collide: false });
    }
    return rotated;
  };
  const containers: [number, number, number, number][] = [
    [-24, -38, 0, 0], [24, -40, Math.PI / 2, 1], [-6, -62, 0, 2], [30, -48, 0, 3], [-40, -66, Math.PI / 2, 0], [10, -74, 0, 1],
  ];
  for (const [x, z, rot, t] of containers) {
    const rotated = container(x, 0, z, rot, t);
    coverBehind(x, z, rotated ? 2.4 : 6, rotated ? 6 : 2.4, 2.6);
  }
  container(10, 2.6, -74, 0, 2); // 2단 적재
  // 가장자리 컨테이너 더미(배경 – 컨셉 아트처럼 알록달록 쌓기)
  for (const [x, z, rot, t, n] of [[-58, -30, Math.PI / 2, 2, 2], [-58, -38, Math.PI / 2, 0, 1], [58, -76, Math.PI / 2, 1, 2], [58, -84, Math.PI / 2, 3, 1], [-58, -96, Math.PI / 2, 1, 3]] as const) {
    for (let k = 0; k < n; k++) container(x, k * 2.6, z, rot, (t + k) % 4);
  }
  if (containerFit) group.add(instancedModel('container', containerSpots, containerColors, shadows));
  // 나무 상자 · 드럼통 무더기
  const crate = mat('plaster', 0x9a7550);
  // 나무 상자: 3D 모델이 있으면 인스턴싱, 없으면 상자
  const crateSpots: THREE.Matrix4[] = [];
  const crateBox = (x: number, y: number, z: number, sz: number, h: number, kind: Box['kind'], yaw = 0) => {
    if (getModel('crate')) {
      collider(x, y, z, sz, h, sz, kind);
      crateSpots.push(new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(yaw)).multiply(fitTransform('crate', sz, h, sz)));
    } else block(x, y, z, sz, h, sz, crate, 1.3, { collide: kind });
  };
  for (const [x, z, stack] of [[-18, -55, 1], [20, -58, 0], [-2, -36, 1], [40, -80, 1], [-50, -78, 0], [8, -40, 0], [-36, -56, 1]] as const) {
    crateBox(x, 0, z, 1.3, 1.2, 'low');
    crateBox(x + 1.35, 0, z + 0.1, 1.1, 1.0, 'low', Math.PI / 2);
    if (stack) crateBox(x + 0.1, 1.2, z, 1.1, 1.0, 'solid', 0.2);
    coverBehind(x + 0.6, z, 2.6, 1.3, 1.2);
  }
  const barrelColors = [0xa8402e, 0x3d6b8c, 0x5d6b3a, 0x8c8478];
  const barrelSpots: THREE.Matrix4[] = [];
  const barrelTints: THREE.Color[] = [];
  const barrelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.95, 12);
  disposables.push(barrelGeo);
  for (const [cx, cz] of [[-20, -34], [26, -66], [-8, -88], [16, -44], [-44, -58], [46, -86], [-28, -100]] as const) {
    for (let k = 0; k < 4; k++) {
      const x = cx + (k % 2) * 0.7 - 0.35, z = cz + Math.floor(k / 2) * 0.7 - 0.35;
      if (getModel('barrel')) {
        barrelSpots.push(new THREE.Matrix4().makeTranslation(x, 0, z).multiply(new THREE.Matrix4().makeRotationY(k * 1.7 + cx)).multiply(fitTransform('barrel', 0.64, 0.95, 0.64)));
        barrelTints.push(new THREE.Color(k === 1 ? 0xd8e0e8 : 0xffffff));
        continue;
      }
      const b = new THREE.Mesh(barrelGeo, plain(barrelColors[(k + Math.round(cx)) & 3], 0.6, 0.3));
      b.position.set(x, 0.475, z);
      b.castShadow = b.receiveShadow = shadows;
      group.add(b);
    }
    collider(cx, 0, cz, 1.4, 0.95, 1.4, 'low');
  }
  // 창고 2동: 골함석 벽 · 박공지붕 · 빨간 셔터 · 높은 창
  const roofMetal = mat('roofmetal');
  const shed = mat('metalg', 0xf4f2ec);
  const shutter = mat('metalg', 0xe0745c);
  const darkWin = plain(0x20262a, 0.3, 0.4);
  const shutterSpots: THREE.Matrix4[] = [];
  const warehouse = (x: number, z: number, w: number, h: number, d: number, doors: number[]) => {
    block(x, 0, z, w, h, d, shed, 4);
    const rise = d * 0.22;
    const roofGeo = gableRoofGeometry(w, d, rise, 0.6, 3);
    disposables.push(roofGeo);
    const roof = new THREE.Mesh(roofGeo, roofMetal);
    roof.position.set(x, h, z);
    roof.castShadow = roof.receiveShadow = shadows;
    group.add(roof);
    for (const sx of [-1, 1]) {
      const endGeo = gableEndGeometry(d, rise);
      disposables.push(endGeo);
      const end = new THREE.Mesh(endGeo, shed);
      end.position.set(x + sx * (w / 2 + 0.01), h, z);
      if (sx < 0) end.rotation.y = Math.PI;
      end.castShadow = shadows;
      group.add(end);
    }
    for (const dx of doors) {
      if (getModel('shutter')) shutterSpots.push(new THREE.Matrix4().makeTranslation(x + dx, 0, z + d / 2 + 0.2).multiply(fitTransform('shutter', 4.4, 5.0, 0.4)));
      else {
        block(x + dx, 0, z + d / 2 + 0.06, 4.2, 4.6, 0.12, shutter, 2, { collide: false });
        block(x + dx, 4.6, z + d / 2 + 0.1, 4.6, 0.3, 0.2, frame, 1, { collide: false });
      }
    }
    for (let wx = -w / 2 + 2; wx <= w / 2 - 2; wx += 3.2) block(x + wx, h - 2.2, z + d / 2 + 0.05, 1.4, 0.9, 0.1, darkWin, 1, { collide: false });
    coverBehind(x, z, w, d, h);
  };
  warehouse(-32, -86, 20, 8, 14, [-4.5, 4.5]);
  warehouse(32, -96, 24, 9, 16, [-4, 5]);
  if (shutterSpots.length) group.add(instancedModel('shutter', shutterSpots, undefined, shadows));
  // 철골 창고(벽 없는 빨간 철골 + 지붕)
  {
    const rust = plain(0x8e3b24, 0.6, 0.55);
    const sx0 = 50, sz0 = -58, sw = 14, sd = 10, sh = 6;
    for (const ox of [-sw / 2, 0, sw / 2]) for (const oz of [-sd / 2, sd / 2]) block(sx0 + ox, 0, sz0 + oz, 0.35, sh, 0.35, rust, 1);
    for (const oz of [-sd / 2, sd / 2]) block(sx0, sh - 0.4, sz0 + oz, sw + 0.4, 0.4, 0.3, rust, 1, { collide: false });
    for (const ox of [-sw / 2, 0, sw / 2]) block(sx0 + ox, sh - 0.4, sz0, 0.3, 0.4, sd, rust, 1, { collide: false });
    const roofGeo = gableRoofGeometry(sw, sd, 1.6, 0.5, 3);
    disposables.push(roofGeo);
    const roof = new THREE.Mesh(roofGeo, mat('roofmetal', 0xc0b0a0));
    roof.position.set(sx0, sh, sz0);
    roof.castShadow = shadows;
    group.add(roof);
    crateBox(sx0 - 3, 0, sz0 + 1, 1.3, 1.2, 'low');
    crateBox(sx0 + 2.2, 0, sz0 - 1, 1.2, 1.0, 'low', 0.4);
    crateBox(sx0 + 3.5, 0, sz0 - 0.8, 1.2, 1.0, 'low', -0.3);
    coverBehind(sx0 - 3, sz0 + 1, 1.3, 1.3, 1.2);
  }
  // 먼 건물(창문에 적 저격수)
  block(2, 0, -116, 26, 13, 8, plaster, 4);
  block(2, 13, -116, 26.4, 0.6, 8.4, mat('concrete', 0xcfc8bc), 3, { collide: false });
  for (const y of [4, 8.5]) for (const x of [-8, -2, 4, 10]) block(x, y, -112.0, 1.8, 2.0, 0.12, plain(0x161b20, 0.3, 0.3), 4, { collide: false });
  // 기지 담장(뒤쪽 가운데 정문 · 양옆) + 기둥
  const wallMat = mat('concrete', 0xd8d2c8);
  block(-35, 0, -126, 60, 3, 0.6, wallMat, 3);
  block(35, 0, -126, 60, 3, 0.6, wallMat, 3);
  for (const sx of [-1, 1]) {
    block(sx * 64, 0, -74, 0.6, 2.6, 104, wallMat, 3);
    for (let z = -124; z <= -24; z += 6) block(sx * 64, 0, z, 0.9, 2.9, 0.9, wallMat, 3, { collide: false });
  }
  // 급수탑(저격수 자리): 다리 · X자 버팀대 · 원통 탱크 · 원뿔 지붕
  const towerX = -48, towerZ = -60;
  const steel = plain(0x5a5048, 0.7, 0.5);
  for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) block(towerX + dx, 0, towerZ + dz, 0.3, 12, 0.3, steel, 2, { collide: false });
  collider(towerX, 0, towerZ, 3.5, 12, 3.5, 'solid');
  {
    const len = Math.hypot(3.2, 4), ang = Math.atan2(3.2, 4);
    const braceGeo = new THREE.BoxGeometry(0.09, len, 0.09);
    disposables.push(braceGeo);
    for (let lv = 0; lv < 3; lv++) {
      for (const sgn of [-1, 1]) {
        for (const side of [-1.6, 1.6]) {
          const a = new THREE.Mesh(braceGeo, steel);
          a.position.set(towerX, lv * 4 + 2, towerZ + side);
          a.rotation.z = sgn * ang;
          const b = new THREE.Mesh(braceGeo, steel);
          b.position.set(towerX + side, lv * 4 + 2, towerZ);
          b.rotation.x = sgn * ang;
          group.add(a, b);
        }
      }
    }
  }
  block(towerX, 12, towerZ, 4.4, 0.25, 4.4, steel, 2);
  const tankMat = mat('metalg', 0xc8c2b6);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 3.4, 20), tankMat);
  disposables.push(tank.geometry);
  tank.position.set(towerX, 12.25 + 1.7, towerZ - 0.6);
  tank.castShadow = shadows;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.35, 1.1, 20), plain(0x6f665c, 0.6, 0.5));
  disposables.push(cap.geometry);
  cap.position.set(towerX, 12.25 + 3.4 + 0.55, towerZ - 0.6);
  cap.castShadow = shadows;
  group.add(tank, cap);
  boxes.push({ min: new THREE.Vector3(towerX - 2.1, 12.25, towerZ - 2.7), max: new THREE.Vector3(towerX + 2.1, 15.65, towerZ + 1.5), kind: 'solid' });
  bags.build(sctx);
  if (crateSpots.length) group.add(instancedModel('crate', crateSpots, undefined, shadows));
  if (barrelSpots.length) group.add(instancedModel('barrel', barrelSpots, barrelTints, shadows));

  // ── 먼 배경: 도시 · 야자수 · 바위산 · 구름 ──
  addCity(sctx);
  const palmSpots: [number, number][] = [];
  // 기지 가장자리 나무: 실사 사막 나무(Poly Haven 퀴버트리)가 있으면 그것, 없으면 야자수
  const nearTrees: [number, number][] = [];
  for (let z = -26; z >= -122; z -= 13) nearTrees.push([-70 - ((z * 7) & 3), z], [71 + ((z * 5) & 3), z - 5]);
  for (const p of [[-16, 9], [17, 7], [-30, -14], [30, -12], [-58, -110], [56, -22], [-58, -18]] as [number, number][]) nearTrees.push(p);
  if (getModel('quiver') && quality !== 'low') {
    group.add(instancedModel('quiver', nearTrees.map(([x, z], i) => new THREE.Matrix4().makeTranslation(x, 0, z).multiply(new THREE.Matrix4().makeRotationY(i * 2.4)).multiply(fitTransform('quiver', 0, 4.5 + (i % 4) * 0.8, 0, true))), undefined, shadows));
    for (const [x, z] of nearTrees) collider(x, 0, z, 0.6, 4, 0.6, 'solid');
  } else palmSpots.push(...nearTrees);
  for (let k = 0; k < 46; k++) {
    const t = Math.PI + 0.2 + (k / 46) * (Math.PI - 0.4);
    const r = 120 + ((k * 37) % 90);
    palmSpots.push([Math.cos(t) * r, -60 + Math.sin(t) * r]);
  }
  addPalms(sctx, palmSpots);
  for (const [x, z] of palmSpots) if (Math.abs(x) < 80 && z > -130) collider(x, 0, z, 0.5, 6, 0.5, 'solid');
  addMountains(sctx);
  // 바위 언덕(Poly Haven 절벽 바위): 도시 너머 · 기지 양옆에 크게
  // 저사양(low)에서는 생략 – 폴리곤이 많다
  if (getModel('cliffA') && getModel('cliffB') && quality !== 'low') {
    const rocks: Record<'cliffA' | 'cliffB', THREE.Matrix4[]> = { cliffA: [], cliffB: [] };
    let seed = 41;
    const rr = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 26; k++) {
      const t = Math.PI * 0.9 + rr() * Math.PI * 1.2; // 앞(북) · 양옆
      const rad = 300 + rr() * 110;
      const x = Math.cos(t) * rad, z = -60 + Math.sin(t) * rad;
      const s = 3 + rr() * 3.5;
      const id = k % 2 ? 'cliffA' : 'cliffB';
      rocks[id].push(new THREE.Matrix4().makeTranslation(x, -1.5, z).multiply(new THREE.Matrix4().makeRotationY(-t + Math.PI / 2 + (rr() - 0.5) * 0.6)).multiply(new THREE.Matrix4().makeScale(s, s * (0.8 + rr() * 0.6), s)));
    }
    for (const id of ['cliffA', 'cliffB'] as const) group.add(instancedModel(id, rocks[id].map((m) => m.multiply(fitTransform(id, 0, 7, 0, true))), undefined, false));
  }

  // ── 조명: 해 질 녘(해는 앞쪽 왼편 낮게 – 그림자가 플레이어 쪽으로 길게) ──
  const hemi = new THREE.HemisphereLight(0xbcd6ea, 0xb48c64, 0.55); // 나머지 주변광은 하늘 사진(환경맵)이 준다
  group.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb878, 2.7);
  sun.target.position.set(0, 0, -55);
  sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 160);
  group.add(sun, sun.target);
  // 반사광: 해를 등진 면(플레이어 쪽을 보는 면)이 새까맣지 않게 뒤에서 약하게 비춘다
  const fill = new THREE.DirectionalLight(0xffdcb8, 0.75);
  fill.position.set(30, 40, 120);
  fill.target.position.set(0, 0, -50);
  group.add(fill, fill.target);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
    const s = sun.shadow.camera;
    s.left = -85;
    s.right = 85;
    s.top = 70;
    s.bottom = -70;
    s.near = 10;
    s.far = 360;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.05;
  }

  const nav = new NavGrid(boxes);
  const floorNav = FLOOR_Y.map((y) => new NavGrid(boxes, { minX: BUILDING.minX, minZ: BUILDING.minZ, cols: 40, rows: 20, cell: 0.5, pad: 0.3, y, surfaces: y > 0 ? info.surfaces : undefined }));

  return {
    group,
    boxes,
    covers,
    // 정문 앞은 먼 건물이 막고 있으므로 건물 양옆 · 기지 양쪽 끝에서 들어온다
    spawns: [new THREE.Vector3(-20, 0, -123), new THREE.Vector3(22, 0, -123), new THREE.Vector3(-60, 0, -112), new THREE.Vector3(60, 0, -114)],
    perches: [new THREE.Vector3(towerX, 12.25, towerZ + 1.9), new THREE.Vector3(-8, 4.1, -111.6), new THREE.Vector3(4, 8.6, -111.6), new THREE.Vector3(10, 4.1, -111.6)],
    entrance: info.entranceOutside,
    entranceInside: info.entranceInside,
    roofDoor: info.roofDoor,
    sun,
    nav,
    floorNav,
    surfaces: info.surfaces,
    stairs: info.stairs,
    floorAt: (x, z, yRef) => floorAt(info.surfaces, x, z, yRef),
    plan: (from, to) => planRoute(nav, floorNav, info.stairs, info.entranceOutside, info.entranceInside, from, to),
    dispose() {
      for (const d of disposables) d.dispose();
      group.removeFromParent();
    },
  };
}

/**
 * 바닥 위에 겹쳐 까는 면(마당 · 도로 · 1층 바닥)이 멀리서 땅과 깊이를 다투며 깜빡이지 않게,
 * 깊이 값을 조금 앞으로 당겨 항상 위에 그려지게 한다(층이 높을수록 더 많이).
 */
function layerOnTop(m: THREE.Material, level: number): void {
  m.polygonOffset = true;
  m.polygonOffsetFactor = -level;
  m.polygonOffsetUnits = -4 * level;
}

/** 건물 안(벽 안쪽)인가 */
export function insideBuilding(p: THREE.Vector3): boolean {
  return p.x > BUILDING.minX + 0.1 && p.x < BUILDING.maxX - 0.1 && p.z > BUILDING.minZ + 0.1 && p.z < BUILDING.maxZ - 0.1;
}

/**
 * 층을 넘나드는 경로: 밖 → 정문 → (층마다) 계단 아래 → 계단 위 → … → 목표.
 * 층 안에서는 그 층 격자로 길을 찾는다.
 */
export function planRoute(nav: NavGrid, floors: NavGrid[], stairs: StairLink[], doorOut: THREE.Vector3, doorIn: THREE.Vector3, from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
  const fromIn = insideBuilding(from), toIn = insideBuilding(to);
  if (!fromIn && !toIn) return nav.path(from, to);
  const out: THREE.Vector3[] = [];
  let cur = from.clone();
  let f = 0;
  if (!fromIn) {
    out.push(...nav.path(cur, doorOut), doorIn.clone());
    cur = doorIn.clone();
  } else f = floorIndex(from.y);
  const ft = toIn ? floorIndex(to.y) : 0;
  while (f < ft) {
    out.push(...floors[f].path(cur, stairs[f].from), stairs[f].to.clone());
    cur = stairs[f].to.clone();
    f++;
  }
  while (f > ft) {
    out.push(...floors[f].path(cur, stairs[f - 1].to), stairs[f - 1].from.clone());
    cur = stairs[f - 1].from.clone();
    f--;
  }
  if (toIn) out.push(...floors[f].path(cur, to));
  else out.push(...floors[0].path(cur, doorIn), doorOut.clone(), ...nav.path(doorOut, to));
  return out;
}

/** 광선과 상자들: 가장 가까운 충돌 거리 */
export function rayBoxes(boxes: Box[], o: THREE.Vector3, d: THREE.Vector3, max: number): number | null {
  let best: number | null = null;
  for (const b of boxes) {
    let t0 = 0, t1 = max;
    let hit = true;
    for (const ax of ['x', 'y', 'z'] as const) {
      const inv = 1 / (d[ax] || 1e-12);
      let ta = (b.min[ax] - o[ax]) * inv;
      let tb = (b.max[ax] - o[ax]) * inv;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t1 < t0) {
        hit = false;
        break;
      }
    }
    if (hit && t0 > 1e-4 && (best === null || t0 < best)) best = t0;
  }
  return best;
}

/** 두 점 사이가 막혀 있지 않은가 */
export function clearLine(boxes: Box[], a: THREE.Vector3, b: THREE.Vector3): boolean {
  const d = b.clone().sub(a);
  const len = d.length();
  d.divideScalar(len);
  const t = rayBoxes(boxes, a, d, len);
  return t === null || t > len - 0.05;
}
