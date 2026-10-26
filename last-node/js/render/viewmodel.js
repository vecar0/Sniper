// 1인칭 총 + 팔: 별도 장면·카메라(시야 60°)로 그려 벽에 파묻히지 않는다.
// 흔들림(걷기·시점 회전 지연) · 조준 정렬 · 반동 스프링 · 재장전 · 교체 · 근접 · 투척 · 대시 기울기
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from '../../vendor/three/addons/utils/BufferGeometryUtils.js';
import { glowTexture } from './materials.js';
import { WEAPONS } from '../config/balance.js';

const rb = (w, h, d, r, x = 0, y = 0, z = 0) => { const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)); g.translate(x, y, z); return g; };
const cy = (r, h, x = 0, y = 0, z = 0, seg = 16, r2 = r) => { const g = new THREE.CylinderGeometry(r, r2, h, seg); g.rotateX(Math.PI / 2); g.translate(x, y, z); return g; };
const merge = (list) => mergeGeometries(list.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); return n; }), false);

export class ViewModel {
  constructor(renderer, aspect) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.01, 10);
    this.scene.add(this.camera);
    this.root = new THREE.Group();
    this.camera.add(this.root);
    // 조명: 주변(환경맵은 메인 장면 것을 공유) + 위쪽 차가운 빛 + 아래 네온 반사광
    this.scene.add(new THREE.HemisphereLight(0x6a86b0, 0x1a0a1e, 0.6));
    const key = new THREE.DirectionalLight(0xbfd6ff, 0.8); key.position.set(-1, 2, 1); this.scene.add(key);
    this.rim = new THREE.PointLight(0xff2bd6, 0.25, 3); this.rim.position.set(0.9, -0.2, -0.3); this.camera.add(this.rim);
    this.coreTint = new THREE.PointLight(0x27e8ff, 0.18, 3); this.coreTint.position.set(-0.8, 0.5, -0.4); this.camera.add(this.coreTint);
    this.muzzleLight = new THREE.PointLight(0xffb070, 0, 4, 2); this.camera.add(this.muzzleLight);

    this.mats = {
      gun: new THREE.MeshStandardMaterial({ color: 0x1c1f24, metalness: 0.85, roughness: 0.4, envMapIntensity: 0.9 }),
      gunLight: new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 1, roughness: 0.3, envMapIntensity: 1.0 }),
      polymer: new THREE.MeshStandardMaterial({ color: 0x0d0e11, metalness: 0.1, roughness: 0.62, envMapIntensity: 0.8 }),
      accent: new THREE.MeshStandardMaterial({ color: 0x0a2a33, metalness: 0.6, roughness: 0.3, emissive: new THREE.Color(0x27e8ff), emissiveIntensity: 0.6 }),
      glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.6, 3.2) }),
      glowDim: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.8, 1.0) }),
      glowHot: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.2, 0.4) }),
      glove: new THREE.MeshStandardMaterial({ color: 0x15161a, metalness: 0.2, roughness: 0.7 }),
      sleeve: new THREE.MeshStandardMaterial({ color: 0x1f2630, metalness: 0.1, roughness: 0.85 }),
      armor: new THREE.MeshStandardMaterial({ color: 0x2a3038, metalness: 0.85, roughness: 0.4, envMapIntensity: 0.9 }),
      blade: new THREE.MeshStandardMaterial({ color: 0xaab4bf, metalness: 1, roughness: 0.15, envMapIntensity: 2 }),
    };
    this.ammoCanvas = document.createElement('canvas'); this.ammoCanvas.width = 128; this.ammoCanvas.height = 64;
    this.ammoTex = new THREE.CanvasTexture(this.ammoCanvas); this.ammoTex.colorSpace = THREE.SRGBColorSpace;
    this.ammoMat = new THREE.MeshBasicMaterial({ map: this.ammoTex, transparent: true, color: new THREE.Color(1.6, 1.6, 1.6) });
    this.reticleMat = new THREE.MeshBasicMaterial({ map: reticleTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(1.5, 1.5, 1.5) });

    this.guns = {};
    for (const id of Object.keys(WEAPONS)) { this.guns[id] = this.buildGun(id); this.guns[id].group.visible = false; this.root.add(this.guns[id].group); }
    this.arms = this.buildArms();
    this.root.add(this.arms.group);
    this.knife = this.buildKnife();
    this.root.add(this.knife);
    this.nade = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshStandardMaterial({ color: 0x15181d, metalness: 0.8, roughness: 0.3, emissive: new THREE.Color(0.2, 1.4, 2.2) }));
    this.nade.visible = false; this.root.add(this.nade);

    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,1)'), color: 0xffc080, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.flash.visible = false;
    this.flash2 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: starTexture(), color: new THREE.Color(3, 1.8, 0.9), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.flash2.visible = false;

    this.cur = 'pistol';
    this.state = { bobT: 0, swayX: 0, swayY: 0, kick: 0, kickV: 0, roll: 0, switchK: 1, reloadK: 0, meleeK: 0, throwK: 0, land: 0, landV: 0, adsK: 0, flashT: 9, lastYaw: 0, lastPitch: 0, charge: 0 };
    this.lastAmmo = '';
    this.setWeapon('pistol', true);
  }

  buildGun(id) {
    const m = this.mats, g = new THREE.Group();
    const parts = [];
    const add = (geo, mat, name) => { const mesh = new THREE.Mesh(geo, mat); if (name) mesh.name = name; g.add(mesh); parts.push(mesh); return mesh; };
    let muzzle, sightY, mag, gripL, gripR, display;
    if (id === 'pistol') {
      add(merge([rb(0.045, 0.05, 0.22, 0.01, 0, 0.03, -0.05), rb(0.04, 0.02, 0.18, 0.006, 0, 0.065, -0.05)]), m.gun);
      add(rb(0.038, 0.11, 0.05, 0.012, 0, -0.035, 0.035), m.polymer);
      add(rb(0.04, 0.025, 0.07, 0.008, 0, 0.005, 0.0), m.polymer);
      add(cy(0.009, 0.03, 0, 0.035, -0.17), m.gunLight);
      add(rb(0.046, 0.006, 0.12, 0.002, 0, 0.042, -0.06), m.glow);
      add(rb(0.02, 0.022, 0.03, 0.004, 0, 0.088, -0.01), m.gun);
      display = add(new THREE.PlaneGeometry(0.036, 0.018), this.ammoMat); display.position.set(-0.0235, 0.03, 0.0); display.rotation.y = -Math.PI / 2 + 0.35;
      mag = add(rb(0.03, 0.05, 0.035, 0.006, 0, -0.1, 0.035), m.gun);
      muzzle = new THREE.Vector3(0, 0.035, -0.19); sightY = 0.095;
      gripR = new THREE.Vector3(0, -0.03, 0.04); gripL = new THREE.Vector3(-0.02, -0.04, 0.03);
    } else if (id === 'shotgun') {
      add(rb(0.07, 0.08, 0.36, 0.015, 0, 0.0, -0.05), m.gun);
      add(cy(0.022, 0.42, 0, 0.025, -0.38, 16), m.gunLight);
      add(cy(0.02, 0.36, 0, -0.025, -0.33, 16), m.gun);
      const pump = add(rb(0.075, 0.06, 0.16, 0.02, 0, -0.025, -0.3), m.polymer); pump.name = 'pump';
      add(rb(0.06, 0.12, 0.06, 0.015, 0, -0.08, 0.1), m.polymer);
      add(rb(0.05, 0.07, 0.22, 0.02, 0, -0.02, 0.24), m.polymer);
      add(rb(0.072, 0.012, 0.3, 0.004, 0, 0.045, -0.06), m.accent);
      for (let i = 0; i < 4; i++) add(cy(0.011, 0.06, 0.04, -0.01, -0.02 + i * 0.03, 8), m.glowHot).rotation.y = Math.PI / 2;
      display = add(new THREE.PlaneGeometry(0.05, 0.025), this.ammoMat); display.position.set(-0.037, 0.013, 0.11); display.rotation.y = -Math.PI / 2 + 0.35;
      add(rb(0.03, 0.03, 0.05, 0.006, 0, 0.06, -0.05), m.gun);
      mag = null;
      muzzle = new THREE.Vector3(0, 0.025, -0.6); sightY = 0.08;
      gripR = new THREE.Vector3(0, -0.06, 0.1); gripL = new THREE.Vector3(0, -0.04, -0.3);
    } else if (id === 'rifle') {
      add(rb(0.06, 0.09, 0.42, 0.015, 0, 0.0, -0.04), m.gun);
      add(rb(0.07, 0.07, 0.24, 0.02, 0, 0.005, -0.33), m.polymer);
      for (let i = 0; i < 5; i++) add(rb(0.072, 0.01, 0.03, 0.003, 0, 0.0, -0.25 - i * 0.04), m.glow);
      add(cy(0.014, 0.2, 0, 0.01, -0.53), m.gunLight);
      add(cy(0.022, 0.06, 0, 0.01, -0.62, 6), m.gun);
      add(rb(0.055, 0.12, 0.055, 0.012, 0, -0.08, 0.08), m.polymer);
      add(rb(0.05, 0.07, 0.24, 0.02, 0, -0.01, 0.27), m.polymer);
      add(rb(0.058, 0.014, 0.36, 0.004, 0, 0.052, -0.08), m.gunLight);
      // 홀로 조준경
      add(rb(0.05, 0.012, 0.08, 0.004, 0, 0.066, -0.04), m.gun);
      for (const sx of [-0.022, 0.022]) add(rb(0.006, 0.05, 0.018, 0.002, sx, 0.095, -0.06), m.gun);
      add(rb(0.05, 0.006, 0.018, 0.002, 0, 0.122, -0.06), m.gun);
      const lens = add(new THREE.PlaneGeometry(0.036, 0.03), new THREE.MeshPhysicalMaterial({ color: 0x66e8ff, transparent: true, opacity: 0.25, roughness: 0, metalness: 0, envMapIntensity: 2 }));
      lens.position.set(0, 0.095, -0.06); lens.name = 'lens';
      mag = add(rb(0.04, 0.13, 0.07, 0.01, 0, -0.1, -0.08), m.gun);
      add(rb(0.042, 0.012, 0.072, 0.003, 0, -0.06, -0.08), m.glow);
      display = add(new THREE.PlaneGeometry(0.05, 0.025), this.ammoMat); display.position.set(-0.031, 0.025, 0.07); display.rotation.y = -Math.PI / 2 + 0.35;
      muzzle = new THREE.Vector3(0, 0.01, -0.66); sightY = 0.098;
      gripR = new THREE.Vector3(0, -0.06, 0.08); gripL = new THREE.Vector3(0, -0.035, -0.3);
    } else {
      add(rb(0.075, 0.1, 0.5, 0.02, 0, 0.0, -0.06), m.gun);
      // 레일 두 줄 + 코일
      for (const sx of [-0.025, 0.025]) add(rb(0.016, 0.03, 0.62, 0.005, sx, 0.0, -0.5), m.gunLight);
      for (let i = 0; i < 6; i++) { const c = add(new THREE.TorusGeometry(0.045, 0.01, 6, 20), m.glow); c.position.set(0, 0, -0.32 - i * 0.065); c.name = 'coil' + i; }
      add(rb(0.06, 0.12, 0.06, 0.012, 0, -0.09, 0.08), m.polymer);
      add(rb(0.055, 0.08, 0.26, 0.02, 0, -0.01, 0.3), m.polymer);
      add(cy(0.03, 0.16, 0, 0.085, -0.08, 16), m.gun);
      add(new THREE.CircleGeometry(0.026, 20), m.accent).position.set(0, 0.085, 0.001);
      mag = add(rb(0.06, 0.07, 0.09, 0.012, 0, -0.07, -0.16), m.armor);
      add(rb(0.062, 0.015, 0.06, 0.004, 0, -0.04, -0.16), m.glowHot);
      display = add(new THREE.PlaneGeometry(0.055, 0.027), this.ammoMat); display.position.set(-0.0385, 0.021, 0.14); display.rotation.y = -Math.PI / 2 + 0.35;
      muzzle = new THREE.Vector3(0, 0, -0.82); sightY = 0.085;
      gripR = new THREE.Vector3(0, -0.07, 0.08); gripL = new THREE.Vector3(0, -0.045, -0.3);
    }
    // 조준선(조준 시만)
    const ret = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.022), this.reticleMat);
    ret.position.set(0, sightY, id === 'rifle' ? -0.061 : -0.05); ret.visible = false; g.add(ret);
    for (const p of parts) { p.castShadow = false; }
    return { group: g, muzzle, sightY, mag, magRest: mag ? mag.position.clone() : null, gripL, gripR, ret, coils: parts.filter((p) => p.name && p.name.startsWith('coil')), pump: parts.find((p) => p.name === 'pump') };
  }

  buildArms() {
    const m = this.mats, group = new THREE.Group();
    const arm = (side) => {
      const a = new THREE.Group();
      const fore = new THREE.Mesh(merge([cy(0.038, 0.32, 0, 0, 0.16, 12, 0.045)]), m.sleeve); a.add(fore);
      const pad = new THREE.Mesh(rb(0.07, 0.04, 0.14, 0.015, 0, 0.035, 0.12), m.armor); a.add(pad);
      const strip = new THREE.Mesh(rb(0.012, 0.005, 0.08, 0.002, 0, 0.056, 0.12), this.mats.glowDim); a.add(strip);
      const hand = new THREE.Mesh(merge([rb(0.07, 0.05, 0.085, 0.02, 0, -0.005, -0.03), rb(0.02, 0.03, 0.06, 0.008, side * 0.035, 0.012, -0.05)]), m.glove);
      a.add(hand);
      group.add(a);
      return a;
    };
    return { group, L: arm(-1), R: arm(1) };
  }

  buildKnife() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(rb(0.03, 0.03, 0.1, 0.008, 0, 0, 0.05), this.mats.polymer));
    const blade = new THREE.Mesh(merge([rb(0.006, 0.04, 0.2, 0.002, 0, 0.005, -0.1)]), this.mats.blade); g.add(blade);
    g.add(new THREE.Mesh(rb(0.007, 0.004, 0.18, 0.001, 0, 0.026, -0.1), this.mats.glow));
    g.visible = false;
    return g;
  }

  setWeapon(id, instant = false) {
    for (const k of Object.keys(this.guns)) this.guns[k].group.visible = k === id;
    this.cur = id;
    const gun = this.guns[id];
    gun.group.add(this.flash); gun.group.add(this.flash2);
    this.flash.position.copy(gun.muzzle); this.flash2.position.copy(gun.muzzle);
    this.muzzleLight.position.set(0.15, -0.1, -0.6);
    if (instant) this.state.switchK = 1;
  }

  onSwitch(id) { this.state.switchK = 0; this.pendingWeapon = id; }
  onShot(id) {
    const s = this.state, w = WEAPONS[id];
    s.kickV += w.recoil * 0.9 * (1 - 0.45 * s.adsK);
    s.flashT = 0;
    this.flash.material.rotation = Math.random() * Math.PI;
    this.flash2.rotation.z = Math.random() * Math.PI;
    const big = id === 'shotgun' || id === 'rail';
    this.flash.scale.setScalar(big ? 0.38 : 0.24);
    this.flash2.scale.setScalar(big ? 0.34 : 0.2);
    this.flash.material.color.setRGB(...(id === 'rail' ? [0.6, 2.2, 3] : id === 'rifle' ? [1.4, 2.2, 3] : [3, 1.9, 1.1]));
    this.flash2.material.color.copy(this.flash.material.color);
    this.muzzleLight.color.setRGB(...(id === 'rail' || id === 'rifle' ? [0.4, 0.9, 1] : [1, 0.7, 0.4]));
    if (this.guns[id].pump) this.pumpT = 0;
  }
  onReload(id, time) { this.state.reloadK = 0.0001; this.reloadDur = time; this.reloadId = id; }
  onMelee() { this.state.meleeK = 0.0001; }
  onThrow() { this.state.throwK = 0.0001; }
  onLand(speed) { this.state.landV -= Math.min(0.08, speed * 0.004); }

  updateAmmo(mag, reserve) {
    const txt = `${mag}/${reserve === Infinity ? '∞' : reserve}`;
    if (txt === this.lastAmmo) return;
    this.lastAmmo = txt;
    const g = this.ammoCanvas.getContext('2d');
    g.clearRect(0, 0, 128, 64);
    g.fillStyle = 'rgba(0,20,26,0.65)'; g.fillRect(0, 0, 128, 64);
    g.font = "700 38px 'Share Tech Mono', monospace"; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = mag === 0 ? '#ff4050' : '#5ff2ff'; g.shadowColor = g.fillStyle; g.shadowBlur = 10;
    g.fillText(txt, 64, 34);
    this.ammoTex.needsUpdate = true;
  }

  update(dt, p, look, t) {
    const s = this.state;
    const gun = this.guns[this.cur];
    // 교체: 내렸다가 올리기
    if (s.switchK < 1) {
      s.switchK = Math.min(1, s.switchK + dt / 0.32);
      if (s.switchK > 0.5 && this.pendingWeapon) { this.setWeapon(this.pendingWeapon); this.pendingWeapon = null; }
    }
    const sw = s.switchK < 0.5 ? s.switchK * 2 : (1 - s.switchK) * 2; // 0→1→0
    // 조준
    s.adsK += ((p.ads > 0.5 ? 1 : 0) - s.adsK) * Math.min(1, dt * 14);
    const ads = s.adsK;
    // 시점 회전 지연 흔들림
    const dyaw = angDiff(look.yaw, s.lastYaw), dpitch = look.pitch - s.lastPitch;
    s.lastYaw = look.yaw; s.lastPitch = look.pitch;
    s.swayX += (-dyaw * 0.9 - s.swayX) * Math.min(1, dt * 10);
    s.swayY += (dpitch * 0.9 - s.swayY) * Math.min(1, dt * 10);
    s.swayX = clamp(s.swayX, -0.06, 0.06); s.swayY = clamp(s.swayY, -0.05, 0.05);
    // 걷기 흔들림
    const moving = p.grounded ? Math.min(1, p.speed / 7) : 0;
    s.bobT += dt * (5 + p.speed * 0.9) * (moving > 0.1 ? 1 : 0.3);
    const bobA = (moving * 0.018 + 0.002) * (1 - ads * 0.85);
    const bx = Math.sin(s.bobT) * bobA, by = -Math.abs(Math.cos(s.bobT)) * bobA * 0.8;
    // 반동·착지 스프링: 프레임이 느려도 발산하지 않게 1/240초 단위로 나눠 적분
    for (let left = Math.min(dt, 0.1); left > 1e-6; left -= 1 / 240) {
      const h = Math.min(left, 1 / 240);
      s.kickV += (-s.kick * 160 - s.kickV * 18) * h; s.kick += s.kickV * h;
      s.landV += (-s.land * 120 - s.landV * 14) * h; s.land += s.landV * h;
    }
    s.kick = clamp(s.kick, -0.5, 2.5); s.land = clamp(s.land, -0.2, 0.1);
    // 대시·슬라이드 기울기
    const rollT = (p.dashT > 0 ? 0.25 : 0) + (p.slideT > 0 ? 0.35 : 0);
    s.roll += (rollT - s.roll) * Math.min(1, dt * 10);
    s.flashT += dt;

    const hip = new THREE.Vector3(0.17, -0.17, -0.36);
    const adsPos = new THREE.Vector3(0, -gun.sightY, this.cur === 'pistol' ? -0.3 : -0.25);
    const pos = hip.lerp(adsPos, ads);
    pos.x += bx + s.swayX * 0.6; pos.y += by + s.swayY * 0.5 - sw * 0.25 + s.land;
    pos.z += s.kick * 0.012;
    const rot = new THREE.Euler(s.kick * 0.03 * (1 - ads * 0.5) + s.swayY * 0.8 - sw * 0.6, s.swayX * 1.2, s.roll + s.swayX * 0.5);

    // 재장전 동작
    if (s.reloadK > 0) {
      s.reloadK += dt / (this.reloadDur || 1.5);
      const k = Math.min(1, s.reloadK);
      const tilt = Math.sin(Math.min(1, k * 1.15) * Math.PI);
      rot.z += tilt * 0.5; rot.x += tilt * 0.25; pos.y -= tilt * 0.04;
      if (gun.mag) {
        const out = k < 0.5 ? Math.min(1, k / 0.25) : Math.max(0, 1 - (k - 0.5) / 0.3);
        gun.mag.position.copy(gun.magRest).add(new THREE.Vector3(0, -0.18 * out, 0.02 * out));
      }
      if (k >= 1) s.reloadK = 0;
    } else if (gun.mag) gun.mag.position.copy(gun.magRest);
    if (gun.pump) {
      this.pumpT = (this.pumpT ?? 9) + dt;
      const k = this.pumpT < 0.35 ? Math.sin((this.pumpT / 0.35) * Math.PI) : 0;
      gun.pump.position.z = -0.3 + k * 0.08;
    }
    // 레일건 충전: 코일이 밝아짐
    for (const c of gun.coils) c.scale.setScalar(1 + p.charge * 0.6);
    // 근접(칼 휘두르기)
    let knifeK = 0;
    if (s.meleeK > 0) { s.meleeK += dt / 0.3; knifeK = Math.sin(Math.min(1, s.meleeK) * Math.PI); if (s.meleeK >= 1) s.meleeK = 0; }
    let throwK = 0;
    if (s.throwK > 0) { s.throwK += dt / 0.4; throwK = Math.sin(Math.min(1, s.throwK) * Math.PI); if (s.throwK >= 1) s.throwK = 0; }
    pos.y -= (knifeK + throwK) * 0.08; rot.x -= (knifeK + throwK) * 0.25;

    gun.group.position.copy(pos);
    gun.group.rotation.copy(rot);
    gun.ret.visible = ads > 0.85;

    // 손: 총의 손잡이 위치에 붙임
    const toWorld = (v) => v.clone().applyEuler(rot).add(pos);
    const R = toWorld(gun.gripR), L = toWorld(gun.gripL);
    const placeArm = (a, hand, elbow) => { a.position.copy(hand); a.lookAt(elbow); };
    placeArm(this.arms.R, R, new THREE.Vector3(0.3, -0.52, -0.02));
    if (knifeK > 0 || throwK > 0) {
      const k = Math.max(knifeK, throwK);
      const hand = new THREE.Vector3(-0.2 + k * 0.22, -0.22 + k * 0.12, -0.35 - k * 0.2);
      placeArm(this.arms.L, hand, new THREE.Vector3(-0.32, -0.55, -0.05));
      this.knife.visible = knifeK > 0;
      this.knife.position.copy(hand); this.knife.rotation.set(-0.2, 0.9 - k * 1.6, -0.4);
      this.nade.visible = throwK > 0 && s.throwK < 0.5;
      this.nade.position.copy(hand).add(new THREE.Vector3(0, 0.03, -0.03));
    } else {
      placeArm(this.arms.L, L, new THREE.Vector3(-0.22, -0.55, -0.1));
      this.knife.visible = false; this.nade.visible = false;
    }
    // 총구 섬광
    const fv = s.flashT < 0.045;
    this.flash.visible = fv; this.flash2.visible = fv;
    this.flash2.lookAt(this.camera.getWorldPosition(new THREE.Vector3()));
    this.muzzleLight.intensity = fv ? 3.5 : 0;
    this.muzzleLight.position.copy(toWorld(gun.muzzle));
    this.rim.intensity = 0.22 + Math.sin(t * 2) * 0.06;
  }

  muzzleWorld(mainCamera) {
    // 화면상 총구 위치를 메인 카메라 월드 좌표로(예광탄 시작점)
    const gun = this.guns[this.cur];
    const v = gun.muzzle.clone().applyEuler(gun.group.rotation).add(gun.group.position); // 뷰모델 카메라 공간
    return mainCamera.localToWorld(v);
  }

  resize(aspect) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); }
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

function reticleTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.strokeStyle = '#ff3050'; g.shadowColor = '#ff3050'; g.shadowBlur = 8; g.lineWidth = 5;
  g.beginPath(); g.arc(64, 64, 34, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#ff6070'; g.beginPath(); g.arc(64, 64, 6, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function starTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.translate(64, 64);
  for (let i = 0; i < 5; i++) {
    g.rotate((Math.PI * 2) / 5);
    const gr = g.createLinearGradient(0, 0, 60, 0); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -6); g.lineTo(60, 0); g.lineTo(0, 6); g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
