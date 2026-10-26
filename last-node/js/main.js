// LAST NODE — 진입점: 상태(메뉴·플레이·일시정지·게임 오버) · 고정 스텝 루프 · 이벤트 연결
import { World } from './sim/world.js';
import { TICK, PLAYER } from './config/balance.js';
import { load, save, recordRun } from './core/save.js';
import { Audio } from './core/audio.js';
import { Input } from './input/input.js';
import { Touch } from './input/touch.js';
import { Hud } from './ui/hud.js';
import { Menus } from './ui/menus.js';

const TEST = new URLSearchParams(location.search).has('test');
const $ = (s) => document.querySelector(s);
const progress = (k, text) => { $('#loading .ld-bar i').style.transform = `scaleX(${k})`; if (text) $('#loading .ld-text').textContent = text; };

function fatal(err) {
  console.error(err);
  $('#fatal').classList.remove('hidden');
  $('#fatal .msg').textContent = String(err && err.message ? err.message : err);
}
addEventListener('error', (e) => { if (!app) fatal(e.error || e.message); });

let app = null;

async function boot() {
  progress(0.15, '렌더러 준비 중…');
  const data = load();
  const coarse = matchMedia('(pointer: coarse)').matches;
  const { Renderer } = await import('./render/renderer.js');
  progress(0.4, '옥상과 도시를 짓는 중…');
  await new Promise((r) => setTimeout(r, 30));
  const q = data.settings.quality === 'auto' ? (coarse ? 'mid' : 'high') : data.settings.quality;
  const renderer = new Renderer($('#game'), { ...data.settings, quality: q });
  if (renderer.lowSpec && data.settings.quality === 'auto') renderer.bloom.enabled = false;
  progress(0.75, '헬릭스 군단 신호 분석 중…');
  await new Promise((r) => setTimeout(r, 30));
  app = new App(renderer, data, coarse);
  progress(1, '접속 완료');
  setTimeout(() => $('#loading').classList.add('done'), 250);
}

