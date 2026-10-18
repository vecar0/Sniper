// 3D 렌더링. 시뮬레이션 상태(World)를 읽기만 하고 절대 바꾸지 않는다.
import * as THREE from '../../vendor/three.module.js';
import { CELL, WALL_H, COVER_H } from '../config/balance.js';
import { T, cellType, roomAtWorld } from '../sim/grid.js';
import { humanGeometry, downGeometry, dummyGeometry, evidenceGeometry, mergeBoxes } from './models.js';
import { makeTextures } from './textures.js';
import { Viewmodel } from './viewmodel.js';
import { Fx } from './fx.js';
import { eyeHeight } from '../sim/combat.js';
import { clamp, lerp, angleWrap } from '../sim/geom.js';

export const QUALITY = {
  low: { pixelRatio: 0.75, roomLights: 3, tex: 256, aa: false },
  mid: { pixelRatio: 1.0, roomLights: 4, tex: 512, aa: false },
  high: { pixelRatio: 1.5, roomLights: 8, tex: 512, aa: true },
};

export class Renderer {
  constructor(canvas, qualityName, mobile) {
    this.canvas = canvas;
    this.mobile = mobile;
    this.qualityName = qualityName;
    this.q = QUALITY[qualityName] || QUALITY.mid;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.q.aa, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
    this.renderer.setClearColor(0x0b0d10);
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 80);
    this.camera.rotation.order = 'YXZ';
    this.baseFov = 75;
    this.tex = makeTextures(this.q.tex);
    this.vm = new Viewmodel();
    this.shake = 0;
    this.resize();
  }

  setQuality(name) {
    this.qualityName = name;
    this.q = QUALITY[name] || QUALITY.mid;
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // 모바일은 기기 배율과 무관하게 절대 배율(낮음 1.0 / 중간 1.33 / 높음 2), PC는 기기 배율 기준
    this.renderer.setPixelRatio(this.mobile ? Math.min(dpr, this.q.pixelRatio * 1.33) : Math.min(dpr, this.q.pixelRatio * dpr));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.vm.resize(w / h);
  }

  // ───────────── 레벨 만들기 ─────────────
  load(world) {
    this.unload();
    this.world = world;
    const g = world.g;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b0d10, 18, 60);
    this.scene = scene;
    const W = g.w * CELL; const H = g.h * CELL;

    const hemi = new THREE.HemisphereLight(0xd8dde6, 0x3a332c, 0.9);
    scene.add(hemi);
    scene.add(new THREE.AmbientLight(0xffffff, 0.18));

    // 바닥·천장
    const floorTex = this.tex.floor.clone(); floorTex.repeat.set(g.w, g.h); floorTex.needsUpdate = true;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0, H / 2);
    scene.add(floor);
    const ceilTex = this.tex.ceiling.clone(); ceilTex.repeat.set(g.w / 2, g.h / 2); ceilTex.needsUpdate = true;
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 1 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(W / 2, WALL_H, H / 2);
    scene.add(ceil);

    // 벽·기둥·엄폐물: 종류별 InstancedMesh 하나씩
    const counts = { wall: 0, pillar: 0, cover: 0, door: g.doors.length };
    for (let i = 0; i < g.cells.length; i++) {
      if (g.cells[i] === T.WALL) counts.wall++;
      else if (g.cells[i] === T.PILLAR) counts.pillar++;
      else if (g.cells[i] === T.COVER) counts.cover++;
    }
    const wallMat = new THREE.MeshStandardMaterial({ map: this.tex.wall, roughness: 0.9 });
    const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, WALL_H, CELL), wallMat, Math.max(1, counts.wall));
    const pillars = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL * 0.8, WALL_H, CELL * 0.8), new THREE.MeshStandardMaterial({ map: this.tex.concrete, roughness: 0.95 }), Math.max(1, counts.pillar));
    const covers = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL * 0.96, COVER_H, CELL * 0.96), new THREE.MeshStandardMaterial({ map: this.tex.crate, roughness: 0.8 }), Math.max(1, counts.cover));
    const lintels = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, WALL_H - 2.2, CELL), wallMat, Math.max(1, counts.door));
    const m = new THREE.Matrix4();
    let wi = 0; let pi = 0; let ci = 0;
    for (let r = 0; r < g.h; r++) for (let c = 0; c < g.w; c++) {
      const t = cellType(g, c, r);
      const x = (c + 0.5) * CELL; const z = (r + 0.5) * CELL;
      if (t === T.WALL) { m.makeTranslation(x, WALL_H / 2, z); walls.setMatrixAt(wi++, m); }
      else if (t === T.PILLAR) { m.makeTranslation(x, WALL_H / 2, z); pillars.setMatrixAt(pi++, m); }
      else if (t === T.COVER) { m.makeRotationY(((c * 7 + r * 3) % 4) * 0.04 - 0.06); m.setPosition(x, COVER_H / 2, z); covers.setMatrixAt(ci++, m); }
    }
    walls.count = wi; pillars.count = pi; covers.count = ci;
    g.doors.forEach((d, i) => { m.makeTranslation((d.c + 0.5) * CELL, 2.2 + (WALL_H - 2.2) / 2, (d.r + 0.5) * CELL); lintels.setMatrixAt(i, m); });
    for (const im of [walls, pillars, covers, lintels]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); scene.add(im); }

    // 천장 조명 패널(발광) + 실제 점광원은 가까운 방에만 몇 개
    const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.04, 0.45), new THREE.MeshBasicMaterial({ color: 0xfff1d6 }), g.rooms.length);
    g.rooms.forEach((rm, i) => { m.makeTranslation(rm.center.x, WALL_H - 0.03, rm.center.z); lamps.setMatrixAt(i, m); });
    lamps.instanceMatrix.needsUpdate = true; lamps.computeBoundingSphere();
    scene.add(lamps);
    this.roomLights = [];
    for (let i = 0; i < this.q.roomLights; i++) {
      const L = new THREE.PointLight(0xffe8c8, 9, 15, 1.4);
      L.position.set(-100, 2.4, -100);
      scene.add(L); this.roomLights.push(L);
    }
    this.lightTimer = 0;

    // 사람·문 공용 재질(정점 색)
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 });
    this.geoCache = new Map();
    this.doorMeshes = g.doors.map((d) => this.makeDoor(d, world.doors[d.id]));

    // 사람
    this.actorMeshes = world.actors.map((a) => {
      if (a.kind === 'leader') return null;
      const mesh = new THREE.Mesh(this.geoFor(a, this.poseOf(a)), this.mat);
      mesh.userData.pose = this.poseOf(a);
      scene.add(mesh);
      return mesh;
    });
    // 대원 머리 위 팀 표시
    this.markers = world.squad.map((s) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.diamondTex(s.team), depthTest: false, transparent: true, opacity: 0.85 }));
      sp.scale.set(0.18, 0.18, 1); sp.renderOrder = 5;
      scene.add(sp); return sp;
    });
    // 발밑 그림자(블롭)
    this.blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.tex.blob, transparent: true, depthWrite: false }), world.actors.length);
    this.blobs.frustumCulled = false;
    scene.add(this.blobs);

    this.evidenceMeshes = [];
    this.grenadeMeshes = [];
    const gGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8);
    const gMat = new THREE.MeshStandardMaterial({ color: 0x3e4a3a, roughness: 0.6 });
    for (let i = 0; i < 4; i++) { const gm = new THREE.Mesh(gGeo, gMat); gm.visible = false; scene.add(gm); this.grenadeMeshes.push(gm); }
    this.fx = new Fx(scene, this.tex);
    this.reachTimer = 0;
    this.reach = new Set();
    this.vm.setWeapon(world.leader.weapons[world.leader.slot].id);
  }

  diamondTex(team) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = team === 'blue' ? '#3b9bff' : '#ff4d40';
    ctx.beginPath(); ctx.moveTo(16, 2); ctx.lineTo(30, 16); ctx.lineTo(16, 30); ctx.lineTo(2, 16); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  makeDoor(d, st) {
    const pivot = new THREE.Group();
    const wdt = CELL;
    const parts = [];
    const color = d.barricade ? 0x6a4a2a : d.locked ? 0x4a5058 : 0x7b5b3d;
    parts.push({ size: [wdt - 0.04, 2.15, 0.06], pos: [wdt / 2, 1.075, 0], color });
    parts.push({ size: [0.05, 0.05, 0.12], pos: [wdt - 0.15, 1.0, 0], color: 0xc8c8c8 });
    if (d.locked) parts.push({ size: [0.06, 0.06, 0.08], pos: [wdt - 0.15, 1.15, 0], color: 0xd23a2a });
    if (d.barricade) {
      parts.push({ size: [wdt + 0.1, 0.16, 0.06], pos: [wdt / 2, 0.7, 0.07], color: 0x8b6a3e, rot: [0, 0, 0.35] });
      parts.push({ size: [wdt + 0.1, 0.16, 0.06], pos: [wdt / 2, 1.4, 0.07], color: 0x8b6a3e, rot: [0, 0, -0.35] });
      parts.push({ size: [wdt + 0.1, 0.16, 0.06], pos: [wdt / 2, 0.7, -0.07], color: 0x8b6a3e, rot: [0, 0, -0.35] });
    }
    const leaf = new THREE.Mesh(mergeBoxes(parts), this.mat);
    pivot.add(leaf);
    const cx = (d.c + 0.5) * CELL; const cz = (d.r + 0.5) * CELL;
    if (d.axis === 'z') { pivot.position.set(cx - CELL / 2, 0, cz); pivot.userData.base = 0; } else { pivot.position.set(cx, 0, cz - CELL / 2); pivot.userData.base = -Math.PI / 2; }
    pivot.rotation.y = pivot.userData.base;
    this.scene.add(pivot);
    return pivot;
  }

  poseOf(a) {
    if (a.kind === 'dummy') return a.state === 'down' ? 'down' : 'stand';
    if (a.state === 'down') return 'down';
    if (a.kind === 'suspect') {
      if (a.state === 'surrendered') return 'surrender';
      if (a.state === 'arrested') return 'secured';
      return a.crouch ? 'crouch' : 'stand';
    }
    if (a.kind === 'hostage' || a.kind === 'civilian') return a.state === 'secured' ? 'secured' : 'cower';
    return a.crouch ? 'crouch' : 'stand';
  }

  geoFor(a, pose) {
    const key = `${a.kind}|${a.sub || ''}|${a.team || ''}|${pose}`;
    let g = this.geoCache.get(key);
    if (!g) {
      if (a.kind === 'dummy') g = dummyGeometry(pose === 'down');
      else if (pose === 'down') g = downGeometry(a.kind, a.sub, a.team);
      else g = humanGeometry(a.kind, a.sub, a.team, pose);
      this.geoCache.set(key, g);
    }
    return g;
  }

  unload() {
    if (!this.scene) return;
    this.scene.traverse((o) => {
      if (o.geometry && !this.geoCache?.has?.(o.geometry)) o.geometry.dispose();
      if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((mt) => { if (mt.map && !Object.values(this.tex).includes(mt.map)) mt.map.dispose(); mt.dispose(); }); }
    });
    for (const gg of this.geoCache.values()) gg.dispose();
    this.scene = null;
  }

  // ───────────── 이벤트(사격·폭발 등) → 효과 ─────────────
  handleEvents(events) {
    const w = this.world;
    for (const e of events) {
      if (e.type === 'shot') {
        if (e.leader) {
          this.vm.kick();
          const mz = this.vm.muzzleWorld(this.camera);
          this.fx.tracer(mz, e.to, 0xfff0b0);
          this.fx.muzzleLight(mz);
        } else {
          this.fx.tracer(e.from, e.to, e.enemy ? 0xffb070 : 0xfff0b0);
          this.fx.muzzleBurst(e.from);
          this.fx.muzzleLight(e.from);
        }
        if (!e.hit) this.fx.impact(e.to);
        else this.fx.hitPuff(e.to);
      } else if (e.type === 'flash') {
        this.fx.blast(e, 0xffffff, 1.0);
        this.addShake(e, 0.25);
      } else if (e.type === 'explosion') {
        this.fx.blast(e, 0xffa54a, 1.4);
        this.addShake(e, 0.6);
      } else if (e.type === 'smoke') {
        this.fx.smoke(e.x, e.z, w.time);
      } else if (e.type === 'swap') {
        this.vm.setWeapon(w.leader.weapons[w.leader.slot].id);
      } else if (e.type === 'reload') {
        this.vm.reload(e.dur);
      }
    }
  }

  addShake(e, amt) {
    const L = this.world.leader;
    const d = Math.hypot(e.x - L.x, e.z - L.z);
    this.shake = Math.max(this.shake, amt * clamp(1 - d / 12, 0, 1));
  }

  // ───────────── 매 프레임 ─────────────
  update(world, alpha, dt, input) {
    const L = world.leader;
    const lx = lerp(L.px ?? L.x, L.x, alpha); const lz = lerp(L.pz ?? L.z, L.z, alpha);
    // 시점(앉기·기울이기 부드럽게)
    this.eyeY = lerp(this.eyeY ?? eyeHeight(L), eyeHeight(L), clamp(dt * 12, 0, 1));
    this.leanS = lerp(this.leanS ?? 0, L.lean || 0, clamp(dt * 10, 0, 1));
    const bob = L.moving ? Math.sin(world.time * (L.sprinting ? 13 : 9)) * (L.sprinting ? 0.035 : 0.018) : 0;
    const off = this.leanS * 0.35;
    this.camera.position.set(lx + Math.cos(L.yaw) * off, this.eyeY + bob - Math.abs(this.leanS) * 0.06, lz - Math.sin(L.yaw) * off);
    this.shake = Math.max(0, this.shake - dt * 1.5);
    const sh = this.shake * this.shake;
    this.camera.rotation.set(L.pitch + (Math.random() - 0.5) * sh * 0.1, L.yaw + (Math.random() - 0.5) * sh * 0.1, -this.leanS * 0.1);
    const wantFov = L.aiming ? this.baseFov * 0.78 : this.baseFov;
    if (Math.abs(this.camera.fov - wantFov) > 0.05) { this.camera.fov = lerp(this.camera.fov, wantFov, clamp(dt * 14, 0, 1)); this.camera.updateProjectionMatrix(); }

    // 어떤 방이 보일 수 있는지(열린 문으로 이어진 방) — 그 밖의 사람은 그리지 않는다
    this.reachTimer -= dt;
    if (this.reachTimer <= 0) { this.reachTimer = 0.2; this.reach = reachableRooms(world, roomAtWorld(world.g, L.x, L.z)); this.placeLights(world); }

    const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const s = new THREE.Vector3(1, 1, 1); const p = new THREE.Vector3();
    let bi = 0;
    world.actors.forEach((a, i) => {
      const mesh = this.actorMeshes[i];
      if (!mesh) return;
      const room = roomAtWorld(world.g, a.x, a.z);
      mesh.visible = room < 0 || this.reach.has(room);
      if (!mesh.visible) return;
      const pose = this.poseOf(a);
      if (pose !== mesh.userData.pose) { mesh.geometry = this.geoFor(a, pose); mesh.userData.pose = pose; }
      const ax = lerp(a.px ?? a.x, a.x, alpha); const az = lerp(a.pz ?? a.z, a.z, alpha);
      const moving = Math.hypot(a.vx, a.vz) > 0.3;
      mesh.position.set(ax, moving && pose !== 'down' ? Math.abs(Math.sin(world.time * 9 + i)) * 0.04 : 0, az);
      const stunned = a.stunUntil > world.time && a.state !== 'down';
      mesh.rotation.set(stunned ? Math.sin(world.time * 7 + i) * 0.12 : 0, a.yaw + (stunned ? Math.sin(world.time * 3 + i) * 0.4 : 0), stunned ? Math.cos(world.time * 5 + i) * 0.08 : 0);
      if (pose !== 'down') { m.compose(p.set(ax, 0.01, az), q.identity(), s.set(1, 1, 1)); this.blobs.setMatrixAt(bi++, m); }
    });
    this.blobs.count = bi;
    this.blobs.instanceMatrix.needsUpdate = true;
    world.squad.forEach((sq, k) => {
      const mk = this.markers[k];
      const mesh = this.actorMeshes[sq.id];
      mk.visible = sq.state !== 'down' && mesh.visible;
      mk.position.set(mesh.position.x, 2.05, mesh.position.z);
    });

    // 문
    world.g.doors.forEach((d, i) => {
      const st = world.doors[i];
      const pv = this.doorMeshes[i];
      if (st.broken) { pv.visible = false; return; }
      pv.rotation.y = pv.userData.base - st.amt * Math.PI * 0.5;
    });

    // 증거물
    while (this.evidenceMeshes.length < world.evidence.length) {
      const ev = world.evidence[this.evidenceMeshes.length];
      const mm = new THREE.Mesh(evidenceGeometry(ev.sub), this.mat);
      mm.position.set(ev.x, 0, ev.z); mm.rotation.y = ev.id * 1.7;
      this.scene.add(mm); this.evidenceMeshes.push(mm);
    }
    world.evidence.forEach((ev, i) => { this.evidenceMeshes[i].visible = !ev.collected; });

    // 수류탄
    this.grenadeMeshes.forEach((gm, i) => {
      const pr = world.projectiles[i];
      gm.visible = !!pr;
      if (pr) { gm.position.set(pr.x, pr.y, pr.z); gm.rotation.x += dt * 12; }
    });

    this.fx.update(dt, world, this.camera);
    this.vm.update(dt, world, input);
  }

  placeLights(world) {
    const cam = this.camera.position;
    const rooms = world.g.rooms
      .map((r) => ({ r, d: Math.hypot(r.center.x - cam.x, r.center.z - cam.z) + (this.reach.has(r.id) ? 0 : 30) }))
      .sort((a, b) => a.d - b.d);
    this.roomLights.forEach((L, i) => {
      const rm = rooms[i];
      if (!rm) { L.intensity = 0; return; }
      const size = (rm.r.maxC - rm.r.minC + 1) * (rm.r.maxR - rm.r.minR + 1);
      L.position.set(rm.r.center.x, WALL_H - 0.35, rm.r.center.z);
      L.intensity = 7 + Math.min(size, 120) * 0.08;
      L.distance = 9 + Math.sqrt(size) * 1.2;
    });
  }

  render() {
    if (!this.scene) return;
    const r = this.renderer;
    r.info.reset();
    r.clear();
    r.render(this.scene, this.camera);
    if (this.world && this.world.leader.state !== 'down') {
      r.clearDepth();
      r.render(this.vm.scene, this.vm.camera);
    }
  }

  info() { return { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles }; }
}

function reachableRooms(world, start) {
  const out = new Set();
  if (start < 0) { world.g.rooms.forEach((r) => out.add(r.id)); return out; }
  const q = [start]; out.add(start);
  while (q.length) {
    const r = q.shift();
    for (const di of world.g.rooms[r].doors) {
      const st = world.doors[di];
      for (const nr of world.g.doors[di].rooms) {
        if (nr < 0 || out.has(nr)) continue;
        // 닫힌 문 너머 방은 안 보이지만, 문이 반쯤이라도 열려 있으면 보인다
        if (st.open || st.amt > 0.01 || st.broken) { out.add(nr); q.push(nr); }
      }
    }
  }
  return out;
}
