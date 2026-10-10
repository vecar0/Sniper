/**
 * UI 컨트롤러: 화면(메뉴·브리핑·일시정지·결과·설정) + HUD + 알림.
 * 모든 버튼은 실제 <button>이라 키보드(Tab/Enter)로도 조작할 수 있다.
 */
import { BALANCE } from '../config/balance';
import { DIFFICULTIES, type DifficultyId } from '../config/difficulty';
import { buildDailyMission, buildRangeMission, MISSIONS, todayKey, type MissionDef } from '../config/missions';
import * as THREE from 'three';
import { getWeapon, WEAPONS, type WeaponSpec } from '../config/weapons';
import { windClock } from '../ballistics/wind';
import type { AudioEngine } from '../audio/audio';
import { keyCodeLabel, type Input } from '../core/input';
import { ACTION_LABELS, DEFAULT_KEYS, type Action, type SaveStore, type Settings } from '../core/save';
import type { GameState } from '../core/stateMachine';
import type { Analysis } from '../game/analysis';
import type { Game, HitInfo, HudSnapshot, MissionResult, TagInfo } from '../game/game';
import { buildHuman, HumanMaterials } from '../game/models/human';
import { buildRifle } from '../game/models/rifle';
import { RifleState } from '../game/rifle';
import { atmosphereFor, THEMES } from '../game/themes';
import { PreviewStage } from './preview';
import { drawTacticalMap } from './tacmap';
import { ScopeOverlay } from './scope';
import { TouchControls } from './touch';

