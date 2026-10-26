// 적 모델: 부품을 코드로 만들어 한 개의 SkinnedMesh로 병합(적 1기 = 그리기 1번).
// 재질은 정점 색(albedo) + 정점 속성 aMat(발광·금속·거칠기) — 피격 번쩍임·기절·디졸브는 셰이더 uniform.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from '../../vendor/three/addons/geometries/RoundedBoxGeometry.js';

// 재질 종류: [색, 발광, 금속, 거칠기]
const KINDS = {
  armor: [0x2b3038, 0, 0.85, 0.32],
  armorLight: [0x4a515c, 0, 0.9, 0.28],
  dark: [0x0b0c0f, 0, 0.35, 0.72],
  joint: [0x17191d, 0, 0.9, 0.5],
  accent: [0x5a0b12, 0, 0.55, 0.4],
  glow: [0xff2030, 7, 0, 0.5],
  glowSoft: [0xff3a30, 2.5, 0, 0.5],
  glowOrange: [0xff6a10, 6, 0, 0.5],
  glowWhite: [0xffe0d0, 4, 0, 0.5],
  glass: [0x10161e, 0.3, 0.2, 0.08],
  blade: [0x9aa3ad, 0, 1.0, 0.18],
  cloth: [0x14161b, 0, 0.0, 0.9],
};

function tube(a, b, r0, r1, seg = 8) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
  const len = A.distanceTo(Bv);
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), Bv.clone().sub(A).normalize());
  g.applyQuaternion(q); g.translate(A.x, A.y, A.z);
  return g;
}
function rbox(w, h, d, r, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g;
}
function box(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) { const g = new THREE.BoxGeometry(w, h, d); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g; }
function sph(r, x, y, z, sx = 1, sy = 1, sz = 1, ws = 12, hs = 8) { const g = new THREE.SphereGeometry(r, ws, hs); g.scale(sx, sy, sz); g.translate(x, y, z); return g; }
function cyl(rt, rb, h, x, y, z, rx = 0, ry = 0, rz = 0, seg = 12) { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g; }

// 부품 목록 → 병합 지오메트리(skinIndex = 붙는 뼈)
function assemble(parts) {
  const list = [];
  for (const { g, bone, kind } of parts) {
    const geo = g.index ? g.toNonIndexed() : g;
    const n = geo.attributes.position.count;
    const [hex, em, me, ro] = KINDS[kind];
    const col = new THREE.Color(hex);
    const c = new Float32Array(n * 3), m = new Float32Array(n * 4), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
      m[i * 4] = em; m[i * 4 + 1] = me; m[i * 4 + 2] = ro; m[i * 4 + 3] = 0;
      si[i * 4] = bone; sw[i * 4] = 1;
    }
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal'].includes(k)) geo.deleteAttribute(k);
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    geo.setAttribute('aMat', new THREE.BufferAttribute(m, 4));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    list.push(geo);
  }
  const merged = mergeGeometries(list, false);
  merged.computeBoundingSphere();
  merged.boundingSphere.radius += 1.5; // 애니메이션으로 커지는 범위
  return merged;
}

