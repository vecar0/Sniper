/**
 * 시각 효과: 착탄 흙먼지 · 불꽃 · 탄 궤적.
 * 전부 고정 크기 풀(InstancedMesh)로 재사용 → 오래 플레이해도 오브젝트·메모리가 늘지 않는다.
 */
import * as THREE from 'three';

interface Particle {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  grow: number;
  gravity: number;
  rot: number;
  rotV: number;
  bounce: boolean;
  color: THREE.Color;
}

class ParticlePool {
  readonly mesh: THREE.InstancedMesh;
  private readonly particles: Particle[] = [];
  private next = 0;
  private readonly fade: boolean;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly axis = new THREE.Vector3(0.3, 1, 0.2).normalize();
  private readonly groundAt: (x: number, z: number) => number;

  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, count: number, fade: boolean, groundAt: (x: number, z: number) => number) {
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.fade = fade;
    this.groundAt = groundAt;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        alive: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 1,
        grow: 0,
        gravity: 0,
        rot: 0,
        rotV: 0,
        bounce: false,
        color: new THREE.Color(),
      });
      this.m.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, new THREE.Color(1, 1, 1));
    }
  }

  spawn(pos: THREE.Vector3, vel: THREE.Vector3, life: number, size: number, grow: number, gravity: number, color: number | THREE.Color, bounce = false): void {
    const p = this.particles[this.next];
    this.next = (this.next + 1) % this.particles.length;
    p.alive = true;
    p.pos.copy(pos);
    p.vel.copy(vel);
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.grow = grow;
    p.gravity = gravity;
    p.rot = Math.random() * 6;
    p.rotV = (Math.random() - 0.5) * 12;
    p.bounce = bounce;
    if (typeof color === 'number') p.color.setHex(color);
    else p.color.copy(color);
  }

  get aliveCount(): number {
    return this.particles.filter((p) => p.alive).length;
  }

  update(dt: number): void {
    let changed = false;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.alive) continue;
      changed = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        this.m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.m);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(Math.max(0, 1 - dt * (p.bounce ? 0.2 : 1.6)));
      p.pos.addScaledVector(p.vel, dt);
      if (p.bounce) {
        const g = this.groundAt(p.pos.x, p.pos.z) + 0.05;
        if (p.pos.y < g) {
          p.pos.y = g;
          p.vel.y = Math.abs(p.vel.y) * 0.35;
          p.vel.x *= 0.6;
          p.vel.z *= 0.6;
          p.rotV *= 0.5;
        }
      }
      p.rot += p.rotV * dt;
      p.size += p.grow * dt;
      const f = p.life / p.maxLife;
      const sc = this.fade ? p.size * (0.4 + 0.6 * f) : p.size * (p.bounce && f < 0.2 ? f * 5 : 1);
      this.q.setFromAxisAngle(this.axis, p.rot);
      this.s.set(sc, sc, sc);
      this.m.compose(p.pos, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, p.color);
    }
    if (changed) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }

  clear(): void {
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].alive = false;
      this.m.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/**
 * 탄 궤적(트레이서): 화면에서 항상 같은 픽셀 크기로 빛나는 점 + 꼬리.
 * 실제 7mm 탄은 수백 m 밖에서 보이지 않지만, 관측수가 보는 "탄적(공기 흔들림)"을 게임적으로 과장해
 * 스코프 배율·거리와 상관없이 탄이 어디로 가는지 눈으로 따라갈 수 있게 한다.
 */
export class TracerPool {
  private static readonly TRAIL = 30;
  private readonly items: { trail: THREE.Points; head: THREE.Points; mat: THREE.PointsMaterial; headMat: THREE.PointsMaterial; points: THREE.Vector3[]; life: number; active: boolean }[] = [];
  readonly group = new THREE.Group();
  private readonly dot: THREE.Texture;

