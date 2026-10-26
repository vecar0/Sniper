// 이펙트: GPU 링버퍼 파티클(불꽃·연기·에너지) · 파편 · 탄흔 · 예광탄 · 폭발 · 예고 표시 · 드롭 아이템
import * as THREE from 'three';
import { glowTexture, smokeTexture, decalTexture } from './materials.js';

// ── GPU 파티클: 생성 시 속성만 쓰고, 움직임은 셰이더가 시간으로 계산 ──
class Particles {
  constructor(scene, max, { blending = THREE.AdditiveBlending, map, stretch = 0, soft = false, gravity = 0, drag = 0, sizeGrow = 0 } = {}) {
    this.max = max; this.i = 0;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.aP = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); // xyz, 태어난 시각
    this.aV = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); // 속도, 수명
    this.aC = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); // 색, 크기
    for (const a of [this.aP, this.aV, this.aC]) a.setUsage(THREE.DynamicDrawUsage);
    for (let k = 0; k < max; k++) this.aP.array[k * 4 + 3] = -1000;
    g.setAttribute('aP', this.aP); g.setAttribute('aV', this.aV); g.setAttribute('aC', this.aC);
    g.instanceCount = max;
    this.u = { uTime: { value: 0 }, uMap: { value: map }, uGrav: { value: gravity }, uDrag: { value: drag }, uStretch: { value: stretch }, uGrow: { value: sizeGrow } };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending, uniforms: this.u,
      vertexShader: `attribute vec4 aP; attribute vec4 aV; attribute vec4 aC; uniform float uTime, uGrav, uDrag, uStretch, uGrow;
varying vec2 vUv; varying vec4 vC; varying float vK;
void main(){ float t = uTime - aP.w; float life = aV.w; float k = t / life; vK = k; vUv = uv; vC = aC;
  if (k < 0.0 || k > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float dr = uDrag > 0.0 ? (1.0 - exp(-uDrag * t)) / uDrag : t;
  vec3 p = aP.xyz + aV.xyz * dr + vec3(0.0, -0.5 * uGrav * t * t, 0.0);
  vec3 vel = aV.xyz * exp(-uDrag * t) + vec3(0.0, -uGrav * t, 0.0);
  float size = aC.w * (1.0 + uGrow * k);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec2 off = position.xy * size;
  if (uStretch > 0.0) {
    vec3 vv = (modelViewMatrix * vec4(vel, 0.0)).xyz; vec2 d2 = vv.xy; float l = length(d2);
    if (l > 0.001) { vec2 dir = d2 / l; vec2 nrm = vec2(-dir.y, dir.x); off = nrm * position.x * size * 0.35 + dir * position.y * (size + l * uStretch); }
  }
  mv.xy += off; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uMap; varying vec2 vUv; varying vec4 vC; varying float vK;
void main(){ vec4 tx = texture2D(uMap, vUv); float fade = (1.0 - vK) * smoothstep(0.0, 0.08, vK + 0.08);
  gl_FragColor = vec4(vC.rgb * tx.rgb, tx.a * fade); ${blending === THREE.AdditiveBlending ? 'gl_FragColor.rgb *= gl_FragColor.a; gl_FragColor.a = 1.0;' : ''} }`,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = blending === THREE.AdditiveBlending ? 5 : 4;
    scene.add(this.mesh);
    this.dirty = false;
    this.lo = max; this.hi = -1;
  }
  emit(x, y, z, vx, vy, vz, life, r, g, b, size, now) {
    const k = this.i; this.i = (this.i + 1) % this.max;
    const P = this.aP.array, V = this.aV.array, C = this.aC.array;
    P[k * 4] = x; P[k * 4 + 1] = y; P[k * 4 + 2] = z; P[k * 4 + 3] = now;
    V[k * 4] = vx; V[k * 4 + 1] = vy; V[k * 4 + 2] = vz; V[k * 4 + 3] = life;
    C[k * 4] = r; C[k * 4 + 1] = g; C[k * 4 + 2] = b; C[k * 4 + 3] = size;
    this.dirty = true; this.lo = Math.min(this.lo, k); this.hi = Math.max(this.hi, k);
  }
  update(now) {
    this.u.uTime.value = now;
    if (!this.dirty) return;
    for (const a of [this.aP, this.aV, this.aC]) {
      a.clearUpdateRanges();
      a.addUpdateRange(this.lo * 4, (this.hi - this.lo + 1) * 4);
      a.needsUpdate = true;
    }
    this.dirty = false; this.lo = this.max; this.hi = -1;
  }
}

