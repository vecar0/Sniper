// 재질 · 텍스처. 생성 텍스처(textures/*.jpg)가 없으면 코드로 만든 텍스처로 대신한다.
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
export const TEX = {};
let maxAniso = 8;

export function setAnisotropy(n) { maxAniso = Math.min(8, n || 1); }

function tiling(tex, srgb) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 파일을 불러오되, 실패하면 대체 캔버스를 그대로 쓴다(같은 Texture 객체에 이미지만 바꿔 끼움)
function loadOr(url, fallbackCanvas, srgb) {
  const tex = tiling(new THREE.CanvasTexture(fallbackCanvas), srgb);
  loader.load(url, (t) => { tex.image = t.image; tex.needsUpdate = true; }, undefined, () => {});
  return tex;
}

// ── 노이즈 캔버스 ────────────────────────────────────────
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, p, s) { // 주기 p로 타일되는 값 노이즈
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(((xi % p) + p) % p, ((yi % p) + p) % p, s), b = hash((((xi + 1) % p) + p) % p, ((yi % p) + p) % p, s);
  const c = hash(((xi % p) + p) % p, (((yi + 1) % p) + p) % p, s), d = hash((((xi + 1) % p) + p) % p, (((yi + 1) % p) + p) % p, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, period, oct = 5, seed = 1) {
  let s = 0, amp = 0.5, f = 1, n = 0;
  for (let o = 0; o < oct; o++) { s += amp * vnoise(x * f, y * f, period * f, seed + o); n += amp; amp *= 0.5; f *= 2; }
  return s / n;
}

function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function noiseCanvas(size, period, fn) {
  const c = canvas(size), g = c.getContext('2d'), img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = fbm((x / size) * period, (y / size) * period, period);
    const [r, gg, b] = fn(n, x, y);
    const i = (y * size + x) * 4;
    img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// 대체 텍스처(작게 — 로딩 전 잠깐만 보이거나 파일이 없을 때)
const FALLBACK = {
  concrete: (s) => noiseCanvas(s, 8, (n) => { const v = 40 + n * 50; return [v, v, v * 1.04]; }),
  plate: (s) => { const c = noiseCanvas(s, 8, (n) => { const v = 45 + n * 30; return [v, v * 1.02, v * 1.06]; }); const g = c.getContext('2d'); g.strokeStyle = 'rgba(160,170,180,0.35)'; g.lineWidth = 2; for (let y = 0; y < s; y += s / 8) for (let x = 0; x < s; x += s / 8) { g.beginPath(); g.moveTo(x + 4, y + 8); g.lineTo(x + 12, y + 2); g.stroke(); } return c; },
  container: (s) => { const c = noiseCanvas(s, 8, (n) => [20 + n * 30, 70 + n * 40, 90 + n * 40]); const g = c.getContext('2d'); for (let x = 0; x < s; x += s / 16) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, 0, s / 48, s); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + s / 32, 0, s / 64, s); } return c; },
  panel: (s) => { const c = noiseCanvas(s, 8, (n) => { const v = 45 + n * 25; return [v, v, v * 1.05]; }); const g = c.getContext('2d'); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, (i * s) / 4); g.lineTo(s, (i * s) / 4); g.stroke(); g.beginPath(); g.moveTo((i * s) / 4, 0); g.lineTo((i * s) / 4, s); g.stroke(); } return c; },
  rust: (s) => noiseCanvas(s, 8, (n) => (n > 0.55 ? [90 + n * 60, 45 + n * 20, 20] : [38 + n * 20, 38 + n * 20, 40 + n * 20])),
};
const FLAT_N = () => { const c = canvas(4); const g = c.getContext('2d'); g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, 4, 4); return c; };
const GREY = (v) => () => { const c = canvas(4); const g = c.getContext('2d'); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, 0, 4, 4); return c; };

export function loadSurface(name, rough = 150) {
  return {
    map: loadOr(`textures/${name}_c.jpg`, FALLBACK[name](128), true),
    normalMap: loadOr(`textures/${name}_n.jpg`, FLAT_N(), false),
    roughnessMap: loadOr(`textures/${name}_r.jpg`, GREY(rough)(), false),
  };
}

