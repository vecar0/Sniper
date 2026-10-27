// 1인칭 총 + 팔: 별도 장면·카메라로 그려 벽에 파묻히지 않는다. 모델은 guns.js(윤곽을 깎아 만든 총 · 손가락 있는 장갑 손).
// 흔들림(걷기·시점 회전 지연) · 조준 정렬 · 반동 스프링 · 재장전 · 교체 · 근접 · 투척 · 대시 기울기
import * as THREE from 'three';
import { WEAPONS } from '../config/balance.js';
import { gunMaterials, viewmodelEnvironment, buildGun, buildKnifeHand } from './guns.js';

export class ViewModel {
  constructor(renderer, aspect) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(54, aspect, 0.01, 10);
    this.scene.add(this.camera);
    this.root = new THREE.Group();
    this.camera.add(this.root);
    const env = viewmodelEnvironment(renderer);
    this.scene.environment = env;
    // 직접광은 약하게(형태만): 반사 환경이 금속의 인상을 만든다
    this.scene.add(new THREE.HemisphereLight(0x55688a, 0x120a12, 0.35));
    const key = new THREE.DirectionalLight(0xc8d8ff, 1.6); key.position.set(-1, 2.2, 0.6); this.scene.add(key);
    this.rim = new THREE.PointLight(0x8ad8ff, 0.6, 2.5, 2); this.rim.position.set(-0.35, 0.25, -0.9); this.camera.add(this.rim);
    this.muzzleLight = new THREE.PointLight(0xffb070, 0, 3, 2); this.camera.add(this.muzzleLight);

    this.M = gunMaterials(env);
    this.ammoCanvas = document.createElement('canvas'); this.ammoCanvas.width = 128; this.ammoCanvas.height = 56;
    this.ammoTex = new THREE.CanvasTexture(this.ammoCanvas); this.ammoTex.colorSpace = THREE.SRGBColorSpace; this.ammoTex.anisotropy = 4;
    this.ammoMat = new THREE.MeshBasicMaterial({ map: this.ammoTex, color: new THREE.Color(1.15, 1.15, 1.15) });
    this.reticleMat = new THREE.MeshBasicMaterial({ map: reticleTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(1.6, 1.6, 1.6) });
    this.scopeMat = new THREE.MeshBasicMaterial({ map: scopeTexture(), transparent: true, depthWrite: false });
    const X = { ammoMat: this.ammoMat, reticleMat: this.reticleMat, scopeMat: this.scopeMat };

    this.guns = {};
    for (const id of Object.keys(WEAPONS)) {
      const gun = buildGun(id, this.M, X);
      gun.group.visible = false;
      gun.group.traverse((o) => { o.frustumCulled = false; });
      if (gun.ret) gun.ret.visible = false;
      this.root.add(gun.group);
      this.guns[id] = gun;
    }
    this.free = buildKnifeHand(this.M);
    this.free.group.visible = false;
    this.root.add(this.free.group);

