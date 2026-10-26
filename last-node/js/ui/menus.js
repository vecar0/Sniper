// 메뉴 화면: 메인 · 설정 · 조작법 · 일시정지 · 상점 · 게임 오버
// 디자인: 신서울 간판 거리. 메인의 세로 네온 간판 하나만 대담하게, 나머지는 상자 없이 조용한 한글 글줄.
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
    const record = b.wave ? `최고 기록은 ${b.wave}웨이브, ${b.score.toLocaleString()}점입니다.` : '아직 기록이 없습니다.';
    this.root.innerHTML = `
      <div class="menu-main">
        <div class="sign" aria-hidden="true"><span>라</span><span>스</span><span class="flicker">트</span><span class="gap"></span><span>노</span><span>드</span></div>
        <div class="col">
          <h1 class="title">LAST NODE</h1>
          <p class="lede">2089년 신서울, 아케론 타워 옥상 320미터.<br>헬릭스가 도시의 마지막 자유 노드를 가져가려 합니다.<br>코어와 당신, 둘 중 하나라도 쓰러지면 끝입니다.</p>
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
      ? [['왼쪽 화면 끌기', '이동'], ['오른쪽 화면 끌기', '둘러보기'], ['발사', '누른 채 끌면 조준까지'], ['조준', '정조준 켜고 끄기'], ['대시, 점프', '공중에서 한 번 더 점프'], ['앉기', '달리다 누르면 슬라이드'], ['근접', '기절한 적은 즉시 처치하고 체력 25 회복'], ['EMP', '주변 기계 적을 2.5초 기절'], ['상점 열기, 준비 완료', '웨이브 사이 단말 근처에서']]
      : [['W A S D', '이동'], ['마우스', '둘러보기'], ['왼쪽 클릭', '사격'], ['오른쪽 클릭', '정조준'], ['Shift', '대시, 두 번까지 충전'], ['Space', '점프, 공중에서 한 번 더'], ['C', '앉기, 달리다 누르면 슬라이드'], ['V', '근접, 기절한 적은 즉시 처치하고 체력 25 회복'], ['G', 'EMP 수류탄, 떼면 던짐'], ['R', '재장전'], ['1 2 3 4, 휠, Q', '무기 바꾸기, Q는 이전 무기'], ['F', '상점 열기'], ['Enter', '정비 시간 건너뛰기'], ['Esc', '일시정지']];
    this.root.innerHTML = `<div class="screen dim"><div class="sheet wide">
      <h2>조작법과 규칙</h2>
      <div class="two">
        <dl class="keys">${rows.map(([k, v]) => `<dt>${k.split(', ').map((x) => `<kbd>${esc(x)}</kbd>`).join(' ')}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
        <div class="rules">
          <p><b>두 목숨을 지킵니다.</b> 당신의 체력이나 코어 내구도가 0이 되면 작전이 끝납니다.</p>
          <p><b>체력은 저절로 차지 않습니다.</b> 적을 처치하면 떨어지는 파란 구슬을 주우세요. 숨어 있으면 회복할 수 없습니다.</p>
          <p><b>리치를 먼저 잡으세요.</b> 머리 위에 빨간 마름모가 있는 해커는 당신을 무시하고 코어에 붙어 내구도를 빨아들입니다. 화면 밖에 있으면 가장자리에 화살표가 뜹니다.</p>
          <p><b>메크는 뒤에서.</b> 정면 방패가 피해를 70% 막습니다. EMP로 방패를 끄거나 등의 주황색 냉각 코어를 쏘세요.</p>
          <p><b>빨간 선과 원은 경고입니다.</b> 모든 공격은 빛과 소리로 먼저 알립니다. 보이면 대시로 피하세요.</p>
          <p><b>웨이브 사이에 정비합니다.</b> 상점 단말에서 무기를 강화할지, 코어 실드와 포탑에 투자할지 고르세요.</p>
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

  // 상점: 자판기처럼 줄 목록. 무기 · 장비 · 코어 방어 세 열(좁은 화면에서는 위아래로)
  shop(world) {
    this.current = 'shop';
    this.root.innerHTML = `<div class="screen dim shop-screen"><div class="shop">
      <div class="shop-head"><h2>정비 단말</h2><span class="shop-timer"></span><span class="shop-credits"></span></div>
      <div class="shop-cols">
        <section data-tab="weapon"><h3>무기</h3><div class="list"></div></section>
        <section data-tab="gear"><h3>장비</h3><div class="list"></div></section>
        <section data-tab="core"><h3>코어 방어</h3><div class="list"></div></section>
      </div>
      <div class="shop-foot"><span class="tip">${this.touch ? '항목을 눌러 구매합니다.' : '항목을 누르거나 번호 키로 구매합니다. F나 Esc로 닫습니다.'}</span>
        <span class="actions"><button class="btn quiet" data-a="close">닫기</button><button class="btn primary" data-a="ready">바로 다음 웨이브</button></span></div></div></div>`;
    this.wire({ close: () => this.emit('closeShop'), ready: () => this.emit('ready') });
    this.renderShop(world);
  }

  renderShop(world) {
    if (this.current !== 'shop') return;
    const items = world.shopItems();
    let k = 0;
    const label = (i) => i.state === 'owned' ? '보유 중' : i.state === 'max' ? '최대' : i.state === 'locked' ? '무기 먼저' : `₵${i.price.toLocaleString()}`;
    for (const sec of this.root.querySelectorAll('.shop-cols section')) {
      const list = items.filter((i) => i.tab === sec.dataset.tab);
      sec.querySelector('.list').innerHTML = list.map((i) => {
        const n = ++k;
        const can = i.state === 'ok' || i.state === 'poor';
        return `<button class="card ${i.state}" data-id="${i.id}" ${can ? '' : 'disabled'}>
          <span class="key">${n <= 9 ? n : ''}</span><span class="nm">${esc(i.name)}</span><span class="pr">${label(i)}</span><span class="ds">${esc(i.desc)}</span></button>`;
      }).join('');
    }
    for (const c of this.root.querySelectorAll('.card')) c.addEventListener('click', () => this.buy(world, c.dataset.id, c));
    this.updateShop(world);
  }

  buy(world, id, el) {
    const r = world.buy(id);
    if (r.ok) { this.audio.buy(); this.renderShop(world); const n = this.root.querySelector(`.card[data-id="${CSS.escape(id)}"]`); if (n) n.classList.add('bought'); }
    else {
      this.audio.deny();
      if (el && r.reason === 'poor') { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); }
    }
  }
  buyIndex(world, k) {
    const c = this.root.querySelectorAll('.card')[k];
    if (c && !c.disabled) this.buy(world, c.dataset.id, c);
  }
  updateShop(world) {
    if (this.current !== 'shop') return;
    const c = this.root.querySelector('.shop-credits'), t = this.root.querySelector('.shop-timer');
    if (c) c.textContent = `₵${world.credits.toLocaleString()}`;
    if (t) t.textContent = `다음 웨이브까지 ${Math.ceil(world.timer)}초`;
  }

  gameOver(world, newBest) {
    const s = world.stats, acc = s.shots ? Math.round((s.hits / s.shots) * 100) : 0, weak = s.hits ? Math.round((s.weakHits / s.hits) * 100) : 0;
    const core = world.overReason === 'core';
    const reason = core ? '코어 함락' : '러너 사망';
    const sub = core
      ? '헬릭스가 오로라 코어를 가져갔습니다. 다음에는 빨간 마름모의 리치를 먼저 잡고, 웨이브 사이에 코어 실드나 포탑을 사 두세요.'
      : '체력이 바닥났습니다. 처치할 때 떨어지는 파란 구슬로 회복하고, 빨간 경고가 보이면 대시로 피하세요.';
    const rows = [['도달한 웨이브', world.wave], ['점수', world.score.toLocaleString()], ['처치', s.kills], ['명중률', `${acc}%`], ['약점 명중', `${weak}%`], ['코어가 받은 피해', Math.round(s.coreDamage).toLocaleString()]];
    this.root.innerHTML = `<div class="screen dim"><div class="sheet over">
      <h2 class="reason">${reason}</h2>
      ${newBest ? '<p class="newbest">새 최고 기록입니다.</p>' : ''}
      <p class="sub">${sub}</p>
      <dl class="stats">${rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>
      <p class="best">최고 기록 ${this.save.best.wave}웨이브, ${this.save.best.score.toLocaleString()}점</p>
      <div class="actions"><button class="btn primary" data-a="retry">다시 하기</button><button class="btn quiet" data-a="menu">처음 화면으로</button></div></div></div>`;
    this.current = 'over';
    this.wire({ retry: () => this.emit('retry'), menu: () => this.emit('quit') });
    setTimeout(() => this.root.querySelector('[data-a=retry]')?.focus({ preventScroll: true }), 50);
  }

  wire(map) {
    for (const [a, fn] of Object.entries(map)) { const b = this.root.querySelector(`[data-a="${a}"]`); if (b) b.addEventListener('click', fn); }
  }
}
