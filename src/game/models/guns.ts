/**
 * 실내 화기 모델(권총 · 기관단총 · 카빈) + 부착물이 실제로 보이게 만든다.
 * 총구 방향 -Z, 원점은 손잡이 위(쥐는 곳). sightY = 조준선 높이(조준 시 화면 중앙에 오는 높이).
 */
import * as THREE from 'three';
import type { CqbSpec, PartChoice } from '../../config/sidearms';

export interface GunRig {
  group: THREE.Group;
  mag: THREE.Group;
  /** 권총 슬라이드(발사 시 뒤로) */
  slide: THREE.Group;
  muzzle: THREE.Vector3;
  sightY: number;
  dispose(): void;
}

export function buildCqbGun(spec: CqbSpec, parts: PartChoice): GunRig {
  const disposables: { dispose(): void }[] = [];
  const std = (color: number, metalness: number, roughness: number, emissive = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive });
    disposables.push(m);
    return m;
  };
  const body = std(spec.color, 0.45, 0.5);
  const metal = std(0x1d1f22, 0.85, 0.35);
  const polymer = std(0x141517, 0.1, 0.8);
  const tan = std(0x8a7a5c, 0.2, 0.7);
  const red = std(0xff2020, 0, 0.5, 0xff2020);
  const group = new THREE.Group();
  const mag = new THREE.Group();
  const slide = new THREE.Group();
  group.add(slide, mag);
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = group, rx = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    disposables.push(g);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    parent.add(m);
    return m;
  };
  const cyl = (r: number, len: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = group, seg = 12) => {
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    g.rotateX(Math.PI / 2);
    disposables.push(g);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  /** 속이 빈 사각 틀(도트 사이트) – 조준할 때 가운데가 보여야 한다 */
  const frame = (w: number, h: number, d: number, t: number, y: number, z: number, parent: THREE.Object3D = group) => {
    box(w, t, d, polymer, 0, y + h / 2 - t / 2, z, parent);
    box(w, t, d, polymer, 0, y - h / 2 + t / 2, z, parent);
    box(t, h, d, polymer, -w / 2 + t / 2, y, z, parent);
    box(t, h, d, polymer, w / 2 - t / 2, y, z, parent);
  };
  /** 가늠자: 가운데가 파인 두 기둥 */
  const notch = (gap: number, h: number, top: number, z: number, parent: THREE.Object3D = group) => {
    box(0.006, h, 0.008, metal, -gap / 2 - 0.003, top - h / 2, z, parent);
    box(0.006, h, 0.008, metal, gap / 2 + 0.003, top - h / 2, z, parent);
  };
  let muzzleZ: number;
  let boreY: number;
  let railY: number;
  let railZ: number;
  let sightY: number;
  const extended = parts.mag === 'ext';

  if (spec.kind === 'pistol') {
    boreY = 0.045;
    // 프레임 · 슬라이드 · 손잡이
    box(0.03, 0.026, 0.16, polymer, 0, 0.022, -0.06);
    box(0.034, 0.034, 0.19, body, 0, 0.055, -0.07, slide);
    for (let i = 0; i < 5; i++) box(0.036, 0.024, 0.004, metal, 0, 0.056, 0.0 + i * 0.008, slide);
    box(0.03, 0.11, 0.046, polymer, 0, -0.04, 0.012, group, -0.18);
    box(0.02, 0.012, 0.035, polymer, 0, 0.0, -0.035); // 방아쇠울
    // 탄창 바닥(확장 탄창은 아래로 길게)
    box(0.028, extended ? 0.05 : 0.012, 0.042, metal, 0, extended ? -0.11 : -0.095, 0.028, mag, -0.18);
    muzzleZ = -0.165;
    railY = 0.072;
    railZ = 0.0;
    sightY = 0.08;
    if (parts.optic === 'dot') {
      box(0.026, 0.006, 0.03, polymer, 0, 0.075, 0.0, slide);
      frame(0.028, 0.026, 0.006, 0.003, 0.09, -0.01, slide);
      sightY = 0.09;
    } else {
      box(0.004, 0.008, 0.006, metal, 0, sightY - 0.005, -0.155, slide);
      notch(0.008, 0.01, sightY + 0.002, 0.012, slide);
    }
    if (parts.under === 'laser') {
      box(0.024, 0.022, 0.04, polymer, 0, 0.0, -0.12);
      box(0.004, 0.004, 0.002, red, 0, 0.0, -0.141);
    }
  } else {
    const carbine = spec.kind === 'carbine';
    boreY = 0.04;
    const len = carbine ? 0.3 : 0.26;
    // 몸통
    box(0.05, 0.07, len, body, 0, 0.035, -0.05);
    box(0.054, 0.012, len * 0.9, metal, 0, 0.076, -0.05); // 상부 레일
    for (let i = 0; i < 8; i++) box(0.056, 0.006, 0.006, metal, 0, 0.084, -0.05 - len * 0.4 + i * (len * 0.8) / 7);
    // 총열 덮개 · 총열
    const hgLen = carbine ? 0.26 : 0.12;
    box(0.046, 0.05, hgLen, carbine ? tan : polymer, 0, 0.035, -0.05 - len / 2 - hgLen / 2);
    const barrelEnd = -0.05 - len / 2 - hgLen - (carbine ? 0.09 : 0.04);
    const front = -0.05 - len / 2;
    cyl(0.009, front - barrelEnd, metal, 0, boreY, (front + barrelEnd) / 2);
    muzzleZ = barrelEnd;
    // 손잡이 · 개머리판
    box(0.032, 0.1, 0.045, polymer, 0, -0.04, 0.06, group, -0.25);
    box(0.04, carbine ? 0.08 : 0.05, carbine ? 0.24 : 0.18, polymer, 0, carbine ? 0.02 : 0.035, 0.07 + len / 2 + (carbine ? 0.1 : 0.07));
    // 탄창(카빈은 앞으로 휜 모양)
    const magLen = (carbine ? 0.17 : 0.15) * (extended ? 1.45 : 1);
    const m1 = box(0.026, magLen, 0.05, carbine ? tan : metal, 0, -magLen / 2 + 0.01, -0.07, mag, carbine ? 0.22 : 0);
    if (extended) box(0.03, 0.012, 0.054, metal, 0, -magLen + 0.012, -0.07 - (carbine ? magLen * 0.2 : 0), mag, carbine ? 0.22 : 0);
    void m1;
    railY = 0.082;
    railZ = -0.04;
    sightY = 0.1;
    if (parts.optic === 'dot') {
      box(0.03, 0.008, 0.05, polymer, 0, railY + 0.008, railZ);
      frame(0.036, 0.034, 0.008, 0.004, railY + 0.03, railZ - 0.01);
      sightY = railY + 0.03;
    } else if (parts.optic === 'x2') {
      // 속이 빈 경통(조준하면 둥근 시야)
      const tube = new THREE.CylinderGeometry(0.021, 0.021, 0.13, 16, 1, true);
      tube.rotateX(Math.PI / 2);
      disposables.push(tube);
      const tm = std(0x141517, 0.3, 0.6);
      tm.side = THREE.DoubleSide;
      const t = new THREE.Mesh(tube, tm);
      t.position.set(0, railY + 0.036, railZ);
      group.add(t);
      box(0.012, 0.022, 0.03, metal, 0, railY + 0.008, railZ);
      sightY = railY + 0.036;
    } else {
      notch(0.01, 0.03, railY + 0.026, railZ + len * 0.35);
      box(0.005, 0.03, 0.006, metal, 0, railY + 0.008, barrelEnd + 0.05);
      sightY = railY + 0.026;
    }
    if (parts.under === 'grip') box(0.026, 0.07, 0.03, polymer, 0, -0.025, -0.05 - len / 2 - hgLen * 0.5, group, 0.1);
    if (parts.under === 'laser') {
      box(0.022, 0.024, 0.05, polymer, 0.034, 0.035, -0.05 - len / 2 - hgLen * 0.6);
      box(0.004, 0.004, 0.002, red, 0.034, 0.035, -0.05 - len / 2 - hgLen * 0.6 - 0.026);
    }
  }
  // 총구 부착물
  if (parts.muzzle === 'sup') {
    const L = spec.kind === 'pistol' ? 0.13 : 0.18;
    cyl(spec.kind === 'pistol' ? 0.016 : 0.02, L, metal, 0, boreY, muzzleZ - L / 2);
    muzzleZ -= L;
  } else if (parts.muzzle === 'comp') {
    cyl(0.014, 0.05, metal, 0, boreY, muzzleZ - 0.025, group, 6);
    muzzleZ -= 0.05;
  }
  void railZ;
  return {
    group,
    mag,
    slide,
    muzzle: new THREE.Vector3(0, boreY, muzzleZ),
    sightY,
    dispose() {
      for (const d of disposables) d.dispose();
      group.removeFromParent();
    },
  };
}
