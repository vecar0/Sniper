// 충돌 · 광선 판정 · 이동 · 길찾기(격자 다익스트라). Three.js 없음 → headless 테스트 가능.
import { ROOF } from '../config/map.js';

const EPS = 1e-4;

export class Geometry {
  constructor(boxes) {
    this.boxes = boxes;
    this.solid = boxes.filter((b) => b.kind !== 'decor');
    this.cell = 0.5;
    this.n = Math.round((ROOF * 2) / this.cell);
    this.buildNav();
  }

  insideRoof(x, z) {
    return x > -ROOF && x < ROOF && z > -ROOF && z < ROOF;
  }

  // ── 광선 ───────────────────────────────────────────────
  // 선분/광선 vs 상자 + 옥상 바닥. 가장 가까운 충돌 {t, nx, ny, nz, box} 또는 null
  raycast(ox, oy, oz, dx, dy, dz, maxT) {
    let best = maxT, hit = null;
    for (const b of this.solid) {
      const r = rayBox(ox, oy, oz, dx, dy, dz, b, best);
      if (r) { best = r.t; hit = r; hit.box = b; }
    }
    if (dy < 0) {
      const t = -oy / dy;
      if (t > 0 && t < best) {
        const x = ox + dx * t, z = oz + dz * t;
        if (this.insideRoof(x, z)) { best = t; hit = { t, nx: 0, ny: 1, nz: 0, box: null }; }
      }
    }
    return hit;
  }

  // 두 점 사이가 막혀 있지 않은가
  los(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return true;
    return !this.raycast(ax, ay, az, dx / len, dy / len, dz / len, len - 0.05);
  }

