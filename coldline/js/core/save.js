// 저장: 최고 기록 + 설정. 손상되었거나 이상한 값이면 기본값으로 되돌린다.
const KEY = 'lastnode.save.v1';

export const DEFAULT_SETTINGS = {
  sens: 1.0, touchSens: 1.0, fov: 95, sfx: 0.8, music: 0.5, quality: 'auto', adsToggle: false, shake: 1, dmgNumbers: true,
};

const clampNum = (v, a, b, d) => (typeof v === 'number' && isFinite(v) ? Math.min(b, Math.max(a, v)) : d);

export function sanitize(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const st = s.settings && typeof s.settings === 'object' ? s.settings : {};
  const D = DEFAULT_SETTINGS;
  return {
    best: {
      score: Math.floor(clampNum(s.best?.score, 0, 1e9, 0)),
      wave: Math.floor(clampNum(s.best?.wave, 0, 9999, 0)),
    },
    settings: {
      sens: clampNum(st.sens, 0.2, 3, D.sens),
      touchSens: clampNum(st.touchSens, 0.2, 3, D.touchSens),
      fov: clampNum(st.fov, 75, 110, D.fov),
      sfx: clampNum(st.sfx, 0, 1, D.sfx),
      music: clampNum(st.music, 0, 1, D.music),
      quality: ['auto', 'low', 'mid', 'high'].includes(st.quality) ? st.quality : D.quality,
      adsToggle: typeof st.adsToggle === 'boolean' ? st.adsToggle : D.adsToggle,
      shake: clampNum(st.shake, 0, 1, D.shake),
      dmgNumbers: typeof st.dmgNumbers === 'boolean' ? st.dmgNumbers : D.dmgNumbers,
    },
    runs: Math.floor(clampNum(s.runs, 0, 1e7, 0)),
  };
}

export function load(storage = globalThis.localStorage) {
  try {
    const txt = storage?.getItem(KEY);
    return sanitize(txt ? JSON.parse(txt) : null);
  } catch { return sanitize(null); }
}

export function save(data, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, JSON.stringify(sanitize(data))); return true; } catch { return false; }
}

// 판이 끝났을 때 최고 기록 갱신. 새 기록이면 true
export function recordRun(data, score, wave) {
  data.runs++;
  let newBest = false;
  if (score > data.best.score) { data.best.score = score; newBest = true; }
  if (wave > data.best.wave) { data.best.wave = wave; newBest = true; }
  return newBest;
}

export const SAVE_KEY = KEY;
