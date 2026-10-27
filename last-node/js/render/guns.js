// 1인칭 총 · 장갑 손 모델. 상자를 쌓지 않고 옆모습 윤곽(실루엣)을 그려 두께만큼 깎아 낸다(Extrude + 모서리 베벨).
// 좌표: 총 앞 = −z, 위 = +y, 오른쪽 = +x. 단위 m(실제 총 치수).
// 재질은 3d-metal-material 원칙: 금속은 metalness 1 + F0 색, 거칠기는 상수가 아니라 얼룩·잔흠집·결로 변한다.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from '../../vendor/three/addons/geometries/RoundedBoxGeometry.js';

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
function picatinny(z0, z1, y, width = 0.021) {
  const parts = [box(width * 0.82, 0.004, z0 - z1, 0, y - 0.002, (z0 + z1) / 2)];
  for (let z = z0 - 0.004; z > z1 + 0.003; z -= 0.01) parts.push(box(width, 0.0042, 0.0052, 0, y + 0.0021, z));
  return merge(parts);
}

// ── 재질 ─────────────────────────────────────────────────
// 거칠기 변화(지문 얼룩 · 두 방향 잔흠집 · 미세 결) + 모서리 마모(밝은 금속이 드러남)를 셰이더로
function finishMaterial(params, { smear = 0.1, scratch = 0.18, grain = 0.03, wear = 0, bump = 0, bumpF = 900, key }) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSmear = { value: smear }; sh.uniforms.uScratch = { value: scratch }; sh.uniforms.uGrain = { value: grain }; sh.uniforms.uWear = { value: wear }; sh.uniforms.uBump = { value: bump }; sh.uniforms.uBumpF = { value: bumpF };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position; vON = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vOP; varying vec3 vON; uniform float uSmear, uScratch, uGrain, uWear, uBump, uBumpF;
float gh(vec3 p){ p = fract(p * 0.3183 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(gh(i), gh(i+vec3(1,0,0)), f.x), mix(gh(i+vec3(0,1,0)), gh(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(gh(i+vec3(0,0,1)), gh(i+vec3(1,0,1)), f.x), mix(gh(i+vec3(0,1,1)), gh(i+vec3(1,1,1)), f.x), f.y), f.z); }
float scr(vec3 p, vec3 dir, float freq){ float d = dot(p, dir) * freq; float line = abs(fract(d) - 0.5);
  float mask = step(0.72, gn(p * 40.0 + dir * 7.0)); return smoothstep(0.035, 0.0, line) * mask; }`)
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
  normal = normalize(abs(det) * normal - grad);
}`);
  };
  m.customProgramCacheKey = () => 'finish-' + key;
  return m;
}
const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);

export function gunMaterials(envMap) {
  const M = {
    // 흑착색 강철(슬라이드·총열): 금속, 어두운 F0
    steel: finishMaterial({ color: lin(0.2, 0.205, 0.215), metalness: 1, roughness: 0.3, envMapIntensity: 0.9 }, { smear: 0.12, scratch: 0.2, grain: 0.03, wear: 0.9, key: 'steel' }),
    // 맨 강철(총구·볼트·방아쇠)
    bright: finishMaterial({ color: lin(0.56, 0.57, 0.58), metalness: 1, roughness: 0.2, envMapIntensity: 0.85 }, { smear: 0.1, scratch: 0.22, grain: 0.025, key: 'bright' }),
    // 경질 아노다이징 알루미늄(리시버): 금속, 아주 어두운 F0, 무광
    anod: finishMaterial({ color: lin(0.13, 0.135, 0.145), metalness: 1, roughness: 0.42, envMapIntensity: 1.0 }, { smear: 0.08, scratch: 0.15, grain: 0.04, wear: 1, key: 'anod' }),
    // 세라코트(군청 회색 도장): 비금속
    cerakote: finishMaterial({ color: lin(0.075, 0.08, 0.09), metalness: 0, roughness: 0.48, envMapIntensity: 0.8 }, { smear: 0.1, scratch: 0.12, grain: 0.05, wear: 0.8, key: 'cera' }),
    // 건메탈 아노다이징(리시버·슬라이드 판): 밝은 회색 금속 — 검은 폴리머와 두 톤으로 부품이 구분된다
    gunmetal: finishMaterial({ color: lin(0.15, 0.155, 0.165), metalness: 0.45, roughness: 0.4, envMapIntensity: 1.0 }, { smear: 0.1, scratch: 0.2, grain: 0.04, wear: 0.9, key: 'gunmetal' }),
    // 회색 폴리머 프레임(권총)
    polyGrey: finishMaterial({ color: lin(0.075, 0.078, 0.082), metalness: 0, roughness: 0.58, envMapIntensity: 0.7 }, { smear: 0.1, scratch: 0.04, grain: 0.08, bump: 0.0005, bumpF: 2200, key: 'polygrey' }),
    // 작은 강조색(조정간 표시·경고 띠) — 한두 군데만
    accent: new THREE.MeshStandardMaterial({ color: lin(0.85, 0.3, 0.05), metalness: 0, roughness: 0.5 }),
    // 강화 폴리머(프레임·손잡이·개머리판)
    polymer: finishMaterial({ color: lin(0.035, 0.036, 0.04), metalness: 0, roughness: 0.6, envMapIntensity: 0.7 }, { smear: 0.12, scratch: 0.05, grain: 0.12, bump: 0.0004, bumpF: 2400, key: 'poly' }),
    // 미끄럼 방지 고무
    rubber: finishMaterial({ color: lin(0.02, 0.02, 0.022), metalness: 0, roughness: 0.82, envMapIntensity: 0.5 }, { smear: 0.05, scratch: 0, grain: 0.15, bump: 0.0012, bumpF: 2600, key: 'rubber' }),
    // 탄피 황동 · 산탄 붉은 플라스틱
    brass: finishMaterial({ color: lin(0.89, 0.72, 0.36), metalness: 1, roughness: 0.28, envMapIntensity: 0.9 }, { smear: 0.15, scratch: 0.1, key: 'brass' }),
    hull: new THREE.MeshStandardMaterial({ color: lin(0.28, 0.025, 0.02), metalness: 0, roughness: 0.45 }),
    // 장갑(천) · 너클 보호판 · 소매
    glove: finishMaterial({ color: lin(0.03, 0.03, 0.032), metalness: 0, roughness: 0.82, envMapIntensity: 0.5 }, { smear: 0.05, scratch: 0, grain: 0.1, key: 'glove' }),
    knuckle: finishMaterial({ color: lin(0.035, 0.037, 0.04), metalness: 0, roughness: 0.5, envMapIntensity: 0.8 }, { smear: 0.08, scratch: 0.08, grain: 0.04, key: 'knuckle' }),
    sleeve: finishMaterial({ color: lin(0.045, 0.05, 0.06), metalness: 0, roughness: 0.9, envMapIntensity: 0.4 }, { smear: 0.04, scratch: 0, grain: 0.08, key: 'sleeve' }),
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

// 뷰모델 전용 반사 환경: 거의 검은 방 + 밝고 경계가 또렷한 조명판(창·네온). PMREM으로 미리 흐림
export function viewmodelEnvironment(renderer) {
  const env = new THREE.Scene();
  env.background = lin(0.012, 0.014, 0.02);
  const card = (w, h, x, y, z, rgb) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: lin(...rgb), side: THREE.DoubleSide, toneMapped: false }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
  };
  // 위쪽 왼편 큰 '창'(먼 도시 하늘): 4×3 창살 — 금속에 구조 있는 반사가 생긴다
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) card(1.0, 1.1, -4.8 + i * 1.32, 3.6 + j * 1.38, 3.5, [3.6, 3.8, 4.4]);
  card(0.5, 5.5, 5.2, 1.0, 1.5, [3.2, 0.45, 2.5]);   // 오른쪽 마젠타 네온 기둥
  card(5.5, 0.35, 0.5, 2.6, -5.0, [0.5, 3.0, 3.6]); // 앞쪽 시안 띠(코어)
  card(2.2, 3.4, 3.0, 2.6, -4.5, [2.4, 1.6, 0.8]); // 따뜻한 나트륨등
  card(7, 2.2, 0, 6.0, 0, [0.4, 0.46, 0.58]);       // 흐린 하늘(위)
  card(9, 9, 0, -4, 0, [0.06, 0.04, 0.06]);          // 젖은 바닥 반사(아래)
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(env, 0.006);
  for (const o of env.children) { o.geometry.dispose(); o.material.dispose(); }
  pm.dispose();
  return rt.texture;
}

