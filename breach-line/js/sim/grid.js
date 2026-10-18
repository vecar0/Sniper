// 맵 격자: 배치도 해석, 방 구분, 이동 충돌, 시선·탄 판정(DDA), 길찾기(A*).
// 렌더·DOM과 무관한 순수 로직이라 Node에서도 그대로 돈다.
import { CELL, COVER_H, ACTOR_R } from '../config/balance.js';

export const T = { FLOOR: 0, WALL: 1, COVER: 2, PILLAR: 3, DOOR: 4 };

const ENTITY_CHARS = 'prhtHC';

export function parseMap(rows) {
  const h = rows.length;
  const w = rows[0].length;
  const cells = new Uint8Array(w * h);
  const doorAt = new Int16Array(w * h).fill(-1);
  const doors = [];
  const entities = [];
  const entries = {};
  for (let r = 0; r < h; r++) {
    if (rows[r].length !== w) throw new Error(`map row ${r} length ${rows[r].length} != ${w}`);
    for (let c = 0; c < w; c++) {
      const ch = rows[r][c];
      const i = r * w + c;
      if (ch === '#') cells[i] = T.WALL;
      else if (ch === 'O') cells[i] = T.PILLAR;
      else if (ch === '=') cells[i] = T.COVER;
      else if (ch === 'D' || ch === 'L' || ch === 'X') {
        cells[i] = T.DOOR;
        doorAt[i] = doors.length;
        doors.push({ id: doors.length, c, r, locked: ch === 'L', barricade: ch === 'X', axis: null, sides: null, rooms: null });
      } else {
        cells[i] = T.FLOOR;
        if (ch === '1' || ch === '2') entries[ch] = { c, r };
        else if (ENTITY_CHARS.includes(ch)) entities.push({ ch, c, r });
        else if (ch !== '.') throw new Error(`unknown map char '${ch}' at ${c},${r}`);
      }
    }
  }
  const g = { w, h, cells, doorAt, doors, entities, entries, room: new Int16Array(w * h).fill(-1), rooms: [] };
  const solid = (c, r) => { const t = cellType(g, c, r); return t === T.WALL || t === T.PILLAR; };
  for (const d of doors) {
    // 좌우가 벽이면 문은 가로로 놓인 벽에 있고, 지나가는 방향은 z(위아래)
    if (solid(d.c - 1, d.r) && solid(d.c + 1, d.r)) {
      d.axis = 'z';
      d.sides = [{ c: d.c, r: d.r - 1 }, { c: d.c, r: d.r + 1 }];
    } else if (solid(d.c, d.r - 1) && solid(d.c, d.r + 1)) {
      d.axis = 'x';
      d.sides = [{ c: d.c - 1, r: d.r }, { c: d.c + 1, r: d.r }];
    } else {
      throw new Error(`door at ${d.c},${d.r} is not set in a wall`);
    }
  }
  buildRooms(g);
  for (const d of doors) d.rooms = d.sides.map((s) => roomAt(g, s.c, s.r));
  return g;
}

function buildRooms(g) {
  let id = 0;
  for (let r = 0; r < g.h; r++) {
    for (let c = 0; c < g.w; c++) {
      const i = r * g.w + c;
      const t = g.cells[i];
      if ((t !== T.FLOOR && t !== T.COVER) || g.room[i] !== -1) continue;
      const cellsInRoom = [];
      const stack = [i];
      g.room[i] = id;
      let sx = 0; let sz = 0; let minC = c; let maxC = c; let minR = r; let maxR = r;
      while (stack.length) {
        const k = stack.pop();
        cellsInRoom.push(k);
        const kc = k % g.w; const kr = (k / g.w) | 0;
        sx += kc; sz += kr;
        minC = Math.min(minC, kc); maxC = Math.max(maxC, kc); minR = Math.min(minR, kr); maxR = Math.max(maxR, kr);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = kc + dc; const nr = kr + dr;
          if (nc < 0 || nr < 0 || nc >= g.w || nr >= g.h) continue;
          const ni = nr * g.w + nc;
          const nt = g.cells[ni];
          if ((nt === T.FLOOR || nt === T.COVER) && g.room[ni] === -1) { g.room[ni] = id; stack.push(ni); }
        }
      }
      const n = cellsInRoom.length;
      g.rooms.push({ id, cells: cellsInRoom, center: cellCenter(sx / n, sz / n), minC, maxC, minR, maxR, doors: [] });
      id++;
    }
  }
  for (const d of g.doors) {
    for (const s of d.sides) {
      const rm = roomAt(g, s.c, s.r);
      if (rm >= 0 && !g.rooms[rm].doors.includes(d.id)) g.rooms[rm].doors.push(d.id);
    }
  }
}

