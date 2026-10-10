/**
 * 실내 잠입: 건물(격자 배치도) · 이동 충돌 · 경비 순찰/시야/청각 · 제압 · 길찾기.
 *
 * 배치도 문자(1칸 = 1m):
 *   #  벽            w  창문(아래·위만 막힌 벽 – 저격 위치 앞)
 *   .  바닥          N  저격 위치(창문 바로 아래 칸)
 *   S  잠입 시작      E  탈출 지점
 *   B  높은 선반(이동·시야 모두 막음)
 *   c  낮은 상자(이동은 막고, 숙이고 있으면 몸을 가려줌)
 *   T  탁자(낮은 상자와 같은 규칙)
 *   (공백) 건물 밖
 *
 * 좌표: 저격 위치(N) 칸의 중심이 월드 (0, 0)이고 배치도 위쪽(행 0)이 표적 방향(-Z)이다.
 * 게임 규칙은 이 파일만 보면 알 수 있도록 수치를 위쪽 상수에 모아 둔다.
 */
import * as THREE from 'three';
import type { InteriorSpec, OutfitId } from '../config/missions';
import { buildHuman, type HumanMaterials, type HumanRig } from './models/human';

export const INTERIOR = {
  cell: 1,
  wallHeight: 3,
  sill: 0.8,
  lintel: 2.25,
  /** 플레이어 */
  playerRadius: 0.28,
  walkSpeed: 3.0,
  crouchSpeed: 1.55,
  standEye: 1.62,
  crouchEye: 1.05,
  /** 저격 자세(창가에 앉아서)의 눈높이 */
  nestEye: 1.3,
  /** 저격 위치·탈출 지점 도착 판정 반경(m) */
  reachRadius: 0.75,
  /** 경비 */
  guardWalk: 1.25,
  guardSearch: 1.25,
  /** 시야: 정면 ±55°, 서 있는 사람 12m, 숙인 사람 7m */
  viewHalfAngle: (55 * Math.PI) / 180,
  viewRange: 12,
  viewRangeCrouch: 7,
  /** 수색 중에는 더 멀리·넓게 본다 */
  searchViewMul: 1.3,
  /** 아주 가까우면(1.3m) 옆에 있어도 알아챈다 */
  closeSense: 1.3,
  /** 발각 게이지: 초당 상승 = (base + near × 가까움) × 난이도 배율 */
  detectBase: 0.55,
  detectNear: 2.4,
  detectDecay: 0.4,
  /** 이 이상이면 멈춰 서서 쳐다본다(의심) */
  suspicious: 0.25,
  /** 서서 걸으면 이 거리 안의 경비가 발소리를 듣고 돌아본다(벽 너머 포함) */
  footstepRadius: 4,
  /** 제압: 거리·뒤쪽 판정 */
  takedownRange: 1.45,
  takedownBehindAngle: (100 * Math.PI) / 180,
  /** 쓰러진 동료를 알아보는 거리 */
  bodySightRange: 9,
  /** 총성 반응 */
  loudShotDelay: 8,
  muffledListenTime: 5,
  searchLookTime: 6,
  /** 교전: 경비 체력, 이동 속도, 놓친 뒤 수색 시간 */
  guardHp: 100,
  guardCombatSpeed: 1.9,
  combatLoseTime: 9,
  /** 무전: 한 명이 교전을 시작하면 이 시간 뒤 건물 전체 경보 */
  radioDelay: 1.5,
  /** 몸을 기울여 일부만 보일 때 발각 속도·피격 확률 배율 */
  partialExposure: 0.5,
} as const;

/** 난이도별 경비 사격 */
export interface CombatTuning {
  /** 나를 본 뒤 첫 발까지(초) */
  reaction: number;
  /** 발사 간격(초) */
  interval: number;
  /** 기본 명중 확률(가까울수록·멈춰 있을수록 높음) */
  hitBase: number;
  /** 한 발 피해(플레이어 체력 100) */
  damage: number;
}

type Cell = 'wall' | 'window' | 'floor' | 'tall' | 'low' | 'table' | 'void';

export interface GridPos {
  c: number;
  r: number;
}

export type GuardState = 'patrol' | 'pause' | 'suspicious' | 'listen' | 'search' | 'look' | 'return' | 'combat' | 'down';

export class InteriorGuard {
  readonly rig: HumanRig;
  readonly pos = new THREE.Vector3();
  yaw = 0;
  state: GuardState = 'patrol';
  meter = 0;
  /** 순찰 경로(월드 좌표) */
  readonly route: THREE.Vector2[];
  private routeIndex = 0;
  readonly pause: number;
  readonly baseYaw: number;
  timer = 0;
  /** 수색·복귀 경로 */
  path: THREE.Vector2[] = [];
  lookAt: THREE.Vector2 | null = null;
  bodySeen = new Set<InteriorGuard>();
  /** 총성을 듣고 멈춘 뒤 수색하러 갈지 */
  searchAfterListen = false;
  hp: number = INTERIOR.guardHp;
  /** 교전: 마지막으로 본 플레이어 위치 */
  lastKnown: THREE.Vector2 | null = null;
  /** 이번 스텝에 플레이어를 보고 있는가(머리만 보이면 partial) */
  seesPlayer = false;
  partial = false;
  aimT = 0;
  fireT = 0;
  lostT = 0;
  /** 경보가 울린 뒤에는 계속 경계(시야가 넓다) */
  alarmed = false;
  /** 총구 섬광 표시 시간 */
  flashT = 0;
  readonly flash: THREE.Mesh;
  private animT = 0;
  private swing = 0;
  private fall = 0;
  readonly label: string;

  constructor(route: THREE.Vector2[], pause: number, yawDeg: number | undefined, outfit: OutfitId, mats: HumanMaterials, label: string) {
    this.rig = buildHuman(outfit, mats);
    this.flash = new THREE.Mesh(FLASH_GEO, FLASH_MAT);
    this.flash.position.set(0.18, 1.38, 0.55);
    this.flash.visible = false;
    this.rig.root.add(this.flash);
    this.route = route;
    this.pause = pause;
    this.baseYaw = yawDeg !== undefined ? (yawDeg * Math.PI) / 180 : 0;
    this.label = label;
  }

