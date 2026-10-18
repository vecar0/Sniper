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
      <div class="a-tl"><div class="a-score">0</div><div class="a-wave">웨이브 1</div><div class="a-left"></div></div>
      <div class="a-combo"></div>
      <div class="a-feed"></div>
      <div class="a-markers"></div>
      <div class="a-snipers"></div>
      <div class="a-cross"><i></i><i></i><i></i><i></i><b></b></div>
      <div class="a-hit"><i></i><i></i></div>
      <div class="a-killtext"></div>
      <div class="a-expose"></div>
      <div class="a-hurt"></div>
      <div class="a-hurtdirs"></div>
      <div class="a-hp"><span>체력</span><i><b></b></i><em></em></div>
      <div class="a-weapon"><b class="a-wname"></b><div class="a-ammo"></div><div class="a-wstate"></div></div>
      <div class="a-banner"></div>
      <div class="a-cam"></div>`;
    root.appendChild(this.hudEl);

    this.screen = document.createElement('div');
    this.screen.className = 'a-screen';
    root.appendChild(this.screen);

    game.hooks = {
      onKill: (k) => this.onKill(k),
      onHitMarker: (head, kill) => this.onHitMarker(head, kill),
      onWave: (n, bonus) => this.banner(`웨이브 ${n - 1} 클리어!`, `+${bonus}점 · 체력 회복 · 다음 웨이브 곧 시작`),
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
    const touch = this.input.isTouch;
    this.show(`<div class="a-panel a-menu">
      <div class="a-brand"><h1>LONG<span>·</span>SHOT</h1><p>옥상 저격전</p></div>
      <p class="a-lead">건물을 지켜라. 옥상 · 창가 · 1층 어디서든 – 몰려오는 적을 <b>저격총 한 방</b>으로.</p>
      <button class="a-btn-main" data-act="start">출격</button>
      <div class="a-best">최고 점수 <b>${this.best().toLocaleString()}</b></div>
      <div class="a-opts">
        <div class="a-opt"><span>난이도</span><div class="a-seg">${(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => `<button data-diff="${d}" class="${p.difficulty === d ? 'on' : ''}">${{ easy: '쉬움', normal: '보통', hard: '어려움' }[d]}</button>`).join('')}</div></div>
        <div class="a-opt"><span>조준 보조</span><div class="a-seg"><button data-assist="1" class="${p.aimAssist ? 'on' : ''}">켜기</button><button data-assist="0" class="${!p.aimAssist ? 'on' : ''}">끄기</button></div></div>
        <div class="a-opt"><span>감도 <output>${p.sens.toFixed(1)}</output></span><input type="range" min="0.3" max="3" step="0.1" value="${p.sens}" data-sens></div>
      </div>
      <details class="a-how"><summary>조작법</summary>
        ${touch
          ? '<p><b>왼손</b> 화면 왼쪽 아무 데나 눌러 끌기 = 이동</p><p><b>오른손</b> 화면을 끌어 조준 · [발사]를 누른 채 끌어도 조준</p><p>[스코프] 켜고 끄기 · [숙이기] 난간 뒤에 숨기 · [점프] 모래주머니 · 상자 · 창턱 넘기 · [무기] 저격총↔기관단총</p>'
          : '<p><b>WASD</b> 이동 · <b>마우스</b> 조준 · <b>좌클릭</b> 발사 · <b>우클릭(누르고 있기)</b> 스코프</p><p><b>Space</b> 점프 · <b>C</b> 숙이기 · <b>R</b> 재장전 · <b>Q</b> 무기 교체 · <b>휠/E</b> 배율 · <b>Esc</b> 일시정지</p>'}
        <p><b>건물</b> 옥상 계단실 문으로 들어가면 3층 · 2층 · 1층으로 내려갈 수 있고, 1층 정문으로 밖에도 나갈 수 있습니다. 2·3층 창가는 숙였다 일어나 쏘기 좋은 자리. <b>돌격병</b>은 정문으로 들어와 계단을 타고 끝까지 쫓아옵니다.</p>
        <p><b>요령</b> 숙이면 난간 · 창턱이 몸을 가려 총에 안 맞습니다. 스코프를 열면 고개만 살짝 내밉니다. 빨간 레이저가 보이면 <b>적 저격수</b> – 먼저 쏘거나 숙이세요.</p>
      </details>
      <a class="a-classic" href="./classic.html">클래식 정밀 저격 작전 모드 →</a>
    </div>`);
    this.bind('[data-act="start"]', () => this.start());
    this.screen.querySelectorAll<HTMLElement>('[data-diff]').forEach((b) =>
      b.addEventListener('click', () => {
        this.prefs.difficulty = b.dataset.diff as Difficulty;
        this.applyPrefs();
        this.showMenu();
      }),
    );
    this.screen.querySelectorAll<HTMLElement>('[data-assist]').forEach((b) =>
      b.addEventListener('click', () => {
        this.prefs.aimAssist = b.dataset.assist === '1';
        this.applyPrefs();
        this.showMenu();
      }),
    );
    const sens = this.screen.querySelector<HTMLInputElement>('[data-sens]');
    sens?.addEventListener('input', () => {
      this.prefs.sens = Number(sens.value);
      this.applyPrefs();
      const o = this.screen.querySelector('output');
      if (o) o.textContent = this.prefs.sens.toFixed(1);
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
    this.show(`<div class="a-panel a-pause"><h2>일시정지</h2>
      <button class="a-btn-main" data-act="resume">계속하기</button>
      <button class="a-btn" data-act="restart">다시 시작</button>
      <button class="a-btn" data-act="quit">메뉴로</button></div>`);
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
      this.show(`<div class="a-panel a-result"><h2>작전 종료</h2>
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
        <button class="a-btn-main" data-act="again">다시 출격</button>
        <button class="a-btn" data-act="menu">메뉴로</button></div>`);
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
    if (r.wave < 4) return '숙이고 있으면 총에 맞지 않습니다. 재장전·체력 회복은 숙인 채로 하세요.';
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
    q('.a-score').textContent = h.score.toLocaleString();
    q('.a-wave').textContent = `웨이브 ${h.wave}`;
    q('.a-left').textContent = h.breakT > 0 ? '다음 웨이브 준비' : `남은 적 ${h.enemiesLeft}`;
    const combo = q('.a-combo');
    combo.textContent = h.combo > 1 ? `×${h.combo} 연속` : '';
    combo.style.opacity = h.combo > 1 ? String(Math.min(1, h.comboT * 2)) : '0';
    // 체력
    q('.a-hp b').style.transform = `scaleX(${Math.max(0, h.hp / 100).toFixed(3)})`;
    q('.a-hp em').textContent = String(Math.ceil(h.hp));
    q('.a-hp').classList.toggle('low', h.hp < 35);
    q('.a-hurt').style.opacity = String(Math.min(1, h.hurt * 0.85 + (h.hp < 35 ? 0.3 : 0)));
    q('.a-hurtdirs').innerHTML = h.hurtDirs.map((d) => `<i style="transform:translate(-50%,-50%) rotate(${d.toFixed(0)}deg)"></i>`).join('');
    // 무기
    q('.a-wname').textContent = h.weaponName;
    const ammo = q('.a-ammo');
    ammo.innerHTML = h.weapon === 'sniper' ? Array.from({ length: 5 }, (_, i) => `<i class="${i < h.inMag ? 'on' : ''}"></i>`).join('') : `<b>${h.inMag}</b> / ${h.reserve}`;
    q('.a-wstate').textContent = h.reloading >= 0 ? '재장전 중…' : h.bolting ? '장전' : h.inMag === 0 ? '탄 없음 – 재장전' : '';
    // 노출 표시
    const ex = q('.a-expose');
    ex.textContent = h.exposed === 'hidden' ? '숨음 – 안전' : h.exposed === 'peek' ? '고개만 내밈' : '노출됨';
    ex.className = `a-expose ${h.exposed}`;
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
    this.touch?.setState({ scoped: h.scopeT > 0.5, crouched: h.crouched, zoomLabel: `${h.zoom}×`, weapon: h.weapon === 'sniper' ? '기관총' : '저격총' });
    if (this.input.consume('pause') && now - this.pausedAt > 350) {
      if (g.paused) this.resume();
      else if (!g.over) this.pause();
    }
  }
}
