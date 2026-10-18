/**
 * 배경 · 장식(컨셉 아트 맞추기): 먼 도시 · 야자수 · 바위산 · 구름, 둥근 모래주머니 더미, 박공지붕.
 * 판정(충돌 · 엄폐)과는 상관없는 "보이기만 하는" 것들이라 인스턴싱으로 한 번에 그린다.
 */
import * as THREE from 'three';

export interface SceneryCtx {
  group: THREE.Group;
  disposables: { dispose(): void }[];
  shadows: boolean;
  quality: 'high' | 'medium' | 'low';
}

/** 재현 가능한 난수 */
function rng(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** 플레이 구역(적 기지 · 건물) – 배경 물체를 두지 않는다 */
const inPlay = (x: number, z: number) => Math.abs(x) < 82 && z > -150 && z < 30;

/** 먼 도시: 낮은 베이지 건물 수백 채 + 드문 고층 · 굴뚝 */
export function addCity(ctx: SceneryCtx): void {
  const r = rng(11);
  const N = ctx.quality === 'low' ? 320 : 560;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  ctx.disposables.push(geo, mat);
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  const palette = [0xd9c3a1, 0xcdb18b, 0xe4d4b6, 0xc2a37f, 0xd6b690, 0xb3a28c, 0xe8dcc6, 0xa98d70];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  let i = 0;
  while (i < N) {
    const t = r() * Math.PI * 2;
    const rad = 150 + Math.pow(r(), 0.7) * 210;
    const x = Math.cos(t) * rad, z = -60 + Math.sin(t) * rad;
    if (inPlay(x, z)) continue;
    const tower = r() < 0.05;
    const w = 6 + r() * 14, d = 6 + r() * 14;
    const h = tower ? 24 + r() * 26 : 3.5 + r() * r() * 14;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t + (r() - 0.5) * 0.3);
    m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(w, h, d));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setHex(palette[Math.floor(r() * palette.length)]));
    i++;
  }
  ctx.group.add(mesh);
  // 굴뚝 · 급수탑 실루엣
  const chimGeo = new THREE.CylinderGeometry(1.2, 1.6, 1, 8);
  chimGeo.translate(0, 0.5, 0);
  ctx.disposables.push(chimGeo);
  const chim = new THREE.InstancedMesh(chimGeo, mat, 10);
  for (let k = 0; k < 10; k++) {
    const t = Math.PI + 0.3 + r() * (Math.PI - 0.6);
    const rad = 200 + r() * 120;
    m.compose(new THREE.Vector3(Math.cos(t) * rad, 0, -60 + Math.sin(t) * rad), new THREE.Quaternion(), new THREE.Vector3(1, 30 + r() * 25, 1));
    chim.setMatrixAt(k, m);
    chim.setColorAt(k, c.setHex(0x9a8a78));
  }
  ctx.group.add(chim);
}

/** 야자수: 줄기 + 늘어진 잎 7장(인스턴스) */
export function addPalms(ctx: SceneryCtx, spots: [number, number][]): void {
  const r = rng(5);
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  // 잎: 밑동에서 바깥으로 뻗어 끝이 처지는 납작한 판
  const leafGeo = new THREE.BoxGeometry(0.55, 0.05, 3.4, 1, 1, 4);
  leafGeo.translate(0, 0, 1.7);
  const pos = leafGeo.getAttribute('position') as THREE.BufferAttribute;
  for (let k = 0; k < pos.count; k++) {
    const zz = pos.getZ(k);
    pos.setY(k, pos.getY(k) - zz * zz * 0.09);
    pos.setX(k, pos.getX(k) * (1 - zz / 4.2));
  }
  leafGeo.computeVertexNormals();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a634a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x5d7a3c });
  ctx.disposables.push(trunkGeo, leafGeo, trunkMat, leafMat);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, spots.length * 7);
  const m = new THREE.Matrix4();
  spots.forEach(([x, z], i) => {
    const h = 7 + r() * 5;
    const lean = new THREE.Euler((r() - 0.5) * 0.18, 0, (r() - 0.5) * 0.18);
    const q = new THREE.Quaternion().setFromEuler(lean);
    m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, h, 1));
    trunks.setMatrixAt(i, m);
    const top = new THREE.Vector3(0, h, 0).applyQuaternion(q).add(new THREE.Vector3(x, 0, z));
    for (let k = 0; k < 7; k++) {
      const lq = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35 + r() * 0.3, (k / 7) * Math.PI * 2 + r() * 0.4, 0, 'YXZ'));
      const s = 0.8 + r() * 0.4;
      m.compose(top, lq, new THREE.Vector3(s, 1, s));
      leaves.setMatrixAt(i * 7 + k, m);
    }
  });
  trunks.castShadow = leaves.castShadow = ctx.shadows;
  ctx.group.add(trunks, leaves);
}

