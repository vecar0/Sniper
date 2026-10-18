// 메뉴 화면들: 메인, 작전 선택, 브리핑(배치·장비), 일시정지, 설정, 조작법, 결과.
import { MISSIONS } from '../config/missions.js';
import { WEAPONS, PRIMARY_IDS, ITEMS } from '../config/weapons.js';
import { LOADOUT_POINTS, ITEM_COST, ITEM_MAX } from '../config/balance.js';
import { parseMap, T } from '../sim/grid.js';
import { defaultLoadout } from '../sim/world.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['screen-loading', 'screen-menu', 'screen-select', 'screen-briefing', 'screen-pause', 'screen-settings', 'screen-help', 'screen-result'];
const MEMBER_NAMES = ['리더(나)', '알파', '브라보', '찰리'];

export function showScreen(id) {
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
}
export function hideScreens() { for (const s of SCREENS) $(s).classList.add('hidden'); }

export function loadoutCost(lo) {
  let c = 0;
  for (const m of lo.members) for (const [k, n] of Object.entries(m.items)) c += (ITEM_COST[k] || 0) * n;
  return c;
}

export class Menus {
  constructor(app) {
    this.app = app; // { save, startMission(id, loadout, entries), saveNow(), applySettings(), resume(), restart(), quitToMenu(), audio }
    this.loadout = defaultLoadout();
    this.bind();
  }

  click(id, fn) {
    const el = $(id);
    el.addEventListener('click', (e) => { e.preventDefault(); this.app.audio.unlock(); this.app.audio.ui('click'); fn(e); });
  }

  bind() {
    this.click('btn-play', () => this.openSelect());
    this.click('btn-help', () => this.openHelp('screen-menu'));
    this.click('btn-settings', () => this.openSettings('screen-menu'));
    this.click('btn-select-back', () => showScreen('screen-menu'));
    this.click('btn-brief-back', () => this.openSelect());
    this.click('btn-brief-start', () => this.app.startMission(this.mission.id, this.loadout, this.entries));
    this.click('btn-resume', () => this.app.resume());
    this.click('btn-pause-settings', () => this.openSettings('screen-pause'));
    this.click('btn-pause-help', () => this.openHelp('screen-pause'));
    this.click('btn-restart', () => this.app.restart());
    this.click('btn-quit', () => this.app.quitToMenu());
    this.click('btn-settings-close', () => { this.app.applySettings(); this.app.saveNow(); showScreen(this.settingsBack); });
    this.click('btn-help-close', () => showScreen(this.helpBack));
    this.click('btn-res-retry', () => this.app.restart());
    this.click('btn-res-next', () => { const i = MISSIONS.findIndex((m) => m.id === this.app.currentMissionId()); const n = MISSIONS[i + 1]; if (n) this.openBriefing(n.id); });
    this.click('btn-res-select', () => this.openSelect());
  }

  openSelect() {
    const save = this.app.save;
    const html = MISSIONS.map((m, i) => {
      const unlocked = save.unlocked.includes(m.id);
      const stars = save.stars[m.id] || 0;
      const best = save.best[m.id];
      return `<button class="mission-card ${unlocked ? '' : 'locked'}" data-id="${m.id}" ${unlocked ? '' : 'disabled'}>
        <div class="mc-num">${String(i + 1).padStart(2, '0')}</div>
        <div class="mc-name">${m.name}</div>
        <div class="mc-intel">${unlocked ? m.intel : '이전 작전에서 별 1개 이상 필요'}</div>
        <div class="mc-stars">${'★'.repeat(stars)}<span>${'★'.repeat(3 - stars)}</span>${best != null ? ` <small>최고 ${best}점</small>` : ''}</div>
      </button>`;
    }).join('');
    $('mission-list').innerHTML = html;
    $('mission-list').querySelectorAll('.mission-card:not(.locked)').forEach((el) => {
      el.addEventListener('click', () => { this.app.audio.unlock(); this.app.audio.ui('click'); this.openBriefing(el.dataset.id); });
    });
    showScreen('screen-select');
  }

  openBriefing(id) {
    this.mission = MISSIONS.find((m) => m.id === id);
    this.entries = { ...this.mission.entries };
    // 팀 구성은 작전의 기본 진입 방식에 맞춘다
    this.loadout.members.forEach((m, i) => { if (i === 0) m.team = 'red'; });
    $('brief-title').textContent = this.mission.name;
    $('brief-text').textContent = this.mission.brief;
    $('brief-intel').textContent = `정보: ${this.mission.intel}${this.mission.timeLimit ? ` · 제한 시간 ${Math.floor(this.mission.timeLimit / 60)}분` : ''}`;
    $('brief-tip').textContent = `팁: ${this.mission.tip}`;
    this.renderLoadout();
    showScreen('screen-briefing');
    requestAnimationFrame(() => this.drawPlan());
  }

