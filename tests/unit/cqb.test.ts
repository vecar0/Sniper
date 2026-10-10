import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CQB_WEAPONS, cqbStats, getCqb, validParts } from '../../src/config/sidearms';
import { CqbGun } from '../../src/game/cqb';
import { Interior } from '../../src/game/interior';
import { HumanMaterials } from '../../src/game/models/human';

const base = (id: string) => validParts(getCqb(id), undefined);

describe('실내 화기 · 파츠', () => {
  it('파츠는 얻는 것과 잃는 것이 함께 있다', () => {
    const w = getCqb('c4');
    const b = cqbStats(w, base('c4'));
    const sup = cqbStats(w, { ...base('c4'), muzzle: 'sup' });
    expect(sup.noise).toBeLessThan(b.noise * 0.3);
    expect(sup.damage).toBeLessThan(b.damage);
    const ext = cqbStats(w, { ...base('c4'), mag: 'ext' });
    expect(ext.magazine).toBe(45);
    expect(ext.reloadTime).toBeGreaterThan(b.reloadTime);
    const x2 = cqbStats(w, { ...base('c4'), optic: 'x2' });
    expect(x2.adsSpread).toBeLessThan(b.adsSpread);
    expect(x2.adsTime).toBeGreaterThan(b.adsTime);
    const laser = cqbStats(w, { ...base('c4'), under: 'laser' });
    expect(laser.hipSpread).toBeLessThan(b.hipSpread);
    expect(laser.detect).toBeGreaterThan(1);
  });

  it('총이 못 쓰는 파츠는 저장값이 있어도 기본으로 고쳐진다', () => {
    const p = validParts(getCqb('p9'), { muzzle: 'comp', optic: 'x2', mag: 'ext', under: 'grip' });
    expect(p).toEqual({ muzzle: 'none', optic: 'iron', mag: 'ext', under: 'none' });
  });

  it('단발 권총은 한 번 누를 때 한 발, 연발 총은 누르는 동안 계속', () => {
    const pistol = new CqbGun('p9', base('p9'));
    let n = 0;
    for (let i = 0; i < 120; i++) {
      pistol.update(1 / 120, false, true);
      if (pistol.trigger(true)) n++;
    }
    expect(n).toBe(1);
    const smg = new CqbGun('v45', base('v45'));
    n = 0;
    for (let i = 0; i < 120; i++) {
      smg.update(1 / 120, false, true);
      if (smg.trigger(true)) n++;
    }
    // 800rpm → 1초에 약 13발
    expect(n).toBeGreaterThanOrEqual(12);
    expect(n).toBeLessThanOrEqual(14);
  });

  it('탄창이 비면 자동 재장전, 예비탄에서 채운다', () => {
    const g = new CqbGun('p9', base('p9'));
    for (let i = 0; i < 12; i++) {
      g.trigger(false);
      g.update(1, false, true);
      expect(g.trigger(true)).toBe(true);
    }
    expect(g.inMag).toBe(0);
    expect(g.reloading).toBe(true);
    g.update(g.stats.reloadTime + 0.01, false, true);
    expect(g.inMag).toBe(12);
    expect(g.reserve).toBe(24);
  });

  it('조준하면 탄 퍼짐이 줄고, 움직이면 늘어난다', () => {
    const g = new CqbGun('c4', base('c4'));
    const hip = g.spread(false, false);
    for (let i = 0; i < 60; i++) g.update(1 / 60, true, true);
    expect(g.ads).toBe(1);
    expect(g.spread(false, false)).toBeLessThan(hip * 0.3);
    expect(g.spread(true, false)).toBeGreaterThan(g.spread(false, false));
  });

  it('모든 실내 화기가 정의돼 있다', () => {
    expect(CQB_WEAPONS.map((w) => w.kind).sort()).toEqual(['carbine', 'pistol', 'smg']);
  });
});

describe('실내 탄 판정', () => {
  const spec = {
    name: '사격장',
    layout: ['##w##', '#.N.#', '#...#', '#.c.#', '#...#', '#S.E#'],
    guards: [{ path: [[2, 4]] as [number, number][], yaw: 180 }],
  };
  const make = () => {
    const it = new Interior(spec, 0, { wall: 0x888888, floor: 0x555555, trim: 0x333333 }, false);
    it.spawnGuards(new HumanMaterials(), 'guard');
    return it;
  };
  it('머리·몸통을 구분해 맞힌다', () => {
    const it = make();
    const g = it.guards[0];
    const from = new THREE.Vector3(g.pos.x, 1.66, g.pos.z - 3);
    const head = it.ray(from, new THREE.Vector3(0, 0, 1), 20);
    expect(head?.kind).toBe('guard');
    expect(head?.zone).toBe('head');
    const body = it.ray(new THREE.Vector3(g.pos.x, 1.2, g.pos.z - 3), new THREE.Vector3(0, 0, 1), 20);
    expect(body?.zone).toBe('body');
  });
  it('낮은 상자는 낮게 날아가는 탄을 막고, 그 위로는 지나간다', () => {
    const it = make();
    const g = it.guards[0];
    const low = it.ray(new THREE.Vector3(g.pos.x, 0.5, g.pos.z - 3), new THREE.Vector3(0, 0, 1), 20);
    expect(low?.kind).toBe('wall');
    const high = it.ray(new THREE.Vector3(g.pos.x, 1.2, g.pos.z - 3), new THREE.Vector3(0, 0, 1), 20);
    expect(high?.kind).toBe('guard');
  });
  it('머리 한 발이면 쓰러지고, 몸통은 여러 발', () => {
    const it = make();
    const g = it.guards[0];
    const me = new THREE.Vector2(0, 0);
    const st = cqbStats(getCqb('p9'), base('p9'));
    expect(it.damage(g, st.damage, me)).toBe(false);
    expect(g.state).toBe('combat');
    expect(it.damage(g, st.damage * st.headMul, me)).toBe(true);
    expect(g.down).toBe(true);
  });
  it('소리 반경 밖 경비는 반응하지 않는다', () => {
    const it = make();
    const g = it.guards[0];
    const far = it.noise(new THREE.Vector2(g.pos.x + 50, g.pos.z), 5, () => false);
    expect(far.length).toBe(0);
    const near = it.noise(new THREE.Vector2(g.pos.x + 2, g.pos.z), 5, () => false);
    expect(near).toContain(g);
    expect(g.state).toBe('search');
  });
});