// ── 손 ───────────────────────────────────────────────────
// 기본 자세: 손가락이 −z로 뻗고, 손가락 마디가 y로 쌓이며(검지가 위), 오른손은 −x 쪽으로 감아 쥔다.
// mirror=true면 왼손(+x로 감음). curls: [검지, 중지, 약지, 소지] 각 [밑마디, 가운데, 끝] 굽힘(라디안)
export function makeHand(M, { mirror = false, curls, thumb = { pos: [0.006, 0.03, 0.045], dir: [-0.6, 0.45, -1], curl: 0.4 }, palm = 0.026 } = {}) {
  const s = mirror ? -1 : 1;
  const g = new THREE.Group();
  const segs = [];
  // 손바닥(손등 보호판 포함)
  // 손바닥: 납작한 타원체(상자보다 손처럼 보인다) + 엄지 두덩
  const palmG = new THREE.SphereGeometry(1, 16, 12); palmG.scale(0.017, 0.042, 0.05); palmG.translate(s * palm, 0, 0.04);
  segs.push({ g: palmG, m: 'glove' });
  const thenar = new THREE.SphereGeometry(1, 12, 8); thenar.scale(0.014, 0.022, 0.026); thenar.translate(s * (palm - 0.01), 0.022, 0.05);
  segs.push({ g: thenar, m: 'glove' });
  // 손등 보호판(얇게, 둥근 모서리)
  segs.push({ g: rbox(0.004, 0.05, 0.036, 0.0018, s * (palm + 0.016), 0.004, 0.028), m: 'knuckle' });
  const ys = [0.027, 0.009, -0.009, -0.026];
  const lens = [[0.042, 0.026, 0.022], [0.046, 0.029, 0.023], [0.043, 0.027, 0.022], [0.034, 0.021, 0.019]];
  const rads = [0.0088, 0.0092, 0.0088, 0.0078];
  const fingerMeshes = [];
  for (let f = 0; f < 4; f++) {
    let pos = new THREE.Vector3(s * (palm - 0.004), ys[f], -0.002);
    let ang = 0;
    for (let k = 0; k < 3; k++) {
      ang += (curls ? curls[f][k] : [0.6, 1.0, 0.7][k]) * -s; // 오른손: 회전 −(y축) = −x 쪽으로 감음
      const L = lens[f][k], r = rads[f] * (1 - k * 0.1);
      const dir = new THREE.Vector3(Math.sin(ang), 0, -Math.cos(ang));
      const c = new THREE.CapsuleGeometry(r, Math.max(0.001, L - r * 1.2), 3, 10);
      c.rotateX(Math.PI / 2);                      // 캡슐 축 y → z
      c.rotateY(-ang);
      const mid = pos.clone().addScaledVector(dir, L / 2);
      c.translate(mid.x, mid.y, mid.z);
      segs.push({ g: c, m: 'glove' });
      if (k === 0) { const kn = rbox(0.006, 0.012, 0.011, 0.0025, mid.x + Math.cos(ang) * r * 0.9 * s, mid.y, mid.z + Math.sin(ang) * r * 0.9 * s); segs.push({ g: kn, m: 'knuckle' }); }
      pos = pos.addScaledVector(dir, L);
    }
    fingerMeshes.push(pos.clone());
  }
  // 엄지(2마디)
  {
    let pos = new THREE.Vector3(s * thumb.pos[0], thumb.pos[1], thumb.pos[2]);
    let dir = new THREE.Vector3(s * thumb.dir[0], thumb.dir[1], thumb.dir[2]).normalize();
    for (let k = 0; k < 2; k++) {
      const L = [0.04, 0.03][k], r = 0.0105 - k * 0.0012;
      const c = new THREE.CapsuleGeometry(r, L - r * 1.2, 3, 10);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      c.applyQuaternion(q);
      const mid = pos.clone().addScaledVector(dir, L / 2);
      c.translate(mid.x, mid.y, mid.z);
      segs.push({ g: c, m: 'glove' });
      pos = pos.addScaledVector(dir, L);
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), -s * thumb.curl).normalize();
    }
  }
  const byMat = {};
  for (const { g: geo, m } of segs) (byMat[m] = byMat[m] || []).push(geo);
  for (const [m, list] of Object.entries(byMat)) g.add(new THREE.Mesh(merge(list), M[m]));
  return g;
}

