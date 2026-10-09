/**
 * 표적: 강철판(자격 심사) / 사람(경비병 · 핵심 표적 · 민간인).
 * - 판정은 단순 도형(구·상자)으로 분석적으로 계산한다(빠르고 결정론적).
 * - AI: 대기/순찰 → (총성·착탄음·목격·시신 발견) → 반응 지연 → 도주 → 탈출
 * - 무력화되면 쓰러져 그 자리에 남는다(유혈 표현 없음). 순찰병이 시신을 보면 경계한다.
 */
import * as THREE from 'three';
import { BALANCE } from '../config/balance';
import type { Role, TargetDef } from '../config/missions';
import { buildHuman, HumanMaterials, type HumanRig } from './models/human';
import type { Terrain } from './terrain';

export type HitZone = 'head' | 'chest' | 'abdomen' | 'arm' | 'leg' | 'plate';

export const ROLE_LABEL: Record<Role, string> = { hvt: '핵심 표적', guard: '경비병', civilian: '민간인' };

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

/** 사람·강철판 공용 재질(모든 표적이 공유 → 생성 비용 절약) */
export class TargetMaterials {
  readonly plate = new THREE.MeshLambertMaterial({ color: 0xf4f4f0, flatShading: true });
  readonly plateHit = new THREE.MeshLambertMaterial({ color: 0x56d364, flatShading: true });
  readonly stand = new THREE.MeshLambertMaterial({ color: 0x4a4038, flatShading: true });
  readonly decal = new THREE.MeshBasicMaterial({ color: 0x3a3a3a, polygonOffset: true, polygonOffsetFactor: -2 });
  readonly human = new HumanMaterials();
  readonly geos = {
    decal: new THREE.CircleGeometry(0.018, 6),
    post: new THREE.BoxGeometry(0.06, 1, 0.06),
  };

  dispose(): void {
    for (const m of [this.plate, this.plateHit, this.stand, this.decal]) m.dispose();
    for (const g of Object.values(this.geos)) g.dispose();
    this.human.dispose();
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
  /** 스코프 관측·레이저로 식별되었는지 */
  tagged = false;
  /** 식별을 위한 관측 누적 시간(초) */
  observe = 0;
  /** 쓰러짐 진행(0~1) */
  private fallT = 0;
  private fallSign = 1;
  private rig: HumanRig | null = null;
  private readonly ownGeos: THREE.BufferGeometry[] = [];
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
    else this.buildPerson();
    this.reset();
  }

  get isPerson(): boolean {
    return this.def.kind === 'person';
  }

  get role(): Role | null {
    return this.isPerson ? (this.def.role ?? 'guard') : null;
  }

  get isCivilian(): boolean {
    return this.role === 'civilian';
  }

  get isDown(): boolean {
    return this.state === 'down';
  }

  get done(): boolean {
    return this.isPerson ? this.state === 'down' : this.plateHit;
  }

