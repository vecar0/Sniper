/**
 * 전술 지도(위에서 본 평면도): 사수 위치, 거리 고리, 표적 예상 위치, 구조물, 구간별 바람.
 * 작전 표적은 "예상 구역"(원)으로만 보여준다 – 정확한 위치는 현장에서 관측해야 한다.
 */
import type { MissionDef } from '../config/missions';

const C = {
  bg: '#0c1114',
  grid: 'rgba(160, 190, 170, 0.08)',
  ring: 'rgba(200, 220, 200, 0.22)',
  text: 'rgba(214, 226, 218, 0.75)',
  amber: '#e8a33d',
  red: '#ff5a4a',
  blue: '#6cb4ff',
  prop: 'rgba(170, 180, 175, 0.5)',
  wind: '#7fd3c8',
};

export function drawTacticalMap(canvas: HTMLCanvasElement, m: MissionDef): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 300;
  const h = canvas.clientHeight || 300;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, w, h);
  // 격자
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
  const maxD = Math.max(...m.targets.map((t) => t.dist)) * 1.12;
  const sy = h - 26;
  const scale = (sy - 22) / maxD;
  const sx = w / 2;
  const P = (x: number, d: number) => [sx + x * scale * 2.2, sy - d * scale] as const; // 좌우는 2.2배 과장(가독성)

  // 시야 부채꼴
  ctx.fillStyle = 'rgba(232, 163, 61, 0.05)';
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx - w * 0.5, 0);
  ctx.lineTo(sx + w * 0.5, 0);
  ctx.closePath();
  ctx.fill();

  // 거리 고리
  ctx.font = '600 10px "Share Tech Mono", ui-monospace, monospace';
  ctx.textAlign = 'left';
  const step = maxD > 900 ? 250 : maxD > 500 ? 200 : 100;
  for (let d = step; d < maxD; d += step) {
    const r = d * scale;
    ctx.strokeStyle = C.ring;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.ellipse(sx, sy, r * 2.2, r, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = C.text;
    ctx.fillText(`${d}m`, sx + 4, sy - r - 3);
  }

  // 구조물
  ctx.fillStyle = C.prop;
  for (const p of m.props) {
    if (p.kind === 'road') {
      const [x0, y0] = P(p.x - p.w / 2, p.dist);
      const [x1] = P(p.x + p.w / 2, p.dist);
      ctx.fillStyle = 'rgba(180, 160, 120, 0.25)';
      ctx.fillRect(x0, y0 - 2, x1 - x0, 4);
      ctx.fillStyle = C.prop;
      continue;
    }
    const [x, y] = P(p.x, p.dist);
    const pw = Math.max(3, p.w * scale * 2.2);
    const ph = Math.max(3, p.d * scale);
    ctx.fillRect(x - pw / 2, y - ph / 2, pw, ph);
  }

  // 바람(구간별 화살표)
  m.wind.zones.forEach((z, i) => {
    const next = m.wind.zones[i + 1]?.from ?? maxD;
    const mid = Math.min(maxD * 0.95, (z.from + next) / 2);
    const [x, y] = P(-(w / 2 / (scale * 2.2)) * 0.78, mid);
    const a = (z.dir * Math.PI) / 180;
    const len = 8 + z.speed * 3;
    const dx = Math.sin(a) * len;
    const dy = Math.cos(a) * len; // 화면 위 = 전방
    ctx.strokeStyle = C.wind;
    ctx.fillStyle = C.wind;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - dx / 2, y + dy / 2);
    ctx.lineTo(x + dx / 2, y - dy / 2);
    ctx.stroke();
    const ang = Math.atan2(-dy, dx);
    ctx.beginPath();
    ctx.moveTo(x + dx / 2, y - dy / 2);
    ctx.lineTo(x + dx / 2 - Math.cos(ang - 0.5) * 6, y - dy / 2 - Math.sin(ang - 0.5) * 6);
    ctx.lineTo(x + dx / 2 - Math.cos(ang + 0.5) * 6, y - dy / 2 - Math.sin(ang + 0.5) * 6);
    ctx.fill();
    ctx.font = '600 10px "Share Tech Mono", ui-monospace, monospace';
    ctx.fillText(z.speed > 0 ? `${z.speed.toFixed(1)}` : '0', x + 10, y + 4);
  });

  // 표적
  const intelOnly = m.category === 'operation' || m.category === 'contract';
  for (const t of m.targets) {
    const [x, y] = P(t.x, t.dist);
    if (t.kind === 'plate') {
      ctx.fillStyle = '#e9ece6';
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    const role = t.role ?? 'guard';
    const col = role === 'hvt' ? C.red : role === 'civilian' ? C.blue : C.amber;
    if (intelOnly) {
      // 예상 구역(흐릿한 원)
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.55;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.arc(x + Math.sin(t.dist) * 2, y + Math.cos(t.x) * 2, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = col;
    ctx.beginPath();
    if (role === 'hvt') {
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x + 5, y);
      ctx.lineTo(x, y + 5);
      ctx.lineTo(x - 5, y);
      ctx.closePath();
    } else ctx.arc(x, y, role === 'civilian' ? 2.6 : 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 사수
  ctx.fillStyle = '#d6e2da';
  ctx.beginPath();
  ctx.moveTo(sx, sy - 8);
  ctx.lineTo(sx + 6, sy + 4);
  ctx.lineTo(sx - 6, sy + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.text;
  ctx.textAlign = 'center';
  ctx.fillText('SNIPER', sx, sy + 17);
  // 범례
  ctx.textAlign = 'right';
  const legend: [string, string][] = [
    ['◆ 핵심 표적', C.red],
    ['● 경비', C.amber],
    ['● 민간인', C.blue],
    ['→ 바람 m/s', C.wind],
  ];
  legend.forEach(([label, col], i) => {
    ctx.fillStyle = col;
    ctx.fillText(label, w - 8, 14 + i * 13);
  });
}
