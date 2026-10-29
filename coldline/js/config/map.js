// 북천 중계소 방어 구역 배치도. 좌표: x=동(+)/서(−), z=남(+)/북(−), y=위. 단위 m. 광장 바닥 y=0, 범위 ±28.
// 상자: [x0, z0, x1, z1, 높이(위면 y), 종류, 바닥 y(기본 0)]
// 둘레는 전부 콘크리트 옹벽 → 떨어지는 곳이 없다.

export const ROOF = 28;

const boxes = [];
const add = (x0, z0, x1, z1, top, kind, y0 = 0) => boxes.push({ x0, z0, x1, z1, y0, y1: top, kind });

// 옹벽(7m) — 바깥으로 두꺼운 덩어리는 화면 쪽(level.js)에서 덧붙인다
add(-28, -28, 28, -27.5, 7, 'wall');
add(-28, 27.5, 28, 28, 7, 'wall');
add(-28, -28, -27.5, 28, 7, 'wall');
add(27.5, -28, 28, 28, 7, 'wall');

// 서쪽 보급 터널 출입동(유입구 1) · 북쪽 화물 리프트(유입구 2)
add(-28, -6, -22, 2, 8.5, 'tunnel');
add(-4, -28, 4, -22.5, 11, 'lift');

// 서남쪽 관제동(지붕 4m) + 동쪽으로 내려가는 계단
add(-23, 6, -13, 17, 4, 'bunker');
for (let i = 0; i < 15; i++) add(-13 + 0.45 * i - 0.01, 6, -13 + 0.45 * (i + 1) + 0.01, 8, 4 - 0.25 * (i + 1), 'step'); // 계단 칸끼리 살짝 겹쳐 경계에 틈이 없게
add(-21.5, 13, -18.5, 16, 6.2, 'equip', 4);
add(-17.5, 13, -14.5, 16, 6.2, 'equip', 4);

// 동쪽 발전기 플랫폼(4m) + 서쪽으로 내려가는 계단 + 남쪽 블록 계단(더블 점프)
add(13, -11, 25, 1, 4, 'deck');
for (let i = 0; i < 15; i++) add(13 - 0.45 * (i + 1) - 0.01, -11, 13 - 0.45 * i + 0.01, -9, 4 - 0.25 * (i + 1), 'step');
add(20.5, 1, 22, 2.4, 2.6, 'crate');
// 높은 곳 난간(1.1m): 계단·블록 계단 쪽만 트여 있다
add(13, -11.05, 25, -10.85, 5.1, 'rail', 4);
add(24.85, -11, 25.05, 1, 5.1, 'rail', 4);
add(12.95, -8.8, 13.15, 1, 5.1, 'rail', 4);
add(-23, 16.85, -13, 17.05, 5.1, 'rail', 4);
add(-23.05, 6, -22.85, 17, 5.1, 'rail', 4);
add(-13.15, 8.2, -12.95, 17, 5.1, 'rail', 4);
add(20.5, 2.4, 22, 3.8, 1.3, 'crate');

// 중앙 송신기 「등대」 + 낮은 방벽 링(1m, 네 방향 입구)
add(-1.3, -1.3, 1.3, 1.3, 6, 'core');
for (const s of [-1, 1]) {
  add(-5, s * 5 - 0.2, -1.6, s * 5 + 0.2, 1.0, 'ring');
  add(1.6, s * 5 - 0.2, 5, s * 5 + 0.2, 1.0, 'ring');
  add(s * 5 - 0.2, -5, s * 5 + 0.2, -1.6, 1.0, 'ring');
  add(s * 5 - 0.2, 1.6, s * 5 + 0.2, 5, 1.0, 'ring');
}

// 포탑 받침 2곳
add(6.5, 6.5, 7.5, 7.5, 1.0, 'pedestal');
add(-7.5, -7.5, -6.5, -6.5, 1.0, 'pedestal');

// 보급 단말
add(-0.7, 12.7, 0.7, 13.3, 1.9, 'terminal');
add(23, -0.3, 24.4, 0.3, 5.9, 'terminal', 4);

// 콘크리트 엄폐 블록(큰 덩어리)
add(8, 10, 14.1, 12.45, 2.6, 'block');
add(16, 19, 22.1, 21.45, 2.6, 'block');
add(16, 22, 22.1, 24.45, 2.6, 'block');

