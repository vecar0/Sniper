/**
 * 총기·탄약 데이터. 실제 탄약의 공개 제원(근사치)을 사용한다.
 * 서로 장단점이 맞물리게 설계: 압도적인 선택지가 없도록.
 *  - R-308: 표준. 아음속탄 사용 가능(유일).
 *  - K-6.5: 볼트가 빠르고 반동이 작아 자기 탄착을 스코프로 볼 수 있음. 대신 장거리 바람에 약간 약하고 위력이 낮음.
 *  - L-338: 장거리 최강 탄도. 대신 반동이 커서 탄착을 놓치고, 볼트가 느리며, 총성이 커서 경계 반응이 빠름.
 */
export interface AmmoSpec {
  id: string;
  name: string;
  /** 총구 속도(m/s) */
  muzzleVelocity: number;
  /** G7 탄도계수(lb/in²) */
  bcG7: number;
  /** 탄두 질량(kg) */
  mass: number;
  /** 아음속탄: 총성이 작아 멀리 있는 표적이 경계하지 않음 */
  subsonic: boolean;
  /** 탄 분산(MOA, 표준편차가 아닌 극단 확산 기준) */
  dispersionMoa: number;
}

export interface WeaponSpec {
  id: string;
  name: string;
  caliber: string;
  description: string;
  ammo: AmmoSpec[];
  magazine: number;
  /** 볼트 조작 시간(초): 다음 발까지 스코프 시야를 잃는 시간 */
  boltTime: number;
  /** 탄창 교환 시간(초) */
  reloadTime: number;
  /** 반동으로 조준점이 튀는 양(mil)과 복귀 시간(초) */
  recoilKick: number;
  recoilRecover: number;
  /** 스코프 배율 범위 */
  zoomMin: number;
  zoomMax: number;
  /** 조준선 높이(m): 총열 중심 위 스코프 높이 */
  sightHeight: number;
  /** 영점 거리(m) */
  zeroRange: number;
  /** 자이로 안정 계수(스핀 드리프트 계산용) */
  stability: number;
  /** 총성 경계 반응 배율(작을수록 빨리 반응) */
  loudness: number;
  /** 흔들림 배율(무거운 총일수록 안정) */
  swayMul: number;
  /** 총기 색(외형) */
  color: number;
  /** 해금에 필요한 별 개수 키(BALANCE.unlocks) – 없으면 처음부터 사용 가능 */
  unlockKey?: 'k65' | 'l338';
}

export const WEAPONS: WeaponSpec[] = [
  {
    id: 'r308',
    name: 'R-308',
    caliber: '.308 Win',
    description: '균형 잡힌 기본 저격총. 아음속탄을 쓸 수 있는 유일한 총.',
    ammo: [
      // 175gr SMK: G7 0.243, 2600fps
      { id: 'std', name: '표준탄 175gr', muzzleVelocity: 792, bcG7: 0.243, mass: 0.01134, subsonic: false, dispersionMoa: 0.6 },
      // 200gr 아음속: 1050fps 내외
      { id: 'sub', name: '아음속탄 200gr', muzzleVelocity: 320, bcG7: 0.29, mass: 0.01296, subsonic: true, dispersionMoa: 0.9 },
    ],
    magazine: 5,
    boltTime: 1.0,
    reloadTime: 2.4,
    recoilKick: 14,
    recoilRecover: 0.55,
    zoomMin: 3,
    zoomMax: 18,
    sightHeight: 0.045,
    zeroRange: 100,
    stability: 1.8,
    loudness: 1.0,
    swayMul: 1.0,
    color: 0x4a5a3c,
  },
  {
    id: 'k65',
    name: 'K-6.5',
    caliber: '6.5 Creedmoor',
    description: '반동이 작아 자기 탄착을 직접 확인할 수 있다. 볼트가 가장 빠르다.',
    ammo: [
      // 140gr ELD-M: G7 0.326(실측 근사 0.29~0.32), 2710fps
      { id: 'std', name: '표준탄 140gr', muzzleVelocity: 826, bcG7: 0.3, mass: 0.00907, subsonic: false, dispersionMoa: 0.5 },
    ],
    magazine: 7,
    boltTime: 0.75,
    reloadTime: 2.0,
    recoilKick: 6,
    recoilRecover: 0.3,
    zoomMin: 4,
    zoomMax: 20,
    sightHeight: 0.045,
    zeroRange: 100,
    stability: 1.7,
    loudness: 0.85,
    swayMul: 1.05,
    color: 0x3c4a5a,
    unlockKey: 'k65',
  },
  {
    id: 'l338',
    name: 'L-338',
    caliber: '.338 Lapua Mag',
    description: '1000m 이상 장거리 전용. 반동과 총성이 크고 볼트가 느리다.',
    ammo: [
      // 300gr SMK: G7 0.381, 2750fps
      { id: 'std', name: '표준탄 300gr', muzzleVelocity: 838, bcG7: 0.381, mass: 0.01944, subsonic: false, dispersionMoa: 0.5 },
    ],
    magazine: 5,
    boltTime: 1.35,
    reloadTime: 2.8,
    recoilKick: 26,
    recoilRecover: 0.85,
    zoomMin: 5,
    zoomMax: 25,
    sightHeight: 0.05,
    zeroRange: 100,
    stability: 2.0,
    loudness: 1.4,
    swayMul: 0.85,
    color: 0x5a4a3c,
    unlockKey: 'l338',
  },
];

/**
 * 소음기: 총성 전파 범위를 줄이고(BALANCE.targets.hearRadius) 섬광을 없앤다.
 * 대가: 총구 속도 1.5% 감소 → 탄도표가 조금 달라진다, 반동은 20% 감소.
 */
export const SUPPRESSOR = { velocityMul: 0.985, recoilMul: 0.8 } as const;

export function getWeapon(id: string): WeaponSpec {
  return WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];
}