  get down(): boolean {
    return this.state === 'down';
  }

  get forward(): THREE.Vector2 {
    return new THREE.Vector2(Math.sin(this.yaw), Math.cos(this.yaw));
  }

  get stationary(): boolean {
    return this.route.length < 2;
  }

  reset(floorY: number): void {
    const p = this.route[0];
    this.pos.set(p.x, floorY, p.y);
    this.routeIndex = this.route.length > 1 ? 1 : 0;
    this.state = this.stationary ? 'pause' : 'patrol';
    this.timer = this.pause;
    this.meter = 0;
    this.path = [];
    this.lookAt = null;
    this.bodySeen.clear();
    this.fall = 0;
    this.hp = INTERIOR.guardHp;
    this.lastKnown = null;
    this.seesPlayer = false;
    this.partial = false;
    this.aimT = 0;
    this.fireT = 0;
    this.lostT = 0;
    this.alarmed = false;
    this.flashT = 0;
    this.flash.visible = false;
    this.rig.body.rotation.set(0, 0, 0);
    this.rig.body.position.set(0, 0, 0);
    this.rig.root.visible = true;
    if (this.route.length > 1) {
      const n = this.route[1];
      this.yaw = Math.atan2(n.x - p.x, n.y - p.y);
    } else this.yaw = this.baseYaw;
    this.sync();
  }

  /** 다음 순찰 지점 */
  nextWaypoint(): THREE.Vector2 {
    return this.route[this.routeIndex];
  }

  advanceRoute(): void {
    this.routeIndex = (this.routeIndex + 1) % this.route.length;
  }

  turnToward(x: number, z: number, rate: number, dt: number): void {
    const want = Math.atan2(x - this.pos.x, z - this.pos.z);
    let d = want - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += Math.sign(d) * Math.min(Math.abs(d), rate * dt);
  }

  /** 지점으로 걸어간다. 도착하면 true */
  walkTo(x: number, z: number, speed: number, dt: number): boolean {
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const step = speed * dt;
    if (d <= step) {
      this.pos.x = x;
      this.pos.z = z;
      return true;
    }
    this.pos.x += (dx / d) * step;
    this.pos.z += (dz / d) * step;
    this.turnToward(x, z, 8, dt);
    this.animT += dt * (2.2 + speed * 1.6);
    this.swing += (Math.min(0.9, 0.35 + speed * 0.15) - this.swing) * Math.min(1, dt * 6);
    return false;
  }

  idle(dt: number): void {
    this.animT += dt;
    this.swing += (0 - this.swing) * Math.min(1, dt * 6);
  }

  knockDown(): void {
    this.state = 'down';
    this.meter = 0;
    this.fall = 0.0001;
  }

  sync(dt = 0): void {
    const r = this.rig;
    this.flashT = Math.max(0, this.flashT - dt);
    this.flash.visible = this.flashT > 0 && this.state !== 'down';
    r.root.position.copy(this.pos);
    r.root.rotation.y = this.yaw;
    if (this.state === 'down') {
      this.fall = Math.min(1, this.fall + dt * 2.2);
      const e = 1 - Math.pow(1 - this.fall, 3);
      r.body.rotation.x = e * (Math.PI / 2 - 0.1);
      r.body.position.y = -e * 0.1;
      r.legL.rotation.x = -e * 0.4;
      r.legR.rotation.x = -e * 0.2;
      r.armL.rotation.x = e * 1.1;
      r.armR.rotation.x = e * 0.8;
      r.alertLight.visible = false;
      return;
    }
    const s = Math.sin(this.animT * 2) * this.swing;
    r.legL.rotation.x = s;
    r.legR.rotation.x = -s;
    r.armL.rotation.x = -s * 0.8;
    r.armR.rotation.x = s * 0.8;
    r.head.rotation.y = this.state === 'pause' || this.state === 'look' ? Math.sin(this.animT * 0.8) * 0.5 : 0;
    r.alertLight.visible = true;
  }
}

export interface PlayerSense {
  x: number;
  z: number;
  /** 머리 위치(몸을 기울이면 몸통과 다르다) */
  hx: number;
  hz: number;
  crouched: boolean;
  moving: boolean;
  /** 저격 중(창가에 붙어 있음) – 숙인 것과 같은 규칙 */
  hidden: boolean;
  /** 레이저 등으로 눈에 더 잘 띔 */
  detectMul: number;
}

export interface GuardShot {
  guard: InteriorGuard;
  hit: boolean;
  damage: number;
}

export interface GuardUpdate {
  /** 게이지가 가득 차 교전을 시작한 경비(처음 한 명) */
  detectedBy: InteriorGuard | null;
  /** 동료 시신을 처음 발견한 경비 */
  foundBody: InteriorGuard | null;
  maxMeter: number;
  /** 이번 스텝에 경비가 쏜 탄 */
  shots: GuardShot[];
  /** 교전 중인 경비가 있는가 */
  combat: boolean;
}

export interface RayHit {
  kind: 'guard' | 'wall';
  point: THREE.Vector3;
  guard?: InteriorGuard;
  zone?: 'head' | 'body' | 'leg';
  dist: number;
}

const FLASH_GEO = new THREE.SphereGeometry(0.07, 6, 4);
const FLASH_MAT = new THREE.MeshBasicMaterial({ color: 0xffd27a });

export class Interior {
  readonly spec: InteriorSpec;
  readonly group = new THREE.Group();
  readonly cols: number;
  readonly rows: number;
  private readonly cells: Cell[][];
  readonly nest: GridPos;
  readonly start: GridPos;
  readonly exit: GridPos;
  readonly floorY: number;
  readonly guards: InteriorGuard[] = [];
  /** 월드 XZ 경계(지형 평탄화용) */
  readonly bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  private readonly disposables: { dispose(): void }[] = [];
  private readonly nestRing: THREE.Mesh;
  private readonly exitRing: THREE.Mesh;
  private t = 0;

