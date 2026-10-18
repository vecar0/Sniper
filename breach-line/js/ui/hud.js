// 작전 중 HUD: 분대 상태, 목표, 미니맵·시간, 조준점, 상호작용 안내, 탄약, 알림, 피격 효과.
import { CELL, TIME_WARNING } from '../config/balance.js';
import { WEAPONS } from '../config/weapons.js';
import { T, roomAtWorld } from '../sim/grid.js';
import { breachName } from '../sim/squad.js';

const $ = (id) => document.getElementById(id);

const ORDER_TEXT = (w, m) => {
  if (m.state === 'down') return '부상';
  if (m.task) return m.task.type === 'arrest' ? '체포 중' : '작업 중';
  if (m.order.type === 'follow') return '따라옴';
  if (m.order.type === 'hold') return '대기';
  if (m.order.type === 'op') {
    const op = w.ops.find((o) => o.id === m.order.op);
    if (!op) return '대기';
    const base = { move: '이동', stack: '문 앞 대기', breach: breachName(op.mode), mirror: '미러', arrest: '체포' }[op.type] || op.type;
    if (op.pending && !op.go) return `${base} · GO 대기`;
    return base;
  }
  return '';
};

export class Hud {
  constructor() {
    this.root = $('hud');
    this.squadEl = $('squad-panel');
    this.objEl = $('obj');
    this.timerEl = $('timer');
    this.ammoEl = $('ammo');
    this.promptEl = $('prompt');
    this.hintEl = $('look-hint');
    this.noticeEl = $('notices');
    this.goChip = $('go-chip');
    this.teamChip = $('team-chip');
    this.tbTeam = $('tb-team');
    this.vignette = $('dmg-vignette');
    this.whiteEl = $('flash-white');
    this.hitEl = $('hitmark');
    this.arcsEl = $('dmg-arcs');
    this.cross = $('crosshair');
    this.mini = $('minimap');
    this.mctx = this.mini.getContext('2d');
    this.goBtn = document.querySelector('[data-btn="go"]');
    this.interactBtn = document.querySelector('[data-btn="interact"]');
    this.fpsEl = $('fps');
    this.white = 0; this.dmg = 0; this.hitT = 0;
    this.lastSquadHtml = '';
    this.noticeList = [];
    this.lastHp = null;
  }

  reset(world) {
    this.world = world;
    this.white = 0; this.dmg = 0; this.hitT = 0;
    this.noticeList = []; this.noticeEl.innerHTML = '';
    this.lastHp = world.leader.hp;
    this.arcsEl.innerHTML = '';
    // 미니맵 크기
    const g = world.g;
    const scale = Math.floor(Math.min(150 / g.w, 110 / g.h) * 10) / 10;
    this.mscale = scale;
    this.mini.width = Math.ceil(g.w * scale * devicePixelRatio);
    this.mini.height = Math.ceil(g.h * scale * devicePixelRatio);
    this.mini.style.width = `${g.w * scale}px`;
    this.mini.style.height = `${g.h * scale}px`;
  }

  handleEvents(events, audio) {
    const w = this.world;
    for (const e of events) {
      if (e.type === 'notice') this.pushNotice(e.text, e.tone);
      else if (e.type === 'flashed') this.white = Math.max(this.white, e.amount);
      else if (e.type === 'hit' && e.id === w.leader.id) {
        this.dmg = Math.min(1, this.dmg + 0.45);
        audio && audio.hurt();
        const by = e.by != null ? w.byId(e.by) : null;
        if (by) this.arc(by);
      } else if (e.type === 'shot' && e.leader && e.hit) {
        const a = w.byId(e.actor);
        if (a && (a.kind === 'suspect' || a.kind === 'dummy')) { this.hitT = 0.15; this.hitEl.classList.toggle('head', e.zone === 'head'); audio && audio.hitMarker(e.zone === 'head'); }
      }
    }
  }

