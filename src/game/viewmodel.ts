/**
 * 1인칭 총기 모델. 별도 씬으로 그려서 지형에 파묻히지 않게 한다.
 * 조준·반동·볼트·재장전·터렛 회전을 애니메이션으로 보여준다.
 */
import * as THREE from 'three';
import type { WeaponSpec } from '../config/weapons';

export class ViewModel {
  readonly scene = new THREE.Scene();
  private readonly root = new THREE.Group();
  private readonly gun = new THREE.Group();
  private readonly bolt = new THREE.Group();
  private readonly elevKnob = new THREE.Group();
  private readonly windKnob = new THREE.Group();
  private readonly mag = new THREE.Group();
  private readonly disposables: { dispose(): void }[] = [];
  private recoil = 0;
  private recoilV = 0;
  private t = 0;

  constructor() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445544, 1.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1.6);
    dl.position.set(-1, 2, 1);
    this.scene.add(dl);
    this.scene.add(this.root);
    this.root.add(this.gun);
    this.gun.scale.setScalar(0.85);
  }

  build(weapon: WeaponSpec): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.gun.clear();
    this.bolt.clear();
    this.elevKnob.clear();
    this.windKnob.clear();
    this.mag.clear();
    const mat = (c: number) => {
      const m = new THREE.MeshLambertMaterial({ color: c, flatShading: true });
      this.disposables.push(m);
      return m;
    };
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.gun) => {
      const g = new THREE.BoxGeometry(w, h, d);
      this.disposables.push(g);
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };
    const cyl = (r0: number, r1: number, len: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.gun, seg = 10) => {
      const g = new THREE.CylinderGeometry(r0, r1, len, seg);
      g.rotateX(Math.PI / 2);
      this.disposables.push(g);
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };
    const body = mat(weapon.color);
    const metal = mat(0x2b2d30);
    const dark = mat(0x18191b);
    const accent = mat(0x8a8f96);
    const long = weapon.id === 'l338' ? 1.15 : weapon.id === 'k65' ? 0.95 : 1;
    // 개머리판·몸통
    box(0.07, 0.11, 0.32, body, 0, -0.03, 0.28);
    box(0.05, 0.05, 0.12, body, 0, 0.04, 0.2);
    box(0.08, 0.08, 0.5, body, 0, -0.01, -0.12);
    box(0.06, 0.1, 0.06, body, 0, -0.09, 0.04); // 손잡이
    // 총열
    cyl(0.013, 0.016, 0.75 * long, metal, 0, 0.01, -0.62 * long);
    cyl(0.022, 0.022, 0.07, dark, 0, 0.01, -1.0 * long - 0.02); // 소염기
    // 탄창
    box(0.05, 0.09, 0.08, dark, 0, -0.08, -0.08, this.mag);
    this.gun.add(this.mag);
    // 스코프
    cyl(0.022, 0.022, 0.3, dark, 0, 0.085, -0.08);
    cyl(0.03, 0.022, 0.07, dark, 0, 0.085, -0.26);
    cyl(0.022, 0.028, 0.06, dark, 0, 0.085, 0.09);
    box(0.02, 0.04, 0.02, metal, 0, 0.05, -0.15);
    box(0.02, 0.04, 0.02, metal, 0, 0.05, 0.0);
    // 터렛
    this.elevKnob.position.set(0, 0.115, -0.07);
    const ek = new THREE.CylinderGeometry(0.017, 0.017, 0.025, 12);
    this.disposables.push(ek);
    this.elevKnob.add(new THREE.Mesh(ek, accent));
    const mark = new THREE.BoxGeometry(0.003, 0.027, 0.008);
    this.disposables.push(mark);
    const em = new THREE.Mesh(mark, mat(0xffffff));
    em.position.set(0, 0, 0.015);
    this.elevKnob.add(em);
    this.gun.add(this.elevKnob);
    this.windKnob.position.set(0.035, 0.085, -0.07);
    this.windKnob.rotation.z = Math.PI / 2;
    this.windKnob.add(new THREE.Mesh(ek, accent));
    const wm = new THREE.Mesh(mark, mat(0xffffff));
    wm.position.set(0, 0, 0.015);
    this.windKnob.add(wm);
    this.gun.add(this.windKnob);
    // 볼트 손잡이(오른쪽)
    this.bolt.position.set(0.04, 0.02, 0.02);
    const shaft = new THREE.BoxGeometry(0.05, 0.01, 0.01);
    this.disposables.push(shaft);
    const s = new THREE.Mesh(shaft, metal);
    s.position.x = 0.025;
    this.bolt.add(s);
    const knob = new THREE.SphereGeometry(0.012, 6, 4);
    this.disposables.push(knob);
    const k = new THREE.Mesh(knob, dark);
    k.position.x = 0.05;
    this.bolt.add(k);
    this.gun.add(this.bolt);
    // 양각대
    for (const sx of [-1, 1]) {
      const leg = box(0.01, 0.16, 0.01, metal, sx * 0.03, -0.08, -0.55 * long);
      leg.rotation.z = sx * 0.35;
    }
  }

  kick(strength: number): void {
    this.recoilV += strength;
  }

  /**
   * @param aim 0 = 허리, 1 = 스코프에 눈을 댐
   * @param boltProgress 0~1 (볼트 조작 진행), -1 = 없음
   * @param reloadProgress 0~1, -1 = 없음
   */
  update(dt: number, aim: number, boltProgress: number, reloadProgress: number, elevMil: number, windMil: number, sway: { x: number; y: number }): void {
    this.t += dt;
    this.recoilV += (-this.recoil * 260 - this.recoilV * 24) * dt;
    this.recoil += this.recoilV * dt;
    const e = aim * aim * (3 - 2 * aim);
    // 허리 자세 → 스코프 자세
    const hipX = 0.2, hipY = -0.19, hipZ = -0.42;
    const adsX = 0, adsY = -0.085, adsZ = -0.2;
    this.root.position.set(
      hipX + (adsX - hipX) * e + sway.x * 0.002,
      hipY + (adsY - hipY) * e + sway.y * 0.002 + Math.sin(this.t * 1.4) * 0.002 * (1 - e),
      hipZ + (adsZ - hipZ) * e + this.recoil * 0.06,
    );
    this.root.rotation.set(this.recoil * 0.25, (1 - e) * 0.06, 0);
    // 볼트: 들기(0~0.2) → 당기기(0.2~0.5) → 밀기(0.5~0.8) → 내리기(0.8~1)
    let lift = 0;
    let pull = 0;
    if (boltProgress >= 0) {
      const b = boltProgress;
      lift = b < 0.2 ? b / 0.2 : b < 0.8 ? 1 : 1 - (b - 0.8) / 0.2;
      pull = b < 0.2 ? 0 : b < 0.5 ? (b - 0.2) / 0.3 : b < 0.8 ? 1 - (b - 0.5) / 0.3 : 0;
      this.root.rotation.z = -0.12 * Math.sin(Math.PI * b);
    }
    this.bolt.rotation.x = 0;
    this.bolt.rotation.z = lift * 1.2;
    this.bolt.position.z = 0.02 + pull * 0.09;
    // 재장전: 총을 기울이고 탄창이 빠졌다 들어간다
    if (reloadProgress >= 0) {
      const r = reloadProgress;
      this.root.rotation.z = 0.35 * Math.sin(Math.PI * Math.min(1, r * 1.1));
      this.mag.position.y = r < 0.5 ? -r * 0.4 : -(1 - r) * 0.4;
    } else {
      this.mag.position.y = 0;
    }
    this.elevKnob.rotation.y = -elevMil * 0.6;
    this.windKnob.rotation.y = windMil * 0.6;
  }

  get root3d(): THREE.Group {
    return this.root;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}
