// 1인칭 총 · 장갑 손 모델. 상자를 쌓지 않고 옆모습 윤곽(실루엣)을 그려 두께만큼 깎아 낸다(Extrude + 모서리 베벨).
// 좌표: 총 앞 = −z, 위 = +y, 오른쪽 = +x. 단위 m(실제 총 치수).
// 재질은 3d-metal-material 원칙: 금속은 metalness 1 + F0 색, 거칠기는 상수가 아니라 얼룩·잔흠집·결로 변한다.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from '../../vendor/three/addons/geometries/RoundedBoxGeometry.js';
import { HAND } from './handData.js';

// ── 윤곽 도우미 ──────────────────────────────────────────
// 점 [z, y, 둥글기]로 닫힌 경로. 둥글기가 있으면 그 꼭짓점을 곡선으로 깎는다.
function path(pts, P = new THREE.Shape()) {
  const n = pts.length;
  const at = (i) => pts[(i + n) % n];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  for (let i = 0; i < n; i++) {
    const [x, y, r = 0] = at(i);
    if (!r) { i === 0 ? P.moveTo(x, y) : P.lineTo(x, y); continue; }
    const prev = at(i - 1), next = at(i + 1);
    const dp = Math.hypot(prev[0] - x, prev[1] - y), dn = Math.hypot(next[0] - x, next[1] - y);
    const a = lerp([x, y], prev, Math.min(0.5, r / dp)), b = lerp([x, y], next, Math.min(0.5, r / dn));
    i === 0 ? P.moveTo(a[0], a[1]) : P.lineTo(a[0], a[1]);
    P.quadraticCurveTo(x, y, b[0], b[1]);
  }
  P.closePath();
  return P;
}
const hole = (pts) => path(pts, new THREE.Path());

// 옆모습 윤곽(z,y)을 x 방향으로 width만큼 두껍게. 가운데 x = cx
function side(pts, width, { holes = [], bevel = 0.0022, cx = 0, seg = 8 } = {}) {
  const s = path(pts);
  for (const h of holes) s.holes.push(hole(h));
  const bt = Math.min(bevel, width * 0.3);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.0005, width - bt * 2), bevelEnabled: bt > 0, bevelThickness: bt, bevelSize: bt * 0.8, bevelSegments: 3, curveSegments: seg });
  g.rotateY(-Math.PI / 2);                 // 회전(반전 아님 → 면 방향 유지): 윤곽 x → 총 z, 두께 방향 → 총 −x
  g.translate(cx + (width - bt * 2) / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}
