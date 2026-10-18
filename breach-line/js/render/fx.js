// 효과: 예광선·불꽃·총구 섬광·폭발광·연막. 모두 풀(pool)로 미리 만들어 draw call을 고정한다.
import * as THREE from '../../vendor/three.module.js';
import { SMOKE } from '../config/balance.js';

const MAX_TRACERS = 48;
const MAX_SPARKS = 160;

export class Fx {
  constructor(scene, tex) {
    this.scene = scene;
    // 예광선
    const tg = new THREE.BufferGeometry();
    this.tPos = new Float32Array(MAX_TRACERS * 6);
    this.tCol = new Float32Array(MAX_TRACERS * 6);
    tg.setAttribute('position', new THREE.BufferAttribute(this.tPos, 3).setUsage(THREE.DynamicDrawUsage));
    tg.setAttribute('color', new THREE.BufferAttribute(this.tCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.tracers = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.tracers.frustumCulled = false;
    scene.add(this.tracers);
    this.tLife = new Float32Array(MAX_TRACERS);
    this.tBase = new Array(MAX_TRACERS).fill(null).map(() => new THREE.Color());
    this.tNext = 0;
    // 불꽃
    const sg = new THREE.BufferGeometry();
    this.sPos = new Float32Array(MAX_SPARKS * 3).fill(-999);
    this.sCol = new Float32Array(MAX_SPARKS * 3);
    sg.setAttribute('position', new THREE.BufferAttribute(this.sPos, 3).setUsage(THREE.DynamicDrawUsage));
    sg.setAttribute('color', new THREE.BufferAttribute(this.sCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.sparks = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.14, map: tex.spark, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.sparks.frustumCulled = false;
    scene.add(this.sparks);
    this.sVel = new Float32Array(MAX_SPARKS * 3);
    this.sLife = new Float32Array(MAX_SPARKS);
    this.sMax = new Float32Array(MAX_SPARKS);
    this.sBase = new Float32Array(MAX_SPARKS * 3);
    this.sNext = 0;
    // 빛(개수 고정 → 셰이더 재컴파일 없음)
    this.muzzle = new THREE.PointLight(0xffc070, 0, 7, 2);
    this.blastL = new THREE.PointLight(0xffffff, 0, 16, 1.5);
    scene.add(this.muzzle, this.blastL);
    this.muzzleT = 0; this.blastT = 0; this.blastMax = 1;
    // 연막
    this.smokeTex = tex.smoke;
    this.smokes = [];
  }

  tracer(a, b, color) {
    const i = this.tNext; this.tNext = (this.tNext + 1) % MAX_TRACERS;
    // 총구에서 조금 떨어진 곳부터 그려야 화면을 가리지 않는다
    const dx = b.x - a.x; const dy = b.y - a.y; const dz = b.z - a.z; const L = Math.hypot(dx, dy, dz) || 1;
    const s0 = Math.min(0.6, L * 0.3);
    this.tPos.set([a.x + (dx / L) * s0, a.y + (dy / L) * s0, a.z + (dz / L) * s0, b.x, b.y, b.z], i * 6);
    this.tBase[i].set(color);
    this.tLife[i] = 0.06;
  }

  spark(p, vel, color, life) {
    const i = this.sNext; this.sNext = (this.sNext + 1) % MAX_SPARKS;
    this.sPos.set([p.x, p.y, p.z], i * 3);
    this.sVel.set([vel.x, vel.y, vel.z], i * 3);
    const c = new THREE.Color(color);
    this.sBase.set([c.r, c.g, c.b], i * 3);
    this.sLife[i] = life; this.sMax[i] = life;
  }

  impact(p) {
    for (let k = 0; k < 4; k++) this.spark(p, { x: (Math.random() - 0.5) * 3, y: Math.random() * 2.5, z: (Math.random() - 0.5) * 3 }, 0xffd090, 0.18 + Math.random() * 0.1);
  }
  hitPuff(p) {
    for (let k = 0; k < 3; k++) this.spark(p, { x: (Math.random() - 0.5) * 1.5, y: Math.random() * 1.2, z: (Math.random() - 0.5) * 1.5 }, 0x999999, 0.25);
  }
  muzzleBurst(p) {
    for (let k = 0; k < 2; k++) this.spark(p, { x: 0, y: 0, z: 0 }, 0xffe0a0, 0.05);
  }
  muzzleLight(p) {
    this.muzzle.position.set(p.x, p.y, p.z);
    this.muzzle.intensity = 6;
    this.muzzleT = 0.05;
  }
  blast(p, color, scale) {
    this.blastL.color.set(color);
    this.blastL.position.set(p.x, (p.y || 1) + 0.3, p.z);
    this.blastMax = 120 * scale;
    this.blastL.intensity = this.blastMax;
    this.blastT = 0.25;
    for (let k = 0; k < 30; k++) {
      const a = Math.random() * Math.PI * 2; const sp = 2 + Math.random() * 5 * scale;
      this.spark({ x: p.x, y: (p.y || 1), z: p.z }, { x: Math.cos(a) * sp, y: Math.random() * 4, z: Math.sin(a) * sp }, color === 0xffffff ? 0xfff6e0 : 0xff9a40, 0.3 + Math.random() * 0.3);
    }
  }

  smoke(x, z, now) {
    const n = 28;
    const pos = new Float32Array(n * 3);
    const vel = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2; const r = Math.random() * 0.3;
      pos.set([x + Math.cos(a) * r, 0.2 + Math.random() * 0.4, z + Math.sin(a) * r], i * 3);
      vel.push({ a, sp: 0.6 + Math.random() * 1.2, up: 0.2 + Math.random() * 0.5 });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.4, map: this.smokeTex, color: 0xb8bcc0, transparent: true, opacity: 0.0, depthWrite: false }));
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.smokes.push({ pts, pos, vel, born: now, x, z });
  }

  update(dt, world) {
    // 예광선
    for (let i = 0; i < MAX_TRACERS; i++) {
      if (this.tLife[i] <= 0) continue;
      this.tLife[i] -= dt;
      const k = Math.max(0, this.tLife[i] / 0.06);
      const c = this.tBase[i];
      this.tCol.set([c.r * k * 0.6, c.g * k * 0.6, c.b * k * 0.6, c.r * k, c.g * k, c.b * k], i * 6);
    }
    this.tracers.geometry.attributes.position.needsUpdate = true;
    this.tracers.geometry.attributes.color.needsUpdate = true;
    // 불꽃
    for (let i = 0; i < MAX_SPARKS; i++) {
      if (this.sLife[i] <= 0) continue;
      this.sLife[i] -= dt;
      const j = i * 3;
      this.sVel[j + 1] -= 9.8 * dt;
      this.sPos[j] += this.sVel[j] * dt; this.sPos[j + 1] += this.sVel[j + 1] * dt; this.sPos[j + 2] += this.sVel[j + 2] * dt;
      if (this.sPos[j + 1] < 0.02) { this.sPos[j + 1] = 0.02; this.sVel[j + 1] *= -0.3; }
      const k = Math.max(0, this.sLife[i] / this.sMax[i]);
      this.sCol[j] = this.sBase[j] * k; this.sCol[j + 1] = this.sBase[j + 1] * k; this.sCol[j + 2] = this.sBase[j + 2] * k;
      if (this.sLife[i] <= 0) { this.sPos[j + 1] = -999; }
    }
    this.sparks.geometry.attributes.position.needsUpdate = true;
    this.sparks.geometry.attributes.color.needsUpdate = true;
    // 빛
    this.muzzleT -= dt; if (this.muzzleT <= 0) this.muzzle.intensity = 0;
    this.blastT -= dt; this.blastL.intensity = this.blastT > 0 ? this.blastMax * (this.blastT / 0.25) : 0;
    // 연막: 퍼지고 → 유지 → 옅어짐
    for (const s of this.smokes) {
      const age = world.time - s.born;
      const life = SMOKE.duration;
      const spread = Math.min(1, age / 2.5);
      for (let i = 0; i < s.vel.length; i++) {
        const v = s.vel[i];
        const r = spread * v.sp * 2.0;
        s.pos[i * 3] = s.x + Math.cos(v.a + age * 0.05) * r;
        s.pos[i * 3 + 1] = Math.min(2.2, 0.3 + v.up * age * 0.8 + spread * 0.6);
        s.pos[i * 3 + 2] = s.z + Math.sin(v.a + age * 0.05) * r;
      }
      s.pts.geometry.attributes.position.needsUpdate = true;
      s.pts.material.opacity = age < 0.6 ? age / 0.6 * 0.8 : age > life - 2 ? Math.max(0, (life - age) / 2) * 0.8 : 0.8;
      if (age > life) { this.scene.remove(s.pts); s.pts.geometry.dispose(); s.pts.material.dispose(); s.dead = true; }
    }
    this.smokes = this.smokes.filter((s) => !s.dead);
  }
}
