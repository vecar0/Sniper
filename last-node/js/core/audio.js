// 사운드: Web Audio 실시간 합성(외부 파일 없음). 총성·적·폭발·UI + 빗소리 + 신스웨이브 배경음.
export class Audio {
  constructor() {
    this.ctx = null;
    this.sfxVol = 0.8; this.musicVol = 0.5;
    this.listener = { x: 0, z: 0, yaw: 0 };
    this.last = {};
    this.intensity = 0; // 0 정비 · 1 전투 · 2 보스
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(this.master);
    this.amb = ctx.createGain(); this.amb.gain.value = this.sfxVol * 0.5; this.amb.connect(this.master);
    // 잔향(옥상 개방감)
    this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(2.2, 2.6);
    this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.28;
    this.verb.connect(this.verbGain); this.verbGain.connect(this.sfx);
    this.noiseBuf = this.makeNoise(2);
    this.startRain();
    this.startMusic();
  }

  setVolumes(sfx, music) {
    this.sfxVol = sfx; this.musicVol = music;
    if (!this.ctx) return;
    this.sfx.gain.value = sfx; this.amb.gain.value = sfx * 0.5; this.music.gain.value = music * 0.5;
  }

  makeNoise(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  impulse(sec, decay) {
    const ctx = this.ctx, n = ctx.sampleRate * sec, b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }

  // 위치 → (볼륨, 팬)
  spatial(x, z, range = 40) {
    if (x == null) return { g: 1, pan: 0 };
    const L = this.listener, dx = x - L.x, dz = z - L.z, d = Math.hypot(dx, dz);
    const g = Math.max(0, 1 - d / range) ** 1.4 * 0.95 + 0.05;
    const rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
    const pan = d > 0.5 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / d)) : 0;
    return { g, pan, d };
  }

  out(gain, pan, verb = 0.3) {
    const ctx = this.ctx, g = ctx.createGain(); g.gain.value = gain;
    let node = g;
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    node.connect(this.sfx);
    if (verb > 0) { const v = ctx.createGain(); v.gain.value = verb; node.connect(v); v.connect(this.verb); }
    return g;
  }

  noise(dst, t, dur, { type = 'bandpass', freq = 1000, q = 1, gain = 1, attack = 0.002, f2 = null } = {}) {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(dst);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  tone(dst, t, dur, { type = 'sine', f0 = 440, f1 = null, gain = 0.5, attack = 0.003 } = {}) {
    const ctx = this.ctx, o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dst); o.start(t); o.stop(t + dur + 0.05);
  }

  limit(key, gap) { const now = this.ctx.currentTime; if ((this.last[key] || 0) > now - gap) return false; this.last[key] = now; return true; }

  // ── 무기 ──────────────────────────────────────────────
  shot(w) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(1, 0, 0.35);
    if (w === 'pistol') {
      this.noise(o, t, 0.12, { freq: 2600, q: 0.8, gain: 0.9, f2: 900 });
      this.tone(o, t, 0.1, { type: 'triangle', f0: 260, f1: 70, gain: 0.7 });
      this.tone(o, t, 0.05, { type: 'square', f0: 1800, f1: 600, gain: 0.08 });
    } else if (w === 'shotgun') {
      this.noise(o, t, 0.45, { type: 'lowpass', freq: 3200, q: 0.6, gain: 1.2, f2: 300 });
      this.tone(o, t, 0.3, { type: 'sine', f0: 120, f1: 38, gain: 1.1 });
      this.noise(o, t + 0.42, 0.07, { freq: 2200, q: 3, gain: 0.25 });
      this.noise(o, t + 0.55, 0.08, { freq: 1600, q: 3, gain: 0.25 });
    } else if (w === 'rifle') {
      this.noise(o, t, 0.1, { freq: 3400, q: 1.2, gain: 0.6, f2: 1200 });
      this.tone(o, t, 0.09, { type: 'sawtooth', f0: 900, f1: 180, gain: 0.22 });
      this.tone(o, t, 0.08, { type: 'sine', f0: 180, f1: 60, gain: 0.55 });
    } else if (w === 'rail') {
      this.tone(o, t, 0.5, { type: 'sawtooth', f0: 2400, f1: 80, gain: 0.45 });
      this.tone(o, t, 0.6, { type: 'sine', f0: 90, f1: 30, gain: 1.0 });
      this.noise(o, t, 0.7, { type: 'highpass', freq: 3000, gain: 0.4, f2: 600 });
    }
  }
  charge() { if (!this.ctx) return; const t = this.ctx.currentTime, o = this.out(0.5, 0, 0.1); this.tone(o, t, 0.35, { type: 'sawtooth', f0: 200, f1: 1600, gain: 0.18, attack: 0.3 }); }
  empty() { if (!this.ctx || !this.limit('empty', 0.2)) return; const t = this.ctx.currentTime; this.noise(this.out(0.5, 0, 0), t, 0.03, { freq: 4000, q: 4, gain: 0.6 }); }
  reload(w, time) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(0.6, 0.15, 0.05);
    if (w === 'shotgun') return;
    this.noise(o, t + 0.1, 0.05, { freq: 2200, q: 5, gain: 0.7 });
    this.noise(o, t + time * 0.55, 0.06, { freq: 1500, q: 5, gain: 0.8 });
    this.noise(o, t + time * 0.85, 0.05, { freq: 3000, q: 6, gain: 0.7 });
    if (w === 'rail') this.tone(o, t + time * 0.8, 0.3, { type: 'sine', f0: 300, f1: 1200, gain: 0.15 });
  }
  shell() { if (!this.ctx) return; const t = this.ctx.currentTime; this.noise(this.out(0.5, 0.15, 0.05), t, 0.05, { freq: 1800, q: 5, gain: 0.7 }); }
  switchW() { if (!this.ctx) return; const t = this.ctx.currentTime, o = this.out(0.4, 0, 0); this.noise(o, t, 0.06, { freq: 1200, q: 3, gain: 0.5 }); this.noise(o, t + 0.12, 0.05, { freq: 2500, q: 5, gain: 0.5 }); }

  // ── 명중·처치 ─────────────────────────────────────────
  hit(weak, shield) {
    if (!this.ctx || !this.limit('hit', 0.03)) return;
    const t = this.ctx.currentTime, o = this.out(0.55, 0, 0);
    if (shield) { this.tone(o, t, 0.08, { type: 'square', f0: 220, f1: 160, gain: 0.2 }); return; }
    this.tone(o, t, 0.05, { type: 'square', f0: weak ? 2400 : 1500, gain: weak ? 0.22 : 0.12 });
    if (weak) this.tone(o, t + 0.02, 0.12, { type: 'sine', f0: 3200, gain: 0.15 });
  }
  kill(type, x, z, weak) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, sp = this.spatial(x, z, 60), o = this.out(sp.g, sp.pan, 0.3);
    this.noise(o, t, 0.25, { freq: 900, q: 1, gain: 0.7, f2: 200 });
    this.tone(o, t, 0.2, { type: 'square', f0: 300, f1: 60, gain: 0.25 });
    const ui = this.out(0.5, 0, 0);
    this.tone(ui, t, 0.18, { type: 'triangle', f0: weak ? 1320 : 990, gain: 0.25 });
    this.tone(ui, t + 0.06, 0.25, { type: 'triangle', f0: weak ? 1760 : 1320, gain: 0.2 });
  }
  melee(hit) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this.out(0.7, 0, 0.1); this.noise(o, t, 0.15, { type: 'highpass', freq: 2000, gain: 0.5, f2: 6000 }); if (hit) this.noise(o, t + 0.05, 0.12, { freq: 700, q: 2, gain: 0.9 }); }

  // ── 적 ────────────────────────────────────────────────
  enemyShot(x, z) {
    if (!this.ctx || !this.limit('eshot', 0.04)) return;
    const t = this.ctx.currentTime, sp = this.spatial(x, z, 70), o = this.out(sp.g * 0.6, sp.pan, 0.4);
    this.tone(o, t, 0.12, { type: 'sawtooth', f0: 1400, f1: 300, gain: 0.25 });
    this.noise(o, t, 0.08, { freq: 2000, q: 1, gain: 0.35 });
  }
  tele(kind, x, z) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, sp = this.spatial(x, z, 50), o = this.out(Math.max(0.35, sp.g), sp.pan, 0.1);
    if (kind === 'leap') { this.tone(o, t, 0.25, { type: 'sawtooth', f0: 180, f1: 700, gain: 0.25 }); }
    else if (kind === 'drone') { for (let i = 0; i < 4; i++) this.tone(o, t + i * 0.11, 0.06, { type: 'square', f0: 2600, gain: 0.18 }); }
    else if (kind === 'missile') { this.tone(o, t, 0.9, { type: 'square', f0: 900, f1: 1400, gain: 0.12 }); }
    else if (kind === 'mortar' || kind === 'dropship') { for (let i = 0; i < 3; i++) this.tone(this.out(0.6, 0, 0), t + i * 0.25, 0.15, { type: 'square', f0: 700, gain: 0.2 }); }
    else if (kind === 'gatling') { this.tone(this.out(0.7, 0, 0), t, 1.0, { type: 'sawtooth', f0: 120, f1: 900, gain: 0.25 }); }
    else if (kind === 'slash') { this.noise(o, t, 0.12, { type: 'highpass', freq: 3000, gain: 0.3 }); }
  }
  gatling(on) {
    if (!this.ctx) return;
    if (on && !this.gat) {
      const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.8;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 28; const lg = ctx.createGain(); lg.gain.value = 0.5;
      const g = ctx.createGain(); g.gain.value = 0.6;
      lfo.connect(lg); lg.connect(g.gain); s.connect(f); f.connect(g); g.connect(this.sfx); s.start(); lfo.start();
      this.gat = { s, lfo };
    } else if (!on && this.gat) { this.gat.s.stop(); this.gat.lfo.stop(); this.gat = null; }
  }
  explode(x, z, r) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, sp = this.spatial(x, z, 90), o = this.out(Math.min(1.4, sp.g * (0.6 + r * 0.15)), sp.pan, 0.6);
    this.noise(o, t, 1.2, { type: 'lowpass', freq: 2400, q: 0.5, gain: 1.2, f2: 120 });
    this.tone(o, t, 0.8, { type: 'sine', f0: 90, f1: 28, gain: 1.2 });
  }
  emp() { if (!this.ctx) return; const t = this.ctx.currentTime, o = this.out(0.9, 0, 0.5); this.tone(o, t, 0.8, { type: 'sine', f0: 1200, f1: 60, gain: 0.6 }); for (let i = 0; i < 8; i++) this.noise(o, t + Math.random() * 0.5, 0.04, { type: 'highpass', freq: 5000, gain: 0.5 }); }
  coreHurt() { if (!this.ctx || !this.limit('core', 0.9)) return; const t = this.ctx.currentTime, o = this.out(0.5, 0, 0.2); this.tone(o, t, 0.18, { type: 'square', f0: 880, gain: 0.18 }); this.tone(o, t + 0.22, 0.18, { type: 'square', f0: 660, gain: 0.18 }); }
  shieldHit() { if (!this.ctx || !this.limit('shield', 0.15)) return; const t = this.ctx.currentTime; this.tone(this.out(0.4, 0, 0.3), t, 0.3, { type: 'sine', f0: 600, f1: 300, gain: 0.25 }); }
  hurt(dmg) { if (!this.ctx || !this.limit('hurt', 0.12)) return; const t = this.ctx.currentTime, o = this.out(0.8, 0, 0.05); this.tone(o, t, 0.15, { type: 'sine', f0: 140, f1: 60, gain: 0.6 + Math.min(0.4, dmg * 0.02) }); this.noise(o, t, 0.12, { freq: 500, q: 1, gain: 0.4 }); }
  heartbeat() { if (!this.ctx || !this.limit('heart', 0.85)) return; const t = this.ctx.currentTime, o = this.out(0.7, 0, 0); this.tone(o, t, 0.12, { type: 'sine', f0: 60, f1: 40, gain: 0.7 }); this.tone(o, t + 0.18, 0.12, { type: 'sine', f0: 55, f1: 38, gain: 0.5 }); }

  // ── 이동 ──────────────────────────────────────────────
  dash() { if (!this.ctx) return; const t = this.ctx.currentTime, o = this.out(0.7, 0, 0.1); this.noise(o, t, 0.25, { type: 'bandpass', freq: 600, q: 0.7, gain: 0.8, f2: 2400 }); this.tone(o, t, 0.2, { type: 'sine', f0: 300, f1: 900, gain: 0.15 }); }
  jump(dbl) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this.out(0.4, 0, 0); if (dbl) this.tone(o, t, 0.2, { type: 'sine', f0: 400, f1: 1200, gain: 0.2 }); else this.noise(o, t, 0.08, { freq: 700, q: 1, gain: 0.3 }); }
  land(speed) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this.out(Math.min(1, speed / 14), 0, 0.05); this.noise(o, t, 0.15, { type: 'lowpass', freq: 500, gain: 0.8 }); }
  step() { if (!this.ctx) return; const t = this.ctx.currentTime, o = this.out(0.18, (Math.random() - 0.5) * 0.3, 0); this.noise(o, t, 0.07, { freq: 900 + Math.random() * 500, q: 1.5, gain: 0.5 }); this.noise(o, t + 0.01, 0.05, { type: 'highpass', freq: 4000, gain: 0.15 }); }
  slide() { if (!this.ctx) return; const t = this.ctx.currentTime; this.noise(this.out(0.5, 0, 0), t, 0.6, { type: 'bandpass', freq: 1400, q: 0.6, gain: 0.5, f2: 500 }); }

  // ── UI · 진행 ─────────────────────────────────────────
  pickup(kind) { if (!this.ctx || !this.limit('pick' + kind, 0.05)) return; const t = this.ctx.currentTime, o = this.out(0.4, 0, 0); if (kind === 'orb') this.tone(o, t, 0.15, { type: 'sine', f0: 1200 + Math.random() * 300, f1: 1800, gain: 0.2 }); else this.noise(o, t, 0.06, { freq: 2500, q: 4, gain: 0.6 }); }
  buy() { if (!this.ctx) return; const t = this.ctx.currentTime, o = this.out(0.5, 0, 0.1); [880, 1320, 1760].forEach((f, i) => this.tone(o, t + i * 0.05, 0.2, { type: 'triangle', f0: f, gain: 0.2 })); }
  deny() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(this.out(0.5, 0, 0), t, 0.18, { type: 'square', f0: 160, gain: 0.2 }); }
  click() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(this.out(0.3, 0, 0), t, 0.04, { type: 'square', f0: 1800, gain: 0.1 }); }
  waveStart(boss) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.out(0.6, 0, 0.5);
    for (let i = 0; i < 3; i++) this.tone(o, t + i * 0.55, 0.5, { type: 'sawtooth', f0: 440, f1: 880, gain: 0.18 });
    if (boss) this.tone(o, t + 0.2, 2.5, { type: 'sawtooth', f0: 55, f1: 45, gain: 0.5, attack: 0.3 });
  }
  waveClear() { if (!this.ctx) return; const t = this.ctx.currentTime, o = this.out(0.5, 0, 0.6); [523, 659, 784, 1046].forEach((f, i) => this.tone(o, t + i * 0.09, 0.8, { type: 'triangle', f0: f, gain: 0.16 })); }
  thunder() { if (!this.ctx) return; const t = this.ctx.currentTime, o = this.out(0.55, (Math.random() - 0.5) * 0.8, 0.8); this.noise(o, t, 3.5, { type: 'lowpass', freq: 400, q: 0.5, gain: 0.9, attack: 0.08, f2: 60 }); }
  elevator() { if (!this.ctx) return; const t = this.ctx.currentTime, sp = this.spatial(0, -22, 60), o = this.out(sp.g, sp.pan, 0.3); this.tone(o, t, 0.4, { type: 'sine', f0: 1046, gain: 0.25 }); this.noise(o, t + 0.3, 1.2, { type: 'lowpass', freq: 300, gain: 0.5 }); }

  // ── 앰비언스 · 음악 ───────────────────────────────────
  startRain() {
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
    const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.value = 0.32;
    s.connect(f); f.connect(f2); f2.connect(g); g.connect(this.amb); s.start();
    // 낮은 도시 웅웅거림
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 48;
    const lf = ctx.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = 120;
    const og = ctx.createGain(); og.gain.value = 0.05;
    o.connect(lf); lf.connect(og); og.connect(this.amb); o.start();
  }

  startMusic() {
    const ctx = this.ctx;
    this.step16 = 0;
    this.nextNote = ctx.currentTime + 0.1;
    const bpm = 112, sx = 60 / bpm / 4;
    // Am - F - C - G 진행
    const roots = [45, 41, 48, 43];
    const pad = ctx.createGain(); pad.gain.value = 0.0; pad.connect(this.music);
    this.padGain = pad;
    const tick = () => {
      if (!this.ctx) return;
      while (this.nextNote < ctx.currentTime + 0.25) {
        const st = this.step16 % 64, bar = Math.floor(st / 16), r = roots[bar];
        const t = this.nextNote, I = this.intensity;
        const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
        // 베이스(16분 옥타브 펌핑)
        if (I > 0 || st % 4 === 0) {
          const n = st % 2 === 0 ? r : r + 12;
          this.musicTone(t, sx * 0.9, midi(n - 12), 'sawtooth', I > 0 ? 0.11 : 0.06, 300 + I * 500);
        }
        // 킥·스네어·하이햇
        if (I > 0) {
          if (st % 4 === 0) { this.tone(this.music, t, 0.25, { type: 'sine', f0: 140, f1: 40, gain: 0.55 }); }
          if (st % 8 === 4) this.noise(this.music, t, 0.18, { freq: 1800, q: 0.7, gain: 0.32 });
          if (st % 2 === 1) this.noise(this.music, t, 0.04, { type: 'highpass', freq: 7000, gain: 0.12 });
        }
        // 아르페지오
        if (I >= 1 && st % 2 === 0) {
          const chord = [0, 3, 7, 12, 15, 12, 7, 3];
          const n = r + 24 + chord[(st / 2) % 8] + (bar === 1 || bar === 2 ? 1 : 0) * 0;
          this.musicTone(t, sx * 1.6, midi(n), 'square', I >= 2 ? 0.045 : 0.03, 2400);
        }
        // 패드(마디 시작)
        if (st % 16 === 0) {
          for (const iv of [0, 7, 12, 15]) this.musicTone(t, sx * 16, midi(r + 12 + iv), 'sawtooth', 0.018, 900, 0.6);
        }
        this.nextNote += sx; this.step16++;
      }
      this.musicTimer = setTimeout(tick, 60);
    };
    tick();
  }
  musicTone(t, dur, f, type, gain, cutoff, attack = 0.01) {
    const ctx = this.ctx, o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cutoff; fl.Q.value = 2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(fl); fl.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.05);
  }
  setIntensity(i) { this.intensity = i; }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
}