// 아래팔: 손목(a)에서 팔꿈치(b)까지 소매 + 손목 보호대
export function makeForearm(M, a, b) {
  const g = new THREE.Group();
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const prof = [[0, 0], [0.022, 0], [0.025, 0.01], [0.026, 0.05], [0.032, 0.14], [0.039, len * 0.75], [0.041, len], [0, len]];
  const sleeve = new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(r, z)), 16);
  const cuff = new THREE.CylinderGeometry(0.028, 0.026, 0.04, 16); cuff.translate(0, 0.028, 0);
  const plate = rbox(0.01, 0.1, 0.04, 0.004, 0.03, 0.13, 0.0); // 팔 바깥 보호판
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  for (const [geo, m] of [[sleeve, 'sleeve'], [cuff, 'knuckle'], [plate, 'knuckle']]) {
    geo.applyQuaternion(q); geo.translate(A.x, A.y, A.z);
    g.add(new THREE.Mesh(geo, M[m]));
  }
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
const FORE_HAND = { mirror: true, curls: [[1.0, 1.15, 0.85], [1.05, 1.25, 0.9], [1.1, 1.3, 0.95], [1.15, 1.3, 0.9]], thumb: { pos: [-0.002, 0.034, 0.036], dir: [-0.8, 0.6, -0.4], curl: 0.3 } };
function onForegrip(hand, z, yTop) { hand.position.set(0, yTop - 0.04, z + 0.004); hand.rotation.set(0.12, 0, 0); }

// 손목(기본 자세 (±0.024, 0, 0.085))에서 팔꿈치 쪽으로 아래팔
function armFrom(parent, M, hand, mirror, elbowOffset) {
  hand.updateMatrix();
  const w = new THREE.Vector3(mirror ? -0.022 : 0.022, 0, 0.082).applyMatrix4(hand.matrix);
  const arm = makeForearm(M, [w.x, w.y, w.z], [w.x + elbowOffset[0], w.y + elbowOffset[1], w.z + elbowOffset[2]]);
  parent.add(arm);
  return arm;
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
  return out;
}

function grooves(z0, z1, n, y0, y1, x, depth = 0.0007) {
  const parts = [];
  for (let i = 0; i < n; i++) { const z = z0 + ((z1 - z0) * (i + 0.5)) / n; parts.push(box(depth * 2, y1 - y0, 0.0012, x, (y0 + y1) / 2, z)); }
  return merge(parts);
}

