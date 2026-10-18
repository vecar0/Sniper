/**
 * 옥상 저격전(아케이드 웨이브 모드) 본체.
 * 루프: 적이 몰려옴 → 난간 뒤에 숨었다 일어나 저격 → 웨이브 정리 → 더 강한 웨이브.
 * 규칙 수치는 TUNING에 모은다. UI는 hud() 스냅샷과 hooks로만 소통한다.
 */
import * as THREE from 'three';
import { AudioEngine } from '../audio/audio';
import { getCqb } from '../config/sidearms';
import { getWeapon } from '../config/weapons';
import { CqbGun } from '../game/cqb';
import { Effects } from '../game/fx';
import { HumanMaterials } from '../game/models/human';
import { ViewModel } from '../game/viewmodel';
import { Enemy, rayEnemy, SPECS, type EnemyKind, type PlayerTarget } from './enemy';
import type { ArenaInput } from './input';
import { groundAt, moveWithCollision } from './building';
import { getModel } from './models';
import { buildMap, clearLine, rayBoxes, ROOF_Y, SKY, SUN_DIR, WORLD, type ArenaMap, type CoverPoint } from './map';

export const TUNING = {
  fov: 70,
  standEye: 1.62,
  crouchEye: 0.92,
  /** 숙인 채 스코프를 열면 이 높이까지 고개를 내민다(머리만 보임) */
  peekEye: 1.32,
  walk: 3.4,
  crouchWalk: 1.7,
  hp: 100,
  regenDelay: 4.5,
  regenRate: 14,
  /** 점프 속도(m/s) · 중력 – 0.66m 뜀: 모래주머니 · 창턱(0.95m)은 올라서고 옥상 난간(1.05m)은 못 넘는다 */
  jump: 5.4,
  gravity: 22,
  sniper: { mag: 5, bolt: 0.75, reload: 2.0, body: 150, head: 999, leg: 90, hipSpreadDeg: 3.5, zooms: [5, 10] as number[] },
  /** 처치 점수 배율 */
  headBonus: 1.5,
  comboWindow: 4,
} as const;

export type Difficulty = 'easy' | 'normal' | 'hard';
const ACC_MUL: Record<Difficulty, number> = { easy: 0.65, normal: 1, hard: 1.35 };

export interface KillInfo {
  kind: EnemyKind;
  name: string;
  head: boolean;
  distance: number;
  score: number;
  combo: number;
  weapon: 'sniper' | 'pistol';
}

export interface ArenaResult {
  score: number;
  wave: number;
  kills: number;
  headshots: number;
  accuracy: number;
  longest: number;
  best: number;
  newBest: boolean;
}

export interface ArenaHooks {
  onKill(k: KillInfo): void;
  onHitMarker(head: boolean, kill: boolean): void;
  onWave(n: number, bonus: number): void;
  onGameOver(r: ArenaResult): void;
  onToast(text: string): void;
}

export interface ArenaHud {
  hp: number;
  hurt: number;
  hurtDirs: number[];
  weapon: 'sniper' | 'pistol';
  weaponName: string;
  inMag: number;
  reserve: number | null;
  reloading: number;
  bolting: boolean;
  scopeT: number;
  zoom: number;
  crouched: boolean;
  exposed: 'hidden' | 'peek' | 'open';
  score: number;
  wave: number;
  enemiesLeft: number;
  combo: number;
  comboT: number;
  /** 저격수 경고: 화면 방향(도) · 조준 진행 */
  snipers: { dir: number; charge: number; onScreen: boolean; x: number; y: number }[];
  /** 적 위치 표시(화면 안) */
  markers: { x: number; y: number; kind: EnemyKind; roof: boolean }[];
  spreadPx: number;
  bulletCam: boolean;
  breakT: number;
  sway: { x: number; y: number };
}

interface Tracer {
  line: THREE.Line;
  life: number;
  max: number;
}

export class ArenaGame {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly vmCamera: THREE.PerspectiveCamera;
  private readonly viewModel: ViewModel;
  readonly input: ArenaInput;
  readonly audio: AudioEngine;
  hooks: ArenaHooks | null = null;
  map: ArenaMap;
  private fx: Effects;
  private readonly mats = new HumanMaterials();
  enemies: Enemy[] = [];
  quality: 'high' | 'medium' | 'low';
  difficulty: Difficulty = 'normal';
  aimAssist = true;
  running = false;
  paused = false;
  over = false;

  // 플레이어
  readonly pos = new THREE.Vector3(0, ROOF_Y, -4.0);
  yaw = 0;
  pitch = -0.04;
  crouched = false;
  private crouchT = 0;
  /** 떨어지는 속도(계단 구멍 · 낮은 턱에서) */
  private vy = 0;
  private grounded = true;
  /** 공중에 뜬 뒤 가장 높았던 발 높이(낙하 피해) */
  private airTop = 0;
  /** 적에게 보이는 정도(0.1초마다 시야선으로 계산) */
  private exposeState: 'hidden' | 'peek' | 'open' = 'hidden';
  private exposeT = 0;
  hp: number = TUNING.hp;
  private hurtT = 99;
  private hurtFlash = 0;
  private hurtDirs: { dir: number; t: number }[] = [];
  private bob = 0;
  private moveAmt = 0;
  private shake = 0;

  // 무기
  weapon: 'sniper' | 'pistol' = 'sniper';
  sniperMag: number = TUNING.sniper.mag;
  private boltT = 0;
  private reloadT = 0;
  private pistol: CqbGun;
  scoped = false;
  scopeT = 0;
  zoomIndex = 0;
  private swapT = 1;
  private recoil = 0;
  private swayT = 0;

