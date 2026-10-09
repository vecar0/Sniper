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

/** 탄 궤적 표시: 탄두(밝은 점) + 짧은 꼬리 */
export class TracerPool {
  private readonly items: { line: THREE.Line; head: THREE.Mesh; points: THREE.Vector3[]; life: number; active: boolean }[] = [];
  readonly group = new THREE.Group();
  private readonly lineMat = new THREE.LineBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.55, fog: false });
  private readonly headMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8, fog: false });
  private readonly headGeo = new THREE.SphereGeometry(0.06, 6, 4);
  private static readonly TRAIL = 24;

  constructor(count: number) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(TracerPool.TRAIL * 3), 3));
      const line = new THREE.Line(geo, this.lineMat);
      line.frustumCulled = false;
      const head = new THREE.Mesh(this.headGeo, this.headMat);
      line.visible = false;
      head.visible = false;
      this.group.add(line, head);
      this.items.push({ line, head, points: [], life: 0, active: false });
    }
  }

  start(): number {
    let idx = this.items.findIndex((i) => !i.active && i.life <= 0);
    if (idx < 0) idx = 0;
    const it = this.items[idx];
    it.active = true;
    it.points = [];
    it.life = 0;
    it.line.visible = true;
    it.head.visible = true;
    return idx;
  }

  push(idx: number, p: THREE.Vector3, camPos: THREE.Vector3): void {
    const it = this.items[idx];
    if (!it?.active) return;
    it.points.push(p.clone());
    if (it.points.length > TracerPool.TRAIL) it.points.shift();
    it.head.position.copy(p);
    // 멀리 있어도 보이도록 거리 비례 크기(스코프로 탄적을 관측하는 느낌)
    const d = p.distanceTo(camPos);
    it.head.scale.setScalar(Math.max(1, d * 0.004));
    const arr = it.line.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < TracerPool.TRAIL; i++) {
      const src = it.points[Math.max(0, it.points.length - TracerPool.TRAIL + i)] ?? p;
      arr[i * 3] = src.x;
      arr[i * 3 + 1] = src.y;
      arr[i * 3 + 2] = src.z;
    }
    it.line.geometry.attributes.position.needsUpdate = true;
  }

  end(idx: number): void {
    const it = this.items[idx];
    if (!it) return;
    it.active = false;
    it.life = 0.25;
    it.head.visible = false;
  }

  update(dt: number): void {
    for (const it of this.items) {
      if (!it.active && it.life > 0) {
        it.life -= dt;
        if (it.life <= 0) it.line.visible = false;
      }
    }
  }

  clear(): void {
    for (const it of this.items) {
      it.active = false;
      it.life = 0;
      it.line.visible = false;
      it.head.visible = false;
    }
  }

  dispose(): void {
    for (const it of this.items) it.line.geometry.dispose();
    this.lineMat.dispose();
    this.headMat.dispose();
    this.headGeo.dispose();
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