function buildPistol(g, add, M, out, X) {
  // 슬라이드(강철): 뒤 0.048 → 앞 −0.15, 높이 0.012~0.046, 앞 윗모서리 사선
  // 슬라이드 앞쪽 경량화 창(양옆 관통) — 안의 총열이 보인다
  add(side([[0.048, 0.013], [0.048, 0.043, 0.004], [0.044, 0.047], [-0.13, 0.047, 0.003], [-0.15, 0.039, 0.004], [-0.15, 0.013]], 0.025,
    { holes: [[[-0.088, 0.021, 0.002], [-0.118, 0.021, 0.002], [-0.118, 0.034, 0.004], [-0.092, 0.038, 0.002]]], bevel: 0.0018 }), 'steel');
  add(lathe([[0, 0.03], [0.0068, 0.03], [0.0068, -0.146], [0, -0.146]], 18, 0.03), 'gunmetal');            // 총열(창으로 보임)
  add(rbox(0.0135, 0.007, 0.03, 0.002, 0.0, 0.0405, -0.008), 'gunmetal');                                 // 배출구 쪽 총열 후드
  add(lathe([[0, -0.1], [0.0032, -0.1], [0.0032, -0.149], [0, -0.149]], 10, 0.017), 'bright');            // 복좌 스프링 가이드
  // 슬라이드 위 조준경 장착판 덮개 + 나사 2개
  add(rbox(0.017, 0.0022, 0.034, 0.0008, 0, 0.0475, 0.003), 'gunmetal');
  for (const z of [-0.008, 0.014]) add(new THREE.CylinderGeometry(0.0016, 0.0016, 0.0012, 10).translate(0, 0.0488, z), 'bright');
  // 각인: 슬라이드 왼쪽
  engrave(add, M, 'K-9 · 9×19 · NEO-SEOUL ARMS', -0.0127, 0.027, -0.045, 0.07, 0.0048);
  // 슬라이드 톱니(뒤·앞) · 배출구 · 측면 각인 홈
  add(grooves(0.012, 0.044, 8, 0.02, 0.043, 0.0127), 'port'); add(grooves(0.012, 0.044, 8, 0.02, 0.043, -0.0127), 'port');
  add(grooves(-0.13, -0.11, 4, 0.022, 0.042, 0.0127), 'port'); add(grooves(-0.13, -0.11, 4, 0.022, 0.042, -0.0127), 'port');
  add(box(0.0008, 0.012, 0.032, 0.0128, 0.038, -0.02), 'port');   // 배출구(오른쪽)
  add(box(0.0006, 0.0015, 0.08, -0.0128, 0.022, -0.06), 'port');  // 왼쪽 분할선
  // 총열 끝(크라운) + 총구
  add(lathe([[0, 0], [0.0068, 0], [0.0068, 0.004], [0.0045, 0.0045], [0, 0.0045]], 20, 0.03, 0).translate(0, 0, -0.149), 'bright');
  add(cylZ(0.0035, 0.002, 0, 0.03, -0.1536, 12), 'bore');
  // 가늠자(뒤, 홈 있는 블록) · 가늠쇠(앞) + 야광점
  add(front([[-0.0105, 0.046], [0.0105, 0.046], [0.0098, 0.0545, 0.0012], [0.0024, 0.0545], [0.0024, 0.0497, 0.0012], [-0.0024, 0.0497, 0.0012], [-0.0024, 0.0545], [-0.0098, 0.0545, 0.0012]], 0.011, 0.0415, { bevel: 0.0005 }), 'steel');
  add(side([[0.03, 0.046], [0.03, 0.0525, 0.001], [0.022, 0.048], [0.02, 0.046]], 0.019, { bevel: 0.0005 }), 'steel'); // 가늠자 앞 경사(옷에 안 걸리게)
  add(new THREE.CylinderGeometry(0.0012, 0.0012, 0.0012, 10).translate(0.0068, 0.0548, 0.034), 'bright'); // 고정 나사
  add(side([[-0.13, 0.046], [-0.131, 0.0535, 0.001], [-0.138, 0.0535], [-0.141, 0.046]], 0.0045, { bevel: 0.0005 }), 'steel');
  add(new THREE.CircleGeometry(0.0013, 12).translate(0, 0.0512, -0.1305), 'tritium');
  for (const x of [-0.0062, 0.0062]) add(new THREE.CircleGeometry(0.0011, 12).translate(x, 0.0508, 0.0418), 'tritium');
  // 프레임(폴리머): 먼지 덮개 + 방아쇠울(구멍) + 기울어진 손잡이 + 비버테일
  const frame = [[0.047, 0.013], [0.064, 0.011, 0.006], [0.061, 0.0], [0.062, -0.012], [0.083, -0.088, 0.006], [0.044, -0.094, 0.006], [0.026, -0.03, 0.008], [0.012, -0.016],
    [-0.036, -0.026, 0.012], [-0.05, -0.012, 0.005], [-0.05, -0.002], [-0.142, -0.002, 0.002], [-0.142, 0.013]];
  add(side(frame, 0.027, { holes: [[[0.006, -0.004], [-0.04, -0.004], [-0.04, -0.012, 0.004], [-0.033, -0.018, 0.004], [0.0, -0.014, 0.002]]], bevel: 0.0026 }), 'polyGrey');
  // 프레임 핀 2개 · 분해 레버 · 일련번호 판
  pinX(0.0016, 0.0278, 0, -0.001, 0.004, 'bright', add); pinX(0.0016, 0.0278, 0, 0.004, 0.036, 'bright', add);
  add(rbox(0.0024, 0.004, 0.012, 0.001, -0.0145, 0.004, -0.008), 'steel');
  add(rbox(0.0008, 0.005, 0.016, 0.0003, -0.0139, -0.008, -0.03), 'bright');
  // 손잡이 미끄럼 방지 패널(고무, 양옆) · 손가락 받침
  for (const x of [0.0142, -0.0142]) add(side([[0.064, -0.016], [0.08, -0.08, 0.004], [0.05, -0.085, 0.004], [0.034, -0.03], [0.04, -0.016]], 0.0015, { cx: x, bevel: 0.0004 }), 'rubber');
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
  out.mag = mag;
  // 슬라이드 뒤 작은 탄수 표시(카메라 쪽)
  out.display = add(new THREE.PlaneGeometry(0.019, 0.009), X.ammoMat); out.display.position.set(0, 0.031, 0.0486);
  out.muzzle = new THREE.Vector3(0, 0.03, -0.16);
  out.sightY = 0.0505; out.adsZ = -0.27;
  // 손: 오른손 손잡이, 왼손 감싸쥠
  const tilt = 0.27;
  const R = makeHand(M, { curls: [[0.25, 0.25, 0.15], [1.05, 1.25, 0.9], [1.1, 1.3, 0.95], [1.15, 1.3, 0.9]], thumb: { pos: [-0.003, 0.03, 0.04], dir: [-0.9, 0.2, -0.75], curl: 0.35 } });
  R.position.set(0.0, -0.05, 0.052); R.rotation.x = -tilt;
  g.add(R);
  const L = makeHand(M, { mirror: true, curls: [[1.0, 1.2, 0.8], [1.05, 1.25, 0.9], [1.05, 1.25, 0.9], [1.0, 1.2, 0.85]], thumb: { pos: [-0.002, 0.03, 0.035], dir: [-0.35, 0.25, -1], curl: 0.15 } });
  L.position.set(-0.006, -0.064, 0.044); L.rotation.set(-tilt, 0.3, 0);
  g.add(L);
  armFrom(g, M, R, false, [0.1, -0.2, 0.3]);
  out.leftArm = armFrom(g, M, L, true, [-0.17, -0.2, 0.25]);
  out.rightHand = R; out.leftHand = L;
}

