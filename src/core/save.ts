/**
 * 저장: localStorage + 버전 + 스키마 검증.
 * - 접근 불가(사생활 보호 모드 등) → 메모리에서만 동작
 * - 데이터 손상 → 백업 후 기본값으로 복구하고 사용자에게 알림
 * - 알 수 없는/잘못된 타입의 필드 → 해당 필드만 기본값
 */
import type { DifficultyId } from '../config/difficulty';
import { DEFAULT_LOADOUT, getCqb, validParts, type CqbId, type PartChoice } from '../config/sidearms';

export type Action =
  | 'fire'
  | 'scope'
  | 'breath'
  | 'zoomIn'
  | 'zoomOut'
  | 'elevUp'
  | 'elevDown'
  | 'windLeft'
  | 'windRight'
  | 'turretReset'
  | 'rangefinder'
  | 'dope'
  | 'ammo'
  | 'pause'
  | 'restart'
  | 'slot1'
  | 'slot2'
  | 'slot3';

export const ACTION_LABELS: Record<Action, string> = {
  fire: '발사',
  scope: '스코프',
  breath: '숨 참기',
  zoomIn: '배율 +',
  zoomOut: '배율 −',
  elevUp: '위로 보정 ▲',
  elevDown: '아래로 보정 ▼',
  windLeft: '왼쪽 보정 ◀',
  windRight: '오른쪽 보정 ▶',
  turretReset: '보정 0으로',
  rangefinder: '거리측정기',
  dope: '보정표',
  ammo: '탄종 변경',
  pause: '일시정지',
  restart: '재시작(길게)',
  slot1: '저격총(창가에서)',
  slot2: '주무기',
  slot3: '권총',
};

export const DEFAULT_KEYS: Record<Action, string> = {
  fire: 'Mouse0',
  scope: 'Mouse2',
  breath: 'ShiftLeft',
  zoomIn: 'KeyE',
  zoomOut: 'KeyQ',
  elevUp: 'KeyW',
  elevDown: 'KeyS',
  windLeft: 'KeyA',
  windRight: 'KeyD',
  turretReset: 'KeyZ',
  rangefinder: 'KeyF',
  dope: 'Tab',
  ammo: 'KeyX',
  pause: 'KeyP',
  restart: 'KeyR',
  slot1: 'Digit1',
  slot2: 'Digit2',
  slot3: 'Digit3',
};

export type ReticleColor = 'black' | 'red' | 'lime' | 'white';
export type Quality = 'auto' | 'high' | 'medium' | 'low';

export interface Settings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
  mouseSensitivity: number;
  scopedSensitivity: number;
  touchSensitivity: number;
  invertY: boolean;
  reticleColor: ReticleColor;
  breathMode: 'hold' | 'toggle';
  scopeMode: 'toggle' | 'hold';
  bulletCam: 'always' | 'final' | 'off';
  reduceFlashes: boolean;
  screenShake: boolean;
  quality: Quality;
  showHints: boolean;
  difficulty: DifficultyId;
  weapon: string;
  /** 소음기 장착 */
  suppressor: boolean;
  keys: Record<Action, string>;
  /** 실내 장비: 주무기 선택과 총마다 파츠 */
  loadout: { primary: CqbId; parts: Record<CqbId, PartChoice> };
}

export interface MissionProgress {
  stars: [boolean, boolean, boolean];
  bestTime: number | null;
  cleared: boolean;
}

export interface Progress {
  missions: Record<string, MissionProgress>;
  daily: Record<string, number>;
  stats: {
    shots: number;
    hits: number;
    kills: number;
    headshots: number;
    longestHit: number;
    playSeconds: number;
  };
  /** 처음 실행 여부 – 첫 실행이면 '첫 발' 미션으로 바로 안내 */
  firstRun: boolean;
}

export interface SaveData {
  version: number;
  settings: Settings;
  progress: Progress;
}

export const SAVE_KEY = 'longshot.save';
export const SAVE_VERSION = 1;

export function defaultSettings(): Settings {
  return {
    masterVolume: 0.8,
    sfxVolume: 0.9,
    musicVolume: 0.45,
    muted: false,
    mouseSensitivity: 1,
    scopedSensitivity: 1,
    touchSensitivity: 1,
    invertY: false,
    reticleColor: 'black',
    breathMode: 'hold',
    scopeMode: 'toggle',
    bulletCam: 'final',
    reduceFlashes: false,
    screenShake: true,
    quality: 'auto',
    showHints: true,
    difficulty: 'recruit',
    weapon: 'r308',
    suppressor: false,
    keys: { ...DEFAULT_KEYS },
    loadout: { primary: DEFAULT_LOADOUT.primary, parts: { p9: { ...DEFAULT_LOADOUT.parts.p9 }, v45: { ...DEFAULT_LOADOUT.parts.v45 }, c4: { ...DEFAULT_LOADOUT.parts.c4 } } },
  };
}

export function defaultProgress(): Progress {
  return {
    missions: {},
    daily: {},
    stats: { shots: 0, hits: 0, kills: 0, headshots: 0, longestHit: 0, playSeconds: 0 },
    firstRun: true,
  };
}

