/**
 * 작전 데이터. 새 작전은 이 배열에 객체를 추가하는 것만으로 만들 수 있다.
 *
 * 세계관: 계약 저격수 조직 "고스트 프로토콜". 자격 심사(강철판) 3단계를 통과한 뒤 실전 작전에 투입된다.
 *
 * 좌표계: 사수는 원점, 사격 방향은 -Z. `dist`는 사수로부터의 전방 거리(m), `x`는 좌우(+오른쪽).
 * 바람 방향 `dir`(도): 바람이 "불어가는" 방향. 0 = 뒤바람(표적 쪽으로), 90 = 왼쪽에서 오른쪽, 180 = 맞바람, 270 = 오른쪽에서 왼쪽.
 *
 * 설계 원칙(난이도 곡선): 작전마다 새 요소를 정확히 하나 소개하고, 앞에서 배운 것을 섞는다.
 */
export type ThemeId = 'plains' | 'desert' | 'forest' | 'snow' | 'mountain';
export type TimeOfDay = 'day' | 'dawn' | 'dusk' | 'overcast';

export interface WindZone {
  /** 이 구간이 시작되는 거리(m) */
  from: number;
  /** 풍속(m/s) */
  speed: number;
  /** 바람 방향(도) */
  dir: number;
}

export interface GustSpec {
  /** 돌풍 간격 범위(초) */
  intervalMin: number;
  intervalMax: number;
  /** 추가 풍속(m/s) */
  strength: number;
  /** 상승 시간(초): 깃발이 먼저 펄럭이며 예고되는 시간 */
  rise: number;
  hold: number;
  fall: number;
}

export interface WindSpec {
  zones: WindZone[];
  /** 느린 풍속 변동 폭(비율). 0.1 = ±10% */
  variability: number;
  gusts?: GustSpec;
}

export type TargetBehavior = 'static' | 'idle' | 'patrol';
/** hvt = 핵심 표적, guard = 경비병, civilian = 민간인(사살 시 작전 실패) */
export type Role = 'hvt' | 'guard' | 'civilian';
export type OutfitId = 'guard' | 'guardDesert' | 'guardSnow' | 'hvtSuit' | 'hvtOfficer' | 'courier' | 'civilian' | 'civilianRed' | 'scientist';

export interface TargetDef {
  id: string;
  kind: 'plate' | 'person';
  x: number;
  dist: number;
  /** 강철판 크기(m) */
  w?: number;
  h?: number;
  shape?: 'circle' | 'rect';
  /** 사람 표적 역할과 외형 */
  role?: Role;
  outfit?: OutfitId;
  behavior?: TargetBehavior;
  /** 순찰 경로 [x, dist] 목록 */
  path?: [number, number][];
  /** 순찰 끝점에서 멈추는 시간(초) */
  pause?: number;
  /** 경계 시 도주 목표 [x, dist]. 도달하면 탈출. 민간인은 없으면 자동 생성 */
  escape?: [number, number];
  /** 클리어에 필요한 표적인지 */
  required: boolean;
  /** 표적 이름(HUD·결과 표시용) */
  label?: string;
  /** 바라보는 방향(도, 0 = 사수 쪽) */
  facing?: number;
}

export interface PropDef {
  kind:
    | 'building'
    | 'rock'
    | 'crate'
    | 'tent'
    | 'wall'
    | 'tower'
    | 'road'
    | 'fence'
    | 'truck'
    | 'jeep'
    | 'barrel'
    | 'sandbag'
    | 'radar'
    | 'antenna'
    | 'container';
  x: number;
  dist: number;
  w: number;
  h: number;
  d: number;
  rot?: number;
}

export type ObjectiveType = 'clear' | 'accuracy' | 'time' | 'headshots' | 'noAlert' | 'holdOnly' | 'maxShots' | 'ghost' | 'noTakedown';

export interface ObjectiveDef {
  type: ObjectiveType;
  value?: number;
  label: string;
}

export type HintTrigger =
  | 'scope'
  | 'zoom'
  | 'breath'
  | 'fire'
  | 'hit'
  | 'dope'
  | 'turretElev'
  | 'turretWind'
  | 'rangefinder'
  | 'ammo'
  | 'tag'
  | 'move'
  | 'crouch'
  | 'takedown'
  | 'nest'
  | 'none';

export interface HintDef {
  /** 표시할 문구. {키이름}은 현재 키 설정으로 치환된다. */
  text: string;
  /** 이 행동을 하면 다음 힌트로 넘어간다 */
  until: HintTrigger;
  /** 터치 기기용 문구(없으면 text 사용) */
  touchText?: string;
}

/** 실내 경비 */
export interface InteriorGuardDef {
  /** 순찰 경유점(배치도 [열, 행]). 하나면 제자리 경비 */
  path: [number, number][];
  /** 경유점마다 멈추는 시간(초) */
  pause?: number;
  /** 제자리 경비가 바라보는 방향(도): 0 = 아래(뒤쪽), 90 = 오른쪽, 180 = 위(창문 쪽), -90 = 왼쪽 */
  yaw?: number;
  outfit?: OutfitId;
  label?: string;
}