// 공용 적 재질(인스턴스마다 clone → uniform만 따로)
function enemyMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 1, roughness: 1, envMapIntensity: 1.25 });
  mat.onBeforeCompile = function (sh) {
    sh.uniforms.uFlash = this.userData.uFlash;
    sh.uniforms.uStun = this.userData.uStun;
    sh.uniforms.uDissolve = this.userData.uDissolve;
    sh.uniforms.uGlow = this.userData.uGlow;
    sh.uniforms.uTime = this.userData.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aMat; varying vec4 vMat; varying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMat = aMat; vObj = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec4 vMat; varying vec3 vObj; uniform float uFlash, uStun, uDissolve, uGlow, uTime;
float dh(vec3 p){ p = fract(p * 0.3183 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float dn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(dh(i), dh(i+vec3(1,0,0)), f.x), mix(dh(i+vec3(0,1,0)), dh(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(dh(i+vec3(0,0,1)), dh(i+vec3(1,0,1)), f.x), mix(dh(i+vec3(0,1,1)), dh(i+vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
float dz = dn(vObj * 9.0) * 0.7 + dn(vObj * 23.0) * 0.3;
if (dz < uDissolve) discard;`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vMat.y;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vMat.z;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += vColor.rgb * vMat.x * uGlow;
totalEmissiveRadiance += vec3(1.0, 0.85, 0.75) * uFlash * 0.9;
float zap = step(0.6, fract(sin(dot(floor(vObj * 14.0), vec3(12.9, 78.2, 37.7)) + floor(uTime * 24.0)) * 43758.5));
totalEmissiveRadiance += vec3(0.25, 0.65, 1.6) * uStun * (0.25 + zap * 1.5);
float edge = smoothstep(uDissolve + 0.07, uDissolve, dz) * step(0.001, uDissolve);
totalEmissiveRadiance += vec3(3.0, 0.9, 0.3) * edge * 4.0;`);
  };
  mat.customProgramCacheKey = () => 'enemy-v1';
  return mat;
}

export function makeEnemyMaterial() {
  const m = enemyMaterial();
  m.userData = { uFlash: { value: 0 }, uStun: { value: 0 }, uDissolve: { value: 0 }, uGlow: { value: 1 }, uTime: { value: 0 } };
  return m;
}

// ── 뼈대 정의 ────────────────────────────────────────────
// [이름, 부모, x, y, z] 절대 위치(정면 = −z)
const H = { HIPS: 0, SPINE: 1, CHEST: 2, HEAD: 3, LSH: 4, LEL: 5, LHA: 6, RSH: 7, REL: 8, RHA: 9, LHI: 10, LKN: 11, LFT: 12, RHI: 13, RKN: 14, RFT: 15 };
function humanoidDefs(s = 1, w = 1) {
  return [
    ['hips', -1, 0, 0.95 * s, 0], ['spine', 0, 0, 1.12 * s, 0], ['chest', 1, 0, 1.32 * s, 0], ['head', 2, 0, 1.56 * s, 0],
    ['lsh', 2, 0.21 * w, 1.46 * s, 0], ['lel', 4, 0.25 * w, 1.16 * s, 0], ['lha', 5, 0.27 * w, 0.9 * s, 0],
    ['rsh', 2, -0.21 * w, 1.46 * s, 0], ['rel', 7, -0.25 * w, 1.16 * s, 0], ['rha', 8, -0.27 * w, 0.9 * s, 0],
    ['lhi', 0, 0.11 * w, 0.92 * s, 0], ['lkn', 10, 0.12 * w, 0.5 * s, 0], ['lft', 11, 0.12 * w, 0.08 * s, 0],
    ['rhi', 0, -0.11 * w, 0.92 * s, 0], ['rkn', 13, -0.12 * w, 0.5 * s, 0], ['rft', 14, -0.12 * w, 0.08 * s, 0],
  ];
}
const P = (defs, i) => [defs[i][2], defs[i][3], defs[i][4]];

function limbs(parts, defs, r, kindUpper = 'dark', kindLower = 'armor') {
  const L = (a, b, r0, r1, bone, kind) => parts.push({ g: tube(P(defs, a), P(defs, b), r0, r1, 8), bone, kind });
  for (const [sh, el, ha] of [[H.LSH, H.LEL, H.LHA], [H.RSH, H.REL, H.RHA]]) {
    L(sh, el, r * 0.9, r * 0.75, sh, kindUpper);
    L(el, ha, r * 0.8, r * 0.62, el, kindLower);
    parts.push({ g: sph(r * 0.85, ...P(defs, el)), bone: el, kind: 'joint' });
    parts.push({ g: sph(r * 0.8, ...P(defs, ha), 0.9, 1.2, 1.1), bone: ha, kind: 'dark' });
  }
  for (const [hi, kn, ft] of [[H.LHI, H.LKN, H.LFT], [H.RHI, H.RKN, H.RFT]]) {
    L(hi, kn, r * 1.35, r * 1.05, hi, kindUpper);
    L(kn, ft, r * 1.0, r * 0.75, kn, kindLower);
    parts.push({ g: sph(r * 1.0, ...P(defs, kn)), bone: kn, kind: 'joint' });
    const f = P(defs, ft);
    parts.push({ g: rbox(r * 1.6, r * 1.0, r * 3.4, 0.02, f[0], f[1] - 0.02, f[2] - r * 0.9), bone: ft, kind: 'dark' });
  }
}

// ── 종류별 모델 ─────────────────────────────────────────
function buildReaper() {
  const d = humanoidDefs(1, 0.95), parts = [], add = (g, bone, kind) => parts.push({ g, bone, kind });
  add(rbox(0.28, 0.16, 0.2, 0.05, 0, 0.95, 0), H.HIPS, 'dark');
  add(tube([0, 0.98, 0], [0, 1.25, 0], 0.1, 0.12, 8), H.SPINE, 'dark');
  add(rbox(0.36, 0.3, 0.22, 0.07, 0, 1.36, -0.01), H.CHEST, 'armor');
  add(rbox(0.3, 0.14, 0.2, 0.05, 0, 1.18, -0.02), H.SPINE, 'armorLight');
  add(box(0.02, 0.22, 0.01, 0, 1.36, -0.125), H.CHEST, 'glowSoft');
  add(rbox(0.19, 0.24, 0.23, 0.08, 0, 1.64, 0), H.HEAD, 'armor');
  add(box(0.15, 0.03, 0.02, 0, 1.66, -0.115, 0, 0, 0), H.HEAD, 'glow');
  add(box(0.05, 0.08, 0.02, 0, 1.6, -0.115), H.HEAD, 'dark');
  add(sph(0.08, 0.2, 1.47, 0, 1.1, 0.8, 1.1), H.LSH, 'armor');
  add(sph(0.08, -0.2, 1.47, 0, 1.1, 0.8, 1.1), H.RSH, 'armor');
  limbs(parts, d, 0.055, 'dark', 'armor');
  // 칼날 팔(아래팔에서 손 아래로 뻗음) + 빛나는 날
  for (const [el, x] of [[H.LEL, 0.27], [H.REL, -0.27]]) {
    add(box(0.025, 0.78, 0.07, x * 1.04, 0.62, -0.03), el, 'blade');
    add(box(0.012, 0.74, 0.012, x * 1.04, 0.62, -0.075), el, 'glow');
    add(rbox(0.07, 0.16, 0.09, 0.02, x, 1.02, 0), el, 'armorLight');
  }
  add(rbox(0.06, 0.12, 0.05, 0.02, 0.12, 0.62, -0.07), H.LKN, 'armorLight');
  add(rbox(0.06, 0.12, 0.05, 0.02, -0.12, 0.62, -0.07), H.RKN, 'armorLight');
  return { defs: d, geo: assemble(parts) };
}

function buildEnforcer() {
  const d = humanoidDefs(1.04, 1.12), parts = [], add = (g, bone, kind) => parts.push({ g, bone, kind });
  add(rbox(0.36, 0.2, 0.26, 0.05, 0, 0.98, 0), H.HIPS, 'armor');
  add(tube([0, 1.0, 0], [0, 1.3, 0], 0.14, 0.16, 8), H.SPINE, 'dark');
  add(rbox(0.5, 0.38, 0.32, 0.08, 0, 1.4, 0), H.CHEST, 'armor');
  add(rbox(0.3, 0.16, 0.06, 0.03, 0, 1.38, -0.17), H.CHEST, 'armorLight');
  add(box(0.08, 0.08, 0.01, 0, 1.4, -0.205), H.CHEST, 'glowSoft');
  add(rbox(0.36, 0.42, 0.18, 0.05, 0, 1.36, 0.22), H.CHEST, 'dark'); // 배낭
  add(box(0.02, 0.3, 0.01, 0.12, 1.36, 0.315), H.CHEST, 'glowSoft');
  add(rbox(0.24, 0.27, 0.27, 0.1, 0, 1.69, 0), H.HEAD, 'armor');
  add(box(0.2, 0.035, 0.02, 0, 1.71, -0.135), H.HEAD, 'glow');
  add(rbox(0.16, 0.08, 0.06, 0.02, 0, 1.6, -0.12), H.HEAD, 'dark');
  for (const [sh, x] of [[H.LSH, 0.24], [H.RSH, -0.24]]) add(rbox(0.18, 0.12, 0.22, 0.05, x * 1.05, 1.53, 0, 0, 0, x > 0 ? -0.3 : 0.3), sh, 'armor');
  limbs(parts, d, 0.07, 'dark', 'armor');
  // 소총(가슴 앞, 오른손 쪽)
  add(rbox(0.07, 0.12, 0.62, 0.02, -0.1, 1.28, -0.38), H.CHEST, 'joint');
  add(cyl(0.022, 0.022, 0.36, -0.1, 1.31, -0.84, Math.PI / 2), H.CHEST, 'dark');
  add(box(0.05, 0.16, 0.08, -0.1, 1.16, -0.4), H.CHEST, 'dark');
  add(box(0.012, 0.02, 0.2, -0.1, 1.355, -0.4), H.CHEST, 'glow');
  add(rbox(0.06, 0.06, 0.2, 0.02, -0.1, 1.34, -0.14), H.CHEST, 'dark');
  return { defs: d, geo: assemble(parts) };
}

function buildLeech() {
  const d = humanoidDefs(0.95, 0.85), parts = [], add = (g, bone, kind) => parts.push({ g, bone, kind });
  add(rbox(0.24, 0.14, 0.18, 0.05, 0, 0.9, 0), H.HIPS, 'dark');
  add(tube([0, 0.93, 0], [0, 1.2, 0.02], 0.08, 0.1, 8), H.SPINE, 'joint');
  add(rbox(0.3, 0.26, 0.24, 0.08, 0, 1.3, 0.02), H.CHEST, 'armor');
  // 망토(가슴에서 늘어짐)
  add(cyl(0.2, 0.42, 0.85, 0, 0.98, 0.06, 0, 0, 0, 10), H.CHEST, 'cloth');
  add(sph(0.17, 0, 1.52, 0.02, 1, 1.05, 1.15), H.HEAD, 'cloth'); // 두건
  add(sph(0.1, 0, 1.5, -0.05, 1, 1.1, 1.0), H.HEAD, 'armor');
  for (const x of [-0.045, 0.045]) add(sph(0.022, x, 1.52, -0.14), H.HEAD, 'glow');
  add(sph(0.016, 0, 1.47, -0.145), H.HEAD, 'glow');
  // 안테나 + 빨간 마름모
  add(tube([0.05, 1.6, 0.08], [0.06, 2.05, 0.1], 0.008, 0.005, 5), H.HEAD, 'joint');
  { const o = new THREE.OctahedronGeometry(0.075); o.scale(0.7, 1.2, 0.7); o.translate(0.06, 2.13, 0.1); add(o, H.HEAD, 'glow'); }
  // 등 케이블
  for (let i = 0; i < 3; i++) {
    const pts = [new THREE.Vector3(-0.08 + i * 0.08, 1.35, 0.12), new THREE.Vector3(-0.12 + i * 0.1, 1.0, 0.3), new THREE.Vector3(-0.16 + i * 0.14, 0.5, 0.25)];
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.016, 5), H.CHEST, i === 1 ? 'glowSoft' : 'joint');
  }
  limbs(parts, d, 0.042, 'joint', 'armor');
  // 긴 손가락
  for (const [ha, x] of [[H.LHA, 0.23], [H.RHA, -0.23]]) for (let k = 0; k < 3; k++) add(tube([x, 0.84, -0.02 + k * 0.02], [x + (k - 1) * 0.02, 0.68, -0.05 + k * 0.02], 0.01, 0.006, 4), ha, 'joint');
  return { defs: d, geo: assemble(parts) };
}

function buildDrone() {
  const defs = [['body', -1, 0, 0, 0], ['r1', 0, 0.32, 0.05, 0.32], ['r2', 0, -0.32, 0.05, 0.32], ['r3', 0, 0.32, 0.05, -0.32], ['r4', 0, -0.32, 0.05, -0.32]];
  const parts = [], add = (g, bone, kind) => parts.push({ g, bone, kind });
  add(rbox(0.26, 0.12, 0.3, 0.05, 0, 0, 0), 0, 'armor');
  add(rbox(0.16, 0.08, 0.18, 0.03, 0, -0.08, 0), 0, 'dark');
  add(sph(0.05, 0, -0.02, -0.16), 0, 'glow');
  add(box(0.1, 0.01, 0.01, 0, 0.065, -0.1), 0, 'glowSoft');
  for (let i = 0; i < 4; i++) {
    const [, , x, y, z] = defs[i + 1];
    add(tube([0, 0, 0], [x, y, z], 0.022, 0.018, 5), 0, 'joint');
    add(cyl(0.035, 0.035, 0.06, x, y, z), 0, 'dark');
    const ring = new THREE.TorusGeometry(0.15, 0.012, 5, 20); ring.rotateX(Math.PI / 2); ring.translate(x, y + 0.02, z);
    add(ring, 0, 'glow');
    add(box(0.28, 0.006, 0.035, x, y + 0.04, z), i + 1, 'dark'); // 프로펠러(뼈 회전)
  }
  return { defs, geo: assemble(parts) };
}

function buildMech() {
  const d = [
    ['hips', -1, 0, 1.65, 0], ['torso', 0, 0, 2.15, 0], ['head', 1, 0, 2.95, -0.3],
    ['lsh', 1, 0.82, 2.6, 0], ['lel', 3, 0.95, 1.95, -0.1], ['lha', 4, 0.95, 1.35, -0.25],
    ['rsh', 1, -0.82, 2.6, 0], ['rel', 6, -0.95, 1.95, -0.1], ['rha', 7, -0.95, 1.35, -0.25],
    ['lhi', 0, 0.45, 1.55, 0], ['lkn', 9, 0.5, 0.9, -0.25], ['lft', 10, 0.5, 0.2, 0.05],
    ['rhi', 0, -0.45, 1.55, 0], ['rkn', 12, -0.5, 0.9, -0.25], ['rft', 13, -0.5, 0.2, 0.05],
  ];
  const parts = [], add = (g, bone, kind) => parts.push({ g, bone, kind });
  add(rbox(0.9, 0.4, 0.7, 0.1, 0, 1.65, 0), 0, 'armor');
  add(rbox(1.5, 1.0, 1.1, 0.16, 0, 2.35, 0), 1, 'armor');
  add(rbox(1.1, 0.5, 0.25, 0.08, 0, 2.3, -0.6), 1, 'armorLight');
  add(rbox(0.6, 0.3, 0.1, 0.04, 0, 2.62, -0.68), 1, 'accent');
  // 머리
  add(rbox(0.5, 0.36, 0.5, 0.1, 0, 2.98, -0.32), 2, 'armor');
  add(box(0.36, 0.05, 0.02, 0, 3.0, -0.58), 2, 'glow');
  // 등 냉각 코어 + 통풍구
  add(cyl(0.3, 0.3, 0.7, 0, 2.4, 0.72, 0, 0, 0, 16), 1, 'glowOrange');
  add(rbox(0.85, 0.85, 0.3, 0.06, 0, 2.4, 0.6), 1, 'dark');
  for (let i = 0; i < 4; i++) add(box(0.7, 0.04, 0.05, 0, 2.15 + i * 0.16, 0.78), 1, 'joint');
  // 어깨 미사일 포드
  add(rbox(0.45, 0.35, 0.6, 0.06, 0.8, 3.0, 0.05), 1, 'armor');
  for (let i = 0; i < 4; i++) add(cyl(0.05, 0.05, 0.05, 0.69 + (i % 2) * 0.22, 2.94 + Math.floor(i / 2) * 0.13, -0.27, Math.PI / 2), 1, 'glowSoft');
  // 팔
  const L = (a, b, r0, r1, bone, kind) => add(tube([d[a][2], d[a][3], d[a][4]], [d[b][2], d[b][3], d[b][4]], r0, r1, 10), bone, kind);
  for (const [sh, el, ha, sx] of [[3, 4, 5, 1], [6, 7, 8, -1]]) {
    add(rbox(0.6, 0.5, 0.65, 0.1, sx * 0.9, 2.65, 0), sh, 'armor');
    L(sh, el, 0.2, 0.18, sh, 'joint');
    add(sph(0.2, d[el][2], d[el][3], d[el][4]), el, 'joint');
    L(el, ha, 0.24, 0.26, el, 'armor');
    add(rbox(0.42, 0.4, 0.42, 0.08, d[ha][2], d[ha][3] - 0.15, d[ha][4]), ha, 'armorLight');
  }
  // 다리
  for (const [hi, kn, ft] of [[9, 10, 11], [12, 13, 14]]) {
    L(hi, kn, 0.26, 0.22, hi, 'armor');
    add(sph(0.24, d[kn][2], d[kn][3], d[kn][4]), kn, 'joint');
    add(rbox(0.3, 0.3, 0.2, 0.06, d[kn][2], d[kn][3] + 0.05, d[kn][4] - 0.2), kn, 'armorLight');
    L(kn, ft, 0.22, 0.18, kn, 'armor');
    add(rbox(0.5, 0.22, 0.8, 0.06, d[ft][2], 0.11, d[ft][4] - 0.15), ft, 'dark');
  }
  return { defs: d, geo: assemble(parts) };
}

const BUILDERS = { reaper: buildReaper, enforcer: buildEnforcer, leech: buildLeech, drone: buildDrone, mech: buildMech };
const CACHE = {};

function makeRig(type) {
  if (!CACHE[type]) CACHE[type] = BUILDERS[type]();
  const { defs, geo } = CACHE[type];
  const bones = defs.map(([name, , x, y, z]) => { const b = new THREE.Bone(); b.name = name; b.userData.abs = new THREE.Vector3(x, y, z); return b; });
  defs.forEach(([, parent], i) => {
    const b = bones[i];
    if (parent >= 0) { bones[parent].add(b); b.position.copy(b.userData.abs).sub(bones[parent].userData.abs); }
    else b.position.copy(b.userData.abs);
    b.userData.rest = b.position.clone();
  });
  const mat = makeEnemyMaterial();
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.add(bones[0]);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.castShadow = true;
  mesh.frustumCulled = true;
  return { mesh, bones, mat };
}

// 메크 방패(육각 에너지)
function mechShield() {
  const u = { uTime: { value: 0 }, uOn: { value: 1 }, uHit: { value: 0 } };
  const g = new THREE.CylinderGeometry(1.3, 1.3, 2.0, 6, 1, true, -Math.PI / 3, (Math.PI * 2) / 3);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: u,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uTime, uOn, uHit; varying vec2 vUv;
float hex(vec2 p){ p.x *= 1.1547; p.y += mod(floor(p.x), 2.0) * 0.5; p = abs(fract(p) - 0.5); return abs(max(p.x * 1.5 + p.y, p.y * 2.0) - 1.0); }
void main(){ vec2 uv = vUv * vec2(9.0, 7.0); float e = smoothstep(0.14, 0.0, hex(uv));
  float edge = smoothstep(0.06, 0.0, min(vUv.x, 1.0 - vUv.x)) + smoothstep(0.06, 0.0, min(vUv.y, 1.0 - vUv.y));
  float flick = 0.85 + 0.15 * sin(uTime * 30.0);
  float a = (0.12 + e * 0.7 + edge * 0.8) * flick * uOn + uHit * (0.4 + e);
  gl_FragColor = vec4(vec3(1.0, 0.18, 0.12) * a * 1.6, 1.0); }`,
  }));
  m.rotation.y = Math.PI; // 정면(−z)을 덮는다
  m.position.set(0, 0, 0);
  return { mesh: m, u };
}

// ── 보스: 무장 수송기 카론(일반 메시 그룹) ───────────────
function buildBoss() {
  const group = new THREE.Group();
  const mat = makeEnemyMaterial();
  const parts = [], add = (g, kind) => parts.push({ g, bone: 0, kind });
  add(rbox(3.2, 2.0, 8.5, 0.5, 0, 0, 0.5), 'armor');
  add(rbox(2.4, 1.4, 3.0, 0.45, 0, -0.1, 4.6 - 9.2), 'armor'); // 꼬리
  add(rbox(2.6, 1.2, 2.6, 0.5, 0, -0.2, -4.0), 'armorLight');   // 기수
  add(rbox(1.9, 0.7, 1.6, 0.3, 0, 0.25, -4.3), 'glass');        // 조종석 유리
  add(box(1.6, 0.05, 0.05, 0, 0.55, -5.0), 'glow');
  add(rbox(8.4, 0.35, 1.8, 0.12, 0, 0.3, -0.2), 'armor');       // 날개
  add(rbox(0.3, 2.2, 1.6, 0.1, 0, 1.2, 4.8), 'armor');          // 수직 꼬리
  add(rbox(3.4, 0.25, 1.2, 0.1, 0, 2.1, 4.9), 'armor');
  add(rbox(2.8, 0.7, 5.0, 0.3, 0, -1.1, 0.3), 'dark');         // 배
  add(box(0.06, 0.06, 6, 1.62, 0.2, 0.5), 'glowSoft');
  add(box(0.06, 0.06, 6, -1.62, 0.2, 0.5), 'glowSoft');
  for (const [x, z] of [[-1.2, -2], [1.2, -2], [-1.2, 2.5], [1.2, 2.5]]) add(box(0.08, 0.7, 0.08, x, -1.6, z), 'joint'); // 착륙 다리
  // 측면 표식
  add(rbox(0.05, 0.6, 1.6, 0.02, 1.61, 0.1, -1.3), 'accent');
  add(rbox(0.05, 0.6, 1.6, 0.02, -1.61, 0.1, -1.3), 'accent');
  const geo = assemble(parts);
  const hull = new THREE.Mesh(geo, mat); hull.castShadow = true;
  group.add(hull);
  // 엔진 2개(회전 나셀)
  const engines = [];
  for (const sx of [1, -1]) {
    const eg = new THREE.Group(); eg.position.set(sx * 4.3, 0.3, -0.5);
    const ep = [];
    ep.push({ g: cyl(0.95, 0.95, 2.2, 0, 0, 0, Math.PI / 2, 0, 0, 20), bone: 0, kind: 'armor' });
    ep.push({ g: cyl(0.8, 0.8, 2.25, 0, 0, 0, Math.PI / 2, 0, 0, 20), bone: 0, kind: 'dark' });
    const ring = new THREE.TorusGeometry(0.82, 0.07, 6, 28); ring.translate(0, 0, 1.1); ep.push({ g: ring, bone: 0, kind: 'glowOrange' });
    ep.push({ g: cyl(0.6, 0.6, 0.05, 0, 0, 1.0, Math.PI / 2, 0, 0, 20), bone: 0, kind: 'glowOrange' });
    const m = new THREE.Mesh(assemble(ep), makeEnemyMaterial()); m.castShadow = true;
    eg.add(m); group.add(eg);
    engines.push({ g: eg, mesh: m });
  }
  // 기수 미니건
  const gun = new THREE.Group(); gun.position.set(0, -1.0, -4.6);
  const gp = [{ g: cyl(0.22, 0.22, 0.4, 0, 0, 0, 0, 0, 0, 10), bone: 0, kind: 'joint' }];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; gp.push({ g: cyl(0.04, 0.04, 1.3, Math.cos(a) * 0.12, Math.sin(a) * 0.12, -0.75, Math.PI / 2, 0, 0, 6), bone: 0, kind: 'dark' }); }
  const gm = new THREE.Mesh(assemble(gp), mat); gun.add(gm); group.add(gun);
  // 탐조등 원뿔
  const cone = new THREE.Mesh(new THREE.ConeGeometry(4.5, 22, 24, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y / 22.0 + 0.5; vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(vN, vV)), 1.5); gl_FragColor = vec4(vec3(1.0, 0.92, 0.8) * f * vY * vY * 0.22, 1.0); }',
  }));
  cone.geometry.translate(0, -11, 0);
  const spot = new THREE.Group(); spot.position.set(0, -1.2, -3.5); spot.add(cone); group.add(spot);
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 0.2) }));
  navL.position.set(4.2, 0.5, -0.2); group.add(navL);
  const navR = navL.clone(); navR.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 4, 0.5) }); navR.position.x = -4.2; group.add(navR);
  return { group, mat, engines, gun, spot, navL, navR };
}

// ── 화면 쪽 적 관리 ────────────────────────────────────
export class EnemyViews {
  constructor(scene, fx) {
    this.scene = scene;
    this.fx = fx;
    this.views = new Map();
    this.pool = {};
    this.dying = [];
    this.time = 0;
  }

  get(type) {
    const p = this.pool[type] || (this.pool[type] = []);
    if (p.length) return p.pop();
    if (type === 'boss') { const b = buildBoss(); return { type, boss: b, root: b.group, mats: [b.mat, ...b.engines.map((e) => e.mesh.material)] }; }
    const rig = makeRig(type);
    const root = new THREE.Group();
    root.add(rig.mesh);
    const v = { type, root, rig, mats: [rig.mat] };
    if (type === 'mech') { const s = mechShield(); rig.bones[5].add(s.mesh); s.mesh.position.set(0.55, -0.45, -0.85); s.mesh.rotation.set(0, Math.PI, 0); v.shield = s; }
    return v;
  }

  release(v) {
    this.scene.remove(v.root);
    (this.pool[v.type] || (this.pool[v.type] = [])).push(v);
  }

  sync(world, alpha, dt) {
    this.time += dt;
    const seen = new Set();
    for (const e of world.enemies) {
      if (!e.alive) continue;
      seen.add(e.id);
      let v = this.views.get(e.id);
      if (!v) {
        v = this.get(e.type);
        v.spawnT = 0; v.e = e;
        for (const m of v.mats) { m.userData.uDissolve.value = 1; m.userData.uFlash.value = 0; m.userData.uStun.value = 0; }
        if (v.boss) v.boss.engines.forEach((en) => { en.g.visible = true; });
        this.scene.add(v.root);
        this.views.set(e.id, v);
      }
      v.e = e;
      const x = e.px + (e.x - e.px) * alpha, y = e.py + (e.y - e.py) * alpha, z = e.pz + (e.z - e.pz) * alpha;
      v.root.position.set(x, y, z);
      v.root.rotation.y = e.yaw;
      v.spawnT += dt;
      const dis = Math.max(0, 1 - v.spawnT * 2.2);
      for (const m of v.mats) {
        m.userData.uDissolve.value = dis;
        m.userData.uFlash.value = Math.max(e.flash, 0);
        m.userData.uStun.value = e.stun > 0 ? 1 : 0;
        m.userData.uTime.value = this.time;
      }
      if (v.boss) this.animBoss(v, e, dt);
      else ANIM[e.type](v.rig.bones, e, this.time, dt, v);
    }
    // 사라진 적(죽음 이벤트 없이 제거된 경우 포함)
    for (const [id, v] of this.views) {
      if (seen.has(id)) continue;
      this.views.delete(id);
      if (!v.dyingStarted) this.startDeath(v, null);
    }
    for (const v of this.dying) {
      v.deathT += dt;
      const k = Math.min(1, v.deathT / v.deathDur);
      for (const m of v.mats) m.userData.uDissolve.value = Math.max(0.0, (k - 0.25) / 0.75);
      if (v.boss) {
        v.root.position.y -= dt * (6 + v.deathT * 14); v.root.rotation.z += dt * 0.8; v.root.rotation.x += dt * 0.3;
      } else if (v.type === 'drone') {
        v.vy -= 18 * dt; v.root.position.y = Math.max(v.floorY + 0.1, v.root.position.y + v.vy * dt); v.root.rotation.x += dt * 6;
      } else {
        // 쓰러짐: 뒤로 넘어가며 가라앉음
        const fall = Math.min(1, v.deathT / 0.5);
        v.root.rotation.x = v.fallDir * fall * (Math.PI / 2.3);
        v.root.position.y = v.baseY - Math.max(0, v.deathT - 0.5) * 0.3;
        const b = v.rig.bones;
        if (b.length > 10) { b[H.LKN].rotation.x = -0.6 * fall; b[H.RKN].rotation.x = -0.4 * fall; b[H.LSH].rotation.z = 0.8 * fall; b[H.RSH].rotation.z = -0.8 * fall; }
      }
      if (v.deathT > v.deathDur) v.done = true;
    }
    this.dying = this.dying.filter((v) => { if (v.done) { v.root.rotation.set(0, 0, 0); this.release(v); return false; } return true; });
  }

  startDeath(v, ev) {
    v.dyingStarted = true;
    v.deathT = 0;
    v.deathDur = v.boss ? 3.0 : v.type === 'mech' ? 1.6 : 1.1;
    v.baseY = v.root.position.y;
    v.vy = 0; v.floorY = 0;
    v.fallDir = ev && ev.dir ? 1 : -1;
    if (ev && ev.dir) {
      // 맞은 방향으로 넘어지게: 모델 기준 앞(−z)으로 맞으면 뒤로
      const fx = -Math.sin(v.root.rotation.y), fz = -Math.cos(v.root.rotation.y);
      v.fallDir = ev.dir.x * fx + ev.dir.z * fz < 0 ? -1 : 1;
    }
    for (const m of v.mats) { m.userData.uFlash.value = 1; m.userData.uStun.value = 0; }
    this.dying.push(v);
  }

  onKill(ev) {
    const v = this.views.get(ev.id);
    if (!v) return;
    this.views.delete(ev.id);
    this.startDeath(v, ev);
  }

  viewOf(id) { return this.views.get(id); }

  animBoss(v, e, dt) {
    const b = v.boss;
    b.engines.forEach((en, i) => {
      const alive = e.engines[i] > 0;
      en.g.rotation.x = Math.sin(this.time * 0.8 + i) * 0.15 + (alive ? 0 : 0.9);
      en.mesh.material.userData.uGlow.value = alive ? 1 : 0.05;
      if (!alive && Math.random() < dt * 30) this.fx.smokePuff(en.g.getWorldPosition(new THREE.Vector3()), 1.6, 0.25);
    });
    b.gun.rotation.z += dt * (e.firing ? 40 : 2);
    b.gun.lookAt(e.firing ? new THREE.Vector3(e.gunX, e.gunY, e.gunZ) : new THREE.Vector3(0, 0, 0));
    b.spot.rotation.x = -0.5 + Math.sin(this.time * 0.7) * 0.3;
    b.spot.rotation.z = Math.sin(this.time * 0.5) * 0.4;
    const blink = Math.sin(this.time * 6) > 0.6;
    b.navL.visible = blink; b.navR.visible = blink;
    v.root.rotation.z = Math.sin(this.time * 0.6) * 0.06 + (e.engines[0] <= 0 ? 0.25 : 0) - (e.engines[1] <= 0 ? 0.25 : 0);
    v.root.rotation.x = Math.sin(this.time * 0.4) * 0.04;
  }
}

// ── 절차 애니메이션 ─────────────────────────────────────
function reset(bones) { for (const b of bones) { b.rotation.set(0, 0, 0); b.position.copy(b.userData.rest); } }
const lerp = (a, b, t) => a + (b - a) * t;

function walk(bones, ph, amt, opts = {}) {
  const sw = opts.swing ?? 0.65, kn = opts.knee ?? 1.0;
  const s = Math.sin(ph), c = Math.cos(ph);
  bones[H.LHI].rotation.x += s * sw * amt;
  bones[H.RHI].rotation.x -= s * sw * amt;
  bones[H.LKN].rotation.x -= Math.max(0, -c) * kn * amt + 0.1 * amt;
  bones[H.RKN].rotation.x -= Math.max(0, c) * kn * amt + 0.1 * amt;
  bones[H.LFT].rotation.x += Math.max(0, s) * 0.3 * amt;
  bones[H.RFT].rotation.x += Math.max(0, -s) * 0.3 * amt;
  bones[H.HIPS].position.y += Math.abs(c) * 0.05 * amt - 0.03 * amt;
  bones[H.HIPS].rotation.y += s * 0.12 * amt;
  bones[H.CHEST].rotation.y -= s * 0.18 * amt;
  if (!opts.noArms) { bones[H.LSH].rotation.x -= s * 0.5 * amt; bones[H.RSH].rotation.x += s * 0.5 * amt; bones[H.LEL].rotation.x += 0.4 * amt; bones[H.REL].rotation.x += 0.4 * amt; }
}

const ANIM = {
  reaper(bones, e, t, dt, v) {
    reset(bones);
    v.ph = (v.ph || 0) + dt * e.moveSpeed * 1.5;
    const amt = Math.min(1, e.moveSpeed / 5);
    walk(bones, v.ph, amt, { swing: 0.8, knee: 1.2 });
    bones[H.SPINE].rotation.x = -0.35 * amt;
    bones[H.HEAD].rotation.x = 0.25 * amt;
    // 칼날은 뒤로 젖힌 채 달린다
    bones[H.LSH].rotation.x += 0.5 * amt; bones[H.RSH].rotation.x += 0.5 * amt;
    bones[H.LSH].rotation.z = 0.25; bones[H.RSH].rotation.z = -0.25;
    if (e.state === 'windup') {
      const k = Math.min(1, e.t / 0.3);
      bones[H.HIPS].position.y -= 0.25 * k;
      bones[H.LHI].rotation.x += 0.9 * k; bones[H.RHI].rotation.x += 0.9 * k; bones[H.LKN].rotation.x -= 1.6 * k; bones[H.RKN].rotation.x -= 1.6 * k;
      bones[H.SPINE].rotation.x = -0.6 * k;
      bones[H.LSH].rotation.x = 1.4 * k; bones[H.RSH].rotation.x = 1.4 * k;
    } else if (e.state === 'leap') {
      bones[H.LSH].rotation.x = -2.2; bones[H.RSH].rotation.x = -2.2; bones[H.LEL].rotation.x = -0.4; bones[H.REL].rotation.x = -0.4;
      bones[H.LHI].rotation.x = 1.0; bones[H.LKN].rotation.x = -1.4; bones[H.RHI].rotation.x = -0.3; bones[H.RKN].rotation.x = -0.8;
    } else if (e.state === 'melee' || e.attackT > 0) {
      const k = Math.max(0, e.attackT / 0.3);
      const side = (Math.floor(t * 1.25) % 2) ? H.LSH : H.RSH;
      bones[side].rotation.x = lerp(-0.3, -1.9, k); bones[side].rotation.y = lerp(0, side === H.LSH ? -0.8 : 0.8, k);
      bones[H.CHEST].rotation.y = (side === H.LSH ? 0.5 : -0.5) * k;
      bones[H.SPINE].rotation.x = -0.3;
    }
    if (e.stun > 0) jitter(bones, t);
  },
  enforcer(bones, e, t, dt, v) {
    reset(bones);
    v.ph = (v.ph || 0) + dt * e.moveSpeed * 1.9;
    const amt = Math.min(1, e.moveSpeed / 3.4);
    walk(bones, v.ph, amt, { noArms: true });
    // 소총 거치 자세(팔은 가슴 앞)
    bones[H.RSH].rotation.x = -1.0; bones[H.RSH].rotation.z = 0.25; bones[H.REL].rotation.x = -0.9;
    bones[H.LSH].rotation.x = -1.25; bones[H.LSH].rotation.z = -0.55; bones[H.LEL].rotation.x = -0.75; bones[H.LEL].rotation.y = 0.4;
    const aiming = e.state === 'aim' || e.state === 'burst' || e.state === 'hold';
    if (aiming) { bones[H.CHEST].rotation.x = 0.06; bones[H.HEAD].rotation.x = 0.08; }
    if (e.attackT > 0) { const k = e.attackT / 0.15; bones[H.CHEST].rotation.x -= 0.08 * k; bones[H.CHEST].position.z += 0.03 * k; }
    if (e.state === 'evade') { bones[H.SPINE].rotation.z = 0.25; }
    if (e.stun > 0) jitter(bones, t);
  },
  leech(bones, e, t, dt, v) {
    reset(bones);
    v.ph = (v.ph || 0) + dt * e.moveSpeed * 2.0;
    const amt = Math.min(1, e.moveSpeed / 4);
    walk(bones, v.ph, amt, { swing: 0.55 });
    bones[H.SPINE].rotation.x = -0.45; bones[H.CHEST].rotation.x = -0.2; bones[H.HEAD].rotation.x = 0.55;
    bones[H.LSH].rotation.x += -0.3; bones[H.RSH].rotation.x += -0.3;
    if (e.state === 'attach') {
      bones[H.LSH].rotation.x = -1.4 + Math.sin(t * 7) * 0.06; bones[H.RSH].rotation.x = -1.5 + Math.cos(t * 6) * 0.06;
      bones[H.LEL].rotation.x = -0.2; bones[H.REL].rotation.x = -0.2;
      bones[H.HEAD].rotation.z = Math.sin(t * 3) * 0.1;
      v.mats[0].userData.uGlow.value = 1.3 + Math.sin(t * 12) * 0.5;
    } else v.mats[0].userData.uGlow.value = 1;
    if (e.stun > 0) jitter(bones, t);
  },
  drone(bones, e, t, dt, v) {
    for (let i = 1; i < 5; i++) bones[i].rotation.y += dt * (40 + i * 3);
    const bank = Math.max(-0.5, Math.min(0.5, (e.vx * Math.cos(e.yaw) - e.vz * Math.sin(e.yaw)) * 0.06));
    bones[0].rotation.z = -bank;
    bones[0].rotation.x = e.state === 'dive' ? -0.6 : -Math.min(0.3, e.moveSpeed * 0.03);
    bones[0].position.y = Math.sin(t * 5 + e.id) * 0.05;
    const blink = e.state === 'windup' ? (Math.sin(t * 40) > 0 ? 3 : 0.3) : 1;
    v.mats[0].userData.uGlow.value = blink;
  },
  mech(bones, e, t, dt, v) {
    reset(bones);
    v.ph = (v.ph || 0) + dt * e.moveSpeed * 1.4;
    const amt = Math.min(1, e.moveSpeed / 2.2);
    const s = Math.sin(v.ph), c = Math.cos(v.ph);
    bones[9].rotation.x += s * 0.45 * amt; bones[12].rotation.x -= s * 0.45 * amt;
    bones[10].rotation.x -= Math.max(0, -c) * 0.7 * amt; bones[13].rotation.x -= Math.max(0, c) * 0.7 * amt;
    bones[0].position.y += Math.abs(c) * 0.08 * amt - 0.05 * amt;
    bones[1].rotation.z = s * 0.05 * amt;
    // 방패 팔(왼쪽)은 앞으로
    bones[3].rotation.x = -0.9; bones[4].rotation.x = -0.6; bones[3].rotation.z = -0.15;
    bones[6].rotation.x = s * 0.25 * amt - 0.2;
    if (e.attackT > 0) { const k = e.attackT / 0.5; bones[6].rotation.x = -1.6 * k; bones[7].rotation.x = -0.2 * k; bones[1].rotation.y = -0.4 * k; }
    if (e.missileWarn > 0) bones[2].rotation.x = 0.1;
    if (v.shield) {
      v.shield.u.uTime.value = t;
      const on = e.shieldOff > 0 || e.stun > 0 ? 0 : 1;
      v.shield.u.uOn.value += (on - v.shield.u.uOn.value) * Math.min(1, dt * 8);
      v.shield.u.uHit.value = Math.max(0, v.shield.u.uHit.value - dt * 4);
      v.shield.mesh.visible = v.shield.u.uOn.value > 0.02 || v.shield.u.uHit.value > 0.02;
    }
    if (e.stun > 0) jitter(bones, t, 0.05);
  },
};

function jitter(bones, t, a = 0.12) {
  for (let i = 0; i < bones.length; i++) { const b = bones[i]; b.rotation.x += Math.sin(t * 53 + i * 7) * a; b.rotation.z += Math.cos(t * 47 + i * 3) * a; }
}
