/**
 * 명시적 상태 머신. 허용되지 않은 전환은 무시하고 false를 돌려준다.
 * → 메뉴 연타·중복 이벤트로 상태가 꼬이는 것을 구조적으로 막는다.
 */
export class StateMachine<S extends string> {
  private current: S;
  private readonly transitions: Record<S, readonly S[]>;
  private readonly listeners: ((to: S, from: S) => void)[] = [];

  constructor(initial: S, transitions: Record<S, readonly S[]>) {
    this.current = initial;
    this.transitions = transitions;
  }

  get state(): S {
    return this.current;
  }

  is(...states: S[]): boolean {
    return states.includes(this.current);
  }

  can(to: S): boolean {
    return this.transitions[this.current].includes(to);
  }

  go(to: S): boolean {
    if (!this.can(to)) return false;
    const from = this.current;
    this.current = to;
    for (const l of this.listeners) l(to, from);
    return true;
  }

  onChange(fn: (to: S, from: S) => void): () => void {
    this.listeners.push(fn);
    return () => {
      const i = this.listeners.indexOf(fn);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }
}

export type GameState = 'loading' | 'menu' | 'briefing' | 'playing' | 'paused' | 'result';

/** 게임 상태 흐름: loading → menu → briefing → playing ⇄ paused → result → (playing | briefing | menu) */
export const GAME_TRANSITIONS: Record<GameState, readonly GameState[]> = {
  loading: ['menu'],
  menu: ['briefing'],
  briefing: ['playing', 'menu'],
  playing: ['paused', 'result', 'playing'],
  paused: ['playing', 'menu', 'briefing'],
  result: ['playing', 'briefing', 'menu'],
};
