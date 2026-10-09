/**
 * 로우폴리 인물 모델. 판정(targets.ts의 BOT_ZONES)과 같은 비율로 만든다.
 * 외형(outfit)으로 역할이 구별되어야 한다: 스코프 속 몇십 픽셀로도 식별 가능한 큰 색 면을 쓴다.
 */
import * as THREE from 'three';
import type { OutfitId } from '../../config/missions';

export interface OutfitSpec {
  top: number;
  bottom: number;
  skin: number;
  boots: number;
  head: 'helmet' | 'beret' | 'cap' | 'none' | 'hood';
  headColor: number;
  vest?: number;
  tie?: number;
  glasses?: boolean;
  backpack?: number;
  rifle?: boolean;
  coat?: number;
}

export const OUTFITS: Record<OutfitId, OutfitSpec> = {
  guard: { top: 0x4f5a3a, bottom: 0x464f34, skin: 0xc79a78, boots: 0x22201c, head: 'helmet', headColor: 0x3d4630, vest: 0x2e3326, rifle: true },
  guardDesert: { top: 0xb39a6c, bottom: 0xa08a60, skin: 0xb88762, boots: 0x5a4a36, head: 'helmet', headColor: 0x9c8660, vest: 0x6e5f44, rifle: true },
  guardSnow: { top: 0xdfe4e8, bottom: 0xc9d0d6, skin: 0xd2a684, boots: 0x3a3a3a, head: 'hood', headColor: 0xe8ecef, vest: 0x8a949c, rifle: true },
  hvtSuit: { top: 0xf2f0ea, bottom: 0xe8e6de, skin: 0xd8ac88, boots: 0x2a1e18, head: 'none', headColor: 0x2a2420, tie: 0xc0202a, glasses: true },
  hvtOfficer: { top: 0x1e2226, bottom: 0x1a1d20, skin: 0xc8977a, boots: 0x111111, head: 'beret', headColor: 0xb3121c, tie: 0x111111 },
  courier: { top: 0x6b4426, bottom: 0x35373c, skin: 0xc49272, boots: 0x2a2420, head: 'none', headColor: 0x2a201a, backpack: 0x1c1c1c },
  civilian: { top: 0x3a6ea8, bottom: 0x3a4658, skin: 0xd4a382, boots: 0x4a3a2a, head: 'cap', headColor: 0xc8b07a },
  civilianRed: { top: 0xb03a32, bottom: 0x4a4a50, skin: 0xc49272, boots: 0x3a2e24, head: 'cap', headColor: 0xd8d0c0 },
  scientist: { top: 0x8aa0b8, bottom: 0x3e434a, skin: 0xe0b896, boots: 0x222222, head: 'none', headColor: 0x6a5a48, coat: 0xf4f6f8, glasses: true },
};

export interface HumanRig {
  root: THREE.Group;
  /** 쓰러짐 애니메이션용(발 기준 회전) */
  body: THREE.Group;
  head: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  /** 경계 시 붉게 빛나는 부분(가슴 무전기 LED) */
  alertLight: THREE.Mesh;
}

/** 재질 캐시: 같은 색은 하나의 재질을 공유 */
export class HumanMaterials {
  private cache = new Map<number, THREE.MeshLambertMaterial>();
  readonly geoCache = new Map<string, THREE.BufferGeometry>();
  readonly ledOff = new THREE.MeshBasicMaterial({ color: 0x2a3a20 });
  readonly ledOn = new THREE.MeshBasicMaterial({ color: 0xff2a1a });

  mat(color: number): THREE.MeshLambertMaterial {
    let m = this.cache.get(color);
    if (!m) {
      m = new THREE.MeshLambertMaterial({ color, flatShading: true });
      this.cache.set(color, m);
    }
    return m;
  }

  box(w: number, h: number, d: number): THREE.BufferGeometry {
    const k = `b${w},${h},${d}`;
    let g = this.geoCache.get(k);
    if (!g) {
      g = new THREE.BoxGeometry(w, h, d);
      this.geoCache.set(k, g);
    }
    return g;
  }

  geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let g = this.geoCache.get(key);
    if (!g) {
      g = make();
      this.geoCache.set(key, g);
    }
    return g;
  }

  dispose(): void {
    for (const m of this.cache.values()) m.dispose();
    for (const g of this.geoCache.values()) g.dispose();
    this.ledOff.dispose();
    this.ledOn.dispose();
    this.cache.clear();
    this.geoCache.clear();
  }
}

