/**
 * 총기 상태: 탄창 · 볼트 · 재장전 · 터렛 · 영점 · 탄도표.
 * 순수 로직(렌더링 없음).
 */
import { BALANCE } from '../config/balance';
import { SUPPRESSOR, type AmmoSpec, type WeaponSpec } from '../config/weapons';
import { airDensity, speedOfSound } from '../ballistics/atmosphere';
import { buildDope, NO_WIND, solveZeroAngle, type BallisticEnv, type DopeRow, type ProjectileParams } from '../ballistics/solver';

/** 터렛 1클릭 = 0.1mil */
export const CLICK_MIL = 0.1;
export const ELEV_MAX = 30;
export const WIND_MAX = 10;

export type RifleEvent = 'boltDone' | 'reloadDone' | 'boltStart' | 'reloadStart' | 'empty' | null;

export class RifleState {
  weapon: WeaponSpec;
  ammoIndex = 0;
  inMag = 0;
  /** 예비탄(Infinity = 무제한) */
  reserve = 0;
  chambered = false;
  boltTimer = 0;
  reloadTimer = 0;
  /** 발사 직후 볼트 조작까지 잠깐 기다림(반동을 보고 나서 조작하는 느낌) */
  private boltDelay = 0;
  elevMil = 0;
  windMil = 0;
  /** 영점 각도(표준 대기에서 영점을 잡았다고 가정) */
  zeroAngles: number[] = [];
  private dopeCache = new Map<string, DopeRow[]>();

  readonly suppressor: boolean;

  constructor(weapon: WeaponSpec, suppressor = false) {
    this.weapon = weapon;
    this.suppressor = suppressor;
    const std: BallisticEnv = { density: airDensity(0, 15), soundSpeed: speedOfSound(15), gravity: BALANCE.sim.gravity, windAt: NO_WIND };
    this.zeroAngles = weapon.ammo.map((a) => solveZeroAngle(this.params(a), std, weapon.sightHeight, weapon.zeroRange));
  }

  get ammo(): AmmoSpec {
    return this.weapon.ammo[this.ammoIndex];
  }

  get zeroAngle(): number {
    return this.zeroAngles[this.ammoIndex];
  }

  params(a: AmmoSpec = this.ammo): ProjectileParams {
    const v = a.muzzleVelocity * (this.suppressor ? SUPPRESSOR.velocityMul : 1);
    return { muzzleVelocity: v, bcG7: a.bcG7, stability: this.weapon.stability };
  }

  reset(totalAmmo: number): void {
    const total = totalAmmo <= 0 ? Infinity : totalAmmo;
    this.ammoIndex = 0;
    this.inMag = Math.min(this.weapon.magazine, total);
    this.reserve = total - this.inMag;
    this.chambered = this.inMag > 0;
    this.boltTimer = 0;
    this.reloadTimer = 0;
    this.boltDelay = 0;
    this.elevMil = 0;
    this.windMil = 0;
  }

  get busy(): boolean {
    return this.boltTimer > 0 || this.reloadTimer > 0 || this.boltDelay > 0;
  }

  canFire(): boolean {
    return this.chambered && !this.busy;
  }

  get totalRounds(): number {
    return this.inMag + this.reserve;
  }

  fire(): void {
    this.chambered = false;
    this.inMag--;
    this.boltDelay = 0.12;
  }

  /** 탄종 변경: 탄창을 갈아 끼우는 시간이 든다 */
  switchAmmo(): boolean {
    if (this.weapon.ammo.length < 2 || this.reloadTimer > 0) return false;
    this.ammoIndex = (this.ammoIndex + 1) % this.weapon.ammo.length;
    // 남은 탄은 공용 탄약으로 간주(단순화). inMag에는 약실의 탄도 포함된다.
    this.reserve += this.inMag;
    this.inMag = 0;
    this.chambered = false;
    this.boltTimer = 0;
    this.boltDelay = 0;
    this.reloadTimer = this.weapon.reloadTime;
    return true;
  }

  update(dt: number): RifleEvent {
    if (this.boltDelay > 0) {
      this.boltDelay -= dt;
      if (this.boltDelay <= 0) {
        this.boltDelay = 0;
        if (this.inMag > 0) {
          this.boltTimer = this.weapon.boltTime;
          return 'boltStart';
        }
        if (this.reserve > 0) {
          this.reloadTimer = this.weapon.reloadTime;
          return 'reloadStart';
        }
        return 'empty';
      }
      return null;
    }
    if (this.boltTimer > 0) {
      this.boltTimer -= dt;
      if (this.boltTimer <= 0) {
        this.boltTimer = 0;
        this.chambered = true;
        return 'boltDone';
      }
    }
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloadTimer = 0;
        const n = Math.min(this.weapon.magazine, this.reserve);
        this.inMag = n;
        this.reserve -= n;
        this.chambered = n > 0;
        return 'reloadDone';
      }
    }
    return null;
  }

  dialElev(clicks: number): boolean {
    const v = Math.round((this.elevMil + clicks * CLICK_MIL) * 10) / 10;
    const c = Math.min(ELEV_MAX, Math.max(0, v));
    const changed = c !== this.elevMil;
    this.elevMil = c;
    return changed;
  }

  dialWind(clicks: number): boolean {
    const v = Math.round((this.windMil + clicks * CLICK_MIL) * 10) / 10;
    const c = Math.min(WIND_MAX, Math.max(-WIND_MAX, v));
    const changed = c !== this.windMil;
    this.windMil = c;
    return changed;
  }

  resetTurrets(): void {
    this.elevMil = 0;
    this.windMil = 0;
  }

  /** 미션 대기 조건에서의 탄도표 */
  dope(altitude: number, temperature: number, maxRange: number): DopeRow[] {
    const key = `${this.weapon.id}:${this.suppressor}:${this.ammoIndex}:${altitude}:${temperature}:${maxRange}`;
    const cached = this.dopeCache.get(key);
    if (cached) return cached;
    const env: BallisticEnv = { density: airDensity(altitude, temperature), soundSpeed: speedOfSound(temperature), gravity: BALANCE.sim.gravity, windAt: NO_WIND };
    const ranges: number[] = [];
    for (let r = 100; r <= maxRange; r += r < 600 ? 50 : 100) ranges.push(r);
    const rows = buildDope(this.params(), this.ammo.mass, env, this.weapon.sightHeight, this.zeroAngle, ranges);
    this.dopeCache.set(key, rows);
    return rows;
  }
}