/** 잠입할 건물: 문자 배치도(설명은 src/game/interior.ts 맨 위) */
export interface InteriorSpec {
  name: string;
  layout: string[];
  guards: InteriorGuardDef[];
}

/** 표적 신상 파일 */
export interface Dossier {
  name: string;
  alias: string;
  summary: string;
  /** 식별 특징(스코프로 확인할 것) */
  features: string[];
  outfit: OutfitId;
}

export interface MissionDef {
  id: string;
  /** 작전명(코드네임) */
  codename: string;
  name: string;
  subtitle: string;
  category: 'qualification' | 'operation' | 'range' | 'contract';
  /** 브리핑 문장(2줄 이내 권장) */
  briefing: string[];
  /** 정보 항목(지도 옆에 표시) */
  intel?: string[];
  dossier?: Dossier;
  /** 이 작전에서 새로 배우는 것 */
  newSkill: string;
  theme: ThemeId;
  timeOfDay: TimeOfDay;
  atmosphere: { altitude: number; temperature: number };
  wind: WindSpec;
  /** 총 탄약(탄창 포함). 0 = 무제한 */
  ammoTotal: number;
  /** 제한 시간(초). 0 = 없음 */
  timeLimit: number;
  targets: TargetDef[];
  props: PropDef[];
  objectives: [ObjectiveDef, ObjectiveDef, ObjectiveDef];
  hints?: HintDef[];
  /** 거리측정기 비활성화(난이도 무관) */
  noRangefinder?: boolean;
  /** 사용 총기 고정 */
  weaponLock?: string;
  /** 깃발 간격(m) */
  flagSpacing?: number;
  /** 사격장 모드 */
  isRange?: boolean;
  /** 잠입 → 저격 → 탈출: 건물 안에서 시작해 창가 저격 위치까지 이동 */
  interior?: InteriorSpec;
}

const CLEAR: ObjectiveDef = { type: 'clear', label: '모든 필수 표적 제거' };
const ACCURACY: ObjectiveDef = { type: 'accuracy', label: '명중률 100% (빗나감 없음)' };

