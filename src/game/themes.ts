import type { ThemeId } from '../config/missions';

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
