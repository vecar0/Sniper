/**
 * 구급상자(회복 아이템) – 체력은 저절로 차지 않고, 땅 위 엄폐물 뒤에 놓인 구급상자를 주워야 회복된다.
 * 옥상에는 두지 않아서 체력이 떨어지면 내려와 엄폐물 사이를 오가게 만든다.
 */
import * as THREE from 'three';
import type { NavGrid } from './map';

export const MEDKIT = {
  heal: 40,
  /** 동시에 놓여 있는 최대 개수 */
  max: 4,
  /** 줍는 거리(m) */
  reach: 1.4,
};

/** 놓일 수 있는 자리(엄폐물의 플레이어 쪽 = 남쪽 면) */
const SPOTS: [number, number][] = [
  [-6, -10.4], [16, -8.4], [-22, -12.8], [26, -16.8], [-12, -26.8], [11, -28.8], [-34, -23], [36, -23],
  [-24, -36.4], [24, -36.6], [-2, -34.6], [8, -38.6], [2, -48.8], [-30, -44.8], [30, -46.4], [-18, -53.6], [20, -56.6],
];

interface Kit {
  pos: THREE.Vector3;
  obj: THREE.Group;
  spot: number;
}

export class Medkits {
  readonly group = new THREE.Group();
  kits: Kit[] = [];
  private readonly spots: THREE.Vector3[];
  private readonly proto: THREE.Group;
  private t = 0;

  constructor(nav: NavGrid) {
    this.spots = SPOTS.map(([x, z]) => new THREE.Vector3(x, 0, z)).filter((p) => nav.free(p.x, p.z));
    this.proto = makeKit();
  }

  /** 모두 치우고 n개 놓기 */
  reset(n: number): void {
    for (const k of this.kits) k.obj.removeFromParent();
    this.kits = [];
    this.fill(n);
  }

  /** 모자란 만큼 빈 자리에 새로 놓는다(웨이브 시작마다) */
  fill(n: number): void {
    const want = Math.min(MEDKIT.max, n);
    const used = new Set(this.kits.map((k) => k.spot));
    const free = this.spots.map((_, i) => i).filter((i) => !used.has(i));
    while (this.kits.length < want && free.length) {
      const i = free.splice(Math.floor(Math.random() * free.length), 1)[0];
      const obj = this.proto.clone();
      obj.position.copy(this.spots[i]);
      this.group.add(obj);
      this.kits.push({ pos: this.spots[i].clone(), obj, spot: i });
    }
  }

  /** 플레이어 발 위치 근처의 상자를 줍는다(체력이 가득이면 줍지 않음). 주웠으면 true */
  update(dt: number, feet: THREE.Vector3, canPick: boolean): boolean {
    this.t += dt;
    let picked = false;
    for (const k of this.kits) {
      const box = k.obj.children[0];
      box.position.y = 0.32 + Math.sin(this.t * 2.4 + k.spot) * 0.06;
      box.rotation.y += dt * 1.4;
    }
    if (canPick) {
      const i = this.kits.findIndex((k) => Math.hypot(k.pos.x - feet.x, k.pos.z - feet.z) < MEDKIT.reach && Math.abs(feet.y - k.pos.y) < 1.5);
      if (i >= 0) {
        this.kits[i].obj.removeFromParent();
        this.kits.splice(i, 1);
        picked = true;
      }
    }
    return picked;
  }
}

/** 흰 상자 + 빨간 십자 + 멀리서도 보이는 초록 빛기둥 */
function makeKit(): THREE.Group {
  const g = new THREE.Group();
  const box = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 });
  const red = new THREE.MeshStandardMaterial({ color: 0xd8261c, roughness: 0.5, emissive: 0x5a0804 });
  box.add(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.3, 0.36), white));
  // 십자: 윗면 · 앞뒤 면
  for (const [w, h, d, y, z] of [[0.3, 0.02, 0.08, 0.16, 0], [0.08, 0.02, 0.3, 0.16, 0], [0.24, 0.07, 0.02, 0, 0.185], [0.07, 0.22, 0.02, 0, 0.185], [0.24, 0.07, 0.02, 0, -0.185], [0.07, 0.22, 0.02, 0, -0.185]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), red);
    m.position.set(0, y, z);
    box.add(m);
  }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0x333333 }));
  handle.position.y = 0.15;
  box.add(handle);
  box.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  g.add(box);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.32, 5, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x6dff8a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
  );
  beam.position.y = 2.5;
  g.add(beam);
  return g;
}
