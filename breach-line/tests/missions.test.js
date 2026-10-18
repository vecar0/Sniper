// 작전 5개가 실제로 끝까지 풀리는지: 자동 플레이 봇이 리더를 입력으로만 조종해 승리해야 한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS } from '../js/config/missions.js';
import { World } from '../js/sim/world.js';
import { playMission } from './bot.js';

for (const m of MISSIONS) {
  test(`작전 ${m.id} "${m.name}": 자동 플레이 3판 모두 승리`, () => {
    for (const seed of [1, 2, 3]) {
      const w = new World(m, { seed });
      const r = playMission(w, 900);
      assert.ok(r, `${m.id} seed ${seed}: 끝나지 않음`);
      assert.ok(r.win, `${m.id} seed ${seed}: ${r.reason}`);
      if (m.timeLimit) assert.ok(r.time < m.timeLimit);
      assert.ok(r.score >= 0 && r.score <= 100);
    }
  });
}

test('일부러 지는 판: 아무것도 안 하면 제한 시간에 실패한다', () => {
  const w = new World(MISSIONS[1], { seed: 5 });
  for (let i = 0; i < (MISSIONS[1].timeLimit + 2) * 60 && !w.result; i++) w.step();
  assert.ok(w.result && !w.result.win);
  assert.equal(w.result.stars, 0);
});

test('일부러 지는 판: 홀 한가운데서 총을 한 발 쏘고(소음) 가만히 있으면 리더가 쓰러져 실패한다', () => {
  const w = new World(MISSIONS[3], { seed: 2 });
  for (const m of w.squad) m.order = { type: 'hold', x: m.x, z: m.z, yaw: m.yaw };
  // 홀 한가운데로 순간이동해 서 있기
  w.leader.x = 15 * 1.2; w.leader.z = 6.5 * 1.2;
  w.leader.pitch = -0.5;
  w.input.fire = true; w.step(); w.input.fire = false;
  for (let i = 0; i < 120 * 60 && !w.result; i++) w.step();
  assert.ok(w.result && !w.result.win);
  assert.match(w.result.reason, /리더/);
});
