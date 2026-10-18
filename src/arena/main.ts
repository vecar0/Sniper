/**
 * 옥상 저격전 진입점: 로딩 → 맵·게임·UI 생성 → 메뉴.
 */
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';
import '@fontsource/share-tech-mono/400.css';
import './arena.css';
import { AudioEngine } from '../audio/audio';
import { ArenaGame } from './game';
import { ArenaInput, TouchPad } from './input';
import { ArenaUI } from './ui';

function setProgress(p: number, text: string): void {
  const bar = document.querySelector<HTMLElement>('.loading-bar i');
  const label = document.querySelector<HTMLElement>('.loading-text');
  if (bar) bar.style.transform = `scaleX(${p})`;
  if (label) label.textContent = text;
}

function showFatal(err: unknown): void {
  console.error(err);
  const el = document.getElementById('fatal');
  if (!el) return;
  el.style.display = 'flex';
  const msg = el.querySelector('.fatal-msg');
  if (msg) msg.textContent = err instanceof Error ? err.message : String(err);
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** GPU가 없는 환경(소프트웨어 렌더링)은 그림자를 끈다 */
function detectQuality(touch: boolean): 'high' | 'medium' | 'low' {
  // ?q=high 처럼 직접 고를 수 있다(화면 확인용)
  const forced = new URLSearchParams(location.search).get('q');
  if (forced === 'high' || forced === 'medium' || forced === 'low') return forced;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'low';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    if (/swiftshader|llvmpipe|software/i.test(name)) return 'low';
  } catch {
    return 'low';
  }
  return touch ? 'medium' : 'high';
}

async function boot(): Promise<void> {
  setProgress(0.2, '조작 준비 중…');
  await nextFrame();
  const root = document.getElementById('app')!;
  const gameEl = document.getElementById('game')!;
  const input = new ArenaInput(gameEl);
  const audio = new AudioEngine();
  setProgress(0.45, '기지 건설 중…');
  await nextFrame();
  const quality = detectQuality(input.isTouch);
  const game = new ArenaGame(gameEl, input, audio, quality);
  setProgress(0.8, '셰이더 준비 중…');
  await nextFrame();
  game.renderer.compile(game.scene, game.camera);
  const touch = input.isTouch ? new TouchPad(root, input) : null;
  touch?.setVisible(false);
  const ui = new ArenaUI(root, game, input, audio, touch);
  game.start();
  setProgress(1, '완료');
  await nextFrame();
  document.getElementById('loading')?.classList.add('done');
  window.setTimeout(() => document.getElementById('loading')?.remove(), 500);
  audio.startMusic();
  if (new URLSearchParams(location.search).has('test')) {
    (window as unknown as { __arena: unknown }).__arena = { game, ui, input, audio };
  }
}

window.addEventListener('error', (e) => showFatal(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => showFatal(e.reason));
boot().catch(showFatal);
