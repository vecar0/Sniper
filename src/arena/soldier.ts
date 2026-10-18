/**
 * 사실적인 적 병사: Tripo로 만든 T자세 병사 메시 + KayKit 뼈대 · 동작(CC0, Kay Lousberg).
 *
 * 메시에는 뼈대가 없으므로 게임이 시작할 때 한 번 "자동 리깅"한다.
 * 1) KayKit 뼈대의 관절을 이 병사의 실제 관절 위치(어깨 · 팔꿈치 · 무릎…, 메시에서 잰 값)로 옮기고,
 *    각 뼈가 KayKit에서처럼 자식 관절 쪽(+Y)을 보게 돌린다 → KayKit 동작의 회전값을 그대로 쓸 수 있다.
 * 2) 정점마다 가까운 뼈(부위 규칙 + 거리)로 가중치를 준다.
 * 동작: 다리 = 서기 · 걷기 · 달리기 · 숙이기, 윗몸 = 소총 겨누기 · 쏘기, 쓰러짐은 몸 전체.
 * 소총은 오른손에 두고 왼손 쪽을 향하게(두 손으로 잡은 모양) 매 프레임 맞춘다.
 */
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { bakedMeshes, getModel, type ModelId } from './models';

export type SoldierLook = 'rifle' | 'rusher' | 'sniper' | 'heavy';

/** 종류별 색(텍스처에 곱함 – 원본은 빨간 전투복) */
const TINT: Record<SoldierLook, number> = { rifle: 0xffffff, rusher: 0xffc28a, sniper: 0xb9c2a6, heavy: 0x8a8a8a };
const HEIGHT = 1.78;

/** 이 병사 메시의 관절 위치(몸 기준: +Z 앞, +X 왼쪽, 키 1.78m, T자세) – 메시 단면을 재서 얻은 값 */
const J: Record<string, [number, number, number]> = {
  root: [0, 0, 0],
  hips: [0, 0.86, 0],
  spine: [0, 1.0, 0],
  chest: [0, 1.2, 0],
  head: [0, 1.5, 0],
  upperarml: [0.2, 1.42, -0.07],
  lowerarml: [0.47, 1.43, -0.1],
  wristl: [0.72, 1.44, -0.085],
  handl: [0.79, 1.44, -0.085],
  upperlegl: [0.105, 0.8, 0],
  lowerlegl: [0.12, 0.47, 0],
  footl: [0.135, 0.09, -0.04],
  toesl: [0.14, 0.02, 0.1],
};
for (const k of Object.keys(J)) if (k.endsWith('l') && k !== 'handl' && !['spine', 'head'].includes(k)) J[k.slice(0, -1) + 'r'] = [-J[k][0], J[k][1], J[k][2]];
J.handr = [-J.handl[0], J.handl[1], J.handl[2]];
/** 뼈가 바라볼 자식(사슬의 다음 관절) */
const NEXT: Record<string, string> = {
  root: 'hips', hips: 'spine', spine: 'chest', chest: 'head',
  upperarml: 'lowerarml', lowerarml: 'wristl', wristl: 'handl',
  upperarmr: 'lowerarmr', lowerarmr: 'wristr', wristr: 'handr',
  upperlegl: 'lowerlegl', lowerlegl: 'footl', footl: 'toesl',
  upperlegr: 'lowerlegr', lowerlegr: 'footr', footr: 'toesr',
};
/** 끝 뼈의 길이 방향(가중치 계산용 선분 끝) */
const TIP: Record<string, [number, number, number]> = {
  head: [0, 1.78, 0.02], handl: [0.88, 1.44, -0.085], handr: [-0.88, 1.44, -0.085], toesl: [0.14, 0.02, 0.16], toesr: [-0.14, 0.02, 0.16],
};
const UPPER = /^(spine|chest|head|upperarm|lowerarm|wrist|hand)/;

interface Template {
  group: THREE.Group;
  clips: Map<string, THREE.AnimationClip>;
  material: THREE.Material;
}
let template: Template | null | undefined;
const tinted = new Map<SoldierLook, THREE.Material>();

