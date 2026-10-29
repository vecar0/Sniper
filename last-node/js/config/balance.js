// NORTHLIGHT — 모든 게임 수치. 값마다 이유를 짧게 적는다. (기획서 design/plan.md 와 같은 숫자)

export const TICK = 1 / 60; // 고정 타임스텝(초)

export const PLAYER = {
  hp: 100,
  armorMax: 50,
  armorAbsorb: 0.6,      // 방어구가 받아 주는 피해 비율
  radius: 0.35,
  height: 1.8,
  crouchHeight: 1.1,
  eye: 1.65,             // 서 있을 때 눈높이
  crouchEye: 1.0,
  speed: 4.8,            // 느린 전술 템포: 걸어서 엄폐물 사이를 옮겨 다닌다
  crouchSpeed: 2.3,
  crouchSpread: 0.65,    // 앉아 쏘면 탄 퍼짐 ×0.65
  groundAccel: 70,
  airAccel: 22,
  friction: 12,
  gravity: 22,           // 현실(9.8)보다 강하게 → 점프가 둔하지 않다
  jumpHeight: 1.3,
  stepUp: 0.55,          // 계단 한 칸(0.25)은 그냥 걸어 오른다
  dashDist: 4,
  dashTime: 0.18,
  dashCharges: 1,
  dashRecharge: 3,
  dashDamageMul: 0.5,
  slideTime: 0.7,
  slideBoost: 10.5,
  slideCooldown: 0.5,
  meleeDamage: 35,
  meleeRange: 2.3,
  meleeCone: 0.75,       // cos(약 41°)
  meleeCooldown: 1.15,   // 천천히 돌려 개머리판으로 치고 천천히 돌아오는 한 동작(1.15초)이 끝나야 다시
  meleeWindup: 0.42,     // 총을 돌려 겨누는 시간 — 판정은 개머리판이 닿는 이 순간에
  meleeDuration: 1.15,   // 동작 전체(이 동안은 쏠 수 없다: 두 손이 총을 휘두르는 중)
  meleeHeal: 25,         // 기절한 적을 근접 처치하면 회복
  fallY: -12,            // 이 높이 아래로 떨어지면 추락 처리
  fallDamage: 30,
  respawn: { x: 0, y: 0, z: 9 },
  leanDist: 0.45,       // 기울이기(Q/E): 눈이 옆으로 나가는 거리(m)
  leanRoll: 0.2,        // 화면이 기우는 각(라디안, 약 11°)
  switchTime: 0.62,     // 무기 교체: 든 총을 내리고 새 총을 위로 던져 돌려 받아 쥔다(이 동안은 못 쏜다)
  carry: 2,             // 들고 다닐 수 있는 총: 1번 주무기 · 2번 보조무기(세 번째를 얻으면 손에 든 총과 바꾼다)
  empMax: 3,
  empStart: 1,
  dashDamageMulSlide: 0.5, // 강화 '낮은 자세': 슬라이드 중 피해 배수
};

// 무기: dmg=1발(산탄은 펠릿 1개) 피해, rate=초당 발사, spread=도(°)
export const WEAPONS = {
  pistol: {
    name: 'P9 권총', slot: 1,
    dmg: 28, pellets: 1, rate: 6.5, auto: false, mag: 14, reserve: Infinity,
    reload: 1.1, spreadHip: 1.1, spreadAds: 0.25, recoil: 1.3, range: 120,
    falloffStart: 25, falloffEnd: 50, falloffMin: 0.65,
    homing: 2.0,           // ADS 때 약점 쪽으로 최대 2° 휜다
  },
  shotgun: {
    name: 'M12 산탄총', slot: 2,
    dmg: 11, pellets: 10, rate: 1.6, auto: true, mag: 8, reserve: 48,
    reload: 0.45, reloadStart: 0.3, perShell: true, spreadHip: 5.0, spreadAds: 3.6, recoil: 5.5, range: 40,
    falloffStart: 10, falloffEnd: 28, falloffMin: 0.35, knockback: 3.5,
  },
  rifle: {
    name: 'AR-7 소총', slot: 3,
    dmg: 22, pellets: 1, rate: 11, auto: true, mag: 36, reserve: 216,
    reload: 1.6, spreadHip: 1.6, spreadAds: 0.35, recoil: 0.9, range: 150,
    falloffStart: 25, falloffEnd: 50, falloffMin: 0.65,
    sustainTime: 3.0, sustainBonus: 0.2, // 3초 연사하면 피해 +20%
  },
  rail: {
    // 볼트액션 저격소총(배그 Kar98k형): 충전 없이 바로 쏘고, 한 발마다 노리쇠를 당겨 다음 탄을 넣는다(0.8발/초 = 1.25초)
    name: 'Kar98k 저격소총', slot: 4,
    dmg: 240, pellets: 1, rate: 0.8, auto: false, mag: 5, reserve: 25,
    reload: 2.2, spreadHip: 0.6, spreadAds: 0.0, recoil: 7, range: 220,
    pierce: 3, weakMul: 1.5,
  },
};
export const WEAPON_ORDER = ['pistol', 'shotgun', 'rifle', 'rail'];

