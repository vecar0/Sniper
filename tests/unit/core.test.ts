import { describe, expect, it } from 'vitest';
import { defaultSave, SaveStore, SAVE_KEY, validateSave, type StorageLike } from '../../src/core/save';
import { GAME_TRANSITIONS, StateMachine } from '../../src/core/stateMachine';
import { ShooterModel } from '../../src/game/shooter';
import { RifleState, ELEV_MAX } from '../../src/game/rifle';
import { getWeapon } from '../../src/config/weapons';
import { BALANCE } from '../../src/config/balance';

class MemStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

describe('저장', () => {
  it('없으면 기본값', () => {
    const s = new SaveStore(new MemStorage());
    expect(s.data).toEqual(defaultSave());
    expect(s.loadWarning).toBeNull();
  });
  it('JSON이 깨졌으면 백업 후 초기화하고 경고', () => {
    const mem = new MemStorage();
    mem.setItem(SAVE_KEY, '{broken');
    const s = new SaveStore(mem);
    expect(s.data).toEqual(defaultSave());
    expect(s.loadWarning).toContain('손상');
    expect(mem.getItem(`${SAVE_KEY}.corrupt`)).toBe('{broken');
  });
  it('잘못된 타입·범위 필드만 기본값으로 교정', () => {
    const v = validateSave({
      settings: { masterVolume: 5, difficulty: 'god', invertY: 'yes', mouseSensitivity: NaN, keys: { fire: 'KeyK' } },
      progress: { missions: { m1: { stars: [true, 'x', false], bestTime: -3, cleared: true } }, daily: { a: 10, b: 'x' } },
    });
    expect(v.settings.masterVolume).toBe(1);
    expect(v.settings.difficulty).toBe('recruit');
    expect(v.settings.invertY).toBe(false);
    expect(v.settings.mouseSensitivity).toBe(1);
    expect(v.settings.keys.fire).toBe('KeyK');
    expect(v.settings.keys.scope).toBe('Mouse2');
    expect(v.progress.missions.m1.stars).toEqual([true, false, false]);
    expect(v.progress.missions.m1.bestTime).toBeNull();
    expect(v.progress.daily).toEqual({ a: 10 });
  });
  it('저장소 접근 불가 → 메모리 동작 + 안내', () => {
    const s = new SaveStore(null);
    expect(s.loadWarning).toContain('저장되지');
    s.save(); // 예외 없이 통과
  });
  it('저장 후 다시 불러오면 동일', () => {
    const mem = new MemStorage();
    const a = new SaveStore(mem);
    a.data.progress.missions.m1 = { stars: [true, true, false], bestTime: 42.5, cleared: true };
    a.data.settings.reticleColor = 'red';
    a.save();
    const b = new SaveStore(mem);
    expect(b.data).toEqual(a.data);
    expect(b.totalStars()).toBe(2);
  });
});

describe('상태 머신', () => {
  it('허용되지 않은 전환은 무시', () => {
    const fsm = new StateMachine('loading', GAME_TRANSITIONS);
    expect(fsm.go('playing')).toBe(false);
    expect(fsm.go('menu')).toBe(true);
    expect(fsm.go('result')).toBe(false);
    expect(fsm.go('briefing')).toBe(true);
    expect(fsm.go('playing')).toBe(true);
    expect(fsm.go('paused')).toBe(true);
    expect(fsm.go('paused')).toBe(false);
    expect(fsm.go('playing')).toBe(true);
    expect(fsm.state).toBe('playing');
  });
  it('일시정지 ↔ 재개 100회 반복해도 상태가 꼬이지 않는다', () => {
    const fsm = new StateMachine('playing', GAME_TRANSITIONS);
    for (let i = 0; i < 100; i++) {
      fsm.go('paused');
      fsm.go('playing');
    }
    expect(fsm.state).toBe('playing');
  });
});

