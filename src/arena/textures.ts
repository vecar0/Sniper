/**
 * 표면 텍스처(바닥 · 옥상 · 벽 · 컨테이너 · 도로).
 * public/textures/<이름>.jpg 가 있으면(AVAILABLE에 등록) 그 이미지를 반복 타일로 쓰고,
 * 없으면 캔버스로 만든 잔무늬 텍스처로 대신한다(네트워크 요청 없음 → 콘솔 에러 없음).
 *
 * 타일 밀도 규칙(텍스처 스킬): 타일 하나가 월드 약 4~12m를 덮게 repeat를 잡는다. 너무 넓으면 흐릿해진다.
 */
import * as THREE from 'three';

export type SurfaceId = 'ground' | 'concrete' | 'plaster' | 'metal' | 'asphalt' | 'metalg' | 'roofmetal' | 'facade' | 'rock';

/** 실제 이미지가 들어 있는 텍스처(파일을 추가하면 여기에 등록) */
export const AVAILABLE: SurfaceId[] = ['ground', 'concrete', 'plaster', 'metal', 'asphalt', 'metalg'];

/**
 * 실사 PBR 텍스처(Poly Haven, CC0): 색 + 노멀(요철) + 거칠기. public/textures/pbr/<이름>_{d,n,r}.jpg
 * 있으면 이것을 쓰고, 없으면 위의 이미지 · 캔버스 텍스처.
 */
const PBR: Partial<Record<SurfaceId, string>> = {
  ground: 'dry_ground_rocks',
  concrete: 'brushed_concrete',
  plaster: 'sandstone_blocks_04',
  metalg: 'worn_corrugated_iron',
  roofmetal: 'rusty_corrugated_iron',
  asphalt: 'asphalt_02',
  rock: 'rock_face_03',
};

/** 이미지가 없을 때의 기본 색과 잔무늬 */
const FALLBACK: Record<SurfaceId, { base: string; dark: string; light: string; grain: number; streaks?: 'v' | 'h' }> = {
  ground: { base: '#b59a72', dark: '#8f7652', light: '#cdb48c', grain: 0.55 },
  concrete: { base: '#a9a49b', dark: '#8a857c', light: '#c2bdb3', grain: 0.4 },
  plaster: { base: '#c9b694', dark: '#a8906c', light: '#ddcfb2', grain: 0.35 },
  metal: { base: '#4f7a72', dark: '#3a5c56', light: '#6c968e', grain: 0.2, streaks: 'v' },
  asphalt: { base: '#45474a', dark: '#33353a', light: '#5a5c60', grain: 0.6 },
  metalg: { base: '#b0b0ac', dark: '#8c8c88', light: '#cfcfca', grain: 0.2, streaks: 'v' },
  roofmetal: { base: '#8a5a3c', dark: '#6a4028', light: '#a87050', grain: 0.3, streaks: 'v' },
  facade: { base: '#b9a58a', dark: '#5a5048', light: '#d8c8b0', grain: 0.2, streaks: 'h' },
  rock: { base: '#b08a6a', dark: '#8a6a50', light: '#c8a888', grain: 0.6 },
};

const cache = new Map<SurfaceId, THREE.Texture>();

function fallbackTexture(id: SurfaceId): THREE.Texture {
  const f = FALLBACK[id];
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = f.base;
  ctx.fillRect(0, 0, size, size);
  // 주기적 잔무늬: 가장자리를 감싸서(wrap) 그려 이음새가 없다
  let seed = id.length * 977;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const blob = (x: number, y: number, r: number, color: string, a: number) => {
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  for (let i = 0; i < 70; i++) blob(rnd() * size, rnd() * size, 8 + rnd() * 30, rnd() < 0.5 ? f.dark : f.light, 0.08 * f.grain + 0.03);
  for (let i = 0; i < 1600 * f.grain; i++) blob(rnd() * size, rnd() * size, 0.6 + rnd() * 1.4, rnd() < 0.5 ? f.dark : f.light, 0.35);
  if (f.streaks === 'v') {
    ctx.globalAlpha = 0.35;
    for (let x = 0; x < size; x += 16) {
      ctx.fillStyle = f.light;
      ctx.fillRect(x, 0, 3, size);
      ctx.fillStyle = f.dark;
      ctx.fillRect(x + 8, 0, 4, size);
    }
  }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  return t;
}

/** 공유 텍스처(재질마다 repeat가 다르므로 clone해서 쓴다) */
function baseTexture(id: SurfaceId): THREE.Texture {
  let t = cache.get(id);
  if (!t) {
    if (AVAILABLE.includes(id)) {
      t = new THREE.TextureLoader().load(`./textures/${id}.jpg`);
    } else t = fallbackTexture(id);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    cache.set(id, t);
  }
  return t;
}

/**
 * 반복 타일 재질.
 * @param tileSize 타일 하나가 덮는 월드 크기(m) – UV가 월드 좌표 기준일 때 repeat = 1 / tileSize
 */
/** 무늬가 큰 텍스처는 덜 반복되게 크게 편다(1 = 그대로) */
const PBR_SCALE: Partial<Record<SurfaceId, number>> = { plaster: 0.6, ground: 0.8 };
const pbrCache = new Map<string, THREE.Texture>();
function pbrTexture(file: string, color: boolean, scale = 1): THREE.Texture {
  let t = pbrCache.get(file);
  if (!t) {
    t = new THREE.TextureLoader().load(`./textures/pbr/${file}.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.setScalar(scale);
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    pbrCache.set(file, t);
  }
  return t;
}

export function surfaceMaterial(id: SurfaceId, opts: { tint?: number; roughness?: number; metalness?: number } = {}): THREE.MeshStandardMaterial {
  const pbr = PBR[id];
  if (pbr) {
    const metal = id === 'metalg' || id === 'roofmetal';
    return new THREE.MeshStandardMaterial({
      map: pbrTexture(`${pbr}_d`, true, PBR_SCALE[id]),
      normalMap: pbrTexture(`${pbr}_n`, false, PBR_SCALE[id]),
      roughnessMap: pbrTexture(`${pbr}_r`, false, PBR_SCALE[id]),
      color: opts.tint ?? 0xffffff,
      roughness: opts.roughness ?? 1,
      metalness: opts.metalness ?? (metal ? 0.35 : 0),
    });
  }
  const map = baseTexture(id).clone();
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    map,
    color: opts.tint ?? 0xffffff,
    roughness: opts.roughness ?? (id === 'metal' || id === 'metalg' ? 0.55 : 0.92),
    metalness: opts.metalness ?? (id === 'metal' || id === 'metalg' ? 0.35 : 0.02),
  });
}

/**
 * 박스 지오메트리의 UV를 "월드 크기 ÷ 타일 크기"로 바꾼다.
 * 크기가 제각각인 상자에도 텍스처 밀도가 일정하게 유지된다(늘어나 보이지 않음).
 */
export function worldUvBox(w: number, h: number, d: number, tile: number): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const [su, sv] = nx > 0.5 ? [d, h] : ny > 0.5 ? [w, d] : [w, h];
    uv.setXY(i, (uv.getX(i) * su) / tile, (uv.getY(i) * sv) / tile);
  }
  uv.needsUpdate = true;
  return g;
}

/** 넓은 평면(바닥)용: 크기 ÷ 타일 크기만큼 반복 */
export function worldUvPlane(w: number, d: number, tile: number): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * d) / tile);
  uv.needsUpdate = true;
  return g;
}