class App {
  constructor(renderer, data, coarse) {
    this.r = renderer;
    this.data = data;
    this.settings = data.settings;
    this.coarse = coarse;
    this.audio = new Audio();
    this.audio.setVolumes(this.settings.sfx, this.settings.music);
    this.hud = new Hud($('#hud'));
    this.hud.touch = coarse;
    this.menus = new Menus($('#ui'), data, this.audio);
    this.input = new Input(renderer.renderer.domElement, this.settings);
    if (coarse) {
      this.touch = new Touch(document.body, this.settings, this.audio);
      this.input.touch = this.touch;
      this.touch.onPause = () => this.pause();
    }
    this.state = 'menu';
    this.world = new World({ seed: 1 });
    this.world.state = 'menu';
    renderer.attach(this.world);
    this.acc = 0;
    this.timeScale = 1;
    this.stepDist = 0;
    this.last = performance.now();
    this.r.onThunder = () => this.audio.thunder();

    this.menus.on('start', () => this.start());
    this.menus.on('retry', () => this.start());
    this.menus.on('resume', () => this.resume());
    this.menus.on('quit', () => this.toMenu());
    this.menus.on('settings', () => this.applySettings());
    this.menus.on('settingsDone', () => save(this.data));
    this.menus.on('closeShop', () => this.closeShop());
    this.menus.on('ready', () => { this.world.input.ready = true; this.closeShop(); });
    this.menus.main();

    this.input.onUnlock = () => { if (this.state === 'play' && !this.world.shopOpen) this.pause(); };
    this.input.onKey = (e) => this.key(e);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (this.state === 'play') this.pause(); this.audio.suspend(); } else this.audio.resume(); });
    addEventListener('blur', () => { if (this.state === 'play' && !this.coarse && !TEST) this.pause(); });
    addEventListener('resize', () => this.r.resize());
    addEventListener('orientationchange', () => setTimeout(() => this.r.resize(), 200));
    // 첫 입력에서 소리 켜기(브라우저 정책)
    const unlockAudio = () => { this.audio.init(); this.audio.setVolumes(this.settings.sfx, this.settings.music); };
    addEventListener('pointerdown', unlockAudio, { once: false });
    addEventListener('keydown', unlockAudio, { once: false });

    if (TEST) this.exposeTest();
    requestAnimationFrame((t) => this.frame(t));
  }

  applySettings() {
    this.audio.setVolumes(this.settings.sfx, this.settings.music);
    this.r.settings = this.settings;
  }

  key(e) {
    // 상점이 열려 있을 때의 키(포인터 잠금 없음)
    if (this.state === 'play' && this.world.shopOpen) {
      if (e.code === 'KeyF' || e.code === 'Escape') { this.closeShop(); e.preventDefault(); return true; }
      if (e.code === 'Enter') { this.world.input.ready = true; this.closeShop(); return true; }
      const m = /^Digit(\d)$/.exec(e.code);
      if (m) { this.menus.buyIndex(this.world, parseInt(m[1], 10) - 1); return true; }
      if (e.code === 'Tab') { e.preventDefault(); const tabs = ['weapon', 'gear', 'core']; this.menus.shopTab = tabs[(tabs.indexOf(this.menus.shopTab) + 1) % 3]; this.menus.renderShop(this.world); return true; }
      return true;
    }
    if (this.state === 'pause' && e.code === 'Escape') { this.resume(); return true; }
    if (this.state === 'play' && (e.code === 'Escape' || e.code === 'KeyP') && (this.coarse || !this.input.locked)) { this.pause(); return true; }
    return false;
  }

  start() {
    this.audio.init();
    this.world = new World({ seed: (Math.random() * 1e9) | 0 });
    this.r.attach(this.world);
    this.state = 'play';
    this.acc = 0;
    this.input.reset();
    this.input.enabled = true;
    this.menus.clear();
    this.hud.show(true);
    if (this.touch) this.touch.show(true);
    if (!this.coarse) this.input.lock();
    this.hud.banner('작전 개시', '정비 단말에서 준비하거나 Enter로 바로 시작');
    this.data.runs++;
    save(this.data);
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'pause';
    this.input.enabled = false;
    this.input.reset();
    this.input.unlock();
    this.menus.pause();
    this.audio.gatling(false);
  }
  resume() {
    if (this.state !== 'pause') return;
    this.state = 'play';
    this.menus.clear();
    this.input.enabled = true;
    this.last = performance.now();
    if (!this.coarse) this.input.lock();
  }
  toMenu() {
    this.state = 'menu';
    this.input.enabled = false;
    this.input.unlock();
    this.hud.show(false);
    if (this.touch) this.touch.show(false);
    this.world = new World({ seed: 1 });
    this.world.state = 'menu';
    this.r.attach(this.world);
    this.menus.main();
    this.audio.setIntensity(0);
    this.audio.gatling(false);
  }
  openShop() {
    this.input.unlock();
    this.input.reset();
    this.menus.shop(this.world);
  }
  closeShop() {
    if (this.world.shopOpen) this.world.toggleShop();
    this.drainEvents();
    this.menus.clear();
    if (!this.coarse && this.state === 'play') this.input.lock();
  }

  gameOver() {
    this.state = 'over';
    this.input.enabled = false;
    this.input.reset();
    this.audio.gatling(false);
    const newBest = recordRun(this.data, this.world.score, this.world.wave);
    save(this.data);
    this.hud.banner(this.world.overReason === 'core' ? '코어 함락' : '러너 사망', `웨이브 ${this.world.wave} · 점수 ${this.world.score.toLocaleString()}`, true);
    setTimeout(() => {
      if (this.state !== 'over') return;
      this.input.unlock();
      if (this.touch) this.touch.show(false);
      this.hud.show(false);
      this.menus.gameOver(this.world, newBest);
    }, 1800);
  }

  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    let dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (dt <= 0) return;
    try {
      if (this.state === 'menu') { this.r.renderMenu(dt); return; }
      const w = this.world, p = w.player;
      if (this.state === 'play' && !this.externalSim) {
        this.input.apply(w, dt);
        if (this.r.hitstop > 0) { this.r.hitstop -= dt; this.timeScale = 0.12; } else this.timeScale += (1 - this.timeScale) * Math.min(1, dt * 10);
        if (w.state === 'over') this.timeScale = 0.3;
        this.acc += dt * this.timeScale;
        let n = 0;
        while (this.acc >= TICK && n < 8) { w.step(TICK); this.acc -= TICK; n++; this.drainEvents(); }
        if (n >= 8) this.acc = 0;
      } else if (this.state === 'over') {
        this.acc += dt * 0.3;
        while (this.acc >= TICK) { w.step(TICK); this.acc -= TICK; this.drainEvents(); }
      }
      if (this.externalSim) this.drainEvents();
      if (this.touch && this.state === 'play') this.touch.context(w);
      const alpha = Math.min(1, this.acc / TICK);
      this.r.render(dt, alpha, { yaw: p.yaw, pitch: p.pitch }, this.settings);
      if (this.state === 'play' || this.state === 'over') this.hud.update(w, dt, this.r.camera, {});
      if (w.shopOpen) this.menus.updateShop(w);
      // 소리: 위치·발소리·심장
      this.audio.listener.x = p.x; this.audio.listener.z = p.z; this.audio.listener.yaw = p.yaw;
      if (this.state === 'play' && p.grounded && p.speed > 2 && p.slideT <= 0) {
        this.stepDist += p.speed * dt;
        if (this.stepDist > 2.3) { this.stepDist = 0; this.audio.step(); }
      }
      if (this.state === 'play' && p.hp < 30 && p.alive) this.audio.heartbeat();
      this.audio.setIntensity(w.state === 'wave' ? (w.boss ? 2 : 1) : 0);
    } catch (err) {
      if (!this.crashed) { this.crashed = true; fatal(err); }
    }
  }

  drainEvents() {
    const w = this.world, evs = w.drainEvents();
    const A = this.audio, H = this.hud, R = this.r;
    for (const ev of evs) {
      R.handle(ev);
      switch (ev.t) {
        case 'shot': A.shot(ev.w); break;
        case 'charge': A.charge(); break;
        case 'empty': A.empty(); break;
        case 'reloadStart': A.reload(ev.w, ev.time); break;
        case 'shell': A.shell(); break;
        case 'switch': A.switchW(); break;
        case 'hit': A.hit(ev.weak, ev.shield); H.hitmark(ev.kill ? 'kill' : ev.weak ? 'weak' : ''); if (this.settings.dmgNumbers && ev.dmg > 0) H.damageNumber(ev, R.camera); break;
        case 'kill': if (!ev.self) { A.kill(ev.type, ev.x, ev.z, ev.weak); if (ev.credits) H.feed(ev); } break;
        case 'melee': A.melee(ev.hit); if (ev.hit) H.hitmark(ev.finisher ? 'kill' : ''); break;
        case 'enemyShot': A.enemyShot(ev.x, ev.z); break;
        case 'tele': {
          const e = w.enemies.find((q) => q.id === ev.id);
          A.tele(ev.kind, e ? e.x : ev.x, e ? e.z : ev.z);
          if (ev.kind === 'gatling') setTimeout(() => A.gatling(true), ev.time * 1000);
          break;
        }
        case 'explode': A.explode(ev.x, ev.z, ev.r); break;
        case 'emp': A.emp(); break;
        case 'playerHurt': A.hurt(ev.dmg); H.dir(ev, w, false); break;
        case 'coreHurt': A.coreHurt(); H.coreDir(w); break;
        case 'shieldHit': A.shieldHit(); break;
        case 'dash': A.dash(); break;
        case 'jump': A.jump(ev.double); break;
        case 'land': A.land(ev.speed); break;
        case 'slide': A.slide(); break;
        case 'pickup': A.pickup(ev.kind); break;
        case 'buy': break;
        case 'elevator': A.elevator(); break;
        case 'broadcast': H.broadcast(ev.text); break;
        case 'waveStart': A.waveStart(ev.boss); H.banner(ev.boss ? `웨이브 ${ev.wave} · 보스` : `웨이브 ${ev.wave}`, ev.boss ? '무장 수송기 카론 접근 중' : `적 ${ev.total}기 접근`, ev.boss); break;
        case 'waveClear': A.waveClear(); H.banner('웨이브 정리', `보너스 ₵${ev.bonus}${ev.perfect ? ` · 코어 무피해 +₵${ev.perfectBonus}` : ''} · 코어 +150 수리`); break;
        case 'shop': if (ev.open) this.openShop(); else this.menus.clear(); break;
        case 'fall': H.banner('추락', `체력 −${PLAYER.fallDamage}`, true); break;
        case 'engineDown': H.banner('엔진 파괴', w.boss && w.boss.engines.every((x) => x <= 0) ? '조종석 노출 — 피해 ×3' : '하나 더!'); break;
        case 'gameOver': this.gameOver(); break;
      }
      if (ev.t === 'kill' && ev.type === 'boss') { A.gatling(false); H.banner('카론 격추', `₵${ev.credits}`); }
    }
    if (!w.boss || !w.boss.alive || !w.boss.firing) A.gatling(false);
  }

  exposeTest() {
    window.__ln = {
      app: this,
      get world() { return app.world; },
      start: () => this.start(),
      stats: () => this.r.stats(),
      setExternal: (v) => { this.externalSim = v; },
    };
  }
}

boot().catch(fatal);
