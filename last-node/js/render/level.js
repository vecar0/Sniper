// 옥상 레벨: 충돌 상자(map.js)를 재질별로 병합한 메시 + 장식(난간·네온·케이블·간판) + 코어 · 광고판 · 단말 · 포탑 · 배터리
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/addons/utils/BufferGeometryUtils.js';
import { BOXES, ROOF, TERMINALS, TURRET_SLOTS, BILLBOARD, SPAWNS } from '../config/map.js';
import { loadSurface, wetMaterial, puddleTexture, neonSign, glowTexture } from './materials.js';
import { PALETTE } from './env.js';

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

class Batch {
  constructor() { this.map = new Map(); }
  add(mat, geo) { if (!this.map.has(mat)) this.map.set(mat, []); this.map.get(mat).push(geo); }
  build(parent, { shadow = true } = {}) {
    for (const [mat, list] of this.map) {
      const norm = list.map((g) => (g.index ? g.toNonIndexed() : g));
      for (const g of norm) { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); }
      const merged = mergeGeometries(norm, false);
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = shadow && !mat.transparent && !(mat.userData.noShadow);
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
    this.anim = [];
    this.buildFloor();
    for (const b of BOXES) this.addBox(b);
    this.buildRailings();
    this.buildDetails();
    this.batch.build(this.root);
    this.glowBatch.build(this.root, { shadow: false });
    this.buildCore();
    this.buildBillboard();
    this.buildSigns();
    this.buildTerminals();
    this.buildTurrets();
    this.buildElevatorDoors();
    this.buildLights();
    this.buildReflections();
  }