  get active(): boolean {
    return this.isPerson ? this.state !== 'down' && this.state !== 'escaped' : true;
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
    this.tagged = !this.isPerson;
    this.observe = 0;
    this.fallT = 0;
    if (this.rig) {
      this.rig.body.rotation.set(0, 0, 0);
      this.rig.body.position.set(0, 0, 0);
      this.rig.alertLight.material = this.mats.human.ledOff;
    }
    this.pathIndex = 1;
    this.pauseTimer = 0;
    this.idleTimer = 1 + Math.random() * 3;
    this.idleYawTarget = this.yaw;
    this.plateSwing = 0;
    this.plateSwingV = 0;
    this.group.visible = true;
    for (const dcl of this.decals) dcl.visible = false;
    if (this.plateMesh) this.plateMesh.material = this.mats.plate;
    // 민간인은 탈출 지점이 없으면 사수 반대쪽 옆으로 달아나게 자동 생성
    const esc = d.escape ?? (this.isCivilian ? ([d.x + (d.x < 0 ? -35 : 35), d.dist + 12] as [number, number]) : undefined);
    if (esc) {
      const ex = esc[0];
      const ez = -esc[1];
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
    this.ownGeos.push(geo);
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
    const barGeo = new THREE.BoxGeometry(w + 0.2, 0.05, 0.05);
    this.ownGeos.push(barGeo);
    const bar = new THREE.Mesh(barGeo, this.mats.stand);
    bar.position.set(0, 0.72 + h, -0.03);
    this.group.add(bar);
    for (let i = 0; i < 12; i++) {
      const dcl = new THREE.Mesh(this.mats.geos.decal, this.mats.decal);
      dcl.visible = false;
      plate.add(dcl);
      this.decals.push(dcl);
    }
  }

  private buildPerson(): void {
    const outfit = this.def.outfit ?? (this.role === 'civilian' ? 'civilian' : this.role === 'hvt' ? 'hvtSuit' : 'guard');
    const rig = buildHuman(outfit, this.mats.human);
    this.rig = rig;
    this.group.add(rig.root);
    this.parts.head = rig.head;
    this.parts.armL = rig.armL;
    this.parts.armR = rig.armR;
    this.parts.legL = rig.legL;
    this.parts.legR = rig.legR;
  }

  private syncGroup(): void {
    this.group.position.copy(this.position);
    this.group.rotation.set(0, this.yaw, 0);
    if (this.parts.hinge) this.parts.hinge.rotation.x = this.plateSwing;
  }

  /** 경계 반응 대기 중인지 */
  get alertPending(): boolean {
    return this.alertTimer >= 0;
  }

  /** 경계 시작(이미 경계 중이면 더 빠른 쪽 유지) */
  alert(delay: number): void {
    if (!this.isPerson || this.state === 'down' || this.state === 'escaped' || !this.escapePoint) return;
    if (this.alerted) return;
    if (this.alertTimer < 0 || delay < this.alertTimer) this.alertTimer = delay;
  }

  /** @returns 이번 업데이트에 막 경계 상태가 되었는지 */
  update(dt: number): { becameAlert: boolean; escaped: boolean } {
    let becameAlert = false;
    let escaped = false;
    if (!this.isPerson) {
      // 강철판 진자 운동
      this.plateSwingV += (-this.plateSwing * 40 - this.plateSwingV * 2.2) * dt;
      this.plateSwing += this.plateSwingV * dt;
      this.syncGroup();
      return { becameAlert, escaped };
    }
    if (this.state === 'down') {
      // 쓰러짐: 무릎이 꺾이며 탄이 날아간 방향으로 넘어진다
      if (this.fallT < 1 && this.rig) {
        this.fallT = Math.min(1, this.fallT + dt / 0.7);
        const f = this.fallT;
        const e = f < 0.35 ? (f / 0.35) * 0.25 : 0.25 + (1 - Math.pow(1 - (f - 0.35) / 0.65, 2)) * 0.75;
        this.rig.body.rotation.x = this.fallSign * e * (Math.PI / 2 - 0.08);
        this.rig.body.position.y = -Math.sin(Math.min(1, f * 2) * Math.PI * 0.5) * 0.12;
        this.rig.legL.rotation.x = -e * 0.5;
        this.rig.legR.rotation.x = -e * 0.3;
        this.rig.armL.rotation.x = this.fallSign * e * 1.2;
        this.rig.armR.rotation.x = this.fallSign * e * 0.9;
      }
      return { becameAlert, escaped };
    }
    if (this.state === 'escaped') return { becameAlert, escaped };
    if (this.alertTimer >= 0) {
      this.alertTimer -= dt;
      if (this.alertTimer < 0 && !this.alerted) {
        this.alerted = true;
        becameAlert = true;
        this.state = 'fleeing';
        if (this.rig) this.rig.alertLight.material = this.mats.human.ledOn;
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
    if (this.isPerson && this.state === 'down') return null;
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
    if (!this.isPerson) {
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
    let vital: HitResult | null = null;
    for (const z of BOT_ZONES) {
      const t = z.type === 'sphere' ? segSphere(la, lb, z.c, z.r!) : segBoxLocal(la, lb, z.c, z.half!);
      if (t === null) continue;
      const h = { target: this, zone: z.zone, t, point: new THREE.Vector3().lerpVectors(a, b, t) };
      if (!best || t < best.t) best = h;
      if ((z.zone === 'head' || z.zone === 'chest' || z.zone === 'abdomen') && (!vital || t < vital.t)) vital = h;
    }
    // 소총탄은 팔을 관통한다: 옆으로 선 사람의 팔 뒤(0.6m 이내)에 몸통이 있으면 몸통 명중으로 본다.
    // 시뮬레이션 한 스텝(약 0.5m)이 팔에서 끝날 수 있으므로 진행 방향으로 늘려서 확인한다.
    if (best && best.zone === 'arm') {
      if (!vital) {
        const len = Math.max(1e-6, la.distanceTo(lb));
        const ext = new THREE.Vector3().subVectors(lb, la).multiplyScalar(1 + 0.6 / len).add(la);
        for (const z of BOT_ZONES) {
          if (z.zone !== 'head' && z.zone !== 'chest' && z.zone !== 'abdomen') continue;
          const t = z.type === 'sphere' ? segSphere(la, ext, z.c, z.r!) : segBoxLocal(la, ext, z.c, z.half!);
          if (t !== null && (!vital || t < vital.t)) vital = { target: this, zone: z.zone, t, point: best.point };
        }
      }
      if (vital) return { ...vital, t: best.t, point: best.point };
    }
    return best;
  }

  /** 맞았을 때 처리. @returns 무력화(파괴) 여부 */
  applyHit(hit: HitResult, impulse: THREE.Vector3): boolean {
    this.hitCount++;
    if (!this.isPerson) {
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
        this.down(impulse);
        return true;
      }
      this.alert(0.15);
      return false;
    }
    this.down(impulse);
    return true;
  }

  /** @param dir 탄의 진행 방향(쓰러지는 방향) */
  private down(dir?: THREE.Vector3): void {
    this.state = 'down';
    this.velocity.set(0, 0, 0);
    this.fallT = 0;
    if (dir) {
      // 몸이 탄 진행 방향으로 넘어지도록: 진행 방향을 바라보면 앞으로(+), 등지면 뒤로(-)
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      this.fallSign = fx * dir.x + fz * dir.z >= 0 ? 1 : -1;
    }
    if (this.rig) this.rig.alertLight.material = this.mats.human.ledOff;
  }

  dispose(): void {
    // 강철판만 고유 지오메트리를 가진다. 사람 모델의 지오메트리·재질은 공유 캐시(HumanMaterials)가 관리한다.
    for (const g of this.ownGeos) g.dispose();
    this.ownGeos.length = 0;
    this.group.removeFromParent();
  }
}
