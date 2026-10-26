// LAST NODE — 모든 게임 수치. 값마다 이유를 짧게 적는다. (기획서 design/plan.md 와 같은 숫자)

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
  speed: 7.0,            // 기본 이동이 빠르다(달리기 키 없음)
  crouchSpeed: 3.0,
  groundAccel: 70,
  airAccel: 22,
  friction: 12,
  gravity: 22,           // 현실(9.8)보다 강하게 → 점프가 둔하지 않다
  jumpHeight: 1.3,
  stepUp: 0.55,          // 계단 한 칸(0.25)은 그냥 걸어 오른다
  dashDist: 6,
  dashTime: 0.18,
  dashCharges: 2,
  dashRecharge: 1.4,
  dashDamageMul: 0.5,
  slideTime: 0.7,
  slideBoost: 10.5,
  slideCooldown: 0.5,
  meleeDamage: 35,
  meleeRange: 2.3,
  meleeCone: 0.75,       // cos(약 41°)
  meleeCooldown: 0.55,
  meleeHeal: 25,         // 기절한 적을 근접 처치하면 회복
  fallY: -12,            // 이 높이 아래로 떨어지면 추락 처리
  fallDamage: 30,
  respawn: { x: 0, y: 0, z: 9 },
  empMax: 3,
  empStart: 1,
};

// 무기: dmg=1발(산탄은 펠릿 1개) 피해, rate=초당 발사, spread=도(°)
export const WEAPONS = {
  pistol: {
    name: 'K-9 스마트 권총', slot: 1, price: 0,
    dmg: 28, pellets: 1, rate: 6.5, auto: false, mag: 14, reserve: Infinity,
    reload: 1.1, spreadHip: 1.1, spreadAds: 0.25, recoil: 1.3, range: 120,
    falloffStart: 25, falloffEnd: 50, falloffMin: 0.65,
    homing: 2.0,           // ADS 때 약점 쪽으로 최대 2° 휜다
  },
  shotgun: {
    name: '브레이커 산탄총', slot: 2, price: 1000,
    dmg: 11, pellets: 10, rate: 1.6, auto: true, mag: 8, reserve: 48,
    reload: 0.45, reloadStart: 0.3, perShell: true, spreadHip: 5.0, spreadAds: 3.6, recoil: 5.5, range: 40,
    falloffStart: 10, falloffEnd: 28, falloffMin: 0.35, knockback: 3.5,
  },
  rifle: {
    name: 'VX-7 펄스 라이플', slot: 3, price: 1600,
    dmg: 22, pellets: 1, rate: 11, auto: true, mag: 36, reserve: 216,
    reload: 1.6, spreadHip: 1.6, spreadAds: 0.35, recoil: 0.9, range: 150,
    falloffStart: 25, falloffEnd: 50, falloffMin: 0.65,
    sustainTime: 3.0, sustainBonus: 0.2, // 3초 연사하면 피해 +20%
  },
  rail: {
    name: '랜스 레일건', slot: 4, price: 3200,
    dmg: 240, pellets: 1, rate: 0.8, auto: false, mag: 5, reserve: 25,
    reload: 2.2, spreadHip: 0.6, spreadAds: 0.0, recoil: 7, range: 220,
    charge: 0.35, pierce: 3, weakMul: 1.5,
  },
};
export const WEAPON_ORDER = ['pistol', 'shotgun', 'rifle', 'rail'];

// 강화 3단계: 1=피해 +15%, 2=탄창 +30%, 3=재장전 −25%. 가격 = 무기 가격(권총은 600 기준) × 배수
export const UPGRADE = { dmg: 0.15, mag: 0.3, reload: 0.25, priceMul: [0.5, 0.75, 1.0], pistolBase: 600 };

export const WEAK_MUL = 2.0;

export const EMP = {
  fuse: 1.6, throwSpeed: 15, upSpeed: 4, radius: 5, damage: 25, // 리퍼(50)를 죽이지 않고 기절만 → 근접 마무리 기회
  stun: 2.5, shieldOff: 4, restitution: 0.35, price: 200,
};

