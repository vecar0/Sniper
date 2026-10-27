// 북천 기지 광장: 충돌 상자(map.js)를 재질별로 병합한 메시 + 실제 기지 구조물(옹벽·차량 터널·화물 승강장·관제동·발전기 플랫폼·
// 레이돔 탑·컨테이너·콘크리트 블록·연료 탱크·발전기·투광등). 위를 향한 면에는 눈이 쌓인다(snowMaterial).
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/addons/utils/BufferGeometryUtils.js';
import { BOXES, ROOF, LAMPS, SPAWNS } from '../config/map.js';
import { loadSurface, snowMaterial } from './materials.js';

// 월드 좌표 기준 UV를 가진 상자(타일 밀도 일정)
export function boxGeo(x0, y0, z0, x1, y1, z1, tile = 3, opts = {}) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    if (ny > 0.5) uv.setXY(i, x / tile, z / tile);
    else if (nx > 0.5) uv.setXY(i, z / tile, y / (opts.vtile || tile));
    else uv.setXY(i, x / tile, y / (opts.vtile || tile));
  }
  return g;
}
const cyl = (rt, rb, h, x, y, z, seg = 16, open = false) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open); g.translate(x, y, z); return g; };
// 원통 UV를 월드 크기에 맞춤
function scaleUV(g, su, sv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; }
// 두 점 사이 파이프
function pipe(a, b, r, seg = 8) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
  g.translate(A.x, A.y, A.z);
  return g;
}

class Batch {
  constructor() { this.map = new Map(); }
  add(mat, geo) { if (!this.map.has(mat)) this.map.set(mat, []); this.map.get(mat).push(geo); }
  build(parent, { shadow = true } = {}) {
    for (const [mat, list] of this.map) {
      const norm = list.map((g) => (g.index ? g.toNonIndexed() : g));
      for (const g of norm) {
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      }
      const merged = mergeGeometries(norm, false);
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = shadow && !mat.transparent && !mat.userData.noShadow;
      m.receiveShadow = !mat.userData.noReceive;
      m.matrixAutoUpdate = false;
      parent.add(m);
    }
  }
}

export class Level {
  constructor(scene, envTime, quality) {
    this.scene = scene;
    this.time = envTime;
    this.quality = quality;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.mats = this.makeMaterials();
    this.batch = new Batch();
    this.glowBatch = new Batch();
    this.lights = [];
    this.buildFloor();
    for (const b of BOXES) this.addBox(b);
    this.buildWallTops();
    this.buildRailings();
    this.buildDetails();
    this.batch.build(this.root);
    this.glowBatch.build(this.root, { shadow: false });
    this.buildRadome();
    this.buildFloodlights();
    this.buildLiftDoors();
    this.buildLights();
  }

