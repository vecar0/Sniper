// 로우폴리 사람·총 모델. 상자들을 정점 색으로 칠해 하나의 지오메트리로 합친다 → 사람 1명 = draw call 1개.
import * as THREE from '../../vendor/three.module.js';

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();

// parts: [{ size:[w,h,d], pos:[x,y,z], rot:[x,y,z], color }]
export function mergeBoxes(parts) {
  const pos = []; const nor = []; const col = [];
  const c = new THREE.Color();
  for (const p of parts) {
    const g = new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]).toNonIndexed();
    tmpE.set(...(p.rot || [0, 0, 0]));
    tmpQ.setFromEuler(tmpE);
    tmpM.compose(tmpP.set(...p.pos), tmpQ, tmpS.set(1, 1, 1));
    if (p.pre) tmpM.premultiply(p.pre);
    g.applyMatrix4(tmpM);
    c.set(p.color);
    const pa = g.attributes.position.array; const na = g.attributes.normal.array;
    for (let i = 0; i < pa.length; i += 3) {
      pos.push(pa[i], pa[i + 1], pa[i + 2]); nor.push(na[i], na[i + 1], na[i + 2]);
      // 위쪽 면을 살짝 밝게 → 조명이 단순해도 형태가 읽힌다
      const shade = na[i + 1] > 0.5 ? 1.08 : na[i + 1] < -0.5 ? 0.7 : 0.92;
      col.push(c.r * shade, c.g * shade, c.b * shade);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

const PALETTE = {
  skin: 0xc99a74,
  squad: { body: 0x2b3542, vest: 0x3b4552, helmet: 0x1f262e, pants: 0x262d36, red: 0xc0392b, blue: 0x2e86de },
  pistol: { body: 0x6b4a3a, pants: 0x2b2f3a, mask: 0x1b1b1f },
  rifle: { body: 0x4d5b3b, pants: 0x30323a, mask: 0x222226 },
  heavy: { body: 0x262628, pants: 0x1f2024, mask: 0x111113, vest: 0x3d3f36 },
  hostage: { body: 0xe4dfd2, pants: 0x55657a, hair: 0x3a2a20 },
  civilian: { body: 0xd8b04a, pants: 0x4a4f57, hair: 0x5a3b22 },
  gun: 0x15171a,
};

function colorsFor(kind, sub, team) {
  if (kind === 'squad' || kind === 'leader') {
    const s = PALETTE.squad;
    return { body: s.body, pants: s.pants, head: s.helmet, vest: s.vest, band: team === 'blue' ? s.blue : s.red, helmet: true };
  }
  if (kind === 'suspect') {
    const s = PALETTE[sub];
    return { body: s.body, pants: s.pants, head: s.mask, vest: s.vest || null, band: null, mask: true };
  }
  const s = PALETTE[kind];
  return { body: s.body, pants: s.pants, head: s.hair, vest: null, band: null, hair: true };
}

// 자세별 사람. 앞쪽 = -z, 발바닥 y=0
export function humanGeometry(kind, sub, team, pose) {
  const C = colorsFor(kind, sub, team);
  const P = [];
  const armed = kind === 'squad' || (kind === 'suspect' && pose !== 'surrender' && pose !== 'down-unarmed');
  const box = (size, pos, color, rot) => P.push({ size, pos, color, rot });
  let hip = 0.92; let legLen = 0.9; let kneel = false;
  if (pose === 'crouch') { hip = 0.62; legLen = 0.58; }
  if (pose === 'surrender' || pose === 'cower' || pose === 'secured') { hip = 0.5; kneel = true; }
  const torsoH = 0.62;
  // 다리
  if (kneel) {
    box([0.15, 0.48, 0.16], [-0.11, 0.24, 0.12], C.pants, [-1.2, 0, 0]);
    box([0.15, 0.48, 0.16], [0.11, 0.24, 0.12], C.pants, [-1.2, 0, 0]);
    box([0.14, 0.12, 0.42], [-0.11, 0.06, 0.32], C.pants);
    box([0.14, 0.12, 0.42], [0.11, 0.06, 0.32], C.pants);
  } else if (pose === 'crouch') {
    box([0.15, 0.36, 0.16], [-0.11, 0.48, -0.1], C.pants, [0.9, 0, 0]);
    box([0.15, 0.36, 0.16], [0.11, 0.48, -0.1], C.pants, [0.9, 0, 0]);
    box([0.15, 0.36, 0.16], [-0.11, 0.18, -0.16], C.pants, [-0.2, 0, 0]);
    box([0.15, 0.36, 0.16], [0.11, 0.18, -0.16], C.pants, [-0.2, 0, 0]);
  } else {
    box([0.16, legLen, 0.18], [-0.11, legLen / 2, 0], C.pants);
    box([0.16, legLen, 0.18], [0.11, legLen / 2, 0], C.pants);
    box([0.17, 0.08, 0.26], [-0.11, 0.04, -0.04], 0x15151a);
    box([0.17, 0.08, 0.26], [0.11, 0.04, -0.04], 0x15151a);
  }
  const ty = hip + torsoH / 2;
  const lean = pose === 'crouch' ? -0.25 : 0;
  box([0.44, torsoH, 0.26], [0, ty, 0.02], C.body, [lean, 0, 0]);
  if (C.vest) box([0.47, 0.42, 0.3], [0, ty + 0.04, 0.02], C.vest, [lean, 0, 0]);
  const headY = hip + torsoH + 0.15;
  box([0.24, 0.27, 0.25], [0, headY, pose === 'crouch' ? -0.08 : 0], C.head);
  if (C.helmet) {
    box([0.29, 0.13, 0.3], [0, headY + 0.12, pose === 'crouch' ? -0.08 : 0], C.head);
    box([0.22, 0.06, 0.04], [0, headY + 0.02, (pose === 'crouch' ? -0.08 : 0) - 0.13], 0x0d0f12);
  } else if (C.hair) {
    box([0.26, 0.1, 0.27], [0, headY + 0.12, 0.01], C.head);
    box([0.22, 0.16, 0.02], [0, headY - 0.02, -0.13], PALETTE.skin);
  } else if (C.mask) {
    box([0.16, 0.05, 0.02], [0, headY + 0.03, -0.13], PALETTE.skin);
  }
  if (C.band) box([0.07, 0.1, 0.2], [0.26, ty + 0.16, 0.02], C.band);
  const shY = hip + torsoH - 0.06;
  const zc = pose === 'crouch' ? -0.08 : 0;
  if (pose === 'surrender') {
    box([0.11, 0.55, 0.11], [-0.27, shY + 0.3, zc], C.body, [0, 0, 0.2]);
    box([0.11, 0.55, 0.11], [0.27, shY + 0.3, zc], C.body, [0, 0, -0.2]);
    box([0.1, 0.1, 0.1], [-0.33, shY + 0.6, zc], PALETTE.skin);
    box([0.1, 0.1, 0.1], [0.33, shY + 0.6, zc], PALETTE.skin);
  } else if (pose === 'cower' || pose === 'secured') {
    // 손을 머리 뒤로(확보되면 손을 뒤로 묶음)
    if (pose === 'cower') {
      box([0.11, 0.42, 0.11], [-0.24, shY + 0.15, 0.06], C.body, [0.4, 0, 0.9]);
      box([0.11, 0.42, 0.11], [0.24, shY + 0.15, 0.06], C.body, [0.4, 0, -0.9]);
    } else {
      box([0.11, 0.45, 0.11], [-0.2, shY - 0.2, 0.12], C.body, [0.3, 0, 0.1]);
      box([0.11, 0.45, 0.11], [0.2, shY - 0.2, 0.12], C.body, [0.3, 0, -0.1]);
      box([0.36, 0.05, 0.05], [0, shY - 0.4, 0.2], 0xf2f2f2);
    }
  } else if (armed) {
    // 총을 앞으로 겨눈 팔
    box([0.11, 0.11, 0.42], [-0.18, shY - 0.08, zc - 0.22], C.body);
    box([0.11, 0.11, 0.48], [0.2, shY - 0.1, zc - 0.18], C.body);
    const gunLen = kind === 'suspect' && sub === 'pistol' ? 0.26 : 0.72;
    box([0.07, 0.13, gunLen], [0.06, shY - 0.06, zc - 0.32 - gunLen / 2 + 0.12], PALETTE.gun);
  } else {
    box([0.11, 0.6, 0.11], [-0.28, shY - 0.3, 0], C.body);
    box([0.11, 0.6, 0.11], [0.28, shY - 0.3, 0], C.body);
  }
  return mergeBoxes(P);
}

// 쓰러진 자세: 선 자세를 뒤로 눕힌다
export function downGeometry(kind, sub, team) {
  const g = humanGeometry(kind, sub, team, 'down-unarmed');
  g.rotateX(Math.PI / 2);
  g.translate(0, 0.14, -0.9);
  return g;
}

export function dummyGeometry(down) {
  const parts = [
    { size: [0.62, 1.2, 0.03], pos: [0, 0.95, 0], color: 0xb9a27a },
    { size: [0.3, 0.32, 0.031], pos: [0, 1.66, 0], color: 0xb9a27a },
    { size: [0.36, 0.5, 0.034], pos: [0, 1.15, -0.002], color: 0x8c2f2f },
    { size: [0.14, 0.14, 0.034], pos: [0, 1.66, -0.002], color: 0x8c2f2f },
    { size: [0.05, 0.4, 0.05], pos: [0, 0.2, 0.05], color: 0x444444 },
    { size: [0.5, 0.04, 0.3], pos: [0, 0.02, 0.05], color: 0x444444 },
  ];
  const g = mergeBoxes(parts);
  if (down) { g.rotateX(Math.PI / 2 - 0.05); g.translate(0, 0.05, 0.9); }
  return g;
}

export function evidenceGeometry(sub) {
  const len = sub === 'pistol' ? 0.25 : 0.75;
  return mergeBoxes([
    { size: [0.07, 0.06, len], pos: [0, 0.035, 0], color: PALETTE.gun },
    { size: [0.05, 0.12, 0.06], pos: [0, 0.03, len * 0.15], color: PALETTE.gun, rot: [-1.2, 0, 0] },
    { size: [0.02, 0.02, 0.02], pos: [0, 0.1, 0], color: 0xffd34a },
  ]);
}

// 1인칭 손+총 모델. 원점 = 손잡이 근처, 총구는 -z
export function viewmodelGeometry(id) {
  const P = [];
  const metal = 0x464c55; const poly = 0x33373d; const glove = 0x4a4036; const sleeve = 0x3d4a5a;
  const box = (size, pos, color, rot) => P.push({ size, pos, color, rot });
  if (id === 'pistol') {
    box([0.045, 0.05, 0.2], [0, 0.03, -0.1], metal);
    box([0.04, 0.11, 0.05], [0, -0.04, -0.02], poly, [0.25, 0, 0]);
    box([0.07, 0.07, 0.12], [0, -0.07, 0.04], glove);
    box([0.08, 0.08, 0.3], [0.02, -0.1, 0.22], sleeve);
  } else {
    const long = id === 'm4' ? 0.62 : id === 'mp5' ? 0.46 : 0.7;
    box([0.06, 0.08, long], [0, 0.0, -long / 2 + 0.12], metal);
    box([0.045, 0.045, 0.2], [0, 0.0, -long + 0.0], metal);
    if (id === 'm4') { box([0.04, 0.05, 0.24], [0, 0.065, -0.14], poly); box([0.035, 0.16, 0.06], [0, -0.1, -0.12], poly, [0.2, 0, 0]); }
    if (id === 'mp5') { box([0.035, 0.14, 0.05], [0, -0.1, -0.16], poly, [0.35, 0, 0]); box([0.07, 0.07, 0.12], [0, 0.0, -0.36], poly); }
    if (id === 'shotgun') { box([0.07, 0.07, 0.28], [0, -0.06, -0.38], 0x5a3a24); box([0.03, 0.03, 0.5], [0, 0.05, -0.3], metal); }
    box([0.04, 0.12, 0.05], [0, -0.08, 0.03], poly, [0.3, 0, 0]);
    box([0.06, 0.1, 0.24], [0, -0.02, 0.22], id === 'shotgun' ? 0x5a3a24 : poly);
    box([0.04, 0.03, 0.06], [0, 0.065, 0.02], metal);
    // 손
    box([0.08, 0.08, 0.11], [0, -0.07, 0.04], glove);
    box([0.08, 0.07, 0.12], [-0.02, -0.06, -long * 0.55], glove);
    box([0.085, 0.085, 0.36], [0.02, -0.11, 0.25], sleeve);
    box([0.085, 0.085, 0.36], [-0.12, -0.1, -long * 0.3], sleeve, [0, -0.6, 0]);
  }
  return mergeBoxes(P);
}

export function muzzleOffset(id) {
  if (id === 'pistol') return new THREE.Vector3(0, 0.03, -0.22);
  const long = id === 'm4' ? 0.62 : id === 'mp5' ? 0.46 : 0.7;
  return new THREE.Vector3(0, 0, -long - 0.1);
}
