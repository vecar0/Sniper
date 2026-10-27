// 메뉴 화면: 메인 · 설정 · 조작법 · 일시정지 · 강화 카드 · 게임 오버
// 디자인: 극지 기지의 작전 문서. 좁은 고딕 숫자·제목 + 조용한 한글 글줄, 상자는 카드에만.
import { CARDS } from '../config/cards.js';
import { WEAPONS } from '../config/balance.js';

// 카드 아이콘(24×24 선 그림)
const ICON = {
  shotgun: '<path d="M2 11h15l3-2h2v4h-5l-2 3H9l-1 3H5l1-4H2z"/>',
  rifle: '<path d="M2 10h12l2-2h6v3h-4l-2 2h-3l-1 5h-3l1-5H8l-1 3H4l1-3H2z"/>',
  rail: '<path d="M2 10h20v4H2z"/><path d="M6 10v4M10 10v4M14 10v4M18 10v4"/>',
  up: '<path d="M12 4l7 7h-4v9H9v-9H5z"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
  cross: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  dash: '<path d="M3 12h10M6 8h9M6 16h9"/><path d="M15 6l6 6-6 6"/>',
  slide: '<path d="M3 18h18"/><path d="M5 14l5-2 4 2 5-1"/><circle cx="17" cy="8" r="2"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  emp: '<circle cx="12" cy="13" r="6"/><path d="M12 3v4M9 4h6"/><path d="M11 10l-2 3h3l-1 3 3-4h-3l1-2z"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  skull: '<path d="M12 3a8 8 0 0 0-5 14v3h10v-3a8 8 0 0 0-5-14z"/><circle cx="9" cy="11" r="1.5"/><circle cx="15" cy="11" r="1.5"/>',
};
const KIND = { weapon: '무기', upgrade: '개량', perk: '능력', rare: '희귀' };
const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ICON.up}</svg>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Menus {
  constructor(root, save, audio) {
    this.root = root;
    this.save = save;
    this.audio = audio;
    this.cb = {};
    this.current = null;
    this.touch = matchMedia('(pointer: coarse)').matches;
  }

  on(name, fn) { this.cb[name] = fn; }
  emit(name, ...a) { this.audio.click(); if (this.cb[name]) this.cb[name](...a); }
  clear() { this.root.innerHTML = ''; this.current = null; }

  main() {
    const b = this.save.best;
    const record = b.wave ? `최고 기록 ${b.wave}웨이브 · ${b.score.toLocaleString()}점` : '아직 기록이 없습니다';
    this.root.innerHTML = `
      <div class="menu-main">
        <div class="col">
          <p class="kicker">북천 기지 · 69°42′N · 영하 31도</p>
          <h1 class="title">NORTHLIGHT</h1>
          <p class="lede">연락이 끊긴 극지 연구 기지에서 무인 방어 체계가 폭주했습니다.<br>지킬 것은 없습니다. 빠르게 쓸어 담고, 강해지고, 살아남으세요.</p>
          <div class="actions">
            <button class="btn primary" data-a="start">작전 시작</button>
            <button class="btn quiet" data-a="howto">조작법과 규칙</button>
            <button class="btn quiet" data-a="settings">설정</button>
          </div>
          <p class="best">${record}</p>
        </div>
      </div>`;
    this.current = 'main';
    this.wire({ start: () => this.emit('start'), howto: () => this.howto('main'), settings: () => this.settings('main') });
    this.root.querySelector('[data-a=start]').focus({ preventScroll: true });
  }

  howto(back) {
    const rows = this.touch
      ? [['왼쪽 화면 끌기', '이동'], ['오른쪽 화면 끌기', '둘러보기'], ['발사', '누른 채 끌면 조준까지'], ['조준', '정조준 켜고 끄기'], ['대시, 점프', '공중에서 한 번 더 점프'], ['앉기', '달리다 누르면 슬라이드'], ['근접', '기절한 적은 즉시 처치하고 체력 25 회복'], ['EMP', '주변 로봇을 2.5초 기절'], ['준비 완료', '카드를 고른 뒤 바로 다음 웨이브']]
      : [['W A S D', '이동'], ['마우스', '둘러보기'], ['왼쪽 클릭', '사격'], ['오른쪽 클릭', '정조준'], ['Shift', '대시, 두 번까지 충전'], ['Space', '점프, 공중에서 한 번 더'], ['C', '앉기, 달리다 누르면 슬라이드'], ['V', '근접, 기절한 적은 즉시 처치하고 체력 25 회복'], ['G', 'EMP 수류탄, 떼면 던짐'], ['R', '재장전'], ['1 2 3 4, 휠, Q', '무기 바꾸기, Q는 이전 무기. 정리 화면에서는 1 2 3 카드, 4~0 보급'], ['Enter', '정리 화면 닫기, 다음 웨이브 바로 시작'], ['Esc', '일시정지']];
    this.root.innerHTML = `<div class="screen dim"><div class="sheet wide">
      <h2>조작법과 규칙</h2>
      <div class="two">
        <dl class="keys">${rows.map(([k, v]) => `<dt>${k.split(', ').map((x) => `<kbd>${esc(x)}</kbd>`).join(' ')}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        <div class="rules">
          <p><b>빨리 잡을수록 강해집니다.</b> 2.5초 안에 다음 적을 처치하면 점수 배수가 0.1씩 올라 최대 2배가 됩니다. 기준 시간 안에 웨이브를 끝내면 보너스 점수와 체력을 받습니다.</p>
          <p><b>체력은 저절로 차지 않습니다.</b> 처치할 때 떨어지는 구슬을 주우세요. 웨이브를 끝내도 조금 회복합니다.</p>
          <p><b>웨이브마다 카드 한 장 + 보급.</b> 정리 화면에서 새 무기·무기 개량·능력 카드 중 하나를 고르고, 처치로 모은 크레딧으로 회복·방어구·탄약·EMP·무기를 삽니다. 빨리 잡을수록 크레딧이 많이 쌓입니다. 보스를 잡으면 희귀 카드가 섞입니다.</p>
          <p><b>수리 로봇을 먼저.</b> 뒤에 숨어 다른 로봇을 고칩니다. 레이더의 속 빈 마름모, 화면 밖이면 가장자리 화살표로 보입니다.</p>
          <p><b>전투차량은 옆이나 뒤에서.</b> 앞 장갑판이 피해를 70% 막습니다. EMP로 잠시 무력화하거나 뒤 엔진 덮개를 쏘세요.</p>
          <p><b>빨간 레이저와 원은 경고입니다.</b> 모든 공격은 빛과 소리로 먼저 알립니다. 대시로 피하세요.</p>
        </div>
      </div>
      <div class="actions end"><button class="btn primary" data-a="back">돌아가기</button></div></div></div>`;
    this.wire({ back: () => (back === 'pause' ? this.pause() : this.main()) });
  }

  settings(back) {
    const s = this.save.settings;
    const seg = (key, opts) => `<span class="seg" data-k="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(s[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</span>`;
    const range = (key, min, max, step, label) => `<input type="range" aria-label="${label}" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}">`;
    const row = (name, help, ctl) => `<div class="row"><span>${name}${help ? `<small>${help}</small>` : ''}</span>${ctl}</div>`;
    this.root.innerHTML = `<div class="screen dim"><div class="sheet">
      <h2>설정</h2>
      ${row('마우스 감도', '', range('sens', 0.2, 3, 0.05, '마우스 감도'))}
      ${row('터치 감도', '휴대폰에서 끌어서 둘러볼 때', range('touchSens', 0.2, 3, 0.05, '터치 감도'))}
      ${row('시야각', '넓을수록 주변이 잘 보입니다', range('fov', 75, 110, 1, '시야각'))}
      ${row('효과음', '', range('sfx', 0, 1, 0.05, '효과음'))}
      ${row('음악', '', range('music', 0, 1, 0.05, '음악'))}
      ${row('그래픽 품질', '다음 판부터 적용됩니다', seg('quality', [['auto', '자동'], ['low', '낮음'], ['mid', '중간'], ['high', '높음']]))}
      ${row('정조준', '', seg('adsToggle', [[false, '누르는 동안'], [true, '누를 때마다 전환']]))}
      ${row('화면 흔들림', '', range('shake', 0, 1, 0.1, '화면 흔들림'))}
      ${row('피해 숫자', '', seg('dmgNumbers', [[true, '보기'], [false, '숨기기']]))}
      <div class="actions end"><button class="btn primary" data-a="back">저장하고 닫기</button></div></div></div>`;
    for (const r of this.root.querySelectorAll('input[type=range]')) r.addEventListener('input', () => { s[r.dataset.k] = parseFloat(r.value); this.emitQuiet('settings'); });
    for (const g of this.root.querySelectorAll('.seg')) for (const b of g.querySelectorAll('button')) b.addEventListener('click', () => {
      const v = b.dataset.v; s[g.dataset.k] = v === 'true' ? true : v === 'false' ? false : v;
      for (const x of g.querySelectorAll('button')) x.classList.toggle('on', x === b);
      this.emit('settings');
    });
    this.wire({ back: () => { this.emit('settingsDone'); back === 'pause' ? this.pause() : this.main(); } });
  }
  emitQuiet(name) { if (this.cb[name]) this.cb[name](); }

  pause() {
    this.root.innerHTML = `<div class="screen dim"><div class="sheet narrow">
      <h2>일시정지</h2>
      <div class="stack">
        <button class="btn primary" data-a="resume">이어서 하기</button>
        <button class="btn quiet" data-a="howto">조작법과 규칙</button>
        <button class="btn quiet" data-a="settings">설정</button>
        <button class="btn quiet danger" data-a="quit">작전 포기하고 나가기</button>
      </div></div></div>`;
    this.current = 'pause';
    this.wire({ resume: () => this.emit('resume'), howto: () => this.howto('pause'), settings: () => this.settings('pause'), quit: () => this.emit('quit') });
  }

  // 웨이브 정리 화면: 위 = 강화 카드 3장(공짜, 하나), 아래 = 보급(크레딧으로 구매). 카드를 고르면 '작전 재개'가 열린다
  cards(world, h) {
    this.current = 'cards';
    this.cardWorld = world; this.cardH = h;
    const offer = (world.offer || []).map((id) => world.cardInfo(id));
    const pips = (c) => (c.max > 1 ? `<span class="pips">${Array.from({ length: c.max }, (_, i) => `<i class="${i < c.level ? 'on' : i === c.level ? 'next' : ''}"></i>`).join('')}</span>` : '');
    const picked = world.picked;
    this.root.innerHTML = `<div class="screen dim cards-screen"><div class="cards">
      <div class="cards-head"><p class="kicker">${world.wave}웨이브 정리 · 시간이 멈춰 있습니다</p><h2>${picked ? '보급을 정비하고 작전을 재개하세요' : '강화 하나를 고르세요'}</h2></div>
      <div class="cards-row">${offer.map((c, i) => `
        <button class="pick ${c.kind}${picked === c.id ? ' taken' : picked ? ' off' : ''}" data-i="${i}" ${picked ? 'disabled' : ''}>
          <span class="top"><span class="kind">${picked === c.id ? '선택함' : KIND[c.kind]}</span><kbd>${i + 1}</kbd></span>
          ${icon(c.icon)}
          <span class="nm">${esc(c.name)}</span>
          <span class="ds">${esc(c.desc)}</span>
          ${pips(c)}
        </button>`).join('')}</div>
      <div class="supply">
        <div class="supply-head"><h3>보급</h3><span class="cr">${world.credits.toLocaleString()} 크레딧</span></div>
        <div class="supply-list"></div>
      </div>
      <div class="cards-foot"><span class="tip">${this.touch ? '카드와 보급을 눌러 고릅니다.' : '카드 1 2 3 · 보급 4~0 · 작전 재개 Enter'}</span>
        <button class="btn primary" data-a="go" ${picked ? '' : 'disabled'}>작전 재개</button></div></div></div>`;
    for (const b of this.root.querySelectorAll('.pick')) b.addEventListener('click', () => h.pick(+b.dataset.i));
    this.root.querySelector('[data-a=go]').addEventListener('click', () => h.go());
    this.renderSupply(world);
    if (!picked) this.root.querySelector('.pick')?.focus({ preventScroll: true });
  }

  renderSupply(world) {
    const list = this.root.querySelector('.supply-list');
    if (!list) return;
    const items = world.shopItems();
    const label = (i) => (i.state === 'owned' ? '보유 중' : i.state === 'max' ? '가득' : `${i.price.toLocaleString()}`);
    list.innerHTML = items.map((i, k) => `<button class="sup ${i.state}" data-id="${i.id}" ${i.state === 'ok' || i.state === 'poor' ? '' : 'disabled'}>
      <kbd>${(k + 4) % 10}</kbd><span class="nm">${esc(i.name)}</span><span class="ds">${esc(i.desc)}</span><span class="pr">${label(i)}</span></button>`).join('');
    for (const b of list.querySelectorAll('.sup')) b.addEventListener('click', () => this.buy(world, b.dataset.id, b));
    const cr = this.root.querySelector('.supply-head .cr'); if (cr) cr.textContent = `${world.credits.toLocaleString()} 크레딧`;
  }

  buy(world, id, el) {
    const r = world.buy(id);
    if (r.ok) { this.audio.buy(); this.renderSupply(world); this.root.querySelector(`.sup[data-id="${CSS.escape(id)}"]`)?.classList.add('bought'); if (this.cardH && this.cardH.bought) this.cardH.bought(); }
    else { this.audio.deny(); if (el && r.reason === 'poor') { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); } }
  }
  buyIndex(world, k) {
    const b = this.root.querySelectorAll('.sup')[k];
    if (b && !b.disabled) this.buy(world, b.dataset.id, b);
  }

  gameOver(world, newBest) {
    const s = world.stats, acc = s.shots ? Math.round((s.hits / s.shots) * 100) : 0, weak = s.hits ? Math.round((s.weakHits / s.hits) * 100) : 0;
    const names = s.cards.map((id) => { const c = CARDS.find((q) => q.id === id); return c.name || `${WEAPONS[c.weapon].name} 개량`; });
    const rows = [['도달한 웨이브', world.wave], ['점수', world.score.toLocaleString()], ['처치', s.kills], ['최고 연속 처치', s.bestCombo], ['명중률', `${acc}%`], ['약점 명중', `${weak}%`]];
    this.root.innerHTML = `<div class="screen dim"><div class="sheet over">
      <p class="kicker">작전 종료</p>
      <h2 class="reason">요원 전투 불능</h2>
      ${newBest ? '<p class="newbest">새 최고 기록입니다.</p>' : ''}
      <dl class="stats">${rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>
      ${names.length ? `<p class="took"><span>고른 카드</span>${names.map((n) => esc(n)).join(' · ')}</p>` : ''}
      <p class="best">최고 기록 ${this.save.best.wave}웨이브 · ${this.save.best.score.toLocaleString()}점</p>
      <div class="actions"><button class="btn primary" data-a="retry">다시 하기</button><button class="btn quiet" data-a="menu">처음 화면으로</button></div></div></div>`;
    this.current = 'over';
    this.wire({ retry: () => this.emit('retry'), menu: () => this.emit('quit') });
    setTimeout(() => this.root.querySelector('[data-a=retry]')?.focus({ preventScroll: true }), 50);
  }

  wire(map) {
    for (const [a, fn] of Object.entries(map)) { const b = this.root.querySelector(`[data-a="${a}"]`); if (b) b.addEventListener('click', fn); }
  }
}