  // ── 이동 ───────────────────────────────────────────────
  // body: {x,y,z,vy,r,h,grounded}. 수평 이동 후 수직 이동. 낮은 턱은 자동으로 오른다.
  move(body, dx, dz, dt, stepUp = 0.55) {
    // 큰 이동은 나눠서(대시 6m/0.18s → 프레임당 0.55m) 벽을 뚫지 않게
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / (body.r * 0.9)));
    const sx = dx / steps, sz = dz / steps;
    let blockedX = false, blockedZ = false;
    for (let i = 0; i < steps; i++) {
      if (sx) blockedX = this.slide(body, 'x', sx, stepUp) || blockedX;
      if (sz) blockedZ = this.slide(body, 'z', sz, stepUp) || blockedZ;
    }
    // 수직
    const wasGrounded = body.grounded;
    const support = this.supportAt(body.x, body.z, body.r, body.y + 0.06);
    const ny = body.y + body.vy * dt;
    if (body.vy <= 0) {
      if (ny <= support) {
        body.y = support; body.landSpeed = -body.vy; body.vy = 0; body.grounded = true;
      } else if (wasGrounded && support > -Infinity && body.y - support <= stepUp + 0.05 && body.vy > -4) {
        // 계단을 내려갈 때 붙어서 내려가게
        body.y = support; body.vy = 0; body.grounded = true;
      } else {
        body.y = ny; body.grounded = false;
      }
    } else {
      const ceil = this.ceilingAt(body.x, body.z, body.r, body.y + body.h);
      if (ny + body.h >= ceil) { body.y = ceil - body.h - EPS; body.vy = 0; } else body.y = ny;
      body.grounded = false;
    }
    return { blockedX, blockedZ };
  }

  slide(body, axis, d, stepUp) {
    body[axis] += d;
    for (const b of this.solid) {
      if (!this.overlaps(body, b)) continue;
      // 낮은 턱이면 올라선다
      const rise = b.y1 - body.y;
      if (body.grounded && rise > 0 && rise <= stepUp && !this.anyOverlapAt(body, b.y1 + EPS)) {
        body.y = b.y1 + EPS;
        continue;
      }
      if (axis === 'x') body.x = d > 0 ? b.x0 - body.r - EPS : b.x1 + body.r + EPS;
      else body.z = d > 0 ? b.z0 - body.r - EPS : b.z1 + body.r + EPS;
      return true;
    }
    return false;
  }

  overlaps(body, b, y = body.y) {
    return body.x + body.r > b.x0 && body.x - body.r < b.x1 &&
      body.z + body.r > b.z0 && body.z - body.r < b.z1 &&
      y + body.h > b.y0 + EPS && y + 0.02 < b.y1;
  }

  anyOverlapAt(body, y) {
    for (const b of this.solid) if (this.overlaps(body, b, y)) return true;
    return false;
  }

  // 발밑 지지면 높이(maxY 이하 중 가장 높은 면). 없으면 −Infinity
  supportAt(x, z, r, maxY) {
    let s = this.insideRoof(x, z) && maxY >= 0 ? 0 : -Infinity;
    for (const b of this.solid) {
      if (b.y1 <= maxY && b.y1 > s && x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1) s = b.y1;
    }
    return s;
  }

  ceilingAt(x, z, r, minY) {
    let c = Infinity;
    for (const b of this.solid) {
      if (b.y0 >= minY - 0.05 && b.y0 < c && x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1) c = b.y0;
    }
    return c;
  }

  // 점 아래 표면 높이(광선 없이)
  heightAt(x, z) {
    let h = this.insideRoof(x, z) ? 0 : -Infinity;
    for (const b of this.solid) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && b.y1 > h && b.y0 <= h + 0.01) h = b.y1;
    return h;
  }

  // ── 길찾기 격자 ─────────────────────────────────────────
  buildNav() {
    const n = this.n, c = this.cell;
    this.h = new Float32Array(n * n);
    this.clear = new Uint8Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = -ROOF + (i + 0.5) * c, z = -ROOF + (j + 0.5) * c;
      this.h[j * n + i] = this.heightAt(x, z);
    }
    for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
      const k = j * n + i, hk = this.h[k];
      let ok = true;
      for (let dj = -1; dj <= 1 && ok; dj++) for (let di = -1; di <= 1; di++) {
        if (Math.abs(this.h[k + dj * n + di] - hk) > 0.3) { ok = false; break; }
      }
      // 머리 위가 막힌 칸(상자 밑)은 없다고 가정. 키 큰 적(메크)은 물리 충돌이 처리
      this.clear[k] = ok ? 1 : 0;
    }
  }

  cellOf(x, z) {
    const i = Math.floor((x + ROOF) / this.cell), j = Math.floor((z + ROOF) / this.cell);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return -1;
    return j * this.n + i;
  }
  cellCenter(k) {
    const i = k % this.n, j = (k / this.n) | 0;
    return { x: -ROOF + (i + 0.5) * this.cell, z: -ROOF + (j + 0.5) * this.cell, y: this.h[k] };
  }
  connected(a, b) {
    return this.clear[a] && this.clear[b] && Math.abs(this.h[a] - this.h[b]) <= 0.3;
  }

  // 가까운 통과 가능 칸(높이 maxY 이하 우선). 없으면 −1
  nearestClear(x, z, maxY = Infinity, radius = 12) {
    const k0 = this.cellOf(x, z);
    if (k0 >= 0 && this.clear[k0] && this.h[k0] <= maxY + 0.3) return k0;
    const n = this.n;
    const ci = Math.floor((x + ROOF) / this.cell), cj = Math.floor((z + ROOF) / this.cell);
    let best = -1, bd = Infinity;
    for (let r = 1; r <= radius; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= n || j >= n) continue;
        const k = j * n + i;
        if (!this.clear[k] || this.h[k] > maxY + 0.3) continue;
        const d = di * di + dj * dj;
        if (d < bd) { bd = d; best = k; }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  // 목표 칸들에서 모든 칸까지의 거리(다익스트라). out 재사용 가능
  field(targets, out) {
    const n = this.n, N = n * n;
    const dist = out || new Float32Array(N);
    dist.fill(Infinity);
    const heap = this._heap || (this._heap = new MinHeap(N * 4));
    heap.clear();
    for (const t of targets) if (t >= 0) { dist[t] = 0; heap.push(t, 0); }
    const D = Math.SQRT2;
    while (heap.size) {
      const k = heap.popKey(), dk = heap.lastPri;
      if (dk > dist[k]) continue;
      const i = k % n;
      for (let d = 0; d < 8; d++) {
        const di = NB[d * 2], dj = NB[d * 2 + 1];
        const ni = i + di;
        if (ni < 0 || ni >= n) continue;
        const nk = k + dj * n + di;
        if (nk < 0 || nk >= N || !this.connected(k, nk)) continue;
        let cost = 1;
        if (di && dj) {
          if (!this.connected(k, k + di) || !this.connected(k, k + dj * n)) continue;
          cost = D;
        }
        const nd = dk + cost;
        if (nd < dist[nk]) { dist[nk] = nd; heap.push(nk, nd); }
      }
    }
    return dist;
  }

  // 거리장을 따라갈 다음 목표점(몇 칸 앞). 없으면 null
  follow(dist, x, z, look = 3) {
    let k = this.cellOf(x, z);
    if (k < 0) return null;
    if (!isFinite(dist[k])) {
      // 격자 밖(가장자리·상자 위)에 있으면 가까운 연결된 칸으로
      const n = this.n; let best = -1, bd = Infinity;
      const ci = k % n, cj = (k / n) | 0;
      for (let dj = -6; dj <= 6; dj++) for (let di = -6; di <= 6; di++) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= n || j >= n) continue;
        const kk = j * n + i;
        if (!isFinite(dist[kk])) continue;
        const s = di * di + dj * dj + dist[kk] * 0.05;
        if (s < bd) { bd = s; best = kk; }
      }
      return best >= 0 ? this.cellCenter(best) : null;
    }
    const n = this.n;
    for (let s = 0; s < look; s++) {
      let bk = k, bd = dist[k];
      const i = k % n;
      for (let d = 0; d < 8; d++) {
        const di = NB[d * 2], dj = NB[d * 2 + 1];
        if (i + di < 0 || i + di >= n) continue;
        const nk = k + dj * n + di;
        if (nk < 0 || nk >= n * n) continue;
        if (dist[nk] < bd) { bd = dist[nk]; bk = nk; }
      }
      if (bk === k) break;
      k = bk;
    }
    return this.cellCenter(k);
  }
}

