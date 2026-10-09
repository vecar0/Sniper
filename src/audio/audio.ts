/**
 * 사운드 엔진. 모든 소리를 Web Audio로 실시간 합성한다(외부 음원 파일 없음 → 라이선스·로딩 문제 없음).
 * - 첫 사용자 입력에서 AudioContext를 만든다(브라우저 자동재생 정책 대응).
 * - 같은 소리 동시 재생 수 제한 + 피치 무작위(±5%)로 반복 재생 시 거슬림 방지.
 * - 마스터/효과음/음악 볼륨 분리, 탭 전환 시 일시정지.
 */
export type SoundName =
  | 'shot'
  | 'shotSub'
  | 'shotSup'
  | 'tag'
  | 'impactGround'
  | 'impactSteel'
  | 'botHit'
  | 'headshot'
  | 'bolt'
  | 'reload'
  | 'turret'
  | 'zoom'
  | 'heartbeat'
  | 'breathIn'
  | 'breathOut'
  | 'uiClick'
  | 'uiHover'
  | 'star'
  | 'alert'
  | 'fail'
  | 'success'
  | 'beep'
  | 'hint'
  | 'dry';

const MAX_VOICES: Partial<Record<SoundName, number>> = {
  turret: 3,
  uiHover: 2,
  uiClick: 3,
  impactGround: 4,
  heartbeat: 1,
  zoom: 2,
  breathIn: 1,
  breathOut: 1,
};

