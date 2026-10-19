/**
 * 조작: 키보드·마우스 + 휴대폰 터치.
 * 휴대폰은 "왼손 = 어디든 누르면 생기는 조이스틱, 오른손 = 끌어서 조준" + 버튼 5개.
 * 발사 버튼을 누른 채 끌어도 조준이 움직인다(쏘면서 따라가기).
 */

export type ButtonId = 'fire' | 'scope' | 'crouch' | 'jump' | 'reload' | 'swap' | 'slot1' | 'slot2' | 'zoom' | 'pause';

export class ArenaInput {
  readonly isTouch: boolean;
  moveX = 0;
  moveY = 0;
  lookX = 0;
  lookY = 0;
  fireDown = false;
  /** 마우스 오른쪽(누르고 있는 동안 스코프) */
  scopeHeld = false;
  zoomSteps = 0;
  private _enabled = false;
  /** 켜진 직후 잠깐은 시선 입력을 무시(화면 전환 때 브라우저가 보내는 가짜 mousemove 방지) */
  private enabledAt = 0;
  get enabled(): boolean {
    return this._enabled;
  }
  set enabled(v: boolean) {
    if (v && !this._enabled) this.enabledAt = performance.now();
    this._enabled = v;
  }
  pointerLocked = false;
  private keys = new Set<string>();
  private pressed = new Set<ButtonId>();
  private readonly el: HTMLElement;
  private disposers: (() => void)[] = [];
  /** 터치 감도(설정) */
  touchSens = 1;
  mouseSens = 1;

  constructor(el: HTMLElement) {
    this.el = el;
    this.isTouch = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);
    this.on(window, 'keydown', (e) => this.key(e as KeyboardEvent, true));
    this.on(window, 'keyup', (e) => this.key(e as KeyboardEvent, false));
    this.on(el, 'mousedown', (e) => this.mouse(e as MouseEvent, true));
    this.on(window, 'mouseup', (e) => this.mouse(e as MouseEvent, false));
    this.on(window, 'mousemove', (e) => {
      const m = e as MouseEvent;
      if (!this.enabled || this.isTouch) return;
      if (performance.now() - this.enabledAt < 250) return;
      if (Math.abs(m.movementX) > 300 || Math.abs(m.movementY) > 300) return;
      this.lookX += m.movementX * this.mouseSens;
      this.lookY += m.movementY * this.mouseSens;
    });
    this.on(el, 'wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.zoomSteps += (e as WheelEvent).deltaY < 0 ? 1 : -1;
    }, { passive: false });
    this.on(el, 'contextmenu', (e) => e.preventDefault());
    this.on(document, 'pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.el;
      // 잠금이 바뀌는 순간 브라우저가 큰 이동값을 한 번 보내는 경우가 있다 → 잠깐 무시
      this.enabledAt = Math.max(this.enabledAt, performance.now() - 150);
      this.lookX = this.lookY = 0;
    });
    this.on(window, 'blur', () => this.releaseAll());
  }

  private on(t: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions): void {
    t.addEventListener(type, fn, opts);
    this.disposers.push(() => t.removeEventListener(type, fn, opts));
  }

  private key(e: KeyboardEvent, down: boolean): void {
    if (e.repeat) return;
    const c = e.code;
    if (down) this.keys.add(c);
    else this.keys.delete(c);
    if (!this.enabled) {
      if (down && (c === 'Escape' || c === 'KeyP')) this.press('pause');
      return;
    }
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
    if (down) {
      if (c === 'KeyC' || c === 'ControlLeft') this.press('crouch');
      if (c === 'Space') this.press('jump');
      if (c === 'KeyR') this.press('reload');
      if (c === 'KeyQ' || c === 'Tab') this.press('swap');
      if (c === 'Digit1') this.press('slot1');
      if (c === 'Digit2') this.press('slot2');
      if (c === 'KeyE' || c === 'KeyZ') this.press('zoom');
      if (c === 'Escape' || c === 'KeyP') this.press('pause');
      if (c === 'KeyF') this.press('scope');
    }
    this.updateMoveFromKeys();
  }

  private updateMoveFromKeys(): void {
    if (this.isTouch && !this.keys.size) return;
    const k = (a: string, b: string) => (this.keys.has(a) || this.keys.has(b) ? 1 : 0);
    this.moveX = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft');
    this.moveY = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown');
  }

  private mouse(e: MouseEvent, down: boolean): void {
    if (this.isTouch) return;
    if (e.button === 0) this.fireDown = down && this.enabled;
    if (e.button === 2) this.scopeHeld = down && this.enabled;
    if (down && this.enabled && !this.pointerLocked) this.requestLock();
  }

  requestLock(): void {
    if (this.isTouch) return;
    try {
      const r = this.el.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === 'function') r.catch(() => undefined);
    } catch {
      /* 일부 환경은 포인터 잠금 미지원 */
    }
  }

  exitLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  press(b: ButtonId): void {
    this.pressed.add(b);
  }

  /** 달리기: Shift, 휴대폰은 조이스틱을 끝까지 앞으로 */
  get sprint(): boolean {
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) return true;
    return this.isTouch && !this.keys.size && this.moveY > 0.9;
  }

  consume(b: ButtonId): boolean {
    const had = this.pressed.has(b);
    this.pressed.delete(b);
    return had;
  }

  takeLook(): { x: number; y: number } {
    const r = { x: this.lookX, y: this.lookY };
    this.lookX = 0;
    this.lookY = 0;
    return r;
  }

  releaseAll(): void {
    this.keys.clear();
    this.moveX = this.moveY = 0;
    this.fireDown = false;
    this.scopeHeld = false;
    this.pressed.clear();
  }

  dispose(): void {
    for (const d of this.disposers) d();
  }
}

