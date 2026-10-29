// 적 모델: 실제 군사 로봇처럼 — 무광 군용 도장, 기계 관절, 카메라 렌즈, 작은 표시등. 빛나는 눈·에너지 방패 같은 판타지 요소 없음.
// 부품을 코드로 만들어 한 개의 SkinnedMesh로 병합(적 1기 = 그리기 1번).
// 재질은 정점 색(albedo) + 정점 속성 aMat(발광·금속·거칠기) — 피격 번쩍임·기절·사라짐은 셰이더 uniform.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from '../../vendor/three/addons/geometries/RoundedBoxGeometry.js';

// 재질 종류: [색, 발광, 금속, 거칠기]
const KINDS = {
  paint: [0x4c5249, 0, 0.12, 0.6],       // 올리브 회색 군용 도장
  paintLight: [0x70766f, 0, 0.12, 0.55],
  grey: [0x666c73, 0, 0.15, 0.48],       // 보병 로봇 외장(회색 복합재)
  greyDark: [0x3a3f45, 0, 0.15, 0.5],
  dark: [0x16181b, 0, 0.3, 0.7],
  joint: [0x2c2f34, 0, 0.85, 0.36],      // 가공 금속 관절
  steel: [0x8b9198, 0, 1.0, 0.28],
  rubber: [0x0f1011, 0, 0, 0.92],
  carbon: [0x1b1d20, 0, 0.3, 0.42],
  lens: [0x05070a, 0.15, 0.6, 0.04],     // 카메라 유리
  hazard: [0xb8921c, 0, 0.1, 0.6],
  explosive: [0x5d5c34, 0, 0, 0.85],     // 폭약(올리브 드랩)
  wireRed: [0x7a1610, 0, 0, 0.6],
  ledRed: [0xff2414, 5, 0, 0.5],
  ledAmber: [0xffa020, 5, 0, 0.5],
  ledGreen: [0x40ff70, 3, 0, 0.5],
  heat: [0xff5a14, 2.6, 0, 0.5],         // 엔진 배기 그릴의 열
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
// 앞(−z)을 보는 카메라 렌즈: 테 + 유리
function lens(add, bone, r, x, y, z, depth = 0.04) {
  add(cyl(r * 1.25, r * 1.25, depth, x, y, z, Math.PI / 2, 0, 0, 14), bone, 'dark');
  add(cyl(r, r, 0.006, x, y, z - depth / 2 - 0.002, Math.PI / 2, 0, 0, 14), bone, 'lens');
}

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

// 공용 적 재질(인스턴스마다 clone → uniform만 따로). 도장 위 미세 얼룩(거칠기 변화)으로 플라스틱처럼 매끈하지 않게
function enemyMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 1, roughness: 1, envMapIntensity: 1.0 });
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
      .replace('#include <color_fragment>', `#include <color_fragment>
// 도장 마모·때: 큰 얼룩으로 색을 조금씩 어둡게, 모서리 쪽은 살짝 밝게
float grime = dn(vObj * 4.0) * 0.6 + dn(vObj * 17.0) * 0.4;
diffuseColor.rgb *= 0.82 + grime * 0.3;`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vMat.y;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(vMat.z + (grime - 0.5) * 0.18, 0.03, 1.0);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += vColor.rgb * vMat.x * uGlow;
float rimK = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
totalEmissiveRadiance += vec3(0.3, 0.4, 0.55) * rimK * 0.1;
totalEmissiveRadiance += vec3(1.0, 0.6, 0.35) * uFlash * uFlash * 0.4;
// 기절(EMP): 표면 군데군데 작은 전기 불꽃만 튄다
float zap = step(0.985, fract(sin(dot(floor(vObj * 40.0), vec3(12.9, 78.2, 37.7)) + floor(uTime * 30.0)) * 43758.5));
totalEmissiveRadiance += vec3(0.5, 0.75, 1.6) * uStun * (0.04 + zap * 3.0);
float edge = smoothstep(uDissolve + 0.05, uDissolve, dz) * step(0.001, uDissolve);
totalEmissiveRadiance += vec3(1.2, 0.35, 0.08) * edge;`);
  };
  mat.customProgramCacheKey = () => 'enemy-v2';
  return mat;
}

export function makeEnemyMaterial() {
  const m = enemyMaterial();
  m.userData = { uFlash: { value: 0 }, uStun: { value: 0 }, uDissolve: { value: 0 }, uGlow: { value: 1 }, uTime: { value: 0 } };
  return m;
}

// ── 하운드(4족 보행 로봇개) ────────────────────────────
// 뼈: 0 몸통, 1 머리(센서), 다리 4개 × [엉덩이, 무릎, 발] (앞왼 2-4, 앞오 5-7, 뒤왼 8-10, 뒤오 11-13)
const Q = { BODY: 0, HEAD: 1, LEGS: [[2, 3, 4], [5, 6, 7], [8, 9, 10], [11, 12, 13]] };
function buildReaper() {
  const defs = [['body', -1, 0, 0.62, 0], ['head', 0, 0, 0.7, -0.5]];
  const legPos = [[0.17, -0.34], [-0.17, -0.34], [0.17, 0.34], [-0.17, 0.34]];
  for (const [x, z] of legPos) {
    const hip = defs.length;
    defs.push(['hip', 0, x * 1.05, 0.58, z], ['knee', hip, x * 1.12, 0.33, z + 0.09], ['foot', hip + 1, x * 1.12, 0.04, z - 0.01]);
  }
  const parts = [], add = (g, bone, kind) => parts.push({ g, bone, kind });
  // 몸통: 납작한 상자 + 윗판 + 옆 경고 띠 + 뒤 배터리 손잡이
  add(rbox(0.36, 0.2, 0.9, 0.05, 0, 0.64, 0), 0, 'paint');
  add(rbox(0.3, 0.05, 0.74, 0.02, 0, 0.765, 0.02), 0, 'paintLight');
  for (const x of [0.181, -0.181]) { add(box(0.004, 0.035, 0.22, x, 0.66, -0.26), 0, 'hazard'); add(box(0.006, 0.08, 0.5, x, 0.6, 0.08), 0, 'dark'); }
  add(tube([-0.1, 0.79, 0.34], [0.1, 0.79, 0.34], 0.015, 0.015, 6), 0, 'steel');
  for (const x of [-0.1, 0.1]) add(tube([x, 0.77, 0.34], [x, 0.79, 0.34], 0.015, 0.015, 6), 0, 'steel');
  // 등 위 센서 기둥 + 라이다
  add(tube([0, 0.79, 0.12], [0, 0.98, 0.12], 0.018, 0.015, 6), 0, 'joint');
  add(cyl(0.05, 0.05, 0.06, 0, 1.01, 0.12, 0, 0, 0, 14), 0, 'dark');
  add(cyl(0.052, 0.052, 0.012, 0, 1.0, 0.12, 0, 0, 0, 14), 0, 'lens');
  add(box(0.012, 0.012, 0.004, 0.0, 0.79, 0.4), 0, 'ledRed');
  // 머리: 센서 블록(앞 카메라 2개 + 깊이 센서) + 앞 충격 전극
  add(rbox(0.28, 0.16, 0.2, 0.04, 0, 0.7, -0.52), 1, 'paint');
  add(rbox(0.22, 0.08, 0.02, 0.01, 0, 0.71, -0.625), 1, 'dark');
  lens(add, 1, 0.022, 0.055, 0.71, -0.632, 0.02); lens(add, 1, 0.022, -0.055, 0.71, -0.632, 0.02);
  add(box(0.04, 0.012, 0.006, 0, 0.67, -0.636), 1, 'lens');
  for (const x of [0.1, -0.1]) { add(tube([x, 0.64, -0.6], [x * 1.1, 0.6, -0.74], 0.012, 0.008, 6), 1, 'steel'); add(sph(0.016, x * 1.1, 0.6, -0.745), 1, 'joint'); }
  // 다리: 엉덩이 구동기(옆으로 누운 원통) · 넓적다리 덮개 · 무릎 · 정강이 · 고무 발
  Q.LEGS.forEach(([hip, knee, foot], i) => {
    const H = defs[hip], K = defs[knee], F = defs[foot];
    const hp = [H[2], H[3], H[4]], kp = [K[2], K[3], K[4]], fp = [F[2], F[3], F[4]];
    add(cyl(0.065, 0.065, 0.1, hp[0], hp[1], hp[2], 0, 0, Math.PI / 2, 14), hip, 'joint');
    add(tube(hp, kp, 0.05, 0.04, 8), hip, 'paint');
    add(rbox(0.06, 0.2, 0.08, 0.02, (hp[0] + kp[0]) / 2 + Math.sign(hp[0]) * 0.02, (hp[1] + kp[1]) / 2, (hp[2] + kp[2]) / 2), hip, 'paintLight');
    add(sph(0.04, ...kp), knee, 'joint');
    add(tube(kp, fp, 0.028, 0.02, 8), knee, 'dark');
    add(sph(0.034, fp[0], fp[1], fp[2], 1, 0.8, 1), foot, 'rubber');
  });
  return { defs, geo: assemble(parts) };
}

// ── 보병 로봇(2족 인간형) ───────────────────────────────
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

function buildEnforcer() {
  const d = humanoidDefs(1.04, 1.12), parts = [], add = (g, bone, kind) => parts.push({ g, bone, kind });
  // 골반 · 허리 구동기 · 가슴(복합재 판) · 등 배터리
  add(rbox(0.34, 0.18, 0.24, 0.05, 0, 0.98, 0), H.HIPS, 'greyDark');
  add(cyl(0.11, 0.12, 0.22, 0, 1.12, 0, 0, 0, 0, 14), H.SPINE, 'joint');
  for (let i = 0; i < 3; i++) add(cyl(0.125, 0.125, 0.015, 0, 1.06 + i * 0.06, 0, 0, 0, 0, 14), H.SPINE, 'dark');
  add(rbox(0.46, 0.34, 0.28, 0.07, 0, 1.4, 0), H.CHEST, 'grey');
  add(rbox(0.34, 0.2, 0.05, 0.03, 0, 1.43, -0.15), H.CHEST, 'greyDark');
  add(box(0.06, 0.02, 0.005, 0.12, 1.5, -0.177), H.CHEST, 'hazard');
  add(rbox(0.36, 0.4, 0.16, 0.04, 0, 1.38, 0.2), H.CHEST, 'paint');
  for (let i = 0; i < 4; i++) add(box(0.26, 0.012, 0.01, 0, 1.25 + i * 0.07, 0.283), H.CHEST, 'dark');
  add(box(0.015, 0.015, 0.006, -0.13, 1.52, 0.283), H.CHEST, 'ledGreen');
  // 머리: 좁은 센서 헤드(전면 검은 유리 + 카메라 3개, 작은 표시등)
  add(cyl(0.05, 0.06, 0.1, 0, 1.6, 0, 0, 0, 0, 10), H.HEAD, 'joint');
  add(rbox(0.2, 0.17, 0.22, 0.06, 0, 1.72, -0.01), H.HEAD, 'grey');
  add(rbox(0.17, 0.08, 0.02, 0.02, 0, 1.73, -0.12), H.HEAD, 'lens');
  lens(add, H.HEAD, 0.018, 0.045, 1.73, -0.128, 0.012); lens(add, H.HEAD, 0.018, -0.045, 1.73, -0.128, 0.012); lens(add, H.HEAD, 0.012, 0, 1.69, -0.128, 0.012);
  add(box(0.012, 0.012, 0.004, 0.07, 1.78, -0.125), H.HEAD, 'ledRed');
  // 팔·다리: 어깨·팔꿈치·무릎 구동기(원통) + 외장 덮개
  for (const [sh, el, ha, x] of [[H.LSH, H.LEL, H.LHA, 1], [H.RSH, H.REL, H.RHA, -1]]) {
    add(cyl(0.085, 0.085, 0.12, x * 0.25, 1.52, 0, 0, 0, Math.PI / 2, 14), sh, 'joint');
    add(rbox(0.14, 0.12, 0.2, 0.04, x * 0.27, 1.56, 0), sh, 'grey');
    add(tube(P(d, sh), P(d, el), 0.055, 0.05, 8), sh, 'joint');
    add(rbox(0.09, 0.2, 0.1, 0.03, ...P(d, sh).map((v, k) => (v + P(d, el)[k]) / 2)), sh, 'grey');
    add(sph(0.06, ...P(d, el)), el, 'dark');
    add(tube(P(d, el), P(d, ha), 0.05, 0.042, 8), el, 'joint');
    add(rbox(0.08, 0.2, 0.09, 0.03, ...P(d, el).map((v, k) => (v + P(d, ha)[k]) / 2)), el, 'greyDark');
    add(rbox(0.07, 0.11, 0.09, 0.02, ...P(d, ha)), ha, 'dark');
  }
  for (const [hi, kn, ft] of [[H.LHI, H.LKN, H.LFT], [H.RHI, H.RKN, H.RFT]]) {
    add(tube(P(d, hi), P(d, kn), 0.08, 0.065, 8), hi, 'joint');
    add(rbox(0.13, 0.32, 0.14, 0.04, ...P(d, hi).map((v, k) => (v + P(d, kn)[k]) / 2 + (k === 2 ? -0.02 : 0))), hi, 'grey');
    add(cyl(0.07, 0.07, 0.14, ...P(d, kn), 0, 0, Math.PI / 2, 12), kn, 'joint');
    add(tube(P(d, kn), P(d, ft), 0.06, 0.05, 8), kn, 'dark');
    add(rbox(0.11, 0.3, 0.1, 0.03, ...P(d, kn).map((v, k) => (v + P(d, ft)[k]) / 2 + (k === 2 ? -0.04 : 0))), kn, 'greyDark');
    const f = P(d, ft);
    add(rbox(0.12, 0.08, 0.28, 0.03, f[0], f[1] - 0.02, f[2] - 0.06), ft, 'dark');
  }
  // 소총(오른팔에 고정) — 실제 소총 비례
  add(rbox(0.06, 0.1, 0.5, 0.015, -0.1, 1.28, -0.38), H.CHEST, 'dark');
  add(cyl(0.016, 0.016, 0.34, -0.1, 1.31, -0.8, Math.PI / 2), H.CHEST, 'steel');
  add(box(0.045, 0.16, 0.07, -0.1, 1.15, -0.42), H.CHEST, 'dark');
  add(rbox(0.05, 0.05, 0.1, 0.01, -0.1, 1.36, -0.32), H.CHEST, 'joint');
  return { defs: d, geo: assemble(parts) };
}

// ── 수리 로봇(6륜 지원 차량 + 수리 팔) ────────────────
// 뼈: 0 차체, 1-6 바퀴, 7 팔 회전대, 8 팔꿈치, 9 끝(수리 레이저)
function buildLeech() {
  const defs = [['body', -1, 0, 0, 0]];
  const wheels = [];
  for (const z of [-0.42, 0, 0.42]) for (const x of [0.4, -0.4]) { wheels.push(defs.length); defs.push(['wheel', 0, x, 0.19, z]); }
  defs.push(['turret', 0, 0, 0.82, 0.18], ['elbow', 7, 0, 1.18, 0.0], ['tip', 8, 0, 1.12, -0.42]);
  const parts = [], add = (g, bone, kind) => parts.push({ g, bone, kind });
  add(rbox(0.66, 0.3, 1.16, 0.06, 0, 0.42, 0), 0, 'paint');
  add(rbox(0.56, 0.2, 0.86, 0.05, 0, 0.66, 0.02), 0, 'paintLight');
  for (const x of [0.335, -0.335]) add(box(0.004, 0.04, 0.6, x, 0.47, 0), 0, 'hazard');
  // 위 장비함(약점) + 호박색 경광등 + 안테나
  add(rbox(0.4, 0.2, 0.34, 0.04, 0, 0.86, -0.12), 0, 'paint');
  for (let i = 0; i < 3; i++) add(box(0.3, 0.01, 0.006, 0, 0.82 + i * 0.05, -0.292), 0, 'dark');
  add(cyl(0.04, 0.045, 0.06, 0.12, 0.99, -0.2, 0, 0, 0, 10), 0, 'ledAmber');
  add(tube([-0.22, 0.76, 0.42], [-0.24, 1.6, 0.5], 0.008, 0.004, 5), 0, 'dark');
  // 앞 범퍼 카메라 2개 · 전조등
  add(rbox(0.6, 0.1, 0.06, 0.02, 0, 0.36, -0.6), 0, 'dark');
  lens(add, 0, 0.02, 0.15, 0.5, -0.585, 0.02); lens(add, 0, 0.02, -0.15, 0.5, -0.585, 0.02);
  // 바퀴(고무 + 휠)
  for (const w of wheels) {
    const [, , x, y, z] = defs[w];
    add(cyl(0.19, 0.19, 0.13, x, y, z, 0, 0, Math.PI / 2, 16), w, 'rubber');
    add(cyl(0.1, 0.1, 0.135, x, y, z, 0, 0, Math.PI / 2, 10), w, 'joint');
    for (let k = 0; k < 4; k++) add(box(0.14, 0.03, 0.03, x, y, z, k * Math.PI / 4, 0, 0), w, 'rubber');
  }
  // 수리 팔: 회전대 · 윗팔 · 아래팔 · 레이저 끝
  add(cyl(0.11, 0.13, 0.1, 0, 0.8, 0.18, 0, 0, 0, 14), 7, 'joint');
  add(tube([0, 0.84, 0.18], [0, 1.18, 0.0], 0.04, 0.035, 8), 7, 'paintLight');
  add(sph(0.05, 0, 1.18, 0.0), 8, 'joint');
  add(tube([0, 1.18, 0.0], [0, 1.12, -0.4], 0.032, 0.028, 8), 8, 'paintLight');
  add(cyl(0.035, 0.045, 0.1, 0, 1.12, -0.44, Math.PI / 2), 9, 'dark');
  add(cyl(0.02, 0.02, 0.005, 0, 1.12, -0.495, Math.PI / 2), 9, 'lens');
  return { defs, geo: assemble(parts), wheels };
}

// ── FPV 자폭 드론(쿼드콥터 + 폭약) ──────────────────────
function buildDrone() {
  const defs = [['body', -1, 0, 0, 0], ['p1', 0, 0.2, 0.04, 0.2], ['p2', 0, -0.2, 0.04, 0.2], ['p3', 0, 0.2, 0.04, -0.2], ['p4', 0, -0.2, 0.04, -0.2]];
  const parts = [], add = (g, bone, kind) => parts.push({ g, bone, kind });
  // X자 탄소 프레임 + 가운데 기판 + 위 배터리(끈) + 앞 카메라(위로 기울어짐)
  add(box(0.58, 0.014, 0.04, 0, 0, 0, 0, Math.PI / 4, 0), 0, 'carbon');
  add(box(0.58, 0.014, 0.04, 0, 0, 0, 0, -Math.PI / 4, 0), 0, 'carbon');
  add(rbox(0.12, 0.05, 0.16, 0.01, 0, 0.03, 0), 0, 'dark');
  add(rbox(0.1, 0.05, 0.17, 0.01, 0, 0.08, 0.01), 0, 'carbon');
  add(box(0.105, 0.008, 0.02, 0, 0.09, 0.0), 0, 'wireRed');
  add(rbox(0.05, 0.05, 0.05, 0.01, 0, 0.04, -0.1, -0.35), 0, 'dark');
  add(cyl(0.014, 0.014, 0.01, 0, 0.05, -0.128, Math.PI / 2 - 0.35), 0, 'lens');
  // 아래 매단 폭약(올리브 상자 + 테이프 + 기폭선)
  add(rbox(0.11, 0.08, 0.2, 0.01, 0, -0.06, 0.02), 0, 'explosive');
  for (const z of [-0.04, 0.07]) add(box(0.115, 0.085, 0.015, 0, -0.06, z), 0, 'dark');
  add(tube([0.03, -0.02, 0.1], [0.04, 0.03, 0.06], 0.004, 0.004, 4), 0, 'wireRed');
  add(box(0.014, 0.008, 0.004, 0, 0.03, 0.082), 0, 'ledRed');
  for (let i = 0; i < 4; i++) {
    const [, , x, y, z] = defs[i + 1];
    add(cyl(0.026, 0.028, 0.035, x, y - 0.02, z, 0, 0, 0, 10), 0, 'joint');
    add(box(0.25, 0.004, 0.026, x, y, z), i + 1, 'carbon');
    add(box(0.026, 0.004, 0.25, x, y, z), i + 1, 'carbon');
  }
  return { defs, geo: assemble(parts) };
}

// ── 무인 전투차량(궤도 + 원격 무장대 + 앞 장갑판) ─────────
// 뼈: 0 차체, 1 포탑(좌우), 2 총(위아래), 3-8 보기륜
function buildMech() {
  const defs = [['hull', -1, 0, 0, 0], ['turret', 0, 0, 1.38, 0.15], ['gun', 1, 0, 1.75, -0.05]];
  const roads = [];
  for (const x of [1.0, -1.0]) for (const z of [-0.8, 0, 0.8]) { roads.push(defs.length); defs.push(['road', 0, x, 0.32, z]); }
  const parts = [], add = (g, bone, kind) => parts.push({ g, bone, kind });
  // 차체 + 경사 앞판 + 옆 흙받기
  add(rbox(1.6, 0.66, 2.2, 0.08, 0, 0.92, 0.05), 0, 'paint');
  add(rbox(1.5, 0.12, 2.0, 0.04, 0, 1.28, 0.1), 0, 'paintLight');
  for (const x of [0.98, -0.98]) add(rbox(0.46, 0.06, 2.6, 0.02, x, 0.66, 0), 0, 'paint');
  // 앞 장갑판(정면 피해 70% 감소 — 두껍고 각진 판, 가장자리 경고 띠)
  add(rbox(1.95, 1.05, 0.14, 0.03, 0, 0.95, -1.3, 0.28), 0, 'paintLight');
  for (const x of [0.92, -0.92]) add(box(0.06, 0.9, 0.02, x, 0.97, -1.39, 0.28), 0, 'hazard');
  for (const [x, y] of [[0.6, 1.25], [-0.6, 1.25], [0.6, 0.7], [-0.6, 0.7]]) add(cyl(0.035, 0.035, 0.03, x, y, -1.38 + (y - 0.95) * 0.28, Math.PI / 2 - 0.28), 0, 'steel');
  // 궤도(고무 띠) + 보기륜 + 앞뒤 기동륜
  for (const x of [1.0, -1.0]) {
    add(rbox(0.36, 0.62, 2.55, 0.25, x, 0.33, 0), 0, 'rubber');
    for (const z of [-1.15, 1.15]) add(cyl(0.22, 0.22, 0.38, x, 0.4, z, 0, 0, Math.PI / 2, 14), 0, 'joint');
  }
  for (const r of roads) { const [, , x, y, z] = defs[r]; add(cyl(0.24, 0.24, 0.4, x, y, z, 0, 0, Math.PI / 2, 14), r, 'dark'); for (let k = 0; k < 3; k++) add(box(0.41, 0.06, 0.4, x, y, z, k * Math.PI / 3, 0, 0), r, 'joint'); }
  // 뒤 엔진 덮개(약점, 등 뒤 ×2.5): 배기 그릴이 달아올라 있다
  add(rbox(1.2, 0.3, 0.5, 0.04, 0, 1.15, 1.05), 0, 'dark');
  for (let i = 0; i < 5; i++) add(box(1.0, 0.03, 0.02, 0, 1.06 + i * 0.05, 1.31), 0, 'heat');
  add(cyl(0.07, 0.07, 0.3, 0.45, 1.45, 1.05, 0, 0, 0, 10), 0, 'dark');
  // 원격 무장대: 회전 받침 · 센서 머리(약점: 카메라·열상 장비) · 기관총 · 미사일 상자
  add(cyl(0.38, 0.42, 0.16, 0, 1.42, 0.15, 0, 0, 0, 18), 1, 'joint');
  add(rbox(0.5, 0.36, 0.6, 0.05, 0, 1.68, 0.12), 1, 'paint');
  add(rbox(0.34, 0.24, 0.24, 0.04, 0, 2.08, 0.05), 1, 'paintLight');
  lens(add, 1, 0.05, 0.08, 2.08, -0.08, 0.03); lens(add, 1, 0.035, -0.08, 2.1, -0.08, 0.03);
  add(box(0.015, 0.015, 0.006, 0.14, 2.17, -0.075), 1, 'ledRed');
  add(rbox(0.36, 0.3, 0.5, 0.04, 0.42, 1.78, 0.15), 1, 'paint');
  for (const [dx, dy] of [[0.35, 1.85], [0.49, 1.85], [0.35, 1.71], [0.49, 1.71]]) add(cyl(0.05, 0.05, 0.04, dx, dy, -0.11, Math.PI / 2), 1, 'dark');
  add(rbox(0.12, 0.12, 0.5, 0.02, -0.12, 1.75, -0.25), 2, 'dark');
  add(cyl(0.025, 0.025, 0.6, -0.12, 1.76, -0.75, Math.PI / 2), 2, 'steel');
  add(box(0.1, 0.12, 0.16, -0.24, 1.72, -0.1), 2, 'dark');
  // 안테나 2개
  for (const x of [0.6, -0.6]) add(tube([x, 1.3, 0.9], [x * 1.05, 2.5, 1.0], 0.012, 0.005, 5), 0, 'dark');
  return { defs, geo: assemble(parts), roads };
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
  return { mesh, bones, mat, info: CACHE[type] };
}

// ── 보스: 무인 틸트로터 건십 ───────────────────────────
function buildBoss() {
  const group = new THREE.Group();
  const mat = makeEnemyMaterial();
  const parts = [], add = (g, kind) => parts.push({ g, bone: 0, kind });
  // 동체 · 기수(센서 볼 = 약점) · 꼬리 붐 · V꼬리 · 날개
  add(rbox(2.3, 2.1, 7.6, 0.6, 0, 0, 0.3), 'paint');
  add(rbox(2.0, 1.6, 2.4, 0.6, 0, -0.15, -4.2), 'paint');
  add(rbox(1.2, 0.9, 3.6, 0.3, 0, 0.45, 5.4), 'paint');
  add(rbox(0.16, 1.6, 1.4, 0.05, 0.7, 1.25, 6.8, 0, 0, -0.5), 'paintLight');
  add(rbox(0.16, 1.6, 1.4, 0.05, -0.7, 1.25, 6.8, 0, 0, 0.5), 'paintLight');
  add(rbox(8.6, 0.32, 1.9, 0.12, 0, 1.0, -0.3), 'paintLight');
  add(rbox(2.0, 0.7, 4.2, 0.3, 0, -1.2, 0.4), 'dark');
  add(sph(0.62, 0, -0.75, -5.1), 'dark');
  add(cyl(0.3, 0.3, 0.05, 0, -0.75, -5.7, Math.PI / 2, 0, 0, 16), 'lens');
  add(cyl(0.16, 0.16, 0.05, 0.32, -0.6, -5.66, Math.PI / 2, 0, 0, 12), 'lens');
  for (const x of [1.16, -1.16]) add(box(0.02, 0.2, 1.6, x, 0.2, -1.0), 'hazard');
  for (const [x, z] of [[-1.0, -2.2], [1.0, -2.2], [-1.0, 2.6], [1.0, 2.6]]) add(box(0.1, 0.8, 0.1, x, -1.7, z), 'joint');
  add(box(0.2, 0.06, 0.06, 0, 1.06, 6.2), 'ledRed');
  const geo = assemble(parts);
  const hull = new THREE.Mesh(geo, mat); hull.castShadow = true;
  group.add(hull);
  // 날개 끝 엔진 나셀 2개(헬리콥터 자세로 세움) + 3날 프롭로터
  const engines = [];
  for (const sx of [1, -1]) {
    const eg = new THREE.Group(); eg.position.set(sx * 4.3, 1.0, -0.4);
    const ep = [];
    ep.push({ g: rbox(0.9, 2.4, 1.0, 0.35, 0, 0.2, 0), bone: 0, kind: 'paint' });
    ep.push({ g: cyl(0.25, 0.32, 0.5, 0, 1.55, 0, 0, 0, 0, 14), bone: 0, kind: 'joint' });
    for (let i = 0; i < 4; i++) ep.push({ g: box(0.7, 0.03, 0.04, 0, -0.95, -0.3 + i * 0.2), bone: 0, kind: 'heat' });
    const m = new THREE.Mesh(assemble(ep), makeEnemyMaterial()); m.castShadow = true;
    eg.add(m);
    const rotor = new THREE.Group(); rotor.position.y = 1.85; eg.add(rotor);
    const blades = [];
    for (let i = 0; i < 3; i++) { const b = box(4.6, 0.05, 0.36, 2.3, 0, 0); b.rotateY((i / 3) * Math.PI * 2); blades.push({ g: b, bone: 0, kind: 'dark' }); }
    blades.push({ g: cyl(0.3, 0.2, 0.3, 0, 0, 0, 0, 0, 0, 12), bone: 0, kind: 'joint' });
    const rm = new THREE.Mesh(assemble(blades), mat); rotor.add(rm);
    group.add(eg);
    engines.push({ g: eg, mesh: m, rotor });
  }
  // 기수 아래 기관포(회전 총열)
  const gun = new THREE.Group(); gun.position.set(0, -1.4, -3.9);
  const gp = [{ g: cyl(0.22, 0.22, 0.4, 0, 0, 0, 0, 0, 0, 10), bone: 0, kind: 'joint' }];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; gp.push({ g: cyl(0.04, 0.04, 1.3, Math.cos(a) * 0.12, Math.sin(a) * 0.12, -0.75, Math.PI / 2, 0, 0, 6), bone: 0, kind: 'dark' }); }
  const gm = new THREE.Mesh(assemble(gp), mat); gun.add(gm); group.add(gun);
  // 탐조등 원뿔
  const cone = new THREE.Mesh(new THREE.ConeGeometry(4.5, 22, 24, 1, true), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y / 22.0 + 0.5; vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(vN, vV)), 1.5); gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * f * vY * vY * 0.16, 1.0); }',
  }));
  cone.geometry.translate(0, -11, 0);
  const spot = new THREE.Group(); spot.position.set(0, -1.3, -3.2); spot.add(cone); group.add(spot);
  // 항법등(왼쪽 빨강 · 오른쪽 초록, 실제 항공 규칙)
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 0.15) }));
  navL.position.set(-4.4, 1.05, -1.2); group.add(navL);
  const navR = navL.clone(); navR.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 4, 0.5) }); navR.position.x = 4.4; group.add(navR);
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
    this._v = new THREE.Vector3();
  }

  get(type) {
    const p = this.pool[type] || (this.pool[type] = []);
    if (p.length) return p.pop();
    if (type === 'boss') { const b = buildBoss(); return { type, boss: b, root: b.group, mats: [b.mat, ...b.engines.map((e) => e.mesh.material)] }; }
    const rig = makeRig(type);
    const root = new THREE.Group();
    root.add(rig.mesh);
    return { type, root, rig, mats: [rig.mat] };
  }

  release(v) {
    this.scene.remove(v.root);
    (this.pool[v.type] || (this.pool[v.type] = [])).push(v);
  }

  sync(world, alpha, dt) {
    this.time += dt;
    this.player = world.player;
    const seen = new Set();
    for (const e of world.enemies) {
      if (!e.alive) continue;
      seen.add(e.id);
      let v = this.views.get(e.id);
      if (!v) {
        v = this.get(e.type);
        v.spawnT = 0; v.e = e;
        v.drop = e.type !== 'drone' && e.type !== 'boss' && e.y > 3; // 수송 드론이 떨어뜨림
        for (const m of v.mats) { m.userData.uDissolve.value = 0; m.userData.uFlash.value = 0; m.userData.uStun.value = 0; }
        if (v.boss) v.boss.engines.forEach((en) => { en.g.visible = true; });
        this.scene.add(v.root);
        this.views.set(e.id, v);
      }
      v.e = e;
      const x = e.px + (e.x - e.px) * alpha, y = e.py + (e.y - e.py) * alpha, z = e.pz + (e.z - e.pz) * alpha;
      v.spawnT += dt;
      const fall = v.drop ? Math.max(0, 1 - v.spawnT / 0.45) : 0;
      v.root.position.set(x, y + fall * fall * 7, z);
      v.root.rotation.y = e.yaw;
      if (v.drop && fall <= 0 && !v.landed) { v.landed = true; this.fx.smokePuff({ x, y: y + 0.2, z }, 1.4, 1.0, 0.3); }
      for (const m of v.mats) {
        m.userData.uFlash.value = Math.max(e.flash, 0);
        m.userData.uStun.value = e.stun > 0 ? 1 : 0;
        m.userData.uTime.value = this.time;
      }
      // 피격 반동: 새로 맞은 순간(번쩍임이 다시 1이 됨) 짧게 움찔
      if (e.flash > (v.lastFlash || 0) + 0.3) v.hitK = 1;
      v.lastFlash = e.flash;
      v.hitK = Math.max(0, (v.hitK || 0) - dt * 7);
      if (v.boss) this.animBoss(v, e, dt);
      else { ANIM[e.type](v.rig.bones, e, this.time, dt, v, this); if (v.hitK > 0) flinch(v.rig.bones, e.type, v.hitK); }
    }
    for (const [id, v] of this.views) {
      if (seen.has(id)) continue;
      this.views.delete(id);
      if (!v.dyingStarted) this.startDeath(v, null);
    }
    for (const v of this.dying) {
      v.deathT += dt;
      const k = Math.min(1, v.deathT / v.deathDur);
      // 쓰러진 뒤 잠깐 놓여 있다가(연기) 사라진다
      for (const m of v.mats) { m.userData.uDissolve.value = Math.max(0, (k - 0.6) / 0.4); m.userData.uFlash.value *= Math.exp(-dt * 12); }
      if (v.boss) {
        v.root.position.y -= dt * (6 + v.deathT * 14); v.root.rotation.z += dt * 0.8; v.root.rotation.x += dt * 0.3;
      } else if (v.type === 'drone') {
        v.vy -= 18 * dt; v.root.position.y = Math.max(v.floorY + 0.1, v.root.position.y + v.vy * dt); v.root.rotation.x += dt * 6;
      } else {
        const f = Math.min(1, v.deathT / 0.45);
        const b = v.rig.bones;
        if (v.type === 'enforcer') {
          // 무릎이 먼저 꺾이고(0~0.25초) 중력으로 점점 빨라지며 쓰러진 뒤 바닥에서 한 번 튄다
          const kb = Math.min(1, v.deathT / 0.25), fallT = Math.max(0, v.deathT - 0.12) / 0.55;
          const fall = fallT < 1 ? fallT * fallT : 1 + Math.sin(Math.min(1, (fallT - 1) * 4) * Math.PI) * 0.06 * Math.exp(-(fallT - 1) * 3);
          v.root.rotation.x = v.fallDir * Math.min(1.06, fall) * (Math.PI / 2.15);
          v.root.position.y = v.baseY - 0.25 * kb;
          b[H.LKN].rotation.x = -1.1 * kb; b[H.RKN].rotation.x = -0.8 * kb; b[H.LHI].rotation.x = 0.6 * kb; b[H.RHI].rotation.x = 0.4 * kb;
          b[H.LSH].rotation.z = 0.9 * kb; b[H.RSH].rotation.z = -0.7 * kb; b[H.HEAD].rotation.x = -0.4 * v.fallDir * kb;
        } else if (v.type === 'reaper') {
          // 다리가 풀리며 주저앉고 옆으로 기운다
          b[0].position.y = b[0].userData.rest.y - 0.4 * f;
          for (const [hip, knee] of Q.LEGS) { b[hip].rotation.z = (hip === 2 || hip === 8 ? 1 : -1) * 0.9 * f; b[knee].rotation.x = -0.8 * f; }
          v.root.rotation.z = 0.35 * f * v.fallDir;
        } else if (v.type === 'leech') {
          v.root.rotation.z = 0.2 * f * v.fallDir; b[8].rotation.x = 0.9 * f;
        } else if (v.type === 'mech') {
          b[1].rotation.x = 0.15 * f; b[2].rotation.x = 0.5 * f;
        }
        if (Math.random() < dt * (v.type === 'mech' ? 30 : 10)) this.fx.smokePuff({ x: v.root.position.x, y: v.root.position.y + (v.type === 'mech' ? 1.4 : 0.6), z: v.root.position.z }, v.type === 'mech' ? 1.2 : 0.5, 1.2, 0.2);
      }
      if (v.deathT > v.deathDur) v.done = true;
    }
    this.dying = this.dying.filter((v) => { if (v.done) { v.root.rotation.set(0, 0, 0); this.release(v); return false; } return true; });
  }

  startDeath(v, ev) {
    v.dyingStarted = true;
    v.deathT = 0;
    v.deathDur = v.boss ? 3.0 : v.type === 'mech' ? 2.6 : 1.8;
    v.baseY = v.root.position.y;
    v.vy = 0; v.floorY = 0;
    v.fallDir = ev && ev.dir ? 1 : -1;
    if (ev && ev.dir) {
      const fx = -Math.sin(v.root.rotation.y), fz = -Math.cos(v.root.rotation.y);
      v.fallDir = ev.dir.x * fx + ev.dir.z * fz < 0 ? -1 : 1;
    }
    for (const m of v.mats) { m.userData.uFlash.value = 0.45; m.userData.uStun.value = 0; }
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
      en.g.rotation.x = Math.sin(this.time * 0.8 + i) * 0.12 + (alive ? 0 : 0.9);
      en.rotor.rotation.y += dt * (alive ? 24 : 2) * (i ? -1 : 1);
      en.mesh.material.userData.uGlow.value = alive ? 1 : 0.05;
      if (!alive && Math.random() < dt * 30) this.fx.smokePuff(en.g.getWorldPosition(this._v), 1.6, 0.25);
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

// 플레이어 쪽 상대 각도(모델 기준)
function relYaw(e, p) { let a = Math.atan2(-(p.x - e.x), -(p.z - e.z)) - e.yaw; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

const ANIM = {
  // 4족 속보: 대각선 다리 쌍(앞왼+뒤오 / 앞오+뒤왼)이 번갈아 딛는다
  reaper(bones, e, t, dt, v, views) {
    reset(bones);
    v.ph = (v.ph || 0) + dt * e.moveSpeed * 2.6;
    const amt = Math.min(1, e.moveSpeed / 4);
    const off = [0, Math.PI, Math.PI, 0];
    Q.LEGS.forEach(([hip, knee], i) => {
      const s = Math.sin(v.ph + off[i]), c = Math.cos(v.ph + off[i]);
      bones[hip].rotation.x = s * 0.55 * amt;
      bones[knee].rotation.x = -Math.max(0, c) * 0.9 * amt;
    });
    bones[0].position.y += Math.abs(Math.cos(v.ph)) * 0.035 * amt;
    bones[0].rotation.x = -0.05 * amt;
    bones[1].rotation.x = Math.sin(t * 1.3 + e.id) * 0.06;
    { const p = views.player; const a = p ? Math.max(-0.6, Math.min(0.6, relYaw(e, p))) : 0; bones[1].rotation.y = a * 0.8 + Math.sin(t * 0.9 + e.id * 2) * 0.06 * (1 - amt); }
    if (e.state === 'windup') {
      // 도약 준비: 몸을 낮추고 뒷다리를 접는다
      const k = Math.min(1, e.t / 0.3);
      bones[0].position.y -= 0.16 * k; bones[0].rotation.x = 0.12 * k;
      for (const [hip, knee] of Q.LEGS) { bones[hip].rotation.x = -0.35 * k; bones[knee].rotation.x = 0.7 * k; }
      bones[1].rotation.x = -0.15 * k;
    } else if (e.state === 'leap') {
      bones[0].rotation.x = -0.2;
      bones[Q.LEGS[0][0]].rotation.x = 0.9; bones[Q.LEGS[1][0]].rotation.x = 0.9;
      bones[Q.LEGS[2][0]].rotation.x = -0.9; bones[Q.LEGS[3][0]].rotation.x = -0.9;
    } else if (e.state === 'melee' || e.attackT > 0) {
      // 들이받기 + 전극: 머리를 내밀어 찌른다
      const k = Math.max(0, e.attackT / 0.3);
      bones[1].position.z -= 0.12 * k; bones[1].rotation.x = 0.25 * k;
      bones[0].rotation.x = 0.1 * k;
    }
    if (e.stun > 0) jitter(bones, t, 0.08);
  },
  enforcer(bones, e, t, dt, v, views) {
    reset(bones);
    v.ph = (v.ph || 0) + dt * e.moveSpeed * 1.9;
    const amt = Math.min(1, e.moveSpeed / 3.4);
    walk(bones, v.ph, amt, { noArms: true });
    // 상체·머리는 플레이어를 따라 돈다(다리는 이동 방향) — 실제 보병처럼 걸으면서 겨눈다
    const p = views.player;
    if (p) {
      const a = Math.max(-0.9, Math.min(0.9, relYaw(e, p)));
      v.aimYaw = (v.aimYaw ?? 0) + (a - (v.aimYaw ?? 0)) * Math.min(1, dt * 6);
      bones[H.SPINE].rotation.y += v.aimYaw * 0.45; bones[H.CHEST].rotation.y += v.aimYaw * 0.35; bones[H.HEAD].rotation.y += v.aimYaw * 0.2;
      const pitch = Math.atan2(p.y + 1.3 - (e.y + 1.5), Math.hypot(p.x - e.x, p.z - e.z));
      bones[H.CHEST].rotation.x += -pitch * 0.6;
    }
    // 소총 거치 자세(팔은 가슴 앞)
    // 뼈 회전 +x = 팔이 앞(−z)으로 들림
    bones[H.RSH].rotation.x = 0.75; bones[H.RSH].rotation.z = -0.12; bones[H.REL].rotation.x = 0.85;
    bones[H.LSH].rotation.x = 1.05; bones[H.LSH].rotation.z = -0.45; bones[H.LEL].rotation.x = 0.7; bones[H.LEL].rotation.y = -0.3;
    const aiming = e.state === 'aim' || e.state === 'burst' || e.state === 'hold';
    v.aimK = (v.aimK || 0) + ((aiming ? 1 : 0) - (v.aimK || 0)) * Math.min(1, dt * 8);
    const ak = v.aimK;
    // 겨눌 때: 무릎을 굽혀 자세를 낮추고(전술 자세) 총을 어깨에 붙인다
    bones[H.HIPS].position.y -= 0.06 * ak; bones[H.LHI].rotation.x += 0.25 * ak; bones[H.RHI].rotation.x += 0.1 * ak; bones[H.LKN].rotation.x -= 0.45 * ak; bones[H.RKN].rotation.x -= 0.3 * ak;
    bones[H.CHEST].rotation.x += 0.06 * ak; bones[H.RSH].rotation.x += 0.18 * ak; bones[H.LSH].rotation.x += 0.18 * ak;
    if (!aiming) bones[H.HEAD].rotation.y += Math.sin(t * 0.7 + e.id) * 0.2 * (1 - ak);
    if (e.attackT > 0) { const k = e.attackT / 0.15; bones[H.CHEST].rotation.x -= 0.08 * k; bones[H.CHEST].position.z += 0.03 * k; }
    if (e.state === 'evade') { bones[H.SPINE].rotation.z = 0.25; }
    if (e.stun > 0) jitter(bones, t);
  },
  // 수리 로봇: 바퀴가 굴러가고, 수리 중엔 팔이 대상 쪽을 향한다
  leech(bones, e, t, dt, v) {
    reset(bones);
    v.roll = (v.roll || 0) + dt * e.moveSpeed / 0.19;
    for (let i = 1; i <= 6; i++) bones[i].rotation.x = -v.roll;
    bones[0].position.y = Math.sin(t * 9 + e.id) * 0.006 * Math.min(1, e.moveSpeed);
    const o = e.state === 'heal' && e.healTarget;
    if (o) {
      const a = relYaw(e, o);
      bones[7].rotation.y = a;
      const dy = (o.y + 0.9) - (e.y + 1.1), dd = Math.hypot(o.x - e.x, o.z - e.z);
      bones[8].rotation.x = Math.atan2(dy, dd) * 0.8 - 0.1;
    } else { bones[7].rotation.y = Math.sin(t * 0.8 + e.id) * 0.6; bones[8].rotation.x = -0.25; }
    v.mats[0].userData.uGlow.value = Math.sin(t * 7) > 0 ? 1.4 : 0.3;     // 경광등 점멸
    if (e.stun > 0) jitter(bones, t, 0.05);
  },
  drone(bones, e, t, dt, v) {
    for (let i = 1; i < 5; i++) bones[i].rotation.y += dt * (60 + i * 3);
    const bank = Math.max(-0.5, Math.min(0.5, (e.vx * Math.cos(e.yaw) - e.vz * Math.sin(e.yaw)) * 0.06));
    bones[0].rotation.z = -bank;
    bones[0].rotation.x = e.state === 'dive' ? -0.7 : -Math.min(0.35, e.moveSpeed * 0.035);
    bones[0].position.y = Math.sin(t * 5 + e.id) * 0.04;
    v.mats[0].userData.uGlow.value = e.state === 'windup' ? (Math.sin(t * 40) > 0 ? 2.5 : 0.2) : 1;
  },
  // 무인 전투차량: 보기륜 회전, 무장대는 플레이어를 따라 돈다
  mech(bones, e, t, dt, v, views) {
    reset(bones);
    v.roll = (v.roll || 0) + dt * e.moveSpeed / 0.24;
    for (const r of v.rig.info.roads) bones[r].rotation.x = -v.roll;
    bones[0].position.y = Math.sin(t * 14) * 0.008 * Math.min(1, e.moveSpeed);
    const p = views.player;
    if (p) {
      const target = Math.max(-1.4, Math.min(1.4, relYaw(e, p)));
      v.tYaw = (v.tYaw ?? 0) + (target - (v.tYaw ?? 0)) * Math.min(1, dt * 3);
      bones[1].rotation.y = v.tYaw;
      bones[2].rotation.x = Math.max(-0.2, Math.min(0.4, Math.atan2(p.y + 1 - (e.y + 1.75), Math.hypot(p.x - e.x, p.z - e.z))));
    }
    if (e.attackT > 0) bones[0].rotation.x = -0.05 * (e.attackT / 0.5);
    // EMP로 장갑 판정이 꺼진 동안: 장갑판에서 전기 불꽃
    if ((e.shieldOff > 0 || e.stun > 0) && Math.random() < dt * 12) {
      const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
      views.fx.sparkBurst({ x: e.x + fx * 1.4 + (Math.random() - 0.5) * 1.6 * fz, y: e.y + 0.5 + Math.random() * 0.9, z: e.z + fz * 1.4 - (Math.random() - 0.5) * 1.6 * fx }, 4, null, [0.6, 1.4, 3], 3, 0.04, 0.25);
    }
    if (e.stun > 0) jitter(bones, t, 0.02);
  },
};

// 맞은 순간 움찔: 몸통이 뒤로 젖혀졌다 돌아온다
function flinch(bones, type, k) {
  const a = k * k;
  if (type === 'enforcer') { bones[H.CHEST].rotation.x -= 0.22 * a; bones[H.HEAD].rotation.x -= 0.18 * a; bones[H.SPINE].rotation.z += 0.08 * a; }
  else if (type === 'reaper') { bones[0].rotation.x += 0.12 * a; bones[1].rotation.x -= 0.25 * a; bones[0].position.y -= 0.03 * a; }
  else if (type === 'leech') { bones[0].rotation.z += 0.05 * a; }
  else if (type === 'mech') { bones[1].rotation.y += 0.06 * a; }
}

function jitter(bones, t, a = 0.12) {
  for (let i = 0; i < bones.length; i++) { const b = bones[i]; b.rotation.x += Math.sin(t * 53 + i * 7) * a; b.rotation.z += Math.cos(t * 47 + i * 3) * a; }
}
