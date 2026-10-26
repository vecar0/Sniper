// 메뉴 화면: 메인 · 설정 · 조작법 · 일시정지 · 상점 · 게임 오버
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
    this.root.innerHTML = `
      <div class="menu-main"><div class="col">
        <h1 class="title"><span class="a">LAST</span><span class="b">NODE</span></h1>
        <p class="tagline">2089년 신서울, 아케론 타워 320m 옥상.<br>헬릭스가 도시의 마지막 자유 노드 <b>오로라 코어</b>를 노린다.<br>코어와 네 목숨, 둘 다 지켜라.</p>
        <button class="btn primary" data-a="start">▶ 작전 시작</button>
        <button class="btn" data-a="howto">조작법 · 규칙</button>
        <button class="btn" data-a="settings">설정</button>
        <div class="best">최고 기록 · 웨이브 <b>${b.wave}</b> · 점수 <b>${b.score.toLocaleString()}</b></div>
      </div><div></div></div>
      <div class="corner-tag">NODE-07 // AURORA CORE ONLINE</div>`;
    this.current = 'main';
    this.wire({ start: () => this.emit('start'), howto: () => this.howto('main'), settings: () => this.settings('main') });
    this.root.querySelector('[data-a=start]').focus();
  }

  howto(back) {
    const touch = this.touch;
    const rows = touch
      ? [['왼쪽 화면 끌기', '이동'], ['오른쪽 화면 끌기', '시점'], ['발사(누른 채 끌기)', '사격 + 조준'], ['조준', '정조준 켜기/끄기'], ['대시 · 점프', '빠르게 피하기 · 공중에서 한 번 더'], ['숙이기(달리며)', '슬라이드'], ['근접', '칼 공격 · 기절한 적은 즉시 처치 + 체력'], ['EMP', '기계 적 2.5초 기절'], ['상점 열기 · 준비 완료', '정비 시간에 단말 근처']]
      : [['WASD', '이동'], ['마우스', '시점'], ['좌클릭 · 우클릭', '사격 · 정조준'], ['Shift', '대시(2회 충전)'], ['Space', '점프 · 공중에서 더블 점프'], ['C', '숙이기 · 달리며 누르면 슬라이드'], ['V', '근접 · 기절한 적은 즉시 처치 + 체력 25'], ['G', 'EMP 수류탄(떼면 던짐)'], ['R · 1~4 · 휠 · Q', '재장전 · 무기 · 이전 무기'], ['F · Enter', '상점 열기 · 정비 건너뛰기'], ['Esc', '일시정지']];
    this.root.innerHTML = `<div class="screen dim"><div class="sheet cut">
      <h2>조작법 · 규칙</h2>
      <div class="keys">${rows.map(([k, v]) => `<kbd>${esc(k)}</kbd><span>${esc(v)}</span>`).join('')}</div>
      <h3>규칙</h3>
      <p class="tip"><b>패배:</b> 내 체력 0 또는 <b>코어 내구도 0</b>. 둘 다 지켜야 한다.</p>
      <p class="tip"><b>회복:</b> 체력은 저절로 차지 않는다. 적을 처치하면 나오는 <b>시안 구슬</b>을 먹어라. 서 있으면 죽는다.</p>
      <p class="tip"><b>리치(빨간 ◆):</b> 너를 무시하고 코어에 붙어 내구도를 빨아들인다. 화면 밖이면 가장자리 화살표로 알려 준다. 가장 먼저 잡아라.</p>
      <p class="tip"><b>메크:</b> 정면 방패는 피해 70% 감소. EMP로 방패를 끄거나 뒤로 돌아가 <b>등의 주황 코어</b>를 쏴라.</p>
      <p class="tip"><b>정비 시간:</b> 단말(◆)에서 무기·강화를 사거나 <b>코어 실드·포탑</b>에 투자. 무엇을 살지가 생존을 가른다.</p>
      <p class="tip"><b>예고:</b> 모든 적 공격은 빛과 소리로 미리 알린다. 빨간 선·원이 보이면 대시로 피하라.</p>
      <div class="actions"><button class="btn" data-a="back">돌아가기</button></div></div></div>`;
    this.wire({ back: () => (back === 'pause' ? this.pause() : this.main()) });
  }

  settings(back) {
    const s = this.save.settings;
    const seg = (key, opts) => `<span class="seg" data-k="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(s[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</span>`;
    const range = (key, min, max, step) => `<input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}">`;
    this.root.innerHTML = `<div class="screen dim"><div class="sheet cut">
      <h2>설정</h2>
      <div class="row"><span>마우스 감도<small>PC</small></span>${range('sens', 0.2, 3, 0.05)}</div>
      <div class="row"><span>터치 감도<small>휴대폰</small></span>${range('touchSens', 0.2, 3, 0.05)}</div>
      <div class="row"><span>시야각(FOV)<small>넓을수록 주변이 잘 보인다</small></span>${range('fov', 75, 110, 1)}</div>
      <div class="row"><span>효과음</span>${range('sfx', 0, 1, 0.05)}</div>
      <div class="row"><span>음악</span>${range('music', 0, 1, 0.05)}</div>
      <div class="row"><span>그래픽 품질<small>바꾸면 다시 시작할 때 적용</small></span>${seg('quality', [['auto', '자동'], ['low', '낮음'], ['mid', '중간'], ['high', '높음']])}</div>
      <div class="row"><span>정조준 방식</span>${seg('adsToggle', [[false, '누르는 동안'], [true, '눌러서 전환']])}</div>
      <div class="row"><span>화면 흔들림</span>${range('shake', 0, 1, 0.1)}</div>
      <div class="row"><span>피해 숫자</span>${seg('dmgNumbers', [[true, '켜기'], [false, '끄기']])}</div>
      <div class="actions"><button class="btn primary" data-a="back">확인</button></div></div></div>`;
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
    this.root.innerHTML = `<div class="screen dim"><div class="sheet cut" style="text-align:center;width:min(380px,100%)">
      <h2>일시정지</h2>
      <div style="display:flex;flex-direction:column;gap:10px;align-items:stretch">
      <button class="btn primary" data-a="resume">이어하기</button>
      <button class="btn" data-a="howto">조작법 · 규칙</button>
      <button class="btn" data-a="settings">설정</button>
      <button class="btn danger" data-a="quit">작전 포기(메인으로)</button></div></div></div>`;
    this.current = 'pause';
    this.wire({ resume: () => this.emit('resume'), howto: () => this.howto('pause'), settings: () => this.settings('pause'), quit: () => this.emit('quit') });
  }

  shop(world) {
    this.current = 'shop';
    this.shopTab = this.shopTab || 'weapon';
    this.root.innerHTML = `<div class="screen dim"><div class="shop cut">
      <div class="shop-head"><h2>정비 단말</h2><span class="shop-timer"></span><span class="shop-credits"></span></div>
      <div class="tabs"><button data-t="weapon">무기</button><button data-t="gear">장비</button><button data-t="core">코어 방어</button></div>
      <div class="cards"></div>
      <div class="shop-foot"><span class="tip">${this.touch ? '' : '숫자키로 빠르게 구매 · F/Esc 닫기 · Enter 웨이브 시작'}</span><span style="display:flex;gap:8px"><button class="btn" data-a="close">닫기</button><button class="btn primary" data-a="ready">웨이브 시작</button></span></div></div></div>`;
    for (const b of this.root.querySelectorAll('.tabs button')) b.addEventListener('click', () => { this.shopTab = b.dataset.t; this.audio.click(); this.renderShop(world); });
    this.wire({ close: () => this.emit('closeShop'), ready: () => this.emit('ready') });
    this.renderShop(world);
  }

  renderShop(world) {
    if (this.current !== 'shop') return;
    const items = world.shopItems().filter((i) => i.tab === this.shopTab);
    for (const b of this.root.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.t === this.shopTab);
    const box = this.root.querySelector('.cards');
    const label = (i) => i.state === 'owned' ? '보유' : i.state === 'max' ? '최대' : i.state === 'locked' ? '무기 먼저 구매' : `₵ ${i.price.toLocaleString()}`;
    box.innerHTML = items.map((i, k) => `<button class="card ${i.state === 'poor' ? 'poor' : ''} ${i.state === 'owned' || i.state === 'max' ? 'done' : ''}" data-id="${i.id}" ${i.state === 'ok' || i.state === 'poor' ? '' : 'disabled'}>
      <span class="key">${k + 1}</span><span class="nm">${esc(i.name)}</span><span class="ds">${esc(i.desc)}</span><span class="pr">${label(i)}</span></button>`).join('');
    for (const c of box.querySelectorAll('.card')) c.addEventListener('click', () => this.buy(world, c.dataset.id, c));
    this.updateShop(world);
  }

  buy(world, id, el) {
    const r = world.buy(id);
    if (r.ok) { this.audio.buy(); this.renderShop(world); const n = this.root.querySelector(`.card[data-id="${CSS.escape(id)}"]`); if (n) n.classList.add('flash'); }
    else { this.audio.deny(); if (el) { el.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 160 }); } }
  }
  buyIndex(world, k) {
    const c = this.root.querySelectorAll('.card')[k];
    if (c && !c.disabled) this.buy(world, c.dataset.id, c);
  }
  updateShop(world) {
    if (this.current !== 'shop') return;
    const c = this.root.querySelector('.shop-credits'), t = this.root.querySelector('.shop-timer');
    if (c) c.textContent = `₵ ${world.credits.toLocaleString()}`;
    if (t) t.textContent = `다음 웨이브까지 ${Math.ceil(world.timer)}초`;
  }

  gameOver(world, newBest) {
    const s = world.stats, acc = s.shots ? Math.round((s.hits / s.shots) * 100) : 0, weak = s.hits ? Math.round((s.weakHits / s.hits) * 100) : 0;
    const reason = world.overReason === 'core' ? '코어 함락' : '러너 사망';
    const sub = world.overReason === 'core' ? '오로라 코어가 헬릭스에 넘어갔다. 리치(◆)를 먼저 잡고, 코어 실드·포탑에 투자해 보자.' : '체력이 바닥났다. 처치해서 나오는 시안 구슬로 회복하고, 대시로 예고된 공격을 피하자.';
    this.root.innerHTML = `<div class="screen dim"><div class="over cut">
      ${newBest ? '<div class="newbest">★ 새 최고 기록 ★</div>' : ''}
      <div class="reason">${reason}</div><div class="sub">${sub}</div>
      <div class="grid">
        <div class="stat"><b>${world.wave}</b><span>도달 웨이브</span></div>
        <div class="stat"><b>${world.score.toLocaleString()}</b><span>점수</span></div>
        <div class="stat"><b>${s.kills}</b><span>처치</span></div>
        <div class="stat"><b>${acc}%</b><span>명중률</span></div>
        <div class="stat"><b>${weak}%</b><span>약점 명중</span></div>
        <div class="stat"><b>${Math.round(s.coreDamage)}</b><span>코어 피해</span></div>
      </div>
      <div class="tip" style="margin-bottom:14px">최고 기록 · 웨이브 ${this.save.best.wave} · 점수 ${this.save.best.score.toLocaleString()}</div>
      <div class="actions"><button class="btn primary" data-a="retry">다시 하기</button><button class="btn" data-a="menu">메인으로</button></div></div></div>`;
    this.current = 'over';
    this.wire({ retry: () => this.emit('retry'), menu: () => this.emit('quit') });
    setTimeout(() => this.root.querySelector('[data-a=retry]')?.focus(), 50);
  }

  wire(map) {
    for (const [a, fn] of Object.entries(map)) { const b = this.root.querySelector(`[data-a="${a}"]`); if (b) b.addEventListener('click', fn); }
  }
}