/** 터치 버튼 아이콘(선 굵기는 CSS) */
const ico = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const ICON = {
  fire: ico('<circle cx="12" cy="12" r="7"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"/><circle class="f" cx="12" cy="12" r="1.6"/>'),
  scope: ico('<rect x="2" y="9" width="20" height="6" rx="1.5"/><path d="M6 9V6.5h3V9M15 9V6.5h3V9"/><circle class="f" cx="12" cy="12" r="1.3"/>'),
  crouch: ico('<path d="M6 7l6 5 6-5M6 13l6 5 6-5"/>'),
  jump: ico('<path d="M6 17l6-5 6 5M6 11l6-5 6 5"/>'),
  reload: ico('<path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19.5 3.5v4.5H15"/>'),
  swap: ico('<path d="M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4"/>'),
  pause: ico('<path d="M8.5 5v14M15.5 5v14"/>'),
};

/**
 * 휴대폰 터치 조작 화면.
 * - 화면 왼쪽 40% 어디든: 누른 자리에 조이스틱이 생긴다(손가락 위치를 맞출 필요 없음)
 * - 오른쪽 빈 곳: 끌어서 조준
 * - 버튼: 발사(크게) · 스코프 · 숙이기 · 재장전 · 무기 교체 (+ 스코프 중 배율)
 */
export class TouchPad {
  readonly el: HTMLDivElement;
  private readonly input: ArenaInput;
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private lookTouches = new Map<number, { x: number; y: number }>();
  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private disposers: (() => void)[] = [];

  constructor(parent: HTMLElement, input: ArenaInput) {
    this.input = input;
    this.el = document.createElement('div');
    this.el.className = 'a-touch';
    this.el.innerHTML = `
      <div class="a-stick-zone"></div>
      <div class="a-look-zone"></div>
      <div class="a-stick idle" aria-hidden="true"><div class="a-knob"></div></div>
      <button class="a-btn a-fire" data-b="fire" aria-label="발사">${ICON.fire}</button>
      <button class="a-btn a-scope" data-b="scope" aria-label="스코프">${ICON.scope}</button>
      <button class="a-btn a-crouch" data-b="crouch" aria-label="숙이기">${ICON.crouch}</button>
      <button class="a-btn a-jump" data-b="jump" aria-label="점프">${ICON.jump}</button>
      <button class="a-btn a-reload" data-b="reload" aria-label="재장전">${ICON.reload}</button>
      <button class="a-btn a-swap" data-b="swap" aria-label="무기 교체">${ICON.swap}</button>
      <button class="a-btn a-zoom" data-b="zoom" aria-label="배율">4×</button>
      <button class="a-btn a-pause" data-b="pause" aria-label="일시정지">${ICON.pause}</button>`;
    parent.appendChild(this.el);
    this.base = this.el.querySelector('.a-stick')!;
    this.knob = this.el.querySelector('.a-knob')!;
    const stickZone = this.el.querySelector<HTMLElement>('.a-stick-zone')!;
    const lookZone = this.el.querySelector<HTMLElement>('.a-look-zone')!;
    this.on(stickZone, 'touchstart', (e) => this.stickStart(e as TouchEvent));
    this.on(stickZone, 'touchmove', (e) => this.stickMove(e as TouchEvent));
    this.on(stickZone, 'touchend', (e) => this.stickEnd(e as TouchEvent));
    this.on(stickZone, 'touchcancel', (e) => this.stickEnd(e as TouchEvent));
    for (const z of [lookZone]) {
      this.on(z, 'touchstart', (e) => this.lookStart(e as TouchEvent));
      this.on(z, 'touchmove', (e) => this.lookMove(e as TouchEvent));
      this.on(z, 'touchend', (e) => this.lookEnd(e as TouchEvent));
      this.on(z, 'touchcancel', (e) => this.lookEnd(e as TouchEvent));
    }
    this.el.querySelectorAll<HTMLButtonElement>('.a-btn').forEach((b) => {
      const id = b.dataset.b as ButtonId;
      if (id === 'fire') {
        // 발사 버튼: 누르는 동안 발사 + 끌면 조준도 따라간다
        this.on(b, 'touchstart', (e) => {
          const te = e as TouchEvent;
          te.preventDefault();
          b.classList.add('pressed');
          this.input.fireDown = true;
          for (const t of Array.from(te.changedTouches)) this.lookTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
        });
        this.on(b, 'touchmove', (e) => this.lookMove(e as TouchEvent));
        const up = (e: Event) => {
          const te = e as TouchEvent;
          te.preventDefault();
          b.classList.remove('pressed');
          this.input.fireDown = false;
          for (const t of Array.from(te.changedTouches)) this.lookTouches.delete(t.identifier);
        };
        this.on(b, 'touchend', up);
        this.on(b, 'touchcancel', up);
      } else {
        this.on(b, 'touchstart', (e) => {
          e.preventDefault();
          b.classList.add('pressed');
          this.input.press(id);
        });
        const up = (e: Event) => {
          e.preventDefault();
          b.classList.remove('pressed');
        };
        this.on(b, 'touchend', up);
        this.on(b, 'touchcancel', up);
        // 마우스로 눌러도(테스트·태블릿) 동작
        this.on(b, 'click', () => this.input.press(id));
      }
    });
  }

