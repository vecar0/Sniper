/**
 * 입력 통합: 키보드 · 마우스 · 터치(가상 버튼)를 같은 "행동(Action)"으로 다룬다.
 * 게임 로직은 키가 무엇인지 모르고 행동만 본다 → 키 변경·터치 대응이 한 곳에서 끝난다.
 */
import type { Action } from './save';

export class Input {
  private keys: Record<Action, string>;
  private codeToAction = new Map<string, Action>();
  private down = new Set<Action>();
  private virtualDown = new Set<Action>();
  private pressedQueue = new Set<Action>();
  private releasedQueue = new Set<Action>();
  lookX = 0;
  lookY = 0;
  zoomSteps = 0;
  /** 핀치 줌 배율(곱) – 프레임마다 소비 */
  zoomFactor = 1;
  /** 최근 시선 이동 속도(rad/s) – 방아쇠 흔들림 계산용 */
  private _enabled = false;
  /** 활성화 직후 잠깐은 시선 입력을 무시한다(화면 전환 때 브라우저가 보내는 가짜 mousemove 방지) */
  private enabledAt = 0;
  pointerLocked = false;
  readonly isTouch: boolean;
  /** 키 재설정 대기 중이면 다음 입력을 이 콜백으로 보낸다 */
  private captureNext: ((code: string) => void) | null = null;
  private readonly el: HTMLElement;
  private readonly disposers: (() => void)[] = [];
  onPointerLockChange: ((locked: boolean) => void) | null = null;
  /** 게임 외 상황에서도 받는 키(메뉴 단축키). true를 돌려주면 그 키는 게임 행동으로 처리하지 않는다. */
  onKeyDown: ((code: string, e: KeyboardEvent) => boolean) | null = null;

