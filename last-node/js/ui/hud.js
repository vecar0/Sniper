// HUD: 웨이브·기준 시간 · 레이더 · 점수·연속 처치 배수 · 방송 · 체력·대시 · 무기 · 십자선·명중 · 피격 방향 · 배너
import { WEAPONS, PLAYER, SCORE } from '../config/balance.js';
import { scopedView } from '../sim/player.js';

const SHORT = { pistol: '권총', shotgun: '산탄총', rifle: '소총', rail: 'Kar98k' };

// 군용 계기판처럼: 숫자는 좁은 고딕(Barlow Condensed), 설명은 IBM Plex Sans KR. 상자 없이 화면에 바로 쓴다.
// 색은 의미에만: 빨강 = 위협·피해, 호박 = 점수·연속 처치(투광등과 같은 색), 그 밖은 차가운 흰색.
export class Hud {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="scope hidden"><i class="h"></i><i class="v"></i><i class="dot"></i></div>
      <div class="hud-top">
        <div class="hud-wave"><span class="wlead"><b class="wave">0</b>웨이브</span><span class="sep"></span>남은 적 <b class="left">0</b></div>
        <div class="par"><div class="meter par-bar"><i class="fill"></i></div><span class="par-t"></span></div>
        <div class="hud-boss hidden">
          <div class="boss-line"><span class="boss-name">틸트로터 건십</span><span class="eng"><span class="e0">왼쪽 로터</span><span class="e1">오른쪽 로터</span></span></div>
          <div class="meter boss-bar"><i class="fill"></i></div>
        </div>
      </div>
      <div class="hud-radar"><canvas width="300" height="300"></canvas></div>
      <div class="hud-tr"><div class="hud-score"><span class="sc">0</span></div><div class="hud-cr"><span class="cr">0</span> 크레딧</div><div class="mult"><span class="x">×1.0</span><i><b></b></i></div></div>
      <div class="broadcast hidden"><span class="who">기지 방어 체계</span><span class="msg"></span></div>
      <div class="hud-hp">
        <div class="hp-row"><span class="hp">100</span><span class="hpmax">/100</span><span class="ar"></span></div>
        <div class="meter hp-bar"><i class="lag"></i><i class="fill"></i></div>
        <div class="meter armor hidden"><i class="fill"></i></div>
        <div class="dash-pips"><span>대시</span></div>
      </div>
      <div class="hud-weapon">
        <div class="reload"></div>
        <div class="ammo"><span class="mag">0</span><span class="res">0</span></div>
        <div class="wname"></div>
        <div class="slots"><span data-i="0"><kbd>1</kbd><b></b></span><span data-i="1"><kbd>2</kbd><b></b></span></div>
        <div class="emp"></div>
      </div>
      <div class="cross"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><div class="dot"></div></div>
      <div class="hitmark"></div>
      <div class="pop"></div>
      <div class="dirs"></div>
      <div class="arrows"></div>
      <div class="nums"></div>
      <div class="prep hidden"><div class="t"></div><div class="s"></div></div>
      <div class="banner"><div class="big"></div><div class="small"></div></div>`;
    const q = (s) => root.querySelector(s);
    this.el = {
      waveBox: q('.hud-wave'), waveLead: q('.wlead'), left: q('.left'), par: q('.par'), parFill: q('.par-bar .fill'), parT: q('.par-t'),
      boss: q('.hud-boss'), bossFill: q('.boss-bar .fill'), e0: q('.e0'), e1: q('.e1'),
      radar: q('.hud-radar canvas'), sc: q('.sc'), cr: q('.hud-cr .cr'), mult: q('.mult'), multX: q('.mult .x'), multBar: q('.mult b'),
      cast: q('.broadcast'), castMsg: q('.broadcast .msg'),
      hpBox: q('.hud-hp'), hp: q('.hp'), hpMax: q('.hpmax'), ar: q('.ar'), hpFill: q('.hp-bar .fill'), hpLag: q('.hp-bar .lag'), armorBar: q('.armor'), armorFill: q('.armor .fill'),
      pipBox: q('.dash-pips'), pips: [],
      reload: q('.reload'), wname: q('.wname'), ammo: q('.ammo'), mag: q('.mag'), res: q('.res'), slots: [...root.querySelectorAll('.slots span')], emp: q('.emp'),
      scope: q('.scope'), cross: q('.cross'), crossI: [...root.querySelectorAll('.cross i')], hit: q('.hitmark'), pop: q('.pop'), dirs: q('.dirs'), arrows: q('.arrows'), nums: q('.nums'),
      prep: q('.prep'), prepT: q('.prep .t'), prepS: q('.prep .s'), banner: q('.banner'), bBig: q('.banner .big'), bSmall: q('.banner .small'),
    };
    this.ctx = this.el.radar.getContext('2d');
    this.radarT = 0;
    this.cache = {};
    this.touch = false;
  }

  set(key, el, val, prop = 'textContent') { if (this.cache[key] !== val) { this.cache[key] = val; el[prop] = val; } }

  update(world, dt, camera) {
    const p = world.player, E = this.el;
    // 웨이브 · 남은 적 · 기준 시간
    const waveText = world.wave === 0 ? '<b class="wave">작전 준비</b>' : `<b class="wave">${world.wave}</b>웨이브`;
    this.set('wvh', E.waveLead, waveText, 'innerHTML');
    const left = world.state === 'wave' ? world.spawn.left + world.enemies.filter((e) => e.type !== 'boss').length + (world.boss ? 1 : 0) : 0;
    this.set('lf', E.left, String(left));
    const inWave = world.state === 'wave';
    E.par.classList.toggle('hidden', !inWave);
    if (inWave) {
      const par = SCORE.par(world.wave), f = world.parT / par;
      this.set('pf', E.parFill.style, `scaleX(${f.toFixed(3)})`, 'transform');
      this.set('pt', E.parT, world.parT > 0 ? `기준 시간 ${fmt(world.parT)}` : '기준 시간 초과');
      E.par.classList.toggle('late', world.parT <= 0);
    }
    const boss = world.boss && world.boss.alive ? world.boss : null;
    E.boss.classList.toggle('hidden', !boss);
    if (boss) {
      this.set('bf', E.bossFill.style, `scaleX(${(boss.hp / boss.maxHp).toFixed(3)})`, 'transform');
      E.e0.classList.toggle('off', boss.engines[0] <= 0); E.e1.classList.toggle('off', boss.engines[1] <= 0);
    }
    // 점수 · 연속 처치 배수(남은 시간 막대)
    this.set('sc', E.sc, world.score.toLocaleString());
    this.set('cr', E.cr, world.credits.toLocaleString());
    const multOn = world.combo >= 2 && world.comboT < SCORE.comboWindow;
    E.mult.classList.toggle('on', multOn);
    if (multOn) {
      this.set('mx', E.multX, `×${world.comboMul.toFixed(1)}`);
      E.multBar.style.transform = `scaleX(${Math.max(0, 1 - world.comboT / SCORE.comboWindow).toFixed(3)})`;
      E.mult.classList.toggle('max', world.comboMul >= SCORE.comboMax);
    }
    // 체력
    const hpF = p.hp / p.maxHp;
    this.set('hp', E.hp, String(Math.ceil(p.hp)));
    this.set('hpm', E.hpMax, `/${p.maxHp}`);
    this.set('hpf', E.hpFill.style, `scaleX(${hpF.toFixed(3)})`, 'transform');
    this.set('hpl', E.hpLag.style, `scaleX(${hpF.toFixed(3)})`, 'transform');
    E.hpBox.classList.toggle('low', p.hp < p.maxHp * 0.3);
    E.armorBar.classList.toggle('hidden', p.armor <= 0);
    this.set('ar', E.ar, p.armor > 0 ? `방어구 ${Math.ceil(p.armor)}` : '');
    this.set('arf', E.armorFill.style, `scaleX(${(p.armor / PLAYER.armorMax).toFixed(3)})`, 'transform');
    while (E.pips.length < p.dashMax) { const i = document.createElement('i'); const b = document.createElement('b'); i.appendChild(b); E.pipBox.appendChild(i); E.pips.push(b); }
    E.pips.forEach((b, i) => {
      const v = i < p.dashCharges ? 1 : i === p.dashCharges ? p.dashRecharge / (PLAYER.dashRecharge * p.dashCdMul) : 0;
      b.style.transform = `scaleX(${v.toFixed(2)})`;
    });
    // 무기
    const w = WEAPONS[p.weapon], am = p.ammo[p.weapon];
    this.set('wn', E.wname, w.name + (p.levels[p.weapon] ? ` · 개량 ${p.levels[p.weapon]}단계` : ''));
    this.set('mg', E.mag, String(am.mag));
    this.set('rs', E.res, am.reserve === Infinity ? '∞' : String(am.reserve));
    E.ammo.classList.toggle('empty', am.mag === 0);
    this.set('rl', E.reload, p.reloadT >= 0 ? '재장전 중' : am.mag === 0 && am.reserve > 0 ? (this.touch ? '장전 버튼을 누르세요' : 'R 키로 재장전') : am.mag === 0 ? '탄약이 없습니다' : '');
    // 1번 주무기 · 2번 보조무기 칸
    E.slots.forEach((s, i) => { const w = p.loadout[i]; s.classList.toggle('own', !!w); s.classList.toggle('cur', !!w && w === p.weapon); this.set('sl' + i, s.lastChild, w ? SHORT[w] : ''); });
    this.set('emp', E.emp, `EMP 수류탄 ${p.emp}/${p.empMax}`);
    // 십자선 퍼짐
    const spread = (w.spreadHip + (w.spreadAds - w.spreadHip) * p.ads) + Math.min(1, p.speed / 7) * 0.9 + (p.grounded ? 0 : 1.2);
    const gap = 6 + spread * 7;
    if (this.cache.gap !== Math.round(gap)) {
      this.cache.gap = Math.round(gap);
      const [t, b, l, r] = E.crossI;
      t.style.top = `${-gap - 8}px`; b.style.top = `${gap}px`; l.style.left = `${-gap - 8}px`; r.style.left = `${gap}px`;
    }
    E.cross.classList.toggle('ads', p.ads > 0.7 && p.weapon !== 'shotgun');
    // 저격소총 조준경: 정조준하면 화면 전체가 조준경 시야(총 모델은 숨긴다)
    const scoped = scopedView(p);
    E.scope.classList.toggle('hidden', !scoped);
    E.cross.classList.toggle('hidden', scoped);
    // 웨이브 사이 카운트다운
    const prep = world.state === 'prep' || world.state === 'intermission';
    E.prep.classList.toggle('hidden', !prep);
    if (prep) {
      this.set('ptt', E.prepT, `${Math.ceil(world.timer)}`);
      const go = this.touch ? '준비 완료를 누르면 바로 시작합니다' : '<kbd>Enter</kbd> 바로 시작';
      this.set('ps', E.prepS, `${world.state === 'prep' ? '첫 웨이브까지' : '다음 웨이브까지'}. ${go}`, 'innerHTML');
    }
    this.radarT += dt;
    if (this.radarT > 1 / 30) { this.radarT = 0; this.drawRadar(world); }
    this.drawArrows(world, camera);
  }

  drawRadar(world) {
    const g = this.ctx, S = 300, R = 30, p = world.player, sc = (S / 2) / R;
    g.clearRect(0, 0, S, S);
    g.save();
    g.translate(S / 2, S / 2);
    g.strokeStyle = 'rgba(232,236,240,0.12)'; g.lineWidth = 2;
    for (const r of [0.33, 0.66, 1]) { g.beginPath(); g.arc(0, 0, (S / 2) * r - 2, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = 'rgba(232,236,240,0.06)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, S / 2, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); g.closePath(); g.fill();
    const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
    const toR = (x, z) => { const dx = x - p.x, dz = z - p.z; return [(dx * cy - dz * sy) * sc, (dx * sy + dz * cy) * sc]; };
    const clampR = (v) => { const l = Math.hypot(v[0], v[1]), m = S / 2 - 10; return l > m ? [v[0] * m / l, v[1] * m / l, true] : [v[0], v[1], false]; };
    // 광장 옹벽 · 가운데 레이돔
    g.strokeStyle = 'rgba(232,236,240,0.24)'; g.lineWidth = 2; g.beginPath();
    for (const [x, z] of [[-28, -28], [28, -28], [28, 28], [-28, 28], [-28, -28]]) { const [rx, ry] = toR(x, z); g.lineTo(rx, ry); }
    g.stroke();
    { const [x, y] = toR(0, 0); g.strokeStyle = 'rgba(232,236,240,0.3)'; g.beginPath(); g.arc(x, y, 1.6 * sc, 0, Math.PI * 2); g.stroke(); }
    for (const k of world.pickups) { const [x, y, out] = clampR(toR(k.x, k.z)); if (out) continue; g.fillStyle = k.kind === 'orb' ? '#9fe8c8' : '#ffb347'; g.fillRect(x - 2, y - 2, 4, 4); }
    for (const e of world.enemies) {
      if (!e.alive) continue;
      const [x, y, out] = clampR(toR(e.x, e.z));
      const above = e.y - p.y;
      g.fillStyle = '#ff4a3d'; g.strokeStyle = '#ff4a3d'; g.lineWidth = 3;
      if (e.type === 'boss') { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-11, -11, 22, 22); g.restore(); continue; }
      // 수리 로봇: 속 빈 마름모(먼저 잡을 표적)
      if (e.type === 'leech') { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.strokeRect(-7, -7, 14, 14); g.restore(); continue; }
      if (e.type === 'drone') { g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 6, y + 5); g.lineTo(x - 6, y + 5); g.closePath(); g.fill(); continue; }
      if (e.type === 'mech') { g.fillRect(x - 9, y - 7, 18, 14); continue; }
      const r = out ? 4 : 6;
      g.globalAlpha = Math.abs(above) > 2.5 ? 0.55 : 1;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    g.fillStyle = '#e8ecf0'; g.beginPath(); g.moveTo(0, -9); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.fill();
    g.restore();
  }

  // 화면 밖 수리 로봇: 가장자리 화살표
  drawArrows(world, camera) {
    const box = this.el.arrows;
    const medics = world.enemies.filter((e) => e.alive && e.type === 'leech');
    while (box.children.length < medics.length) { const d = document.createElement('div'); d.className = 'arrow'; box.appendChild(d); }
    const W = innerWidth, H = innerHeight;
    let n = 0;
    for (const e of medics) {
      const s = project({ x: e.x, y: e.y + 1, z: e.z }, camera);
      const on = s.z < 1 && s.x > 0.04 && s.x < 0.96 && s.y > 0.06 && s.y < 0.94;
      const el = box.children[n++];
      if (on) { el.style.display = 'none'; continue; }
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
  // 처치 점수: 십자선 아래에 잠깐(피드 대신)
  killPop(ev) {
    if (!ev.points) return;
    const d = document.createElement('div');
    d.className = 'kp' + (ev.weak ? ' weak' : '');
    d.textContent = `+${ev.points}${ev.weak ? ' 약점' : ev.melee ? ' 근접' : ''}`;
    this.el.pop.appendChild(d);
    setTimeout(() => d.remove(), 900);
    while (this.el.pop.children.length > 3) this.el.pop.firstChild.remove();
  }
  dir(ev, world) {
    const p = world.player;
    if (ev.fx == null) return;
    const dx = ev.fx - p.x, dz = ev.fz - p.z, s = Math.sin(p.yaw), c = Math.cos(p.yaw);
    const a = Math.atan2(dx * c - dz * s, -dx * s - dz * c); // 0 = 앞(화면 위), +는 오른쪽
    const d = document.createElement('div');
    d.className = 'dir';
    d.style.transform = `rotate(${a}rad)`;
    this.el.dirs.appendChild(d);
    setTimeout(() => d.remove(), 1100);
    while (this.el.dirs.children.length > 8) this.el.dirs.firstChild.remove();
  }
  broadcast(text) {
    const b = this.el.cast;
    this.el.castMsg.textContent = text.replace(/^[^:]*:\s*/, ''); b.classList.remove('hidden'); b.style.opacity = 1;
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

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

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
