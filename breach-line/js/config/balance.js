// 모든 밸런스 수치. 기획서(design/plan.md)의 숫자를 그대로 옮겼고, 바꿀 때는 여기만 고친다.

export const SIM_HZ = 60;
export const DT = 1 / SIM_HZ;

export const CELL = 1.2;          // 격자 한 칸 = 1.2m
export const WALL_H = 2.8;
export const COVER_H = 1.0;       // 낮은 엄폐물 높이: 숙인 사람(1.15m)의 머리 아래까지 가림 판정은 시선 높이로 처리
export const ACTOR_R = 0.3;

export const BODY = {
  standH: 1.75,
  crouchH: 1.15,
  kneelH: 1.1,
  eyeStand: 1.6,
  eyeCrouch: 1.0,
  radius: 0.28,
  headR: 0.14,
};

// 부위 배율
export const ZONE_MULT = { head: 2.5, torso: 1.0, limb: 0.6 };

export const MOVE = {
  walk: 3.0,
  sprint: 5.2,
  crouch: 1.6,
  squadWalk: 3.2,
  squadRun: 4.4,
  turnRate: 8.0,      // AI 회전 속도(rad/s)
  leanOffset: 0.35,   // 기울이기 시 시점 좌우 이동(m)
};

export const HP = {
  leader: 100,
  squad: 100,
  armorBonus: 25,
  pistol: 60,
  rifle: 80,
  heavy: 140,
  hostage: 50,
  civilian: 50,
  dummy: 1,
};

// 감지
export const SENSE = {
  fovDeg: 60,          // 정면 ±60°
  sightRange: 18,
  hearWalk: 5,
  hearCrouch: 2,
  hearSprint: 10,
  hearKickDoor: 15,
  hearQuietDoor: 3,
  hearShout: 14,
  perceptionInterval: 0.1,
  forgetTime: 6,
};

// 반응 시간(발견 → 첫 발)
export const REACTION = { pistol: 0.45, rifle: 0.55, heavy: 0.35, squad: 0.5 };
export const FLASH_REACTION_PENALTY = 4;

// 적 무기
export const ENEMY_WEAPON = {
  pistol: { damage: 18, interval: 0.6, burst: 1 },
  rifle: { damage: 22, interval: 0.18, burst: 3, burstPause: 0.7 },
  heavy: { damage: 22, interval: 0.12, burst: 5, burstPause: 0.6 },
};

// 명중률
export const ACCURACY = {
  enemyBase: 0.6,
  squadBase: 0.7,
  near: 5, far: 15,        // 5m 1.0 → 15m 0.6
  farMult: 0.6,
  movingMult: 0.5,
  coverMult: 0.4,
};
export const MAX_SHOOTERS_PER_TARGET = 2;

// 항복
export const SURRENDER = {
  base: { pistol: 0.55, rifle: 0.35, heavy: 0.08 },
  flashed: 0.35,
  aimedByTwo: 0.15,
  lowHp: 0.20,
  allyDown: 0.10,
  cooldown: 1.5,
  failShootChance: 0.3,
  shoutRange: 10,
  aimConeDeg: 15,
};

export const FLASH = { radius: 6, stun: 4, fuse: 1.4, throwSpeed: 9 };
export const SMOKE = { radius: 2.6, duration: 12, fuse: 1.2 };
export const C2 = { stunRadius: 2.4, stun: 3, plantTime: 2 };

export const SQUAD = {
  followMin: 2.0,
  followMax: 3.0,
  entryInterval: 0.4,
  stackTimeout: 6,
  autoArrestRange: 8,
  arrestTime: 1.2,
  secureTime: 1.0,
  mirrorTime: 2.0,
  mirrorReveal: 6,
  shoutRange: 9,
  goSyncWindow: 0.2,
};

export const INTERACT_HOLD = 0.5;
export const SHOUT_TAP = 0.25;   // F를 이보다 짧게 누르면 경고

// 점수
export const SCORE = {
  hostageSecured: 10,
  allHostagesBonus: 10,
  arrest: 6,
  kill: 2,
  dummyHit: 6,
  evidence: 1,
  squadInjured: -5,
  unjustified: -15,
  innocentShot: -25,
  timeBonus: 5,
};
export const STARS = [60, 80, 95];

export const LOADOUT_POINTS = 100;
export const ITEM_COST = { flash: 10, smoke: 8, c2: 15, extmag: 5, armor: 20 };
export const ITEM_MAX = { flash: 2, smoke: 1, c2: 2, extmag: 1, armor: 1 };

export const HOSTAGE_DEATHS_TO_FAIL = 2;
export const TIME_WARNING = 60;
