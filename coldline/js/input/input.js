// 키보드·마우스 입력 → 월드 입력. 시점은 매 프레임 바로 반영(반응성), 나머지는 고정 스텝에서 소비.
const BIND = {
  KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
  Space: 'jump', ShiftLeft: 'dash', ShiftRight: 'dash', KeyC: 'crouch', ControlLeft: 'crouch', KeyV: 'melee',
  KeyR: 'reload', KeyQ: 'leanL', KeyE: 'leanR', KeyF: 'lastWeapon', KeyG: 'emp', Enter: 'ready',
  Digit1: 's1', Digit2: 's2', Numpad1: 's1', Numpad2: 's2',
};
const SLOTS = { s1: 1, s2: 2 }; // 1번 주무기 · 2번 보조무기

export class Input {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.held = new Set();
    this.edges = new Set();
    this.mouse = { fire: false, ads: false };
    this.adsLatched = false;
    this.lookDX = 0; this.lookDY = 0;
    this.enabled = false;
    this.locked = false;
    this.onUnlock = null;
    this.onKey = null;
    this.touch = null;
    this.wheel = 0;

    addEventListener('keydown', (e) => {
      if (this.onKey && this.onKey(e)) return;
      const a = BIND[e.code];
      if (!a || !this.enabled) return;
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.held.has(a)) this.edges.add(a);
      this.held.add(a);
    });
    addEventListener('keyup', (e) => {
      const a = BIND[e.code];
      if (!a) return;
      this.held.delete(a);
      if (a === 'emp') this.edges.add('empRelease');
    });
    addEventListener('blur', () => { this.held.clear(); this.mouse.fire = false; this.mouse.ads = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (!this.locked) { this.lock(); return; }
      if (e.button === 0) this.mouse.fire = true;
      if (e.button === 2) { if (this.settings.adsToggle) this.adsLatched = !this.adsLatched; else this.mouse.ads = true; }
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.fire = false; if (e.button === 2) this.mouse.ads = false; });
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      // 브라우저가 가끔 튀는 값을 보낸다
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.lookDX += e.movementX; this.lookDY += e.movementY;
    });
    addEventListener('wheel', (e) => { if (this.enabled && this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked) { this.mouse.fire = false; this.mouse.ads = false; if (this.onUnlock) this.onUnlock(); }
    });
  }

  lock() {
    if (this.touch && this.touch.active) return;
    try { const r = this.canvas.requestPointerLock({ unadjustedMovement: true }); if (r && r.catch) r.catch(() => this.canvas.requestPointerLock()); } catch { try { this.canvas.requestPointerLock(); } catch { /* 미지원 */ } }
  }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  // 프레임마다: 시점 회전을 플레이어에 반영하고 월드 입력을 채운다
  apply(world, dt) {
    const p = world.player, inp = world.input;
    const zoomMul = 1 - p.ads * (p.weapon === 'rail' ? 0.5 : 0.3);
    const k = 0.0022 * this.settings.sens * zoomMul;
    p.yaw -= this.lookDX * k;
    p.pitch -= this.lookDY * k;
    this.lookDX = this.lookDY = 0;
    if (this.touch) this.touch.applyLook(world, dt);
    p.pitch = Math.max(-1.45, Math.min(1.45, p.pitch));

    if (!this.enabled) { inp.moveX = inp.moveZ = 0; inp.lean = 0; inp.fire = inp.ads = inp.crouch = false; return; }
    const H = this.held, E = this.edges;
    let mx = (H.has('r') ? 1 : 0) - (H.has('l') ? 1 : 0), mz = (H.has('f') ? 1 : 0) - (H.has('b') ? 1 : 0);
    let fire = this.mouse.fire, ads = this.mouse.ads || this.adsLatched, crouch = H.has('crouch');
    if (this.touch && this.touch.active) {
      const t = this.touch.state;
      if (Math.hypot(t.mx, t.mz) > 0.05) { mx = t.mx; mz = t.mz; }
      fire = fire || t.fire; ads = ads || t.ads; crouch = crouch || t.crouch;
      for (const e of t.edges) E.add(e);
      t.edges.clear();
    }
    let lean = (H.has('leanR') ? 1 : 0) - (H.has('leanL') ? 1 : 0);
    if (this.touch && this.touch.active && this.touch.state.lean) lean = this.touch.state.lean;
    inp.moveX = mx; inp.moveZ = mz; inp.fire = fire; inp.ads = ads; inp.crouch = crouch; inp.lean = lean;
    if (E.has('jump')) inp.jump = true;
    if (E.has('dash')) inp.dash = true;
    if (E.has('melee')) inp.melee = true;
    if (E.has('reload')) inp.reload = true;
    if (E.has('lastWeapon')) inp.lastWeapon = true;
    if (E.has('ready')) inp.ready = true;
    if (E.has('empRelease') || E.has('empTap')) inp.throwEmp = true;
    if (E.has('cycle')) inp.cycle = 1;
    for (const s of Object.keys(SLOTS)) if (E.has(s)) inp.slot = SLOTS[s];
    if (this.wheel) { inp.cycle = this.wheel > 0 ? 1 : -1; this.wheel = 0; }
    this.empAiming = H.has('emp');
    E.clear();
  }

  reset() { this.held.clear(); this.edges.clear(); this.mouse.fire = false; this.mouse.ads = false; this.adsLatched = false; this.lookDX = this.lookDY = 0; this.wheel = 0; if (this.touch) this.touch.reset(); }
}
