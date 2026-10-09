/**
 * 난이도. 같은 미션을 다른 "보조 수준"으로 플레이한다.
 * 탄도 물리는 모든 난이도에서 동일하다(규칙 일관성). 달라지는 것은 정보량과 여유뿐.
 */
export type DifficultyId = 'recruit' | 'marksman' | 'expert';

export interface DifficultySpec {
  id: DifficultyId;
  name: string;
  description: string;
  /** 레이저 거리측정기 사용 가능 */
  rangefinder: boolean;
  /** 풍속계: 'path' = 탄도 경로 평균 풍속(정확), 'local' = 사수 위치 풍속만, 'none' = 없음 */
  windMeter: 'path' | 'local' | 'none';
  /** 스코프에 예상 탄착점 표시 */
  predictedImpact: boolean;
  /** 흔들림 배율 */
  swayMul: number;
  /** 숨 참기 최대 시간(초) */
  breathHold: number;
  /** 표적 도주 속도·거리 배율(낮을수록 여유) */
  escapeSpeedMul: number;
  escapeDistanceMul: number;
  /** 별 해금 키 (없으면 기본 해금) */
  unlockKey?: 'expert';
}

export const DIFFICULTIES: Record<DifficultyId, DifficultySpec> = {
  recruit: {
    id: 'recruit',
    name: '훈련병',
    description: '예상 탄착점과 정확한 풍속을 보여줍니다. 처음이라면 여기서 시작하세요.',
    rangefinder: true,
    windMeter: 'path',
    predictedImpact: true,
    swayMul: 0.6,
    breathHold: 8,
    escapeSpeedMul: 0.75,
    escapeDistanceMul: 1.4,
  },
  marksman: {
    id: 'marksman',
    name: '저격수',
    description: '거리측정기와 사수 위치의 풍속만 제공됩니다. 바람은 깃발로 읽어야 합니다.',
    rangefinder: true,
    windMeter: 'local',
    predictedImpact: false,
    swayMul: 1.0,
    breathHold: 6,
    escapeSpeedMul: 1.0,
    escapeDistanceMul: 1.0,
  },
  expert: {
    id: 'expert',
    name: '현실',
    description: '보조 장비 없음. 레티클로 거리를 재고 깃발로 바람을 읽으세요.',
    rangefinder: false,
    windMeter: 'none',
    predictedImpact: false,
    swayMul: 1.2,
    breathHold: 5,
    escapeSpeedMul: 1.1,
    escapeDistanceMul: 0.9,
    unlockKey: 'expert',
  },
};