// 앞모습 윤곽(x,y)을 z 방향으로 depth만큼(조준경 테두리 등). z0부터 앞(−z)으로
function front(pts, depth, z0, { holes = [], bevel = 0.0012, seg = 6 } = {}) {
  const s = path(pts);
  for (const h of holes) s.holes.push(hole(h));
  const bt = Math.min(bevel, depth * 0.3);
  const g = new THREE.ExtrudeGeometry(s, { depth: depth - bt * 2, bevelEnabled: bt > 0, bevelThickness: bt, bevelSize: bt * 0.8, bevelSegments: 2, curveSegments: seg });
  g.translate(0, 0, z0 - (depth - bt * 2) - bt); // 뒷면 = z0, 앞면 = z0 − depth
  return g;
}
// z축을 따라 도는 회전체: 프로파일 [반지름, z]
function lathe(prof, segs = 24, cy = 0, cx = 0) {
  if (prof[0][1] > prof[prof.length - 1][1]) prof = [...prof].reverse(); // 면 방향(바깥)을 맞춘다: 프로파일은 z가 커지는 순서여야 한다
  const g = new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(r, z)), segs);
  g.rotateX(Math.PI / 2); // 회전축 y → z(프로파일 높이 = 총 z)
  g.translate(cx, cy, 0);
  return g;
}
const rbox = (w, h, d, r, x, y, z) => { const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)); g.translate(x, y, z); return g; };
const box = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
const cylZ = (r, len, x, y, z, seg = 16) => { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateX(Math.PI / 2); g.translate(x, y, z); return g; };
const merge = (list) => mergeGeometries(list.map((g) => { let n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal'].includes(k)) n.deleteAttribute(k); return n; }), false);

// 피카티니 레일(이빨 포함) z0 → z1(앞으로), 윗면 y
function picatinny(z0, z1, y, width = 0.021, pitch = 0.01, tooth = 0.0052, th = 0.0042) {
  const parts = [box(width * 0.82, 0.004, z0 - z1, 0, y - 0.002, (z0 + z1) / 2)];
  for (let z = z0 - 0.004; z > z1 + 0.003; z -= pitch) parts.push(box(width, th, tooth, 0, y + th / 2, z));
  return merge(parts);
}

// ── 재질 ─────────────────────────────────────────────────
// 거칠기 변화(지문 얼룩 · 두 방향 잔흠집 · 미세 결) + 모서리 마모(밝은 금속이 드러남)를 셰이더로
function finishMaterial(params, { smear = 0.1, scratch = 0.18, grain = 0.03, wear = 0, bump = 0, bumpF = 900, camo = 0, key }) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSmear = { value: smear }; sh.uniforms.uScratch = { value: scratch }; sh.uniforms.uGrain = { value: grain }; sh.uniforms.uWear = { value: wear }; sh.uniforms.uBump = { value: bump }; sh.uniforms.uBumpF = { value: bumpF }; sh.uniforms.uCamo = { value: camo };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position; vON = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vOP; varying vec3 vON; uniform float uSmear, uScratch, uGrain, uWear, uBump, uBumpF, uCamo;
float gh(vec3 p){ p = fract(p * 0.3183 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(gh(i), gh(i+vec3(1,0,0)), f.x), mix(gh(i+vec3(0,1,0)), gh(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(gh(i+vec3(0,0,1)), gh(i+vec3(1,0,1)), f.x), mix(gh(i+vec3(0,1,1)), gh(i+vec3(1,1,1)), f.x), f.y), f.z); }
float scr(vec3 p, vec3 dir, float freq){ float d = dot(p, dir) * freq; float line = abs(fract(d) - 0.5);
  float mask = step(0.72, gn(p * 40.0 + dir * 7.0)); return smoothstep(0.035, 0.0, line) * mask; }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
if (uCamo > 0.0) {   // 위장 무늬(어두운 올리브 바탕 + 모래색·검은 얼룩): 천 좌표에 붙은 덩어리 잡음
  float c1 = gn(vOP * 34.0 + 1.3) + 0.45 * gn(vOP * 95.0), c2 = gn(vOP * 48.0 + 7.1) + 0.4 * gn(vOP * 120.0 + 2.0);
  vec3 col = vec3(0.05, 0.055, 0.042);
  col = mix(col, vec3(0.064, 0.072, 0.05), smoothstep(0.5, 0.56, gn(vOP * 22.0 + 5.0)));
  col = mix(col, vec3(0.1, 0.092, 0.07), smoothstep(0.86, 0.9, c1));
  col = mix(col, vec3(0.022, 0.024, 0.022), smoothstep(0.84, 0.88, c2));
  diffuseColor.rgb = col * (0.95 + 0.1 * gn(vOP * 260.0));
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
{ vec3 p = vOP;
  float fw = max(length(dFdx(p)), length(dFdy(p)));
  float sm = gn(p * 45.0) * gn(p * 13.0 + 3.1);
  float s1 = scr(p, normalize(vec3(0.3, 0.2, 1.0)), 900.0), s2 = scr(p + 1.7, normalize(vec3(1.0, -0.4, 0.2)), 700.0);
  float grain = gn(p * 2600.0) - 0.5;
  float fade = 1.0 - smoothstep(0.15, 0.8, fw * 900.0);
  roughnessFactor = clamp(roughnessFactor + sm * uSmear + (s1 + s2) * uScratch * fade + grain * uGrain * (1.0 - smoothstep(0.15, 0.8, fw * 2600.0)), 0.04, 1.0); }`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
{ float edgeK = 1.0 - max(abs(vON.x), max(abs(vON.y), abs(vON.z)));
  float w = smoothstep(0.12, 0.3, edgeK) * step(0.35, gn(vOP * 180.0)) * uWear;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.43, 0.45), w);
  metalnessFactor = mix(metalnessFactor, 1.0, w);
  roughnessFactor = mix(roughnessFactor, 0.28, w); }`);
  };
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh) => {
    prev(sh);
    // 표면 요철(노멀 교란): 높이 = 잡음, 화면 미분으로 기울기 → 픽셀보다 잘면 끈다
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
if (uBump > 0.0) {
  float fwb = max(length(dFdx(vOP)), length(dFdy(vOP))) * uBumpF;
  float amp = uBump * (1.0 - smoothstep(0.25, 0.9, fwb));
  float hh = gn(vOP * uBumpF) + 0.5 * gn(vOP * uBumpF * 2.3 + 4.1);
  vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
  vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dFdx(hh) * r1 + dFdy(hh) * r2) * amp;
  // 아주 작은·비스듬한 면에선 det·grad가 0에 가까워 normalize(0) = NaN → 화면에 검은 얼룩(블룸이 번진다). 길이가 있을 때만
  vec3 nb = abs(det) * normal - grad;
  if (dot(nb, nb) > 1e-16) normal = normalize(nb);
}`);
  };
  m.customProgramCacheKey = () => 'finish-' + key;
  return m;
}
const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);

export function gunMaterials(envMap) {
  const M = {
    // 흑착색 강철(슬라이드·총열): 금속, 어두운 F0
    steel: finishMaterial({ color: lin(0.26, 0.265, 0.275), metalness: 1, roughness: 0.3, envMapIntensity: 0.9 }, { smear: 0.12, scratch: 0.2, grain: 0.03, wear: 0.9, key: 'steel' }),
    // 맨 강철(총구·볼트·방아쇠)
    bright: finishMaterial({ color: lin(0.56, 0.57, 0.58), metalness: 1, roughness: 0.2, envMapIntensity: 0.85 }, { smear: 0.1, scratch: 0.22, grain: 0.025, key: 'bright' }),
    // 경질 아노다이징 알루미늄(리시버): 금속, 아주 어두운 F0, 무광
    anod: finishMaterial({ color: lin(0.2, 0.205, 0.215), metalness: 1, roughness: 0.42, envMapIntensity: 1.0 }, { smear: 0.08, scratch: 0.15, grain: 0.04, wear: 1, key: 'anod' }),
    // 세라코트(군청 회색 도장): 비금속
    cerakote: finishMaterial({ color: lin(0.11, 0.115, 0.125), metalness: 0, roughness: 0.48, envMapIntensity: 0.8 }, { smear: 0.1, scratch: 0.12, grain: 0.05, wear: 0.8, key: 'cera' }),
    // 건메탈 아노다이징(리시버·슬라이드 판): 밝은 회색 금속 — 검은 폴리머와 두 톤으로 부품이 구분된다
    gunmetal: finishMaterial({ color: lin(0.17, 0.174, 0.182), metalness: 0.55, roughness: 0.4, envMapIntensity: 1.0 }, { smear: 0.1, scratch: 0.2, grain: 0.04, wear: 0.9, key: 'gunmetal' }),
    // 회색 폴리머 프레임(권총)
    polyGrey: finishMaterial({ color: lin(0.1, 0.103, 0.108), metalness: 0, roughness: 0.58, envMapIntensity: 0.7 }, { smear: 0.1, scratch: 0.04, grain: 0.08, bump: 0.0005, bumpF: 2200, key: 'polygrey' }),
    // 작은 강조색(조정간 표시·경고 띠) — 한두 군데만
    accent: new THREE.MeshStandardMaterial({ color: lin(0.85, 0.3, 0.05), metalness: 0, roughness: 0.5 }),
    // 강화 폴리머(프레임·손잡이·개머리판)
    polymer: finishMaterial({ color: lin(0.05, 0.051, 0.056), metalness: 0, roughness: 0.6, envMapIntensity: 0.7 }, { smear: 0.12, scratch: 0.05, grain: 0.12, bump: 0.0004, bumpF: 2400, key: 'poly' }),
    // 플랫 다크 어스(FDE) 폴리머 가구 · 같은 색 세라코트(핸드가드) · 올리브(산탄총) — 검은 금속과 두 톤으로 부품이 갈린다
    fde: finishMaterial({ color: lin(0.165, 0.128, 0.085), metalness: 0, roughness: 0.62, envMapIntensity: 0.7 }, { smear: 0.12, scratch: 0.06, grain: 0.1, wear: 0.5, bump: 0.0005, bumpF: 2200, key: 'fde' }),
    // 참고 사진 소총: 갈색 기가 도는 검정 폴리머·세라코트(가구 · 핸드가드)
    blkPoly: finishMaterial({ color: lin(0.045, 0.039, 0.033), metalness: 0, roughness: 0.58, envMapIntensity: 0.7 }, { smear: 0.12, scratch: 0.06, grain: 0.1, wear: 0.4, bump: 0.0005, bumpF: 2200, key: 'blkpoly' }),
    blkCera: finishMaterial({ color: lin(0.055, 0.048, 0.04), metalness: 0, roughness: 0.5, envMapIntensity: 0.8 }, { smear: 0.1, scratch: 0.14, grain: 0.05, wear: 0.7, key: 'blkcera' }),
    fdeCera: finishMaterial({ color: lin(0.158, 0.122, 0.082), metalness: 0, roughness: 0.5, envMapIntensity: 0.8 }, { smear: 0.1, scratch: 0.14, grain: 0.05, wear: 0.9, key: 'fdecera' }),
    // 옛 펌프 산탄총(배그 S1897): 회색 파커라이징 강철 · 호두나무
    gunsteel: finishMaterial({ color: lin(0.21, 0.215, 0.22), metalness: 0.9, roughness: 0.42, envMapIntensity: 0.9 }, { smear: 0.12, scratch: 0.22, grain: 0.05, wear: 1, key: 'gunsteel' }),
    wood: finishMaterial({ color: lin(0.11, 0.05, 0.025), metalness: 0, roughness: 0.5, envMapIntensity: 0.6 }, { smear: 0.08, scratch: 0.08, grain: 0.18, bump: 0.0004, bumpF: 900, key: 'wood' }),
    od: finishMaterial({ color: lin(0.07, 0.078, 0.05), metalness: 0, roughness: 0.6, envMapIntensity: 0.7 }, { smear: 0.12, scratch: 0.06, grain: 0.1, bump: 0.0005, bumpF: 2200, key: 'od' }),
    // 손잡이 점각(스티플링): 같은 FDE에 굵은 요철
    stip: finishMaterial({ color: lin(0.15, 0.116, 0.078), metalness: 0, roughness: 0.78, envMapIntensity: 0.6 }, { smear: 0.05, scratch: 0, grain: 0.15, bump: 0.0011, bumpF: 1000, key: 'stip' }),
    // 미끄럼 방지 고무
    rubber: finishMaterial({ color: lin(0.02, 0.02, 0.022), metalness: 0, roughness: 0.82, envMapIntensity: 0.5 }, { smear: 0.05, scratch: 0, grain: 0.15, bump: 0.0012, bumpF: 2600, key: 'rubber' }),
    // 탄피 황동 · 산탄 붉은 플라스틱
    brass: finishMaterial({ color: lin(0.89, 0.72, 0.36), metalness: 1, roughness: 0.28, envMapIntensity: 0.9 }, { smear: 0.15, scratch: 0.1, key: 'brass' }),
    copper: finishMaterial({ color: lin(0.86, 0.5, 0.36), metalness: 1, roughness: 0.3, envMapIntensity: 0.9 }, { smear: 0.12, scratch: 0.08, key: 'copper' }),
    hull: new THREE.MeshStandardMaterial({ color: lin(0.28, 0.025, 0.02), metalness: 0, roughness: 0.45 }),
    // 장갑(천) · 너클 보호판 · 소매
    glove: finishMaterial({ color: lin(0.03, 0.03, 0.032), metalness: 0, roughness: 0.82, envMapIntensity: 0.5 }, { smear: 0.05, scratch: 0, grain: 0.1, key: 'glove' }),
    knuckle: finishMaterial({ color: lin(0.035, 0.037, 0.04), metalness: 0, roughness: 0.5, envMapIntensity: 0.8 }, { smear: 0.08, scratch: 0.08, grain: 0.04, key: 'knuckle' }),
    // 전투복 소매(검은 단색 면직 + 짠 결 요철) · 소매 끝단·벨크로 · 팔꿈치 패드(고무 코팅) — 모두 검정 계열
    sleeve: finishMaterial({ color: lin(0.024, 0.024, 0.026), metalness: 0, roughness: 0.92, envMapIntensity: 0.35 }, { smear: 0.04, scratch: 0, grain: 0.08, bump: 0.0006, bumpF: 2600, camo: 0, key: 'sleeve' }),
    cuff: finishMaterial({ color: lin(0.02, 0.02, 0.022), metalness: 0, roughness: 0.88, envMapIntensity: 0.35 }, { smear: 0.04, scratch: 0, grain: 0.12, bump: 0.0008, bumpF: 3000, key: 'cuff' }),
    pad: finishMaterial({ color: lin(0.03, 0.032, 0.03), metalness: 0, roughness: 0.6, envMapIntensity: 0.6 }, { smear: 0.08, scratch: 0.05, grain: 0.06, bump: 0.0008, bumpF: 1200, key: 'pad' }),
    bore: new THREE.MeshBasicMaterial({ color: 0x050505 }),
    port: new THREE.MeshStandardMaterial({ color: 0x0a0a0b, metalness: 0.6, roughness: 0.6 }),
    // 발광은 의미 있는 곳에만: 야간 조준점(초록) · 탄수 표시 · 충전 코일
    tritium: new THREE.MeshBasicMaterial({ color: lin(0.35, 1.8, 0.45) }),
    coil: new THREE.MeshStandardMaterial({ color: lin(0.2, 0.2, 0.21), metalness: 1, roughness: 0.25, emissive: new THREE.Color(0x30d8ff), emissiveIntensity: 0 }),
    lens: new THREE.MeshPhysicalMaterial({ color: 0x9fd6c8, metalness: 0, roughness: 0.02, transmission: 0, transparent: true, opacity: 0.18, envMapIntensity: 2.2, depthWrite: false }),
  };
  for (const m of Object.values(M)) if (m.isMeshStandardMaterial && envMap) m.envMap = envMap; // r163+: scene.environment만으로는 envMapIntensity가 무시된다
  return M;
}

// 뷰모델 조명(게임·검수 페이지 공용). 총 왼면(플레이어가 보는 면)에 따뜻한 투광등 키, 윗모서리에 차가운 달빛 테두리,
// 아래에서 눈 반사 채움 — 검은 총이라도 면이 바뀌는 곳마다 밝기가 달라 형태가 읽힌다
export function viewmodelLights(scene, camera, target = [0, 0, 0]) {
  scene.add(new THREE.HemisphereLight(0x8094b8, 0x3a3440, 0.55));
  // 키 조명만 그림자: 조준경·손·장전 손잡이가 총 몸통에 그림자를 드리워 부품 사이 깊이가 생긴다(뷰모델 크기만 덮는 작은 상자)
  const key = new THREE.DirectionalLight(0xffd6a8, 2.1); key.position.set(-1.2 + target[0], 1.5 + target[1], 0.5 + target[2]);
  key.target.position.set(...target); scene.add(key, key.target);
  key.castShadow = true; key.shadow.mapSize.set(512, 512); key.shadow.bias = -0.0002; key.shadow.normalBias = 0.002; key.shadow.radius = 2;
  Object.assign(key.shadow.camera, { left: -0.55, right: 0.55, top: 0.55, bottom: -0.55, near: 0.5, far: 4 });
  const rim = new THREE.DirectionalLight(0xa8c8ff, 1.5); rim.position.set(0.9, 1.2, -1.1); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x9aa6c0, 0.45); fill.position.set(-0.3, -1, 0.4); scene.add(fill);
  const pt = new THREE.PointLight(0x8ad8ff, 0.6, 2.5, 2); pt.position.set(-0.35, 0.25, -0.9); (camera || scene).add(pt);
  return pt;
}
// 그림자 받기/드리우기: 불투명 표준 재질만(렌즈·발광·조준점 제외)
export function shadowGun(root) { root.traverse((o) => { if (o.isMesh && o.material.isMeshStandardMaterial && !o.material.transparent) o.castShadow = o.receiveShadow = true; }); }

// 뷰모델 전용 반사 환경: 거의 검은 방 + 밝고 경계가 또렷한 조명판(투광등·하늘·눈). PMREM으로 미리 흐림
export function viewmodelEnvironment(renderer) {
  const env = new THREE.Scene();
  env.background = lin(0.012, 0.014, 0.02);
  const card = (w, h, x, y, z, rgb) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: lin(...rgb), side: THREE.DoubleSide, toneMapped: false }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
  };
  // 위쪽 왼편 투광등 묶음(등 4개) — 금속에 구조 있는 반사가 생긴다
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) card(1.3, 0.9, -4.2 + i * 1.6, 4.4 + j * 1.2, 3.5, [4.2, 3.0, 1.8]);
  card(0.5, 5.5, 5.2, 1.0, 1.5, [1.4, 1.6, 2.0]);   // 오른쪽 달빛 받은 옹벽 모서리
  card(5.5, 0.35, 0.5, 2.6, -5.0, [2.6, 1.8, 1.0]); // 앞쪽 먼 투광등 줄
  card(2.2, 3.4, 3.0, 2.6, -4.5, [2.4, 1.6, 0.8]); // 따뜻한 나트륨등
  card(7, 2.2, 0, 6.0, 0, [0.4, 0.48, 0.62]);       // 흐린 밤하늘(위)
  card(9, 9, 0, -4, 0, [0.16, 0.17, 0.2]);           // 눈 덮인 바닥 반사(아래)
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(env, 0.006);
  for (const o of env.children) { o.geometry.dispose(); o.material.dispose(); }
  pm.dispose();
  return rt.texture;
}

// ── 손 ───────────────────────────────────────────────────
// 기본 자세: 손가락이 −z로 뻗고, 손가락 마디가 y로 쌓이며(검지가 위), 오른손은 −x 쪽으로 감아 쥔다.
// mirror=true면 왼손(+x로 감음). curls: [검지, 중지, 약지, 소지] 각 [밑마디, 가운데, 끝] 굽힘(라디안)
// 실제 사람 손 메시(handData.js, 해부학적 관절 25개)에 전술 장갑 재질을 입힌다. 왼손은 x를 뒤집은 같은 메시.
// 우리 손 좌표: 손가락 −z, 검지 쪽 +y, 손목 +z, 오른손 손바닥은 −x를 본다(왼손은 +x).
// curls: [검지, 중지, 약지, 소지] 각 [첫마디(MCP), 중간마디(PIP), 끝마디(DIP)] 굽힘(라디안)
// thumb.dir: 엄지 전체(손목 쪽 뿌리 → 끝)가 향할 방향(오른손 기준), thumb.curl: 엄지 끝마디 굽힘
let HAND_GEO = null;
const dec = (str, T) => { const b = Uint8Array.from(atob(str), (c) => c.charCodeAt(0)); return new T(b.buffer); };
// 반장갑 구역(정점마다 한 번): 손끝 마디는 맨살(aSkin), 손등·손가락 첫마디 등쪽은 보호판(aPanel) — 가장 많이 붙은 뼈와 손바닥 반대쪽을 보는 법선으로 나눈다
function gloveZones(geo, palmN) {
  if (geo.getAttribute('aSkin')) return;
  const si = geo.getAttribute('skinIndex'), sw = geo.getAttribute('skinWeight'), nr = geo.getAttribute('normal'), n = si.count;
  const skin = new Float32Array(n), panel = new Float32Array(n), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    let bi = si.getX(i), bw = sw.getX(i);
    for (const [c, w] of [[si.getY(i), sw.getY(i)], [si.getZ(i), sw.getZ(i)], [si.getW(i), sw.getW(i)]]) if (w > bw) { bw = w; bi = c; }
    const name = HAND.bones[bi].name;
    skin[i] = /phalanx-distal|tip/.test(name) ? 1 : 0;
    const back = -v.fromBufferAttribute(nr, i).dot(palmN);
    panel[i] = !skin[i] && /metacarpal|phalanx-proximal/.test(name) && !name.startsWith('thumb') && back > 0.35 ? 1 : 0;
  }
  geo.setAttribute('aSkin', new THREE.BufferAttribute(skin, 1));
  geo.setAttribute('aPanel', new THREE.BufferAttribute(panel, 1));
}
// 반장갑 재질: 짙은 회색 천 + 손등 보호판(회색·검정 디지털 무늬, 살짝 매끈) + 손끝 맨살
function halfFingerGlove() {
  const m = new THREE.MeshStandardMaterial({ color: lin(0.03, 0.031, 0.034), roughness: 0.85, metalness: 0, envMapIntensity: 0.5, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSkin; attribute float aPanel; varying float vSkin; varying float vPanel; varying vec3 vHP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkin = aSkin; vPanel = aPanel; vHP = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vSkin; varying float vPanel; varying vec3 vHP;
float hh(vec3 p){ p = fract(p * 0.3183 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
float hp = 0.0;
if (vSkin > 0.5) diffuseColor.rgb = vec3(0.42, 0.27, 0.2);
else if (vPanel > 0.5) {
  vec3 c = floor(vHP * 520.0); float a = hh(c), b = hh(floor(vHP * 230.0) + 3.0);
  vec3 col = vec3(0.06, 0.062, 0.068);
  col = mix(col, vec3(0.15, 0.152, 0.16), step(0.6, b));
  col = mix(col, vec3(0.02, 0.02, 0.022), step(0.72, a));
  diffuseColor.rgb = col; hp = 1.0;
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = vSkin > 0.5 ? 0.55 : mix(roughnessFactor, 0.5, hp);');
  };
  m.customProgramCacheKey = () => 'half-finger-glove';
  return m;
}
function handGeometry() {
  if (HAND_GEO) return HAND_GEO;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(dec(HAND.position, Float32Array), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(dec(HAND.normal, Float32Array), 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(dec(HAND.skinIndex, Uint8Array), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(dec(HAND.skinWeight, Float32Array), 4));
  g.setIndex(new THREE.BufferAttribute(dec(HAND.index, Uint16Array), 1));
  return (HAND_GEO = g);
}
const FINGERS = ['index', 'middle', 'ring', 'pinky'];
const HAND_SCALE = 1.05;                         // 장갑 두께만큼
const ALIGN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2); // 메시(손가락 −y, 검지 −z) → 우리 좌표
export function makeHand(M, { mirror = false, curls, thumb = { dir: [-0.6, 0.45, -1], curl: 0.4 } } = {}) {
  const s = mirror ? -1 : 1;
  const g = new THREE.Group();
  const inner = new THREE.Group(); inner.scale.set(s, 1, 1); g.add(inner);
  const root = new THREE.Group(); inner.add(root);
  // 뼈: 원본은 모두 한 층에 있으므로 손목 → 손허리뼈 → 마디 사슬로 다시 묶는다(부모를 굽히면 자식이 따라 움직이게)
  const bones = HAND.bones.map((d) => { const b = new THREE.Bone(); b.name = d.name; b.userData.W = new THREE.Matrix4().fromArray(d.world); return b; });
  const by = Object.fromEntries(bones.map((b) => [b.name, b]));
  const parentOf = (n) => {
    if (n === 'wrist') return null;
    const [f, ...rest] = n.split('-'); const part = rest.join('-');
    const chain = f === 'thumb' ? ['metacarpal', 'phalanx-proximal', 'phalanx-distal', 'tip'] : ['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'];
    const pre = f === 'thumb' ? 'thumb-' : f + '-finger-';
    const key = part.replace(/^finger-/, '');
    const i = chain.indexOf(key);
    return i <= 0 ? by.wrist : by[pre + chain[i - 1]];
  };
  const _q = new THREE.Quaternion(), _sc = new THREE.Vector3();
  for (const b of bones) {
    const p = parentOf(b.name);
    const local = p ? p.userData.W.clone().invert().multiply(b.userData.W) : b.userData.W.clone();
    local.decompose(b.position, b.quaternion, _sc);
    (p || root).add(b);
    b.userData.bindQ = b.quaternion.clone();
    b.userData.Wq = new THREE.Quaternion().setFromRotationMatrix(b.userData.W);
    b.userData.Wp = new THREE.Vector3().setFromMatrixPosition(b.userData.W);
  }
  // 손목 끝이 열린 메시라 뒷면도 그린다(안쪽이 보여도 장갑 안감처럼 어둡게) — 손 전용 재질(반장갑: 손등 보호판 무늬 · 손끝 맨살)
  if (!M.gloveHand) M.gloveHand = halfFingerGlove();
  const mesh = new THREE.SkinnedMesh(handGeometry(), M.gloveHand);
  mesh.frustumCulled = false;
  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones, HAND.bones.map((d) => new THREE.Matrix4().fromArray(d.inv))), new THREE.Matrix4());
  // 정렬: 회전 + 장갑 두께 + 가운뎃손가락 첫마디가 (0.022, 0, −0.002)에 오게(이전 손과 같은 기준이라 파지 값을 그대로 쓴다)
  root.quaternion.copy(ALIGN); root.scale.setScalar(HAND_SCALE);
  const toOurs = (v) => v.clone().multiplyScalar(HAND_SCALE).applyQuaternion(ALIGN);
  root.position.copy(new THREE.Vector3(0.022, 0, -0.002).sub(toOurs(by['middle-finger-phalanx-proximal'].userData.Wp)));
  const wristOurs = toOurs(by.wrist.userData.Wp).add(root.position);
  g.userData.wrist = new THREE.Vector3(s * wristOurs.x, wristOurs.y, wristOurs.z);
  // 굽힘 축(메시 좌표): 손가락 방향 × 손바닥 법선 → 양의 각이 손바닥 쪽으로 굽힌다
  const W = (n) => by[n].userData.Wp;
  const lateral = W('index-finger-phalanx-proximal').clone().sub(W('pinky-finger-phalanx-proximal')).normalize();
  const mid = W('middle-finger-tip').clone().sub(W('middle-finger-phalanx-proximal')).normalize();
  let palmN = new THREE.Vector3().crossVectors(mid, lateral).normalize();
  if (W('thumb-tip').clone().sub(W('middle-finger-phalanx-proximal')).dot(palmN) < 0) palmN.negate(); // 엄지는 손바닥 쪽에 있다
  gloveZones(mesh.geometry, palmN);
  const flex = (b, dir, n = palmN) => { const ax = new THREE.Vector3().crossVectors(dir, n).normalize(); return ax.applyQuaternion(b.userData.Wq.clone().invert()); };
  const joints = FINGERS.map((f) => {
    const d = W(f + '-finger-tip').clone().sub(W(f + '-finger-phalanx-proximal')).normalize();
    return ['phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal'].map((k) => { const b = by[f + '-finger-' + k]; return { b, ax: flex(b, d) }; });
  });
  const metas = FINGERS.map((f, i) => { const b = by[f + '-finger-metacarpal']; return { b, ax: flex(b, mid), cup: [0, 0.02, 0.07, 0.14][i] }; });
  const tMeta = by['thumb-metacarpal'], tProx = by['thumb-phalanx-proximal'], tDist = by['thumb-phalanx-distal'];
  const t0 = W('thumb-tip').clone().sub(W('thumb-metacarpal')).normalize();
  const tAx = [tProx, tDist].map((b) => flex(b, t0));
  // 원하는 엄지 방향(오른손 기준 우리 좌표) → 메시 좌표
  const tGoal = new THREE.Vector3(thumb.dir[0], thumb.dir[1], thumb.dir[2]).normalize().applyQuaternion(ALIGN.clone().invert());
  const aimQ = new THREE.Quaternion().setFromUnitVectors(t0, tGoal);
  { const ang = 2 * Math.acos(Math.min(1, Math.abs(aimQ.w))); if (ang > 1.1) aimQ.slerp(new THREE.Quaternion(), 1 - 1.1 / ang); } // 관절 한계: 엄지 뿌리는 63°까지만 돈다
  const wristQinv = by.wrist.userData.Wq.clone().invert();
  const grip = curls || FINGERS.map(() => [0.6, 1.0, 0.7]);
  const OPEN = [0.1, 0.14, 0.08], TRIG = [0.35, 0.45, 0.25];
  const rot = (b, ax, a) => b.quaternion.copy(b.userData.bindQ).multiply(_q.setFromAxisAngle(ax, a));
  // 손가락 관절 한계: MCP −20°~90°, PIP 0~105°, DIP 0~80°이고 DIP는 PIP가 굽은 만큼만(힘줄로 이어져 혼자 크게 못 굽힌다)
  const clampF = (k, v, pip) => k === 0 ? THREE.MathUtils.clamp(v, LIMIT.mcp[0], LIMIT.mcp[1]) : k === 1 ? THREE.MathUtils.clamp(v, LIMIT.pip[0], LIMIT.pip[1])
    : THREE.MathUtils.clamp(v, LIMIT.dip[0], Math.min(LIMIT.dip[1], pip * LIMIT.dipPerPip + 0.15));
  const finger = (js, vals) => { const v0 = clampF(0, vals[0]), v1 = clampF(1, vals[1]), v2 = clampF(2, vals[2], v1); rot(js[0].b, js[0].ax, v0); rot(js[1].b, js[1].ax, v1); rot(js[2].b, js[2].ax, v2); return [v0, v1, v2]; };
  let last = '';
  g.userData.pose = (open = 0, trig = 0) => {
    const key = open.toFixed(3) + trig.toFixed(3);
    if (key === last) return; last = key;
    joints.forEach((js, f) => finger(js, [0, 1, 2].map((k) => grip[f][k] + (OPEN[k] + f * 0.02 - grip[f][k]) * open + (f === 0 ? TRIG[k] * trig : 0))));
    for (const { b, ax, cup } of metas) rot(b, ax, cup * (1 - open * 0.7));            // 쥘 때 약지·소지 쪽 손바닥이 오므라든다
    const q = new THREE.Quaternion().slerp(aimQ, 1 - open * 0.8);
    tMeta.quaternion.copy(wristQinv).multiply(q).multiply(tMeta.userData.Wq);            // 엄지 뿌리(손목 기준)
    rot(tProx, tAx[0], THREE.MathUtils.clamp((thumb.curl ?? 0.3) * 0.5 * (1 - open), LIMIT.thumbMcp[0], LIMIT.thumbMcp[1]));
    rot(tDist, tAx[1], THREE.MathUtils.clamp((thumb.curl ?? 0.3) * (1 - open) + 0.1, LIMIT.thumbIp[0], LIMIT.thumbIp[1]));
  };
  g.userData.pose(0, 0);
  // 해부학 기준점(우리 손 좌표): 검지·새끼 첫마디 관절(MCP), 손목, 엄지 뿌리 — 총 위 실제 위치에 맞춰 손을 놓는 데 쓴다
  const lm = (n) => { const v = toOurs(W(n)).add(root.position); v.x *= s; return v; };
  g.userData.lm = { index: lm('index-finger-phalanx-proximal'), pinky: lm('pinky-finger-phalanx-proximal'), wrist: lm('wrist'), thumb: lm('thumb-metacarpal') };
  // 손바닥 중심(뼈 선 위)과 손바닥 법선(우리 손 좌표) — 총 표면에 손바닥을 붙일 때 쓴다
  const pc = toOurs(W('wrist').clone().lerp(W('middle-finger-phalanx-proximal'), 0.6)).add(root.position);
  const pn = palmN.clone().applyQuaternion(ALIGN);
  g.userData.palm = new THREE.Vector3(s * pc.x, pc.y, pc.z); g.userData.palmN = new THREE.Vector3(s * pn.x, pn.y, pn.z).normalize();
  // 접촉 맞춤: 각 손가락을 첫마디부터 차례로 굽히다가 총(또는 다른 손)에 닿기 직전에 멈춘다 → 실제 표면을 감싸 쥔다
  const tips = FINGERS.map((f) => by[f + '-finger-tip']);
  g.userData.grip = grip;
  g.userData.fit = (targets, trigger, thumbAt) => {
    if (thumbAt) {
      // 엄지 끝이 향할 곳(실제 파지에서 엄지가 놓이는 자리) → 엄지 뿌리를 그쪽으로 돌린다(뿌리 관절 한계 63°)
      g.updateMatrixWorld(true);
      const base = new THREE.Vector3(); tMeta.getWorldPosition(base);
      const dirW = thumbAt.clone().sub(base).normalize();
      const dirM = dirW.transformDirection(new THREE.Matrix4().copy(root.matrixWorld).invert());          // 메시 좌표 방향
      aimQ.setFromUnitVectors(t0, dirM);
      const lim = thumb.maxAim ?? 1.1, ang = 2 * Math.acos(Math.min(1, Math.abs(aimQ.w))); if (ang > lim) aimQ.slerp(new THREE.Quaternion(), 1 - lim / ang);
      last = ''; g.userData.pose(0, 0);
    }
    const rc = new THREE.Raycaster(), a = new THREE.Vector3(), c = new THREE.Vector3(), off = new THREE.Vector3();
    g.updateMatrixWorld(true);
    const hit = (chain) => {
      chain[0].updateWorldMatrix(false, true);
      for (let i = 0; i < chain.length - 1; i++) {
        chain[i].getWorldPosition(a); chain[i + 1].getWorldPosition(c);
        const dir = c.clone().sub(a), L = dir.length(); dir.divideScalar(L);
        // 손가락 두께: 가운데 + 손바닥 쪽 · 손등 쪽으로 반지름만큼 띄운 광선
        for (const k of [0, 1]) {
          off.copy(g.userData.palmN).transformDirection(g.matrixWorld).multiplyScalar(0.005 * k);   // 장갑 낀 손가락은 1~2 mm 눌린다: 반지름보다 조금 안쪽
          rc.set(a.clone().add(off), dir); rc.far = L + 0.004;
          if (rc.intersectObjects(targets, false).length) return true;
        }
      }
      return false;
    };
    joints.forEach((js, f) => {
      const chain = [...js.map((j) => j.b), tips[f]];
      if (f === 0 && trigger) {
        // 방아쇠 손가락: 끝마디 지문 부분(끝마디 중간)이 방아쇠 앞면에 오도록 첫마디·중간마디 각을 찾는다
        let best = Infinity, bv = [0, 0];
        const pad = new THREE.Vector3(), t1 = new THREE.Vector3();
        g.updateMatrixWorld(true);
        const tryA = (m, p) => {
          finger(js, [m, p, p * 0.45]);
          js[0].b.updateWorldMatrix(false, true);                     // 손가락 사슬만 다시 계산
          js[2].b.getWorldPosition(pad); tips[0].getWorldPosition(t1); pad.lerp(t1, 0.55);
          const d = pad.distanceTo(trigger);
          if (d < best) { best = d; bv = [m, p]; }
        };
        for (let m = LIMIT.mcp[0]; m <= LIMIT.mcp[1]; m += 0.1) for (let p = 0; p <= LIMIT.pip[1]; p += 0.1) tryA(m, p);     // 거칠게(관절 범위 안에서만)
        const [m0, p0] = bv;
        for (let m = Math.max(LIMIT.mcp[0], m0 - 0.1); m <= Math.min(LIMIT.mcp[1], m0 + 0.1); m += 0.025) for (let p = Math.max(0, p0 - 0.1); p <= Math.min(LIMIT.pip[1], p0 + 0.1); p += 0.025) tryA(m, p); // 곱게
        grip[0][0] = bv[0]; grip[0][1] = bv[1]; grip[0][2] = bv[1] * 0.45;
        return;
      }
      const set = (k, v) => { grip[f][k] = clampF(k, v, grip[f][1]); rot(js[k].b, js[k].ax, grip[f][k]); };
      // 나머지 손가락: 쥐는 물체 굵기에 맞춰 정한 굽힘(실제 파지 사진 기준)을 관절 범위 안에서 그대로 쓴다
      const c = curls ? curls[f] : [0.9, 1.2, 0.8]; set(0, c[0]); set(1, c[1]); set(2, c[2]);
    });
    last = ''; g.userData.pose(0, 0);
  };
  return g;
}

// 손바닥을 총 표면에 붙이고(법선 방향으로 밀어 닿게) 손가락을 접촉까지 굽힌다. others: 함께 피해야 할 다른 손
const _tri = new THREE.Triangle(), _cp = new THREE.Vector3();
// 손을 기준점 세 개(검지 MCP · 새끼 MCP · 손목)의 목표 위치(부모 공간)에 맞춰 놓는다: 두 삼각형의 좌표틀을 맞추는 회전 + 무게중심 이동
export function placeHand(hand, { index, pinky, wrist }) {
  const L = hand.userData.lm;
  const frame = (w, i, p) => {
    const m = i.clone().add(p).multiplyScalar(0.5), f = m.sub(w).normalize();
    const l = i.clone().sub(p); l.addScaledVector(f, -l.dot(f)).normalize();
    return new THREE.Matrix4().makeBasis(f, l, new THREE.Vector3().crossVectors(f, l));
  };
  const T = [new THREE.Vector3(...wrist), new THREE.Vector3(...index), new THREE.Vector3(...pinky)];
  const R = frame(...T).multiply(frame(L.wrist, L.index, L.pinky).transpose());
  hand.quaternion.setFromRotationMatrix(R);
  const cl = L.wrist.clone().add(L.index).add(L.pinky).multiplyScalar(1 / 3).applyQuaternion(hand.quaternion);
  hand.position.copy(T[0]).add(T[1]).add(T[2]).multiplyScalar(1 / 3).sub(cl);
  hand.updateMatrix();
}

export function fitHand(gunGroup, hand, others = [], trigger = null) {
  gunGroup.updateMatrixWorld(true);
  let targets = [];
  gunGroup.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && !o.material.transparent && o.material.side !== THREE.DoubleSide && !o.material.map) targets.push(o); });
  // 다른 손은 지금 자세를 정적 메시로 한 번 굽혀(스킨 계산) 넣는다 — 스킨 메시에 광선을 쏘면 매번 정점 전체를 다시 계산해 느리다
  for (const h of others) h.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const src = o.geometry.attributes.position, pos = new Float32Array(src.count * 3), v = new THREE.Vector3();
    for (let i = 0; i < src.count; i++) { o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld); pos.set([v.x, v.y, v.z], i * 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(o.geometry.index);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial()); m.updateMatrixWorld(true); targets.push(m);
  });
  const rc = new THREE.Raycaster();
  const P = hand.userData.palm.clone().applyMatrix4(hand.matrixWorld), N = hand.userData.palmN.clone().transformDirection(hand.matrixWorld);
  // 손 근처(손바닥에서 16 cm 안) 부품만 검사한다
  const near = targets.filter((o) => {
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const bs = o.geometry.boundingSphere, c = bs.center.clone().applyMatrix4(o.matrixWorld);
    return c.distanceTo(P) < bs.radius * o.matrixWorld.getMaxScaleOnAxis() + 0.16;
  });
  // 손 근처 삼각형만 모은 충돌용 메시 하나(광선 검사가 부품 수백 개를 돌지 않게)
  const tri = [], a = new THREE.Vector3(), b2 = new THREE.Vector3(), c = new THREE.Vector3();
  for (const o of near) {
    const g = o.geometry, pa = g.attributes.position, idx = g.index, n = idx ? idx.count : pa.count;
    for (let i = 0; i < n; i += 3) {
      const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pa, i0).applyMatrix4(o.matrixWorld); b2.fromBufferAttribute(pa, i1).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(pa, i2).applyMatrix4(o.matrixWorld);
      _tri.set(a, b2, c); _tri.closestPointToPoint(P, _cp);
      if (_cp.distanceTo(P) < 0.115) tri.push(a.x, a.y, a.z, b2.x, b2.y, b2.z, c.x, c.y, c.z);
    }
  }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  const proxy = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ side: THREE.FrontSide })); proxy.updateMatrixWorld(true);   // 앞면만: 표면 안쪽에서 시작한 광선(이미 닿아 있는 마디)은 무시
  targets = [proxy];
  // 손바닥 붙이기: 손바닥 뒤 5 cm에서 손바닥 쪽으로 광선을 쏴 표면을 찾고, 손바닥 살(1.45 cm)이 표면에 닿도록 앞뒤로 옮긴다
  // (손이 총 속에 파묻혀 있으면 밖으로 빼고, 떠 있으면 붙인다 — 3 cm 이내만)
  rc.set(P.clone().addScaledVector(N, -0.05), N); rc.far = 0.12;
  const h = rc.intersectObjects(targets, false)[0];
  if (h) {
    const d = THREE.MathUtils.clamp(h.distance - 0.05 - 0.0145, -0.03, 0.03);
    const local = N.clone().transformDirection(new THREE.Matrix4().copy(hand.parent.matrixWorld).invert());
    hand.position.addScaledVector(local, d); hand.updateMatrixWorld(true);
  }
  const th = hand.userData.thumbAt;
  hand.userData.fit(targets, trigger && gunGroup.localToWorld(trigger.clone()), th && (hand.parent === gunGroup ? gunGroup : hand.parent).localToWorld(new THREE.Vector3(...th)));
}

// 아래팔: 손목(a)에서 팔꿈치(b)까지 + 팔꿈치 너머로 조금 더.
// 장갑 손목 덮개(건틀릿, 벨크로 끈) → 전투복 소매 끝단(벨크로 탭) → 위장 무늬 소매(근육 따라 굵어짐 · 주름 · 바느질 솔기)
export function makeForearm(M, a, b) {
  const g = new THREE.Group();
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B), ext = len + 0.05;
  const parts = [];
  // 장갑 건틀릿: 손목을 덮고 0.06까지, 끝이 살짝 벌어짐
  const gl = [[0, -0.006], [0.021, -0.006], [0.0235, 0.01], [0.0245, 0.04], [0.027, 0.058], [0.0255, 0.062], [0, 0.062]];
  parts.push([new THREE.LatheGeometry(gl.map(([r, z]) => new THREE.Vector2(r, z)), 16), 'glove']);
  { const st = new THREE.CylinderGeometry(0.0255, 0.0255, 0.016, 16, 1, true); st.translate(0, 0.03, 0); parts.push([st, 'knuckle']); }  // 벨크로 끈
  parts.push([rbox(0.009, 0.018, 0.022, 0.003, 0.024, 0.03, 0.006), 'knuckle']);                                                         // 끈 당김 탭
  // 소매: 건틀릿 위를 덮는 끝단부터 시작
  const prof = [[0, 0.045], [0.029, 0.045], [0.031, 0.05]];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20, z = 0.05 + t * (ext - 0.05);
    const base = 0.03 + 0.012 * Math.sin(Math.min(1, z / (len * 0.75)) * Math.PI / 2);
    const fold = z > 0.09 ? 0.0018 * Math.sin(z * 110 + 0.7) * (0.4 + 0.6 * Math.sin(t * Math.PI)) : 0;  // 접힌 주름
    prof.push([base + fold, z]);
  }
  prof.push([0.04, ext + 0.006], [0, ext + 0.008]);
  parts.push([new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(r, z)), 20), 'sleeve']);
  { const hem = new THREE.CylinderGeometry(0.032, 0.0315, 0.024, 20, 1, true); hem.translate(0, 0.058, 0); parts.push([hem, 'cuff']); }  // 소매 끝단(두 겹)
  parts.push([rbox(0.007, 0.03, 0.02, 0.003, 0.031, 0.062, -0.004), 'cuff']);                                                           // 끝단 벨크로 탭
  // 솔기(바깥 아래쪽으로 길게 한 줄) + 소매 위 작은 펜 포켓
  { const sm = new THREE.BoxGeometry(0.002, ext - 0.08, 0.002); sm.translate(0.0, 0.08 + (ext - 0.08) / 2, -0.035); parts.push([sm, 'cuff']); }
  parts.push([rbox(0.006, 0.07, 0.03, 0.003, 0.036, 0.15, 0.004), 'cuff']);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  for (const [geo, m] of parts) { geo.applyQuaternion(q); geo.translate(A.x, A.y, A.z); g.add(new THREE.Mesh(geo, M[m])); }
  return g;
}

// 수직 앞손잡이(핸드가드 아래, 약간 앞으로 기움): 왼손도 오른손처럼 세로 손잡이를 쥐어 자연스럽다
function foregrip(add, parent, z, yTop) {
  const prof = [[0, 0], [0.012, 0], [0.0135, -0.006], [0.0135, -0.012]];
  for (let i = 0; i < 5; i++) { const y = -0.016 - i * 0.012; prof.push([0.0128, y], [0.0138, y - 0.006]); }
  prof.push([0.0138, -0.078], [0.016, -0.082], [0.016, -0.088], [0, -0.09]);
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 20);
  g.rotateX(-0.12); g.translate(0, yTop, z);
  add(g, 'polymer', parent);
  add(box(0.026, 0.008, 0.05, 0, yTop - 0.002, z), 'anod', parent); // 레일 고정부
}
// 손가락 굽힘(첫마디·중간·끝): 쥐는 물체 굵기 기준 — 수직 손잡이 2.8 cm, 핸드가드 4.3×6.8 cm, 펌프 4.8 cm
const FORE_HAND = { mirror: true, curls: [[1.2, 1.45, 0.95], [1.25, 1.5, 1.0], [1.3, 1.5, 1.0], [1.35, 1.5, 1.0]], thumb: { dir: [-0.8, 0.6, -0.4], curl: 0.3 } };
// C-클램프·펌프: 손바닥이 물체 중심을 보고, 손가락은 아래를 비스듬히 가로질러 중간마디(PIP)에서 꺾여 반대쪽 면을 감는다
// 옆잡기: 첫마디는 거의 펴서 왼쪽 면을 타고 오르고, 둘째·셋째 마디를 굽혀 손끝이 윗면을 덮는다
// 엄지 뻗어 잡기: 네 손가락은 핸드가드 밑을 감고, 엄지는 굽히지 않고 곧게
// (엄지 뿌리를 크게 벌려 앞으로 뻗으므로 회전 한계를 넓힌다: 엄지 손목손허리관절은 벌림·맞섬이 넓다)
const THUMB_HAND = { mirror: true, curls: [[0.9, 1.0, 0.6], [0.95, 1.05, 0.65], [1.0, 1.05, 0.65], [1.05, 1.0, 0.6]], thumb: { dir: [-0.1, 0.35, -0.93], curl: 0, maxAim: 2.6 } };
const SIDE_HAND = { mirror: true, curls: [[0.3, 0.95, 0.55], [0.32, 1.0, 0.6], [0.35, 1.0, 0.6], [0.4, 0.95, 0.55]], thumb: { dir: [0.3, -0.2, -0.93], curl: 0.15 } };
const CLAMP_HAND = { mirror: true, curls: [[0.85, 1.0, 0.65], [0.9, 1.05, 0.7], [0.95, 1.05, 0.7], [1.0, 1.0, 0.65]], thumb: { dir: [-0.24, 0.93, -0.27], curl: 0.08 } };
// 펌프(지름 4.8 cm): 표면을 따라 감는 각 = 마디 길이 ÷ (반지름 + 손가락 두께)
const PUMP_HAND = { mirror: true, curls: [[0.85, 1.05, 0.7], [0.9, 1.1, 0.75], [0.95, 1.1, 0.75], [1.0, 1.05, 0.7]], thumb: { dir: [-0.24, 0.93, -0.27], curl: 0.08 } };
function onForegrip(hand, z, yTop) { hand.position.set(0, yTop - 0.04, z + 0.004); hand.rotation.set(0.12, 0, 0); }

// 손 방향을 '쥐는 축'과 '손바닥이 향하는 쪽'으로 정한다(오일러 각을 맞추는 것보다 실제 파지를 옮기기 쉽다).
// axis: 검지 → 새끼 반대 방향(쥔 물체의 축, 검지 쪽), palm: 손바닥 법선, at: 손 원점 위치
export function poseHand(hand, mirror, axis, palm, at) {
  const N = new THREE.Vector3(...palm).normalize();
  const X = mirror ? N.clone() : N.clone().negate();               // 오른손은 손바닥이 −x, 왼손은 +x
  const Y = new THREE.Vector3(...axis); Y.addScaledVector(X, -Y.dot(X)).normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y);
  hand.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  hand.position.set(...at);
}

// 팔: 어깨–팔꿈치–손목 2관절. 위팔 0.29 m · 아래팔 0.26 m(실제 비율)로 고정, 팔꿈치는 아래·바깥으로 굽는 2-뼈 IK.
// 메시는 끊김 없는 하나의 소매(스킨): 팔꿈치 앞뒤 ±5 cm에서 두 뼈의 가중치가 섞여 접힐 때 매끈하게 휜다.
function armFrom(parent, M, hand, mirror, shoulderOff) {
  const arm = new THREE.Group();
  const wrist = (hand.userData.wrist || new THREE.Vector3(mirror ? -0.022 : 0.022, 0, 0.082)).clone();
  hand.updateMatrix();
  const W = wrist.clone().applyMatrix4(hand.matrix);
  arm.userData = { hand, wrist, mirror, M, S0: W.clone().add(new THREE.Vector3(...shoulderOff)), pole0: new THREE.Vector3(mirror ? -0.55 : 0.55, -1, 0.1).normalize() };
  parent.add(arm);
  aimArm(arm);
  return arm;
}
// 팔 단면 반지름(전투복 소매 포함) — y: 어깨 0 → 팔꿈치 a → 손목 a+b. side: 둘레 각(0 = +x = 팔꿈치 끝이 향하는 바깥)
function armRadius(y, a, b, ang) {
  const c = Math.cos(ang);
  if (y < a) {                                                     // 위팔: 어깨 쪽 굵고(삼각근) 팔꿈치로 갈수록 조금 가늘게
    const t = Math.max(0, y) / a;
    return 0.052 - 0.008 * t + 0.004 * Math.exp(-((((y - a) / 0.03)) ** 2)) * Math.max(0, c);
  }
  const t = (y - a) / b;                                           // 아래팔: 팔꿈치 아래 근육이 가장 굵고 손목으로 가늘어진다
  let r = 0.046 - 0.004 * t - 0.012 * t * t;
  r += 0.005 * Math.exp(-((((y - a) / 0.025)) ** 2)) * Math.max(0, c);  // 팔꿈치 뼈 끝
  r *= 1 + 0.12 * t * Math.cos(2 * ang);                           // 손목 쪽은 납작한 타원
  return r;
}
function makeArmMesh(M, a, b) {
  const bones = [new THREE.Bone(), new THREE.Bone()];
  bones[1].position.set(0, a, 0); bones[0].add(bones[1]);
  const SEG = 20, ys = [];
  for (let y = -0.06; y < a + b - 0.04; y += y > a - 0.08 && y < a + 0.08 ? 0.01 : 0.022) ys.push(y);
  ys.push(a + b - 0.04);
  const pos = [], idx = [], si = [], sw = [];
  const wB = (y) => { const t = Math.min(1, Math.max(0, (y - (a - 0.05)) / 0.1)); return t * t * (3 - 2 * t); };
  ys.forEach((y, i) => {
    for (let j = 0; j <= SEG; j++) {
      const ang = (j / SEG) * Math.PI * 2;
      let r = armRadius(y, a, b, ang);
      // 천 주름: 팔꿈치 안쪽(−x)에 접힌 주름, 아래팔에 느슨한 물결
      const inner = Math.max(0, -Math.cos(ang));
      r += 0.004 * inner * Math.exp(-((((y - a) / 0.045)) ** 2)) * Math.sin(y * 260);
      r += 0.0016 * Math.sin(y * 90 + ang * 2) * (y > a ? 1 : 0.5);
      pos.push(Math.cos(ang) * r, y, Math.sin(ang) * r);
      const w = wB(y); si.push(0, 1, 0, 0); sw.push(1 - w, w, 0, 0);
      if (i > 0 && j < SEG) { const p0 = (i - 1) * (SEG + 1) + j, p1 = i * (SEG + 1) + j; idx.push(p0, p1, p0 + 1, p1, p1 + 1, p0 + 1); }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.setIndex(idx); geo.computeVertexNormals();
  const g = new THREE.Group(); g.add(bones[0]);
  g.updateMatrixWorld(true);                       // 뼈 역행렬은 지금 자세(곧게 편 팔) 기준이어야 한다
  const skel = new THREE.Skeleton(bones);
  const sleeve = new THREE.SkinnedMesh(geo, M.sleeve); g.add(sleeve);
  // 소매 끝단 · 장갑 손목 덮개 · 팔꿈치 보호대 — 각 부품은 붙는 뼈 하나에 100%
  const part = (gg, bone) => { gg = gg.index ? gg.toNonIndexed() : gg; for (const k of Object.keys(gg.attributes)) if (!['position', 'normal'].includes(k)) gg.deleteAttribute(k);
    const n = gg.attributes.position.count; gg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(n * 4).fill(0).map((_, i) => (i % 4 === 0 ? bone : 0)), 4));
    gg.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(n * 4).fill(0).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4)); return gg; };
  const wy = a + b;
  const cuff = new THREE.CylinderGeometry(0.0335, 0.033, 0.028, 20, 1, true); cuff.translate(0, wy - 0.05, 0);
  const tab = rbox(0.008, 0.032, 0.02, 0.003, 0.033, wy - 0.05, -0.004);
  const pocket = rbox(0.008, 0.075, 0.032, 0.003, 0.0, a + 0.11, -0.041); // 아래팔 펜 주머니(안쪽 위)
  const gl = [[0.026, wy - 0.075], [0.03, wy - 0.07], [0.0285, wy - 0.05], [0.0255, wy - 0.02], [0.0235, wy + 0.012], [0, wy + 0.014]];
  const gaunt = new THREE.LatheGeometry(gl.map(([r, y]) => new THREE.Vector2(r, y)), 18);
  const strap = new THREE.CylinderGeometry(0.0275, 0.0275, 0.014, 18, 1, true); strap.translate(0, wy - 0.04, 0);
  const pad = new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2); pad.scale(0.03, 0.017, 0.04); pad.rotateZ(-Math.PI / 2); pad.translate(0.05, a - 0.005, 0);
  const pstrap = new THREE.CylinderGeometry(0.05, 0.05, 0.01, 20, 1, true); pstrap.translate(0, a - 0.045, 0);
  const sk = (list, mat) => { const m = new THREE.SkinnedMesh(mergeGeometries(list, false), mat); g.add(m); return m; };
  const meshes = [sleeve, sk([part(cuff, 1), part(tab, 1), part(pocket, 1)], M.cuff), sk([part(gaunt, 1)], M.glove), sk([part(strap, 1)], M.knuckle), sk([part(pad, 0), part(pstrap, 0)], M.pad)];
  g.updateMatrixWorld(true);
  for (const m of meshes) { m.bind(skel, new THREE.Matrix4()); m.frustumCulled = false; }
  return { group: g, bones };
}
// 사람 관절 가동 범위(라디안): 손가락 MCP 굽힘 90° · 젖힘 20°, PIP 105°, DIP 80°(PIP를 따라서만), 엄지 MCP 50° · IP 80°,
// 손목 굽힘 75° · 젖힘 65° · 새끼쪽 30° · 엄지쪽 20°, 팔꿈치 굽힘 145°(안쪽 각 35°) · 팔꿈치 방향은 자연 방향에서 ±60°
const LIMIT = { mcp: [-0.35, 1.57], pip: [0, 1.83], dip: [0, 1.4], dipPerPip: 0.85, thumbMcp: [0, 0.87], thumbIp: [-0.1, 1.4], spread: 0.35,
  wristFlex: 1.31, wristExt: 1.13, wristUlnar: 0.52, wristRadial: 0.35, elbowInner: (35 * Math.PI) / 180, elbowSwing: Math.PI / 3 };
const _D = new THREE.Vector3(), _E = new THREE.Vector3(), _P = new THREE.Vector3(), _X = new THREE.Vector3(), _Z = new THREE.Vector3(), _B = new THREE.Matrix4(), _W = new THREE.Vector3(), _V = new THREE.Vector3(), _Yv = new THREE.Vector3(0, 1, 0), _Qi = new THREE.Quaternion();
// S(어깨)·pole(팔꿈치가 향할 방향)은 arm.parent 공간. 생략하면 쉬는 자세 값
export function aimArm(arm, S = arm.userData.S0, pole = arm.userData.pole0) {
  const u = arm.userData;
  u.hand.updateMatrix();
  const W = _W.copy(u.wrist).applyMatrix4(u.hand.matrix);
  if (!u.a) {
    u.a = 0.29; u.b = 0.26;
    u.rig = makeArmMesh(u.M, u.a, u.b); arm.add(u.rig.group);
  }
  // 손이 팔 길이보다 멀면 팔을 늘리지 않고 어깨가 손 쪽으로 따라 나간다(실제로도 앞손 쪽 어깨를 내민다). 어깨는 화면 밖
  const reach = (u.a + u.b) * 0.985;
  const D = _P.copy(W).sub(S); let d = D.length();
  if (d > reach) { S = S.clone().addScaledVector(D, 1 - reach / d); D.copy(W).sub(S); d = reach; }
  // 팔꿈치 최대 굽힘 145°: 손이 어깨에 너무 가까우면 어깨가 뒤로 물러난다(팔꿈치가 그 이상 접히지 않게)
  const dMin = Math.sqrt(u.a * u.a + u.b * u.b - 2 * u.a * u.b * Math.cos(LIMIT.elbowInner));
  if (d < dMin) { S = W.clone().addScaledVector(D, -dMin / (d || 1)); D.copy(W).sub(S); d = dMin; }
  const n = D.divideScalar(d || 1), a = u.a, b = u.b;
  const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
  // 팔꿈치는 어깨–손목 축 둘레 원 위 어디든 될 수 있다. 손목이 관절 한계(굽힘 75° · 젖힘 65° · 새끼쪽 30° · 엄지쪽 20°)를
  // 넘지 않으면서 자연스러운 방향(아래·바깥)에 가까운 곳을 고른다. 매 프레임 17곳을 재 보고, 직전 위치에서 크게 튀지 않게
  const p0 = pole.clone().addScaledVector(n, -pole.dot(n)).normalize(), p1 = new THREE.Vector3().crossVectors(n, p0);
  const hq = _Qi.copy(u.hand.quaternion).invert(), side = u.mirror ? 1 : -1;     // 손바닥 쪽: 오른손 −x, 왼손 +x
  const wristAt = (psi, out) => {
    out.copy(S).addScaledVector(n, x).addScaledVector(p0, Math.cos(psi) * h).addScaledVector(p1, Math.sin(psi) * h);
    const f = _V.copy(out).sub(W).normalize().applyQuaternion(hq);                // 손 좌표에서 본 아래팔 방향(곧으면 +z)
    return [Math.atan2(side * f.x, f.z), Math.atan2(f.y, f.z)];   // [굽힘(+)/젖힘(−), 새끼쪽(+)/엄지쪽(−)]
  };
  const over = ([fl, dv]) => Math.max(0, fl - LIMIT.wristFlex) + Math.max(0, -fl - LIMIT.wristExt) + Math.max(0, dv - LIMIT.wristUlnar) + Math.max(0, -dv - LIMIT.wristRadial);
  let best = 0, bestC = Infinity; const prev = u.psi ?? 0, tmp = new THREE.Vector3();
  // 팔꿈치는 자연 방향(아래·바깥)에서 ±60°까지만 — 어깨 구조상 팔을 뻗은 채 팔꿈치를 위·안쪽으로 크게 돌릴 수 없다
  for (let i = 0; i <= 16; i++) {
    const psi = -LIMIT.elbowSwing + (i / 16) * LIMIT.elbowSwing * 2, w = wristAt(psi, tmp);
    let dp = psi - prev; dp = Math.atan2(Math.sin(dp), Math.cos(dp));
    const c = 40 * over(w) ** 2 + 2.5 * (1 - Math.cos(psi)) + 0.08 * (w[0] * w[0] + w[1] * w[1]) + 0.25 * dp * dp;
    if (c < bestC) { bestC = c; best = psi; }
  }
  // 고른 근처를 한 번 더 곱게
  for (let psi = Math.max(-LIMIT.elbowSwing, best - 0.13); psi <= Math.min(LIMIT.elbowSwing, best + 0.13); psi += 0.026) {
    const w = wristAt(psi, tmp); let dp = psi - prev; dp = Math.atan2(Math.sin(dp), Math.cos(dp));
    const c = 40 * over(w) ** 2 + 2.5 * (1 - Math.cos(psi)) + 0.08 * (w[0] * w[0] + w[1] * w[1]) + 0.25 * dp * dp;
    if (c < bestC) { bestC = c; best = psi; }
  }
  u.psi = best;
  const E = _E; u.wristAngles = wristAt(best, E);
  const pp = E.clone().sub(S).addScaledVector(n, -E.clone().sub(S).dot(n)).normalize();
  // 위팔 뼈: +y가 어깨→팔꿈치, +x(팔꿈치 끝)가 바깥(pole) 쪽
  const up = _D.copy(E).sub(S).normalize();
  _X.copy(pp).addScaledVector(up, -pp.dot(up)).normalize(); _Z.crossVectors(_X, up);
  const g = u.rig.group; g.position.copy(S); g.quaternion.setFromRotationMatrix(_B.makeBasis(_X, up, _Z));
  // 아래팔 뼈: 위팔 기준에서 팔꿈치→손목 방향으로(굽힘 평면 안에서만 돈다)
  _V.copy(W).sub(E).normalize().applyQuaternion(_Qi.copy(g.quaternion).invert());
  u.rig.bones[1].quaternion.setFromUnitVectors(_Yv, _V);
}

// 각인(롤마크): 금속에 레이저로 새긴 듯한 옅은 회색 글자. 왼쪽 면(플레이어 쪽)에 붙인다
const ENGRAVE = new Map();
function engraveMat(text, w, h, M) {
  const key = text + w + h;
  if (ENGRAVE.has(key)) return ENGRAVE.get(key);
  const W = 512, H = Math.max(32, Math.round((512 * h) / w));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.textBaseline = 'middle';
  let size = H * 0.8;
  g.font = `600 ${size}px 'Plex KR', sans-serif`;
  while (g.measureText(text).width > W * 0.98 && size > 6) { size *= 0.92; g.font = `600 ${size}px 'Plex KR', sans-serif`; }
  g.fillText(text, 2, H / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, color: lin(0.55, 0.56, 0.58), metalness: 0.9, roughness: 0.32, envMap: M.steel.envMap, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
  ENGRAVE.set(key, m);
  return m;
}
// 왼쪽 면(x<0, −x를 향함) 글자: 가운데(z,y), 크기 w×h
function engrave(add, M, text, x, y, z, w, h, parent) {
  const geo = new THREE.PlaneGeometry(w, h); geo.rotateY(-Math.PI / 2); geo.translate(x - 0.0002, y, z);
  return add(geo, engraveMat(text, w, h, M), parent);
}
const pinX = (r, len, x, y, z, mat, add, parent) => add(new THREE.CylinderGeometry(r, r, len, 12).rotateZ(Math.PI / 2).translate(x, y, z), mat, parent);

// ── 총 4종 ───────────────────────────────────────────────
// 반환: { group, muzzle, sightY, adsZ, mag, magRest, pump, coils, display, rightHand, leftHand, ret }
export function buildGun(id, M, extras) {
  const g = new THREE.Group();
  const add = (geo, mat, parent = g) => { const m = new THREE.Mesh(geo, M[mat] || mat); parent.add(m); return m; };
  const out = { group: g, coils: [] };
  if (id === 'pistol') buildPistol(g, add, M, out, extras);
  else if (id === 'rifle') buildRifle(g, add, M, out, extras);
  else if (id === 'shotgun') buildShotgun(g, add, M, out, extras);
  else buildRail(g, add, M, out, extras);
  out.magRest = out.mag ? out.mag.position.clone() : null;
  // 실제 파지처럼: 손바닥을 손잡이·핸드가드 표면에 붙이고 손가락을 닿을 때까지 감는다(왼손은 오른손도 피해서 감싼다)
  if (out.rightHand && out.rightHand.userData.fit && !(extras && extras.noFit)) {   // 게임에서는 뷰모델이 관절 범위 맞춤과 함께 한 번에 한다
    fitHand(g, out.rightHand, [], out.trigger);
    if (out.leftHand) fitHand(g, out.leftHand, [out.rightHand]);
    for (const a of [out.rightArm, out.leftArm]) if (a) aimArm(a);
  }
  bakeStatic(g, out);
  return out;
}

// 가공선(부품 이음새·밀링 단차): 옆면 x 위에 점 [z,y]를 잇는 가는 어두운 홈 — 넓은 평면을 실제 부품처럼 쪼갠다
function panelLine(pts, x, w = 0.0009, closed = false) {
  const parts = [], n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [z0, y0] = pts[i], [z1, y1] = pts[(i + 1) % n], len = Math.hypot(z1 - z0, y1 - y0);
    const b = new THREE.BoxGeometry(0.0006, w, len + w); b.rotateX(Math.atan2(y1 - y0, -(z1 - z0))); b.translate(x, (y0 + y1) / 2, (z0 + z1) / 2); parts.push(b);
  }
  return merge(parts);
}
// 모서리 모따기 면(긴 부품의 위·아래 모서리를 45°로 깎은 띠): 빛을 다르게 받아 단면이 팔각처럼 읽힌다
function chamfer(x, y, z0, z1, wdt, ang) { const g = new THREE.BoxGeometry(0.0012, wdt, z0 - z1); g.rotateZ(ang); g.translate(x, y, (z0 + z1) / 2); return g; }
// 나사 머리(육각 홈) — 옆면 x에
function screw(add, x, y, z, r = 0.0022) {
  const sx = Math.sign(x) || -1;
  add(new THREE.CylinderGeometry(r, r * 1.05, 0.0012, 14).rotateZ(Math.PI / 2).translate(x + sx * 0.0005, y, z), 'bright');
  add(new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.0014, 6).rotateZ(Math.PI / 2).translate(x + sx * 0.0008, y, z), 'bore');
}

// 움직이지 않는 부품(총 그룹 바로 아래, 변환 없음)을 재질별로 하나로 합친다 → 부품 수백 개라도 그리기 호출은 재질 수만큼
function bakeStatic(g, out) {
  const keep = new Set([out.display, out.ret, ...(out.coils || [])]);
  const byMat = new Map();
  for (const o of [...g.children]) {
    if (!o.isMesh || keep.has(o) || o.material.map || o.material.side === THREE.DoubleSide) continue;
    o.updateMatrix(); if (!o.matrix.equals(new THREE.Matrix4())) continue;
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(o);
  }
  for (const [mat, list] of byMat) {
    if (list.length < 2) continue;
    for (const o of list) g.remove(o);
    g.add(new THREE.Mesh(merge(list.map((o) => o.geometry)), mat));
    for (const o of list) o.geometry.dispose();
  }
}

function grooves(z0, z1, n, y0, y1, x, depth = 0.0007) {
  const parts = [];
  for (let i = 0; i < n; i++) { const z = z0 + ((z1 - z0) * (i + 0.5)) / n; parts.push(box(depth * 2, y1 - y0, 0.0012, x, (y0 + y1) / 2, z)); }
  return merge(parts);
}

function buildPistol(g, add, M, out, X) {
  // 슬라이드는 따로 묶어 사격·재장전 때 뒤로 밀린다(S)
  const S = new THREE.Group(); g.add(S); out.slide = S;
  // 슬라이드(강철): 뒤 0.048 → 앞 −0.15, 높이 0.012~0.046, 앞 윗모서리 사선
  // 슬라이드 앞쪽 경량화 창(양옆 관통) — 안의 총열이 보인다
  add(side([[0.048, 0.013], [0.048, 0.043, 0.004], [0.044, 0.047], [-0.13, 0.047, 0.003], [-0.15, 0.039, 0.004], [-0.15, 0.013]], 0.025,
    { holes: [[[-0.088, 0.021, 0.002], [-0.118, 0.021, 0.002], [-0.118, 0.034, 0.004], [-0.092, 0.038, 0.002]]], bevel: 0.0018 }), 'steel', S);
  add(lathe([[0, 0.03], [0.0068, 0.03], [0.0068, -0.146], [0, -0.146]], 18, 0.03), 'gunmetal');            // 총열(창으로 보임)
  add(rbox(0.0135, 0.007, 0.03, 0.002, 0.0, 0.0405, -0.008), 'gunmetal');                                 // 배출구 쪽 총열 후드
  add(lathe([[0, -0.1], [0.0032, -0.1], [0.0032, -0.149], [0, -0.149]], 10, 0.017), 'bright');            // 복좌 스프링 가이드
  // 슬라이드 위 조준경 장착판 덮개 + 나사 2개
  add(rbox(0.017, 0.0022, 0.034, 0.0008, 0, 0.0475, 0.003), 'gunmetal', S);
  for (const z of [-0.008, 0.014]) add(new THREE.CylinderGeometry(0.0016, 0.0016, 0.0012, 10).translate(0, 0.0488, z), 'bright', S);
  // 각인: 슬라이드 왼쪽
  engrave(add, M, 'P9 · 9×19 · NORDVAG ARMS', -0.0127, 0.027, -0.045, 0.07, 0.0048, S);
  // 슬라이드 톱니(뒤·앞) · 배출구 · 측면 각인 홈
  add(grooves(0.012, 0.044, 8, 0.02, 0.043, 0.0127), 'port', S); add(grooves(0.012, 0.044, 8, 0.02, 0.043, -0.0127), 'port', S);
  add(grooves(-0.13, -0.11, 4, 0.022, 0.042, 0.0127), 'port', S); add(grooves(-0.13, -0.11, 4, 0.022, 0.042, -0.0127), 'port', S);
  add(box(0.0008, 0.012, 0.032, 0.0128, 0.038, -0.02), 'port', S);   // 배출구(오른쪽)
  add(box(0.0006, 0.0015, 0.08, -0.0128, 0.022, -0.06), 'port', S);  // 왼쪽 분할선
  // 총열 끝(크라운) + 총구
  add(lathe([[0, 0], [0.0068, 0], [0.0068, 0.004], [0.0045, 0.0045], [0, 0.0045]], 20, 0.03, 0).translate(0, 0, -0.149), 'bright');
  add(cylZ(0.0035, 0.002, 0, 0.03, -0.1536, 12), 'bore');
  // 가늠자(뒤, 홈 있는 블록) · 가늠쇠(앞) + 야광점
  add(front([[-0.0105, 0.046], [0.0105, 0.046], [0.0098, 0.0545, 0.0012], [0.0024, 0.0545], [0.0024, 0.0497, 0.0012], [-0.0024, 0.0497, 0.0012], [-0.0024, 0.0545], [-0.0098, 0.0545, 0.0012]], 0.011, 0.0415, { bevel: 0.0005 }), 'steel', S);
  add(side([[0.03, 0.046], [0.03, 0.0525, 0.001], [0.022, 0.048], [0.02, 0.046]], 0.019, { bevel: 0.0005 }), 'steel', S); // 가늠자 앞 경사(옷에 안 걸리게)
  add(new THREE.CylinderGeometry(0.0012, 0.0012, 0.0012, 10).translate(0.0068, 0.0548, 0.034), 'bright', S); // 고정 나사
  add(side([[-0.13, 0.046], [-0.131, 0.0535, 0.001], [-0.138, 0.0535], [-0.141, 0.046]], 0.0045, { bevel: 0.0005 }), 'steel', S);
  add(new THREE.CircleGeometry(0.0013, 12).translate(0, 0.0512, -0.1305), 'tritium', S);
  for (const x of [-0.0062, 0.0062]) add(new THREE.CircleGeometry(0.0011, 12).translate(x, 0.0508, 0.0418), 'tritium', S);
  // 프레임(폴리머): 먼지 덮개 + 방아쇠울(구멍) + 기울어진 손잡이 + 비버테일
  const frame = [[0.047, 0.013], [0.064, 0.011, 0.006], [0.061, 0.0], [0.062, -0.012], [0.083, -0.088, 0.006], [0.044, -0.094, 0.006], [0.026, -0.03, 0.008], [0.012, -0.016],
    [-0.036, -0.026, 0.012], [-0.05, -0.012, 0.005], [-0.05, -0.002], [-0.142, -0.002, 0.002], [-0.142, 0.013]];
  add(side(frame, 0.027, { holes: [[[0.006, -0.004], [-0.04, -0.004], [-0.04, -0.012, 0.004], [-0.033, -0.018, 0.004], [0.0, -0.014, 0.002]]], bevel: 0.0026 }), 'fde');
  // 프레임 핀 2개 · 분해 레버 · 일련번호 판
  pinX(0.0016, 0.0278, 0, -0.001, 0.004, 'bright', add); pinX(0.0016, 0.0278, 0, 0.004, 0.036, 'bright', add);
  add(rbox(0.0024, 0.004, 0.012, 0.001, -0.0145, 0.004, -0.008), 'steel');
  add(rbox(0.0008, 0.005, 0.016, 0.0003, -0.0139, -0.008, -0.03), 'bright');
  // 손잡이 미끄럼 방지 패널(고무, 양옆) · 손가락 받침
  for (const x of [0.0142, -0.0142]) add(side([[0.064, -0.016], [0.08, -0.08, 0.004], [0.05, -0.085, 0.004], [0.034, -0.03], [0.04, -0.016]], 0.0015, { cx: x, bevel: 0.0004 }), 'stip');
  // 액세서리 레일 홈(먼지 덮개 아래)
  add(grooves(-0.13, -0.07, 3, -0.0015, 0.001, 0, 0.014), 'port');
  // 방아쇠 · 슬라이드 멈치 · 탄창 멈치
  add(side([[-0.006, -0.004], [-0.01, -0.012, 0.003], [-0.004, -0.019, 0.002], [-0.001, -0.019], [-0.004, -0.004]], 0.006, { bevel: 0.0008 }), 'bright');
  add(rbox(0.003, 0.004, 0.018, 0.0015, -0.0148, 0.007, -0.02), 'steel');
  add(rbox(0.003, 0.007, 0.007, 0.0015, -0.0148, -0.007, 0.022), 'steel');
  // 탄창(재장전 때 빠짐): 손잡이 속 몸통 + 바닥판
  const mag = new THREE.Group(); g.add(mag);
  add(side([[0.058, -0.03], [0.074, -0.088], [0.049, -0.092], [0.036, -0.03]], 0.018, { bevel: 0.0006 }), 'steel', mag);
  add(side([[0.078, -0.09], [0.08, -0.098, 0.002], [0.042, -0.099, 0.002], [0.044, -0.09]], 0.029, { bevel: 0.0012 }), 'polymer', mag);
  // 탄창: 잔탄 확인 구멍(왼쪽 3개) · 맨 위 탄 1발(황동 탄피 + 구리 탄두, 탄창이 빠졌을 때 보인다) · 바닥판 손가락 턱
  for (let i = 0; i < 3; i++) add(new THREE.CircleGeometry(0.0016, 10).rotateY(-Math.PI / 2).translate(-0.0092, -0.045 - i * 0.013, 0.048 + i * 0.0035), 'bore', mag);
  add(new THREE.CylinderGeometry(0.0049, 0.0049, 0.016, 12).rotateX(Math.PI / 2).rotateX(-0.25).translate(0, -0.029, 0.052), 'brass', mag);
  add(new THREE.SphereGeometry(0.0046, 12, 8).scale(1, 1, 1.5).rotateX(-0.25).translate(0, -0.027, 0.04), 'copper', mag);
  add(side([[0.045, -0.098], [0.04, -0.104, 0.002], [0.03, -0.103, 0.002], [0.034, -0.097]], 0.022, { bevel: 0.001 }), 'polymer', mag);
  out.mag = mag;
  // 손잡이 끝 끈 고리 · 약실 확인 표시(슬라이드 위 작은 돌기)
  add(new THREE.TorusGeometry(0.0045, 0.0012, 6, 14).rotateY(Math.PI / 2).translate(0, -0.088, 0.083), 'steel');
  add(rbox(0.004, 0.0016, 0.008, 0.0006, 0.004, 0.0474, -0.034), 'bright', S);
  // 슬라이드 뒤 작은 탄수 표시(카메라 쪽)
  out.display = add(new THREE.PlaneGeometry(0.019, 0.009), X.ammoMat, S); out.display.position.set(0, 0.031, 0.0486);
  // ── 표면 디테일 ──
  for (const sx of [-1, 1]) {
    // 슬라이드 아래 모서리 모따기 · 앞 경사면 가공선 · 프레임: 먼지 덮개 이음새 · 레일 옆 홈 · 엄지 받침 단차 · 점각 테두리
    add(chamfer(sx * 0.0118, 0.0145, 0.046, -0.148, 0.004, -sx * Math.PI / 4), 'steel', S);
    add(panelLine([[-0.112, 0.046], [-0.112, 0.016]], sx * 0.0128), 'port', S);
    add(panelLine([[-0.05, -0.002], [-0.14, -0.002]], sx * 0.0139), 'port');
    add(panelLine([[-0.06, 0.006], [-0.138, 0.006]], sx * 0.0139), 'port');
    add(panelLine([[0.008, 0.008], [-0.03, 0.008], [-0.036, 0.0]], sx * 0.0139), 'port');
    add(panelLine([[0.064, -0.016], [0.08, -0.08], [0.05, -0.085], [0.034, -0.03], [0.04, -0.016]], sx * 0.0148, 0.0008, true), 'port');
    screw(add, sx * 0.0138, -0.05, 0.068, 0.0015);
  }
  out.muzzle = new THREE.Vector3(0, 0.03, -0.16);
  out.trigger = new THREE.Vector3(0, -0.011, -0.008);
  // 동작 기준점: 탄피 배출구 · 왼손이 탄창을 끼우는 곳(손잡이 밑) · 슬라이드를 당기는 곳
  out.eject = new THREE.Vector3(0.013, 0.038, -0.02); out.casing = 'pistol';
  out.magHand = new THREE.Vector3(0.05, -0.13, 0.07); out.rackPt = new THREE.Vector3(-0.034, 0.0, 0.01); out.slideTravel = 0.036;  // 슬라이드 뒤쪽 톱니를 왼손으로 집어 당김
  out.sightY = 0.0505; out.adsZ = -0.33;
  // 손: 오른손 손잡이, 왼손 감싸쥠
  const tilt = 0.27;
  // 엄지 앞으로(thumbs-forward) 파지: 오른손은 손잡이 높이 잡고 엄지를 프레임 왼쪽 위로 뻗어 표적을 가리킨다.
  // 왼손은 손바닥으로 손잡이 왼쪽 빈 곳을 덮고 손가락이 오른손 손가락 위를 45° 아래로 감싸며, 엄지는 오른손 엄지 아래에서 나란히 앞을 본다
  const R = makeHand(M, { curls: [[0.3, 0.3, 0.2], [1.2, 1.45, 0.95], [1.25, 1.5, 1.0], [1.3, 1.5, 1.0]], thumb: { dir: [0.06, 0.31, -0.95], curl: 0.05 } });
  // 실제 파지(엄지 앞으로): 오른손 검지 MCP는 프레임 오른쪽 슬라이드 바로 아래·방아쇠울 뒤, 새끼 MCP는 손잡이 아래,
  // 손목은 손잡이 뒤(총열 선을 따라 조금 아래) · 엄지는 프레임 왼쪽 위를 따라 앞으로
  placeHand(R, { index: [0.021, -0.016, 0.032], pinky: [0.021, -0.076, 0.058], wrist: [0.03, -0.066, 0.142] }); R.userData.thumbAt = [-0.017, 0.002, -0.035];
  g.add(R);
  const L = makeHand(M, { mirror: true, curls: [[1.0, 1.15, 0.75], [1.0, 1.2, 0.8], [1.05, 1.25, 0.8], [1.1, 1.25, 0.8]], thumb: { dir: [0.07, 0.75, -0.65], curl: 0.05 } });   // 오른손 손가락 위를 감싸 굵기 약 5 cm
  // 왼손: 손바닥이 손잡이 왼쪽 빈 곳을 덮고, 검지 MCP는 방아쇠울 앞 아래, 손목은 45° 아래로 꺾여 뒤쪽 · 엄지는 오른손 엄지 아래에서 앞으로
  placeHand(L, { index: [-0.026, -0.03, -0.004], pinky: [-0.03, -0.078, 0.034], wrist: [-0.05, -0.085, 0.112] }); L.userData.thumbAt = [-0.02, -0.01, -0.05];
  g.add(L);
  out.rightArm = armFrom(g, M, R, false, [0.13, -0.2, 0.42]);
  out.leftArm = armFrom(g, M, L, true, [-0.24, -0.2, 0.4]);
  out.rightHand = R; out.leftHand = L;
}

function buildRifle(g, add, M, out, X) {
  // M4A1(URG-I) 실측 비율: 상부 리시버 180 mm · 13" 핸드가드 · 14.5" 총열(노리쇠 면에서) · 30발 PMAG · 카빈 완충관.
  // 좌표: 총열 축 y = 0.012, 상부 리시버 뒤 z = 0.12 → 앞 −0.06, 노리쇠 면 z ≈ −0.014, 총구 −0.382(+소염기 −0.438)
  const B = 0.012;
  // ── 상부 리시버(플랫톱) ──
  add(side([[0.12, -0.003], [0.12, 0.034, 0.003], [0.114, 0.04], [-0.06, 0.04], [-0.06, -0.003]], 0.029, { bevel: 0.002 }), 'anod');
  // 위 레일: 리시버 뒤에서 핸드가드 앞끝까지 한 줄로 이어진 굵은 이빨(참고 사진의 SCAR형 일체 상부)
  add(picatinny(0.118, -0.388, 0.048, 0.024, 0.014, 0.0075, 0.0058), 'anod');
  // 배출구(오른쪽) · 덮개 · 전진 보조 버튼 · 탄피 튕김막이 · 왼쪽 볼트 멈치 쪽 낮은 면
  add(box(0.0008, 0.016, 0.052, 0.0146, 0.016, 0.03), 'port');
  add(side([[0.058, 0.004], [0.058, 0.028, 0.002], [0.004, 0.028, 0.002], [0.004, 0.004]], 0.0012, { cx: 0.0156, bevel: 0.0003 }), 'steel');
  add(side([[0.075, 0.03], [0.072, 0.036, 0.002], [0.058, 0.032], [0.058, 0.026]], 0.01, { cx: 0.0175, bevel: 0.001 }), 'anod');
  add(cylZ(0.0055, 0.016, 0, 0, 0, 14).rotateY(Math.PI / 2).rotateZ(0).translate(0.019, 0.02, 0.085), 'anod');
  add(cylZ(0.0035, 0.006, 0, 0, 0, 12).rotateY(Math.PI / 2).translate(0.028, 0.02, 0.085), 'steel');
  add(side([[0.11, 0.004], [0.11, 0.03, 0.003], [-0.05, 0.03, 0.003], [-0.05, 0.004, 0.003]], 0.0012, { cx: -0.0146, bevel: 0.0004 }), 'anod');
  const CH = new THREE.Group(); g.add(CH); out.charge = CH;          // 장전 손잡이(T자, 뒤로 당김)
  add(side([[0.145, 0.036], [0.145, 0.046, 0.002], [0.118, 0.046], [0.118, 0.036]], 0.012, { bevel: 0.001 }), 'anod', CH);
  add(side([[0.146, 0.037], [0.15, 0.045, 0.003], [0.138, 0.046], [0.138, 0.037]], 0.05, { bevel: 0.0015 }), 'anod', CH);
  const BOLT = new THREE.Group(); g.add(BOLT); out.bolt = BOLT;       // 노리쇠 뭉치(배출구로 보임)
  add(rbox(0.006, 0.013, 0.05, 0.002, 0.0118, 0.016, 0.03), 'bright', BOLT);
  // ── 하부 리시버: 완충관 연결부 · 탄창 삽입구(앞 플레어) · 방아쇠울(일체형) ──
  add(side([[0.12, -0.003], [0.12, -0.024, 0.004], [0.104, -0.03], [0.064, -0.03], [0.058, -0.046, 0.004], [0.004, -0.05, 0.006], [-0.006, -0.034],
    [-0.008, -0.074, 0.002], [-0.074, -0.078, 0.003], [-0.078, -0.05], [-0.068, -0.012, 0.004], [-0.06, -0.003]], 0.028,
    { holes: [[[0.052, -0.03], [0.05, -0.04, 0.003], [0.008, -0.043, 0.004], [0.002, -0.034, 0.002], [0.002, -0.03]]], bevel: 0.002 }), 'anod');
  add(side([[-0.006, -0.072], [-0.008, -0.08, 0.002], [-0.076, -0.083, 0.002], [-0.078, -0.075]], 0.032, { bevel: 0.0015 }), 'anod');  // 삽입구 아래 플레어
  for (const [z, y] of [[0.106, -0.012], [-0.052, -0.012]]) pinX(0.0032, 0.0315, 0, y, z, 'bright', add);       // 분해 핀 · 앞 경첩 핀
  add(side([[-0.004, -0.018], [-0.002, -0.006, 0.002], [-0.03, -0.004, 0.002], [-0.032, -0.016]], 0.004, { cx: -0.0158, bevel: 0.0008 }), 'steel');  // 볼트 멈치
  add(cylZ(0.0042, 0.004, 0, 0, 0, 12).rotateY(Math.PI / 2).translate(0.0158, -0.03, -0.004), 'steel');          // 탄창 멈치 버튼(오른쪽)
  engrave(add, M, 'AR-7  M4A1', -0.0142, -0.05, -0.04, 0.05, 0.0065);
  engrave(add, M, 'CAL 5.56 MM · NORDVAG', -0.0142, -0.062, -0.042, 0.05, 0.004);
  engrave(add, M, 'SAFE   SEMI   AUTO', -0.0142, -0.004, 0.072, 0.034, 0.0036);
  add(new THREE.CircleGeometry(0.0012, 10).rotateY(-Math.PI / 2).translate(-0.0152, -0.012, 0.062), 'accent');
  add(new THREE.CylinderGeometry(0.0062, 0.0062, 0.002, 14).rotateZ(Math.PI / 2).translate(-0.0148, -0.012, 0.08), 'steel');  // 조정간 레버
  add(side([[0.084, -0.0135], [0.084, -0.0105], [0.064, -0.009, 0.001], [0.064, -0.015]], 0.002, { cx: -0.0158, bevel: 0.0004 }), 'steel');
  add(side([[0.034, -0.03], [0.03, -0.04, 0.003], [0.036, -0.047], [0.039, -0.047], [0.038, -0.03]], 0.0055, { bevel: 0.0007 }), 'bright');  // 방아쇠
  // 권총손잡이(25° 경사, 손가락 홈 없는 MOE형, 뒤쪽 볼록 · 밑판)
  add(side([[0.064, -0.03], [0.1, -0.03], [0.108, -0.044, 0.006], [0.138, -0.128, 0.012], [0.132, -0.138, 0.004], [0.104, -0.14, 0.004], [0.098, -0.13], [0.072, -0.05, 0.008]], 0.029, { bevel: 0.0035 }), 'blkPoly');
  add(side([[0.106, -0.134], [0.136, -0.132, 0.003], [0.134, -0.142, 0.003], [0.104, -0.144, 0.003]], 0.03, { bevel: 0.0012 }), 'blkPoly');
  // ── 완충관 · 성곽 너트 · 끝판 · 개머리(SOPMOD형, 중간 위치) ──
  // SCAR형: 둥근 완충관 대신 리시버 뒤에 붙는 각진 접철 경첩 블록 → 개머리 몸통
  add(side([[0.118, 0.034], [0.21, 0.034, 0.004], [0.21, -0.016, 0.004], [0.13, -0.022, 0.006], [0.118, -0.016]], 0.03, { bevel: 0.003 }), 'blkPoly');
  add(cylZ(0.0045, 0.034, 0, 0, 0, 14).rotateY(Math.PI / 2).translate(0, 0.022, 0.125), 'steel');   // 경첩 축
  add(side([[0.118, -0.003], [0.128, -0.003], [0.128, 0.02], [0.118, 0.02]], 0.04, { bevel: 0.0015 }), 'steel');   // 끝판(멜빵 고리)
  const stock = [[0.2, 0.036], [0.2, -0.012, 0.004], [0.226, -0.03, 0.01], [0.33, -0.074, 0.01], [0.362, -0.078, 0.006], [0.362, 0.044, 0.006], [0.27, 0.05, 0.012], [0.21, 0.046, 0.006]];
  add(side(stock, 0.04, { holes: [[[0.238, 0.026, 0.004], [0.236, 0.004, 0.006], [0.316, -0.044, 0.008], [0.336, -0.046, 0.004], [0.336, 0.03, 0.006], [0.27, 0.033, 0.008]]], bevel: 0.004 }), 'blkPoly');
  add(side([[0.362, 0.046], [0.362, -0.08], [0.378, -0.082, 0.008], [0.378, 0.048, 0.008]], 0.042, { bevel: 0.003 }), 'rubber');  // 고무 받침
  add(side([[0.2, -0.01], [0.206, -0.022, 0.003], [0.25, -0.03, 0.004], [0.252, -0.022]], 0.012, { bevel: 0.001 }), 'polymer');     // 조절 레버
  for (const x of [-0.021, 0.021]) add(cylZ(0.0055, 0.002, 0, 0, 0, 14).rotateY(Math.PI / 2).translate(x, 0.024, 0.255), 'steel'); // QD 소켓
  // ── 핸드가드: 가늘고 모서리가 둥근 매끈한 폴리머(참고 사진) · 앞쪽에만 작은 환기 구멍 3개 ──
  const vents = [];
  for (let i = 0; i < 3; i++) { const z = -0.318 - i * 0.022; vents.push([[z, B + 0.006, 0.002], [z - 0.014, B + 0.006, 0.002], [z - 0.014, B - 0.004, 0.002], [z, B - 0.004, 0.002]]); }
  add(side([[-0.06, 0.04], [-0.382, 0.04], [-0.392, 0.03, 0.008], [-0.392, -0.006, 0.008], [-0.382, -0.017, 0.008], [-0.07, -0.017], [-0.06, -0.01]], 0.03, { holes: vents, bevel: 0.0055 }), 'blkCera');
  for (const sx of [-1, 1]) {
    add(panelLine([[-0.066, 0.031], [-0.378, 0.031]], sx * 0.0206), 'port');      // 레일 받침과 핸드가드 이음
    for (const z of [-0.08, -0.2]) screw(add, sx * 0.0206, 0.022, z, 0.0016);
    add(panelLine([[0.11, 0.004], [-0.058, 0.004]], sx * 0.0146), 'port');
    add(panelLine([[-0.008, -0.034], [-0.006, -0.072], [-0.074, -0.076], [-0.068, -0.012]], sx * 0.0141), 'port');
    add(side([[0.104, -0.048], [0.132, -0.122, 0.004], [0.112, -0.128], [0.088, -0.056]], 0.0012, { cx: sx * 0.0148, bevel: 0.0003 }), 'stip');   // 손잡이 점각
  }
  add(lathe([[0, -0.06], [0.021, -0.06], [0.021, -0.07], [0, -0.07]], 20, B), 'steel');                       // 총열 너트(핸드가드 안 뒤쪽이 살짝 보임)
  // 멜빵 고리(핸드가드 왼쪽 아래 앞 · 사진처럼 아래로 매달린 고리)
  add(new THREE.TorusGeometry(0.0055, 0.0013, 6, 14).rotateY(Math.PI / 2).translate(-0.02, -0.026, -0.36), 'steel');
  // ── 총열 · 소염기(SFMB형: 구멍 뚫린 원통 + 홈) ──
  add(lathe([[0, -0.388], [0.0098, -0.388], [0.0098, -0.384], [0.0078, -0.382], [0.0078, -0.39], [0, -0.39]], 18, B), 'steel');
  { const pr = [[0, -0.39], [0.0112, -0.39], [0.0112, -0.396]];
    for (let i = 0; i < 6; i++) pr.push([0.0112, -0.398 - i * 0.006], [0.0102, -0.399 - i * 0.006], [0.0102, -0.402 - i * 0.006], [0.0112, -0.403 - i * 0.006]);
    pr.push([0.0112, -0.434], [0.0104, -0.438], [0, -0.438]); add(lathe(pr, 24, B), 'cerakote'); }
  add(cylZ(0.0046, 0.002, 0, B, -0.4385, 12), 'bore');
  // 접이식 예비 가늠자(뒤) · 가늠쇠(앞, 눕힌 상태)
  add(side([[0.112, 0.051], [0.11, 0.058, 0.002], [0.086, 0.057, 0.003], [0.08, 0.051]], 0.016, { bevel: 0.0009 }), 'anod');
  add(side([[-0.35, 0.051], [-0.35, 0.058, 0.002], [-0.382, 0.056, 0.003], [-0.386, 0.051]], 0.017, { bevel: 0.0008 }), 'anod');
  // ── 30발 PMAG(앞으로 휜 몸통, 아래로 갈수록 앞쪽) ──
  const mag = new THREE.Group(); g.add(mag);
  const magBody = [[-0.012, -0.004], [-0.014, -0.08], [-0.03, -0.15, 0.03], [-0.05, -0.208, 0.008], [-0.108, -0.2, 0.008], [-0.092, -0.14, 0.03], [-0.076, -0.08], [-0.072, -0.004]];
  add(side(magBody, 0.024, { bevel: 0.002 }), 'polymer', mag);
  add(side([[-0.048, -0.204], [-0.05, -0.214, 0.002], [-0.112, -0.206, 0.002], [-0.108, -0.198]], 0.028, { bevel: 0.0014 }), 'polymer', mag);  // 바닥판
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) add(rbox(0.0012, 0.009, 0.044 - i * 0.002, 0.0005, sx * 0.0122, -0.1 - i * 0.022, -0.05 - i * 0.008), 'polymer', mag);   // 와플 결
    add(panelLine([[-0.014, -0.078], [-0.074, -0.078]], sx * 0.0122), 'port', mag);
  }
  add(side([[-0.062, -0.084], [-0.07, -0.13, 0.002], [-0.078, -0.128, 0.002], [-0.07, -0.084]], 0.0008, { cx: -0.01245, bevel: 0.0002 }), 'lens', mag);  // 잔탄 창
  for (let i = 0; i < 5; i++) add(box(0.0004, 0.0045, 0.006, -0.0127, -0.09 - i * 0.008, -0.067 - i * 0.0012), 'brass', mag);
  add(new THREE.CylinderGeometry(0.0048, 0.0052, 0.034, 12).rotateX(Math.PI / 2).translate(0, -0.002, -0.04), 'brass', mag);   // 맨 위 탄
  add(new THREE.ConeGeometry(0.0028, 0.016, 12).rotateX(-Math.PI / 2).translate(0, -0.002, -0.065), 'copper', mag);
  out.mag = mag;
  // ── 열린 반사 조준경(참고 사진): 넓은 받침 상자 + 둥근 모서리 직사각 창틀(위가 트인 듯 가는 테) + 오른쪽 배터리·밝기 상자 ──
  add(side([[0.032, 0.048], [0.032, 0.058, 0.002], [-0.03, 0.058, 0.002], [-0.03, 0.048]], 0.03, { bevel: 0.0014 }), 'anod');           // 받침(레일 물림)
  add(side([[0.03, 0.058], [0.03, 0.064, 0.002], [-0.028, 0.064, 0.002], [-0.028, 0.058]], 0.026, { bevel: 0.0012 }), 'anod');          // 몸통 위층
  add(side([[0.028, 0.05], [0.028, 0.074, 0.003], [-0.02, 0.074, 0.003], [-0.02, 0.05]], 0.018, { cx: 0.026, bevel: 0.0015 }), 'anod');  // 오른쪽 배터리 상자
  for (const z of [0.014, -0.004]) add(cylZ(0.0042, 0.004, 0, 0, 0, 14).rotateY(Math.PI / 2).translate(0.037, 0.062, z), 'rubber');     // 밝기·영점 다이얼
  add(side([[0.02, 0.064], [0.02, 0.07, 0.002], [0.004, 0.07, 0.002], [0.004, 0.064]], 0.012, { bevel: 0.001 }), 'rubber');             // 위 버튼
  // 창틀: 바깥 둥근 사각(폭 6 cm · 높이 5 cm, 사진처럼 크고 높게) − 안쪽 창, 두께 7 mm. 창 가운데 = 조준선 높이(sightY 0.079)
  add(front([[-0.03, 0.054], [0.03, 0.054], [0.03, 0.095, 0.01], [0.022, 0.104, 0.008], [-0.022, 0.104, 0.008], [-0.03, 0.095, 0.01]], 0.007, -0.027,
    { holes: [[[-0.0255, 0.059], [0.0255, 0.059], [0.0255, 0.093, 0.008], [0.019, 0.0995, 0.006], [-0.019, 0.0995, 0.006], [-0.0255, 0.093, 0.008]]], bevel: 0.0014, seg: 10 }), 'anod');
  add(new THREE.PlaneGeometry(0.05, 0.039).translate(0, 0.079, -0.024), 'lens');
  out.ret = add(new THREE.PlaneGeometry(0.014, 0.014).translate(0, 0.079, -0.0235), X.reticleMat);
  out.display = add(new THREE.PlaneGeometry(0.026, 0.012), X.ammoMat); out.display.position.set(-0.0154, 0.02, -0.03); out.display.rotation.y = -Math.PI / 2;
  out.muzzle = new THREE.Vector3(0, B, -0.45);
  out.trigger = new THREE.Vector3(0, -0.038, 0.031);
  out.eject = new THREE.Vector3(0.016, 0.016, 0.03); out.casing = 'rifle';
  out.magHand = new THREE.Vector3(-0.04, -0.2, -0.07); out.rackPt = new THREE.Vector3(-0.05, -0.03, -0.02); out.boltTravel = 0.04;
  out.sightY = 0.079; out.adsZ = -0.17;
  // 손: 오른손 권총손잡이(엄지는 조정간 위로 감음) · 왼손 C-클램프(핸드가드 앞쪽, 엄지는 왼쪽 면을 따라 앞으로)
  const tilt = 0.42;
  const R = makeHand(M, { curls: [[0.3, 0.3, 0.2], [1.2, 1.45, 0.95], [1.25, 1.5, 1.0], [1.3, 1.5, 1.0]], thumb: { dir: [-0.9, 0.45, -0.45], curl: 0.3 } });
  // 권총손잡이: 검지 MCP는 오른쪽 리시버 바로 아래(방아쇠울 뒤), 새끼 MCP는 손잡이 아래쪽 뒤, 손목은 손잡이 뒤 · 엄지는 위로 넘어가 조정간 옆
  placeHand(R, { index: [0.021, -0.044, 0.066], pinky: [0.022, -0.108, 0.094], wrist: [0.03, -0.1, 0.19] }); R.userData.thumbAt = [-0.02, -0.014, 0.07]; g.add(R);
  const L = makeHand(M, THUMB_HAND);
  // 엄지 뻗어 잡기(참고 사진): 손바닥이 핸드가드 왼쪽 아래 모서리를 받치고(손등은 왼쪽 아래 = 화면에 보임) 네 손가락은 밑을 지나 오른쪽 면으로(안 보임),
  // 엄지는 왼쪽 면을 타고 올라가 윗모서리를 따라 총구 쪽으로 곧게 뻗는다. 손목은 손 아래·뒤 → 아래팔이 화면 왼쪽 아래로 내려간다
  placeHand(L, { index: [-0.022, -0.037, -0.28], pinky: [-0.026, -0.03, -0.335], wrist: [-0.075, -0.07, -0.235] }); L.userData.thumbAt = [-0.024, 0.03, -0.44]; g.add(L);
  out.rightArm = armFrom(g, M, R, false, [0.1, -0.18, 0.4]);
  out.leftArm = armFrom(g, M, L, true, [-0.28, -0.16, 0.6]);
  out.rightHand = R; out.leftHand = L;
}

function buildShotgun(g, add, M, out, X) {
  // 배그 S1897(윈체스터 1897)형: 회색 강철 리시버(둥근 윗면, 레일 없음) · 구멍 뚫린 열 차단 덮개 · 나무 펌프·개머리
  add(side([[0.12, -0.02], [0.12, 0.034, 0.006], [0.1, 0.047, 0.006], [-0.1, 0.047, 0.004], [-0.105, 0.04], [-0.105, -0.02]], 0.036, { bevel: 0.0035 }), 'gunsteel');
  // 노출 공이치기(리시버 뒤 위)
  add(side([[0.13, 0.03], [0.142, 0.05, 0.003], [0.136, 0.054, 0.002], [0.122, 0.036]], 0.008, { bevel: 0.001 }), 'steel');
  // 리시버 각인 · 핀 · 크로스볼트 안전장치 · 탄 넣는 구멍(아래)
  engrave(add, M, 'M12 12GA', -0.0182, 0.032, 0.04, 0.05, 0.0065);
  engrave(add, M, '3" CHAMBER · NORDVAG ARMS', -0.0182, 0.0, -0.06, 0.06, 0.0042);
  pinX(0.0022, 0.0368, 0, -0.012, 0.09, 'bright', add); pinX(0.0022, 0.0368, 0, -0.012, -0.08, 'bright', add);
  pinX(0.0032, 0.031, 0, -0.03, 0.098, 'steel', add);
  add(new THREE.CircleGeometry(0.0024, 12).rotateY(-Math.PI / 2).translate(-0.0158, -0.03, 0.098), 'accent');
  add(box(0.024, 0.0008, 0.08, 0, -0.0204, -0.04), 'port');
  add(box(0.0008, 0.018, 0.07, 0.0181, 0.02, -0.02), 'port');
  // 방아쇠울 · 방아쇠 · 손잡이 · 개머리판(일체형 폴리머)
  add(side([[0.11, -0.02], [0.1, -0.04, 0.004], [0.04, -0.044, 0.006], [0.02, -0.02]], 0.026, { holes: [[[0.09, -0.024], [0.084, -0.036, 0.004], [0.048, -0.038, 0.004], [0.034, -0.024]]], bevel: 0.0014 }), 'gunsteel');
  add(side([[0.068, -0.024], [0.064, -0.033, 0.003], [0.07, -0.038], [0.073, -0.038], [0.071, -0.024]], 0.006, { bevel: 0.0007 }), 'bright');
  // 레밍턴 870 전통 개머리판(권총손잡이 없음): 손목(잡는 곳)이 가늘고 아래로 휘며 뒤로 갈수록 높아진다. 빗장 낙차 38 mm · 뒤꿈치 64 mm(총열 리브 기준)
  add(side([[0.118, 0.036], [0.15, 0.033, 0.01], [0.215, 0.014, 0.03], [0.372, -0.012, 0.01], [0.38, -0.016], [0.38, -0.142], [0.362, -0.144, 0.012], [0.25, -0.1, 0.03], [0.2, -0.066, 0.03], [0.15, -0.04, 0.012], [0.118, -0.022]], 0.04, { bevel: 0.006, seg: 12 }), 'wood');
  add(side([[0.38, -0.014], [0.394, -0.014, 0.006], [0.396, -0.144, 0.006], [0.38, -0.146]], 0.042, { bevel: 0.002 }), 'rubber');
  // 총열 + 탄창관 + 고정 고리 + 가늠쇠 구슬
  add(lathe([[0, -0.1], [0.0112, -0.1], [0.0112, -0.55], [0.0125, -0.552], [0.0125, -0.56], [0, -0.56]], 22, 0.03), 'steel');
  // 총열 위 통풍 리브(얇은 띠 + 기둥) · 펌프 아래 액션 바 2개 · 탄창관 마개 멜빵 고리
  for (const x of [0.008, -0.008]) add(box(0.0025, 0.004, 0.11, x, 0.004, -0.15), 'steel');
  add(new THREE.TorusGeometry(0.007, 0.0016, 6, 16).translate(0, -0.008, -0.542), 'steel');
  add(cylZ(0.0085, 0.002, 0, 0.03, -0.561, 14), 'bore');
  add(lathe([[0, -0.1], [0.0105, -0.1], [0.0105, -0.5], [0.0095, -0.505], [0, -0.505]], 20, 0.004), 'steel');
  // 탄창관 마개(홈 파인 손잡이)
  { const pr = [[0, -0.505], [0.012, -0.505]]; for (let i = 0; i < 5; i++) pr.push([0.0128, -0.508 - i * 0.006], [0.0118, -0.511 - i * 0.006]); pr.push([0.011, -0.54], [0, -0.54]); add(lathe(pr, 20, 0.004), 'polymer'); }
  add(side([[-0.44, 0.04], [-0.44, -0.008, 0.004], [-0.47, -0.008, 0.004], [-0.47, 0.04]], 0.026, { holes: [], bevel: 0.002 }), 'anod');
  add(new THREE.SphereGeometry(0.0028, 10, 8).translate(0, 0.044, -0.545), 'bright');
  // 열 차단 덮개(구멍 뚫린 반원통)
  // 펌프 앞에서 총구 바로 뒤까지 총열을 덮는 덮개(윗반 원통) + 위·양옆 세 줄의 긴 구멍(배그 S1897처럼 촘촘하게)
  { const sh = new THREE.CylinderGeometry(0.0165, 0.0165, 0.2, 20, 1, true, -Math.PI * 0.62, Math.PI * 1.24); sh.rotateX(Math.PI / 2); sh.translate(0, 0.03, -0.45); add(sh, 'gunsteel').material.side = THREE.DoubleSide; }
  for (let z = -0.362; z > -0.54; z -= 0.013) for (const a of [-0.55, 0, 0.55]) add(box(0.0042, 0.0012, 0.008, 0, 0, 0).rotateZ(-a).translate(Math.sin(a) * 0.0166, 0.03 + Math.cos(a) * 0.0166, z), 'bore');
  // 펌프(홈 있는 손받침) — 사격 후 앞뒤로
  const pump = new THREE.Group(); g.add(pump);
  const pp = [[0, -0.2], [0.021, -0.2]];
  for (let i = 0; i < 8; i++) { const z = -0.205 - i * 0.017; pp.push([0.024, z], [0.024, z - 0.011], [0.021, z - 0.013], [0.021, z - 0.017]); }
  pp.push([0.021, -0.345], [0, -0.345]);
  const pg = lathe(pp, 24, 0.0); pg.scale(1.15, 1, 1); add(pg, 'wood', pump);
  pump.position.y = 0.004;
  out.pump = pump; out.pumpRest = 0;
  // 탄수 표시
  out.display = add(new THREE.PlaneGeometry(0.03, 0.013), X.ammoMat); out.display.position.set(-0.0185, 0.032, -0.07); out.display.rotation.y = -Math.PI / 2;
  // ── 표면 디테일 ──
  for (const sx of [-1, 1]) {
    // 리시버 옆 밀링 홈(한 단 낮은 판) · 위 모서리 모따기 · 나사
    add(side([[0.105, 0.03], [0.105, 0.0, 0.004], [-0.09, 0.0, 0.004], [-0.09, 0.03, 0.004]], 0.0012, { cx: sx * 0.0184, bevel: 0.0003 }), 'steel');
    add(chamfer(sx * 0.016, 0.044, 0.105, -0.098, 0.006, sx * Math.PI / 4), 'gunsteel');
    for (const z of [0.1, -0.095]) screw(add, sx * 0.0186, 0.038, z, 0.0016);
    // 개머리판 가공선(뺨 받침 경계) · 멜빵 고리
    add(panelLine([[0.15, 0.03], [0.36, 0.026], [0.372, -0.08]], sx * 0.0193), 'port');
  }
  add(new THREE.TorusGeometry(0.006, 0.0014, 6, 14).translate(-0.0205, -0.06, 0.33), 'steel');
  for (let i = 0; i < 6; i++) add(box(0.041, 0.0016, 0.0015, 0, 0.022 - i * 0.019, 0.396), 'polymer');  // 개머리 고무 받침 줄
  out.muzzle = new THREE.Vector3(0, 0.03, -0.575);
  out.trigger = new THREE.Vector3(0, -0.031, 0.064);
  out.eject = new THREE.Vector3(0.019, 0.02, -0.02); out.casing = 'shell';
  out.magHand = new THREE.Vector3(-0.01, -0.06, -0.02);   // 탄 넣는 구멍(아래)
  out.sightY = 0.047; out.adsZ = -0.24;
  const tilt = 0.85;   // 손목을 쥐는 각(권총손잡이보다 많이 눕는다)
  const R = makeHand(M, { curls: [[0.3, 0.3, 0.2], [1.2, 1.45, 0.95], [1.25, 1.5, 1.0], [1.3, 1.5, 1.0]], thumb: { dir: [-0.95, 0.35, -0.5], curl: 0.3 } });
  // 개머리 손목: 검지 MCP는 손목 오른쪽 앞(방아쇠울 뒤), 새끼 MCP는 아래 뒤, 손목은 개머리 쪽 · 엄지는 빗장을 넘어 왼쪽으로
  placeHand(R, { index: [0.023, -0.028, 0.122], pinky: [0.023, -0.07, 0.152], wrist: [0.03, -0.075, 0.245] }); R.userData.thumbAt = [-0.024, 0.02, 0.12]; g.add(R);
  // 왼손: 펌프를 아래에서 감싸 쥐고(손가락은 오른쪽 면으로, 엄지는 왼쪽 면을 따라 앞으로) 앞으로 밀어 반동을 누른다
  const L = makeHand(M, PUMP_HAND);
  // 펌프: 손바닥이 펌프 왼쪽 아래를 감싸고 손가락은 아래로 돌아 오른쪽 면으로, 손목은 왼쪽 옆 · 엄지는 왼쪽 면을 따라 앞으로
  placeHand(L, { index: [0.004, -0.038, -0.305], pinky: [0.004, -0.04, -0.25], wrist: [-0.076, -0.056, -0.27] }); L.userData.thumbAt = [-0.026, 0.02, -0.34]; pump.add(L);
  out.rightArm = armFrom(g, M, R, false, [0.1, -0.18, 0.4]);
  out.leftArm = armFrom(pump, M, L, true, [-0.28, -0.16, 0.56]);
  out.rightHand = R; out.leftHand = L;
}

function buildRail(g, add, M, out, X) {
  // 배그 Kar98k형 볼트액션 저격소총(실측 비율: 전장 1.11 m · 총열 60 cm). 총열 축 y = A, 노리쇠 뒤 z ≈ 0.13 → 총구 −0.69
  const A = 0.016;
  // ── 나무 개머리(일체형: 개머리판 · 반 권총손잡이 손목 · 탄창 덮개 · 긴 앞나무) ──
  add(side([[0.45, 0.032], [0.45, -0.124, 0.008], [0.43, -0.13, 0.006], [0.26, -0.056, 0.02], [0.17, -0.05, 0.01], [0.128, -0.084, 0.012], [0.098, -0.084, 0.006],
    [0.088, -0.046, 0.008], [0.03, -0.046], [-0.06, -0.04], [-0.47, -0.026, 0.006], [-0.48, -0.004, 0.004], [-0.47, 0.006], [-0.04, 0.008], [0.11, 0.004],
    [0.17, 0.012, 0.01], [0.24, 0.028, 0.012]], 0.042, { bevel: 0.005, seg: 10 }), 'wood');
  add(side([[0.45, 0.034], [0.462, 0.034, 0.004], [0.462, -0.126, 0.004], [0.45, -0.128]], 0.044, { bevel: 0.0015 }), 'gunsteel');   // 개머리 끝 쇠판
  add(cylZ(0.0062, 0.046, 0, -0.03, 0.31, 14).rotateY(Math.PI / 2).translate(0, 0, 0), 'gunsteel');                                   // 개머리 관통 원판(멜빵 구멍)
  // ── 리시버 · 노리쇠 덮개 · 가늠자 ──
  add(lathe([[0, 0.1], [0.0155, 0.1], [0.0165, 0.09], [0.0165, -0.06], [0.0135, -0.07], [0, -0.07]], 22, A), 'gunsteel');
  add(side([[0.1, A + 0.004], [0.13, A + 0.004, 0.003], [0.13, A - 0.012, 0.003], [0.1, A - 0.014]], 0.026, { bevel: 0.002 }), 'gunsteel');  // 리시버 뒤 탱
  add(side([[-0.06, A + 0.014], [-0.06, A + 0.026, 0.002], [-0.13, A + 0.02, 0.002], [-0.13, A + 0.014]], 0.02, { bevel: 0.0012 }), 'gunsteel');   // 가늠자 받침(탄젠트)
  add(side([[-0.07, A + 0.026], [-0.074, A + 0.032, 0.001], [-0.084, A + 0.032, 0.001], [-0.088, A + 0.026]], 0.018, { bevel: 0.0008 }), 'steel');
  // ── 총열(계단식으로 가늘어짐) · 총열 고정 띠 2개 · 앞 덮개 · 가늠쇠 덮개 ──
  add(lathe([[0, -0.07], [0.0125, -0.07], [0.0118, -0.2], [0.0108, -0.2], [0.0102, -0.46], [0.009, -0.47], [0.009, -0.69], [0, -0.69]], 18, A), 'gunsteel');
  add(cylZ(0.0042, 0.003, 0, A, -0.6915, 12), 'bore');
  for (const [z, w] of [[-0.29, 0.012], [-0.43, 0.014]]) add(side([[z + w / 2, A + 0.014], [z + w / 2, -0.034, 0.003], [z - w / 2, -0.034, 0.003], [z - w / 2, A + 0.014, 0.003]], 0.046, { bevel: 0.0015 }), 'gunsteel');
  add(lathe([[0, -0.47], [0.017, -0.47], [0.017, -0.5], [0.0115, -0.51], [0, -0.51]], 18, A - 0.008), 'gunsteel');   // 앞 덮개(총검 받침)
  add(front([[-0.009, A + 0.006], [0.009, A + 0.006], [0.009, A + 0.02, 0.008], [-0.009, A + 0.02, 0.008]], 0.024, -0.655, { holes: [[[-0.0065, A + 0.008], [0.0065, A + 0.008], [0.0065, A + 0.017, 0.006], [-0.0065, A + 0.017, 0.006]]], bevel: 0.0008 }), 'gunsteel');
  add(box(0.0022, 0.009, 0.004, 0, A + 0.012, -0.665), 'steel');                                                              // 가늠쇠
  // ── 노리쇠(쏜 뒤 손잡이를 들어 올려 뒤로 당겼다 민다): 뭉치 + 꺾인 손잡이 + 둥근 손잡이 끝 + 뒤 안전 깃발 ──
  const bolt = new THREE.Group(); g.add(bolt); bolt.position.set(0, A, 0); out.bolt98 = bolt;
  add(lathe([[0, 0.135], [0.0098, 0.135], [0.0098, 0.03], [0, 0.03]], 16, 0), 'bright', bolt);
  add(lathe([[0, 0.15], [0.0105, 0.15], [0.0112, 0.135], [0, 0.135]], 16, 0), 'gunsteel', bolt);
  add(new THREE.CylinderGeometry(0.0034, 0.0034, 0.04, 10).rotateZ(Math.PI / 2 - 0.55).translate(0.024, -0.012, 0.115), 'gunsteel', bolt);  // 꺾여 내려간 손잡이
  add(new THREE.SphereGeometry(0.0085, 14, 10).translate(0.041, -0.024, 0.118), 'gunsteel', bolt);                                     // 손잡이 끝 공
  add(side([[0.15, 0.006], [0.156, 0.016, 0.002], [0.15, 0.02], [0.145, 0.008]], 0.004, { bevel: 0.0008 }), 'steel', bolt);
  out.boltKnob = new THREE.Vector3(0.041, -0.024 + A, 0.118);
  // ── 방아쇠울 · 방아쇠 · 탄창 바닥판 ──
  add(side([[0.095, -0.044], [0.088, -0.064, 0.006], [0.05, -0.068, 0.008], [0.03, -0.046]], 0.014, { holes: [[[0.084, -0.047], [0.08, -0.058, 0.004], [0.054, -0.06, 0.004], [0.042, -0.047]]], bevel: 0.001 }), 'gunsteel');
  add(side([[0.072, -0.044], [0.068, -0.054, 0.003], [0.073, -0.06], [0.076, -0.06], [0.076, -0.044]], 0.005, { bevel: 0.0006 }), 'steel');
  add(side([[0.03, -0.044], [0.03, -0.05, 0.002], [-0.05, -0.046, 0.002], [-0.05, -0.04]], 0.026, { bevel: 0.0012 }), 'gunsteel');
  // ── 조준경(배그 8배율형): 접안 · 관 · 대물 + 고리 받침 2개 ──
  const SY = 0.074;
  add(lathe([[0, 0.15], [0.018, 0.15], [0.018, 0.112], [0.0125, 0.098], [0.0125, -0.13], [0.021, -0.155], [0.021, -0.2], [0, -0.2]], 28, SY), 'anod');
  for (const z of [0.06, -0.09]) add(side([[z + 0.011, A + 0.012], [z + 0.011, SY - 0.006, 0.002], [z - 0.011, SY - 0.006, 0.002], [z - 0.011, A + 0.012]], 0.018, { bevel: 0.0012 }), 'anod');
  add(lathe([[0, -0.01], [0.0065, -0.01], [0.0065, 0.012], [0, 0.012]], 14).rotateX(Math.PI / 2).translate(0, SY + 0.016, -0.01), 'anod');   // 위 다이얼
  add(new THREE.CircleGeometry(0.0195, 24).translate(0, SY, -0.2005).rotateY(Math.PI).translate(0, 0, -0.401), 'lens');
  out.ret = add(new THREE.CircleGeometry(0.0165, 28).translate(0, SY, 0.149), X.scopeMat);
  out.display = add(new THREE.PlaneGeometry(0.03, 0.013), X.ammoMat); out.display.position.set(-0.0222, -0.01, -0.12); out.display.rotation.y = -Math.PI / 2;
  out.muzzle = new THREE.Vector3(0, A, -0.7);
  out.trigger = new THREE.Vector3(0, -0.05, 0.068);
  out.eject = new THREE.Vector3(0.016, A + 0.012, 0.06); out.casing = 'bolt';
  out.magHand = new THREE.Vector3(0.0, A + 0.05, 0.05);
  out.sightY = SY; out.adsZ = -0.2;
  // 손: 오른손은 반 권총손잡이 손목(엄지는 손목 위로 감음) · 왼손은 앞나무 아래를 받쳐 감싼다(배그 Kar98k 화면처럼)
  const R = makeHand(M, { curls: [[0.3, 0.3, 0.2], [1.2, 1.45, 0.95], [1.25, 1.5, 1.0], [1.3, 1.5, 1.0]], thumb: { dir: [-0.95, 0.35, -0.5], curl: 0.3 } });
  placeHand(R, { index: [0.023, -0.03, 0.1], pinky: [0.023, -0.074, 0.13], wrist: [0.03, -0.08, 0.225] }); R.userData.thumbAt = [-0.024, 0.02, 0.105]; g.add(R);
  const L = makeHand(M, PUMP_HAND);
  placeHand(L, { index: [0.004, -0.05, -0.245], pinky: [0.004, -0.052, -0.19], wrist: [-0.076, -0.07, -0.21] }); L.userData.thumbAt = [-0.026, 0.012, -0.28]; g.add(L);
  out.rightArm = armFrom(g, M, R, false, [0.1, -0.18, 0.4]);
  out.leftArm = armFrom(g, M, L, true, [-0.28, -0.16, 0.6]);
  out.rightHand = R; out.leftHand = L;
}

// 근접용 칼 + 그것을 쥔 손(손잡이가 세로 = 기본 손 자세 그대로). 칼날은 위(+y)
export function buildKnifeHand(M) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(rbox(0.024, 0.1, 0.03, 0.01, 0, 0, 0), M.rubber));
  g.add(new THREE.Mesh(box(0.03, 0.006, 0.04, 0, 0.053, 0), M.steel));
  g.add(new THREE.Mesh(side([[0.012, 0.056], [0.012, 0.2], [0.0, 0.225], [-0.014, 0.19], [-0.014, 0.056]], 0.004, { bevel: 0.0008 }), M.bright));
  g.add(makeHand(M, { curls: [[1.25, 1.3, 0.9], [1.3, 1.35, 0.95], [1.3, 1.35, 0.95], [1.25, 1.3, 0.9]], thumb: { pos: [-0.004, 0.03, 0.035], dir: [-0.9, 0.3, -0.7], curl: 0.6 } }));
  const nade = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), M.anod); nade.position.set(-0.01, 0, -0.03); g.add(nade);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.003, 6, 24), M.coil); ring.position.copy(nade.position); g.add(ring);
  g.add(makeForearm(M, [0.022, 0, 0.082], [0.15, -0.18, 0.36]));
  return { group: g, blade: g.children.slice(0, 3), nade: [nade, ring] };
}