export const MISSIONS: MissionDef[] = [
  {
    id: 'm1',
    codename: '자격 심사 I',
    name: '첫 발',
    subtitle: '기초 사격',
    category: 'qualification',
    briefing: ['고스트 프로토콜 저격수 자격 심사를 시작합니다.', '강철판 두 개를 맞히십시오. 바람은 없습니다.'],
    intel: ['무풍 · 100m에 맞춰진(영점) 총', '▲ 1번 = 100m에서 1cm 위로', '훈련병: [거리]로 재면 보정이 자동으로 맞춰짐'],
    newSkill: '조준 · 숨 참기 · 위아래 보정',
    theme: 'plains',
    timeOfDay: 'day',
    atmosphere: { altitude: 100, temperature: 15 },
    wind: { zones: [{ from: 0, speed: 0, dir: 90 }], variability: 0 },
    ammoTotal: 15,
    timeLimit: 0,
    targets: [
      { id: 'p1', kind: 'plate', x: 0, dist: 200, w: 0.6, h: 0.6, shape: 'circle', required: true, label: '200m 강철판' },
      { id: 'p2', kind: 'plate', x: 9, dist: 350, w: 0.6, h: 0.6, shape: 'circle', required: true, label: '350m 강철판' },
    ],
    props: [
      { kind: 'sandbag', x: -5, dist: 205, w: 3, h: 0.8, d: 1 },
      { kind: 'crate', x: 14, dist: 345, w: 1.5, h: 1, d: 1.5 },
      { kind: 'barrel', x: 12, dist: 352, w: 0.6, h: 0.9, d: 0.6 },
    ],
    objectives: [CLEAR, ACCURACY, { type: 'time', value: 60, label: '60초 이내 완료' }],
    hints: [
      { text: '{scope} 로 스코프를 들여다보세요.', touchText: '[스코프] 버튼을 누르세요.', until: 'scope' },
      { text: '마우스 휠로 배율을 올려 200m 강철판을 찾으세요.', touchText: '두 손가락으로 벌리거나 [+] 버튼으로 배율을 올리세요.', until: 'zoom' },
      { text: '{breath} 를 누르고 있으면 숨을 참아 흔들림이 줄어듭니다.', touchText: '[숨] 버튼을 누르고 있으면 흔들림이 줄어듭니다.', until: 'breath' },
      { text: '숨을 참은 채 강철판 중앙에 맞추고 {fire} 로 쏘세요.', touchText: '숨을 참은 채 강철판 중앙에 맞추고 [발사]를 누르세요.', until: 'hit' },
      { text: '다음은 350m. 멀수록 탄이 아래로 떨어집니다. {rangefinder} 로 거리를 재거나 {dope} 로 보정표를 여세요.', touchText: '다음은 350m. 멀수록 탄이 떨어집니다. [거리]로 재거나 [표]를 여세요.', until: 'dope' },
      { text: '보정표 350m 줄의 횟수만큼 {elevUp}(▲)를 누르세요.', touchText: '보정표 350m 줄의 횟수만큼 [▲]를 누르세요.', until: 'turretElev' },
      { text: '보정이 끝났으면 십자선 가운데를 표적에 그대로 겨누고 쏘세요.', until: 'hit' },
    ],
  },
  {
    id: 'm2',
    codename: '자격 심사 II',
    name: '바람 읽기',
    subtitle: '횡풍 보정',
    category: 'qualification',
    briefing: ['왼쪽에서 바람이 붑니다. 깃발이 얼마나 펄럭이는지 보십시오.', '바람은 탄을 오른쪽으로 밀어냅니다.'],
    intel: ['바람 약 3m/s, 왼쪽(9시)에서 불어옴', '깃발이 옆으로 많이 펄럭일수록 센 바람'],
    newSkill: '바람 보정 (깃발 읽기 · 바람 쪽으로 겨누기)',
    theme: 'plains',
    timeOfDay: 'overcast',
    atmosphere: { altitude: 150, temperature: 18 },
    wind: { zones: [{ from: 0, speed: 3, dir: 90 }], variability: 0.08 },
    ammoTotal: 15,
    timeLimit: 0,
    targets: [
      { id: 'p1', kind: 'plate', x: -4, dist: 400, w: 0.6, h: 0.6, shape: 'circle', required: true, label: '400m 강철판' },
      { id: 'p2', kind: 'plate', x: 10, dist: 500, w: 0.6, h: 0.6, shape: 'circle', required: true, label: '500m 강철판' },
    ],
    props: [
      { kind: 'rock', x: 3, dist: 395, w: 2.5, h: 1, d: 2 },
      { kind: 'sandbag', x: 14, dist: 503, w: 3, h: 0.8, d: 1 },
    ],
    objectives: [CLEAR, ACCURACY, { type: 'holdOnly', label: '좌우 보정(◀▶) 없이 조준점만 옮겨서 명중' }],
    hints: [
      { text: '깃발과 왼쪽 바람 표시를 보세요. 바람이 탄을 오른쪽으로 밉니다.', until: 'scope' },
      { text: '{dope} 보정표의 "바람 1m/s당" × 풍속 = 왼쪽으로 옮길 칸 수입니다.', touchText: '[표] 보정표의 "바람 1m/s당" × 풍속 = 왼쪽으로 옮길 칸 수', until: 'dope' },
      { text: '위아래는 ▲▼로 맞추고, 바람만큼 표적 왼쪽(바람 오는 쪽)을 겨누세요. 십자선 작은 눈금 1개 = 10칸.', until: 'hit' },
    ],
  },
  {
    id: 'm3',
    codename: '자격 심사 III',
    name: '눈으로 재는 거리',
    subtitle: '밀 거리측정',
    category: 'qualification',
    briefing: ['모래폭풍으로 거리측정기가 고장났습니다.', '표적판의 높이는 정확히 1m입니다. 레티클로 재십시오.'],
    intel: ['표적판 높이 1m가 십자선 큰 눈금 몇 개인지 세기', '눈금 2개 → 500m · 2.5개 → 400m (거리 = 1000 ÷ 눈금 수)'],
    newSkill: '십자선 눈금으로 거리 재기',
    theme: 'desert',
    timeOfDay: 'day',
    atmosphere: { altitude: 400, temperature: 32 },
    wind: { zones: [{ from: 0, speed: 2, dir: 270 }], variability: 0.1 },
    ammoTotal: 15,
    timeLimit: 0,
    noRangefinder: true,
    targets: [
      { id: 'p1', kind: 'plate', x: -12, dist: 450, w: 0.5, h: 1.0, shape: 'rect', required: true, label: '표적판 A' },
      { id: 'p2', kind: 'plate', x: 15, dist: 620, w: 0.5, h: 1.0, shape: 'rect', required: true, label: '표적판 B' },
    ],
    props: [
      { kind: 'rock', x: -20, dist: 440, w: 4, h: 2, d: 3 },
      { kind: 'rock', x: 24, dist: 600, w: 5, h: 2.5, d: 4 },
      { kind: 'barrel', x: -9, dist: 455, w: 0.6, h: 0.9, d: 0.6 },
    ],
    objectives: [CLEAR, ACCURACY, { type: 'time', value: 120, label: '120초 이내 완료' }],
    hints: [
      { text: '표적판(높이 1m)이 십자선 큰 눈금 몇 개에 걸치는지 세세요. 거리 = 1000 ÷ 눈금 수', until: 'scope' },
      { text: '예: 눈금 2.2개면 1000 ÷ 2.2 ≈ 455m. 보정표에서 그 거리의 ▲ 횟수를 누르세요.', until: 'hit' },
    ],
  },
  {
    id: 'm4',
    codename: '작전: 검은 소나무',
    name: '초소 정리',
    subtitle: '연속 사격',
    category: 'operation',
    briefing: ['숲길 앞 산림 관리소에 잠입해 창가를 확보하고, 초소 경계병 3명을 제거하십시오.', '관리소 안에도 경비 3명. 들키지 말고 들어가 쏘고, 빠져나오십시오.'],
    intel: ['건물 안: 입구 옆 보초(등을 돌리고 있음) · 복도 순찰 · 창고 순찰', '소음기 없이 쏘면 건물 안 경비가 저격 위치로 옵니다 → 소음기 권장', '경계병 3명, 470~515m · 총성 후 바위 뒤로 도주'],
    newSkill: '잠입 · 숙이기 · 뒤에서 제압 · 연속 사격',
    theme: 'forest',
    timeOfDay: 'dawn',
    atmosphere: { altitude: 600, temperature: 8 },
    wind: { zones: [{ from: 0, speed: 2.5, dir: 60 }], variability: 0.1 },
    ammoTotal: 12,
    timeLimit: 0,
    targets: [
      { id: 'b1', kind: 'person', role: 'guard', outfit: 'guard', x: -6, dist: 470, behavior: 'idle', escape: [-30, 482], required: true, label: '경계병 A' },
      { id: 'b2', kind: 'person', role: 'guard', outfit: 'guard', x: 2, dist: 490, behavior: 'idle', escape: [-30, 488], required: true, label: '경계병 B' },
      { id: 'b3', kind: 'person', role: 'guard', outfit: 'guard', x: 9, dist: 515, behavior: 'idle', escape: [32, 520], required: true, label: '경계병 C' },
    ],
    props: [
      { kind: 'rock', x: -33, dist: 485, w: 5, h: 2.6, d: 4 },
      { kind: 'rock', x: 35, dist: 522, w: 5, h: 2.6, d: 4 },
      { kind: 'sandbag', x: 0, dist: 496, w: 4, h: 0.9, d: 1 },
      { kind: 'tent', x: 14, dist: 505, w: 4, h: 2.2, d: 4 },
      { kind: 'barrel', x: -3, dist: 480, w: 0.6, h: 0.9, d: 0.6 },
    ],
    interior: {
      name: '산림 관리소',
      layout: [
        '#####wwwww######',
        '#...#..N..#....#',
        '#.B.........cc.#',
        '#...#T.c..#....#',
        '#...###.###....#',
        '#..............#',
        '#..............#',
        '###.######.#####',
        '#B.....#.....B.#',
        '#..c...#.....c.#',
        '#......#.......#',
        '###S########E###',
      ],
      guards: [
        { path: [[5, 9]], yaw: 90, label: '보초' },
        { path: [[1, 5], [14, 5]], pause: 2.5, label: '복도 순찰' },
        { path: [[8, 10], [14, 10]], pause: 3, label: '창고 순찰' },
      ],
    },
    objectives: [CLEAR, { type: 'maxShots', value: 3, label: '3발로 3명 제거 (1탄 1킬)' }, { type: 'headshots', value: 1, label: '헤드샷 1회 이상' }],
    hints: [
      { text: '스코프로 사람을 1초간 관측하면 식별 태그가 붙습니다. 3명 모두 식별하세요.', until: 'tag' },
      { text: '첫 발 이후 약 2초 뒤에 나머지가 달아납니다. 도주 경로가 긴 표적을 나중에 쏘세요.', until: 'fire' },
    ],
  },
  {
    id: 'm5',
    codename: '작전: 회색 도로',
    name: '운반책',
    subtitle: '움직이는 표적 · 민간인 구별',
    category: 'operation',
    briefing: ['도로가 내려다보이는 농가 창고에 잠입하십시오. 운반책 두 명(갈색 재킷 · 배낭)이 도로를 오갑니다.', '근처에 농부들이 있습니다. 민간인을 쏘면 작전은 즉시 중단됩니다.'],
    intel: ['창고 안 경비 3명: 현관 · 홀 순찰, 안쪽 방 감시병', '운반책 2명: 갈색 재킷 · 배낭 / 민간인: 파란·빨간 셔츠', '걷는 표적은 가는 방향 앞을 겨누기(600m ≈ 눈금 2개)'],
    dossier: {
      name: '운반책 2명',
      alias: '"짐꾼"',
      summary: '국경 너머로 소형 무기를 나르는 운반책. 도로 끝에서 잠시 멈춘다.',
      features: ['갈색 가죽 재킷', '검은 배낭', '도로 위를 좌우로 걸음'],
      outfit: 'courier',
    },
    newSkill: '움직이는 표적 앞질러 겨누기 · 민간인 구별',
    theme: 'plains',
    timeOfDay: 'overcast',
    atmosphere: { altitude: 200, temperature: 14 },
    wind: { zones: [{ from: 0, speed: 2, dir: 120 }], variability: 0.1 },
    ammoTotal: 12,
    timeLimit: 0,
    targets: [
      { id: 'b1', kind: 'person', role: 'hvt', outfit: 'courier', x: -14, dist: 560, behavior: 'patrol', path: [[-14, 560], [14, 560]], pause: 2, escape: [-45, 570], required: true, label: '운반책 A' },
      { id: 'b2', kind: 'person', role: 'hvt', outfit: 'courier', x: 16, dist: 640, behavior: 'patrol', path: [[16, 640], [-12, 640]], pause: 2, escape: [45, 650], required: true, label: '운반책 B' },
      { id: 'c1', kind: 'person', role: 'civilian', outfit: 'civilian', x: -28, dist: 600, behavior: 'idle', escape: [-60, 610], required: false, label: '농부' },
      { id: 'c2', kind: 'person', role: 'civilian', outfit: 'civilianRed', x: 26, dist: 590, behavior: 'patrol', path: [[26, 590], [34, 600]], pause: 4, escape: [60, 600], required: false, label: '농부' },
    ],
    props: [
      { kind: 'road', x: 0, dist: 560, w: 120, h: 0.02, d: 4 },
      { kind: 'road', x: 0, dist: 640, w: 120, h: 0.02, d: 4 },
      { kind: 'wall', x: -48, dist: 570, w: 6, h: 2.2, d: 1 },
      { kind: 'wall', x: 48, dist: 650, w: 6, h: 2.2, d: 1 },
      { kind: 'truck', x: -38, dist: 556, w: 2.4, h: 2.6, d: 6, rot: 90 },
      { kind: 'fence', x: -26, dist: 606, w: 14, h: 1.1, d: 0.1 },
      { kind: 'crate', x: 30, dist: 596, w: 1.2, h: 0.9, d: 1.2 },
    ],
    interior: {
      name: '버려진 농가 창고',
      layout: [
        '###wwwww#######',
        '#B....N.#.....#',
        '#....cc.#..T..#',
        '#..cc...#.....#',
        '#.......##.####',
        '####.##.......#',
        '#.....#.......E',
        '#.c...#..B....#',
        '#.....#.......#',
        '##S############',
      ],
      guards: [
        { path: [[1, 6], [5, 6]], pause: 2, label: '현관 순찰' },
        { path: [[7, 6], [13, 6]], pause: 2, label: '홀 순찰' },
        { path: [[11, 1]], yaw: 0, label: '감시병' },
      ],
    },
    objectives: [CLEAR, ACCURACY, { type: 'headshots', value: 1, label: '헤드샷 1회 이상' }],
    hints: [
      { text: '먼저 관측하세요. 갈색 재킷 = 운반책, 파란·빨간 셔츠 = 민간인입니다.', until: 'tag' },
      { text: '탄이 가는 동안 표적도 걷습니다. 600m면 걷는 방향으로 큰 눈금 2개만큼 앞을 겨누세요.', until: 'hit' },
    ],
  },
  {
    id: 'm6',
    codename: '작전: 백색 침묵',
    name: '소리 없이',
    subtitle: '소음기 · 아음속탄',
    category: 'operation',
    briefing: ['설원 야영지의 보초 네 명을 아무도 모르게 제거하십시오.', '소음기와 아음속탄({ammo})을 함께 쓰면 총성이 거의 나지 않습니다. 대신 탄이 아주 많이 떨어집니다.'],
    intel: ['보초 4명, 290~340m', '쓰러진 사람을 순찰병이 보면 경보', '아음속탄은 300m에서 ▲ 약 150칸이 필요(보정표 확인)'],
    newSkill: '소음기 · 탄종 선택 · 많이 떨어지는 탄 보정',
    theme: 'snow',
    timeOfDay: 'dusk',
    atmosphere: { altitude: 900, temperature: -5 },
    wind: { zones: [{ from: 0, speed: 1.5, dir: 270 }], variability: 0.1 },
    ammoTotal: 15,
    timeLimit: 0,
    weaponLock: 'r308',
    targets: [
      { id: 'b1', kind: 'person', role: 'guard', outfit: 'guardSnow', x: -28, dist: 290, behavior: 'idle', escape: [-60, 300], required: true, label: '보초 A' },
      { id: 'b2', kind: 'person', role: 'guard', outfit: 'guardSnow', x: 2, dist: 305, behavior: 'idle', escape: [-60, 315], required: true, label: '보초 B' },
      { id: 'b3', kind: 'person', role: 'guard', outfit: 'guardSnow', x: 31, dist: 300, behavior: 'idle', escape: [65, 312], required: true, label: '보초 C' },
      { id: 'b4', kind: 'person', role: 'guard', outfit: 'guardSnow', x: 6, dist: 340, behavior: 'patrol', path: [[-10, 340], [22, 340]], pause: 3, escape: [65, 350], required: true, label: '순찰병 D' },
    ],
    props: [
      { kind: 'tent', x: -22, dist: 296, w: 4, h: 2.2, d: 4 },
      { kind: 'tent', x: 9, dist: 312, w: 4, h: 2.2, d: 4 },
      { kind: 'tent', x: 38, dist: 306, w: 4, h: 2.2, d: 4 },
      { kind: 'crate', x: -3, dist: 300, w: 1.2, h: 1, d: 1.2 },
      { kind: 'barrel', x: 16, dist: 300, w: 0.6, h: 0.9, d: 0.6 },
      { kind: 'jeep', x: -40, dist: 320, w: 2, h: 1.8, d: 4, rot: 30 },
      { kind: 'rock', x: -63, dist: 302, w: 5, h: 2.6, d: 4 },
      { kind: 'rock', x: 68, dist: 330, w: 5, h: 3, d: 6 },
    ],
    objectives: [CLEAR, { type: 'noAlert', label: '한 명도 경계시키지 않기' }, ACCURACY],
    hints: [
      { text: '{ammo} 로 아음속탄(조용한 탄)으로 바꾸세요. 보정표도 함께 바뀝니다.', touchText: '[탄] 버튼으로 아음속탄(조용한 탄)으로 바꾸세요.', until: 'ammo' },
      { text: '빗나간 탄이 표적 근처(20m)에 떨어지면 들킵니다. 순찰병이 시신을 보지 않게 순서를 정하세요.', until: 'hit' },
    ],
  },
  {
    id: 'm7',
    codename: '작전: 철의 능선',
    name: '레이더 기지',
    subtitle: '구간마다 다른 바람 · 돌풍',
    category: 'operation',
    briefing: ['능선의 관측 벙커에 잠입해 레이더 기지 경비 두 명을 제거하고 공습로를 여십시오.', '계곡 구간마다 바람이 다릅니다. 벙커 통로 보초는 창가 쪽을 지킵니다 – 다른 길을 찾으십시오.'],
    intel: ['벙커: 저격실 문이 3개(아래 · 왼쪽 숙소 · 오른쪽 방)', '바람: 가까이 3.5 · 중간 1.5 · 멀리 4.5m/s, 돌풍 9~15초마다', '먼 곳 바람이 더 중요(탄이 느려져 오래 밀림)'],
    newSkill: '우회로 찾기 · 구간 바람 읽기 · 돌풍 피해서 쏘기',
    theme: 'mountain',
    timeOfDay: 'day',
    atmosphere: { altitude: 1400, temperature: 6 },
    wind: {
      zones: [
        { from: 0, speed: 3.5, dir: 90 },
        { from: 300, speed: 1.5, dir: 90 },
        { from: 560, speed: 4.5, dir: 60 },
      ],
      variability: 0.12,
      gusts: { intervalMin: 9, intervalMax: 15, strength: 3, rise: 2, hold: 3, fall: 2 },
    },
    ammoTotal: 12,
    timeLimit: 0,
    targets: [
      { id: 'b1', kind: 'person', role: 'guard', outfit: 'guard', x: -10, dist: 740, behavior: 'idle', escape: [-42, 750], required: true, label: '경비 A' },
      { id: 'b2', kind: 'person', role: 'guard', outfit: 'guard', x: 12, dist: 815, behavior: 'idle', escape: [45, 820], required: true, label: '경비 B' },
    ],
    props: [
      { kind: 'rock', x: -45, dist: 752, w: 6, h: 3, d: 5 },
      { kind: 'rock', x: 48, dist: 822, w: 6, h: 3, d: 5 },
      { kind: 'radar', x: 2, dist: 790, w: 6, h: 9, d: 6 },
      { kind: 'container', x: -18, dist: 760, w: 6, h: 2.6, d: 2.5, rot: 10 },
      { kind: 'antenna', x: 22, dist: 808, w: 1, h: 14, d: 1 },
      { kind: 'sandbag', x: 12, dist: 812, w: 3.5, h: 0.9, d: 1 },
    ],
    interior: {
      name: '산악 관측 벙커',
      layout: [
        '#######www#####',
        '#..B..#.N.....#',
        '#.......c.#.T.#',
        '#.....##.##...#',
        '#..c......#...#',
        '#.....#...##.##',
        '####.##.......#',
        '#.....#..c....#',
        '#.B...#.......#',
        '###S#######E###',
      ],
      guards: [
        { path: [[1, 1], [1, 5]], pause: 2.5, label: '숙소 순찰' },
        { path: [[9, 5]], yaw: 180, label: '통로 보초' },
        { path: [[7, 8], [13, 8]], pause: 2, label: '홀 순찰' },
      ],
    },
    objectives: [CLEAR, ACCURACY, { type: 'ghost', label: '잠입·탈출 중 한 번도 의심받지 않기' }],
    flagSpacing: 130,
    hints: [{ text: '가까운 깃발과 먼 깃발을 비교하세요. 먼 구간의 바람에 더 무게를 두세요.', until: 'hit' }],
  },
  {
    id: 'm8',
    codename: '작전: 마지막 계약',
    name: '1km',
    subtitle: '최종 암살',
    category: 'operation',
    briefing: ['연구소 별관에 잠입해 1km 밖 무기상 빅토르 렌코를 노리십시오. 건물 사이를 오갈 때만 노출됩니다.', '별관 경비 4명. 고지대(2200m)라 탄이 덜 떨어집니다. 창가에 자리 잡은 뒤 150초 안에 끝내십시오.'],
    intel: ['표적: 흰 정장 · 붉은 넥타이 · 선글라스', '경호원 2명(선택), 연구원 1명(민간인)', '건물 사이로 나왔다가 뒤에서 약 5초 멈춤', '탄 도착까지 약 1.6초'],
    dossier: {
      name: '빅토르 렌코',
      alias: '"상인"',
      summary: '3개 대륙의 분쟁 지역에 무기를 공급한 밀매상. 이번이 유일한 기회다.',
      features: ['흰 정장', '붉은 넥타이', '선글라스', '경호원 없이 건물 사이를 걸음'],
      outfit: 'hvtSuit',
    },
    newSkill: '종합: 높은 산 · 1km · 나오는 순간 쏘기 · 표적 식별',
    theme: 'mountain',
    timeOfDay: 'dusk',
    atmosphere: { altitude: 2200, temperature: 4 },
    wind: {
      zones: [
        { from: 0, speed: 2.5, dir: 240 },
        { from: 500, speed: 3.5, dir: 260 },
      ],
      variability: 0.12,
      gusts: { intervalMin: 12, intervalMax: 18, strength: 2, rise: 2, hold: 2, fall: 2 },
    },
    ammoTotal: 10,
    timeLimit: 150,
    targets: [
      { id: 'vip', kind: 'person', role: 'hvt', outfit: 'hvtSuit', x: -9, dist: 1050, behavior: 'patrol', path: [[-9, 1050], [9, 1050]], pause: 5, escape: [-9, 1062], required: true, label: '빅토르 렌코' },
      { id: 'g1', kind: 'person', role: 'guard', outfit: 'guard', x: -14, dist: 1045, behavior: 'idle', escape: [-24, 1060], required: false, label: '경호원 A' },
      { id: 'g2', kind: 'person', role: 'guard', outfit: 'guard', x: 14, dist: 1046, behavior: 'idle', escape: [24, 1060], required: false, label: '경호원 B' },
      { id: 'c1', kind: 'person', role: 'civilian', outfit: 'scientist', x: 5, dist: 1058, behavior: 'idle', escape: [10, 1066], required: false, label: '연구원' },
    ],
    props: [
      { kind: 'building', x: -16, dist: 1052, w: 12, h: 7, d: 10 },
      { kind: 'building', x: 16, dist: 1052, w: 12, h: 9, d: 10 },
      { kind: 'wall', x: 0, dist: 1064, w: 10, h: 3, d: 1 },
      { kind: 'jeep', x: -26, dist: 1044, w: 2, h: 1.8, d: 4, rot: 75 },
      { kind: 'barrel', x: 7, dist: 1044, w: 0.6, h: 0.9, d: 0.6 },
      { kind: 'antenna', x: 18, dist: 1050, w: 1, h: 16, d: 1 },
    ],
    interior: {
      name: '연구소 별관',
      layout: [
        '#########www#########',
        '#...B.....N.#..T....#',
        '#.......#.c.........#',
        '#..cc...#.###...c...#',
        '#...................#',
        '#.......#B.B#.......#',
        '####.####...####.####',
        '#.......#...#.......#',
        '#..T....#...#..B....#',
        '#.......#...#.......#',
        '####S#########E######',
      ],
      guards: [
        { path: [[6, 2]], yaw: -90, label: '사무실 보초' },
        { path: [[1, 4], [19, 4]], pause: 3, label: '복도 순찰' },
        { path: [[10, 6], [10, 9]], pause: 2.5, label: '실험실 순찰' },
        { path: [[13, 7], [19, 7]], pause: 2, label: '창고 순찰' },
      ],
    },
    objectives: [CLEAR, ACCURACY, { type: 'headshots', value: 1, label: '헤드샷 1회 이상' }],
    flagSpacing: 160,
    hints: [
      { text: '흰 정장의 표적을 찾아 관측하세요. 흰 가운은 연구원(민간인)입니다.', until: 'tag' },
      { text: '렌코는 건물 뒤에서 약 5초 멈춘 뒤 다시 나옵니다. 나오기 직전에 보정을 끝내세요.', until: 'hit' },
    ],
  },
];