  private on(t: EventTarget, type: string, fn: (e: Event) => void): void {
    const opts: AddEventListenerOptions = { passive: false };
    t.addEventListener(type, fn, opts);
    this.disposers.push(() => t.removeEventListener(type, fn));
  }

  private stickStart(e: TouchEvent): void {
    e.preventDefault();
    if (this.stickId !== null) return;
    const t = e.changedTouches[0];
    this.stickId = t.identifier;
    this.stickOrigin = { x: t.clientX, y: t.clientY };
    this.base.classList.remove('idle');
    this.base.style.transform = `translate(${t.clientX - 60}px, ${t.clientY - 60}px)`;
    this.knob.style.transform = 'translate(0px, 0px)';
  }

  private stickMove(e: TouchEvent): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.stickId) continue;
      let dx = t.clientX - this.stickOrigin.x;
      let dy = t.clientY - this.stickOrigin.y;
      const R = 52;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        // 손가락이 멀리 가면 조이스틱이 따라온다(끝에 걸려 멈추지 않게)
        this.stickOrigin.x += (dx / d) * (d - R);
        this.stickOrigin.y += (dy / d) * (d - R);
        this.base.style.transform = `translate(${this.stickOrigin.x - 60}px, ${this.stickOrigin.y - 60}px)`;
        dx = (dx / d) * R;
        dy = (dy / d) * R;
      }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      // 가운데 약간은 무시(손 떨림)
      const dead = 0.12;
      const nx = dx / R, ny = -dy / R;
      const mag = Math.hypot(nx, ny);
      const k = mag < dead ? 0 : (mag - dead) / (1 - dead) / Math.max(mag, 1e-6);
      this.input.moveX = nx * k;
      this.input.moveY = ny * k;
    }
  }

  private stickEnd(e: TouchEvent): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.stickId) continue;
      this.stickId = null;
      this.input.moveX = this.input.moveY = 0;
      this.restStick();
    }
  }

  /** 손을 떼면 조이스틱은 기본 자리(왼쪽 아래)에 희미하게 남는다 */
  private restStick(): void {
    this.base.classList.add('idle');
    this.base.style.transform = '';
    this.knob.style.transform = 'translate(0px, 0px)';
  }

  private lookStart(e: TouchEvent): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) this.lookTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
  }

  private lookMove(e: TouchEvent): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const p = this.lookTouches.get(t.identifier);
      if (!p) continue;
      this.input.lookX += (t.clientX - p.x) * 2.2 * this.input.touchSens;
      this.input.lookY += (t.clientY - p.y) * 2.2 * this.input.touchSens;
      p.x = t.clientX;
      p.y = t.clientY;
    }
  }

  private lookEnd(e: TouchEvent): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) this.lookTouches.delete(t.identifier);
  }

  /** 상태 표시: 스코프 중엔 배율 버튼, 숙이기 켜짐 등 */
  setState(o: { scoped: boolean; crouched: boolean; zoomLabel: string; weapon: string }): void {
    this.el.classList.toggle('scoped', o.scoped);
    this.el.querySelector('.a-crouch')?.classList.toggle('on', o.crouched);
    this.el.querySelector('.a-scope')?.classList.toggle('on', o.scoped);
    const z = this.el.querySelector<HTMLElement>('.a-zoom');
    if (z && z.textContent !== o.zoomLabel) z.textContent = o.zoomLabel;
    const w = this.el.querySelector<HTMLElement>('.a-swap');
    if (w && w.getAttribute('aria-label') !== o.weapon) w.setAttribute('aria-label', o.weapon);
  }

  setVisible(v: boolean): void {
    this.el.style.display = v ? 'block' : 'none';
    if (!v) {
      this.lookTouches.clear();
      this.stickId = null;
      this.restStick();
      this.input.moveX = this.input.moveY = 0;
      this.input.fireDown = false;
    }
  }

  dispose(): void {
    for (const d of this.disposers) d();
    this.el.remove();
  }
}
