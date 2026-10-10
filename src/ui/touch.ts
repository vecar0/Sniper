/**
 * 모바일 터치 조작.
 * - 버튼이 아닌 곳을 드래그하면 조준, 두 손가락으로 벌리면 줌
 * - 발사는 손을 떼는 순간이 아니라 누르는 순간(입력 지연 최소화)
 * - 숨 참기는 누르고 있는 동안
 */
import type { Input } from '../core/input';
import type { Action } from '../core/save';

interface BtnDef {
  action: Action;
  label: string;
  cls: string;
  hold?: boolean;
  aria: string;
}

const BUTTONS: BtnDef[] = [
  { action: 'fire', label: '발사', cls: 't-fire', hold: true, aria: '발사' },
  { action: 'scope', label: '스코프', cls: 't-scope', aria: '스코프 전환' },
  { action: 'breath', label: '숨', cls: 't-breath', hold: true, aria: '숨 참기' },
  { action: 'zoomIn', label: '+', cls: 't-zoomin', aria: '배율 올리기' },
  { action: 'zoomOut', label: '−', cls: 't-zoomout', aria: '배율 내리기' },
  { action: 'elevUp', label: '▲', cls: 't-up', hold: true, aria: '위로 보정' },
  { action: 'elevDown', label: '▼', cls: 't-down', hold: true, aria: '아래로 보정' },
  { action: 'windLeft', label: '◀', cls: 't-left', hold: true, aria: '왼쪽 보정' },
  { action: 'windRight', label: '▶', cls: 't-right', hold: true, aria: '오른쪽 보정' },
  { action: 'turretReset', label: '0', cls: 't-reset', aria: '보정 0으로' },
  { action: 'dope', label: '표', cls: 't-dope', aria: '보정표' },
  { action: 'rangefinder', label: '거리', cls: 't-range', aria: '거리측정기' },
  { action: 'ammo', label: '탄', cls: 't-ammo', aria: '탄종 변경' },
];

export class TouchControls {
  readonly el: HTMLDivElement;
  private readonly input: Input;
  private aimTouches = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private readonly disposers: (() => void)[] = [];
  onPause: (() => void) | null = null;

  constructor(parent: HTMLElement, input: Input) {
    this.input = input;
    this.el = document.createElement('div');
    this.el.className = 'touch';
    this.el.innerHTML =
      `<div class="touch-aim" aria-hidden="true"></div>` +
      BUTTONS.map((b) => `<button class="tbtn ${b.cls}" data-action="${b.action}" aria-label="${b.aria}">${b.label}</button>`).join('') +
      `<button class="tbtn t-pause" aria-label="일시정지">II</button>`;
    parent.appendChild(this.el);
    for (const b of BUTTONS) {
      const btn = this.el.querySelector<HTMLButtonElement>(`[data-action="${b.action}"]`)!;
      const down = (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        btn.setPointerCapture?.(e.pointerId);
        btn.classList.add('pressed');
        this.input.setVirtual(b.action, true);
      };
      const up = (e: PointerEvent) => {
        e.preventDefault();
        btn.classList.remove('pressed');
        this.input.setVirtual(b.action, false);
      };
      this.on(btn, 'pointerdown', down as EventListener);
      this.on(btn, 'pointerup', up as EventListener);
      this.on(btn, 'pointercancel', up as EventListener);
      this.on(btn, 'contextmenu', (e) => e.preventDefault());
    }
    const pause = this.el.querySelector<HTMLButtonElement>('.t-pause')!;
    this.on(pause, 'click', () => this.onPause?.());
    const aim = this.el.querySelector<HTMLDivElement>('.touch-aim')!;
    this.on(aim, 'touchstart', (e) => this.touchStart(e as TouchEvent), { passive: false });
    this.on(aim, 'touchmove', (e) => this.touchMove(e as TouchEvent), { passive: false });
    this.on(aim, 'touchend', (e) => this.touchEnd(e as TouchEvent), { passive: false });
    this.on(aim, 'touchcancel', (e) => this.touchEnd(e as TouchEvent), { passive: false });
  }

