/**
 * 옥상 저격전 화면: 메뉴 · HUD · 스코프 · 일시정지 · 결과.
 * 게임과는 game.hud()(매 프레임)와 hooks(사건)로만 소통한다.
 */
import type { AudioEngine } from '../audio/audio';
import type { ArenaGame, ArenaResult, Difficulty, KillInfo } from './game';
import type { ArenaInput, TouchPad } from './input';

interface Prefs {
  difficulty: Difficulty;
  aimAssist: boolean;
  sens: number;
}

const PREF_KEY = 'longshot.arena.prefs';

function loadPrefs(touch: boolean): Prefs {
  const def: Prefs = { difficulty: 'normal', aimAssist: touch, sens: 1 };
  try {
    const raw = JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') as Partial<Prefs>;
    return {
      difficulty: raw.difficulty === 'easy' || raw.difficulty === 'hard' ? raw.difficulty : def.difficulty,
      aimAssist: typeof raw.aimAssist === 'boolean' ? raw.aimAssist : def.aimAssist,
      sens: typeof raw.sens === 'number' && raw.sens >= 0.3 && raw.sens <= 3 ? raw.sens : 1,
    };
  } catch {
    return def;
  }
}

/** 무기 실루엣(왼쪽이 총구) – 점수판 무기 칸 · 무기 목록 */
const GUN_SVG = {
  sniper: '<svg viewBox="0 0 120 30" aria-hidden="true"><path d="M2 13h46v-2h4V7h-2V4h28v3h-2v4h4v-1h14l4 1h20v3l-4 1v8h-6l-12-6h-6v4l3 7h-6l-3-7h-4v4h-6v-4h-4l-2 2h-6v-2H52v-1H2z"/></svg>',
  pistol: '<svg viewBox="0 0 120 30" aria-hidden="true"><path d="M30 5h52v9H74v2l4 13h-11l-4-11h-6c-1 3-3 5-7 5h-4v-2h4c2 0 3-1 3-3H34v-4h-4z"/></svg>',
};