export class FX {
  constructor(scene, camera, geom, quality) {
    this.scene = scene; this.camera = camera; this.geom = geom;
    this.now = 0;
    this.low = quality === 'low';
    const glow = glowTexture(), smoke = smokeTexture();
    this.sparks = new Particles(scene, this.low ? 600 : 1500, { map: glow, stretch: 0.045, gravity: 9, drag: 1.2 });
    this.glow = new Particles(scene, this.low ? 300 : 700, { map: glow, drag: 2.5, sizeGrow: 0.5 });
    this.smoke = new Particles(scene, this.low ? 250 : 600, { map: smoke, blending: THREE.NormalBlending, drag: 1.8, sizeGrow: 2.2, gravity: -0.6 });
    this.energy = new Particles(scene, 500, { map: glow, drag: 0.6, gravity: -1.5 });

    // 파편(CPU 물리, 인스턴스 1번 그리기)
    this.debrisMax = 140;
    this.debris = [];
    const dm = new THREE.MeshStandardMaterial({ color: 0x23272d, metalness: 0.9, roughness: 0.4, envMapIntensity: 1.2 });
    this.debrisMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), dm, this.debrisMax);
    this.debrisMesh.castShadow = true;
    this.debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debrisMesh.count = 0;
    this.debrisMesh.frustumCulled = false;
    scene.add(this.debrisMesh);

    // 탄흔·그을음(링버퍼)
    this.decalMax = 90;
    this.decalI = 0;
    const mk = (tex) => {
      const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.9, metalness: 0 }), this.decalMax);
      m.count = 0; m.frustumCulled = false; m.receiveShadow = true; m.renderOrder = 1; scene.add(m); return m;
    };
    this.holes = mk(decalTexture('hole'));
    this.scorch = mk(decalTexture('scorch'));
    this.holeI = 0; this.scorchI = 0;

    // 예광탄(가산 막대) — 플레이어 탄은 짧게 번쩍, 적 탄은 매 프레임 위치
    this.tracerMax = 120;
    this.tracers = [];
    this.tracerMesh = new THREE.InstancedMesh(tracerGeo(), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: false }), this.tracerMax);
    this.tracerMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.tracerMax * 3), 3);
    this.tracerMesh.frustumCulled = false; this.tracerMesh.count = 0; this.tracerMesh.renderOrder = 6;
    scene.add(this.tracerMesh);

    // 폭발 섬광·충격파 고리(풀)
    this.flashes = [];
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      s.visible = false; scene.add(s); this.flashes.push({ s, t: 9, dur: 0.3, size: 1 });
    }
    this.rings = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); this.rings.push({ m, t: 9, dur: 0.5, r: 1 });
    }
    // 점광 풀(폭발·총구)
    this.lights = [];
    for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffaa66, 0, 12, 2); scene.add(l); this.lights.push({ l, t: 9, dur: 0.2, peak: 0 }); }

    // 예고 표시: 레이저 선 · 바닥 경고 원
    this.lasers = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.geometry.translate(0, 0.5, 0); m.geometry.rotateX(Math.PI / 2); m.visible = false; m.frustumCulled = false; scene.add(m);
      this.lasers.push({ m, until: 0, src: null });
    }
    this.circles = [];
    const circleMat = () => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uK: { value: 0 }, uT: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uK, uT; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float ring = smoothstep(0.06, 0.0, abs(d - 0.95)); float fill = step(d, uK) * 0.35 * step(d, 1.0); float pulse = 0.6 + 0.4 * sin(uT * 30.0); gl_FragColor = vec4(vec3(1.0, 0.12, 0.08) * (ring * pulse * 1.6 + fill), 1.0); }',
    });
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), circleMat());
      m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 3; scene.add(m);
      this.circles.push({ m, t0: 0, dur: 1, r: 1 });
    }
    // 보스 미니건 선
    this.lineMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uT; varying vec2 vUv; void main(){ float e = smoothstep(0.5, 0.35, abs(vUv.y - 0.5)); float dash = step(0.5, fract(vUv.x * 14.0 - uT * 3.0)); gl_FragColor = vec4(vec3(1.0, 0.1, 0.08) * e * (0.35 + dash * 0.8), 1.0); }',
    }));
    this.lineMesh.rotation.x = -Math.PI / 2; this.lineMesh.visible = false; this.lineMesh.renderOrder = 3;
    scene.add(this.lineMesh);
    this.lineUntil = 0;

    // 드롭: 체력 오브(시안) · 탄약 큐브(호박색)
    this.orbMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.085, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1.5, 1.8) }), 80);
    this.orbMesh.count = 0; this.orbMesh.frustumCulled = false; scene.add(this.orbMesh);
    this.ammoMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.2, 0.36), new THREE.MeshStandardMaterial({ color: 0x2a2018, metalness: 0.6, roughness: 0.4, emissive: new THREE.Color(0.8, 0.4, 0.06), emissiveIntensity: 1 }), 30);
    this.ammoMesh.count = 0; this.ammoMesh.frustumCulled = false; scene.add(this.ammoMesh);
    // EMP 수류탄
    this.nadeMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshStandardMaterial({ color: 0x15181d, metalness: 0.8, roughness: 0.3, emissive: new THREE.Color(0.2, 1.6, 2.5) }), 6);
    this.nadeMesh.count = 0; this.nadeMesh.frustumCulled = false; scene.add(this.nadeMesh);
    // 배터리
    this.batteryViews = [];
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._e = new THREE.Euler();
  }

  buildBatteries(list) {
    const body = new THREE.MeshStandardMaterial({ color: 0x1b1f25, metalness: 0.85, roughness: 0.35, envMapIntensity: 1.3 });
    const band = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.6, 0.25) });
    for (const b of list) {
      const g = new THREE.Group();
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.1, 16), body); c.position.y = 0.55; c.castShadow = true; g.add(c);
      for (const y of [0.3, 0.8]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.08, 16), band); r.position.y = y; g.add(r); }
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.15, 12), body); cap.position.y = 1.17; g.add(cap);
      g.position.set(b.x, b.y, b.z);
      this.scene.add(g);
      this.batteryViews.push({ g, band });
    }
  }

  // ── 생성 함수 ─────────────────────────────────────────
  sparkBurst(p, n, dir, color = [3, 1.6, 0.6], speed = 8, size = 0.06, life = 0.35) {
    for (let i = 0; i < n; i++) {
      const vx = (Math.random() - 0.5) * 2, vy = Math.random() * 1.2, vz = (Math.random() - 0.5) * 2;
      const dx = (dir ? dir.x : 0) + vx * 0.8, dy = (dir ? dir.y : 0) + vy * 0.8, dz = (dir ? dir.z : 0) + vz * 0.8;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.sparks.emit(p.x, p.y, p.z, dx * s, dy * s, dz * s, life * (0.5 + Math.random()), color[0], color[1], color[2], size * (0.6 + Math.random() * 0.8), this.now);
    }
  }
  glowPuff(p, size, color, life = 0.25, n = 1, spread = 0) {
    for (let i = 0; i < n; i++) this.glow.emit(p.x + (Math.random() - 0.5) * spread, p.y + (Math.random() - 0.5) * spread, p.z + (Math.random() - 0.5) * spread, 0, 0, 0, life, color[0], color[1], color[2], size, this.now);
  }
  smokePuff(p, size = 1, life = 1.4, dark = 0.12, vel = null) {
    const v = vel || { x: (Math.random() - 0.5) * 0.6, y: 0.4 + Math.random() * 0.5, z: (Math.random() - 0.5) * 0.6 };
    this.smoke.emit(p.x, p.y, p.z, v.x, v.y, v.z, life * (0.7 + Math.random() * 0.6), dark, dark * 1.05, dark * 1.15, size * (0.7 + Math.random() * 0.6), this.now);
  }
  energyBurst(p, n, color = [0.4, 2.4, 3.2], speed = 3, size = 0.08, life = 0.8) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1), s = speed * (0.3 + Math.random());
      this.energy.emit(p.x, p.y, p.z, Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s, Math.sin(b) * Math.sin(a) * s, life * (0.5 + Math.random()), color[0], color[1], color[2], size, this.now);
    }
  }
  debrisBurst(p, n, size = 0.12, speed = 5, dir = null) {
    for (let i = 0; i < n; i++) {
      if (this.debris.length >= this.debrisMax) this.debris.shift();
      const s = speed * (0.4 + Math.random() * 0.8);
      this.debris.push({
        x: p.x, y: p.y, z: p.z,
        vx: ((dir ? dir.x * 0.8 : 0) + (Math.random() - 0.5) * 1.6) * s, vy: (0.5 + Math.random()) * s * 0.7, vz: ((dir ? dir.z * 0.8 : 0) + (Math.random() - 0.5) * 1.6) * s,
        rx: Math.random() * 6, ry: Math.random() * 6, wx: (Math.random() - 0.5) * 20, wy: (Math.random() - 0.5) * 20,
        sx: size * (0.5 + Math.random()), sy: size * (0.3 + Math.random() * 0.6), sz: size * (0.5 + Math.random()), life: 3 + Math.random() * 2,
      });
    }
  }
  decal(p, n, kind = 'hole', size = 0.12) {
    const mesh = kind === 'hole' ? this.holes : this.scorch;
    const idx = kind === 'hole' ? this.holeI++ % this.decalMax : this.scorchI++ % this.decalMax;
    const nrm = this._v.set(n.x, n.y, n.z);
    this._q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);
    const spin = new THREE.Quaternion().setFromAxisAngle(nrm, Math.random() * Math.PI * 2);
    this._q.premultiply(spin);
    this._m.compose(new THREE.Vector3(p.x + n.x * 0.01, p.y + n.y * 0.01, p.z + n.z * 0.01), this._q, this._s.set(size, size, size));
    mesh.setMatrixAt(idx, this._m);
    mesh.count = Math.min(this.decalMax, Math.max(mesh.count, idx + 1));
    mesh.instanceMatrix.needsUpdate = true;
  }
  tracer(a, b, color, life = 0.07, width = 0.025) {
    if (this.tracers.length >= this.tracerMax) this.tracers.shift();
    this.tracers.push({ a: { ...a }, b: { ...b }, color, t: 0, life, width, moving: false });
  }
  flash(p, size, color, dur = 0.25) {
    const f = this.flashes.find((q) => q.t >= q.dur) || this.flashes[0];
    f.s.position.set(p.x, p.y, p.z); f.s.material.color.setRGB(...color); f.size = size; f.t = 0; f.dur = dur; f.s.visible = true;
  }
  ring(p, r, color, dur = 0.5) {
    const g = this.rings.find((q) => q.t >= q.dur) || this.rings[0];
    g.m.position.set(p.x, p.y + 0.05, p.z); g.m.material.color.setRGB(...color); g.r = r; g.t = 0; g.dur = dur; g.m.visible = true;
  }
  light(p, color, peak, dist = 12, dur = 0.2) {
    const l = this.lights.find((q) => q.t >= q.dur) || this.lights.reduce((a, b) => (a.t > b.t ? a : b));
    l.l.position.set(p.x, p.y, p.z); l.l.color.setHex(color); l.l.distance = dist; l.peak = peak; l.t = 0; l.dur = dur;
  }

  explosion(p, r, kind) {
    const big = kind === 'big' || kind === 'boss';
    const col = kind === 'drone' ? [3, 0.8, 0.3] : kind === 'battery' ? [2.4, 2.0, 0.6] : [3, 1.3, 0.4];
    this.flash({ x: p.x, y: p.y + 0.3, z: p.z }, r * 2.4, col, big ? 0.45 : 0.28);
    this.ring({ x: p.x, y: Math.max(0, this.geom.heightAt(p.x, p.z)), z: p.z }, r * 1.4, [col[0] * 0.5, col[1] * 0.5, col[2] * 0.5], 0.45);
    this.light(p, kind === 'battery' ? 0xffdd66 : 0xff8844, big ? 260 : 140, r * 4, big ? 0.5 : 0.3);
    this.sparkBurst(p, this.low ? 18 : 40, { x: 0, y: 0.6, z: 0 }, col, 11 * Math.sqrt(r), 0.08, 0.6);
    this.glowPuff(p, r * 1.2, [2.2, 0.9, 0.3], 0.35, 4, r * 0.6);
    for (let i = 0; i < (this.low ? 4 : 9); i++) this.smokePuff({ x: p.x + (Math.random() - 0.5) * r, y: p.y + Math.random() * r * 0.5, z: p.z + (Math.random() - 0.5) * r }, r * 0.9, 1.8, 0.06);
    this.debrisBurst(p, big ? 14 : 5, big ? 0.22 : 0.1, big ? 9 : 6);
    const gy = this.geom.heightAt(p.x, p.z);
    if (p.y - gy < r) this.decal({ x: p.x, y: gy + 0.01, z: p.z }, { x: 0, y: 1, z: 0 }, 'scorch', r * 1.3);
  }

  emp(p, r) {
    this.ring({ x: p.x, y: Math.max(0, this.geom.heightAt(p.x, p.z)), z: p.z }, r, [0.4, 1.8, 3], 0.6);
    this.flash(p, r * 1.6, [0.4, 1.6, 3.0], 0.35);
    this.light(p, 0x44ccff, 160, r * 3, 0.4);
    this.energyBurst(p, 70, [0.4, 2.0, 3.2], 7, 0.07, 0.6);
    this.sparkBurst(p, 25, null, [0.6, 1.8, 3.2], 9, 0.05, 0.4);
  }

  telegraphLaser(src, until) {
    const l = this.lasers.find((q) => q.until < this.now) || this.lasers[0];
    l.until = until; l.src = src; l.m.visible = true;
    return l;
  }
  telegraphCircle(p, r, dur) {
    const c = this.circles.find((q) => this.now - q.t0 > q.dur) || this.circles[0];
    c.m.position.set(p.x, p.y + 0.03, p.z); c.m.scale.set(r, r, 1); c.t0 = this.now; c.dur = dur; c.r = r; c.m.visible = true;
  }
  telegraphLine(a, b, dur) {
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    this.lineMesh.position.set((a.x + b.x) / 2, Math.max(a.y, b.y) + 0.04, (a.z + b.z) / 2);
    this.lineMesh.scale.set(len, 2.4, 1);
    this.lineMesh.rotation.set(-Math.PI / 2, 0, -Math.atan2(dz, dx));
    this.lineMesh.visible = true; this.lineUntil = this.now + dur + 2.6;
  }

  // ── 매 프레임 ─────────────────────────────────────────
  update(dt, world, alpha) {
    this.now += dt;
    for (const p of [this.sparks, this.glow, this.smoke, this.energy]) p.update(this.now);
    // 파편
    const m = this._m, q = this._q, e = this._e, v = this._v, s = this._s;
    let n = 0;
    for (const d of this.debris) {
      d.life -= dt;
      if (d.life <= 0) continue;
      d.vy -= 18 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      const gy = this.geom.heightAt(d.x, d.z) + d.sy * 0.5;
      if (d.y < gy && gy > -50) { d.y = gy; d.vy = -d.vy * 0.3; d.vx *= 0.6; d.vz *= 0.6; d.wx *= 0.6; d.wy *= 0.6; }
      d.rx += d.wx * dt; d.ry += d.wy * dt;
      const sc = Math.min(1, d.life * 2);
      m.compose(v.set(d.x, d.y, d.z), q.setFromEuler(e.set(d.rx, d.ry, 0)), s.set(d.sx * sc, d.sy * sc, d.sz * sc));
      this.debrisMesh.setMatrixAt(n++, m);
    }
    this.debris = this.debris.filter((d) => d.life > 0);
    this.debrisMesh.count = n;
    this.debrisMesh.instanceMatrix.needsUpdate = true;

    // 예광탄: 플레이어 탄(짧게) + 적 투사체(실제 위치)
    n = 0;
    const cam = this.camera.position;
    const put = (ax, ay, az, bx, by, bz, w, col, k) => {
      if (n >= this.tracerMax) return;
      const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz);
      if (len < 0.01) return;
      v.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
      // 막대가 카메라를 보게 축(진행 방향) 주위로 회전
      const fwd = new THREE.Vector3(dx / len, dy / len, dz / len);
      const toCam = new THREE.Vector3(cam.x - v.x, cam.y - v.y, cam.z - v.z).normalize();
      const side = new THREE.Vector3().crossVectors(fwd, toCam).normalize();
      const up = new THREE.Vector3().crossVectors(side, fwd);
      m.makeBasis(side, up, fwd);
      m.scale(s.set(w, 1, len));
      m.setPosition(v);
      this.tracerMesh.setMatrixAt(n, m);
      this.tracerMesh.instanceColor.setXYZ(n, col[0] * k, col[1] * k, col[2] * k);
      n++;
    };
    for (const t of this.tracers) {
      t.t += dt;
      const k = 1 - t.t / t.life;
      if (k <= 0) continue;
      // 머리가 앞으로 나가며 꼬리가 따라감
      const hf = Math.min(1, t.t / t.life * 2.2), tf = Math.max(0, t.t / t.life * 2.2 - 0.6);
      put(t.a.x + (t.b.x - t.a.x) * tf, t.a.y + (t.b.y - t.a.y) * tf, t.a.z + (t.b.z - t.a.z) * tf,
        t.a.x + (t.b.x - t.a.x) * hf, t.a.y + (t.b.y - t.a.y) * hf, t.a.z + (t.b.z - t.a.z) * hf, t.width, t.color, 1);
    }
    this.tracers = this.tracers.filter((t) => t.t < t.life);
    for (const b of world.projectiles) {
      const sp = Math.hypot(b.vx, b.vy, b.vz) || 1;
      const L = b.kind === 'missile' ? 0.9 : 2.2;
      put(b.x - (b.vx / sp) * L, b.y - (b.vy / sp) * L, b.z - (b.vz / sp) * L, b.x, b.y, b.z, b.kind === 'missile' ? 0.16 : 0.05, b.kind === 'missile' ? [3, 1.2, 0.4] : [3.2, 0.35, 0.3], 1);
      if (b.kind === 'missile' && Math.random() < dt * 40) this.smokePuff(b, 0.5, 0.9, 0.18, { x: 0, y: 0.2, z: 0 });
    }
    this.tracerMesh.count = n;
    this.tracerMesh.instanceMatrix.needsUpdate = true;
    if (this.tracerMesh.instanceColor) this.tracerMesh.instanceColor.needsUpdate = true;

    for (const f of this.flashes) {
      if (f.t >= f.dur) { f.s.visible = false; continue; }
      f.t += dt; const k = f.t / f.dur;
      f.s.scale.setScalar(f.size * (0.6 + k * 0.8)); f.s.material.opacity = 1 - k;
    }
    for (const g of this.rings) {
      if (g.t >= g.dur) { g.m.visible = false; continue; }
      g.t += dt; const k = g.t / g.dur;
      g.m.scale.setScalar(0.2 + g.r * (1 - Math.pow(1 - k, 3))); g.m.material.opacity = 1 - k;
    }
    for (const l of this.lights) {
      if (l.t >= l.dur) { l.l.intensity = 0; continue; }
      l.t += dt; l.l.intensity = l.peak * Math.pow(1 - l.t / l.dur, 2);
    }
    for (const l of this.lasers) {
      if (l.until < this.now || !l.src) { l.m.visible = false; continue; }
      const a = l.src.from(), b = l.src.to();
      if (!a || !b) { l.m.visible = false; continue; }
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, len = Math.hypot(dx, dy, dz);
      l.m.position.set(a.x, a.y, a.z); l.m.lookAt(b.x, b.y, b.z); l.m.scale.set(l.src.w || 1, l.src.w || 1, len);
      l.m.material.opacity = 0.5 + 0.5 * Math.sin(this.now * 40);
      l.m.visible = true;
    }
    for (const c of this.circles) {
      const k = (this.now - c.t0) / c.dur;
      if (k > 1) { c.m.visible = false; continue; }
      c.m.material.uniforms.uK.value = k; c.m.material.uniforms.uT.value = this.now;
    }
    this.lineMesh.visible = this.now < this.lineUntil;
    this.lineMesh.material.uniforms.uT.value = this.now;

    // 드롭 · 수류탄 · 배터리
    let oi = 0, ai = 0;
    for (const k of world.pickups) {
      const bob = Math.sin(this.now * 4 + k.id * 20) * 0.08;
      if (k.kind === 'orb' && oi < 80) {
        m.compose(v.set(k.x, k.y + bob, k.z), q.identity(), s.setScalar(k.life < 2 ? (Math.sin(this.now * 20) > 0 ? 1 : 0.4) : 1));
        this.orbMesh.setMatrixAt(oi++, m);
        if (Math.random() < dt * 6) this.energy.emit(k.x, k.y, k.z, 0, 0.6, 0, 0.6, 0.3, 1.8, 2.2, 0.05, this.now);
      } else if (k.kind === 'ammo' && ai < 30) {
        m.compose(v.set(k.x, k.y + bob, k.z), q.setFromEuler(e.set(0, this.now * 2 + k.id * 10, 0)), s.setScalar(1));
        this.ammoMesh.setMatrixAt(ai++, m);
      }
    }
    this.orbMesh.count = oi; this.orbMesh.instanceMatrix.needsUpdate = true;
    this.ammoMesh.count = ai; this.ammoMesh.instanceMatrix.needsUpdate = true;
    let gi = 0;
    for (const g of world.grenades) {
      const x = g.px + (g.x - g.px) * alpha, y = g.py + (g.y - g.py) * alpha, z = g.pz + (g.z - g.pz) * alpha;
      m.compose(v.set(x, y, z), q.identity(), s.setScalar(1));
      this.nadeMesh.setMatrixAt(gi++, m);
      if (Math.random() < dt * 30) this.energy.emit(x, y, z, 0, 0.3, 0, 0.3, 0.4, 2, 3, 0.06, this.now);
    }
    this.nadeMesh.count = gi; this.nadeMesh.instanceMatrix.needsUpdate = true;
    world.batteries.forEach((b, i) => {
      const bv = this.batteryViews[i]; if (!bv) return;
      bv.g.visible = b.alive;
      bv.band.color.setRGB(3.2 * (0.7 + 0.3 * Math.sin(this.now * 3 + i)), 1.6, 0.25);
    });
  }
}

// 예광탄용: 길이 1(z 0~1이 아니라 −0.5~0.5), 폭 1 평면 2장 교차
function tracerGeo() {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(Math.PI / 2);
  return g;
}