export function cellType(g, c, r) {
  if (c < 0 || r < 0 || c >= g.w || r >= g.h) return T.WALL;
  return g.cells[r * g.w + c];
}
export function roomAt(g, c, r) {
  if (c < 0 || r < 0 || c >= g.w || r >= g.h) return -1;
  return g.room[r * g.w + c];
}
export function roomAtWorld(g, x, z) {
  const c = Math.floor(x / CELL); const r = Math.floor(z / CELL);
  const rm = roomAt(g, c, r);
  if (rm >= 0) return rm;
  const d = doorAtCell(g, c, r);
  return d >= 0 ? g.doors[d].rooms[0] : -1;
}
export function doorAtCell(g, c, r) {
  if (c < 0 || r < 0 || c >= g.w || r >= g.h) return -1;
  return g.doorAt[r * g.w + c];
}
export function cellCenter(c, r) { return { x: (c + 0.5) * CELL, z: (r + 0.5) * CELL }; }
export function toCell(x, z) { return { c: Math.floor(x / CELL), r: Math.floor(z / CELL) }; }

// 이동을 막는 칸인지. doorState[i].open 이면 문 칸은 통과.
export function blocksMove(g, doorState, c, r) {
  const t = cellType(g, c, r);
  if (t === T.FLOOR) return false;
  if (t === T.DOOR) return !doorState[g.doorAt[r * g.w + c]].open;
  return true;
}

// 원(반지름 rad)을 막는 칸 밖으로 밀어낸다. pos는 직접 수정.
export function resolveCircle(g, doorState, pos, rad = ACTOR_R) {
  for (let iter = 0; iter < 2; iter++) {
    const c0 = Math.floor((pos.x - rad) / CELL); const c1 = Math.floor((pos.x + rad) / CELL);
    const r0 = Math.floor((pos.z - rad) / CELL); const r1 = Math.floor((pos.z + rad) / CELL);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (!blocksMove(g, doorState, c, r)) continue;
        const minX = c * CELL; const maxX = minX + CELL; const minZ = r * CELL; const maxZ = minZ + CELL;
        const nx = Math.max(minX, Math.min(pos.x, maxX));
        const nz = Math.max(minZ, Math.min(pos.z, maxZ));
        let dx = pos.x - nx; let dz = pos.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rad * rad) continue;
        if (d2 < 1e-10) {
          // 중심이 칸 안: 가장 가까운 면으로
          const pushes = [[pos.x - minX, -1, 0], [maxX - pos.x, 1, 0], [pos.z - minZ, 0, -1], [maxZ - pos.z, 0, 1]];
          pushes.sort((a, b) => a[0] - b[0]);
          const [dist, px, pz] = pushes[0];
          pos.x += px * (dist + rad); pos.z += pz * (dist + rad);
        } else {
          const d = Math.sqrt(d2);
          const push = rad - d;
          dx /= d; dz /= d;
          pos.x += dx * push; pos.z += dz * push;
        }
      }
    }
  }
}

// 3D 선분이 맵에 막히는 첫 지점의 비율 t(0~1). 안 막히면 null.
// 벽·기둥·닫힌 문은 항상 막고, 낮은 엄폐물은 선분 높이가 COVER_H 아래일 때만 막는다.
export function raycastGrid(g, doorState, x0, y0, z0, x1, y1, z1) {
  const ux = x0 / CELL; const uz = z0 / CELL;
  const dx = (x1 - x0) / CELL; const dz = (z1 - z0) / CELL;
  let c = Math.floor(ux); let r = Math.floor(uz);
  const endC = Math.floor(x1 / CELL); const endR = Math.floor(z1 / CELL);
  const stepC = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepR = dz > 0 ? 1 : dz < 0 ? -1 : 0;
  const tDeltaC = stepC !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaR = stepR !== 0 ? Math.abs(1 / dz) : Infinity;
  let tMaxC = stepC > 0 ? (c + 1 - ux) * tDeltaC : stepC < 0 ? (ux - c) * tDeltaC : Infinity;
  let tMaxR = stepR > 0 ? (r + 1 - uz) * tDeltaR : stepR < 0 ? (uz - r) * tDeltaR : Infinity;
  let tEnter = 0;
  for (let guard = 0; guard < 512; guard++) {
    const tExit = Math.min(tMaxC, tMaxR, 1);
    const blk = cellBlocksRay(g, doorState, c, r, y0 + (y1 - y0) * tEnter, y0 + (y1 - y0) * tExit);
    if (blk) return { t: tEnter, c, r, kind: blk };
    if (c === endC && r === endR) return null;
    if (tMaxC < tMaxR) { c += stepC; tEnter = tMaxC; tMaxC += tDeltaC; } else { r += stepR; tEnter = tMaxR; tMaxR += tDeltaR; }
    if (tEnter > 1) return null;
  }
  return null;
}