  arc(src) {
    const L = this.world.leader;
    const ang = Math.atan2(-(src.x - L.x), -(src.z - L.z)) - L.yaw;
    const el = document.createElement('div');
    el.className = 'arc';
    el.style.transform = `rotate(${-ang}rad)`;
    this.arcsEl.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  pushNotice(text, tone) {
    const el = document.createElement('div');
    el.className = `notice ${tone}`;
    el.textContent = text;
    this.noticeEl.prepend(el);
    while (this.noticeEl.children.length > 4) this.noticeEl.lastChild.remove();
    setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 500); }, 3200);
  }

  update(dt, world, ui) {
    const L = world.leader;
    // 분대
    const rows = [`<div class="sq-row lead"><b>리더</b><span class="hpbar"><i style="width:${Math.max(0, L.hp / L.maxHp) * 100}%"></i></span><span class="ord">${Math.max(0, Math.ceil(L.hp))}</span></div>`];
    for (const m of world.squad) {
      rows.push(`<div class="sq-row ${m.team} ${m.state === 'down' ? 'down' : ''}"><b>${m.name}</b><span class="hpbar"><i style="width:${Math.max(0, m.hp / m.maxHp) * 100}%"></i></span><span class="ord">${ORDER_TEXT(world, m)}</span></div>`);
    }
    const sq = rows.join('');
    if (sq !== this.lastSquadHtml) { this.squadEl.innerHTML = sq; this.lastSquadHtml = sq; }
    // 목표
    const o = world.objectives();
    const objTxt = world.mission.training
      ? `표적 ${o.suspectsDone}/${o.suspects}`
      : `인질 ${o.hostagesDone}/${o.hostages - o.hostageDeaths}${o.hostageDeaths ? ` (사망 ${o.hostageDeaths})` : ''} · 용의자 ${o.suspectsDone}/${o.suspects}`;
    if (this.objEl.textContent !== objTxt) this.objEl.textContent = objTxt;
    // 시간
    const left = world.timeLeft();
    const t = left == null ? world.time : left;
    const mm = Math.floor(t / 60); const ss = Math.floor(t % 60);
    this.timerEl.textContent = `${left == null ? '경과 ' : ''}${mm}:${String(ss).padStart(2, '0')}`;
    this.timerEl.classList.toggle('warn', left != null && left <= TIME_WARNING);
    // 탄약
    const g = L.weapons[L.slot];
    const spec = WEAPONS[g.id];
    const reloading = L.reloadUntil ? ' · 재장전…' : '';
    const ammo = `<div class="wname">${spec.name}${reloading}</div><div class="mag"><b>${g.mag}</b> / ${g.magSize} <small>탄창 ×${g.reserve}</small></div><div class="nades">섬광 ${L.items.flash} · 연막 ${L.items.smoke}${L.items.c2 ? ` · 폭약 ${L.items.c2}` : ''} <small>[투척: ${L.grenade === 'flash' ? '섬광' : '연막'}]</small></div>`;
    if (ammo !== this.lastAmmo) { this.ammoEl.innerHTML = ammo; this.lastAmmo = ammo; }
    // 상호작용
    if (L.interact || (ui.interactTarget && !ui.wheelOpen)) {
      const it = L.interact || ui.interactTarget;
      const p = L.interact ? Math.round(L.interact.progress * 100) : 0;
      const keyName = ui.touch ? '' : 'F 길게: ';
      this.promptEl.innerHTML = `${keyName}${it.label}${p ? `<span class="pbar"><i style="width:${p}%"></i></span>` : ''}`;
      this.promptEl.classList.remove('hidden');
    } else this.promptEl.classList.add('hidden');
    if (this.interactBtn) {
      const it = ui.interactTarget;
      this.interactBtn.classList.toggle('hidden', !it || it.type === 'locked');
      if (it && this.interactBtn.dataset.label !== it.label) { this.interactBtn.dataset.label = it.label; this.interactBtn.querySelector('span').textContent = it.label.replace(/ \(.+\)/, ''); }
    }
    // 명령 대상 안내
    const lt = ui.lookTarget;
    let hint = '';
    if (lt && lt.type === 'door') hint = `문${lt.state.locked ? '(잠김)' : lt.state.barricade ? '(바리케이드)' : ''} — ${ui.touch ? '[명령]' : 'V'}로 명령`;
    else if (lt && lt.type === 'actor') hint = `${lt.label} — ${ui.touch ? '[명령]' : 'V'}`;
    if (this.hintEl.textContent !== hint) this.hintEl.textContent = hint;
    // GO 대기·팀
    const pend = world.ops.filter((op) => op.pending && !op.go);
    const ready = pend.filter((op) => op.phase === 'ready').length;
    this.goChip.innerHTML = `GO 대기 <b class="${ui.goWait ? 'on' : ''}">${ui.goWait ? '켬' : '끔'}</b>${pend.length ? ` · 대기 명령 ${pend.length}개 (준비 ${ready})${ui.touch ? '' : ' — Space'}` : ''}`;
    if (this.goBtn) this.goBtn.classList.toggle('hidden', pend.length === 0);
    const teamTxt = { all: '전원', red: 'Red', blue: 'Blue' }[ui.team];
    const chip = `<span>명령 대상</span><b class="${ui.team}">${teamTxt}</b>`;
    if (this.lastChip !== chip) { this.teamChip.innerHTML = chip; this.tbTeam.innerHTML = chip; this.lastChip = chip; }
    // 조준점 벌어짐
    const spreadPx = Math.min(60, 6 + L.spread * 520);
    this.cross.style.setProperty('--gap', `${spreadPx}px`);
    this.cross.classList.toggle('hidden', L.sprinting);
    // 피격·섬광
    this.dmg = Math.max(0, this.dmg - dt * 0.9);
    this.vignette.style.opacity = String(Math.max(this.dmg, L.hp < L.maxHp * 0.35 ? 0.35 : 0));
    this.white = Math.max(0, this.white - dt * 0.28);
    this.whiteEl.style.opacity = String(Math.min(1, this.white * 1.3));
    this.hitT -= dt;
    this.hitEl.classList.toggle('on', this.hitT > 0);
    this.drawMinimap(world, ui);
  }

  drawMinimap(world, ui) {
    const g = world.g; const ctx = this.mctx; const s = this.mscale * devicePixelRatio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.mini.width, this.mini.height);
    ctx.fillStyle = 'rgba(8,12,16,0.75)';
    ctx.fillRect(0, 0, this.mini.width, this.mini.height);
    const revealed = new Set(world.reveals.filter((r) => r.until > world.time).map((r) => r.room));
    for (let r = 0; r < g.h; r++) for (let c = 0; c < g.w; c++) {
      const t = g.cells[r * g.w + c];
      const room = g.room[r * g.w + c];
      if (t === T.FLOOR || t === T.COVER) {
        const seen = world.visited.has(room);
        ctx.fillStyle = seen ? (t === T.COVER ? '#5a6068' : '#3a4048') : revealed.has(room) ? '#2f3a46' : '#1c2127';
        ctx.fillRect(c * s, r * s, s + 0.5, s + 0.5);
      } else if (t === T.DOOR) {
        const st = world.doors[g.doorAt[r * g.w + c]];
        ctx.fillStyle = st.broken ? '#776655' : st.open ? '#6b8f5e' : st.barricade ? '#a0522d' : st.locked ? '#b03a2e' : '#c9a35c';
        ctx.fillRect(c * s, r * s, s + 0.5, s + 0.5);
      }
    }
    const dot = (x, z, color, rad) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc((x / CELL) * s, (z / CELL) * s, rad * devicePixelRatio, 0, Math.PI * 2); ctx.fill(); };
    for (const a of world.actors) {
      if (a.kind === 'leader') continue;
      if (a.kind === 'squad') { if (a.state !== 'down') dot(a.x, a.z, a.team === 'blue' ? '#3b9bff' : '#ff5a4d', 2.6); else dot(a.x, a.z, '#666', 2.2); continue; }
      const known = (a.knownUntil || 0) > world.time || (world.visited.has(roomAtWorld(g, a.x, a.z)) && (a.state === 'down' || a.state === 'arrested' || a.state === 'surrendered' || a.state === 'secured' || a.kind === 'dummy'));
      if (!known) continue;
      if (a.kind === 'suspect' || a.kind === 'dummy') dot(a.x, a.z, a.state === 'down' ? '#5a3030' : a.state === 'arrested' ? '#888' : a.state === 'surrendered' ? '#e6c84a' : '#ff3030', 2.2);
      else dot(a.x, a.z, a.state === 'down' ? '#444' : a.state === 'secured' ? '#9fe6a0' : '#ffffff', 2.2);
    }
    // 리더(방향 표시)
    const L = world.leader;
    const lx = (L.x / CELL) * s; const lz = (L.z / CELL) * s;
    ctx.save();
    ctx.translate(lx, lz); ctx.rotate(-L.yaw);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -5 * devicePixelRatio); ctx.lineTo(3.5 * devicePixelRatio, 4 * devicePixelRatio); ctx.lineTo(-3.5 * devicePixelRatio, 4 * devicePixelRatio); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
