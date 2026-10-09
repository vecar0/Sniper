/**
 * 정밀 저격총 모델(1인칭·장비 미리보기 공용).
 * 실제 치수(미터)에 가깝게 만들고, 금속은 PBR 재질(metalness/roughness) + 환경맵으로 광택을 낸다.
 * 총구 방향은 -Z.
 */
import * as THREE from 'three';
import type { WeaponSpec } from '../../config/weapons';

export interface RifleRig {
  group: THREE.Group;
  bolt: THREE.Group;
  elevKnob: THREE.Group;
  windKnob: THREE.Group;
  mag: THREE.Group;
  /** 총구 끝 위치(로컬) – 섬광 위치 */
  muzzle: THREE.Vector3;
  dispose(): void;
}

interface Look {
  chassis: number;
  accent: number;
  barrelScale: number;
  slim: number;
  brake: 'compact' | 'large';
}

const LOOKS: Record<string, Look> = {
  r308: { chassis: 0x9c8565, accent: 0x2a2b2d, barrelScale: 1, slim: 1, brake: 'compact' },
  k65: { chassis: 0x2c2e31, accent: 0x6d7378, barrelScale: 0.95, slim: 0.92, brake: 'compact' },
  l338: { chassis: 0x4c573b, accent: 0x262729, barrelScale: 1.22, slim: 1.12, brake: 'large' },
};