type ScreenName = 'menu' | 'missions' | 'briefing' | 'settings' | 'controls' | 'credits' | 'pause' | 'result' | 'none';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function formatTime(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

function stars(arr: boolean[]): string {
  return arr.map((v) => `<span class="star ${v ? 'on' : ''}" aria-hidden="true">★</span>`).join('');
}

export class UI {
  private readonly root: HTMLElement;
  private readonly game: Game;
  private readonly save: SaveStore;
  private readonly audio: AudioEngine;
  private readonly input: Input;
  private readonly screens: HTMLDivElement;
  private readonly hudEl: HTMLDivElement;
  private readonly scope: ScopeOverlay;
  private readonly touch: TouchControls | null;
  private readonly toastEl: HTMLDivElement;
  private readonly fadeEl: HTMLDivElement;
  private readonly flashEl: HTMLDivElement;
  private readonly rotateEl: HTMLDivElement;
  private screen: ScreenName = 'none';
  private settingsReturn: ScreenName = 'menu';
  private controlsReturn: ScreenName = 'menu';
  private briefingMission: MissionDef | null = null;
  private lastResult: MissionResult | null = null;
  private transitioning = false;
  private pausedAt = 0;
  private hudCache = new Map<string, string>();
  private hitTimer = 0;
  private analysisTimer = 0;
  private rangeTimer = 0;
  private alertTimer = 0;
  private rangeWind = { speed: 3, dir: 90 };
  private lastHover = 0;
  private dopeKey = '';
  private toastTimer: number | null = null;

  constructor(root: HTMLElement, game: Game, save: SaveStore, audio: AudioEngine, input: Input) {
    this.root = root;
    this.game = game;
    this.save = save;
    this.audio = audio;
    this.input = input;
    if (input.isTouch) document.body.classList.add('is-touch');

    this.hudEl = this.div('hud');
    this.hudEl.innerHTML = this.hudTemplate();
    this.scope = new ScopeOverlay(root);
    this.scope.setColor(save.data.settings.reticleColor);
    this.scope.showReadout = !input.isTouch;
    this.flashEl = this.div('flash');
    this.touch = input.isTouch ? new TouchControls(root, input) : null;
    if (this.touch) this.touch.onPause = () => this.pauseGame();
    this.screens = this.div('screens');
    this.toastEl = this.div('toast');
    this.toastEl.setAttribute('role', 'status');
    this.toastEl.setAttribute('aria-live', 'polite');
    this.fadeEl = this.div('fade');
    this.rotateEl = this.div('rotate');
    this.rotateEl.innerHTML = '<div class="rotate-icon" aria-hidden="true">⟳</div><p>화면을 가로로 돌려주세요</p><p class="muted">저격 조준을 위해 가로 화면이 필요합니다.</p>';
    this.setHudVisible(false);

    // 버튼 소리 + 오디오 잠금 해제
    this.screens.addEventListener('click', (e) => {
      this.audio.unlock();
      if ((e.target as HTMLElement).closest('button')) this.audio.play('uiClick');
    });
    this.screens.addEventListener('pointerover', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (b && !b.disabled && performance.now() - this.lastHover > 60) {
        this.lastHover = performance.now();
        this.audio.play('uiHover');
      }
    });
    window.addEventListener('pointerdown', () => this.audio.unlock(), { capture: true });
    window.addEventListener('keydown', () => this.audio.unlock(), { capture: true });

    // 게임 화면 클릭: 포인터 락이 없으면 먼저 락을 잡고 그 클릭은 발사로 쓰지 않는다
    const gameEl = document.getElementById('game')!;
    gameEl.addEventListener(
      'mousedown',
      (e) => {
        if (this.game.fsm.is('playing') && !this.input.pointerLocked && !this.input.isTouch && e.button === 0 && this.lockWanted) {
          this.input.requestPointerLock();
          this.lockWanted = false;
          e.stopPropagation();
        }
      },
      { capture: true },
    );

    input.onPointerLockChange = (locked) => {
      if (!locked && this.game.fsm.is('playing')) this.pauseGame();
      if (locked) this.lockWanted = false;
    };
    input.onKeyDown = (code, e) => this.onKey(code, e);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseGame();
        this.audio.suspend();
      } else this.audio.resume();
    });
    window.addEventListener('blur', () => this.pauseGame());
    window.addEventListener('resize', () => this.checkOrientation());
    this.checkOrientation();

    game.hooks = {
      onHint: (t) => this.setHint(t),
      onHit: (i) => this.showHit(i),
      onAnalysis: (a) => this.showAnalysis(a),
      onRangefinder: (d, ok) => this.showRange(d, ok),
      onAlert: (l) => this.showAlert(l),
      onToast: (t) => this.toast(t),
      onMissionEnd: (r) => this.onMissionEnd(r),
      onStateChange: (to, from) => this.onState(to, from),
      onMuzzleFlash: () => this.muzzleFlash(),
      onTag: (t) => this.showTag(t),
    };
    this.applySettings();
    const loop = () => {
      requestAnimationFrame(loop);
      this.frame();
    };
    requestAnimationFrame(loop);
  }

  /** 포인터 락이 풀린 채 플레이 중이면 다음 클릭에서 다시 잡는다 */
  private lockWanted = false;

  private div(cls: string): HTMLDivElement {
    const d = document.createElement('div');
    d.className = cls;
    this.root.appendChild(d);
    return d;
  }

  // ───────────────────────── 화면 전환 ─────────────────────────
  private fade(fn: () => void): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.fadeEl.classList.add('on');
    window.setTimeout(() => {
      fn();
      this.fadeEl.classList.remove('on');
      window.setTimeout(() => (this.transitioning = false), 180);
    }, 180);
  }

  private show(name: ScreenName, html = ''): void {
    this.disposePreviews();
    this.screen = name;
    // 휴대폰에는 키보드가 없으므로 "(Esc)" 같은 키 안내를 뺀다
    if (this.input.isTouch) html = html.replace(/ \((Esc|Enter|R)\)/g, '');
    this.screens.innerHTML = html;
    this.screens.className = `screens screen-${name}`;
    this.screens.style.display = name === 'none' ? 'none' : 'flex';
    const primary = this.screens.querySelector<HTMLButtonElement>('[data-primary]');
    if (primary && !this.input.isTouch) primary.focus({ preventScroll: true });
  }

  private bind(sel: string, fn: (el: HTMLElement) => void): void {
    this.screens.querySelectorAll<HTMLElement>(sel).forEach((el) => el.addEventListener('click', () => fn(el)));
  }

  showMenu(): void {
    const p = this.save.data.progress;
    const total = this.save.totalStars();
    const next = this.nextMission();
    const cleared = MISSIONS.filter((m) => p.missions[m.id]?.cleared).length;
    const primaryLabel = p.firstRun ? '자격 심사 시작' : next ? '이어하기' : '작전 목록';
    const primarySub = p.firstRun ? '처음이라면 여기서 시작하세요' : next ? `${next.codename} · ${next.name}` : '모든 작전 완료';
    const acc = p.stats.shots ? Math.round((p.stats.hits / p.stats.shots) * 100) : 0;
    const unlocked = WEAPONS.filter((w) => this.weaponUnlocked(w)).map((w) => w.name);
    const radio = [
      '[무전] 본부: 고스트-7, 다음 계약이 대기 중이다.',
      '[무전] 관측수: 오늘 계곡 바람이 심상치 않다. 깃발을 잘 봐라.',
      '[무전] 본부: 민간인 피해는 용납하지 않는다. 쏘기 전에 식별하라.',
      '[무전] 정비반: 소음기는 총성을 줄이지만 탄속이 조금 떨어진다.',
    ];
    this.show(
      'menu',
      `<div class="menu-layout">
        <div class="menu-left">
          <div class="brand">
            <span class="brand-tag">GHOST PROTOCOL <i>//</i> CONTRACT SNIPER</span>
            <h1>LONG SHOT</h1>
            <p class="tagline">바람을 읽고, 숨을 멈추고, 한 발로 끝낸다.</p>
          </div>
          <nav class="menu-list" aria-label="메인 메뉴">
            <button class="menu-item primary" data-primary data-go="next"><span class="mi-idx">01</span><span class="mi-text"><b>${esc(primaryLabel)}</b><small>${esc(primarySub)}</small></span><span class="mi-arrow" aria-hidden="true">›</span></button>
            <button class="menu-item" data-go="missions"><span class="mi-idx">02</span><span class="mi-text"><b>작전 목록</b><small>자격 심사 3 · 실전 작전 5</small></span><span class="mi-arrow" aria-hidden="true">›</span></button>
            <button class="menu-item" data-go="daily"><span class="mi-idx">03</span><span class="mi-text"><b>일일 계약</b><small>${esc(todayKey())} · 매일 바뀌는 표적</small></span><span class="mi-arrow" aria-hidden="true">›</span></button>
            <button class="menu-item" data-go="range"><span class="mi-idx">04</span><span class="mi-text"><b>사격장</b><small>100~1500m 자유 연습</small></span><span class="mi-arrow" aria-hidden="true">›</span></button>
            <div class="menu-row">
              <button class="btn ghost small" data-go="settings">설정</button>
              <button class="btn ghost small" data-go="controls">조작법</button>
              <button class="btn ghost small" data-go="credits">크레딧</button>
            </div>
          </nav>
        </div>
        <aside class="operator frame" aria-label="요원 기록">
          <header><span>OPERATOR FILE</span><span class="mono">GHOST-7</span></header>
          <div class="op-grid">
            <div><small>작전 진행</small><b class="mono">${cleared}<i>/${MISSIONS.length}</i></b></div>
            <div><small>확인 제거</small><b class="mono">${p.stats.kills}</b></div>
            <div><small>최장 명중</small><b class="mono">${p.stats.longestHit}<i>m</i></b></div>
            <div><small>명중률</small><b class="mono">${acc}<i>%</i></b></div>
          </div>
          <div class="op-bar"><i style="--v:${Math.round((cleared / MISSIONS.length) * 100)}%"></i></div>
          <div class="menu-foot"><span>★ ${total} / ${MISSIONS.length * 3}</span><span>헤드샷 ${p.stats.headshots}</span><span>플레이 ${Math.round(p.stats.playSeconds / 60)}분</span></div>
          <div class="op-gear"><small>지급 장비</small>${unlocked.map((n) => `<span class="chip">${esc(n)}</span>`).join('')}<span class="chip">소음기</span></div>
        </aside>
        <div class="radio" aria-hidden="true"><span>${esc(radio[Math.floor(Date.now() / 60000) % radio.length])}</span></div>
      </div>`,
    );
    this.bind('[data-go]', (el) => {
      const go = el.dataset.go;
      if (go === 'next') this.openBriefing(next ?? MISSIONS[0]);
      else if (go === 'missions') this.showMissions();
      else if (go === 'range') this.openBriefing(buildRangeMission(this.rangeWind.speed, this.rangeWind.dir));
      else if (go === 'daily') this.openBriefing(buildDailyMission(todayKey()));
      else if (go === 'settings') this.showSettings('menu');
      else if (go === 'controls') this.showControls('menu');
      else if (go === 'credits') this.showCredits();
    });
  }

  private missionUnlocked(i: number): boolean {
    if (i === 0) return true;
    return !!this.save.data.progress.missions[MISSIONS[i - 1].id]?.cleared;
  }

  private nextMission(): MissionDef | null {
    for (let i = 0; i < MISSIONS.length; i++) {
      if (!this.missionUnlocked(i)) return MISSIONS[Math.max(0, i - 1)];
      if (!this.save.data.progress.missions[MISSIONS[i].id]?.cleared) return MISSIONS[i];
    }
    return null;
  }

  showMissions(): void {
    const prog = this.save.data.progress.missions;
    const row = (m: MissionDef, i: number) => {
      const unlocked = this.missionUnlocked(i);
      const p = prog[m.id];
      const dists = m.targets.filter((t) => t.required).map((t) => t.dist);
      const range = `${Math.min(...dists)}${Math.max(...dists) !== Math.min(...dists) ? `~${Math.max(...dists)}` : ''}m`;
      return `<button class="mission-card ${unlocked ? '' : 'locked'} ${p?.cleared ? 'cleared' : ''}" data-mission="${i}" ${unlocked ? '' : 'disabled aria-disabled="true"'}>
        <span class="mc-num mono">${m.category === 'qualification' ? 'QUAL' : 'OP'}-${String(i + 1).padStart(2, '0')}</span>
        <span class="mc-code">${esc(m.codename)}</span>
        <span class="mc-name">${esc(m.name)}</span>
        <span class="mc-sub">${esc(m.subtitle)} · ${range}</span>
        <span class="mc-stars">${unlocked ? stars(p?.stars ?? [false, false, false]) : '🔒 이전 작전 완료 필요'}</span>
        ${p?.bestTime ? `<span class="mc-best mono">BEST ${formatTime(p.bestTime)}</span>` : ''}
        ${p?.cleared ? '<span class="mc-stamp">완료</span>' : ''}
      </button>`;
    };
    this.show(
      'missions',
      `<div class="panel wide frame">
        <div class="panel-head"><h2><span class="h-tag">OPERATIONS</span>작전 목록</h2><button class="btn small" data-back>뒤로 (Esc)</button></div>
        <div class="missions-cols">
          <div>
            <h3 class="sec">자격 심사 <small>강철판 · 기본기</small></h3>
            <div class="mission-grid">${MISSIONS.map((m, i) => (m.category === 'qualification' ? row(m, i) : '')).join('')}</div>
            <h3 class="sec">실전 작전 <small>표적 식별 · 암살</small></h3>
            <div class="mission-grid">${MISSIONS.map((m, i) => (m.category === 'operation' ? row(m, i) : '')).join('')}</div>
          </div>
          <aside class="mission-preview frame">
            <canvas class="tacmap" aria-label="전술 지도"></canvas>
            <div class="mp-info"></div>
          </aside>
        </div>
      </div>`,
    );
    this.bind('[data-back]', () => this.showMenu());
    this.bind('[data-mission]', (el) => this.openBriefing(MISSIONS[Number(el.dataset.mission)]));
    const map = this.screens.querySelector<HTMLCanvasElement>('.tacmap')!;
    const info = this.screens.querySelector<HTMLElement>('.mp-info')!;
    const preview = (i: number) => {
      const m = MISSIONS[i];
      drawTacticalMap(map, m);
      info.innerHTML = `<b>${esc(m.codename)}</b><p>${esc(m.briefing[0])}</p><small>${esc(THEMES[m.theme].name)} · ${esc(atmosphereFor(THEMES[m.theme], m.timeOfDay).timeName)} · 배울 것: ${esc(m.newSkill)}</small>`;
    };
    this.screens.querySelectorAll<HTMLElement>('[data-mission]').forEach((el) => {
      const i = Number(el.dataset.mission);
      el.addEventListener('pointerenter', () => preview(i));
      el.addEventListener('focus', () => preview(i));
    });
    const firstOpen = this.screens.querySelector<HTMLButtonElement>('.mission-card:not(.locked):not(.cleared)') ?? this.screens.querySelector<HTMLButtonElement>('.mission-card:not(.locked)');
    preview(Number(firstOpen?.dataset.mission ?? 0));
    if (firstOpen && !this.input.isTouch) firstOpen.focus({ preventScroll: true });
  }

  private openBriefing(m: MissionDef): void {
    this.briefingMission = m;
    this.game.loadMission(m);
    if (this.game.fsm.is('menu')) this.game.fsm.go('briefing');
    else if (this.game.fsm.is('result', 'paused')) this.game.toBriefing();
    this.renderBriefing();
  }

  private windDesc(m: MissionDef): string {
    const z = m.wind.zones[0];
    if (z.speed === 0 && m.wind.zones.length === 1) return '무풍';
    const strength = z.speed < 2 ? '약함' : z.speed < 4 ? '보통' : '강함';
    const zones = m.wind.zones.length > 1 ? ' · 구간별 상이' : '';
    const gust = m.wind.gusts ? ' · 돌풍' : '';
    return `${strength} · ${windClock(z.dir)}시 방향${zones}${gust}`;
  }

  private weaponUnlocked(w: WeaponSpec): boolean {
    return !w.unlockKey || this.save.totalStars() >= BALANCE.unlocks[w.unlockKey];
  }

  private weaponStats(w: WeaponSpec): { acc: number; power: number; bolt: number; recoil: number; e800: number } {
    const r = new RifleState(w);
    const row = r.dope(100, 15, 800).find((d) => d.range === 800);
    const e800 = row ? row.energy : 0;
    return {
      acc: Math.max(0.1, 1 - (w.ammo[0].dispersionMoa - 0.3) / 0.8),
      power: Math.min(1, e800 / 4000),
      bolt: Math.max(0.1, 1 - (w.boltTime - 0.5) / 1.0),
      recoil: Math.min(1, w.recoilKick / 14),
      e800,
    };
  }
  private renderBriefing(): void {
    const m = this.briefingMission!;
    const s = this.save.data.settings;
    const total = this.save.totalStars();
    const prog = this.save.data.progress.missions[m.id];
    const atmo = atmosphereFor(THEMES[m.theme], m.timeOfDay);
    const req = m.targets.filter((t) => t.required || m.isRange);
    const dists = req.map((t) => t.dist);
    const distText = m.noRangefinder ? '알 수 없음 (직접 측정)' : `약 ${Math.round(Math.min(...dists) / 10) * 10}${Math.max(...dists) - Math.min(...dists) > 20 ? `~${Math.round(Math.max(...dists) / 10) * 10}` : ''}m`;
    const people = m.targets.filter((t) => t.kind === 'person');
    const count = (r: string) => people.filter((t) => (t.role ?? 'guard') === r).length;
    const targetText = m.isRange
      ? '100~1500m 강철판 15개'
      : people.length
        ? [count('hvt') ? `핵심 ${count('hvt')}` : '', count('guard') ? `경비 ${count('guard')}` : '', count('civilian') ? `민간인 ${count('civilian')}` : ''].filter(Boolean).join(' · ') + ` · ${distText}`
        : `강철판 ${req.length}개 · ${distText}`;
    const diffs = (Object.keys(DIFFICULTIES) as DifficultyId[])
      .map((id) => {
        const d = DIFFICULTIES[id];
        const locked = d.unlockKey && total < BALANCE.unlocks[d.unlockKey];
        return `<button class="diff-btn ${s.difficulty === id && !locked ? 'selected' : ''}" data-diff="${id}" ${locked ? 'disabled aria-disabled="true"' : ''} aria-pressed="${s.difficulty === id}">${d.name}${locked ? ` <small>🔒★${BALANCE.unlocks[d.unlockKey!]}</small>` : ''}</button>`;
      })
      .join('');
    const weaponTabs = WEAPONS.map((w) => {
      const unlocked = this.weaponUnlocked(w);
      const locked = !unlocked || (m.weaponLock && m.weaponLock !== w.id);
      return `<button class="wtab" data-weapon="${w.id}" ${locked ? 'disabled aria-disabled="true"' : ''} title="${!unlocked && w.unlockKey ? `★ ${BALANCE.unlocks[w.unlockKey]}개 필요` : esc(w.description)}">${w.name}${!unlocked ? ' 🔒' : ''}</button>`;
    }).join('');
    const rangeControls = m.isRange
      ? `<div class="range-wind">
          <label>풍속 <output id="rw-s">${this.rangeWind.speed.toFixed(1)}</output> m/s<input type="range" id="rw-speed" min="0" max="10" step="0.5" value="${this.rangeWind.speed}"></label>
          <label>방향 <output id="rw-d">${windClock(this.rangeWind.dir)}시에서</output><input type="range" id="rw-dir" min="0" max="345" step="15" value="${this.rangeWind.dir}"></label>
        </div>`
      : '';
    const objectives = m.isRange
      ? '<li>목표 없음 – 자유롭게 연습하세요. 일시정지 메뉴에서 나갈 수 있습니다.</li>'
      : m.objectives.map((o, i) => `<li><span class="star ${prog?.stars[i] ? 'on' : ''}">★</span> ${esc(o.label)}</li>`).join('');
    const dossier = m.dossier
      ? `<div class="dossier frame">
          <header><span>TARGET DOSSIER</span><span class="stamp-red">CLASSIFIED</span></header>
          <div class="dossier-body">
            <canvas class="dossier-3d" aria-label="표적 외형"></canvas>
            <div class="dossier-info">
              <b>${esc(m.dossier.name)}</b><small>${esc(m.dossier.alias)}</small>
              <p>${esc(m.dossier.summary)}</p>
              <ul>${m.dossier.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
            </div>
          </div>
        </div>`
      : `<div class="dossier frame mini"><header><span>TARGET</span></header><p class="muted">${m.category === 'qualification' || m.isRange ? '강철판 표적 – 명중 시 초록색으로 바뀌고 탄흔이 남습니다.' : '경계병 – 소총과 조끼를 착용했습니다. 스코프로 관측해 식별하세요.'}</p></div>`;
    this.show(
      'briefing',
      `<div class="panel wide frame briefing">
        <div class="panel-head">
          <h2><span class="h-tag">${m.category === 'qualification' ? 'QUALIFICATION' : m.isRange ? 'RANGE' : m.category === 'contract' ? 'CONTRACT' : 'OPERATION'}</span>${esc(m.codename)} <small>${esc(m.name)}</small></h2>
          <div class="head-actions"><button class="btn small" data-back>뒤로 (Esc)</button><button class="btn primary start-btn" data-primary data-start>${this.input.isTouch ? '작전 개시' : '작전 개시 (Enter)'}</button></div>
        </div>
        <div class="brief-cols">
          <section class="brief-info">
            <h3 class="sec">INTEL</h3>
            ${m.briefing.map((b) => `<p class="brief-text">${esc(b.replace('{ammo}', `[${this.input.keyLabel('ammo')}]`))}</p>`).join('')}
            <div class="brief-new"><b>배울 것</b> ${esc(m.newSkill)}</div>
            <dl class="brief-env">
              <dt>지형</dt><dd>${atmo.name} · ${atmo.timeName}</dd>
              <dt>대기</dt><dd class="mono">ALT ${m.atmosphere.altitude}m · ${m.atmosphere.temperature}°C</dd>
              <dt>바람</dt><dd>${m.isRange ? '직접 설정' : this.windDesc(m)}</dd>
              <dt>표적</dt><dd>${targetText}</dd>
              <dt>탄약</dt><dd>${m.ammoTotal > 0 ? `${m.ammoTotal}발` : '무제한'}${m.timeLimit ? ` · 제한 ${formatTime(m.timeLimit)}` : ''}</dd>
            </dl>
            ${m.intel?.length ? `<ul class="intel">${m.intel.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
            ${rangeControls}
            <h3 class="sec">목표</h3>
            <ul class="objectives">${objectives}</ul>
          </section>
          <section class="brief-mid">
            <canvas class="tacmap" aria-label="전술 지도"></canvas>
            ${dossier}
          </section>
          <section class="brief-loadout">
            <h3 class="sec">LOADOUT</h3>
            <div class="weapon-stage frame"><canvas class="weapon-3d" aria-label="총기 미리보기"></canvas><div class="ws-name"></div></div>
            <div class="wtabs" role="group" aria-label="총기 선택">${weaponTabs}</div>
            <div class="wstats"></div>
            <button class="toggle ${s.suppressor ? 'on' : ''}" data-suppressor aria-pressed="${s.suppressor}"><span>소음기</span><small></small><i aria-hidden="true"></i></button>
            <h3 class="sec">난이도</h3>
            <div class="diff-row">${diffs}</div>
            <p class="muted diff-desc">${esc(DIFFICULTIES[s.difficulty].description)}</p>
          </section>
        </div>
      </div>`,
    );
    drawTacticalMap(this.screens.querySelector<HTMLCanvasElement>('.tacmap')!, m);
    this.bind('[data-back]', () => this.backFromBriefing());
    this.bind('[data-start]', () => this.startMission());
    this.bind('[data-weapon]', (el) => {
      s.weapon = el.dataset.weapon!;
      this.save.save();
      this.game.loadMission(m);
      this.refreshLoadout();
    });
    this.bind('[data-suppressor]', () => {
      s.suppressor = !s.suppressor;
      this.save.save();
      this.game.loadMission(m);
      this.refreshLoadout();
    });
    this.bind('[data-diff]', (el) => {
      s.difficulty = el.dataset.diff as DifficultyId;
      this.save.save();
      this.game.loadMission(m);
      this.screens.querySelectorAll<HTMLElement>('[data-diff]').forEach((b) => {
        const on = b.dataset.diff === s.difficulty;
        b.classList.toggle('selected', on);
        b.setAttribute('aria-pressed', String(on));
      });
      this.screens.querySelector('.diff-desc')!.textContent = DIFFICULTIES[s.difficulty].description;
    });
    const sp = this.screens.querySelector<HTMLInputElement>('#rw-speed');
    const dr = this.screens.querySelector<HTMLInputElement>('#rw-dir');
    if (sp && dr) {
      const upd = () => {
        this.rangeWind = { speed: Number(sp.value), dir: Number(dr.value) };
        this.screens.querySelector('#rw-s')!.textContent = this.rangeWind.speed.toFixed(1);
        this.screens.querySelector('#rw-d')!.textContent = `${windClock(this.rangeWind.dir)}시에서`;
      };
      sp.addEventListener('input', upd);
      dr.addEventListener('input', upd);
      const commit = () => {
        this.briefingMission = buildRangeMission(this.rangeWind.speed, this.rangeWind.dir);
        this.game.loadMission(this.briefingMission);
        drawTacticalMap(this.screens.querySelector<HTMLCanvasElement>('.tacmap')!, this.briefingMission);
      };
      sp.addEventListener('change', commit);
      dr.addEventListener('change', commit);
    }
    // 3D 미리보기(WebGL 실패 시 조용히 생략)
    try {
      const wc = this.screens.querySelector<HTMLCanvasElement>('.weapon-3d');
      if (wc) this.weaponStage = new PreviewStage(wc, { fov: 26, distance: 2.4, height: 0.35, lookY: 0, spin: 0.3 });
      const dc = this.screens.querySelector<HTMLCanvasElement>('.dossier-3d');
      if (dc && m.dossier) {
        this.dossierStage = new PreviewStage(dc, { fov: 28, distance: 4.2, height: 1.3, lookY: 1.0, spin: 0.5 });
        const mats = new HumanMaterials();
        const rig = buildHuman(m.dossier.outfit, mats);
        this.dossierStage.show(rig.root, () => mats.dispose());
      }
    } catch {
      /* 미리보기 없이 진행 */
    }
    this.refreshLoadout();
  }

  private weaponStage: PreviewStage | null = null;
  private dossierStage: PreviewStage | null = null;

  private disposePreviews(): void {
    this.weaponStage?.dispose();
    this.dossierStage?.dispose();
    this.weaponStage = null;
    this.dossierStage = null;
  }

  /** 장비 패널만 다시 그린다(3D 미리보기 컨텍스트를 재사용) */
  private refreshLoadout(): void {
    const m = this.briefingMission!;
    const s = this.save.data.settings;
    const wid = m.weaponLock ?? (this.weaponUnlocked(getWeapon(s.weapon)) ? s.weapon : 'r308');
    const w = getWeapon(wid);
    this.screens.querySelectorAll<HTMLElement>('[data-weapon]').forEach((b) => {
      const on = b.dataset.weapon === w.id;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
    });
    const st = this.weaponStats(w);
    const bar = (label: string, v: number, val: string) => `<div class="stat"><span>${label}</span><i style="--v:${Math.round(v * 100)}%"></i><em class="mono">${val}</em></div>`;
    const wstats = this.screens.querySelector<HTMLElement>('.wstats');
    if (wstats)
      wstats.innerHTML = `<p class="w-desc">${esc(w.caliber)} · ${esc(w.description)}</p>${bar('정확도', st.acc, `${w.ammo[0].dispersionMoa}MOA`)}${bar('위력', st.power, `${Math.round(st.e800)}J@800`)}${bar('볼트', st.bolt, `${w.boltTime}s`)}${bar('반동', st.recoil, `${w.recoilKick}`)}<p class="w-ammo">${w.ammo.map((a) => esc(a.name)).join(' / ')} · 탄창 ${w.magazine}발 · ${w.zoomMin}-${w.zoomMax}×</p>`;
    const sup = this.screens.querySelector<HTMLElement>('[data-suppressor]');
    if (sup) {
      sup.classList.toggle('on', s.suppressor);
      sup.setAttribute('aria-pressed', String(s.suppressor));
      sup.querySelector('small')!.textContent = s.suppressor ? '장착 – 총성 범위↓ · 섬광 없음 · 탄속 −1.5%' : '미장착 – 총성이 전장에 울린다';
    }
    const name = this.screens.querySelector<HTMLElement>('.ws-name');
    if (name) name.innerHTML = `<b>${esc(w.name)}</b><small class="mono">${esc(w.caliber)}${s.suppressor ? ' · SUPPRESSED' : ''}</small>`;
    if (this.weaponStage) {
      const rig = buildRifle(w, s.suppressor);
      rig.group.position.z = 0.2;
      rig.group.rotation.y = Math.PI / 2;
      const holder = new THREE.Group();
      holder.add(rig.group);
      this.weaponStage.show(holder, () => rig.dispose());
    }
  }
  private backFromBriefing(): void {
    this.game.toMenu();
    if (this.briefingMission && !this.briefingMission.isRange && !this.briefingMission.id.startsWith('daily-')) this.showMissions();
    else this.showMenu();
  }

  private startMission(): void {
    if (!this.briefingMission || this.transitioning) return;
    this.audio.unlock();
    // 포인터 락은 사용자 클릭 안에서 바로 요청해야 한다
    const ok = this.game.begin();
    if (!ok) return;
    this.enterFullscreen();
    this.show('none');
    this.setHudVisible(true);
    this.prepareHud();
  }

  /**
   * 휴대폰: 주소창·툴바가 화면 높이를 크게 잡아먹으므로 전체화면 + 가로 고정을 시도한다.
   * (안드로이드 크롬은 동작, 아이폰 사파리는 미지원 → '홈 화면에 추가'로 실행하면 전체화면)
   * 반드시 사용자 탭 안에서 호출해야 한다.
   */
  private iosTipShown = false;
  private enterFullscreen(): void {
    if (!this.input.isTouch || document.fullscreenElement || new URLSearchParams(location.search).has('test')) return;
    const el = document.documentElement;
    if (!el.requestFullscreen) {
      // 아이폰 사파리: 전체화면 API가 없다 → 홈 화면 앱으로 여는 방법을 한 번만 알려 준다
      const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
      if (standalone || this.iosTipShown) return;
      this.iosTipShown = true;
      setTimeout(() => this.toast('화면이 좁으면: 사파리 공유 버튼 → [홈 화면에 추가] 후 그 아이콘으로 실행하면 전체화면'), 2500);
      return;
    }
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
      .catch(() => undefined);
  }

  private prepareHud(): void {
    const h = this.game.hud();
    this.touch?.setAmmoVisible(h.canSwitchAmmo);
    this.touch?.setRangeVisible(h.rangefinderAllowed);
    this.hudCache.clear();
    this.hideTransient();
    // 키보드로 시작/재시작하면 포인터 락이 안 잡힐 수 있다 → 다음 클릭에서 잡는다
    this.lockWanted = !this.input.isTouch && !this.input.pointerLocked;
  }

  private hideTransient(): void {
    this.hitTimer = 0;
    this.analysisTimer = 0;
    this.rangeTimer = 0;
    this.alertTimer = 0;
    for (const sel of ['.hud-hit', '.hud-analysis', '.hud-range', '.hud-alert']) this.q(sel).classList.remove('show');
  }

  /** 일시정지 화면은 onState('paused')에서 그린다(키·포커스 상실·탭 전환 등 어떤 경로든 동일) */
  pauseGame(): void {
    if (!this.game.fsm.is('playing')) return;
    this.game.pause();
  }

  private renderPause(): void {
    const isRange = !!this.game.mission?.isRange;
    const m = this.game.mission;
    this.show(
      'pause',
      `<div class="panel narrow frame">
        <div class="panel-head"><h2><span class="h-tag">PAUSED</span>작전 일시중지</h2></div>
        <p class="muted mono">${esc(m?.codename ?? '')} · T+${formatTime(this.game.hud().time)}</p>
        <div class="menu-buttons">
          <button class="btn primary big" data-primary data-act="resume">계속 ${this.input.isTouch ? '' : '(Esc)'}</button>
          <button class="btn" data-act="restart">처음부터 다시 ${this.input.isTouch ? '' : '(R)'}</button>
          <button class="btn" data-act="settings">설정</button>
          <button class="btn" data-act="controls">조작법</button>
          <button class="btn danger" data-act="quit">${isRange ? '사격장 나가기' : '작전 포기'}</button>
        </div>
      </div>`,
    );
    this.bind('[data-act]', (el) => {
      const a = el.dataset.act;
      if (a === 'resume') this.resumeGame();
      else if (a === 'restart') this.restartGame();
      else if (a === 'settings') this.showSettings('pause');
      else if (a === 'controls') this.showControls('pause');
      else if (a === 'quit') {
        this.fade(() => {
          this.game.abandon();
          this.setHudVisible(false);
          this.showMenu();
        });
      }
    });
  }
  private resumeGame(): void {
    if (!this.game.fsm.is('paused')) return;
    if (this.portrait()) {
      this.toast('가로 화면에서 계속할 수 있습니다');
      return;
    }
    this.show('none');
    this.game.resume();
    this.lockWanted = !this.input.isTouch;
  }

  private restartGame(): void {
    this.show('none');
    this.setHudVisible(true);
    this.game.restart();
    this.prepareHud();
  }

  private onMissionEnd(r: MissionResult): void {
    this.lastResult = r;
    window.setTimeout(() => {
      this.setHudVisible(false);
      this.renderResult(r);
    }, 350);
  }

  private renderResult(r: MissionResult): void {
    const m = r.mission;
    const idx = MISSIONS.findIndex((x) => x.id === m.id);
    const next = r.success && idx >= 0 && idx + 1 < MISSIONS.length ? MISSIONS[idx + 1] : null;
    const acc = r.shots ? Math.round((r.hits / r.shots) * 100) : 0;
    const daily = m.id.startsWith('daily-');
    const analysis = r.lastAnalysis;
    const grade = ['D', 'C', 'B', 'A'][r.success ? r.stars.filter(Boolean).length : 0];
    this.show(
      'result',
      `<div class="panel result frame ${r.success ? 'win' : 'lose'}">
        <div class="aar-head"><span class="h-tag">AFTER ACTION REPORT</span><span class="mono">${esc(m.codename)}</span></div>
        <div class="aar-title">
          <h2>${r.success ? '임무 완수' : '임무 실패'}</h2>
          <span class="aar-stamp">${r.success ? 'MISSION COMPLETE' : 'MISSION FAILED'}</span>
          <span class="aar-grade mono" aria-label="평가 ${grade}">${grade}</span>
        </div>
        ${r.failReason ? `<p class="fail-reason">${esc(r.failReason)}</p>` : ''}
        <div class="result-stars" aria-label="별 ${r.stars.filter(Boolean).length}개">${r.stars.map((v, i) => `<span class="star big ${v ? 'pending' : ''}" data-i="${i}">★</span>`).join('')}</div>
        <ul class="objectives">${r.objectives.map((o, i) => `<li class="${o.done ? 'done' : ''}"><span class="check">${o.done ? '✔' : '✖'}</span> ${esc(o.label)} ${r.prevStars[i] && !o.done ? '<small class="muted">(이전에 달성)</small>' : ''}</li>`).join('')}</ul>
        <div class="result-stats">
          <div><b class="mono">${formatTime(r.time)}</b><span>작전 시간${r.newBestTime ? ' · 신기록' : ''}</span></div>
          <div><b class="mono">${r.hits}/${r.shots}</b><span>명중 (${acc}%)</span></div>
          <div><b class="mono">${r.kills}</b><span>제거</span></div>
          <div><b class="mono">${r.headshots}</b><span>헤드샷</span></div>
          <div><b class="mono">${Math.round(r.longest)}m</b><span>최장 명중</span></div>
          ${daily ? `<div><b class="mono">${r.score}</b><span>점수 (오늘 최고 ${r.bestScore})</span></div>` : ''}
        </div>
        ${r.unlocked.length ? `<div class="unlocks">${r.unlocked.map((u) => `<p>🔓 ${esc(u)}</p>`).join('')}</div>` : ''}
        ${r.tip ? `<div class="tip"><b>다음엔 이렇게</b> ${esc(r.tip)}</div>` : ''}
        ${analysis && !r.success ? `<details class="analysis-details"><summary>마지막 빗나간 탄 분석</summary>${analysis.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</details>` : ''}
        <div class="menu-buttons row-buttons">
          ${next ? `<button class="btn primary big" data-primary data-act="next">다음 작전 ${this.input.isTouch ? '' : '(Enter)'}</button>` : ''}
          <button class="btn ${next ? '' : 'primary big'}" ${next ? '' : 'data-primary'} data-act="retry">다시 하기 ${this.input.isTouch ? '' : '(R)'}</button>
          <button class="btn" data-act="missions">${daily ? '메인 메뉴' : '작전 목록'}</button>
        </div>
      </div>`,
    );
    // 별 연출: 하나씩 켜지며 소리
    const pend = Array.from(this.screens.querySelectorAll<HTMLElement>('.star.pending'));
    pend.forEach((el, i) => {
      window.setTimeout(() => {
        el.classList.remove('pending');
        el.classList.add('on', 'pop');
        this.audio.play('star', { pitch: 1 + i * 0.12 });
      }, 400 + i * 320);
    });
    this.bind('[data-act]', (el) => {
      const a = el.dataset.act;
      if (a === 'next' && next) this.fade(() => this.openBriefing(next));
      else if (a === 'retry') this.restartGame();
      else if (a === 'missions')
        this.fade(() => {
          this.game.toMenu();
          if (daily) this.showMenu();
          else this.showMissions();
        });
    });
  }
  showSettings(ret: ScreenName): void {
    this.settingsReturn = ret;
    const s = this.save.data.settings;
    const slider = (id: keyof Settings, label: string, min: number, max: number, step: number, fmt: (v: number) => string) =>
      `<label class="set-row"><span>${label}</span><input type="range" data-set="${id}" min="${min}" max="${max}" step="${step}" value="${s[id] as number}"><output>${fmt(s[id] as number)}</output></label>`;
    const toggle = (id: keyof Settings, label: string) =>
      `<label class="set-row"><span>${label}</span><input type="checkbox" data-set="${id}" ${s[id] ? 'checked' : ''}><i class="switch" aria-hidden="true"></i></label>`;
    const select = (id: keyof Settings, label: string, opts: [string, string][]) =>
      `<label class="set-row"><span>${label}</span><select data-set="${id}">${opts.map(([v, l]) => `<option value="${v}" ${s[id] === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const mul = (v: number) => `${v.toFixed(1)}×`;
    const keys = (Object.keys(ACTION_LABELS) as Action[])
      .map((a) => `<div class="key-row"><span>${ACTION_LABELS[a]}</span><button class="btn small key-btn" data-key="${a}">${keyCodeLabel(s.keys[a])}</button></div>`)
      .join('');
    const st = this.save.data.progress.stats;
    this.show(
      'settings',
      `<div class="panel wide settings">
        <div class="panel-head"><h2>설정</h2><button class="btn small" data-primary data-back>완료 (Esc)</button></div>
        <div class="settings-cols">
          <section><h3>소리</h3>
            ${slider('masterVolume', '전체 볼륨', 0, 1, 0.05, pct)}
            ${slider('sfxVolume', '효과음', 0, 1, 0.05, pct)}
            ${slider('musicVolume', '음악', 0, 1, 0.05, pct)}
            ${toggle('muted', '음소거')}
          <h3>조작</h3>
            ${slider('mouseSensitivity', '마우스 감도', 0.2, 3, 0.1, mul)}
            ${slider('scopedSensitivity', '스코프 감도', 0.2, 3, 0.1, mul)}
            ${slider('touchSensitivity', '터치 감도', 0.2, 3, 0.1, mul)}
            ${toggle('invertY', 'Y축 반전')}
            ${select('breathMode', '숨 참기', [['hold', '누르고 있기'], ['toggle', '한 번 눌러 전환']])}
            ${select('scopeMode', '스코프', [['toggle', '한 번 눌러 전환'], ['hold', '누르고 있기']])}
          </section>
          <section><h3>화면</h3>
            ${select('quality', '그래픽 품질', [['auto', '자동'], ['high', '높음'], ['medium', '중간'], ['low', '낮음']])}
            ${select('reticleColor', '레티클 색', [['black', '검정'], ['red', '빨강'], ['lime', '연두'], ['white', '흰색']])}
            ${select('bulletCam', '불릿캠', [['final', '마지막 결정타만'], ['always', '처치할 때마다'], ['off', '끄기']])}
            ${toggle('screenShake', '화면 흔들림')}
          <h3>접근성</h3>
            ${toggle('reduceFlashes', '섬광 효과 줄이기')}
            ${toggle('showHints', '도움말 표시')}
          <h3>데이터</h3>
            <p class="muted small-text">총 ${st.shots}발 · 명중 ${st.hits} · 처치 ${st.kills} · 헤드샷 ${st.headshots} · 플레이 ${Math.round(st.playSeconds / 60)}분</p>
            <button class="btn small danger" data-reset>진행 기록 초기화</button>
          </section>
          <section class="keys-section"><h3>키 설정 ${this.input.isTouch ? '<small class="muted">(키보드 연결 시)</small>' : ''}</h3>
            ${keys}
            <button class="btn small" data-keyreset>키 기본값 복원</button>
            <p class="muted small-text">Esc는 항상 일시정지, 마우스 휠은 배율 조절입니다.</p>
          </section>
        </div>
      </div>`,
    );
    this.bind('[data-back]', () => this.leaveSettings());
    this.screens.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-set]').forEach((el) => {
      el.addEventListener('input', () => {
        const id = el.dataset.set as keyof Settings;
        const rec = s as unknown as Record<string, unknown>;
        if (el instanceof HTMLInputElement && el.type === 'checkbox') rec[id] = el.checked;
        else if (el instanceof HTMLInputElement && el.type === 'range') {
          rec[id] = Number(el.value);
          const out = el.parentElement?.querySelector('output');
          if (out) out.textContent = id.toLowerCase().includes('volume') ? pct(Number(el.value)) : mul(Number(el.value));
        } else rec[id] = el.value;
        this.applySettings();
        this.save.save();
      });
    });
    this.bind('[data-key]', (el) => {
      const action = el.dataset.key as Action;
      el.textContent = '키를 누르세요…';
      el.classList.add('listening');
      this.input.captureKey((code) => {
        if (code === 'Escape') {
          this.showSettings(this.settingsReturn);
          return;
        }
        // 같은 키를 쓰던 다른 행동과 서로 바꾼다(충돌 방지)
        const other = (Object.keys(s.keys) as Action[]).find((a) => a !== action && s.keys[a] === code);
        if (other) s.keys[other] = s.keys[action];
        s.keys[action] = code;
        this.input.setKeys(s.keys);
        this.save.save();
        this.showSettings(this.settingsReturn);
        if (other) this.toast(`'${ACTION_LABELS[other]}'와(과) 키를 서로 바꿨습니다`);
      });
    });
    this.bind('[data-keyreset]', () => {
      s.keys = { ...DEFAULT_KEYS };
      this.input.setKeys(s.keys);
      this.save.save();
      this.showSettings(this.settingsReturn);
    });
    this.bind('[data-reset]', () =>
      this.confirm('진행 기록(별·최고 기록·통계)을 모두 지울까요? 설정은 유지됩니다.', () => {
        this.save.resetProgress();
        this.toast('진행 기록을 초기화했습니다');
        this.showSettings(this.settingsReturn);
      }),
    );
  }

  private leaveSettings(): void {
    this.input.cancelCapture();
    if (this.settingsReturn === 'pause') this.renderPause();
    else this.showMenu();
  }

  private applySettings(): void {
    const s = this.save.data.settings;
    this.audio.setVolumes(s.masterVolume, s.sfxVolume, s.musicVolume, s.muted);
    this.input.setKeys(s.keys);
    this.scope.setColor(s.reticleColor);
    const q = s.quality === 'auto' ? this.game.qualityLevel : s.quality;
    if (q !== this.game.qualityLevel) this.game.setQuality(q);
    document.body.classList.toggle('reduce-flash', s.reduceFlashes);
  }

  private confirm(text: string, yes: () => void): void {
    const overlay = document.createElement('div');
    overlay.className = 'confirm';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `<div class="panel narrow"><p>${esc(text)}</p><div class="row"><button class="btn danger" data-yes>예</button><button class="btn primary" data-no>아니요</button></div></div>`;
    this.root.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('[data-yes]')!.addEventListener('click', () => {
      close();
      yes();
    });
    overlay.querySelector('[data-no]')!.addEventListener('click', close);
    overlay.querySelector<HTMLButtonElement>('[data-no]')!.focus();
  }

  showControls(ret: ScreenName): void {
    this.controlsReturn = ret;
    const k = (a: Action) => `<kbd>${keyCodeLabel(this.save.data.settings.keys[a])}</kbd>`;
    this.show(
      'controls',
      `<div class="panel wide">
        <div class="panel-head"><h2>조작법과 사격 요령</h2><button class="btn small" data-primary data-back>뒤로 (Esc)</button></div>
        <div class="controls-cols">
          <section><h3>키보드 · 마우스</h3>
            <table class="keys-table">
              <tr><td>조준</td><td>마우스 이동</td></tr>
              <tr><td>스코프</td><td>${k('scope')}</td></tr>
              <tr><td>배율</td><td>마우스 휠 / ${k('zoomIn')} ${k('zoomOut')}</td></tr>
              <tr><td>숨 참기</td><td>${k('breath')} 또는 <kbd>Space</kbd></td></tr>
              <tr><td>발사</td><td>${k('fire')}</td></tr>
              <tr><td>위아래 보정 ▲▼</td><td>${k('elevUp')} ${k('elevDown')} (누르고 있으면 연속)</td></tr>
              <tr><td>좌우 보정 ◀▶</td><td>${k('windLeft')} ${k('windRight')}</td></tr>
              <tr><td>보정 0으로</td><td>${k('turretReset')}</td></tr>
              <tr><td>거리측정기</td><td>${k('rangefinder')}</td></tr>
              <tr><td>보정표</td><td>${k('dope')}</td></tr>
              <tr><td>탄종 변경</td><td>${k('ammo')}</td></tr>
              <tr><td>재시작</td><td>${k('restart')} 길게</td></tr>
              <tr><td>일시정지</td><td><kbd>Esc</kbd> / ${k('pause')}</td></tr>
            </table>
            <h3>터치</h3>
            <p class="small-text">빈 곳을 드래그해 조준 · 두 손가락으로 벌려 배율 조절 · 오른쪽 아래 [발사] · 왼쪽 아래 [숨] · 왼쪽 십자 버튼(▲▼◀▶)으로 보정</p>
          </section>
          <section><h3>사격 요령</h3>
            <ol class="howto">
              <li><b>찾기</b> – 스코프로 사람을 1초 보면 누구인지(표적·경비·민간인) 표시됩니다.</li>
              <li><b>거리 재기</b> – [거리] 버튼. 훈련병 난이도는 이때 보정이 <b>자동</b>으로 맞춰집니다.</li>
              <li><b>위아래 보정</b> – 멀수록 탄이 떨어집니다. [표]의 그 거리 "▲ 누를 횟수"만큼 ▲를 누르세요. (1번 = 100m에서 1cm)</li>
              <li><b>바람</b> – 깃발이 많이 펄럭일수록 센 바람. 바람이 오는 쪽으로 조금 옮겨 겨누세요.</li>
              <li><b>움직이는 표적</b> – 탄이 가는 동안 표적도 걷습니다. 걷는 방향 앞을 겨누세요.</li>
              <li><b>쏘기</b> – [숨]을 누르고 있으면 흔들림이 80% 줄어듭니다. 멈춘 순간 발사. 너무 오래 참으면 오히려 흔들립니다.</li>
              <li><b>빗나가면</b> – 아래 카드가 "몇 cm 빗나갔고 ▲를 몇 번 누르라"고 알려줍니다. 빛나는 탄 궤적과 탄착 표시도 보세요.</li>
            </ol>
            <h3>판정</h3>
            <p class="small-text">사람: 머리·흉부·복부 명중 시 무력화, 팔·다리는 부상(경계 후 도주). 총성은 음속(343m/s)으로 퍼져 다른 사람이 듣고 반응한다.</p>
            <h3>식별과 은밀성</h3>
            <p class="small-text">스코프로 사람을 1초 관측하거나 레이저로 조사하면 식별 태그(핵심 표적·경비·민간인)가 붙습니다. <b>민간인을 쏘면 작전 실패</b>입니다. 쓰러진 사람은 그 자리에 남고, 근처(14m)를 지나는 사람이 발견하면 경보를 울립니다.</p>
            <p class="small-text">총성이 들리는 범위: 일반탄 = 전체 · 일반탄+소음기 = 400m(반응 느림) · 아음속탄 = 250m · 아음속탄+소음기 = 없음.</p>
          </section>
        </div>
      </div>`,
    );
    this.bind('[data-back]', () => (this.controlsReturn === 'pause' ? this.renderPause() : this.showMenu()));
  }

  showCredits(): void {
    this.show(
      'credits',
      `<div class="panel narrow frame credits">
        <div class="panel-head"><h2><span class="h-tag">CREDITS</span>크레딧</h2><button class="btn small" data-primary data-back>뒤로 (Esc)</button></div>
        <p><b>LONG SHOT</b> v2.0 – Ghost Protocol</p>
        <p>기획 · 개발: vecar0 with Claude Code</p>
        <h3 class="sec">기술</h3>
        <p>Three.js (MIT) · TypeScript · Vite · Rajdhani / Share Tech Mono 글꼴 (SIL OFL)</p>
        <h3 class="sec">그래픽 · 사운드</h3>
        <p>모든 3D 모델, 효과음, 배경음은 코드로 실시간 생성했습니다. 외부 이미지·음원을 사용하지 않았습니다.</p>
        <h3 class="sec">탄도 모델</h3>
        <p>G7 표준 항력 함수, ICAO 표준 대기, Litz 스핀 드리프트 근사식. 게임용 근사치이며 실제 사격에 사용하지 마세요.</p>
        <p class="muted">이 게임은 허구의 이야기이며 실존 인물·단체와 관계가 없습니다. 유혈 표현은 없습니다.</p>
      </div>`,
    );
    this.bind('[data-back]', () => this.showMenu());
  }
  private onKey(code: string, e: KeyboardEvent): boolean {
    const st = this.game.fsm.state;
    if (document.querySelector('.confirm')) {
      if (code === 'Escape') document.querySelector('.confirm')?.remove();
      return true;
    }
    if (st === 'playing') return false;
    const keys = this.save.data.settings.keys;
    const back = code === 'Escape';
    if (this.screen === 'pause') {
      if (back || code === keys.pause) {
        if (performance.now() - this.pausedAt > 350) this.resumeGame();
        return true;
      }
      if (code === keys.restart) {
        this.restartGame();
        return true;
      }
      return false;
    }
    if (this.screen === 'result') {
      if (code === 'Enter') {
        e.preventDefault();
        this.screens.querySelector<HTMLButtonElement>('[data-primary]')?.click();
        return true;
      }
      if (code === keys.restart) {
        this.restartGame();
        return true;
      }
      if (back) {
        this.screens.querySelector<HTMLButtonElement>('[data-act="missions"]')?.click();
        return true;
      }
      return false;
    }
    if (this.screen === 'briefing') {
      if (code === 'Enter' && !(e.target instanceof HTMLButtonElement && !e.target.dataset.start)) {
        e.preventDefault();
        this.startMission();
        return true;
      }
      if (back) {
        this.backFromBriefing();
        return true;
      }
      return false;
    }
    if (back) {
      if (this.screen === 'settings') this.leaveSettings();
      else if (this.screen === 'controls') this.controlsReturn === 'pause' ? this.renderPause() : this.showMenu();
      else if (this.screen === 'missions' || this.screen === 'credits') this.showMenu();
      return true;
    }
    return false;
  }

  private onState(to: GameState, _from: GameState): void {
    this.touch?.setVisible(to === 'playing');
    if (to === 'paused') {
      this.pausedAt = performance.now();
      this.renderPause();
    }
    if (to !== 'playing') this.q('.hud-dope').classList.remove('show');
  }

  // ───────────────────────── 화면 방향 ─────────────────────────
  private portrait(): boolean {
    return this.input.isTouch && window.innerHeight > window.innerWidth;
  }

  private checkOrientation(): void {
    const p = this.portrait();
    this.rotateEl.classList.toggle('show', p);
    if (p) this.pauseGame();
  }

  // ───────────────────────── HUD ─────────────────────────
  private hudTemplate(): string {
    return `
      <div class="hud-vignette" aria-hidden="true"></div>
      <div class="hud-tl frame-lite">
        <div class="hud-code mono"></div>
        <div class="hud-mission"></div>
        <div class="hud-targets"></div>
        <div class="hud-time mono"></div>
      </div>
      <canvas class="hud-compass" width="440" height="40" aria-hidden="true"></canvas>
      <div class="hud-tr"><button class="hud-pause" aria-label="일시정지">II</button></div>
      <div class="hud-hint" role="status" aria-live="polite"></div>
      <div class="hud-alert" role="alert"></div>
      <div class="hud-cross" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="hud-hit"><b></b><span></span></div>
      <div class="hud-range mono"></div>
      <div class="hud-analysis"><div class="ha-lines"></div><div class="ha-tip"></div></div>
      <div class="hud-bl">
        <canvas class="hud-winddial" width="72" height="72" aria-hidden="true"></canvas>
        <div class="hud-wind"></div>
      </div>
      <div class="hud-br frame-lite">
        <div class="hud-weapon"><b class="hw-name"></b><span class="hw-sup">SUPPRESSED</span></div>
        <div class="hud-turret mono"><span class="ht-e"></span><span class="ht-w"></span><span class="hud-zoom"></span></div>
        <div class="hud-ammo"><span class="ha-pips"></span><b class="ha-count mono"></b><span class="ha-name"></span></div>
        <span class="ha-status"></span>
      </div>
      <div class="hud-breath"><span class="hb-label"></span><i></i></div>
      <div class="hud-restart"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" /></svg><span>재시작</span></div>
      <div class="hud-dope"></div>
      <div class="hud-cam"><span>불릿캠 · 클릭하면 건너뜀</span></div>
      <div class="hud-lock">화면을 클릭하면 마우스가 고정됩니다</div>
      <div class="hud-markers" aria-hidden="true"></div>
      <div class="hud-impact" aria-hidden="true"><i></i><span>탄착</span></div>`;
  }
  private q(sel: string): HTMLElement {
    return this.hudEl.querySelector<HTMLElement>(sel)!;
  }

  private setText(sel: string, text: string): void {
    if (this.hudCache.get(sel) === text) return;
    this.hudCache.set(sel, text);
    this.q(sel).textContent = text;
  }

  private setHudVisible(v: boolean): void {
    this.hudEl.style.display = v ? 'block' : 'none';
    if (!v) this.scope.el.style.display = 'none';
    if (v) {
      const pb = this.q('.hud-pause');
      pb.onclick = () => this.pauseGame();
    }
  }

  private frame(): void {
    const st = this.game.fsm.state;
    if (st !== 'playing' && st !== 'paused') return;
    const h = this.game.hud();
    this.updateHud(h);
    this.scope.update(h);
    const dt = 1 / 60;
    if (st === 'playing') {
      if (this.hitTimer > 0 && (this.hitTimer -= dt) <= 0) this.q('.hud-hit').classList.remove('show');
      if (this.analysisTimer > 0 && (this.analysisTimer -= dt) <= 0) {
        this.q('.hud-analysis').classList.remove('show');
        this.hudEl.classList.remove('has-analysis');
      }
      if (this.rangeTimer > 0 && (this.rangeTimer -= dt) <= 0) this.q('.hud-range').classList.remove('show');
      if (this.alertTimer > 0 && (this.alertTimer -= dt) <= 0) this.q('.hud-alert').classList.remove('show');
    }
  }

  private lastCompass = '';
  private lastDial = '';

  private updateHud(h: HudSnapshot): void {
    const m = this.game.mission;
    this.setText('.hud-code', m ? `${m.codename}` : '');
    this.setText('.hud-mission', h.missionName);
    this.setText('.hud-targets', h.isRange ? `${h.weaponName} · 자유 연습` : `◆ 표적 ${h.targetsTotal - h.targetsLeft} / ${h.targetsTotal}`);
    const timeText = h.timeLimit > 0 ? `T−${formatTime(h.timeLimit - h.time)}` : `T+${formatTime(h.time)}`;
    this.setText('.hud-time', timeText);
    this.q('.hud-time').classList.toggle('danger', h.timeLimit > 0 && h.timeLimit - h.time < 20);
    // 보정은 버튼 누른 횟수(칸)로 보여준다: ▲▼ 위아래, ◀▶ 좌우
    const ec = Math.round(h.elev * 10);
    const wc = Math.round(h.wind * 10);
    this.setText('.ht-e', `▲▼ ${ec}칸`);
    this.setText('.ht-w', wc === 0 ? '◀▶ 0칸' : `${wc > 0 ? '▶' : '◀'} ${Math.abs(wc)}칸`);
    this.setText('.hud-zoom', `${h.zoom.toFixed(1)}×`);
    this.setText('.hw-name', h.weaponName);
    this.q('.hw-sup').style.display = h.suppressor ? '' : 'none';
    const reserve = h.reserve === Infinity ? '∞' : String(h.reserve);
    this.setText('.ha-count', `${h.inMag} | ${reserve}`);
    const pipKey = `${h.inMag}`;
    if (this.hudCache.get('pips') !== pipKey) {
      this.hudCache.set('pips', pipKey);
      this.q('.ha-pips').innerHTML = Array.from({ length: Math.min(10, h.inMag) }, () => '<i></i>').join('');
    }
    this.setText('.ha-name', h.ammoName);
    this.setText('.ha-status', h.status);
    this.q('.ha-status').classList.toggle('warn', h.status !== '장전됨');
    this.q('.ha-name').classList.toggle('sub', h.subsonic);
    const wind = this.q('.hud-wind');
    if (h.windText) {
      this.setText('.hud-wind', h.windText);
      wind.style.display = '';
    } else wind.style.display = 'none';
    this.drawWindDial(h);
    this.drawCompass(h);
    const breath = this.q('.hud-breath');
    const showBreath = h.scopeT > 0.5 || h.breath < 0.999 || h.holding;
    breath.classList.toggle('show', showBreath);
    breath.classList.toggle('holding', h.holding);
    breath.classList.toggle('exhausted', h.exhausted);
    (breath.querySelector('i') as HTMLElement).style.transform = `scaleX(${h.breath.toFixed(3)})`;
    this.setText('.hb-label', `${h.exhausted ? '호흡 회복 중' : h.holding ? '숨 참는 중' : '호흡'} · ♥ ${Math.round(h.heartRate)}`);
    this.q('.hud-cross').style.display = h.scopeT < 0.3 && !h.bulletCam ? '' : 'none';
    this.hudEl.classList.toggle('scoped', h.scopeT > 0.5);
    this.hudEl.classList.toggle('cam', h.bulletCam);
    const rs = this.q('.hud-restart');
    rs.classList.toggle('show', h.restartProgress > 0.05);
    (rs.querySelector('circle') as SVGCircleElement).style.strokeDashoffset = String(94.2 * (1 - Math.min(1, h.restartProgress)));
    this.updateMarkers();
    const imp = this.q('.hud-impact');
    if (h.impact) {
      imp.style.display = '';
      imp.style.transform = `translate(${h.impact.x.toFixed(1)}px, ${h.impact.y.toFixed(1)}px)`;
      imp.style.opacity = String(Math.max(0, Math.min(1, h.impact.fade)));
      imp.classList.toggle('hit', h.impact.hit);
    } else imp.style.display = 'none';
    this.q('.hud-lock').classList.toggle('show', this.lockWanted && !this.input.pointerLocked && this.game.fsm.is('playing'));
    // 탄도표
    const dope = this.q('.hud-dope');
    dope.classList.toggle('show', h.dopeOpen);
    if (h.dopeOpen) {
      const key = `${h.weaponName}:${h.ammoName}:${h.suppressor}:${this.game.mission?.id}`;
      if (key !== this.dopeKey) {
        this.dopeKey = key;
        const rows = this.game.dopeRows();
        const mm = this.game.mission!;
        dope.innerHTML = `<div class="dope-head"><span class="h-tag">보정표</span><b>${esc(h.weaponName)}</b> · ${esc(h.ammoName)}${h.suppressor ? ' · 소음기' : ''}<br><small>표적 거리를 찾아 ▲를 그 횟수만큼 누르세요. 바람이 불면 바람 1m/s당 횟수 × 풍속만큼 바람 오는 쪽(◀ 또는 ▶)으로.</small></div>
          <table class="mono"><thead><tr><th>거리</th><th>▲ 누를 횟수</th><th>바람 1m/s당 ◀▶</th><th>탄 도착</th></tr></thead><tbody>
          ${rows.map((r) => `<tr><td>${r.range}m</td><td>${Math.round(r.elevationMil * 10)}</td><td>${(r.windPerMpsMil * 10).toFixed(1)}</td><td>${r.time.toFixed(2)}초</td></tr>`).join('')}
          </tbody></table><div class="dope-foot">${this.input.isTouch ? '[표] 버튼으로 닫기' : `[${this.input.keyLabel('dope')}] 닫기`} · 1칸 = 0.1mil = 100m에서 1cm · 영점 100m · 고도 ${mm.atmosphere.altitude}m · ${mm.atmosphere.temperature}°C</div>`;
      }
    }
  }

  /** 상단 나침반: 시선 방위 눈금 + 식별된 사람 방위 표시 */
  private drawCompass(h: HudSnapshot): void {
    const key = `${h.heading.toFixed(1)}|${h.bearings.map((b) => `${b.bearing.toFixed(1)}${b.role}${b.down}`).join(',')}|${h.scopeT > 0.5}`;
    if (key === this.lastCompass) return;
    this.lastCompass = key;
    const c = this.q('.hud-compass') as HTMLCanvasElement;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const W = c.width;
    const H = c.height;
    ctx.clearRect(0, 0, W, H);
    const span = 90; // 보이는 각도 범위
    const pxPerDeg = W / span;
    const x0 = W / 2;
    ctx.font = '600 12px "Share Tech Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    const names: Record<number, string> = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let d = Math.floor(h.heading - span / 2); d <= h.heading + span / 2; d++) {
      const dd = ((d % 360) + 360) % 360;
      const x = x0 + (d - h.heading) * pxPerDeg;
      const fade = 1 - Math.abs(x - x0) / (W / 2);
      if (dd % 5 !== 0) continue;
      ctx.strokeStyle = `rgba(230,236,228,${0.25 + fade * 0.55})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, H - 4);
      ctx.lineTo(x, H - (dd % 15 === 0 ? 14 : 8));
      ctx.stroke();
      if (dd % 15 === 0) {
        ctx.fillStyle = names[dd] ? `rgba(232,163,61,${0.4 + fade * 0.6})` : `rgba(230,236,228,${0.3 + fade * 0.6})`;
        ctx.fillText(names[dd] ?? String(dd).padStart(3, '0'), x, H - 18);
      }
    }
    // 표적 방위
    for (const b of h.bearings) {
      let rel = b.bearing - h.heading;
      rel = ((rel + 540) % 360) - 180;
      const clamped = Math.max(-span / 2 + 2, Math.min(span / 2 - 2, rel));
      const x = x0 + clamped * pxPerDeg;
      ctx.fillStyle = b.down ? 'rgba(160,160,160,0.6)' : b.role === 'hvt' ? '#ff5a4a' : b.role === 'civilian' ? '#6cb4ff' : '#e8a33d';
      ctx.beginPath();
      ctx.moveTo(x, H - 2);
      ctx.lineTo(x - 4, H - 8);
      ctx.lineTo(x + 4, H - 8);
      ctx.closePath();
      ctx.fill();
    }
    // 중앙 지시선 + 현재 방위
    ctx.fillStyle = '#e8a33d';
    ctx.fillRect(x0 - 1, H - 16, 2, 14);
    ctx.fillStyle = 'rgba(10,14,16,0.75)';
    ctx.fillRect(x0 - 22, 0, 44, 14);
    ctx.fillStyle = '#f2f4ee';
    ctx.fillText(String(Math.round(h.heading) % 360).padStart(3, '0'), x0, 11);
  }

  /** 풍향 다이얼: 사수 위치 바람이 어느 쪽에서 얼마나 부는지 */
  private drawWindDial(h: HudSnapshot): void {
    const c = this.q('.hud-winddial') as HTMLCanvasElement;
    if (!h.windNow) {
      c.style.display = 'none';
      return;
    }
    c.style.display = '';
    const key = `${h.windNow.speed.toFixed(1)}|${Math.round(h.windNow.fromDeg)}`;
    if (key === this.lastDial) return;
    this.lastDial = key;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const W = c.width;
    const r = W / 2 - 6;
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.translate(W / 2, W / 2);
    ctx.strokeStyle = 'rgba(230,236,228,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * (r - 4), -Math.cos(a) * (r - 4));
      ctx.lineTo(Math.sin(a) * r, -Math.cos(a) * r);
      ctx.stroke();
    }
    // 바람이 불어오는 쪽 → 중심으로 향하는 화살표
    const a = (h.windNow.fromDeg * Math.PI) / 180;
    const len = Math.min(r - 2, 8 + h.windNow.speed * 4);
    ctx.strokeStyle = '#7fd3c8';
    ctx.fillStyle = '#7fd3c8';
    ctx.lineWidth = 3;
    const sx = Math.sin(a) * r, sy = -Math.cos(a) * r;
    const ex = Math.sin(a) * (r - len), ey = -Math.cos(a) * (r - len);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    const ang = Math.atan2(ey - sy, ex - sx);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - Math.cos(ang - 0.5) * 7, ey - Math.sin(ang - 0.5) * 7);
    ctx.lineTo(ex - Math.cos(ang + 0.5) * 7, ey - Math.sin(ang + 0.5) * 7);
    ctx.fill();
    ctx.fillStyle = '#f2f4ee';
    ctx.font = '600 13px "Share Tech Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(h.windNow.speed.toFixed(1), 0, 0);
    ctx.restore();
  }
  private markerEls: HTMLDivElement[] = [];

  private updateMarkers(): void {
    const list = this.game.markers();
    const box = this.q('.hud-markers');
    while (this.markerEls.length < list.length) {
      const d = document.createElement('div');
      d.className = 'marker';
      d.innerHTML = '<span></span><i></i>';
      box.appendChild(d);
      this.markerEls.push(d);
    }
    this.markerEls.forEach((el, i) => {
      const m = list[i];
      if (!m) {
        el.style.display = 'none';
        return;
      }
      el.style.display = '';
      el.style.transform = `translate(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px)`;
      el.className = `marker r-${m.role}${m.alert ? ' alert' : ''}`;
      const span = el.firstElementChild as HTMLElement;
      if (span.textContent !== m.label) span.textContent = m.label;
    });
  }
  private setHint(text: string | null): void {
    const el = this.q('.hud-hint');
    el.textContent = text ?? '';
    el.classList.toggle('show', !!text);
  }

  private showHit(i: HitInfo): void {
    const el = this.q('.hud-hit');
    el.className = `hud-hit show k-${i.kind}`;
    (el.querySelector('b') as HTMLElement).textContent = i.title;
    (el.querySelector('span') as HTMLElement).textContent = i.detail;
    this.hitTimer = BALANCE.feedback.hitMarkerTime;
    if (i.kind !== 'wound') {
      this.q('.hud-analysis').classList.remove('show');
      this.hudEl.classList.remove('has-analysis');
      this.analysisTimer = 0;
    }
  }

  private showTag(t: TagInfo): void {
    const role = t.role === 'hvt' ? '핵심 표적' : t.role === 'civilian' ? '민간인 – 사격 금지' : '경비병';
    this.toast(`식별: ${t.label} · ${role} · ${Math.round(t.distance)}m`);
  }
  private showAnalysis(a: Analysis | null): void {
    const el = this.q('.hud-analysis');
    if (!a) {
      el.classList.remove('show');
      this.hudEl.classList.remove('has-analysis');
      return;
    }
    // 휴대폰은 화면이 좁으므로 탄착 요약 한 줄 + 팁만(세부 수치는 결과 화면에서)
    const lines = this.input.isTouch ? a.lines.slice(0, 1) : a.lines;
    (el.querySelector('.ha-lines') as HTMLElement).innerHTML = `<b>빗나감</b>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}`;
    (el.querySelector('.ha-tip') as HTMLElement).textContent = `→ ${a.tip}`;
    el.classList.add('show');
    this.hudEl.classList.add('has-analysis');
    this.analysisTimer = this.input.isTouch ? 7 : 9;
  }

  private showRange(d: number | null, ok: boolean): void {
    const el = this.q('.hud-range');
    if (!ok) {
      el.textContent = this.game.mission?.noRangefinder ? '거리측정기 고장 – 레티클로 재세요' : '이 난이도에서는 거리측정기가 없습니다';
      el.classList.add('show', 'err');
      this.rangeTimer = 2.5;
      return;
    }
    el.classList.remove('err');
    if (d === null && this.rangeTimer <= 0) {
      el.classList.remove('show');
      return;
    }
    el.textContent = d === null ? '거리: 측정 불가' : `거리 ${Math.round(d)}m`;
    el.classList.add('show');
    this.rangeTimer = 5;
  }

  private showAlert(label: string): void {
    const el = this.q('.hud-alert');
    el.textContent = `⚠ ${label}`;
    el.classList.add('show');
    this.alertTimer = 3;
  }

  private muzzleFlash(): void {
    if (this.save.data.settings.reduceFlashes) return;
    this.flashEl.classList.remove('on');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('on');
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 2600);
  }

  /** 첫 진입: 메뉴 표시 */
  enterMenu(): void {
    this.showMenu();
  }

  get lastMissionResult(): MissionResult | null {
    return this.lastResult;
  }
}