function cellBlocksRay(g, doorState, c, r, yA, yB) {
  const t = cellType(g, c, r);
  if (t === T.FLOOR) return null;
  if (t === T.WALL || t === T.PILLAR) return 'wall';
  if (t === T.DOOR) return doorState[g.doorAt[r * g.w + c]].open ? null : 'door';
  if (t === T.COVER) return Math.min(yA, yB) < COVER_H ? 'cover' : null;
  return null;
}

// 문 칸을 지나가는지(명령 대상 고르기용). 처음 만나는 문 칸과 그 지점 t.
export function firstDoorOnRay(g, x0, z0, x1, z1) {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (CELL * 0.25));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const c = Math.floor((x0 + (x1 - x0) * t) / CELL); const r = Math.floor((z0 + (z1 - z0) * t) / CELL);
    const d = doorAtCell(g, c, r);
    if (d >= 0) return { door: d, t };
  }
  return null;
}

// A* (8방향, 모서리 끼기 금지). passable(c,r) 콜백. 결과는 칸 목록(시작 제외) 또는 null.
export function findPath(g, start, goal, passable, maxNodes = 4000) {
  const W = g.w;
  const si = start.r * W + start.c; const gi = goal.r * W + goal.c;
  if (si === gi) return [];
  if (!passable(goal.c, goal.r)) return null;
  const open = [si];
  const gScore = new Map([[si, 0]]);
  const fScore = new Map([[si, heur(start.c, start.r, goal.c, goal.r)]]);
  const came = new Map();
  const closed = new Set();
  let visited = 0;
  while (open.length && visited < maxNodes) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (fScore.get(open[k]) < fScore.get(open[bi])) bi = k;
    const cur = open[bi];
    open[bi] = open[open.length - 1]; open.pop();
    if (cur === gi) {
      const path = [];
      let k = cur;
      while (k !== si) { path.push({ c: k % W, r: (k / W) | 0 }); k = came.get(k); }
      return path.reverse();
    }
    closed.add(cur);
    visited++;
    const cc = cur % W; const cr = (cur / W) | 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dc && !dr) continue;
        const nc = cc + dc; const nr = cr + dr;
        if (!passable(nc, nr)) continue;
        if (dc && dr && (!passable(cc + dc, cr) || !passable(cc, cr + dr))) continue;
        const ni = nr * W + nc;
        if (closed.has(ni)) continue;
        const tentative = gScore.get(cur) + (dc && dr ? 1.4142 : 1);
        if (tentative < (gScore.get(ni) ?? Infinity)) {
          came.set(ni, cur);
          gScore.set(ni, tentative);
          fScore.set(ni, tentative + heur(nc, nr, goal.c, goal.r));
          if (!open.includes(ni)) open.push(ni);
        }
      }
    }
  }
  return null;
}
function heur(a, b, c, d) { const dx = Math.abs(a - c); const dz = Math.abs(b - d); return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz); }

// 문 앞(near 쪽) 대기 위치 후보: 문 바로 앞 칸의 좌우, 그 뒤 칸.
export function stackCells(g, door, nearIdx) {
  const near = door.sides[nearIdx];
  const dc = near.c - door.c; const dr = near.r - door.r; // 문 → 바깥 방향
  const lc = dr; const lr = -dc;                              // 좌우 방향
  const cand = [
    { c: near.c + lc, r: near.r + lr }, { c: near.c - lc, r: near.r - lr },
    { c: near.c + lc + dc, r: near.r + lr + dr }, { c: near.c - lc + dc, r: near.r - lr + dr },
    { c: near.c + dc, r: near.r + dr }, { c: near.c, r: near.r },
    { c: near.c + 2 * dc, r: near.r + 2 * dr },
  ];
  return cand.filter((p) => cellType(g, p.c, p.r) === T.FLOOR && roomAt(g, p.c, p.r) === door.rooms[nearIdx]);
}

// 문 너머 방에 들어가 설 지점: 문 옆 모서리 쪽 → 중앙 쪽.
export function entryCells(g, door, farIdx) {
  const far = door.sides[farIdx];
  const dc = far.c - door.c; const dr = far.r - door.r;
  const lc = dr; const lr = -dc;
  const roomId = door.rooms[farIdx];
  const out = [];
  const tryAdd = (c, r) => {
    if (cellType(g, c, r) === T.FLOOR && roomAt(g, c, r) === roomId && !out.some((p) => p.c === c && p.r === r)) out.push({ c, r });
  };
  for (const [side, fwd] of [[2, 1], [-2, 1], [0, 2], [3, 2], [-3, 2], [1, 3], [-1, 3], [0, 1]]) {
    let c = far.c + lc * side + dc * fwd; let r = far.r + lr * side + dr * fwd;
    // 방 밖이면 안쪽으로 당긴다
    let k = Math.abs(side);
    while (k > 0 && !(cellType(g, c, r) === T.FLOOR && roomAt(g, c, r) === roomId)) {
      k--; c -= lc * Math.sign(side); r -= lr * Math.sign(side);
    }
    tryAdd(c, r);
  }
  return out;
}
