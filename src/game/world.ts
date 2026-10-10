/**
 * 월드 구성: 하늘 · 지형 · 나무 · 소품 · 바람 깃발 · 조명.
 * 미션을 바꿀 때만 다시 만들고, 같은 미션 재시작은 그대로 재사용한다(빠른 재시작).
 */
import * as THREE from 'three';
import type { MissionDef, PropDef } from '../config/missions';
import { seededRandom } from '../config/missions';
import { SHOOTER_GROUND, Terrain } from './terrain';
import { Interior, interiorBounds } from './interior';
import { atmosphereFor, THEMES, type Atmosphere } from './themes';
import type { WindField } from '../ballistics/wind';

export interface Box {
  min: THREE.Vector3;
  max: THREE.Vector3;
  kind: PropDef['kind'] | 'tree';
}

interface Flag {
  pole: THREE.Mesh;
  cloth: THREE.Mesh;
  base: Float32Array;
  dist: number;
  x: number;
  phase: number;
  dir: number;
  speed: number;
}

export type QualityLevel = 'high' | 'medium' | 'low';

/** 테마별 건물 내부 색(벽 · 바닥 · 몰딩) */
const INTERIOR_PALETTE: Record<MissionDef["theme"], { wall: number; floor: number; trim: number }> = {
  forest: { wall: 0xa49a86, floor: 0x6e5a46, trim: 0x4a3e30 },
  plains: { wall: 0xb0a48e, floor: 0x7a6850, trim: 0x544634 },
  mountain: { wall: 0x9aa0a4, floor: 0x5c6064, trim: 0x3a3e42 },
  desert: { wall: 0xb8a684, floor: 0x7a6a50, trim: 0x544632 },
  snow: { wall: 0x8e949a, floor: 0x55595e, trim: 0x34383c },
};

export class World {
  readonly scene = new THREE.Scene();
  readonly terrain: Terrain;
  readonly colliders: Box[] = [];
  readonly theme: Atmosphere;
  private readonly spinners: THREE.Object3D[] = [];
  private readonly blinkers: THREE.Mesh[] = [];
  private readonly flags: Flag[] = [];
  private readonly disposables: { dispose(): void }[] = [];
  readonly sun: THREE.DirectionalLight;
  readonly maxDist: number;
  /** 잠입 건물(있는 미션만) */
  readonly interior: Interior | null = null;

  constructor(mission: MissionDef, quality: QualityLevel, seed: number) {
    this.theme = atmosphereFor(THEMES[mission.theme], mission.timeOfDay);
    this.maxDist = Math.max(...mission.targets.map((t) => t.dist), 300);
    const pad = mission.interior ? { ...interiorBounds(mission.interior), h: SHOOTER_GROUND - 0.05 } : undefined;
    this.terrain = new Terrain({ theme: mission.theme, seed, maxDist: this.maxDist, pad });
    const th = this.theme;

    this.scene.background = new THREE.Color(th.skyHorizon);
    // 안개: 1000m 표적이 뿌옇게 보이되 식별은 가능한 정도(대기 원근감). 시간대별로 짙기가 다르다
    this.scene.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);

    const hemi = new THREE.HemisphereLight(th.hemiSky, th.hemiGround, 1.05);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(th.sun, th.sunIntensity);
    const [sx, sy, sz] = th.sunDir;
    this.sun.position.set(sx * 1000, sy * 1000, sz * 1000);
    this.scene.add(this.sun);

