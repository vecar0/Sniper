/**
 * 실내 화기 상태: 장탄 · 연사 간격 · 재장전 · 조준(ADS) · 탄 퍼짐 · 반동.
 * 렌더링과 무관한 순수 로직(단위 테스트 가능).
 */
import { cqbStats, getCqb, type CqbSpec, type CqbStats, type PartChoice } from '../config/sidearms';

export class CqbGun {
  readonly spec: CqbSpec;
  readonly parts: PartChoice;
  readonly stats: CqbStats;
  inMag = 0;
  reserve = 0;
  cooldown = 0;
  reloadTimer = 0;
  /** 조준 진행도 0(허리) ~ 1(조준) */
  ads = 0;
  /** 연사로 쌓이는 추가 퍼짐(도) */
  bloom = 0;
  /** 반동으로 튄 시선(라디안, 위로 +) – 서서히 돌아온다 */
  kick = 0;
  /** 단발 총: 방아쇠를 뗐다가 다시 눌러야 다음 발 */
  private triggerHeld = false;

  constructor(id: string, parts: PartChoice) {
    this.spec = getCqb(id);
    this.parts = parts;
    this.stats = cqbStats(this.spec, parts);
    this.reset();
  }

  reset(): void {
    this.inMag = this.stats.magazine;
    this.reserve = this.stats.reserve;
    this.cooldown = 0;
    this.reloadTimer = 0;
    this.ads = 0;
    this.bloom = 0;
    this.kick = 0;
    this.triggerHeld = false;
  }

  get reloading(): boolean {
    return this.reloadTimer > 0;
  }

  get reloadProgress(): number {
    return this.reloadTimer > 0 ? 1 - this.reloadTimer / this.stats.reloadTime : -1;
  }

  /** 현재 탄 퍼짐(도) */
  spread(moving: boolean, crouched: boolean): number {
    const s = this.stats;
    const base = s.hipSpread + (s.adsSpread - s.hipSpread) * this.ads;
    return (base + this.bloom) * (moving ? 1.6 : 1) * (crouched ? 0.8 : 1);
  }

  /** @returns 재장전이 끝났으면 'reloaded' */
  update(dt: number, wantAds: boolean, canAds: boolean): 'reloaded' | null {
    let ev: 'reloaded' | null = null;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloadTimer = 0;
        const need = this.stats.magazine - this.inMag;
        const take = Math.min(need, this.reserve);
        this.inMag += take;
        this.reserve -= take;
        ev = 'reloaded';
      }
    }
    const target = wantAds && canAds && !this.reloading ? 1 : 0;
    const rate = dt / Math.max(0.05, this.stats.adsTime);
    this.ads = target > this.ads ? Math.min(target, this.ads + rate) : Math.max(target, this.ads - rate * 1.4);
    this.bloom = Math.max(0, this.bloom - dt * 4);
    this.kick *= Math.exp(-dt * 9);
    return ev;
  }

  /**
   * 방아쇠 입력 처리.
   * @param down 방아쇠를 누르고 있는가
   * @returns 이번 스텝에 한 발 나가면 true
   */
  trigger(down: boolean): boolean {
    if (!down) {
      this.triggerHeld = false;
      return false;
    }
    const first = !this.triggerHeld;
    this.triggerHeld = true;
    if (!this.stats.auto && !first) return false;
    if (this.reloading || this.cooldown > 0) return false;
    if (this.inMag <= 0) {
      if (first) this.startReload();
      return false;
    }
    this.inMag--;
    this.cooldown = this.stats.interval;
    this.bloom = Math.min(this.bloom + this.stats.recoil * 0.35, 4);
    this.kick += (this.stats.recoil * Math.PI) / 180;
    if (this.inMag === 0 && this.reserve > 0) this.startReload();
    return true;
  }

  startReload(): boolean {
    if (this.reloading || this.inMag >= this.stats.magazine || this.reserve <= 0) return false;
    this.reloadTimer = this.stats.reloadTime;
    return true;
  }

  /** 무기를 바꾸면 재장전은 취소(탄은 그대로) */
  holster(): void {
    this.reloadTimer = 0;
    this.ads = 0;
    this.triggerHeld = false;
  }
}