function buildRifle(g, add, M, out, X) {
  // 상부 리시버(아노다이징) + 배출구 덮개 + 장전 손잡이
  add(side([[0.13, 0.0], [0.13, 0.036, 0.003], [0.124, 0.042], [-0.16, 0.042], [-0.16, 0.0]], 0.031, { bevel: 0.0022 }), 'gunmetal');
  // 상부 왼쪽 가공 홈(한 단 낮은 면) + 볼트 멈치 레버 + 분해 핀 머리
  add(side([[0.1, 0.008], [0.1, 0.03, 0.003], [-0.12, 0.03, 0.003], [-0.12, 0.008, 0.003]], 0.0012, { cx: -0.0158, bevel: 0.0004 }), 'anod');
  add(side([[0.062, -0.002], [0.066, 0.006, 0.002], [0.05, 0.008, 0.002], [0.048, -0.002]], 0.004, { cx: -0.0168, bevel: 0.0008 }), 'steel');
  for (const [z, y] of [[0.112, -0.012], [-0.088, -0.016]]) pinX(0.0032, 0.0335, 0, y, z, 'bright', add);
  add(box(0.0008, 0.014, 0.05, 0.0157, 0.022, 0.02), 'port');
  add(side([[0.04, 0.012], [0.04, 0.032, 0.002], [-0.01, 0.032, 0.002], [-0.01, 0.012]], 0.0012, { cx: 0.0162, bevel: 0.0003 }), 'steel');
  add(side([[0.152, 0.03], [0.152, 0.04, 0.002], [0.128, 0.04], [0.128, 0.03]], 0.04, { bevel: 0.001 }), 'steel');
  // 하부 리시버: 탄창 삽입구 · 방아쇠울(구멍)
  add(side([[0.12, 0.0], [0.12, -0.026, 0.004], [0.075, -0.04], [0.06, -0.04], [0.035, -0.055, 0.005], [-0.005, -0.055, 0.004], [-0.02, -0.04], [-0.026, -0.072, 0.003], [-0.09, -0.072, 0.003], [-0.094, -0.02], [-0.11, 0.0]], 0.03,
    { holes: [[[0.055, -0.03], [0.03, -0.044], [0.0, -0.044], [-0.006, -0.032], [-0.006, -0.028], [0.055, -0.028]]], bevel: 0.0022 }), 'gunmetal');
  // 탄창 삽입구 왼쪽 각인 + 조정간 표시(작은 주황 점이 '연발'을 가리킴)
  engrave(add, M, 'VX-7 PULSE', -0.0152, -0.04, -0.058, 0.05, 0.0075);
  engrave(add, M, 'CAL 5.7×28 · NEO-SEOUL', -0.0152, -0.055, -0.058, 0.055, 0.0045);
  engrave(add, M, 'SAFE   SEMI   AUTO', -0.0152, -0.004, 0.064, 0.036, 0.004);
  add(new THREE.CircleGeometry(0.0012, 10).rotateY(-Math.PI / 2).translate(-0.0162, -0.012, 0.052), 'accent');
  // 방아쇠 · 셀렉터
  add(side([[0.03, -0.028], [0.026, -0.038, 0.003], [0.033, -0.045], [0.036, -0.045], [0.034, -0.028]], 0.006, { bevel: 0.0007 }), 'bright');
  add(new THREE.CylinderGeometry(0.006, 0.006, 0.002, 14).rotateZ(Math.PI / 2).translate(-0.0158, -0.012, 0.075), 'steel'); // 조정간
  // 손잡이(폴리머, 손가락 홈)
  add(side([[0.11, -0.03], [0.116, -0.04], [0.146, -0.128, 0.008], [0.112, -0.138, 0.006], [0.098, -0.11], [0.092, -0.09, 0.006], [0.084, -0.07], [0.078, -0.04]], 0.029, { bevel: 0.003 }), 'polymer');
  add(side([[0.118, -0.05], [0.14, -0.122, 0.004], [0.118, -0.128], [0.098, -0.06]], 0.0012, { cx: 0.0148, bevel: 0.0003 }), 'rubber');
  // 개머리판: 완충관 + 접이 개머리(살빼기 구멍) + 고무 받침
  add(lathe([[0, 0.12], [0.016, 0.12], [0.016, 0.33], [0, 0.33]], 20, 0.016), 'anod');
  add(side([[0.2, 0.038], [0.2, -0.012], [0.33, -0.07, 0.008], [0.355, -0.07], [0.355, 0.042, 0.006], [0.25, 0.046, 0.01]], 0.036,
    { holes: [[[0.235, 0.02], [0.235, 0.0, 0.005], [0.315, -0.035, 0.006], [0.33, -0.035, 0.003], [0.33, 0.026, 0.005], [0.27, 0.028, 0.006]]], bevel: 0.003 }), 'polymer');
  add(side([[0.355, 0.044], [0.355, -0.072], [0.372, -0.074, 0.006], [0.372, 0.046, 0.006]], 0.038, { bevel: 0.003 }), 'rubber');
  // 볼 받침(뺨 대는 곳) · 멜빵 고리 소켓 · 완충관 고정 너트
  add(side([[0.21, 0.046], [0.214, 0.056, 0.004], [0.33, 0.054, 0.006], [0.33, 0.044]], 0.03, { bevel: 0.003 }), 'rubber');
  add(lathe([[0, 0], [0.0045, 0], [0.0045, 0.003], [0, 0.003]], 14).rotateY(Math.PI / 2).translate(-0.0185, 0.0, 0.34), 'steel');
  add(new THREE.CircleGeometry(0.0022, 12).rotateY(-Math.PI / 2).translate(-0.0189, 0.0, 0.34), 'bore');
  add(lathe([[0, 0.122], [0.019, 0.122], [0.019, 0.132], [0, 0.132]], 8, 0.016), 'steel');
  // 핸드가드(M-LOK 구멍) + 위 레일
  const slots = [];
  for (let i = 0; i < 6; i++) { const z = -0.19 - i * 0.048; slots.push([[z, 0.006], [z - 0.032, 0.006, 0.003], [z - 0.032, -0.004, 0.003], [z, -0.004, 0.003]].map((p, k) => (k === 0 ? [p[0], p[1], 0.003] : p))); }
  add(side([[-0.16, 0.042], [-0.49, 0.042], [-0.495, 0.036], [-0.495, -0.016, 0.006], [-0.485, -0.026], [-0.17, -0.026], [-0.16, -0.016]], 0.043, { holes: slots, bevel: 0.0045 }), 'cerakote');
  // 핸드가드 고정 나사 · 앞쪽 가스 블록
  for (const z of [-0.175, -0.47]) add(new THREE.CylinderGeometry(0.0022, 0.0022, 0.001, 10).rotateZ(Math.PI / 2).translate(-0.0217, 0.03, z), 'bright');
  add(rbox(0.022, 0.024, 0.02, 0.003, 0, 0.012, -0.505), 'gunmetal');
  pinX(0.0012, 0.0225, 0, 0.012, -0.5, 'bright', add);
  add(picatinny(0.034, -0.49, 0.0475), 'anod');
  // 조준경 뒤: 레일 대신 매끈한 윗면 + 접힌 예비 가늠자(낮은 윤곽) + 가운데 홈
  add(side([[0.126, 0.042], [0.124, 0.0455, 0.002], [0.034, 0.0455], [0.034, 0.042]], 0.019, { bevel: 0.0008 }), 'gunmetal');
  add(side([[0.112, 0.045], [0.11, 0.0525, 0.002], [0.084, 0.051, 0.003], [0.078, 0.045]], 0.016, { bevel: 0.0009 }), 'anod');
  add(new THREE.CylinderGeometry(0.0016, 0.0016, 0.0185, 10).rotateZ(Math.PI / 2).translate(0, 0.048, 0.108), 'bright');
  add(box(0.002, 0.0006, 0.026, 0, 0.0527, 0.096), 'port');
  // 총열 · 가스 블록 · 소염기(포트)
  add(lathe([[0, -0.49], [0.0085, -0.49], [0.0085, -0.6], [0, -0.6]], 18, 0.012), 'steel');
  add(lathe([[0, -0.6], [0.0128, -0.6], [0.0132, -0.606], [0.0132, -0.618], [0.0105, -0.62], [0.0105, -0.626], [0.0132, -0.628], [0.0132, -0.64], [0.0105, -0.642], [0.0105, -0.648], [0.0132, -0.65], [0.0132, -0.662], [0.011, -0.666], [0, -0.666]], 24, 0.012), 'cerakote');
  add(cylZ(0.0045, 0.002, 0, 0.012, -0.6668, 12), 'bore');
  // 탄창(곡선, 리브)
  const mag = new THREE.Group(); g.add(mag);
  add(side([[-0.028, -0.06], [-0.052, -0.17, 0.006], [-0.098, -0.162, 0.006], [-0.088, -0.06]], 0.026, { bevel: 0.002 }), 'polymer', mag);
  for (let i = 0; i < 4; i++) add(side([[-0.035 - i * 0.004, -0.09 - i * 0.02], [-0.04 - i * 0.004, -0.098 - i * 0.02], [-0.088 - i * 0.002, -0.094 - i * 0.02], [-0.086 - i * 0.002, -0.086 - i * 0.02]], 0.0285, { bevel: 0.0004 }), 'polymer', mag);
  out.mag = mag;
  // 홀로 조준경: 받침 + 창틀(앞모습 윤곽에 구멍) + 렌즈 + 빨간 점
  add(side([[0.03, 0.047], [0.03, 0.058, 0.002], [-0.03, 0.058, 0.002], [-0.03, 0.047]], 0.026, { bevel: 0.0012 }), 'anod');
  add(front([[-0.019, 0.056], [0.019, 0.056], [0.0215, 0.08, 0.004], [0.017, 0.086, 0.006], [-0.017, 0.086, 0.006], [-0.0215, 0.08, 0.004]], 0.05, 0.026,
    { holes: [[[-0.0155, 0.0605, 0.001], [0.0155, 0.0605, 0.001], [0.0168, 0.0795, 0.004], [-0.0168, 0.0795, 0.004]]], bevel: 0.0016, seg: 10 }), 'anod');
  add(front([[-0.0175, 0.0595], [0.0175, 0.0595], [0.0182, 0.0812, 0.004], [-0.0182, 0.0812, 0.004]], 0.002, -0.022,
    { holes: [[[-0.0155, 0.0605, 0.001], [0.0155, 0.0605, 0.001], [0.0168, 0.0795, 0.004], [-0.0168, 0.0795, 0.004]]], bevel: 0.0004 }), 'port'); // 앞 렌즈 테
  add(lathe([[0, -0.012], [0.0068, -0.012], [0.0072, -0.009], [0.0072, 0.012], [0.0066, 0.014], [0, 0.014]], 18).rotateY(Math.PI / 2).translate(0.0235, 0.066, 0.0), 'anod'); // 배터리 캡(오른쪽)
  for (const x of [-0.006, 0.006]) add(rbox(0.007, 0.0032, 0.004, 0.0012, x, 0.0585, 0.027), 'rubber'); // 밝기 버튼(뒤)
  add(new THREE.PlaneGeometry(0.031, 0.02).translate(0, 0.0705, -0.012), 'lens');
  out.ret = add(new THREE.PlaneGeometry(0.012, 0.012).translate(0, 0.0705, -0.0115), X.reticleMat);
  // 탄수 표시(왼쪽 리시버 뒤)
  out.display = add(new THREE.PlaneGeometry(0.03, 0.013), X.ammoMat); out.display.position.set(-0.0162, 0.024, -0.12); out.display.rotation.y = -Math.PI / 2;
  out.muzzle = new THREE.Vector3(0, 0.012, -0.68);
  out.sightY = 0.0705; out.adsZ = -0.17;
  const tilt = 0.34;
  const R = makeHand(M, { curls: [[0.3, 0.3, 0.2], [1.05, 1.2, 0.9], [1.1, 1.25, 0.9], [1.15, 1.25, 0.85]], thumb: { pos: [-0.002, 0.034, 0.038], dir: [-0.95, 0.35, -0.5], curl: 0.3 } });
  R.position.set(0.002, -0.082, 0.112); R.rotation.x = -tilt; g.add(R);
  // 왼손: 핸드가드 아래에서 받쳐 쥠(손가락이 오른쪽 면으로 감아 올라감)
  foregrip(add, g, -0.33, -0.026);
  const L = makeHand(M, FORE_HAND);
  onForegrip(L, -0.33, -0.026); g.add(L);
  armFrom(g, M, R, false, [0.1, -0.2, 0.3]);
  out.leftArm = armFrom(g, M, L, true, [-0.17, -0.2, 0.3]);
  out.rightHand = R; out.leftHand = L;
}