/** 한 번만: 메시 손질 → 뼈대 맞추기 → 가중치 → 동작 정리 */
function prepare(): Template | null {
  if (template !== undefined) return template;
  const meshes = bakedMeshes('soldier');
  const rig = getModel('rig');
  if (!meshes.length || !rig) return (template = null);

  // ── 메시: 앞(+Z) · 바닥 0 · 키 1.78m (원본은 +X를 보는 T자세)
  const geo = meshes[0].geometry.clone();
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const s = HEIGHT / (bb.max.y - bb.min.y);
  const c = bb.getCenter(new THREE.Vector3());
  geo.applyMatrix4(
    new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -bb.min.y, -c.z)),
  );

  // ── KayKit 뼈대의 휴식 자세(월드 회전)
  rig.scene.updateMatrixWorld(true);
  const kq = new Map<string, THREE.Quaternion>();
  const kParent = new Map<string, string | null>();
  const order: string[] = [];
  let rigRoot: THREE.Object3D | null = null;
  rig.scene.traverse((o) => {
    if (o.name === 'root') rigRoot = o;
  });
  if (!rigRoot) return (template = null);
  (rigRoot as THREE.Object3D).traverse((o) => {
    kq.set(o.name, o.getWorldQuaternion(new THREE.Quaternion()));
    kParent.set(o.name, o.parent && kq.has(o.parent.name) ? o.parent.name : null);
    order.push(o.name);
  });

  // ── 새 뼈대: 관절 = 이 병사의 위치, 회전 = KayKit 회전을 "자식 쪽을 보게" 최소 회전으로 고친 것
  const worldPos = new Map<string, THREE.Vector3>();
  const worldQ = new Map<string, THREE.Quaternion>();
  const up = new THREE.Vector3(0, 1, 0);
  for (const name of order) {
    const parent = kParent.get(name) ?? null;
    let pos: THREE.Vector3;
    if (J[name]) pos = new THREE.Vector3(...J[name]);
    else {
      // 표에 없는 뼈(손 슬롯 등): 부모 기준 KayKit 위치를 비율대로
      const pq = worldQ.get(parent!)!;
      const node = rig.scene.getObjectByName(name)!;
      pos = node.position.clone().multiplyScalar(2).applyQuaternion(pq).add(worldPos.get(parent!)!);
    }
    worldPos.set(name, pos);
    const q0 = kq.get(name)!.clone();
    let q: THREE.Quaternion;
    const next = NEXT[name];
    if (next && J[next]) {
      const want = new THREE.Vector3(...J[next]).sub(pos).normalize();
      const have = up.clone().applyQuaternion(q0);
      q = new THREE.Quaternion().setFromUnitVectors(have, want).multiply(q0);
    } else if (parent) {
      // 끝 뼈: 부모가 돈 만큼 같이 돈다
      const delta = worldQ.get(parent)!.clone().multiply(kq.get(parent)!.clone().invert());
      q = delta.multiply(q0);
    } else q = q0;
    worldQ.set(name, q);
  }
  const bones = new Map<string, THREE.Bone>();
  const boneList: THREE.Bone[] = [];
  for (const name of order) {
    const b = new THREE.Bone();
    b.name = name;
    const parent = kParent.get(name);
    const w = new THREE.Matrix4().compose(worldPos.get(name)!, worldQ.get(name)!, new THREE.Vector3(1, 1, 1));
    if (parent) {
      const pw = new THREE.Matrix4().compose(worldPos.get(parent)!, worldQ.get(parent)!, new THREE.Vector3(1, 1, 1));
      w.premultiply(pw.invert());
      bones.get(parent)!.add(b);
    }
    w.decompose(b.position, b.quaternion, b.scale);
    bones.set(name, b);
    boneList.push(b);
  }
  const rootBone = bones.get('root')!;

  // ── 가중치: 부위 규칙으로 후보 뼈를 고르고, 뼈 선분까지 거리로 나눈다
  const segs = new Map<string, [THREE.Vector3, THREE.Vector3]>();
  for (const name of order) {
    const a = worldPos.get(name)!;
    const tip = NEXT[name] && J[NEXT[name]] ? new THREE.Vector3(...J[NEXT[name]]) : TIP[name] ? new THREE.Vector3(...TIP[name]) : null;
    if (tip) segs.set(name, [a, tip]);
  }
  const p = geo.getAttribute('position') as THREE.BufferAttribute;
  const skinIndex = new Uint16Array(p.count * 4);
  const skinWeight = new Float32Array(p.count * 4);
  const v = new THREE.Vector3(), cl = new THREE.Vector3();
  const line = new THREE.Line3();
  const idx = (n: string) => order.indexOf(n);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const side = v.x >= 0 ? 'l' : 'r';
    let cand: string[];
    if (v.y > 1.52) cand = ['head'];
    else if (v.y > 1.26 && Math.abs(v.x) > 0.27) cand = [`upperarm${side}`, `lowerarm${side}`, `wrist${side}`, `hand${side}`];
    else if (v.y < 0.7) cand = [`upperleg${side}`, `lowerleg${side}`, `foot${side}`, `toes${side}`];
    else {
      cand = ['hips', 'spine', 'chest', 'head'];
      if (v.y < 0.95) cand.push(`upperleg${side}`);
      if (v.y > 1.25) cand.push(`upperarm${side}`);
    }
    const ws: [number, number][] = [];
    for (const n of cand) {
      const sg = segs.get(n);
      if (!sg) continue;
      line.set(sg[0], sg[1]).closestPointToPoint(v, true, cl);
      const d = cl.distanceTo(v);
      ws.push([idx(n), 1 / Math.pow(d + 0.02, 4)]);
    }
    ws.sort((a, b) => b[1] - a[1]);
    const top = ws.slice(0, 3);
    const sum = top.reduce((a, w) => a + w[1], 0) || 1;
    top.forEach((w, k) => {
      skinIndex[i * 4 + k] = w[0];
      skinWeight[i * 4 + k] = w[1] / sum;
    });
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));

  const group = new THREE.Group();
  const mesh = new THREE.SkinnedMesh(geo, meshes[0].material);
  group.add(rootBone, mesh);
  group.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(boneList));

  // ── 동작: 위치 · 크기 트랙은 버리고(KayKit 몸 비율이라) 회전만, 엉덩이 위치는 키 비율로
  const kHips = rig.scene.getObjectByName('hips')!.getWorldPosition(new THREE.Vector3()).y;
  const hipScale = J.hips[1] / Math.max(0.01, kHips);
  const clips = new Map<string, THREE.AnimationClip>();
  for (const id of ['animRanged', 'animMove', 'animMoveAdv', 'animGeneral'] as ModelId[]) {
    for (const clip of getModel(id)?.animations ?? []) {
      const cl2 = clip.clone();
      cl2.tracks = cl2.tracks.filter((t) => {
        const [bone, prop] = t.name.split('.');
        if (prop === 'scale') return false;
        if (prop === 'position') {
          if (bone !== 'hips') return false;
          for (let k = 0; k < t.values.length; k++) t.values[k] *= hipScale;
        }
        return bones.has(bone);
      });
      clips.set(clip.name, cl2);
    }
  }
  return (template = { group, clips, material: meshes[0].material });
}

