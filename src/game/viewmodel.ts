/**
 * 1인칭 총기 모델. 별도 씬으로 그려서 지형에 파묻히지 않게 한다.
 * PBR 재질 + 환경맵(RoomEnvironment)으로 금속 광택, 조명 색은 작전 시간대를 따른다.
 * 조준·반동·볼트·재장전·터렛 회전을 애니메이션으로 보여준다.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { WeaponSpec } from '../config/weapons';
import { buildRifle, type RifleRig } from './models/rifle';
import { buildCqbGun, type GunRig } from './models/guns';
import type { CqbSpec, PartChoice } from '../config/sidearms';

export class ViewModel {
  readonly scene = new THREE.Scene();
  private readonly root = new THREE.Group();
  private rig: RifleRig | null = null;
  private recoil = 0;
  private recoilV = 0;
  private t = 0;
  private readonly hemi: THREE.HemisphereLight;
  private readonly key: THREE.DirectionalLight;
  private readonly flash: THREE.PointLight;
  private flashT = 0;
  private envTex: THREE.Texture | null = null;
  /** 휴대폰: 총을 작게, 화면 오른쪽 아래로(터치 버튼과 겹치지 않게) */
  compact = false;
  /** 실내 화기(권총·주무기) */
  private readonly gunRoot = new THREE.Group();
  private guns = new Map<string, GunRig>();
  private activeGun: GunRig | null = null;
  private gunKey = '';

  constructor(renderer: THREE.WebGLRenderer) {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x445544, 0.9);
    this.key = new THREE.DirectionalLight(0xffffff, 2.2);
    this.key.position.set(-1, 2, 1.2);
    this.flash = new THREE.PointLight(0xffb060, 0, 1.5, 2);
    this.scene.add(this.hemi, this.key, this.flash, this.root, this.gunRoot);
    this.gunRoot.visible = false;
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environment = this.envTex;
      this.scene.environmentIntensity = 0.55;
      pmrem.dispose();
    } catch {
      /* 환경맵 실패 시 기본 조명만 사용 */
    }
  }

  build(weapon: WeaponSpec, suppressor: boolean): void {
    if (this.rig) {
      this.root.remove(this.rig.group);
      this.rig.dispose();
    }
    this.rig = buildRifle(weapon, suppressor);
    this.rig.group.scale.setScalar(this.compact ? 0.5 : 0.72);
    this.root.add(this.rig.group);
  }

  /**
   * 코드로 만든 저격총 모양을 사실적인 3D 모델로 바꾼다(총구 -Z).
   * 원래 모양의 크기에 맞춰(길이 · 스코프 위쪽 높이 · 총구 위치) 얹고, 원래 메시는 숨긴다.
   */
  replaceRifleVisual(model: THREE.Object3D, darken = 0.26): void {
    if (this.rig) this.fitModel(this.rig.group, model, darken);
  }

  /** 실내 화기(권총 등)의 모양을 사실적인 모델로 바꾼다(총구 -Z로 돌려서 넘길 것) */
  replaceGunVisual(id: string, model: THREE.Object3D, darken = 0.45): void {
    const g = this.guns.get(id);
    if (g) this.fitModel(g.group, model, darken);
  }

  /** 원래 모양의 크기(길이 · 위쪽 높이 · 총구 위치)에 맞춰 모델을 얹고 원래 메시는 숨긴다. darken: 색을 이만큼 곱해 검게 */
  private fitModel(g: THREE.Group, model: THREE.Object3D, darken: number): void {
    const keepScale = g.scale.clone();
    g.scale.set(1, 1, 1);
    g.updateMatrixWorld(true);
    const inv = g.matrixWorld.clone().invert();
    const target = new THREE.Box3();
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible) return;
      m.geometry.computeBoundingBox();
      target.union(m.geometry.boundingBox!.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld)));
      m.visible = false;
    });
    const src = new THREE.Box3().setFromObject(model);
    const size = src.getSize(new THREE.Vector3());
    const s = (target.max.z - target.min.z) / size.z;
    model.scale.multiplyScalar(s);
    model.position.add(new THREE.Vector3(-((src.min.x + src.max.x) / 2) * s, target.max.y - src.max.y * s, target.min.z - src.min.z * s));
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.frustumCulled = false;
      // 환경 반사를 줄이고 색을 낮춰 무광의 검은 총처럼(가까이서 번쩍이지 않게)
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.envMapIntensity = 0.25;
      mat.metalness = 0.3;
      mat.roughnessMap = null;
      mat.roughness = 0.55;
      mat.color.multiplyScalar(darken);
      m.material = mat;
    });
    g.add(model);
    g.scale.copy(keepScale);
  }

  /** 실내 화기 모델을 (다시) 만든다. 같은 구성이면 그대로 둔다 */
  buildGuns(list: { spec: CqbSpec; parts: PartChoice }[]): void {
    const key = list.map((g) => `${g.spec.id}:${Object.values(g.parts).join(',')}`).join('|');
    if (key === this.gunKey) return;
    this.gunKey = key;
    for (const g of this.guns.values()) g.dispose();
    this.guns.clear();
    for (const { spec, parts } of list) {
      const rig = buildCqbGun(spec, parts);
      rig.group.visible = false;
      this.gunRoot.add(rig.group);
      this.guns.set(spec.id, rig);
      rig.group.scale.setScalar(this.compact ? 0.62 : 0.75);
    }
    this.activeGun = null;
  }

  /** 'rifle' 또는 실내 화기 id */
  setActive(id: string): void {
    const rifle = id === 'rifle';
    this.root.visible = rifle;
    this.gunRoot.visible = !rifle;
    this.activeGun = null;
    for (const [gid, g] of this.guns) {
      g.group.visible = gid === id;
      if (gid === id) this.activeGun = g;
    }
  }

  /**
   * 실내 화기 자세.
   * @param ads 0 = 허리, 1 = 조준(조준선이 화면 중앙)
   * @param raise 0 = 내린 상태(무기 교체 중), 1 = 든 상태
   * @param reloadProgress 0~1, -1 = 없음
   */
  updateGun(dt: number, ads: number, raise: number, reloadProgress: number, sway: { x: number; y: number }): void {
    const g = this.activeGun;
    if (!g) return;
    this.t += dt;
    let left = Math.min(dt, 0.25);
    while (left > 0) {
      const h = Math.min(left, 1 / 240);
      this.recoilV += (-this.recoil * 420 - this.recoilV * 32) * h;
      this.recoil += this.recoilV * h;
      left -= h;
    }
    this.flashT = Math.max(0, this.flashT - dt);
    this.flash.intensity = this.flashT > 0 ? 5 : 0;
    this.flash.position.copy(g.muzzle).applyMatrix4(g.group.matrixWorld);
    const e = ads * ads * (3 - 2 * ads);
    const pistol = g.slide.children.length > 0;
    const hipX = this.compact ? 0.15 : 0.13, hipY = this.compact ? -0.16 : -0.13, hipZ = pistol ? -0.34 : -0.3;
    const adsZ = pistol ? -0.28 : -0.12;
    const down = 1 - raise;
    const breath = Math.sin(this.t * 1.6) * 0.002 * (1 - e);
    this.gunRoot.position.set(
      hipX * (1 - e) + sway.x * 0.002 * (1 - e * 0.7),
      hipY * (1 - e) - g.sightY * g.group.scale.y * e + sway.y * 0.002 * (1 - e * 0.7) + breath - down * 0.25,
      hipZ + (adsZ - hipZ) * e + this.recoil * 0.05,
    );
    this.gunRoot.rotation.set(this.recoil * 0.35 - down * 0.6, (1 - e) * 0.06, (1 - e) * -0.04);
    // 권총 슬라이드가 뒤로 밀렸다 돌아온다
    g.slide.position.z = Math.min(0.03, Math.max(0, this.recoil * 0.4));
    if (reloadProgress >= 0) {
      const r = reloadProgress;
      this.gunRoot.rotation.z += 0.45 * Math.sin(Math.PI * Math.min(1, r * 1.1));
      this.gunRoot.rotation.x += 0.15 * Math.sin(Math.PI * r);
      g.mag.position.y = r < 0.5 ? -r * 0.5 : -(1 - r) * 0.5;
    } else g.mag.position.y = 0;
  }

  /** 작전 시간대 조명 */
  setLighting(sun: number, sky: number, ground: number, intensity: number): void {
    this.key.color.setHex(sun);
    this.key.intensity = 1.2 + intensity * 0.5;
    this.hemi.color.setHex(sky);
    this.hemi.groundColor.setHex(ground);
  }

  kick(strength: number, flash: boolean): void {
    this.recoilV += strength;
    if (flash) this.flashT = 0.06;
  }

  /**
   * @param aim 0 = 허리, 1 = 스코프에 눈을 댐
   * @param boltProgress 0~1 (볼트 조작 진행), -1 = 없음
   * @param reloadProgress 0~1, -1 = 없음
   */
  update(dt: number, aim: number, boltProgress: number, reloadProgress: number, elevMil: number, windMil: number, sway: { x: number; y: number }): void {
    const rig = this.rig;
    if (!rig) return;
    this.t += dt;
    // 스프링은 큰 dt에서 발산한다 → 1/240초 단위로 나눠 적분(느린 프레임·끊김에서도 안정)
    let left = Math.min(dt, 0.25);
    while (left > 0) {
      const h = Math.min(left, 1 / 240);
      this.recoilV += (-this.recoil * 260 - this.recoilV * 24) * h;
      this.recoil += this.recoilV * h;
      left -= h;
    }
    this.flashT = Math.max(0, this.flashT - dt);
    this.flash.intensity = this.flashT > 0 ? 6 : 0;
    this.flash.position.copy(rig.muzzle).applyMatrix4(rig.group.matrixWorld);
    const e = aim * aim * (3 - 2 * aim);
    // 허리 자세 → 스코프 자세
    const hipX = this.compact ? 0.17 : 0.16, hipY = this.compact ? -0.19 : -0.15, hipZ = -0.36;
    const adsX = 0, adsY = -0.062, adsZ = -0.14;
    const breath = Math.sin(this.t * 1.4) * 0.0025 * (1 - e);
    this.root.position.set(
      hipX + (adsX - hipX) * e + sway.x * 0.002,
      hipY + (adsY - hipY) * e + sway.y * 0.002 + breath,
      hipZ + (adsZ - hipZ) * e + this.recoil * 0.06,
    );
    this.root.rotation.set(this.recoil * 0.25, (1 - e) * 0.05, (1 - e) * -0.03);
    // 볼트: 들기(0~0.2) → 당기기(0.2~0.5) → 밀기(0.5~0.8) → 내리기(0.8~1)
    let lift = 0;
    let pull = 0;
    if (boltProgress >= 0) {
      const b = boltProgress;
      lift = b < 0.2 ? b / 0.2 : b < 0.8 ? 1 : 1 - (b - 0.8) / 0.2;
      pull = b < 0.2 ? 0 : b < 0.5 ? (b - 0.2) / 0.3 : b < 0.8 ? 1 - (b - 0.5) / 0.3 : 0;
      this.root.rotation.z += -0.14 * Math.sin(Math.PI * b);
    }
    rig.bolt.rotation.z = lift * 1.2;
    rig.bolt.position.z = 0.03 + pull * 0.085;
    // 재장전: 총을 기울이고 탄창이 빠졌다 들어간다
    if (reloadProgress >= 0) {
      const r = reloadProgress;
      this.root.rotation.z += 0.38 * Math.sin(Math.PI * Math.min(1, r * 1.1));
      rig.mag.position.y = r < 0.5 ? -r * 0.4 : -(1 - r) * 0.4;
    } else {
      rig.mag.position.y = 0;
    }
    rig.elevKnob.rotation.y = -elevMil * 0.6;
    rig.windKnob.rotation.y = windMil * 0.6;
  }

  dispose(): void {
    for (const g of this.guns.values()) g.dispose();
    this.rig?.dispose();
    this.envTex?.dispose();
  }
}