// 적. targets: 'player' | 'core'. hp는 웨이브 배수 적용 전 값
export const ENEMIES = {
  reaper: {
    name: '리퍼', hp: 50, speed: 6.2, radius: 0.32, height: 1.8, target: 'player', credits: 50,
    meleeDmg: 14, meleeRate: 0.8, leapRange: 3.0, leapWindup: 0.3, leapTime: 0.35, leapStagger: 0.6, hitRange: 1.5,
    parts: [ // [오른쪽, 위, 앞, 반지름, 배수]
      [0, 1.62, 0.05, 0.2, 'weak'], [0, 1.22, 0, 0.32, 1], [0, 0.85, 0, 0.28, 1], [0, 0.42, 0, 0.26, 1],
    ],
  },
  enforcer: {
    name: '집행관', hp: 120, speed: 3.4, radius: 0.36, height: 1.9, target: 'player', credits: 80,
    burst: 3, burstGap: 0.11, dmg: 4, fireEvery: 2.3, aimTime: 0.4, accuracy: 0.3,
    rangeMin: 10, rangeMax: 26, repositionMin: 5, repositionMax: 8, tooClose: 5, bulletSpeed: 70,
    parts: [[0, 1.72, 0.04, 0.21, 'weak'], [0, 1.3, 0, 0.36, 1], [0, 0.9, 0, 0.32, 1], [0, 0.45, 0, 0.3, 1]],
  },
  leech: {
    name: '리치', hp: 70, speed: 4.0, radius: 0.32, height: 1.7, target: 'core', credits: 90,
    drain: 18, attachDist: 2.2, interrupt: 0.4,
    parts: [[0, 1.4, 0.25, 0.2, 'weak'], [0, 1.1, 0.05, 0.32, 1], [0, 0.7, 0, 0.28, 1], [0, 0.32, 0, 0.24, 1]],
  },
  drone: {
    name: '스웜 드론', hp: 25, speed: 8.0, radius: 0.35, height: 0.5, target: 'mixed', credits: 30,
    flyMin: 2, flyMax: 5, triggerDist: 4, windup: 0.5, boomDmg: 18, boomRadius: 2, chain: 1.5,
    parts: [[0, 0, 0.1, 0.18, 'weak'], [0, 0, 0, 0.36, 1]],
  },
  mech: {
    name: '브레이커 메크', hp: 600, speed: 2.2, radius: 1.0, height: 3.4, target: 'core', credits: 350,
    punchDmg: 60, punchEvery: 2, punchRange: 3.6, missileDmg: 25, missileRadius: 3, missileEvery: 6,
    missileRange: 25, missileWarn: 1, missileSpeed: 18, turnRate: 1.0, shieldMul: 0.3, backMul: 2.5,
    parts: [
      [0, 3.0, 0.35, 0.36, 'weak'], [0, 2.25, 0, 0.95, 1], [0.62, 1.0, 0, 0.45, 1], [-0.62, 1.0, 0, 0.45, 1],
      [0, 2.35, -0.85, 0.42, 'back'],
    ],
  },
  boss: {
    name: '무장 수송기 카론', hp: 4000, perAppear: 0.25, radius: 3, credits: 2500,
    orbitR: 17, altMin: 13, altMax: 17, orbitSpeed: 0.18, engineHp: 900, cockpitMul: 3,
    patternGap: 3, patternGapRage: 2, gatlingWarn: 1, gatlingTime: 2.5, gatlingDps: 30, gatlingWidth: 1.2,
    missileCount: 6, missileWarn: 1.2, missileDmg: 25, missileRadius: 3,
    drop: ['enforcer', 'enforcer', 'leech'], engineAltLoss: 4,
  },
};

export const CORE = {
  hp: 1500, radius: 1.6, repairBetween: 150, shieldLevels: [300, 600, 900],
  pulseEvery: 15, pulseRadius: 6, pulseStun: 1.5,
};

export const TURRET = { dmg: 9, rate: 6, range: 22, turn: 6 };

export const WAVES = {
  count: (w) => Math.min(80, 10 + 4 * w),
  aliveCap: 20,
  bossAliveCap: 12,
  hpMul: (w) => Math.min(2.2, 1 + 0.07 * (w - 1)),
  dmgMul: (w) => Math.min(2.2, 1 + 0.04 * (w - 1)),
  bossEvery: 5,
  intermission: 20,
  firstDelay: 8,
  stairsEvery: [0.6, 1.0],
  elevatorFrom: 2, elevatorEvery: 12, elevatorGroup: [4, 6],
  dropshipFrom: 4, dropshipEvery: 18, dropshipGroup: 3, dropshipWarn: 1.5,
  droneFrom: 3, leechFrom: 2, mechFrom: 6,
  mix: { reaper: 40, enforcer: 25, leech: 12, drone: 15 },
  leechSlots: (w) => 1 + Math.floor(w / 4),
  mechMax: (w) => Math.floor(w / 3),
  mechChance: 0.06,
  swarm: [3, 5],
};

export const ECONOMY = {
  weakBonus: 0.5, meleeBonus: 0.3,
  comboWindow: 2.5, combo2: 0.1, combo5: 0.25,
  waveBonus: (w) => 200 + 50 * w,
  perfectBonus: 300,
};

export const SHOP = {
  armor: { price: 400, amount: 25 },
  heal: { price: (w) => 250 + 20 * w },
  emp: { price: 200 },
  ammo: { price: 200 },
  coreRepair: { price: 400, amount: 300 },
  coreShield: { price: [800, 1400, 2200] },
  turret: { price: [1200, 1800] },
  corePulse: { price: 2000 },
};

export const DROPS = {
  orbMin: 1, orbMax: 2, orbHeal: 10, orbLife: 8, ammoChance: 0.3, magnet: 3, collect: 0.9,
};

export const BATTERY = { damage: 70, radius: 4.5 };

export const BROADCAST = {
  waveStart: ['헬릭스 보안 통신: 자산 회수를 시작합니다.', '헬릭스: 무단 점유자를 제거하십시오.', '헬릭스: 노드 접근 권한을 회수합니다.', '헬릭스: 저항은 비용만 늘릴 뿐입니다.'],
  boss: '헬릭스: 무장 수송기 카론 투입. 옥상을 정리하라.',
  core50: '헬릭스: 노드 방화벽 50% 붕괴.',
  core25: '헬릭스: 노드 장악 임박. 러너, 항복하십시오.',
};