  private on(t: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions): void {
    t.addEventListener(type, fn, opts);
    this.disposers.push(() => t.removeEventListener(type, fn, opts));
  }

  setVisible(v: boolean): void {
    this.el.style.display = v ? 'block' : 'none';
    if (!v) {
      this.aimTouches.clear();
      this.el.querySelectorAll('.pressed').forEach((b) => b.classList.remove('pressed'));
    }
  }

  private touchStart(e: TouchEvent): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) this.aimTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
    if (this.aimTouches.size === 2) this.pinchDist = this.currentPinch();
  }

  private currentPinch(): number {
    const pts = Array.from(this.aimTouches.values());
    return pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
  }

  private touchMove(e: TouchEvent): void {
    e.preventDefault();
    if (this.aimTouches.size >= 2) {
      for (const t of Array.from(e.changedTouches)) if (this.aimTouches.has(t.identifier)) this.aimTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
      const d = this.currentPinch();
      if (this.pinchDist > 0 && d > 0) this.input.zoomFactor *= d / this.pinchDist;
      this.pinchDist = d;
      return;
    }
    for (const t of Array.from(e.changedTouches)) {
      const prev = this.aimTouches.get(t.identifier);
      if (!prev) continue;
      this.input.addLook(t.clientX - prev.x, t.clientY - prev.y);
      this.aimTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
  }

  private touchEnd(e: TouchEvent): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) this.aimTouches.delete(t.identifier);
    if (this.aimTouches.size < 2) this.pinchDist = 0;
  }

  private mode: 'infil' | 'snipe' | '' = '';
  private crouchOn = false;
  /**
   * 잠입(건물 안)에서는 같은 버튼을 다른 뜻으로 쓴다:
   * ▲▼◀▶ = 걷기, 발사 = 제압, 숨 = 숙이기(켜기/끄기), 스코프 = 창가에 자리 잡기.
   * 저격에 쓰는 배율·표·거리·탄 버튼은 숨긴다.
   */
  setMode(mode: 'infil' | 'snipe', crouched: boolean): void {
    if (mode === this.mode && crouched === this.crouchOn) return;
    const changed = mode !== this.mode;
    this.mode = mode;
    this.crouchOn = crouched;
    const infil = mode === 'infil';
    const set = (cls: string, label: string, aria: string) => {
      const b = this.el.querySelector<HTMLElement>(`.${cls}`);
      if (!b) return;
      b.textContent = label;
      b.setAttribute('aria-label', aria);
    };
    if (changed) {
      set('t-fire', infil ? '제압' : '발사', infil ? '경비 제압' : '발사');
      set('t-breath', infil ? '숙이기' : '숨', infil ? '숙이기 켜기/끄기' : '숨 참기');
      set('t-scope', infil ? '저격' : '스코프', infil ? '창가에 자리 잡기' : '스코프 전환');
      set('t-up', '▲', infil ? '앞으로' : '위로 보정');
      set('t-down', '▼', infil ? '뒤로' : '아래로 보정');
      set('t-left', '◀', infil ? '왼쪽으로' : '왼쪽 보정');
      set('t-right', '▶', infil ? '오른쪽으로' : '오른쪽 보정');
      this.el.classList.toggle('mode-infil', infil);
      this.el.querySelectorAll('.pressed').forEach((b) => b.classList.remove('pressed'));
    }
    this.el.querySelector('.t-breath')?.classList.toggle('on', infil && crouched);
  }

  setAmmoVisible(v: boolean): void {
    const b = this.el.querySelector<HTMLElement>('.t-ammo');
    if (b) b.style.display = v ? '' : 'none';
  }

  setRangeVisible(v: boolean): void {
    const b = this.el.querySelector<HTMLElement>('.t-range');
    if (b) b.style.display = v ? '' : 'none';
  }

  dispose(): void {
    for (const d of this.disposers) d();
    this.el.remove();
  }
}