  constructor(count: number) {
    // 부드러운 원형 점 텍스처
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,240,200,0.9)');
    g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    this.dot = new THREE.CanvasTexture(c);
    for (let i = 0; i < count; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(TracerPool.TRAIL * 3), 3));
      // 꼬리 끝으로 갈수록 어두워짐(가산 혼합이라 어두울수록 투명하게 보인다)
      const col = new Float32Array(TracerPool.TRAIL * 3);
      for (let k = 0; k < TracerPool.TRAIL; k++) {
        const f = Math.pow(k / (TracerPool.TRAIL - 1), 1.6);
        col[k * 3] = 1 * f;
        col[k * 3 + 1] = 0.85 * f;
        col[k * 3 + 2] = 0.55 * f;
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, map: this.dot, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false });
      const trail = new THREE.Points(geo, mat);
      trail.frustumCulled = false;
      trail.renderOrder = 10;
      const hg = new THREE.BufferGeometry();
      hg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3), 3));
      const headMat = new THREE.PointsMaterial({ size: 11, sizeAttenuation: false, map: this.dot, color: 0xfff4d0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false });
      const head = new THREE.Points(hg, headMat);
      head.frustumCulled = false;
      head.renderOrder = 11;
      trail.visible = false;
      head.visible = false;
      this.group.add(trail, head);
      this.items.push({ trail, head, mat, headMat, points: [], life: 0, active: false });
    }
  }

  /** 렌더러 픽셀 비율(고해상도 화면에서도 같은 크기로 보이게) */
  setScale(pixelRatio: number): void {
    for (const it of this.items) {
      it.mat.size = 5 * pixelRatio;
      it.headMat.size = 11 * pixelRatio;
    }
  }

  start(): number {
    let idx = this.items.findIndex((i) => !i.active && i.life <= 0);
    if (idx < 0) idx = 0;
    const it = this.items[idx];
    it.active = true;
    it.points = [];
    it.life = 0;
    it.mat.opacity = 1;
    it.headMat.opacity = 1;
    it.trail.visible = true;
    it.head.visible = true;
    return idx;
  }

  push(idx: number, p: THREE.Vector3, _camPos: THREE.Vector3): void {
    const it = this.items[idx];
    if (!it?.active) return;
    it.points.push(p.clone());
    if (it.points.length > TracerPool.TRAIL) it.points.shift();
    const hp = it.head.geometry.attributes.position.array as Float32Array;
    hp[0] = p.x;
    hp[1] = p.y;
    hp[2] = p.z;
    it.head.geometry.attributes.position.needsUpdate = true;
    const arr = it.trail.geometry.attributes.position.array as Float32Array;
    const n = it.points.length;
    for (let i = 0; i < TracerPool.TRAIL; i++) {
      const src = it.points[Math.max(0, n - TracerPool.TRAIL + i)] ?? p;
      arr[i * 3] = src.x;
      arr[i * 3 + 1] = src.y;
      arr[i * 3 + 2] = src.z;
    }
    it.trail.geometry.attributes.position.needsUpdate = true;
  }

  end(idx: number): void {
    const it = this.items[idx];
    if (!it) return;
    it.active = false;
    it.life = 0.6;
  }

  update(dt: number): void {
    for (const it of this.items) {
      if (!it.active && it.life > 0) {
        it.life -= dt;
        const f = Math.max(0, it.life / 0.6);
        it.mat.opacity = f;
        it.headMat.opacity = f * 0.6;
        if (it.life <= 0) {
          it.trail.visible = false;
          it.head.visible = false;
        }
      }
    }
  }

  clear(): void {
    for (const it of this.items) {
      it.active = false;
      it.life = 0;
      it.trail.visible = false;
      it.head.visible = false;
    }
  }

  dispose(): void {
    for (const it of this.items) {
      it.trail.geometry.dispose();
      it.head.geometry.dispose();
      it.mat.dispose();
      it.headMat.dispose();
    }
    this.dot.dispose();
  }
}

export class Effects {
  readonly group = new THREE.Group();
  private readonly dust: ParticlePool;
  private readonly sparks: ParticlePool;
  private readonly frags: ParticlePool;
  readonly tracers: TracerPool;
  private readonly disposables: { dispose(): void }[] = [];
  private dustColor = new THREE.Color(0x9a8a6a);