/** 사격장: 100m~1500m 강철판. 바람은 브리핑에서 직접 설정. */
export function buildRangeMission(windSpeed: number, windDir: number): MissionDef {
  const targets: TargetDef[] = [];
  for (let d = 100; d <= 1500; d += 100) {
    const size = Math.round((0.3 + d * 0.0006) * 100) / 100;
    targets.push({
      id: `r${d}`,
      kind: 'plate',
      x: (d / 100) % 2 === 0 ? 7 : -7,
      dist: d,
      w: size,
      h: size,
      shape: 'circle',
      required: false,
      label: `${d}m`,
    });
  }
  return {
    id: 'range',
    codename: '훈련장',
    name: '사격장',
    subtitle: '자유 연습',
    category: 'range',
    briefing: ['100m부터 1500m까지 강철판이 놓여 있습니다.', '바람을 직접 설정하고 탄도를 익히십시오.'],
    newSkill: '자유 연습',
    theme: 'plains',
    timeOfDay: 'day',
    atmosphere: { altitude: 100, temperature: 15 },
    wind: { zones: [{ from: 0, speed: windSpeed, dir: windDir }], variability: windSpeed > 0 ? 0.06 : 0 },
    ammoTotal: 0,
    timeLimit: 0,
    targets,
    props: [],
    objectives: [CLEAR, ACCURACY, ACCURACY],
    isRange: true,
    flagSpacing: 200,
  };
}

