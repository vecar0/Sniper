/**
 * 실내(근접) 화기와 부착물(파츠).
 * 저격총은 창가 저격 위치에서만 쓰고, 건물 안에서는 권총 + 주무기(기관단총 또는 카빈)를 쓴다.
 * 파츠는 모두 "얻는 것과 잃는 것"이 함께 있어 정답 조합이 하나로 고정되지 않게 했다.
 */

export type CqbId = 'p9' | 'v45' | 'c4';
export type PartSlot = 'muzzle' | 'optic' | 'mag' | 'under';

/** 파츠가 바꾸는 값(곱셈) */
export interface PartMods {
  damage?: number;
  /** 총성이 들리는 거리 */
  noise?: number;
  /** 허리 사격 탄 퍼짐 */
  hipSpread?: number;
  /** 조준 사격 탄 퍼짐 */
  adsSpread?: number;
  recoil?: number;
  magazine?: number;
  reload?: number;
  /** 조준 전환 시간 */
  adsTime?: number;
  /** 경비가 나를 알아보는 속도(레이저 빛) */
  detect?: number;
}

export interface PartSpec {
  id: string;
  slot: PartSlot;
  name: string;
  /** 한 줄 설명(장점 · 단점) */
  desc: string;
  mods: PartMods;
  /** 조준 배율(조준경 슬롯만) */
  adsZoom?: number;
}

export interface CqbSpec {
  id: CqbId;
  name: string;
  kind: 'pistol' | 'smg' | 'carbine';
  kindName: string;
  desc: string;
  /** 몸통 한 발 피해(경비 체력 100) */
  damage: number;
  /** 머리 배율 */
  headMul: number;
  /** 분당 발사 수 */
  rpm: number;
  /** 연발(누르고 있으면 계속) */
  auto: boolean;
  magazine: number;
  /** 예비 탄 */
  reserve: number;
  reloadTime: number;
  /** 탄 퍼짐(도, 원뿔 반각) */
  hipSpread: number;
  adsSpread: number;
  /** 한 발 반동(도, 위로 튐) */
  recoil: number;
  /** 총성이 들리는 거리(m) – 이 안의 경비가 소리 난 곳으로 온다 */
  noise: number;
  adsTime: number;
  /** 쓸 수 있는 파츠 */
  parts: Record<PartSlot, string[]>;
  color: number;
}

export const PARTS: PartSpec[] = [
  { id: 'none', slot: 'muzzle', name: '없음', desc: '기본 총구', mods: {} },
  { id: 'sup', slot: 'muzzle', name: '소음기', desc: '총성이 매우 작아짐 · 위력 −8%', mods: { noise: 0.15, damage: 0.92 } },
  { id: 'comp', slot: 'muzzle', name: '보정기', desc: '반동 −30% · 총성이 더 큼', mods: { recoil: 0.7, noise: 1.2 } },
  { id: 'iron', slot: 'optic', name: '가늠쇠', desc: '기본 조준 · 조준이 빠름', mods: {}, adsZoom: 1.2 },
  { id: 'dot', slot: 'optic', name: '도트 사이트', desc: '빠른 조준 · 조준 사격 퍼짐 −20%', mods: { adsSpread: 0.8, adsTime: 0.9 }, adsZoom: 1.35 },
  { id: 'x2', slot: 'optic', name: '2배 조준경', desc: '멀리 정확 · 조준이 느리고 시야가 좁음', mods: { adsSpread: 0.6, adsTime: 1.45 }, adsZoom: 2.1 },
  { id: 'std', slot: 'mag', name: '기본 탄창', desc: '기본 장탄 · 빠른 재장전', mods: {} },
  { id: 'ext', slot: 'mag', name: '확장 탄창', desc: '장탄 +50% · 재장전 +25% 느림', mods: { magazine: 1.5, reload: 1.25 } },
  { id: 'none', slot: 'under', name: '없음', desc: '기본', mods: {} },
  { id: 'laser', slot: 'under', name: '레이저', desc: '허리 사격 퍼짐 −45% · 빛 때문에 경비가 조금 더 빨리 알아챔', mods: { hipSpread: 0.55, detect: 1.15 } },
  { id: 'grip', slot: 'under', name: '수직 손잡이', desc: '반동 −25% · 조준이 조금 느림', mods: { recoil: 0.75, adsTime: 1.1 } },
];

