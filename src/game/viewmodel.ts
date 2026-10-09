/**
 * 1인칭 총기 모델. 별도 씬으로 그려서 지형에 파묻히지 않게 한다.
 * PBR 재질 + 환경맵(RoomEnvironment)으로 금속 광택, 조명 색은 작전 시간대를 따른다.
 * 조준·반동·볼트·재장전·터렛 회전을 애니메이션으로 보여준다.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { WeaponSpec } from '../config/weapons';
import { buildRifle, type RifleRig } from './models/rifle';

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

  constructor(renderer: THREE.WebGLRenderer) {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x445544, 0.9);
    this.key = new THREE.DirectionalLight(0xffffff, 2.2);
    this.key.position.set(-1, 2, 1.2);
    this.flash = new THREE.PointLight(0xffb060, 0, 1.5, 2);
    this.scene.add(this.hemi, this.key, this.flash, this.root);
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
    this.rig.group.scale.setScalar(0.72);
    this.root.add(this.rig.group);
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
    const hipX = 0.16, hipY = -0.15, hipZ = -0.36;
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
    this.rig?.dispose();
    this.envTex?.dispose();
  }
}