// 무기 강화 3단계(카드): 1=피해 +15%, 2=탄창 +30%, 3=재장전 −25%
export const UPGRADE = { dmg: 0.15, mag: 0.3, reload: 0.25 };

export const WEAK_MUL = 2.0;

export const EMP = {
  fuse: 1.6, throwSpeed: 15, upSpeed: 4, radius: 5, damage: 25, // 리퍼(50)를 죽이지 않고 기절만 → 근접 마무리 기회
  stun: 2.5, shieldOff: 4, restitution: 0.35,
};

// 적(북천 기지 방어 로봇). 내부 키는 이전 이름 그대로: reaper=하운드, enforcer=보병 로봇, leech=수리 로봇, drone=FPV 드론, mech=무인 전투차량, boss=틸트로터 건십.
// hp는 웨이브 배수 적용 전 값, points=처치 점수
// 이동 속도: 느린 전술 템포에 맞춰 다시 약 20% 느리게(하운드 4.2, 보병 2.4, 수리 2.8, 드론 4.0, 전투차량 1.6)
export const ENEMIES = {
  reaper: {
    name: '하운드', hp: 50, speed: 4.2, radius: 0.38, height: 1.0, target: 'player', points: 50,
    meleeDmg: 14, meleeRate: 0.8, leapRange: 3.0, leapWindup: 0.3, leapTime: 0.35, leapStagger: 0.6, hitRange: 1.5,
    parts: [ // [오른쪽, 위, 앞, 반지름, 배수] — 4족: 앞쪽 센서 머리가 약점
      [0, 0.74, 0.52, 0.17, 'weak'], [0, 0.62, 0.18, 0.3, 1], [0, 0.6, -0.24, 0.3, 1], [0, 0.3, 0, 0.26, 1],
    ],
  },
  enforcer: {
    name: '보병 로봇', hp: 120, speed: 2.4, radius: 0.36, height: 1.9, target: 'player', points: 80,
    burst: 3, burstGap: 0.11, dmg: 6, fireEvery: 2.3, aimTime: 0.4, accuracy: 0.3,
    rangeMin: 10, rangeMax: 26, repositionMin: 5, repositionMax: 8, tooClose: 5, bulletSpeed: 70,
    parts: [[0, 1.72, 0.04, 0.21, 'weak'], [0, 1.3, 0, 0.36, 1], [0, 0.9, 0, 0.32, 1], [0, 0.45, 0, 0.3, 1]],
  },
  leech: {
    name: '수리 로봇', hp: 70, speed: 2.8, radius: 0.5, height: 1.2, target: 'ally', points: 90,
    heal: 18, healRange: 10, keepDist: 14, interrupt: 0.4, // 다친 아군에게 초당 18 회복, 맞으면 0.4초 끊김
    parts: [[0, 1.02, -0.1, 0.2, 'weak'], [0, 0.55, 0, 0.42, 1], [0, 0.5, 0.42, 0.3, 1], [0, 0.5, -0.42, 0.3, 1]],
  },
  drone: {
    name: 'FPV 드론', hp: 20, speed: 4.0, radius: 0.35, height: 0.5, target: 'player', points: 30,
    // 대처할 틈: 4.5m 안에 오면 0.9초 동안 깜빡이며 멈칫한 뒤, 그 순간 방향으로 곧게 돌진(따라 꺾지 않는다 → 옆으로 피할 수 있다)
    flyMin: 2, flyMax: 4, triggerDist: 4.5, windup: 0.9, diveSpeed: 9.5, boomDmg: 12, boomRadius: 1.8, chain: 1.5,
    parts: [[0, 0, 0.1, 0.22, 'weak'], [0, 0, 0, 0.45, 1]], // 맞히기 쉽게 판정을 조금 크게
  },
  mech: {
    name: '무인 전투차량', hp: 600, speed: 1.6, radius: 1.1, height: 2.4, target: 'player', points: 350,
    punchDmg: 30, punchEvery: 2.5, punchRange: 3.2, missileDmg: 25, missileRadius: 3, missileEvery: 6, // punch = 들이받기
    missileRange: 25, missileWarn: 1, missileSpeed: 18, turnRate: 1.0, shieldMul: 0.3, backMul: 2.5, holdDist: 9,
    parts: [ // 정면 장갑판 ×0.3, 뒤 엔진 덮개 ×2.5
      [0, 2.15, 0.15, 0.3, 'weak'], [0, 1.0, 0.1, 0.95, 1], [0.75, 0.55, 0, 0.5, 1], [-0.75, 0.55, 0, 0.5, 1],
      [0, 1.15, -1.0, 0.45, 'back'],
    ],
  },
  boss: {
    name: '틸트로터 건십', hp: 4000, perAppear: 0.25, radius: 3, points: 2500,
    orbitR: 17, altMin: 13, altMax: 17, orbitSpeed: 0.15, engineHp: 900, cockpitMul: 3,
    patternGap: 3, patternGapRage: 2, gatlingWarn: 1, gatlingTime: 2.5, gatlingDps: 30, gatlingWidth: 1.2,
    missileCount: 6, missileWarn: 1.2, missileDmg: 25, missileRadius: 3,
    drop: ['enforcer', 'enforcer', 'leech'], engineAltLoss: 4,
  },
};