  renderLoadout() {
    const lo = this.loadout;
    const cost = loadoutCost(lo);
    const left = LOADOUT_POINTS - cost;
    $('brief-points').innerHTML = `장비 포인트 <b class="${left < 0 ? 'bad' : ''}">${left}</b> / ${LOADOUT_POINTS}`;
    const g = parseMap(this.mission.map);
    const multiEntry = Object.keys(g.entries).length > 1;
    let entryHtml = '';
    if (multiEntry) {
      entryHtml = ['red', 'blue'].map((t) => `<div class="entry-row"><span class="team-tag ${t}">${t === 'red' ? 'Red' : 'Blue'} 진입</span>${Object.keys(g.entries).map((k) => `<button class="chip ${this.entries[t] == k ? 'on' : ''}" data-entry="${t}:${k}">${k}번 입구</button>`).join('')}</div>`).join('');
    }
    $('brief-entries').innerHTML = entryHtml;
    $('brief-entries').querySelectorAll('[data-entry]').forEach((el) => el.addEventListener('click', () => {
      const [t, k] = el.dataset.entry.split(':'); this.entries[t] = Number(k); this.app.audio.ui('click'); this.renderLoadout(); this.drawPlan();
    }));
    $('brief-members').innerHTML = lo.members.map((m, i) => {
      const prim = PRIMARY_IDS.map((pid) => `<button class="chip ${m.primary === pid ? 'on' : ''}" data-prim="${i}:${pid}">${WEAPONS[pid].name}</button>`).join('');
      const items = Object.keys(ITEM_COST).map((k) => {
        const n = m.items[k] || 0;
        return `<div class="item-row"><span>${ITEMS[k].name} <small>${ITEM_COST[k]}p</small></span><button class="pm" data-item="${i}:${k}:-1" ${n <= 0 ? 'disabled' : ''}>−</button><b>${n}</b><button class="pm" data-item="${i}:${k}:1" ${n >= ITEM_MAX[k] || left < ITEM_COST[k] ? 'disabled' : ''}>+</button></div>`;
      }).join('');
      const team = i === 0 ? '<span class="team-tag red">Red(리더)</span>' : `<button class="team-tag ${m.team}" data-team="${i}">${m.team === 'red' ? 'Red' : 'Blue'} ▾</button>`;
      return `<div class="member-card"><div class="mc-head"><b>${MEMBER_NAMES[i]}</b>${team}</div><div class="prim">${prim}</div>${items}</div>`;
    }).join('');
    const root = $('brief-members');
    root.querySelectorAll('[data-prim]').forEach((el) => el.addEventListener('click', () => { const [i, p] = el.dataset.prim.split(':'); lo.members[+i].primary = p; this.app.audio.ui('click'); this.renderLoadout(); }));
    root.querySelectorAll('[data-item]').forEach((el) => el.addEventListener('click', () => {
      const [i, k, d] = el.dataset.item.split(':');
      const m = lo.members[+i];
      const n = (m.items[k] || 0) + Number(d);
      if (n < 0 || n > ITEM_MAX[k]) return;
      m.items[k] = n;
      if (loadoutCost(lo) > LOADOUT_POINTS) { m.items[k] -= Number(d); return; }
      this.app.audio.ui('click'); this.renderLoadout();
    }));
    root.querySelectorAll('[data-team]').forEach((el) => el.addEventListener('click', () => { const m = lo.members[+el.dataset.team]; m.team = m.team === 'red' ? 'blue' : 'red'; this.app.audio.ui('click'); this.renderLoadout(); }));
    $('btn-brief-start').disabled = left < 0;
  }

