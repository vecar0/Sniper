// 강화 카드. 웨이브를 정리할 때마다 3장 중 1장을 고른다. max = 같은 카드를 고를 수 있는 최대 횟수.
// kind: weapon(무기 획득) · upgrade(무기 강화) · perk(능력) · rare(보스 뒤 희귀)
export const CARDS = [
  { id: 'get:shotgun', kind: 'weapon', name: 'T-97 펌프 산탄총', desc: '근거리 압도 · 10펠릿 · 맞은 적이 밀려남', icon: 'shotgun' },
  { id: 'get:rifle', kind: 'weapon', name: 'KV-41 소총', desc: '만능 연사 · 3초 연사하면 피해 +20%', icon: 'rifle' },
  { id: 'get:rail', kind: 'weapon', name: 'SK-7 볼트 저격소총', desc: '볼트액션 · 적 3기 관통 · 한 방 240', icon: 'rail', minWave: 3 },
  { id: 'up:pistol', kind: 'upgrade', weapon: 'pistol', max: 3, icon: 'up' },
  { id: 'up:shotgun', kind: 'upgrade', weapon: 'shotgun', max: 3, icon: 'up' },
  { id: 'up:rifle', kind: 'upgrade', weapon: 'rifle', max: 3, icon: 'up' },
  { id: 'up:rail', kind: 'upgrade', weapon: 'rail', max: 3, icon: 'up' },
  { id: 'maxhp', kind: 'perk', name: '강화 외골격', desc: '최대 체력 +25 (즉시 25 회복)', max: 3, icon: 'heart' },
  { id: 'armor', kind: 'perk', name: '방탄판', desc: '방어구 +25 · 피해의 60%를 대신 받음', max: 2, icon: 'shield' },
  { id: 'vamp', kind: 'perk', name: '야전 의무병', desc: '체력 구슬 회복량 +50%', max: 2, icon: 'cross' },
  { id: 'dash+', kind: 'perk', name: '보조 추진기', desc: '대시 충전 +1회', max: 1, icon: 'dash' },
  { id: 'dashcd', kind: 'perk', name: '냉각 순환', desc: '대시 충전 시간 −25%', max: 2, icon: 'dash' },
  { id: 'slide', kind: 'perk', name: '낮은 자세', desc: '슬라이드 중 받는 피해 −50%', max: 1, icon: 'slide' },
  { id: 'weak', kind: 'perk', name: '정밀 사격', desc: '약점 피해 +25%', max: 2, icon: 'target' },
  { id: 'emp', kind: 'perk', name: 'EMP 탄띠', desc: 'EMP 수류탄 +1 · 최대 보유 +1', max: 2, icon: 'emp' },
  { id: 'shock', kind: 'rare', name: '과부하 회로', desc: '처치할 때 주변 3m에 전기 폭발(피해 40)', max: 1, icon: 'bolt' },
  { id: 'dashstun', kind: 'rare', name: '충격 돌파', desc: '대시로 스친 적을 1초 기절', max: 1, icon: 'dash' },
  { id: 'berserk', kind: 'rare', name: '사선', desc: '체력 30% 이하에서 피해 +40%', max: 1, icon: 'skull' },
];

export const UPGRADE_STEP = ['피해 +15%', '탄창 +30%', '재장전 −25%'];
export const CARD_RULES = {
  choices: 3,
  weaponBy: 3,        // 이 웨이브를 정리할 때까지 무기 카드를 최소 1번은 보여 준다
  shockDmg: 40, shockRadius: 3,
  dashStun: 1.0, dashStunRadius: 1.4,
  berserkHp: 0.3, berserkMul: 1.4,
  weakBonus: 0.25, vampBonus: 0.5, dashCdMul: 0.75,
};
