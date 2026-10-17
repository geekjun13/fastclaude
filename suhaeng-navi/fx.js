'use strict';
/* 수행 내비 — look & motion: appearance modes, the in-place DOM morph, page transitions,
   sliding pills, ripples, swipe navigation, confetti, the splash and the logo mark. */

const LOGO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#1B2337" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="2.4" fill="#fff"/><path d="M8.2 17h6.3a3 3 0 0 0 0-6h-5a3 3 0 0 1 0-6h6.3"/><rect x="16" y="3.4" width="5" height="5" rx="1.4" fill="#1B2337"/></svg>';
const logoMark = (s, cls) => `<span class="logo${cls ? ' ' + cls : ''}" style="--s:${s || 28}px" aria-hidden="true">${LOGO_SVG}</span>`;

const THEMES = {
  sunrise: { name: '선라이즈', sun: ['#F5D560', '#EBC64C'], blue: ['#2F5BD3', '#86A6FF'], blobs: [['#F7D96B', '#F5B79A', '#9EC1F5', '#C7B8F2'], ['#6A5A1C', '#6B3A2A', '#23407A', '#3E3170']] },
  mint: { name: '민트', sun: ['#8FE3C2', '#5FCFA6'], blue: ['#0E8F6A', '#5FD6AE'], blobs: [['#A8EBD0', '#BDE7F5', '#D7F5B8', '#B9D8F7'], ['#1E5A48', '#1F4A5E', '#3D5A23', '#24406A']] },
  sakura: { name: '사쿠라', sun: ['#F7B8CC', '#E88AA8'], blue: ['#C2376D', '#FF8FB6'], blobs: [['#F9C9D8', '#FBD9C4', '#E5C9F5', '#C9DDF7'], ['#6A2A40', '#6A3E2A', '#4E2E6A', '#2A3E6A']] },
  ocean: { name: '오션', sun: ['#9CD3F7', '#6BB8EA'], blue: ['#1F6FD1', '#7DB6FF'], blobs: [['#A9D8F7', '#B9F0EA', '#C4CCF8', '#E2F2FF'], ['#1D4A6A', '#1D5A55', '#2E356A', '#22324A']] }
};
const MODES = {
  light: { name: '화이트', desc: '밝고 깨끗한 기본', pv: ['#F4F1E8', '#FFFDF8', '#1B2337', '#F5D560'] },
  dark: { name: '다크', desc: '밤에도 눈이 편한', pv: ['#10162A', '#1A2238', '#EEF1F8', '#EBC64C'] },
  natural: { name: '내추럴', desc: '종이와 나무 같은 온기', pv: ['#EFE8DA', '#FBF8F1', '#33402F', '#E2B755'] }
};
const MODE_BG = { light: '#F4F1E8', dark: '#10162A', natural: '#EFE8DA' };
const motionOn = () => state.look.motion !== 'off' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
const mo = () => (state.look.motion === 'quick' ? 0.55 : 1);
const sysDark = matchMedia('(prefers-color-scheme: dark)');
const effMode = () => { const m = state.look.mode || 'auto'; return m === 'auto' ? (sysDark.matches ? 'dark' : 'light') : m; };