// 낮은 방벽 · 연료 탱크 · 발전기
add(6, -17, 8.5, -14.6, 1.3, 'barrier');
add(9, -17, 11.5, -14.6, 1.3, 'barrier');
add(6, -14, 7.5, -12, 0.8, 'barrier');
add(20.3, 10.3, 23.7, 13.7, 4.0, 'tank');
add(-25, -16, -22, -12, 1.8, 'generator');
add(-25, -22, -22, -18, 1.8, 'generator');

// ── 들어가 싸울 수 있는 건물 3채: 벽 0.3m · 높이 3.2m · 지붕 판. 문(1.8m)·창(턱 1.0m~위 2.2m)·안쪽 칸막이 ──
// 열린 곳: [변('n'|'s'|'w'|'e'), 시작, 끝, 종류('door'|'win')]. 칸막이: [x0, z0, x1, z1] (0.3m 두께 벽, 틈은 따로 나눠 적는다)
const WALL_H = 3.2, WALL_T = 0.3, SILL = 1.0, LINTEL = 2.2;
export const HOUSES = [];
function house(x0, z0, x1, z1, openings, inner = []) {
  HOUSES.push({ x0, z0, x1, z1 });
  const T = WALL_T;
  const sides = {
    n: { a: x0, b: x1, fixed: z0, alongX: true }, s: { a: x0, b: x1, fixed: z1 - T, alongX: true },
    w: { a: z0 + T, b: z1 - T, fixed: x0, alongX: false }, e: { a: z0 + T, b: z1 - T, fixed: x1 - T, alongX: false },
  };
  const seg = (sd, a, b, y0, y1) => {
    if (b - a < 0.01) return;
    if (sd.alongX) add(a, sd.fixed, b, sd.fixed + T, y1, 'hwall', y0);
    else add(sd.fixed, a, sd.fixed + T, b, y1, 'hwall', y0);
  };
  for (const [k, sd] of Object.entries(sides)) {
    const ops = openings.filter((o) => o[0] === k).sort((p, q) => p[1] - q[1]);
    let at = sd.a;
    for (const [, a, b, kind] of ops) {
      seg(sd, at, a, 0, WALL_H);
      if (kind === 'win') { seg(sd, a, b, 0, SILL); seg(sd, a, b, LINTEL, WALL_H); } else seg(sd, a, b, LINTEL + 0.2, WALL_H);
      at = b;
    }
    seg(sd, at, sd.b, 0, WALL_H);
  }
  for (const [ax, az, bx, bz] of inner) add(ax, az, bx, bz, WALL_H, 'hwall');
  add(x0 - 0.15, z0 - 0.15, x1 + 0.15, z1 + 0.15, WALL_H + 0.3, 'hroof', WALL_H);
}
// 북서 창고(가운데 칸막이에 문)
house(-21, -24, -9, -15, [['s', -17, -15.2, 'door'], ['e', -21, -19.2, 'door'], ['s', -12.5, -10.5, 'win'], ['w', -20.5, -18.5, 'win'], ['n', -14, -12, 'win']],
  [[-15.15, -23.7, -14.85, -20.6], [-15.15, -18.8, -14.85, -15.3]]);
// 남쪽 숙소(가로 칸막이로 앞·뒤 방)
house(-12, 17, -1, 25.5, [['n', -7.5, -5.7, 'door'], ['e', 22.2, 24, 'door'], ['n', -11, -9.2, 'win'], ['n', -3.5, -2, 'win'], ['s', -8, -6, 'win'], ['w', 19, 20.5, 'win']],
  [[-11.7, 21.35, -8.5, 21.65], [-6.7, 21.35, -1.3, 21.65]]);