  // 진행
  score = 0;
  wave = 0;
  private toSpawn: EnemyKind[] = [];
  private spawnT = 0;
  breakT = 0;
  private combo = 0;
  private comboT = 0;
  stats = { shots: 0, hits: 0, kills: 0, headshots: 0, longest: 0 };
  private timeScale = 1;
  private hitStop = 0;
  // 불릿캠(웨이브 마지막 처치)
  private cam: { from: THREE.Vector3; to: THREE.Vector3; t: number; enemy: Enemy; hold: number } | null = null;
  private tracers: Tracer[] = [];
  private readonly tracerMat = new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.9, depthWrite: false });
  private readonly enemyTracerMat = new THREE.LineBasicMaterial({ color: 0xff8a5a, transparent: true, opacity: 0.8, depthWrite: false });
  private readonly laserMat = new THREE.LineBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.6, depthWrite: false });
  private readonly glintMat: THREE.SpriteMaterial;
  private readonly flashMat: THREE.SpriteMaterial;
  private lasers = new Map<Enemy, { line: THREE.Line; glint: THREE.Sprite }>();
  private flashes = new Map<Enemy, THREE.Sprite>();
  private accumulator = 0;
  private last = 0;
  private menuT = 0;
  private readonly tmpV = new THREE.Vector3();

  constructor(container: HTMLElement, input: ArenaInput, audio: AudioEngine, quality: 'high' | 'medium' | 'low') {
    this.input = input;
    this.audio = audio;
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1));
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(TUNING.fov, 1, 0.08, 1500);
    this.vmCamera = new THREE.PerspectiveCamera(TUNING.fov, 1, 0.01, 10);
    this.scene.fog = new THREE.Fog(0xcfc3b1, 160, 900);
    // 하늘: 실사 사진을 배경으로, 같은 사진으로 주변광(환경맵)도 만든다. 사진을 못 불러오면 그라데이션 하늘
    const skyFallback = buildSky();
    this.scene.add(skyFallback);
    new THREE.TextureLoader().load(SKY.url, (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      this.scene.background = tex;
      this.scene.backgroundRotation.set(0, SKY.yaw, 0);
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pm.fromEquirectangular(tex).texture;
      this.scene.environmentRotation.set(0, SKY.yaw, 0);
      this.scene.environmentIntensity = 0.55;
      pm.dispose();
      skyFallback.removeFromParent();
    });
    this.map = buildMap(quality);
    this.scene.add(this.map.group);
    this.fx = new Effects((x, z) => this.map.floorAt(x, z, this.pos.y + 0.5), 0xb59a72);
    this.scene.add(this.fx.group);
    this.fx.tracers.setScale(this.renderer.getPixelRatio());
    this.viewModel = new ViewModel(this.renderer);
    this.viewModel.compact = input.isTouch;
    this.viewModel.build(getWeapon('k65'), false); // 검은 저격총(컨셉 아트)
    const rifleModel = getModel('rifle');
    if (rifleModel) this.viewModel.replaceRifleVisual(rifleModel.scene.clone());
    const pistolParts = { muzzle: 'none', optic: 'iron', mag: 'ext', under: 'laser' } as const;
    this.pistol = new CqbGun('p9', { ...pistolParts });
    this.viewModel.buildGuns([{ spec: getCqb('p9'), parts: { ...pistolParts } }]);
    // 권총: Poly Haven 실사 권총(진열용 파일에서 한 자루만 – 이름이 _a인 부품) · 총구 +X → -Z
    const pistolModel = getModel('pistol');
    if (pistolModel) {
      const pm = pistolModel.scene.clone();
      pm.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && !/_a$/.test(o.name)) o.visible = false;
      });
      for (const o of [...pm.children]) if (!o.visible) o.removeFromParent();
      const holder = new THREE.Group();
      pm.rotation.y = Math.PI / 2;
      holder.add(pm);
      this.viewModel.replaceGunVisual('p9', holder, 0.28);
    }
    this.viewModel.setActive('rifle');
    this.viewModel.setLighting(0xffd6b0, 0x9fb4c4, 0x5a4a3c, 0.8);
    this.glintMat = new THREE.SpriteMaterial({ map: glowTexture('#ffffff'), color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
    this.flashMat = new THREE.SpriteMaterial({ map: glowTexture('#ffd27a'), color: 0xffd27a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  private sizeW = 0;
  private sizeH = 0;
  resize(): void {
    const el = this.renderer.domElement.parentElement!;
    const w = el.clientWidth || window.innerWidth, h = el.clientHeight || window.innerHeight;
    this.sizeW = w;
    this.sizeH = h;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = this.vmCamera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.vmCamera.updateProjectionMatrix();
  }

  start(): void {
    this.last = performance.now();
    const tick = (now: number) => {
      requestAnimationFrame(tick);
      const el = this.renderer.domElement.parentElement;
      if (el && (el.clientWidth !== this.sizeW || el.clientHeight !== this.sizeH)) this.resize();
      const real = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.frame(real);
    };
    requestAnimationFrame(tick);
  }

  // ─────────── 진행 ───────────
  newGame(): void {
    for (const e of this.enemies) e.dispose();
    this.enemies = [];
    for (const c of this.map.covers) c.taken = false;
    for (const l of this.lasers.values()) l.line.removeFromParent(), l.glint.removeFromParent();
    this.lasers.clear();
    for (const f of this.flashes.values()) f.removeFromParent();
    this.flashes.clear();
    for (const t of this.tracers) t.line.removeFromParent();
    this.tracers = [];
    this.fx.clear();
    this.pos.set(0, ROOF_Y, -4.0);
    this.vy = 0;
    this.grounded = true;
    this.exposeState = 'hidden';
    this.yaw = 0;
    this.pitch = -0.04;
    this.crouched = false;
    this.crouchT = 0;
    this.hp = TUNING.hp;
    this.hurtT = 99;
    this.hurtFlash = 0;
    this.hurtDirs = [];
    this.weapon = 'sniper';
    this.viewModel.setActive('rifle');
    this.sniperMag = TUNING.sniper.mag;
    this.boltT = this.reloadT = 0;
    this.pistol.reset();
    this.scoped = false;
    this.scopeT = 0;
    this.zoomIndex = 0;
    this.score = 0;
    this.wave = 0;
    this.combo = 0;
    this.comboT = 0;
    this.stats = { shots: 0, hits: 0, kills: 0, headshots: 0, longest: 0 };
    this.cam = null;
    this.timeScale = 1;
    this.over = false;
    this.paused = false;
    this.running = true;
    this.input.enabled = true;
    this.input.releaseAll();
    this.input.requestLock();
    this.nextWave();
  }

  private nextWave(): void {
    this.wave++;
    const n = this.wave;
    const list: EnemyKind[] = [];
    for (let i = 0; i < 3 + n; i++) list.push('rifle');
    for (let i = 0; i < Math.max(0, n - 1); i++) list.push('rusher');
    if (n >= 3) for (let i = 0; i < Math.min(3, 1 + Math.floor((n - 3) / 2)); i++) list.push('sniper');
    if (n >= 4) for (let i = 0; i < Math.floor((n - 2) / 2); i++) list.push('heavy');
    // 섞되 첫 몇 명은 소총병(웨이브 시작이 갑자기 어렵지 않게)
    const head = list.splice(0, 2);
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    this.toSpawn = [...head, ...list];
    this.spawnT = 1.2;
    this.breakT = 0;
  }

  private spawn(kind: EnemyKind): boolean {
    const m = this.map;
    const e = new Enemy(kind, this.mats);
    if (kind === 'sniper') {
      const used = new Set(this.enemies.filter((x) => x.alive && x.kind === 'sniper').map((x) => x.pos.x * 1000 + x.pos.z));
      const free = m.perches.filter((p) => !used.has(p.x * 1000 + p.z));
      if (!free.length) return false;
      const p = free[Math.floor(Math.random() * free.length)];
      e.spawnAt(p);
      e.state = 'aim';
    } else {
      const sp = m.spawns[Math.floor(Math.random() * m.spawns.length)];
      e.spawnAt(sp.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0, 0)));
      if (kind === 'rusher') e.chase();
      else {
        const c = this.pickCover(e, true) ?? this.openSpot();
        e.cover = c;
        c.taken = true;
        e.moveTo(c.pos, m.nav);
      }
    }
    this.scene.add(e.rig.root);
    this.enemies.push(e);
    return true;
  }

  /** 비어 있는 엄폐 지점: 처음엔 먼 곳, 전진할 땐 지금보다 가까운 곳 */
  private pickCover(e: Enemy, first: boolean): CoverPoint | null {
    const free = this.map.covers.filter((c) => !c.taken);
    if (!free.length) return this.openSpot();
    const curZ = e.cover ? e.cover.pos.z : -200;
    const cand = first ? free.filter((c) => c.pos.z < -45) : free.filter((c) => c.pos.z > curZ + 6 && c.pos.z < -24);
    // 더 가까운 곳이 없으면 아무 빈 엄폐물(교착 방지)
    const pool = cand.length ? cand : free.filter((c) => c !== e.cover);
    if (!pool.length) return this.openSpot();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** 엄폐물이 모자랄 때: 옥상이 보이는 빈 땅(교착 방지 – 숨지 못하니 위험하지만 공격적) */
  private openSpot(): CoverPoint {
    const roof = this.pos.clone().setY(this.pos.y + 1.4);
    for (let i = 0; i < 40; i++) {
      const p = new THREE.Vector3((Math.random() - 0.5) * 70, 0, -28 - Math.random() * 70);
      if (!this.map.nav.free(p.x, p.z)) continue;
      if (clearLine(this.map.boxes, new THREE.Vector3(p.x, 1.6, p.z), roof)) return { pos: p, low: true, side: 0, taken: false };
    }
    return { pos: new THREE.Vector3((Math.random() - 0.5) * 30, 0, -40), low: true, side: 0, taken: false };
  }

  // ─────────── 루프 ───────────
  private frame(real: number): void {
    if (this.running && !this.paused && !this.over) {
      this.handleLook(real);
      if (this.hitStop > 0) this.hitStop -= real;
      else {
        const dt = real * this.timeScale;
        this.accumulator += dt;
        let steps = 0;
        while (this.accumulator >= 1 / 120 && steps < 12) {
          this.update(1 / 120);
          this.accumulator -= 1 / 120;
          steps++;
        }
      }
      this.updateBulletCam(real);
    } else if (!this.running) {
      this.menuT += real;
    }
    this.updateCamera(real);
    this.updateEffects(real);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (this.running && this.scopeT < 0.85 && !this.cam) {
      this.renderer.clearDepth();
      this.renderer.render(this.viewModel.scene, this.vmCamera);
    }
  }

  setPaused(p: boolean): void {
    if (!this.running || this.over) return;
    this.paused = p;
    this.input.enabled = !p;
    this.input.releaseAll();
    if (p) this.input.exitLock();
    else {
      this.input.requestLock();
      this.last = performance.now();
    }
  }

  /** 현재 화면 시야각 */
  private fovNow(): number {
    const z = this.weapon === 'sniper' ? TUNING.sniper.zooms[this.zoomIndex] : this.pistol.stats.adsZoom;
    const k = this.weapon === 'sniper' ? this.scopeT : this.pistol.ads;
    return TUNING.fov / (1 + (z - 1) * k);
  }

  private handleLook(_real: number): void {
    const l = this.input.takeLook();
    if (this.cam) return;
    const fovK = this.fovNow() / TUNING.fov;
    let sens = (this.input.isTouch ? 0.0021 : 0.0022) * fovK;
    // 조준 보조: 십자선이 적 위에 있으면 감도가 낮아진다(지나치지 않게)
    if (this.aimAssist && this.enemyNearCrosshair(2.2)) sens *= 0.45;
    this.yaw -= l.x * sens;
    this.pitch = Math.max(-1.1, Math.min(0.9, this.pitch - l.y * sens));
  }

  /** 십자선과 가장 가까운 적(각도, 도) */
  private nearestEnemyAngle(): { e: Enemy; ang: number; point: THREE.Vector3 } | null {
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const eye = this.camera.position;
    let best: { e: Enemy; ang: number; point: THREE.Vector3 } | null = null;
    for (const e of this.enemies) {
      if (!e.alive || !e.rig.root.visible) continue;
      const p = e.headPos().add(new THREE.Vector3(0, -0.45, 0));
      const d = p.clone().sub(eye);
      const ang = (d.angleTo(f) * 180) / Math.PI;
      if (!best || ang < best.ang) best = { e, ang, point: p };
    }
    return best;
  }

  private enemyNearCrosshair(deg: number): boolean {
    const n = this.nearestEnemyAngle();
    return !!n && n.ang < deg * (this.scopeT > 0.5 ? 0.6 : 1);
  }

  private update(dt: number): void {
    const inp = this.input;
    // ── 무기 교체 ──
    if (inp.consume('swap') && this.swapT >= 1) this.swapWeapon();
    this.swapT = Math.min(1, this.swapT + dt / 0.4);
    // ── 숙이기 ──
    if (inp.consume('crouch')) {
      this.crouched = !this.crouched;
      this.audio.play('uiClick', { volume: 0.4 });
    }
    // ── 스코프(PC: 오른쪽 누르고 있기 / 휴대폰: 버튼 켜기·끄기) ──
    if (inp.consume('scope')) this.scoped = !this.scoped;
    const wantScope = (this.scoped || inp.scopeHeld) && this.swapT >= 1 && this.reloadT <= 0 && !(this.weapon === 'sniper' && this.boltT > 0.25);
    if (this.weapon === 'sniper') {
      const before = this.scopeT;
      this.scopeT = Math.max(0, Math.min(1, this.scopeT + (wantScope ? dt : -dt) / 0.14));
      if (before < 0.5 && this.scopeT >= 0.5) this.onScopeIn();
      if (inp.consume('zoom') || inp.zoomSteps !== 0) {
        this.zoomIndex = (this.zoomIndex + 1) % TUNING.sniper.zooms.length;
        this.audio.play('zoom');
      }
    } else {
      this.scopeT = Math.max(0, this.scopeT - dt / 0.14);
      inp.consume('zoom');
    }
    inp.zoomSteps = 0;
    const ex = this.crouchT; // 숙인 정도
    this.crouchT += ((this.crouched ? 1 : 0) - this.crouchT) * Math.min(1, dt * 10);
    void ex;
    // ── 이동(옥상 · 건물 안 · 밖 어디든 – 벽에 막히고 계단으로 오르내림) ──
    const scopedNow = this.scopeT > 0.5 || this.pistol.ads > 0.5;
    const speed = (this.crouched ? TUNING.crouchWalk : TUNING.walk) * (scopedNow ? 0.45 : 1);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let mx = fx * inp.moveY + rx * inp.moveX;
    let mz = fz * inp.moveY + rz * inp.moveX;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    // 점프: 땅에 있을 때만(숙인 상태면 일어나며 뛴다)
    if (inp.consume('jump') && this.grounded) {
      this.vy = TUNING.jump;
      this.grounded = false;
      this.airTop = this.pos.y;
      this.crouched = false;
    }
    moveWithCollision(this.map.boxes, this.pos, mx * speed * dt, mz * speed * dt, 0.3);
    this.pos.x = Math.max(WORLD.minX, Math.min(WORLD.maxX, this.pos.x));
    this.pos.z = Math.max(WORLD.minZ, Math.min(WORLD.maxZ, this.pos.z));
    // 발밑: 계단 · 낮은 상자는 바로 올라서고, 바닥이 없으면 떨어진다
    const floor = groundAt(this.map.boxes, this.map.surfaces, this.pos.x, this.pos.z, this.pos.y);
    if (this.vy <= 0 && floor >= this.pos.y - 0.02) {
      this.pos.y = floor;
      this.vy = 0;
      this.grounded = true;
    } else {
      if (this.grounded) this.airTop = this.pos.y;
      this.grounded = false;
      this.vy -= TUNING.gravity * dt;
      this.pos.y += this.vy * dt;
      this.airTop = Math.max(this.airTop, this.pos.y);
      if (this.pos.y <= floor) {
        // 착지: 4.5m 넘게 떨어지면 다친다
        const drop = this.airTop - floor;
        this.pos.y = floor;
        this.vy = 0;
        this.grounded = true;
        if (drop > 4.5) this.fallDamage((drop - 4.5) * 15);
        else if (drop > 0.4) this.shake = Math.min(1, this.shake + 0.15);
      }
    }
    const moving = len > 0.1;
    this.moveAmt += ((moving ? 1 : 0) - this.moveAmt) * Math.min(1, dt * 8);
    this.bob += dt * (this.crouched ? 6 : 9) * this.moveAmt;
    // ── 사격 ──
    this.updateWeapons(dt, moving);
    // ── 적 ──
    const target = this.playerTarget(moving);
    this.exposeT -= dt;
    if (this.exposeT <= 0) {
      this.exposeT = 0.1;
      this.exposeState = this.computeExposure(target);
    }
    const acc = ACC_MUL[this.difficulty];
    for (const e of this.enemies) {
      const shot = e.update(dt, this.map, target, acc, (en) => this.pickCover(en, false));
      if (shot) this.onEnemyShot(shot.enemy, shot.hit, shot.damage, shot.from, shot.to);
    }
    // 쓰러진 적 정리
    this.enemies = this.enemies.filter((e) => {
      if (e.state === 'dead' && e.deadT > 9) {
        e.dispose();
        this.removeEnemyFx(e);
        return false;
      }
      return true;
    });
    // ── 웨이브 ──
    const alive = this.enemies.filter((e) => e.alive).length;
    if (this.toSpawn.length) {
      this.spawnT -= dt;
      const maxAlive = 5 + Math.floor(this.wave * 0.7);
      if (this.spawnT <= 0 && alive < maxAlive) {
        const k = this.toSpawn[0];
        if (this.spawn(k)) this.toSpawn.shift();
        else this.toSpawn.push(this.toSpawn.shift()!);
        this.spawnT = Math.max(0.7, 1.8 - this.wave * 0.1);
      }
    } else if (alive === 0 && this.breakT <= 0 && !this.cam) {
      const bonus = 300 * this.wave;
      this.score += bonus;
      this.hp = Math.min(TUNING.hp, this.hp + 35);
      this.pistol.reserve = this.pistol.stats.reserve;
      this.breakT = 4;
      this.audio.play('success', { volume: 0.6 });
      this.hooks?.onWave(this.wave + 1, bonus);
    }
    if (this.breakT > 0) {
      this.breakT -= dt;
      if (this.breakT <= 0) this.nextWave();
    }
    // ── 체력 · 콤보 ──
    this.hurtT += dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.6);
    for (const h of this.hurtDirs) h.t -= dt;
    this.hurtDirs = this.hurtDirs.filter((h) => h.t > 0);
    if (this.hurtT > TUNING.regenDelay) this.hp = Math.min(TUNING.hp, this.hp + TUNING.regenRate * dt);
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    this.shake = Math.max(0, this.shake - dt * 3);
    this.recoil *= Math.exp(-dt * 10);
    this.swayT += dt;
    this.fx.update(dt);
  }

  private swapWeapon(): void {
    this.weapon = this.weapon === 'sniper' ? 'pistol' : 'sniper';
    this.scoped = false;
    this.scopeT = 0;
    this.reloadT = 0;
    this.pistol.holster();
    this.swapT = 0;
    this.viewModel.setActive(this.weapon === 'sniper' ? 'rifle' : 'p9');
    this.audio.play('reload', { weight: 0.3, volume: 0.6 });
  }

  /** 스코프를 여는 순간: 근처 적이 있으면 살짝 끌어준다(휴대폰 조준 보조) */
  private onScopeIn(): void {
    this.audio.play('zoom', { volume: 0.5 });
    if (!this.aimAssist) return;
    const n = this.nearestEnemyAngle();
    if (!n || n.ang > 5) return;
    const d = n.point.clone().sub(this.camera.position);
    const wantYaw = Math.atan2(-d.x, -d.z);
    const wantPitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    let dy = wantYaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const k = this.input.isTouch ? 0.75 : 0.45;
    this.yaw += dy * k;
    this.pitch += (wantPitch - this.pitch) * k;
  }

  private eyeHeight(): number {
    const scoped = this.scopeT > 0.3 || this.pistol.ads > 0.3;
    const crouchEye = scoped ? TUNING.peekEye : TUNING.crouchEye;
    return TUNING.standEye + (crouchEye - TUNING.standEye) * this.crouchT;
  }

  /** 적에게 보이는 정도: 숨음 / 고개만 / 상체까지 – 살아 있는 적이 일어섰을 때의 눈에서 시야선으로 판단 */
  private computeExposure(t: PlayerTarget): 'hidden' | 'peek' | 'open' {
    let head = false;
    const eye = new THREE.Vector3();
    for (const e of this.enemies) {
      if (!e.alive || !e.rig.root.visible) continue;
      eye.set(e.pos.x, e.pos.y + 1.6 * e.rig.root.scale.y, e.pos.z);
      if (eye.distanceToSquared(t.head) > 220 * 220) continue;
      if (clearLine(this.map.boxes, eye, t.chest)) return 'open';
      if (!head && clearLine(this.map.boxes, eye, t.head)) head = true;
    }
    return head ? 'peek' : 'hidden';
  }

  private playerTarget(moving: boolean): PlayerTarget {
    const eye = this.eyeHeight();
    const y = this.pos.y;
    const head = new THREE.Vector3(this.pos.x, y + eye, this.pos.z);
    const chest = new THREE.Vector3(this.pos.x, y + Math.max(0.6, eye - 0.35), this.pos.z);
    // 몸통이 실제로 보이는지는 적마다 시야선으로 따진다
    return { head, chest, feet: this.pos.clone(), chestExposed: true, moving };
  }

  private updateWeapons(dt: number, moving: boolean): void {
    const inp = this.input;
    if (this.weapon === 'sniper') {
      if (this.boltT > 0) {
        this.boltT -= dt;
        if (this.boltT <= 0 && this.sniperMag === 0) this.startReload();
      }
      if (this.reloadT > 0) {
        this.reloadT -= dt;
        if (this.reloadT <= 0) this.sniperMag = TUNING.sniper.mag;
      }
      if (inp.consume('reload')) this.startReload();
      if (inp.fireDown && this.swapT >= 1 && this.boltT <= 0 && this.reloadT <= 0 && this.sniperMag > 0 && !this.fireLatch) {
        this.fireLatch = true;
        this.fireSniper(moving);
      }
      if (!inp.fireDown) this.fireLatch = false;
    } else {
      if (inp.consume('reload') && this.pistol.startReload()) this.audio.play('reload', { weight: 0.8 });
      const wantAds = this.scoped || inp.scopeHeld;
      const before = this.pistol.reloading;
      this.pistol.update(dt, wantAds, this.swapT >= 1);
      if (this.swapT >= 1 && this.pistol.trigger(inp.fireDown)) this.firePistol(moving);
      if (!before && this.pistol.reloading) this.audio.play('reload', { weight: 0.8 });
    }
  }
  private fireLatch = false;

  private startReload(): void {
    if (this.reloadT > 0 || this.sniperMag >= TUNING.sniper.mag) return;
    this.reloadT = TUNING.sniper.reload;
    this.scoped = false;
    this.audio.play('reload', { weight: 1 });
  }

  private aimRay(spreadDeg: number): { o: THREE.Vector3; d: THREE.Vector3 } {
    const cam = this.camera;
    const o = cam.position.clone();
    const a = Math.random() * Math.PI * 2;
    const r = ((spreadDeg * Math.PI) / 180) * Math.sqrt(Math.random());
    const d = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, -1).normalize().applyQuaternion(cam.quaternion);
    return { o, d };
  }

  private fireSniper(moving: boolean): void {
    this.stats.shots++;
    this.sniperMag--;
    // 스코프를 70% 이상 열었으면 정확(퀵스코프 허용), 아니면 허리 사격 퍼짐
    const spread = this.scopeT > 0.7 ? (moving ? 0.25 : 0) : TUNING.sniper.hipSpreadDeg * (moving ? 1.5 : 1);
    const { o, d } = this.aimRay(spread);
    const hit = this.resolveShot(o, d, 'sniper');
    this.audio.play('shot', { weight: 1.1, volume: 0.9 });
    this.viewModel.kick(7, true);
    this.recoil = 0.05;
    this.pitch += 0.018;
    this.boltT = TUNING.sniper.bolt;
    setTimeout(() => this.audio.play('bolt', { weight: 0.8 }), 180);
    this.addTracer(this.muzzlePos(), hit, this.tracerMat, 0.35);
  }

  private firePistol(moving: boolean): void {
    this.stats.shots++;
    const spread = this.pistol.spread(moving, this.crouched);
    const { o, d } = this.aimRay(spread);
    const hit = this.resolveShot(o, d, 'pistol');
    this.audio.play('shot', { weight: 0.35, volume: 0.55, pitch: 1.4 });
    this.viewModel.kick(2, true);
    this.pitch += (this.pistol.stats.recoil * 0.5 * Math.PI) / 180;
    this.yaw += (((Math.random() - 0.5) * this.pistol.stats.recoil * 0.4) * Math.PI) / 180;
    if (Math.random() < 0.5) this.addTracer(this.muzzlePos(), hit, this.tracerMat, 0.12);
  }

  private muzzlePos(): THREE.Vector3 {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(this.camera.quaternion);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const k = this.scopeT > 0.5 ? 0 : 1;
    return this.camera.position.clone().addScaledVector(right, 0.18 * k).addScaledVector(down, 0.12 * k).addScaledVector(fwd, 0.8);
  }

  /** 탄 판정: 가장 가까운 벽 또는 적. 맞은 지점 반환 */
  private resolveShot(o: THREE.Vector3, d: THREE.Vector3, weapon: 'sniper' | 'pistol'): THREE.Vector3 {
    const max = 600;
    const wall = rayBoxes(this.map.boxes, o, d, max);
    let best: { e: Enemy; t: number; zone: 'head' | 'body' | 'leg' } | null = null;
    for (const e of this.enemies) {
      const h = rayEnemy(e, o, d, max);
      if (h && (!best || h.t < best.t)) best = { e, ...h };
    }
    // 바닥(땅·옥상)
    const groundT = d.y < 0 ? (o.y - 0) / -d.y : null;
    const wallT = Math.min(wall ?? Infinity, groundT ?? Infinity);
    if (best && best.t < wallT) {
      const e = best.e;
      const point = o.clone().addScaledVector(d, best.t);
      const head = best.zone === 'head';
      let dmg: number;
      if (weapon === 'sniper') dmg = head ? TUNING.sniper.head : best.zone === 'leg' ? TUNING.sniper.leg : TUNING.sniper.body;
      else dmg = this.pistol.stats.damage * (head ? this.pistol.stats.headMul : best.zone === 'leg' ? 0.75 : 1);
      const dist = o.distanceTo(point);
      const lastOfWave = this.toSpawn.length === 0 && this.enemies.filter((x) => x.alive).length === 1;
      const killed = e.damage(dmg, d, head);
      this.stats.hits++;
      this.fx.personDown(point, e.pos, d, Math.min(200, dist));
      if (killed) {
        this.onKill(e, head, dist, weapon);
        // 웨이브 마지막 처치는 불릿캠(저격총·먼 거리)
        if (lastOfWave && weapon === 'sniper' && dist > 25) {
          this.cam = { from: this.muzzlePos(), to: point.clone(), t: 0, enemy: e, hold: 0 };
          this.timeScale = 0.15;
        }
      } else {
        this.audio.play('botHit', { volume: 0.7 });
        this.hooks?.onHitMarker(head, false);
      }
      return point;
    }
    const t = Number.isFinite(wallT) ? wallT : 300;
    const p = o.clone().addScaledVector(d, t);
    if (Number.isFinite(wallT)) {
      if (wall !== null && wall === wallT) this.fx.impactSteel(p, Math.min(150, t));
      else this.fx.impactGround(p, Math.min(150, t));
    }
    return p;
  }

  private onKill(e: Enemy, head: boolean, dist: number, weapon: 'sniper' | 'pistol'): void {
    this.stats.kills++;
    if (head) this.stats.headshots++;
    this.stats.longest = Math.max(this.stats.longest, dist);
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = TUNING.comboWindow;
    let pts = SPECS[e.kind].score;
    if (head) pts *= TUNING.headBonus;
    if (dist > 50) pts += Math.round((dist - 50) * 2);
    pts = Math.round(pts * (1 + (this.combo - 1) * 0.25));
    this.score += pts;
    this.hitStop = head ? 0.09 : 0.045;
    this.audio.play(head ? 'headshot' : 'botHit', { volume: 0.9 });
    if (head) this.audio.play('impactSteel', { volume: 0.25, pitch: 1.6 });
    this.hooks?.onHitMarker(head, true);
    this.hooks?.onKill({ kind: e.kind, name: SPECS[e.kind].name, head, distance: dist, score: pts, combo: this.combo, weapon });
    this.removeEnemyFx(e);
  }

  private onEnemyShot(e: Enemy, hit: boolean, damage: number, from: THREE.Vector3, to: THREE.Vector3): void {
    const d = from.distanceTo(this.camera.position);
    this.audio.play('shot', { weight: e.kind === 'sniper' ? 1 : 0.4, volume: Math.max(0.12, 0.6 - d / 200), pitch: e.kind === 'sniper' ? 0.9 : 1.2 });
    this.addTracer(from, to, this.enemyTracerMat, e.kind === 'sniper' ? 0.3 : 0.1);
    if (!hit) return;
    this.hp -= damage;
    this.hurtT = 0;
    this.hurtFlash = Math.min(1, this.hurtFlash + (e.kind === 'sniper' ? 1 : 0.5));
    this.shake = Math.min(1, this.shake + (e.kind === 'sniper' ? 0.8 : 0.25));
    const ang = Math.atan2(-(from.x - this.pos.x), -(from.z - this.pos.z));
    let rel = ang - this.yaw;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    this.hurtDirs.push({ dir: (-rel * 180) / Math.PI, t: 1.2 });
    this.audio.play('botHit', { volume: 0.5, pitch: 0.6 });
    if (this.hp <= 0) this.gameOver();
  }

  private fallDamage(dmg: number): void {
    this.hp -= dmg;
    this.hurtT = 0;
    this.hurtFlash = Math.min(1, this.hurtFlash + 0.6);
    this.shake = Math.min(1, this.shake + 0.6);
    this.audio.play('impactGround', { volume: 0.7 });
    if (this.hp <= 0) this.gameOver();
  }

  private gameOver(): void {
    if (this.over) return;
    this.over = true;
    this.hp = 0;
    this.input.enabled = false;
    this.input.releaseAll();
    this.input.exitLock();
    this.audio.play('fail');
    let best = 0;
    try {
      best = Number(localStorage.getItem('longshot.arena.best') ?? 0) || 0;
    } catch {
      /* 저장소 불가 */
    }
    const newBest = this.score > best;
    if (newBest) {
      best = this.score;
      try {
        localStorage.setItem('longshot.arena.best', String(best));
      } catch {
        /* 저장소 불가 */
      }
    }
    this.hooks?.onGameOver({
      score: this.score,
      wave: this.wave,
      kills: this.stats.kills,
      headshots: this.stats.headshots,
      accuracy: this.stats.shots ? this.stats.hits / this.stats.shots : 0,
      longest: this.stats.longest,
      best,
      newBest,
    });
  }

  quit(): void {
    this.running = false;
    this.over = false;
    this.paused = false;
    this.input.enabled = false;
    this.input.releaseAll();
    this.input.exitLock();
    for (const e of this.enemies) e.dispose();
    this.enemies = [];
    for (const l of this.lasers.values()) l.line.removeFromParent(), l.glint.removeFromParent();
    this.lasers.clear();
  }

  // ─────────── 연출 ───────────
  private addTracer(a: THREE.Vector3, b: THREE.Vector3, mat: THREE.LineBasicMaterial, life: number): void {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(g, mat.clone());
    line.frustumCulled = false;
    this.scene.add(line);
    this.tracers.push({ line, life, max: life });
  }

  private removeEnemyFx(e: Enemy): void {
    const l = this.lasers.get(e);
    if (l) {
      l.line.removeFromParent();
      l.glint.removeFromParent();
      l.line.geometry.dispose();
      this.lasers.delete(e);
    }
    const f = this.flashes.get(e);
    if (f) {
      f.removeFromParent();
      this.flashes.delete(e);
    }
  }

  private updateEffects(real: number): void {
    for (const t of this.tracers) {
      t.life -= real;
      (t.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, t.life / t.max) * 0.9;
    }
    this.tracers = this.tracers.filter((t) => {
      if (t.life > 0) return true;
      t.line.removeFromParent();
      t.line.geometry.dispose();
      (t.line.material as THREE.Material).dispose();
      return false;
    });
    // 저격수 레이저 · 반짝임, 총구 섬광
    const head = this.camera.position;
    for (const e of this.enemies) {
      if (e.kind === 'sniper' && e.alive) {
        let l = this.lasers.get(e);
        if (!l) {
          const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([e.muzzle, head]), this.laserMat.clone());
          line.frustumCulled = false;
          const glint = new THREE.Sprite(this.glintMat);
          this.scene.add(line, glint);
          l = { line, glint };
          this.lasers.set(e, l);
        }
        const pos = l.line.geometry.getAttribute('position') as THREE.BufferAttribute;
        pos.setXYZ(0, e.muzzle.x, e.muzzle.y, e.muzzle.z);
        const aimAt = this.tmpV.copy(head).add(new THREE.Vector3(0, -0.2, 0)).lerp(e.muzzle, 0.02);
        pos.setXYZ(1, aimAt.x, aimAt.y, aimAt.z);
        pos.needsUpdate = true;
        (l.line.material as THREE.LineBasicMaterial).opacity = 0.15 + e.charge * 0.7;
        l.line.visible = e.charge > 0.02;
        const pulse = 1 + Math.sin(this.menuT * 20 + e.charge * 30) * 0.3;
        l.glint.position.copy(e.headPos()).add(new THREE.Vector3(0, -0.05, 0.3));
        const dist = l.glint.position.distanceTo(head);
        l.glint.scale.setScalar((0.6 + e.charge * 1.6) * pulse * Math.max(1, dist / 40));
      }
      let f = this.flashes.get(e);
      if (e.flashT > 0) {
        if (!f) {
          f = new THREE.Sprite(this.flashMat);
          this.scene.add(f);
          this.flashes.set(e, f);
        }
        f.visible = true;
        f.position.copy(e.muzzle);
        f.scale.setScalar(0.9 + Math.random() * 0.4);
      } else if (f) f.visible = false;
    }
    this.menuT += real;
  }

  private updateBulletCam(real: number): void {
    const c = this.cam;
    if (!c) return;
    if (c.t < 1) {
      c.t = Math.min(1, c.t + real / 0.9);
      if (c.t >= 1) this.timeScale = 0.35;
    } else {
      c.hold += real;
      if (c.hold > 1.3) {
        this.cam = null;
        this.timeScale = 1;
      }
    }
  }

  private updateCamera(real: number): void {
    const cam = this.camera;
    if (!this.running) {
      // 메뉴: 옥상에서 기지를 천천히 둘러본다
      const t = this.menuT * 0.05;
      cam.position.set(Math.sin(t) * 3, ROOF_Y + 1.7, 0);
      cam.fov = 55;
      cam.lookAt(Math.sin(t * 0.7) * 30, 2, -70);
      cam.updateProjectionMatrix();
      return;
    }
    if (this.cam) {
      const c = this.cam;
      const e = 1 - Math.pow(1 - c.t, 2);
      const p = c.from.clone().lerp(c.to, e);
      const dir = c.to.clone().sub(c.from).normalize();
      const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      if (c.t < 1) {
        cam.position.copy(p).addScaledVector(dir, -1.2).addScaledVector(side, 0.35).add(new THREE.Vector3(0, 0.15, 0));
        cam.lookAt(p.clone().addScaledVector(dir, 4));
      } else {
        const ang = c.hold * 0.9;
        cam.position.copy(c.to).addScaledVector(dir, -3.2).addScaledVector(side, 1.4 + Math.sin(ang)).add(new THREE.Vector3(0, 0.8, 0));
        cam.lookAt(c.to);
      }
      cam.fov = 50;
      cam.updateProjectionMatrix();
      return;
    }
    const eye = this.eyeHeight();
    const bob = Math.sin(this.bob) * 0.03 * this.moveAmt;
    cam.position.set(this.pos.x, this.pos.y + eye + Math.abs(bob), this.pos.z);
    // 스코프 흔들림(작게) – 숙여서 고개만 내밀면 더 안정
    const swayAmp = this.weapon === 'sniper' ? this.scopeT * (this.crouched ? 0.0009 : 0.0018) : 0;
    const sx = Math.sin(this.swayT * 0.9) * swayAmp, sy = Math.sin(this.swayT * 1.37) * swayAmp * 0.7;
    const sh = this.shake * 0.012;
    cam.quaternion.setFromEuler(new THREE.Euler(this.pitch + this.recoil + sy + (Math.random() - 0.5) * sh, this.yaw + sx + (Math.random() - 0.5) * sh, 0, 'YXZ'));
    const fov = this.fovNow();
    if (Math.abs(cam.fov - fov) > 1e-3) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    this.vmCamera.fov = TUNING.fov;
    this.vmCamera.updateProjectionMatrix();
    const sway = { x: Math.sin(this.bob * 0.5) * 6 * this.moveAmt, y: (Math.abs(Math.sin(this.bob)) * 5 - 6) * this.moveAmt };
    if (this.weapon === 'sniper') {
      const bolt = this.boltT > 0 ? 1 - this.boltT / TUNING.sniper.bolt : -1;
      const rel = this.reloadT > 0 ? 1 - this.reloadT / TUNING.sniper.reload : -1;
      this.viewModel.update(real, this.scopeT, bolt, rel, 0, 0, sway);
    } else {
      this.viewModel.updateGun(real, this.pistol.ads, this.swapT, this.pistol.reloadProgress, sway);
    }
  }

  // ─────────── HUD ───────────
  hud(): ArenaHud {
    const W = this.sizeW, H = this.sizeH;
    const v = new THREE.Vector3();
    const snipers: ArenaHud['snipers'] = [];
    const markers: ArenaHud['markers'] = [];
    for (const e of this.enemies) {
      if (!e.alive || !e.rig.root.visible) continue;
      v.copy(e.headPos()).add(new THREE.Vector3(0, 0.45, 0)).project(this.camera);
      const on = v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1;
      const sx = ((v.x + 1) / 2) * W, sy = ((1 - v.y) / 2) * H;
      if (e.kind === 'sniper') {
        const ang = Math.atan2(-(e.pos.x - this.pos.x), -(e.pos.z - this.pos.z));
        let rel = ang - this.yaw;
        rel = Math.atan2(Math.sin(rel), Math.cos(rel));
        snipers.push({ dir: (-rel * 180) / Math.PI, charge: e.charge, onScreen: on, x: sx, y: sy });
      }
      if (on && this.scopeT < 0.5) markers.push({ x: sx, y: sy, kind: e.kind, roof: e.state === 'chase' && e.pos.distanceTo(this.pos) < 25 });
    }
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const spreadDeg = this.weapon === 'sniper' ? (this.scopeT > 0.7 ? 0 : TUNING.sniper.hipSpreadDeg) : this.pistol.spread(this.moveAmt > 0.3, this.crouched);
    const spreadPx = (Math.tan((spreadDeg * Math.PI) / 180) / Math.tan(fovRad / 2)) * (H / 2);
    const swayAmp = this.weapon === 'sniper' ? this.scopeT * (this.crouched ? 0.0009 : 0.0018) : 0;
    return {
      hp: this.hp,
      hurt: this.hurtFlash,
      hurtDirs: this.hurtDirs.map((h) => h.dir),
      weapon: this.weapon,
      weaponName: this.weapon === 'sniper' ? 'R-308 저격총' : 'P9 권총',
      inMag: this.weapon === 'sniper' ? this.sniperMag : this.pistol.inMag,
      reserve: this.weapon === 'sniper' ? null : this.pistol.reserve,
      reloading: this.weapon === 'sniper' ? (this.reloadT > 0 ? 1 - this.reloadT / TUNING.sniper.reload : -1) : this.pistol.reloadProgress,
      bolting: this.weapon === 'sniper' && this.boltT > 0,
      scopeT: this.cam ? 0 : this.scopeT,
      zoom: TUNING.sniper.zooms[this.zoomIndex],
      crouched: this.crouched,
      exposed: this.exposeState,
      score: this.score,
      wave: this.wave,
      enemiesLeft: this.toSpawn.length + this.enemies.filter((e) => e.alive).length,
      combo: this.combo,
      comboT: this.comboT / TUNING.comboWindow,
      snipers,
      markers,
      spreadPx,
      bulletCam: !!this.cam,
      breakT: this.breakT,
      sway: { x: (Math.sin(this.swayT * 0.9) * swayAmp) / (fovRad / 2), y: (Math.sin(this.swayT * 1.37) * swayAmp * 0.7) / (fovRad / 2) },
    };
  }

  /** 테스트용: 가장 가까운 살아 있는 적을 정확히 겨눈다 */
  testAimNearest(zone: 'head' | 'body' = 'head'): boolean {
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || !e.rig.root.visible) continue;
      const d = e.pos.distanceTo(this.pos);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (!best) return false;
    const p = best.headPos();
    if (zone === 'body') p.y -= 0.5;
    const d = p.sub(this.camera.position);
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    return true;
  }
}

function buildSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(1200, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color(0x4f97c4) }, mid: { value: new THREE.Color(0xa9cfe0) }, horizon: { value: new THREE.Color(0xf6cf9c) }, sunDir: { value: SUN_DIR.clone() } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader:
      'uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vDir;' +
      'void main(){ vec3 d = normalize(vDir); float h = max(d.y, 0.0); float s = max(dot(d, sunDir), 0.0);' +
      // 해 쪽 지평선은 금빛, 반대쪽은 옅은 복숭아빛
      ' float az = max(dot(normalize(vec2(d.x, d.z)), normalize(vec2(sunDir.x, sunDir.z))), 0.0);' +
      ' vec3 hz = mix(horizon, vec3(1.0, 0.72, 0.38), pow(az, 3.0) * 0.85);' +
      ' vec3 c = mix(hz, mid, smoothstep(0.0, 0.22, h)); c = mix(c, top, smoothstep(0.22, 0.75, h));' +
      ' c += vec3(1.0,0.85,0.6) * smoothstep(0.9993, 0.9998, s) * 2.0 + vec3(1.0,0.7,0.4) * pow(s, 24.0) * 0.9 + vec3(1.0,0.55,0.25) * pow(s, 4.0) * 0.3;' +
      ' if (vDir.y < 0.0) c = horizon * 0.9; gl_FragColor = vec4(c, 1.0); }',
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = -1;
  return m;
}

function glowTexture(color: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, color);
  g.addColorStop(0.25, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