  constructor(groundAt: (x: number, z: number) => number, dustColor: number) {
    this.dustColor.setHex(dustColor);
    const dustGeo = new THREE.IcosahedronGeometry(1, 0);
    const dustMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.85 });
    const sparkGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    const fragGeo = new THREE.TetrahedronGeometry(1, 0);
    const fragMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    this.disposables.push(dustGeo, dustMat, sparkGeo, sparkMat, fragGeo, fragMat);
    this.dust = new ParticlePool(dustGeo, dustMat, 160, true, groundAt);
    this.sparks = new ParticlePool(sparkGeo, sparkMat, 120, true, groundAt);
    this.frags = new ParticlePool(fragGeo, fragMat, 90, false, groundAt);
    this.tracers = new TracerPool(6);
    this.group.add(this.dust.mesh, this.sparks.mesh, this.frags.mesh, this.tracers.group);
  }

  /** 지면 착탄: 흙먼지 기둥 – 1000m에서도 스코프로 보이도록 크게 */
  impactGround(p: THREE.Vector3, distance: number): void {
    const scale = 0.5 + distance * 0.0012;
    const v = new THREE.Vector3();
    for (let i = 0; i < 10; i++) {
      v.set((Math.random() - 0.5) * 2, 2 + Math.random() * 3, (Math.random() - 0.5) * 2).multiplyScalar(scale);
      const c = this.dustColor.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
      this.dust.spawn(p, v, 0.9 + Math.random() * 0.8, 0.15 * scale, 0.6 * scale, 2, c);
    }
  }

  impactSteel(p: THREE.Vector3, distance: number): void {
    const scale = 0.5 + distance * 0.0012;
    const v = new THREE.Vector3();
    for (let i = 0; i < 14; i++) {
      v.set((Math.random() - 0.5) * 6, Math.random() * 5, Math.random() * 4).multiplyScalar(scale);
      this.sparks.spawn(p, v, 0.25 + Math.random() * 0.3, 1.2 * scale, -1, 6, 0xffd36a);
    }
    for (let i = 0; i < 3; i++) {
      v.set((Math.random() - 0.5), 0.5 + Math.random(), 0.5).multiplyScalar(scale);
      this.dust.spawn(p, v, 0.6, 0.08 * scale, 0.4 * scale, 0, 0xd8d8d0);
    }
  }

  /** 포탄 폭발: 불꽃 + 큰 흙먼지 + 파편 */
  explosion(p: THREE.Vector3): void {
    const v = new THREE.Vector3();
    for (let i = 0; i < 24; i++) {
      v.set((Math.random() - 0.5) * 14, 3 + Math.random() * 9, (Math.random() - 0.5) * 14);
      this.sparks.spawn(p, v, 0.3 + Math.random() * 0.4, 2.2, -1, 9, i % 3 ? 0xffb347 : 0xfff0a0);
    }
    for (let i = 0; i < 30; i++) {
      v.set((Math.random() - 0.5) * 7, 1 + Math.random() * 6, (Math.random() - 0.5) * 7);
      const c = this.dustColor.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.12 - 0.08);
      this.dust.spawn(p, v, 1.4 + Math.random() * 1.2, 0.5, 1.6, 1.2, c);
    }
    for (let i = 0; i < 12; i++) {
      v.set((Math.random() - 0.5) * 10, 4 + Math.random() * 6, (Math.random() - 0.5) * 10);
      this.frags.spawn(p, v, 1.5, 0.08, 0, 14, 0x4a4238, true);
    }
  }

  /** 사람 무력화: 피격 지점의 작은 먼지 + 쓰러진 자리의 흙먼지(유혈 표현 없음) */
  personDown(hit: THREE.Vector3, feet: THREE.Vector3, dir: THREE.Vector3, distance: number): void {
    const scale = 0.5 + distance * 0.0008;
    const v = new THREE.Vector3();
    for (let i = 0; i < 6; i++) {
      v.set((Math.random() - 0.5) * 0.8, Math.random() * 0.6, (Math.random() - 0.5) * 0.8).addScaledVector(dir, 1.5);
      this.dust.spawn(hit, v, 0.5 + Math.random() * 0.3, 0.06 * scale, 0.35 * scale, 0, 0x8c8676);
    }
    const ground = feet.clone().addScaledVector(dir, 0.9);
    ground.y += 0.1;
    for (let i = 0; i < 8; i++) {
      v.set((Math.random() - 0.5) * 2, 0.5 + Math.random() * 1.2, (Math.random() - 0.5) * 2);
      const c = this.dustColor.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
      this.dust.spawn(ground, v, 1.0 + Math.random() * 0.6, 0.12 * scale, 0.5 * scale, 1, c);
    }
  }

  update(dt: number): void {
    this.dust.update(dt);
    this.sparks.update(dt);
    this.frags.update(dt);
    this.tracers.update(dt);
  }

  clear(): void {
    this.dust.clear();
    this.sparks.clear();
    this.frags.clear();
    this.tracers.clear();
  }

  /** 테스트·디버그: 살아있는 파티클 수 */
  stats(): { dust: number; sparks: number; frags: number } {
    return { dust: this.dust.aliveCount, sparks: this.sparks.aliveCount, frags: this.frags.aliveCount };
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.tracers.dispose();
    this.group.removeFromParent();
  }
}
