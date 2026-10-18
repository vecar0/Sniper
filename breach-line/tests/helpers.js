// 테스트 도우미: 작은 시험용 맵으로 월드를 만들고, 리더를 특정 지점·방향으로 세운다.
import { World, defaultLoadout } from '../js/sim/world.js';
import { yawTo } from '../js/sim/geom.js';
import { cellCenter } from '../js/sim/grid.js';

export function testWorld(map, extra = {}) {
  const mission = { id: 'test', name: 'test', timeLimit: extra.timeLimit ?? null, entries: extra.entries || { red: 1, blue: 1 }, map, training: extra.training };
  const w = new World(mission, { seed: extra.seed ?? 7, loadout: extra.loadout || defaultLoadout() });
  w.noEnd = extra.noEnd ?? true;
  return w;
}

export function place(a, c, r) { const p = cellCenter(c, r); a.x = p.x; a.z = p.z; a.vx = a.vz = 0; return a; }
export function face(a, b) { a.yaw = yawTo(a.x, a.z, b.x, b.z); a.pitch = 0; }
export function run(w, seconds, each) { const n = Math.round(seconds * 60); for (let i = 0; i < n && !w.result; i++) { if (each) each(w, i); w.step(); } }
export function suspects(w) { return w.actors.filter((a) => a.kind === 'suspect'); }
export function hold(w, members) { for (const m of members) m.order = { type: 'hold', x: m.x, z: m.z, yaw: m.yaw }; }
// 리더가 바라보는 방향을 정확히 대상 머리/몸통에 맞춘다
export function aimAt(w, t, y) {
  const L = w.leader;
  const eyeY = L.crouch ? 1.0 : 1.6;
  const d = Math.hypot(t.x - L.x, t.z - L.z);
  L.yaw = yawTo(L.x, L.z, t.x, t.z);
  L.pitch = Math.atan2(y - eyeY, d);
}

// 분대원을 멀리 치워 둔다(리더만 시험할 때)
export function benchSquad(w) {
  for (const m of w.squad) { m.state = 'down'; m.hp = 0; m.x = -50; m.z = -50; }
  w.stats.squadInjured = 0;
}

export const ROOM2 = [
  '############',
  '#1.........#',
  '#..........#',
  '#...=......#',
  '#..........#',
  '#####D######',
  '#..........#',
  '#....p.....#',
  '#..........#',
  '############',
];
