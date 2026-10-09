/**
 * 표적: 강철판 / 훈련 로봇.
 * - 판정은 단순 도형(구·상자)으로 분석적으로 계산한다(빠르고 결정론적).
 * - 로봇 AI: 대기/순찰 → (총성·착탄음·목격) → 반응 지연 → 도주 → 탈출
 */
import * as THREE from 'three';
import { BALANCE } from '../config/balance';
import type { TargetDef } from '../config/missions';
import type { Terrain } from './terrain';

export type HitZone = 'head' | 'chest' | 'abdomen' | 'arm' | 'leg' | 'plate';

export const ZONE_LABEL: Record<HitZone, string> = {
  head: '머리',
  chest: '흉부',
  abdomen: '복부',
  arm: '팔',
  leg: '다리',
  plate: '강철판',
};

export type BotState = 'idle' | 'patrol' | 'pausing' | 'alerting' | 'fleeing' | 'escaped' | 'down';

interface ZoneShape {
  zone: HitZone;
  /** 'sphere': c + r, 'box': c + half */
  type: 'sphere' | 'box';
  c: THREE.Vector3;
  r?: number;
  half?: THREE.Vector3;
}

const BOT_ZONES: ZoneShape[] = [
  { zone: 'head', type: 'sphere', c: new THREE.Vector3(0, 1.66, 0), r: 0.125 * BALANCE.targets.headHitboxScale },
  { zone: 'chest', type: 'box', c: new THREE.Vector3(0, 1.34, 0), half: new THREE.Vector3(0.21, 0.18, 0.13) },
  { zone: 'abdomen', type: 'box', c: new THREE.Vector3(0, 1.0, 0), half: new THREE.Vector3(0.18, 0.16, 0.12) },
  { zone: 'arm', type: 'box', c: new THREE.Vector3(-0.3, 1.24, 0), half: new THREE.Vector3(0.065, 0.28, 0.07) },
  { zone: 'arm', type: 'box', c: new THREE.Vector3(0.3, 1.24, 0), half: new THREE.Vector3(0.065, 0.28, 0.07) },
  { zone: 'leg', type: 'box', c: new THREE.Vector3(-0.1, 0.42, 0), half: new THREE.Vector3(0.085, 0.42, 0.09) },
  { zone: 'leg', type: 'box', c: new THREE.Vector3(0.1, 0.42, 0), half: new THREE.Vector3(0.085, 0.42, 0.09) },
];

export interface HitResult {
  target: Target;
  zone: HitZone;
  /** 선분상 위치(0~1) */
  t: number;
  point: THREE.Vector3;
  /** 강철판 로컬 좌표(데칼용) */
  local?: THREE.Vector3;
}

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpD = new THREE.Vector3();

function segSphere(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, r: number): number | null {
  tmpD.subVectors(b, a);
  const fx = a.x - c.x, fy = a.y - c.y, fz = a.z - c.z;
  const A = tmpD.dot(tmpD);
  const B = 2 * (fx * tmpD.x + fy * tmpD.y + fz * tmpD.z);
  const C = fx * fx + fy * fy + fz * fz - r * r;
  const disc = B * B - 4 * A * C;
  if (disc < 0 || A === 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-B - s) / (2 * A);
  if (t1 >= 0 && t1 <= 1) return t1;
  const t2 = (-B + s) / (2 * A);
  if (t1 < 0 && t2 >= 0) return 0;
  return null;
}

