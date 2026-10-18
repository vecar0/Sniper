/**
 * 적: 소총병(엄폐 → 일어나 사격) · 돌격병(플레이어를 끝까지 쫓아옴 – 정문으로 들어와 계단을 타고 층을 오르내림) ·
 * 저격수(창문·급수탑, 레이저와 반짝임으로 예고 후 강한 한 발) · 중장갑(체력 많음).
 * 피해·명중 수치는 맨 위 SPECS에 모아 둔다.
 */
import * as THREE from 'three';
import type { OutfitId } from '../config/missions';
import { buildHuman, type HumanMaterials, type HumanRig } from '../game/models/human';
import { FLOOR_Y, floorIndex } from './building';
import { clearLine, insideBuilding, type ArenaMap, type Box, type CoverPoint } from './map';
import { createSoldier, type SoldierVisual } from './soldier';

export type EnemyKind = 'rifle' | 'rusher' | 'sniper' | 'heavy';

export interface EnemySpec {
  name: string;
  hp: number;
  speed: number;
  outfit: OutfitId;
  score: number;
  /** 사격 간격(초) · 연발 수 · 한 발 피해 · 기본 명중률 */
  interval: number;
  burst: number;
  damage: number;
  accuracy: number;
}

export const SPECS: Record<EnemyKind, EnemySpec> = {
  rifle: { name: '소총병', hp: 100, speed: 4.4, outfit: 'enemyRifle', score: 100, interval: 1.6, burst: 3, damage: 7, accuracy: 0.42 },
  rusher: { name: '돌격병', hp: 90, speed: 6.4, outfit: 'enemyRusher', score: 150, interval: 0.55, burst: 1, damage: 9, accuracy: 0.55 },
  sniper: { name: '저격수', hp: 100, speed: 0, outfit: 'enemySniper', score: 250, interval: 3.4, burst: 1, damage: 55, accuracy: 1 },
  heavy: { name: '중장갑', hp: 280, speed: 2.9, outfit: 'enemyHeavy', score: 300, interval: 1.6, burst: 6, damage: 6, accuracy: 0.36 },
};

/** 저격수가 조준을 시작해 쏘기까지(초) – 이 동안 레이저가 보인다 */
export const SNIPER_CHARGE = 3.0;

export type EnemyState = 'move' | 'hide' | 'peek' | 'chase' | 'aim' | 'dead' | 'gone';

export interface PlayerTarget {
  /** 머리(눈) 위치 */
  head: THREE.Vector3;
  /** 몸통 중심 */
  chest: THREE.Vector3;
  /** 발 위치 */
  feet: THREE.Vector3;
  /** 몸통이 난간 위로 드러나 있는가(서 있음) */
  chestExposed: boolean;
  moving: boolean;
}

export interface EnemyShot {
  enemy: Enemy;
  hit: boolean;
  damage: number;
  from: THREE.Vector3;
  /** 빗나간 탄이 지나간 지점(궤적 표시용) */
  to: THREE.Vector3;
}


export class Enemy {
  readonly kind: EnemyKind;
  readonly spec: EnemySpec;
  readonly rig: HumanRig;
  /** 사실적인 3D 병사(있으면 코드로 만든 몸 대신 보인다) */
  private readonly visual: SoldierVisual | null;
  readonly pos = new THREE.Vector3();
  yaw = Math.PI;
  hp: number;
  state: EnemyState = 'move';
  /** 0 = 서 있음, 1 = 완전히 앉음 */
  crouch = 0;
  private crouchTarget = 0;
  private goal: THREE.Vector3 | null = null;
  /** 지상 경로(경유점) */
  private route: THREE.Vector3[] = [];
  private stuckT = 0;
  private replanT = 0;
  /** 돌격병: 플레이어가 보여 겨누는 중 */
  private aiming = false;
  private lastPos = new THREE.Vector3();
  cover: CoverPoint | null = null;
  private timer = 0;
  private shotsLeft = 0;
  private fireT = 0;
  private aimT = 0;
  private cycles = 0;
  /** 내밀었는데 플레이어가 안 보인 횟수 */
  private blindPeeks = 0;
  private sawPlayer = false;
  /** 저격수 조준 진행(0~1) – 레이저·반짝임 표시용 */
  charge = 0;
  private animT = Math.random() * 10;
  private swing = 0;
  private fall = 0;
  private fallDir = new THREE.Vector3();
  deadT = 0;
  flashT = 0;
  readonly muzzle = new THREE.Vector3();
  /** 이번에 쓰러진 원인이 머리였는가 */
  headshot = false;

