// 1인칭 총 + 팔: 별도 장면·카메라로 그려 벽에 파묻히지 않는다. 모델은 guns.js(윤곽을 깎아 만든 총 · 손가락 있는 장갑 손).
// 흔들림(8자 걷기·관성·숨쉬기·시점 회전 지연) · 조준 정렬 · 반동 스프링 · 슬라이드/노리쇠 왕복 · 탄피 배출
// · 왼손이 실제로 탄창을 빼고 끼우는 단계별 재장전(탄창이 비었으면 슬라이드·장전 손잡이 당김) · 교체 · 근접 · 투척 · 대시 기울기
import * as THREE from 'three';
import { WEAPONS } from '../config/balance.js';
import { gunMaterials, viewmodelEnvironment, buildGun, buildKnifeHand, aimArm } from './guns.js';

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
    for (const gun of Object.values(this.guns)) {
      gun.leftRest = { p: gun.leftHand.position.clone(), r: gun.leftHand.rotation.clone() };
      // 산탄: 손에 들고 넣을 탄 1발
      if (gun.pump) {
        const shell = new THREE.Group();
        shell.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.05, 12), this.M.hull));
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.0098, 0.0098, 0.012, 12), this.M.brass); base.position.y = -0.025; shell.add(base);
        shell.position.set(0.012, 0.0, -0.005); shell.rotation.x = Math.PI / 2; shell.visible = false;
        gun.leftHand.add(shell); gun.handShell = shell;
      }
    }
    // 탄피(풀 24개): 배출구에서 오른쪽 위로 튀어 돌며 떨어진다
    this.casings = [];
    const casingGeo = {
      pistol: new THREE.CylinderGeometry(0.0048, 0.0048, 0.019, 10),
      rifle: new THREE.CylinderGeometry(0.0046, 0.005, 0.045, 10),
      shell: new THREE.CylinderGeometry(0.0105, 0.0105, 0.065, 12),
    };
    for (let i = 0; i < 24; i++) {
      const g = new THREE.Group();
      const meshes = {};
      for (const [k, geo] of Object.entries(casingGeo)) { const m = new THREE.Mesh(geo, k === 'shell' ? this.M.hull : this.M.brass); m.visible = false; g.add(m); meshes[k] = m; }
      g.visible = false; this.camera.add(g);
      this.casings.push({ g, meshes, t: 9, v: new THREE.Vector3(), w: new THREE.Vector3() });
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
    this.state = { slideT: 9, boltT: 9, rackK: 0, shellK: 0, breathT: 0, velX: 0, velZ: 0, velY: 0, kickYaw: 0, kickYawV: 0, bobT: 0, swayX: 0, swayY: 0, kick: 0, kickV: 0, roll: 0, switchK: 1, reloadK: 0, meleeK: 0, throwK: 0, land: 0, landV: 0, adsK: 0, flashT: 9, lastYaw: 0, lastPitch: 0, charge: 0 };
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
  onShot(id, magLeft = 1) {
    const s = this.state, w = WEAPONS[id];
    s.kickV += w.recoil * 0.9 * (1 - 0.45 * s.adsK);
    s.kickYawV += (Math.random() - 0.5) * w.recoil * 0.9;     // 좌우로도 조금씩 튄다
    s.slideT = 0; s.boltT = 0; this.slideLock = id === 'pistol' && magLeft === 0;  // 마지막 발이면 슬라이드가 뒤로 멈춘다
    const gun = this.guns[id];
    if (gun.casing && gun.casing !== 'shell') this.eject(gun, gun.casing);
    s.flashT = 0;
    this.flash.rotation.z = Math.random() * Math.PI;
    const big = id === 'shotgun' ? 1.7 : id === 'rail' ? 1.4 : id === 'rifle' ? 1.15 : 0.85;
    this.flash.scale.setScalar(big * (0.85 + Math.random() * 0.3));
    const col = id === 'rail' ? [0.7, 2.0, 2.8] : [2.6, 1.6 + Math.random() * 0.3, 0.9];
    for (const c of this.flash.children) c.material.color.setRGB(...col);
    this.muzzleLight.color.setRGB(...(id === 'rail' ? [0.45, 0.85, 1] : [1, 0.68, 0.38]));
    if (this.guns[id].pump) { this.pumpT = 0; this.pumpEjected = false; }
  }
  onReload(id, time, empty = false) {
    if (this.guns[id].pump) { this.state.shellLoad = true; return; }
    this.state.reloadK = 0.0001; this.reloadDur = time; this.reloadId = id; this.reloadEmpty = empty; this.newMag = false;
  }
  onShell() { this.state.shellK = 0.0001; }
  onReloadEnd(id) { if (this.guns[id] && this.guns[id].pump) this.state.shellLoad = false; }

  // 탄피 하나: 총의 배출구(총 좌표) → 뷰모델 카메라 좌표로 옮겨 날린다
  eject(gun, kind) {
    const c = this.casings.find((q) => q.t > 0.8) || this.casings[0];
    c.t = 0; c.kind = kind;
    for (const [k, m] of Object.entries(c.meshes)) m.visible = k === kind;
    c.g.visible = true;
    c.g.position.copy(gun.eject).applyEuler(gun.group.rotation).add(gun.group.position);
    c.g.rotation.set(Math.random() * 3, Math.random() * 3, Math.PI / 2);
    const sp = kind === 'shell' ? 0.9 : 1.4;
    c.v.set(sp * (0.8 + Math.random() * 0.4), sp * (0.7 + Math.random() * 0.4), sp * (0.15 + Math.random() * 0.2));
    c.w.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30);
  }
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
    // 교체: 총구를 아래로 돌리며 내렸다가 새 총을 올린다
    if (s.switchK < 1) {
      s.switchK = Math.min(1, s.switchK + dt / 0.32);
      if (s.switchK > 0.5 && this.pendingWeapon) { this.setWeapon(this.pendingWeapon); this.pendingWeapon = null; this.state.reloadK = 0; }
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
    // 몸의 속도(카메라 기준 좌우·앞뒤·위아래) → 총이 관성으로 반대쪽으로 처진다
    const cy = Math.cos(look.yaw), sy = Math.sin(look.yaw);
    const vr = cy * p.vx - sy * p.vz, vf = -sy * p.vx - cy * p.vz;
    s.velX += (vr - s.velX) * Math.min(1, dt * 8); s.velZ += (vf - s.velZ) * Math.min(1, dt * 8); s.velY += (clamp(p.vy, -10, 8) - s.velY) * Math.min(1, dt * 10);
    // 걷기 흔들림: 발걸음마다 아래로(8자), 빠를수록 크게
    const moving = p.grounded ? Math.min(1, p.speed / 7) : 0;
    s.bobT += dt * (5 + p.speed * 0.9) * (moving > 0.1 ? 1 : 0.3);
    const bobA = (moving * 0.016 + 0.0015) * (1 - ads * 0.85);
    const bx = Math.sin(s.bobT) * bobA, by = -Math.abs(Math.sin(s.bobT)) * bobA * 0.9 + Math.cos(s.bobT * 2) * bobA * 0.15;
    // 숨쉬기(서 있을 때 아주 작게)
    s.breathT += dt;
    const br = Math.sin(s.breathT * 1.5) * 0.0011 * (1 - ads * 0.6) * (1 - moving);
    // 반동·착지 스프링: 프레임이 느려도 발산하지 않게 1/240초 단위로 나눠 적분
    for (let left = Math.min(dt, 0.1); left > 1e-6; left -= 1 / 240) {
      const h = Math.min(left, 1 / 240);
      s.kickV += (-s.kick * 160 - s.kickV * 18) * h; s.kick += s.kickV * h;
      s.kickYawV += (-s.kickYaw * 140 - s.kickYawV * 16) * h; s.kickYaw += s.kickYawV * h;
      s.landV += (-s.land * 120 - s.landV * 14) * h; s.land += s.landV * h;
    }
    s.kick = clamp(s.kick, -0.5, 2.5); s.kickYaw = clamp(s.kickYaw, -1, 1); s.land = clamp(s.land, -0.2, 0.1);
    // 대시·슬라이드 기울기
    const rollT = (p.dashT > 0 ? 0.25 : 0) + (p.slideT > 0 ? 0.35 : 0);
    s.roll += (rollT - s.roll) * Math.min(1, dt * 10);
    s.flashT += dt;

    const H = HIP[this.cur];
    const hip = new THREE.Vector3(H[0], H[1], H[2]);
    const adsPos = new THREE.Vector3(0, -gun.sightY, gun.adsZ);
    const pos = hip.lerp(adsPos, ads);
    const inert = 1 - ads * 0.7;
    pos.x += bx + s.swayX * 0.6 - s.velX * 0.0022 * inert;
    pos.y += by + br + s.swayY * 0.5 - sw * 0.22 + s.land - s.velY * 0.0016 * inert;
    pos.z += s.kick * 0.012 + clamp(s.velZ, -8, 8) * 0.0014 * inert;
    const muzzleFlip = this.cur === 'pistol' ? 0.05 : 0.03;
    const rot = new THREE.Euler(
      s.kick * muzzleFlip * (1 - ads * 0.5) + s.swayY * 0.8 - sw * 0.75 + br * 2,
      s.swayX * 1.2 + H[3] * (1 - ads) + s.kickYaw * 0.012,
      s.roll + s.swayX * 0.5 + H[4] * (1 - ads) - s.velX * 0.006 * inert - sw * 0.3 + s.kickYaw * 0.01,
    );

    // ── 슬라이드·노리쇠 왕복(쏠 때 빠르게 뒤로 → 돌아옴) ──
    s.slideT += dt; s.boltT += dt;
    const cyc = (u) => (u < 0.025 ? u / 0.025 : u < 0.085 ? 1 - (u - 0.025) / 0.06 : 0);
    let slideZ = cyc(s.slideT);
    if (this.slideLock && s.slideT > 0.025) slideZ = 1;   // 빈 탄창: 뒤로 멈춤
    let chargeZ = 0;

    // ── 재장전(탄창식): 단계별 왼손 동작 ──
    const L = gun.leftHand, R0 = gun.leftRest;
    let handP = null, handR = null, magOff = null, magVis = true;
    if (s.reloadK > 0 && !gun.pump) {
      s.reloadK += dt / (this.reloadDur || 1.5);
      const k = Math.min(1, s.reloadK);
      const empty = this.reloadEmpty;
      // 총: 살짝 기울여(캔트) 탄창 구멍을 보이게, 끼울 때 한 번 툭
      const tilt = smooth(0, 0.12, k) * (1 - smooth(0.86, 1, k));
      // 총을 들어 올려 가운데로 당기고 오른쪽으로 눕혀(캔트) 탄창 구멍이 왼손·화면 쪽을 보게
      const long = this.cur !== 'pistol';
      rot.z -= tilt * 0.45; rot.x += tilt * (long ? 0.2 : 0.3); rot.y += tilt * (long ? 0.32 : 0.18);
      pos.y += tilt * (long ? 0.07 : 0.035); pos.x -= tilt * (long ? 0.1 : 0.04); pos.z -= tilt * (long ? 0.02 : 0);
      const bump = Math.exp(-Math.pow((k - 0.74) / 0.02, 2));
      rot.x -= bump * 0.05; pos.y += bump * 0.006;
      const MH = gun.magHand, pouch = MH.clone().add(new THREE.Vector3(-0.02, -0.32, 0.18)), under = MH.clone().add(new THREE.Vector3(0, -0.07, 0.01));
      const restP = R0.p, gripR = new THREE.Euler(R0.r.x + 0.5, R0.r.y, R0.r.z);
      if (k < 0.12) { handP = lerpV(restP, MH, ease(k / 0.12)); handR = gripR; }
      else if (k < 0.25) { handP = lerpV(MH, pouch, ease((k - 0.12) / 0.13)); handR = gripR; }
      else if (k < 0.5) { handP = pouch; handR = gripR; }
      else if (k < 0.68) { handP = lerpV(pouch, under, ease((k - 0.5) / 0.18)); handR = gripR; }
      else if (k < 0.75) { handP = lerpV(under, MH, ease((k - 0.68) / 0.07)); handR = gripR; }
      else if (empty && gun.rackPt && k < 0.9) {
        // 빈 탄창이었으면 슬라이드(장전 손잡이)를 당겼다 놓는다
        const u = (k - 0.75) / 0.15;
        const grab = gun.rackPt;
        const reach = lerpV(MH, grab, ease(Math.min(1, u / 0.4)));
        const pull = u < 0.4 ? 0 : u < 0.7 ? (u - 0.4) / 0.3 : 0;
        handP = reach.clone().add(new THREE.Vector3(0, 0, gun.slide ? pull * gun.slideTravel : -Math.sin(pull * Math.PI) * 0.01));
        handR = R0.r;
        if (gun.slide) { if (u > 0.4) this.slideLock = false; slideZ = Math.max(slideZ, pull); }
        if (gun.charge) chargeZ = 0;  // 소총: 멈치를 치면 노리쇠가 앞으로 닫힌다(아래 boltLock)
        if (gun.bolt && u < 0.55) chargeZ = 1;
      } else { const u = (k - (empty && gun.rackPt ? 0.9 : 0.75)) / (empty && gun.rackPt ? 0.1 : 0.25); handP = lerpV(empty && gun.rackPt ? gun.rackPt : MH, restP, ease(Math.min(1, u))); handR = R0.r; }
      // 탄창: 0.12~0.2 빠져 떨어짐 → 0.5부터 손에 들려 올라와 0.75에 끼워짐
      if (gun.mag) {
        if (k < 0.12) magOff = new THREE.Vector3();
        else if (k < 0.24) { const u = (k - 0.12) / 0.12; magOff = new THREE.Vector3(0, -0.4 * u * u - 0.02 * u, 0.02 * u); magVis = u < 0.8; }
        else if (k < 0.5) { magVis = false; }
        else if (k < 0.75) magOff = handP.clone().sub(MH);
        else magOff = new THREE.Vector3();
      }
      if (k >= 1) { s.reloadK = 0; this.slideLock = false; }
    }
    // ── 산탄총: 한 발씩 손으로 밀어 넣기 ──
    if (gun.pump) {
      if (s.shellLoad && p.reloadT < 0 && s.shellK <= 0) s.shellLoad = false; // 쏘면 장전이 끊긴다
      if (s.shellLoad || s.shellK > 0) {
        rot.z -= 0.4; rot.x += 0.22; pos.x -= 0.04; pos.y += 0.04; pos.z += 0.02;
        const port = gun.magHand, below = port.clone().add(new THREE.Vector3(0, -0.12, 0.08));
        const gp = gun.pump.position;
        if (s.shellK > 0) {
          s.shellK += dt / 0.42;
          const u = Math.min(1, s.shellK);
          const pP = u < 0.45 ? lerpV(below, port, ease(u / 0.45)) : u < 0.6 ? port.clone().add(new THREE.Vector3(0, 0.012 * Math.sin(((u - 0.45) / 0.15) * Math.PI), 0)) : lerpV(port, below, ease((u - 0.6) / 0.4));
          handP = pP.sub(gp); handR = new THREE.Euler(R0.r.x - 1.0, R0.r.y, R0.r.z + 1.0);
          if (gun.handShell) gun.handShell.visible = u < 0.5;
          if (s.shellK >= 1) s.shellK = 0;
        } else { handP = below.clone().sub(gp); handR = new THREE.Euler(R0.r.x - 1.0, R0.r.y, R0.r.z + 1.0); if (gun.handShell) gun.handShell.visible = false; }
      } else if (gun.handShell) gun.handShell.visible = false;
      // 펌프: 쏜 뒤 앞뒤로, 뒤로 갈 때 빈 탄피가 튀어나간다
      this.pumpT = (this.pumpT ?? 9) + dt;
      const pk = this.pumpT > 0.08 && this.pumpT < 0.42 ? Math.sin(((this.pumpT - 0.08) / 0.34) * Math.PI) : 0;
      if (this.pumpT > 0.2 && !this.pumpEjected) { this.pumpEjected = true; this.eject(gun, 'shell'); }
      gun.pump.position.z = pk * 0.075;
      rot.x -= pk * 0.03;
    }
    // 왼손 적용(+ 아래팔이 손목을 따라온다)
    if (handP) { L.position.copy(handP); L.rotation.copy(handR); }
    else { L.position.copy(R0.p); L.rotation.copy(R0.r); }
    if (gun.leftArm) aimArm(gun.leftArm);
    if (gun.mag) { gun.mag.position.copy(gun.magRest).add(magOff || new THREE.Vector3()); gun.mag.visible = magVis; }
    if (gun.slide) gun.slide.position.z = slideZ * gun.slideTravel;
    if (gun.bolt) gun.bolt.position.z = Math.max(cyc(s.boltT), chargeZ) * gun.boltTravel;
    if (gun.charge) gun.charge.position.z = chargeZ * gun.boltTravel;

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
    // 탄피 비행: 중력 + 공기 저항 + 회전, 0.8초 뒤 사라짐
    for (const c of this.casings) {
      if (c.t > 0.8) continue;
      c.t += dt;
      c.v.y -= 9.8 * dt; c.v.multiplyScalar(1 - dt * 0.6);
      c.g.position.addScaledVector(c.v, dt);
      c.g.rotation.x += c.w.x * dt; c.g.rotation.y += c.w.y * dt; c.g.rotation.z += c.w.z * dt;
      if (c.t > 0.8) c.g.visible = false;
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
  // 긴 총은 개머리를 어깨에 댄 자세: 앞손(왼손)과 손잡이 손(오른손)이 모두 화면 아래쪽에 보이게 조금 높고 멀리
  pistol: [0.085, -0.07, -0.3, 0.07, -0.04],
  rifle: [0.115, -0.055, -0.27, 0.13, -0.06],
  shotgun: [0.115, -0.055, -0.28, 0.13, -0.06],
  rail: [0.115, -0.06, -0.26, 0.13, -0.06],
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const smooth = (a, b, x) => ease((x - a) / (b - a));
const lerpV = (a, b, t) => a.clone().lerp(b, t);
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
