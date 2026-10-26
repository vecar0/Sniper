// 하늘 · 도시 원경 · 비행 차량 · 비 · 번개 · 환경맵. 모두 셰이더로 움직여서 CPU 부담이 거의 없다.
import * as THREE from 'three';

export const PALETTE = {
  fog: new THREE.Color(0x0b1220),
  zenith: new THREE.Color(0x02040a),
  mid: new THREE.Color(0x0a1426),
  horizon: new THREE.Color(0x3a1d4a),
  cityGlow: new THREE.Color(0xff5a8a),
  cyan: new THREE.Color(0x27e8ff),
  magenta: new THREE.Color(0xff2bd6),
  amber: new THREE.Color(0xffa040),
  red: new THREE.Color(0xff2a3a),
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
    this.flash = { value: 0 };
    this.quality = quality;
    this.lightningT = 12 + Math.random() * 10;
    this.flashSeq = [];
    this.onThunder = null;
    scene.fog = new THREE.FogExp2(PALETTE.fog, 0.011);
    scene.background = PALETTE.zenith.clone();
    this.buildSky();
    this.buildCity(quality === 'low' ? 380 : 760);
    this.buildTraffic(quality === 'low' ? 120 : 280);
    this.buildBeams();
    this.rain = this.buildRain(quality === 'low' ? 1400 : quality === 'mid' ? 2800 : 4200);
    this.splash = this.buildSplash(quality === 'low' ? 250 : 650);
    this.buildEnvMap();
  }

  buildSky() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uTime: this.time, uFlash: this.flash,
        uZenith: { value: PALETTE.zenith }, uMid: { value: PALETTE.mid }, uHorizon: { value: PALETTE.horizon },
        uGlow: { value: PALETTE.cityGlow }, uMoon: { value: new THREE.Vector3(-0.45, 0.42, -0.78).normalize() },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `varying vec3 vDir; uniform float uTime, uFlash; uniform vec3 uZenith, uMid, uHorizon, uGlow, uMoon;
${NOISE_GLSL}
void main(){
  vec3 d = normalize(vDir); float y = d.y;
  vec3 col = mix(uMid, uZenith, smoothstep(0.05, 0.6, y));
  col = mix(uHorizon, col, smoothstep(-0.12, 0.22, y));
  // 도시 불빛이 낮은 구름을 밑에서 비춘다
  vec2 uv = d.xz / max(0.08, y + 0.18);
  float c = fbm3(vec3(uv * 0.55 + vec2(uTime * 0.006, uTime * 0.002), uTime * 0.01));
  float c2 = fbm3(vec3(uv * 1.7 - vec2(uTime * 0.012, 0.0), 3.0));
  float cloud = smoothstep(0.38, 0.8, c * 0.75 + c2 * 0.35) * smoothstep(-0.05, 0.25, y);
  vec3 under = mix(uGlow * 0.32, vec3(0.08, 0.12, 0.2), smoothstep(0.0, 0.5, y));
  col = mix(col, under * (0.6 + c2 * 0.6), cloud * 0.85);
  // 달
  float m = max(dot(d, uMoon), 0.0);
  col += vec3(0.55, 0.65, 0.8) * (pow(m, 5000.0) * 2.0 + pow(m, 120.0) * 0.02) * (1.0 - cloud * 0.7);
  // 번개
  col += vec3(0.6, 0.7, 1.0) * uFlash * (0.25 + cloud * 1.6);
  // 아래(도시 쪽)는 안개색
  col = mix(col, uHorizon * 0.9 + uGlow * 0.08, smoothstep(0.0, -0.25, y));
  gl_FragColor = vec4(col, 1.0);
}`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(950, 48, 24), mat);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    this.scene.add(sky);
    this.sky = sky;
  }

  // 원경 빌딩: 인스턴스 1번 그리기. 창문·네온 띠·항공등은 셰이더에서
  buildCity(count) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mesh = new THREE.InstancedMesh(geo, null, count);
    const seeds = new Float32Array(count * 4);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let i = 0, tries = 0;
    const placed = [];
    const rnd = mulberry(7);
    while (i < count && tries < count * 20) {
      tries++;
      const near = i < 40;
      const r = near ? 105 + rnd() * 110 : 130 + Math.pow(rnd(), 0.7) * 620;
      const a = rnd() * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const w = (near ? 22 : 14) + rnd() * (near ? 34 : 40), d = w * (0.6 + rnd() * 0.8);
      if (placed.some((o) => Math.abs(o.x - x) < (o.w + w) * 0.55 && Math.abs(o.z - z) < (o.d + d) * 0.55)) continue;
      placed.push({ x, z, w, d });
      const tall = rnd() < (near ? 0.35 : 0.12);
      const h = tall ? 380 + rnd() * 260 : 120 + rnd() * 260;
      p.set(x, -330, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.round(rnd() * 4) * (Math.PI / 2) + (rnd() - 0.5) * 0.3);
      s.set(w, h, d);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
      seeds[i * 4] = rnd(); seeds[i * 4 + 1] = rnd(); seeds[i * 4 + 2] = rnd(); seeds[i * 4 + 3] = tall ? 1 : 0;
      i++;
    }
    mesh.count = i;
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    mesh.material = new THREE.ShaderMaterial({
      fog: false,
      uniforms: { uTime: this.time, uFlash: this.flash, uFog: { value: PALETTE.fog }, uGlow: { value: PALETTE.cityGlow }, uHorizon: { value: PALETTE.horizon } },
      vertexShader: `attribute vec4 aSeed; varying vec3 vW; varying vec3 vL; varying vec3 vN; varying vec4 vS; varying vec3 vScale;
void main(){ vS = aSeed; vL = position; vN = normal;
  vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `varying vec3 vW; varying vec3 vL; varying vec3 vN; varying vec4 vS; varying vec3 vScale; uniform float uTime, uFlash; uniform vec3 uFog, uGlow, uHorizon;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
  vec3 base = vec3(0.012, 0.016, 0.026) * (0.7 + vS.x * 0.6);
  vec3 col = base;
  float side = 1.0 - abs(vN.y);
  // 면 좌표(미터)
  vec2 f = abs(vN.x) > 0.5 ? vec2(vL.z * vScale.z, vL.y * vScale.y) : vec2(vL.x * vScale.x, vL.y * vScale.y);
  float floorH = 3.4 + vS.y * 1.2, winW = 2.2 + vS.z * 1.8;
  vec2 cell = floor(vec2(f.x / winW, f.y / floorH));
  vec2 fr = fract(vec2(f.x / winW, f.y / floorH));
  float frame = step(0.14, fr.x) * step(fr.x, 0.86) * step(0.22, fr.y) * step(fr.y, 0.84);
  float r = h21(cell + vS.xy * 91.0 + floor(vN.xz * 3.0) * 17.0);
  float lit = step(0.62 - vS.w * 0.12, r);
  vec2 fw = fwidth(vec2(f.x / winW, f.y / floorH));
  float far = smoothstep(0.25, 0.7, max(fw.x, fw.y));
  // 가끔 깜빡이는 창
  lit *= 1.0 - step(0.985, r) * step(0.5, fract(uTime * 0.3 + r * 9.0));
  vec3 warm = vec3(1.0, 0.72, 0.42), cool = vec3(0.55, 0.8, 1.0), pink = vec3(1.0, 0.35, 0.8);
  vec3 wc = r > 0.93 ? pink : (fract(r * 13.0) > 0.5 ? warm : cool);
  vec3 winC = wc * lit * frame * (0.55 + fract(r * 7.3) * 1.1);
  vec3 avgC = vec3(0.85, 0.75, 0.7) * (0.38 + vS.w * 0.12) * 0.38 * 1.1;
  col += mix(winC, avgC, far) * side;
  // 세로 네온 띠(일부 빌딩 모서리)
  if (vS.z > 0.72) {
    float edge = abs(vN.x) > 0.5 ? abs(vL.z) : abs(vL.x);
    float strip = smoothstep(0.47, 0.5, edge) * side;
    vec3 nc = vS.x > 0.5 ? vec3(0.15, 0.9, 1.0) : vec3(1.0, 0.18, 0.85);
    col += nc * strip * 2.2;
  }
  // 옥상 가장자리 띠 + 항공 경고등
  float top = vL.y * vScale.y;
  col += vec3(1.0, 0.1, 0.1) * step(vScale.y - 1.5, top) * side * step(0.5, fract(uTime * 0.5 + vS.x)) * 3.0 * vS.w;
  // 아래로 갈수록 거리 불빛 반사로 붉은 안개
  float hgt = vW.y;
  float dist = length(vW - cameraPosition);
  float fog = 1.0 - exp(-pow(dist * 0.0032, 1.25));
  vec3 fogC = mix(uHorizon * 0.95 + uGlow * 0.12, uFog, smoothstep(-200.0, 120.0, hgt));
  col = mix(col, fogC, clamp(fog, 0.0, 0.94));
  col += vec3(0.4, 0.5, 0.8) * uFlash * 0.06;
  gl_FragColor = vec4(col, 1.0);
}`,
    });
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.city = mesh;
    this.cityPlaced = placed;

    // 거대 광고판(일부 빌딩 면)
    const atlas = adAtlas();
    const adMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
      uniforms: { uMap: { value: atlas }, uTime: this.time },
      vertexShader: `attribute vec4 aAd; varying vec2 vUv; varying vec4 vAd; varying float vDist; void main(){ vUv = uv; vAd = aAd; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vDist = length(w.xyz - cameraPosition); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform sampler2D uMap; uniform float uTime; varying vec2 vUv; varying vec4 vAd; varying float vDist;
void main(){ float idx = floor(mod(vAd.x * 4.0 + floor(uTime / 7.0 + vAd.y * 4.0), 4.0));
  vec2 uv = vec2(mod(idx, 2.0), floor(idx / 2.0)) * 0.5 + vUv * 0.5;
  vec3 c = texture2D(uMap, uv).rgb;
  float scan = 0.85 + 0.15 * sin(vUv.y * 150.0 + uTime * 6.0);
  float flick = 0.9 + 0.1 * sin(uTime * 23.0 + vAd.z * 50.0);
  float glitch = step(0.985, fract(sin(floor(uTime * 8.0) + vAd.z * 77.0) * 4375.5));
  c *= scan * flick * (1.0 - glitch * 0.7);
  float fog = exp(-pow(vDist * 0.0021, 1.4));
  gl_FragColor = vec4(c * 0.75 * fog, 1.0); }`,
    });
    const ads = placed.slice(40, 140).filter((_, k) => k % 6 === 0).slice(0, 14);
    const adGeo = new THREE.PlaneGeometry(1, 1);
    const adMesh = new THREE.InstancedMesh(adGeo, adMat, ads.length);
    const adAttr = new Float32Array(ads.length * 4);
    ads.forEach((b, k) => {
      const toC = Math.atan2(-b.x, -b.z);
      const dir = new THREE.Vector3(-b.x, 0, -b.z).normalize();
      const w = Math.min(b.w, b.d) * 0.55, h = w * 1.4;
      p.set(b.x + dir.x * (Math.max(b.w, b.d) * 0.52), -30 + rnd() * 120, b.z + dir.z * (Math.max(b.w, b.d) * 0.52));
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), toC + Math.PI);
      s.set(w, h, 1);
      m4.compose(p, q, s);
      adMesh.setMatrixAt(k, m4);
      adAttr[k * 4] = rnd(); adAttr[k * 4 + 1] = rnd(); adAttr[k * 4 + 2] = rnd();
    });
    adGeo.setAttribute('aAd', new THREE.InstancedBufferAttribute(adAttr, 4));
    adMesh.frustumCulled = false;
    this.scene.add(adMesh);
  }

  // 비행 차량: 원형 차선을 도는 불빛(전조등 흰색 / 후미등 빨강)
  buildTraffic(count) {
    const geo = new THREE.BoxGeometry(0.9, 0.35, 2.4);
    const lane = new Float32Array(count * 4);
    const rnd = mulberry(11);
    for (let i = 0; i < count; i++) {
      const tier = rnd();
      lane[i * 4] = 60 + rnd() * 380;                 // 반지름
      lane[i * 4 + 1] = tier < 0.35 ? -40 + rnd() * 30 : tier < 0.75 ? 10 + rnd() * 40 : -140 + rnd() * 60; // 높이
      lane[i * 4 + 2] = (14 + rnd() * 22) * (rnd() < 0.5 ? 1 : -1); // 속도
      lane[i * 4 + 3] = rnd() * 1000;
    }
    geo.setAttribute('aLane', new THREE.InstancedBufferAttribute(lane, 4));
    const mat = new THREE.ShaderMaterial({
      fog: false, uniforms: { uTime: this.time },
      vertexShader: `uniform float uTime; attribute vec4 aLane; varying float vFront; varying float vDist; varying float vSide;
void main(){ float ang = (aLane.w + uTime * aLane.z / aLane.x * 1.0); float r = aLane.x + sin(ang * 3.0 + aLane.w) * 6.0;
  vec3 c = vec3(cos(ang) * r, aLane.y + sin(ang * 2.0 + aLane.w) * 3.0, sin(ang) * r);
  vec3 t = normalize(vec3(-sin(ang), 0.0, cos(ang))) * sign(aLane.z); vec3 rt = normalize(cross(t, vec3(0,1,0)));
  vec3 w = c + rt * position.x + vec3(0,1,0) * position.y + t * position.z;
  vFront = position.z; vSide = position.x; vDist = length(w - cameraPosition); gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
      fragmentShader: `varying float vFront; varying float vDist; varying float vSide;
void main(){ vec3 c = vFront > 0.0 ? vec3(1.6, 1.5, 1.3) : vec3(2.4, 0.15, 0.2);
  float fog = exp(-pow(vDist * 0.0025, 1.3)); gl_FragColor = vec4(c * (0.35 + fog), 1.0); }`,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, m);
    this.scene.add(mesh);
  }

  // 먼 빌딩의 서치라이트(가산 원뿔)
  buildBeams() {
    const geo = new THREE.CylinderGeometry(0.5, 14, 420, 24, 1, true);
    geo.translate(0, 210, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uColor: { value: new THREE.Color(0.35, 0.55, 1.0) } },
      vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = position.y / 420.0; vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec3 uColor; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(vN, vV)), 2.0); gl_FragColor = vec4(uColor * f * (1.0 - vY) * 0.13, 1.0); }`,
    });
    this.beams = [];
    const spots = [[-180, -120, -260], [230, -150, -320], [-320, -200, 180], [150, -100, 280]];
    for (const [x, y, z] of spots) {
      const b = new THREE.Mesh(geo, mat);
      b.position.set(x, y, z);
      b.userData.phase = Math.random() * 10;
      this.scene.add(b);
      this.beams.push(b);
    }
  }

  buildRain(count) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);
    const off = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) { off[i * 4] = Math.random(); off[i * 4 + 1] = Math.random(); off[i * 4 + 2] = Math.random(); off[i * 4 + 3] = 0.75 + Math.random() * 0.5; }
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uTime: this.time, uFlash: this.flash, uBox: { value: new THREE.Vector3(44, 26, 44) } },
      vertexShader: `attribute vec4 aOff; uniform float uTime; uniform vec3 uBox; varying float vA; varying float vY;
