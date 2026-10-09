/**
 * 진입점: 로딩 화면 → 게임/UI 생성 → 메인 메뉴.
 * 예기치 못한 오류는 빈 화면 대신 안내 화면으로 보여준다.
 */
import './ui/styles.css';
import { AudioEngine } from './audio/audio';
import { MISSIONS } from './config/missions';
import { Input } from './core/input';
import { SaveStore } from './core/save';
import { Game } from './game/game';
import { UI } from './ui/ui';

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

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

async function boot(): Promise<void> {
  if (!webglAvailable()) {
    showFatal(new Error('이 브라우저는 WebGL을 지원하지 않습니다. 최신 Chrome, Edge, Safari, Firefox에서 실행해 주세요.'));
    return;
  }
  setProgress(0.15, '저장 데이터 불러오는 중…');
  await nextFrame();
  const save = new SaveStore();
  const audio = new AudioEngine();
  const root = document.getElementById('app')!;
  const gameEl = document.getElementById('game')!;
  const input = new Input(gameEl, save.data.settings.keys);

  setProgress(0.35, '그래픽 준비 중…');
  await nextFrame();
  const game = new Game(gameEl, save, audio, input);

  setProgress(0.6, '훈련장 지형 생성 중…');
  await nextFrame();
  game.loadBackdrop(MISSIONS[0]);

  setProgress(0.85, '셰이더 준비 중…');
  await nextFrame();
  if (game.world) game.renderer.compile(game.world.scene, game.camera);

  const ui = new UI(root, game, save, audio, input);
  game.fsm.go('menu');
  game.start();
  setProgress(1, '완료');
  await nextFrame();
  document.getElementById('loading')?.classList.add('done');
  window.setTimeout(() => document.getElementById('loading')?.remove(), 500);
  ui.enterMenu();
  if (save.loadWarning) ui.toast(save.loadWarning);
  audio.startMusic();

  // 자동 테스트용 훅(?test 주소에서만)
  if (new URLSearchParams(location.search).has('test')) {
    (window as unknown as { __longshot: unknown }).__longshot = { game, ui, save, input, audio };
  }
}

window.addEventListener('error', (e) => showFatal(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => showFatal(e.reason));
boot().catch(showFatal);
