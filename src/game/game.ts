/**
 * 게임 본체: 미션 진행 · 사격 · 탄 시뮬레이션 · 판정 · 카메라 · 렌더링.
 * UI는 `hooks`(이벤트)와 `hud()`(매 프레임 상태 스냅샷)로만 게임과 소통한다.
 */
import * as THREE from 'three';
import { BALANCE } from '../config/balance';
import { DIFFICULTIES, type DifficultySpec } from '../config/difficulty';
import type { HintTrigger, MissionDef, ObjectiveDef } from '../config/missions';
import { getWeapon, SUPPRESSOR } from '../config/weapons';
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
import { ROLE_LABEL, Target, TargetMaterials, ZONE_LABEL, type HitResult } from './targets';
import type { Role } from '../config/missions';
import { SHOOTER_GROUND } from './terrain';
import { ViewModel } from './viewmodel';
import { INTERIOR, type Interior, type InteriorGuard } from './interior';
import { segmentBox, World, type QualityLevel } from './world';

export interface HitInfo {
  kind: 'plate' | 'kill' | 'headshot' | 'wound' | 'civilian';
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
  onTag(info: TagInfo): void;
}

export interface TagInfo {
  label: string;
  role: Role | null;
  distance: number;
}

export interface MarkerInfo {
  x: number;
  y: number;
  label: string;
  role: Role | 'plate' | 'unknown' | 'objective' | 'sentry' | 'takedown';
  alert: boolean;
}

export type Phase = 'infil' | 'snipe' | 'exfil';