  constructor(spec: InteriorSpec, floorY: number, palette: { wall: number; floor: number; trim: number }, lights: boolean) {
    this.spec = spec;
    this.floorY = floorY;
    const layout = spec.layout;
    this.rows = layout.length;
    this.cols = Math.max(...layout.map((l) => l.length));
    let nest: GridPos | null = null;
    let start: GridPos | null = null;
    let exit: GridPos | null = null;
    this.cells = layout.map((line, r) =>
      Array.from({ length: this.cols }, (_, c) => {
        const ch = line[c] ?? ' ';
        if (ch === 'N') nest = { c, r };
        if (ch === 'S') start = { c, r };
        if (ch === 'E') exit = { c, r };
        return charToCell(ch);
      }),
    );
    if (!nest || !start || !exit) throw new Error(`배치도에 N/S/E가 필요합니다: ${spec.name}`);
    this.nest = nest;
    this.start = start;
    this.exit = exit;
    const C = INTERIOR.cell;
    this.bounds = {
      minX: (0 - this.nest.c - 0.5) * C,
      maxX: (this.cols - 1 - this.nest.c + 0.5) * C,
      minZ: (0 - this.nest.r - 0.5) * C,
      maxZ: (this.rows - 1 - this.nest.r + 0.5) * C,
    };
    this.buildMeshes(palette, lights);
    const ringGeo = this.track(new THREE.RingGeometry(0.32, 0.42, 24));
    ringGeo.rotateX(-Math.PI / 2);
    const nestMat = this.track(new THREE.MeshBasicMaterial({ color: 0xe8a33d, transparent: true, opacity: 0.85, depthWrite: false }));
    const exitMat = this.track(new THREE.MeshBasicMaterial({ color: 0x56d364, transparent: true, opacity: 0.85, depthWrite: false }));
    this.nestRing = new THREE.Mesh(ringGeo, nestMat);
    this.exitRing = new THREE.Mesh(ringGeo, exitMat);
    const n = this.toWorld(this.nest);
    const e = this.toWorld(this.exit);
    this.nestRing.position.set(n.x, floorY + 0.02, n.y);
    this.exitRing.position.set(e.x, floorY + 0.02, e.y);
    this.group.add(this.nestRing, this.exitRing);
  }

  private track<T extends { dispose(): void }>(o: T): T {
    this.disposables.push(o);
    return o;
  }

  // ───────── 좌표 ─────────
  toWorld(p: GridPos): THREE.Vector2 {
    return new THREE.Vector2((p.c - this.nest.c) * INTERIOR.cell, (p.r - this.nest.r) * INTERIOR.cell);
  }

  toGrid(x: number, z: number): GridPos {
    return { c: Math.round(x / INTERIOR.cell) + this.nest.c, r: Math.round(z / INTERIOR.cell) + this.nest.r };
  }

  cell(c: number, r: number): Cell {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return 'void';
    return this.cells[r][c];
  }

  /** 이동을 막는 칸 */
  solid(c: number, r: number): boolean {
    const k = this.cell(c, r);
    return k !== 'floor';
  }

  /** 시선을 막는 칸. 낮은 상자·탁자는 숙인 사람만 가린다 */
  blocksSight(c: number, r: number, targetLow: boolean): boolean {
    const k = this.cell(c, r);
    if (k === 'floor') return false;
    if (k === 'low' || k === 'table') return targetLow;
    return true;
  }