  constructor(kind: EnemyKind, mats: HumanMaterials) {
    this.kind = kind;
    this.spec = SPECS[kind];
    this.hp = this.spec.hp;
    this.rig = buildHuman(this.spec.outfit, mats);
    if (kind === 'heavy') this.rig.root.scale.setScalar(1.12);
    this.rig.alertLight.visible = false;
    this.visual = createSoldier(kind);
    if (this.visual) {
      this.rig.body.visible = false;
      this.rig.root.add(this.visual.root);
    }
  }

  get alive(): boolean {
    return this.state !== 'dead' && this.state !== 'gone';
  }

  /** 머리 중심(월드) */
  headPos(out = new THREE.Vector3()): THREE.Vector3 {
    const s = this.rig.root.scale.y;
    return out.set(this.pos.x, this.pos.y + (1.66 - this.crouch * 0.55) * s, this.pos.z);
  }

  /** 지점으로 출발(길찾기 격자가 있으면 장애물을 돌아간다) */
  moveTo(goal: THREE.Vector3, nav?: { path(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] }): void {
    this.goal = goal.clone();
    this.route = nav ? nav.path(this.pos, goal) : [goal.clone()];
    this.state = 'move';
    this.stuckT = 0;
  }

  spawnAt(p: THREE.Vector3): void {
    this.pos.copy(p);
    this.sync(0);
  }