const NB = [1, 0, -1, 0, 0, 1, 0, -1, 1, 1, 1, -1, -1, 1, -1, -1];

export function rayBox(ox, oy, oz, dx, dy, dz, b, maxT) {
  let tmin = 0, tmax = maxT, nAxis = -1, nSign = 0;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  const lo = [b.x0, b.y0, b.z0], hi = [b.x1, b.y1, b.z1];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < lo[a] || o[a] > hi[a]) return null;
      continue;
    }
    const inv = 1 / d[a];
    let t1 = (lo[a] - o[a]) * inv, t2 = (hi[a] - o[a]) * inv, s = -1;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
    if (t1 > tmin) { tmin = t1; nAxis = a; nSign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (nAxis < 0) return null; // 시작점이 상자 안
  return { t: tmin, nx: nAxis === 0 ? nSign : 0, ny: nAxis === 1 ? nSign : 0, nz: nAxis === 2 ? nSign : 0 };
}

// 광선 vs 구: 가장 가까운 t 또는 −1
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tc = lx * dx + ly * dy + lz * dz;
  if (tc < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - tc * tc;
  const r2 = r * r;
  if (d2 > r2) return -1;
  return tc - Math.sqrt(r2 - d2);
}

class MinHeap {
  constructor(cap) { this.k = new Int32Array(cap); this.p = new Float32Array(cap); this.size = 0; this.lastPri = 0; }
  clear() { this.size = 0; }
  push(key, pri) {
    if (this.size >= this.k.length) { // 넘치면 늘린다
      const k = new Int32Array(this.k.length * 2); k.set(this.k); this.k = k;
      const p = new Float32Array(this.p.length * 2); p.set(this.p); this.p = p;
    }
    let i = this.size++;
    while (i > 0) {
      const pa = (i - 1) >> 1;
      if (this.p[pa] <= pri) break;
      this.k[i] = this.k[pa]; this.p[i] = this.p[pa]; i = pa;
    }
    this.k[i] = key; this.p[i] = pri;
  }
  popKey() {
    const key = this.k[0]; this.lastPri = this.p[0];
    const lk = this.k[--this.size], lp = this.p[this.size];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= this.size) break;
      if (c + 1 < this.size && this.p[c + 1] < this.p[c]) c++;
      if (this.p[c] >= lp) break;
      this.k[i] = this.k[c]; this.p[i] = this.p[c]; i = c;
    }
    this.k[i] = lk; this.p[i] = lp;
    return key;
  }
}
