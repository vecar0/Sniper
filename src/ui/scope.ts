/**
 * 스코프 오버레이: 원형 시야 + 밀(mil) 레티클(전초점 FFP).
 * FFP이므로 레티클 눈금은 배율과 상관없이 항상 실제 각도(mil)와 일치한다.
 */
import type { ReticleColor } from '../core/save';
import type { HudSnapshot } from '../game/game';

const COLORS: Record<ReticleColor, { line: string; glow: string; text: string }> = {
  black: { line: '#0b0b0b', glow: 'rgba(255,255,255,0.35)', text: '#0b0b0b' },
  red: { line: '#ff2a2a', glow: 'rgba(0,0,0,0.5)', text: '#ff4a4a' },
  lime: { line: '#c8ff3a', glow: 'rgba(0,0,0,0.55)', text: '#d8ff6a' },
  white: { line: '#ffffff', glow: 'rgba(0,0,0,0.6)', text: '#ffffff' },
};

export class ScopeOverlay {
  readonly el: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly status: HTMLDivElement;
  private color: ReticleColor = 'black';
  private lastKey = '';

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'scope';
    this.el.innerHTML = '<canvas class="scope-reticle"></canvas><div class="scope-mask"></div><div class="scope-status"></div>';
    parent.appendChild(this.el);
    this.canvas = this.el.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.status = this.el.querySelector('.scope-status')!;
  }

  setColor(c: ReticleColor): void {
    this.color = c;
    this.lastKey = '';
  }

  update(h: HudSnapshot): void {
    const t = h.scopeT;
    const visible = t > 0.5;
    this.el.style.display = t > 0.01 ? 'block' : 'none';
    this.el.style.opacity = String(Math.min(1, Math.max(0, (t - 0.4) / 0.6)));
    if (!visible) return;
    this.el.classList.toggle('busy', h.busy);
    this.status.textContent = h.status === '재장전 중' || h.status === '볼트 조작 중' ? h.status : '';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.el.clientWidth;
    const hh = this.el.clientHeight;
    const key = `${w}x${hh}@${dpr}:${h.pxPerMil.toFixed(3)}:${this.color}:${h.elev}:${h.wind}:${h.predicted ? `${h.predicted.x.toFixed(2)},${h.predicted.y.toFixed(2)}` : ''}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(hh * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(hh * dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hh);
    const cx = w / 2;
    const cy = hh / 2;
    const ppm = h.pxPerMil;
    const radius = Math.min(w, hh) * 0.46;
    const col = COLORS[this.color];
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    const drawPass = (stroke: string, widthAdd: number) => {
      ctx.strokeStyle = stroke;
      ctx.lineCap = 'butt';
      // 굵은 바깥 기둥(중앙 10mil 밖)
      const gap = 10 * ppm;
      ctx.lineWidth = 4 + widthAdd;
      ctx.beginPath();
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx - gap, cy);
      ctx.moveTo(cx + gap, cy);
      ctx.lineTo(cx + radius, cy);
      ctx.moveTo(cx, cy + gap);
      ctx.lineTo(cx, cy + radius);
      ctx.moveTo(cx, cy - gap);
      ctx.lineTo(cx, cy - radius);
      ctx.stroke();
      // 가는 십자선
      ctx.lineWidth = 1.2 + widthAdd;
      ctx.beginPath();
      ctx.moveTo(cx - gap, cy);
      ctx.lineTo(cx + gap, cy);
      ctx.moveTo(cx, cy - gap);
      ctx.lineTo(cx, cy + gap);
      ctx.stroke();
      // 눈금: 1mil 긴 눈금, 0.5mil 짧은 눈금
      ctx.lineWidth = 1 + widthAdd;
      ctx.beginPath();
      for (let m = -10; m <= 10; m += 0.5) {
        if (m === 0) continue;
        if (!Number.isInteger(m) && ppm < 8) continue;
        const len = Number.isInteger(m) ? (m % 2 === 0 ? 7 : 5) : 3;
        const p = m * ppm;
        ctx.moveTo(cx + p, cy - len);
        ctx.lineTo(cx + p, cy + len);
        ctx.moveTo(cx - len, cy + p);
        ctx.lineTo(cx + len, cy + p);
      }
      ctx.stroke();
      // 아래쪽 홀드오버 격자(2~10mil 아래, 좌우 1mil 간격 점)
      if (ppm > 6) {
        for (let dy = 2; dy <= 10; dy += 1) {
          const y = cy + dy * ppm;
          const span = Math.min(5, Math.floor(dy / 2) + 1);
          for (let dx = -span; dx <= span; dx++) {
            if (dx === 0) continue;
            ctx.beginPath();
            ctx.arc(cx + dx * ppm, y, Math.max(0.9, 1 + widthAdd / 2), 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    };
    drawPass(col.glow, 1.6);
    drawPass(col.line, 0);
    // 숫자(2mil마다)
    ctx.fillStyle = col.text;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (ppm > 9) {
      for (let m = 2; m <= 10; m += 2) {
        const p = m * ppm;
        ctx.fillText(String(m), cx + p, cy - 14);
        ctx.fillText(String(m), cx - p, cy - 14);
        ctx.fillText(String(m), cx + 16, cy + p);
      }
    }
    // 중앙 점(조명식 – 어두운 배경에서도 보이게)
    ctx.fillStyle = 'rgba(255, 60, 40, 0.95)';
    ctx.shadowColor = 'rgba(255, 60, 40, 0.8)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 예상 탄착점(훈련병)
    if (h.predicted) {
      const px = cx + h.predicted.x * ppm;
      const py = cy - h.predicted.y * ppm;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#3cf0ff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#3cf0ff';
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`예상 탄착 ${Math.round(h.predicted.dist)}m`, px + 9, py);
    }
    ctx.restore();
    // 접안부 링 판독값
    ctx.font = '13px "Share Tech Mono", ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(232, 163, 61, 0.9)';
    const wl = h.wind === 0 ? '0.0' : `${Math.abs(h.wind).toFixed(1)}${h.wind > 0 ? 'R' : 'L'}`;
    const lx = cx - radius * 0.66;
    const ly = cy + radius * 0.6;
    ctx.fillText(`${h.zoom.toFixed(1)}×`, lx, ly);
    ctx.fillText(`E ${h.elev.toFixed(1)}`, lx, ly + 16);
    ctx.fillText(`W ${wl}`, lx, ly + 32);
  }
}