function applyLook() {
  const L = state.look, root = document.documentElement, r = root.style;
  r.setProperty('--glass-a', (L.style === 'simple' ? 0.97 : 0.92 - L.glass * 0.0072).toFixed(3));
  r.setProperty('--blur-px', (L.style === 'simple' ? 0 : L.blur) + 'px');
  r.setProperty('--rk', (0.72 + L.round * 0.0092).toFixed(3));
  r.setProperty('--mo', String(mo()));
  if (!L.mode || L.mode === 'auto') delete root.dataset.mode; else root.dataset.mode = L.mode;
  document.body.classList.toggle('simple', L.style === 'simple');
  document.body.classList.toggle('motion-off', L.motion === 'off');
  document.body.classList.toggle('no-ambient', !L.ambient || L.style === 'simple');
  const key = has('themes') ? L.theme : 'sunrise', t = THEMES[key] || THEMES.sunrise;
  const vars = i => `--sun:${t.sun[i]};--blue:${t.blue[i]};--blob-1:${t.blobs[i][0]};--blob-2:${t.blobs[i][1]};--blob-3:${t.blobs[i][2]};--blob-4:${t.blobs[i][3]}`;
  let el = document.getElementById('theme-style');
  if (!el) { el = document.createElement('style'); el.id = 'theme-style'; document.head.appendChild(el); }
  el.textContent = key === 'sunrise' ? '' : `:root{${vars(0)}}:root[data-mode="natural"]{${vars(0)}}@media (prefers-color-scheme: dark){:root:not([data-theme="light"]):not([data-mode]){${vars(1)}}}:is(:root[data-theme="dark"]:not([data-mode]),:root[data-mode="dark"]){${vars(1)}}`;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
  meta.content = MODE_BG[effMode()];
}
sysDark.addEventListener && sysDark.addEventListener('change', () => { if (!state.look.mode || state.look.mode === 'auto') applyLook(); });

/* ---------- DOM morphing: update the page in place so transitions play, focus and scroll stay,
   and nothing re-animates or flashes when one value changes ---------- */
const tplEl = document.createElement('template');
const keyOf = n => (n.nodeType === 1 ? n.getAttribute('data-key') || n.id || null : null);
const ownNode = n => n && n.nodeType === 1 && n.hasAttribute('data-own');
const swapped = []; // containers whose content switched (tabs, calendar views): animated after the render
function morph(root, html) { tplEl.innerHTML = html; morphKids(root, tplEl.content); }
function swapAnim() {
  const list = swapped.splice(0);
  if (!motionOn()) return;
  for (const el of list) el.animate([{ opacity: 0, transform: 'translate3d(0,10px,0)' }, { opacity: 1, transform: 'none' }], { duration: 420 * mo(), easing: EASE });
}
function sameNode(a, b) {
  if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) return false;
  return a.nodeType !== 1 || keyOf(a) === keyOf(b);
}
function morphKids(parent, next) {
  let a = parent.firstChild, b = next.firstChild;
  while (b) {
    const nb = b.nextSibling;
    while (ownNode(a)) a = a.nextSibling;
    if (!a) parent.appendChild(b);
    else if (sameNode(a, b)) { morphNode(a, b); a = a.nextSibling; }
    else {
      const k = keyOf(b);
      let m = null;
      if (k) for (let s = a.nextSibling; s; s = s.nextSibling) if (s.nodeType === 1 && keyOf(s) === k && s.nodeName === b.nodeName) { m = s; break; }
      if (m) { parent.insertBefore(m, a); morphNode(m, b); }
      else parent.insertBefore(b, a);
    }
    b = nb;
  }
  while (a) { const na = a.nextSibling; if (!ownNode(a)) parent.removeChild(a); a = na; }
}
function morphNode(a, b) {
  if (a.nodeType !== 1) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
  const tag = a.nodeName;
  const lastVal = tag === 'INPUT' ? a.getAttribute('value') ?? '' : null;
  const lastSel = tag === 'SELECT' ? Array.prototype.findIndex.call(a.options, o => o.hasAttribute('selected')) : -1;
  const swap = a.getAttribute('data-swap');
  for (const { name, value } of Array.from(b.attributes)) if (a.getAttribute(name) !== value) a.setAttribute(name, value);
  for (const { name } of Array.from(a.attributes)) {
    if (b.hasAttribute(name)) continue;
    if ((name === 'src' && a.hasAttribute('data-photo')) || (name === 'open' && tag === 'DETAILS')) continue;
    a.removeAttribute(name);
  }
  if (swap !== null && swap !== b.getAttribute('data-swap')) swapped.push(a);
  if (tag === 'INPUT') {
    if (a.type === 'checkbox' || a.type === 'radio') a.checked = b.hasAttribute('checked');
    else { const nv = b.getAttribute('value') ?? ''; if (nv !== lastVal && a.value !== nv) a.value = nv; }
    return;
  }
  if (tag === 'TEXTAREA') { const nv = b.value; if (nv !== a.defaultValue) { a.defaultValue = nv; a.value = nv; } return; }
  if (a.hasAttribute('data-keep')) return;
  morphKids(a, b);
  if (tag === 'SELECT') { const ni = Array.prototype.findIndex.call(b.options, o => o.hasAttribute('selected')); if (ni !== lastSel && ni >= 0) a.selectedIndex = ni; }
}