export function buildRifle(weapon: WeaponSpec, suppressor: boolean): RifleRig {
  const look = LOOKS[weapon.id] ?? LOOKS.r308;
  const disposables: { dispose(): void }[] = [];
  const std = (color: number, metalness: number, roughness: number) => {
    const m = new THREE.MeshStandardMaterial({ color, metalness, roughness, flatShading: false });
    disposables.push(m);
    return m;
  };
  const chassis = std(look.chassis, 0.35, 0.55);
  const metal = std(0x25272b, 0.85, 0.32);
  const anod = std(0x15161a, 0.55, 0.42);
  const accent = std(look.accent, 0.7, 0.38);
  const rubber = std(0x101112, 0, 0.92);
  const lens = new THREE.MeshStandardMaterial({ color: 0x0a1a2c, metalness: 1, roughness: 0.05, emissive: 0x0c2a44, emissiveIntensity: 0.6 });
  disposables.push(lens);

  const group = new THREE.Group();
  const bolt = new THREE.Group();
  const elevKnob = new THREE.Group();
  const windKnob = new THREE.Group();
  const mag = new THREE.Group();

  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = group, rx = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    disposables.push(g);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    parent.add(m);
    return m;
  };
  /** z축 방향 원통(앞뒤) */
  const tube = (r0: number, r1: number, len: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = group, seg = 16) => {
    const g = new THREE.CylinderGeometry(r0, r1, len, seg);
    g.rotateX(Math.PI / 2);
    disposables.push(g);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  /** y축 방향 원통(위아래) */
  const knob = (r: number, h: number, mat: THREE.Material, parent: THREE.Object3D, y = 0, seg = 18) => {
    const g = new THREE.CylinderGeometry(r, r, h, seg);
    disposables.push(g);
    const m = new THREE.Mesh(g, mat);
    m.position.y = y;
    parent.add(m);
    return m;
  };

  const s = look.slim;
  const bl = look.barrelScale;

  // ── 몸통(섀시·리시버)
  tube(0.021 * s, 0.021 * s, 0.24, metal, 0, 0.002, -0.07);
  box(0.062 * s, 0.07, 0.44, chassis, 0, -0.03, -0.08);
  box(0.058 * s, 0.062, 0.36 * bl, chassis, 0, -0.012, -0.47 * bl + 0.03);
  // 핸드가드 M-LOK 홈
  for (let i = 0; i < 5; i++) {
    for (const sx of [-1, 1]) box(0.004, 0.012, 0.034, anod, sx * 0.03 * s, -0.012, -0.32 - i * 0.055 * bl);
  }
  // 레일 + 홈
  box(0.022, 0.012, 0.36, anod, 0, 0.03, -0.1);
  for (let i = 0; i < 16; i++) box(0.024, 0.005, 0.006, metal, 0, 0.038, 0.06 - i * 0.021);

  // ── 총열·소염기/소음기
  const barrelLen = 0.46 * bl;
  const barrelStart = -0.62 * bl + 0.05;
  tube(0.0115 * s, 0.0145 * s, barrelLen, metal, 0, 0.002, barrelStart - barrelLen / 2 + 0.23);
  const muzzleZ = barrelStart - barrelLen + 0.23;
  let muzzleEnd: number;
  if (suppressor) {
    const len = 0.24;
    tube(0.024, 0.024, len, anod, 0, 0.002, muzzleZ - len / 2, group, 20);
    tube(0.025, 0.025, 0.02, metal, 0, 0.002, muzzleZ - 0.01, group, 20);
    tube(0.025, 0.022, 0.015, metal, 0, 0.002, muzzleZ - len, group, 20);
    muzzleEnd = muzzleZ - len;
  } else {
    const bw = look.brake === 'large' ? 0.04 : 0.032;
    const bL = look.brake === 'large' ? 0.1 : 0.07;
    box(bw, bw * 0.85, bL, metal, 0, 0.002, muzzleZ - bL / 2);
    for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) box(0.004, bw * 0.55, 0.012, rubber, (sx * bw) / 2, 0.002, muzzleZ - 0.015 - i * (bL / 3.3));
    muzzleEnd = muzzleZ - bL;
  }

  // ── 스코프
  const sy = 0.086;
  tube(0.0172, 0.0172, 0.27, anod, 0, sy, -0.09, group, 20);
  tube(0.029, 0.0172, 0.06, anod, 0, sy, -0.255, group, 20); // 대물 벨
  tube(0.029, 0.029, 0.075, anod, 0, sy, -0.322, group, 20); // 선셰이드
  tube(0.026, 0.026, 0.002, lens, 0, sy, -0.358, group, 20);
  tube(0.0205, 0.0172, 0.05, anod, 0, sy, 0.07, group, 20); // 접안부
  tube(0.022, 0.022, 0.06, anod, 0, sy, 0.12, group, 20);
  tube(0.0225, 0.0225, 0.014, rubber, 0, sy, 0.155, group, 20); // 아이컵
  tube(0.019, 0.019, 0.002, lens, 0, sy, 0.163, group, 20);
  // 링 마운트
  for (const z of [-0.19, 0.0]) {
    tube(0.021, 0.021, 0.018, metal, 0, sy, z);
    box(0.03, 0.04, 0.018, metal, 0, 0.058, z);
  }
  // 고각 터렛(위) – 홈이 파인 손잡이 + 눈금 표시
  elevKnob.position.set(0, sy + 0.03, -0.085);
  knob(0.0165, 0.028, accent, elevKnob, 0, 24);
  knob(0.0175, 0.008, metal, elevKnob, -0.01, 24);
  box(0.003, 0.03, 0.006, std(0xf2f2f2, 0, 0.5), 0, 0, 0.016, elevKnob);
  group.add(elevKnob);
  // 좌우 터렛(오른쪽)
  windKnob.position.set(0.03, sy, -0.085);
  windKnob.rotation.z = -Math.PI / 2;
  knob(0.015, 0.022, accent, windKnob, 0, 24);
  box(0.003, 0.024, 0.006, std(0xf2f2f2, 0, 0.5), 0, 0, 0.014, windKnob);
  group.add(windKnob);
  // 시차 조절(왼쪽)
  const para = new THREE.Group();
  para.position.set(-0.028, sy, -0.085);
  para.rotation.z = Math.PI / 2;
  knob(0.019, 0.016, anod, para, 0, 24);
  group.add(para);
  // 배율 링
  tube(0.024, 0.024, 0.02, accent, 0, sy, 0.035, group, 24);

  // ── 볼트
  bolt.position.set(0.024 * s, 0.006, 0.03);
  const shaft = tube(0.005, 0.005, 0.06, metal, 0.03, 0, 0, bolt);
  shaft.rotation.y = Math.PI / 2;
  const kg = new THREE.SphereGeometry(0.013, 12, 8);
  disposables.push(kg);
  const k = new THREE.Mesh(kg, rubber);
  k.position.set(0.06, -0.004, 0.006);
  bolt.add(k);
  group.add(bolt);

  // ── 방아쇠·손잡이·탄창
  box(0.012, 0.03, 0.06, metal, 0, -0.07, 0.02);
  const grip = box(0.034, 0.11, 0.048, rubber, 0, -0.105, 0.075, group, 0.32);
  grip.castShadow = false;
  box(0.042, 0.085, 0.09, anod, 0, -0.085, -0.075, mag);
  box(0.044, 0.012, 0.094, metal, 0, -0.125, -0.075, mag);
  group.add(mag);

  // ── 개머리판(스켈레톤형)
  box(0.05, 0.1, 0.07, chassis, 0, -0.035, 0.155);
  box(0.038 * s, 0.03, 0.3, chassis, 0, 0.005, 0.3);
  const lower = box(0.034 * s, 0.03, 0.28, chassis, 0, -0.085, 0.31, group, -0.06);
  lower.rotation.x = -0.08;
  box(0.036, 0.04, 0.13, accent, 0, 0.034, 0.27); // 볼받침
  box(0.046, 0.15, 0.03, rubber, 0, -0.04, 0.455); // 개머리판 패드
  box(0.02, 0.08, 0.02, metal, 0, -0.12, 0.38); // 후방 지지대

  // ── 양각대
  const bipodZ = -0.5 * bl;
  box(0.04, 0.02, 0.03, metal, 0, -0.07, bipodZ);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.016, -0.075, bipodZ);
    leg.rotation.set(-0.55, 0, sx * 0.22);
    const lg = new THREE.CylinderGeometry(0.0055, 0.0055, 0.2, 8);
    disposables.push(lg);
    const lm = new THREE.Mesh(lg, metal);
    lm.position.y = -0.1;
    leg.add(lm);
    const fg = new THREE.BoxGeometry(0.018, 0.012, 0.03);
    disposables.push(fg);
    const fm = new THREE.Mesh(fg, rubber);
    fm.position.y = -0.205;
    leg.add(fm);
    group.add(leg);
  }

  return {
    group,
    bolt,
    elevKnob,
    windKnob,
    mag,
    muzzle: new THREE.Vector3(0, 0.002, muzzleEnd),
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
