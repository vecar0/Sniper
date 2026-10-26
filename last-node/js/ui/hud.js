// HUD: 코어·웨이브 · 레이더 · 크레딧·피드·방송 · 체력·대시 · 무기 · 십자선·명중 · 피격/코어 방향 · 배너
import { WEAPONS, PLAYER, CORE } from '../config/balance.js';
import { TERMINALS, TURRET_SLOTS } from '../config/map.js';

const TYPE_NAME = { reaper: '리퍼', enforcer: '집행관', leech: '리치', drone: '드론', mech: '메크', boss: '카론' };
const SHORT = { pistol: '권총', shotgun: '산탄총', rifle: '라이플', rail: '레일건' };

// 신서울 간판 서체(Black Han Sans)로 숫자, 단말 서체(IBM Plex Sans KR)로 설명. 테두리 상자 없이 화면에 바로 쓴다.
export class Hud {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="hud-core">
        <div class="core-line"><span class="core-name">오로라 코어</span><span class="core-num">1500</span></div>
        <div class="meter core-bar"><i class="lag"></i><i class="fill"></i><i class="shield"></i></div>
        <div class="hud-wave"><span class="wlead"><b class="wave">0</b>웨이브</span><span class="sep"></span>남은 적 <b class="left">0</b></div>
        <div class="hud-boss hidden">
          <div class="core-line"><span class="boss-name">무장 수송기 카론</span><span class="eng"><span class="e0">왼쪽 엔진</span><span class="e1">오른쪽 엔진</span></span></div>
          <div class="meter boss-bar"><i class="fill"></i></div>
        </div>
      </div>
      <div class="hud-radar"><canvas width="300" height="300"></canvas></div>
      <div class="hud-tr"><div class="hud-credits"><span class="cr-sym">₵</span><span class="cr">0</span></div><div class="hud-score">점수 <span class="sc">0</span></div><div class="feed"></div></div>
      <div class="broadcast hidden"><span class="who">헬릭스 방송</span><span class="msg"></span></div>
      <div class="hud-hp">
        <div class="hp-row"><span class="hp">100</span><span class="ar"></span></div>
        <div class="meter hp-bar"><i class="lag"></i><i class="fill"></i></div>
        <div class="meter armor hidden"><i class="fill"></i></div>
        <div class="dash-pips"><span>대시</span><i><b></b></i><i><b></b></i></div>
      </div>
      <div class="hud-weapon">
        <div class="reload"></div>
        <div class="ammo"><span class="mag">0</span><span class="res">0</span></div>
        <div class="wname"></div>
        <div class="slots">${['pistol', 'shotgun', 'rifle', 'rail'].map((w) => `<span data-w="${w}">${SHORT[w]}</span>`).join('')}</div>
        <div class="emp"></div>
      </div>
      <div class="cross"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><div class="dot"></div></div>
      <div class="hitmark"></div>
      <div class="combo"></div>
      <div class="dirs"></div>
      <div class="arrows"></div>
      <div class="nums"></div>
      <div class="hint hidden"></div>
      <div class="prep hidden"><div class="t"></div><div class="s"></div></div>
      <div class="banner"><div class="big"></div><div class="small"></div></div>`;
    const q = (s) => root.querySelector(s);
    this.el = {
      core: q('.hud-core'), coreNum: q('.core-num'), coreFill: q('.core-bar .fill'), coreLag: q('.core-bar .lag'), coreShield: q('.core-bar .shield'),
      waveBox: q('.hud-wave'), waveLead: q('.wlead'), left: q('.left'), boss: q('.hud-boss'), bossFill: q('.boss-bar .fill'), e0: q('.e0'), e1: q('.e1'),
      radar: q('.hud-radar canvas'), cr: q('.cr'), sc: q('.sc'), feed: q('.feed'), cast: q('.broadcast'), castMsg: q('.broadcast .msg'),
      hpBox: q('.hud-hp'), hp: q('.hp'), ar: q('.ar'), hpFill: q('.hp-bar .fill'), hpLag: q('.hp-bar .lag'), armorBar: q('.armor'), armorFill: q('.armor .fill'),
      pips: [...root.querySelectorAll('.dash-pips b')],
      reload: q('.reload'), wname: q('.wname'), ammo: q('.ammo'), mag: q('.mag'), res: q('.res'), slots: [...root.querySelectorAll('.slots span')], emp: q('.emp'),
      cross: q('.cross'), crossI: [...root.querySelectorAll('.cross i')], hit: q('.hitmark'), combo: q('.combo'), dirs: q('.dirs'), arrows: q('.arrows'), nums: q('.nums'),
      hint: q('.hint'), prep: q('.prep'), prepT: q('.prep .t'), prepS: q('.prep .s'), banner: q('.banner'), bBig: q('.banner .big'), bSmall: q('.banner .small'),
    };
    this.ctx = this.el.radar.getContext('2d');
    this.radarT = 0;
    this.cache = {};
    this.touch = false;
  }

  set(key, el, val, prop = 'textContent') { if (this.cache[key] !== val) { this.cache[key] = val; el[prop] = val; } }

  update(world, dt, camera) {
    const p = world.player, c = world.core, E = this.el;
    // 코어
    const cf = Math.max(0, c.hp / c.max);
    this.set('cf', E.coreFill.style, `scaleX(${cf.toFixed(3)})`, 'transform');
    this.set('cl', E.coreLag.style, `scaleX(${cf.toFixed(3)})`, 'transform');
    const shMax = c.shieldLevel ? CORE.shieldLevels[c.shieldLevel - 1] : 1;
    this.set('cs', E.coreShield.style, `scaleX(${(c.shieldLevel ? c.shield / shMax : 0).toFixed(3)})`, 'transform');
    this.set('cn', E.coreNum, Math.ceil(c.hp).toLocaleString());
    E.core.classList.toggle('hurt', c.hurtT < 0.4);
    const waveText = world.wave === 0 ? '<b class="wave">작전 준비</b>' : `<b class="wave">${world.wave}</b>웨이브`;
    if (this.cache.wvh !== waveText) { this.cache.wvh = waveText; E.waveBox.firstChild && (E.waveLead.innerHTML = waveText); }
    const left = world.state === 'wave' ? world.spawn.left + world.enemies.filter((e) => e.type !== 'boss').length + (world.boss ? 1 : 0) : 0;
    this.set('lf', E.left, String(left));
    const boss = world.boss && world.boss.alive ? world.boss : null;
    E.boss.classList.toggle('hidden', !boss);
    if (boss) {
      this.set('bf', E.bossFill.style, `scaleX(${(boss.hp / boss.maxHp).toFixed(3)})`, 'transform');
      E.e0.classList.toggle('off', boss.engines[0] <= 0); E.e1.classList.toggle('off', boss.engines[1] <= 0);
    }
    this.set('cr', E.cr, world.credits.toLocaleString());
    this.set('sc', E.sc, world.score.toLocaleString());
    // 체력: 10칸 눈금
    const hpF = p.hp / PLAYER.hp;
    this.set('hp', E.hp, String(Math.ceil(p.hp)));
    this.set('hpf', E.hpFill.style, `scaleX(${hpF.toFixed(3)})`, 'transform');
    this.set('hpl', E.hpLag.style, `scaleX(${hpF.toFixed(3)})`, 'transform');
    E.hpBox.classList.toggle('low', p.hp < 30);
    E.armorBar.classList.toggle('hidden', p.armor <= 0);
    this.set('ar', E.ar, p.armor > 0 ? `방어구 ${Math.ceil(p.armor)}` : '');
    this.set('arf', E.armorFill.style, `scaleX(${(p.armor / PLAYER.armorMax).toFixed(3)})`, 'transform');
    E.pips.forEach((b, i) => {
      const v = i < p.dashCharges ? 1 : i === p.dashCharges ? p.dashRecharge / PLAYER.dashRecharge : 0;
      b.style.transform = `scaleX(${v.toFixed(2)})`;
    });
    // 무기
    const w = WEAPONS[p.weapon], am = p.ammo[p.weapon];
    this.set('wn', E.wname, w.name + (p.levels[p.weapon] ? ` 강화 ${p.levels[p.weapon]}단계` : ''));
    this.set('mg', E.mag, String(am.mag));
    this.set('rs', E.res, am.reserve === Infinity ? '∞' : String(am.reserve));
    E.ammo.classList.toggle('empty', am.mag === 0);
    this.set('rl', E.reload, p.reloadT >= 0 ? '재장전 중' : am.mag === 0 && am.reserve > 0 ? (this.touch ? '장전 버튼을 누르세요' : 'R 키로 재장전') : am.mag === 0 ? '탄약이 없습니다' : '');
    E.slots.forEach((s) => { s.classList.toggle('own', !!p.owned[s.dataset.w]); s.classList.toggle('cur', s.dataset.w === p.weapon); });
    this.set('emp', E.emp, `EMP 수류탄 ${p.emp}개`);
    // 십자선 퍼짐
    const spread = (w.spreadHip + (w.spreadAds - w.spreadHip) * p.ads) + Math.min(1, p.speed / 7) * 0.9 + (p.grounded ? 0 : 1.2);
    const gap = 6 + spread * 7;
    if (this.cache.gap !== Math.round(gap)) {
      this.cache.gap = Math.round(gap);
      const [t, b, l, r] = E.crossI;
      t.style.top = `${-gap - 8}px`; b.style.top = `${gap}px`; l.style.left = `${-gap - 8}px`; r.style.left = `${gap}px`;
    }
    E.cross.classList.toggle('ads', p.ads > 0.7 && p.weapon !== 'shotgun');
    // 연속 처치
    const comboOn = world.combo >= 2 && world.comboT < 2.5;
    E.combo.classList.toggle('on', comboOn);
    if (comboOn) this.set('cb', E.combo, `${world.combo}연속 처치, 크레딧 ${world.combo >= 5 ? '25' : '10'}% 추가`);
    // 정비 시간
    const prep = world.canShop();
    E.prep.classList.toggle('hidden', !prep || world.shopOpen);
    if (prep) {
      this.set('pt', E.prepT, `${Math.ceil(world.timer)}`);
      const nearT = world.nearTerminal();
      const go = this.touch ? '준비 완료를 누르면 바로 시작합니다' : '<kbd>Enter</kbd> 바로 시작';
      const msg = world.state === 'prep' ? `첫 웨이브까지 남은 시간. ${go}`
        : nearT ? `${this.touch ? '상점 열기를 누르세요' : '<kbd>F</kbd> 상점 열기'}. ${go}` : `노란 마름모가 상점 단말입니다. ${go}`;
      this.set('ps', E.prepS, msg, 'innerHTML');
    }
    const hint = !prep && world.nearTerminal() ? '상점은 웨이브 사이에만 열립니다' : '';
    E.hint.classList.toggle('hidden', !hint);
    if (hint) this.set('hint', E.hint, hint);
    this.radarT += dt;
    if (this.radarT > 1 / 30) { this.radarT = 0; this.drawRadar(world); }
    this.drawArrows(world, camera);
  }

  drawRadar(world) {
    const g = this.ctx, S = 300, R = 30, p = world.player, sc = (S / 2) / R;
    g.clearRect(0, 0, S, S);
    g.save();
    g.translate(S / 2, S / 2);
    // 링
    g.strokeStyle = 'rgba(233,228,218,0.12)'; g.lineWidth = 2;
    for (const r of [0.33, 0.66, 1]) { g.beginPath(); g.arc(0, 0, (S / 2) * r - 2, 0, Math.PI * 2); g.stroke(); }
    // 시야 부채꼴
    g.fillStyle = 'rgba(233,228,218,0.06)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, S / 2, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); g.closePath(); g.fill();
    const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
    // 월드 → 레이더(플레이어 기준, 보는 방향이 위)
    const toR = (x, z) => { const dx = x - p.x, dz = z - p.z; return [(dx * cy - dz * sy) * sc, (dx * sy + dz * cy) * sc]; };
    const clampR = (v) => { const l = Math.hypot(v[0], v[1]), m = S / 2 - 10; return l > m ? [v[0] * m / l, v[1] * m / l, true] : [v[0], v[1], false]; };
    // 옥상 외곽
    g.strokeStyle = 'rgba(233,228,218,0.22)'; g.lineWidth = 2; g.beginPath();
    for (const [x, z] of [[-28, -28], [28, -28], [28, 28], [-28, 28], [-28, -28]]) { const [rx, ry] = toR(x, z); g.lineTo(rx, ry); }
    g.stroke();
    // 코어
    { const [x, y, out] = clampR(toR(0, 0)); g.fillStyle = world.core.hurtT < 0.4 ? '#ff4438' : '#46e0ee'; g.beginPath(); g.arc(x, y, out ? 7 : 10, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(70,224,238,0.5)'; g.beginPath(); g.arc(x, y, 15, 0, Math.PI * 2); g.stroke(); }
    // 단말 · 포탑
    if (world.canShop()) for (const t of TERMINALS) { const [x, y] = clampR(toR(t.x, t.z)); g.fillStyle = '#f2b23e'; g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-6, -6, 12, 12); g.restore(); }
    world.turrets.forEach((t, i) => { if (!t.built) return; const s = TURRET_SLOTS[i]; const [x, y] = clampR(toR(s.x, s.z)); g.fillStyle = '#46e0ee'; g.fillRect(x - 5, y - 5, 10, 10); });
    // 드롭
    for (const k of world.pickups) { const [x, y, out] = clampR(toR(k.x, k.z)); if (out) continue; g.fillStyle = k.kind === 'orb' ? '#4dffe0' : '#ffb040'; g.fillRect(x - 2, y - 2, 4, 4); }
    // 적
    const blink = Math.sin(performance.now() / 120) > 0;
    for (const e of world.enemies) {
      if (!e.alive) continue;
      const [x, y, out] = clampR(toR(e.x, e.z));
      const above = e.y - p.y;
      if (e.type === 'boss') { g.fillStyle = '#ff3448'; g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-11, -11, 22, 22); g.restore(); continue; }
      if (e.type === 'leech') { if (!blink && e.state === 'attach') continue; g.fillStyle = '#ff2bd6'; g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-7, -7, 14, 14); g.restore(); continue; }
      g.fillStyle = e.type === 'mech' ? '#ff7a30' : '#ff3448';
      if (e.type === 'drone') { g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 6, y + 5); g.lineTo(x - 6, y + 5); g.closePath(); g.fill(); continue; }
      const r = e.type === 'mech' ? 9 : out ? 4 : 6;
      g.globalAlpha = Math.abs(above) > 2.5 ? 0.55 : 1;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    // 플레이어
    g.fillStyle = '#e9e4da'; g.beginPath(); g.moveTo(0, -9); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.fill();
    g.restore();
  }

  drawArrows(world, camera) {
    const box = this.el.arrows;
    const leeches = world.enemies.filter((e) => e.alive && e.type === 'leech');
    while (box.children.length < leeches.length) { const d = document.createElement('div'); d.className = 'arrow'; box.appendChild(d); }
    const W = innerWidth, H = innerHeight;
    let n = 0;
    for (const e of leeches) {
      const v = { x: e.x, y: e.y + 1.4, z: e.z };
      const s = project(v, camera);
      const on = s.z < 1 && s.x > 0.04 && s.x < 0.96 && s.y > 0.06 && s.y < 0.94;
      const el = box.children[n++];
      if (on) { el.style.display = 'none'; continue; }
      // 화면 가장자리 화살표
      let ax = s.x - 0.5, ay = s.y - 0.5;
      if (s.z >= 1) { ax = -ax; ay = -ay; }
      const a = Math.atan2(ay, ax);
      const m = Math.min((W / 2 - 40) / Math.abs(Math.cos(a) || 1e-3), (H / 2 - 40) / Math.abs(Math.sin(a) || 1e-3));
      el.style.display = 'block';
      el.style.left = `${W / 2 + Math.cos(a) * m - 10}px`; el.style.top = `${H / 2 + Math.sin(a) * m - 9}px`;
      el.style.transform = `rotate(${a + Math.PI / 2}rad)`;
    }
    for (let i = n; i < box.children.length; i++) box.children[i].style.display = 'none';
  }

  // ── 이벤트 반응 ───────────────────────────────────────
  hitmark(kind) {
    const h = this.el.hit;
    h.className = 'hitmark'; void h.offsetWidth;
    h.className = `hitmark show ${kind}`;
  }
  damageNumber(ev, camera) {
    const s = project(ev, camera);
    if (s.z >= 1) return;
    const d = document.createElement('div');
    d.className = 'dmgnum' + (ev.weak ? ' weak' : '');
    d.textContent = Math.round(ev.dmg);
    d.style.left = `${s.x * innerWidth + (Math.random() - 0.5) * 20}px`; d.style.top = `${s.y * innerHeight}px`;
    this.el.nums.appendChild(d);
    setTimeout(() => d.remove(), 700);
    if (this.el.nums.children.length > 14) this.el.nums.firstChild.remove();
  }
  feed(ev) {
    const d = document.createElement('div');
    if (ev.weak) d.className = 'weak';
    const how = ev.melee ? '근접으로 처치' : ev.weak ? '약점 명중' : '처치';
    d.innerHTML = `<span class="who">${TYPE_NAME[ev.type] || ev.type}</span> ${how}<b>+${ev.credits}</b>`;
    this.el.feed.prepend(d);
    while (this.el.feed.children.length > 4) this.el.feed.lastChild.remove();
    setTimeout(() => d.remove(), 4000);
  }
  dir(ev, world, core) {
    const p = world.player;
    if (ev.fx == null) return;
    const dx = ev.fx - p.x, dz = ev.fz - p.z, s = Math.sin(p.yaw), c = Math.cos(p.yaw);
    const a = Math.atan2(dx * c - dz * s, -dx * s - dz * c); // 0 = 앞(화면 위), +는 오른쪽
    const d = document.createElement('div');
    d.className = 'dir' + (core ? ' core' : '');
    d.style.transform = `rotate(${a}rad)`;
    this.el.dirs.appendChild(d);
    setTimeout(() => d.remove(), 1100);
    while (this.el.dirs.children.length > 8) this.el.dirs.firstChild.remove();
  }
  coreDir(world) {
    // 코어가 공격받으면: 플레이어 기준 코어 방향
    if (performance.now() - (this.lastCoreDir || 0) < 900) return;
    this.lastCoreDir = performance.now();
    this.dir({ fx: 0, fz: 0 }, world, true);
  }
  broadcast(text) {
    const b = this.el.cast;
    this.el.castMsg.textContent = text.replace(/^헬릭스[^:]*:\s*/, ''); b.classList.remove('hidden'); b.style.opacity = 1;
    clearTimeout(this.castT);
    this.castT = setTimeout(() => { b.style.opacity = 0; setTimeout(() => b.classList.add('hidden'), 500); }, 4200);
  }
  banner(big, small, red = false) {
    const b = this.el.banner;
    this.el.bBig.textContent = big; this.el.bSmall.textContent = small;
    b.className = 'banner' + (red ? ' red' : ''); void b.offsetWidth; b.className = 'banner show' + (red ? ' red' : '');
  }
  show(on) { this.root.classList.toggle('hidden', !on); }
}

// 월드 → 화면(0~1), z>=1이면 카메라 뒤
const _v = { x: 0, y: 0, z: 0 };
export function project(p, camera) {
  const e = camera.matrixWorldInverse.elements, pr = camera.projectionMatrix.elements;
  const x = e[0] * p.x + e[4] * p.y + e[8] * p.z + e[12];
  const y = e[1] * p.x + e[5] * p.y + e[9] * p.z + e[13];
  const z = e[2] * p.x + e[6] * p.y + e[10] * p.z + e[14];
  const w = -z;
  const cx = (pr[0] * x + pr[8] * z) / w, cy = (pr[5] * y + pr[9] * z) / w;
  _v.x = cx * 0.5 + 0.5; _v.y = -cy * 0.5 + 0.5; _v.z = w > 0 ? 0 : 1;
  return { ..._v };
}