function buildShotgun(g, add, M, out, X) {
  // 리시버(세라코트, 둥근 윗면) + 배출구 + 위 레일 짧게
  add(side([[0.12, -0.02], [0.12, 0.034, 0.006], [0.1, 0.047, 0.006], [-0.1, 0.047, 0.004], [-0.105, 0.04], [-0.105, -0.02]], 0.036, { bevel: 0.0035 }), 'gunmetal');
  // 리시버 각인 · 핀 · 크로스볼트 안전장치 · 탄 넣는 구멍(아래)
  engrave(add, M, 'BREAKER 12GA', -0.0182, 0.032, 0.04, 0.05, 0.0065);
  engrave(add, M, '3" CHAMBER · NEO-SEOUL ARMS', -0.0182, 0.0, -0.06, 0.06, 0.0042);
  pinX(0.0022, 0.0368, 0, -0.012, 0.09, 'bright', add); pinX(0.0022, 0.0368, 0, -0.012, -0.08, 'bright', add);
  pinX(0.0032, 0.031, 0, -0.03, 0.098, 'steel', add);
  add(new THREE.CircleGeometry(0.0024, 12).rotateY(-Math.PI / 2).translate(-0.0158, -0.03, 0.098), 'accent');
  add(box(0.024, 0.0008, 0.08, 0, -0.0204, -0.04), 'port');
  add(box(0.0008, 0.018, 0.07, 0.0181, 0.02, -0.02), 'port');
  add(picatinny(0.08, -0.06, 0.052, 0.02), 'anod');
  // 방아쇠울 · 방아쇠 · 손잡이 · 개머리판(일체형 폴리머)
  add(side([[0.11, -0.02], [0.1, -0.04, 0.004], [0.04, -0.044, 0.006], [0.02, -0.02]], 0.026, { holes: [[[0.09, -0.024], [0.084, -0.036, 0.004], [0.048, -0.038, 0.004], [0.034, -0.024]]], bevel: 0.0014 }), 'anod');
  add(side([[0.068, -0.024], [0.064, -0.033, 0.003], [0.07, -0.038], [0.073, -0.038], [0.071, -0.024]], 0.006, { bevel: 0.0007 }), 'bright');
  add(side([[0.11, -0.02], [0.14, -0.13, 0.008], [0.106, -0.14, 0.006], [0.088, -0.05], [0.086, -0.022]], 0.03, { bevel: 0.003 }), 'polymer');
  add(side([[0.12, 0.036], [0.37, 0.03, 0.01], [0.38, -0.085, 0.008], [0.33, -0.088], [0.15, -0.035], [0.12, -0.02]], 0.038,
    { holes: [[[0.2, 0.012], [0.33, 0.008, 0.008], [0.335, -0.058, 0.008], [0.21, -0.022, 0.01]]], bevel: 0.003 }), 'polymer');
  add(side([[0.375, 0.032], [0.39, 0.032, 0.006], [0.395, -0.086, 0.006], [0.378, -0.088]], 0.04, { bevel: 0.002 }), 'rubber');
  // 총열 + 탄창관 + 고정 고리 + 가늠쇠 구슬
  add(lathe([[0, -0.1], [0.0112, -0.1], [0.0112, -0.55], [0.0125, -0.552], [0.0125, -0.56], [0, -0.56]], 22, 0.03), 'steel');
  add(cylZ(0.0085, 0.002, 0, 0.03, -0.561, 14), 'bore');
  add(lathe([[0, -0.1], [0.0105, -0.1], [0.0105, -0.5], [0.0095, -0.505], [0, -0.505]], 20, 0.004), 'steel');
  // 탄창관 마개(홈 파인 손잡이)
  { const pr = [[0, -0.505], [0.012, -0.505]]; for (let i = 0; i < 5; i++) pr.push([0.0128, -0.508 - i * 0.006], [0.0118, -0.511 - i * 0.006]); pr.push([0.011, -0.54], [0, -0.54]); add(lathe(pr, 20, 0.004), 'polymer'); }
  add(side([[-0.44, 0.04], [-0.44, -0.008, 0.004], [-0.47, -0.008, 0.004], [-0.47, 0.04]], 0.026, { holes: [], bevel: 0.002 }), 'anod');
  add(new THREE.SphereGeometry(0.0028, 10, 8).translate(0, 0.044, -0.545), 'bright');
  // 열 차단 덮개(구멍 뚫린 반원통)
  { const sh = new THREE.CylinderGeometry(0.0155, 0.0155, 0.28, 18, 1, true, -Math.PI * 0.55, Math.PI * 1.1); sh.rotateX(Math.PI / 2); sh.translate(0, 0.03, -0.25); add(sh, 'cerakote').material.side = THREE.DoubleSide; }
  for (let i = 0; i < 7; i++) add(new THREE.CircleGeometry(0.0042, 12).rotateX(-Math.PI / 2).translate(0, 0.0457, -0.135 - i * 0.036), 'port');
  // 펌프(홈 있는 손받침) — 사격 후 앞뒤로
  const pump = new THREE.Group(); g.add(pump);
  const pp = [[0, -0.2], [0.021, -0.2]];
  for (let i = 0; i < 8; i++) { const z = -0.205 - i * 0.017; pp.push([0.024, z], [0.024, z - 0.011], [0.021, z - 0.013], [0.021, z - 0.017]); }
  pp.push([0.021, -0.345], [0, -0.345]);
  const pg = lathe(pp, 24, 0.0); pg.scale(1.15, 1, 1); add(pg, 'polymer', pump);
  pump.position.y = 0.004;
  out.pump = pump; out.pumpRest = 0;
  // 왼쪽 산탄 받침(4발: 붉은 탄피 + 황동 바닥)
  add(side([[0.07, 0.036], [0.07, -0.006, 0.003], [-0.03, -0.006, 0.003], [-0.03, 0.036]], 0.006, { cx: -0.021, bevel: 0.0012 }), 'anod');
  for (let i = 0; i < 4; i++) {
    const z = 0.055 - i * 0.022;
    add(new THREE.CylinderGeometry(0.0095, 0.0095, 0.05, 14).translate(-0.031, 0.015, z), 'hull');
    add(new THREE.CylinderGeometry(0.0098, 0.0098, 0.012, 14).translate(-0.031, -0.006, z), 'brass');
  }
  // 탄수 표시
  out.display = add(new THREE.PlaneGeometry(0.03, 0.013), X.ammoMat); out.display.position.set(-0.0185, 0.032, -0.07); out.display.rotation.y = -Math.PI / 2;
  out.muzzle = new THREE.Vector3(0, 0.03, -0.575);
  out.sightY = 0.047; out.adsZ = -0.24;
  const tilt = 0.35;
  const R = makeHand(M, { curls: [[0.3, 0.3, 0.2], [1.05, 1.2, 0.9], [1.1, 1.25, 0.9], [1.15, 1.25, 0.85]], thumb: { pos: [-0.002, 0.034, 0.038], dir: [-0.95, 0.35, -0.5], curl: 0.3 } });
  R.position.set(0.002, -0.075, 0.11); R.rotation.x = -tilt; g.add(R);
  foregrip(add, pump, -0.27, -0.016);
  const L = makeHand(M, FORE_HAND);
  onForegrip(L, -0.27, -0.016); pump.add(L);
  armFrom(g, M, R, false, [0.1, -0.2, 0.3]);
  out.leftArm = armFrom(pump, M, L, true, [-0.17, -0.2, 0.3]);
  out.rightHand = R; out.leftHand = L;
}