/** 시드 기반 의사난수(mulberry32). 같은 날짜 → 같은 챌린지. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const GUARD_OUTFIT: Record<ThemeId, OutfitId> = { plains: 'guard', forest: 'guard', mountain: 'guard', desert: 'guardDesert', snow: 'guardSnow' };
const SURNAMES = ['카잔', '베르크', '도란', '말코프', '세라노', '이바르', '코스타', '렌스키'];

/**
 * 일일 계약: 날짜 시드로 거리·바람·표적 구성을 정한다.
 * 표적 1명(HVT) + 경호원 1~2명(선택) + 민간인 0~1명. 난이도는 M4~M7 수준으로 제한(불공정 방지).
 */
export function buildDailyMission(key: string): MissionDef {
  const seed = Number(key.replace(/-/g, ''));
  const rnd = seededRandom(seed);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
  const themes: ThemeId[] = ['plains', 'desert', 'forest', 'snow', 'mountain'];
  const theme = pick(themes);
  const tod = pick<TimeOfDay>(['day', 'dawn', 'dusk', 'overcast']);
  const baseDist = Math.round(380 + rnd() * 420); // 380~800m
  const windSpeed = Math.round((1 + rnd() * 3.5) * 10) / 10; // 1~4.5m/s
  const windDir = pick([60, 90, 120, 240, 270, 300]);
  const hvtOutfit = pick<OutfitId>(['hvtOfficer', 'hvtSuit']);
  const name = `${pick(SURNAMES)} ${pick(['대령', '중개인', '사령관', '회계사'])}`;
  const targets: TargetDef[] = [];
  const props: PropDef[] = [];
  const moving = rnd() < 0.45;
  const hx = Math.round((rnd() - 0.5) * 24);
  targets.push({
    id: 'hvt',
    kind: 'person',
    role: 'hvt',
    outfit: hvtOutfit,
    x: hx,
    dist: baseDist,
    behavior: moving ? 'patrol' : 'idle',
    path: moving ? [[hx - 10, baseDist], [hx + 10, baseDist]] : undefined,
    pause: 2,
    escape: [hx + (hx < 0 ? -30 : 30), baseDist + 8],
    required: true,
    label: name,
  });
  props.push({ kind: 'rock', x: hx + (hx < 0 ? -33 : 33), dist: baseDist + 10, w: 5, h: 2.6, d: 4 });
  const guards = 1 + Math.floor(rnd() * 2);
  for (let i = 0; i < guards; i++) {
    const gx = hx + (i === 0 ? -6 : 7) + Math.round((rnd() - 0.5) * 4);
    const gd = baseDist + Math.round((rnd() - 0.5) * 20);
    targets.push({ id: `g${i}`, kind: 'person', role: 'guard', outfit: GUARD_OUTFIT[theme], x: gx, dist: gd, behavior: 'idle', escape: [gx + (gx < hx ? -25 : 25), gd + 10], required: false, label: `경호원 ${String.fromCharCode(65 + i)}` });
  }
  if (rnd() < 0.6) {
    const cx = hx + (rnd() < 0.5 ? -16 : 16);
    targets.push({ id: 'c0', kind: 'person', role: 'civilian', outfit: pick<OutfitId>(['civilian', 'civilianRed', 'scientist']), x: cx, dist: baseDist + 6, behavior: 'idle', required: false, label: '민간인' });
  }
  props.push({ kind: pick(['jeep', 'truck', 'container'] as const), x: hx + 4, dist: baseDist + 14, w: 2.2, h: 2.2, d: 4.5, rot: Math.round(rnd() * 180) });
  props.push({ kind: 'sandbag', x: hx - 2, dist: baseDist - 4, w: 3, h: 0.8, d: 1 });
  return {
    id: `daily-${key}`,
    codename: `계약 #${key.replace(/-/g, '').slice(2)}`,
    name: '일일 계약',
    subtitle: key,
    category: 'contract',
    briefing: [`오늘의 계약 표적: ${name}.`, '경호원은 선택 사항, 민간인 사살 시 계약 파기. 점수: 거리 · 헤드샷 · 시간 · 명중률.'],
    intel: [`예상 거리 약 ${Math.round(baseDist / 50) * 50}m`, moving ? '표적이 이동 중' : '표적이 정지해 있음'],
    dossier: {
      name,
      alias: '"계약 표적"',
      summary: '의뢰인이 지정한 표적. 매일 바뀐다.',
      features: hvtOutfit === 'hvtOfficer' ? ['검은 제복', '붉은 베레모'] : ['흰 정장', '붉은 넥타이', '선글라스'],
      outfit: hvtOutfit,
    },
    newSkill: '종합',
    theme,
    timeOfDay: tod,
    atmosphere: { altitude: Math.round(100 + rnd() * 1500), temperature: Math.round(-5 + rnd() * 35) },
    wind: { zones: [{ from: 0, speed: windSpeed, dir: windDir }], variability: 0.12 },
    ammoTotal: 12,
    timeLimit: 0,
    targets,
    props,
    objectives: [CLEAR, ACCURACY, { type: 'headshots', value: 1, label: '헤드샷 1회 이상' }],
  };
}
