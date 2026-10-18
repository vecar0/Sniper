// 명령 휠. 바라보는 대상(문·사람·바닥)에 따라 항목이 바뀐다.
// PC: V/가운데 버튼을 누른 채 마우스로 고르고 떼면 실행. 모바일: [명령]을 누르면 열리고 항목을 탭.
import { breachName } from '../sim/squad.js';

export class CommandWheel {
  constructor(root, hooks) {
    this.root = root; // #wheel
    this.hooks = hooks; // { getTarget(), execute(item), goWait(), toggleGoWait(), teamLabel(), onOpen(), onClose() }
    this.open = false;
    this.mode = 'mouse';
    this.items = [];
    this.sel = -1;
    this.vec = { x: 0, y: 0 };
  }

  buildItems(target) {
    const items = [];
    if (target && target.type === 'door') {
      const st = target.state;
      items.push({ label: '문 앞 대기', icon: '▮▮', cmd: { type: 'stack', door: target.door } });
      items.push({ label: breachName('open'), icon: '⇥', cmd: { type: 'breach', door: target.door, mode: 'open' }, warn: st.locked || st.barricade });
      items.push({ label: breachName('flash'), icon: '✷', cmd: { type: 'breach', door: target.door, mode: 'flash' }, warn: st.locked || st.barricade });
      items.push({ label: breachName('c2'), icon: '✹', cmd: { type: 'breach', door: target.door, mode: 'c2' } });
      items.push({ label: '미러로 확인', icon: '◐', cmd: { type: 'mirror', door: target.door } });
    } else if (target && target.type === 'actor') {
      items.push({ label: target.label, icon: '⛓', cmd: { type: 'arrest', target: target.id } });
    } else if (target && target.type === 'floor') {
      items.push({ label: '여기로 이동', icon: '⌖', cmd: { type: 'move', x: target.x, z: target.z } });
    }
    items.push({ label: '따라와', icon: '↩', cmd: { type: 'follow' } });
    items.push({ label: '대기', icon: '■', cmd: { type: 'hold' } });
    return items;
  }

  show(mode) {
    const target = this.hooks.getTarget();
    this.target = target;
    this.items = this.buildItems(target);
    this.mode = mode;
    this.sel = -1;
    this.vec = { x: 0, y: 0 };
    this.open = true;
    this.render();
    this.root.classList.remove('hidden');
    this.hooks.onOpen && this.hooks.onOpen();
  }

  hide() {
    this.open = false;
    this.root.classList.add('hidden');
    this.hooks.onClose && this.hooks.onClose();
  }

  pointer(dx, dy) {
    this.vec.x += dx; this.vec.y += dy;
    const L = Math.hypot(this.vec.x, this.vec.y);
    if (L > 140) { this.vec.x *= 140 / L; this.vec.y *= 140 / L; }
    if (L < 28) { this.setSel(-1); return; }
    const ang = Math.atan2(this.vec.y, this.vec.x);
    this.setSel(this.indexForAngle(ang));
  }

  angleFor(i) { return -Math.PI / 2 + (i * Math.PI * 2) / this.items.length; }
  indexForAngle(ang) {
    let best = 0; let bd = Infinity;
    this.items.forEach((_, i) => { let d = Math.abs(((ang - this.angleFor(i)) + Math.PI * 3) % (Math.PI * 2) - Math.PI); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  setSel(i) {
    if (i === this.sel) return;
    this.sel = i;
    this.root.querySelectorAll('.wheel-item').forEach((el, k) => el.classList.toggle('sel', k === i));
  }

  confirm() {
    const it = this.items[this.sel];
    this.hide();
    if (it) this.hooks.execute(it.cmd);
  }

  render() {
    // 항목 수가 많으면 반지름을 키워 겹치지 않게(화면 높이 안에서)
    const n = this.items.length;
    const need = n >= 6 ? 150 : n >= 4 ? 128 : 110;
    const R = Math.min(need, Math.max(96, (window.innerHeight / 2) - 44));
    const t = this.target;
    const head = t ? (t.type === 'door' ? `문${t.state.locked ? ' (잠김)' : t.state.barricade ? ' (바리케이드)' : ''}` : t.type === 'actor' ? '대상' : '바닥') : '';
    const html = [`<div class="wheel-center" data-act="gowait"><div class="wc-head">${head}</div><div class="wc-team">${this.hooks.teamLabel()}</div><div class="wc-go ${this.hooks.goWait() ? 'on' : ''}">GO 대기 ${this.hooks.goWait() ? '켬' : '끔'}</div><div class="wc-hint">${this.mode === 'touch' ? '탭해서 켜기/끄기' : '우클릭/T: 켜기·끄기'}</div></div>`];
    this.items.forEach((it, i) => {
      const a = this.angleFor(i);
      const x = Math.cos(a) * R; const y = Math.sin(a) * R;
      html.push(`<button class="wheel-item${it.warn ? ' warn' : ''}" data-i="${i}" style="transform:translate(calc(${x}px - 50%), calc(${y}px - 50%))"><span class="wi-icon">${it.icon}</span><span class="wi-label">${it.label}</span></button>`);
    });
    if (this.mode === 'touch') html.push('<button class="wheel-close" data-act="close">닫기</button>');
    this.root.innerHTML = `<div class="wheel-ring">${html.join('')}</div>`;
    this.root.querySelectorAll('.wheel-item').forEach((el) => {
      const pick = (e) => { e.preventDefault(); e.stopPropagation(); this.setSel(+el.dataset.i); this.confirm(); };
      el.addEventListener('click', pick);
      el.addEventListener('touchend', pick, { passive: false });
    });
    const center = this.root.querySelector('[data-act="gowait"]');
    const toggle = (e) => { e.preventDefault(); e.stopPropagation(); this.hooks.toggleGoWait(); this.render(); };
    center.addEventListener('click', toggle);
    center.addEventListener('touchend', toggle, { passive: false });
    const close = this.root.querySelector('[data-act="close"]');
    if (close) {
      const c = (e) => { e.preventDefault(); e.stopPropagation(); this.hide(); };
      close.addEventListener('click', c); close.addEventListener('touchend', c, { passive: false });
    }
  }
}