/** 동작 트랙 중 윗몸(또는 다리)만 남긴 복사본 */
function part(clip: THREE.AnimationClip | undefined, upper: boolean): THREE.AnimationClip | null {
  if (!clip) return null;
  const c = clip.clone();
  c.tracks = c.tracks.filter((t) => {
    const bone = t.name.split('.')[0];
    return upper ? UPPER.test(bone) : !UPPER.test(bone);
  });
  return c;
}

/** 겨누기 때 두 손 목표(몸 기준): 오른손 = 손잡이, 왼손 = 총열 덮개. 뛰며 들고 갈 땐 가슴 앞 비스듬히 */
const GRIP = {
  aim: { r: new THREE.Vector3(-0.07, 1.33, 0.22), l: new THREE.Vector3(-0.03, 1.33, 0.45) },
  carry: { r: new THREE.Vector3(-0.1, 1.12, 0.22), l: new THREE.Vector3(0.1, 1.28, 0.36) },
};
const POLE = { r: new THREE.Vector3(-1, -1.2, -0.2), l: new THREE.Vector3(0.7, -1.2, -0.2) };
const t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), t3 = new THREE.Vector3();
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion();

/** 뼈가 자식 뼈 쪽으로 향하는 방향을 월드 점 target 쪽으로(가중치 w만큼) 돌린다 */
function aimBone(bone: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3, w: number): void {
  bone.updateWorldMatrix(true, false);
  child.updateWorldMatrix(false, false);
  bone.getWorldPosition(t1);
  child.getWorldPosition(t2);
  const cur = t2.sub(t1).normalize();
  const want = t3.copy(target).sub(t1).normalize();
  qa.setFromUnitVectors(cur, want);
  qa.slerp(qc.identity(), 1 - w);
  bone.getWorldQuaternion(qb);
  qa.multiply(qb);
  bone.parent!.getWorldQuaternion(qb);
  bone.quaternion.copy(qb.invert().multiply(qa));
  bone.updateMatrixWorld(true);
}