  makeMaterials() {
    const puddle = puddleTexture();
    const S = (name, r) => loadSurface(name, r);
    const concrete = S('concrete', 170), plate = S('plate', 120), container = S('container', 140), panel = S('panel', 130), rust = S('rust', 180);
    const mats = {
      floor: wetMaterial({ ...concrete, roughness: 1, metalness: 0.0, envMapIntensity: 1.2, normalScale: new THREE.Vector2(0.8, 0.8) }, { puddle, time: this.time }),
      concrete: wetMaterial({ ...concrete, roughness: 1, metalness: 0.0, envMapIntensity: 0.9, color: 0xb8bcc4 }, { puddle, time: this.time, wet: 0.6 }),
      plate: wetMaterial({ ...plate, roughness: 0.9, metalness: 0.75, envMapIntensity: 1.3 }, { puddle, time: this.time, wet: 0.7 }),
      panel: new THREE.MeshStandardMaterial({ ...panel, roughness: 0.8, metalness: 0.3, envMapIntensity: 1.3, color: 0xd0d8e4 }),
      panelDark: new THREE.MeshStandardMaterial({ ...panel, roughness: 0.75, metalness: 0.3, envMapIntensity: 1.2, color: 0x9aa4b4 }),
      rust: new THREE.MeshStandardMaterial({ ...rust, roughness: 1, metalness: 0.25, envMapIntensity: 1.0 }),
      containerTeal: new THREE.MeshStandardMaterial({ ...container, roughness: 0.8, metalness: 0.3, envMapIntensity: 1.2 }),
      containerRed: new THREE.MeshStandardMaterial({ ...container, roughness: 0.8, metalness: 0.3, envMapIntensity: 1.2, color: new THREE.Color(2.2, 0.55, 0.45) }),
      containerGrey: new THREE.MeshStandardMaterial({ ...container, roughness: 0.8, metalness: 0.3, envMapIntensity: 1.2, color: new THREE.Color(0.75, 0.62, 0.55) }),
      metal: new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.35, metalness: 1.0, envMapIntensity: 1.4 }),
      blackMetal: new THREE.MeshStandardMaterial({ color: 0x121418, roughness: 0.42, metalness: 0.9, envMapIntensity: 1.2 }),
      hazard: new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.7, metalness: 0.3 }),
      cyan: glowMat(PALETTE.cyan, 1.35),
      magenta: glowMat(PALETTE.magenta, 1.4),
      amber: glowMat(PALETTE.amber, 1.6),
      red: glowMat(PALETTE.red, 2.0),
      white: glowMat(new THREE.Color(0xdde8ff), 2.2),
    };
    for (const k of ['containerTeal', 'containerRed', 'containerGrey', 'panel', 'panelDark', 'rust']) mats[k].normalScale = new THREE.Vector2(1, 1);
    return mats;
  }

  buildFloor() {
    const m = this.mats;
    // 옥상 바닥 + 두께(밖에서 보이는 가장자리)
    this.batch.add(m.floor, boxGeo(-ROOF, -0.6, -ROOF, ROOF, 0, ROOF, 5.5));
    this.batch.add(m.panelDark, boxGeo(-ROOF - 0.4, -2.2, -ROOF - 0.4, ROOF + 0.4, -0.6, ROOF + 0.4, 4));
    // 바닥 도색: 코어 원 · 통로선
    const lines = new THREE.MeshStandardMaterial({ color: 0xc9b23a, roughness: 0.6, metalness: 0.1, transparent: true, opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
    lines.userData.noShadow = true;
    const ring = new THREE.RingGeometry(6.2, 6.45, 64);
    ring.rotateX(-Math.PI / 2); ring.translate(0, 0.005, 0);
    this.batch.add(lines, ring);
    for (const [x0, z0, x1, z1] of [[-0.12, 6.6, 0.12, 12.4], [-0.12, -21.5, 0.12, -6.6], [6.6, -0.12, 12.6, 0.12], [-20.5, -0.12, -6.6, 0.12]]) {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0.005, (z0 + z1) / 2);
      this.batch.add(lines, g);
    }
  }

  addBox(b) {
    const m = this.mats, B = this.batch;
    const { x0, z0, x1, z1, y0, y1 } = b;
    switch (b.kind) {
      case 'parapet':
        B.add(m.concrete, boxGeo(x0, y0, z0, x1, y1 - 0.08, z1, 3));
        B.add(m.metal, boxGeo(x0 - 0.03, y1 - 0.08, z0 - 0.03, x1 + 0.03, y1, z1 + 0.03, 3));
        break;
      case 'stairwell': case 'elevator':
        B.add(m.panel, boxGeo(x0, y0, z0, x1, y1, z1, 2.5));
        B.add(m.blackMetal, boxGeo(x0 - 0.15, y1, z0 - 0.15, x1 + 0.15, y1 + 0.25, z1 + 0.15, 3));
        break;
      case 'platform': case 'helipad':
        B.add(m.rust, boxGeo(x0, y0, z0, x1, y1 - 0.3, z1, 3));
        B.add(m.plate, boxGeo(x0 - 0.1, y1 - 0.3, z0 - 0.1, x1 + 0.1, y1, z1 + 0.1, 2.5));
        // 가장자리 LED 띠
        this.glowBatch.add(b.kind === 'helipad' ? m.cyan : m.magenta, boxGeo(x0 - 0.12, y1 - 0.22, z0 - 0.12, x1 + 0.12, y1 - 0.14, z1 + 0.12, 3));
        break;
      case 'step':
        B.add(m.plate, boxGeo(x0, y0, z0, x1, y1, z1, 2));
        this.glowBatch.add(m.amber, boxGeo(x1 - 0.04, y1 - 0.04, z0 + 0.1, x1 - 0.005, y1, z1 - 0.1, 1));
        break;
      case 'cooler':
        B.add(m.panelDark, boxGeo(x0, y0, z0, x1, y1 - 0.4, z1, 2));
        B.add(m.blackMetal, boxGeo(x0 + 0.2, y1 - 0.4, z0 + 0.2, x1 - 0.2, y1, z1 - 0.2, 2));
        { const fan = new THREE.CylinderGeometry(1.15, 1.15, 0.06, 28); fan.translate((x0 + x1) / 2, y1 + 0.03, (z0 + z1) / 2); B.add(m.metal, fan); }
        break;
      case 'core': break; // 코어는 따로
      case 'rail': break; // 난간은 buildRailings에서 파이프로
      case 'ring':
        B.add(m.concrete, boxGeo(x0, y0, z0, x1, y1, z1, 2));
        { const w = 0.03, xm = (x0 + x1) / 2, zm = (z0 + z1) / 2, alongX = x1 - x0 > z1 - z0;
          this.glowBatch.add(m.cyan, alongX ? boxGeo(x0, y1, zm - w, x1, y1 + 0.012, zm + w, 2) : boxGeo(xm - w, y1, z0, xm + w, y1 + 0.012, z1, 2)); }
        break;
      case 'pedestal':
        B.add(m.blackMetal, boxGeo(x0, y0, z0, x1, y1, z1, 1));
        this.glowBatch.add(m.cyan, boxGeo(x0 - 0.01, y1 - 0.15, z0 - 0.01, x1 + 0.01, y1 - 0.1, z1 + 0.01, 1));
        break;
      case 'terminal': break;
      case 'container': {
        const along = x1 - x0 > z1 - z0;
        const mat = [m.containerTeal, m.containerRed, m.containerGrey][Math.abs(Math.round(x0 * 7 + z0 * 3)) % 3];
        const g = boxGeo(x0, y0, z0, x1, y1, z1, 2.6, { vtile: 2.6 });
        // 골이 세로로 서도록: 옆면 UV는 (가로, 세로) 그대로
        B.add(mat, g);
        // 모서리 프레임
        const f = 0.12;
        for (const [ax, az] of [[x0, z0], [x1 - f, z0], [x0, z1 - f], [x1 - f, z1 - f]]) B.add(m.blackMetal, boxGeo(ax - 0.02, y0, az - 0.02, ax + f + 0.02, y1 + 0.02, az + f + 0.02, 1));
        if (along) { B.add(m.blackMetal, boxGeo(x0 - 0.02, y1 - 0.1, z0 - 0.02, x1 + 0.02, y1 + 0.02, z0 + 0.12, 1)); B.add(m.blackMetal, boxGeo(x0 - 0.02, y1 - 0.1, z1 - 0.12, x1 + 0.02, y1 + 0.02, z1 + 0.02, 1)); }
        else { B.add(m.blackMetal, boxGeo(x0 - 0.02, y1 - 0.1, z0 - 0.02, x0 + 0.12, y1 + 0.02, z1 + 0.02, 1)); B.add(m.blackMetal, boxGeo(x1 - 0.12, y1 - 0.1, z0 - 0.02, x1 + 0.02, y1 + 0.02, z1 + 0.02, 1)); }
        break;
      }
      case 'vent':
        B.add(m.panelDark, boxGeo(x0, y0, z0, x1, y1, z1, 1.5));
        for (let i = 0; i < 4; i++) { const zz = z0 + 0.3 + i * ((z1 - z0 - 0.6) / 3); B.add(m.blackMetal, boxGeo(x0 + 0.15, y1, zz - 0.04, x1 - 0.15, y1 + 0.05, zz + 0.04, 1)); }
        break;
      case 'tank': {
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, r = (x1 - x0) / 2 + 0.25;
        const cyl = new THREE.CylinderGeometry(r, r, y1 - 0.6, 32, 1); cyl.translate(cx, (y1 - 0.6) / 2 + 0.6, cz);
        scaleUV(cyl, (2 * Math.PI * r) / 3, (y1 - 0.6) / 3);
        B.add(m.rust, cyl);
        const cap = new THREE.CylinderGeometry(r * 0.6, r, 0.5, 32); cap.translate(cx, y1 + 0.25, cz); B.add(m.rust, cap);
        for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.add(m.blackMetal, boxGeo(cx + lx * r * 0.7 - 0.1, 0, cz + lz * r * 0.7 - 0.1, cx + lx * r * 0.7 + 0.1, 0.6, cz + lz * r * 0.7 + 0.1, 1));
        break;
      }
      case 'hvac':
        B.add(m.panel, boxGeo(x0, y0, z0, x1, y1, z1, 1.5));
        { const fan = new THREE.CylinderGeometry(0.85, 0.85, 0.04, 24); fan.rotateZ(Math.PI / 2); fan.translate(x1 + 0.02, (y0 + y1) / 2, (z0 + z1) / 2); B.add(m.blackMetal, fan); }
        break;
      case 'pillar':
        B.add(m.blackMetal, boxGeo(x0, y0, z0, x1, y1, z1, 1));
        break;
      case 'crate':
        B.add(m.panelDark, boxGeo(x0, y0, z0, x1, y1, z1, 1.2));
        B.add(m.hazard, boxGeo(x0 - 0.01, y1 - 0.25, z0 - 0.01, x1 + 0.01, y1 - 0.12, z1 + 0.01, 1.2));
        break;
      default:
        B.add(m.panel, boxGeo(x0, y0, z0, x1, y1, z1, 2));
    }
  }

  buildRailings() {
    const m = this.mats;
    // 난간 위 파이프 레일(0.4m 위) + 기둥
    const rail = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az);
      const g = new THREE.CylinderGeometry(0.035, 0.035, len, 8); g.rotateZ(Math.PI / 2);
      g.rotateY(-Math.atan2(bz - az, bx - ax)); g.translate((ax + bx) / 2, 1.5, (az + bz) / 2);
      this.batch.add(m.metal, g);
      const n = Math.floor(len / 2.4);
      for (let i = 0; i <= n; i++) {
        const t = i / Math.max(1, n), x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        const p = new THREE.CylinderGeometry(0.03, 0.03, 0.42, 6); p.translate(x, 1.31, z); this.batch.add(m.metal, p);
      }
    };
    const R = ROOF - 0.25;
    rail(-R, -R, R, -R); rail(-R, -R, -R, R); rail(-R, R, 4, R); rail(9, R, R, R); rail(R, -R, R, 16); rail(R, 21, R, R);
    // 플랫폼·헬리패드 난간
    const prail = (ax, az, bx, bz, y) => {
      const len = Math.hypot(bx - ax, bz - az);
      for (const h of [0.55, 1.05]) { const g = new THREE.CylinderGeometry(0.03, 0.03, len, 6); g.rotateZ(Math.PI / 2); g.rotateY(-Math.atan2(bz - az, bx - ax)); g.translate((ax + bx) / 2, y + h, (az + bz) / 2); this.batch.add(m.metal, g); }
      const n = Math.ceil(len / 1.6);
      for (let i = 0; i <= n; i++) { const t = i / n; const p = new THREE.CylinderGeometry(0.035, 0.035, 1.08, 6); p.translate(ax + (bx - ax) * t, y + 0.54, az + (bz - az) * t); this.batch.add(m.metal, p); }
    };
    prail(-22.9, 16.9, -13.1, 16.9, 4); prail(-22.9, 6.1, -22.9, 16.9, 4); prail(-13.1, 8.2, -13.1, 16.9, 4);
    prail(13.1, -10.9, 24.9, -10.9, 4); prail(24.9, -10.9, 24.9, 0.9, 4); prail(13.1, -8.8, 13.1, 0.9, 4);
  }

  buildDetails() {
    const m = this.mats;
    // 바닥 배수구·케이블 덕트
    for (const [x0, z0, x1, z1] of [[-27.4, 3, -26.6, 26], [26.6, -27, 27.4, -12], [-10, 26.6, 3, 27.4]]) this.batch.add(m.blackMetal, boxGeo(x0, 0, z0, x1, 0.12, z1, 1));
    // 코어로 가는 굵은 케이블(바닥)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const pts = [];
      for (let k = 0; k <= 12; k++) { const r = 1.5 + k * 0.6; pts.push(new THREE.Vector3(Math.cos(a + k * 0.04) * r, 0.07, Math.sin(a + k * 0.04) * r)); }
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.07, 6, false);
      this.batch.add(m.blackMetal, g);
    }
    // 머리 위 늘어진 케이블(광고판 기둥 ↔ 계단실 ↔ 엘리베이터)
    const sag = (a, b, s) => {
      const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * s, a.z + (b.z - a.z) * t)); }
      this.batch.add(m.blackMetal, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.035, 5, false));
    };
    sag(new THREE.Vector3(-20, 14.5, -24.5), new THREE.Vector3(-25, 3.4, -4), 2.5);
    sag(new THREE.Vector3(-10, 14.5, -24.5), new THREE.Vector3(-3.5, 4.6, -24), 3);
    sag(new THREE.Vector3(-10, 12, -24.5), new THREE.Vector3(14, 4.2, -10.5), 5);
    sag(new THREE.Vector3(3.5, 4.6, -23), new THREE.Vector3(22, 4.1, -10.8), 4);
    // 계단실 문(어두운 입구 + 위 표시등)
    const sp = SPAWNS.stairs;
    this.batch.add(m.blackMetal, boxGeo(-22.05, 0, sp.z - 1.1, -21.95, 2.4, sp.z + 1.1, 1));
    this.glowBatch.add(m.amber, boxGeo(-21.95, 2.45, sp.z - 1.2, -21.9, 2.55, sp.z + 1.2, 1));
    // 헬리패드 H 표시
    const hm = new THREE.MeshStandardMaterial({ map: helipadTexture(), transparent: true, roughness: 0.7, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
    hm.userData.noShadow = true;
    const hp = new THREE.PlaneGeometry(9, 9); hp.rotateX(-Math.PI / 2); hp.translate(19, 4.005, -5);
    this.batch.add(hm, hp);
  }

  // ── 오로라 코어 ───────────────────────────────────────
  buildCore() {
    const g = new THREE.Group();
    const m = this.mats;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 0.7, 8), m.blackMetal);
    base.position.y = 0.35; base.castShadow = base.receiveShadow = true; g.add(base);
    const base2 = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.0, 0.5, 8), m.metal);
    base2.position.y = 0.95; base2.castShadow = true; g.add(base2);
    // 기둥 지지대 4개
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.22, 7.6, 0.3), m.blackMetal);
      s.position.set(Math.cos(a) * 1.35, 4.8, Math.sin(a) * 1.35); s.rotation.y = -a; s.castShadow = true; g.add(s);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 7.2, 0.06), m.cyan);
      strip.position.set(Math.cos(a) * 1.22, 4.8, Math.sin(a) * 1.22); g.add(strip);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.2, 0.6, 8), m.blackMetal);
    cap.position.y = 8.8; cap.castShadow = true; g.add(cap);
    // 유리관 + 에너지 기둥
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 7.4, 32, 1, true), new THREE.MeshPhysicalMaterial({
      color: 0x88ccff, roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.22, envMapIntensity: 2.5, side: THREE.DoubleSide, depthWrite: false,
    }));
    glass.position.y = 4.9; g.add(glass);
    this.coreU = { uTime: this.time, uHurt: { value: 0 }, uPower: { value: 1 } };
    const energyMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: this.coreU,
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uTime, uHurt, uPower; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){ float core = pow(abs(dot(vN, vV)), 2.5);
  float flow = n(vec2(vUv.x * 8.0, vUv.y * 6.0 - uTime * 2.2)) * 0.6 + n(vec2(vUv.x * 21.0, vUv.y * 14.0 - uTime * 4.5)) * 0.4;
  float bands = 0.65 + 0.35 * sin(vUv.y * 60.0 - uTime * 9.0);
  vec3 c = mix(vec3(0.1, 0.85, 1.0), vec3(1.0, 0.15, 0.2), uHurt);
  float a = (core * 1.4 + 0.15) * (0.55 + flow * 0.8) * bands * uPower;
  gl_FragColor = vec4(c * a * 2.4 + vec3(0.8,1.0,1.0) * pow(core, 6.0) * 1.5 * uPower, 1.0); }`,
    });
    const energy = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 7.2, 24, 1, true), energyMat);
    energy.position.y = 4.9; g.add(energy);
    // 떠 있는 고리 2개
    this.coreRings = [];
    for (const [y, r] of [[3.4, 2.3], [6.6, 1.9]]) {
      const ring = new THREE.Group();
      const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.16, 12, 64), m.metal); t.rotation.x = Math.PI / 2; t.castShadow = true; ring.add(t);
      const tg = new THREE.Mesh(new THREE.TorusGeometry(r - 0.2, 0.035, 6, 64), m.cyan); tg.rotation.x = Math.PI / 2; ring.add(tg);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const nod = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.35), m.blackMetal); nod.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); ring.add(nod); }
      ring.position.y = y; g.add(ring);
      this.coreRings.push(ring);
    }
    // 하늘로 솟는 빛기둥
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: this.coreU,
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uTime, uHurt, uPower; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(vN, vV)), 3.0); float fade = (1.0 - vUv.y); float pulse = 0.75 + 0.25 * sin(vUv.y * 40.0 - uTime * 6.0); vec3 c = mix(vec3(0.1, 0.8, 1.0), vec3(1.0, 0.2, 0.25), uHurt); gl_FragColor = vec4(c * f * fade * fade * pulse * 0.55 * uPower, 1.0); }`,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 260, 20, 1, true), beamMat);
    beam.position.y = 9 + 130; g.add(beam);
    // 실드(육각 격자)
    this.shieldU = { uTime: this.time, uAmt: { value: 0 }, uHit: { value: 0 }, uHitDir: { value: new THREE.Vector3(1, 0, 0) } };
    const shield = new THREE.Mesh(new THREE.SphereGeometry(3.6, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: this.shieldU,
      vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position; vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uTime, uAmt, uHit; uniform vec3 uHitDir; varying vec3 vP; varying vec3 vN; varying vec3 vV;
float hex(vec2 p){ p.x *= 1.1547; p.y += mod(floor(p.x), 2.0) * 0.5; p = abs(fract(p) - 0.5); return abs(max(p.x * 1.5 + p.y, p.y * 2.0) - 1.0); }
void main(){ vec3 d = normalize(vP); vec2 uv = vec2(atan(d.z, d.x) * 3.0, acos(clamp(d.y, -1.0, 1.0)) * 6.0);
  float e = smoothstep(0.12, 0.0, hex(uv * 1.0));
  float rim = pow(1.0 - abs(dot(vN, vV)), 2.5);
  float hit = uHit * smoothstep(0.6, 1.0, dot(d, normalize(uHitDir)));
  float a = (e * 0.35 + rim * 0.6) * uAmt * (0.7 + 0.3 * sin(uTime * 3.0 + vP.y * 4.0)) + hit * (0.6 + e * 1.5);
  gl_FragColor = vec4(vec3(0.2, 0.9, 1.0) * a, 1.0); }`,
    }));
    shield.position.y = 0.2; g.add(shield);
    this.shield = shield;
    this.core = g;
    this.root.add(g);
  }

  buildBillboard() {
    const B = BILLBOARD;
    const w = B.x1 - B.x0, h = B.y1 - B.y0;
    const frame = new THREE.Group();
    const m = this.mats;
    const fr = (x0, y0, x1, y1) => { const g = new THREE.Mesh(boxGeo(x0, y0, B.z - 0.25, x1, y1, B.z + 0.25, 1), m.blackMetal); g.castShadow = true; frame.add(g); };
    fr(B.x0 - 0.3, B.y0 - 0.3, B.x1 + 0.3, B.y0); fr(B.x0 - 0.3, B.y1, B.x1 + 0.3, B.y1 + 0.3); fr(B.x0 - 0.3, B.y0, B.x0, B.y1); fr(B.x1, B.y0, B.x1 + 0.3, B.y1);
    // 뒷면 철골 격자
    for (let i = 1; i < 6; i++) { const x = B.x0 + (w * i) / 6; const g = new THREE.Mesh(boxGeo(x - 0.06, B.y0, B.z - 0.5, x + 0.06, B.y1, B.z - 0.35, 1), m.metal); frame.add(g); }
    this.root.add(frame);
    this.boardU = { uTime: this.time, uMap: { value: holoAd() } };
    const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: this.boardU,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; uniform sampler2D uMap; varying vec2 vUv;
void main(){ float row = floor(vUv.y * 40.0); float gl = step(0.93, fract(sin(row * 13.1 + floor(uTime * 6.0)) * 4375.5)) * step(0.7, fract(uTime * 0.37));
  vec2 uv = vUv + vec2(gl * 0.03, 0.0);
  float page = floor(mod(uTime / 6.0, 2.0));
  vec3 c = texture2D(uMap, vec2(uv.x, uv.y * 0.5 + page * 0.5)).rgb;
  float scan = 0.78 + 0.22 * sin(vUv.y * 600.0 - uTime * 10.0);
  float edge = smoothstep(0.0, 0.02, vUv.x) * smoothstep(0.0, 0.02, 1.0 - vUv.x) * smoothstep(0.0, 0.03, vUv.y) * smoothstep(0.0, 0.03, 1.0 - vUv.y);
  float flick = 0.92 + 0.08 * sin(uTime * 37.0);
  gl_FragColor = vec4(c * scan * flick * edge * 1.25, 1.0); }`,
    }));
    board.position.set((B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2, B.z + 0.05);
    this.root.add(board); // 평면 앞면(+z)이 옥상 안쪽(남쪽)을 본다
  }

  buildSigns() {
    const add = (text, color, x, y, z, ry, w, h, opts) => {
      const tex = neonSign(text, color, opts);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(1.8, 1.8, 1.8) });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.position.set(x, y, z); m.rotation.y = ry; this.root.add(m);
      return m;
    };
    add('아케론', '#ff2bd6', -21.94, 2.0, -5.0, Math.PI / 2, 0.9, 2.6, { vertical: true, w: 128, h: 384, size: 96 });
    add('NODE-07', '#27e8ff', 0, 3.7, -22.44, 0, 3.4, 0.85, { size: 90 });
    add('LIFT', '#ffa040', 3.0, 2.6, -22.44, 0, 1.2, 0.4, { size: 90 });
    add('HELIPAD', '#27e8ff', 13.0 - 0.02, 2.6, -5, -Math.PI / 2, 4.0, 1.0, { size: 90 });
    add('냉각 구역', '#ff2bd6', -12.98, 2.6, 12, Math.PI / 2, 3.2, 0.8, { size: 76 });
    add('AURORA', '#27e8ff', 0, 9.6, 1.62, 0, 2.6, 0.6, { size: 92 });
  }

  buildTerminals() {
    this.terminals = [];
    const m = this.mats;
    const scr = neonSign('상점', '#27e8ff', { size: 100, w: 256, h: 160 });
    for (const t of TERMINALS) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(boxGeo(-0.6, 0, -0.25, 0.6, 1.9, 0.25, 1), m.blackMetal); body.castShadow = true; g.add(body);
      const scrMat = new THREE.MeshBasicMaterial({ map: scr, color: new THREE.Color(1.6, 1.6, 1.6), transparent: true });
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.6), scrMat);
      screen.position.set(0, 1.35, 0.26); g.add(screen);
      const strip = new THREE.Mesh(boxGeo(-0.62, 0.05, 0.24, 0.62, 0.1, 0.27, 1), m.cyan); g.add(strip);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), m.cyan); beacon.position.set(0, 2.0, 0); g.add(beacon);
      g.position.set(t.x, t.y, t.z - 0.9);
      // 단말이 옥상 안쪽을 보게
      if (t.x > 10) { g.rotation.y = 0; }
      this.root.add(g);
      this.terminals.push({ g, scrMat, beacon });
    }
  }

  buildTurrets() {
    this.turretModels = [];
    const m = this.mats;
    for (const s of TURRET_SLOTS) {
      const root = new THREE.Group(); root.position.set(s.x, s.y, s.z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.3, 12), m.blackMetal); base.position.y = 0.15; root.add(base);
      const yaw = new THREE.Group(); yaw.position.y = 0.55; root.add(yaw);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.38, 0.7), m.metal); head.castShadow = true; yaw.add(head);
      const pitch = new THREE.Group(); pitch.position.set(0, 0.05, -0.1); yaw.add(pitch);
      for (const sx of [-0.12, 0.12]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.9, 8), m.blackMetal); b.rotation.x = Math.PI / 2; b.position.set(sx, 0, -0.5); pitch.add(b); }
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.02), m.cyan); eye.position.set(0, 0.08, -0.36); yaw.add(eye);
      const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x9ff6ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      flash.position.set(0, 0, -1.0); flash.scale.setScalar(0.8); flash.visible = false; pitch.add(flash);
      root.visible = false; root.scale.setScalar(0.01);
      this.root.add(root);
      this.turretModels.push({ root, yaw, pitch, flash, built: 0 });
    }
  }

  buildElevatorDoors() {
    const m = this.mats;
    this.doors = [];
    for (const s of [-1, 1]) {
      const d = new THREE.Mesh(boxGeo(-1.4, 0, -0.06, 0, 3.2, 0.06, 1.5), m.hazard);
      d.position.set(s < 0 ? 0 : 1.4, 0, -22.42);
      d.castShadow = true;
      this.root.add(d);
      this.doors.push({ mesh: d, side: s });
    }
    this.doorOpen = 0; this.doorT = 0;
    // 문 위 회전 경광등
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 12), this.mats.red);
    beacon.position.set(0, 4.85, -22.6); this.root.add(beacon);
  }

  buildLights() {
    const add = (color, intensity, dist, x, y, z, decay = 1.6) => { const l = new THREE.PointLight(color, intensity, dist, decay); l.position.set(x, y, z); this.root.add(l); this.lights.push(l); return l; };
    this.coreLight = add(0x30e0ff, 60, 26, 0, 5, 0);
    this.boardLight = add(0xff2bd6, 22, 20, -15, 9, -21);
    add(0x27e8ff, 26, 16, 19, 6.5, -5);       // 헬리패드
    add(0xffa040, 22, 12, -20.8, 3.0, -2);    // 계단실 문 나트륨등
    add(0xff2bd6, 6, 10, -18, 7, 11);         // 냉각 구역
    this.elevLight = add(0xff2a3a, 0, 14, 0, 4.4, -21.5);
  }

  // 젖은 바닥에 길게 비친 네온(가산 막대). 카메라 쪽으로 늘어진다
  buildReflections() {
    this.refl = [];
    const tex = streakTexture();
    const mk = (color, x, z, w, len, strength) => {
      const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(color).multiplyScalar(strength), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
      const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, 0.5);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 0.012, z); mesh.scale.set(w, 1, len);
      mesh.renderOrder = 2;
      this.root.add(mesh);
      this.refl.push({ mesh, x, z, len });
    };
    mk(0x27e8ff, 0, 0, 1.6, 16, 1.0);
    mk(0xff2bd6, -15, -22.5, 7, 18, 0.3);
    mk(0x27e8ff, 13, -5, 2.2, 10, 0.4);
    mk(0xffa040, -21.5, -2, 1.2, 9, 0.5);
  }

  update(dt, t, world, camPos) {
    for (const [i, r] of this.coreRings.entries()) { r.rotation.y += dt * (i ? -0.5 : 0.35); r.position.y += Math.sin(t * 1.3 + i * 2) * 0.002; }
    const c = world.core;
    const hurt = Math.max(0, 1 - c.hurtT * 2.5);
    this.coreU.uHurt.value += (hurt - this.coreU.uHurt.value) * Math.min(1, dt * 12);
    this.coreU.uPower.value = 0.35 + 0.65 * (c.hp / c.max) + Math.sin(t * 13) * 0.03;
    this.coreLight.color.setRGB(0.19 + 0.8 * this.coreU.uHurt.value, 0.88 - 0.7 * this.coreU.uHurt.value, 1 - 0.75 * this.coreU.uHurt.value);
    this.coreLight.intensity = (50 + Math.sin(t * 9) * 4) * this.coreU.uPower.value + 40 * this.coreU.uHurt.value;
    const sh = c.shieldLevel ? c.shield / [300, 600, 900][c.shieldLevel - 1] : 0;
    this.shieldU.uAmt.value += (sh * 0.6 - this.shieldU.uAmt.value) * Math.min(1, dt * 5);
    this.shieldU.uHit.value = Math.max(0, this.shieldU.uHit.value - dt * 3);
    this.shield.visible = this.shieldU.uAmt.value > 0.01 || this.shieldU.uHit.value > 0.01;
    this.boardLight.intensity = 26 + Math.sin(t * 2) * 6 + (Math.sin(t * 37) > 0.97 ? -18 : 0);
    // 단말: 정비 시간엔 밝게
    const shopOn = world.canShop();
    for (const term of this.terminals) { term.scrMat.color.setScalar(shopOn ? 1.8 + Math.sin(t * 4) * 0.3 : 0.35); term.beacon.visible = shopOn && Math.sin(t * 6) > 0; }
    // 포탑
    world.turrets.forEach((tr, i) => {
      const m = this.turretModels[i];
      if (tr.built && m.built < 1) { m.root.visible = true; m.built = Math.min(1, m.built + dt * 2); m.root.scale.setScalar(easeOutBack(m.built)); }
      if (!tr.built) { m.root.visible = false; m.built = 0; }
      m.yaw.rotation.y = tr.yaw; m.pitch.rotation.x = tr.pitch;
      m.flash.visible = tr.fireT > 0; m.flash.material.rotation = Math.random() * 6;
    });
    // 엘리베이터 문
    this.doorT -= dt;
    const want = this.doorT > 0 ? 1 : 0;
    this.doorOpen += (want - this.doorOpen) * Math.min(1, dt * 3);
    for (const d of this.doors) d.mesh.position.x = (d.side < 0 ? 0 : 1.4) + d.side * this.doorOpen * 1.35;
    this.elevLight.intensity = this.doorT > -1 ? 30 * (0.5 + 0.5 * Math.sin(t * 12)) : 0;
    // 바닥 반사 막대가 카메라 쪽으로 늘어지게
    for (const r of this.refl) {
      const dx = camPos.x - r.x, dz = camPos.z - r.z;
      r.mesh.rotation.y = Math.atan2(dx, dz);
      r.mesh.scale.z = Math.min(r.len, Math.hypot(dx, dz) * 0.9 + 1);
    }
  }

  openElevator() { this.doorT = 3.5; }
  shieldHit(fx, fz) { this.shieldU.uHit.value = 1; this.shieldU.uHitDir.value.set(fx, 1.2, fz).normalize(); }
}