export const WAVES = {
  count: (w) => Math.min(30, 5 + 2 * w),   // 느린 템포: 한 웨이브 적이 적고(1웨이브 7, 5웨이브 15) 한 번에 많이 몰려오지 않는다
  aliveCap: 7,
  bossAliveCap: 5,
  hpMul: (w) => Math.min(2.2, 1 + 0.07 * (w - 1)),
  dmgMul: (w) => Math.min(2.2, 1 + 0.04 * (w - 1)),
  bossEvery: 5,
  intermission: 5,        // 보급 화면을 닫은 뒤 다음 웨이브까지
  firstDelay: 6,
  stairsEvery: [2.5, 4.0],   // 적이 줄어든 만큼 천천히 나와 숨 돌릴 틈이 있다
  elevatorFrom: 2, elevatorEvery: 18, elevatorGroup: [2, 3],
  dropshipFrom: 4, dropshipEvery: 26, dropshipGroup: 3, dropshipWarn: 1.5,
  droneFrom: 3, leechFrom: 2, mechFrom: 6,
  mix: { reaper: 22, enforcer: 50, leech: 12, drone: 8 },   // 엄폐물 사이 총격전 위주(보병 로봇이 절반)
  medicMax: (w) => 1 + Math.floor(w / 4), // 동시에 있을 수 있는 수리 로봇
  mechMax: (w) => Math.floor(w / 3),
  mechChance: 0.06,
  swarm: [2, 3],
};

// 점수: 처치 점수 × 연속 처치 배수(2.5초 안 다음 처치마다 +0.1, 최대 2.0) · 기준 시간 보너스
export const SCORE = {
  weakBonus: 0.5, meleeBonus: 0.3,
  comboWindow: 2.5, comboStep: 0.1, comboMax: 2.0,
  par: (w) => 50 + 6 * w,   // 웨이브 기준 시간(초)
  parPerSec: 20, parHeal: 15,
  waveHeal: 25,             // 웨이브를 정리하면 기본 회복(상점 회복 대신)
};

// 보급(상점): 웨이브 정리 화면에서 크레딧으로 산다. 크레딧 = 처치 점수(연속 배수 포함) + 기준 시간 보너스.
// 카드는 운(무작위 3장), 보급은 확실히 필요한 것 — 회복 값은 웨이브마다 올라 '무기냐 회복이냐'를 고민하게 한다.
export const SUPPLY = {
  heal: { price: (w) => 200 + 30 * w, amount: 50 },
  armor: { price: 350, amount: 25 },
  ammo: { price: 150 },
  emp: { price: 220 },
  weapons: { shotgun: 900, rifle: 1400, rail: 2800 },
};

export const DROPS = {
  orbMin: 1, orbMax: 2, orbHeal: 10, orbLife: 8, ammoChance: 0.3, magnet: 3, collect: 0.9,
};

export const BATTERY = { damage: 70, radius: 4.5 };

export const BROADCAST = {
  waveStart: ['기지 방어 체계: 침입자 확인. 제거 절차를 시작합니다.', '기지 방어 체계: 예비 병력 가동.', '기지 방어 체계: 격리 구역 봉쇄. 표적을 추적합니다.', '기지 방어 체계: 손실 허용. 계속 진행합니다.'],
  boss: '경고: 무인 틸트로터 건십 출격.',
};