  constructor(el: HTMLElement, keys: Record<Action, string>) {
    this.el = el;
    this.keys = keys;
    this.rebuild();
    this.isTouch = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);
    this.listen(window, 'keydown', (e) => this.handleKey(e as KeyboardEvent, true));
    this.listen(window, 'keyup', (e) => this.handleKey(e as KeyboardEvent, false));
    this.listen(el, 'mousedown', (e) => this.handleMouse(e as MouseEvent, true));
    this.listen(window, 'mouseup', (e) => this.handleMouse(e as MouseEvent, false));
    this.listen(window, 'mousemove', (e) => this.handleMove(e as MouseEvent));
    this.listen(el, 'wheel', (e) => this.handleWheel(e as WheelEvent), { passive: false });
    this.listen(el, 'contextmenu', (e) => e.preventDefault());
    this.listen(document, 'pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.el;
      this.onPointerLockChange?.(this.pointerLocked);
    });
    // 포커스를 잃으면 눌린 키를 모두 해제(키가 눌린 채로 남는 문제 방지)
    this.listen(window, 'blur', () => this.releaseAll());
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(v: boolean) {
    if (v && !this._enabled) this.enabledAt = performance.now();
    this._enabled = v;
  }

  private listen(target: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions): void {
    target.addEventListener(type, fn, opts);
    this.disposers.push(() => target.removeEventListener(type, fn, opts));
  }

  dispose(): void {
    for (const d of this.disposers) d();
    this.disposers.length = 0;
  }

  setKeys(keys: Record<Action, string>): void {
    this.keys = keys;
    this.rebuild();
  }

  private rebuild(): void {
    this.codeToAction.clear();
    for (const [action, code] of Object.entries(this.keys) as [Action, string][]) this.codeToAction.set(code, action);
    // 고정 보조키: ESC는 항상 일시정지, 휠은 줌
    this.codeToAction.set('Escape', 'pause');
    if (!this.codeToAction.has('Space')) this.codeToAction.set('Space', 'breath');
  }

  captureKey(cb: (code: string) => void): void {
    this.captureNext = cb;
  }

  cancelCapture(): void {
    this.captureNext = null;
  }

  private handleKey(e: KeyboardEvent, isDown: boolean): void {
    if (this.captureNext && isDown) {
      e.preventDefault();
      const cb = this.captureNext;
      this.captureNext = null;
      cb(e.code);
      return;
    }
    // 메뉴가 처리한 키(예: 일시정지 해제용 Esc)가 같은 이벤트로 다시 일시정지를 걸지 않게 한다
    if (isDown && this.onKeyDown?.(e.code, e)) return;
    const action = this.codeToAction.get(e.code);
    if (!action) return;
    // 게임 중 브라우저 기본 동작(Tab 포커스 이동, 스페이스 스크롤) 방지
    if (this.enabled && (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow'))) e.preventDefault();
    if (e.repeat) return;
    this.setAction(action, isDown);
  }

  private handleMouse(e: MouseEvent, isDown: boolean): void {
    const code = `Mouse${e.button}`;
    if (this.captureNext && isDown) {
      e.preventDefault();
      const cb = this.captureNext;
      this.captureNext = null;
      cb(code);
      return;
    }
    const action = this.codeToAction.get(code);
    if (!action) return;
    if (isDown && !this.enabled) return;
    this.setAction(action, isDown);
  }

  private handleMove(e: MouseEvent): void {
    if (!this.enabled) return;
    if (performance.now() - this.enabledAt < 150) return;
    const dx = e.movementX || 0;
    const dy = e.movementY || 0;
    // 한 이벤트에 비정상적으로 큰 이동(포인터 락 전환·창 포커스 복귀 때 생김)은 버린다
    if (Math.abs(dx) > 400 || Math.abs(dy) > 400) return;
    // 포인터 락이 없으면(일부 브라우저·테스트 환경) 커서가 화면 안에 있을 때의 이동량을 사용
    this.lookX += dx;
    this.lookY += dy;
  }

  private handleWheel(e: WheelEvent): void {
    if (!this.enabled) return;
    e.preventDefault();
    this.zoomSteps += e.deltaY < 0 ? 1 : -1;
  }

  private setAction(action: Action, isDown: boolean): void {
    if (isDown) {
      if (!this.down.has(action)) this.pressedQueue.add(action);
      this.down.add(action);
    } else {
      if (this.down.has(action)) this.releasedQueue.add(action);
      this.down.delete(action);
    }
  }

  /** 터치 가상 버튼 */
  setVirtual(action: Action, isDown: boolean): void {
    if (isDown) {
      if (!this.isDown(action)) this.pressedQueue.add(action);
      this.virtualDown.add(action);
    } else {
      if (this.virtualDown.has(action) && !this.down.has(action)) this.releasedQueue.add(action);
      this.virtualDown.delete(action);
    }
  }

  tapVirtual(action: Action): void {
    this.pressedQueue.add(action);
    this.releasedQueue.add(action);
  }

  addLook(dx: number, dy: number): void {
    this.lookX += dx;
    this.lookY += dy;
  }

  isDown(action: Action): boolean {
    return this.down.has(action) || this.virtualDown.has(action);
  }

  /** 이번 프레임에 눌렸는지(한 번 읽으면 소비) */
  consumePressed(action: Action): boolean {
    if (this.pressedQueue.has(action)) {
      this.pressedQueue.delete(action);
      return true;
    }
    return false;
  }

  consumeReleased(action: Action): boolean {
    if (this.releasedQueue.has(action)) {
      this.releasedQueue.delete(action);
      return true;
    }
    return false;
  }

  /**
   * 프레임 끝 정리. 시선 이동은 매 프레임 소비되므로 항상 비운다.
   * 일회성 입력(클릭·탭·줌)은 게임 로직 스텝이 실제로 돌았을 때만 비운다:
   * 히트스톱이나 144Hz 이상 화면에서 로직 스텝이 없는 프레임에 클릭이 사라지지 않게.
   */
  endFrame(logicRan = true): void {
    this.lookX = 0;
    this.lookY = 0;
    if (!logicRan) return;
    this.pressedQueue.clear();
    this.releasedQueue.clear();
    this.zoomSteps = 0;
    this.zoomFactor = 1;
  }

  releaseAll(): void {
    for (const a of this.down) this.releasedQueue.add(a);
    for (const a of this.virtualDown) this.releasedQueue.add(a);
    this.down.clear();
    this.virtualDown.clear();
  }

  requestPointerLock(): void {
    if (this.isTouch) return;
    try {
      const r = this.el.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === 'function') r.catch(() => undefined);
    } catch {
      /* 지원 안 함 – 커서 이동량으로 대체 */
    }
  }

  exitPointerLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  keyLabel(action: Action): string {
    return keyCodeLabel(this.keys[action]);
  }
}

export function keyCodeLabel(code: string): string {
  if (!code) return '없음';
  const map: Record<string, string> = {
    Mouse0: '좌클릭',
    Mouse1: '휠클릭',
    Mouse2: '우클릭',
    Mouse3: '마우스4',
    Mouse4: '마우스5',
    ShiftLeft: 'Shift',
    ShiftRight: '오른쪽 Shift',
    ControlLeft: 'Ctrl',
    ControlRight: '오른쪽 Ctrl',
    AltLeft: 'Alt',
    Space: 'Space',
    Tab: 'Tab',
    Escape: 'Esc',
    Enter: 'Enter',
    Backspace: 'Backspace',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num${code.slice(6)}`;
  return code;
}
