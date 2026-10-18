// 코드로 만드는 타일 텍스처(외부 파일 없음). 크기는 2의 거듭제곱, 밉맵 사용.
import * as THREE from '../../vendor/three.module.js';

function canvasTex(size, draw, repeat = 1) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function noise(ctx, s, amt, alpha = 0.06) {
  for (let i = 0; i < amt; i++) {
    const v = Math.random() * 255 | 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

export function makeTextures(size) {
  const floor = canvasTex(size, (ctx, s) => {
    ctx.fillStyle = '#6d6a63'; ctx.fillRect(0, 0, s, s);
    const n = 4; const q = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = 100 + ((x + y) % 2) * 8 + Math.random() * 6;
      ctx.fillStyle = `rgb(${v},${v - 3},${v - 9})`;
      ctx.fillRect(x * q + 1, y * q + 1, q - 2, q - 2);
    }
    noise(ctx, s, s * 6);
    ctx.strokeStyle = 'rgba(30,30,30,0.5)'; ctx.lineWidth = 2;
    for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(i * q, 0); ctx.lineTo(i * q, s); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * q); ctx.lineTo(s, i * q); ctx.stroke(); }
  });
  const wall = canvasTex(size, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#a29d92'); g.addColorStop(0.7, '#958f84'); g.addColorStop(0.72, '#4b4f55'); g.addColorStop(1, '#3f4348');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    noise(ctx, s, s * 10, 0.05);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, s * 0.70, s, 3);
  });
  const crate = canvasTex(size / 2, (ctx, s) => {
    ctx.fillStyle = '#7a5a36'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#4e3820'; ctx.lineWidth = s / 16;
    ctx.strokeRect(s / 32, s / 32, s - s / 16, s - s / 16);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s, s); ctx.stroke();
    for (let i = 1; i < 4; i++) { ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, (i * s) / 4, s, 2); }
    noise(ctx, s, s * 4);
  });
  const concrete = canvasTex(size / 2, (ctx, s) => {
    ctx.fillStyle = '#7f8186'; ctx.fillRect(0, 0, s, s);
    noise(ctx, s, s * 12, 0.08);
  });
  const ceiling = canvasTex(size / 2, (ctx, s) => {
    ctx.fillStyle = '#58585a'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, s - 2, s - 2);
    noise(ctx, s, s * 3);
  });
  const smoke = canvasTex(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(220,220,220,0.9)'); g.addColorStop(1, 'rgba(220,220,220,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });
  const spark = canvasTex(32, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.4, 'rgba(255,200,90,0.7)'); g.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });
  const blob = canvasTex(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });
  for (const t of [smoke, spark, blob]) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }
  return { floor, wall, crate, concrete, ceiling, smoke, spark, blob };
}
