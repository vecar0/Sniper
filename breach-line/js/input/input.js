// 키보드·마우스 입력 → 공용 입력 상태. 터치(touch.js)도 같은 상태를 채운다.
// 키 겹침 규칙: F 짧게=경고/길게=상호작용, 명령 휠이 열려 있으면 마우스는 휠 선택에만 쓴다, Space=GO 전용(점프 없음).

export class InputState {
  constructor() {
    this.keys = new Set();
    this.mx = 0; this.mz = 0;
    this.sprint = false; this.crouch = false; this.lean = 0;
    this.fire = false; this.aim = false; this.fDown = false; this.interact = false;
    this.yawAcc = 0; this.pitchAcc = 0; this.lastDyaw = 0; this.lastDpitch = 0;
    this.edges = { reload: false, slot: null, cycleGrenade: false, throwG: false, go: false, shout: false };
    this.touchMove = { x: 0, z: 0 };
    this.touchActive = false;
  }
  // 매 프레임 한 번: 누적된 시점 회전과 순간 입력을 월드 입력으로 옮긴다
  flushTo(wi) {
    const k = this.keys;
    let mx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    let mz = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    if (this.touchActive && (this.touchMove.x || this.touchMove.z)) { mx = this.touchMove.x; mz = this.touchMove.z; }
    wi.mx = mx; wi.mz = mz;
    wi.sprint = this.sprint || (this.touchActive && Math.hypot(this.touchMove.x, this.touchMove.z) > 0.95 && this.touchMove.z > 0.7);
    wi.crouch = this.crouch;
    wi.lean = this.lean;
    wi.fire = this.fire;
    wi.aim = this.aim;
    wi.fDown = this.fDown;
    wi.interact = this.interact;
    wi.dyaw += this.yawAcc; wi.dpitch += this.pitchAcc;
    this.lastDyaw = this.yawAcc; this.lastDpitch = this.pitchAcc;
    this.yawAcc = 0; this.pitchAcc = 0;
    const e = this.edges;
    if (e.reload) wi.reload = true;
    if (e.slot) wi.slot = e.slot;
    if (e.cycleGrenade) wi.cycleGrenade = true;
    if (e.throwG) wi.throwG = true;
    if (e.go) wi.go = true;
    if (e.shout) wi.shout = true;
    this.edges = { reload: false, slot: null, cycleGrenade: false, throwG: false, go: false, shout: false };
  }
  releaseAll() {
    this.keys.clear();
    this.fire = false; this.aim = false; this.fDown = false; this.interact = false; this.sprint = false; this.lean = 0;
    this.touchMove.x = 0; this.touchMove.z = 0;
  }
}

export class DesktopInput {
  constructor(canvas, state, hooks) {
    this.canvas = canvas;
    this.s = state;
    this.hooks = hooks; // { isPlaying, onPause, wheel: CommandWheel, onTeamCycle, onToggleGoWait, settings }
    this.locked = false;
    this.leanKeys = { q: false, e: false };
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => this.keyUp(e));
    canvas.addEventListener('mousedown', (e) => this.mouseDown(e));
    window.addEventListener('mouseup', (e) => this.mouseUp(e));
    window.addEventListener('mousemove', (e) => this.mouseMove(e));
    canvas.addEventListener('wheel', (e) => this.wheelScroll(e), { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked && this.hooks.isPlaying() && !this.s.touchActive && !this.hooks.wheel.open) this.hooks.onPause('pointer');
    });
  }

  requestLock() {
    if (this.s.touchActive) return;
    if (document.pointerLockElement !== this.canvas && this.canvas.requestPointerLock) {
      try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* 테스트 환경 등 */ }
    }
  }

  keyDown(e) {
    if (!this.hooks.isPlaying()) return;
    const c = e.code;
    if (['Tab', 'Space'].includes(c)) e.preventDefault();
    if (e.repeat) return;
    const s = this.s;
    s.keys.add(c);
    const wheel = this.hooks.wheel;
    switch (c) {
      case 'ShiftLeft': case 'ShiftRight': s.sprint = true; break;
      case 'KeyC': case 'ControlLeft': s.crouch = !s.crouch; break;
      case 'KeyQ': this.leanKeys.q = true; this.updLean(); break;
      case 'KeyE': this.leanKeys.e = true; this.updLean(); break;
      case 'KeyR': s.edges.reload = true; break;
      case 'Digit1': s.edges.slot = 'primary'; break;
      case 'Digit2': s.edges.slot = 'secondary'; break;
      case 'Digit3': s.edges.cycleGrenade = true; break;
      case 'KeyG': s.edges.throwG = true; break;
      case 'KeyF': s.fDown = true; break;
      case 'KeyV': if (!wheel.open) wheel.show('mouse'); break;
      case 'Tab': this.hooks.onTeamCycle(); break;
      case 'KeyT': this.hooks.onToggleGoWait(); break;
      case 'Space': s.edges.go = true; break;
      case 'Escape': case 'KeyP': if (wheel.open) wheel.hide(); else this.hooks.onPause('key'); break;
      default: break;
    }
  }

  keyUp(e) {
    const s = this.s;
    s.keys.delete(e.code);
    switch (e.code) {
      case 'ShiftLeft': case 'ShiftRight': s.sprint = false; break;
      case 'KeyQ': this.leanKeys.q = false; this.updLean(); break;
      case 'KeyE': this.leanKeys.e = false; this.updLean(); break;
      case 'KeyF': s.fDown = false; break;
      case 'KeyV': if (this.hooks.wheel.open && this.hooks.wheel.mode === 'mouse') this.hooks.wheel.confirm(); break;
      default: break;
    }
  }
  updLean() { this.s.lean = (this.leanKeys.e ? 1 : 0) - (this.leanKeys.q ? 1 : 0); }

  mouseDown(e) {
    if (!this.hooks.isPlaying()) return;
    if (this.s.touchActive) return;
    if (!this.locked) { this.requestLock(); return; }
    const wheel = this.hooks.wheel;
    if (wheel.open) {
      if (e.button === 0) wheel.confirm();
      else if (e.button === 2) this.hooks.onToggleGoWait();
      return;
    }
    if (e.button === 0) this.s.fire = true;
    else if (e.button === 2) this.s.aim = true;
    else if (e.button === 1) { e.preventDefault(); wheel.show('mouse'); }
  }
  mouseUp(e) {
    if (e.button === 0) this.s.fire = false;
    else if (e.button === 2) this.s.aim = false;
    else if (e.button === 1 && this.hooks.wheel.open && this.hooks.wheel.mode === 'mouse') this.hooks.wheel.confirm();
  }
  mouseMove(e) {
    if (!this.locked || !this.hooks.isPlaying()) return;
    const wheel = this.hooks.wheel;
    if (wheel.open) { wheel.pointer(e.movementX, e.movementY); return; }
    const st = this.hooks.settings();
    const k = 0.0022 * st.sens * (this.s.aim ? 0.75 : 1);
    this.s.yawAcc -= e.movementX * k;
    this.s.pitchAcc -= e.movementY * k * (st.invertY ? -1 : 1);
  }
  wheelScroll(e) {
    if (!this.hooks.isPlaying() || this.hooks.wheel.open) return;
    e.preventDefault();
    this.s.edges.slot = e.deltaY > 0 ? 'secondary' : 'primary';
  }
}
