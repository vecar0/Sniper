import { Color } from 'three';
import type { ThemeId, TimeOfDay } from '../config/missions';

export interface ThemeColors {
  name: string;
  skyTop: number;
  skyHorizon: number;
  fog: number;
  groundLow: number;
  groundHigh: number;
  rock: number;
  treeTrunk: number;
  treeLeaf: number[];
  treeDensity: number;
  /** 나무 모양: 침엽수 / 활엽수 / 선인장 */
  treeShape: 'pine' | 'round' | 'cactus';
  sun: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
}

/** 로우폴리 스타일 팔레트. 표적(주황·흰색)이 모든 배경에서 잘 보이도록 배경은 채도를 낮춘다. */
export const THEMES: Record<ThemeId, ThemeColors> = {
  plains: {
    name: '초원',
    skyTop: 0x5d8fc9,
    skyHorizon: 0xcfdde6,
    fog: 0xc5d4dc,
    groundLow: 0x7b9450,
    groundHigh: 0x5f7a3f,
    rock: 0x8d8a80,
    treeTrunk: 0x5b4632,
    treeLeaf: [0x4f7a3a, 0x5c8a44, 0x466e34],
    treeDensity: 1,
    treeShape: 'round',
    sun: 0xfff1d6,
    sunIntensity: 2.2,
    hemiSky: 0xbcd6f0,
    hemiGround: 0x6a7a48,
  },
  desert: {
    name: '사막',
    skyTop: 0x6f9fd0,
    skyHorizon: 0xeedfc6,
    fog: 0xe6d6bb,
    groundLow: 0xcfb07a,
    groundHigh: 0xb98f5c,
    rock: 0xa86e4c,
    treeTrunk: 0x6b8a4a,
    treeLeaf: [0x6b8a4a, 0x5e7d42],
    treeDensity: 0.25,
    treeShape: 'cactus',
    sun: 0xfff0d0,
    sunIntensity: 2.6,
    hemiSky: 0xd6e4f2,
    hemiGround: 0xb08a5a,
  },
  forest: {
    name: '숲',
    skyTop: 0x5a86b8,
    skyHorizon: 0xc4d3d6,
    fog: 0xb6c6c4,
    groundLow: 0x5f7c40,
    groundHigh: 0x4a6534,
    rock: 0x7c7c74,
    treeTrunk: 0x4d3a28,
    treeLeaf: [0x2f5a32, 0x3a6a3a, 0x284e2c],
    treeDensity: 2.2,
    treeShape: 'pine',
    sun: 0xffeccc,
    sunIntensity: 2.0,
    hemiSky: 0xb0c8dc,
    hemiGround: 0x4a5a34,
  },
  snow: {
    name: '설원',
    skyTop: 0x7d9cbe,
    skyHorizon: 0xdfe7ee,
    fog: 0xd8e1e8,
    groundLow: 0xe9eef2,
    groundHigh: 0xd2dbe2,
    rock: 0x6f7378,
    treeTrunk: 0x4a3a2c,
    treeLeaf: [0x2e4a3a, 0x355544],
    treeDensity: 1.3,
    treeShape: 'pine',
    sun: 0xfff6ea,
    sunIntensity: 1.8,
    hemiSky: 0xd8e4f0,
    hemiGround: 0xb8c4cc,
  },
  mountain: {
    name: '산악',
    skyTop: 0x4f7fb8,
    skyHorizon: 0xc9d6e0,
    fog: 0xbfcdd8,
    groundLow: 0x7a8656,
    groundHigh: 0x8a8678,
    rock: 0x86827a,
    treeTrunk: 0x4d3a28,
    treeLeaf: [0x345a3a, 0x3e6642],
    treeDensity: 0.8,
    treeShape: 'pine',
    sun: 0xfff0dc,
    sunIntensity: 2.3,
    hemiSky: 0xbcd0e6,
    hemiGround: 0x6e6a5a,
  },
};



export interface Atmosphere extends ThemeColors {
  timeName: string;
  /** 태양 방향(단위 벡터 근사, 사수 기준) */
  sunDir: [number, number, number];
  sunDisc: number;
  /** 태양 주변 빛무리 색·세기 */
  glow: number;
  glowStrength: number;
  cloud: number;
  cloudOpacity: number;
  /** 원경 산맥 색(가까운 → 먼) */
  ridges: [number, number, number];
  exposure: number;
  /** 안개 시작·끝(m) */
  fogNear: number;
  fogFar: number;
}