function buildRail(g, add, M, out, X) {
  // 본체: 각진 하우징(세라코트) + 아래 배터리 칸
  add(side([[0.32, 0.03], [0.3, 0.05, 0.006], [0.08, 0.055, 0.006], [-0.02, 0.048], [-0.28, 0.044, 0.004], [-0.3, 0.028], [-0.3, -0.018], [-0.12, -0.03], [0.05, -0.03], [0.07, -0.02], [0.32, -0.03, 0.01]], 0.05,
    { holes: [[[0.2, 0.034], [0.11, 0.038, 0.004], [0.11, -0.008, 0.004], [0.2, -0.014, 0.004]]], bevel: 0.003 }), 'cerakote');
  // 측면 패널(아노다이징, 나사)
  for (const x of [0.0258, -0.0258]) {
    add(side([[-0.02, 0.04], [-0.26, 0.036, 0.004], [-0.27, 0.0], [-0.03, -0.012, 0.004]], 0.0015, { cx: x, bevel: 0.0004 }), 'anod');
    for (const z of [-0.04, -0.24]) add(cylZ(0.0025, 0.002, 0, 0, 0, 10).rotateY(Math.PI / 2).translate(x + Math.sign(x) * 0.0009, 0.026, z), 'bright');
  }
  // 각인 · 경고 띠(주황) · 통풍 슬롯
  engrave(add, M, 'LANCE RG-1', -0.026, 0.03, -0.09, 0.06, 0.009);
  engrave(add, M, '고전압 · 충전 중 분리 금지', -0.026, 0.018, -0.12, 0.07, 0.0052);
  add(new THREE.PlaneGeometry(0.03, 0.005).rotateY(-Math.PI / 2).translate(-0.0262, 0.005, -0.2), 'accent');
  for (let i = 0; i < 7; i++) add(box(0.0008, 0.016, 0.003, -0.0258, 0.012, 0.02 + i * 0.008), 'port');
  // 윗면 방열핀(조준경 앞, 위에서 보이는 결) + 고정 띠
  { const fins = []; for (let i = 0; i < 10; i++) { const z = -0.075 - i * 0.018; fins.push(rbox(0.036, 0.006, 0.0035, 0.0012, 0, 0.0475 - (z < -0.17 ? 0.0015 : 0), z)); } add(merge(fins), 'gunmetal'); }
  add(rbox(0.052, 0.004, 0.008, 0.0015, 0, 0.0465, -0.026), 'anod');
  // 레일 두 줄(구멍 뚫린 판) + 그 사이 코일 고리(충전되면 빛남)
  for (const x of [0.016, -0.016]) {
    const holes = [];
    for (let i = 0; i < 7; i++) { const z = -0.32 - i * 0.05; holes.push([[z, 0.008, 0.003], [z - 0.03, 0.008, 0.003], [z - 0.03, -0.004, 0.003], [z, -0.004, 0.003]]); }
    add(side([[-0.29, 0.02], [-0.7, 0.016, 0.004], [-0.72, 0.0], [-0.7, -0.014, 0.004], [-0.29, -0.016]], 0.009, { cx: x, holes, bevel: 0.0012 }), 'anod');
  }
  for (let i = 0; i < 6; i++) {
    const ring = new THREE.TorusGeometry(0.021, 0.0042, 8, 28).translate(0, 0.002, -0.33 - i * 0.065);
    out.coils.push(add(ring, 'coil'));
  }
  add(lathe([[0, -0.28], [0.006, -0.28], [0.006, -0.7], [0, -0.7]], 12, 0.002), 'bright'); // 가운데 투사체 안내봉
  // 축전기 셀(아래, 노출된 원통 3개)
  for (let i = 0; i < 3; i++) add(lathe([[0, 0.19 - i * 0.03], [0.011, 0.19 - i * 0.03], [0.012, 0.188 - i * 0.03], [0.012, 0.168 - i * 0.03], [0.011, 0.166 - i * 0.03], [0, 0.166 - i * 0.03]], 16, 0.012), i === 1 ? 'brass' : 'bright');
  // 손잡이 · 개머리판(뒤가 본체와 하나인 불펍형)
  add(side([[0.02, -0.03], [0.05, -0.125, 0.008], [0.016, -0.135, 0.006], [0.0, -0.06], [-0.004, -0.03]], 0.03, { bevel: 0.003 }), 'polymer');
  add(side([[0.32, 0.03], [0.4, 0.034, 0.008], [0.41, -0.08, 0.008], [0.36, -0.082], [0.32, -0.03]], 0.044, { bevel: 0.003 }), 'polymer');
  add(side([[0.405, 0.034], [0.418, 0.034, 0.005], [0.42, -0.082, 0.005], [0.408, -0.082]], 0.046, { bevel: 0.002 }), 'rubber');
  // 배터리 탄창(재장전 때 빠짐)
  const mag = new THREE.Group(); g.add(mag);
  add(side([[0.24, -0.03], [0.24, -0.075, 0.006], [0.15, -0.075, 0.006], [0.15, -0.03]], 0.04, { bevel: 0.002 }), 'anod', mag);
  add(box(0.0412, 0.004, 0.06, 0, -0.06, 0.195), 'port', mag);
  out.mag = mag;
  // 조준경(회전체) + 마운트
  add(lathe([[0, 0.12], [0.017, 0.12], [0.019, 0.105], [0.0135, 0.08], [0.0135, -0.06], [0.021, -0.085], [0.021, -0.1], [0, -0.1]], 28, 0.084), 'anod');
  for (const z of [0.07, -0.05]) add(side([[z + 0.012, 0.055], [z + 0.012, 0.072], [z - 0.012, 0.072], [z - 0.012, 0.055]], 0.02, { bevel: 0.0012 }), 'anod');
  add(new THREE.CircleGeometry(0.0158, 24).translate(0, 0.084, 0.1205), 'lens');
  out.ret = add(new THREE.PlaneGeometry(0.03, 0.03).translate(0, 0.084, 0.119), X.scopeMat);
  out.display = add(new THREE.PlaneGeometry(0.034, 0.015), X.ammoMat); out.display.position.set(-0.0262, 0.012, -0.18); out.display.rotation.y = -Math.PI / 2;
  out.muzzle = new THREE.Vector3(0, 0.002, -0.73);
  out.sightY = 0.084; out.adsZ = -0.17;
  const tilt = 0.3;
  const R = makeHand(M, { curls: [[0.3, 0.3, 0.2], [1.05, 1.2, 0.9], [1.1, 1.25, 0.9], [1.15, 1.25, 0.85]], thumb: { pos: [-0.002, 0.034, 0.038], dir: [-0.95, 0.35, -0.5], curl: 0.3 } });
  R.position.set(0.002, -0.08, 0.021); R.rotation.x = -tilt; g.add(R);
  foregrip(add, g, -0.38, -0.014);
  const L = makeHand(M, FORE_HAND);
  onForegrip(L, -0.38, -0.014); g.add(L);
  armFrom(g, M, R, false, [0.1, -0.2, 0.3]);
  out.leftArm = armFrom(g, M, L, true, [-0.17, -0.2, 0.32]);
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