    this.flash = new THREE.Group();
    const flame = flameTexture();
    for (let i = 0; i < 3; i++) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0, 0), new THREE.MeshBasicMaterial({ map: flame, color: new THREE.Color(2.6, 1.7, 1.0), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      pl.rotation.set(0, Math.PI / 2, (i * Math.PI) / 3); pl.scale.set(0.11, 0.05, 1); pl.position.z = -0.045;
      this.flash.add(pl);
    }
    const front = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: starTexture(), color: new THREE.Color(2.4, 1.6, 0.9), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    front.scale.setScalar(0.07); this.flash.add(front); this.flashFront = front;
    this.flash.visible = false;

    this.cur = 'pistol';
    this.state = { bobT: 0, swayX: 0, swayY: 0, kick: 0, kickV: 0, roll: 0, switchK: 1, reloadK: 0, meleeK: 0, throwK: 0, land: 0, landV: 0, adsK: 0, flashT: 9, lastYaw: 0, lastPitch: 0, charge: 0 };
    this.lastAmmo = '';
    this.setWeapon('pistol', true);
  }

  setWeapon(id, instant = false) {
    for (const k of Object.keys(this.guns)) this.guns[k].group.visible = k === id;
    this.cur = id;
    const gun = this.guns[id];
    gun.group.add(this.flash);
    this.flash.position.copy(gun.muzzle);
    if (instant) this.state.switchK = 1;
  }

  onSwitch(id) { this.state.switchK = 0; this.pendingWeapon = id; }
  onShot(id) {
    const s = this.state, w = WEAPONS[id];
    s.kickV += w.recoil * 0.9 * (1 - 0.45 * s.adsK);
    s.flashT = 0;
    this.flash.rotation.z = Math.random() * Math.PI;
    const big = id === 'shotgun' ? 1.7 : id === 'rail' ? 1.4 : id === 'rifle' ? 1.15 : 0.85;
    this.flash.scale.setScalar(big * (0.85 + Math.random() * 0.3));
    const col = id === 'rail' ? [0.7, 2.0, 2.8] : [2.6, 1.6 + Math.random() * 0.3, 0.9];
    for (const c of this.flash.children) c.material.color.setRGB(...col);
    this.muzzleLight.color.setRGB(...(id === 'rail' ? [0.45, 0.85, 1] : [1, 0.68, 0.38]));
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
    // 작은 흑백 OLED: 탄창 수만 크게(예비탄은 HUD에)
    const g = this.ammoCanvas.getContext('2d');
    g.fillStyle = '#020303'; g.fillRect(0, 0, 128, 56);
    g.font = "700 44px 'Barlow Cond', 'Apple SD Gothic Neo', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = mag === 0 ? '#ff5a4a' : '#d8f0e8';
    g.fillText(String(mag).padStart(2, '0'), 64, 30);
    g.fillStyle = 'rgba(216,240,232,0.25)'; for (let y = 0; y < 56; y += 3) g.fillRect(0, y, 128, 1);
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

    const H = HIP[this.cur];
    const hip = new THREE.Vector3(H[0], H[1], H[2]);
    const adsPos = new THREE.Vector3(0, -gun.sightY, gun.adsZ);
    const pos = hip.lerp(adsPos, ads);
    pos.x += bx + s.swayX * 0.6; pos.y += by + s.swayY * 0.5 - sw * 0.25 + s.land;
    pos.z += s.kick * 0.012;
    const rot = new THREE.Euler(s.kick * 0.03 * (1 - ads * 0.5) + s.swayY * 0.8 - sw * 0.6, s.swayX * 1.2 + H[3] * (1 - ads), s.roll + s.swayX * 0.5 + H[4] * (1 - ads));

    // 재장전: 총을 기울이고 탄창이 빠졌다 들어감
    if (s.reloadK > 0) {
      s.reloadK += dt / (this.reloadDur || 1.5);
      const k = Math.min(1, s.reloadK);
      const tilt = Math.sin(Math.min(1, k * 1.15) * Math.PI);
      rot.z += tilt * 0.45; rot.x += tilt * 0.22; pos.y -= tilt * 0.03;
      if (gun.mag) {
        const out = k < 0.5 ? Math.min(1, k / 0.25) : Math.max(0, 1 - (k - 0.5) / 0.3);
        gun.mag.position.copy(gun.magRest).add(new THREE.Vector3(0, -0.16 * out, 0.015 * out));
        gun.mag.visible = out < 0.95;
      }
      if (k >= 1) s.reloadK = 0;
    } else if (gun.mag) { gun.mag.position.copy(gun.magRest); gun.mag.visible = true; }
    if (gun.pump) {
      this.pumpT = (this.pumpT ?? 9) + dt;
      const k = this.pumpT > 0.08 && this.pumpT < 0.42 ? Math.sin(((this.pumpT - 0.08) / 0.34) * Math.PI) : 0;
      gun.pump.position.z = k * 0.075;
    }
    // 레일건 충전: 코일이 차오르며 빛남
    for (const c of gun.coils) c.material.emissiveIntensity = 0.15 + p.charge * 9;
    // 근접(칼) · 투척: 왼손을 총에서 떼어 앞으로
    let knifeK = 0;
    if (s.meleeK > 0) { s.meleeK += dt / 0.32; knifeK = Math.sin(Math.min(1, s.meleeK) * Math.PI); if (s.meleeK >= 1) s.meleeK = 0; }
    let throwK = 0;
    if (s.throwK > 0) { s.throwK += dt / 0.42; throwK = Math.sin(Math.min(1, s.throwK) * Math.PI); if (s.throwK >= 1) s.throwK = 0; }
    const freeK = Math.max(knifeK, throwK);
    pos.y -= freeK * 0.05; pos.x += freeK * 0.04; rot.z -= freeK * 0.25;
    gun.group.position.copy(pos);
    gun.group.rotation.copy(rot);
    if (gun.ret) gun.ret.visible = ads > 0.85;
    const freeOn = s.meleeK > 0 || s.throwK > 0;
    gun.leftHand.visible = !freeOn; if (gun.leftArm) gun.leftArm.visible = !freeOn;
    const F = this.free;
    F.group.visible = freeOn;
    if (freeOn) {
      const k = freeK;
      for (const m of F.blade) m.visible = s.meleeK > 0;
      for (const m of F.nade) m.visible = s.throwK > 0 && s.throwK < 0.55;
      if (s.meleeK > 0) { // 왼쪽 아래에서 오른쪽 위로 베기: 칼날이 앞을 보게 눕힘
        F.group.position.set(-0.16 + k * 0.2, -0.17 + k * 0.08, -0.26 - k * 0.12);
        F.group.rotation.set(-1.35 + k * 0.2, 0.6 - k * 1.3, -0.5 + k * 0.4);
      } else { // 투척: 어깨 위로 올렸다 앞으로
        F.group.position.set(-0.12 + k * 0.05, -0.16 + k * 0.14, -0.22 - k * 0.12);
        F.group.rotation.set(-0.4 - k * 0.6, 0.3, -0.2);
      }
    }
    // 총구 섬광(사격 직후 2프레임 정도)
    const fv = s.flashT < 0.04;
    this.flash.visible = fv;
    if (fv) this.flashFront.lookAt(this.camera.getWorldPosition(new THREE.Vector3()));
    this.muzzleLight.intensity = fv ? 2.2 : 0;
    this.muzzleLight.position.copy(gun.muzzle.clone().applyEuler(rot).add(pos));
    this.rim.intensity = 0.55 + Math.sin(t * 2) * 0.05;
  }

  muzzleWorld(mainCamera) {
    // 화면상 총구 위치를 메인 카메라 월드 좌표로(예광탄 시작점)
    const gun = this.guns[this.cur];
    const v = gun.muzzle.clone().applyEuler(gun.group.rotation).add(gun.group.position); // 뷰모델 카메라 공간
    return mainCamera.localToWorld(v);
  }

  resize(aspect) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); }
}

