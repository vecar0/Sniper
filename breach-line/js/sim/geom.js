// 작은 수학 도우미.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

export function angleWrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
// yaw=0 → -z 방향(three.js 카메라 기본 방향과 같음)
export function yawTo(fromX, fromZ, toX, toZ) { return Math.atan2(-(toX - fromX), -(toZ - fromZ)); }
export function dirFromYawPitch(yaw, pitch) {
  const cp = Math.cos(pitch);
  return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
}
export function turnToward(cur, target, maxStep) {
  const d = angleWrap(target - cur);
  if (Math.abs(d) <= maxStep) return target;
  return cur + Math.sign(d) * maxStep;
}
export const dist2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// 선분(시작 o, 방향 d 단위벡터, 길이 len) vs 수직 원기둥(중심 cx,cz, 반지름 rad, 높이 0~h).
// 맞으면 {t, y} (t는 거리).
export function rayCylinder(o, d, len, cx, cz, rad, h) {
  const ox = o.x - cx; const oz = o.z - cz;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-9) return null;
  const b = 2 * (ox * d.x + oz * d.z);
  const c = ox * ox + oz * oz - rad * rad;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
    if (t < 0 || t > len) continue;
    const y = o.y + d.y * t;
    if (y >= 0 && y <= h) return { t, y };
  }
  // 위에서 내려다보는 경우(뚜껑)
  if (Math.abs(d.y) > 1e-6) {
    const t = (h - o.y) / d.y;
    if (t >= 0 && t <= len) {
      const px = ox + d.x * t; const pz = oz + d.z * t;
      if (px * px + pz * pz <= rad * rad) return { t, y: h };
    }
  }
  return null;
}

// 선분 vs 구(연막 판정용) — 선분이 구 안을 지나는지
export function segmentHitsSphere(x0, y0, z0, x1, y1, z1, cx, cy, cz, rad) {
  const dx = x1 - x0; const dy = y1 - y0; const dz = z1 - z0;
  const L2 = dx * dx + dy * dy + dz * dz;
  let t = L2 > 0 ? ((cx - x0) * dx + (cy - y0) * dy + (cz - z0) * dz) / L2 : 0;
  t = clamp(t, 0, 1);
  const px = x0 + dx * t - cx; const py = y0 + dy * t - cy; const pz = z0 + dz * t - cz;
  return px * px + py * py + pz * pz <= rad * rad;
}