void main(){ vec3 drift = vec3(uTime * 2.2, -uTime * 24.0 * aOff.w, uTime * 0.9);
  vec3 p = mod(aOff.xyz * uBox + drift - cameraPosition, uBox) - uBox * 0.5 + cameraPosition;
  vec3 dir = normalize(vec3(0.09, -1.0, 0.035));
  vec3 view = normalize(cameraPosition - p); vec3 right = normalize(cross(dir, view));
  vec3 w = p + right * position.x * 0.018 - dir * position.y * 0.85 * aOff.w;
  vY = position.y; float d = length(p - cameraPosition); vA = smoothstep(0.6, 2.5, d) * (1.0 - smoothstep(14.0, 22.0, d));
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
      fragmentShader: `uniform float uFlash; varying float vA; varying float vY; void main(){ float a = vA * (1.0 - vY) * vY * 4.0; gl_FragColor = vec4(vec3(0.55, 0.68, 0.85) * a * (0.32 + uFlash * 0.8), 1.0); }`,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, m);
    this.scene.add(mesh);
    return mesh;
  }

  // 바닥 빗방울 튐(옥상 바닥 y=0 근처만)
  buildSplash(count) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const off = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { off[i * 3] = Math.random(); off[i * 3 + 1] = Math.random(); off[i * 3 + 2] = Math.random(); }
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uTime: this.time },
      vertexShader: `attribute vec3 aOff; uniform float uTime; varying vec2 vUv; varying float vT; varying float vA;
void main(){ float t = fract(uTime * 1.6 + aOff.z * 13.0); float cyc = floor(uTime * 1.6 + aOff.z * 13.0);
  vec2 rnd = fract(aOff.xy + cyc * vec2(0.618, 0.382));
  vec2 xz = floor(cameraPosition.xz) + (rnd - 0.5) * 36.0;
  float inside = step(abs(xz.x), 27.6) * step(abs(xz.y), 27.6);
  vec3 w = vec3(xz.x, 0.02, xz.y) + position * (0.06 + t * 0.32);
  vUv = uv; vT = t; vA = inside * (1.0 - smoothstep(6.0, 18.0, length(xz - cameraPosition.xz)));
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
      fragmentShader: `varying vec2 vUv; varying float vT; varying float vA; void main(){ float d = length(vUv - 0.5) * 2.0; float ring = smoothstep(0.12, 0.0, abs(d - 0.8)) * (1.0 - vT); gl_FragColor = vec4(vec3(0.5, 0.65, 0.8) * ring * vA * 0.35, 1.0); }`,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, m);
    this.scene.add(mesh);
    return mesh;
  }

  // 반사용 환경맵: 어두운 방 + 밝은 네온 카드(금속·젖은 바닥에 비칠 것)
  buildEnvMap() {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x05080e);
    const room = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vD; void main(){ float y = vD.y; vec3 c = mix(vec3(0.16,0.07,0.16), vec3(0.015,0.025,0.05), smoothstep(-0.1, 0.5, y)); c = mix(c, vec3(0.02,0.02,0.03), smoothstep(-0.05,-0.4,y)); gl_FragColor = vec4(c,1.0); }',
    }));
    env.add(room);
    const card = (color, intensity, x, y, z, w, h) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    };
    card(0x27e8ff, 6, 0, 6, -14, 3, 10);     // 코어 빛 기둥
    card(0xff2bd6, 1.6, -16, 8, -10, 10, 5); // 광고판
    card(0x27e8ff, 3, 18, 3, 6, 6, 1);       // 헬리패드 띠
    card(0x27e8ff, 2.2, -10, 5, 16, 8, 2);  // 반대편 시안 간판
    card(0xffa040, 3, -18, 4, 10, 2, 4);     // 나트륨등
    card(0x8fb0ff, 1.5, 6, 30, 4, 30, 8);    // 하늘
    card(0xff5a8a, 1.2, 0, -6, 30, 60, 6);   // 아래 도시 빛
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pm.fromScene(env, 0.035);
    this.scene.environment = this.envRT.texture;
    pm.dispose();
  }

  update(dt, t) {
    this.time.value = t;
    // 번개
    this.lightningT -= dt;
    if (this.lightningT <= 0) {
      this.lightningT = 18 + Math.random() * 22;
      this.flashSeq = [0, 0.09, 0.2, 0.33].map((d, i) => ({ at: t + d, v: [1, 0.3, 0.8, 0.15][i] }));
      if (this.onThunder) setTimeout(() => this.onThunder(), 700 + Math.random() * 900);
    }
    let f = this.flash.value * Math.exp(-dt * 9);
    for (const s of this.flashSeq) if (!s.done && t >= s.at) { s.done = true; f = Math.max(f, s.v); }
    this.flash.value = f;
    for (const b of this.beams) {
      const ph = b.userData.phase + t * 0.15;
      b.rotation.set(Math.sin(ph) * 0.35, 0, Math.cos(ph * 0.7) * 0.35);
    }
  }
}

export function mulberry(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// 가상 광고 4종(2×2 아틀라스)
function adAtlas() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S * 2;
  const g = c.getContext('2d');
  const font = "'Rajdhani', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
  const panel = (ix, iy, draw) => { g.save(); g.translate(ix * S, iy * S); g.beginPath(); g.rect(0, 0, S, S); g.clip(); draw(); g.restore(); };
  panel(0, 0, () => {
    const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, '#300a40'); gr.addColorStop(1, '#ff2bd6'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.strokeStyle = '#fff'; g.lineWidth = 14; g.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; g.lineTo(S / 2 + Math.cos(a) * 110, 200 + Math.sin(a) * 110); }
    g.closePath(); g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `700 92px ${font}`; g.fillText('HELIX', S / 2, 400);
    g.font = `600 34px ${font}`; g.fillText('내일을 소유하라', S / 2, 455);
  });
  panel(1, 0, () => {
    g.fillStyle = '#04141c'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#27e8ff'; g.textAlign = 'center'; g.font = `700 150px ${font}`; g.fillText('라멘', S / 2, 230);
    g.font = `700 64px ${font}`; g.fillStyle = '#ffa040'; g.fillText('NEO 24H', S / 2, 330);
    g.strokeStyle = '#ffa040'; g.lineWidth = 6; g.strokeRect(40, 40, S - 80, S - 80);
  });
  panel(0, 1, () => {
    const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, '#081a40'); gr.addColorStop(1, '#27e8ff'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.textAlign = 'center'; g.font = `700 80px ${font}`; g.fillText('SYNTH', S / 2, 210); g.fillText('//WAVE', S / 2, 300);
    for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(255,255,255,${0.1 + i * 0.05})`; g.fillRect(60 + i * 34, 420 - i * 8, 20, i * 8 + 10); }
  });
  panel(1, 1, () => {
    g.fillStyle = '#1a0005'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#ff2a3a'; g.textAlign = 'center'; g.font = `700 70px ${font}`; g.fillText('헬릭스 보안', S / 2, 200);
    g.font = `600 40px ${font}`; g.fillStyle = '#ffd0d0'; g.fillText('당신의 안전은 우리의 자산', S / 2, 280);
    g.strokeStyle = '#ff2a3a'; g.lineWidth = 10; g.beginPath(); g.arc(S / 2, 390, 50, 0, Math.PI * 2); g.stroke();
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