export function defaultSave(): SaveData {
  return { version: SAVE_VERSION, settings: defaultSettings(), progress: defaultProgress() };
}

/** 기본값의 모양(타입)에 맞는 값만 받아들인다 */
function sanitize<T>(def: T, raw: unknown): T {
  if (def === null || typeof def !== 'object') {
    if (typeof raw === typeof def && (typeof raw !== 'number' || Number.isFinite(raw))) return raw as T;
    return def;
  }
  if (Array.isArray(def)) {
    if (!Array.isArray(raw) || raw.length !== def.length) return def;
    return def.map((d, i) => sanitize(d, raw[i])) as T;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return def;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(def as object)) out[k] = sanitize((def as Record<string, unknown>)[k], (raw as Record<string, unknown>)[k]);
  return out as T;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function validateSave(raw: unknown): SaveData {
  const def = defaultSave();
  if (!raw || typeof raw !== 'object') return def;
  const r = raw as Partial<SaveData>;
  const settings = sanitize(def.settings, r.settings);
  settings.masterVolume = clamp01(settings.masterVolume);
  settings.sfxVolume = clamp01(settings.sfxVolume);
  settings.musicVolume = clamp01(settings.musicVolume);
  settings.mouseSensitivity = Math.min(3, Math.max(0.2, settings.mouseSensitivity));
  settings.scopedSensitivity = Math.min(3, Math.max(0.2, settings.scopedSensitivity));
  settings.touchSensitivity = Math.min(3, Math.max(0.2, settings.touchSensitivity));
  if (!['recruit', 'marksman', 'expert'].includes(settings.difficulty)) settings.difficulty = 'recruit';
  if (!['black', 'red', 'lime', 'white'].includes(settings.reticleColor)) settings.reticleColor = 'black';
  if (!['auto', 'high', 'medium', 'low'].includes(settings.quality)) settings.quality = 'auto';
  if (!['always', 'final', 'off'].includes(settings.bulletCam)) settings.bulletCam = 'final';
  if (!['hold', 'toggle'].includes(settings.breathMode)) settings.breathMode = 'hold';
  if (!['hold', 'toggle'].includes(settings.scopeMode)) settings.scopeMode = 'toggle';
  if (!['v45', 'c4'].includes(settings.loadout.primary)) settings.loadout.primary = 'v45';
  for (const id of ['p9', 'v45', 'c4'] as const) settings.loadout.parts[id] = validParts(getCqb(id), settings.loadout.parts[id]);

  const progress: Progress = sanitize<Progress>({ ...def.progress, missions: {}, daily: {} }, r.progress);
  const rawMissions = (r.progress as Progress | undefined)?.missions;
  if (rawMissions && typeof rawMissions === 'object') {
    for (const [id, m] of Object.entries(rawMissions)) {
      progress.missions[id] = sanitize<MissionProgress>({ stars: [false, false, false], bestTime: 0, cleared: false }, m);
      const bt = (m as MissionProgress | undefined)?.bestTime;
      progress.missions[id].bestTime = typeof bt === 'number' && Number.isFinite(bt) && bt > 0 ? bt : null;
    }
  }
  const rawDaily = (r.progress as Progress | undefined)?.daily;
  if (rawDaily && typeof rawDaily === 'object') {
    for (const [k, v] of Object.entries(rawDaily)) if (typeof v === 'number' && Number.isFinite(v)) progress.daily[k] = v;
  }
  return { version: SAVE_VERSION, settings, progress };
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export class SaveStore {
  data: SaveData;
  /** 불러오기 중 문제가 있었으면 사용자에게 보여줄 메시지 */
  loadWarning: string | null = null;
  private storage: StorageLike | null;

  constructor(storage?: StorageLike | null) {
    this.storage = storage === undefined ? SaveStore.probe() : storage;
    this.data = this.load();
  }

  private static probe(): StorageLike | null {
    try {
      const s = window.localStorage;
      s.setItem('__ls_probe', '1');
      s.getItem('__ls_probe');
      return s;
    } catch {
      return null;
    }
  }

  private load(): SaveData {
    if (!this.storage) {
      this.loadWarning = '브라우저 저장소를 사용할 수 없어 기록이 저장되지 않습니다.';
      return defaultSave();
    }
    let text: string | null = null;
    try {
      text = this.storage.getItem(SAVE_KEY);
    } catch {
      return defaultSave();
    }
    if (!text) return defaultSave();
    try {
      const parsed = JSON.parse(text);
      return validateSave(parsed);
    } catch {
      try {
        this.storage.setItem(`${SAVE_KEY}.corrupt`, text);
      } catch {
        /* 백업 실패는 무시 */
      }
      this.loadWarning = '저장 데이터가 손상되어 초기화했습니다. (손상된 데이터는 백업됨)';
      return defaultSave();
    }
  }

  save(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      /* 용량 초과 등 – 게임 진행은 계속 */
    }
  }

  totalStars(): number {
    let n = 0;
    for (const m of Object.values(this.data.progress.missions)) n += m.stars.filter(Boolean).length;
    return n;
  }

  resetProgress(): void {
    this.data.progress = defaultProgress();
    this.data.progress.firstRun = false;
    this.save();
  }
}