/* ---------- page transitions: cheap, compositor-only (transform + opacity) ---------- */
const TAB_ORDER = ['today', 'board', 'calendar', 'capture', 'study', 'timetable', 'progress', 'chat', 'prompts', 'settings'];
let navHint = 0, forceEnter = false;
function withTransition(mutate, dir) { navHint = dir || 0; forceEnter = true; mutate(); }
const dirTo = v => { const a = TAB_ORDER.indexOf(state.detail ? 'board' : state.view), b = TAB_ORDER.indexOf(v); return a < 0 || b < 0 ? 0 : Math.sign(b - a); };
const EASE = 'cubic-bezier(.2,.85,.25,1)';
function enterAnim(dir) {
  if (!motionOn()) return;
  const m = mo(), dx = dir > 0 ? 34 : dir < 0 ? -34 : 0;
  Array.from(document.getElementById('view').children).slice(0, 9).forEach((el, i) => {
    el.animate([{ opacity: 0, transform: `translate3d(${dx}px,${dir ? 0 : 12}px,0)` }, { opacity: 1, transform: 'none' }],
      { duration: 520 * m, delay: Math.min(i, 7) * 34 * m, easing: EASE, fill: 'backwards' });
  });
  for (const el of [document.getElementById('tb-title'), document.getElementById('m-title')]) {
    if (el) el.animate([{ opacity: 0, transform: `translate3d(${dx * 0.4}px,4px,0)` }, { opacity: 1, transform: 'none' }], { duration: 380 * m, easing: EASE });
  }
  countUp();
}
/* numbers count up when a page appears */
function countUp() {
  document.querySelectorAll('#view .hero-stats b, #view .stat .big, #view .count-up').forEach(el => {
    const t = el.firstChild;
    if (!t || t.nodeType !== 3) return;
    const to = parseFloat(t.nodeValue);
    if (!Number.isFinite(to) || to <= 0 || to > 99999 || !/^\d+$/.test(t.nodeValue.trim())) return;
    const t0 = performance.now(), dur = 700 * mo();
    const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); t.nodeValue = String(Math.round(to * e)); if (k < 1 && t.isConnected) requestAnimationFrame(step); else t.nodeValue = String(to); };
    t.nodeValue = '0'; requestAnimationFrame(step);
  });
}
function tweenNum(el, to, fmt) {
  const from = +(el.dataset.v || 0); el.dataset.v = to;
  if (!motionOn() || from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 520 * mo();
  const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(Math.round(from + (to - from) * e)); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/* ---------- sliding pills: segmented controls, tab bar, sidebar ---------- */
const pillPos = new Map();
function slideInto(container, active, key, cls) {
  if (!container) return;
  let pill = container.querySelector(':scope > .' + cls);
  if (!pill) { pill = document.createElement('span'); pill.className = cls; pill.setAttribute('aria-hidden', 'true'); pill.setAttribute('data-own', ''); container.prepend(pill); }
  container.classList.add('has-pill');
  if (!active || !active.offsetWidth) { pill.style.opacity = '0'; pillPos.delete(key); return; }
  const to = { x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight };
  const from = pillPos.get(key);
  const set = p => { pill.style.transform = `translate(${p.x}px,${p.y}px)`; pill.style.width = p.w + 'px'; pill.style.height = p.h + 'px'; };
  pill.style.opacity = '1';
  const cur = pill.dataset.at;
  const at = `${to.x},${to.y},${to.w},${to.h}`;
  if (cur === at) return;
  pill.dataset.at = at;
  if (from && cur && motionOn()) set(to); // the pill element persists: its CSS transition slides it
  else if (from && motionOn() && (from.x !== to.x || from.y !== to.y || from.w !== to.w)) { pill.style.transition = 'none'; set(from); void pill.offsetWidth; pill.style.transition = ''; set(to); }
  else { pill.style.transition = 'none'; set(to); void pill.offsetWidth; pill.style.transition = ''; }
  pillPos.set(key, to);
}
function fxAfterRender() {
  document.querySelectorAll('.seg').forEach(seg => {
    const first = seg.querySelector('button');
    const key = 'seg:' + (seg.dataset.seg || (first && first.dataset.act) || 'x');
    slideInto(seg, seg.querySelector('button[aria-pressed="true"]'), key, 'seg-pill');
  });
  slideInto(document.querySelector('.mtab'), document.querySelector('.mt-item[aria-current="page"]'), 'mtab', 'mt-pill');
  const nav = document.getElementById('nav');
  slideInto(nav, nav && nav.querySelector('.nav-item[aria-current="page"]'), 'nav', 'nav-pill');
}

/* ---------- touch ripple on everything you can press ---------- */
const RIPPLE = '.btn,.nav-item,.mt-item,.mt-fab,.opt,.choice,.oxb,.pill-btn,.gi[data-act],.seg button,.scard,.cell[data-act],.nrow,.dayb,.plan-opt,.fin-sw';
document.addEventListener('pointerdown', e => {
  if (!motionOn() || e.button > 0) return;
  const host = e.target.closest && e.target.closest(RIPPLE);
  if (!host || host.disabled) return;
  const r = host.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2.2;
  const wrap = document.createElement('span'); wrap.className = 'rpl-wrap'; wrap.setAttribute('data-own', ''); wrap.setAttribute('aria-hidden', 'true');
  const dot = document.createElement('i'); dot.className = 'rpl';
  dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  wrap.appendChild(dot); host.appendChild(wrap);
  setTimeout(() => wrap.remove(), 700);
}, { passive: true });

/* ---------- bars become floating capsules once the page scrolls ---------- */
let scrollRaf = 0;
function onScrollState() { scrollRaf = 0; document.body.classList.toggle('scrolled', scrollY > 6); }
addEventListener('scroll', () => { if (!scrollRaf) scrollRaf = requestAnimationFrame(onScrollState); }, { passive: true });

/* ---------- confetti (celebrations) ---------- */
function confetti(x, y, n) {
  if (!motionOn()) return;
  const c = document.createElement('canvas'), dpr = Math.min(2, devicePixelRatio || 1);
  c.className = 'confetti'; c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  document.body.appendChild(c);
  const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
  const cs = getComputedStyle(document.documentElement);
  const cols = ['--sun', '--blue', '--orange', '--green'].map(v => cs.getPropertyValue(v).trim()).concat(['#ffffff', '#C7B8F2']);
  const P = Array.from({ length: n || 160 }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1, v = 7 + Math.random() * 11;
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: 6 + Math.random() * 7, h: 9 + Math.random() * 9, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.35, c: cols[Math.floor(Math.random() * cols.length)], round: Math.random() < 0.3 };
  });
  const t0 = performance.now();
  const frame = now => {
    const t = now - t0; ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of P) {
      p.vy += 0.32; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 1800) / 900); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, 7); ctx.fill(); } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 2);
      ctx.restore();
    }
    if (t < 2800) requestAnimationFrame(frame); else c.remove();
  };
  requestAnimationFrame(frame);
}