// 텍스처 세트를 반복 횟수만 다르게 복제(같은 이미지 공유)
export function withRepeat(set, rx, ry = rx) {
  const out = {};
  for (const k of Object.keys(set)) { const t = set[k].clone(); t.repeat.set(rx, ry); out[k] = t; }
  return out;
}

// 물웅덩이 마스크(옥상 전체에 1번 깔림, 저주파)
export function puddleTexture() {
  const c = noiseCanvas(256, 4, (n) => { const v = Math.max(0, Math.min(1, (n - 0.52) * 7)); return [v * 255, v * 255, v * 255]; });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// 젖은 바닥: 월드 좌표 기준 웅덩이 마스크로 거칠기↓·색↓·노멀 평평하게 + 빗방울 파문
export function wetMaterial(params, opts = {}) {
  const m = new THREE.MeshStandardMaterial(params);
  const uniforms = { uPuddle: { value: opts.puddle }, uTime: opts.time || { value: 0 }, uWet: { value: opts.wet ?? 1 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWPos; uniform sampler2D uPuddle; uniform float uTime; uniform float uWet;
`)
      .replace('#include <map_fragment>', `#include <map_fragment>
float pud = texture2D(uPuddle, vWPos.xz / 56.0 + 0.5).r * uWet * step(vWPos.y, 0.05);
float pudSoft = smoothstep(0.0, 1.0, pud);
diffuseColor.rgb *= mix(1.0, 0.42, pudSoft);
diffuseColor.rgb *= mix(1.0, 0.82, uWet);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor * mix(1.0, 0.62, uWet), 0.035, pudSoft);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = normalize(mix(normal, normalize(vNormal), pudSoft * 0.85));`);
  };
  m.customProgramCacheKey = () => 'wet';
  return m;
}

// ── 스프라이트용 캔버스 ──────────────────────────────────
export function glowTexture(inner = 'rgba(255,255,255,1)', size = 128) {
  const c = canvas(size), g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, inner); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function smokeTexture(size = 128) {
  const c = canvas(size), g = c.getContext('2d'), img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x / size - 0.5, dy = y / size - 0.5, r = Math.hypot(dx, dy) * 2;
    const n = fbm(x / 20, y / 20, 1000, 4, 7);
    const a = Math.max(0, 1 - r) ** 1.5 * (0.5 + n * 0.8);
    const i = (y * size + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.min(255, a * 255);
  }
  g.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}

export function decalTexture(kind, size = 128) {
  const c = canvas(size), g = c.getContext('2d');
  if (kind === 'hole') {
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.18, 'rgba(10,10,12,0.95)'); gr.addColorStop(0.3, 'rgba(40,40,45,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + Math.random(); g.beginPath(); g.moveTo(size / 2, size / 2); g.lineTo(size / 2 + Math.cos(a) * size * 0.3, size / 2 + Math.sin(a) * size * 0.3); g.stroke(); }
  } else {
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = x / size - 0.5, dy = y / size - 0.5, r = Math.hypot(dx, dy) * 2;
      const n = fbm(x / 16, y / 16, 1000, 4, 3);
      const a = Math.max(0, 1 - r * (0.8 + n * 0.5)) ** 0.8;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 8; img.data[i + 3] = a * 230;
    }
    g.putImageData(img, 0, 0);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// 네온 글씨 간판
export function neonSign(text, color, opts = {}) {
  const w = opts.w || 512, h = opts.h || 128;
  const c = canvas(w, h), g = c.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.font = `${opts.weight || 700} ${opts.size || 80}px ${opts.font || "'Rajdhani', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (opts.vertical) {
    const chars = [...text];
    g.translate(w / 2, 0);
    chars.forEach((ch, i) => { g.shadowColor = color; g.shadowBlur = 24; g.fillStyle = color; g.fillText(ch, 0, (i + 0.5) * (h / chars.length)); g.shadowBlur = 0; g.fillStyle = '#fff'; g.globalAlpha = 0.85; g.fillText(ch, 0, (i + 0.5) * (h / chars.length)); g.globalAlpha = 1; });
  } else {
    g.shadowColor = color; g.shadowBlur = 28; g.fillStyle = color; g.fillText(text, w / 2, h / 2);
    g.shadowBlur = 8; g.fillStyle = '#ffffff'; g.globalAlpha = 0.8; g.fillText(text, w / 2, h / 2);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
  return t;
}
