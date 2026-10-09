/**
 * 미션 데이터 검증: "피할 수 없는 상황" · "불가능한 보정" · "데이터 실수"를 자동으로 잡는다.
 */
import { describe, expect, it } from 'vitest';
import { buildDailyMission, buildRangeMission, MISSIONS, todayKey } from '../../src/config/missions';
import { getWeapon, WEAPONS } from '../../src/config/weapons';
import { BALANCE } from '../../src/config/balance';
import { DIFFICULTIES } from '../../src/config/difficulty';
import { RifleState, ELEV_MAX, WIND_MAX } from '../../src/game/rifle';
import { Terrain } from '../../src/game/terrain';
import { WindField, crossComponent } from '../../src/ballistics/wind';

describe('미션 데이터', () => {
  it('ID가 겹치지 않고 목표가 3개', () => {
    const ids = new Set(MISSIONS.map((m) => m.id));
    expect(ids.size).toBe(MISSIONS.length);
    for (const m of MISSIONS) {
      expect(m.objectives).toHaveLength(3);
      expect(m.objectives[0].type).toBe('clear');
      expect(m.targets.some((t) => t.required)).toBe(true);
    }
  });

  it('난이도 곡선: 가장 먼 필수 표적 거리가 대체로 증가한다', () => {
    const far = MISSIONS.map((m) => Math.max(...m.targets.filter((t) => t.required).map((t) => t.dist)));
    // 새 메커니즘을 소개하는 미션(M4 연속 사격, M6 아음속탄)은 의도적으로 거리를 낮춘다:
    // 한 번에 하나만 어렵게(새 요소는 안전한 상황에서 먼저 소개)
    const stepDown = new Set(['m4', 'm6']);
    for (let i = 1; i < far.length; i++) if (!stepDown.has(MISSIONS[i].id)) expect(far[i]).toBeGreaterThanOrEqual(far[i - 1] - 60);
    expect(far[far.length - 1]).toBeGreaterThanOrEqual(1000);
  });

  it('모든 필수 표적은 사용 가능한 총으로 터렛 범위 안에서 보정 가능', () => {
    for (const m of MISSIONS) {
      const w = getWeapon(m.weaponLock ?? 'r308');
      const r = new RifleState(w);
      for (let a = 0; a < w.ammo.length; a++) {
        if (m.id !== 'm6' && w.ammo[a].subsonic) continue;
        r.ammoIndex = a;
        const rows = r.dope(m.atmosphere.altitude, m.atmosphere.temperature, 1200);
        for (const t of m.targets.filter((x) => x.required)) {
          const row = rows.reduce((best, x) => (Math.abs(x.range - t.dist) < Math.abs(best.range - t.dist) ? x : best));
          expect(row.elevationMil, `${m.id}/${t.id}/${w.ammo[a].id}`).toBeLessThan(ELEV_MAX);
          // 최대 풍속(돌풍 포함)에서도 좌우 보정이 터렛 범위 안
          const maxWind = Math.max(...m.wind.zones.map((z) => Math.abs(crossComponent(z.speed, z.dir)))) + (m.wind.gusts?.strength ?? 0) * 1.25;
          expect(row.windPerMpsMil * maxWind, `${m.id}/${t.id} wind`).toBeLessThan(WIND_MAX);
        }
      }
    }
  });

  it('도주하는 로봇은 반드시 탈출 지점이 있고, 도주 시간이 볼트 2회 이상 확보된다', () => {
    for (const m of MISSIONS) {
      for (const t of m.targets.filter((x) => x.kind === 'person' && x.required)) {
        expect(t.escape, `${m.id}/${t.id}`).toBeDefined();
        const [ex, ed] = t.escape!;
        const run = Math.hypot(ex - t.x, ed - t.dist);
        // 가장 어려운 난이도 기준: 반응 지연 + 달리는 시간
        const d = DIFFICULTIES.expert;
        const time = BALANCE.targets.reactionMin + (run * d.escapeDistanceMul) / (BALANCE.targets.runSpeed * d.escapeSpeedMul);
        expect(time, `${m.id}/${t.id} 도주 시간`).toBeGreaterThan(getWeapon('r308').boltTime * 2);
      }
    }
  });

  it('표적이 사수 시야에서 지형에 가려지지 않는다', () => {
    for (const m of MISSIONS) {
      const terrain = new Terrain({ theme: m.theme, seed: 1, maxDist: Math.max(...m.targets.map((t) => t.dist)) });
      const eyeY = terrain.height(0, 0) + BALANCE.camera.eyeHeight;
      for (const t of m.targets) {
        const ty = terrain.height(t.x, -t.dist) + 1.2;
        for (let f = 0.05; f < 0.97; f += 0.01) {
          const x = t.x * f;
          const z = -t.dist * f;
          const y = eyeY + (ty - eyeY) * f;
          expect(y, `${m.id}/${t.id} at ${(f * 100).toFixed(0)}%`).toBeGreaterThan(terrain.height(x, z));
        }
      }
    }
  });

  it('사격장은 100~1500m, 일일 챌린지는 날짜별로 결정론적', () => {
    const r = buildRangeMission(3, 90);
    expect(r.targets[0].dist).toBe(100);
    expect(r.targets[r.targets.length - 1].dist).toBe(1500);
    const a = buildDailyMission('2026-10-09');
    const b = buildDailyMission('2026-10-09');
    const c = buildDailyMission('2026-10-10');
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(c));
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('일일 챌린지 365일치가 모두 보정 가능한 범위', () => {
    const r = new RifleState(getWeapon('r308'));
    for (let d = 0; d < 365; d++) {
      const date = new Date(2026, 0, 1 + d);
      const m = buildDailyMission(todayKey(date));
      const rows = r.dope(m.atmosphere.altitude, m.atmosphere.temperature, 1000);
      for (const t of m.targets) {
        const row = rows.reduce((best, x) => (Math.abs(x.range - t.dist) < Math.abs(best.range - t.dist) ? x : best));
        expect(row.elevationMil).toBeLessThan(ELEV_MAX);
        expect(t.dist).toBeLessThanOrEqual(900);
      }
    }
  });

  it('총기 밸런스: 각 총이 하나 이상의 항목에서 가장 좋다(압도적 선택지 없음)', () => {
    const wins = new Map<string, number>();
    const stats = WEAPONS.map((w) => {
      const r = new RifleState(w);
      const row = r.dope(100, 15, 1000).find((x) => x.range === 1000)!;
      return { id: w.id, drop: row.elevationMil, wind: row.windPerMpsMil, bolt: w.boltTime, recoil: w.recoilKick, energy: row.energy, sub: w.ammo.some((a) => a.subsonic) ? 1 : 0 };
    });
    const best = (key: keyof (typeof stats)[0], lower: boolean) => {
      const sorted = [...stats].sort((a, b) => (lower ? (a[key] as number) - (b[key] as number) : (b[key] as number) - (a[key] as number)));
      wins.set(sorted[0].id, (wins.get(sorted[0].id) ?? 0) + 1);
    };
    best('drop', true);
    best('wind', true);
    best('bolt', true);
    best('recoil', true);
    best('energy', false);
    best('sub', false);
    for (const w of WEAPONS) expect(wins.get(w.id) ?? 0, w.id).toBeGreaterThan(0);
    // 어떤 총도 모든 항목을 독식하지 않는다
    for (const v of wins.values()) expect(v).toBeLessThan(5);
  });

  it('바람장은 미션 시간 동안 음수·NaN이 없다', () => {
    for (const m of MISSIONS) {
      const w = new WindField(m.wind, 3);
      for (let t = 0; t < 300; t += 0.7) {
        for (const d of [0, 300, 800, 1200]) {
          const s = w.sample(d, t);
          expect(Number.isFinite(s.speed) && s.speed >= 0).toBe(true);
        }
      }
    }
  });
});

describe('암살 작전 규칙', () => {
  it('민간인은 필수 표적이 아니고, 작전의 사람은 모두 역할과 외형이 있다', () => {
    for (const m of MISSIONS) {
      for (const t of m.targets.filter((x) => x.kind === 'person')) {
        expect(t.role, `${m.id}/${t.id}`).toBeDefined();
        expect(t.outfit, `${m.id}/${t.id}`).toBeDefined();
        if (t.role === 'civilian') expect(t.required).toBe(false);
      }
      if (m.dossier) expect(m.targets.some((t) => t.role === 'hvt' && t.outfit === m.dossier!.outfit)).toBe(true);
    }
  });
  it('민간인이 있는 작전은 민간인 외형이 표적 외형과 다르다(식별 가능)', () => {
    for (const m of MISSIONS) {
      const civ = new Set(m.targets.filter((t) => t.role === 'civilian').map((t) => t.outfit));
      for (const t of m.targets.filter((x) => x.role === 'hvt')) expect(civ.has(t.outfit)).toBe(false);
    }
  });
  it('총성 전파 규칙: 소음기·아음속탄일수록 들리는 범위가 좁다', () => {
    const H = BALANCE.targets.hearRadius;
    expect(H.std).toBeGreaterThan(H.stdSuppressed);
    expect(H.stdSuppressed).toBeGreaterThan(H.sub);
    expect(H.sub).toBeGreaterThan(H.subSuppressed);
    expect(H.subSuppressed).toBe(0);
  });
  it('M6: 아음속탄+소음기면 모든 보초가 총성을 듣지 못한다(경계 없이 클리어 가능)', () => {
    const m6 = MISSIONS.find((m) => m.id === 'm6')!;
    for (const t of m6.targets) expect(Math.hypot(t.x, t.dist)).toBeGreaterThan(BALANCE.targets.hearRadius.subSuppressed);
    // 보초끼리는 목격 반경 밖에 있다
    const people = m6.targets.filter((t) => t.behavior !== 'patrol');
    for (let i = 0; i < people.length; i++)
      for (let j = i + 1; j < people.length; j++) expect(Math.hypot(people[i].x - people[j].x, people[i].dist - people[j].dist)).toBeGreaterThan(BALANCE.targets.witnessRadius);
  });
  it('일일 계약: 표적 1명 + 경호원(선택) + 민간인(선택)', () => {
    for (let d = 0; d < 60; d++) {
      const m = buildDailyMission(todayKey(new Date(2026, 3, 1 + d)));
      expect(m.targets.filter((t) => t.role === 'hvt' && t.required)).toHaveLength(1);
      expect(m.targets.filter((t) => t.required)).toHaveLength(1);
      expect(m.dossier).toBeDefined();
    }
  });
});
