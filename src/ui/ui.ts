/**
 * UI 컨트롤러: 화면(메뉴·브리핑·일시정지·결과·설정) + HUD + 알림.
 * 모든 버튼은 실제 <button>이라 키보드(Tab/Enter)로도 조작할 수 있다.
 */
import { BALANCE } from '../config/balance';
import { DIFFICULTIES, type DifficultyId } from '../config/difficulty';
import { buildDailyMission, buildRangeMission, MISSIONS, todayKey, type MissionDef } from '../config/missions';
import { WEAPONS, type WeaponSpec } from '../config/weapons';
import { windClock } from '../ballistics/wind';
import type { AudioEngine } from '../audio/audio';
import { keyCodeLabel, type Input } from '../core/input';
import { ACTION_LABELS, DEFAULT_KEYS, type Action, type SaveStore, type Settings } from '../core/save';
import type { GameState } from '../core/stateMachine';
import type { Analysis } from '../game/analysis';
import type { Game, HitInfo, HudSnapshot, MissionResult } from '../game/game';
import { RifleState } from '../game/rifle';
import { THEMES } from '../game/themes';
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
    this.screen = name;
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
    const primaryLabel = p.firstRun ? '훈련 시작' : next ? `계속: ${next.name}` : '미션 선택';
    this.show(
      'menu',
      `<div class="panel menu-panel">
        <div class="logo"><span class="logo-mark" aria-hidden="true"></span><h1>LONG SHOT</h1></div>
        <p class="tagline">장거리 저격 훈련 시뮬레이터 — 바람을 읽고, 한 발로 끝낸다</p>
        <div class="menu-buttons">
          <button class="btn primary big" data-primary data-go="next">${esc(primaryLabel)}</button>
          <button class="btn" data-go="missions">미션 선택</button>
          <button class="btn" data-go="range">사격장 (자유 연습)</button>
          <button class="btn" data-go="daily">일일 챌린지 <span class="badge">${esc(todayKey())}</span></button>
          <div class="row">
            <button class="btn small" data-go="settings">설정</button>
            <button class="btn small" data-go="controls">조작법</button>
            <button class="btn small" data-go="credits">크레딧</button>
          </div>
        </div>
        <div class="menu-foot"><span>★ ${total} / ${MISSIONS.length * 3}</span><span>최장 명중 ${p.stats.longestHit}m</span><span>명중률 ${p.stats.shots ? Math.round((p.stats.hits / p.stats.shots) * 100) : 0}%</span></div>
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
    const cards = MISSIONS.map((m, i) => {
      const unlocked = this.missionUnlocked(i);
      const p = prog[m.id];
      const dists = m.targets.map((t) => t.dist);
      return `<button class="mission-card ${unlocked ? '' : 'locked'}" data-mission="${i}" ${unlocked ? '' : 'disabled aria-disabled="true"'}>
        <span class="mc-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="mc-name">${esc(m.name)}</span>
        <span class="mc-sub">${esc(m.subtitle)} · ${Math.min(...dists)}${dists.length > 1 && Math.max(...dists) !== Math.min(...dists) ? `~${Math.max(...dists)}` : ''}m</span>
        <span class="mc-stars">${unlocked ? stars(p?.stars ?? [false, false, false]) : '🔒 이전 미션 클리어 필요'}</span>
        ${p?.bestTime ? `<span class="mc-best">최고 ${formatTime(p.bestTime)}</span>` : ''}
      </button>`;
    }).join('');
    this.show(
      'missions',
      `<div class="panel wide">
        <div class="panel-head"><h2>미션 선택</h2><button class="btn small" data-back>뒤로 (Esc)</button></div>
        <div class="mission-grid">${cards}</div>
      </div>`,
    );
    this.bind('[data-back]', () => this.showMenu());
    this.bind('[data-mission]', (el) => this.openBriefing(MISSIONS[Number(el.dataset.mission)]));
    const firstOpen = this.screens.querySelector<HTMLButtonElement>('.mission-card:not(.locked)');
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
    const strength = z.speed < 2 ? '약한' : z.speed < 4 ? '보통' : '강한';
    const zones = m.wind.zones.length > 1 ? ' · 구간마다 다름' : '';
    const gust = m.wind.gusts ? ' · 돌풍' : '';
    return `${strength} 바람 (${windClock(z.dir)}시 방향에서)${zones}${gust}`;
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
      recoil: Math.min(1, w.recoilKick / 28),
      e800,
    };
  }

  private renderBriefing(): void {
    const m = this.briefingMission!;
    const s = this.save.data.settings;
    const total = this.save.totalStars();
    const prog = this.save.data.progress.missions[m.id];
    const th = THEMES[m.theme];
    const dists = m.targets.filter((t) => t.required || m.isRange).map((t) => t.dist);
    const distText = m.noRangefinder ? '알 수 없음 (직접 측정)' : `약 ${Math.round(Math.min(...dists) / 10) * 10}${Math.max(...dists) - Math.min(...dists) > 20 ? `~${Math.round(Math.max(...dists) / 10) * 10}` : ''}m`;
    const weaponCards = WEAPONS.map((w) => {
      const unlocked = this.weaponUnlocked(w);
      const locked = !unlocked || (m.weaponLock && m.weaponLock !== w.id);
      const st = this.weaponStats(w);
      const bar = (label: string, v: number) => `<div class="stat"><span>${label}</span><i style="--v:${Math.round(v * 100)}%"></i></div>`;
      const req = w.unlockKey ? `★ ${BALANCE.unlocks[w.unlockKey]}개 필요` : '';
      const sel = (m.weaponLock ? m.weaponLock === w.id : s.weapon === w.id) && !locked;
      return `<button class="weapon-card ${sel ? 'selected' : ''}" data-weapon="${w.id}" ${locked ? 'disabled aria-disabled="true"' : ''} aria-pressed="${sel}">
        <span class="wc-name">${w.name} <small>${w.caliber}</small></span>
        <span class="wc-desc">${!unlocked ? `🔒 ${req}` : m.weaponLock && m.weaponLock !== w.id ? '이 미션에서는 사용 불가' : esc(w.description)}</span>
        ${bar('정확도', st.acc)}${bar('위력', st.power)}${bar('볼트 속도', st.bolt)}${bar('반동', st.recoil)}
      </button>`;
    }).join('');
    const diffs = (Object.keys(DIFFICULTIES) as DifficultyId[])
      .map((id) => {
        const d = DIFFICULTIES[id];
        const locked = d.unlockKey && total < BALANCE.unlocks[d.unlockKey];
        return `<button class="diff-btn ${s.difficulty === id && !locked ? 'selected' : ''}" data-diff="${id}" ${locked ? 'disabled aria-disabled="true"' : ''} aria-pressed="${s.difficulty === id}">${d.name}${locked ? ` 🔒★${BALANCE.unlocks[d.unlockKey!]}` : ''}</button>`;
      })
      .join('');
    const diffDesc = DIFFICULTIES[s.difficulty].description;
    const rangeControls = m.isRange
      ? `<div class="range-wind">
          <label>풍속 <output id="rw-s">${this.rangeWind.speed.toFixed(1)}</output> m/s<input type="range" id="rw-speed" min="0" max="10" step="0.5" value="${this.rangeWind.speed}"></label>
          <label>방향 <output id="rw-d">${windClock(this.rangeWind.dir)}시에서</output><input type="range" id="rw-dir" min="0" max="345" step="15" value="${this.rangeWind.dir}"></label>
        </div>`
      : '';
    const objectives = m.isRange
      ? '<li>목표 없음 – 자유롭게 연습하세요. 일시정지 메뉴에서 나갈 수 있습니다.</li>'
      : m.objectives.map((o, i) => `<li><span class="star ${prog?.stars[i] ? 'on' : ''}">★</span> ${esc(o.label)}</li>`).join('');
    this.show(
      'briefing',
      `<div class="panel wide briefing">
        <div class="panel-head"><h2>${esc(m.name)} <small>${esc(m.subtitle)}</small></h2><button class="btn small" data-back>뒤로 (Esc)</button></div>
        <div class="brief-cols">
          <div class="brief-info">
            ${m.briefing.map((b) => `<p class="brief-text">${esc(b.replace('{ammo}', `[${this.input.keyLabel('ammo')}]`))}</p>`).join('')}
            <div class="brief-new"><b>배울 것</b> ${esc(m.newSkill)}</div>
            <dl class="brief-env">
              <dt>지형</dt><dd>${th.name} · 고도 ${m.atmosphere.altitude}m · ${m.atmosphere.temperature}°C</dd>
              <dt>바람</dt><dd>${m.isRange ? '직접 설정' : this.windDesc(m)}</dd>
              <dt>표적</dt><dd>${m.isRange ? '100~1500m 강철판 15개' : `${m.targets.filter((t) => t.required).length}개 · ${distText}`}</dd>
              <dt>탄약</dt><dd>${m.ammoTotal > 0 ? `${m.ammoTotal}발` : '무제한'}${m.timeLimit ? ` · 제한 ${formatTime(m.timeLimit)}` : ''}</dd>
            </dl>
            ${rangeControls}
            <h3>목표</h3>
            <ul class="objectives">${objectives}</ul>
          </div>
          <div class="brief-loadout">
            <h3>총기</h3>
            <div class="weapon-list">${weaponCards}</div>
            <h3>난이도</h3>
            <div class="diff-row">${diffs}</div>
            <p class="muted diff-desc">${esc(diffDesc)}</p>
          </div>
        </div>
        <div class="brief-actions">
          <button class="btn primary big" data-primary data-start>${this.input.isTouch ? '시작' : '시작 (Enter)'}</button>
        </div>
      </div>`,
    );
    this.bind('[data-back]', () => this.backFromBriefing());
    this.bind('[data-start]', () => this.startMission());
    this.bind('[data-weapon]', (el) => {
      s.weapon = el.dataset.weapon!;
      this.save.save();
      this.game.loadMission(m);
      this.renderBriefing();
    });
    this.bind('[data-diff]', (el) => {
      s.difficulty = el.dataset.diff as DifficultyId;
      this.save.save();
      this.game.loadMission(m);
      this.renderBriefing();
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
      };
      sp.addEventListener('change', commit);
      dr.addEventListener('change', commit);
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
    this.show('none');
    this.setHudVisible(true);
    this.prepareHud();
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
    this.show(
      'pause',
      `<div class="panel narrow">
        <h2>일시정지</h2>
        <p class="muted">${esc(this.game.mission?.name ?? '')} · ${formatTime(this.game.hud().time)}</p>
        <div class="menu-buttons">
          <button class="btn primary big" data-primary data-act="resume">계속 ${this.input.isTouch ? '' : '(Esc)'}</button>
          <button class="btn" data-act="restart">처음부터 다시 ${this.input.isTouch ? '' : '(R)'}</button>
          <button class="btn" data-act="settings">설정</button>
          <button class="btn" data-act="controls">조작법</button>
          <button class="btn" data-act="quit">${isRange ? '사격장 나가기' : '미션 나가기'}</button>
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
    const analysis = r.lastAnalysis && (!r.success || r.lastAnalysis) ? r.lastAnalysis : null;
    this.show(
      'result',
      `<div class="panel result ${r.success ? 'win' : 'lose'}">
        <h2>${r.success ? '임무 완료' : '임무 실패'}</h2>
        ${r.failReason ? `<p class="fail-reason">${esc(r.failReason)}</p>` : ''}
        <div class="result-stars" aria-label="별 ${r.stars.filter(Boolean).length}개">${r.stars.map((v, i) => `<span class="star big ${v ? 'pending' : ''}" data-i="${i}">★</span>`).join('')}</div>
        <ul class="objectives">${r.objectives.map((o, i) => `<li class="${o.done ? 'done' : ''}"><span class="check">${o.done ? '✔' : '✖'}</span> ${esc(o.label)} ${r.prevStars[i] && !o.done ? '<small class="muted">(이전에 달성)</small>' : ''}</li>`).join('')}</ul>
        <div class="result-stats">
          <div><b>${formatTime(r.time)}</b><span>시간${r.newBestTime ? ' · 신기록!' : ''}</span></div>
          <div><b>${r.hits}/${r.shots}</b><span>명중 (${acc}%)</span></div>
          <div><b>${r.headshots}</b><span>헤드샷</span></div>
          <div><b>${Math.round(r.longest)}m</b><span>최장 명중</span></div>
          ${daily ? `<div><b>${r.score}</b><span>점수 (오늘 최고 ${r.bestScore})</span></div>` : ''}
        </div>
        ${r.unlocked.length ? `<div class="unlocks">${r.unlocked.map((u) => `<p>🔓 ${esc(u)}</p>`).join('')}</div>` : ''}
        ${r.tip ? `<div class="tip"><b>다음엔 이렇게</b> ${esc(r.tip)}</div>` : ''}
        ${analysis && !r.success ? `<details class="analysis-details"><summary>마지막 빗나간 탄 분석</summary>${analysis.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</details>` : ''}
        <div class="menu-buttons row-buttons">
          ${next ? `<button class="btn primary big" data-primary data-act="next">다음 미션 ${this.input.isTouch ? '' : '(Enter)'}</button>` : ''}
          <button class="btn ${next ? '' : 'primary big'}" ${next ? '' : 'data-primary'} data-act="retry">다시 하기 ${this.input.isTouch ? '' : '(R)'}</button>
          <button class="btn" data-act="missions">${daily ? '메인 메뉴' : '미션 선택'}</button>
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
      }, 300 + i * 320);
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

  // ───────────────────────── 설정 ─────────────────────────
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
              <tr><td>고각 터렛</td><td>${k('elevUp')} ${k('elevDown')} (1클릭 0.1mil, 누르고 있으면 연속)</td></tr>
              <tr><td>좌우 터렛</td><td>${k('windLeft')} ${k('windRight')}</td></tr>
              <tr><td>터렛 초기화</td><td>${k('turretReset')}</td></tr>
              <tr><td>거리측정기</td><td>${k('rangefinder')}</td></tr>
              <tr><td>탄도표</td><td>${k('dope')}</td></tr>
              <tr><td>탄종 변경</td><td>${k('ammo')}</td></tr>
              <tr><td>재시작</td><td>${k('restart')} 길게</td></tr>
              <tr><td>일시정지</td><td><kbd>Esc</kbd> / ${k('pause')}</td></tr>
            </table>
            <h3>터치</h3>
            <p class="small-text">빈 곳을 드래그해 조준 · 두 손가락으로 벌려 배율 조절 · 오른쪽 아래 [발사] · 왼쪽 아래 [숨] · 왼쪽 십자 버튼으로 터렛 조절</p>
          </section>
          <section><h3>사격 요령</h3>
            <ol class="howto">
              <li><b>거리</b>를 잰다 – 거리측정기, 또는 레티클: <code>거리(m) = 크기(m) × 1000 ÷ mil</code></li>
              <li><b>탄도표</b>에서 그 거리의 고각(mil)을 찾아 터렛을 돌린다. <code>1mil = 1000m에서 1m</code></li>
              <li><b>바람</b>을 읽는다 – 깃발이 수평에 가까울수록 강하다(8m/s↑). 좌우 보정 = 탄도표의 "1m/s당 값" × 풍속</li>
              <li>움직이는 표적은 <b>리드</b>: <code>리드(mil) ≈ 속도 × 비행시간 ÷ 거리 × 1000</code></li>
              <li><b>숨을 참고</b>(흔들림 80%↓) 레티클이 멈춘 순간 쏜다. 너무 오래 참으면 오히려 흔들린다.</li>
              <li>빗나가면 <b>탄착 분석</b>을 보고 보정한다. 흙먼지가 보인 위치도 단서다.</li>
            </ol>
            <h3>판정</h3>
            <p class="small-text">로봇: 머리·흉부·복부 명중 시 무력화, 팔·다리는 부상(경계 후 도주). 총성은 음속(343m/s)으로 퍼져 다른 로봇이 듣고 반응한다. 아음속탄은 총성이 작지만 탄이 크게 떨어진다.</p>
          </section>
        </div>
      </div>`,
    );
    this.bind('[data-back]', () => (this.controlsReturn === 'pause' ? this.renderPause() : this.showMenu()));
  }

  showCredits(): void {
    this.show(
      'credits',
      `<div class="panel narrow credits">
        <div class="panel-head"><h2>크레딧</h2><button class="btn small" data-primary data-back>뒤로 (Esc)</button></div>
        <p><b>LONG SHOT</b> v1.0</p>
        <p>기획 · 개발: vecar0 with Claude Code</p>
        <h3>기술</h3>
        <p>Three.js (MIT License) · TypeScript · Vite</p>
        <h3>그래픽 · 사운드</h3>
        <p>모든 3D 모델과 효과음, 배경음은 코드로 실시간 생성했습니다. 외부 에셋을 사용하지 않았습니다.</p>
        <h3>탄도 모델</h3>
        <p>G7 표준 항력 함수, ICAO 표준 대기, Litz 스핀 드리프트 근사식을 사용했습니다. 실제 사격에 사용하지 마세요.</p>
        <p class="muted">표적은 모두 훈련용 로봇과 강철판입니다.</p>
      </div>`,
    );
    this.bind('[data-back]', () => this.showMenu());
  }

  // ───────────────────────── 키 ─────────────────────────
  /** @returns 키를 메뉴에서 처리했으면 true */
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
      <div class="hud-tl">
        <div class="hud-mission"></div>
        <div class="hud-targets"></div>
        <div class="hud-time"></div>
      </div>
      <div class="hud-tr"><button class="hud-pause" aria-label="일시정지">II</button></div>
      <div class="hud-hint" role="status" aria-live="polite"></div>
      <div class="hud-alert" role="alert"></div>
      <div class="hud-cross" aria-hidden="true"></div>
      <div class="hud-hit"><b></b><span></span></div>
      <div class="hud-range"></div>
      <div class="hud-analysis"><div class="ha-lines"></div><div class="ha-tip"></div></div>
      <div class="hud-bl">
        <div class="hud-wind"></div>
      </div>
      <div class="hud-br">
        <div class="hud-turret"><span class="ht-e"></span><span class="ht-w"></span></div>
        <div class="hud-zoom"></div>
        <div class="hud-ammo"><b class="ha-count"></b><span class="ha-name"></span><span class="ha-status"></span></div>
      </div>
      <div class="hud-breath"><i></i><span></span></div>
      <div class="hud-restart"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" /></svg><span>재시작</span></div>
      <div class="hud-dope"></div>
      <div class="hud-cam"><span>불릿캠 · 클릭하면 건너뜀</span></div>
      <div class="hud-lock">화면을 클릭하면 마우스가 고정됩니다</div>
      <div class="hud-markers" aria-hidden="true"></div>`;
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
      if (this.analysisTimer > 0 && (this.analysisTimer -= dt) <= 0) this.q('.hud-analysis').classList.remove('show');
      if (this.rangeTimer > 0 && (this.rangeTimer -= dt) <= 0) this.q('.hud-range').classList.remove('show');
      if (this.alertTimer > 0 && (this.alertTimer -= dt) <= 0) this.q('.hud-alert').classList.remove('show');
    }
  }

  private updateHud(h: HudSnapshot): void {
    this.setText('.hud-mission', h.missionName);
    this.setText('.hud-targets', h.isRange ? `${h.weaponName} · 자유 연습` : `표적 ${h.targetsTotal - h.targetsLeft} / ${h.targetsTotal}`);
    const timeText = h.timeLimit > 0 ? `남은 시간 ${formatTime(h.timeLimit - h.time)}` : formatTime(h.time);
    this.setText('.hud-time', timeText);
    this.q('.hud-time').classList.toggle('danger', h.timeLimit > 0 && h.timeLimit - h.time < 20);
    this.setText('.ht-e', `고각 ▲ ${h.elev.toFixed(1)}`);
    this.setText('.ht-w', `좌우 ${h.wind === 0 ? '0.0' : `${Math.abs(h.wind).toFixed(1)}${h.wind > 0 ? 'R' : 'L'}`} mil`);
    this.setText('.hud-zoom', `${h.zoom.toFixed(1)}×`);
    this.setText('.ha-count', `${h.inMag} / ${h.reserve === Infinity ? '∞' : h.reserve}`);
    this.setText('.ha-name', h.ammoName);
    this.setText('.ha-status', h.status);
    this.q('.ha-status').classList.toggle('warn', h.status !== '장전됨');
    this.q('.ha-name').classList.toggle('sub', h.subsonic);
    const wind = this.q('.hud-wind');
    if (h.windText) {
      this.setText('.hud-wind', `풍속계 · ${h.windText}`);
      wind.style.display = '';
    } else wind.style.display = 'none';
    const breath = this.q('.hud-breath');
    const showBreath = h.scopeT > 0.5 || h.breath < 0.999 || h.holding;
    breath.classList.toggle('show', showBreath);
    breath.classList.toggle('holding', h.holding);
    breath.classList.toggle('exhausted', h.exhausted);
    (breath.querySelector('i') as HTMLElement).style.transform = `scaleX(${h.breath.toFixed(3)})`;
    this.setText('.hud-breath span', h.exhausted ? `숨 고르는 중 · 심박 ${Math.round(h.heartRate)}` : h.holding ? '숨 참는 중' : `숨 · 심박 ${Math.round(h.heartRate)}`);
    this.q('.hud-cross').style.display = h.scopeT < 0.3 && !h.bulletCam ? '' : 'none';
    this.hudEl.classList.toggle('scoped', h.scopeT > 0.5);
    this.hudEl.classList.toggle('cam', h.bulletCam);
    const rs = this.q('.hud-restart');
    rs.classList.toggle('show', h.restartProgress > 0.05);
    (rs.querySelector('circle') as SVGCircleElement).style.strokeDashoffset = String(94.2 * (1 - Math.min(1, h.restartProgress)));
    this.updateMarkers();
    this.q('.hud-lock').classList.toggle('show', this.lockWanted && !this.input.pointerLocked && this.game.fsm.is('playing'));
    // 탄도표
    const dope = this.q('.hud-dope');
    dope.classList.toggle('show', h.dopeOpen);
    if (h.dopeOpen) {
      const key = `${h.weaponName}:${h.ammoName}:${this.game.mission?.id}`;
      if (key !== this.dopeKey) {
        this.dopeKey = key;
        const rows = this.game.dopeRows();
        const m = this.game.mission!;
        dope.innerHTML = `<div class="dope-head"><b>탄도표</b> ${esc(h.weaponName)} · ${esc(h.ammoName)}<br><small>영점 100m · 고도 ${m.atmosphere.altitude}m · ${m.atmosphere.temperature}°C · 1클릭 = 0.1mil</small></div>
          <table><thead><tr><th>거리</th><th>고각</th><th>클릭</th><th>바람 1m/s당</th><th>비행</th><th>에너지</th></tr></thead><tbody>
          ${rows.map((r) => `<tr><td>${r.range}m</td><td>${r.elevationMil.toFixed(1)}</td><td>${Math.round(r.elevationMil * 10)}</td><td>${r.windPerMpsMil.toFixed(2)}</td><td>${r.time.toFixed(2)}s</td><td>${Math.round(r.energy)}J</td></tr>`).join('')}
          </tbody></table><div class="dope-foot">${this.input.isTouch ? '[표] 버튼으로 닫기' : `[${this.input.keyLabel('dope')}] 닫기`} · 스핀 드리프트: 1000m에서 약 0.2mil 오른쪽</div>`;
      }
    }
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
      el.classList.toggle('alert', m.alert);
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
      this.analysisTimer = 0;
    }
  }

  private showAnalysis(a: Analysis | null): void {
    const el = this.q('.hud-analysis');
    if (!a) {
      el.classList.remove('show');
      return;
    }
    (el.querySelector('.ha-lines') as HTMLElement).innerHTML = `<b>빗나감</b>${a.lines.map((l) => `<p>${esc(l)}</p>`).join('')}`;
    (el.querySelector('.ha-tip') as HTMLElement).textContent = `→ ${a.tip}`;
    el.classList.add('show');
    this.analysisTimer = 9;
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
