// 렌더 총괄: 장면·카메라·조명·후처리 + 시뮬레이션 이벤트를 화면 효과로 바꾼다.
import * as THREE from 'three';
import { EffectComposer } from '../../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from '../../vendor/three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from '../../vendor/three/addons/postprocessing/OutputPass.js';
import { Environment } from './env.js';
import { Level } from './level.js';
import { EnemyViews } from './models.js';
import { FX } from './fx.js';
import { ViewModel } from './viewmodel.js';
import { setAnisotropy } from './materials.js';
import { BATTERIES } from '../config/map.js';
import { WEAPONS, PLAYER } from '../config/balance.js';
import { scopedView } from '../sim/player.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uHurt: { value: 0 }, uLow: { value: 0 }, uAberr: { value: 0 },
    uVignette: { value: 0.32 }, uStun: { value: 0 }, uDash: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uHurt, uLow, uAberr, uVignette, uStun, uDash; uniform vec2 uRes; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 c = vUv - 0.5; float r = length(c);
  float ab = uAberr * 0.006 + uDash * 0.004 + 0.0007;
  vec2 dir = c * ab * (0.5 + r * 2.0);
  // 대시: 가장자리 방사형 흐림
  vec3 col;
  if (uDash > 0.01) {
    vec3 acc = vec3(0.0); for (int i = 0; i < 6; i++){ float k = float(i) / 6.0 * uDash * 0.05 * r; acc += texture2D(tDiffuse, vUv - c * k).rgb; } col = acc / 6.0;
  } else col = texture2D(tDiffuse, vUv).rgb;
  col.r = mix(col.r, texture2D(tDiffuse, vUv + dir).r, 0.85);
  col.b = mix(col.b, texture2D(tDiffuse, vUv - dir).b, 0.85);
  // 체력 낮음: 채도↓ + 붉은 가장자리 맥동
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(lum) * vec3(1.05, 0.95, 0.95), uLow * 0.55);
  float edge = smoothstep(0.35, 0.85, r);
  col += vec3(0.55, 0.0, 0.03) * edge * (uHurt * 0.9 + uLow * (0.35 + 0.25 * sin(uTime * 6.0)));
  col += vec3(0.1, 0.35, 0.8) * edge * uStun * 0.4;
  // 비네트 + 미세 그레인
  col *= 1.0 - uVignette * smoothstep(0.25, 0.95, r);
  col += (h(vUv * uRes + fract(uTime) * 100.0) - 0.5) * 0.018;
  gl_FragColor = vec4(col, 1.0);
}`,
};

export class Renderer {
  constructor(container, settings) {
    this.settings = settings;
    this.quality = settings.quality || 'high';
    const r = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = this.quality !== 'low';
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);
    this.renderer = r;
    r.info.autoReset = false; // 여러 패스의 그리기 호출을 합산
    this.lowSpec = detectLowSpec(r);
    setAnisotropy(r.capabilities.getMaxAnisotropy());

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.05, 1600);
    this.scene.add(this.camera);
    this.env = new Environment(this.scene, r, this.quality);
    this.level = new Level(this.scene, this.env.time, this.quality);

    // 달빛(그림자) + 아주 어두운 반구광
    const moon = new THREE.DirectionalLight(0x9fb4e8, 1.2);
    moon.position.copy(this.env.moonDir).multiplyScalar(60); // 하늘에 보이는 달과 같은 방향에서 그림자
    moon.target.position.set(0, 0, 0);
    moon.castShadow = this.quality !== 'low';
    moon.shadow.mapSize.set(this.quality === 'high' ? 2048 : 1024, this.quality === 'high' ? 2048 : 1024);
    const sc = moon.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 5; sc.far = 110;
    moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.03;
    this.scene.add(moon, moon.target);
    this.moon = moon;
    this.scene.add(new THREE.HemisphereLight(0x4a6088, 0x2a2a2c, 1.05)); // 하늘(청) / 눈 반사(회)

    this.fx = new FX(this.scene, this.camera, null, this.quality);
    this.enemies = new EnemyViews(this.scene, this.fx);
    this.vm = new ViewModel(r, 16 / 9);
    // 뷰모델은 자기 반사 환경(어두운 방 + 밝은 조명판)을 쓴다 — viewmodel.js

    // 후처리
    const composer = new EffectComposer(r);
    composer.addPass(new RenderPass(this.scene, this.camera));
    const vmPass = new RenderPass(this.vm.scene, this.vm.camera);
    vmPass.clear = false; vmPass.clearDepth = true;
    composer.addPass(vmPass);
    this.vmPass = vmPass;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 0.88);
    this.bloom.enabled = this.quality !== 'low';
    composer.addPass(this.bloom);
    this.final = new ShaderPass(FinalShader);
    composer.addPass(this.final);
    composer.addPass(new OutputPass());
    this.composer = composer;

    this.shake = 0; this.fovKick = 0; this.camDip = 0; this.hurt = 0; this.aberr = 0; this.dash = 0;
    this.resScale = 1; this.frameAvg = 16; this.resTimer = 0;
    this.lasers = new Map();
    this.resize();
  }

  attach(world) {
    this.world = world;
    this.fx.geom = world.geom;
    if (!this.fx.batteryViews.length) this.fx.buildBatteries(BATTERIES);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const base = Math.min(window.devicePixelRatio || 1, this.quality === 'high' ? 2 : this.quality === 'mid' ? 1.5 : 1);
    const pr = Math.max(0.5, base * this.resScale * (this.lowSpec ? 0.6 : 1));
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w * pr * 0.5, h * pr * 0.5);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vm.resize(w / h);
    this.final.uniforms.uRes.value.set(w * pr, h * pr);
  }

  setQuality(q) { /* 다음 시작 때 적용 */ this.settings.quality = q; }

  // 시뮬레이션 이벤트 → 화면 효과
  handle(ev) {
    const fx = this.fx, w = this.world;
    const p = w ? w.player : null;
    const near = (x, z, r) => p ? Math.max(0, 1 - Math.hypot(p.x - x, p.z - z) / r) : 0;
    switch (ev.t) {
      case 'shot': {
        this.vm.onShot(ev.w, w ? w.player.ammo[ev.w].mag : 1);
        const muzzle = this.vm.muzzleWorld(this.camera);
        const W = WEAPONS[ev.w];
        const energy = ev.w === 'rifle' || ev.w === 'rail';
        const col = ev.w === 'rail' ? [0.8, 2.6, 3.2] : energy ? [0.6, 2.2, 3] : [3, 1.8, 0.8];
        for (const e of ev.ends) {
          if (ev.w === 'rail') {
            fx.tracer(muzzle, e, col, 0.35, 0.09);
            const n = 24, dx = e.x - muzzle.x, dy = e.y - muzzle.y, dz = e.z - muzzle.z;
            for (let i = 0; i < n; i++) { const k = i / n; fx.energy.emit(muzzle.x + dx * k, muzzle.y + dy * k, muzzle.z + dz * k, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0.6, 0.4, 2, 3, 0.05, fx.now); }
          } else if (W.pellets > 1 || Math.random() < 0.7) fx.tracer(muzzle, e, col, ev.w === 'shotgun' ? 0.06 : 0.07, ev.w === 'shotgun' ? 0.012 : 0.02);
          if (e.wall) {
            const n = { x: e.nx, y: e.ny, z: e.nz };
            fx.sparkBurst(e, ev.w === 'shotgun' ? 2 : 6, n, energy ? [0.5, 2, 3] : [3, 1.6, 0.6], 5, 0.04, 0.25);
            if (Math.random() < 0.5) fx.smokePuff(e, 0.25, 0.8, 0.25, { x: n.x * 0.5, y: 0.3, z: n.z * 0.5 });
            if (e.surf !== 'core') fx.decal(e, n, 'hole', ev.w === 'rail' ? 0.3 : ev.w === 'shotgun' ? 0.07 : 0.1);
          }
        }
        this.shake = Math.min(1, this.shake + (ev.w === 'rail' ? 0.25 : ev.w === 'shotgun' ? 0.18 : 0.04));
        break;
      }
      case 'hit': {
        const pos = { x: ev.x, y: ev.y, z: ev.z };
        if (ev.shield) {
          fx.sparkBurst(pos, 6, null, [3, 0.3, 0.2], 4, 0.05, 0.25);
          const v = this.enemies.viewOf(ev.id); if (v && v.shield) v.shield.u.uHit.value = 1;
        } else {
          fx.sparkBurst(pos, ev.weak ? 12 : 6, null, ev.weak ? [3, 2.6, 1.6] : [3, 1.5, 0.5], ev.weak ? 7 : 5, 0.05, 0.3);
          fx.glowPuff(pos, ev.weak ? 0.5 : 0.3, ev.weak ? [2, 1.8, 1.2] : [1.6, 0.8, 0.3], 0.08);
          if (ev.type !== 'drone' && ev.type !== 'boss' && Math.random() < 0.4) fx.smokePuff(pos, 0.2, 0.5, 0.12); // 부서진 외장 가루
        }
        break;
      }
      case 'kill': {
        this.enemies.onKill(ev);
        const pos = { x: ev.x, y: ev.y + (ev.type === 'drone' || ev.type === 'boss' ? 0 : 1.1), z: ev.z };
        if (ev.type !== 'boss' && !ev.self) {
          fx.sparkBurst(pos, 18, ev.dir ? { x: ev.dir.x, y: 0.4, z: ev.dir.z } : null, [3, 1.2, 0.4], 7, 0.06, 0.5);
          fx.debrisBurst(pos, ev.type === 'mech' ? 14 : 6, ev.type === 'mech' ? 0.2 : 0.08, 5, ev.dir);
          fx.glowPuff(pos, ev.type === 'mech' ? 1.6 : 0.7, [3, 1.4, 0.5], 0.12);
          fx.smokePuff(pos, 0.8, 1.2, 0.1);
        }
        break;
      }
      case 'explode':
        fx.explosion({ x: ev.x, y: ev.y, z: ev.z }, ev.r, ev.kind);
        this.shake = Math.min(1, this.shake + near(ev.x, ev.z, ev.r * 5) * (ev.kind === 'boss' ? 1 : 0.6));
        break;
      case 'impact':
        fx.sparkBurst(ev, 3, { x: ev.nx, y: ev.ny, z: ev.nz }, [3, 0.5, 0.3], 4, 0.035, 0.2);
        break;
      case 'enemyShot':
        fx.glowPuff(ev, 0.35, [3, 0.6, 0.3], 0.05);
        break;
      case 'tele': this.telegraph(ev); break;
      case 'elevator': this.level.openElevator(); break;
      case 'spawn':
        if (ev.source === 'dropship') fx.smokePuff({ x: ev.x, y: ev.y + 3, z: ev.z }, 1.0, 0.8, 0.2, { x: 0, y: -2, z: 0 });
        break;
      case 'playerHurt':
        this.hurt = Math.min(1, this.hurt + 0.4 + ev.dmg * 0.02);
        this.aberr = Math.min(1, this.aberr + 0.5);
        this.shake = Math.min(1, this.shake + 0.15 + ev.dmg * 0.01);
        break;
      case 'emp': fx.emp(ev, ev.r); break;
      case 'shock': fx.emp(ev, ev.r); break;
      case 'dashStun': fx.sparkBurst(ev, 10, null, [0.6, 1.6, 3], 4, 0.04, 0.3); break;
      case 'pickup': fx.glowPuff(ev, 0.6, ev.kind === 'orb' ? [0.3, 2, 2.6] : [2.6, 1.5, 0.3], 0.18); break;
      case 'meleeStart': this.vm.onMelee(); break;
      case 'melee':
        if (ev.hit) { fx.sparkBurst(ev, ev.finisher ? 30 : 10, null, [3, 2, 1], 6, 0.06, 0.35); this.shake = Math.min(1, this.shake + (ev.finisher ? 0.35 : 0.15)); }
        if (ev.finisher) { fx.energyBurst(ev, 30, [0.3, 2.2, 3], 4, 0.07, 0.6); this.hitstop = 0.09; }
        break;
      case 'dash': this.fovKick = 9; this.dash = 1; break;
      case 'jump': if (ev.double && p) fx.energyBurst({ x: p.x, y: p.y + 0.1, z: p.z }, 14, [0.3, 1.8, 2.8], 2.5, 0.05, 0.35); break;
      case 'land': this.vm.onLand(ev.speed); this.camDip = Math.min(0.18, ev.speed * 0.012); break;
      case 'reloadStart': this.vm.onReload(ev.w, ev.time, w ? w.player.ammo[ev.w].mag === 0 : false); break;
      case 'shell': this.vm.onShell(); break;
      case 'reloadEnd': this.vm.onReloadEnd(ev.w); break;
      case 'switch': this.vm.onSwitch(ev.w); break;
      case 'throw': this.vm.onThrow(); break;
      case 'bounce': fx.sparkBurst(ev, 2, null, [0.5, 1.6, 3], 2, 0.03, 0.15); break;
      case 'engineDown': this.shake = Math.min(1, this.shake + 0.4); break;
      case 'missile': fx.glowPuff(ev, 0.6, [3, 1.2, 0.4], 0.1); break;
    }
  }

  telegraph(ev) {
    const fx = this.fx, w = this.world;
    const find = () => w.enemies.find((e) => e.id === ev.id);
    const p = w.player;
    if (ev.kind === 'aim') {
      const e = find(); if (!e) return;
      fx.telegraphLaser({ from: () => (e.alive ? { x: e.x - Math.sin(e.yaw) * 0.6, y: e.y + 1.42, z: e.z - Math.cos(e.yaw) * 0.6 } : null), to: () => ({ x: p.x, y: p.y + 1.2, z: p.z }), w: 0.6 }, fx.now + 0.35);
    } else if (ev.kind === 'missile') {
      const e = find(); if (!e) return;
      fx.telegraphLaser({ from: () => (e.alive ? { x: e.x + Math.cos(e.yaw) * 0.8, y: e.y + 3.0, z: e.z - Math.sin(e.yaw) * 0.8 } : null), to: () => ({ x: e.aimX ?? p.x, y: e.aimY ?? p.y + 1, z: e.aimZ ?? p.z }), w: 1.6 }, fx.now + 1.0);
    } else if (ev.kind === 'mortar') {
      for (const q of ev.targets) fx.telegraphCircle(q, 3, q.t);
    } else if (ev.kind === 'gatling') {
      fx.telegraphLine(ev.a, ev.b, ev.time);
    } else if (ev.kind === 'dropship') {
      fx.telegraphCircle({ x: ev.x, y: ev.y, z: ev.z }, 3.2, ev.time);
    }
  }

  // 화면 1장
  render(dt, alpha, look, settings) {
    const w = this.world, p = w.player;
    const t = this.env.time.value + dt;
    this.env.update(dt, t);
    // 카메라
    const x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha, z = p.pz + (p.z - p.pz) * alpha;
    this.camDip *= Math.exp(-dt * 8);
    const bob = p.grounded ? Math.sin(this.vm.state.bobT * 2) * Math.min(1, p.speed / 7) * 0.025 : 0;
    this.camera.position.set(x + p.leanX, y + p.eye - Math.abs(p.lean) * 0.08 - this.camDip + bob, z + p.leanZ);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const sk = this.shake * this.shake * (settings.shake ?? 1);
    const st = t * 32;
    const roll = -p.lean * PLAYER.leanRoll + clampRoll(p, look) + Math.sin(st * 1.3) * sk * 0.03;
    this.camera.rotation.set(look.pitch + Math.sin(st) * sk * 0.025, look.yaw + Math.cos(st * 0.9) * sk * 0.025, roll, 'YXZ');
    // 시야각: 기본 + 대시 순간 확대 + 조준 확대
    this.fovKick *= Math.exp(-dt * 6);
    const hfov = settings.fov || 95;
    const scoped = scopedView(p);
    const zoom = p.weapon === 'rail' ? (scoped ? 0.28 : 0.5) : p.weapon === 'rifle' ? 0.72 : p.weapon === 'pistol' ? 0.85 : 0.9;
    const ads = p.ads;
    const h = (hfov + this.fovKick) * (1 - ads * (1 - zoom));
    const vfov = (2 * Math.atan(Math.tan((h * Math.PI) / 360) * (9 / 16)) * 180) / Math.PI;
    if (Math.abs(this.camera.fov - vfov) > 0.01) { this.camera.fov = vfov; this.camera.updateProjectionMatrix(); }
    // 허리 사격은 넓게(양손이 다 보이게), 조준하면 좁혀 조준경을 크게
    { const base = p.weapon === "pistol" ? 58 : 66, aimF = p.weapon === "rail" ? 32 : 44; this.vm.camera.fov = base - ads * (base - aimF); this.vm.camera.updateProjectionMatrix(); }

    // 장면 갱신
    this.level.update(dt, t, w, this.camera.position);
    this.enemies.sync(w, alpha, dt);
    this.updateLeechBeams();
    this.fx.update(dt, w, alpha);
    const am = p.ammo[p.weapon];
    this.vm.updateAmmo(am.mag, am.reserve);
    this.vm.update(dt, p, look, t);
    this.vmPass.enabled = p.alive && !scoped; // 조준경 화면에서는 총 모델을 그리지 않는다

    // 후처리 값
    this.hurt *= Math.exp(-dt * 3); this.aberr *= Math.exp(-dt * 4); this.dash *= Math.exp(-dt * 7);
    const u = this.final.uniforms;
    u.uTime.value = t; u.uHurt.value = this.hurt; u.uAberr.value = this.aberr;
    u.uLow.value = p.hp < 30 ? 1 - p.hp / 30 : 0;
    u.uDash.value = this.dash;
    r0(this.renderer);
    this.composer.render(dt);
    this.lastInfo = { calls: this.renderer.info.render.calls, tris: this.renderer.info.render.triangles };

    // 동적 해상도
    this.frameAvg += (dt * 1000 - this.frameAvg) * 0.05;
    this.resTimer += dt;
    if (this.resTimer > 2 && settings.dynRes !== false) {
      this.resTimer = 0;
      if (this.frameAvg > 22 && this.resScale > 0.6) { this.resScale = Math.max(0.6, this.resScale - 0.1); this.resize(); }
      else if (this.frameAvg < 13 && this.resScale < 1) { this.resScale = Math.min(1, this.resScale + 0.1); this.resize(); }
    }
  }

  // 메뉴 배경: 광장 위를 천천히 도는 카메라
  renderMenu(dt) {
    const t = this.env.time.value + dt;
    this.env.update(dt, t);
    // 남동쪽 낮은 곳에서 레이돔 탑과 북쪽 산을 올려다보며 천천히 좌우로 흔든다(왼쪽은 메뉴 글줄 자리)
    const a = 1.05 + Math.sin(t * 0.035) * 0.35;
    this.camera.position.set(Math.cos(a) * 21 - 4, 2.6 + Math.sin(t * 0.13) * 0.3, Math.sin(a) * 21);
    this.camera.lookAt(-6, 6.5, -6);
    const vfov = 2 * Math.atan(Math.tan((90 * Math.PI) / 360) * (9 / 16)) * 180 / Math.PI;
    if (Math.abs(this.camera.fov - vfov) > 0.01) { this.camera.fov = vfov; this.camera.updateProjectionMatrix(); }
    if (this.world) { this.level.update(dt, t, this.world, this.camera.position); this.fx.update(dt, this.world, 1); this.enemies.sync(this.world, 1, dt); }
    this.vmPass.enabled = false;
    const u = this.final.uniforms; u.uTime.value = t; u.uHurt.value = 0; u.uLow.value = 0; u.uAberr.value = 0; u.uDash.value = 0;
    this.composer.render(dt);
  }

  // 수리 로봇 → 아군: 수리 레이저(초록빛 흰 선 + 맞는 곳 불꽃)
  updateLeechBeams() {
    const w = this.world, used = new Set();
    for (const e of w.enemies) {
      if (e.type !== 'leech' || e.state !== 'heal' || !e.alive || !e.healTarget) continue;
      used.add(e.id);
      const o = e.healTarget;
      if (!this.lasers.has(e.id)) {
        const l = this.fx.telegraphLaser({ from: () => (e.alive && e.state === 'heal' && e.healing ? { x: e.x - Math.sin(e.yaw) * 0.35, y: e.y + 1.05, z: e.z - Math.cos(e.yaw) * 0.35 } : null), to: () => ({ x: o.x, y: o.y + (o.type === 'mech' ? 1.2 : o.type === 'reaper' ? 0.6 : 1.1), z: o.z }), w: 1.4 }, Infinity, [0.8, 2.6, 1.4]);
        this.lasers.set(e.id, l);
      }
      if (e.healing && Math.random() < 0.4) this.fx.sparkBurst({ x: o.x, y: o.y + (o.type === 'reaper' ? 0.6 : 1.1), z: o.z }, 1, null, [1.2, 2.6, 1.4], 2, 0.03, 0.25);
    }
    for (const [id, l] of this.lasers) if (!used.has(id)) { l.until = 0; this.lasers.delete(id); }
  }

  stats() {
    const i = this.renderer.info, l = this.lastInfo || { calls: 0, tris: 0 };
    return { calls: l.calls, tris: l.tris, geos: i.memory.geometries, tex: i.memory.textures };
  }
}

function r0(r) { r.info.reset(); }

function clampRoll(p, look) {
  // 옆으로 움직일 때 살짝 기울기
  const right = Math.cos(look.yaw) * p.vx - Math.sin(look.yaw) * p.vz;
  return -right * 0.004 - (p.slideT > 0 ? 0.06 : 0);
}

function detectLowSpec(r) {
  try {
    const gl = r.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    return /swiftshader|llvmpipe|software/i.test(name);
  } catch { return false; }
}
