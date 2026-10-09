/**
 * 게임 본체: 미션 진행 · 사격 · 탄 시뮬레이션 · 판정 · 카메라 · 렌더링.
 * UI는 `hooks`(이벤트)와 `hud()`(매 프레임 상태 스냅샷)로만 게임과 소통한다.
 */
import * as THREE from 'three';
import { BALANCE } from '../config/balance';
import { DIFFICULTIES, type DifficultySpec } from '../config/difficulty';
import type { HintTrigger, MissionDef, ObjectiveDef } from '../config/missions';
import { getWeapon } from '../config/weapons';
import { airDensity, speedOfSound } from '../ballistics/atmosphere';
import { createProjectile, flatTrajectory, speedOf, stepProjectile, type BallisticEnv, type Projectile, type V3 } from '../ballistics/solver';
import { WindField, windClock } from '../ballistics/wind';
import { AudioEngine } from '../audio/audio';
import { Input } from '../core/input';
import { SaveStore } from '../core/save';
import { GAME_TRANSITIONS, StateMachine, type GameState } from '../core/stateMachine';
import { analyzeShot, basisToward, boreDir, muzzleFrom, solveFiringSolution, type Analysis, type ShotRecord } from './analysis';
import { Effects } from './fx';
import { RifleState } from './rifle';
import { ShooterModel } from './shooter';
import { Target, TargetMaterials, ZONE_LABEL, type HitResult } from './targets';
import { SHOOTER_GROUND } from './terrain';
import { ViewModel } from './viewmodel';
import { segmentBox, World, type QualityLevel } from './world';

export interface HitInfo {
  kind: 'plate' | 'kill' | 'headshot' | 'wound';
  title: string;
  detail: string;
}

export interface ObjectiveStatus {
  label: string;
  done: boolean;
}

export interface MissionResult {
  mission: MissionDef;
  success: boolean;
  failReason?: string;
  tip?: string;
  time: number;
  shots: number;
  hits: number;
  kills: number;
  headshots: number;
  longest: number;
  objectives: ObjectiveStatus[];
  stars: [boolean, boolean, boolean];
  prevStars: [boolean, boolean, boolean];
  newBestTime: boolean;
  score?: number;
  bestScore?: number;
  unlocked: string[];
  lastAnalysis: Analysis | null;
}

export interface GameHooks {
  onHint(text: string | null): void;
  onHit(info: HitInfo): void;
  onAnalysis(a: Analysis | null): void;
  onRangefinder(dist: number | null, ok: boolean): void;
  onAlert(label: string): void;
  onToast(text: string): void;
  onMissionEnd(r: MissionResult): void;
  onStateChange(to: GameState, from: GameState): void;
  onMuzzleFlash(): void;
}

export interface HudSnapshot {
  missionName: string;
  time: number;
  timeLimit: number;
  targetsLeft: number;
  targetsTotal: number;
  shots: number;
  inMag: number;
  reserve: number;
  ammoName: string;
  subsonic: boolean;
  status: string;
  elev: number;
  wind: number;
  zoom: number;
  zoomMin: number;
  zoomMax: number;
  breath: number;
  holding: boolean;
  exhausted: boolean;
  heartRate: number;
  windText: string | null;
  scopeT: number;
  pxPerMil: number;
  predicted: { x: number; y: number; dist: number } | null;
  restartProgress: number;
  busy: boolean;
  dopeOpen: boolean;
  bulletCam: boolean;
  isRange: boolean;
  rangefinderAllowed: boolean;
  canSwitchAmmo: boolean;
  weaponName: string;
}

interface ActiveBullet {
  proj: Projectile;
  tracer: number;
  prev: THREE.Vector3;
  record: ShotRecord | null;
  subsonic: boolean;
  mass: number;
  cam: boolean;
  done: boolean;
  /** 표적을 맞혔는지(맞힌 뒤 불릿캠 연출용) */
  hitTarget: boolean;
  doneTimer: number;
}

