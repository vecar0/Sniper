// 재질 · 텍스처. 생성 텍스처(textures/*.jpg)가 없으면 코드로 만든 텍스처로 대신한다. 눈 쌓임 재질(snowMaterial).
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
  // 크기가 다른 이미지로 바꿀 때는 GPU 텍스처를 버리고 새로 만든다(r170은 텍스처 저장 공간 크기가 고정이라
  // 그대로 덮으면 'Offset overflows texture dimensions'로 업로드가 실패하고 대체 텍스처가 남는다)
  loader.load(url, (t) => { tex.dispose(); tex.image = t.image; tex.needsUpdate = true; }, undefined, () => {});
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
  wall: (s) => { const c = noiseCanvas(s, 8, (n) => { const v = 92 + n * 50; return [v, v, v * 1.02]; }); const g = c.getContext('2d'); g.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < s; y += s / 8) g.fillRect(0, y, s, 1); return c; },
  ground: (s) => noiseCanvas(s, 8, (n) => { const v = 110 + n * 40; return [v, v, v * 1.03]; }),
  snow: (s) => noiseCanvas(s, 8, (n) => { const v = 215 + n * 30; return [v * 0.97, v, Math.min(255, v * 1.04)]; }),
  steel: (s) => noiseCanvas(s, 8, (n) => { const v = 60 + n * 30; return [v, v * 1.02, v * 1.05]; }),
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

// 눈 쌓임: 위를 향한 면(월드 법선 y)에만, 월드 좌표 잡음으로 얼룩지게. 바닥은 옹벽·물체 가까이에 더 두껍게(바람에 몰린 눈).
// opts: amount(위 면 덮임 0~1) · drift(바닥에서 벽 쪽으로 몰린 눈) · snow(눈 텍스처 세트) · sparkle
export function snowMaterial(params, opts = {}) {
  const m = new THREE.MeshStandardMaterial(params);
  const u = {
    uSnowMap: { value: opts.snow.map }, uSnowN: { value: opts.snow.normalMap }, uAmount: { value: opts.amount ?? 0.8 },
    uDrift: { value: opts.drift ?? 0 }, uSparkle: { value: opts.sparkle ?? 1 }, uEdge: { value: opts.edge ?? 27.5 },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSW; varying vec3 vSN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSW = (modelMatrix * vec4(transformed, 1.0)).xyz; vSN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vSW; varying vec3 vSN; uniform sampler2D uSnowMap; uniform sampler2D uSnowN; uniform float uAmount, uDrift, uSparkle, uEdge;
float sh2(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float sn2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(sh2(i), sh2(i+vec2(1,0)), f.x), mix(sh2(i+vec2(0,1)), sh2(i+vec2(1,1)), f.x), f.y); }
float snowMask(){
  float up = smoothstep(0.55, 0.9, vSN.y);
  float n = sn2(vSW.xz * 0.9) * 0.45 + sn2(vSW.xz * 3.1) * 0.35 + sn2(vSW.xz * 9.0) * 0.2;
  float cover = up * clamp(uAmount * 0.5 + smoothstep(0.5, 0.85, n) * uAmount * 1.3, 0.0, 1.0); // 얇은 서리 + 군데군데 쌓인 눈
  // 바닥: 옹벽 가까이 몰린 눈(가장자리 3m) — 낮을수록 두껍게
  float wallD = uEdge - max(abs(vSW.x), abs(vSW.z));
  float drift = uDrift * up * smoothstep(3.5, 0.3, wallD + (n - 0.5) * 2.0) * step(vSW.y, 0.2);
  return clamp(max(cover, drift), 0.0, 1.0);
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
float sMask = snowMask();
vec3 snowC = texture2D(uSnowMap, vSW.xz * 0.4).rgb * vec3(0.93, 0.97, 1.05);
diffuseColor.rgb = mix(diffuseColor.rgb, snowC, sMask);`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= 1.0 - sMask;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.62, sMask);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = normalize(mix(normal, normalize(vNormal), sMask * 0.8));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
// 눈 결정 반짝임: 작은 칸마다 하나, 보는 각도가 맞을 때만
{ vec2 cell = floor(vSW.xz * 22.0); float r = sh2(cell + floor(vSW.y * 4.0));
  vec3 V = normalize(vViewPosition);
  float glint = step(0.985, r) * pow(max(0.0, sin(dot(V, vec3(r * 40.0, r * 71.0, r * 13.0)) * 6.0)), 18.0);
  totalEmissiveRadiance += vec3(0.9, 0.95, 1.0) * glint * sMask * uSparkle * 0.35; }`);
  };
  m.customProgramCacheKey = () => 'snow';
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