/** 잠입 구간 HUD 정보 */
export interface StealthHud {
  /** 가장 높은 경비 발각 게이지(0~1) */
  meter: number;
  crouched: boolean;
  /** 지금 할 수 있는 행동 안내 */
  prompt: string | null;
  /** 목표 안내 문구 */
  objective: string;
  /** 경비 수(남은/전체) */
  guardsDown: number;
  guardsTotal: number;
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
  suppressor: boolean;
  /** 시선 방위각(도, 0 = 정면 북쪽, 시계 방향 +) */
  heading: number;
  /** 식별된 사람들의 방위(나침반 표시용) */
  bearings: { bearing: number; role: Role; down: boolean }[];
  /** 사수 위치 바람(나침반 다이얼용): 속도와 불어오는 방향(도, 사격 방향 기준) */
  windNow: { speed: number; fromDeg: number } | null;
  pitchDeg: number;
  /** 최근 탄착 지점(화면 좌표) */
  impact: { x: number; y: number; hit: boolean; fade: number } | null;
  /** 진행 단계: 잠입 → 저격 → 탈출 (건물이 없는 미션은 항상 snipe) */
  phase: Phase;
  stealth: StealthHud | null;
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
  private readonly viewModel: ViewModel;
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
  /** 경로 평균 횡풍(m/s, +오른쪽) – 훈련병 자동 보정용 */
  private effWind = 0;
  /** 최근 탄착 지점(화면 표시용) */
  private lastImpact: { pos: THREE.Vector3; t: number; hit: boolean } | null = null;
  private windTimer = 0;
  private lastRange = 500;
  private camBullet: ActiveBullet | null = null;
  private camHold = 0;
  private readonly camPos = new THREE.Vector3();
  private readonly camLook = new THREE.Vector3();
  private menuT = 0;
  private frameTimes: number[] = [];
  private sizeW = -1;
  private sizeH = -1;
  private qualityChecked = false;
  private eye = new THREE.Vector3(0, SHOOTER_GROUND + BALANCE.camera.eyeHeight, 0);
  private accumulator = 0;
  private rafId = 0;
  private lastFrame = 0;
  private disposers: (() => void)[] = [];
  // 잠입
  phase: Phase = 'snipe';
  /** 플레이어 발 위치(실내) */
  private readonly ppos = new THREE.Vector3();
  private crouched = false;
  private crouchT = 0;
  private bobT = 0;
  private moveAmt = 0;
  private snipeTime = 0;
  private stealth = { maxMeter: 0, suspected: false, takedowns: 0, heardLoud: false, heardMuffled: false, fireTipShown: false };
  private takedownCand: InteriorGuard | null = null;
  private lastSuspicionBeep = 0;
  private phaseHintTimer = 0;
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
    // 영화 같은 대비(ACES 톤매핑) – 노출은 작전 시간대별로 조정
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.id = 'game-canvas';
    this.camera = new THREE.PerspectiveCamera(BALANCE.camera.baseFov, 1, 0.1, 7000);
    this.vmCamera = new THREE.PerspectiveCamera(BALANCE.camera.baseFov, 1, 0.01, 10);
    this.rifle = new RifleState(getWeapon(s.weapon), s.suppressor);
    this.viewModel = new ViewModel(this.renderer);
    this.viewModel.compact = input.isTouch;
    this.viewModel.build(this.rifle.weapon, s.suppressor);
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
    this.fx?.tracers.setScale(this.renderer.getPixelRatio());
    this.resize();
  }

  get qualityLevel(): QualityLevel {
    return this.quality;
  }

  resize(): void {
    const el = this.renderer.domElement.parentElement;
    const w = el?.clientWidth || window.innerWidth;
    const h = el?.clientHeight || window.innerHeight;
    this.sizeW = el?.clientWidth ?? 0;
    this.sizeH = el?.clientHeight ?? 0;
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
    // 휴대폰은 주소창 숨김·전체화면·홈 화면 앱 전환 때 resize 이벤트 없이(또는 레이아웃 전에) 크기가 바뀐다.
    // 크기가 어긋난 채 그리면 화면이 위아래로 찌그러지므로 매 프레임 실제 크기를 확인한다(값 비교만이라 비용 없음).
    const host = this.renderer.domElement.parentElement;
    if (host && (host.clientWidth !== this.sizeW || host.clientHeight !== this.sizeH)) this.resize();
    const playing = this.fsm.is('playing');
    let logicRan = true;
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
      logicRan = n > 0 || !this.fsm.is('playing');
      this.updateBulletCamScale(real);
      this.trackPerformance(real);
    } else if (this.fsm.is('menu', 'briefing', 'loading')) {
      this.menuT += real;
    }
    this.input.endFrame(logicRan);
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
    const key = `${mission.id}:${mission.theme}:${mission.timeOfDay}:${seed}:${this.quality}`;
    if (key !== this.worldKey || !this.world) {
      this.fx?.dispose();
      this.world?.dispose();
      this.world = new World(mission, this.quality, seed);
      this.fx = new Effects((x, z) => this.world!.terrain.height(x, z), this.world.theme.groundLow);
      this.world.scene.add(this.fx.group);
      this.fx.tracers.setScale(this.renderer.getPixelRatio());
      this.worldKey = key;
      const th = this.world.theme;
      this.renderer.toneMappingExposure = th.exposure;
      this.viewModel.setLighting(th.sun, th.hemiSky, th.hemiGround, th.sunIntensity);
    }
  }

  loadMission(mission: MissionDef): void {
    const s = this.save.data.settings;
    this.mission = mission;
    const seed = mission.id.split('').reduce((a, c) => a + c.charCodeAt(0) * 31, 17);
    this.prepareWorld(mission, seed);
    const weaponId = mission.weaponLock ?? s.weapon;
    if (this.rifle.weapon.id !== weaponId || this.rifle.suppressor !== s.suppressor) {
      this.rifle = new RifleState(getWeapon(weaponId), s.suppressor);
      this.viewModel.build(this.rifle.weapon, s.suppressor);
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
    const it = this.interior;
    if (it) {
      const guardOutfit = mission.targets.find((t) => t.kind === 'person' && t.role === 'guard')?.outfit ?? 'guard';
      it.spawnGuards(this.mats.human, guardOutfit);
    }
  }

  /** 이 미션의 잠입 건물 */
  get interior(): Interior | null {
    return this.mission ? (this.world?.interior ?? null) : null;
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

  // ───────────────────────── 잠입 · 탈출 ─────────────────────────
  private keyHint(): { move: string; crouch: string; act: string; scope: string } {
    const k = (a: Parameters<Input['keyLabel']>[0]) => this.input.keyLabel(a);
    return { move: `${k('elevUp')}${k('windLeft')}${k('elevDown')}${k('windRight')}`, crouch: k('breath'), act: k('fire'), scope: k('scope') };
  }

  private phaseHint(): string | null {
    this.phaseHintTimer = 0;
    const touch = this.input.isTouch;
    const k = this.keyHint();
    if (this.phase === 'infil') {
      return touch
        ? '잠입: ◀▲▼▶로 걷고 화면을 끌어 둘러보세요. [숙이기]를 켜면 조용하고 잘 안 보입니다. 경비 뒤에서 [제압]. 목표: ◆ 저격 위치'
        : `잠입: [${k.move}] 이동 · [${k.crouch}] 숙이기(조용·잘 안 보임) · 경비 뒤에서 [${k.act}] 제압. 목표: ◆ 저격 위치`;
    }
    if (this.phase === 'exfil') {
      const heard = this.stealth.heardLoud ? ' 총성을 들은 경비가 저격 위치로 오고 있습니다 – 마주치지 않게!' : '';
      return `탈출: 초록색 ◆ EXIT까지 이동하세요.${heard}`;
    }
    return null;
  }

  private enterNest(): void {
    const it = this.interior;
    if (!it || this.phase !== 'infil') return;
    this.phase = 'snipe';
    const n = it.toWorld(it.nest);
    this.ppos.set(n.x, it.floorY, n.y);
    this.eye.set(n.x, it.floorY + INTERIOR.nestEye, n.y);
    const first = this.mission!.targets[0];
    this.yaw = first ? Math.atan2(-first.x, first.dist) * 0.6 : 0;
    this.pitch = -0.004;
    this.crouched = false;
    this.input.releaseAll();
    it.setObjective(null);
    this.audio.play('bolt', { weight: 0.6 });
    this.hooks?.onToast('저격 위치 확보 – 창밖의 표적을 찾으세요');
    this.trigger('nest');
    this.hintIndex = 0;
    this.showHint();
  }

  private startExfil(): void {
    const it = this.interior;
    if (!it) return;
    this.phase = 'exfil';
    this.scoped = false;
    this.dopeOpen = false;
    this.camBullet = null;
    this.timeScale = 1;
    this.endTimer = -1;
    this.input.releaseAll();
    it.setObjective('exit');
    // 숙인 채로 일어난다(조용히 빠져나가는 것이 기본)
    this.crouched = true;
    this.crouchT = 1;
    this.yaw = Math.PI; // 창문을 등지고 건물 안쪽을 본다
    this.pitch = 0;
    this.audio.play('success', { volume: 0.5 });
    this.hooks?.onToast('목표 제거! 이제 건물을 빠져나가세요');
    this.showHint();
  }

  /** 총성이 실내 경비에게 어떻게 들리는가: 소음기+아음속 = 안 들림, 소음기 = 위치 모름, 그 외 = 위치를 알고 옴 */
  private interiorHearShot(): void {
    const it = this.interior;
    if (!it) return;
    const sup = this.rifle.suppressor;
    const sub = this.rifle.ammo.subsonic;
    if (sup && sub) return;
    const nest = it.toWorld(it.nest);
    if (!sup) {
      it.hearShot('loud', nest);
      if (!this.stealth.heardLoud) this.hooks?.onAlert('건물 안 경비가 총성을 들었습니다! 곧 이쪽으로 옵니다');
      this.stealth.heardLoud = true;
    } else {
      it.hearShot('muffled', nest);
      if (!this.stealth.heardMuffled && !this.stealth.heardLoud) this.hooks?.onToast('경비가 소리를 들었지만 어디서 났는지 모릅니다');
      this.stealth.heardMuffled = true;
    }
  }

  private updateInterior(dt: number, player: { x: number; z: number; crouched: boolean; moving: boolean; hidden: boolean }): void {
    const it = this.interior!;
    const res = it.update(dt, player, this.difficulty.detectMul);
    this.stealth.maxMeter = res.maxMeter;
    if (res.maxMeter > INTERIOR.suspicious) {
      if (!this.stealth.suspected) this.audio.play('beep');
      this.stealth.suspected = true;
    }
    if (res.maxMeter > 0.15 && this.missionTime - this.lastSuspicionBeep > 0.6) {
      this.lastSuspicionBeep = this.missionTime;
      this.audio.play('heartbeat', { volume: 0.4 + res.maxMeter * 0.6 });
    }
    if (res.foundBody) {
      this.audio.play('alert');
      this.hooks?.onAlert(`${res.foundBody.label}이(가) 쓰러진 동료를 발견! 주변을 수색합니다`);
    }
    if (res.detectedBy && !this.ended) {
      this.audio.play('alert');
      const tip =
        this.phase === 'snipe'
          ? '소음기를 달면 총성이 어디서 났는지 모릅니다. 소음기 없이 쏘면 경비가 몇 초 뒤 저격 위치로 옵니다.'
          : '숙이기를 켜면 경비가 알아보는 거리가 12m → 7m로 줄고 발소리도 안 납니다. 경비가 등을 돌렸을 때 지나가세요. 머리 위 ? 표시가 차오르면 바로 숨으세요.';
      this.fail(`${res.detectedBy.label}에게 발각되었습니다.`, tip);
    }
  }

  private updateInfil(dt: number): void {
    const it = this.interior!;
    const inp = this.input;
    this.scoped = false;
    this.scopeT = Math.max(0, this.scopeT - dt / BALANCE.camera.scopeTransition);
    // 숙이기(누를 때마다 켜기/끄기)
    if (inp.consumePressed('breath')) {
      this.crouched = !this.crouched;
      this.trigger('crouch');
    }
    this.crouchT += ((this.crouched ? 1 : 0) - this.crouchT) * Math.min(1, dt * 10);
    // 이동: ▲▼◀▶(W S A D)
    for (const a of ['elevUp', 'elevDown', 'windLeft', 'windRight', 'turretReset', 'dope', 'rangefinder', 'ammo', 'zoomIn', 'zoomOut'] as const) inp.consumePressed(a);
    inp.zoomSteps = 0;
    inp.zoomFactor = 1;
    const fwd = (inp.isDown('elevUp') ? 1 : 0) - (inp.isDown('elevDown') ? 1 : 0);
    const str = (inp.isDown('windRight') ? 1 : 0) - (inp.isDown('windLeft') ? 1 : 0);
    let mx = -Math.sin(this.yaw) * fwd + Math.cos(this.yaw) * str;
    let mz = -Math.cos(this.yaw) * fwd - Math.sin(this.yaw) * str;
    const len = Math.hypot(mx, mz);
    const moving = len > 0.01;
    if (moving) {
      const sp = (this.crouched ? INTERIOR.crouchSpeed : INTERIOR.walkSpeed) / len;
      mx *= sp * dt;
      mz *= sp * dt;
      this.ppos.x += mx;
      this.ppos.z += mz;
      it.collide(this.ppos, INTERIOR.playerRadius);
      this.trigger('move');
    }
    this.moveAmt += ((moving ? 1 : 0) - this.moveAmt) * Math.min(1, dt * 8);
    this.bobT += dt * (this.crouched ? 6 : 9) * this.moveAmt;
    // 제압
    this.takedownCand = it.takedownCandidate(this.ppos.x, this.ppos.z, this.yaw);
    if (inp.consumePressed('fire')) {
      if (this.takedownCand) {
        const g = this.takedownCand;
        g.knockDown();
        this.stealth.takedowns++;
        this.takedownCand = null;
        this.audio.play('botHit', { volume: 0.5 });
        this.viewModel.kick(4, false);
        this.shake = 0.4;
        this.hooks?.onToast(`${g.label} 제압 – 쓰러진 모습을 다른 경비가 보면 수색합니다`);
        this.trigger('takedown');
      } else if (!this.stealth.fireTipShown) {
        this.stealth.fireTipShown = true;
        this.hooks?.onToast(this.input.isTouch ? '실내에서 쏘면 들킵니다. 경비 뒤로 다가가 [제압]을 누르세요' : '실내에서 쏘면 들킵니다. 경비 뒤로 다가가면 제압할 수 있습니다');
      }
    }
    // 저격 위치 · 탈출 지점
    const goal = it.toWorld(this.phase === 'infil' ? it.nest : it.exit);
    const atGoal = Math.hypot(goal.x - this.ppos.x, goal.y - this.ppos.z) < INTERIOR.reachRadius;
    const scopePressed = inp.consumePressed('scope');
    if (this.phase === 'infil' && atGoal && (scopePressed || this.input.isDown('scope'))) {
      this.enterNest();
      return;
    }
    if (this.phase === 'exfil' && atGoal) {
      this.finish(true);
      return;
    }
    this.eye.set(this.ppos.x, it.floorY + INTERIOR.standEye + (INTERIOR.crouchEye - INTERIOR.standEye) * this.crouchT, this.ppos.z);
    this.updateInterior(dt, { x: this.ppos.x, z: this.ppos.z, crouched: this.crouched, moving, hidden: false });
    // 긴 안내문은 잠시 뒤 접는다(목표 줄과 버튼 이름으로 충분)
    this.phaseHintTimer += dt;
    if (this.phaseHintTimer > 14 && this.phaseHintTimer - dt <= 14) this.hooks?.onHint(null);
    // 바깥 세계는 계속 움직인다
    for (const t of this.targets) t.update(dt);
    this.world?.updateFlags(this.wind!, this.missionTime);
    this.fx?.update(dt);
    this.shake = Math.max(0, this.shake - dt * 3);
    if (this.mission!.timeLimit > 0 && this.phase === 'infil') {
      // 제한 시간은 저격 구간만 센다(잠입 중에는 멈춤)
    }
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
    this.lastImpact = null;
    this.predicted = null;
    this.accumulator = 0;
    this.zoom = Math.max(this.rifle.weapon.zoomMin, Math.min(8, this.rifle.weapon.zoomMax));
    // 첫 표적 쪽을 바라보며 시작
    const first = m.targets[0];
    this.yaw = first ? Math.atan2(-first.x, first.dist) * 0.6 : 0;
    this.pitch = -0.004;
    this.lastRange = first ? first.dist : 500;
    this.snipeTime = 0;
    this.crouched = false;
    this.crouchT = 0;
    this.moveAmt = 0;
    this.takedownCand = null;
    this.stealth = { maxMeter: 0, suspected: false, takedowns: 0, heardLoud: false, heardMuffled: false, fireTipShown: false };
    const it = this.interior;
    if (it) {
      it.reset();
      it.setObjective('nest');
      this.phase = 'infil';
      // 숙인 채로 시작(조용히 들어가는 것이 기본)
      this.crouched = true;
      this.crouchT = 1;
      const sp = it.toWorld(it.start);
      this.ppos.set(sp.x, it.floorY, sp.y);
      // 입구에서 건물 안쪽(저격 위치 방향)을 바라보며 시작
      const n = it.toWorld(it.nest);
      this.yaw = Math.atan2(-(n.x - sp.x), -(n.y - sp.y));
      this.pitch = 0;
      this.eye.set(this.ppos.x, it.floorY + INTERIOR.crouchEye, this.ppos.z);
    } else {
      this.phase = 'snipe';
      if (this.world) this.eye.set(0, this.world.terrain.height(0, 0) + BALANCE.camera.eyeHeight, 0);
    }
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
    if (this.phase !== 'snipe') {
      // 실내: 360° 둘러보기
      this.yaw = Math.atan2(Math.sin(this.yaw - dx), Math.cos(this.yaw - dx));
      this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - dy));
    } else if (!this.camBullet) {
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
    if (this.phase !== 'snipe') {
      this.updateInfil(dt);
      return;
    }
    this.snipeTime += dt;

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
      this.hooks?.onToast('보정을 0으로 되돌렸습니다');
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
    this.updateTagging(dt);
    this.checkBodies();
    for (const t of this.targets) {
      const r = t.update(dt);
      if (r.becameAlert) {
        if (t.isCivilian) {
          this.hooks?.onAlert(`민간인이 놀라 달아납니다`);
        } else {
          this.stats.alerts++;
          this.audio.play('alert');
          this.hooks?.onAlert(`${t.def.label ?? '표적'} 경계! 도주 중`);
        }
      }
      if (r.escaped && t.def.required && !this.ended) {
        this.fail(`${t.def.label ?? '표적'}이(가) 엄폐물 뒤로 탈출했습니다.`, '첫 발 이후 나머지 표적은 약 2~3초 뒤 도주합니다. 도주 거리가 긴 표적을 나중에 쏘세요.');
      }
    }

    if (this.interior) this.updateInterior(dt, { x: this.ppos.x, z: this.ppos.z, crouched: true, moving: false, hidden: true });

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

  /** 스코프로 사람을 일정 시간 관측하면 식별 태그를 붙인다 */
  private updateTagging(dt: number): void {
    if (this.scopeT < 0.9 || this.camBullet) {
      for (const t of this.targets) t.observe = Math.max(0, t.observe - dt * 2);
      return;
    }
    const q = this.losQuaternion(new THREE.Quaternion());
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const c = new THREE.Vector3();
    const T = BALANCE.targets;
    for (const t of this.targets) {
      if (!t.isPerson || t.tagged || !t.active || t.isDown) continue;
      c.copy(t.position);
      c.y += 1.2;
      const ang = c.sub(this.eye).normalize().angleTo(f) * 1000;
      if (ang < T.tagObserveMil) {
        t.observe += dt;
        if (t.observe >= T.tagObserveTime) this.tag(t);
      } else t.observe = Math.max(0, t.observe - dt);
    }
  }

  private tag(t: Target): void {
    if (t.tagged) return;
    t.tagged = true;
    this.audio.play('tag', { pitch: t.isCivilian ? 0.8 : t.role === 'hvt' ? 1.25 : 1 });
    this.hooks?.onTag({ label: t.def.label ?? ROLE_LABEL[t.role ?? 'guard'], role: t.role, distance: t.position.distanceTo(this.eye) });
    this.trigger('tag');
  }

  /** 대기·순찰 중인 사람이 근처 시신을 보면 경계한다 */
  private checkBodies(): void {
    const R = BALANCE.targets.bodyDiscoveryRadius;
    for (const body of this.targets) {
      if (!body.isPerson || !body.isDown) continue;
      for (const o of this.targets) {
        if (o === body || !o.isPerson || !o.active || o.alerted || o.isDown) continue;
        if (o.position.distanceTo(body.position) < R && !o.alertPending) {
          o.alert(BALANCE.targets.bodyDiscoveryDelay);
          if (!o.isCivilian) this.hooks?.onAlert(`${o.def.label ?? '경비'}이(가) 시신을 발견했습니다!`);
        }
      }
    }
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
      if (this.endTimer <= 0) {
        if (this.interior) this.startExfil();
        else this.finish(true);
      }
      return;
    }
    if (m.timeLimit > 0 && (this.interior ? this.snipeTime : this.missionTime) > m.timeLimit) {
      this.fail('제한 시간이 끝났습니다.', '표적이 노출되는 순간을 미리 계산해 두고, 보정은 노출 전에 끝내세요.');
      return;
    }
    if (this.rifle.totalRounds <= 0 && this.bullets.length === 0 && !this.rifle.busy) {
      this.fail('탄약을 모두 썼습니다.', this.lastAnalysis?.tip ?? '보정표(표)를 보고 ▲를 거리에 맞게 누른 뒤 쏘세요.');
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
    if (this.phase !== 'snipe') {
      this.hooks?.onHint(this.phaseHint());
      return;
    }
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
    this.interiorHearShot();
    this.save.data.progress.stats.shots++;
    this.rifle.fire();
    this.shooter.onShot();
    const sup = this.rifle.suppressor;
    const kick = w.recoilKick * (sup ? SUPPRESSOR.recoilMul : 1);
    this.recoilV += kick * 9;
    const flash = !sup && !ammo.subsonic;
    this.viewModel.kick(kick * 0.35, flash && !this.save.data.settings.reduceFlashes);
    if (this.save.data.settings.screenShake) this.shake = Math.min(1, kick / 10);
    this.audio.play(sup ? 'shotSup' : ammo.subsonic ? 'shotSub' : 'shot', { weight: w.loudness, volume: sup && ammo.subsonic ? 0.6 : 1 });
    if (flash) this.hooks?.onMuzzleFlash();
    this.trigger('fire');

    // 총성 전파 → 표적 경계 (소음기 × 탄종 규칙)
    const H = BALANCE.targets.hearRadius;
    const radius = ammo.subsonic ? (sup ? H.subSuppressed : H.sub) : sup ? H.stdSuppressed : H.std;
    const slow = sup && !ammo.subsonic ? BALANCE.targets.suppressedReactionMul : 1;
    for (const t of this.targets) {
      if (!t.isPerson || !t.active) continue;
      const d = t.position.distanceTo(this.eye);
      if (d > radius) continue;
      t.alert(d / BALANCE.targets.speedOfSound + (t.reaction * slow) / w.loudness);
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
      const pts = t.isPerson
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
    if (!pred || !pred.target.isPerson || pred.target.isCivilian || pred.zone === 'arm' || pred.zone === 'leg') return false;
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
    this.lastImpact = { pos: at.clone(), t: performance.now(), hit: false };
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
    if (this.lastImpact) this.lastImpact.hit = true;
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
    if (!t.isPerson) {
      this.fx!.impactSteel(hit.point, dist);
      this.audio.play('impactSteel', { delay: soundDelay, volume: Math.max(0.35, 1 - dist / 2000), pan });
      this.hooks?.onHit({ kind: 'plate', title: '명중!', detail: `${t.def.label ?? '강철판'} · ${Math.round(dist)}m · 비행 ${b.proj.t.toFixed(2)}초` });
      if (!b.cam) this.hitStop = fb.hitStop;
    } else if (killed) {
      const head = hit.zone === 'head';
      this.fx!.personDown(hit.point, t.position, vel.clone().normalize(), dist);
      this.audio.play('botHit', { delay: soundDelay, volume: Math.max(0.4, 1 - dist / 2000), pan });
      if (t.isCivilian) {
        // 민간인 사살: 작전 즉시 중단
        this.hooks?.onHit({ kind: 'civilian', title: '민간인 사살', detail: `${t.def.label ?? '민간인'} · 작전이 중단됩니다` });
        this.fail('민간인을 사살했습니다. 작전이 중단됐습니다.', '쏘기 전에 스코프로 1초 관측해 식별 태그를 확인하세요. 브리핑의 표적 특징(옷 색)과 비교하세요.');
        this.trigger('hit');
        return;
      }
      this.stats.kills++;
      this.save.data.progress.stats.kills++;
      if (head) {
        this.stats.headshots++;
        this.save.data.progress.stats.headshots++;
      }
      if (head) this.audio.play('headshot', { delay: 0.05 });
      const hvt = t.role === 'hvt';
      this.hooks?.onHit({
        kind: head ? 'headshot' : 'kill',
        title: head ? '헤드샷' : hvt ? '표적 제거' : '제거',
        detail: `${t.def.label ?? '표적'} · ${ZONE_LABEL[hit.zone]} · ${Math.round(dist)}m · ${Math.round(energy)}J`,
      });
      if (!b.cam) this.hitStop = head ? fb.headshotHitStop : fb.hitStop;
      // 목격 → 경계
      for (const o of this.targets) {
        if (o === t || !o.isPerson || !o.active) continue;
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

  /** 아음속탄 착탄음: 근처 사람만 듣는다 */
  private alertNear(p: THREE.Vector3): void {
    for (const t of this.targets) {
      if (!t.isPerson || !t.active) continue;
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
    if (d !== null) {
      this.lastRange = d;
      if (this.difficulty.id === 'recruit') this.autoDial(d);
      const end = this.eye.clone().addScaledVector(dir, d + 0.5);
      for (const t of this.targets) if (t.isPerson && !t.tagged && t.intersect(this.eye, end)) this.tag(t);
    }
  }

  /**
   * 훈련병 전용: 잰 거리에 맞춰 위아래·좌우 보정을 자동으로 맞춘다.
   * 처음 하는 사람이 계산 없이 "찾기 → 거리 재기 → 숨 참고 쏘기"만으로 맞힐 수 있게 한다.
   */
  private autoDial(dist: number): void {
    const rows = this.dopeRows();
    if (!rows.length) return;
    let lo = rows[0];
    let hi = rows[rows.length - 1];
    for (let i = 0; i < rows.length - 1; i++) {
      if (rows[i].range <= dist && rows[i + 1].range >= dist) {
        lo = rows[i];
        hi = rows[i + 1];
        break;
      }
    }
    const f = hi.range === lo.range ? 0 : Math.max(0, Math.min(1, (dist - lo.range) / (hi.range - lo.range)));
    const lerp = (a: number, b: number) => a + (b - a) * f;
    // 바람 정보 갱신 후 보정(바람이 오른쪽으로 밀면 왼쪽으로 겨눠야 한다)
    this.lastRange = dist;
    this.updateWindText();
    const elev = Math.max(0, lerp(lo.elevationMil, hi.elevationMil));
    const wind = -(this.effWind * lerp(lo.windPerMpsMil, hi.windPerMpsMil) + lerp(lo.spinMil, hi.spinMil));
    this.rifle.elevMil = 0;
    this.rifle.windMil = 0;
    this.rifle.dialElev(Math.round(elev * 10));
    this.rifle.dialWind(Math.round(wind * 10));
    this.audio.play('turret');
    this.audio.play('turret', { delay: 0.06 });
    const w = Math.round(this.rifle.windMil * 10);
    this.hooks?.onToast(`자동 보정: ${Math.round(dist)}m → ▲${Math.round(this.rifle.elevMil * 10)}칸${w ? ` · ${w < 0 ? '◀' : '▶'}${Math.abs(w)}칸` : ''}`);
    this.trigger('dope');
    this.trigger('turretElev');
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
      this.windText = `바람 ${s.speed.toFixed(1)}m/s · ${windClock(s.dir)}시 쪽에서`;
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
    this.effWind = eff;
    this.windText = Math.abs(eff) < 0.15 ? '바람 거의 없음' : `바람 ${Math.abs(eff).toFixed(1)}m/s · 탄이 ${eff > 0 ? '오른쪽 →' : '← 왼쪽'}으로 밀림`;
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
      const inside = !!this.world?.interior;
      const eye = this.world ? this.world.terrain.height(0, 0) + (inside ? INTERIOR.nestEye : 1.6) : 8;
      // 건물이 있는 미션: 창가에서 내다보는 장면
      cam.position.set(inside ? 0 : Math.sin(t) * 3, eye, inside ? 0.1 : 2);
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
    if (this.phase !== 'snipe') {
      // 실내 1인칭: 걸음에 따른 흔들림
      const bob = Math.sin(this.bobT) * 0.035 * this.moveAmt;
      cam.position.copy(this.eye);
      cam.position.y += Math.abs(bob) - 0.02 * this.moveAmt;
      const sh = this.shake * 0.01;
      cam.quaternion.setFromEuler(new THREE.Euler(this.pitch + (Math.random() - 0.5) * sh, this.yaw + (Math.random() - 0.5) * sh, Math.sin(this.bobT * 0.5) * 0.006 * this.moveAmt, 'YXZ'));
      if (Math.abs(cam.fov - BALANCE.camera.baseFov) > 1e-4) {
        cam.fov = BALANCE.camera.baseFov;
        cam.updateProjectionMatrix();
      }
      if (this.fsm.is('playing')) {
        const sw = { x: Math.sin(this.bobT * 0.5) * 6 * this.moveAmt, y: (Math.abs(Math.sin(this.bobT)) * 5 - 6) * this.moveAmt - 8 * this.crouchT };
        this.viewModel.update(real, 0, -1, -1, this.rifle.elevMil, this.rifle.windMil, sw);
      }
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
      case 'ghost':
        return !this.stealth.suspected;
      case 'noTakedown':
        return this.stealth.takedowns === 0;
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
    if (r.reloadTimer > 0) status = '탄창 교체 중';
    else if (r.boltTimer > 0) status = '장전 중';
    else if (r.totalRounds <= 0 && !r.chambered) status = '탄약 없음';
    else if (r.chambered) status = '장전됨';
    const h = this.renderer.domElement.clientHeight || 720;
    const fov = (this.camera.fov * Math.PI) / 180;
    return {
      missionName: m?.name ?? '',
      // 제한 시간이 있는 잠입 작전은 창가에 자리 잡은 뒤부터 센다
      time: this.interior && (m?.timeLimit ?? 0) > 0 ? this.snipeTime : this.missionTime,
      timeLimit: this.interior && this.phase !== 'snipe' ? 0 : (m?.timeLimit ?? 0),
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
      suppressor: r.suppressor,
      heading: ((-this.yaw * 180) / Math.PI + 360) % 360,
      bearings: this.targets
        .filter((t) => t.isPerson && t.tagged && t.state !== 'escaped')
        .map((t) => ({
          bearing: ((Math.atan2(t.position.x - this.eye.x, -(t.position.z - this.eye.z)) * 180) / Math.PI + 360) % 360,
          role: t.role!,
          down: t.isDown,
        })),
      windNow: this.wind && this.difficulty.windMeter !== 'none' ? (() => {
        const w = this.wind!.sample(0, this.missionTime);
        return { speed: w.speed, fromDeg: (w.dir + 180) % 360 };
      })() : null,
      pitchDeg: (this.pitch * 180) / Math.PI,
      impact: this.impactOnScreen(),
      phase: this.phase,
      stealth: this.stealthHud(),
    };
  }

  private stealthHud(): StealthHud | null {
    const it = this.interior;
    if (!it) return null;
    const touch = this.input.isTouch;
    const k = this.keyHint();
    let prompt: string | null = null;
    let objective: string;
    if (this.phase === 'infil') {
      const n = it.toWorld(it.nest);
      const d = Math.hypot(n.x - this.ppos.x, n.y - this.ppos.z);
      objective = `잠입 · ◆ 저격 위치까지 ${Math.round(d)}m`;
      if (d < INTERIOR.reachRadius) prompt = touch ? '[저격] 눌러 창가에 자리 잡기' : `[${k.scope}] 창가에 자리 잡기`;
    } else if (this.phase === 'exfil') {
      const e = it.toWorld(it.exit);
      objective = `탈출 · ◆ EXIT까지 ${Math.round(Math.hypot(e.x - this.ppos.x, e.y - this.ppos.z))}m`;
    } else objective = '저격';
    if (this.takedownCand && this.phase !== 'snipe') prompt = touch ? `[제압] ${this.takedownCand.label} 쓰러뜨리기` : `[${k.act}] ${this.takedownCand.label} 제압`;
    return {
      meter: this.stealth.maxMeter,
      crouched: this.crouched,
      prompt,
      objective,
      guardsDown: it.guards.filter((g) => g.down).length,
      guardsTotal: it.guards.length,
    };
  }

  /**
   * 맨눈 시야의 표적 표시. 식별(태그)된 사람만 보인다 – 관측이 먼저다.
   * 훈련병 난이도는 아직 식별하지 않은 필수 표적도 "?"로 보여줘 처음 하는 사람이 막히지 않게 한다.
   */
  markers(): MarkerInfo[] {
    if (!this.fsm.is('playing') || this.scopeT > 0.3 || this.camBullet) return [];
    if (this.phase !== 'snipe') return this.interiorMarkers();
    const out: MarkerInfo[] = [];
    const el = this.renderer.domElement;
    const v = new THREE.Vector3();
    const expert = this.difficulty.id === 'expert';
    const showDist = this.rangefinderAllowed();
    for (const t of this.targets) {
      if (!t.isPerson && (t.done || expert)) continue;
      if (t.isPerson && (t.state === 'escaped' || t.isDown)) continue;
      if (!t.isPerson && !t.def.required && !this.mission?.isRange) continue;
      const unknownHint = t.isPerson && !t.tagged && t.def.required && this.difficulty.id === 'recruit';
      if (t.isPerson && !t.tagged && !unknownHint) continue;
      v.copy(t.position);
      v.y += t.isPerson ? 2.25 : 1.6 + (t.def.h ?? 0.6);
      v.project(this.camera);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) continue;
      const d = `${Math.round(t.position.distanceTo(this.eye))}m`;
      const role: MarkerInfo['role'] = !t.isPerson ? 'plate' : unknownHint ? 'unknown' : t.role!;
      const name = role === 'plate' ? '' : role === 'unknown' ? '?' : role === 'civilian' ? '민간인' : (t.def.label ?? ROLE_LABEL[role]);
      out.push({
        x: ((v.x + 1) / 2) * el.clientWidth,
        y: ((1 - v.y) / 2) * el.clientHeight,
        label: [name, showDist ? d : ''].filter(Boolean).join(' · '),
        role,
        alert: t.alerted,
      });
    }
    // 서로 붙어 있는 표적은 글자가 겹친다 → 가까운 쪽만 이름을 남긴다
    out.sort((a, b) => a.y - b.y);
    for (let i = 0; i < out.length; i++) {
      for (let j = 0; j < i; j++) {
        if (out[j].label && Math.abs(out[i].x - out[j].x) < 70 && Math.abs(out[i].y - out[j].y) < 18) {
          out[i].label = '';
          break;
        }
      }
    }
    return out;
  }

  /** 실내: 목표 지점 + 나를 의심하는 경비(벽 너머도 표시) + 제압 가능 표시 */
  private interiorMarkers(): MarkerInfo[] {
    const it = this.interior;
    if (!it) return [];
    const el = this.renderer.domElement;
    const W = el.clientWidth, H = el.clientHeight;
    const out: MarkerInfo[] = [];
    const v = new THREE.Vector3();
    const place = (x: number, y: number, z: number, clamp: boolean): { x: number; y: number } | null => {
      v.set(x, y, z).project(this.camera);
      const behind = v.z > 1;
      if (behind) {
        if (!clamp) return null;
        v.x = -v.x;
        v.y = -1;
      }
      if (!clamp && (Math.abs(v.x) > 1 || Math.abs(v.y) > 1)) return null;
      const m = 0.9;
      const sx = Math.max(-m, Math.min(m, v.x));
      const sy = Math.max(-m, Math.min(m, v.y));
      return { x: ((sx + 1) / 2) * W, y: ((1 - sy) / 2) * H };
    };
    const goalCell = this.phase === 'infil' ? it.nest : it.exit;
    const g = it.toWorld(goalCell);
    const gp = place(g.x, it.floorY + 1.1, g.y, true);
    if (gp) {
      const d = Math.round(Math.hypot(g.x - this.ppos.x, g.y - this.ppos.z));
      out.push({ ...gp, label: `${this.phase === 'infil' ? '저격 위치' : 'EXIT'} ${d}m`, role: 'objective', alert: this.phase === 'exfil' });
    }
    for (const gd of it.guards) {
      if (gd.down) continue;
      const cand = gd === this.takedownCand;
      const aware = gd.meter > 0.03 || gd.state === 'search' || gd.state === 'listen';
      if (!aware && !cand) continue;
      const p = place(gd.pos.x, gd.pos.y + 2.15, gd.pos.z, aware);
      if (!p) continue;
      out.push({ ...p, label: cand ? '제압' : gd.meter > 0.7 ? '!' : '?', role: cand ? 'takedown' : 'sentry', alert: gd.meter > 0.7 });
    }
    return out;
  }

  /** 최근 탄착 지점의 화면 좌표(2.5초 동안) */
  private impactOnScreen(): { x: number; y: number; hit: boolean; fade: number } | null {
    const li = this.lastImpact;
    if (!li || this.camBullet) return null;
    const age = (performance.now() - li.t) / 1000;
    if (age > 2.5) return null;
    const v = li.pos.clone().project(this.camera);
    if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) return null;
    const el = this.renderer.domElement;
    return { x: ((v.x + 1) / 2) * el.clientWidth, y: ((1 - v.y) / 2) * el.clientHeight, hit: li.hit, fade: 1 - Math.max(0, age - 1.8) / 0.7 };
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
  /** 테스트용: 잠입 구간을 건너뛰고 바로 저격 위치로 */
  testSkipInfil(): void {
    if (this.phase === 'infil') this.enterNest();
  }

  testAimAt(index: number): boolean {
    this.testSkipInfil();
    const t = this.targets[index];
    if (!t || !this.env) return false;
    const p = t.position.clone();
    p.y += t.isPerson ? 1.3 : 0.7 + (t.def.h ?? 0.6) / 2;
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