const UP = new THREE.Vector3(0, 1, 0);

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  private readonly vmCamera: THREE.PerspectiveCamera;
  readonly fsm = new StateMachine<GameState>('loading', GAME_TRANSITIONS);
  readonly input: Input;
  readonly audio: AudioEngine;
  readonly save: SaveStore;
  hooks: GameHooks | null = null;

  world: World | null = null;
  private worldKey = '';
  mission: MissionDef | null = null;
  targets: Target[] = [];
  private mats = new TargetMaterials();
  private fx: Effects | null = null;
  private readonly viewModel = new ViewModel();
  rifle: RifleState;
  readonly shooter = new ShooterModel(1.7);
  private wind: WindField | null = null;
  private env: BallisticEnv | null = null;
  private difficulty: DifficultySpec = DIFFICULTIES.recruit;
  private quality: QualityLevel = 'high';

  // 조준
  private yaw = 0;
  private pitch = 0;
  private lookSpeed = 0;
  private scoped = false;
  private scopeT = 0;
  zoom = 6;
  private recoil = 0;
  private recoilV = 0;
  private shake = 0;
  private dopeOpen = false;
  private breathToggle = false;

  // 진행
  private missionTime = 0;
  private timeScale = 1;
  private hitStop = 0;
  private bullets: ActiveBullet[] = [];
  private stats = { shots: 0, hits: 0, kills: 0, headshots: 0, misses: 0, longest: 0, alerts: 0, windDialOnHit: false };
  private endTimer = -1;
  private ended = false;
  private hintIndex = 0;
  private fireBuffer = 0;
  private repeatTimers = new Map<string, number>();
  private restartHold = 0;
  private lastAnalysis: Analysis | null = null;
  private predicted: { x: number; y: number; dist: number } | null = null;
  private predictTimer = 0;
  private windText: string | null = null;
  private windTimer = 0;
  private lastRange = 500;
  private camBullet: ActiveBullet | null = null;
  private camHold = 0;
  private readonly camPos = new THREE.Vector3();
  private readonly camLook = new THREE.Vector3();
  private menuT = 0;
  private frameTimes: number[] = [];
  private qualityChecked = false;
  private eye = new THREE.Vector3(0, SHOOTER_GROUND + BALANCE.camera.eyeHeight, 0);
  private accumulator = 0;
  private rafId = 0;
  private lastFrame = 0;
  private disposers: (() => void)[] = [];
  /** 테스트용: 다음 발사에서 흔들림·분산을 끈다 */
  testSteady = false;

  constructor(container: HTMLElement, save: SaveStore, audio: AudioEngine, input: Input) {
    this.save = save;
    this.audio = audio;
    this.input = input;
    const s = save.data.settings;
    this.quality = s.quality === 'auto' ? (input.isTouch ? 'medium' : 'high') : s.quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: this.quality !== 'low', logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.id = 'game-canvas';
    this.camera = new THREE.PerspectiveCamera(BALANCE.camera.baseFov, 1, 0.1, 7000);
    this.vmCamera = new THREE.PerspectiveCamera(BALANCE.camera.baseFov, 1, 0.01, 10);
    this.rifle = new RifleState(getWeapon(s.weapon));
    this.viewModel.build(this.rifle.weapon);
    this.fsm.onChange((to, from) => this.hooks?.onStateChange(to, from));
    const onResize = () => this.resize();
    window.addEventListener('resize', onResize);
    this.disposers.push(() => window.removeEventListener('resize', onResize));
    this.resize();
  }

  private pixelRatio(): number {
    const cap = this.quality === 'high' ? 2 : this.quality === 'medium' ? 1.25 : 1;
    return Math.min(window.devicePixelRatio || 1, cap);
  }

  setQuality(q: QualityLevel): void {
    this.quality = q;
    this.renderer.setPixelRatio(this.pixelRatio());
    this.resize();
  }

  get qualityLevel(): QualityLevel {
    return this.quality;
  }

  resize(): void {
    const el = this.renderer.domElement.parentElement;
    const w = el?.clientWidth || window.innerWidth;
    const h = el?.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.vmCamera.aspect = this.camera.aspect;
    this.vmCamera.updateProjectionMatrix();
  }

  // ───────────────────────── 루프 ─────────────────────────
  start(): void {
    this.lastFrame = performance.now();
    const tick = (now: number) => {
      this.rafId = requestAnimationFrame(tick);
      const real = Math.min(BALANCE.sim.maxFrameTime, Math.max(0, (now - this.lastFrame) / 1000));
      this.lastFrame = now;
      this.frame(real);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private frame(real: number): void {
    const playing = this.fsm.is('playing');
    if (playing) {
      this.handleFrameInput(real);
      // 히트스톱: 실제 시간으로 잠깐 정지
      let scale = this.timeScale;
      if (this.hitStop > 0) {
        this.hitStop -= real;
        scale = 0;
      }
      this.accumulator += real * scale;
      const step = BALANCE.sim.fixedStep;
      let n = 0;
      while (this.accumulator >= step && n < 30) {
        this.update(step);
        this.accumulator -= step;
        n++;
      }
      if (n >= 30) this.accumulator = 0;
      this.updateBulletCamScale(real);
      this.trackPerformance(real);
    } else if (this.fsm.is('menu', 'briefing', 'loading')) {
      this.menuT += real;
    }
    this.input.endFrame();
    this.updateCamera(real);
    this.render();
  }

  private trackPerformance(real: number): void {
    if (this.qualityChecked || this.save.data.settings.quality !== 'auto') return;
    this.frameTimes.push(real);
    // 2.5초(최소 20프레임) 측정 후 판단: 저사양 기기에서 오래 버벅이지 않게
    const total = this.frameTimes.reduce((a, b) => a + b, 0);
    if (total >= 2.5 && this.frameTimes.length >= 20) {
      const sorted = [...this.frameTimes].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      this.qualityChecked = true;
      if (median > 0.028 && this.quality !== 'low') {
        this.setQuality(this.quality === 'high' ? 'medium' : 'low');
        this.hooks?.onToast('프레임이 낮아 그래픽 품질을 자동으로 낮췄습니다. (설정에서 변경 가능)');
      }
    }
  }

  private render(): void {
    this.renderer.clear();
    if (this.world) this.renderer.render(this.world.scene, this.camera);
    const showVm = this.fsm.is('playing', 'paused') && this.scopeT < 0.9 && !this.camBullet;
    if (showVm) {
      this.renderer.clearDepth();
      this.renderer.render(this.viewModel.scene, this.vmCamera);
    }
  }

  // ───────────────────────── 미션 준비 ─────────────────────────
  /** 메뉴 배경용 월드 */
  loadBackdrop(mission: MissionDef): void {
    this.prepareWorld(mission, 7);
    this.mission = null;
    for (const t of this.targets) t.dispose();
    this.targets = [];
    // 배경에서도 표적이 보이면 분위기가 산다
    for (const d of mission.targets) {
      const t = new Target(d, this.world!.terrain, this.mats, 1, 1, 0.7);
      this.world!.scene.add(t.group);
      this.targets.push(t);
    }
    this.wind = new WindField(mission.wind, 7);
  }

  private prepareWorld(mission: MissionDef, seed: number): void {
    const key = `${mission.id}:${mission.theme}:${seed}:${this.quality}`;
    if (key !== this.worldKey || !this.world) {
      this.fx?.dispose();
      this.world?.dispose();
      this.world = new World(mission, this.quality, seed);
      this.fx = new Effects((x, z) => this.world!.terrain.height(x, z), this.world.theme.groundLow);
      this.world.scene.add(this.fx.group);
      this.worldKey = key;
    }
  }

  loadMission(mission: MissionDef): void {
    const s = this.save.data.settings;
    this.mission = mission;
    const seed = mission.id.split('').reduce((a, c) => a + c.charCodeAt(0) * 31, 17);
    this.prepareWorld(mission, seed);
    const weaponId = mission.weaponLock ?? s.weapon;
    if (this.rifle.weapon.id !== weaponId) {
      this.rifle = new RifleState(getWeapon(weaponId));
      this.viewModel.build(this.rifle.weapon);
    }
    this.difficulty = DIFFICULTIES[s.difficulty];
    for (const t of this.targets) t.dispose();
    this.targets = [];
    const rnd = (i: number) => BALANCE.targets.reactionMin + ((Math.sin(seed * 13.7 + i * 7.1) + 1) / 2) * (BALANCE.targets.reactionMax - BALANCE.targets.reactionMin);
    mission.targets.forEach((d, i) => {
      const t = new Target(d, this.world!.terrain, this.mats, this.difficulty.escapeSpeedMul, this.difficulty.escapeDistanceMul, rnd(i));
      this.world!.scene.add(t.group);
      this.targets.push(t);
    });
    this.wind = new WindField(mission.wind, seed);
    this.env = {
      density: airDensity(mission.atmosphere.altitude, mission.atmosphere.temperature),
      soundSpeed: speedOfSound(mission.atmosphere.temperature),
      gravity: BALANCE.sim.gravity,
      windAt: (x, y, z, t, out) => this.wind!.windAt(x, y, z, t, out),
    };
    this.eye.set(0, this.world!.terrain.height(0, 0) + BALANCE.camera.eyeHeight, 0);
  }

  /** 브리핑 → 플레이 */
  begin(): boolean {
    if (!this.mission) return false;
    if (!this.fsm.can('playing')) return false;
    this.resetRun();
    this.fsm.go('playing');
    this.enterPlay();
    return true;
  }

  restart(): void {
    if (!this.mission || !this.fsm.is('playing', 'paused', 'result')) return;
    this.resetRun();
    this.fsm.go('playing');
    this.enterPlay();
  }

  private enterPlay(): void {
    this.input.enabled = true;
    this.input.requestPointerLock();
    this.audio.stopMusic();
    this.audio.setWind(0, true);
    this.audio.resume();
    this.showHint();
  }

  private resetRun(): void {
    const m = this.mission!;
    for (const t of this.targets) t.reset();
    this.fx?.clear();
    this.rifle.reset(m.ammoTotal);
    this.shooter.reset();
    this.bullets = [];
    this.camBullet = null;
    this.camHold = 0;
    this.stats = { shots: 0, hits: 0, kills: 0, headshots: 0, misses: 0, longest: 0, alerts: 0, windDialOnHit: false };
    this.missionTime = 0;
    this.timeScale = 1;
    this.hitStop = 0;
    this.endTimer = -1;
    this.ended = false;
    this.hintIndex = 0;
    this.fireBuffer = 0;
    this.restartHold = 0;
    this.recoil = 0;
    this.recoilV = 0;
    this.shake = 0;
    this.scoped = false;
    this.scopeT = 0;
    this.dopeOpen = false;
    this.breathToggle = false;
    this.lastAnalysis = null;
    this.predicted = null;
    this.accumulator = 0;
    this.zoom = Math.max(this.rifle.weapon.zoomMin, Math.min(8, this.rifle.weapon.zoomMax));
    // 첫 표적 쪽을 바라보며 시작
    const first = m.targets[0];
    this.yaw = first ? Math.atan2(-first.x, first.dist) * 0.6 : 0;
    this.pitch = -0.004;
    this.lastRange = first ? first.dist : 500;
    this.hooks?.onAnalysis(null);
    this.hooks?.onRangefinder(null, true);
  }

  pause(): void {
    if (!this.fsm.is('playing')) return;
    this.fsm.go('paused');
    this.input.enabled = false;
    this.input.releaseAll();
    this.input.exitPointerLock();
    this.audio.setWind(0, false);
  }

  resume(): void {
    if (!this.fsm.is('paused')) return;
    this.fsm.go('playing');
    this.input.enabled = true;
    this.input.releaseAll();
    this.input.requestPointerLock();
    this.audio.setWind(0, true);
    this.lastFrame = performance.now();
  }

  toMenu(): void {
    if (this.fsm.is('paused', 'result', 'briefing')) {
      this.fsm.go('menu');
      this.input.enabled = false;
      this.input.exitPointerLock();
      this.audio.setWind(0, false);
      this.audio.startMusic();
      this.camBullet = null;
    }
  }

  toBriefing(): void {
    if (this.fsm.go('briefing')) {
      this.input.enabled = false;
      this.input.exitPointerLock();
      this.audio.setWind(0, false);
    }
  }

  // ───────────────────────── 입력(매 프레임) ─────────────────────────
  private handleFrameInput(real: number): void {
    const s = this.save.data.settings;
    const inp = this.input;
    if (inp.consumePressed('pause')) {
      this.pause();
      return;
    }
    // 불릿캠 건너뛰기
    if (this.camBullet && (inp.consumePressed('fire') || inp.consumePressed('scope'))) {
      this.endBulletCam();
      return;
    }
    // 시선
    const fovRatio = this.currentFov() / BALANCE.camera.baseFov;
    const base = inp.isTouch ? BALANCE.input.touchSensitivity * s.touchSensitivity : BALANCE.input.mouseSensitivity * s.mouseSensitivity;
    const sens = base * (this.scopeT > 0.5 ? fovRatio * BALANCE.input.scopedSensitivityScale * s.scopedSensitivity : 1);
    const dx = inp.lookX * sens;
    const dy = inp.lookY * sens * (s.invertY ? -1 : 1);
    if (!this.camBullet) {
      this.yaw = Math.max(-BALANCE.camera.yawLimit, Math.min(BALANCE.camera.yawLimit, this.yaw - dx));
      this.pitch = Math.max(BALANCE.camera.pitchMin, Math.min(BALANCE.camera.pitchMax, this.pitch - dy));
    }
    const speed = Math.hypot(dx, dy) / Math.max(real, 1e-3);
    this.lookSpeed += (speed - this.lookSpeed) * Math.min(1, real * 20);

    // 재시작(길게)
    if (inp.isDown('restart')) {
      this.restartHold += real;
      if (this.restartHold >= BALANCE.input.restartHoldTime) {
        this.restartHold = 0;
        this.restart();
        return;
      }
    } else this.restartHold = 0;
  }

  private repeat(action: 'elevUp' | 'elevDown' | 'windLeft' | 'windRight', dt: number): number {
    const inp = this.input;
    if (inp.consumePressed(action)) {
      this.repeatTimers.set(action, 0.35);
      return 1;
    }
    if (!inp.isDown(action)) {
      this.repeatTimers.delete(action);
      return 0;
    }
    let t = (this.repeatTimers.get(action) ?? 0.35) - dt;
    let n = 0;
    while (t <= 0) {
      n++;
      t += 1 / 14;
    }
    this.repeatTimers.set(action, t);
    return n;
  }

  // ───────────────────────── 고정 스텝 업데이트 ─────────────────────────
  private update(dt: number): void {
    const m = this.mission;
    if (!m || !this.wind) return;
    const inp = this.input;
    const s = this.save.data.settings;
    this.missionTime += dt;

    // 스코프
    if (!this.camBullet) {
      if (s.scopeMode === 'toggle') {
        if (inp.consumePressed('scope')) this.scoped = !this.scoped;
      } else {
        inp.consumePressed('scope');
        this.scoped = inp.isDown('scope');
      }
    }
    const prevScopeT = this.scopeT;
    this.scopeT = Math.max(0, Math.min(1, this.scopeT + (this.scoped ? dt : -dt) / BALANCE.camera.scopeTransition));
    if (prevScopeT < 1 && this.scopeT >= 1) this.trigger('scope');

    // 줌
    let zoomSteps = inp.zoomSteps;
    if (inp.consumePressed('zoomIn')) zoomSteps++;
    if (inp.consumePressed('zoomOut')) zoomSteps--;
    inp.zoomSteps = 0;
    const zf = inp.zoomFactor;
    inp.zoomFactor = 1;
    if (zoomSteps !== 0 || zf !== 1) {
      const w = this.rifle.weapon;
      const before = this.zoom;
      this.zoom = Math.max(w.zoomMin, Math.min(w.zoomMax, this.zoom * Math.pow(BALANCE.input.zoomStep, zoomSteps) * zf));
      if (Math.abs(before - this.zoom) > 0.01) {
        this.audio.play('zoom');
        this.trigger('zoom');
      }
    }

    // 숨 참기
    let wantHold: boolean;
    if (s.breathMode === 'toggle') {
      if (inp.consumePressed('breath')) this.breathToggle = !this.breathToggle;
      wantHold = this.breathToggle;
    } else {
      inp.consumePressed('breath');
      wantHold = inp.isDown('breath');
    }
    const sev = this.shooter.update(dt, wantHold, this.difficulty.breathHold, this.difficulty.swayMul * this.rifle.weapon.swayMul);
    if (sev.holdStarted) {
      this.audio.play('breathIn');
      this.trigger('breath');
    }
    if (sev.holdEnded) {
      this.audio.play('breathOut');
      this.breathToggle = false;
    }
    if (sev.exhausted) this.hooks?.onToast('숨이 찼습니다! 흔들림이 커집니다');
    if (sev.heartbeat && (this.shooter.holding || this.shooter.exhausted) && this.scopeT > 0.5) this.audio.play('heartbeat', { volume: this.shooter.exhausted ? 1 : 0.6 });

    // 터렛
    const elevClicks = this.repeat('elevUp', dt) - this.repeat('elevDown', dt);
    if (elevClicks !== 0 && this.rifle.dialElev(elevClicks)) {
      this.audio.play('turret');
      this.trigger('turretElev');
    }
    const windClicks = this.repeat('windRight', dt) - this.repeat('windLeft', dt);
    if (windClicks !== 0 && this.rifle.dialWind(windClicks)) {
      this.audio.play('turret', { pitch: 0.9 });
      this.trigger('turretWind');
    }
    if (inp.consumePressed('turretReset')) {
      this.rifle.resetTurrets();
      this.audio.play('turret');
      this.audio.play('turret', { delay: 0.05 });
      this.hooks?.onToast('터렛을 0으로 되돌렸습니다');
    }

    // 장비
    if (inp.consumePressed('rangefinder')) this.useRangefinder();
    if (inp.consumePressed('dope')) {
      this.dopeOpen = !this.dopeOpen;
      if (this.dopeOpen) this.trigger('dope');
      this.audio.play('uiClick');
    }
    if (inp.consumePressed('ammo')) {
      if (this.rifle.switchAmmo()) {
        this.audio.play('reload', { weight: this.rifle.weapon.reloadTime / 2.4 });
        this.hooks?.onToast(`탄종 변경: ${this.rifle.ammo.name}`);
        this.trigger('ammo');
      } else if (this.rifle.weapon.ammo.length < 2) this.hooks?.onToast('이 총은 탄종이 하나뿐입니다');
    }

    // 총기
    const ev = this.rifle.update(dt);
    if (ev === 'boltStart') this.audio.play('bolt', { weight: this.rifle.weapon.boltTime });
    if (ev === 'reloadStart') this.audio.play('reload', { weight: this.rifle.weapon.reloadTime / 2.4 });

    // 발사
    if (this.fireBuffer > 0) this.fireBuffer -= dt;
    const firePressed = inp.consumePressed('fire');
    if (firePressed || (this.fireBuffer > 0 && this.rifle.canFire())) {
      if (this.rifle.canFire() && !this.camBullet) {
        this.fireBuffer = 0;
        this.fire();
      } else if (firePressed) {
        if (this.rifle.totalRounds <= 0) {
          this.audio.play('dry');
          this.hooks?.onToast('탄약이 없습니다');
        } else this.fireBuffer = BALANCE.input.fireBufferTime;
      }
    }

    // 반동 복귀(임계 감쇠)
    const w = (2 * Math.PI) / (this.rifle.weapon.recoilRecover * 2.2);
    this.recoilV += (-this.recoil * w * w - this.recoilV * 2 * w) * dt;
    this.recoil += this.recoilV * dt;
    this.shake = Math.max(0, this.shake - dt * 3);

    // 탄
    this.updateBullets(dt);

    // 표적
    for (const t of this.targets) {
      const r = t.update(dt);
      if (r.becameAlert) {
        this.stats.alerts++;
        this.audio.play('alert');
        this.hooks?.onAlert(`${t.def.label ?? '표적'} 경계! 도주 중`);
      }
      if (r.escaped && t.def.required && !this.ended) {
        this.fail(`${t.def.label ?? '표적'}이(가) 엄폐물 뒤로 탈출했습니다.`, '첫 발 이후 나머지 표적은 약 2~3초 뒤 도주합니다. 도주 거리가 긴 표적을 나중에 쏘세요.');
      }
    }

    this.world?.updateFlags(this.wind, this.missionTime);
    this.fx?.update(dt);
    this.audio.setWind(this.wind.sample(0, this.missionTime).speed, true);

    // 보조 정보
    this.predictTimer -= dt;
    if (this.predictTimer <= 0) {
      this.predictTimer = BALANCE.ballisticsAssist.predictInterval;
      this.updatePredicted();
    }
    this.windTimer -= dt;
    if (this.windTimer <= 0) {
      this.windTimer = 0.25;
      this.updateWindText();
    }

    this.checkEnd(dt);
  }

  private checkEnd(dt: number): void {
    const m = this.mission!;
    if (this.ended) return;
    if (m.isRange) return;
    const required = this.targets.filter((t) => t.def.required);
    const allDone = required.length > 0 && required.every((t) => t.done);
    if (allDone) {
      if (this.endTimer < 0) this.endTimer = 1.4;
      if (!this.camBullet) this.endTimer -= dt;
      if (this.endTimer <= 0) this.finish(true);
      return;
    }
    if (m.timeLimit > 0 && this.missionTime > m.timeLimit) {
      this.fail('제한 시간이 끝났습니다.', '표적이 노출되는 순간을 미리 계산해 두고, 보정은 노출 전에 끝내세요.');
      return;
    }
    if (this.rifle.totalRounds <= 0 && this.bullets.length === 0 && !this.rifle.busy) {
      this.fail('탄약을 모두 썼습니다.', this.lastAnalysis?.tip ?? '탄도표로 보정량을 계산한 뒤 쏘세요.');
    }
  }

  // ───────────────────────── 사격 ─────────────────────────
  private trigger(t: HintTrigger): void {
    const hints = this.mission?.hints;
    if (!hints || !this.save.data.settings.showHints) return;
    const cur = hints[this.hintIndex];
    if (cur && cur.until === t) {
      this.hintIndex++;
      this.audio.play('hint');
      this.showHint();
    }
  }

  private showHint(): void {
    const hints = this.mission?.hints;
    if (!hints || !this.save.data.settings.showHints) {
      this.hooks?.onHint(null);
      return;
    }
    const h = hints[this.hintIndex];
    if (!h) {
      this.hooks?.onHint(null);
      return;
    }
    const raw = this.input.isTouch && h.touchText ? h.touchText : h.text;
    this.hooks?.onHint(raw.replace(/\{(\w+)\}/g, (_, k: string) => `[${this.input.keyLabel(k as never)}]`));
  }

  /** 조준선(시선) 방향 – 흔들림·반동 포함 */
  private losQuaternion(out: THREE.Quaternion): THREE.Quaternion {
    const sway = this.testSteady ? { x: 0, y: 0 } : this.shooter.offset;
    const mil = 0.001;
    const swayMul = 0.35 + 0.65 * this.scopeT;
    const e = new THREE.Euler(
      this.pitch + (sway.y * swayMul + this.recoil) * mil + Math.sin(this.missionTime * 70) * this.shake * 0.004,
      this.yaw - sway.x * swayMul * mil,
      0,
      'YXZ',
    );
    return out.setFromEuler(e);
  }

  private fire(): void {
    const w = this.rifle.weapon;
    const ammo = this.rifle.ammo;
    const q = this.losQuaternion(new THREE.Quaternion());
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const r = new THREE.Vector3().crossVectors(f, UP).normalize();
    const u = new THREE.Vector3().crossVectors(r, f);
    const basis = { f, r, u };
    // 방아쇠 흔들림(빠르게 움직이며 쏘면 오차) + 총기 분산
    const steady = this.testSteady;
    const jerk = steady ? 0 : Math.min(BALANCE.shooter.triggerJerkMax, this.lookSpeed * BALANCE.shooter.triggerJerkPerRadPerSec);
    const ja = Math.random() * Math.PI * 2;
    const disp = steady ? 0 : ((ammo.dispersionMoa * 0.2909) / 2) * Math.sqrt(Math.random());
    const da = Math.random() * Math.PI * 2;
    const extraV = Math.sin(ja) * jerk + Math.sin(da) * disp;
    const extraH = Math.cos(ja) * jerk + Math.cos(da) * disp;
    const muzzle = muzzleFrom(this.eye, basis, w.sightHeight);
    const dir = boreDir(basis, this.rifle.zeroAngle + (this.rifle.elevMil + extraV) / 1000, (this.rifle.windMil + extraH) / 1000);
    const proj = createProjectile(this.rifle.params(), muzzle, dir);
    proj.t = 0;
    const record = this.buildRecord(f, extraV, extraH);

    this.stats.shots++;
    this.save.data.progress.stats.shots++;
    this.rifle.fire();
    this.shooter.onShot();
    this.recoilV += w.recoilKick * 9;
    this.viewModel.kick(w.recoilKick * 0.35);
    if (this.save.data.settings.screenShake) this.shake = Math.min(1, w.recoilKick / 14);
    this.audio.play(ammo.subsonic ? 'shotSub' : 'shot', { weight: w.loudness });
    if (!ammo.subsonic) this.hooks?.onMuzzleFlash();
    this.trigger('fire');

    // 총성 전파 → 표적 경계
    for (const t of this.targets) {
      if (!t.isBot || !t.active) continue;
      const d = t.position.distanceTo(this.eye);
      if (ammo.subsonic && d > 60) continue;
      t.alert(d / BALANCE.targets.speedOfSound + t.reaction / w.loudness);
    }

    const bullet: ActiveBullet = {
      proj,
      tracer: this.fx!.tracers.start(),
      prev: new THREE.Vector3(muzzle.x, muzzle.y, muzzle.z),
      record,
      subsonic: ammo.subsonic,
      mass: ammo.mass,
      cam: false,
      done: false,
      hitTarget: false,
      doneTimer: 0,
    };
    this.bullets.push(bullet);
    if (this.shouldBulletCam(proj)) {
      bullet.cam = true;
      this.camBullet = bullet;
      this.camHold = 0;
      this.scoped = false;
    }
  }

  /** 조준선과 가장 가까운 표적 기준으로 사격 기록(분석용)을 만든다 */
  private buildRecord(f: THREE.Vector3, extraV: number, extraH: number): ShotRecord | null {
    if (!this.env) return null;
    let best: { t: Target; point: THREE.Vector3; ang: number } | null = null;
    const dir = new THREE.Vector3();
    for (const t of this.targets) {
      if (!t.active || t.done) continue;
      const pts = t.isBot
        ? [new THREE.Vector3(0, 1.66, 0), new THREE.Vector3(0, 1.3, 0)]
        : [new THREE.Vector3(0, 0.7 + (t.def.h ?? 0.6) / 2, 0)];
      for (const lp of pts) {
        const p = lp.add(t.position);
        dir.subVectors(p, this.eye).normalize();
        const ang = dir.angleTo(f);
        if (ang < 0.03 && (!best || ang < best.ang)) best = { t, point: p.clone(), ang };
      }
    }
    if (!best) return null;
    const params = this.rifle.params();
    const base = {
      params,
      env: this.envAt(this.missionTime),
      sightHeight: this.rifle.weapon.sightHeight,
      zeroAngle: this.rifle.zeroAngle,
      eye: this.eye,
      target: best.point,
    };
    const vel = best.t.velocity.clone();
    const needed = solveFiringSolution({ ...base, targetVel: vel });
    const moving = vel.lengthSq() > 0.05;
    const neededStatic = moving ? solveFiringSolution({ ...base, targetVel: { x: 0, y: 0, z: 0 } }) : needed;
    const tb = basisToward(this.eye, best.point);
    const offV = Math.asin(Math.max(-1, Math.min(1, f.x * tb.u.x + f.y * tb.u.y + f.z * tb.u.z))) * 1000;
    const offH = Math.asin(Math.max(-1, Math.min(1, f.x * tb.r.x + f.y * tb.r.y + f.z * tb.r.z))) * 1000;
    const swayMul = 0.35 + 0.65 * this.scopeT;
    return {
      losOffsetV: offV + extraV,
      losOffsetH: offH + extraH,
      swayV: this.shooter.offset.y * swayMul + extraV,
      swayH: this.shooter.offset.x * swayMul + extraH,
      elevDial: this.rifle.elevMil,
      windDial: this.rifle.windMil,
      needed,
      neededStatic,
      targetLabel: best.t.def.label ?? '표적',
      moving,
    };
  }

  /** 절대 시각 t0에서 시작하는 탄도 환경 */
  private envAt(t0: number): BallisticEnv {
    const env = this.env!;
    return { ...env, windAt: (x, y, z, t, out) => env.windAt(x, y, z, t0 + t, out) };
  }

  /** 불릿캠 여부: 설정 + 결정타 예측 */
  private shouldBulletCam(proj: Projectile): boolean {
    const mode = this.save.data.settings.bulletCam;
    if (mode === 'off' || !this.mission || this.mission.isRange) return false;
    const pred = this.predictHit(proj);
    if (!pred || !pred.target.isBot || pred.zone === 'arm' || pred.zone === 'leg') return false;
    if (pred.target.position.distanceTo(this.eye) < 250) return false;
    if (mode === 'always') return true;
    const remaining = this.targets.filter((t) => t.def.required && !t.done);
    return remaining.length === 1 && remaining[0] === pred.target;
  }

  /** 현재 표적 속도를 유지한다고 가정하고 명중 여부를 미리 계산 */
  private predictHit(src: Projectile): HitResult | null {
    const p: Projectile = { ...src, pos: { ...src.pos }, vel: { ...src.vel }, right: { ...src.right } };
    const env = this.envAt(this.missionTime);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const saved = this.targets.map((t) => t.position.clone());
    let result: HitResult | null = null;
    const dt = 0.002;
    while (p.t < BALANCE.sim.bulletMaxLife) {
      a.set(p.pos.x, p.pos.y, p.pos.z);
      stepProjectile(p, env, dt);
      b.set(p.pos.x, p.pos.y, p.pos.z);
      if (b.y < this.world!.terrain.height(b.x, b.z)) break;
      for (let i = 0; i < this.targets.length; i++) {
        const t = this.targets[i];
        t.position.copy(saved[i]).addScaledVector(t.velocity, p.t);
        t.group.position.copy(t.position);
      }
      for (const t of this.targets) {
        const h = t.intersect(a, b);
        if (h) {
          result = h;
          break;
        }
      }
      if (result || -b.z > this.world!.maxDist + 200) break;
    }
    this.targets.forEach((t, i) => {
      t.position.copy(saved[i]);
      t.group.position.copy(saved[i]);
    });
    return result;
  }

  private updateBullets(dt: number): void {
    const sub = BALANCE.sim.bulletSubStep;
    const steps = Math.max(1, Math.round(dt / sub));
    const h = dt / steps;
    const cur = new THREE.Vector3();
    const env = this.env!;
    const terrain = this.world!.terrain;
    const nearColliders = this.world!.colliders;
    for (const b of this.bullets) {
      if (b.done) {
        b.doneTimer += dt;
        continue;
      }
      for (let i = 0; i < steps && !b.done; i++) {
        // 탄의 바람은 절대 시각 기준
        const t0 = this.missionTime - dt + i * h - b.proj.t;
        stepProjectile(b.proj, { ...env, windAt: (x, y, z, t, out) => env.windAt(x, y, z, t0 + t, out) }, h);
        cur.set(b.proj.pos.x, b.proj.pos.y, b.proj.pos.z);
        this.collide(b, b.prev, cur, terrain, nearColliders);
        b.prev.copy(cur);
        if (b.proj.t > BALANCE.sim.bulletMaxLife || cur.y < -100 || -cur.z > 4000) {
          this.bulletMissed(b, null);
        }
      }
      this.fx!.tracers.push(b.tracer, b.prev, this.eye);
    }
    this.bullets = this.bullets.filter((b) => !b.done || (b === this.camBullet && b.doneTimer < 1));
  }

  private collide(b: ActiveBullet, a: THREE.Vector3, c: THREE.Vector3, terrain: World['terrain'], colliders: World['colliders']): void {
    // 1) 표적
    let best: HitResult | null = null;
    for (const t of this.targets) {
      const h = t.intersect(a, c);
      if (h && (!best || h.t < best.t)) best = h;
    }
    // 2) 장애물
    let obstacleT: number | null = null;
    const minX = Math.min(a.x, c.x) - 1, maxX = Math.max(a.x, c.x) + 1;
    const minZ = Math.min(a.z, c.z) - 1, maxZ = Math.max(a.z, c.z) + 1;
    for (const box of colliders) {
      if (box.max.x < minX || box.min.x > maxX || box.max.z < minZ || box.min.z > maxZ) continue;
      const t = segmentBox(a, c, box);
      if (t !== null && (obstacleT === null || t < obstacleT)) obstacleT = t;
    }
    // 3) 지면
    let groundT: number | null = null;
    if (c.y < terrain.height(c.x, c.z)) {
      let lo = 0;
      let hi = 1;
      const p = new THREE.Vector3();
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        p.lerpVectors(a, c, mid);
        if (p.y < terrain.height(p.x, p.z)) hi = mid;
        else lo = mid;
      }
      groundT = hi;
    }
    const tBest = best ? best.t : Infinity;
    const tObs = obstacleT ?? Infinity;
    const tGround = groundT ?? Infinity;
    if (tBest === Infinity && tObs === Infinity && tGround === Infinity) return;
    if (tBest <= tObs && tBest <= tGround && best) {
      this.bulletHitTarget(b, best);
    } else {
      const t = Math.min(tObs, tGround);
      const p = new THREE.Vector3().lerpVectors(a, c, t);
      this.bulletMissed(b, p);
    }
  }

  private finishBullet(b: ActiveBullet, at: THREE.Vector3): void {
    b.done = true;
    b.proj.pos.x = at.x;
    b.proj.pos.y = at.y;
    b.proj.pos.z = at.z;
    b.prev.copy(at);
    this.fx!.tracers.push(b.tracer, at, this.eye);
    this.fx!.tracers.end(b.tracer);
  }

  private bulletHitTarget(b: ActiveBullet, hit: HitResult): void {
    const t = hit.target;
    this.finishBullet(b, hit.point);
    b.hitTarget = true;
    const dist = Math.hypot(hit.point.x - this.eye.x, hit.point.z - this.eye.z);
    const speed = speedOf(b.proj);
    const energy = 0.5 * b.mass * speed * speed;
    const vel = new THREE.Vector3(b.proj.vel.x, b.proj.vel.y, b.proj.vel.z);
    const killed = t.applyHit(hit, vel.clone().multiplyScalar(b.mass * 140));
    const soundDelay = dist / BALANCE.targets.speedOfSound;
    const pan = Math.max(-1, Math.min(1, (hit.point.x - this.eye.x) / Math.max(50, dist) * 3));
    this.stats.hits++;
    this.save.data.progress.stats.hits++;
    this.stats.longest = Math.max(this.stats.longest, dist);
    this.save.data.progress.stats.longestHit = Math.max(this.save.data.progress.stats.longestHit, Math.round(dist));
    if (this.rifle.windMil !== 0 || (b.record && b.record.windDial !== 0)) this.stats.windDialOnHit = true;
    const fb = BALANCE.feedback;
    if (!t.isBot) {
      this.fx!.impactSteel(hit.point, dist);
      this.audio.play('impactSteel', { delay: soundDelay, volume: Math.max(0.35, 1 - dist / 2000), pan });
      this.hooks?.onHit({ kind: 'plate', title: '명중!', detail: `${t.def.label ?? '강철판'} · ${Math.round(dist)}m · 비행 ${b.proj.t.toFixed(2)}초` });
      if (!b.cam) this.hitStop = fb.hitStop;
    } else if (killed) {
      const head = hit.zone === 'head';
      this.stats.kills++;
      this.save.data.progress.stats.kills++;
      if (head) {
        this.stats.headshots++;
        this.save.data.progress.stats.headshots++;
      }
      const center = t.position.clone();
      center.y += 1.1;
      this.fx!.botDestroyed(center, vel.clone().normalize(), dist, head);
      this.audio.play('botHit', { delay: soundDelay, volume: Math.max(0.4, 1 - dist / 2000), pan });
      if (head) this.audio.play('headshot', { delay: 0.05 });
      this.hooks?.onHit({
        kind: head ? 'headshot' : 'kill',
        title: head ? '헤드샷!' : '무력화',
        detail: `${t.def.label ?? '표적'} · ${ZONE_LABEL[hit.zone]} · ${Math.round(dist)}m · ${Math.round(energy)}J`,
      });
      if (!b.cam) this.hitStop = head ? fb.headshotHitStop : fb.hitStop;
      // 목격 → 경계
      for (const o of this.targets) {
        if (o === t || !o.isBot || !o.active) continue;
        if (o.position.distanceTo(t.position) < BALANCE.targets.witnessRadius) o.alert(BALANCE.targets.witnessDelay);
      }
    } else {
      this.fx!.impactSteel(hit.point, dist);
      this.audio.play('botHit', { delay: soundDelay, volume: 0.5, pan, pitch: 1.3 });
      this.hooks?.onHit({ kind: 'wound', title: '부상 – 무력화 실패', detail: `${ZONE_LABEL[hit.zone]} 명중. 몸통이나 머리를 노리세요.` });
    }
    if (b.subsonic) this.alertNear(hit.point);
    this.trigger('hit');
  }

  private bulletMissed(b: ActiveBullet, at: THREE.Vector3 | null): void {
    if (at) {
      this.finishBullet(b, at);
      const dist = Math.hypot(at.x - this.eye.x, at.z - this.eye.z);
      this.fx!.impactGround(at, dist);
      this.audio.play('impactGround', { delay: dist / BALANCE.targets.speedOfSound, volume: Math.max(0.2, 0.8 - dist / 2500) });
      if (b.subsonic) this.alertNear(at);
    } else {
      b.done = true;
      this.fx!.tracers.end(b.tracer);
    }
    this.stats.misses++;
    if (b.record) {
      this.lastAnalysis = analyzeShot(b.record);
      this.hooks?.onAnalysis(this.lastAnalysis);
    } else {
      this.hooks?.onAnalysis(null);
      this.hooks?.onHit({ kind: 'wound', title: '빗나감', detail: '조준선 근처에 표적이 없었습니다.' });
    }
  }

  /** 아음속탄 착탄음: 근처 로봇만 듣는다 */
  private alertNear(p: THREE.Vector3): void {
    for (const t of this.targets) {
      if (!t.isBot || !t.active) continue;
      const d = t.position.distanceTo(p);
      if (d < BALANCE.targets.subsonicImpactHearRadius) t.alert(t.reaction);
    }
  }

  // ───────────────────────── 불릿캠 ─────────────────────────
  private updateBulletCamScale(real: number): void {
    const b = this.camBullet;
    if (!b) {
      this.timeScale = 1;
      return;
    }
    if (b.done) {
      this.camHold += real;
      this.timeScale = 0.25;
      if (this.camHold > 1.0) this.endBulletCam();
      return;
    }
    const fb = BALANCE.feedback;
    // 남은 비행시간 추정
    const remaining = this.estimateRemaining(b);
    this.timeScale = remaining < fb.bulletCamFinalWindow ? fb.bulletCamFinalSlow : Math.max(0.15, Math.min(1, 1.6 / fb.bulletCamDuration));
  }

  private estimateRemaining(b: ActiveBullet): number {
    let best = Infinity;
    const speed = speedOf(b.proj);
    for (const t of this.targets) {
      if (!t.active || t.done) continue;
      const d = Math.hypot(t.position.x - b.proj.pos.x, t.position.z - b.proj.pos.z);
      best = Math.min(best, d / speed);
    }
    return best;
  }

  private endBulletCam(): void {
    this.camBullet = null;
    this.timeScale = 1;
    this.camHold = 0;
  }

  // ───────────────────────── 장비 ─────────────────────────
  private rangefinderAllowed(): boolean {
    return !!this.mission && this.difficulty.rangefinder && !this.mission.noRangefinder;
  }

  private useRangefinder(): void {
    this.trigger('rangefinder');
    if (!this.rangefinderAllowed()) {
      this.audio.play('dry');
      this.hooks?.onRangefinder(null, false);
      return;
    }
    const q = this.losQuaternion(new THREE.Quaternion());
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const d = this.raycast(this.eye, dir, 2500);
    this.audio.play('beep');
    this.hooks?.onRangefinder(d, true);
    if (d !== null) this.lastRange = d;
  }

  /** 시선 레이: 표적 → 장애물 → 지형 순으로 가장 가까운 거리 */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, max: number): number | null {
    const end = origin.clone().addScaledVector(dir, max);
    let best = Infinity;
    for (const t of this.targets) {
      const h = t.intersect(origin, end);
      if (h) best = Math.min(best, h.t * max);
    }
    for (const box of this.world!.colliders) {
      const t = segmentBox(origin, end, box);
      if (t !== null) best = Math.min(best, t * max);
    }
    const terrain = this.world!.terrain;
    const p = new THREE.Vector3();
    let prev = 0;
    for (let s = 2; s <= Math.min(max, best); s += s < 300 ? 2 : 4) {
      p.copy(origin).addScaledVector(dir, s);
      if (p.y < terrain.height(p.x, p.z)) {
        let lo = prev;
        let hi = s;
        for (let i = 0; i < 10; i++) {
          const mid = (lo + hi) / 2;
          p.copy(origin).addScaledVector(dir, mid);
          if (p.y < terrain.height(p.x, p.z)) hi = mid;
          else lo = mid;
        }
        best = Math.min(best, hi);
        break;
      }
      prev = s;
    }
    return best === Infinity ? null : best;
  }

  private updatePredicted(): void {
    if (!this.difficulty.predictedImpact || this.scopeT < 0.5 || !this.env) {
      this.predicted = null;
      return;
    }
    const q = this.losQuaternion(new THREE.Quaternion());
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const dist = this.raycast(this.eye, f, 2500) ?? this.lastRange;
    const r = new THREE.Vector3().crossVectors(f, UP).normalize();
    const u = new THREE.Vector3().crossVectors(r, f);
    const basis = { f, r, u };
    const muzzle = muzzleFrom(this.eye, basis, this.rifle.weapon.sightHeight);
    const p = createProjectile(this.rifle.params(), muzzle, boreDir(basis, this.rifle.zeroAngle + this.rifle.elevMil / 1000, this.rifle.windMil / 1000));
    const env = this.envAt(this.missionTime);
    const along = (v: V3) => (v.x - this.eye.x) * f.x + (v.y - this.eye.y) * f.y + (v.z - this.eye.z) * f.z;
    while (p.t < 6 && along(p.pos) < dist) stepProjectile(p, env, 0.003);
    const rel = new THREE.Vector3(p.pos.x - this.eye.x, p.pos.y - this.eye.y, p.pos.z - this.eye.z);
    const a = Math.max(1, rel.dot(f));
    this.predicted = { x: (rel.dot(r) / a) * 1000, y: (rel.dot(u) / a) * 1000, dist };
  }

  private updateWindText(): void {
    const mode = this.difficulty.windMeter;
    if (!this.wind || mode === 'none') {
      this.windText = null;
      return;
    }
    if (mode === 'local') {
      const s = this.wind.sample(0, this.missionTime);
      this.windText = `사수 위치 ${s.speed.toFixed(1)}m/s · ${windClock(s.dir)}시 방향`;
      return;
    }
    // 경로 유효 횡풍: 실제 바람으로 계산한 편류 ÷ 1m/s 편류
    const range = Math.max(100, Math.min(1500, this.lastRange));
    const params = { ...this.rifle.params(), stability: 0 };
    const env = this.envAt(this.missionTime);
    const [real] = flatTrajectory(params, env, this.rifle.weapon.sightHeight, this.rifle.zeroAngle, 0, [range], 0.002);
    const unit = flatTrajectory(params, { ...env, windAt: (_x, _y, _z, _t, o) => ((o.x = 1), (o.y = 0), (o.z = 0), o) }, this.rifle.weapon.sightHeight, this.rifle.zeroAngle, 0, [range], 0.002)[0];
    if (!real || !unit || Math.abs(unit.lateral) < 1e-6) return;
    const eff = real.lateral / unit.lateral;
    const arrow = Math.abs(eff) < 0.15 ? '' : eff > 0 ? ' →' : ' ←';
    this.windText = `${Math.round(range)}m 유효 횡풍 ${Math.abs(eff).toFixed(1)}m/s${arrow}`;
  }

  // ───────────────────────── 카메라 ─────────────────────────
  private currentFov(): number {
    if (this.scopeT < 0.5) return BALANCE.camera.baseFov;
    return BALANCE.camera.scopeBaseFov / this.zoom;
  }

  private updateCamera(real: number): void {
    const cam = this.camera;
    if (this.fsm.is('menu', 'briefing', 'loading') || !this.mission) {
      // 메뉴: 사격장을 천천히 둘러보는 배경 카메라
      const t = this.menuT * 0.04;
      const eye = this.world ? this.world.terrain.height(0, 0) + 1.6 : 8;
      cam.position.set(Math.sin(t) * 3, eye, 2);
      cam.fov = 40;
      cam.lookAt(Math.sin(t * 0.7) * 120, eye - 6, -500);
      cam.updateProjectionMatrix();
      return;
    }
    if (this.camBullet) {
      const b = this.camBullet;
      const p = new THREE.Vector3(b.proj.pos.x, b.proj.pos.y, b.proj.pos.z);
      const v = new THREE.Vector3(b.proj.vel.x, b.proj.vel.y, b.proj.vel.z).normalize();
      if (b.done) {
        // 착탄 후: 천천히 돌며 보여준다
        const side = new THREE.Vector3().crossVectors(v, UP).normalize();
        const ang = this.camHold * 0.8;
        const want = p.clone().addScaledVector(v, -3.5).addScaledVector(side, 1.5 + Math.sin(ang)).add(new THREE.Vector3(0, 0.6, 0));
        this.camPos.lerp(want, Math.min(1, real * 3));
        this.camLook.lerp(p, Math.min(1, real * 5));
      } else {
        const side = new THREE.Vector3().crossVectors(v, UP).normalize();
        this.camPos.copy(p).addScaledVector(v, -0.9).addScaledVector(side, 0.25).add(new THREE.Vector3(0, 0.12, 0));
        this.camLook.copy(p).addScaledVector(v, 6);
      }
      cam.position.copy(this.camPos);
      cam.fov = 50;
      cam.lookAt(this.camLook);
      cam.updateProjectionMatrix();
      return;
    }
    cam.position.copy(this.eye);
    this.losQuaternion(cam.quaternion);
    const fov = this.currentFov();
    if (Math.abs(cam.fov - fov) > 1e-4) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    const busyBolt = this.rifle.boltTimer > 0 ? 1 - this.rifle.boltTimer / this.rifle.weapon.boltTime : -1;
    const busyReload = this.rifle.reloadTimer > 0 ? 1 - this.rifle.reloadTimer / this.rifle.weapon.reloadTime : -1;
    if (this.fsm.is('playing')) this.viewModel.update(real, this.scopeT, busyBolt, busyReload, this.rifle.elevMil, this.rifle.windMil, this.shooter.offset);
  }

  // ───────────────────────── 종료 ─────────────────────────
  private fail(reason: string, tip: string): void {
    if (this.ended) return;
    this.ended = true;
    this.audio.play('fail');
    this.endWith(false, reason, tip);
  }

  private finish(success: boolean): void {
    if (this.ended) return;
    this.ended = true;
    this.audio.play('success');
    this.endWith(success);
  }

  private evalObjective(o: ObjectiveDef, cleared: boolean): boolean {
    if (!cleared) return false;
    const s = this.stats;
    switch (o.type) {
      case 'clear':
        return cleared;
      case 'accuracy':
        return s.misses === 0;
      case 'time':
        return this.missionTime <= (o.value ?? 0);
      case 'headshots':
        return s.headshots >= (o.value ?? 1);
      case 'noAlert':
        return s.alerts === 0;
      case 'holdOnly':
        return !s.windDialOnHit;
      case 'maxShots':
        return s.shots <= (o.value ?? 1);
    }
  }

  private endWith(success: boolean, failReason?: string, tip?: string): void {
    const m = this.mission!;
    const save = this.save.data.progress;
    const prev = save.missions[m.id] ?? { stars: [false, false, false] as [boolean, boolean, boolean], bestTime: null, cleared: false };
    const prevStars = [...prev.stars] as [boolean, boolean, boolean];
    const objectives = m.objectives.map((o) => ({ label: o.label, done: this.evalObjective(o, success) }));
    const stars = objectives.map((o) => o.done) as [boolean, boolean, boolean];
    const starsBefore = this.save.totalStars();
    let newBestTime = false;
    if (!m.id.startsWith('daily-')) {
      const merged = prev.stars.map((v, i) => v || stars[i]) as [boolean, boolean, boolean];
      if (success && (prev.bestTime === null || this.missionTime < prev.bestTime)) {
        newBestTime = prev.bestTime !== null;
        prev.bestTime = this.missionTime;
      }
      save.missions[m.id] = { stars: merged, bestTime: prev.bestTime, cleared: prev.cleared || success };
    }
    let score: number | undefined;
    let bestScore: number | undefined;
    if (m.id.startsWith('daily-')) {
      const S = BALANCE.scoring;
      score = 0;
      if (success) {
        score += this.stats.kills * S.killBase + Math.round(this.stats.longest * S.perMeter) * this.stats.kills;
        score += this.stats.headshots * S.headshotBonus;
        score += Math.round(Math.max(0, S.timeBonusWindow - this.missionTime) * S.timeBonusPerSec);
      }
      score -= this.stats.misses * S.missPenalty;
      score = Math.max(0, score);
      const key = m.id.slice(6);
      const prevBest = save.daily[key] ?? 0;
      bestScore = Math.max(prevBest, score);
      save.daily[key] = bestScore;
    }
    save.stats.playSeconds += Math.round(this.missionTime);
    save.firstRun = false;
    const starsAfter = this.save.totalStars();
    const unlocked: string[] = [];
    const U = BALANCE.unlocks;
    if (starsBefore < U.k65 && starsAfter >= U.k65) unlocked.push('새 총기 해금: K-6.5');
    if (starsBefore < U.expert && starsAfter >= U.expert) unlocked.push('새 난이도 해금: 현실');
    if (starsBefore < U.l338 && starsAfter >= U.l338) unlocked.push('새 총기 해금: L-338');
    this.save.save();
    this.input.enabled = false;
    this.input.releaseAll();
    this.input.exitPointerLock();
    this.audio.setWind(0, false);
    this.camBullet = null;
    this.timeScale = 1;
    const result: MissionResult = {
      mission: m,
      success,
      failReason,
      tip: tip ?? this.lastAnalysis?.tip,
      time: this.missionTime,
      shots: this.stats.shots,
      hits: this.stats.hits,
      kills: this.stats.kills,
      headshots: this.stats.headshots,
      longest: this.stats.longest,
      objectives,
      stars,
      prevStars,
      newBestTime,
      score,
      bestScore,
      unlocked,
      lastAnalysis: this.lastAnalysis,
    };
    this.fsm.go('result');
    this.hooks?.onMissionEnd(result);
  }

  /** 사격장 나가기 등 결과 없이 종료 */
  abandon(): void {
    this.save.save();
    this.toMenu();
  }

  // ───────────────────────── HUD ─────────────────────────
  hud(): HudSnapshot {
    const m = this.mission;
    const r = this.rifle;
    const req = this.targets.filter((t) => t.def.required);
    let status = '';
    if (r.reloadTimer > 0) status = '재장전 중';
    else if (r.boltTimer > 0) status = '볼트 조작 중';
    else if (r.totalRounds <= 0 && !r.chambered) status = '탄약 없음';
    else if (r.chambered) status = '장전됨';
    const h = this.renderer.domElement.clientHeight || 720;
    const fov = (this.camera.fov * Math.PI) / 180;
    return {
      missionName: m?.name ?? '',
      time: this.missionTime,
      timeLimit: m?.timeLimit ?? 0,
      targetsLeft: req.filter((t) => !t.done).length,
      targetsTotal: req.length,
      shots: this.stats.shots,
      inMag: r.inMag,
      reserve: r.reserve,
      ammoName: r.ammo.name,
      subsonic: r.ammo.subsonic,
      status,
      elev: r.elevMil,
      wind: r.windMil,
      zoom: this.zoom,
      zoomMin: r.weapon.zoomMin,
      zoomMax: r.weapon.zoomMax,
      breath: this.shooter.breath,
      holding: this.shooter.holding,
      exhausted: this.shooter.exhausted,
      heartRate: this.shooter.heartRate,
      windText: this.windText,
      scopeT: this.camBullet ? 0 : this.scopeT,
      pxPerMil: (h / 2 / Math.tan(fov / 2)) * 0.001,
      predicted: this.predicted,
      restartProgress: this.restartHold / BALANCE.input.restartHoldTime,
      busy: r.busy,
      dopeOpen: this.dopeOpen,
      bulletCam: !!this.camBullet,
      isRange: !!m?.isRange,
      rangefinderAllowed: this.rangefinderAllowed(),
      canSwitchAmmo: r.weapon.ammo.length > 1,
      weaponName: r.weapon.name,
    };
  }

  /**
   * 맨눈 시야에서 남은 표적 위치 표시(훈련병·저격수). 스코프를 보면 숨긴다.
   * 처음 하는 사람이 "어디를 봐야 하는지" 막히지 않게 한다.
   */
  markers(): { x: number; y: number; label: string; alert: boolean }[] {
    if (!this.fsm.is('playing') || this.scopeT > 0.3 || this.camBullet || this.difficulty.id === 'expert') return [];
    const out: { x: number; y: number; label: string; alert: boolean }[] = [];
    const el = this.renderer.domElement;
    const v = new THREE.Vector3();
    for (const t of this.targets) {
      if (!t.active || t.done || (!t.def.required && !this.mission?.isRange)) continue;
      v.copy(t.position);
      v.y += t.isBot ? 2.2 : 1.6 + (t.def.h ?? 0.6);
      v.project(this.camera);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) continue;
      const showDist = this.rangefinderAllowed();
      out.push({
        x: ((v.x + 1) / 2) * el.clientWidth,
        y: ((1 - v.y) / 2) * el.clientHeight,
        label: showDist ? `${Math.round(t.position.distanceTo(this.eye))}m` : '',
        alert: t.alerted,
      });
    }
    return out;
  }

  closeDope(): void {
    this.dopeOpen = false;
  }

  dopeRows() {
    const m = this.mission;
    if (!m) return [];
    return this.rifle.dope(m.atmosphere.altitude, m.atmosphere.temperature, Math.max(600, Math.ceil((this.world?.maxDist ?? 800) / 100) * 100 + 200));
  }

  // ───────────────────────── 테스트 지원 ─────────────────────────
  /** 표적을 정확히 겨냥(테스트·자동 검증용): 터렛에 필요한 보정을 넣고 조준 */
  testAimAt(index: number): boolean {
    const t = this.targets[index];
    if (!t || !this.env) return false;
    const p = t.position.clone();
    p.y += t.isBot ? 1.3 : 0.7 + (t.def.h ?? 0.6) / 2;
    const sol = solveFiringSolution({
      params: this.rifle.params(),
      env: this.envAt(this.missionTime),
      sightHeight: this.rifle.weapon.sightHeight,
      zeroAngle: this.rifle.zeroAngle,
      eye: this.eye,
      target: p,
      targetVel: t.velocity,
    });
    const d = p.clone().sub(this.eye);
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    this.rifle.elevMil = Math.round(sol.elevMil * 1000) / 1000;
    this.rifle.windMil = Math.round(sol.windMil * 1000) / 1000;
    this.testSteady = true;
    this.shooter.offset.x = 0;
    this.shooter.offset.y = 0;
    return true;
  }

  debugStats() {
    return {
      state: this.fsm.state,
      bullets: this.bullets.length,
      fx: this.fx?.stats() ?? null,
      sceneChildren: this.world?.scene.children.length ?? 0,
      targets: this.targets.map((t) => ({ id: t.def.id, done: t.done, state: t.state })),
      stats: { ...this.stats },
      time: this.missionTime,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
    };
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    for (const d of this.disposers) d();
    for (const t of this.targets) t.dispose();
    this.fx?.dispose();
    this.world?.dispose();
    this.viewModel.dispose();
    this.mats.dispose();
    this.renderer.dispose();
  }
}
