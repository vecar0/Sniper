// 앱 진입점: 상태 흐름(로딩 → 메뉴 → 작전 선택 → 브리핑 → 작전 ⇄ 일시정지 → 결과), 고정 스텝 루프, 자동 일시정지.
import { DT, CELL } from './config/balance.js';
import { MISSIONS, missionById } from './config/missions.js';
import { World } from './sim/world.js';
import { raycastGrid, firstDoorOnRay } from './sim/grid.js';
import { eyePos, canSee } from './sim/combat.js';
import { dirFromYawPitch } from './sim/geom.js';
import { Renderer } from './render/scene.js';
import { InputState, DesktopInput } from './input/input.js';
import { TouchInput } from './input/touch.js';
import { CommandWheel } from './input/command-wheel.js';
import { Hud } from './ui/hud.js';
import { Menus, showScreen, hideScreens } from './ui/menus.js';
import * as Save from './core/save.js';
import { Audio } from './core/audio.js';

const $ = (id) => document.getElementById(id);
const TEST = new URLSearchParams(location.search).has('test');

class App {
  constructor() {
    this.state = 'loading';
    this.save = Save.load(MISSIONS.map((m) => m.id));
    this.audio = new Audio();
    this.touchMode = matchMedia('(pointer: coarse)').matches;
    this.canvas = $('view');
    this.renderer = new Renderer(this.canvas, this.resolveQuality(), this.touchMode);
    this.input = new InputState();
    this.team = 'all';
    this.goWait = false;
    this.world = null;
    this.acc = 0;
    this.perf = { frames: [], worst: 0 };
    this.hud = new Hud();
    this.wheel = new CommandWheel($('wheel'), {
      getTarget: () => this.lookTarget,
      execute: (cmd) => this.executeCommand(cmd),
      goWait: () => this.goWait,
      toggleGoWait: () => this.toggleGoWait(),
      teamLabel: () => ({ all: '전원', red: 'Red 팀', blue: 'Blue 팀' }[this.team]),
      onOpen: () => { this.input.fire = false; },
      onClose: () => {},
    });
    const hooks = {
      isPlaying: () => this.state === 'play',
      onPause: (why) => this.pause(why),
      wheel: this.wheel,
      onTeamCycle: () => this.cycleTeam(),
      onToggleGoWait: () => this.toggleGoWait(),
      settings: () => this.save.settings,
      aimAssist: () => this.aimAssistFactor(),
      otherSlot: () => (this.world && this.world.leader.slot === 'primary' ? 'secondary' : 'primary'),
    };
    this.desktop = new DesktopInput(this.canvas, this.input, hooks);
    this.touch = new TouchInput($('touch'), this.input, hooks);
    this.menus = new Menus(this);
    this.setTouchMode(this.touchMode);
    window.addEventListener('touchstart', () => { if (!this.touchMode) this.setTouchMode(true); }, { passive: true });
    window.addEventListener('resize', () => { this.renderer.resize(); this.checkOrientation(); if (this.state === 'briefing') this.menus.drawPlan(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause('hidden'); });
    window.addEventListener('blur', () => this.pause('blur'));
    window.addEventListener('pointerdown', () => this.audio.unlock(), { once: false });
    this.applySettings();
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
    // 로딩 끝
    setTimeout(() => { this.state = 'menu'; showScreen('screen-menu'); }, 50);
  }

  resolveQuality() {
    const q = this.save.settings.quality;
    if (q !== 'auto') return q;
    return this.touchMode ? 'low' : 'mid';
  }

  setTouchMode(on) {
    this.touchMode = on;
    document.body.classList.toggle('touch', on);
    this.renderer.mobile = on;
    this.renderer.setQuality(this.resolveQuality());
  }

  applySettings() {
    const s = this.save.settings;
    this.renderer.baseFov = s.fov;
    this.renderer.camera.fov = s.fov;
    this.renderer.camera.updateProjectionMatrix();
    this.audio.setVolume(s.volume);
    if (this.renderer.qualityName !== this.resolveQuality()) this.renderer.setQuality(this.resolveQuality());
  }
  saveNow() { Save.store(this.save); }

  currentMissionId() { return this.world ? this.world.mission.id : null; }

  // ───────────── 작전 시작·종료 ─────────────
  startMission(id, loadout, entries) {
    const base = missionById(id);
    const mission = { ...base, entries: entries || base.entries };
    this.lastStart = { id, loadout: JSON.parse(JSON.stringify(loadout)), entries: { ...(entries || base.entries) } };
    this.world = new World(mission, { loadout: this.lastStart.loadout, seed: (Date.now() & 0xffff) + 1 });
    this.renderer.load(this.world);
    this.hud.reset(this.world);
    this.team = 'all';
    this.goWait = false;
    this.input.releaseAll();
    this.touch.reset();
    this.acc = 0;
    this.perf = { frames: [], worst: 0 };
    hideScreens();
    $('hud').classList.remove('hidden');
    this.state = 'play';
    this.desktop.requestLock();
    this.checkOrientation();
    this.renderer.resize();
  }

  restart() { if (this.lastStart) this.startMission(this.lastStart.id, this.lastStart.loadout, this.lastStart.entries); }

  quitToMenu() {
    this.state = 'menu';
    this.world = null;
    $('hud').classList.add('hidden');
    this.wheel.hide();
    showScreen('screen-menu');
  }

  pause(why) {
    if (this.state !== 'play') return;
    if (why === 'pointer' && this.touchMode) return;
    this.state = 'pause';
    this.pauseReason = why;
    this.input.releaseAll();
    this.touch.reset();
    this.wheel.hide();
    if (document.pointerLockElement) document.exitPointerLock();
    this.menus.openPause();
  }

  resume() {
    if (this.state !== 'pause') return;
    if (this.touchMode && innerHeight > innerWidth) return; // 세로면 계속 멈춤
    hideScreens();
    this.state = 'play';
    this.last = performance.now();
    this.acc = 0;
    this.desktop.requestLock();
  }

  checkOrientation() {
    const portrait = this.touchMode && innerHeight > innerWidth;
    $('rotate-notice').classList.toggle('hidden', !portrait);
    if (portrait) this.pause('portrait');
  }

  finish(res) {
    this.state = 'result';
    if (document.pointerLockElement) document.exitPointerLock();
    this.wheel.hide();
    $('hud').classList.add('hidden');
    const id = this.world.mission.id;
    const i = MISSIONS.findIndex((m) => m.id === id);
    const next = MISSIONS[i + 1];
    let newly = false;
    if (res.win) {
      this.save.stars[id] = Math.max(this.save.stars[id] || 0, res.stars);
      this.save.best[id] = Math.max(this.save.best[id] || 0, res.score);
      if (res.stars >= 1 && next && !this.save.unlocked.includes(next.id)) { this.save.unlocked.push(next.id); newly = true; }
      this.saveNow();
    }
    this.audio.ui(res.win ? 'good' : 'bad');
    this.menus.showResult(res, !!next && this.save.unlocked.includes(next.id), newly);
  }

  // ───────────── 명령 ─────────────
  cycleTeam() {
    this.team = this.team === 'all' ? 'red' : this.team === 'red' ? 'blue' : 'all';
    this.audio.ui('click');
  }
  toggleGoWait() { this.goWait = !this.goWait; this.audio.ui('click'); }
  executeCommand(cmd) {
    if (!this.world) return;
    const noGo = cmd.type === 'follow' || cmd.type === 'hold' || cmd.type === 'arrest';
    this.world.command(this.team, cmd, this.goWait && !noGo);
    this.audio.ui('click');
  }

  // 화면 가운데가 가리키는 명령 대상(사람 > 문 > 바닥)
  computeLookTarget() {
    const w = this.world; const L = w.leader;
    const eye = eyePos(L); const dir = dirFromYawPitch(L.yaw, L.pitch);
    const range = 16;
    const gh = raycastGrid(w.g, w.doors, eye.x, eye.y, eye.z, eye.x + dir.x * range, eye.y + dir.y * range, eye.z + dir.z * range);
    const wallD = gh ? gh.t * range : range;
    let best = null; let bt = Infinity;
    for (const a of w.actors) {
      const ok = (a.kind === 'suspect' && a.state === 'surrendered') || ((a.kind === 'hostage' || a.kind === 'civilian') && a.state === 'captive');
      if (!ok) continue;
      const dx = a.x - eye.x; const dz = a.z - eye.z;
      const t = dx * dir.x + dz * dir.z;
      if (t < 0.3 || t > 12 || t > wallD + 0.5) continue;
      const px = eye.x + dir.x * t - a.x; const pz = eye.z + dir.z * t - a.z;
      if (Math.hypot(px, pz) > 0.5) continue;
      if (t < bt) { bt = t; best = { type: 'actor', id: a.id, label: a.kind === 'suspect' ? `${a.name} 체포` : `${a.name} 확보` }; }
    }
    const lim = Math.min(14, wallD + CELL * 0.6);
    const fd = firstDoorOnRay(w.g, eye.x, eye.z, eye.x + dir.x * lim, eye.z + dir.z * lim);
    const doorT = fd ? fd.t * lim : Infinity;
    if (best && bt < doorT) return best;
    if (fd && !w.doors[fd.door].broken) return { type: 'door', door: fd.door, state: w.doors[fd.door] };
    if (fd) return { type: 'floor', ...floorPoint(eye, dir, Math.min(doorT + 1.5, wallD - 0.3)) };
    if (best) return best;
    if (dir.y < -0.03) {
      const tf = -eye.y / dir.y;
      if (tf < wallD && tf < 22) return { type: 'floor', x: eye.x + dir.x * tf, z: eye.z + dir.z * tf };
    }
    return { type: 'floor', ...floorPoint(eye, dir, Math.max(0.5, wallD - 0.4)) };
  }

  aimAssistFactor() {
    if (!this.world || !this.save.settings.aimAssist || !this.touchMode) return 1;
    const L = this.world.leader;
    const dir = dirFromYawPitch(L.yaw, L.pitch); const eye = eyePos(L);
    for (const s of this.world.actors) {
      if (s.kind !== 'suspect' || s.state === 'down' || s.state === 'arrested' || s.state === 'surrendered') continue;
      const dx = s.x - eye.x; const dy = 1.2 - eye.y; const dz = s.z - eye.z; const d = Math.hypot(dx, dy, dz);
      if (d > 25) continue;
      if ((dx * dir.x + dy * dir.y + dz * dir.z) / d < Math.cos(0.07)) continue;
      if (canSee(this.world, L, s, 180, 25)) return 0.6;
    }
    return 1;
  }

  // ───────────── 루프 ─────────────
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.1);
    const w = this.world;
    if (!w) return;
    if (this.state === 'play' && this.externalSim) {
      // 테스트 봇이 시뮬레이션을 직접 진행하는 동안은 화면만 그린다
      this.lookTarget = this.computeLookTarget();
      this.interactTarget = w.interactTarget();
    } else if (this.state === 'play') {
      this.input.flushTo(w.input);
      this.acc += dt;
      let steps = 0;
      while (this.acc >= DT && steps < 8) {
        for (const a of w.actors) { a.px = a.x; a.pz = a.z; }
        w.step();
        this.acc -= DT; steps++;
        if (w.result) break;
      }
      if (steps >= 8) this.acc = 0;
      this.lookTarget = this.computeLookTarget();
      this.interactTarget = w.interactTarget();
      this.perf.frames.push(dt);
      if (this.perf.frames.length > 240) this.perf.frames.shift();
    }
    const events = w.drainEvents();
    this.playSounds(events);
    this.renderer.handleEvents(events);
    this.hud.handleEvents(events, this.audio);
    const alpha = this.state === 'play' ? this.acc / DT : 1;
    this.renderer.update(w, alpha, this.state === 'play' ? dt : 0, this.input);
    if (this.state === 'play' || this.state === 'pause') {
      this.hud.update(this.state === 'play' ? dt : 0, w, { lookTarget: this.lookTarget, interactTarget: this.interactTarget, goWait: this.goWait, team: this.team, touch: this.touchMode, wheelOpen: this.wheel.open });
    }
    this.renderer.render();
    if (w.result && this.state === 'play') this.finish(w.result);
  }

  playSounds(events) {
    const a = this.audio; const w = this.world;
    if (!a.ctx) return;
    const L = w.leader;
    for (const e of events) {
      const dist = e.from ? Math.hypot(e.from.x - L.x, e.from.z - L.z) : e.x != null ? Math.hypot(e.x - L.x, e.z - L.z) : 0;
      if (e.type === 'shot') { if (e.leader || !a.throttle(`shot${e.by}`, 40)) a.gun(e.weapon === 'heavy' || e.weapon === 'rifle' ? 'm4' : e.weapon, dist); }
      else if (e.type === 'flash') a.bang(false);
      else if (e.type === 'explosion') a.bang(true);
      else if (e.type === 'door') a.door(e.broken);
      else if (e.type === 'step') a.step();
      else if (e.type === 'shout') a.shout(!!e.leader);
      else if (e.type === 'dry') a.dry();
      else if (e.type === 'reload') a.reload();
      else if (e.type === 'go') a.go();
      else if (e.type === 'notice' && e.tone !== 'info') a.ui(e.tone);
    }
  }
}

function floorPoint(eye, dir, t) {
  return { x: eye.x + dir.x * t, z: eye.z + dir.z * t };
}

const app = new App();
if (TEST) {
  // 자동 테스트 전용 훅(?test). 일반 실행에는 노출되지 않는다.
  window.__breach = {
    app,
    get world() { return app.world; },
    get state() { return app.state; },
    start: (id, loadout, entries) => app.startMission(id, loadout || app.menus.loadout, entries),
    stepSim: (n) => { for (let i = 0; i < n && app.world && !app.world.result; i++) app.world.step(); },
    renderInfo: () => app.renderer.info(),
    perf: () => app.perf,
    save: () => app.save,
  };
}