/** 바위산 능선: 원을 따라 둘러친 띠, 꼭대기를 들쭉날쭉하게 + 면을 각지게(flatShading) */
export function addMountains(ctx: SceneryCtx): void {
  const layers = [
    { r: 430, base: 26, amp: 46, color: 0xd2b096, seed: 3 },
    { r: 560, base: 40, amp: 70, color: 0xe2cab4, seed: 9 },
  ];
  for (const L of layers) {
    const rr = rng(L.seed);
    const seg = 220, rows = 5;
    const ph = [rr() * 6, rr() * 6, rr() * 6, rr() * 6];
    const heights: number[] = [];
    for (let i = 0; i <= seg; i++) {
      const t = (i / seg) * Math.PI * 2;
      let h = L.base + L.amp * (0.5 + 0.3 * Math.sin(t * 3 + ph[0]) + 0.18 * Math.sin(t * 7 + ph[1]) + 0.1 * Math.sin(t * 17 + ph[2]) + 0.06 * Math.sin(t * 41 + ph[3]));
      // 플레이어 앞(북쪽)은 조금 낮춰 하늘이 보이게
      if (Math.sin(t) < 0) h *= 0.85;
      heights.push(Math.max(8, h + (rr() - 0.5) * 8));
    }
    const verts: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= seg; i++) {
      const t = (i / seg) * Math.PI * 2;
      for (let j = 0; j <= rows; j++) {
        const v = j / rows;
        // 아래는 바깥으로 넓게, 위로 갈수록 안쪽으로 – 산비탈
        const rad = L.r + (1 - v) * 60 + (rr() - 0.5) * 14 * (j > 0 && j < rows ? 1 : 0);
        const y = -6 + heights[i] * Math.pow(v, 0.8) + (j > 0 && j < rows ? (rr() - 0.5) * 6 : 0);
        verts.push(Math.cos(t) * rad, y, -60 + Math.sin(t) * rad);
      }
    }
    for (let i = 0; i < seg; i++) {
      for (let j = 0; j < rows; j++) {
        const a = i * (rows + 1) + j, b = a + rows + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // 멀리 있는 산은 대기에 묻혀 밝게 보인다 → 자체 발광으로 그늘을 띄운다
    const mat = new THREE.MeshLambertMaterial({ color: L.color, emissive: new THREE.Color(L.color).multiplyScalar(0.38), flatShading: true, fog: false, side: THREE.DoubleSide });
    ctx.disposables.push(g, mat);
    ctx.group.add(new THREE.Mesh(g, mat));
  }
}

/** 구름: 부드러운 덩어리 텍스처를 쓴 판(노을빛) */
export function addClouds(ctx: SceneryCtx, sunDir: THREE.Vector3): void {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 128;
  const g = cv.getContext('2d')!;
  const r = rng(21);
  for (let k = 0; k < 26; k++) {
    const x = 40 + r() * 176, y = 50 + r() * 40 - Math.abs(x - 128) * 0.12, rad = 14 + r() * 26;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  ctx.disposables.push(tex);
  const sunAz = Math.atan2(sunDir.z, sunDir.x);
  for (let k = 0; k < 16; k++) {
    // 해 쪽 구름은 금빛, 반대쪽은 분홍빛 흰색
    const t = Math.PI + 0.15 + r() * (Math.PI - 0.3) + (k < 4 ? 0 : 0);
    const near = Math.cos(t - sunAz);
    const color = new THREE.Color(0xfff2e2).lerp(new THREE.Color(0xffb46a), Math.max(0, near) * 0.8);
    const mat = new THREE.SpriteMaterial({ map: tex, color, fog: false, transparent: true, depthWrite: false, opacity: 0.75 + r() * 0.2 });
    ctx.disposables.push(mat);
    const s = new THREE.Sprite(mat);
    const rad = 650 + r() * 350;
    s.position.set(Math.cos(t) * rad, 150 + r() * 230, -60 + Math.sin(t) * rad);
    const w = 160 + r() * 220;
    s.scale.set(w, w * (0.28 + r() * 0.12), 1);
    s.renderOrder = -0.5;
    ctx.group.add(s);
  }
}

/** 둥근 모래주머니를 벽돌처럼 쌓은 모양(충돌 상자는 따로) – 모아 두었다가 build()로 한 번에 그린다 */
export class SandbagStacks {
  private mats: THREE.Matrix4[] = [];
  private readonly r = rng(17);

  /** x,z 중심 · 길이 w(x축) · 높이 h · 두께 d */
  row(x: number, z: number, w: number, h: number, d: number, rotY = 0): void {
    const bagL = 0.62, bagH = 0.25, bagD = d / 2;
    const layers = Math.max(1, Math.round(h / bagH));
    const q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    for (let L = 0; L < layers; L++) {
      const n = Math.max(1, Math.floor(w / bagL));
      const off = L % 2 ? bagL / 2 : 0;
      for (let k = 0; k < n - (L % 2); k++) {
        for (const side of [-1, 1]) {
          const lx = -w / 2 + bagL / 2 + k * bagL + off + (this.r() - 0.5) * 0.04;
          const lz = (side * bagD) / 2;
          const p = new THREE.Vector3(lx, bagH / 2 + L * bagH * 0.96, lz).applyQuaternion(q0).add(new THREE.Vector3(x, 0, z));
          const q = q0.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (this.r() - 0.5) * 0.12));
          this.mats.push(new THREE.Matrix4().compose(p, q, new THREE.Vector3(bagL * 1.04, bagH * 1.1, bagD * 1.05)));
        }
      }
    }
  }

  build(ctx: SceneryCtx): void {
    if (!this.mats.length) return;
    const geo = new THREE.SphereGeometry(0.5, 9, 5);
    // 아랫면을 납작하게(쌓인 자루처럼)
    const p = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) if (p.getY(k) < -0.2) p.setY(k, -0.2 - (p.getY(k) + 0.2) * 0.3);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0xb69d72, roughness: 0.95, metalness: 0 });
    ctx.disposables.push(geo, mat);
    const mesh = new THREE.InstancedMesh(geo, mat, this.mats.length);
    const c = new THREE.Color();
    this.mats.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.setHSL(0.11, 0.3 + this.r() * 0.12, 0.5 + this.r() * 0.12));
    });
    mesh.castShadow = mesh.receiveShadow = ctx.shadows;
    ctx.group.add(mesh);
  }
}