interface PlayOpts {
  delay?: number;
  volume?: number;
  pitch?: number;
  pan?: number;
  /** 무게감 계수(총기 종류 등) */
  weight?: number;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private ambient!: GainNode;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private noise!: AudioBuffer;
  private active = new Map<SoundName, number[]>();
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private musicNodes: AudioNode[] = [];
  private musicTimer: number | null = null;
  private volumes = { master: 0.8, sfx: 0.9, music: 0.45, muted: false };
  private wantMusic = false;

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** 사용자 제스처 안에서 호출 */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.build();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    } catch {
      this.ctx = null;
    }
  }

  private build(): void {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.connect(this.master);
    this.ambient = ctx.createGain();
    this.ambient.connect(this.sfx);
    // 노이즈 버퍼(2초)
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // 잔향: 지수 감쇠 노이즈 임펄스(계곡 메아리 느낌)
    this.reverb = ctx.createConvolver();
    const irLen = Math.floor(ctx.sampleRate * 2.8);
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < irLen; i++) {
        const t = i / ctx.sampleRate;
        // 0.35초 지점의 약한 메아리 + 긴 꼬리
        const echo = Math.abs(t - 0.35) < 0.04 ? 0.5 : 0;
        ch[i] = (Math.random() * 2 - 1) * (Math.exp(-t * 2.2) * 0.6 + echo * Math.exp(-t * 3));
      }
    }
    this.reverb.buffer = ir;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb);
    this.reverb.connect(this.sfx);
    this.applyVolumes();
    if (this.wantMusic) this.startMusic();
  }

  setVolumes(master: number, sfx: number, music: number, muted: boolean): void {
    this.volumes = { master, sfx, music, muted };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.muted ? 0 : this.volumes.master, t, 0.02);
    this.sfx.gain.setTargetAtTime(this.volumes.sfx, t, 0.02);
    this.music.gain.setTargetAtTime(this.volumes.music * 0.5, t, 0.05);
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => undefined);
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
  }

  private allow(name: SoundName, duration: number, delay: number): boolean {
    if (!this.ctx) return false;
    const max = MAX_VOICES[name] ?? 6;
    const now = this.ctx.currentTime;
    const list = (this.active.get(name) ?? []).filter((end) => end > now);
    if (list.length >= max) {
      this.active.set(name, list);
      return false;
    }
    list.push(now + delay + duration);
    this.active.set(name, list);
    return true;
  }

  private noiseSource(start: number, duration: number): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.start(start, Math.random() * 1.5);
    src.stop(start + duration + 0.05);
    return src;
  }

  private env(start: number, attack: number, decay: number, peak: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
    return g;
  }

  private tone(type: OscillatorType, freq: number, start: number, attack: number, decay: number, peak: number, out: AudioNode, freqEnd?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, start + attack + decay);
    const g = this.env(start, attack, decay, peak);
    o.connect(g).connect(out);
    o.start(start);
    o.stop(start + attack + decay + 0.05);
  }

  private burst(start: number, duration: number, filterType: BiquadFilterType, freq: number, q: number, peak: number, out: AudioNode, freqEnd?: number): void {
    const ctx = this.ctx!;
    const src = this.noiseSource(start, duration);
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(freq, start);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, start + duration);
    f.Q.value = q;
    const g = this.env(start, 0.002, duration, peak);
    src.connect(f).connect(g).connect(out);
  }

  play(name: SoundName, opts: PlayOpts = {}): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const delay = Math.max(0, opts.delay ?? 0);
    const durations: Partial<Record<SoundName, number>> = { shot: 1.5, impactSteel: 1.2, star: 0.8, success: 1.4, fail: 1.2 };
    if (!this.allow(name, durations[name] ?? 0.4, delay)) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const vol = opts.volume ?? 1;
    const pitch = (opts.pitch ?? 1) * (0.95 + Math.random() * 0.1);
    let out: AudioNode = this.sfx;
    if (opts.pan !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      p.connect(this.sfx);
      out = p;
    }
    const w = opts.weight ?? 1;
    switch (name) {
      case 'shot': {
        // 날카로운 폭음 + 저음 충격 + 잔향
        const bus = ctx.createGain();
        bus.gain.value = vol;
        bus.connect(out);
        bus.connect(this.reverbSend);
        this.burst(t, 0.35 * w, 'lowpass', 9000 * pitch, 0.7, 1.0, bus, 300);
        this.burst(t, 0.08, 'highpass', 2500, 0.5, 0.6, bus);
        this.tone('sine', 85 / w, t, 0.003, 0.28 * w, 0.9, bus, 35);
        break;
      }
      case 'shotSub': {
        const bus = ctx.createGain();
        bus.gain.value = vol * 0.6;
        bus.connect(out);
        this.burst(t, 0.12, 'bandpass', 1800 * pitch, 1.2, 0.5, bus, 600);
        this.burst(t + 0.02, 0.03, 'highpass', 5000, 1, 0.25, bus);
        this.tone('sine', 120, t, 0.002, 0.08, 0.3, bus, 60);
        break;
      }
      case 'shotSup': {
        // 소음기: 둔탁한 "퍽" + 기계음, 잔향 적음
        const bus = ctx.createGain();
        bus.gain.value = vol * 0.7;
        bus.connect(out);
        this.burst(t, 0.16 * w, 'lowpass', 1600 * pitch, 0.9, 0.7, bus, 220);
        this.tone('sine', 70, t, 0.003, 0.16, 0.5, bus, 40);
        this.burst(t + 0.03, 0.025, 'bandpass', 3200, 3, 0.18, bus);
        break;
      }
      case 'tag':
        this.tone('sine', 1760 * (opts.pitch ?? 1), t, 0.003, 0.08, 0.12 * vol, out);
        this.tone('sine', 2349 * (opts.pitch ?? 1), t + 0.07, 0.003, 0.12, 0.1 * vol, out);
        break;
      case 'impactGround':
        this.burst(t, 0.18, 'lowpass', 1400 * pitch, 0.8, 0.5 * vol, out, 200);
        break;
      case 'impactSteel': {
        // 강철판 "땡" – 비정수배 배음
        const bus = ctx.createGain();
        bus.gain.value = vol;
        bus.connect(out);
        bus.connect(this.reverbSend);
        for (const [f, a, d] of [[1180, 0.5, 1.0], [2760, 0.25, 0.7], [4130, 0.12, 0.4]] as const) this.tone('sine', f * pitch, t, 0.002, d, a, bus);
        this.burst(t, 0.03, 'highpass', 3000, 1, 0.3, bus);
        break;
      }
      case 'botHit': {
        const bus = ctx.createGain();
        bus.gain.value = vol;
        bus.connect(out);
        bus.connect(this.reverbSend);
        this.burst(t, 0.25, 'bandpass', 2200 * pitch, 2, 0.7, bus, 700);
        this.tone('square', 420 * pitch, t, 0.002, 0.18, 0.18, bus, 90);
        this.tone('sine', 760 * pitch, t + 0.01, 0.002, 0.35, 0.2, bus);
        break;
      }
      case 'headshot':
        this.tone('sine', 1568 * pitch, t, 0.005, 0.5, 0.25 * vol, out);
        this.tone('sine', 2093 * pitch, t + 0.06, 0.005, 0.6, 0.2 * vol, out);
        break;
      case 'bolt': {
        // 노리쇠: 들기-후퇴-전진-잠금
        const bt = (opts.weight ?? 1) as number;
        for (const [o, f, a] of [[0, 2600, 0.35], [0.22, 1600, 0.45], [0.55, 1900, 0.45], [0.8, 3200, 0.35]] as const)
          this.burst(t + o * bt, 0.045, 'bandpass', f * pitch, 3, a * vol, out);
        break;
      }
      case 'reload':
        for (const [o, f, a] of [[0, 1200, 0.4], [0.35, 900, 0.3], [1.3, 1500, 0.45], [1.6, 2400, 0.4]] as const)
          this.burst(t + o * w, 0.06, 'bandpass', f * pitch, 3, a * vol, out);
        break;
      case 'turret':
        this.burst(t, 0.012, 'bandpass', 4200 * pitch, 6, 0.35 * vol, out);
        break;
      case 'zoom':
        this.burst(t, 0.03, 'bandpass', 2500 * pitch, 4, 0.08 * vol, out);
        break;
      case 'heartbeat':
        this.tone('sine', 55, t, 0.01, 0.12, 0.5 * vol, out, 40);
        this.tone('sine', 50, t + 0.18, 0.01, 0.14, 0.35 * vol, out, 38);
        break;
      case 'breathIn':
        this.burst(t, 0.6, 'bandpass', 900, 0.8, 0.07 * vol, out, 1400);
        break;
      case 'breathOut':
        this.burst(t, 0.8, 'bandpass', 1100, 0.8, 0.08 * vol, out, 600);
        break;
      case 'uiClick':
        this.tone('triangle', 880 * pitch, t, 0.002, 0.07, 0.18 * vol, out, 660);
        break;
      case 'uiHover':
        this.tone('sine', 1320 * pitch, t, 0.002, 0.04, 0.05 * vol, out);
        break;
      case 'star':
        this.tone('triangle', 1046 * (opts.pitch ?? 1), t, 0.005, 0.5, 0.22 * vol, out);
        this.tone('sine', 2093 * (opts.pitch ?? 1), t, 0.005, 0.35, 0.1 * vol, out);
        break;
      case 'alert':
        this.tone('square', 880, t, 0.005, 0.12, 0.08 * vol, out);
        this.tone('square', 660, t + 0.15, 0.005, 0.16, 0.08 * vol, out);
        break;
      case 'fail':
        this.tone('triangle', 392, t, 0.01, 0.4, 0.2 * vol, out, 300);
        this.tone('triangle', 294, t + 0.3, 0.01, 0.7, 0.2 * vol, out, 200);
        break;
      case 'success':
        for (const [i, f] of [523, 659, 784, 1046].entries()) this.tone('triangle', f, t + i * 0.09, 0.01, 0.7, 0.16 * vol, out);
        break;
      case 'beep':
        this.tone('sine', 2400, t, 0.003, 0.06, 0.12 * vol, out);
        break;
      case 'hint':
        this.tone('sine', 988, t, 0.005, 0.2, 0.08 * vol, out);
        this.tone('sine', 1319, t + 0.08, 0.005, 0.25, 0.08 * vol, out);
        break;
      case 'dry':
        this.burst(t, 0.02, 'bandpass', 3000, 4, 0.3 * vol, out);
        break;
    }
  }

  /** 주변 바람 소리: 풍속(m/s)에 따라 크기·음색 변화 */
  setWind(speed: number, on: boolean): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (on && !this.windSource) {
      this.windSource = ctx.createBufferSource();
      this.windSource.buffer = this.noise;
      this.windSource.loop = true;
      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.Q.value = 0.6;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      this.windSource.connect(this.windFilter).connect(this.windGain).connect(this.ambient);
      this.windSource.start();
    }
    if (!on && this.windSource) {
      try {
        this.windSource.stop();
      } catch {
        /* 이미 정지 */
      }
      this.windSource.disconnect();
      this.windSource = null;
      return;
    }
    if (this.windGain && this.windFilter) {
      const t = ctx.currentTime;
      this.windGain.gain.setTargetAtTime(0.02 + Math.min(0.12, speed * 0.018), t, 0.4);
      this.windFilter.frequency.setTargetAtTime(250 + speed * 90, t, 0.4);
    }
  }

  /** 메뉴 배경음: 느린 패드 코드 진행 */
  startMusic(): void {
    this.wantMusic = true;
    if (!this.ctx || this.musicTimer !== null) return;
    const chords = [
      [220, 261.6, 329.6],
      [196, 246.9, 293.7],
      [174.6, 220, 261.6],
      [196, 246.9, 329.6],
    ];
    let i = 0;
    const playChord = () => {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      filter.connect(this.music);
      for (const f of chords[i % chords.length]) {
        for (const det of [-6, 6]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = f;
          o.detune.value = det;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.025, t + 1.5);
          g.gain.linearRampToValueAtTime(0.0001, t + 4.2);
          o.connect(g).connect(filter);
          o.start(t);
          o.stop(t + 4.3);
          this.musicNodes.push(o);
        }
      }
      if (this.musicNodes.length > 48) this.musicNodes.splice(0, this.musicNodes.length - 48);
      i++;
    };
    playChord();
    this.musicTimer = window.setInterval(playChord, 4000);
  }

  stopMusic(): void {
    this.wantMusic = false;
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    for (const n of this.musicNodes) {
      try {
        (n as OscillatorNode).stop();
      } catch {
        /* 이미 정지 */
      }
    }
    this.musicNodes = [];
  }
}
