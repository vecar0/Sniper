// 휴대폰 터치: 왼쪽 아무 곳 = 조이스틱, 오른쪽 드래그 = 시점, [발사]는 누른 채 끌면 조준도 된다.
// 조준 보조: 십자선이 적 위면 감도 −35%, [조준]을 누르는 순간 최대 3° 끌어줌.
export class Touch {
  constructor(root, settings, audio) {
    this.settings = settings;
    this.audio = audio;
    this.active = false;
    this.state = { mx: 0, mz: 0, fire: false, ads: false, crouch: false, edges: new Set() };
    this.lookDX = 0; this.lookDY = 0;
    this.el = document.createElement('div');
    this.el.id = 'touch';
    this.el.className = 'hidden';
    this.el.innerHTML = `
      <div class="zone l"></div><div class="zone r"></div>
      <div class="stick hidden"><i></i></div>
      <button class="tbtn fire" data-a="fire">발사</button>
      <button class="tbtn" data-a="ads">조준</button>
      <button class="tbtn" data-a="jump">점프</button>
      <button class="tbtn" data-a="dash">대시</button>
      <button class="tbtn small" data-a="crouch">앉기</button>
      <button class="tbtn small" data-a="reload">장전</button>
      <button class="tbtn small" data-a="melee">근접</button>
      <button class="tbtn small" data-a="emp">EMP</button>
      <button class="tbtn small" data-a="cycle">무기</button>
      <button class="tbtn small" data-a="pause">II</button>
      <button class="tbtn ctx hidden" data-a="interact">상점 열기</button>
      <button class="tbtn ctx hidden" data-a="ready">준비 완료</button>`;
    root.appendChild(this.el);
    this.stick = this.el.querySelector('.stick');
    this.knob = this.stick.querySelector('i');
    this.btn = {};
    for (const b of this.el.querySelectorAll('.tbtn')) this.btn[b.dataset.a] = b;
    this.layout();
    addEventListener('resize', () => this.layout());
    this.bind();
    this.onPause = null;
  }

  layout() {
    const W = innerWidth, H = innerHeight, s = Math.min(1, H / 390);
    const pos = (a, right, bottom, scale = 1) => { const b = this.btn[a]; b.style.right = `calc(${right * s}px + env(safe-area-inset-right, 0px))`; b.style.bottom = `${bottom * s}px`; b.style.transform = `scale(${s * scale})`; b.style.transformOrigin = 'bottom right'; };
    pos('fire', 96, 92); pos('ads', 196, 150); pos('jump', 16, 24); pos('dash', 16, 108);
    pos('crouch', 196, 70); pos('reload', 112, 22); pos('melee', 270, 106); pos('emp', 270, 40);
    pos('cycle', 16, 190);
    const p = this.btn.pause; p.style.left = `calc(${118 * s}px + env(safe-area-inset-left, 0px))`; p.style.top = `${8 * s}px`; p.style.transform = `scale(${s})`; p.style.transformOrigin = 'top left';
    for (const a of ['interact', 'ready']) { const b = this.btn[a]; b.style.left = '50%'; b.style.transform = `translateX(-50%) scale(${s})`; }
    this.btn.interact.style.bottom = `${150 * s}px`; this.btn.ready.style.bottom = `${96 * s}px`;
    void W;
  }

  show(on) { this.active = on; this.el.classList.toggle('hidden', !on); if (!on) this.reset(); }
  reset() { const s = this.state; s.mx = s.mz = 0; s.fire = s.ads = s.crouch = false; s.edges.clear(); this.stickId = null; this.lookId = null; this.fireId = null; this.stick.classList.add('hidden'); }

  bind() {
    const L = this.el.querySelector('.zone.l'), R = this.el.querySelector('.zone.r');
    L.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      if (this.stickId != null) return;
      this.stickId = t.identifier; this.sx = t.clientX; this.sy = t.clientY;
      this.stick.style.left = `${t.clientX}px`; this.stick.style.top = `${t.clientY}px`;
      this.stick.classList.remove('hidden'); this.knob.style.transform = '';
    }, { passive: false });
    R.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      if (this.lookId != null) return;
      this.lookId = t.identifier; this.lx = t.clientX; this.ly = t.clientY;
    }, { passive: false });
    const move = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stickId) {
          let dx = t.clientX - this.sx, dy = t.clientY - this.sy;
          const max = 50, l = Math.hypot(dx, dy);
          if (l > max) { dx *= max / l; dy *= max / l; }
          this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
          this.state.mx = dx / max; this.state.mz = -dy / max;
        } else if (t.identifier === this.lookId || t.identifier === this.fireId) {
          const k = t.identifier === this.lookId ? 'l' : 'f';
          const px = k === 'l' ? this.lx : this.fx, py = k === 'l' ? this.ly : this.fy;
          this.lookDX += t.clientX - px; this.lookDY += t.clientY - py;
          if (k === 'l') { this.lx = t.clientX; this.ly = t.clientY; } else { this.fx = t.clientX; this.fy = t.clientY; }
        }
      }
    };
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stickId) { this.stickId = null; this.state.mx = this.state.mz = 0; this.stick.classList.add('hidden'); }
        if (t.identifier === this.lookId) this.lookId = null;
        if (t.identifier === this.fireId) { this.fireId = null; this.state.fire = false; this.btn.fire.classList.remove('on'); }
      }
    };
    this.el.addEventListener('touchmove', (e) => { e.preventDefault(); move(e); }, { passive: false });
    this.el.addEventListener('touchend', end);
    this.el.addEventListener('touchcancel', end);
    for (const [a, b] of Object.entries(this.btn)) {
      b.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        const t = e.changedTouches[0];
        const s = this.state;
        if (a === 'fire') { s.fire = true; this.fireId = t.identifier; this.fx = t.clientX; this.fy = t.clientY; b.classList.add('on'); return; }
        if (a === 'ads') { s.ads = !s.ads; b.classList.toggle('on', s.ads); if (s.ads) this.assistPull = true; return; }
        if (a === 'crouch') { s.crouch = !s.crouch; b.classList.toggle('on', s.crouch); s.edges.add('crouchTap'); return; }
        if (a === 'pause') { if (this.onPause) this.onPause(); return; }
        if (a === 'emp') { s.edges.add('empTap'); return; }
        s.edges.add(a);
        b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 120);
      }, { passive: false });
    }
  }

  // 컨텍스트 버튼(상점·준비)
  context(world) {
    const shopOk = world.canShop() && !world.shopOpen;
    this.btn.interact.classList.toggle('hidden', !(shopOk && world.nearTerminal()));
    this.btn.ready.classList.toggle('hidden', !shopOk);
    // 슬라이드는 숙이기 토글을 다시 누르면 풀린다 — 달리다 누르면 슬라이드
  }

  applyLook(world, dt) {
    if (!this.active) return;
    const p = world.player;
    let k = 0.0052 * this.settings.touchSens * (1 - p.ads * (p.weapon === 'rail' ? 0.55 : 0.35));
    // 조준 보조: 적 위면 감도 낮춤
    const near = world.aimAssist(3.5);
    if (near) k *= 0.65;
    p.yaw -= this.lookDX * k; p.pitch -= this.lookDY * k;
    this.lookDX = this.lookDY = 0;
    if (this.assistPull) {
      this.assistPull = false;
      const tgt = world.aimAssist(3.0);
      if (tgt) { p.yaw = Math.atan2(-tgt.x, -tgt.z); p.pitch = Math.asin(Math.max(-1, Math.min(1, tgt.y))); }
    }
    void dt;
  }
}
