/**
 * 옥상 저격전 맵: 남쪽 3층 건물 옥상(플레이어) → 북쪽으로 펼쳐진 적 기지.
 * 좌표: 옥상 중앙 = (0, ROOF_Y, 0), 적은 -Z(북쪽)에서 온다. 1단위 = 1m.
 * 맵이 돌려주는 것: 충돌 상자(탄·시야 판정), 엄폐 지점, 적 등장 지점, 적 저격수 자리, 옥상 출입구.
 */
import * as THREE from 'three';
import { surfaceMaterial, worldUvBox, worldUvPlane, type SurfaceId } from './textures';

export const ROOF_Y = 9;
/** 옥상에서 플레이어가 움직일 수 있는 범위 */
export const ROOF = { minX: -8.4, maxX: 8.4, minZ: -4.3, maxZ: 3.4 };
export const PARAPET_H = 1.05;

export interface Box {
  min: THREE.Vector3;
  max: THREE.Vector3;
  /** 엄폐물 높이 분류: low = 숙이면 숨는 높이 */
  kind: 'solid' | 'low';
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
  /** 돌격병이 들어가는 1층 입구, 옥상에 나타나는 계단 문 */
  entrance: THREE.Vector3;
  hatch: THREE.Vector3;
  sun: THREE.DirectionalLight;
  /** 지상 길찾기 격자 */
  nav: NavGrid;
  dispose(): void;
}

/**
 * 지상 길찾기: 1m 격자, 장애물(높이 1.5m 아래까지 닿는 상자)을 0.5m 부풀려 막는다.
 * 경로는 8방향 BFS 후 곧게 갈 수 있는 경유점은 건너뛴다.
 */
export class NavGrid {
  readonly minX = -90;
  readonly minZ = -140;
  readonly cols = 180;
  readonly rows = 136;
  private readonly blocked: Uint8Array;

  constructor(boxes: Box[]) {
    this.blocked = new Uint8Array(this.cols * this.rows);
    const pad = 0.5;
    for (const b of boxes) {
      if (b.min.y > 1.5 || b.max.y < 0.2) continue;
      const c0 = Math.floor(b.min.x - pad - this.minX), c1 = Math.ceil(b.max.x + pad - this.minX);
      const r0 = Math.floor(b.min.z - pad - this.minZ), r1 = Math.ceil(b.max.z + pad - this.minZ);
      for (let r = Math.max(0, r0); r < Math.min(this.rows, r1); r++) {
        for (let c = Math.max(0, c0); c < Math.min(this.cols, c1); c++) {
          const x = c + 0.5 + this.minX, z = r + 0.5 + this.minZ;
          if (x > b.min.x - pad && x < b.max.x + pad && z > b.min.z - pad && z < b.max.z + pad) this.blocked[r * this.cols + c] = 1;
        }
      }
    }
  }

  private cellOf(x: number, z: number): [number, number] {
    return [Math.max(0, Math.min(this.cols - 1, Math.floor(x - this.minX))), Math.max(0, Math.min(this.rows - 1, Math.floor(z - this.minZ)))];
  }

  free(x: number, z: number): boolean {
    const [c, r] = this.cellOf(x, z);
    return !this.blocked[r * this.cols + c];
  }

