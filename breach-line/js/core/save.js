// 저장: 해금·별·설정. 손상되거나 버전이 다르면 조용히 초기값으로 되돌린다.
const KEY = 'breachline.save';
const VERSION = 1;

export function defaultSave() {
  return {
    version: VERSION,
    unlocked: ['m1'],
    stars: {},
    best: {},
    settings: { sens: 1.0, invertY: false, fov: 75, quality: 'auto', volume: 0.8, aimAssist: true },
  };
}

export function validate(raw, missionIds) {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object' || raw.version !== VERSION) return d;
  const out = d;
  if (Array.isArray(raw.unlocked)) out.unlocked = [...new Set(['m1', ...raw.unlocked.filter((x) => missionIds.includes(x))])];
  if (raw.stars && typeof raw.stars === 'object') {
    for (const id of missionIds) { const v = raw.stars[id]; if (Number.isInteger(v) && v >= 0 && v <= 3) out.stars[id] = v; }
  }
  if (raw.best && typeof raw.best === 'object') {
    for (const id of missionIds) { const v = raw.best[id]; if (Number.isFinite(v) && v >= 0 && v <= 100) out.best[id] = v; }
  }
  const s = raw.settings || {};
  if (Number.isFinite(s.sens)) out.settings.sens = Math.min(3, Math.max(0.2, s.sens));
  if (typeof s.invertY === 'boolean') out.settings.invertY = s.invertY;
  if (Number.isFinite(s.fov)) out.settings.fov = Math.min(95, Math.max(60, s.fov));
  if (['auto', 'low', 'mid', 'high'].includes(s.quality)) out.settings.quality = s.quality;
  if (Number.isFinite(s.volume)) out.settings.volume = Math.min(1, Math.max(0, s.volume));
  if (typeof s.aimAssist === 'boolean') out.settings.aimAssist = s.aimAssist;
  return out;
}

export function load(missionIds, storage = globalThis.localStorage) {
  try {
    const txt = storage ? storage.getItem(KEY) : null;
    if (!txt) return defaultSave();
    return validate(JSON.parse(txt), missionIds);
  } catch (_) {
    return defaultSave();
  }
}

export function store(data, storage = globalThis.localStorage) {
  try { if (storage) storage.setItem(KEY, JSON.stringify(data)); return true; } catch (_) { return false; }
}

export const SAVE_KEY = KEY;