/* ---------- swipe between tabs (touch) ---------- */
const SWIPE_TABS = ['today', 'board', 'calendar', 'study', 'progress'];
let swipe = null;
document.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch' || sheet) return;
  if (!e.target.closest('#view') || e.target.closest('input,textarea,select,button.ev,.hscroll,.tt-scroll,.mask-stage,.seg,.tbl,.flip,.cmap,.composer')) { swipe = null; return; }
  swipe = { x: e.clientX, y: e.clientY, t: Date.now(), cal: !!e.target.closest('.cal-main') };
}, { passive: true });
document.addEventListener('pointercancel', () => { swipe = null; });
document.addEventListener('pointerup', e => {
  if (!swipe || e.pointerType !== 'touch') return;
  const s = swipe; swipe = null;
  const dx = e.clientX - s.x, dy = e.clientY - s.y;
  if (Date.now() - s.t > 700 || Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
  const dir = dx < 0 ? 1 : -1;
  if (s.cal && state.view === 'calendar' && !state.detail) { withTransition(() => H.calNav(String(dir)), dir); return; }
  if (state.detail) { if (dir < 0) H.back(); return; }
  const i = SWIPE_TABS.indexOf(state.view);
  if (i >= 0 && SWIPE_TABS[i + dir]) setView(SWIPE_TABS[i + dir]);
});

/* ---------- splash ---------- */
function splash() {
  let first = true;
  try { first = !sessionStorage.getItem('sn-splash'); sessionStorage.setItem('sn-splash', '1'); } catch (e) { first = false; } // previews: no storage, no splash
  if (!first || !motionOn()) { document.body.classList.remove('booting'); return; }
  const el = document.createElement('div');
  el.className = 'splash';
  el.innerHTML = `<div class="sp-glow" aria-hidden="true"><i></i><i></i><i></i></div><div class="splash-in">
    <span class="logo sp-logo" style="--s:96px" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#1B2337" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="2.4" fill="#fff"/><path class="sp-path" pathLength="1" d="M8.2 17h6.3a3 3 0 0 0 0-6h-5a3 3 0 0 1 0-6h6.3"/><rect x="16" y="3.4" width="5" height="5" rx="1.4" fill="#1B2337"/></svg></span>
    <b>수행 내비</b><small>공지 사진 한 장으로, 어떻게 · 언제부터</small><span class="sp-bar"><i></i></span></div>`;
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('out'); document.body.classList.remove('booting'); }, 1250);
  setTimeout(() => el.remove(), 2000);
}