/** 시작 화면 아이콘 */
const svg = (b: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${b}</svg>`;
const UI_ICON = {
  gear: svg('<path d="M10.3 2.5h3.4l.5 2.4 1.8.8 2.1-1.4 2.4 2.4-1.4 2.1.8 1.8 2.4.5v3.4l-2.4.5-.8 1.8 1.4 2.1-2.4 2.4-2.1-1.4-1.8.8-.5 2.4h-3.4l-.5-2.4-1.8-.8-2.1 1.4-2.4-2.4 1.4-2.1-.8-1.8-2.4-.5v-3.4l2.4-.5.8-1.8-1.4-2.1 2.4-2.4 2.1 1.4 1.8-.8z"/><circle cx="12" cy="12" r="3"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.6v.7"/><circle class="f" cx="12" cy="17" r="1"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  arrow: svg('<path d="M5 12h13M13 6l6 6-6 6"/>'),
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export class ArenaUI {
  private readonly game: ArenaGame;
  private readonly input: ArenaInput;
  private readonly audio: AudioEngine;
  private readonly touch: TouchPad | null;
  private readonly hudEl: HTMLDivElement;
  private readonly screen: HTMLDivElement;
  private readonly scopeEl: HTMLDivElement;
  private prefs: Prefs;
  private feed: { el: HTMLElement; t: number }[] = [];
  private hitT = 0;
  private killTextT = 0;
  private bannerT = 0;
  private radarT = 0;
  private hudCache = '';

  constructor(root: HTMLElement, game: ArenaGame, input: ArenaInput, audio: AudioEngine, touch: TouchPad | null) {
    this.game = game;
    this.input = input;
    this.audio = audio;
    this.touch = touch;
    this.prefs = loadPrefs(input.isTouch);
    this.applyPrefs();
    if (input.isTouch) document.body.classList.add('a-is-touch');

    this.scopeEl = document.createElement('div');
    this.scopeEl.className = 'a-scopeview';
    this.scopeEl.innerHTML = `<div class="a-scope-mask"></div><svg class="a-reticle" viewBox="-100 -100 200 200" aria-hidden="true">
      <line x1="-100" y1="0" x2="-6" y2="0"/><line x1="6" y1="0" x2="100" y2="0"/><line x1="0" y1="-100" x2="0" y2="-6"/><line x1="0" y1="6" x2="0" y2="100"/>
      <line class="thick" x1="-100" y1="0" x2="-55" y2="0"/><line class="thick" x1="55" y1="0" x2="100" y2="0"/><line class="thick" x1="0" y1="55" x2="0" y2="100"/>
      ${[-40, -30, -20, -10, 10, 20, 30, 40].map((x) => `<circle cx="${x}" cy="0" r="1.3"/><circle cx="0" cy="${x}" r="1.3"/>`).join('')}
      <circle class="dot" cx="0" cy="0" r="1.1"/></svg><div class="a-scope-zoom"></div>`;
    root.appendChild(this.scopeEl);

    this.hudEl = document.createElement('div');
    this.hudEl.className = 'a-hud';
    this.hudEl.innerHTML = `
      <div class="a-sb"><div class="a-sb-t"><b class="a-kills">0</b><small>처치</small></div><div class="a-sb-mid"><b class="a-time">00:00</b><span class="a-wave">WAVE 1</span></div><div class="a-sb-ct"><b class="a-left">0</b><small>남은 적</small></div></div>
      <div class="a-radar"><canvas width="300" height="300"></canvas><div class="a-score"><span>★</span><b>0</b></div></div>
      <div class="a-combo"></div>
      <div class="a-feed"></div>
      <div class="a-markers"></div>
      <div class="a-covermark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6z"/></svg><span></span></div>
      <div class="a-snipers"></div>
      <div class="a-cross"><i></i><i></i><i></i><i></i><b></b></div>
      <div class="a-hit"><i></i><i></i></div>
      <div class="a-killtext"></div>
      <div class="a-expose"></div>
      <div class="a-hurt"></div>
      <div class="a-hurtdirs"></div>
      <div class="a-hp"><svg class="a-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 1h4v5h5v4h-5v5H6v-5H1V6h5z"/></svg><b class="a-hpn">100</b><i><b></b></i></div>
      <div class="a-weapon"><div class="a-ammo"></div><div class="a-wrow"><span class="a-wname"></span>${GUN_SVG.sniper.replace('<svg', '<svg class="a-gun"')}</div><div class="a-wstate"></div></div>
      <div class="a-slots"><div class="a-slot" data-w="sniper"><span>1</span>${GUN_SVG.sniper}</div><div class="a-slot" data-w="pistol"><span>2</span>${GUN_SVG.pistol}</div><em>Q 교체</em></div>
      <div class="a-banner"></div>
      <div class="a-cam"></div>`;
    root.appendChild(this.hudEl);

    this.screen = document.createElement('div');
    this.screen.className = 'a-screen';
    root.appendChild(this.screen);

    game.hooks = {
      onKill: (k) => this.onKill(k),
      onHitMarker: (head, kill) => this.onHitMarker(head, kill),
      onWave: (n, bonus) => this.banner(`웨이브 ${n - 1} 클리어!`, `+${bonus}점 · 구급상자 보충 · 다음 웨이브 곧 시작`),
      onGameOver: (r) => this.showResult(r),
      onToast: (t) => this.banner(t, ''),
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.game.running && !this.game.paused && !this.game.over) this.pause();
    });
    window.addEventListener('blur', () => {
      if (this.game.running && !this.game.paused && !this.game.over && !this.input.isTouch) this.pause();
    });
    document.addEventListener('pointerlockchange', () => {
      // ESC로 마우스 잠금이 풀리면 일시정지
      if (!document.pointerLockElement && this.game.running && !this.game.paused && !this.game.over && !this.input.isTouch) this.pause();
    });
    this.showMenu();
    const loop = () => {
      requestAnimationFrame(loop);
      this.update();
    };
    loop();
  }

  private applyPrefs(): void {
    this.game.difficulty = this.prefs.difficulty;
    this.game.aimAssist = this.prefs.aimAssist;
    this.input.touchSens = this.prefs.sens;
    this.input.mouseSens = this.prefs.sens;
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(this.prefs));
    } catch {
      /* 저장소 불가 */
    }
  }

  private best(): number {
    try {
      return Number(localStorage.getItem('longshot.arena.best') ?? 0) || 0;
    } catch {
      return 0;
    }
  }

  // ─────────── 화면 ───────────
  private show(html: string): void {
    this.screen.innerHTML = html;
    this.screen.style.display = html ? 'flex' : 'none';
  }

  showMenu(): void {
    this.hudEl.style.display = 'none';
    this.touch?.setVisible(false);
    const p = this.prefs;
    const diffName = { easy: '쉬움', normal: '보통', hard: '어려움' }[p.difficulty];
    this.show(`<div class="a-lobby a-menu">
      <div class="a-lobby-top">
        <button class="a-icon-btn" data-sheet="how" aria-label="조작법">${UI_ICON.help}</button>
        <button class="a-icon-btn" data-sheet="settings" aria-label="설정">${UI_ICON.gear}</button>
      </div>
      <div class="a-brand">
        <span class="a-kicker">TACTICAL SNIPER</span>
        <h1>LONG<span>·</span>SHOT</h1>
        <p>옥상 저격전</p>
      </div>
      <div class="a-lobby-bottom">
        <div class="a-lobby-info">
          <div class="a-best"><span>최고 점수</span><b>${this.best().toLocaleString()}</b></div>
          <div class="a-chips"><span>난이도 ${diffName}</span><span>조준 보조 ${p.aimAssist ? '켬' : '끔'}</span><span>감도 ${p.sens.toFixed(1)}</span></div>
          <a class="a-classic" href="./classic.html">클래식 정밀 저격 작전 →</a>
        </div>
        <button class="a-play" data-act="start"><span>출격</span>${UI_ICON.arrow}</button>
      </div>
    </div>`);
    this.bind('[data-act="start"]', () => this.start());
    this.screen.querySelectorAll<HTMLElement>('[data-sheet]').forEach((b) => b.addEventListener('click', () => this.openSheet(b.dataset.sheet as 'how' | 'settings')));
  }

  /** 시작 화면 위에 오른쪽에서 열리는 설정 · 조작법 창 */
  private openSheet(kind: 'how' | 'settings'): void {
    this.audio.play('uiClick');
    const p = this.prefs;
    const touch = this.input.isTouch;
    const seg = (key: string, items: [string, string][], on: string) => `<div class="a-seg">${items.map(([v, t]) => `<button data-${key}="${v}" class="${v === on ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    const body =
      kind === 'settings'
        ? `<div class="a-opts">
            <div class="a-opt"><span>난이도</span>${seg('diff', [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']], p.difficulty)}</div>
            <div class="a-opt"><span>조준 보조</span>${seg('assist', [['1', '켜기'], ['0', '끄기']], p.aimAssist ? '1' : '0')}</div>
            <div class="a-opt"><span>감도 <output>${p.sens.toFixed(1)}</output></span><input type="range" min="0.3" max="3" step="0.1" value="${p.sens}" data-sens></div>
          </div>`
        : `<div class="a-how">
            <h3>조작</h3>
            ${touch
              ? '<p><b>왼쪽 화면</b> 눌러 끌기 = 이동 (끝까지 밀면 달리기)</p><p><b>오른쪽 화면</b> 끌어서 조준 · 발사 버튼을 누른 채 끌어도 조준</p><p>버튼: 발사 · 스코프 · 숙이기 · 엄폐(방패) · 점프 · 재장전 · 무기 교체</p>'
              : '<div class="a-keys"><span><kbd>WASD</kbd>이동</span><span><kbd>Shift</kbd>달리기</span><span><kbd>마우스</kbd>조준</span><span><kbd>좌클릭</kbd>발사</span><span><kbd>우클릭</kbd>스코프</span><span><kbd>V</kbd>엄폐</span><span><kbd>C</kbd>숙이기</span><span><kbd>Space</kbd>점프</span><span><kbd>R</kbd>재장전</span><span><kbd>Q · 1 · 2</kbd>무기</span><span><kbd>휠 · E</kbd>배율</span><span><kbd>Esc</kbd>일시정지</span></div>'}
            <h3>요령</h3>
            <p><b>엄폐</b> 화면의 방패 표시가 가장 가까운 엄폐 자리. 엄폐 버튼을 누르면 달려가 숨고, 다시 누르면 다음 엄폐물로. 높은 엄폐물(컨테이너)은 스코프를 열면 옆으로 몸을 내밉니다.</p>
            <p><b>숙이기</b> 난간 · 창턱 · 모래주머니 뒤에서 숙이면 총에 안 맞고, 스코프를 열면 고개만 내밉니다.</p>
            <p><b>회복</b> 체력은 저절로 차지 않습니다. 땅 위 엄폐물 뒤 구급상자(초록 빛기둥)를 주우세요.</p>
            <p><b>적</b> 빨간 레이저는 적 저격수 – 먼저 쏘거나 숨으세요. 돌격병은 건물 안 계단까지 쫓아옵니다.</p>
          </div>`;
    const sheet = document.createElement('div');
    sheet.className = 'a-sheet-wrap';
    sheet.innerHTML = `<div class="a-sheet"><div class="a-sheet-head"><h2>${kind === 'settings' ? '설정' : '조작법'}</h2><button class="a-icon-btn" data-close aria-label="닫기">${UI_ICON.close}</button></div>${body}</div>`;
    this.screen.appendChild(sheet);
    const close = () => {
      sheet.remove();
      this.showMenu();
    };
    sheet.addEventListener('click', (e) => e.target === sheet && close());
    sheet.querySelector('[data-close]')!.addEventListener('click', close);
    const pick = (attr: string, fn: (v: string) => void) =>
      sheet.querySelectorAll<HTMLElement>(`[data-${attr}]`).forEach((b) =>
        b.addEventListener('click', () => {
          this.audio.play('uiClick');
          fn(b.dataset[attr]!);
          this.applyPrefs();
          b.parentElement!.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        }),
      );
    pick('diff', (v) => (this.prefs.difficulty = v as Difficulty));
    pick('assist', (v) => (this.prefs.aimAssist = v === '1'));
    const sens = sheet.querySelector<HTMLInputElement>('[data-sens]');
    sens?.addEventListener('input', () => {
      this.prefs.sens = Number(sens.value);
      this.applyPrefs();
      sheet.querySelector('output')!.textContent = this.prefs.sens.toFixed(1);
    });
  }

  private bind(sel: string, fn: () => void): void {
    this.screen.querySelector<HTMLElement>(sel)?.addEventListener('click', () => {
      this.audio.play('uiClick');
      fn();
    });
  }

  private start(): void {
    this.audio.unlock();
    this.audio.stopMusic();
    this.show('');
    this.hudEl.style.display = 'block';
    this.touch?.setVisible(true);
    this.feed.forEach((f) => f.el.remove());
    this.feed = [];
    this.game.newGame();
    this.banner('웨이브 1', '적이 몰려옵니다 – 숙여서 엄폐하고, 일어나 쏘세요');
    if (this.input.isTouch) this.tryFullscreen();
  }

  private tryFullscreen(): void {
    const el = document.documentElement;
    if (document.fullscreenElement || !el.requestFullscreen || new URLSearchParams(location.search).has('test')) return;
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
      .catch(() => undefined);
  }

  private pausedAt = 0;
  pause(): void {
    this.pausedAt = performance.now();
    this.input.consume('pause');
    this.game.setPaused(true);
    this.touch?.setVisible(false);
    const h = this.game.hud();
    this.show(`<div class="a-panel a-pause"><span class="a-kicker">PAUSED</span><h2>일시정지</h2>
      <div class="a-pause-stats"><div><b>${h.wave}</b><span>웨이브</span></div><div><b>${h.kills}</b><span>처치</span></div><div><b>${h.score.toLocaleString()}</b><span>점수</span></div></div>
      <button class="a-btn-main" data-act="resume">계속하기</button>
      <div class="a-row"><button class="a-btn" data-act="restart">다시 시작</button><button class="a-btn" data-act="quit">메뉴로</button></div></div>`);
    this.bind('[data-act="resume"]', () => this.resume());
    this.bind('[data-act="restart"]', () => this.start());
    this.bind('[data-act="quit"]', () => {
      this.game.quit();
      this.audio.startMusic();
      this.showMenu();
    });
  }

  private resume(): void {
    this.show('');
    this.touch?.setVisible(true);
    this.game.setPaused(false);
  }

  private showResult(r: ArenaResult): void {
    this.touch?.setVisible(false);
    window.setTimeout(() => {
      this.hudEl.style.display = 'none';
      this.show(`<div class="a-panel a-result"><span class="a-kicker">MISSION OVER</span><h2>작전 종료</h2>
        <div class="a-final">${r.score.toLocaleString()}<small>점</small></div>
        ${r.newBest ? '<div class="a-newbest">최고 기록!</div>' : `<div class="a-best">최고 ${r.best.toLocaleString()}</div>`}
        <div class="a-stats">
          <div><b>${r.wave}</b><span>도달 웨이브</span></div>
          <div><b>${r.kills}</b><span>처치</span></div>
          <div><b>${r.headshots}</b><span>헤드샷</span></div>
          <div><b>${Math.round(r.accuracy * 100)}%</b><span>명중률</span></div>
          <div><b>${Math.round(r.longest)}m</b><span>최장 처치</span></div>
        </div>
        <p class="a-tip">${esc(this.tip(r))}</p>
        <div class="a-row"><button class="a-btn" data-act="menu">메뉴로</button><button class="a-btn-main" data-act="again">다시 출격</button></div></div>`);
      this.bind('[data-act="again"]', () => this.start());
      this.bind('[data-act="menu"]', () => {
        this.game.quit();
        this.audio.startMusic();
        this.showMenu();
      });
    }, 900);
  }

  private tip(r: ArenaResult): string {
    if (r.accuracy < 0.35) return '스코프를 다 연 뒤(화면이 확대된 뒤) 쏘면 탄이 정확히 가운데로 갑니다.';
    if (r.headshots < r.kills * 0.3) return '머리를 맞히면 점수 1.5배 + 중장갑도 한 방입니다.';
    if (r.wave < 4) return '숙이고 있으면 총에 맞지 않습니다. 체력이 낮으면 엄폐물 뒤 구급상자를 주우러 내려가세요.';
    return '빨간 레이저(적 저격수)는 다른 적보다 먼저 처리하세요.';
  }

  // ─────────── 사건 ───────────
  private onKill(k: KillInfo): void {
    const el = document.createElement('div');
    el.className = `a-feed-row${k.head ? ' head' : ''}`;
    el.innerHTML = `<span>${k.head ? '헤드샷' : '처치'}</span> ${esc(k.name)} <em>${Math.round(k.distance)}m</em> <b>+${k.score}</b>`;
    this.hudEl.querySelector('.a-feed')!.prepend(el);
    this.feed.unshift({ el, t: 4 });
    while (this.feed.length > 4) this.feed.pop()!.el.remove();
    const kt = this.hudEl.querySelector<HTMLElement>('.a-killtext')!;
    kt.textContent = k.head ? 'HEADSHOT' : k.combo > 1 ? `${k.combo}연속 처치` : '처치';
    kt.className = `a-killtext show${k.head ? ' head' : ''}`;
    this.killTextT = 1.1;
  }

  private onHitMarker(head: boolean, kill: boolean): void {
    const h = this.hudEl.querySelector<HTMLElement>('.a-hit')!;
    h.className = `a-hit show${kill ? ' kill' : ''}${head ? ' head' : ''}`;
    this.hitT = 0.35;
  }

  private banner(title: string, sub: string): void {
    const b = this.hudEl.querySelector<HTMLElement>('.a-banner')!;
    b.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
    b.classList.add('show');
    this.bannerT = 2.6;
  }

  // ─────────── 매 프레임 ───────────
  private last = performance.now();
  private update(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const g = this.game;
    if (!g.running) {
      this.scopeEl.style.display = 'none';
      return;
    }
    const h = g.hud();
    const q = <T extends HTMLElement>(s: string) => this.hudEl.querySelector<T>(s)!;
    q('.a-score b').textContent = h.score.toLocaleString();
    q('.a-kills').textContent = String(h.kills);
    const t = Math.floor(h.playTime);
    q('.a-time').textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    q('.a-wave').textContent = h.breakT > 0 ? `WAVE ${h.wave + 1} 준비` : `WAVE ${h.wave}`;
    q('.a-left').textContent = h.breakT > 0 ? '–' : String(h.enemiesLeft);
    const combo = q('.a-combo');
    combo.textContent = h.combo > 1 ? `×${h.combo} 연속` : '';
    combo.style.opacity = h.combo > 1 ? String(Math.min(1, h.comboT * 2)) : '0';
    // 레이더(초당 약 20번 다시 그림)
    this.radarT -= dt;
    if (this.radarT <= 0) {
      this.radarT = 0.05;
      this.drawRadar();
    }
    // 체력
    q('.a-hp i b').style.transform = `scaleX(${Math.max(0, h.hp / 100).toFixed(3)})`;
    q('.a-hpn').textContent = String(Math.ceil(h.hp));
    q('.a-hp').classList.toggle('low', h.hp < 35);
    q('.a-hurt').style.opacity = String(Math.min(1, h.hurt * 0.85 + (h.hp < 35 ? 0.3 : 0)));
    q('.a-hurtdirs').innerHTML = h.hurtDirs.map((d) => `<i style="transform:translate(-50%,-50%) rotate(${d.toFixed(0)}deg)"></i>`).join('');
    // 무기: 큰 숫자 탄약 + 실루엣 (바뀔 때만 다시 그림)
    const key = `${h.weapon}|${h.inMag}|${h.reserve}`;
    if (key !== this.hudCache) {
      this.hudCache = key;
      q('.a-wname').textContent = h.weaponName;
      q('.a-ammo').innerHTML = `<b class="${h.inMag === 0 ? 'empty' : ''}">${h.inMag}</b><small>/ ${h.reserve ?? '∞'}</small>`;
      q('.a-gun').outerHTML = GUN_SVG[h.weapon].replace('<svg', '<svg class="a-gun"');
      this.hudEl.querySelectorAll<HTMLElement>('.a-slot').forEach((el) => el.classList.toggle('on', el.dataset.w === h.weapon));
    }
    q('.a-wstate').textContent = h.reloading >= 0 ? '재장전 중…' : h.bolting ? '장전' : h.inMag === 0 ? '탄 없음 – 재장전' : '';
    // 노출 표시
    const ex = q('.a-expose');
    ex.textContent = h.exposed === 'hidden' ? '숨음' : h.exposed === 'peek' ? '머리 노출' : '노출';
    ex.className = `a-expose ${h.exposed}${h.inCover ? ' cover' : ''}`;
    // 엄폐 버튼이 갈 자리(방패 표시)
    const cm = q('.a-covermark');
    if (h.coverMark) {
      cm.style.display = 'block';
      cm.style.transform = `translate(${h.coverMark.x.toFixed(0)}px, ${h.coverMark.y.toFixed(0)}px)`;
      cm.classList.toggle('run', h.coverMark.run);
      cm.querySelector('span')!.textContent = h.coverMark.run || this.input.isTouch ? '' : 'V';
    } else cm.style.display = 'none';
    // 십자선 · 스코프
    const scoped = h.scopeT > 0.85;
    this.scopeEl.style.display = scoped ? 'block' : 'none';
    if (scoped) {
      const z = this.scopeEl.querySelector<HTMLElement>('.a-scope-zoom')!;
      z.textContent = `${h.zoom}×`;
    }
    const cross = q('.a-cross');
    cross.style.display = scoped || h.bulletCam ? 'none' : 'block';
    cross.style.setProperty('--gap', `${Math.max(5, Math.min(90, h.spreadPx)).toFixed(1)}px`);
    // 적 표시(맨눈일 때)
    const mk = q('.a-markers');
    mk.innerHTML = h.markers.map((m) => `<i class="${m.kind}${m.roof ? ' roof' : ''}" style="transform:translate(${m.x.toFixed(0)}px,${m.y.toFixed(0)}px)">${m.roof ? '!' : ''}</i>`).join('');
    // 적 저격수 경고
    const sn = q('.a-snipers');
    sn.innerHTML = h.snipers
      .filter((s) => s.charge > 0.05)
      .map((s) =>
        s.onScreen
          ? `<div class="a-sn-on" style="transform:translate(${s.x.toFixed(0)}px,${s.y.toFixed(0)}px)"><span style="--c:${(s.charge * 100).toFixed(0)}%"></span>저격수</div>`
          : `<div class="a-sn-off" style="transform:translate(-50%,-50%) rotate(${s.dir.toFixed(0)}deg)"><span>저격수!</span></div>`,
      )
      .join('');
    // 일시적 표시들
    this.hitT -= dt;
    if (this.hitT <= 0) q('.a-hit').classList.remove('show');
    this.killTextT -= dt;
    if (this.killTextT <= 0) q('.a-killtext').classList.remove('show');
    this.bannerT -= dt;
    if (this.bannerT <= 0) q('.a-banner').classList.remove('show');
    for (const f of this.feed) {
      f.t -= dt;
      f.el.style.opacity = String(Math.min(1, f.t));
    }
    q('.a-cam').style.display = h.bulletCam ? 'block' : 'none';
    this.touch?.setState({ scoped: h.scopeT > 0.5, crouched: h.crouched, zoomLabel: `${h.zoom}×`, weapon: h.weapon === 'sniper' ? '권총으로 교체' : '저격총으로 교체' });
    if (this.input.consume('pause') && now - this.pausedAt > 350) {
      if (g.paused) this.resume();
      else if (!g.over) this.pause();
    }
  }

  /** 왼쪽 위 원형 레이더: 내가 보는 방향이 위, 건물 · 엄폐물은 회색, 적은 빨간 점 */
  private drawRadar(): void {
    const cv = this.hudEl.querySelector<HTMLCanvasElement>('.a-radar canvas')!;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const g = this.game;
    const S = cv.width, C = S / 2;
    const RANGE = 70; // 레이더 반지름 = 70 m
    const k = (C - 4) / RANGE;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(C, C, C - 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(16, 20, 22, 0.62)';
    ctx.fill();
    ctx.clip();
    // 세계 좌표 (x, z)를 캔버스 (x, y)로 – 돌려서 내 시선이 항상 위쪽
    ctx.translate(C, C);
    ctx.rotate(g.yaw);
    ctx.scale(k, k);
    ctx.translate(-g.pos.x, -g.pos.z);
    ctx.fillStyle = 'rgba(215, 210, 195, 0.4)';
    for (const b of g.map.boxes) {
      if (b.max.y - b.min.y < 0.7) continue;
      ctx.fillRect(b.min.x, b.min.z, b.max.x - b.min.x, b.max.z - b.min.z);
    }
    // 구급상자(초록 십자) – 회전된 좌표에서 그리되 크기는 m 단위
    ctx.fillStyle = '#5dff7e';
    for (const kt of g.medkits.kits) {
      const u = 18 / k;
      ctx.fillRect(kt.pos.x - u / 2, kt.pos.z - u / 6, u, u / 3);
      ctx.fillRect(kt.pos.x - u / 6, kt.pos.z - u / 2, u / 3, u);
    }
    ctx.restore();
    // 거리 눈금
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(C, C, (C - 4) / 2, 0, Math.PI * 2);
    ctx.stroke();
    // 시야 부채꼴
    const half = Math.atan(Math.tan((g.camera.fov * Math.PI) / 360) * g.camera.aspect);
    const grad = ctx.createRadialGradient(C, C, 0, C, C, C);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(C, C);
    ctx.arc(C, C, C, -Math.PI / 2 - half, -Math.PI / 2 + half);
    ctx.fill();
    // 적
    const c = Math.cos(g.yaw), s = Math.sin(g.yaw);
    for (const e of g.enemies) {
      if (!e.alive || !e.rig.root.visible) continue;
      const dx = e.pos.x - g.pos.x, dz = e.pos.z - g.pos.z;
      let x = (c * dx - s * dz) * k, y = (s * dx + c * dz) * k;
      const d = Math.hypot(x, y);
      const edge = d > C - 12;
      if (edge) {
        x *= (C - 12) / d;
        y *= (C - 12) / d;
      }
      ctx.globalAlpha = edge ? 0.55 : 1;
      ctx.fillStyle = e.kind === 'sniper' ? '#ff2a2a' : e.kind === 'heavy' ? '#ff9a3c' : '#ff5545';
      ctx.beginPath();
      ctx.arc(C + x, C + y, e.kind === 'heavy' ? 9 : 7, 0, Math.PI * 2);
      ctx.fill();
      if (e.kind === 'sniper') {
        ctx.strokeStyle = '#ffd0c8';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // 나(가운데 흰 화살표)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(C, C - 13);
    ctx.lineTo(C + 9, C + 9);
    ctx.lineTo(C, C + 4);
    ctx.lineTo(C - 9, C + 9);
    ctx.closePath();
    ctx.fill();
    // 테두리
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(C, C, C - 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}