/** 박공지붕(용마루가 x축): 너비 w, 깊이 d, 높이 rise, 처마 o */
export function gableRoofGeometry(w: number, d: number, rise: number, o = 0.5, tile = 3): THREE.BufferGeometry {
  const hw = w / 2 + o, hd = d / 2 + o;
  const th = 0.12;
  // 양쪽 경사면 두 장(두께 있는 판) + 양끝 삼각 벽
  const v: number[] = [];
  const uv: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d2: number[], ua: number[], ub: number[], uc: number[], ud: number[]) => {
    v.push(...a, ...b, ...c, ...a, ...c, ...d2);
    uv.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud);
  };
  const slope = Math.hypot(hd, rise);
  for (const s of [-1, 1]) {
    const eave = [s * hd, 0];
    const ridge = [0, rise];
    // 윗면
    const A = [-hw, eave[1] + th, eave[0]], B = [hw, eave[1] + th, eave[0]], C = [hw, ridge[1] + th, ridge[0]], D = [-hw, ridge[1] + th, ridge[0]];
    const U = (x: number, l: number) => [x / tile, l / tile];
    if (s > 0) quad(A, B, C, D, U(-hw, 0), U(hw, 0), U(hw, slope), U(-hw, slope));
    else quad(B, A, D, C, U(hw, 0), U(-hw, 0), U(-hw, slope), U(hw, slope));
    // 아랫면(처마 밑에서 보일 때)
    const a = [-hw, eave[1], eave[0]], b = [hw, eave[1], eave[0]], c = [hw, ridge[1], ridge[0]], d = [-hw, ridge[1], ridge[0]];
    if (s > 0) quad(b, a, d, c, U(hw, 0), U(-hw, 0), U(-hw, slope), U(hw, slope));
    else quad(a, b, c, d, U(-hw, 0), U(hw, 0), U(hw, slope), U(-hw, slope));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** 박공 끝 삼각벽(지붕 아래 벽 위) */
export function gableEndGeometry(d: number, rise: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0);
  s.lineTo(d / 2, 0);
  s.lineTo(0, rise);
  s.closePath();
  const g = new THREE.ShapeGeometry(s);
  // ShapeGeometry는 XY 평면 → 벽면(YZ 평면)으로
  g.rotateY(Math.PI / 2);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / 4, uv.getY(k) / 4);
  return g;
}