export function buildHuman(outfit: OutfitId, mats: HumanMaterials): HumanRig {
  const o = OUTFITS[outfit];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const add = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, parent: THREE.Object3D = body) => {
    const m = new THREE.Mesh(geo, mats.mat(color));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // 머리
  const head = new THREE.Group();
  head.position.set(0, 1.62, 0);
  body.add(head);
  add(mats.geo('head', () => new THREE.IcosahedronGeometry(0.115, 1)), o.skin, 0, 0.04, 0, head);
  add(mats.box(0.2, 0.06, 0.2), o.headColor, 0, 0.13, -0.01, head); // 머리카락/모자 바닥
  if (o.head === 'helmet') {
    add(mats.geo('helmet', () => new THREE.SphereGeometry(0.14, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2)), o.headColor, 0, 0.07, 0, head);
  } else if (o.head === 'beret') {
    const b = add(mats.geo('beret', () => new THREE.CylinderGeometry(0.13, 0.12, 0.05, 8)), o.headColor, -0.02, 0.15, 0, head);
    b.rotation.z = 0.2;
  } else if (o.head === 'cap') {
    add(mats.geo('cap', () => new THREE.CylinderGeometry(0.12, 0.12, 0.07, 8)), o.headColor, 0, 0.14, 0, head);
    add(mats.box(0.16, 0.015, 0.1), o.headColor, 0, 0.11, 0.1, head);
  } else if (o.head === 'hood') {
    add(mats.geo('hood', () => new THREE.SphereGeometry(0.145, 8, 6)), o.headColor, 0, 0.05, -0.02, head);
  }
  if (o.glasses) add(mats.box(0.17, 0.035, 0.03), 0x101214, 0, 0.06, 0.105, head);

  // 몸통
  add(mats.box(0.1, 0.08, 0.1), o.skin, 0, 1.5, 0); // 목
  add(mats.box(0.42, 0.36, 0.24), o.top, 0, 1.33, 0); // 가슴
  add(mats.box(0.36, 0.28, 0.21), o.top, 0, 1.03, 0); // 복부
  add(mats.box(0.36, 0.12, 0.22), o.bottom, 0, 0.86, 0); // 골반
  if (o.vest) {
    add(mats.box(0.45, 0.42, 0.28), o.vest, 0, 1.25, 0);
    // 탄창 주머니
    for (const x of [-0.12, 0, 0.12]) add(mats.box(0.08, 0.1, 0.05), o.vest, x, 1.16, 0.15);
  }
  if (o.coat) {
    add(mats.box(0.44, 0.7, 0.26), o.coat, 0, 1.13, 0);
    add(mats.box(0.4, 0.3, 0.24), o.coat, 0, 0.66, 0);
  }
  if (o.tie) add(mats.box(0.05, 0.28, 0.02), o.tie, 0, 1.33, 0.125);
  if (o.backpack) add(mats.box(0.34, 0.44, 0.16), o.backpack, 0, 1.25, -0.2);
  const alertLight = new THREE.Mesh(mats.box(0.04, 0.04, 0.02), mats.ledOff);
  alertLight.position.set(0.12, 1.42, 0.13 + (o.vest ? 0.03 : 0));
  body.add(alertLight);

  // 팔·다리(어깨/엉덩이 피벗)
  const limb = (x: number, y: number, len: number, w: number, color: number, end: number, endH: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    body.add(pivot);
    add(mats.box(w, len, w * 1.05), color, 0, -len / 2, 0, pivot);
    add(mats.box(w * 0.95, endH, w * (endH > 0.1 ? 1.6 : 1)), end, 0, -len - endH / 2 + 0.02, endH > 0.1 ? 0.04 : 0, pivot);
    return pivot;
  };
  const armL = limb(-0.29, 1.49, 0.52, 0.11, o.coat ?? o.top, o.skin, 0.09);
  const armR = limb(0.29, 1.49, 0.52, 0.11, o.coat ?? o.top, o.skin, 0.09);
  const legL = limb(-0.1, 0.84, 0.74, 0.15, o.bottom, o.boots, 0.12);
  const legR = limb(0.1, 0.84, 0.74, 0.15, o.bottom, o.boots, 0.12);

  // 경비병 소총(가슴 앞에 비스듬히)
  if (o.rifle) {
    const gun = new THREE.Group();
    gun.position.set(0.02, 1.18, 0.2);
    // 총 길이(z축)를 가로로 눕힌 뒤(y) 대각선으로 기울인다(z) – 'ZYX' 순서는 x→y→z 순으로 적용
    gun.rotation.set(0, Math.PI / 2, 0.6, 'ZYX');
    add(mats.box(0.05, 0.08, 0.7), 0x1b1d1f, 0, 0, 0, gun);
    add(mats.box(0.04, 0.12, 0.06), 0x1b1d1f, 0, -0.08, 0.05, gun);
    add(mats.box(0.05, 0.07, 0.2), 0x3a3226, 0, -0.02, -0.38, gun);
    body.add(gun);
  }

  // 발밑 그림자(지면 접지감)
  const shadow = new THREE.Mesh(mats.geo('shadow', () => new THREE.CircleGeometry(0.42, 12)), shadowMaterial());
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  root.add(shadow);

  return { root, body, head, armL, armR, legL, legR, alertLight };
}

let _shadowMat: THREE.MeshBasicMaterial | null = null;
function shadowMaterial(): THREE.MeshBasicMaterial {
  if (!_shadowMat) _shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
  return _shadowMat;
}
