// 아군 무기. spread는 라디안(정지·조준 시 최소 → 이동·연사 시 최대).

export const WEAPONS = {
  m4: {
    id: 'm4', name: 'M4 소총', slot: 'primary',
    damage: 30, interval: 0.09, mag: 30, reserveMags: 4, pellets: 1,
    spreadMin: 0.004, spreadMax: 0.05, spreadPerShot: 0.008, recoil: 0.012,
    reload: 2.2, auto: true, range: 60, breaksLock: false,
  },
  mp5: {
    id: 'mp5', name: 'MP5 기관단총', slot: 'primary',
    damage: 22, interval: 0.075, mag: 30, reserveMags: 4, pellets: 1,
    spreadMin: 0.005, spreadMax: 0.035, spreadPerShot: 0.005, recoil: 0.007,
    reload: 1.9, auto: true, range: 40, breaksLock: false, moveSpreadMult: 0.6,
  },
  shotgun: {
    id: 'shotgun', name: '산탄총', slot: 'primary',
    damage: 12, interval: 0.8, mag: 7, reserveMags: 4, pellets: 8,
    spreadMin: 0.045, spreadMax: 0.07, spreadPerShot: 0.01, recoil: 0.04,
    reload: 3.0, auto: false, range: 25, breaksLock: true,
  },
  pistol: {
    id: 'pistol', name: '권총', slot: 'secondary',
    damage: 25, interval: 0.2, mag: 15, reserveMags: 3, pellets: 1,
    spreadMin: 0.006, spreadMax: 0.04, spreadPerShot: 0.01, recoil: 0.015,
    reload: 1.6, auto: false, range: 35, breaksLock: false,
  },
};

export const PRIMARY_IDS = ['m4', 'mp5', 'shotgun'];

export const ITEMS = {
  flash: { name: '섬광탄', short: '섬광' },
  smoke: { name: '연막탄', short: '연막' },
  c2: { name: '문 폭약', short: '폭약' },
  extmag: { name: '확장 탄창(+10발)', short: '확장' },
  armor: { name: '방탄판 강화(체력+25)', short: '방탄' },
};
