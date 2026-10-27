// 하늘(해 진 직후 청색 + 낮은 눈구름 + 달) · 설산 능선 3겹 · 먼 철탑·기지 건물 · 눈발 · 환경맵.
// 실사 원칙: 빛은 출처가 있는 것만(하늘·달·투광등·창문). 움직임은 셰이더로 → CPU 부담이 거의 없다.
import * as THREE from 'three';
import { LAMPS } from '../config/map.js';

export const PALETTE = {
  fog: new THREE.Color(0.075, 0.1, 0.14),
  zenith: new THREE.Color(0.006, 0.012, 0.03),
  mid: new THREE.Color(0.03, 0.055, 0.1),
  horizon: new THREE.Color(0.11, 0.15, 0.22),
  dusk: new THREE.Color(0.32, 0.17, 0.09),     // 서쪽 지평선에 남은 노을
  sodium: new THREE.Color(1.0, 0.62, 0.28),    // 투광등(나트륨) 빛
  moon: new THREE.Color(0.62, 0.72, 0.9),
};

const NOISE_GLSL = `
float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h31(i), h31(i+vec3(1,0,0)), f.x), mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x), mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y), f.z); }
float fbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * n3(p); p *= 2.03; a *= 0.5; } return s; }
`;

export class Environment {
  constructor(scene, renderer, quality) {
    this.scene = scene;
    this.renderer = renderer;
    this.time = { value: 0 };
    this.quality = quality;
    this.moonDir = new THREE.Vector3(0.42, 0.42, -0.8).normalize();   // 북동쪽 하늘
    this.duskDir = new THREE.Vector3(-1, 0, 0.25).normalize();        // 노을이 남은 쪽(서남서)
    this.wind = new THREE.Vector3(2.2, 0, 0.8);
    scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0105);
    scene.background = PALETTE.zenith.clone();
    this.buildSky();
    this.buildRidges();
    this.buildFarBase();
    this.snow = this.buildSnow(quality === 'low' ? 1600 : quality === 'mid' ? 3200 : 5200);
    this.buildEnvMap();
  }

  // 하늘: 높이에 따른 청색 + 노을 잔광 + 낮은 눈구름(달빛이 구름 가장자리를 비춤) + 구름 틈의 별
  buildSky() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uTime: this.time, uZenith: { value: PALETTE.zenith }, uMid: { value: PALETTE.mid }, uHorizon: { value: PALETTE.horizon },
        uDusk: { value: PALETTE.dusk }, uDuskDir: { value: this.duskDir }, uMoon: { value: this.moonDir }, uMoonC: { value: PALETTE.moon },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `varying vec3 vDir; uniform float uTime; uniform vec3 uZenith, uMid, uHorizon, uDusk, uDuskDir, uMoon, uMoonC;
${NOISE_GLSL}
void main(){
  vec3 d = normalize(vDir); float y = d.y;
  vec3 col = mix(uMid, uZenith, smoothstep(0.08, 0.7, y));
  col = mix(uHorizon, col, smoothstep(-0.05, 0.3, y));
  // 노을 잔광: 서쪽 지평선 가까이만, 낮을수록 따뜻하게
  float az = max(dot(normalize(vec3(d.x, 0.0, d.z)), uDuskDir), 0.0);
  col += uDusk * pow(az, 3.0) * smoothstep(0.35, 0.0, y) * smoothstep(-0.08, 0.04, y) * 0.9;
  // 별(구름 뒤에선 가려짐)
  vec3 sp = floor(d * 420.0);
  float star = step(0.9965, h31(sp)) * smoothstep(0.1, 0.5, y) * (0.5 + 0.5 * sin(uTime * 2.0 + h31(sp + 7.0) * 40.0));
  // 낮은 눈구름: 하늘 높이로 펼친 평면 좌표
  vec2 uv = d.xz / max(0.06, y + 0.12);
  vec2 drift = vec2(uTime * 0.004, uTime * 0.0015);
  float c1 = fbm3(vec3(uv * 0.42 + drift, 0.3));
  float c2 = fbm3(vec3(uv * 1.6 + drift * 2.5, 2.1));
  float dens = smoothstep(0.44, 0.78, c1 * 0.8 + c2 * 0.3) * smoothstep(-0.02, 0.18, y);
  // 달빛이 구름 가장자리(얇은 곳)를 밝힘
  float m = max(dot(d, uMoon), 0.0);
  float edge = (1.0 - smoothstep(0.0, 0.6, dens)) * dens * 4.0;
  vec3 cloudC = mix(vec3(0.035, 0.05, 0.075), vec3(0.09, 0.11, 0.15), c2);
  cloudC += uMoonC * (pow(m, 6.0) * 0.55 + pow(m, 40.0) * 0.8) * (0.25 + edge);
  cloudC += uDusk * pow(az, 3.0) * smoothstep(0.3, 0.0, y) * 0.35;
  col += vec3(0.8, 0.86, 1.0) * star * (1.0 - smoothstep(0.0, 0.3, dens));
  // 달: 원반 + 달무리(구름에 가려지면 흐려짐)
  float disc = smoothstep(0.99955, 0.99975, m);
  col += uMoonC * 2.2 * disc * (1.0 - dens * 0.85);
  col += uMoonC * pow(m, 300.0) * 0.35 + uMoonC * pow(m, 18.0) * 0.06;
  col = mix(col, cloudC, dens * 0.92);
  // 지평선 아래 = 안개
  col = mix(col, uHorizon * 0.75, smoothstep(0.0, -0.15, y));
  gl_FragColor = vec4(col, 1.0);
}`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(950, 48, 24), mat);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    this.scene.add(sky);
    this.sky = sky;
  }

  // 설산: 기지를 둘러싼 진짜 3D 지형(극좌표 격자). 완만한 사면엔 눈, 가파른 절벽은 바위. 멀수록 대기 원근(청회색 안개).
  buildRidges() {
    const NA = this.quality === 'low' ? 220 : 480, NR = this.quality === 'low' ? 40 : 80;
    const R0 = 140, R1 = 1100;
    const pos = new Float32Array((NA + 1) * (NR + 1) * 3), col = new Float32Array((NA + 1) * (NR + 1) * 3);
    const height = (x, z, r) => {
      const ramp = smooth(R0, 380, r);
      const big = ridged(x * 0.0021, z * 0.0021, 5, 11) ;              // 큰 산줄기
      const hill = fbm2(x * 0.008, z * 0.008, 4, 23);                  // 가까운 언덕
      return ramp * (Math.pow(big, 1.8) * 360 * smooth(250, 700, r) + hill * 55 * (1 - smooth(500, 900, r) * 0.5)) - 2;
    };
    for (let j = 0; j <= NR; j++) {
      const t = j / NR, r = R0 + (R1 - R0) * t * t;
      for (let i = 0; i <= NA; i++) {
        const a = (i / NA) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
        const k = (j * (NA + 1) + i) * 3;
        pos[k] = x; pos[k + 1] = height(x, z, r); pos[k + 2] = z;
      }
    }
    const idx = [];
    for (let j = 0; j < NR; j++) for (let i = 0; i < NA; i++) {
      const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // 눈/바위: 경사(법선 y) + 높이 + 잡음
    const nrm = geo.attributes.normal.array;
    for (let v = 0; v < pos.length / 3; v++) {
      const ny = nrm[v * 3 + 1], y = pos[v * 3 + 1];
      const n = fbm2(pos[v * 3] * 0.03, pos[v * 3 + 2] * 0.03, 3, 5);
      const snow = smooth(0.62, 0.8, ny + (n - 0.5) * 0.25) * (y < 3 ? 1 : 1);
      const c = [0.86 + n * 0.08, 0.9 + n * 0.08, 0.98 + n * 0.04];
      const rock = [0.07 + n * 0.05, 0.075 + n * 0.05, 0.085 + n * 0.05];
      for (let q = 0; q < 3; q++) col[v * 3 + q] = rock[q] + (c[q] - rock[q]) * snow;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, fog: false, envMapIntensity: 0.4 });
    const haze = { uHaze: { value: PALETTE.horizon.clone().multiplyScalar(0.95) } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, haze);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTW; uniform vec3 uHaze;')
        .replace('#include <fog_fragment>', `float hd = length(vTW.xz - cameraPosition.xz);
float hz = 1.0 - exp(-pow(hd * 0.00105, 1.3));
hz = max(hz, smoothstep(30.0, -10.0, vTW.y) * 0.5);
gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, clamp(hz, 0.0, 0.97));`);
    };
    mat.customProgramCacheKey = () => 'terrain';
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    this.scene.add(m);
    this.terrain = m;
  }

  // 옹벽 밖: 눈 덮인 땅 + 기지의 다른 건물(어두운 덩어리, 따뜻한 창 몇 개) + 먼 철골 통신탑(붉은 항공등)
  buildFarBase() {
    const ground = new THREE.Mesh(new THREE.CircleGeometry(150, 48), new THREE.MeshStandardMaterial({ color: 0xaab6c6, roughness: 0.9, metalness: 0, envMapIntensity: 0.5 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05;
    this.scene.add(ground);
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.85, metalness: 0.1 });
    const roofSnow = new THREE.MeshStandardMaterial({ color: 0xc8d4e2, roughness: 0.8, metalness: 0 });
    const win = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.95, 0.45), fog: true });
    const rnd = mulberry(17);
    const blds = [
      [-62, -48, 30, 9, 14, 0.3], [-70, 12, 18, 6, 10, -0.2], [58, -62, 26, 11, 16, 0.5], [74, 18, 34, 8, 12, 0.1],
      [18, 78, 22, 7, 12, 0], [-38, 82, 40, 10, 18, 0.25], [96, -12, 14, 18, 14, 0], [-104, -20, 20, 7, 30, 0.4],
    ];
    // 건물은 재질별로 한 덩어리로 합쳐 그리기 호출 3번
    const lists = { dark: [], roof: [], win: [] };
    const place = (g, x, z, ry) => { g.rotateY(ry); g.translate(x, 0, z); return g; };
    for (const [x, z, w, h, d, ry] of blds) {
      lists.dark.push(place(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), x, z, ry));
      lists.roof.push(place(new THREE.BoxGeometry(w + 0.4, 0.35, d + 0.4).translate(0, h + 0.17, 0), x, z, ry));
      const n = Math.floor(w / 4);
      for (let i = 0; i < n; i++) if (rnd() < 0.35) lists.win.push(place(new THREE.PlaneGeometry(1.2, 0.8).translate(-w / 2 + 2 + i * 4, h * 0.55, d / 2 + 0.02), x, z, ry));
    }
    this.scene.add(new THREE.Mesh(mergeList(lists.dark, true), dark), new THREE.Mesh(mergeList(lists.roof, true), roofSnow), new THREE.Mesh(mergeList(lists.win, true), win));
    // 먼 레이돔
    const dome = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), new THREE.MeshStandardMaterial({ color: 0xd8dee6, roughness: 0.6, metalness: 0 }));
    dome.position.set(-88, 14, -70); this.scene.add(dome);
    const domeBase = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.5, 9, 16), dark); domeBase.position.set(-88, 4.5, -70); this.scene.add(domeBase);
    // 철골 통신탑(격자) + 붉은 항공등
    const tower = new THREE.Group(); tower.position.set(150, 0, -260);
    const steel = new THREE.MeshBasicMaterial({ color: 0x0b0e13, fog: true });
    const H = 120, legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const w = (y) => 9 * (1 - y / H) + 1.2;
    const parts = [];
    for (const [sx, sz] of legs) parts.push(strut(new THREE.Vector3(sx * w(0), 0, sz * w(0)), new THREE.Vector3(sx * w(H), H, sz * w(H)), 0.5));
    for (let y = 0; y < H; y += 10) for (let k = 0; k < 4; k++) {
      const [ax, az] = legs[k], [bx, bz] = legs[(k + 1) % 4];
      parts.push(strut(new THREE.Vector3(ax * w(y), y, az * w(y)), new THREE.Vector3(bx * w(y + 10), y + 10, bz * w(y + 10)), 0.25));
      parts.push(strut(new THREE.Vector3(ax * w(y), y, az * w(y)), new THREE.Vector3(bx * w(y), y, bz * w(y)), 0.25));
    }
    tower.add(new THREE.Mesh(mergeList(parts), steel));
    this.towerLights = [];
    const red = new THREE.SpriteMaterial({ map: dotTexture(), color: new THREE.Color(3, 0.15, 0.1), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    for (const y of [H + 1, H * 0.66, H * 0.33]) { const s = new THREE.Sprite(red); s.position.set(0, y, 0); s.scale.setScalar(y > H ? 5 : 3.5); tower.add(s); this.towerLights.push(s); }
    this.scene.add(tower);
  }

  // 눈발: 카메라를 둘러싼 상자 안에서 바람에 흘러간다. 투광등 빛 원뿔 안의 눈송이는 호박색으로 반짝인다.
  buildSnow(count) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const off = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) { off[i * 4] = Math.random(); off[i * 4 + 1] = Math.random(); off[i * 4 + 2] = Math.random(); off[i * 4 + 3] = 0.6 + Math.random() * 0.8; }
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
    const lamps = LAMPS.map((l) => new THREE.Vector3(l.x, l.y, l.z));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uTime: this.time, uBox: { value: new THREE.Vector3(40, 22, 40) }, uWind: { value: this.wind }, uLamps: { value: lamps }, uSodium: { value: PALETTE.sodium } },
      vertexShader: `attribute vec4 aOff; uniform float uTime; uniform vec3 uBox, uWind; uniform vec3 uLamps[4]; uniform vec3 uSodium; varying vec2 vUv; varying float vA; varying vec3 vC;
void main(){
  float t = uTime;
  vec3 drift = vec3(uWind.x * t, -1.3 * t * aOff.w, uWind.z * t);
  drift.x += sin(t * 0.7 + aOff.y * 30.0) * 0.8; drift.z += cos(t * 0.6 + aOff.x * 25.0) * 0.6;
  vec3 p = mod(aOff.xyz * uBox + drift - cameraPosition, uBox) - uBox * 0.5 + cameraPosition;
  vec3 view = normalize(cameraPosition - p);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), view)), up = cross(view, right);
  float size = 0.035 * aOff.w;
  vec3 w = p + (right * position.x + up * position.y) * size;
  vUv = uv;
  float d = length(p - cameraPosition);
  vA = smoothstep(0.4, 1.5, d) * (1.0 - smoothstep(12.0, 20.0, d));
  float lit = 0.0;
  for (int i = 0; i < 4; i++) { vec3 l = uLamps[i]; vec3 dl = p - l; float dist = length(dl); lit += smoothstep(0.55, 0.85, dot(normalize(dl), normalize(vec3(-l.x, -l.y * 1.6, -l.z)))) * 18.0 / (dist * dist * 0.08 + 6.0); }
  vC = vec3(0.32, 0.38, 0.48) + uSodium * min(lit, 2.5);
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`,
      fragmentShader: `varying vec2 vUv; varying float vA; varying vec3 vC; void main(){ float r = length(vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.2, r) * vA; gl_FragColor = vec4(vC * a * 0.55, 1.0); }`,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, m);
    this.scene.add(mesh);
    return mesh;
  }

  // 반사용 환경맵: 어두운 청색 하늘 + 달 + 투광등 4개(호박색) + 낮은 눈 반사
  buildEnvMap() {
    const env = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vD; void main(){ float y = vD.y; vec3 c = mix(vec3(0.07,0.09,0.13), vec3(0.012,0.02,0.04), smoothstep(-0.05, 0.6, y)); c = mix(c, vec3(0.09,0.1,0.12), smoothstep(-0.02,-0.3,y)); gl_FragColor = vec4(c,1.0); }',
    }));
    env.add(room);
    const card = (color, intensity, x, y, z, w, h) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    };
    for (const l of LAMPS) card(0xffa860, 6, l.x * 0.6, 9, l.z * 0.6, 1.6, 1.0);
    card(0x9fb4e0, 3.5, this.moonDir.x * 30, this.moonDir.y * 30, this.moonDir.z * 30, 2, 2);
    card(0x2a3a55, 1.2, 0, 30, 0, 40, 40);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pm.fromScene(env, 0.035);
    this.scene.environment = this.envRT.texture;
    pm.dispose();
  }

  update(dt, t) {
    this.time.value = t;
    const blink = Math.sin(t * 2.4) > 0.55;
    if (this.towerLights) for (const s of this.towerLights) s.visible = blink;
  }
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function vh(x, y, s) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vn2(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = vh(xi, yi, s), b = vh(xi + 1, yi, s), c = vh(xi, yi + 1, s), d = vh(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm2(x, y, oct, s) { let r = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { r += a * vn2(x * f, y * f, s + i); n += a; a *= 0.5; f *= 2.03; } return r / n; }
function ridged(x, y, oct, s) { let r = 0, a = 0.5, f = 1, n = 0, w = 1; for (let i = 0; i < oct; i++) { let v = 1 - Math.abs(vn2(x * f, y * f, s + i) * 2 - 1); v *= v * w; w = Math.min(1, v * 1.6); r += a * v; n += a; a *= 0.5; f *= 2.1; } return r / n; }

function strut(a, b, r) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, 4, 1);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  g.translate(a.x, a.y, a.z);
  return g.toNonIndexed();
}
function mergeList(list, normals = false) {
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = normals ? new Float32Array(n * 3) : null; let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o); if (nor) nor.set(g.attributes.normal.array, o); o += g.attributes.position.array.length; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (nor) out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function mulberry(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