/* ---------- appearance settings section ---------- */
function lookSettingsHtml() {
  const L = state.look, mode = L.mode || 'auto';
  const opt = (act, v, cur, title, desc) => `<button class="opt" data-act="${act}" data-arg="${v}" aria-pressed="${cur === v}"><b>${title}</b><small>${desc}</small></button>`;
  const slider = (k, label, lo, hi, unit, note) => `<label class="slider"><span class="sl-top"><b>${label}</b><output id="out-${k}">${L[k]}${unit}</output></span>
    <input type="range" id="look-${k}" data-look="${k}" min="${lo}" max="${hi}" value="${L[k]}" ${L.style === 'simple' && k !== 'round' ? 'disabled' : ''}><small>${note}</small></label>`;
  const modeTile = (k, m) => `<button class="mode-tile" data-act="lookMode" data-arg="${k}" aria-pressed="${mode === k}">
      <span class="mode-pv" style="--pb:${m.pv[0]};--pc:${m.pv[1]};--pi:${m.pv[2]};--ps:${m.pv[3]}" aria-hidden="true"><i class="pv-card"></i><i class="pv-line"></i><i class="pv-line s"></i><i class="pv-bar"><em></em><em></em><em></em></i></span>
      <b>${m.name}</b><small>${m.desc}</small></button>`;
  return `<div class="stack">
    <div><div class="sec-sub">모드</div><div class="mode-row">${Object.entries(MODES).map(([k, m]) => modeTile(k, m)).join('')}</div>
      <div class="group" style="margin-top:10px">${sw2('lookAuto', mode === 'auto', '기기 설정 따라가기', '휴대폰이 다크 모드면 다크, 아니면 화이트로 바뀌어요')}</div></div>
    <div><div class="sec-sub">스타일</div><div class="opts">${opt('lookStyle', 'liquid', L.style, '리퀴드 글라스', '메뉴와 탭 막대가 뒤를 은은하게 비춰요')}${opt('lookStyle', 'simple', L.style, '심플', '투명 효과 없이 또렷한 불투명 디자인')}</div></div>
    <div class="look-wrap">
      <div class="look-preview" aria-hidden="true"><div class="lp-bg"><i></i><i></i><i></i></div>
        <div class="lp-card"><i></i><i></i><i class="s"></i></div>
        <div class="lp-bar glass">${logoMark(22)}<span></span><span></span><span></span></div></div>
      <div class="cell pad stack">
        ${slider('glass', '투명도', 0, 100, '%', '높을수록 유리 뒤가 잘 비쳐요')}
        ${slider('blur', '흐림', 0, 40, 'px', '유리 뒤 배경을 얼마나 흐리게 할지')}
        ${slider('round', '모서리 둥글기', 0, 100, '', '모든 카드와 버튼의 모서리')}
      </div></div>
    <div><div class="sec-sub">움직임</div><div class="seg" data-seg="motion" role="group" aria-label="움직임">${[['smooth', '부드럽게'], ['quick', '빠르게'], ['off', '끄기']].map(([k, l]) => `<button data-act="lookMotion" data-arg="${k}" aria-pressed="${L.motion === k}">${l}</button>`).join('')}</div></div>
    <div class="group">${sw2('lookAmbient', L.ambient, '배경 빛', '유리 뒤에 은은한 색 번짐')}</div>
    ${has('themes') ? `<div><div class="sec-sub">테마 팩</div><div class="opts">${Object.entries(THEMES).map(([k, t]) => `<button class="opt theme-opt" data-act="lookTheme" data-arg="${k}" aria-pressed="${L.theme === k}"><b><i style="background:${t.sun[0]}"></i><i style="background:${t.blue[0]}"></i>${t.name}</b><small>${k === 'sunrise' ? '기본' : '멤버십'}</small></button>`).join('')}</div></div>` : ''}
  </div>`;
}
function sw2(act, on, label, desc) {
  return `<div class="gi"><div style="flex:1;min-width:0"><b>${label}</b>${desc ? `<div class="small faint">${desc}</div>` : ''}</div><button class="sw" role="switch" aria-checked="${!!on}" data-act="${act}" aria-label="${label}"></button></div>`;
}
let lookSaveT = null;
const FX_H = {
  lookStyle(v) { state.look.style = v; applyLook(); save(); render(); },
  lookMode(v) { if (!MODES[v]) return; state.look.mode = v; applyLook(); save(); render(); },
  lookAuto() { state.look.mode = state.look.mode === 'auto' ? effMode() : 'auto'; applyLook(); save(); render(); },
  lookMotion(v) { state.look.motion = v; applyLook(); save(); render(); },
  lookAmbient() { state.look.ambient = !state.look.ambient; applyLook(); save(); render(); },
  lookTheme(v) { if (!has('themes')) return; state.look.theme = v; applyLook(); save(); render(); },
  lookReset() { state.look = { ...DEF_LOOK }; applyLook(); save(); render(); toast('화면 설정을 기본값으로 되돌렸어요'); },
  jump(id) { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: motionOn() ? 'smooth' : 'auto', block: 'start' }); }
};
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.look;
  if (!k) return;
  state.look[k] = +e.target.value;
  const o = document.getElementById('out-' + k);
  if (o) o.textContent = e.target.value + ({ glass: '%', blur: 'px' }[k] || '');
  applyLook();
  clearTimeout(lookSaveT); lookSaveT = setTimeout(save, 300);
});