    const rnd = seededRandom(seed + 99);
    this.buildSky(rnd);
    this.buildRidges(rnd);
    this.buildTerrain(quality);
    for (const p of mission.props) this.addProp(p, rnd);
    this.buildTrees(mission, quality, rnd);
    this.buildFlags(mission, rnd);
    if (mission.interior) {
      this.interior = new Interior(mission.interior, SHOOTER_GROUND, INTERIOR_PALETTE[mission.theme], quality === 'high');
      this.scene.add(this.interior.group);
    } else this.buildHide();
    if (quality !== 'low') this.buildGrass(quality, rnd);
  }

  private track<T extends { dispose(): void }>(o: T): T {
    this.disposables.push(o);
    return o;
  }

  /** 부드러운 원형 텍스처(태양 빛무리·구름용) – 캔버스로 생성 */
  private softTexture(kind: 'glow' | 'cloud', rnd: () => number): THREE.Texture {
    const size = kind === 'glow' ? 128 : 256;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = kind === 'glow' ? size : size / 2;
    const ctx = c.getContext('2d')!;
    if (kind === 'glow') {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.15, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.12)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    } else {
      // 여러 개의 흐릿한 원을 겹쳐 뭉게구름 모양
      for (let i = 0; i < 14; i++) {
        const x = size * (0.2 + rnd() * 0.6);
        const y = c.height * (0.45 + rnd() * 0.25);
        const r = c.height * (0.18 + rnd() * 0.22);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.55)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return this.track(tex);
  }

  private buildSky(rnd: () => number): void {
    const th = this.theme;
    const R = 5800;
    const geo = this.track(new THREE.SphereGeometry(R, 48, 24));
    const colors: number[] = [];
    const top = new THREE.Color(th.skyTop);
    const hor = new THREE.Color(th.skyHorizon);
    const glow = new THREE.Color(th.glow);
    const sunDir = new THREE.Vector3(...th.sunDir).normalize();
    const pos = geo.attributes.position;
    const c = new THREE.Color();
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      const f = Math.pow(Math.max(0, v.y), 0.5);
      c.copy(hor).lerp(top, f);
      // 태양 쪽 하늘이 밝게 물든다(새벽·황혼에 특히 강함)
      const d = Math.max(0, v.dot(sunDir));
      c.lerp(glow, Math.pow(d, 6) * th.glowStrength * 0.8);
      if (v.y < 0) c.lerp(new THREE.Color(th.fog), Math.min(1, -v.y * 4));
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = this.track(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    const sky = new THREE.Mesh(geo, mat);
    sky.renderOrder = -2;
    sky.frustumCulled = false;
    this.scene.add(sky);

    // 태양 원반 + 빛무리
    const sunPos = sunDir.clone().multiplyScalar(5200);
    const glowTex = this.softTexture('glow', rnd);
    const disc = new THREE.Sprite(this.track(new THREE.SpriteMaterial({ map: glowTex, color: th.sunDisc, fog: false, depthWrite: false, transparent: true })));
    disc.scale.setScalar(380);
    disc.position.copy(sunPos);
    disc.renderOrder = -1;
    const halo = new THREE.Sprite(
      this.track(new THREE.SpriteMaterial({ map: glowTex, color: th.glow, fog: false, depthWrite: false, transparent: true, opacity: 0.55 * th.glowStrength + 0.1, blending: THREE.AdditiveBlending })),
    );
    halo.scale.setScalar(2600);
    halo.position.copy(sunPos);
    halo.renderOrder = -1;
    this.scene.add(halo, disc);

    // 구름
    const cloudTex = this.softTexture('cloud', rnd);
    const cloudMat = this.track(new THREE.SpriteMaterial({ map: cloudTex, color: th.cloud, fog: false, depthWrite: false, transparent: true, opacity: th.cloudOpacity }));
    for (let i = 0; i < 16; i++) {
      const a = (rnd() - 0.5) * Math.PI * 1.6;
      const dist = 2600 + rnd() * 2400;
      const sp = new THREE.Sprite(cloudMat);
      sp.position.set(Math.sin(a) * dist, 650 + rnd() * 900, -Math.cos(a) * dist);
      const w = 700 + rnd() * 900;
      sp.scale.set(w, w * (0.32 + rnd() * 0.12), 1);
      sp.renderOrder = -1;
      this.scene.add(sp);
    }
  }

  /** 원경 산맥 3겹: 거리감과 프레임을 만든다 */
  private buildRidges(rnd: () => number): void {
    const th = this.theme;
    const layers = [
      { r: 3300, h: this.terrain.hillHeight * 2.6 + 90, amp: 0.55, color: th.ridges[0] },
      { r: 4200, h: this.terrain.hillHeight * 3.4 + 160, amp: 0.65, color: th.ridges[1] },
      { r: 5100, h: this.terrain.hillHeight * 4.2 + 280, amp: 0.75, color: th.ridges[2] },
    ];
    layers.forEach((L, li) => {
      const seg = 160;
      const positions: number[] = [];
      const seedOff = rnd() * 100;
      const heightAt = (a: number) => {
        const n =
          Math.sin(a * 3 + seedOff) * 0.35 + Math.sin(a * 7.3 + seedOff * 2) * 0.25 + Math.sin(a * 17.1 + seedOff * 3) * 0.12 + Math.sin(a * 41 + li) * 0.05;
        return L.h * (1 - L.amp + L.amp * (0.5 + n));
      };
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2;
        const a1 = ((i + 1) / seg) * Math.PI * 2;
        const p = (a: number, y: number) => [Math.sin(a) * L.r, y, -Math.cos(a) * L.r];
        const b0 = p(a0, -80), b1 = p(a1, -80), t0 = p(a0, heightAt(a0)), t1 = p(a1, heightAt(a1));
        positions.push(...b0, ...t0, ...b1, ...b1, ...t0, ...t1);
      }
      const geo = this.track(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const mesh = new THREE.Mesh(geo, this.track(new THREE.MeshBasicMaterial({ color: L.color, fog: false, side: THREE.DoubleSide })));
      mesh.renderOrder = -1 + li * 0;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
    });
  }

  /** 사수 엄폐물: 모래주머니와 바위가 화면 아래쪽에 깊이감을 준다(조준선·탄도보다 낮게) */
  private buildHide(): void {
    const g = this.terrain.height(0, 0);
    const eye = g + 0.45;
    const bagMat = this.track(new THREE.MeshLambertMaterial({ color: 0xa08e6a, flatShading: true }));
    const bagGeo = this.track(new THREE.CapsuleGeometry(0.11, 0.38, 3, 6));
    bagGeo.rotateZ(Math.PI / 2);
    // 화면 맨 아래에 살짝 걸리는 정도(조준선보다 충분히 낮게)
    const rows = [{ y: eye - 0.62, n: 5, z: -1.5 }];
    for (const r of rows) {
      for (let i = 0; i < r.n; i++) {
        const m = new THREE.Mesh(bagGeo, bagMat);
        m.position.set((i - (r.n - 1) / 2) * 0.6 + (r.n === 4 ? 0 : 0.0), r.y, r.z + Math.sin(i * 2.1) * 0.04);
        m.rotation.y = Math.sin(i * 1.7) * 0.12;
        m.scale.set(1, 0.8, 1);
        this.scene.add(m);
      }
    }
    const rockGeo = this.track(new THREE.DodecahedronGeometry(0.9, 0));
    const rockMat = this.track(new THREE.MeshLambertMaterial({ color: this.theme.rock, flatShading: true }));
    for (const [x, z, sc] of [[-2.4, -1.4, 1.1], [2.6, -1.8, 0.9]] as const) {
      const m = new THREE.Mesh(rockGeo, rockMat);
      m.position.set(x, this.terrain.height(x, z) - 0.25, z);
      m.scale.set(sc, sc * 0.7, sc);
      this.scene.add(m);
    }
  }

  private buildTerrain(quality: QualityLevel): void {
    const t = this.terrain;
    const th = this.theme;
    // 근거리(정밀) + 원거리(거침) 두 장으로 정점 수를 절약
    const tiles: { x0: number; x1: number; d0: number; d1: number; step: number }[] = [
      { x0: -260, x1: 260, d0: -40, d1: this.maxDist + 300, step: quality === 'low' ? 10 : 6 },
    ];
    const farStep = quality === 'low' ? 60 : 40;
    tiles.push({ x0: -2600, x1: -260, d0: -600, d1: 3600, step: farStep });
    tiles.push({ x0: 260, x1: 2600, d0: -600, d1: 3600, step: farStep });
    tiles.push({ x0: -260, x1: 260, d0: this.maxDist + 300, d1: 3600, step: farStep });
    tiles.push({ x0: -260, x1: 260, d0: -600, d1: -40, step: farStep / 2 });

    const low = new THREE.Color(th.groundLow);
    const high = new THREE.Color(th.groundHigh);
    const rock = new THREE.Color(th.rock);
    const mat = this.track(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    const rnd = seededRandom(this.terrain.p.seed + 3);
    for (const tile of tiles) {
      const nx = Math.max(1, Math.round((tile.x1 - tile.x0) / tile.step));
      const nd = Math.max(1, Math.round((tile.d1 - tile.d0) / tile.step));
      const positions: number[] = [];
      const colors: number[] = [];
      const c = new THREE.Color();
      const vert = (ix: number, id: number) => {
        const x = tile.x0 + ((tile.x1 - tile.x0) * ix) / nx;
        const z = -(tile.d0 + ((tile.d1 - tile.d0) * id) / nd);
        return [x, t.height(x, z), z] as const;
      };
      for (let id = 0; id < nd; id++) {
        for (let ix = 0; ix < nx; ix++) {
          const a = vert(ix, id);
          const b = vert(ix + 1, id);
          const cc = vert(ix, id + 1);
          const d = vert(ix + 1, id + 1);
          // 위에서 봤을 때 반시계 방향(앞면)
          for (const tri of [[a, b, cc], [b, d, cc]]) {
            const hAvg = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
            // 경사가 크면 바위색, 높으면 고지대색
            const e1x = tri[1][0] - tri[0][0], e1y = tri[1][1] - tri[0][1], e1z = tri[1][2] - tri[0][2];
            const e2x = tri[2][0] - tri[0][0], e2y = tri[2][1] - tri[0][1], e2z = tri[2][2] - tri[0][2];
            const ny = e1z * e2x - e1x * e2z;
            const nl = Math.hypot(e1y * e2z - e1z * e2y, ny, e1x * e2y - e1y * e2x) || 1;
            const slope = 1 - Math.abs(ny / nl);
            c.copy(low).lerp(high, Math.min(1, Math.max(0, hAvg / (this.terrain.hillHeight * 0.8))));
            if (slope > 0.35) c.lerp(rock, Math.min(1, (slope - 0.35) * 2.5));
            const j = (rnd() - 0.5) * 0.06;
            c.offsetHSL(0, 0, j);
            for (const v of tri) {
              positions.push(v[0], v[1], v[2]);
              colors.push(c.r, c.g, c.b);
            }
          }
        }
      }
      const geo = this.track(new THREE.BufferGeometry());
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, mat);
      this.scene.add(mesh);
    }
  }

  private addProp(p: PropDef, rnd: () => number): void {
    const z = -p.dist;
    const ground = this.terrain.height(p.x, z);
    const th = this.theme;
    const group = new THREE.Group();
    group.position.set(p.x, ground, z);
    group.rotation.y = ((p.rot ?? 0) * Math.PI) / 180;
    const lambert = (color: number) => this.track(new THREE.MeshLambertMaterial({ color, flatShading: true }));
    let collider = true;
    switch (p.kind) {
      case 'building': {
        const body = new THREE.Mesh(this.track(new THREE.BoxGeometry(p.w, p.h, p.d)), lambert(0xb9ad98));
        body.position.y = p.h / 2;
        group.add(body);
        const roof = new THREE.Mesh(this.track(new THREE.ConeGeometry(Math.max(p.w, p.d) * 0.75, 2.2, 4)), lambert(0x7a4a3a));
        roof.position.y = p.h + 1.1;
        roof.rotation.y = Math.PI / 4;
        group.add(roof);
        const winMat = lambert(0x232a33);
        const frameMat = lambert(0xe2dccf);
        const winGeo = this.track(new THREE.BoxGeometry(1.1, 1.3, 0.1));
        const frameGeo = this.track(new THREE.BoxGeometry(1.3, 0.12, 0.18));
        for (let floor = 0; floor < Math.floor(p.h / 3); floor++) {
          for (let i = -1; i <= 1; i++) {
            if (floor === 0 && i === 0) continue;
            const w = new THREE.Mesh(winGeo, winMat);
            w.position.set(i * (p.w / 3.2), 1.8 + floor * 3, p.d / 2 + 0.05);
            const sill = new THREE.Mesh(frameGeo, frameMat);
            sill.position.set(i * (p.w / 3.2), 1.1 + floor * 3, p.d / 2 + 0.09);
            group.add(w, sill);
          }
        }
        // 현관 · 차양 · 처마 띠 · 실외기
        const door = new THREE.Mesh(this.track(new THREE.BoxGeometry(1.2, 2.2, 0.12)), lambert(0x4a3426));
        door.position.set(0, 1.1, p.d / 2 + 0.06);
        const awning = new THREE.Mesh(this.track(new THREE.BoxGeometry(2.2, 0.08, 1.0)), lambert(0x7a4a3a));
        awning.position.set(0, 2.5, p.d / 2 + 0.5);
        awning.rotation.x = 0.18;
        const band = new THREE.Mesh(this.track(new THREE.BoxGeometry(p.w + 0.3, 0.3, p.d + 0.3)), frameMat);
        band.position.y = p.h - 0.15;
        const ac = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.9, 0.6, 0.45)), lambert(0xc8c8c0));
        ac.position.set(p.w / 2 - 1, 4.2, p.d / 2 + 0.25);
        group.add(door, awning, band, ac);
        break;
      }
      case 'rock': {
        const geo = this.track(new THREE.DodecahedronGeometry(1, 0));
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * (0.85 + rnd() * 0.3), pos.getY(i) * (0.85 + rnd() * 0.3), pos.getZ(i) * (0.85 + rnd() * 0.3));
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, lambert(th.rock));
        m.scale.set(p.w / 2, p.h / 1.6, p.d / 2);
        m.position.y = p.h * 0.35;
        group.add(m);
        break;
      }
      case 'crate': {
        const m = new THREE.Mesh(this.track(new THREE.BoxGeometry(p.w, p.h, p.d)), lambert(0x8a6a42));
        m.position.y = p.h / 2;
        group.add(m);
        break;
      }
      case 'tent': {
        const m = new THREE.Mesh(this.track(new THREE.ConeGeometry(p.w / 1.4, p.h, 4)), lambert(0x6a7a5a));
        m.position.y = p.h / 2;
        m.rotation.y = Math.PI / 4;
        group.add(m);
        break;
      }
      case 'wall': {
        const m = new THREE.Mesh(this.track(new THREE.BoxGeometry(p.w, p.h, p.d)), lambert(0x9a948a));
        m.position.y = p.h / 2;
        group.add(m);
        break;
      }
      case 'tower': {
        const legGeo = this.track(new THREE.BoxGeometry(0.2, p.h, 0.2));
        const legMat = lambert(0x5a4a3a);
        for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const l = new THREE.Mesh(legGeo, legMat);
          l.position.set((lx * p.w) / 2.4, p.h / 2, (lz * p.d) / 2.4);
          group.add(l);
        }
        const top = new THREE.Mesh(this.track(new THREE.BoxGeometry(p.w, 1.2, p.d)), lambert(0x6a5a46));
        top.position.y = p.h;
        group.add(top);
        collider = false;
        this.colliders.push({ min: new THREE.Vector3(p.x - p.w / 2, ground + p.h - 0.6, z - p.d / 2), max: new THREE.Vector3(p.x + p.w / 2, ground + p.h + 0.6, z + p.d / 2), kind: 'tower' });
        break;
      }
      case 'road': {
        const geo = this.track(new THREE.PlaneGeometry(p.w, p.d, Math.max(1, Math.round(p.w / 6)), 1));
        geo.rotateX(-Math.PI / 2);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setY(i, this.terrain.height(p.x + pos.getX(i), z + pos.getZ(i)) - ground + 0.05);
        const m = new THREE.Mesh(geo, lambert(0x8a7a62));
        group.add(m);
        collider = false;
        break;
      }
      case 'fence': {
        const m = new THREE.Mesh(this.track(new THREE.BoxGeometry(p.w, p.h, 0.1)), lambert(0x7a6a52));
        m.position.y = p.h / 2;
        group.add(m);
        break;
      }
      case 'truck':
      case 'jeep': {
        const truck = p.kind === 'truck';
        const paint = lambert(truck ? 0x4f5638 : 0x5a5f44);
        const dark = lambert(0x1c1d1f);
        const glass = lambert(0x2a3644);
        const L = p.d;
        const W = p.w;
        // 차체(길이 방향 = 로컬 z)
        const chassis = new THREE.Mesh(this.track(new THREE.BoxGeometry(W * 0.95, 0.35, L)), dark);
        chassis.position.y = 0.6;
        const cab = new THREE.Mesh(this.track(new THREE.BoxGeometry(W, truck ? 1.3 : 0.9, truck ? L * 0.3 : L * 0.55)), paint);
        cab.position.set(0, truck ? 1.4 : 1.15, truck ? L * 0.33 : 0.05);
        const wind = new THREE.Mesh(this.track(new THREE.BoxGeometry(W * 0.85, truck ? 0.55 : 0.4, 0.06)), glass);
        wind.position.set(0, truck ? 1.7 : 1.35, (truck ? L * 0.48 : L * 0.33) + 0.02);
        group.add(chassis, cab, wind);
        if (truck) {
          const bed = new THREE.Mesh(this.track(new THREE.BoxGeometry(W, 1.5, L * 0.62)), lambert(0x5d6447));
          bed.position.set(0, 1.55, -L * 0.18);
          group.add(bed);
        } else {
          const hood = new THREE.Mesh(this.track(new THREE.BoxGeometry(W * 0.95, 0.35, L * 0.3)), paint);
          hood.position.set(0, 0.95, L * 0.33);
          const bar = new THREE.Mesh(this.track(new THREE.BoxGeometry(W * 0.9, 0.08, 0.08)), dark);
          bar.position.set(0, 1.75, -0.4);
          group.add(hood, bar);
        }
        const wheelGeo = this.track(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10));
        wheelGeo.rotateZ(Math.PI / 2);
        for (const zz of truck ? [L * 0.33, -L * 0.15, -L * 0.36] : [L * 0.32, -L * 0.3]) {
          for (const sx of [-1, 1]) {
            const w = new THREE.Mesh(wheelGeo, dark);
            w.position.set((sx * W) / 2, 0.42, zz);
            group.add(w);
          }
        }
        break;
      }
      case 'barrel': {
        const colors = [0x2f4a6a, 0x7a3326, 0x4a5a2e, 0x6a6a68];
        const m = new THREE.Mesh(this.track(new THREE.CylinderGeometry(p.w / 2, p.w / 2, p.h, 12)), lambert(colors[Math.floor(rnd() * colors.length)]));
        m.position.y = p.h / 2;
        const ringGeo = this.track(new THREE.CylinderGeometry(p.w / 2 + 0.015, p.w / 2 + 0.015, 0.04, 12));
        const ringMat = lambert(0x222222);
        for (const y of [0.25, 0.75]) {
          const r = new THREE.Mesh(ringGeo, ringMat);
          r.position.y = p.h * y;
          group.add(r);
        }
        group.add(m);
        break;
      }
      case 'sandbag': {
        const bagGeo = this.track(new THREE.CapsuleGeometry(0.16, 0.45, 3, 6));
        bagGeo.rotateZ(Math.PI / 2);
        const mat = lambert(0x8f7f5f);
        const per = Math.max(2, Math.round(p.w / 0.62));
        const rows = Math.max(1, Math.round(p.h / 0.26));
        for (let r = 0; r < rows; r++) {
          for (let i = 0; i < per - (r % 2); i++) {
            const b = new THREE.Mesh(bagGeo, mat);
            b.position.set(-p.w / 2 + 0.31 + i * 0.62 + (r % 2) * 0.31, 0.14 + r * 0.25, 0);
            b.scale.set(1, 0.75, 1);
            group.add(b);
          }
        }
        break;
      }
      case 'radar': {
        const base = new THREE.Mesh(this.track(new THREE.BoxGeometry(p.w, 2.6, p.d)), lambert(0x8a8f86));
        base.position.y = 1.3;
        const mast = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.25, 0.35, p.h - 3, 8)), lambert(0x6e736c));
        mast.position.y = 2.6 + (p.h - 3) / 2;
        const spin = new THREE.Group();
        spin.position.y = p.h;
        const dishGeo = this.track(new THREE.SphereGeometry(2.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3.2));
        const dish = new THREE.Mesh(dishGeo, this.track(new THREE.MeshLambertMaterial({ color: 0xe6e6e0, side: THREE.DoubleSide, flatShading: true })));
        dish.rotation.x = Math.PI / 2.4;
        spin.add(dish);
        group.add(base, mast, spin);
        this.spinners.push(spin);
        collider = false;
        this.colliders.push({ min: new THREE.Vector3(p.x - p.w / 2, ground - 1, z - p.d / 2), max: new THREE.Vector3(p.x + p.w / 2, ground + 2.6, z + p.d / 2), kind: 'radar' });
        break;
      }
      case 'antenna': {
        const mat = lambert(0x9a9a96);
        const legGeo = this.track(new THREE.CylinderGeometry(0.05, 0.08, p.h, 5));
        for (const [lx, lz] of [[-0.3, -0.3], [0.3, -0.3], [0, 0.35]]) {
          const l = new THREE.Mesh(legGeo, mat);
          l.position.set(lx, p.h / 2, lz);
          group.add(l);
        }
        const barGeo = this.track(new THREE.BoxGeometry(0.7, 0.04, 0.04));
        for (let y = 1.5; y < p.h; y += 1.6) {
          const b = new THREE.Mesh(barGeo, mat);
          b.position.y = y;
          b.rotation.y = y * 1.3;
          group.add(b);
        }
        const light = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.15, 6, 4)), this.track(new THREE.MeshBasicMaterial({ color: 0xff2a1a })));
        light.position.y = p.h + 0.15;
        group.add(light);
        this.blinkers.push(light);
        collider = false;
        break;
      }
      case 'container': {
        const colors = [0x7a3a2c, 0x2e4f6e, 0x4c5e3a, 0x8a6a2a];
        const mat = lambert(colors[Math.floor(rnd() * colors.length)]);
        const m = new THREE.Mesh(this.track(new THREE.BoxGeometry(p.w, p.h, p.d)), mat);
        m.position.y = p.h / 2;
        group.add(m);
        const ribGeo = this.track(new THREE.BoxGeometry(0.06, p.h * 0.92, p.d + 0.06));
        const ribMat = lambert(new THREE.Color(mat.color).multiplyScalar(0.75).getHex());
        for (let x = -p.w / 2 + 0.3; x < p.w / 2; x += 0.45) {
          const r = new THREE.Mesh(ribGeo, ribMat);
          r.position.set(x, p.h / 2, 0);
          group.add(r);
        }
        break;
      }
    }
    this.scene.add(group);
    if (collider) {
      const shrink = p.kind === 'rock' ? 0.8 : 1;
      const h = p.kind === 'rock' ? p.h * 0.85 : p.h + (p.kind === 'building' ? 2 : 0);
      // 회전된 직사각형을 감싸는 축 정렬 상자
      const a = ((p.rot ?? 0) * Math.PI) / 180;
      const hw = (p.w / 2) * shrink;
      const hd = (p.d / 2) * shrink;
      const ex = Math.abs(Math.cos(a)) * hw + Math.abs(Math.sin(a)) * hd;
      const ez = Math.abs(Math.sin(a)) * hw + Math.abs(Math.cos(a)) * hd;
      this.colliders.push({
        min: new THREE.Vector3(p.x - ex, ground - 1, z - ez),
        max: new THREE.Vector3(p.x + ex, ground + h, z + ez),
        kind: p.kind,
      });
    }
  }

  private buildTrees(mission: MissionDef, quality: QualityLevel, rnd: () => number): void {
    const th = this.theme;
    const base = quality === 'high' ? 1400 : quality === 'medium' ? 850 : 450;
    const count = Math.round(base * th.treeDensity);
    const trunkGeo = this.track(th.treeShape === 'cactus' ? new THREE.CylinderGeometry(0.25, 0.3, 3, 6) : new THREE.CylinderGeometry(0.18, 0.28, 2.2, 5));
    trunkGeo.translate(0, th.treeShape === 'cactus' ? 1.5 : 1.1, 0);
    let leafGeo: THREE.BufferGeometry;
    if (th.treeShape === 'pine') {
      leafGeo = new THREE.ConeGeometry(1.6, 5.5, 6);
      leafGeo.translate(0, 4.6, 0);
    } else if (th.treeShape === 'round') {
      leafGeo = new THREE.IcosahedronGeometry(2.2, 0);
      leafGeo.translate(0, 3.8, 0);
    } else {
      leafGeo = new THREE.CylinderGeometry(0.18, 0.2, 1.4, 6);
      leafGeo.rotateZ(Math.PI / 2);
      leafGeo.translate(0, 1.8, 0);
    }
    this.track(leafGeo);
    const trunks = new THREE.InstancedMesh(trunkGeo, this.track(new THREE.MeshLambertMaterial({ color: th.treeTrunk, flatShading: true })), count);
    const leaves = new THREE.InstancedMesh(leafGeo, this.track(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true })), count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const c = new THREE.Color();
    const targetSpots = mission.targets.map((t) => ({ x: t.x, z: -t.dist }));
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 6) {
      attempts++;
      const dist = -80 + rnd() * (this.maxDist + 900);
      const x = (rnd() - 0.5) * 1400;
      const half = this.terrain.corridorHalfWidth(dist);
      // 사격 회랑 안에는 심지 않는다(시야 확보). 단, 표적 주변 장식용으로 회랑 가장자리는 허용
      if (Math.abs(x) < half * 0.9 && dist > -10) continue;
      if (Math.abs(x) < 25 && dist < 30) continue;
      if (targetSpots.some((t) => Math.hypot(t.x - x, t.z + dist) < 15)) continue;
      const z = -dist;
      const y = this.terrain.height(x, z);
      const scale = 0.8 + rnd() * 0.7;
      p.set(x, y - 0.2, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2);
      s.set(scale, scale * (0.85 + rnd() * 0.4), scale);
      m.compose(p, q, s);
      trunks.setMatrixAt(placed, m);
      leaves.setMatrixAt(placed, m);
      c.setHex(th.treeLeaf[Math.floor(rnd() * th.treeLeaf.length)]).offsetHSL(0, 0, (rnd() - 0.5) * 0.06);
      leaves.setColorAt(placed, c);
      if (Math.abs(x) < half + 120 && dist > 0 && dist < this.maxDist + 100) {
        this.colliders.push({
          min: new THREE.Vector3(x - 1.4 * scale, y, z - 1.4 * scale),
          max: new THREE.Vector3(x + 1.4 * scale, y + 7 * scale, z + 1.4 * scale),
          kind: 'tree',
        });
      }
      placed++;
    }
    trunks.count = placed;
    leaves.count = placed;
    trunks.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    this.scene.add(trunks, leaves);
  }

  /** 근경 풀: 사수 주변에 깊이감을 준다 */
  private buildGrass(quality: QualityLevel, rnd: () => number): void {
    if (this.theme.treeShape === 'cactus') return;
    const count = quality === 'high' ? 900 : 400;
    const geo = this.track(new THREE.ConeGeometry(0.05, 0.28, 3));
    geo.translate(0, 0.14, 0);
    const mat = this.track(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    const base = new THREE.Color(this.theme.groundHigh);
    for (let i = 0; i < count; i++) {
      const a = (rnd() - 0.5) * Math.PI * 1.2;
      // 사수 바로 앞은 비워 둔다(조준선 가림 방지)
      const r = 10 + rnd() * 70;
      const x = Math.sin(a) * r;
      const z = -Math.cos(a) * r;
      const s = 0.6 + rnd() * 0.8;
      m.makeScale(s, s * (0.7 + rnd() * 0.6), s);
      const pad = this.terrain.p.pad;
      // 건물 안에는 풀을 심지 않는다
      const inPad = pad && x > pad.minX - 1 && x < pad.maxX + 1 && z > pad.minZ - 1 && z < pad.maxZ + 1;
      m.setPosition(x, this.terrain.height(x, z) - (inPad ? 50 : 0.05), z);
      mesh.setMatrixAt(i, m);
      c.copy(base).offsetHSL((rnd() - 0.5) * 0.04, 0, (rnd() - 0.4) * 0.1);
      mesh.setColorAt(i, c);
    }
    this.scene.add(mesh);
  }

  private buildFlags(mission: MissionDef, rnd: () => number): void {
    const spacing = mission.flagSpacing ?? 150;
    const poleGeo = this.track(new THREE.CylinderGeometry(0.05, 0.06, 6, 5));
    poleGeo.translate(0, 3, 0);
    const poleMat = this.track(new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    const clothMat = this.track(new THREE.MeshLambertMaterial({ color: 0xff5a1f, side: THREE.DoubleSide, flatShading: true }));
    let side = 1;
    for (let d = 60; d <= this.maxDist + 40; d += spacing) {
      const x = side * (16 + rnd() * 10);
      side = -side;
      const z = -d;
      const y = this.terrain.height(x, z);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, y, z);
      const clothGeo = this.track(new THREE.PlaneGeometry(2.4, 1.3, 8, 3));
      clothGeo.translate(1.2, 0, 0);
      const cloth = new THREE.Mesh(clothGeo, clothMat);
      cloth.position.set(x, y + 5.3, z);
      this.scene.add(pole, cloth);
      this.flags.push({
        pole,
        cloth,
        base: new Float32Array(clothGeo.attributes.position.array as Float32Array),
        dist: d,
        x,
        phase: rnd() * 10,
        dir: 0,
        speed: 0,
      });
      this.colliders.push({ min: new THREE.Vector3(x - 0.08, y, z - 0.08), max: new THREE.Vector3(x + 0.08, y + 6, z + 0.08), kind: 'fence' });
    }
  }

  /** 깃발: 풍향으로 돌고, 풍속에 따라 들림 각도·펄럭임이 커진다 */
  updateFlags(wind: WindField, t: number): void {
    for (const sp of this.spinners) sp.rotation.y = t * 0.9;
    for (const b of this.blinkers) b.visible = Math.sin(t * 4) > 0;
    for (const f of this.flags) {
      const s = wind.sample(f.dist, t);
      f.dir += (s.dir - f.dir) * 0.08;
      f.speed += (s.speed - f.speed) * 0.08;
      const heading = (f.dir * Math.PI) / 180;
      // 바람 벡터 (sin, -cos) 방향으로 천이 뻗도록 회전 (천의 +X가 바람 방향)
      f.cloth.rotation.y = Math.atan2(Math.cos(heading), Math.sin(heading));
      // 0m/s → 거의 늘어짐(80°), 8m/s 이상 → 수평
      const lift = Math.min(1, f.speed / 8);
      f.cloth.rotation.z = -(1 - lift) * 1.35;
      const pos = f.cloth.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const amp = 0.08 + lift * 0.25;
      const freq = 2 + f.speed * 0.9;
      for (let i = 0; i < arr.length; i += 3) {
        const bx = f.base[i];
        const by = f.base[i + 1];
        const k = bx / 2.4;
        arr[i + 2] = Math.sin(t * freq + bx * 2.2 + f.phase) * amp * k + Math.sin(t * freq * 1.7 + by * 3) * amp * 0.3 * k;
        arr[i + 1] = by - k * k * 0.08 * (1 - lift);
      }
      pos.needsUpdate = true;
      f.cloth.geometry.computeVertexNormals();
    }
  }

  dispose(): void {
    this.interior?.dispose();
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.scene.clear();
  }
}

/** 선분(p0→p1)과 AABB 교차: 0~1 사이 t 또는 null */
export function segmentBox(p0: THREE.Vector3, p1: THREE.Vector3, b: Box): number | null {
  let tmin = 0;
  let tmax = 1;
  for (const axis of ['x', 'y', 'z'] as const) {
    const d = p1[axis] - p0[axis];
    if (Math.abs(d) < 1e-9) {
      if (p0[axis] < b.min[axis] || p0[axis] > b.max[axis]) return null;
    } else {
      let t1 = (b.min[axis] - p0[axis]) / d;
      let t2 = (b.max[axis] - p0[axis]) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}