  /** 두 점 사이 시야(0.15m 간격 표본) */
  los(ax: number, az: number, bx: number, bz: number, targetLow: boolean): boolean {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(d / 0.15));
    const start = this.toGrid(ax, az);
    const end = this.toGrid(bx, bz);
    let prev = start;
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      const g = this.toGrid(ax + (bx - ax) * f, az + (bz - az) * f);
      // 대각선으로 칸을 건너뛸 때 두 모서리 중 하나라도 막혀 있으면 틈으로 보이지 않는다
      if (g.c !== prev.c && g.r !== prev.r && (this.blocksSight(g.c, prev.r, targetLow) || this.blocksSight(prev.c, g.r, targetLow))) return false;
      prev = g;
      if ((g.c === start.c && g.r === start.r) || (g.c === end.c && g.r === end.r)) continue;
      if (this.blocksSight(g.c, g.r, targetLow)) return false;
    }
    return true;
  }

  /** 원(플레이어)을 벽 밖으로 밀어낸다 */
  collide(p: THREE.Vector3, radius: number): void {
    const C = INTERIOR.cell;
    for (let pass = 0; pass < 2; pass++) {
      const g = this.toGrid(p.x, p.z);
      for (let r = g.r - 1; r <= g.r + 1; r++) {
        for (let c = g.c - 1; c <= g.c + 1; c++) {
          if (!this.solid(c, r)) continue;
          const w = this.toWorld({ c, r });
          const minX = w.x - C / 2, maxX = w.x + C / 2, minZ = w.y - C / 2, maxZ = w.y + C / 2;
          const qx = Math.max(minX, Math.min(maxX, p.x));
          const qz = Math.max(minZ, Math.min(maxZ, p.z));
          let dx = p.x - qx;
          let dz = p.z - qz;
          const d = Math.hypot(dx, dz);
          if (d >= radius) continue;
          if (d < 1e-6) {
            // 중심이 벽 안: 가장 가까운 면으로
            const ex = [p.x - minX, maxX - p.x, p.z - minZ, maxZ - p.z];
            const i = ex.indexOf(Math.min(...ex));
            dx = i === 0 ? -1 : i === 1 ? 1 : 0;
            dz = i === 2 ? -1 : i === 3 ? 1 : 0;
            p.x = i === 0 ? minX - radius : i === 1 ? maxX + radius : p.x;
            p.z = i === 2 ? minZ - radius : i === 3 ? maxZ + radius : p.z;
            continue;
          }
          p.x = qx + (dx / d) * radius;
          p.z = qz + (dz / d) * radius;
        }
      }
    }
  }

  /** 격자 최단 경로(4방향 BFS) → 월드 좌표 경유점 */
  path(from: THREE.Vector2, to: THREE.Vector2): THREE.Vector2[] {
    const a = this.toGrid(from.x, from.y);
    let b = this.toGrid(to.x, to.y);
    // 목적지가 벽·상자 칸이면 가장 가까운 바닥 칸으로(벽을 뚫고 걷지 않게)
    if (this.solid(b.c, b.r)) {
      let best: GridPos | null = null;
      let bestD = Infinity;
      for (let r = b.r - 2; r <= b.r + 2; r++) {
        for (let c = b.c - 2; c <= b.c + 2; c++) {
          if (this.solid(c, r)) continue;
          const w = this.toWorld({ c, r });
          const d = w.distanceTo(to);
          if (d < bestD) {
            bestD = d;
            best = { c, r };
          }
        }
      }
      if (!best) return [];
      b = best;
      to = this.toWorld(best);
    }
    const key = (c: number, r: number) => r * this.cols + c;
    const prev = new Map<number, number>();
    const q: GridPos[] = [a];
    prev.set(key(a.c, a.r), -1);
    let found = false;
    while (q.length) {
      const p = q.shift()!;
      if (p.c === b.c && p.r === b.r) {
        found = true;
        break;
      }
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = p.c + dc, r = p.r + dr;
        if (this.solid(c, r) || prev.has(key(c, r))) continue;
        prev.set(key(c, r), key(p.c, p.r));
        q.push({ c, r });
      }
    }
    if (!found) return [];
    const cellsRev: GridPos[] = [];
    let k = key(b.c, b.r);
    while (k !== -1) {
      cellsRev.push({ c: k % this.cols, r: Math.floor(k / this.cols) });
      k = prev.get(k)!;
    }
    const pts = cellsRev.reverse().map((g) => this.toWorld(g));
    pts[pts.length - 1] = to.clone();
    // 직선으로 갈 수 있는 경유점은 건너뛴다(자연스러운 움직임)
    const out: THREE.Vector2[] = [];
    let anchor = from.clone();
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.clearLine(anchor, pts[j])) j--;
      out.push(pts[j]);
      anchor = pts[j];
      i = j + 1;
    }
    return out;
  }

  /** 사람 폭(0.3m)으로 지나갈 수 있는 직선인지 */
  clearLine(a: THREE.Vector2, b: THREE.Vector2): boolean {
    const d = a.distanceTo(b);
    const n = Math.max(1, Math.ceil(d / 0.2));
    for (let i = 0; i <= n; i++) {
      const x = a.x + ((b.x - a.x) * i) / n;
      const z = a.y + ((b.y - a.y) * i) / n;
      for (const [ox, oz] of [[0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) {
        const g = this.toGrid(x + ox, z + oz);
        if (this.solid(g.c, g.r)) return false;
      }
    }
    return true;
  }

  // ───────── 경비 ─────────
  spawnGuards(mats: HumanMaterials, defaultOutfit: OutfitId): void {
    for (const g of this.guards) this.group.remove(g.rig.root);
    this.guards.length = 0;
    this.spec.guards.forEach((d, i) => {
      const route = d.path.map(([c, r]) => this.toWorld({ c, r }));
      const g = new InteriorGuard(route, d.pause ?? 2, d.yaw, d.outfit ?? defaultOutfit, mats, d.label ?? `경비 ${String.fromCharCode(65 + i)}`);
      this.guards.push(g);
      this.group.add(g.rig.root);
    });
    this.reset();
  }

  reset(): void {
    for (const g of this.guards) g.reset(this.floorY);
  }

  /** 총성: loud = 위치를 알고 수색하러 옴, muffled = 멈춰서 귀 기울임 */
  hearShot(kind: 'loud' | 'muffled', at: THREE.Vector2): void {
    for (const g of this.guards) {
      if (g.down) continue;
      g.lookAt = at.clone();
      if (kind === 'loud') {
        g.state = 'listen';
        g.timer = INTERIOR.loudShotDelay;
        g.path = this.path(new THREE.Vector2(g.pos.x, g.pos.z), at);
        g.searchAfterListen = true;
      } else if (g.state !== 'search') {
        g.state = 'listen';
        g.timer = INTERIOR.muffledListenTime;
        g.path = [];
        g.searchAfterListen = false;
      }
    }
  }

  /** 제압 가능한 경비(가까이·바라보는 중·뒤쪽이거나 눈치채지 못함) */
  takedownCandidate(px: number, pz: number, yaw: number): InteriorGuard | null {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    let best: InteriorGuard | null = null;
    let bestD = Infinity;
    for (const g of this.guards) {
      if (g.down) continue;
      const dx = g.pos.x - px, dz = g.pos.z - pz;
      const d = Math.hypot(dx, dz);
      if (d > INTERIOR.takedownRange || d < 1e-3) continue;
      if ((dx * fx + dz * fz) / d < Math.cos((55 * Math.PI) / 180)) continue;
      const gf = g.forward;
      const behind = Math.acos(Math.max(-1, Math.min(1, (-dx * gf.x + -dz * gf.y) / d)));
      if (behind < INTERIOR.takedownBehindAngle && g.meter > 0.2) continue;
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    return best;
  }

  update(dt: number, player: PlayerSense, detectMul: number, tuning: CombatTuning): GuardUpdate {
    this.t += dt;
    const I = INTERIOR;
    const out: GuardUpdate = { detectedBy: null, foundBody: null, maxMeter: 0, shots: [], combat: false };
    const pv = new THREE.Vector2(player.x, player.z);
    for (const g of this.guards) {
      if (g.down) {
        g.sync(dt);
        continue;
      }
      // ── 감지(머리 위치 기준, 몸통이 가려져 있으면 일부만 보임) ──
      const dx = player.hx - g.pos.x, dz = player.hz - g.pos.z;
      const d = Math.hypot(dx, dz);
      const low = player.crouched || player.hidden;
      const searching = g.state === 'search' || g.state === 'look' || g.state === 'combat' || g.alarmed;
      const range = (low ? I.viewRangeCrouch : I.viewRange) * (searching ? I.searchViewMul : 1);
      const half = I.viewHalfAngle * (searching ? 1.2 : 1);
      const gf = g.forward;
      const ang = d > 1e-3 ? Math.acos(Math.max(-1, Math.min(1, (dx * gf.x + dz * gf.y) / d))) : 0;
      const inCone = g.state === 'combat' ? d < range * 1.5 : (d < range && ang < half) || (d < I.closeSense && ang < Math.PI * 0.6);
      const headVis = inCone && this.los(g.pos.x, g.pos.z, player.hx, player.hz, low);
      const bodyVis = headVis && (Math.hypot(player.hx - player.x, player.hz - player.z) < 0.1 || this.los(g.pos.x, g.pos.z, player.x, player.z, low));
      g.seesPlayer = headVis;
      g.partial = headVis && !bodyVis;
      if (headVis) {
        const near = Math.max(0, 1 - d / range);
        g.meter = Math.min(1, g.meter + (I.detectBase + I.detectNear * near) * detectMul * player.detectMul * (player.moving ? 1 : 0.75) * (g.partial ? I.partialExposure : 1) * dt);
        g.lookAt = pv.clone();
        g.lastKnown = pv.clone();
      } else if (g.state !== 'combat') {
        g.meter = Math.max(0, g.meter - I.detectDecay * dt);
      }
      // 발소리(서서 걸을 때)
      if (!headVis && player.moving && !player.crouched && !player.hidden && d < I.footstepRadius && (g.state === 'patrol' || g.state === 'pause')) {
        g.state = 'suspicious';
        g.timer = 2.5;
        g.lookAt = pv.clone();
        g.meter = Math.max(g.meter, 0.1);
      }
      if (g.meter >= 1 && g.state !== 'combat') {
        g.meter = 1;
        this.engage(g, pv);
        out.detectedBy = out.detectedBy ?? g;
      }
      out.maxMeter = Math.max(out.maxMeter, g.meter);
      if (g.meter > I.suspicious && g.state !== 'search' && g.state !== 'combat') {
        if (g.state !== 'suspicious') g.timer = 2.5;
        g.state = 'suspicious';
      }
      // 쓰러진 동료 발견
      if (g.state !== 'combat') {
        for (const o of this.guards) {
          if (!o.down || g.bodySeen.has(o)) continue;
          const bx = o.pos.x - g.pos.x, bz = o.pos.z - g.pos.z;
          const bd = Math.hypot(bx, bz);
          if (bd > I.bodySightRange) continue;
          const ba = Math.acos(Math.max(-1, Math.min(1, (bx * gf.x + bz * gf.y) / Math.max(bd, 1e-3))));
          if (ba > half || !this.los(g.pos.x, g.pos.z, o.pos.x, o.pos.z, false)) continue;
          g.bodySeen.add(o);
          g.state = 'search';
          g.alarmed = true;
          g.path = this.path(new THREE.Vector2(g.pos.x, g.pos.z), new THREE.Vector2(o.pos.x + 0.6, o.pos.z));
          out.foundBody = out.foundBody ?? g;
        }
      }
      if (g.state === 'combat') {
        out.combat = true;
        const shot = this.combat(g, dt, player, d, tuning);
        if (shot) out.shots.push(shot);
      } else this.think(g, dt);
      g.sync(dt);
    }
    // 도착 표시 링 깜빡임
    const pulse = 0.55 + Math.sin(this.t * 4) * 0.3;
    (this.nestRing.material as THREE.MeshBasicMaterial).opacity = pulse;
    (this.exitRing.material as THREE.MeshBasicMaterial).opacity = pulse;
    return out;
  }

  /** 교전 시작 */
  engage(g: InteriorGuard, at: THREE.Vector2): void {
    if (g.down) return;
    if (g.state !== 'combat') {
      g.aimT = 0;
      g.fireT = 0.2;
    }
    g.state = 'combat';
    g.meter = 1;
    g.alarmed = true;
    g.lastKnown = at.clone();
    g.lostT = 0;
    g.path = [];
  }

  /** 건물 전체 경보: 모든 경비가 마지막 위치로 온다 */
  alarm(at: THREE.Vector2): void {
    for (const g of this.guards) if (!g.down) this.engage(g, at);
  }

  get anyCombat(): boolean {
    return this.guards.some((g) => !g.down && g.state === 'combat');
  }

  private combat(g: InteriorGuard, dt: number, player: PlayerSense, d: number, t: CombatTuning): GuardShot | null {
    g.fireT -= dt;
    if (g.seesPlayer) {
      g.lostT = 0;
      g.path = [];
      g.idle(dt);
      g.turnToward(player.hx, player.hz, 6, dt);
      g.aimT += dt;
      if (g.aimT >= t.reaction && g.fireT <= 0) {
        g.fireT = t.interval * (0.85 + Math.random() * 0.3);
        g.flashT = 0.06;
        // 명중 확률: 거리 · 자세 · 노출
        let p = t.hitBase * Math.max(0.3, Math.min(1.1, 1.25 - d / 18));
        if (player.crouched) p *= 0.8;
        if (player.moving) p *= 0.7;
        if (g.partial) p *= INTERIOR.partialExposure;
        const hit = Math.random() < p;
        return { guard: g, hit, damage: hit ? t.damage * (0.85 + Math.random() * 0.3) : 0 };
      }
      return null;
    }
    g.aimT = Math.max(0, g.aimT - dt * 2);
    // 안 보이면 마지막 위치로 이동
    const goal = g.lastKnown;
    if (!goal) return null;
    if (!g.path.length) {
      if (Math.hypot(goal.x - g.pos.x, goal.y - g.pos.z) > 0.6) g.path = this.path(new THREE.Vector2(g.pos.x, g.pos.z), goal);
    }
    const next = g.path[0];
    if (next) {
      if (g.walkTo(next.x, next.y, INTERIOR.guardCombatSpeed, dt)) g.path.shift();
    } else {
      g.idle(dt);
      g.yaw += Math.sin(this.t * 1.7) * dt * 2;
      g.lostT += dt;
      if (g.lostT > INTERIOR.combatLoseTime) {
        // 놓쳤다: 경계한 채로 둘러보다 복귀
        g.state = 'look';
        g.timer = INTERIOR.searchLookTime;
        g.meter = 0.3;
      }
    }
    return null;
  }

  /** 플레이어가 쏜 소리: 반경 안 경비가 반응(보이면 교전, 아니면 소리 난 곳 수색) */
  noise(at: THREE.Vector2, radius: number, playerVisibleTo: (g: InteriorGuard) => boolean): InteriorGuard[] {
    const reacted: InteriorGuard[] = [];
    for (const g of this.guards) {
      if (g.down || g.state === 'combat') continue;
      if (Math.hypot(g.pos.x - at.x, g.pos.z - at.y) > radius) continue;
      reacted.push(g);
      g.alarmed = true;
      if (playerVisibleTo(g)) this.engage(g, at);
      else {
        g.state = 'search';
        g.meter = Math.max(g.meter, 0.35);
        g.lookAt = at.clone();
        g.path = this.path(new THREE.Vector2(g.pos.x, g.pos.z), at);
      }
    }
    return reacted;
  }

  /** 경비가 지금 플레이어 머리를 볼 수 있는가(방향 무관) */
  canSee(g: InteriorGuard, hx: number, hz: number, low: boolean): boolean {
    return this.los(g.pos.x, g.pos.z, hx, hz, low);
  }

  /** 피해를 준다. 쓰러지면 true */
  damage(g: InteriorGuard, amount: number, from: THREE.Vector2): boolean {
    if (g.down) return false;
    g.hp -= amount;
    if (g.hp <= 0) {
      g.knockDown();
      return true;
    }
    this.engage(g, from);
    return false;
  }

  /**
   * 총탄 판정(즉시): 벽·바닥·천장·상자 또는 경비 몸.
   * 창문 구멍으로 나가면 null(건물 밖은 실내 화기로 맞히지 않는다).
   */
  ray(origin: THREE.Vector3, dir: THREE.Vector3, range: number): RayHit | null {
    const I = INTERIOR;
    // 경비 몸(머리 구 · 몸통/다리 원기둥)
    let best: RayHit | null = null;
    for (const g of this.guards) {
      if (g.down) continue;
      const head = new THREE.Vector3(g.pos.x, g.pos.y + 1.66, g.pos.z);
      const th = raySphere(origin, dir, head, 0.14);
      if (th !== null && th < range && (!best || th < best.dist)) best = { kind: 'guard', guard: g, zone: 'head', dist: th, point: origin.clone().addScaledVector(dir, th) };
      for (const [r, y0, y1, zone] of [[0.24, 0.85, 1.52, 'body'], [0.2, 0, 0.85, 'leg']] as const) {
        const tc = rayCylinder(origin, dir, g.pos.x, g.pos.z, r, g.pos.y + y0, g.pos.y + y1);
        if (tc !== null && tc < range && (!best || tc < best.dist)) best = { kind: 'guard', guard: g, zone, dist: tc, point: origin.clone().addScaledVector(dir, tc) };
      }
    }
    // 벽: 경비보다 먼저 막히는지 0.04m 간격으로 확인
    const maxT = best ? best.dist : range;
    const p = new THREE.Vector3();
    for (let t = 0.05; t < maxT; t += 0.04) {
      p.copy(origin).addScaledVector(dir, t);
      const y = p.y - this.floorY;
      const g = this.toGrid(p.x, p.z);
      const k = this.cell(g.c, g.r);
      if (k === 'void') return null;
      let block = y < 0 || y > I.wallHeight;
      if (!block) {
        if (k === 'wall' || k === 'tall') block = k === 'wall' || y < 1.9;
        else if (k === 'window') block = y < I.sill || y > I.lintel;
        else if (k === 'low') block = y < 0.86;
        else if (k === 'table') block = y < 0.78 && y > 0.7;
      }
      if (block) return { kind: 'wall', point: p.clone(), dist: t };
    }
    return best;
  }

  private think(g: InteriorGuard, dt: number): void {
    const I = INTERIOR;
    switch (g.state) {
      case 'patrol': {
        if (g.stationary) {
          g.state = 'pause';
          break;
        }
        const w = g.nextWaypoint();
        if (g.walkTo(w.x, w.y, I.guardWalk, dt)) {
          g.advanceRoute();
          g.state = 'pause';
          g.timer = g.pause;
        }
        break;
      }
      case 'pause': {
        g.idle(dt);
        if (g.stationary) {
          // 제자리 경비: 좌우로 천천히 둘러본다
          const want = g.baseYaw + Math.sin(this.t * 0.35 + g.route[0].x) * 0.4;
          let d = want - g.yaw;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          g.yaw += d * Math.min(1, dt * 2);
          break;
        }
        g.timer -= dt;
        if (g.timer <= 0) g.state = 'patrol';
        break;
      }
      case 'suspicious': {
        g.idle(dt);
        if (g.lookAt) g.turnToward(g.lookAt.x, g.lookAt.y, 2.6, dt);
        g.timer -= dt;
        if (g.timer <= 0 && g.meter <= 0.05) g.state = 'return';
        break;
      }
      case 'listen': {
        g.idle(dt);
        if (g.lookAt) g.turnToward(g.lookAt.x, g.lookAt.y, 2, dt);
        g.timer -= dt;
        if (g.timer <= 0) {
          g.state = g.searchAfterListen ? 'search' : 'return';
        }
        break;
      }
      case 'search': {
        const next = g.path[0];
        if (!next) {
          g.state = 'look';
          g.timer = I.searchLookTime;
          break;
        }
        if (g.walkTo(next.x, next.y, I.guardSearch, dt)) g.path.shift();
        break;
      }
      case 'look': {
        g.idle(dt);
        g.yaw += Math.sin(this.t * 1.3) * dt * 1.4;
        g.timer -= dt;
        if (g.timer <= 0) g.state = 'return';
        break;
      }
      case 'return': {
        if (!g.path.length) g.path = this.path(new THREE.Vector2(g.pos.x, g.pos.z), g.route[0]);
        const next = g.path[0];
        if (!next || g.walkTo(next.x, next.y, I.guardWalk, dt)) {
          g.path.shift();
          if (!g.path.length) {
            g.state = g.stationary ? 'pause' : 'patrol';
            g.timer = g.pause;
            g.alarmed = false;
          }
        }
        break;
      }
      case 'down':
        break;
    }
  }

  /** 현재 목표 지점 표시 링 */
  setObjective(which: 'nest' | 'exit' | null): void {
    this.nestRing.visible = which === 'nest';
    this.exitRing.visible = which === 'exit';
  }

  // ───────── 건물 모델 ─────────
  private buildMeshes(palette: { wall: number; floor: number; trim: number }, lights: boolean): void {
    const I = INTERIOR;
    const C = I.cell;
    const y0 = this.floorY;
    // 실내는 해가 직접 들지 않으므로 은은한 자체광으로 형광등 아래 밝기를 흉내 낸다(점광원이 없는 저사양에서도 보이게)
    const glow = (c: number, k: number) => new THREE.Color(c).multiplyScalar(k);
    const wallMat = this.track(new THREE.MeshLambertMaterial({ color: palette.wall, emissive: glow(palette.wall, lights ? 0.22 : 0.38), flatShading: true }));
    const trimMat = this.track(new THREE.MeshLambertMaterial({ color: palette.trim, emissive: glow(palette.trim, 0.25), flatShading: true }));
    const floorMat = this.track(new THREE.MeshLambertMaterial({ color: palette.floor, emissive: glow(palette.floor, lights ? 0.2 : 0.34), flatShading: true }));
    const crateMat = this.track(new THREE.MeshLambertMaterial({ color: 0x7a5e40, emissive: glow(0x7a5e40, 0.25), flatShading: true }));
    const shelfMat = this.track(new THREE.MeshLambertMaterial({ color: 0x4a5054, emissive: glow(0x4a5054, 0.25), flatShading: true }));
    const boxMat = this.track(new THREE.MeshLambertMaterial({ color: 0x9a8058, emissive: glow(0x9a8058, 0.25), flatShading: true }));

    const wallCells: GridPos[] = [];
    const windowCells: GridPos[] = [];
    const lows: GridPos[] = [];
    const tables: GridPos[] = [];
    const talls: GridPos[] = [];
    const floors: GridPos[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const k = this.cells[r][c];
        if (k === 'wall') wallCells.push({ c, r });
        else if (k === 'window') windowCells.push({ c, r });
        else if (k === 'low') lows.push({ c, r });
        else if (k === 'table') tables.push({ c, r });
        else if (k === 'tall') talls.push({ c, r });
        if (k !== 'void') floors.push({ c, r });
      }
    }
    const m = new THREE.Matrix4();
    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, list: GridPos[], y: number, jitter = 0) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(this.track(geo), mat, list.length);
      list.forEach((p, i) => {
        const w = this.toWorld(p);
        m.makeRotationY(jitter ? Math.sin(p.c * 3.1 + p.r * 1.7) * jitter : 0);
        m.setPosition(w.x, y, w.y);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
    };
    inst(new THREE.BoxGeometry(C, I.wallHeight, C), wallMat, wallCells, y0 + I.wallHeight / 2);
    // 창문: 아래(창턱)·위(인방)만
    inst(new THREE.BoxGeometry(C, I.sill, C), wallMat, windowCells, y0 + I.sill / 2);
    inst(new THREE.BoxGeometry(C, I.wallHeight - I.lintel, C), wallMat, windowCells, y0 + (I.lintel + I.wallHeight) / 2);
    inst(new THREE.BoxGeometry(C * 1.02, 0.06, C * 0.4), trimMat, windowCells, y0 + I.sill + 0.03);
    // 바닥 몰딩(벽 아래 띠) – 공간감
    inst(new THREE.BoxGeometry(C + 0.02, 0.12, C + 0.02), trimMat, wallCells, y0 + 0.06);
    // 바닥·천장
    inst(new THREE.BoxGeometry(C, 0.2, C), floorMat, floors, y0 - 0.1);
    inst(new THREE.BoxGeometry(C, 0.2, C), wallMat, floors, y0 + I.wallHeight + 0.1);
    // 소품
    inst(new THREE.BoxGeometry(0.86, 0.86, 0.86), crateMat, lows, y0 + 0.43, 0.25);
    const tableTop = new THREE.BoxGeometry(0.95, 0.06, 0.95);
    tableTop.translate(0, 0.74, 0);
    const legGeo = new THREE.BoxGeometry(0.06, 0.72, 0.06);
    const legs = [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].map(([x, z]) => legGeo.clone().translate(x, 0.36, z));
    inst(mergeBoxes([tableTop, ...legs]), crateMat, tables, y0);
    legGeo.dispose();
    const shelf = new THREE.BoxGeometry(0.9, 1.9, 0.6);
    shelf.translate(0, 0.95, 0);
    inst(shelf, shelfMat, talls, y0, 0);
    const boxes = mergeBoxes([0.35, 0.95, 1.55].map((y, i) => new THREE.BoxGeometry(0.5 - i * 0.06, 0.32, 0.4).translate((i - 1) * 0.08, y, 0)));
    inst(boxes, boxMat, talls, y0, 0);

    // 천장 조명(빛나는 판) + 따뜻한 점광원 몇 개
    const lampGeo = this.track(new THREE.BoxGeometry(0.7, 0.04, 0.25));
    const lampMat = this.track(new THREE.MeshBasicMaterial({ color: 0xffe2a8 }));
    const lampSpots = floors.filter((p) => this.cells[p.r][p.c] === 'floor' && p.c % 4 === 2 && p.r % 4 === 2);
    for (const p of lampSpots) {
      const w = this.toWorld(p);
      const l = new THREE.Mesh(lampGeo, lampMat);
      l.position.set(w.x, y0 + I.wallHeight - 0.03, w.y);
      this.group.add(l);
    }
    if (lights) {
      const picks = lampSpots.filter((_, i) => i % 3 === 0).slice(0, 3);
      for (const p of picks) {
        const w = this.toWorld(p);
        const pl = new THREE.PointLight(0xffd59a, 6, 9, 2);
        pl.position.set(w.x, y0 + I.wallHeight - 0.4, w.y);
        this.group.add(pl);
      }
    }
    // 탈출구 표시등
    const sign = this.exitSign();
    const e = this.toWorld(this.exit);
    sign.position.set(e.x, y0 + 2.45, e.y);
    // 탈출 칸에 붙은 벽 쪽을 바라보게: 바깥(건물 밖) 반대 방향
    const outward = this.outwardDir(this.exit);
    sign.position.x -= outward.x * 0.45;
    sign.position.z -= outward.y * 0.45;
    sign.rotation.y = Math.atan2(-outward.x, -outward.y);
    this.group.add(sign);
  }

  /** 테두리 칸에서 건물 밖을 향하는 방향 */
  private outwardDir(p: GridPos): THREE.Vector2 {
    for (const [dc, dr] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      if (this.cell(p.c + dc, p.r + dr) === 'void') return new THREE.Vector2(dc, dr);
    }
    return new THREE.Vector2(0, 1);
  }

  private exitSign(): THREE.Mesh {
    if (typeof document === 'undefined') return new THREE.Mesh(this.track(new THREE.PlaneGeometry(0.6, 0.22)), this.track(new THREE.MeshBasicMaterial({ color: 0x0e7a34 })));
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 48;
    const ctx = cv.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0e7a34';
      ctx.fillRect(0, 0, 128, 48);
      ctx.fillStyle = '#eaffef';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EXIT', 64, 26);
    }
    const tex = this.track(new THREE.CanvasTexture(cv));
    const mat = this.track(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    return new THREE.Mesh(this.track(new THREE.PlaneGeometry(0.6, 0.22)), mat);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}

function charToCell(ch: string): Cell {
  switch (ch) {
    case '#':
      return 'wall';
    case 'w':
      return 'window';
    case 'B':
      return 'tall';
    case 'c':
      return 'low';
    case 'T':
      return 'table';
    case ' ':
      return 'void';
    default:
      return 'floor';
  }
}

/** 여러 박스 지오메트리를 하나로(인스턴싱용) */
function mergeBoxes(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  for (const g of geos) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...(ng.getAttribute('position').array as Float32Array));
    nor.push(...(ng.getAttribute('normal').array as Float32Array));
    if (ng !== g) ng.dispose();
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

/** 건물이 차지하는 월드 XZ 범위(지형 평탄화용) – 메시를 만들기 전에 필요 */
export function interiorBounds(spec: InteriorSpec): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const rows = spec.layout;
  const cols = Math.max(...rows.map((l) => l.length));
  let nc = 0, nr = 0;
  rows.forEach((l, r) => {
    const c = l.indexOf('N');
    if (c >= 0) {
      nc = c;
      nr = r;
    }
  });
  const C = INTERIOR.cell;
  return { minX: (-nc - 0.5) * C, maxX: (cols - 1 - nc + 0.5) * C, minZ: (-nr - 0.5) * C, maxZ: (rows.length - 1 - nr + 0.5) * C };
}

/** 배치도 검증(테스트용): 시작→저격 위치→탈출이 이어지고, 경비 경로가 벽을 지나지 않는지 */
export function validateLayout(spec: InteriorSpec): string[] {
  const errors: string[] = [];
  const rows = spec.layout;
  const find = (ch: string) => {
    for (let r = 0; r < rows.length; r++) {
      const c = rows[r].indexOf(ch);
      if (c >= 0) return { c, r };
    }
    return null;
  };
  const n = find('N'), s = find('S'), e = find('E');
  if (!n || !s || !e) return ['N/S/E 누락'];
  if (rows[n.r - 1]?.[n.c] !== 'w') errors.push('N 바로 위(표적 쪽)가 창문(w)이 아님');
  const walk = (ch: string | undefined) => ch !== undefined && '.NSE'.includes(ch);
  const reach = (a: GridPos, b: GridPos) => {
    const seen = new Set<string>([`${a.c},${a.r}`]);
    const q = [a];
    while (q.length) {
      const p = q.shift()!;
      if (p.c === b.c && p.r === b.r) return true;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = p.c + dc, r = p.r + dr;
        if (!walk(rows[r]?.[c]) || seen.has(`${c},${r}`)) continue;
        seen.add(`${c},${r}`);
        q.push({ c, r });
      }
    }
    return false;
  };
  if (!reach(s, n)) errors.push('시작 → 저격 위치 길 없음');
  if (!reach(n, e)) errors.push('저격 위치 → 탈출 길 없음');
  spec.guards.forEach((g, gi) => {
    const pts = g.path;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      if (!walk(rows[a[1]]?.[a[0]])) errors.push(`경비 ${gi} 경유점 ${i}가 바닥이 아님`);
      if (pts.length < 2) continue;
      const b = pts[(i + 1) % pts.length];
      if (a[0] !== b[0] && a[1] !== b[1]) errors.push(`경비 ${gi} 경로 ${i}: 가로/세로 직선만 허용`);
      const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      for (let k = 0; k <= steps; k++) {
        const c = a[0] + Math.sign(b[0] - a[0]) * k;
        const r = a[1] + Math.sign(b[1] - a[1]) * k;
        if (!walk(rows[r]?.[c])) errors.push(`경비 ${gi} 경로 ${i}가 (${c},${r}) 벽을 지남`);
      }
    }
  });
  return errors;
}

function raySphere(o: THREE.Vector3, d: THREE.Vector3, c: THREE.Vector3, r: number): number | null {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : null;
}

/** 세로 원기둥(XZ 중심, 반지름, 높이 범위)과 광선 */
function rayCylinder(o: THREE.Vector3, d: THREE.Vector3, cx: number, cz: number, r: number, y0: number, y1: number): number | null {
  const ox = o.x - cx, oz = o.z - cz;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-9) return null;
  const b = ox * d.x + oz * d.z;
  const c = ox * ox + oz * oz - r * r;
  const disc = b * b - a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / a;
  if (t <= 0) return null;
  const y = o.y + d.y * t;
  return y >= y0 && y <= y1 ? t : null;
}
