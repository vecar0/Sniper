// 실시간 합성 사운드(외부 파일 없음). 첫 사용자 입력 뒤에 AudioContext를 연다.
export class Audio {
  constructor() { this.ctx = null; this.vol = 0.8; this.last = {}; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.vol;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 1.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  throttle(key, gap) { const t = performance.now(); if (t - (this.last[key] || 0) < gap) return true; this.last[key] = t; return false; }

  noise(dur, freq, q, gain, type = 'lowpass', decay = 8) {
    if (!this.ctx) return;
    const c = this.ctx; const t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
  tone(freq, dur, gain, type = 'sine', slide = 0) {
    if (!this.ctx) return;
    const c = this.ctx; const t = c.currentTime;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }

  gun(kind, dist = 0) {
    const fall = Math.max(0.15, 1 - dist / 30);
    if (kind === 'shotgun') { this.noise(0.35, 1800, 0.7, 0.9 * fall); this.tone(70, 0.25, 0.5 * fall, 'sine', -40); }
    else if (kind === 'pistol') { this.noise(0.12, 3200, 0.8, 0.6 * fall); this.tone(140, 0.08, 0.3 * fall, 'square', -80); }
    else if (kind === 'mp5') { this.noise(0.1, 2600, 0.9, 0.5 * fall); this.tone(110, 0.07, 0.25 * fall, 'square', -60); }
    else { this.noise(0.15, 2200, 0.8, 0.7 * fall); this.tone(90, 0.1, 0.35 * fall, 'square', -50); }
  }
  bang(big) { this.noise(big ? 1.2 : 0.8, big ? 600 : 1400, 0.5, 1.0); this.tone(50, 0.6, 0.8, 'sine', -30); if (!big) this.tone(3200, 1.2, 0.05, 'sine', -200); }
  door(broken) { if (broken) this.noise(0.4, 900, 1, 0.6); else { this.tone(180, 0.18, 0.08, 'triangle', 60); this.noise(0.12, 600, 2, 0.15); } }
  step() { if (!this.throttle('step', 250)) this.noise(0.05, 500, 1.5, 0.06); }
  shout(leader) { if (!this.throttle('shout' + leader, 300)) { this.tone(leader ? 260 : 300, 0.18, 0.12, 'sawtooth', -60); this.tone(leader ? 330 : 380, 0.12, 0.08, 'sawtooth', -40); } }
  ui(kind) {
    if (kind === 'good') { this.tone(660, 0.1, 0.12, 'triangle'); setTimeout(() => this.tone(880, 0.12, 0.1, 'triangle'), 80); }
    else if (kind === 'bad') this.tone(220, 0.25, 0.14, 'square', -80);
    else this.tone(520, 0.06, 0.07, 'triangle');
  }
  hitMarker(head) { this.tone(head ? 1600 : 1200, 0.05, 0.08, 'square'); }
  hurt() { this.noise(0.2, 400, 1, 0.4); }
  dry() { this.tone(900, 0.03, 0.08, 'square'); }
  reload() { this.noise(0.06, 2000, 4, 0.2, 'bandpass'); setTimeout(() => this.noise(0.08, 1500, 4, 0.25, 'bandpass'), 350); }
  go() { this.tone(440, 0.12, 0.15, 'square'); setTimeout(() => this.tone(660, 0.18, 0.15, 'square'), 120); }
}