  /**
   * @returns 이번 스텝에 쏜 탄(있으면)
   */
  update(dt: number, map: ArenaMap, player: PlayerTarget, accMul: number, freeCover: (e: Enemy) => CoverPoint | null): EnemyShot | null {
    this.animT += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    if (this.state === 'dead') {
      this.deadT += dt;
      this.fall = Math.min(1, this.fall + dt * 2.4);
      this.sync(dt);
      return null;
    }
    if (this.state === 'gone') return null;
    let shot: EnemyShot | null = null;
    this.fireT -= dt;
    switch (this.state) {
      case 'move': {
        const g = this.goal;
        if (!g) break;
        const next = this.route[0] ?? g;
        let arrived = false;
        if (this.walk(next, dt, map.boxes)) {
          this.route.shift();
          arrived = this.route.length === 0;
        }
        this.settle(map, dt);
        // 이동하면서도 가끔 쏜다(압박): 플레이어가 보이면 정확도 절반으로 한 발
        if ((this.kind === 'rifle' || this.kind === 'heavy') && this.fireT <= 0) {
          this.fireT = this.spec.interval * (0.8 + Math.random() * 0.6);
          if (clearLine(map.boxes, this.eye(), player.head)) shot = this.shoot(player, map.boxes, accMul * 0.5);
        }
        // 막혀서 못 움직이면 경로를 다시 찾는다
        if (this.pos.distanceToSquared(this.lastPos) < 0.0004) {
          this.stuckT += dt;
          if (this.stuckT > 0.8) {
            this.route = map.nav.path(this.pos, g);
            this.stuckT = 0;
          }
        } else this.stuckT = 0;
        this.lastPos.copy(this.pos);
        if (arrived) {
          if (this.kind === 'rusher') this.chase();
          else if (this.cover) {
            this.state = 'hide';
            this.timer = 1 + Math.random() * 1.5;
          } else {
            this.state = 'peek';
            this.timer = 3;
          }
        }
        break;
      }
      case 'hide': {
        this.idle(dt);
        this.face(player.head, dt);
        this.crouchTarget = this.cover?.low ? 1 : 0;
        if (this.cover && !this.cover.low) this.offsetFromCover(0, dt);
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'peek';
          this.timer = 2.4 + Math.random();
          this.shotsLeft = this.spec.burst;
          this.aimT = 0;
        }
        break;
      }
      case 'peek': {
        this.idle(dt);
        this.face(player.head, dt);
        this.crouchTarget = 0;
        if (this.cover && !this.cover.low) this.offsetFromCover(1.3 * this.cover.side, dt);
        this.aimT += dt;
        if (!this.sawPlayer && this.aimT > 0.3 && clearLine(map.boxes, this.eye(), player.head)) this.sawPlayer = true;
        if (this.aimT > 0.5 && this.fireT <= 0 && this.shotsLeft > 0) {
          shot = this.shoot(player, map.boxes, accMul);
          this.shotsLeft--;
          this.fireT = this.shotsLeft > 0 ? 0.16 : this.spec.interval;
        }
        this.timer -= dt;
        // 연발 도중이 아닐 때만 숨거나 이동한다
        if (this.timer <= 0 && (this.shotsLeft === 0 || this.shotsLeft === this.spec.burst)) {
          this.cycles++;
          if (!this.sawPlayer) this.blindPeeks++;
          this.sawPlayer = false;
          // 몇 번 쏜 뒤엔(또는 여기서 플레이어가 안 보이면) 다른 엄폐물로 전진
          const relocate = this.blindPeeks >= 2 || (this.cycles >= 2 && Math.random() < 0.6);
          const next = relocate ? freeCover(this) : null;
          if (next) this.blindPeeks = 0;
          if (next) {
            if (this.cover) this.cover.taken = false;
            this.cover = next;
            next.taken = true;
            this.cycles = 0;
            this.moveTo(next.pos, map.nav);
          } else {
            this.state = this.cover ? 'hide' : 'peek';
            this.timer = 1.4 + Math.random() * 1.8;
          }
        }
        break;
      }
      case 'chase': {
        // 돌격병: 플레이어가 있는 곳(밖 · 몇 층이든)까지 계단을 타고 쫓아가 근거리 사격
        const d = this.pos.distanceTo(player.feet);
        const sameLevel = Math.abs(player.feet.y - this.pos.y) < 1.2;
        const see = d < 45 && clearLine(map.boxes, this.eye(), player.head);
        // 계단을 오르내리는 도중에는 경로를 바꾸지 않는다(층 바닥에 있을 때만 다시 계산)
        const onFloor = !insideBuilding(this.pos) || Math.abs(this.pos.y - FLOOR_Y[floorIndex(this.pos.y)]) < 0.08;
        this.replanT -= dt;
        if (onFloor && (this.replanT <= 0 || !this.route.length)) {
          this.route = map.plan(this.pos, player.feet);
          this.replanT = 0.9;
        }
        if (see && sameLevel && d < 3.2) this.idle(dt);
        else {
          const next = this.route[0];
          if (next) {
            // 건물 안에서는 조금 천천히(좁은 곳에서 부딪히지 않게)
            if (this.walk(next, dt, map.boxes, insideBuilding(this.pos) ? 0.7 : 1)) this.route.shift();
          } else this.idle(dt);
          if (this.pos.distanceToSquared(this.lastPos) < 0.0004 && next) {
            this.stuckT += dt;
            if (this.stuckT > 0.8) {
              this.route = [];
              this.replanT = 0;
              this.stuckT = 0;
            }
          } else this.stuckT = 0;
          this.lastPos.copy(this.pos);
        }
        this.settle(map, dt);
        this.aiming = see && d < 32;
        if (this.aiming) {
          this.face(player.head, dt);
          this.aimT += dt;
          if (this.aimT > 0.45 && this.fireT <= 0) {
            shot = this.shoot(player, map.boxes, accMul * (d < 12 ? 1.4 : 1));
            this.fireT = this.spec.interval;
          }
        } else this.aimT = 0;
        break;
      }
      case 'aim': {
        // 저격수: 레이저로 겨누다 일정 시간 뒤 강한 한 발
        this.idle(dt);
        this.face(player.head, dt);
        this.crouchTarget = 0.3;
        if (this.fireT <= 0) {
          this.charge = Math.min(1, this.charge + dt / SNIPER_CHARGE);
          if (this.charge >= 1) {
            shot = this.shoot(player, map.boxes, 1);
            this.charge = 0;
            this.fireT = this.spec.interval;
          }
        }
        break;
      }
    }
    this.crouch += (this.crouchTarget - this.crouch) * Math.min(1, dt * 8);
    this.sync(dt);
    return shot;
  }

  /** 돌격병 추격 시작 */
  chase(): void {
    this.state = 'chase';
    this.route = [];
    this.replanT = 0;
    this.aimT = 0;
  }

  /** 발밑 높이 맞추기(계단을 오르면 바로 올라서고, 떨어지면 빠르게 내려온다) */
  private settle(map: ArenaMap, dt: number): void {
    const f = map.floorAt(this.pos.x, this.pos.z, this.pos.y);
    this.pos.y = f < this.pos.y ? Math.max(f, this.pos.y - 12 * dt) : f;
  }

  private walk(goal: THREE.Vector3, dt: number, boxes: Box[], speedMul = 1): boolean {
    const dx = goal.x - this.pos.x, dz = goal.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const step = this.spec.speed * speedMul * dt;
    if (d <= step + 0.02) {
      this.pos.x = goal.x;
      this.pos.z = goal.z;
      return true;
    }
    const nx = this.pos.x + (dx / d) * step, nz = this.pos.z + (dz / d) * step;
    // 장애물에 막히면 막히지 않은 축으로 미끄러진다
    if (!this.blocked(nx, nz, boxes)) {
      this.pos.x = nx;
      this.pos.z = nz;
    } else if (!this.blocked(nx, this.pos.z, boxes)) this.pos.x = nx;
    else if (!this.blocked(this.pos.x, nz, boxes)) this.pos.z = nz;
    else this.pos.x += Math.sign(dx || 1) * step; // 모서리에 끼면 옆으로
    const want = Math.atan2(dx, dz);
    let dy = want - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * Math.min(1, dt * 10);
    this.animT += dt * (2 + this.spec.speed * speedMul * 1.4);
    this.swing += (0.9 - this.swing) * Math.min(1, dt * 6);
    this.crouchTarget = 0;
    return false;
  }

  private blocked(x: number, z: number, boxes: Box[]): boolean {
    const r = 0.35, p = this.pos;
    for (const b of boxes) {
      if (b.min.y > p.y + 1.2 || b.max.y < p.y + 0.35) continue;
      if (x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z) {
        // 이미 겹쳐 있던 상자는 무시(끼었을 때 빠져나오게)
        if (p.x + r > b.min.x && p.x - r < b.max.x && p.z + r > b.min.z && p.z - r < b.max.z) continue;
        return true;
      }
    }
    return false;
  }

  private idle(dt: number): void {
    this.swing += (0 - this.swing) * Math.min(1, dt * 6);
  }

  private face(p: THREE.Vector3, dt: number): void {
    const want = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    let dy = want - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * Math.min(1, dt * 6);
  }

  /** 높은 엄폐물: 옆으로 몸을 내밀었다 숨는다 */
  private offsetFromCover(off: number, dt: number): void {
    if (!this.cover) return;
    const tx = this.cover.pos.x + off;
    this.pos.x += (tx - this.pos.x) * Math.min(1, dt * 5);
  }

  /** 눈 위치 – 몸이 엄폐물 밖으로 나와야 쏠 수 있도록 총구 대신 눈으로 시야를 판단한다 */
  eye(): THREE.Vector3 {
    const h = this.headPos();
    return h.add(new THREE.Vector3(Math.sin(this.yaw) * 0.15, -0.05, Math.cos(this.yaw) * 0.15));
  }

  private shoot(player: PlayerTarget, boxes: Box[], accMul: number): EnemyShot {
    this.flashT = 0.07;
    const from = this.eye();
    // 머리·몸통 중 보이는 곳을 노린다
    const headVis = clearLine(boxes, from, player.head);
    const chestVis = player.chestExposed && clearLine(boxes, from, player.chest);
    const d = from.distanceTo(player.head);
    let p = 0;
    if (headVis || chestVis) {
      const exposure = chestVis ? 1 : 0.45;
      p = this.spec.accuracy * exposure * Math.max(0.5, Math.min(1.2, 1.3 - d / 120)) * (player.moving ? 0.75 : 1) * accMul;
      if (this.kind === 'sniper') p = headVis || chestVis ? 0.92 : 0;
    }
    const hit = Math.random() < p;
    const aim = chestVis ? player.chest : player.head;
    const to = aim.clone();
    if (!hit) {
      // 빗나간 탄: 플레이어 근처를 스쳐 지나가게
      const off = new THREE.Vector3((Math.random() - 0.5) * 2.4, (Math.random() - 0.2) * 1.4, (Math.random() - 0.5) * 2.4);
      to.add(off);
      to.addScaledVector(to.clone().sub(from).normalize(), 6);
    }
    return { enemy: this, hit, damage: hit ? this.spec.damage * (0.85 + Math.random() * 0.3) : 0, from: this.muzzle.clone(), to };
  }

  /** 피해. 쓰러지면 true */
  damage(amount: number, dir: THREE.Vector3, head: boolean): boolean {
    if (!this.alive) return false;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.state = 'dead';
      this.headshot = head;
      this.fall = 0;
      this.fallDir.copy(dir).setY(0).normalize();
      if (this.cover) this.cover.taken = false;
      this.charge = 0;
      return true;
    }
    // 맞으면 잠깐 움찔하고 엄폐물로
    if (this.state === 'peek' && this.cover) {
      this.state = 'hide';
      this.timer = 1.2;
    }
    return false;
  }

  sync(dt: number): void {
    const r = this.rig;
    r.root.position.copy(this.pos);
    r.root.rotation.y = this.yaw;
    if (this.state === 'dead') {
      // 탄이 온 방향으로 뒤로 넘어지며 미끄러진다
      const e = 1 - Math.pow(1 - this.fall, 3);
      r.body.rotation.x = -e * (Math.PI / 2 - 0.08);
      r.body.position.y = -e * 0.1 - this.crouch * 0.45 * (1 - e);
      const slide = Math.min(1, this.fall * 3) * 0.6 * dt * 6;
      this.pos.addScaledVector(this.fallDir, slide * (1 - this.fall));
      r.armL.rotation.x = -e * 2.6;
      r.armR.rotation.x = -e * 2.2;
      r.legL.rotation.x = e * 0.3;
      r.legR.rotation.x = -e * 0.2;
      if (r.gun) r.gun.visible = this.fall < 0.3;
      if (this.visual) {
        this.visual.pivot.rotation.x = -e * (Math.PI / 2 - 0.08);
        this.visual.update(dt, { moving: false, aiming: true, speed: 0, crouch: this.crouch * (1 - e), fall: Math.max(0.001, this.fall) });
      }
      return;
    }
    const c = this.crouch;
    r.body.rotation.x = 0;
    r.body.position.y = -c * 0.45;
    const s = Math.sin(this.animT * 2) * this.swing;
    const aiming = this.state === 'peek' || this.state === 'aim' || this.state === 'hide' || (this.state === 'chase' && this.aiming);
    if (this.visual) {
      this.visual.pivot.rotation.x = 0;
      this.visual.update(dt, { moving: this.swing > 0.35, aiming: aiming || (this.state === 'move' && this.flashT > 0), speed: this.spec.speed, crouch: c, fall: 0 });
    }
    r.legL.rotation.x = s - c * 1.4;
    r.legR.rotation.x = -s - c * 0.4;
    if (aiming && r.gun) {
      // 소총을 어깨에 대고 겨눈다
      r.armR.rotation.x = -1.35;
      r.armL.rotation.x = -1.45;
      r.armL.rotation.z = -0.35;
      r.gun.rotation.set(0, 0, 0);
      r.gun.position.set(0.1, 1.4, 0.32);
    } else {
      r.armL.rotation.set(-s * 0.8, 0, 0);
      r.armR.rotation.x = s * 0.8;
      if (r.gun) {
        r.gun.rotation.set(0, Math.PI / 2, 0.6, 'ZYX');
        r.gun.position.set(0.02, 1.18, 0.2);
      }
    }
    // 총구(월드) – 탄·섬광 시작점
    r.root.updateMatrixWorld(true);
    this.muzzle.set(0.1, 1.4 - c * 0.45, 0.7).applyMatrix4(r.root.matrixWorld);
  }

  dispose(): void {
    this.rig.root.removeFromParent();
  }
}