export const CQB_WEAPONS: CqbSpec[] = [
  {
    id: 'p9',
    name: 'P9',
    kind: 'pistol',
    kindName: '권총',
    desc: '항상 휴대. 한 발씩, 꺼내기가 빠르다.',
    damage: 34,
    headMul: 4,
    rpm: 360,
    auto: false,
    magazine: 12,
    reserve: 36,
    reloadTime: 1.4,
    hipSpread: 1.6,
    adsSpread: 0.45,
    recoil: 1.6,
    noise: 22,
    adsTime: 0.16,
    parts: { muzzle: ['none', 'sup'], optic: ['iron', 'dot'], mag: ['std', 'ext'], under: ['none', 'laser'] },
    color: 0x2a2c30,
  },
  {
    id: 'v45',
    name: 'V45',
    kind: 'smg',
    kindName: '기관단총',
    desc: '빠른 연사 · 가까운 거리에 강함. 멀면 퍼진다.',
    damage: 24,
    headMul: 3.5,
    rpm: 800,
    auto: true,
    magazine: 30,
    reserve: 90,
    reloadTime: 2.0,
    hipSpread: 2.4,
    adsSpread: 0.9,
    recoil: 0.9,
    noise: 26,
    adsTime: 0.2,
    parts: { muzzle: ['none', 'sup', 'comp'], optic: ['iron', 'dot', 'x2'], mag: ['std', 'ext'], under: ['none', 'laser', 'grip'] },
    color: 0x34373b,
  },
  {
    id: 'c4',
    name: 'C4 카빈',
    kind: 'carbine',
    kindName: '카빈',
    desc: '한 발이 강하고 정확 · 반동과 총성이 크다.',
    damage: 38,
    headMul: 3,
    rpm: 650,
    auto: true,
    magazine: 30,
    reserve: 60,
    reloadTime: 2.4,
    hipSpread: 3.0,
    adsSpread: 0.3,
    recoil: 1.5,
    noise: 38,
    adsTime: 0.26,
    parts: { muzzle: ['none', 'sup', 'comp'], optic: ['iron', 'dot', 'x2'], mag: ['std', 'ext'], under: ['none', 'laser', 'grip'] },
    color: 0x4a4d3c,
  },
];

export type PartChoice = Record<PartSlot, string>;

export const PART_SLOTS: { slot: PartSlot; name: string }[] = [
  { slot: 'muzzle', name: '총구' },
  { slot: 'optic', name: '조준기' },
  { slot: 'mag', name: '탄창' },
  { slot: 'under', name: '하부' },
];

export function getCqb(id: string): CqbSpec {
  return CQB_WEAPONS.find((w) => w.id === id) ?? CQB_WEAPONS[0];
}

export function getPart(slot: PartSlot, id: string): PartSpec {
  return PARTS.find((p) => p.slot === slot && p.id === id) ?? PARTS.find((p) => p.slot === slot)!;
}

/** 저장 데이터에 이상한 값이 있어도 그 총이 쓸 수 있는 파츠로 고친다 */
export function validParts(w: CqbSpec, choice: Partial<PartChoice> | undefined): PartChoice {
  const out = {} as PartChoice;
  for (const { slot } of PART_SLOTS) {
    const want = choice?.[slot];
    out[slot] = want && w.parts[slot].includes(want) ? want : w.parts[slot][0];
  }
  return out;
}

/** 파츠를 반영한 최종 수치 */
export interface CqbStats {
  damage: number;
  headMul: number;
  interval: number;
  auto: boolean;
  magazine: number;
  reserve: number;
  reloadTime: number;
  hipSpread: number;
  adsSpread: number;
  recoil: number;
  noise: number;
  adsTime: number;
  adsZoom: number;
  detect: number;
  suppressed: boolean;
}

export function cqbStats(w: CqbSpec, parts: PartChoice): CqbStats {
  const m: Required<PartMods> = { damage: 1, noise: 1, hipSpread: 1, adsSpread: 1, recoil: 1, magazine: 1, reload: 1, adsTime: 1, detect: 1 };
  let zoom = 1.2;
  for (const { slot } of PART_SLOTS) {
    const p = getPart(slot, parts[slot]);
    for (const [k, v] of Object.entries(p.mods) as [keyof PartMods, number][]) m[k] *= v;
    if (p.adsZoom) zoom = p.adsZoom;
  }
  const magazine = Math.round(w.magazine * m.magazine);
  return {
    damage: w.damage * m.damage,
    headMul: w.headMul,
    interval: 60 / w.rpm,
    auto: w.auto,
    magazine,
    reserve: Math.round(w.reserve * m.magazine),
    reloadTime: w.reloadTime * m.reload,
    hipSpread: w.hipSpread * m.hipSpread,
    adsSpread: w.adsSpread * m.adsSpread,
    recoil: w.recoil * m.recoil,
    noise: w.noise * m.noise,
    adsTime: w.adsTime * m.adsTime,
    adsZoom: zoom,
    detect: m.detect,
    suppressed: parts.muzzle === 'sup',
  };
}

export const DEFAULT_LOADOUT = {
  primary: 'v45' as CqbId,
  parts: {
    p9: { muzzle: 'sup', optic: 'iron', mag: 'std', under: 'none' } as PartChoice,
    v45: { muzzle: 'none', optic: 'dot', mag: 'std', under: 'none' } as PartChoice,
    c4: { muzzle: 'none', optic: 'dot', mag: 'std', under: 'grip' } as PartChoice,
  },
};