  makeMaterials() {
    const snow = loadSurface('snow', 160);
    const wall = loadSurface('wall', 200), ground = loadSurface('ground', 190), steel = loadSurface('steel', 140);
    const S = (set, params, opts) => snowMaterial({ ...set, ...params }, { snow, ...opts });
    const m = {
      floor: S(ground, { roughness: 1, metalness: 0, envMapIntensity: 0.6, normalScale: new THREE.Vector2(0.7, 0.7), color: 0xc4c9d0 }, { amount: 0.3, drift: 1 }),
      concrete: S(wall, { roughness: 1, metalness: 0, envMapIntensity: 0.5, color: 0xd4d8dc }, { amount: 0.9 }),
      concreteDark: S(wall, { roughness: 1, metalness: 0, envMapIntensity: 0.5, color: 0x8e949b }, { amount: 0.9 }),
      olive: S(steel, { roughness: 0.7, metalness: 0.1, envMapIntensity: 0.8, color: 0xb4c09a }, { amount: 0.85 }),
      steelGrey: S(steel, { roughness: 0.65, metalness: 0.1, envMapIntensity: 0.8, color: 0xd6dce2 }, { amount: 0.85 }),
      steelDark: S(steel, { roughness: 0.6, metalness: 0.3, envMapIntensity: 0.9, color: 0x8c939b }, { amount: 0.6 }),
      galv: new THREE.MeshStandardMaterial({ color: 0x8a9198, roughness: 0.42, metalness: 1, envMapIntensity: 1.1 }),
      black: new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.6, metalness: 0.5, envMapIntensity: 0.8 }),
      void: new THREE.MeshBasicMaterial({ color: 0x030405 }),
      white: new THREE.MeshStandardMaterial({ color: 0xdfe4ea, roughness: 0.55, metalness: 0, envMapIntensity: 0.9, flatShading: true }),
      tank: S({}, { color: 0xd4d8dc, roughness: 0.5, metalness: 0.3, envMapIntensity: 1.0 }, { amount: 0.9 }),
      hazard: new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.7, metalness: 0.2 }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x1a1b1d, roughness: 0.9, metalness: 0 }),
      lamp: glowMat(new THREE.Color(1.0, 0.62, 0.3), 5.0),
      lampWarm: glowMat(new THREE.Color(1.0, 0.7, 0.4), 2.2),
      window: glowMat(new THREE.Color(1.0, 0.72, 0.42), 1.25),
      ledGreen: glowMat(new THREE.Color(0.3, 1.0, 0.4), 2.2),
      red: glowMat(new THREE.Color(1.0, 0.08, 0.05), 3.0),
      paint: new THREE.MeshStandardMaterial({ color: 0xc9a23a, roughness: 0.7, metalness: 0, transparent: true, opacity: 0.5, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }),
    };
    m.paint.userData.noShadow = true;
    return m;
  }

  buildFloor() {
    const m = this.mats;
    this.batch.add(m.floor, boxGeo(-ROOF, -0.6, -ROOF, ROOF, 0, ROOF, 4));
    // 바닥 도색(바랜 노란 차선): 터널 → 중앙, 승강장 → 중앙
    for (const [x0, z0, x1, z1] of [[-21.5, -2.15, -6.5, -1.85], [-0.15, -21.5, 0.15, -6.5]]) {
      const len = Math.max(x1 - x0, z1 - z0), alongX = x1 - x0 > z1 - z0;
      for (let k = 0; k < len; k += 2.4) {
        const g = new THREE.PlaneGeometry(alongX ? 1.4 : x1 - x0, alongX ? z1 - z0 : 1.4); g.rotateX(-Math.PI / 2);
        g.translate(alongX ? x0 + k + 0.7 : (x0 + x1) / 2, 0.006, alongX ? (z0 + z1) / 2 : z0 + k + 0.7);
        this.batch.add(m.paint, g);
      }
    }
  }

  addBox(b) {
    const m = this.mats, B = this.batch, G = this.glowBatch;
    const { x0, z0, x1, z1, y0, y1 } = b;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    switch (b.kind) {
      case 'wall': {
        // 옹벽: 안쪽 면 = 충돌면, 바깥으로 1.2m 두께. 6m마다 신축 줄눈
        const alongX = x1 - x0 > z1 - z0;
        const out = alongX ? Math.sign(cz) : Math.sign(cx);
        const ax0 = alongX ? x0 - 1.2 : Math.min(x0, x0 + out * 1.2), ax1 = alongX ? x1 + 1.2 : Math.max(x1, x1 + out * 1.2);
        const az0 = alongX ? Math.min(z0, z0 + out * 1.2) : z0 - 1.2, az1 = alongX ? Math.max(z1, z1 + out * 1.2) : z1 + 1.2;
        B.add(m.concrete, boxGeo(ax0, 0, az0, ax1, y1, az1, 3));
        // 줄눈(어두운 가는 홈) + 아래쪽 물때(조금 어두운 띠)
        const inner = alongX ? (out > 0 ? z0 : z1) : (out > 0 ? x0 : x1);
        for (let k = -27; k <= 27; k += 6) {
          if (alongX) B.add(m.black, boxGeo(k - 0.03, 0, inner - out * 0.012 - 0.01, k + 0.03, y1, inner - out * 0.012 + 0.01, 1));
          else B.add(m.black, boxGeo(inner - out * 0.012 - 0.01, 0, k - 0.03, inner - out * 0.012 + 0.01, y1, k + 0.03, 1));
        }
        // 벽 위 갓돌(살짝 튀어나옴)
        B.add(m.concreteDark, boxGeo(ax0 - (alongX ? 0 : 0.12), y1, az0 - (alongX ? 0.12 : 0), ax1 + (alongX ? 0 : 0.12), y1 + 0.18, az1 + (alongX ? 0.12 : 0), 2));
        break;
      }
      case 'tunnel': this.buildTunnel(b); break;
      case 'lift': this.buildLift(b); break;
      case 'bunker': this.buildBunker(b); break;
      case 'deck':
        B.add(m.concreteDark, boxGeo(x0, y0, z0, x1, y1 - 0.25, z1, 3));
        B.add(m.steelDark, boxGeo(x0 - 0.08, y1 - 0.25, z0 - 0.08, x1 + 0.08, y1, z1 + 0.08, 2));
        // 갑판 위 미끄럼 방지 줄(바닥판 이음)
        for (let z = z0 + 1.5; z < z1; z += 1.5) B.add(m.black, boxGeo(x0, y1, z - 0.02, x1, y1 + 0.006, z + 0.02, 1));
        break;
      case 'step':
        B.add(m.concreteDark, boxGeo(x0, y0, z0, x1, y1 - 0.05, z1, 2));
        B.add(m.galv, boxGeo(x0, y1 - 0.05, z0, x1, y1, z1, 1));
        break;
      case 'equip': // 옥상 통신 장비함
        B.add(m.steelGrey, boxGeo(x0 + 0.1, y0, z0 + 0.1, x1 - 0.1, y1 - 0.3, z1 - 0.1, 1.5));
        for (let i = 0; i < 5; i++) B.add(m.black, boxGeo(x0 + 0.4 + i * 0.45, y0 + 0.6, z1 - 0.1, x0 + 0.65 + i * 0.45, y1 - 0.8, z1 - 0.08, 1));
        B.add(m.steelDark, boxGeo(x0, y1 - 0.3, z0, x1, y1, z1, 1.5));
        G.add(m.ledGreen, boxGeo(x1 - 0.5, y1 - 0.7, z1 - 0.09, x1 - 0.4, y1 - 0.65, z1 - 0.07, 1));
        break;
      case 'core': break;                   // 레이돔 탑은 따로
      case 'rail': break;                   // 난간은 buildRailings
      case 'ring': this.jersey(x0, z0, x1, z1, y1); break;
      case 'pedestal':
        B.add(m.concreteDark, cyl(0.42, 0.48, y1, cx, y1 / 2, cz, 16));
        B.add(m.hazard, cyl(0.485, 0.485, 0.18, cx, y1 - 0.25, cz, 16, true));
        break;
      case 'terminal': // 전기 분전함
        B.add(m.steelGrey, boxGeo(x0, y0, z0, x1, y1, z1, 1));
        B.add(m.steelGrey, boxGeo(x0 + 0.08, y0 + 0.2, z1, x1 - 0.08, y1 - 0.2, z1 + 0.015, 1));
        B.add(m.black, boxGeo(x0 + (x1 - x0) / 2 - 0.01, y0 + 0.2, z1 + 0.015, x0 + (x1 - x0) / 2 + 0.01, y1 - 0.2, z1 + 0.02, 1));
        B.add(m.galv, boxGeo(x1 - 0.2, y0 + 0.9, z1 + 0.015, x1 - 0.15, y0 + 1.15, z1 + 0.05, 1));
        B.add(m.steelGrey, boxGeo(x0 - 0.05, y1, z0 - 0.05, x1 + 0.05, y1 + 0.06, z1 + 0.05, 1));
        G.add(m.ledGreen, boxGeo(x1 - 0.25, y1 - 0.35, z1 + 0.015, x1 - 0.17, y1 - 0.29, z1 + 0.025, 1));
        G.add(m.red, boxGeo(x1 - 0.4, y1 - 0.35, z1 + 0.015, x1 - 0.32, y1 - 0.29, z1 + 0.025, 1));
        break;
      case 'block': {
        // 컨테이너(길쭉한 것 중 일부) 또는 프리캐스트 콘크리트 블록 2단
        const container = Math.abs(Math.round(x0 * 3 + z0)) % 2 === 0;
        if (container) this.container(b, Math.abs(Math.round(z0)) % 3 === 0 ? m.olive : m.steelGrey);
        else {
          const h = (y1 - y0) / 2, alongX = x1 - x0 > z1 - z0, L = alongX ? x1 - x0 : z1 - z0, n = Math.max(1, Math.round(L / 1.6));
          for (let r = 0; r < 2; r++) for (let i = 0; i < n - r; i++) {
            const a = (alongX ? x0 : z0) + (L / n) * (i + r * 0.5), c = a + L / n - 0.04;
            const g = alongX ? boxGeo(a, r * h, z0 + r * 0.1, c, (r + 1) * h - 0.02, z1 - r * 0.1, 2) : boxGeo(x0 + r * 0.1, r * h, a, x1 - r * 0.1, (r + 1) * h - 0.02, c, 2);
            B.add(m.concrete, g);
          }
        }
        break;
      }
      case 'barrier': this.jersey(x0, z0, x1, z1, y1, true); break;
      case 'tank': {
        const r = (x1 - x0) / 2 + 0.25;
        B.add(m.tank, scaleUV(cyl(r, r, y1 - 0.6, cx, (y1 - 0.6) / 2 + 0.6, cz, 32), 4, 1));
        B.add(m.tank, cyl(r * 0.92, r, 0.35, cx, y1 + 0.17, cz, 32));
        for (const y of [1.4, 2.6, 3.6]) B.add(m.galv, cyl(r + 0.03, r + 0.03, 0.06, cx, y, cz, 32, true));
        for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.add(m.black, boxGeo(cx + lx * r * 0.7 - 0.1, 0, cz + lz * r * 0.7 - 0.1, cx + lx * r * 0.7 + 0.1, 0.6, cz + lz * r * 0.7 + 0.1, 1));
        // 사다리
        for (const s of [-0.22, 0.22]) B.add(m.galv, pipe([cx - r - 0.12, 0, cz + s], [cx - r - 0.12, y1 + 0.3, cz + s], 0.025, 6));
        for (let y = 0.4; y < y1; y += 0.35) B.add(m.galv, pipe([cx - r - 0.12, y, cz - 0.22], [cx - r - 0.12, y, cz + 0.22], 0.018, 5));
        break;
      }
      case 'generator': {
        // 디젤 발전기 함체 + 배기통 + 통풍 루버
        B.add(m.olive, boxGeo(x0, y0, z0, x1, y1, z1, 1.5));
        for (let i = 0; i < 6; i++) B.add(m.black, boxGeo(x1, 0.35 + i * 0.2, z0 + 0.4, x1 + 0.04, 0.42 + i * 0.2, z1 - 0.4, 1));
        B.add(m.black, cyl(0.12, 0.12, 1.2, cx - 0.6, y1 + 0.6, cz + 0.8, 10));
        B.add(m.steelDark, boxGeo(x0 - 0.05, y1, z0 - 0.05, x1 + 0.05, y1 + 0.08, z1 + 0.05, 1));
        G.add(m.ledGreen, boxGeo(x1 + 0.01, 1.4, cz - 0.05, x1 + 0.03, 1.46, cz + 0.05, 1));
        break;
      }
      case 'pole': break;                  // 투광등은 buildFloodlights
      case 'crate': // 군용 하드케이스(올리브) + 걸쇠
        B.add(m.olive, boxGeo(x0 + 0.02, y0, z0 + 0.02, x1 - 0.02, y1 - 0.02, z1 - 0.02, 1.2));
        B.add(m.black, boxGeo(x0, y1 - 0.35, z0, x1, y1 - 0.3, z1, 1));
        for (const s of [0.3, 0.7]) B.add(m.galv, boxGeo(x0 + (x1 - x0) * s - 0.05, y1 - 0.42, z1 - 0.02, x0 + (x1 - x0) * s + 0.05, y1 - 0.24, z1 + 0.01, 1));
        break;
      default:
        B.add(m.concrete, boxGeo(x0, y0, z0, x1, y1, z1, 2));
    }
  }

  // 저지 방벽(아래가 넓은 콘크리트 방호벽), 길이 방향으로 2m씩 끊어 놓는다
  jersey(x0, z0, x1, z1, h, wide = false) {
    const alongX = x1 - x0 > z1 - z0, L = alongX ? x1 - x0 : z1 - z0, W = alongX ? z1 - z0 : x1 - x0;
    const base = Math.max(W, wide ? W : 0.6) / 2, top = Math.min(0.12, base * 0.5);
    const prof = new THREE.Shape([new THREE.Vector2(-base, 0), new THREE.Vector2(base, 0), new THREE.Vector2(base, h * 0.12), new THREE.Vector2(base * 0.55, h * 0.3), new THREE.Vector2(top, h), new THREE.Vector2(-top, h), new THREE.Vector2(-base * 0.55, h * 0.3), new THREE.Vector2(-base, h * 0.12)]);
    const n = Math.max(1, Math.round(L / 2));
    for (let i = 0; i < n; i++) {
      const a = (alongX ? x0 : z0) + (L / n) * i + 0.03, seg = L / n - 0.06;
      const g = new THREE.ExtrudeGeometry(prof, { depth: seg, bevelEnabled: false });
      // 윤곽(x, y)을 길이 방향(z)으로 뽑은 뒤 놓기
      if (alongX) { g.rotateY(Math.PI / 2); g.translate(a, 0, (z0 + z1) / 2); } else g.translate((x0 + x1) / 2, 0, a);
      const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 0.5, uv.getY(k) * 0.5);
      this.batch.add(this.mats.concrete, g);
    }
  }

  container(b, mat) {
    const B = this.batch, m = this.mats;
    const { x0, z0, x1, z1, y0, y1 } = b;
    const alongX = x1 - x0 > z1 - z0;
    B.add(mat, boxGeo(x0 + 0.05, y0, z0 + 0.05, x1 - 0.05, y1, z1 - 0.05, 2.6));
    // 골판(세로 골): 긴 면에 0.3m 간격
    const L = alongX ? x1 - x0 : z1 - z0;
    for (let k = 0.25; k < L - 0.2; k += 0.3) {
      if (alongX) { B.add(mat, boxGeo(x0 + k, y0 + 0.15, z0, x0 + k + 0.12, y1 - 0.15, z0 + 0.06, 1)); B.add(mat, boxGeo(x0 + k, y0 + 0.15, z1 - 0.06, x0 + k + 0.12, y1 - 0.15, z1, 1)); }
      else { B.add(mat, boxGeo(x0, y0 + 0.15, z0 + k, x0 + 0.06, y1 - 0.15, z0 + k + 0.12, 1)); B.add(mat, boxGeo(x1 - 0.06, y0 + 0.15, z0 + k, x1, y1 - 0.15, z0 + k + 0.12, 1)); }
    }
    // 모서리 기둥 · 위아래 테
    const f = 0.14;
    for (const [ax, az] of [[x0, z0], [x1 - f, z0], [x0, z1 - f], [x1 - f, z1 - f]]) B.add(m.steelDark, boxGeo(ax, y0, az, ax + f, y1 + 0.02, az + f, 1));
    B.add(m.steelDark, boxGeo(x0, y1 - 0.1, z0, x1, y1 + 0.02, z1, 1));
    // 끝면 문짝 손잡이 막대
    const endX = alongX ? x1 : null;
    if (endX != null) for (const s of [0.3, 0.45, 0.55, 0.7]) B.add(m.galv, pipe([x1 + 0.03, 0.3, z0 + (z1 - z0) * s], [x1 + 0.03, y1 - 0.2, z0 + (z1 - z0) * s], 0.025, 6));
  }

  // 서쪽 차량 터널 출입동: 콘크리트 덩어리 + 동쪽 면 개구부(어두운 터널 안) + 강철 문틀 · 경고 띠 · 나트륨등
  buildTunnel(b) {
    const m = this.mats, B = this.batch, G = this.glowBatch;
    const { x0, z0, x1, z1, y1 } = b;
    const oz0 = SPAWNS.stairs.z - 2.2, oz1 = SPAWNS.stairs.z + 2.2, oh = 4.6;
    B.add(m.concrete, boxGeo(x0 - 1.2, 0, z0, x1, y1, oz0, 3));
    B.add(m.concrete, boxGeo(x0 - 1.2, 0, oz1, x1, y1, z1, 3));
    B.add(m.concrete, boxGeo(x0 - 1.2, oh, oz0, x1, y1, oz1, 3));
    B.add(m.void, boxGeo(x0, 0.01, oz0, x1 - 0.4, oh, oz1, 1));
    // 문틀 + 경고 띠
    B.add(m.steelDark, boxGeo(x1 - 0.1, 0, oz0 - 0.25, x1 + 0.08, oh + 0.25, oz0, 1));
    B.add(m.steelDark, boxGeo(x1 - 0.1, 0, oz1, x1 + 0.08, oh + 0.25, oz1 + 0.25, 1));
    B.add(m.steelDark, boxGeo(x1 - 0.1, oh, oz0, x1 + 0.08, oh + 0.25, oz1, 1));
    B.add(m.hazard, boxGeo(x1 + 0.08, 0, oz0 - 0.24, x1 + 0.09, 1.2, oz0 - 0.01, 0.6));
    B.add(m.hazard, boxGeo(x1 + 0.08, 0, oz1 + 0.01, x1 + 0.09, 1.2, oz1 + 0.24, 0.6));
    // 반쯤 올라간 방폭문(셔터) 아랫단
    B.add(m.steelGrey, boxGeo(x1 - 0.35, oh - 0.9, oz0, x1 - 0.2, oh, oz1, 1));
    for (let y = oh - 0.85; y < oh; y += 0.15) B.add(m.black, boxGeo(x1 - 0.2, y, oz0, x1 - 0.19, y + 0.02, oz1, 1));
    // 위 투광등 2개 + 지붕 위 환풍기
    for (const z of [oz0 + 0.6, oz1 - 0.6]) { B.add(m.black, boxGeo(x1, oh + 0.6, z - 0.25, x1 + 0.35, oh + 0.85, z + 0.25, 1)); G.add(m.lampWarm, boxGeo(x1 + 0.35, oh + 0.62, z - 0.2, x1 + 0.36, oh + 0.82, z + 0.2, 1)); }
    B.add(m.steelGrey, boxGeo(x0 + 1, y1, z0 + 2, x0 + 3, y1 + 1.2, z0 + 4, 1));
  }

  // 북쪽 화물 승강장: 높은 콘크리트 승강로 + 강철 문(열림 애니메이션) + 기계실 + 회전 경광등
  buildLift(b) {
    const m = this.mats, B = this.batch;
    const { x0, z0, x1, z1, y1 } = b;
    B.add(m.concrete, boxGeo(x0, 0, z0 - 1.2, x1, y1, z1, 3));
    B.add(m.void, boxGeo(-1.6, 0.01, z1 - 0.6, 1.6, 3.4, z1 + 0.01, 1));
    B.add(m.steelDark, boxGeo(-1.85, 0, z1, -1.6, 3.65, z1 + 0.12, 1));
    B.add(m.steelDark, boxGeo(1.6, 0, z1, 1.85, 3.65, z1 + 0.12, 1));
    B.add(m.steelDark, boxGeo(-1.85, 3.4, z1, 1.85, 3.65, z1 + 0.12, 1));
    B.add(m.hazard, boxGeo(-1.6, 0, z1 + 0.12, 1.6, 0.06, z1 + 0.5, 0.6));
    B.add(m.steelGrey, boxGeo(x0 + 0.8, y1, z0 + 0.5, x1 - 0.8, y1 + 2, z1 - 1.5, 2));
    B.add(m.black, boxGeo(x0 + 1.5, y1 + 0.6, z1 - 1.51, x0 + 2.5, y1 + 1.6, z1 - 1.49, 1));
  }

  // 관제동: 콘크리트 건물(지붕 4m) + 따뜻한 창 + 철문 + 지붕 테
  buildBunker(b) {
    const m = this.mats, B = this.batch, G = this.glowBatch;
    const { x0, z0, x1, z1, y1 } = b;
    B.add(m.concreteDark, boxGeo(x0, 0, z0, x1, y1, z1, 3));
    B.add(m.concrete, boxGeo(x0 - 0.1, y1 - 0.25, z0 - 0.1, x1 + 0.1, y1, z1 + 0.1, 3));
    // 남쪽 창(z1 면), 동쪽 창(x1 면, 계단 쪽은 빼고)
    for (const x of [x0 + 2, x0 + 5, x0 + 8]) { G.add(m.window, boxGeo(x - 0.7, 1.5, z1 + 0.01, x + 0.7, 2.4, z1 + 0.02, 1)); B.add(m.black, boxGeo(x - 0.8, 1.4, z1, x + 0.8, 2.5, z1 + 0.01, 1)); }
    for (const z of [z0 + 4.5, z0 + 7.5]) { G.add(m.window, boxGeo(x1 + 0.01, 1.5, z - 0.7, x1 + 0.02, 2.4, z + 0.7, 1)); B.add(m.black, boxGeo(x1, 1.4, z - 0.8, x1 + 0.01, 2.5, z + 0.8, 1)); }
    // 철문 + 문 위 등
    B.add(m.steelGrey, boxGeo(x1 + 0.005, 0, z1 - 2.2, x1 + 0.05, 2.2, z1 - 1.2, 1));
    G.add(m.lampWarm, boxGeo(x1 + 0.05, 2.45, z1 - 1.85, x1 + 0.2, 2.55, z1 - 1.55, 1));
    // 지붕 안테나 마스트
    B.add(m.galv, pipe([x0 + 1, y1, z0 + 1.2], [x0 + 1, y1 + 6, z0 + 1.2], 0.05, 6));
    for (const y of [y1 + 4, y1 + 5.4]) B.add(m.galv, pipe([x0 + 0.4, y, z0 + 1.2], [x0 + 1.6, y, z0 + 1.2], 0.02, 5));
  }

  // 옹벽 위: 철망 기둥 + 위아래 파이프 (안쪽 가장자리)
  buildWallTops() {
    const m = this.mats, R = ROOF + 0.4, y = 7.18;
    const line = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 3);
      for (const h of [0.5, 1.2]) this.batch.add(m.galv, pipe([ax, y + h, az], [bx, y + h, bz], 0.025, 6));
      for (let i = 0; i <= n; i++) { const t = i / n; this.batch.add(m.galv, pipe([ax + (bx - ax) * t, y, az + (bz - az) * t], [ax + (bx - ax) * t, y + 1.3, az + (bz - az) * t], 0.035, 6)); }
    };
    line(-R, -R, R, -R); line(R, -R, R, R); line(R, R, -R, R); line(-R, R, -R, -R);
  }

  buildRailings() {
    const m = this.mats;
    const prail = (ax, az, bx, bz, y) => {
      const len = Math.hypot(bx - ax, bz - az);
      for (const h of [0.55, 1.05]) this.batch.add(m.galv, pipe([ax, y + h, az], [bx, y + h, bz], 0.03, 6));
      const n = Math.ceil(len / 1.6);
      for (let i = 0; i <= n; i++) { const t = i / n; this.batch.add(m.galv, pipe([ax + (bx - ax) * t, y, az + (bz - az) * t], [ax + (bx - ax) * t, y + 1.08, az + (bz - az) * t], 0.035, 6)); }
      // 발끝막이(노란 도장)
      this.batch.add(m.hazard, boxGeo(Math.min(ax, bx) - 0.02, y, Math.min(az, bz) - 0.02, Math.max(ax, bx) + 0.02, y + 0.12, Math.max(az, bz) + 0.02, 0.6));
    };
    prail(-22.9, 16.9, -13.1, 16.9, 4); prail(-22.9, 6.1, -22.9, 16.9, 4); prail(-13.1, 8.2, -13.1, 16.9, 4);
    prail(13.1, -10.9, 24.9, -10.9, 4); prail(24.9, -10.9, 24.9, 0.9, 4); prail(13.1, -8.8, 13.1, 0.9, 4);
  }

  buildDetails() {
    const m = this.mats;
    // 벽을 따라 늘어선 케이블 트레이(옹벽 안쪽 면, 높이 3m)
    for (const [ax, az, bx, bz] of [[-27.4, 4, -27.4, 26], [27.4, -26, 27.4, -12], [-10, 27.4, 14, 27.4]]) {
      this.batch.add(m.galv, boxGeo(Math.min(ax, bx) - 0.06, 3, Math.min(az, bz) - 0.06, Math.max(ax, bx) + 0.06, 3.08, Math.max(az, bz) + 0.06, 1));
      this.batch.add(m.black, boxGeo(Math.min(ax, bx) - 0.04, 3.08, Math.min(az, bz) - 0.04, Math.max(ax, bx) + 0.04, 3.16, Math.max(az, bz) + 0.04, 1));
    }
    // 바닥 배수구 덮개(격자)
    for (const [x, z] of [[-10, 10], [10, -10], [6, 18], [-18, -6]]) {
      this.batch.add(m.black, boxGeo(x - 0.4, 0.002, z - 0.4, x + 0.4, 0.012, z + 0.4, 1));
      for (let k = -0.3; k <= 0.3; k += 0.1) this.batch.add(m.galv, boxGeo(x - 0.38, 0.012, z + k - 0.015, x + 0.38, 0.02, z + k + 0.015, 1));
    }
    // 벽등(나트륨 벽부등) — 실제 빛은 투광등이 담당
    for (const [x, z, nx, nz] of [[-27.45, 14, 1, 0], [27.45, 14, -1, 0], [10, -27.45, 0, 1], [-14, 27.45, 0, -1], [27.45, -18, -1, 0]]) {
      this.batch.add(m.black, boxGeo(x - 0.2 + nx * 0.1, 3.6, z - 0.2 + nz * 0.1, x + 0.2 + nx * 0.1, 3.9, z + 0.2 + nz * 0.1, 1));
      this.glowBatch.add(m.lampWarm, boxGeo(x - 0.15 + nx * 0.12, 3.58, z - 0.15 + nz * 0.12, x + 0.15 + nx * 0.12, 3.6, z + 0.15 + nz * 0.12, 1));
    }
  }

  // ── 레이돔 탑(가운데 랜드마크): 팔각 콘크리트 받침 6m + 난간 두른 장비 층 + 흰 다면체 레이돔 + 항공등 ──
  buildRadome() {
    const m = this.mats, g = new THREE.Group();
    const base = new THREE.Mesh(scaleUV(new THREE.CylinderGeometry(1.42, 1.5, 6, 8), 3, 2), m.concrete); base.position.y = 3; base.castShadow = base.receiveShadow = true; g.add(base);
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.25, 24), m.steelDark); deck.position.y = 6.1; deck.castShadow = true; g.add(deck);
    const rails = [];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; rails.push(pipe([Math.cos(a) * 2.4, 6.2, Math.sin(a) * 2.4], [Math.cos(a) * 2.4, 7.2, Math.sin(a) * 2.4], 0.03, 5)); }
    const ring = new THREE.TorusGeometry(2.4, 0.03, 5, 48); ring.rotateX(Math.PI / 2); ring.translate(0, 7.2, 0); rails.push(ring);
    const ring2 = ring.clone(); ring2.translate(0, -0.5, 0); rails.push(ring2);
    const rm = new THREE.Mesh(mergeGeometries(rails.map((q) => { const n = q.index ? q.toNonIndexed() : q; n.deleteAttribute('uv'); return n; })), m.galv); g.add(rm);
    // 레이돔: 다면체 패널(살짝 각진 면이 실제 레이돔 이음매처럼 보인다)
    const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(2.25, 3), m.white); dome.position.y = 8.35; dome.castShadow = true; g.add(dome);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.6, 24), m.steelGrey); neck.position.y = 6.5; g.add(neck);
    // 사다리(남쪽 면)
    const lad = [];
    for (const s of [-0.25, 0.25]) lad.push(pipe([s, 0, 1.52], [s, 6.1, 1.52], 0.025, 5));
    for (let y = 0.3; y < 6; y += 0.32) lad.push(pipe([-0.25, y, 1.52], [0.25, y, 1.52], 0.018, 4));
    g.add(new THREE.Mesh(mergeGeometries(lad.map((q) => { const n = q.toNonIndexed(); n.deleteAttribute('uv'); return n; })), m.galv));
    // 꼭대기 항공등 · 받침 둘레 분전함
    this.aviation = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), m.red); this.aviation.position.y = 10.65; g.add(this.aviation);
    const box = new THREE.Mesh(boxGeo(-0.4, 0.3, 1.5, 0.4, 1.4, 1.75, 1), m.steelGrey); box.rotation.y = Math.PI / 2; g.add(box);
    this.root.add(g);
    this.radome = g;
  }

  // 투광등 4기: 강철 기둥 + 등 4개 묶음(광장 가운데를 향함) + 실제 스포트라이트 + 눈발에 걸린 빛줄기
  buildFloodlights() {
    const m = this.mats;
    const coneMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uTime: this.time, uC: { value: new THREE.Color(1.0, 0.64, 0.32) } },
      vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vY = uv.y; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uTime; uniform vec3 uC; varying float vY; varying vec3 vN; varying vec3 vV; varying vec3 vW;