/** 탄이 적 몸에 맞는지: 머리 구 · 몸통/다리 원기둥 */
export function rayEnemy(e: Enemy, o: THREE.Vector3, d: THREE.Vector3, max: number): { t: number; zone: 'head' | 'body' | 'leg' } | null {
  if (!e.alive || !e.rig.root.visible) return null;
  const s = e.rig.root.scale.y;
  const head = e.headPos();
  let best: { t: number; zone: 'head' | 'body' | 'leg' } | null = null;
  // 머리는 조금 관대하게(1.15배) – 맞혔다고 느낀 탄이 인정되도록
  const th = raySphere(o, d, head, 0.16 * s);
  if (th !== null && th < max) best = { t: th, zone: 'head' };
  const drop = e.crouch * 0.45 * s;
  for (const [r, y0, y1, zone] of [[0.26, 0.82, 1.52, 'body'], [0.2, 0, 0.84, 'leg']] as const) {
    const t = rayCylinder(o, d, e.pos.x, e.pos.z, r * s, e.pos.y + y0 * s - (zone === 'body' ? drop : 0), e.pos.y + y1 * s - drop);
    if (t !== null && t < max && (!best || t < best.t)) best = { t, zone };
  }
  return best;
}

function raySphere(o: THREE.Vector3, d: THREE.Vector3, c: THREE.Vector3, r: number): number | null {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : null;
}

function rayCylinder(o: THREE.Vector3, d: THREE.Vector3, cx: number, cz: number, r: number, y0: number, y1: number): number | null {
  const ox = o.x - cx, oz = o.z - cz;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-9) return null;
  const b = ox * d.x + oz * d.z;
  const c = ox * ox + oz * oz - r * r;
  const disc = b * b - a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / a;
  if (t <= 0) return null;
  const y = o.y + d.y * t;
  return y >= y0 && y <= y1 ? t : null;
}
