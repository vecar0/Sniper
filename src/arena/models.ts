/**
 * 사실적인 3D 모델(GLB) – public/models/<이름>.glb.
 * 게임 시작 전에 한 번 불러 두고(preloadModels), 맵 · 적 · 1인칭 총이 getModel로 꺼내 쓴다.
 * 파일이 없거나 못 불러오면 null → 각자 코드로 만든 모양으로 대신한다.
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type ModelId = 'soldier' | 'rig' | 'animRanged' | 'animMove' | 'animMoveAdv' | 'animGeneral' | 'rifle' | 'container' | 'sandbags' | 'crate' | 'barrel';

/** 실제 파일이 들어 있는 모델(scripts/models.py가 갱신) */
export const MODELS_AVAILABLE: ModelId[] = ['rifle', 'container', 'soldier', 'sandbags', 'crate', 'barrel', 'rig', 'animRanged', 'animMove', 'animMoveAdv', 'animGeneral'];

const loaded = new Map<ModelId, GLTF>();

export async function preloadModels(onProgress?: (done: number, total: number) => void): Promise<void> {
  const loader = new GLTFLoader();
  let done = 0;
  await Promise.all(
    MODELS_AVAILABLE.map(async (id) => {
      try {
        const g = await loader.loadAsync(`./models/${id}.glb`);
        g.scene.updateMatrixWorld(true);
        loaded.set(id, g);
      } catch {
        /* 모델이 없으면 코드로 만든 모양을 쓴다 */
      }
      onProgress?.(++done, MODELS_AVAILABLE.length);
    }),
  );
}

export function getModel(id: ModelId): GLTF | null {
  return loaded.get(id) ?? null;
}

/** 모델 안의 메시들을 월드 변환을 구운 지오메트리 + 재질 목록으로 */
const baked = new Map<ModelId, { geometry: THREE.BufferGeometry; material: THREE.Material }[]>();
export function bakedMeshes(id: ModelId): { geometry: THREE.BufferGeometry; material: THREE.Material }[] {
  const hit = baked.get(id);
  if (hit) return hit;
  const g = getModel(id);
  if (!g) return [];
  const out: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
  g.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as unknown as THREE.SkinnedMesh).isSkinnedMesh) return;
    const geo = m.geometry.clone();
    geo.applyMatrix4(m.matrixWorld);
    out.push({ geometry: geo, material: Array.isArray(m.material) ? m.material[0] : m.material });
  });
  baked.set(id, out);
  return out;
}

/**
 * 모델을 상자 크기(w × h × d, 바닥 중심이 원점)에 맞추는 변환.
 * 긴 쪽이 z축이면 90° 돌려 x축으로 눕힌다. uniform=true면 비율을 유지(높이 기준).
 */
export function fitTransform(id: ModelId, w: number, h: number, d: number, uniform = false): THREE.Matrix4 {
  const box = new THREE.Box3();
  for (const { geometry } of bakedMeshes(id)) {
    geometry.computeBoundingBox();
    box.union(geometry.boundingBox!);
  }
  const size = box.getSize(new THREE.Vector3());
  const rot = size.z > size.x * 1.15 && w > d * 1.15 ? Math.PI / 2 : 0;
  const sx0 = rot ? size.z : size.x, sz0 = rot ? size.x : size.z;
  const s = uniform ? new THREE.Vector3(h / size.y, h / size.y, h / size.y) : new THREE.Vector3(w / sx0, h / size.y, d / sz0);
  const c = box.getCenter(new THREE.Vector3());
  // 원점으로 옮기고(바닥 중심) → 돌리고 → 늘린다
  const m = new THREE.Matrix4().makeScale(s.x, s.y, s.z);
  m.multiply(new THREE.Matrix4().makeRotationY(rot));
  m.multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
  return m;
}

/**
 * 같은 모델을 여러 곳에 한 번에 그리기(인스턴싱).
 * @param placements 각 자리의 변환(fitTransform을 곱한 최종 변환)
 */
export function instancedModel(id: ModelId, placements: THREE.Matrix4[], colors?: THREE.Color[], shadows = true): THREE.Group {
  const group = new THREE.Group();
  for (const { geometry, material } of bakedMeshes(id)) {
    const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
    placements.forEach((p, i) => {
      mesh.setMatrixAt(i, p);
      if (colors) mesh.setColorAt(i, colors[i]);
    });
    mesh.castShadow = mesh.receiveShadow = shadows;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}