describe('사수(호흡·흔들림)', () => {
  const amp = (m: ShooterModel, hold: boolean, secs: number) => {
    let max = 0;
    for (let t = 0; t < secs; t += 1 / 120) {
      m.update(1 / 120, hold, 6, 1);
      max = Math.max(max, Math.hypot(m.offset.x, m.offset.y));
    }
    return max;
  };
  it('숨을 참으면 흔들림이 크게 줄어든다', () => {
    const a = new ShooterModel();
    amp(a, false, 2);
    const free = amp(a, false, 4);
    const b = new ShooterModel();
    amp(b, true, 0.6);
    const held = amp(b, true, 2);
    expect(held).toBeLessThan(free * 0.45);
  });
  it('한계를 넘기면 숨이 차고 흔들림이 커진다', () => {
    const m = new ShooterModel();
    let exhausted = false;
    for (let t = 0; t < 7; t += 1 / 120) if (m.update(1 / 120, true, 6, 1).exhausted) exhausted = true;
    expect(exhausted).toBe(true);
    expect(m.holding).toBe(false);
    expect(m.canHold()).toBe(false);
    const big = amp(m, false, 3);
    const fresh = new ShooterModel();
    expect(big).toBeGreaterThan(amp(fresh, false, 3));
  });
  it('숨이 30% 미만이면 다시 참을 수 없다(연타 꼼수 방지)', () => {
    const m = new ShooterModel();
    m.breath = BALANCE.shooter.breathMinToHold - 0.05;
    m.update(1 / 120, true, 6, 1);
    expect(m.holding).toBe(false);
  });
});

describe('총기', () => {
  it('발사 → 볼트 → 장전 순서', () => {
    const r = new RifleState(getWeapon('r308'));
    r.reset(10);
    expect(r.canFire()).toBe(true);
    r.fire();
    expect(r.canFire()).toBe(false);
    let ev: string | null = null;
    const events: string[] = [];
    for (let t = 0; t < 2; t += 1 / 120) {
      ev = r.update(1 / 120);
      if (ev) events.push(ev);
    }
    expect(events).toEqual(['boltStart', 'boltDone']);
    expect(r.canFire()).toBe(true);
    expect(r.inMag).toBe(4);
  });
  it('탄창이 비면 재장전, 예비탄이 없으면 empty', () => {
    const r = new RifleState(getWeapon('r308'));
    r.reset(6);
    const events: string[] = [];
    for (let shot = 0; shot < 6; shot++) {
      while (!r.canFire()) {
        const e = r.update(1 / 120);
        if (e) events.push(e);
        if (e === 'empty') break;
      }
      r.fire();
    }
    for (let t = 0; t < 1; t += 1 / 120) {
      const e = r.update(1 / 120);
      if (e) events.push(e);
    }
    expect(events).toContain('reloadStart');
    expect(events[events.length - 1]).toBe('empty');
    expect(r.totalRounds).toBe(0);
  });
  it('터렛은 0.1mil 단위, 범위 제한', () => {
    const r = new RifleState(getWeapon('r308'));
    r.reset(5);
    r.dialElev(3);
    expect(r.elevMil).toBeCloseTo(0.3);
    r.dialElev(-10);
    expect(r.elevMil).toBe(0);
    r.dialElev(9999);
    expect(r.elevMil).toBe(ELEV_MAX);
    r.dialWind(-7);
    expect(r.windMil).toBeCloseTo(-0.7);
  });
  it('탄종 변경은 재장전 시간이 들고 탄약 총량은 유지', () => {
    const r = new RifleState(getWeapon('r308'));
    r.reset(15);
    expect(r.switchAmmo()).toBe(true);
    expect(r.ammo.subsonic).toBe(true);
    expect(r.canFire()).toBe(false);
    for (let t = 0; t < 3; t += 1 / 120) r.update(1 / 120);
    expect(r.canFire()).toBe(true);
    expect(r.totalRounds).toBe(15);
  });
  it('무제한 탄약(사격장)', () => {
    const r = new RifleState(getWeapon('r308'));
    r.reset(0);
    expect(r.reserve).toBe(Infinity);
  });
});
