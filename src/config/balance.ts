/**
 * 게임 전체 밸런스 수치.
 * 규칙: 플레이 감각에 영향을 주는 숫자는 전부 여기(또는 weapons/missions/difficulty)에 둔다.
 * 각 값 옆에 "왜 이 값인지"를 적는다.
 */
export const BALANCE = {
  sim: {
    /** 게임 로직 고정 스텝(초). 120Hz: 흔들림·AI가 프레임레이트와 무관하게 같은 결과를 내도록. */
    fixedStep: 1 / 120,
    /** 한 프레임에 처리할 최대 실제 시간(초). 탭 복귀 시 시간이 한꺼번에 흐르는 것을 막는다. */
    maxFrameTime: 0.1,
    /** 탄도 적분 서브스텝(초). 800m/s 탄이 한 스텝에 0.8m만 이동 → 얇은 표적도 통과하지 않음. */
    bulletSubStep: 0.001,
    /** 탄이 이 시간 동안 아무것도 맞히지 않으면 제거(초). 1500m 아음속탄도 충분히 커버. */
    bulletMaxLife: 6,
    gravity: 9.80665,
  },

  camera: {
    /** 맨눈 시야각(수직, 도). */
    baseFov: 55,
    /** 스코프 1배율 기준 시야각(도). 스코프 FOV = 이 값 ÷ 배율. 실제 스코프의 시야(약 22~30°/배율)에 맞춤. */
    scopeBaseFov: 28,
    /** 조준 가능 범위(라디안). 사격 구역 밖으로 시선이 돌아가 길을 잃지 않게 제한. */
    yawLimit: (70 * Math.PI) / 180,
    pitchMin: (-20 * Math.PI) / 180,
    pitchMax: (15 * Math.PI) / 180,
    /** 사수 눈높이(m). 엎드려쏴 자세 기준. */
    eyeHeight: 0.45,
    /** 스코프 전환 시간(초). 0.18초: 즉각적이되 전환이 눈에 보이는 길이. */
    scopeTransition: 0.18,
  },

  input: {
    /** 마우스 기본 감도(라디안/픽셀). 1280px 이동 ≈ 90도. */
    mouseSensitivity: 0.0012,
    /** 터치 드래그 감도(라디안/픽셀). 손가락은 마우스보다 이동량이 작아 더 크게. */
    touchSensitivity: 0.0028,
    /** 스코프 감도 = 기본 감도 × (스코프FOV/기본FOV) × 이 값. 배율이 높아도 화면상 이동 속도가 일정하게. */
    scopedSensitivityScale: 1.0,
    /** 볼트 조작 중 누른 발사를 기억해 두는 시간(초). 입력 씹힘 방지. */
    fireBufferTime: 0.15,
    /** R 길게 눌러 재시작하는 데 필요한 시간(초). 실수 재시작 방지 + 충분히 빠름. */
    restartHoldTime: 0.5,
    /** 줌 1단계 배율 변화(곱). */
    zoomStep: 1.15,
  },

  shooter: {
    /** 기본 흔들림 진폭(mil). 양각대 엎드려쏴 기준. 0.35mil = 1000m에서 35cm → 숨 참지 않으면 헤드샷이 어렵다. */
    swayAmplitude: 0.35,
    /** 흔들림 주파수(Hz). 서로 소인 값 두 개로 8자 궤적을 만든다. */
    swayFreqX: 0.31,
    swayFreqY: 0.47,
    /** 호흡 주기(초)와 수직 진폭(mil). 호흡 정점(숨을 다 내쉰 순간)이 가장 안정적. */
    breathPeriod: 4.2,
    breathAmplitude: 0.45,
    /** 숨 참는 동안 흔들림 배율. 0.2 = 80% 감소 → 숨 참기의 가치가 분명히 느껴짐. */
    holdSwayMul: 0.2,
    /** 숨 참기 한계 초과 후 흔들림 배율. 오래 참으면 오히려 손해라는 것을 명확히 전달. */
    exhaustedSwayMul: 2.6,
    /** 숨 회복 속도(최대치 대비 초당 비율). 0.25 → 바닥에서 가득 차기까지 4초. */
    breathRecoverRate: 0.25,
    /** 숨이 이 비율 이상 회복돼야 다시 참을 수 있다. 연타 꼼수 방지. */
    breathMinToHold: 0.3,
    /** 심박(bpm). 평상시 / 숨 고갈 시 / 사격 직후 추가량. */
    heartRateRest: 68,
    heartRateExhausted: 118,
    heartRatePerShot: 4,
    heartRateRecoverPerSec: 3,
    /** 심박 한 번당 조준점 튐(mil). */
    heartKick: 0.06,
    /** 발사 순간 마우스가 빠르게 움직이고 있으면 생기는 추가 오차 계수(mil per rad/s). */
    triggerJerkPerRadPerSec: 2.0,
    triggerJerkMax: 0.6,
  },

  ballisticsAssist: {
    /** 예상 탄착점 갱신 간격(초). 매 프레임 계산할 필요가 없고 0.1초면 충분히 부드럽다. */
    predictInterval: 0.1,
  },

  targets: {
    /** 봇 이동 속도(m/s). 걷기 1.4 = 사람 보행 속도. 도주 3.6 = 가벼운 달리기(전력질주면 리드 불가). */
    walkSpeed: 1.4,
    runSpeed: 3.6,
    /** 총성을 들은 뒤 반응까지 시간(초) 범위. 사람 반응 시간 기반. */
    reactionMin: 0.5,
    reactionMax: 0.9,
    /** 아음속탄 착탄 소음이 들리는 반경(m). */
    subsonicImpactHearRadius: 20,
    /** 동료 파괴를 목격하고 경계하는 반경(m). 25m: M6 야영지의 보초 간격(30m 이상)보다 작게 → 조용히 하나씩 처리 가능. */
    witnessRadius: 25,
    witnessDelay: 1.0,
    /** 다리 부상 시 이동 속도 배율. */
    legHitSpeedMul: 0.5,
    /** 머리 판정 관대함 배율. 눈에 보이는 것보다 5% 크게 → 아슬아슬한 명중을 인정. */
    headHitboxScale: 1.05,
    speedOfSound: 343,
    /**
     * 총성 전파 규칙(소음기 × 탄종). 반경(m) 안의 사람만 듣는다. Infinity = 전부.
     * 일반탄: 초음속 파열음이 남아 소음기를 달아도 400m 안은 듣지만, 방향을 헷갈려 반응이 1.8배 느리다.
     * 아음속탄 + 소음기: 총성 없음(착탄음만).
     */
    hearRadius: { std: Infinity, stdSuppressed: 400, sub: 250, subSuppressed: 0 },
    suppressedReactionMul: 1.8,
    /** 순찰·대기 중인 사람이 시신을 발견하는 거리(m)와 반응 시간(초) */
    bodyDiscoveryRadius: 14,
    bodyDiscoveryDelay: 0.8,
    /** 스코프로 이 시간(초) 관측하면 식별 태그가 붙는다 */
    tagObserveTime: 0.7,
    /** 관측 판정 반경: 조준점이 사람 중심에서 이 각도(mil) 안 */
    tagObserveMil: 2.5,
  },

  feedback: {
    /** 착탄 후 히트스톱(초). 명중의 무게감. */
    hitStop: 0.06,
    headshotHitStop: 0.12,
    /** 착탄 정보 표시 시간(초). */
    hitMarkerTime: 2.5,
    /** 불릿캠: 실제 시간 기준 총 길이(초)와 마지막 구간 슬로모션 배율. */
    bulletCamDuration: 2.4,
    bulletCamFinalSlow: 0.08,
    bulletCamFinalWindow: 0.12,
  },

  scoring: {
    /** 데일리 챌린지 점수. 거리가 멀수록, 정확할수록 높게. */
    killBase: 100,
    perMeter: 0.1,
    headshotBonus: 50,
    missPenalty: 20,
    timeBonusPerSec: 2,
    timeBonusWindow: 90,
  },

  /** 별 누적에 따른 해금. 미션 8개 × 별 3 = 24개 중. */
  unlocks: {
    'k65': 6,
    'l338': 14,
    expert: 8,
  },
} as const;

export type Balance = typeof BALANCE;