/** 2관절 IK: 어깨 s에서 목표 t로 – 팔꿈치는 pole 쪽으로. [팔꿈치, 손목] */
function solveIk(sh: THREE.Vector3, t: THREE.Vector3, a: number, b: number, pole: THREE.Vector3): [THREE.Vector3, THREE.Vector3] {
  const d = t.clone().sub(sh);
  const len = Math.min(Math.max(d.length(), 1e-3), (a + b) * 0.995);
  d.normalize();
  const cosA = (a * a + len * len - b * b) / (2 * a * len);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const p = pole.clone().addScaledVector(d, -pole.dot(d)).normalize();
  return [sh.clone().addScaledVector(d, a * cosA).addScaledVector(p, a * sinA), sh.clone().addScaledVector(d, len)];
}

export interface SoldierVisual {
  root: THREE.Group;
  /** 쓰러질 때 발 기준으로 기우는 축(동작이 있으면 쓰지 않음) */
  pivot: THREE.Group;
  mixer: THREE.AnimationMixer;
  /** 동작으로 쓰러지는가(그러면 코드로 넘어뜨리지 않는다) */
  animatedDeath: boolean;
  /** 한 발 쏠 때 */
  fire(): void;
  update(dt: number, o: { moving: boolean; running: boolean; aiming: boolean; speed: number; crouch: number; fall: number }): void;
}

