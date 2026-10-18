// 모바일 가로 화면 터치 조작. 왼쪽 = 누른 자리 기준 가상 조이스틱, 오른쪽 = 시점 드래그, 버튼은 엄지 영역.
// 멀티터치: 조이스틱과 시점/발사를 동시에 쓸 수 있다.

export class TouchInput {
  constructor(root, state, hooks) {
    this.root = root; // #touch
    this.s = state;
    this.hooks = hooks; // { isPlaying, onPause, wheel, onTeamCycle, settings, aimAssist() }
    this.joy = null; // { id, x0, y0 }
    this.look = new Map(); // id → {x,y}
    this.btnTouches = new Map(); // id → btn name
    this.base = root.querySelector('#joy-base');
    this.knob = root.querySelector('#joy-knob');
    const opt = { passive: false };
    root.addEventListener('touchstart', (e) => this.start(e), opt);
    root.addEventListener('touchmove', (e) => this.move(e), opt);
    root.addEventListener('touchend', (e) => this.end(e), opt);
    root.addEventListener('touchcancel', (e) => this.end(e), opt);
  }

  start(e) {
    if (!this.hooks.isPlaying()) return;
    if (this.hooks.wheel.open) return;
    e.preventDefault();
    this.s.touchActive = true;
    for (const t of e.changedTouches) {
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const btn = el && el.closest ? el.closest('[data-btn]') : null;
      if (btn && !btn.classList.contains('hidden')) {
        const name = btn.dataset.btn;
        this.btnTouches.set(t.identifier, { name, el: btn });
        btn.classList.add('down');
        this.press(name, true);
        if (name === 'fire') this.look.set(t.identifier, { x: t.clientX, y: t.clientY });
        continue;
      }
      if (t.clientX < window.innerWidth * 0.42 && !this.joy) {
        this.joy = { id: t.identifier, x0: t.clientX, y0: t.clientY };
        this.base.style.transform = `translate(${t.clientX - 60}px, ${t.clientY - 60}px)`;
        this.knob.style.transform = `translate(${t.clientX - 26}px, ${t.clientY - 26}px)`;
        this.base.classList.add('on'); this.knob.classList.add('on');
      } else {
        this.look.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    }
  }

  move(e) {
    if (!this.hooks.isPlaying()) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.joy && t.identifier === this.joy.id) {
        let dx = t.clientX - this.joy.x0; let dy = t.clientY - this.joy.y0;
        const L = Math.hypot(dx, dy); const R = 56;
        if (L > R) { dx *= R / L; dy *= R / L; }
        this.knob.style.transform = `translate(${this.joy.x0 + dx - 26}px, ${this.joy.y0 + dy - 26}px)`;
        const k = Math.min(1, L / R);
        const dead = 0.12;
        const mag = k < dead ? 0 : (k - dead) / (1 - dead);
        this.s.touchMove.x = L > 0 ? (dx / Math.min(L, R)) * mag : 0;
        this.s.touchMove.z = L > 0 ? (-dy / Math.min(L, R)) * mag : 0;
        continue;
      }
      const lk = this.look.get(t.identifier);
      if (lk) {
        const dx = t.clientX - lk.x; const dy = t.clientY - lk.y;
        lk.x = t.clientX; lk.y = t.clientY;
        const st = this.hooks.settings();
        const k = 0.0052 * st.sens * this.hooks.aimAssist() * (this.s.aim ? 0.7 : 1);
        this.s.yawAcc -= dx * k;
        this.s.pitchAcc -= dy * k * (st.invertY ? -1 : 1);
      }
    }
  }

  end(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.joy && t.identifier === this.joy.id) {
        this.joy = null;
        this.s.touchMove.x = 0; this.s.touchMove.z = 0;
        this.base.classList.remove('on'); this.knob.classList.remove('on');
      }
      this.look.delete(t.identifier);
      const b = this.btnTouches.get(t.identifier);
      if (b) { b.el.classList.remove('down'); this.press(b.name, false); this.btnTouches.delete(t.identifier); }
    }
  }

  press(name, down) {
    const s = this.s;
    switch (name) {
      case 'fire': s.fire = down; break;
      case 'aim': if (down) s.aim = !s.aim; break;
      case 'crouch': if (down) s.crouch = !s.crouch; break;
      case 'reload': if (down) s.edges.reload = true; break;
      case 'leanL': s.lean = down ? -1 : 0; break;
      case 'leanR': s.lean = down ? 1 : 0; break;
      case 'weapon': if (down) s.edges.slot = this.hooks.otherSlot(); break;
      case 'throw': if (down) s.edges.throwG = true; break;
      case 'grenade': if (down) s.edges.cycleGrenade = true; break;
      case 'shout': if (down) s.edges.shout = true; break;
      case 'interact': s.interact = down; break;
      case 'cmd': if (down) this.hooks.wheel.show('touch'); break;
      case 'go': if (down) s.edges.go = true; break;
      case 'team': if (down) this.hooks.onTeamCycle(); break;
      case 'pause': if (down) this.hooks.onPause('button'); break;
      default: break;
    }
    this.hooks.onButton && this.hooks.onButton(name, down);
  }

  reset() {
    this.joy = null; this.look.clear();
    for (const b of this.btnTouches.values()) b.el.classList.remove('down');
    this.btnTouches.clear();
    this.base.classList.remove('on'); this.knob.classList.remove('on');
  }
}