// 허리 사격 위치 [x, y, z, 좌우 비틀기, 기울기] — 총마다 길이·손잡이 위치가 다르다
const HIP = {
  pistol: [0.1, -0.075, -0.32, 0.09, -0.05],
  rifle: [0.125, -0.08, -0.24, 0.1, -0.07],
  shotgun: [0.125, -0.078, -0.25, 0.1, -0.07],
  rail: [0.125, -0.085, -0.22, 0.1, -0.07],
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

function reticleTexture() {
  // 홀로그램 조준경: 빨간 점 + 바깥 원(빛 번짐 약간)
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,60,50,0.9)'; g.shadowColor = '#ff3020'; g.shadowBlur = 6; g.lineWidth = 3;
  g.beginPath(); g.arc(64, 64, 44, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#ff5a48'; g.beginPath(); g.arc(64, 64, 5, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function scopeTexture() {
  // 레일건 조준경 접안렌즈: 가는 십자선 + 거리 눈금, 가장자리는 검은 테
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, S * 0.36, S / 2, S / 2, S * 0.5);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(10,10,10,0.95)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(S / 2, 20); g.lineTo(S / 2, S - 20); g.moveTo(20, S / 2); g.lineTo(S - 20, S / 2); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.moveTo(S / 2, 20); g.lineTo(S / 2, S / 2 - 40); g.moveTo(20, S / 2); g.lineTo(S / 2 - 40, S / 2); g.moveTo(S - 20, S / 2); g.lineTo(S / 2 + 40, S / 2); g.stroke();
  g.lineWidth = 1.2; for (let i = 1; i <= 4; i++) { const y = S / 2 + i * 9; g.beginPath(); g.moveTo(S / 2 - 6 + i, y); g.lineTo(S / 2 + 6 - i, y); g.stroke(); }
  g.fillStyle = '#ff4030'; g.beginPath(); g.arc(S / 2, S / 2, 2, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function flameTexture() {
  // 옆에서 본 불꽃: 가운데가 뜨겁고 끝이 갈라지는 혀 모양
  const W = 128, H = 64, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = (y / H - 0.5) * 2;
    const width = 0.85 * Math.pow(1 - u, 0.6) * (0.75 + 0.25 * Math.sin(u * 23 + v * 3));
    const a = Math.max(0, 1 - Math.abs(v) / Math.max(0.02, width)) * Math.pow(1 - u, 1.2) * (u < 0.04 ? u / 0.04 : 1);
    const i = (y * W + x) * 4;
    img.data[i] = 255; img.data[i + 1] = 200 + 55 * a; img.data[i + 2] = 140 + 115 * a * a; img.data[i + 3] = Math.min(255, a * 300);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function starTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.translate(64, 64);
  const core = g.createRadialGradient(0, 0, 0, 0, 0, 30); core.addColorStop(0, 'rgba(255,255,240,1)'); core.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = core; g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 4; i++) {
    g.rotate((Math.PI * 2) / 4 + 0.2);
    const len = 40 + Math.random() * 20;
    const gr = g.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, 'rgba(255,240,200,0.9)'); gr.addColorStop(1, 'rgba(255,160,80,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -5); g.lineTo(len, 0); g.lineTo(0, 5); g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
