// 1인칭 손·총. 별도 장면/카메라로 그려 벽에 파묻히지 않게 한다.
import * as THREE from '../../vendor/three.module.js';
import { viewmodelGeometry, muzzleOffset } from './models.js';
import { clamp, lerp } from '../sim/geom.js';

const HIP = new THREE.Vector3(0.15, -0.16, -0.36);
const AIM = { m4: new THREE.Vector3(0, -0.085, -0.26), mp5: new THREE.Vector3(0, -0.085, -0.25), shotgun: new THREE.Vector3(0, -0.08, -0.28), pistol: new THREE.Vector3(0, -0.062, -0.3) };

export class Viewmodel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(54, 1, 0.01, 5);
    this.scene.add(new THREE.HemisphereLight(0xe8ecf2, 0x4a443c, 1.8));
    const d = new THREE.DirectionalLight(0xffffff, 1.2); d.position.set(0.5, 1, 0.4); this.scene.add(d);
    this.group = new THREE.Group();
    this.group.scale.setScalar(0.72);
    this.scene.add(this.group);
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 });
    this.meshes = {};
    for (const id of ['m4', 'mp5', 'shotgun', 'pistol']) {
      const m = new THREE.Mesh(viewmodelGeometry(id), this.mat);
      m.visible = false;
      this.group.add(m);
      this.meshes[id] = m;
    }
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.3, 'rgba(255,190,80,0.9)'); g.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flash.visible = false;
    this.group.add(this.flash);
    this.id = 'm4';
    this.pos = HIP.clone();
    this.recoil = 0; this.reloadT = 0; this.reloadDur = 1; this.flashT = 0; this.swapT = 0;
    this.sway = new THREE.Vector2();
  }
  resize(aspect) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); }
  setWeapon(id) {
    for (const k in this.meshes) this.meshes[k].visible = k === id;
    this.id = id;
    this.flash.position.copy(muzzleOffset(id));
    this.swapT = 0.3;
    this.reloadT = 0;
  }
  kick() { this.recoil = Math.min(1, this.recoil + (this.id === 'shotgun' ? 1 : 0.45)); this.flashT = 0.045; this.flash.material.rotation = Math.random() * 6; const s = this.id === 'shotgun' ? 0.3 : 0.2; this.flash.scale.set(s, s, 1); }
  reload(dur) { this.reloadT = dur; this.reloadDur = dur; }

  // 화면 밖 장면 좌표로 총구 위치(예광선 시작점)
  muzzleWorld(cam) {
    const p = this.group.localToWorld(muzzleOffset(this.id).clone());
    // 뷰모델 카메라 좌표 → 월드 카메라 좌표
    p.applyMatrix4(this.camera.matrixWorldInverse);
    p.multiplyScalar(1.0);
    return p.applyMatrix4(cam.matrixWorld);
  }

  update(dt, world, input) {
    const L = world.leader;
    const aim = L.aiming && !L.reloadUntil;
    const target = aim ? AIM[this.id] : HIP;
    this.pos.lerp(target, clamp(dt * 14, 0, 1));
    this.recoil = Math.max(0, this.recoil - dt * 7);
    this.flashT -= dt; this.flash.visible = this.flashT > 0;
    this.swapT = Math.max(0, this.swapT - dt);
    let reloadDip = 0;
    if (this.reloadT > 0) { this.reloadT -= dt; const k = 1 - this.reloadT / this.reloadDur; reloadDip = Math.sin(Math.PI * clamp(k, 0, 1)); }
    const mv = L.moving ? 1 : 0;
    const t = world.time;
    const bobX = Math.sin(t * (L.sprinting ? 7 : 4.5)) * 0.008 * mv * (aim ? 0.3 : 1);
    const bobY = Math.abs(Math.cos(t * (L.sprinting ? 7 : 4.5))) * 0.01 * mv * (aim ? 0.3 : 1);
    if (input) { this.sway.x = lerp(this.sway.x, clamp(-input.lastDyaw * 2, -0.04, 0.04), clamp(dt * 8, 0, 1)); this.sway.y = lerp(this.sway.y, clamp(input.lastDpitch * 2, -0.04, 0.04), clamp(dt * 8, 0, 1)); }
    this.group.position.set(this.pos.x + bobX + this.sway.x * 0.3, this.pos.y - bobY - reloadDip * 0.12 - this.swapT * 0.4 - this.sway.y * 0.3, this.pos.z + this.recoil * 0.05);
    const sprint = L.sprinting ? 1 : 0;
    this.sprintK = lerp(this.sprintK || 0, sprint, clamp(dt * 8, 0, 1));
    this.group.rotation.set(this.recoil * 0.12 - reloadDip * 0.6 - this.sprintK * 0.5, this.sway.x + this.sprintK * 0.7, -reloadDip * 0.3 + this.sprintK * 0.2);
  }
}