const mix = (a: number, b: number, t: number): number => {
  const ca = new Color(a);
  return ca.lerp(new Color(b), t).getHex();
};

interface TodSpec {
  name: string;
  skyTop: number;
  skyHorizon: number;
  tint: number;
  tintAmount: number;
  sun: number;
  sunIntensity: number;
  sunDir: [number, number, number];
  glow: number;
  glowStrength: number;
  cloud: number;
  cloudOpacity: number;
  exposure: number;
  fogNear: number;
  fogFar: number;
  hemiScale: number;
}

const TOD: Record<TimeOfDay, TodSpec | null> = {
  day: null,
  dawn: {
    name: '새벽',
    skyTop: 0x3e5a86,
    skyHorizon: 0xf0b98a,
    tint: 0xf3c7a2,
    tintAmount: 0.18,
    sun: 0xffc48a,
    sunIntensity: 1.7,
    sunDir: [0.75, 0.12, -0.65],
    glow: 0xffa860,
    glowStrength: 0.9,
    cloud: 0xf6c8b0,
    cloudOpacity: 0.85,
    exposure: 1.0,
    fogNear: 500,
    fogFar: 3800,
    hemiScale: 0.8,
  },
  dusk: {
    name: '황혼',
    skyTop: 0x2c3558,
    skyHorizon: 0xe8946a,
    tint: 0xe39a72,
    tintAmount: 0.2,
    sun: 0xff9e5e,
    sunIntensity: 1.6,
    sunDir: [-0.8, 0.09, -0.6],
    glow: 0xff7a3a,
    glowStrength: 1.0,
    cloud: 0xd88a74,
    cloudOpacity: 0.85,
    exposure: 0.95,
    fogNear: 450,
    fogFar: 3600,
    hemiScale: 0.7,
  },
  overcast: {
    name: '흐림',
    skyTop: 0x7d8792,
    skyHorizon: 0xb8bec4,
    tint: 0x9aa2aa,
    tintAmount: 0.22,
    sun: 0xe6e9ec,
    sunIntensity: 1.1,
    sunDir: [-0.3, 0.6, -0.4],
    glow: 0xffffff,
    glowStrength: 0.15,
    cloud: 0xa4abb2,
    cloudOpacity: 0.95,
    exposure: 1.05,
    fogNear: 350,
    fogFar: 3000,
    hemiScale: 1.15,
  },
};

/** 지형 테마 + 시간대 → 최종 대기·조명 팔레트 */
export function atmosphereFor(theme: ThemeColors, tod: TimeOfDay): Atmosphere {
  const t = TOD[tod];
  if (!t) {
    return {
      ...theme,
      timeName: '주간',
      sunDir: [-0.45, 0.62, -0.35],
      sunDisc: 0xfff6e0,
      glow: 0xfff0c8,
      glowStrength: 0.45,
      cloud: 0xffffff,
      cloudOpacity: 0.8,
      ridges: [mix(theme.groundHigh, theme.fog, 0.55), mix(theme.rock, theme.fog, 0.7), mix(theme.skyTop, theme.fog, 0.75)],
      exposure: 1.1,
      fogNear: 700,
      fogFar: 4800,
    };
  }
  const tint = (c: number) => mix(c, t.tint, t.tintAmount);
  const fog = mix(t.skyHorizon, theme.fog, 0.35);
  return {
    ...theme,
    name: theme.name,
    timeName: t.name,
    skyTop: t.skyTop,
    skyHorizon: t.skyHorizon,
    fog,
    groundLow: tint(theme.groundLow),
    groundHigh: tint(theme.groundHigh),
    rock: tint(theme.rock),
    treeLeaf: theme.treeLeaf.map(tint),
    sun: t.sun,
    sunIntensity: t.sunIntensity,
    hemiSky: mix(theme.hemiSky, t.skyHorizon, 0.5),
    hemiGround: tint(theme.hemiGround),
    sunDir: t.sunDir,
    sunDisc: mix(t.sun, 0xffffff, 0.4),
    glow: t.glow,
    glowStrength: t.glowStrength,
    cloud: t.cloud,
    cloudOpacity: t.cloudOpacity,
    ridges: [mix(tint(theme.groundHigh), fog, 0.5), mix(tint(theme.rock), fog, 0.68), mix(t.skyTop, fog, 0.72)],
    exposure: t.exposure,
    fogNear: t.fogNear,
    fogFar: t.fogFar,
  };
}