function glowMat(color, intensity) {
  const m = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(intensity), fog: true });
  m.userData.noShadow = true; m.userData.noReceive = true;
  return m;
}

function scaleUV(g, su, sv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); }
function easeOutBack(x) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }

function hazardTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#d9a91c';
  for (let i = -4; i < 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 16, 0); g.lineTo(i * 32 + 16 + 128, 128); g.lineTo(i * 32 + 128, 128); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

function helipadTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.strokeStyle = 'rgba(230,230,230,0.8)'; g.lineWidth = 22; g.beginPath(); g.arc(256, 256, 220, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(230,230,230,0.8)'; g.fillRect(150, 130, 50, 252); g.fillRect(312, 130, 50, 252); g.fillRect(150, 231, 212, 50);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function streakTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  const img = g.createImageData(64, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) {
    const u = x / 63 - 0.5, v = y / 255;
    const a = Math.exp(-u * u * 18) * Math.pow(1 - v, 1.6) * (0.75 + 0.25 * Math.sin(v * 50 + x * 0.3));
    const i = (y * 64 + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// 홀로그램 광고 2쪽(위/아래)
function holoAd() {
  const W = 1024, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const font = "'Black Han Sans', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
  // 페이지 1 (아래 절반 = uv.y 0~0.5)
  const page = (y0, draw) => { g.save(); g.translate(0, y0); g.beginPath(); g.rect(0, 0, W, H / 2); g.clip(); draw(); g.restore(); };
  page(H / 2, () => {
    const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(255,43,214,0.85)'); gr.addColorStop(1, 'rgba(60,20,140,0.6)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H / 2);
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 12; g.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; g.lineTo(200 + Math.cos(a) * 120, 256 + Math.sin(a) * 120); }
    g.closePath(); g.stroke();
    g.fillStyle = '#fff'; g.font = `400 170px ${font}`; g.textAlign = 'left'; g.fillText('HELIX', 370, 270);
    g.font = `400 56px ${font}`; g.fillText('DYNAMICS · 내일을 소유하라', 370, 360);
  });
  page(0, () => {
    const gr = g.createLinearGradient(0, 0, 0, H / 2); gr.addColorStop(0, 'rgba(10,40,90,0.7)'); gr.addColorStop(1, 'rgba(39,232,255,0.8)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H / 2);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `400 120px ${font}`; g.fillText('신서울 2089', W / 2, 230);
    g.font = `400 54px ${font}`; g.fillText('하늘 위의 도시, 헬릭스가 지킵니다', W / 2, 330);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
