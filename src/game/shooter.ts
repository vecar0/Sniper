/**
 * 사수 상태: 흔들림 · 호흡 · 숨 참기 · 심박.
 * 순수 로직(렌더링 없음) → 단위 테스트 가능.
 *
 * 핵심 규칙:
 *  - 숨 참기 = 흔들림 80% 감소. 하지만 한계를 넘기면 흔들림이 2.6배로 커지고 심박이 오른다.
 *  - 숨이 30% 이상 회복돼야 다시 참을 수 있다(연타 꼼수 방지).
 */
import { BALANCE } from '../config/balance';

export interface ShooterEvents {
  heartbeat: boolean;
  holdStarted: boolean;
  holdEnded: boolean;
  exhausted: boolean;
}

export class ShooterModel {
  /** 남은 숨(0~1) */
  breath = 1;
  holding = false;
  exhausted = false;
  heartRate: number = BALANCE.shooter.heartRateRest;
  /** 현재 조준 오프셋(mil): x = 오른쪽, y = 위 */
  readonly offset = { x: 0, y: 0 };
  private t = 0;
  private heartPhase = 0;
  private heartKick = 0;
  private stateMul = 1;
  private breathAmp = 1;
  private readonly seedPhase: number;

  constructor(seedPhase = 0) {
    this.seedPhase = seedPhase;
  }

  reset(): void {
    this.breath = 1;
    this.holding = false;
    this.exhausted = false;
    this.heartRate = BALANCE.shooter.heartRateRest;
    this.heartPhase = 0;
    this.heartKick = 0;
    this.stateMul = 1;
    this.breathAmp = 1;
    this.t = 0;
    this.offset.x = 0;
    this.offset.y = 0;
  }

  canHold(): boolean {
    return !this.exhausted && this.breath >= BALANCE.shooter.breathMinToHold;
  }

  onShot(): void {
    this.heartRate += BALANCE.shooter.heartRatePerShot;
  }

  /**
   * @param wantHold 숨 참기 입력
   * @param holdMax 최대 숨 참기 시간(초, 난이도)
   * @param swayMul 흔들림 배율(난이도 × 총기)
   */
  update(dt: number, wantHold: boolean, holdMax: number, swayMul: number): ShooterEvents {
    const S = BALANCE.shooter;
    const ev: ShooterEvents = { heartbeat: false, holdStarted: false, holdEnded: false, exhausted: false };
    this.t += dt;

    if (wantHold && !this.holding && this.canHold()) {
      this.holding = true;
      ev.holdStarted = true;
    } else if (!wantHold && this.holding) {
      this.holding = false;
      ev.holdEnded = true;
    }

    if (this.holding) {
      this.breath -= dt / holdMax;
      if (this.breath <= 0) {
        this.breath = 0;
        this.holding = false;
        this.exhausted = true;
        ev.exhausted = true;
        ev.holdEnded = true;
      }
    } else {
      this.breath = Math.min(1, this.breath + dt * S.breathRecoverRate * (this.exhausted ? 0.6 : 1));
      if (this.exhausted && this.breath >= 0.6) this.exhausted = false;
    }

    // 심박
    const targetHr = this.exhausted ? S.heartRateExhausted : S.heartRateRest;
    if (this.heartRate > targetHr) this.heartRate = Math.max(targetHr, this.heartRate - S.heartRateRecoverPerSec * dt);
    else this.heartRate = Math.min(targetHr, this.heartRate + 12 * dt);
    this.heartPhase += (this.heartRate / 60) * dt;
    if (this.heartPhase >= 1) {
      this.heartPhase -= 1;
      this.heartKick = S.heartKick * (this.heartRate / S.heartRateRest);
      ev.heartbeat = true;
    }
    this.heartKick *= Math.exp(-14 * dt);

    // 흔들림 크기: 상태 전환은 부드럽게(0.2초 정도)
    const want = this.holding ? S.holdSwayMul : this.exhausted ? S.exhaustedSwayMul : 1;
    this.stateMul += (want - this.stateMul) * Math.min(1, dt * 5);
    this.breathAmp += ((this.holding ? 0 : this.exhausted ? 1.6 : 1) - this.breathAmp) * Math.min(1, dt * 4);

    const amp = S.swayAmplitude * swayMul * this.stateMul;
    const tt = this.t + this.seedPhase;
    const fx = S.swayFreqX * Math.PI * 2;
    const fy = S.swayFreqY * Math.PI * 2;
    this.offset.x = amp * (Math.sin(tt * fx) + 0.5 * Math.sin(tt * fx * 2.3 + 1.3)) / 1.5;
    this.offset.y =
      (amp * (Math.sin(tt * fy + 0.7) + 0.4 * Math.sin(tt * fy * 1.9 + 2.1))) / 1.4 +
      S.breathAmplitude * swayMul * this.breathAmp * Math.sin((tt * Math.PI * 2) / S.breathPeriod) +
      this.heartKick;
    return ev;
  }
}
