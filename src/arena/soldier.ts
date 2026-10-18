/**
 * 사실적인 적 병사(3D 모델: 소총을 겨눈 자세).
 * 모델을 "윗몸 + 왼다리 + 오른다리"로 잘라 다리만 엉덩이를 축으로 흔들어 걷게 한다.
 * (리깅된 모델은 관절 위치가 메시와 어긋나 팔이 망가져서, 자세가 정해진 모델을 쓰는 쪽이 훨씬 깔끔하다)
 * 쓰러짐 · 숙이기는 발 기준 회전 · 낮추기. 모델이 없으면 null → 코드로 만든 사람 모양.
 */
import * as THREE from 'three';
import { bakedMeshes } from './models';

export type SoldierLook = 'rifle' | 'rusher' | 'sniper' | 'heavy';

/** 종류별 색(텍스처에 곱함 – 원본은 빨간 전투복) */
const TINT: Record<SoldierLook, number> = { rifle: 0xffffff, rusher: 0xffc28a, sniper: 0xb9c2a6, heavy: 0x8a8a8a };
const HEIGHT = 1.78;
/** 다리를 자르는 높이(엉덩이) */
const HIP_Y = 0.9;

interface Parts {
  upper: THREE.BufferGeometry;
  legL: THREE.BufferGeometry;
  legR: THREE.BufferGeometry;
  material: THREE.Material;
  hipX: number;
}

let parts: Parts | null | undefined;
const tinted = new Map<SoldierLook, THREE.Material>();

/** 모델을 한 번만 손질: 앞(+Z) 맞추기 · 키 맞추기 · 세 덩어리로 자르기 */
function prepare(): Parts | null {
  if (parts !== undefined) return parts;
  const meshes = bakedMeshes('soldier');
  if (!meshes.length) return (parts = null);
  const geo = meshes[0].geometry.index ? meshes[0].geometry.toNonIndexed() : meshes[0].geometry.clone();
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const h = bb.max.y - bb.min.y;
  // 발 중심(몸의 축)과, 소총 높이에서 가장 멀리 튀어나온 점(총구) → 그쪽이 앞
  const feet = new THREE.Vector2();
  let nf = 0;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < bb.min.y + h * 0.12) {
      feet.x += pos.getX(i);
      feet.y += pos.getZ(i);
      nf++;
    }
  }
  feet.divideScalar(Math.max(1, nf));
  let far = 0;
  const fwd = new THREE.Vector2(0, 1);
  for (let i = 0; i < pos.count; i++) {
    const y = (pos.getY(i) - bb.min.y) / h;
    if (y < 0.65 || y > 0.9) continue;
    const dx = pos.getX(i) - feet.x, dz = pos.getZ(i) - feet.y;
    const d = Math.hypot(dx, dz);
    if (d > far) {
      far = d;
      fwd.set(dx, dz).normalize();
    }
  }
  // 앞이 +Z가 되게 돌리고(atan2(x, z) = 앞의 yaw), 발 중심을 원점 · 바닥을 0으로, 키를 1.78m로
  const s = HEIGHT / h;
  const yaw = Math.atan2(fwd.x, fwd.y);
  const m = new THREE.Matrix4().makeScale(s, s, s);
  m.multiply(new THREE.Matrix4().makeRotationY(-yaw));
  m.multiply(new THREE.Matrix4().makeTranslation(-feet.x, -bb.min.y, -feet.y));
  geo.applyMatrix4(m);
  // 엉덩이 아래 삼각형은 왼 · 오른 다리로(가운데 기준 x 부호), 나머지는 윗몸
  const p = geo.getAttribute('position') as THREE.BufferAttribute;
  const groups: Record<'upper' | 'legL' | 'legR', number[]> = { upper: [], legL: [], legR: [] };
  let hipX = 0, nh = 0;
  for (let t = 0; t < p.count; t += 3) {
    const cy = (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3;
    const cx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3;
    if (cy < HIP_Y) {
      groups[cx >= 0 ? 'legL' : 'legR'].push(t);
      if (cy > HIP_Y - 0.15) {
        hipX += Math.abs(cx);
        nh++;
      }
    } else groups.upper.push(t);
  }
  const pick = (tris: number[]) => {
    const g = new THREE.BufferGeometry();
    for (const name of Object.keys(geo.attributes)) {
      const a = geo.getAttribute(name) as THREE.BufferAttribute;
      const out = new Float32Array(tris.length * 3 * a.itemSize);
      tris.forEach((t, k) => {
        for (let v = 0; v < 3; v++) for (let c = 0; c < a.itemSize; c++) out[(k * 3 + v) * a.itemSize + c] = a.array[(t + v) * a.itemSize + c];
      });
      g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize, a.normalized));
    }
    g.computeBoundingSphere();
    return g;
  };
  return (parts = { upper: pick(groups.upper), legL: pick(groups.legL), legR: pick(groups.legR), material: meshes[0].material, hipX: nh ? hipX / nh : 0.1 });
}

export interface SoldierVisual {
  root: THREE.Group;
  /** 쓰러질 때 발 기준으로 기우는 축 */
  pivot: THREE.Group;
  update(dt: number, o: { moving: boolean; aiming: boolean; speed: number; crouch: number; fall: number }): void;
}

export function createSoldier(look: SoldierLook): SoldierVisual | null {
  const P = prepare();
  if (!P) return null;
  let mat = tinted.get(look);
  if (!mat) {
    mat = P.material.clone();
    (mat as THREE.MeshStandardMaterial).color?.multiply(new THREE.Color(TINT[look]));
    tinted.set(look, mat);
  }
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  const body = new THREE.Group();
  root.add(pivot);
  pivot.add(body);
  const mk = (g: THREE.BufferGeometry) => {
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    return m;
  };
  body.add(mk(P.upper));
  // 다리: 엉덩이 관절을 축으로 돌도록 한 단계 감싼다
  const leg = (g: THREE.BufferGeometry, x: number) => {
    const hip = new THREE.Group();
    hip.position.set(x, HIP_Y, 0);
    const m = mk(g);
    m.position.set(-x, -HIP_Y, 0);
    hip.add(m);
    body.add(hip);
    return hip;
  };
  const legL = leg(P.legL, P.hipX), legR = leg(P.legR, -P.hipX);
  let phase = Math.random() * 6;
  let swing = 0;

  return {
    root,
    pivot,
    update(dt, o) {
      swing += ((o.moving && o.fall === 0 ? 1 : 0) - swing) * Math.min(1, dt * 8);
      if (o.moving) phase += dt * (3 + o.speed * 1.5);
      const a = Math.sin(phase) * 0.55 * swing;
      legL.rotation.x = a;
      legR.rotation.x = -a;
      // 걸을 때 몸이 살짝 오르내림 · 숙이면 낮아짐(아래는 엄폐물에 가려진다)
      body.position.y = Math.abs(Math.cos(phase)) * 0.04 * swing - o.crouch * 0.5;
    },
  };
}