// 북동 경비 초소
house(6, -25, 14, -19.5, [['s', 8, 9.8, 'door'], ['w', -23.5, -21.7, 'door'], ['s', 11, 13, 'win'], ['e', -23, -21.5, 'win']]);
// 건물 안 엄폐물
add(-20.4, -23.4, -19.2, -22.2, 1.2, 'crate');
add(-20.4, -22.2, -19.2, -21.0, 2.4, 'crate');
add(-12.2, -23.5, -10.0, -22.3, 1.0, 'table');
add(-14.4, -17.5, -13.4, -16.5, 1.2, 'crate');
add(-11.5, 23.5, -9.5, 25.0, 0.8, 'table');
add(-4.4, 18.0, -2.0, 19.0, 0.8, 'table');
add(-4.0, 23.2, -2.8, 24.4, 1.2, 'crate');
add(11.8, -24.4, 13.4, -23.4, 1.0, 'table');
add(6.6, -20.6, 7.8, -19.8, 1.2, 'crate');
add(-20.6, -16.2, -17.8, -15.6, 2.0, 'shelf');
add(-14.4, -23.6, -11.6, -23.0, 2.0, 'shelf');
add(-11.6, 17.4, -9.0, 18.0, 2.0, 'shelf');
add(13.2, -22.0, 13.7, -20.0, 2.0, 'shelf');

// ── 바깥 엄폐: 모래주머니 진지(1m) · 방벽 · 상자 ──
add(-6, -12, -3.5, -11.4, 1.0, 'sandbag');
add(3, 14, 5.5, 14.6, 1.0, 'sandbag');
add(-14, -8, -13.4, -5.5, 1.0, 'sandbag');
add(14, 4, 16.5, 4.6, 1.0, 'sandbag');
add(-4, -16, -1.5, -15.4, 1.0, 'sandbag');
add(16, 15, 18.5, 15.6, 1.0, 'sandbag');
add(-15, -12.6, -12.5, -12, 1.0, 'sandbag');
add(-8.5, 12, -6, 12.6, 1.0, 'sandbag');
add(9, 4, 10.2, 5.2, 1.2, 'crate');
add(-4, -7.5, -2.8, -6.3, 1.2, 'crate');
add(18, -16.6, 20.5, -16, 1.3, 'barrier');
add(-19, 3.2, -16.5, 3.8, 1.3, 'barrier');
add(2.5, 21, 5, 21.6, 1.3, 'barrier');
add(5.2, -12.2, 6.6, -10.8, 0.95, 'barrel');
add(-11.2, 7.6, -9.8, 9.0, 0.95, 'barrel');
add(17.2, 8.0, 18.6, 9.4, 0.95, 'barrel');
add(-7.6, -21.5, -6.2, -20.1, 0.95, 'barrel');

// 투광등 기둥 4개(네 모서리)
export const LAMPS = [
  { x: -25.6, z: -25.6 }, { x: 25.6, z: -25.6 }, { x: -25.6, z: 25.6 }, { x: 25.6, z: 25.6 },
].map((l) => ({ ...l, y: 13 }));
for (const l of LAMPS) add(l.x - 0.35, l.z - 0.35, l.x + 0.35, l.z + 0.35, 12.4, 'pole');

// 하드케이스 상자
add(-6.6, 8.4, -5.4, 9.6, 1.2, 'crate');
add(11.4, -2.6, 12.6, -1.4, 1.2, 'crate');
add(11.4, -1.4, 12.6, -0.2, 2.4, 'crate');
add(-10.6, 2.4, -9.4, 3.6, 1.2, 'crate');
add(3.4, -10.6, 4.6, -9.4, 1.2, 'crate');

export const BOXES = boxes;

// 키 이름은 시뮬레이션과 맞춘다: stairs = 보급 터널, elevator = 화물 리프트, dropship = 강하 포드
export const SPAWNS = {
  stairs: { x: -20.6, y: 0, z: -2 },
  elevator: { x: 0, y: 0, z: -21.2 },
  dropship: { x: 19, y: 4, z: -5 },
};

export const TURRET_SLOTS = [{ x: 7, y: 1, z: 7 }, { x: -7, y: 1, z: -7 }];
export const TERMINALS = [{ x: 0, y: 0, z: 13.9 }, { x: 23.7, y: 4, z: 0.9 }];
export const BATTERIES = [
  { x: -8, y: 0, z: -4 }, { x: 8.5, y: 0, z: -7 }, { x: 15.5, y: 0, z: 13.5 },
  { x: -14, y: 0, z: 0.5 }, { x: 2, y: 0, z: -18.5 }, { x: 22, y: 4, z: -7.5 },
];
export const PLAYER_START = { x: 0, y: 0, z: 9, yaw: 0 };