export function createSoldier(look: SoldierLook): SoldierVisual | null {
  const T = prepare();
  if (!T) return null;
  let mat = tinted.get(look);
  if (!mat) {
    mat = T.material.clone();
    (mat as THREE.MeshStandardMaterial).color?.multiply(new THREE.Color(TINT[look]));
    tinted.set(look, mat);
  }
  const inner = cloneSkinned(T.group) as THREE.Group;
  const bones = new Map<string, THREE.Object3D>();
  inner.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh) {
      m.material = mat!;
      m.castShadow = true;
      m.frustumCulled = false;
    }
    if ((o as THREE.Bone).isBone) bones.set(o.name, o);
  });
  const pivot = new THREE.Group();
  pivot.add(inner);
  const root = new THREE.Group();
  root.add(pivot);

  const mixer = new THREE.AnimationMixer(inner);
  const act = (clip: THREE.AnimationClip | null, once = false) => {
    if (!clip) return null;
    const a = mixer.clipAction(clip);
    if (once) {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
    a.enabled = true;
    a.weight = 0;
    a.play();
    return a;
  };
  const C = (n: string) => T.clips.get(n);
  const lower = {
    idle: act(part(C('Idle_A'), false)),
    walk: act(part(C('Walking_A'), false)),
    run: act(part(C('Running_HoldingRifle'), false)),
    crouch: act(part(C('Crouching'), false)),
  };
  const upper = {
    aim: act(part(C('Ranged_2H_Aiming'), true)),
    carry: act(part(C('Running_HoldingRifle'), true)),
  };
  const shoot = act(part(C('Ranged_2H_Shoot'), true), true);
  if (shoot) shoot.stop();
  const death = act(C(Math.random() < 0.5 ? 'Death_A' : 'Death_B') ?? null, true);
  if (death) death.stop();
  const w = { idle: 1, walk: 0, run: 0, crouch: 0, aim: 1, carry: 0 };
  let dying = false;

  // 손에 든 소총(저격총 모델을 1m로 줄여서)
  let gun: THREE.Object3D | null = null;
  const rifle = getModel('rifle');
  if (rifle) {
    const g = rifle.scene.clone();
    const box = new THREE.Box3().setFromObject(g);
    g.scale.setScalar(1.0 / box.getSize(new THREE.Vector3()).z);
    g.rotation.y = Math.PI; // 총구 -Z → +Z
    g.position.z = 0.12; // 손잡이(뒤쪽)가 오른손에 오게
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
    gun = new THREE.Group();
    gun.add(g);
    pivot.add(gun);
  }
  const handR = bones.get('handr'), handL = bones.get('handl');
  const chain = (sd: 'r' | 'l') => {
    const up = bones.get(`upperarm${sd}`), fore = bones.get(`lowerarm${sd}`), wrist = bones.get(`wrist${sd}`);
    if (!up || !fore || !wrist) return null;
    const a = new THREE.Vector3(...J[`upperarm${sd}`]), e = new THREE.Vector3(...J[`lowerarm${sd}`]), w2 = new THREE.Vector3(...J[`wrist${sd}`]);
    return { up, fore, wrist, lenUp: a.distanceTo(e), lenFore: e.distanceTo(w2) };
  };
  const cr = chain('r'), clft = chain('l');
  const arms = cr && clft ? { r: cr, l: clft } : null;
  const hipsBone = bones.get('hips');
  const hipsY = () => hipsBone?.position.y ?? J.hips[1];
  const pr = new THREE.Vector3(), pl = new THREE.Vector3(), fwd = new THREE.Vector3(), upv = new THREE.Vector3(0, 1, 0);
  const mtx = new THREE.Matrix4();

  return {
    root,
    pivot,
    mixer,
    animatedDeath: !!death,
    fire() {
      if (!shoot || dying) return;
      shoot.reset();
      shoot.weight = 1;
      shoot.play();
    },
    update(dt, o) {
      if (o.fall > 0 && !dying && death) {
        dying = true;
        for (const a of [...Object.values(lower), ...Object.values(upper), shoot]) a?.stop();
        death.reset();
        death.weight = 1;
        death.play();
      }
      if (!dying) {
        // 다리: 숙이기 > 달리기 > 걷기 > 서기, 윗몸: 겨누기 ↔ 들고 뛰기
        const tgt = { idle: 0, walk: 0, run: 0, crouch: 0, aim: 0, carry: 0 };
        if (o.crouch > 0.3) tgt.crouch = 1;
        else if (o.moving && o.running) tgt.run = 1;
        else if (o.moving) tgt.walk = 1;
        else tgt.idle = 1;
        if (o.aiming || !(o.moving && o.running)) tgt.aim = 1;
        else tgt.carry = 1;
        const k = Math.min(1, dt * 8);
        for (const key of Object.keys(w) as (keyof typeof w)[]) w[key] += (tgt[key] - w[key]) * k;
        for (const key of ['idle', 'walk', 'run', 'crouch'] as const) if (lower[key]) lower[key]!.weight = w[key];
        if (shoot && !shoot.isRunning()) shoot.weight = 0;
        if (upper.aim) upper.aim.weight = w.aim * (shoot?.isRunning() ? 0 : 1);
        if (upper.carry) upper.carry.weight = w.carry;
        if (lower.walk) lower.walk.timeScale = Math.max(0.7, o.speed / 3.2);
        if (lower.run) lower.run.timeScale = Math.max(0.7, o.speed / 6);
      }
      mixer.update(dt);
      // 두 손을 소총에: KayKit 캐릭터는 팔이 길어서 그대로 두면 손이 벌어진다 → 2관절 IK로 맞춘다
      if (!dying && arms) {
        inner.updateMatrixWorld(true);
        const ikW = Math.min(1, w.aim + w.carry);
        for (const side of ['r', 'l'] as const) {
          const A = arms[side];
          const goal = t3.copy(GRIP.aim[side]).multiplyScalar(w.aim).addScaledVector(GRIP.carry[side], w.carry);
          if (w.aim + w.carry > 0.01) goal.divideScalar(w.aim + w.carry);
          goal.y += inner.position.y + (w.crouch > 0.01 ? (hipsY() - J.hips[1]) * w.crouch : 0);
          const gw = goal.clone().applyMatrix4(pivot.matrixWorld);
          const sh = A.up.getWorldPosition(new THREE.Vector3());
          const pole = POLE[side].clone().transformDirection(pivot.matrixWorld);
          const [el, wr] = solveIk(sh, gw, A.lenUp, A.lenFore, pole);
          aimBone(A.up, A.fore, el, ikW);
          aimBone(A.fore, A.wrist, wr, ikW);
        }
      }
      // 소총: 오른손에서 왼손 쪽으로(두 손으로 잡은 방향)
      if (gun && handR && handL) {
        inner.updateMatrixWorld(true);
        handR.getWorldPosition(pr);
        handL.getWorldPosition(pl);
        pivot.worldToLocal(pr);
        pivot.worldToLocal(pl);
        fwd.copy(pl).sub(pr);
        if (fwd.length() < 0.12) fwd.set(0, 0, 1);
        fwd.normalize();
        gun.position.copy(pr);
        mtx.lookAt(new THREE.Vector3(), fwd.clone().negate(), upv);
        gun.quaternion.setFromRotationMatrix(mtx);
        gun.visible = !dying || (death?.time ?? 0) < 0.25;
      }
    },
  };
}