  // 탑다운 도면
  drawPlan() {
    const cv = $('brief-map');
    const g = parseMap(this.mission.map);
    const box = cv.parentElement.getBoundingClientRect();
    const s = Math.max(4, Math.floor(Math.min((box.width - 8) / g.w, (box.height - 8) / g.h)));
    const dpr = devicePixelRatio || 1;
    cv.width = g.w * s * dpr; cv.height = g.h * s * dpr;
    cv.style.width = `${g.w * s}px`; cv.style.height = `${g.h * s}px`;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#0d1116'; ctx.fillRect(0, 0, g.w * s, g.h * s);
    for (let r = 0; r < g.h; r++) for (let c = 0; c < g.w; c++) {
      const t = g.cells[r * g.w + c];
      if (t === T.FLOOR) ctx.fillStyle = '#26303a';
      else if (t === T.COVER) ctx.fillStyle = '#4b5560';
      else if (t === T.PILLAR) ctx.fillStyle = '#8a9099';
      else if (t === T.DOOR) { const d = g.doors[g.doorAt[r * g.w + c]]; ctx.fillStyle = d.barricade ? '#a0522d' : d.locked ? '#c0392b' : '#d4a65a'; }
      else ctx.fillStyle = '#5d6772';
      ctx.fillRect(c * s, r * s, s, s);
    }
    ctx.strokeStyle = 'rgba(120,180,255,0.06)';
    for (let c = 0; c <= g.w; c++) { ctx.beginPath(); ctx.moveTo(c * s, 0); ctx.lineTo(c * s, g.h * s); ctx.stroke(); }
    for (let r = 0; r <= g.h; r++) { ctx.beginPath(); ctx.moveTo(0, r * s); ctx.lineTo(g.w * s, r * s); ctx.stroke(); }
    ctx.font = `bold ${Math.max(10, s * 0.9)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [k, e] of Object.entries(g.entries)) {
      const teams = ['red', 'blue'].filter((t) => String(this.entries[t]) === k);
      ctx.fillStyle = teams.length === 2 ? '#c77dff' : teams[0] === 'blue' ? '#3b9bff' : teams[0] === 'red' ? '#ff5a4d' : '#888';
      ctx.beginPath(); ctx.arc((e.c + 0.5) * s, (e.r + 0.5) * s, s * 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(k, (e.c + 0.5) * s, (e.r + 0.5) * s + 1);
    }
    // 인질 추정 위치(정보로 공개)
    for (const e of g.entities) {
      if (e.ch !== 'H') continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc((e.c + 0.5) * s, (e.r + 0.5) * s, s * 1.6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = `${Math.max(9, s * 0.7)}px sans-serif`; ctx.fillText('인질?', (e.c + 0.5) * s, (e.r - 1.2) * s);
    }
    const legend = $('brief-legend');
    legend.innerHTML = '<span><i style="background:#d4a65a"></i>문</span><span><i style="background:#c0392b"></i>잠긴 문</span><span><i style="background:#a0522d"></i>바리케이드</span><span><i style="background:#4b5560"></i>엄폐물</span><span><i style="background:#ff5a4d;border-radius:50%"></i>진입 지점</span>';
  }

  openPause() { showScreen('screen-pause'); }

  openSettings(back) {
    this.settingsBack = back;
    const s = this.app.save.settings;
    $('set-sens').value = s.sens; $('set-sens-v').textContent = s.sens.toFixed(2);
    $('set-fov').value = s.fov; $('set-fov-v').textContent = s.fov;
    $('set-vol').value = s.volume; $('set-vol-v').textContent = Math.round(s.volume * 100);
    $('set-invert').checked = s.invertY;
    $('set-assist').checked = s.aimAssist;
    $('set-quality').value = s.quality;
    const upd = () => {
      s.sens = +$('set-sens').value; $('set-sens-v').textContent = s.sens.toFixed(2);
      s.fov = +$('set-fov').value; $('set-fov-v').textContent = s.fov;
      s.volume = +$('set-vol').value; $('set-vol-v').textContent = Math.round(s.volume * 100);
      s.invertY = $('set-invert').checked; s.aimAssist = $('set-assist').checked; s.quality = $('set-quality').value;
      this.app.applySettings();
    };
    if (!this.settingsBound) {
      for (const id of ['set-sens', 'set-fov', 'set-vol', 'set-invert', 'set-assist', 'set-quality']) $(id).addEventListener('input', () => upd());
      for (const id of ['set-invert', 'set-assist', 'set-quality']) $(id).addEventListener('change', () => upd());
      this.settingsBound = true;
    }
    showScreen('screen-settings');
  }

  openHelp(back) { this.helpBack = back; showScreen('screen-help'); }

  showResult(res, nextAvailable, newlyUnlocked) {
    $('res-title').textContent = res.win ? '작전 성공' : '작전 실패';
    $('res-title').className = res.win ? 'win' : 'fail';
    $('res-reason').textContent = res.win ? '' : res.reason;
    $('res-stars').innerHTML = `${'★'.repeat(res.stars)}<span>${'★'.repeat(3 - res.stars)}</span>`;
    $('res-score').innerHTML = `<b>${res.score}</b>점 <small>(${res.earned} / ${res.max}) · ${Math.floor(res.time / 60)}분 ${Math.floor(res.time % 60)}초</small>`;
    $('res-rows').innerHTML = res.rows.length
      ? res.rows.map((r) => `<tr class="${r.pts < 0 ? 'neg' : ''}"><td>${r.label}</td><td>${r.n > 1 ? `${r.n} × ${r.per}` : ''}</td><td>${r.pts > 0 ? '+' : ''}${r.pts}</td></tr>`).join('')
      : '<tr><td colspan="3">기록 없음</td></tr>';
    $('res-violations').innerHTML = res.violations.length
      ? `<h4>교전 규칙 위반</h4>${res.violations.map((v) => `<div>${Math.floor(v.t / 60)}:${String(Math.floor(v.t % 60)).padStart(2, '0')} · ${v.by}: ${v.what} (${v.pts})</div>`).join('')}`
      : '<div class="ok">교전 규칙 위반 없음</div>';
    $('res-unlock').textContent = newlyUnlocked ? '다음 작전이 해금되었습니다!' : (res.win && res.stars === 0 ? '별 1개(60점) 이상이면 다음 작전이 열립니다' : '');
    $('btn-res-next').classList.toggle('hidden', !nextAvailable);
    showScreen('screen-result');
  }
}