function segBoxLocal(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, h: THREE.Vector3): number | null {
  let tmin = 0;
  let tmax = 1;
  for (const axis of ['x', 'y', 'z'] as const) {
    const d = b[axis] - a[axis];
    const lo = c[axis] - h[axis];
    const hi = c[axis] + h[axis];
    if (Math.abs(d) < 1e-12) {
      if (a[axis] < lo || a[axis] > hi) return null;
    } else {
      let t1 = (lo - a[axis]) / d;
      let t2 = (hi - a[axis]) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

/** 로봇·강철판 공용 재질(모든 표적이 공유 → 생성 비용 절약) */
export class TargetMaterials {
  readonly body = new THREE.MeshLambertMaterial({ color: 0xff7a1a, flatShading: true });
  readonly bodyLight = new THREE.MeshLambertMaterial({ color: 0xf2efe8, flatShading: true });
  readonly dark = new THREE.MeshLambertMaterial({ color: 0x2a2f36, flatShading: true });
  readonly visor = new THREE.MeshBasicMaterial({ color: 0x5fe0ff });
  readonly visorAlert = new THREE.MeshBasicMaterial({ color: 0xff3030 });
  readonly plate = new THREE.MeshLambertMaterial({ color: 0xf4f4f0, flatShading: true });
  readonly plateHit = new THREE.MeshLambertMaterial({ color: 0x56d364, flatShading: true });
  readonly stand = new THREE.MeshLambertMaterial({ color: 0x4a4038, flatShading: true });
  readonly shadow = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false });
  readonly decal = new THREE.MeshBasicMaterial({ color: 0x3a3a3a, polygonOffset: true, polygonOffsetFactor: -2 });
  readonly geos = {
    head: new THREE.IcosahedronGeometry(0.12, 0),
    visor: new THREE.BoxGeometry(0.18, 0.05, 0.05),
    chest: new THREE.BoxGeometry(0.42, 0.36, 0.26),
    abdomen: new THREE.BoxGeometry(0.34, 0.3, 0.22),
    arm: new THREE.BoxGeometry(0.12, 0.56, 0.13),
    leg: new THREE.BoxGeometry(0.16, 0.84, 0.17),
    shadow: new THREE.CircleGeometry(0.45, 10),
    decal: new THREE.CircleGeometry(0.018, 6),
    post: new THREE.BoxGeometry(0.06, 1, 0.06),
  };

  dispose(): void {
    for (const m of [this.body, this.bodyLight, this.dark, this.visor, this.visorAlert, this.plate, this.plateHit, this.stand, this.shadow, this.decal]) m.dispose();
    for (const g of Object.values(this.geos)) g.dispose();
  }
}

export class Target {
  readonly def: TargetDef;
  readonly group = new THREE.Group();
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  yaw = 0;
  state: BotState = 'idle';
  alerted = false;
  hitCount = 0;
  /** 강철판 명중 여부 */
  plateHit = false;
  wounded = false;
  private alertTimer = -1;
  private pathIndex = 1;
  private pauseTimer = 0;
  private idleTimer = 0;
  private idleYawTarget = 0;
  private animT = Math.random() * 10;
  private swing = 0;
  private readonly terrain: Terrain;
  private readonly mats: TargetMaterials;
  private parts: Record<string, THREE.Object3D> = {};
  private plateMesh: THREE.Mesh | null = null;
  private plateSwing = 0;
  private plateSwingV = 0;
  private decals: THREE.Mesh[] = [];
  private readonly escapeSpeedMul: number;
  private readonly escapeDistMul: number;
  readonly reaction: number;
  /** 탈출 지점(난이도 반영) */
  private escapePoint: THREE.Vector3 | null = null;

  constructor(def: TargetDef, terrain: Terrain, mats: TargetMaterials, escapeSpeedMul: number, escapeDistMul: number, reaction: number) {
    this.def = def;
    this.terrain = terrain;
    this.mats = mats;
    this.escapeSpeedMul = escapeSpeedMul;
    this.escapeDistMul = escapeDistMul;
    this.reaction = reaction;
    if (def.kind === 'plate') this.buildPlate();
    else this.buildBot();
    this.reset();
  }

  get isBot(): boolean {
    return this.def.kind === 'bot';
  }

  get done(): boolean {
    return this.isBot ? this.state === 'down' : this.plateHit;
  }

  get active(): boolean {
    return this.isBot ? this.state !== 'down' && this.state !== 'escaped' : true;
  }

  reset(): void {
    const d = this.def;
    this.position.set(d.x, 0, -d.dist);
    this.position.y = this.terrain.height(this.position.x, this.position.z);
    this.velocity.set(0, 0, 0);
    this.yaw = ((d.facing ?? 0) * Math.PI) / 180;
    this.state = d.behavior === 'patrol' ? 'patrol' : 'idle';
    this.alerted = false;
    this.alertTimer = -1;
    this.hitCount = 0;
    this.plateHit = false;
    this.wounded = false;
    this.pathIndex = 1;
    this.pauseTimer = 0;
    this.idleTimer = 1 + Math.random() * 3;
    this.idleYawTarget = this.yaw;
    this.plateSwing = 0;
    this.plateSwingV = 0;
    this.group.visible = true;
    for (const dcl of this.decals) dcl.visible = false;
    if (this.plateMesh) this.plateMesh.material = this.mats.plate;
    if (this.parts.visor) (this.parts.visor as THREE.Mesh).material = this.mats.visor;
    if (d.escape) {
      const ex = d.escape[0];
      const ez = -d.escape[1];
      // 도주 거리 배율: 시작점→탈출점 벡터를 늘이거나 줄인다
      const sx = d.x;
      const sz = -d.dist;
      this.escapePoint = new THREE.Vector3(sx + (ex - sx) * this.escapeDistMul, 0, sz + (ez - sz) * this.escapeDistMul);
    }
    this.syncGroup();
  }

  private buildPlate(): void {
    const d = this.def;
    const w = d.w ?? 0.6;
    const h = d.h ?? 0.6;
    const geo = d.shape === 'rect' ? new THREE.BoxGeometry(w, h, 0.03) : new THREE.CylinderGeometry(w / 2, w / 2, 0.03, 18);
    if (d.shape !== 'rect') geo.rotateX(Math.PI / 2);
    // 경첩이 위에 있도록 피벗을 위쪽 가장자리로
    geo.translate(0, -h / 2, 0);
    const hinge = new THREE.Group();
    hinge.position.y = 0.7 + h;
    const plate = new THREE.Mesh(geo, this.mats.plate);
    hinge.add(plate);
    this.plateMesh = plate;
    this.parts.hinge = hinge;
    this.group.add(hinge);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(this.mats.geos.post, this.mats.stand);
      post.scale.y = 0.75 + h;
      post.position.set((sx * w) / 2 + sx * 0.05, (0.75 + h) / 2, -0.03);
      this.group.add(post);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.05, 0.05), this.mats.stand);
    bar.position.set(0, 0.72 + h, -0.03);
    this.group.add(bar);
    for (let i = 0; i < 12; i++) {
      const dcl = new THREE.Mesh(this.mats.geos.decal, this.mats.decal);
      dcl.visible = false;
      plate.add(dcl);
      this.decals.push(dcl);
    }
  }

  private buildBot(): void {
    const g = this.mats.geos;
    const add = (name: string, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z = 0, parent: THREE.Object3D = this.group) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      parent.add(m);
      this.parts[name] = m;
      return m;
    };
    add('head', g.head, this.mats.bodyLight, 0, 1.66);
    add('visor', g.visor, this.mats.visor, 0, 1.67, 0.1);
    add('chest', g.chest, this.mats.body, 0, 1.34);
    add('abdomen', g.abdomen, this.mats.bodyLight, 0, 1.02);
    // 팔·다리: 어깨/엉덩이 피벗
    for (const [name, x, y, geo, len, mat] of [
      ['armL', -0.3, 1.5, g.arm, 0.56, this.mats.body],
      ['armR', 0.3, 1.5, g.arm, 0.56, this.mats.body],
      ['legL', -0.1, 0.86, g.leg, 0.84, this.mats.dark],
      ['legR', 0.1, 0.86, g.leg, 0.84, this.mats.dark],
    ] as const) {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      this.group.add(pivot);
      const m = new THREE.Mesh(geo, mat);
      m.position.y = -len / 2;
      pivot.add(m);
      this.parts[name] = pivot;
    }
    const shadow = new THREE.Mesh(g.shadow, this.mats.shadow);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    this.group.add(shadow);
  }

  private syncGroup(): void {
    this.group.position.copy(this.position);
    this.group.rotation.set(0, this.yaw, 0);
    if (this.parts.hinge) this.parts.hinge.rotation.x = this.plateSwing;
  }

  /** 경계 시작(이미 경계 중이면 더 빠른 쪽 유지) */
  alert(delay: number): void {
    if (!this.isBot || this.state === 'down' || this.state === 'escaped' || !this.escapePoint) return;
    if (this.alerted) return;
    if (this.alertTimer < 0 || delay < this.alertTimer) this.alertTimer = delay;
  }

  /** @returns 이번 업데이트에 막 경계 상태가 되었는지 */
  update(dt: number): { becameAlert: boolean; escaped: boolean } {
    let becameAlert = false;
    let escaped = false;
    if (!this.isBot) {
      // 강철판 진자 운동
      this.plateSwingV += (-this.plateSwing * 40 - this.plateSwingV * 2.2) * dt;
      this.plateSwing += this.plateSwingV * dt;
      this.syncGroup();
      return { becameAlert, escaped };
    }
    if (this.state === 'down' || this.state === 'escaped') return { becameAlert, escaped };
    if (this.alertTimer >= 0) {
      this.alertTimer -= dt;
      if (this.alertTimer < 0 && !this.alerted) {
        this.alerted = true;
        becameAlert = true;
        this.state = 'fleeing';
        if (this.parts.visor) (this.parts.visor as THREE.Mesh).material = this.mats.visorAlert;
      }
    }
    const T = BALANCE.targets;
    let speed = 0;
    let goal: THREE.Vector3 | null = null;
    if (this.state === 'fleeing' && this.escapePoint) {
      goal = this.escapePoint;
      speed = T.runSpeed * this.escapeSpeedMul;
    } else if (this.state === 'patrol' && this.def.path) {
      const p = this.def.path[this.pathIndex];
      goal = tmpA.set(p[0], 0, -p[1]);
      speed = T.walkSpeed;
    } else if (this.state === 'pausing') {
      this.pauseTimer -= dt;
      if (this.pauseTimer <= 0) this.state = 'patrol';
    } else if (this.state === 'idle') {
      this.idleTimer -= dt;
      if (this.idleTimer <= 0) {
        this.idleTimer = 2 + Math.random() * 3;
        this.idleYawTarget = (Math.random() - 0.5) * 2.2;
      }
      this.yaw += (this.idleYawTarget - this.yaw) * Math.min(1, dt * 2);
    }
    if (this.wounded) speed *= T.legHitSpeedMul;
    if (goal && speed > 0) {
      tmpB.set(goal.x - this.position.x, 0, goal.z - this.position.z);
      const dist = tmpB.length();
      const step = speed * dt;
      if (dist <= step) {
        this.position.x = goal.x;
        this.position.z = goal.z;
        this.velocity.set(0, 0, 0);
        if (this.state === 'fleeing') {
          this.state = 'escaped';
          this.group.visible = false;
          escaped = true;
        } else if (this.def.path) {
          this.pathIndex = (this.pathIndex + 1) % this.def.path.length;
          this.state = 'pausing';
          this.pauseTimer = this.def.pause ?? 1;
        }
      } else {
        tmpB.multiplyScalar(1 / dist);
        this.velocity.set(tmpB.x * speed, 0, tmpB.z * speed);
        this.position.x += tmpB.x * step;
        this.position.z += tmpB.z * step;
        const targetYaw = Math.atan2(tmpB.x, tmpB.z);
        let dy = targetYaw - this.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this.yaw += dy * Math.min(1, dt * 8);
      }
      this.position.y = this.terrain.height(this.position.x, this.position.z);
    } else {
      this.velocity.set(0, 0, 0);
    }
    // 걷기/달리기 애니메이션
    const moving = this.velocity.lengthSq() > 0.01;
    const sp = Math.sqrt(this.velocity.lengthSq());
    this.animT += dt * (moving ? 2.2 + sp * 1.6 : 1);
    this.swing += ((moving ? Math.min(0.9, 0.35 + sp * 0.15) : 0) - this.swing) * Math.min(1, dt * 6);
    const s = Math.sin(this.animT * 2) * this.swing;
    this.parts.legL.rotation.x = s;
    this.parts.legR.rotation.x = -s;
    this.parts.armL.rotation.x = -s * 0.8;
    this.parts.armR.rotation.x = s * 0.8;
    if (!moving) this.parts.head.rotation.y = Math.sin(this.animT * 0.7) * 0.4;
    this.syncGroup();
    return { becameAlert, escaped };
  }

  /** 선분(월드 좌표)과 판정 */
  intersect(a: THREE.Vector3, b: THREE.Vector3): HitResult | null {
    if (!this.group.visible) return null;
    if (this.isBot && this.state === 'down') return null;
    // 대략적 경계 구 검사로 빠르게 거른다
    const center = tmpA.copy(this.position);
    center.y += 1;
    if (segSphere(a, b, center, 1.6) === null) return null;
    // 로컬 좌표로 변환
    const cos = Math.cos(-this.yaw);
    const sin = Math.sin(-this.yaw);
    const toLocal = (p: THREE.Vector3, out: THREE.Vector3) => {
      const x = p.x - this.position.x;
      const z = p.z - this.position.z;
      out.set(x * cos + z * sin, p.y - this.position.y, -x * sin + z * cos);
      return out;
    };
    const la = toLocal(a, new THREE.Vector3());
    const lb = toLocal(b, new THREE.Vector3());
    if (!this.isBot) {
      const w = this.def.w ?? 0.6;
      const h = this.def.h ?? 0.6;
      // 판 앞면(z=0) 통과 지점 – 흔들림 각도 반영
      const hy = 0.7 + h;
      const ang = this.plateSwing;
      // 판 평면: 경첩 기준으로 x축 회전
      const nY = -Math.sin(ang);
      const nZ = Math.cos(ang);
      const da = (la.y - hy) * nY + la.z * nZ;
      const db = (lb.y - hy) * nY + lb.z * nZ;
      if ((da > 0 && db > 0) || (da < 0 && db < 0)) return null;
      const t = da / (da - db);
      const p = new THREE.Vector3().lerpVectors(la, lb, t);
      // 판 좌표: 경첩에서 아래로
      const v = (p.y - hy) * Math.cos(ang) + p.z * Math.sin(ang);
      const u = p.x;
      const inside = this.def.shape === 'rect' ? Math.abs(u) <= w / 2 && v <= 0 && v >= -h : u * u + (v + h / 2) * (v + h / 2) <= (w / 2) * (w / 2);
      if (!inside) return null;
      return { target: this, zone: 'plate', t, point: new THREE.Vector3().lerpVectors(a, b, t), local: new THREE.Vector3(u, v, 0.02) };
    }
    let best: HitResult | null = null;
    for (const z of BOT_ZONES) {
      const t = z.type === 'sphere' ? segSphere(la, lb, z.c, z.r!) : segBoxLocal(la, lb, z.c, z.half!);
      if (t !== null && (!best || t < best.t)) best = { target: this, zone: z.zone, t, point: new THREE.Vector3().lerpVectors(a, b, t) };
    }
    return best;
  }

  /** 맞았을 때 처리. @returns 무력화(파괴) 여부 */
  applyHit(hit: HitResult, impulse: THREE.Vector3): boolean {
    this.hitCount++;
    if (!this.isBot) {
      this.plateHit = true;
      if (this.plateMesh) this.plateMesh.material = this.mats.plateHit;
      this.plateSwingV += Math.min(6, impulse.length() * 0.004);
      const dcl = this.decals.find((d) => !d.visible) ?? this.decals[(this.hitCount - 1) % this.decals.length];
      if (hit.local) {
        dcl.visible = true;
        dcl.position.set(hit.local.x, hit.local.y, 0.017);
      }
      return true;
    }
    if (hit.zone === 'arm' || hit.zone === 'leg') {
      // 팔·다리: 무력화 실패, 부상 + 즉시 경계
      if (hit.zone === 'leg') this.wounded = true;
      if (this.wounded && this.hitCount >= 2) {
        this.down();
        return true;
      }
      this.alert(0.15);
      return false;
    }
    this.down();
    return true;
  }

  private down(): void {
    this.state = 'down';
    this.velocity.set(0, 0, 0);
    this.group.visible = false;
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh && !Object.values(this.mats.geos).includes(o.geometry)) o.geometry.dispose();
    });
    this.group.removeFromParent();
  }
}