float h(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
void main(){ float f = pow(abs(dot(vN, vV)), 1.6);
  float along = smoothstep(0.0, 0.15, 1.0 - vY) * pow(vY, 0.7);
  float flick = 0.85 + 0.15 * h(floor(vW * 1.5 + vec3(uTime * 2.0, -uTime * 3.0, 0.0)));
  float near = smoothstep(1.0, 5.0, length(vW - cameraPosition));
  gl_FragColor = vec4(uC * f * along * flick * near * 0.09, 1.0); }`,
    });
    this.spots = [];
    for (const L of LAMPS) {
      const g = new THREE.Group(); g.position.set(L.x, 0, L.z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 12.4, 12), m.galv); pole.position.y = 6.2; pole.castShadow = true; g.add(pole);
      const foot = new THREE.Mesh(boxGeo(-0.4, 0, -0.4, 0.4, 0.5, 0.4, 1), m.concreteDark); g.add(foot);
      // 등 묶음(가운데를 향해 기울어짐)
      const head = new THREE.Group(); head.position.y = 12.6; head.rotation.y = Math.atan2(-L.x, -L.z); g.add(head);
      const frame = new THREE.Mesh(boxGeo(-0.9, -0.05, -0.1, 0.9, 0.05, 0.1, 1), m.galv); head.add(frame);
      for (const [x, y] of [[-0.55, 0.25], [0.55, 0.25], [-0.55, -0.35], [0.55, -0.35]]) {
        const lamp = new THREE.Group(); lamp.position.set(x, y, 0); lamp.rotation.x = -0.55; head.add(lamp);
        lamp.add(new THREE.Mesh(boxGeo(-0.26, -0.2, -0.1, 0.26, 0.2, 0.18, 1), m.black));
        lamp.add(new THREE.Mesh(boxGeo(-0.22, -0.16, 0.18, 0.22, 0.16, 0.19, 1), m.lamp));
      }
      this.root.add(g);
      // 실제 빛: 그림자 없는 스포트라이트(가운데 쪽 바닥을 향함)
      const target = new THREE.Object3D(); target.position.set(L.x * 0.35, 0, L.z * 0.35); this.root.add(target);
      const spot = new THREE.SpotLight(0xffd0a0, 360, 70, 0.62, 0.75, 1.6);
      spot.position.set(L.x, 12.4, L.z); spot.target = target; this.root.add(spot);
      this.spots.push(spot);
      // 빛줄기 원뿔
      const len = Math.hypot(L.x * 0.65, 12.4, L.z * 0.65);
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.4, len * Math.tan(0.5), len, 24, 1, true), coneMat);
      cone.geometry.translate(0, -len / 2, 0);
      cone.position.set(L.x, 12.5, L.z);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(target.position.x - L.x, -12.4, target.position.z - L.z).normalize());
      cone.renderOrder = 3;
      this.root.add(cone);
    }
  }

  buildLiftDoors() {
    const m = this.mats;
    this.doors = [];
    const z = -22.42;
    for (const s of [-1, 1]) {
      const d = new THREE.Group();
      const panel = new THREE.Mesh(boxGeo(-1.6, 0, -0.06, 0, 3.4, 0.06, 1.5), m.steelGrey); panel.castShadow = true; d.add(panel);
      const band = new THREE.Mesh(boxGeo(-1.6, 0.1, 0.06, 0, 0.5, 0.07, 0.6), m.hazard); d.add(band);
      for (let y = 0.8; y < 3.3; y += 0.5) d.add(new THREE.Mesh(boxGeo(-1.55, y, 0.06, -0.05, y + 0.04, 0.075, 1), m.black));
      d.position.set(s < 0 ? 0 : 1.6, 0, z);
      this.root.add(d);
      this.doors.push({ mesh: d, side: s });
    }
    this.doorOpen = 0; this.doorT = 0;
    this.beacon = new THREE.Group(); this.beacon.position.set(0, 3.95, -22.35); this.root.add(this.beacon);
    this.beacon.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.25, 12), m.red));
  }

  buildLights() {
    const add = (color, intensity, dist, x, y, z, decay = 1.6) => { const l = new THREE.PointLight(color, intensity, dist, decay); l.position.set(x, y, z); this.root.add(l); this.lights.push(l); return l; };
    add(0xffa860, 14, 10, SPAWNS.stairs.x + 1.5, 5.4, SPAWNS.stairs.z);   // 터널 입구 등
    this.elevLight = add(0xff2a1a, 0, 12, 0, 3.8, -21.5);
  }

  update(dt, t, world, camPos) {
    // 승강장 문 · 경광등
    this.doorT -= dt;
    const want = this.doorT > 0 ? 1 : 0;
    this.doorOpen += (want - this.doorOpen) * Math.min(1, dt * 3);
    for (const d of this.doors) d.mesh.position.x = (d.side < 0 ? 0 : 1.6) + d.side * this.doorOpen * 1.55;
    const spin = this.doorT > -1;
    this.beacon.rotation.y += dt * 8;
    this.elevLight.intensity = spin ? 18 * (0.5 + 0.5 * Math.sin(t * 12)) : 0;
    this.aviation.visible = Math.sin(t * 2.4) > 0.55;
  }

  openElevator() { this.doorT = 3.5; }
}

function glowMat(color, intensity) {
  const m = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(intensity), fog: true });
  m.userData.noShadow = true; m.userData.noReceive = true;
  return m;
}

function hazardTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#c9a020';
  for (let i = -4; i < 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 16, 0); g.lineTo(i * 32 + 16 + 128, 128); g.lineTo(i * 32 + 128, 128); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
