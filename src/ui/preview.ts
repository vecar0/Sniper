/**
 * 브리핑 화면용 작은 3D 미리보기(장비 · 표적 신상).
 * 화면을 떠나면 dispose()로 WebGL 컨텍스트를 반납한다.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export class PreviewStage {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly pivot = new THREE.Group();
  private raf = 0;
  private t = 0;
  private last = 0;
  private disposeObj: (() => void) | null = null;
  private readonly canvas: HTMLCanvasElement;
  private env: THREE.Texture | null = null;
  private alive = true;
  private readonly spin: number;

  constructor(canvas: HTMLCanvasElement, opts: { fov?: number; distance: number; height: number; lookY: number; spin?: number }) {
    this.canvas = canvas;
    this.spin = opts.spin ?? 0.35;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.camera = new THREE.PerspectiveCamera(opts.fov ?? 30, 1, 0.01, 50);
    this.camera.position.set(0, opts.height, opts.distance);
    this.camera.lookAt(0, opts.lookY, 0);
    this.scene.add(this.pivot);
    this.scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x2a2e28, 1.1));
    const key = new THREE.DirectionalLight(0xffe6c8, 2.4);
    key.position.set(2, 3, 2);
    const rim = new THREE.DirectionalLight(0x9fc8ff, 1.6);
    rim.position.set(-2, 1.5, -2.5);
    this.scene.add(key, rim);
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environment = this.env;
      this.scene.environmentIntensity = 0.6;
      pmrem.dispose();
    } catch {
      /* 환경맵 없이도 동작 */
    }
    this.resize();
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.alive) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.t += dt;
      this.pivot.rotation.y = this.t * this.spin + 0.6;
      this.resize();
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private resize(): void {
    const w = this.canvas.clientWidth || 300;
    const h = this.canvas.clientHeight || 200;
    if (this.canvas.width !== Math.round(w * this.renderer.getPixelRatio()) || this.canvas.height !== Math.round(h * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  /** 표시할 물체 교체. dispose는 물체의 소유자가 넘겨준다 */
  show(obj: THREE.Object3D, dispose?: () => void): void {
    this.disposeObj?.();
    this.pivot.clear();
    this.pivot.add(obj);
    this.disposeObj = dispose ?? null;
  }

  dispose(): void {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.disposeObj?.();
    this.env?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