  private walkable(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(d / 0.5));
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
    for (let i = goal; i !== start; i = prev[i]) cells.push(new THREE.Vector3((i % this.cols) + 0.5 + this.minX, 0, Math.floor(i / this.cols) + 0.5 + this.minZ));
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
  const block = (x: number, y: number, z: number, w: number, h: number, d: number, m: THREE.Material, tile: number, opts: { collide?: Box['kind'] | false; rotY?: number } = {}) => {
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
      boxes.push({ min: new THREE.Vector3(x - hw, y, z - hd), max: new THREE.Vector3(x + hw, y + h, z + hd), kind: opts.collide ?? 'solid' });
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
  const ground = new THREE.Mesh(worldUvPlane(500, 500, 9), mat('ground'));
  disposables.push(ground.geometry);
  ground.position.z = -100;
  ground.receiveShadow = shadows;
  group.add(ground);
  const road = new THREE.Mesh(worldUvPlane(260, 7, 7), mat('asphalt'));
  disposables.push(road.geometry);
  road.position.set(0, 0.02, -17);
  road.receiveShadow = shadows;
  group.add(road);

  // ── 플레이어 건물 ──
  const concrete = mat('concrete');
  const plaster = mat('plaster');
  block(0, 0, 0, 20, ROOF_Y, 10, plaster, 4, { collide: 'solid' });
  // 창문 줄(어두운 유리)
  for (const y of [2, 5.5]) for (let x = -8; x <= 8; x += 4) block(x, y, -5.02, 1.6, 1.8, 0.1, plain(0x1e262c, 0.25, 0.4), 4, { collide: false });
  block(0, 0, -5.1, 2.4, 2.6, 0.2, plain(0x2a2420), 4, { collide: false }); // 1층 입구
  // 옥상 바닥(얇은 판, 그림자 받음)
  const roofTop = new THREE.Mesh(worldUvPlane(20, 10, 3), concrete);
  disposables.push(roofTop.geometry);
  roofTop.position.set(0, ROOF_Y + 0.01, 0);
  roofTop.receiveShadow = shadows;
  group.add(roofTop);
  // 난간(북쪽은 엄폐용, 나머지는 낮은 턱)
  block(0, ROOF_Y, -4.85, 20, PARAPET_H, 0.3, concrete, 3, { collide: 'low' });
  block(-9.85, ROOF_Y, 0, 0.3, PARAPET_H, 10, concrete, 3, { collide: 'low' });
  block(9.85, ROOF_Y, 0, 0.3, PARAPET_H, 10, concrete, 3, { collide: 'low' });
  block(0, ROOF_Y, 4.85, 20, PARAPET_H, 0.3, concrete, 3, { collide: 'low' });
  // 계단실(돌격병이 올라오는 문)
  block(6.2, ROOF_Y, 2.9, 3.2, 2.6, 2.2, plaster, 4, { collide: 'solid' });
  block(6.2, ROOF_Y, 1.78, 1.1, 2.1, 0.06, plain(0x3b2f26), 4, { collide: false });
  // 옥상 소품: 에어컨 실외기 · 물탱크(낮은 엄폐)
  block(-6.5, ROOF_Y, 2.4, 1.6, 1.0, 1.0, plain(0xb9bcbd, 0.5, 0.4), 2);
  block(-3.4, ROOF_Y, 3.1, 1.2, 0.9, 0.9, plain(0xb9bcbd, 0.5, 0.4), 2);

  // ── 적 기지 ──
  const metalTints = [0xffffff, 0xd98a5c, 0x8fa6d6, 0xd6c46a];
  // 모래주머니 줄(낮은 엄폐)
  const sandbag = plain(0x9c8a66, 0.95);
  for (const [x, z, w] of [[-12, -28, 9], [11, -30, 10], [-30, -46, 7], [2, -50, 8], [34, -62, 7], [-14, -78, 8], [12, -92, 8], [-46, -32, 6], [44, -36, 6], [-2, -100, 8], [-24, -60, 5]] as const) {
    block(x, 0, z, w, 1.0, 1.1, sandbag, 2, { collide: 'low' });
    coverBehind(x, z, w, 1.1, 1.0);
  }
  // 컨테이너(높은 엄폐)
  const containers: [number, number, number, number][] = [
    [-24, -38, 0, 0], [24, -40, Math.PI / 2, 1], [-6, -62, 0, 2], [30, -48, 0, 3], [-40, -66, Math.PI / 2, 0], [10, -74, 0, 1],
  ];
  for (const [x, z, rot, t] of containers) {
    const rotated = Math.abs(Math.sin(rot)) > 0.5;
    block(x, 0, z, 6, 2.6, 2.4, mat('metal', metalTints[t]), 2.6, { rotY: rot });
    coverBehind(x, z, rotated ? 2.4 : 6, rotated ? 6 : 2.4, 2.6);
  }
  block(10, 2.6, -74, 6, 2.6, 2.4, mat('metal', metalTints[2]), 2.6); // 2단 적재
  // 나무 상자 · 드럼통
  const crate = plain(0x8a6a44, 0.9);
  for (const [x, z] of [[-18, -55], [20, -58], [-2, -36], [40, -80], [-50, -78], [8, -40], [-36, -56]] as const) {
    block(x, 0, z, 1.3, 1.2, 1.3, crate, 1.3, { collide: 'low' });
    coverBehind(x, z, 1.3, 1.3, 1.2);
  }
  const barrelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.95, 12);
  disposables.push(barrelGeo);
  for (const [x, z, c] of [[-20, -34, 0xa8402e], [-19.2, -34.4, 0x3d6b8c], [26, -66, 0xa8402e], [-8, -88, 0x5d6b3a]] as const) {
    const b = new THREE.Mesh(barrelGeo, plain(c, 0.6, 0.3));
    b.position.set(x, 0.475, z);
    b.castShadow = b.receiveShadow = shadows;
    group.add(b);
    boxes.push({ min: new THREE.Vector3(x - 0.32, 0, z - 0.32), max: new THREE.Vector3(x + 0.32, 0.95, z + 0.32), kind: 'low' });
  }
  // 창고 2동
  const roofMetal = mat('metal', 0xb8b0a4);
  block(-32, 0, -86, 20, 8, 14, plaster, 4);
  block(-32, 8, -86, 21, 0.4, 15, roofMetal, 3, { collide: false });
  block(-32, 0, -78.95, 6, 5, 0.1, plain(0x3a3632), 4, { collide: false });
  coverBehind(-32, -86, 20, 14, 8);
  block(32, 0, -96, 24, 9, 16, plaster, 4);
  block(32, 9, -96, 25, 0.4, 17, roofMetal, 3, { collide: false });
  block(28, 0, -87.95, 6, 5.5, 0.1, plain(0x3a3632), 4, { collide: false });
  coverBehind(32, -96, 24, 16, 9);
  // 먼 건물(창문에 적 저격수)
  block(2, 0, -116, 26, 13, 8, plaster, 4);
  for (const y of [4, 8.5]) for (const x of [-8, -2, 4, 10]) block(x, y, -112.0, 1.8, 2.0, 0.12, plain(0x161b20, 0.3, 0.3), 4, { collide: false });
  // 기지 담장(가운데 정문)
  const wallMat = mat('concrete', 0xd8d2c8);
  block(-35, 0, -126, 60, 3, 0.6, wallMat, 3);
  block(35, 0, -126, 60, 3, 0.6, wallMat, 3);
  // 급수탑(저격수 자리)
  const towerX = -48, towerZ = -60;
  const steel = plain(0x6a5a4a, 0.7, 0.5);
  for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) block(towerX + dx, 0, towerZ + dz, 0.3, 12, 0.3, steel, 2, { collide: false });
  block(towerX, 12, towerZ, 4.4, 0.25, 4.4, steel, 2);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 3.4, 16), mat('metal', 0xd8c39a));
  disposables.push(tank.geometry);
  tank.position.set(towerX, 12.25 + 1.7, towerZ - 0.6);
  tank.castShadow = shadows;
  group.add(tank);
  boxes.push({ min: new THREE.Vector3(towerX - 2.1, 12.25, towerZ - 2.7), max: new THREE.Vector3(towerX + 2.1, 15.65, towerZ + 1.5), kind: 'solid' });

  // ── 먼 배경: 능선 · 나무 ──
  const ridgeMat = plain(0x8c7a62, 1);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI - Math.PI;
    const r = 260 + (i % 3) * 30;
    const h = 30 + ((i * 37) % 40);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(70 + (i % 4) * 15, h, 5), ridgeMat);
    disposables.push(cone.geometry);
    cone.position.set(Math.cos(a) * r, h / 2 - 4, -100 + Math.sin(a) * r);
    group.add(cone);
  }
  const treeMat = plain(0x5f6e3a, 1);
  const trunkMat = plain(0x5a4632, 1);
  const leaf = new THREE.ConeGeometry(2.2, 6, 6);
  const trunk = new THREE.CylinderGeometry(0.25, 0.35, 2, 5);
  disposables.push(leaf, trunk);
  for (let i = 0; i < 40; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (66 + ((i * 13) % 40));
    const z = -20 - ((i * 29) % 130);
    const t = new THREE.Mesh(trunk, trunkMat);
    t.position.set(x, 1, z);
    const l = new THREE.Mesh(leaf, treeMat);
    l.position.set(x, 4.8, z);
    l.castShadow = shadows;
    group.add(t, l);
  }

  // ── 조명: 해 질 녘 ──
  const hemi = new THREE.HemisphereLight(0xa9d0e6, 0x8a6a48, 0.95);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(0xffc48a, 2.4);
  sun.position.set(-90, 55, 30);
  sun.target.position.set(0, 0, -55);
  group.add(sun, sun.target);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
    const s = sun.shadow.camera;
    s.left = -75;
    s.right = 75;
    s.top = 80;
    s.bottom = -80;
    s.near = 10;
    s.far = 260;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
  }

  return {
    group,
    boxes,
    covers,
    // 정문 앞은 먼 건물이 막고 있으므로 건물 양옆 · 기지 양쪽 끝에서 들어온다
    spawns: [new THREE.Vector3(-20, 0, -123), new THREE.Vector3(22, 0, -123), new THREE.Vector3(-62, 0, -112), new THREE.Vector3(62, 0, -114)],
    perches: [new THREE.Vector3(towerX, 12.25, towerZ + 1.9), new THREE.Vector3(-8, 4.1, -111.6), new THREE.Vector3(4, 8.6, -111.6), new THREE.Vector3(10, 4.1, -111.6)],
    entrance: new THREE.Vector3(0, 0, -6.2),
    hatch: new THREE.Vector3(6.2, ROOF_Y, 1.2),
    sun,
    nav: new NavGrid(boxes),
    dispose() {
      for (const d of disposables) d.dispose();
      group.removeFromParent();
    },
  };
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
