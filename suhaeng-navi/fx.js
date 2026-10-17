'use strict';
/* 수행 내비 — look & motion: appearance settings, page transitions, sliding pills and
   segmented thumbs, swipe navigation, the splash, and the logo mark used across the app. */

const LOGO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#1B2337" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="2.4" fill="#fff"/><path d="M8.2 17h6.3a3 3 0 0 0 0-6h-5a3 3 0 0 1 0-6h6.3"/><rect x="16" y="3.4" width="5" height="5" rx="1.4" fill="#1B2337"/></svg>';
const logoMark = (s, cls) => `<span class="logo${cls ? ' ' + cls : ''}" style="--s:${s || 28}px" aria-hidden="true">${LOGO_SVG}</span>`;

const THEMES = {
  sunrise: { name: '선라이즈', sun: ['#F5D560', '#EBC64C'], blue: ['#2F5BD3', '#86A6FF'], blobs: [['#F7D96B', '#F5B79A', '#9EC1F5', '#C7B8F2'], ['#6A5A1C', '#6B3A2A', '#23407A', '#3E3170']] },
  mint: { name: '민트', sun: ['#8FE3C2', '#5FCFA6'], blue: ['#0E8F6A', '#5FD6AE'], blobs: [['#A8EBD0', '#BDE7F5', '#D7F5B8', '#B9D8F7'], ['#1E5A48', '#1F4A5E', '#3D5A23', '#24406A']] },
  sakura: { name: '사쿠라', sun: ['#F7B8CC', '#E88AA8'], blue: ['#C2376D', '#FF8FB6'], blobs: [['#F9C9D8', '#FBD9C4', '#E5C9F5', '#C9DDF7'], ['#6A2A40', '#6A3E2A', '#4E2E6A', '#2A3E6A']] },
  ocean: { name: '오션', sun: ['#9CD3F7', '#6BB8EA'], blue: ['#1F6FD1', '#7DB6FF'], blobs: [['#A9D8F7', '#B9F0EA', '#C4CCF8', '#E2F2FF'], ['#1D4A6A', '#1D5A55', '#2E356A', '#22324A']] }
};
const motionOn = () => state.look.motion !== 'off' && !matchMedia('(prefers-reduced-motion: reduce)').matches;

function applyLook() {
  const L = state.look, r = document.documentElement.style;
  r.setProperty('--glass-a', (L.style === 'simple' ? 0.97 : 0.92 - L.glass * 0.0072).toFixed(3));
  r.setProperty('--blur-px', (L.style === 'simple' ? 0 : L.blur) + 'px');
  r.setProperty('--rk', (0.72 + L.round * 0.0092).toFixed(3));
  r.setProperty('--mo', L.motion === 'quick' ? '.55' : '1');
  document.body.classList.toggle('simple', L.style === 'simple');
  document.body.classList.toggle('motion-off', L.motion === 'off');
  document.body.classList.toggle('no-ambient', !L.ambient || L.style === 'simple');
  const t = THEMES[has('themes') ? L.theme : 'sunrise'] || THEMES.sunrise;
  const vars = i => `--sun:${t.sun[i]};--blue:${t.blue[i]};--blob-1:${t.blobs[i][0]};--blob-2:${t.blobs[i][1]};--blob-3:${t.blobs[i][2]};--blob-4:${t.blobs[i][3]}`;
  let el = document.getElementById('theme-style');
  if (!el) { el = document.createElement('style'); el.id = 'theme-style'; document.head.appendChild(el); }
  el.textContent = `:root{${vars(0)}}@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${vars(1)}}}:root[data-theme="dark"]{${vars(1)}}`;
}

/* ---------- page transitions ---------- */
const TAB_ORDER = ['today', 'board', 'calendar', 'capture', 'study', 'timetable', 'progress', 'chat', 'prompts', 'settings'];
function withTransition(mutate, dir) {
  if (!motionOn()) { mutate(); return; }
  document.documentElement.dataset.vt = dir > 0 ? 'fwd' : dir < 0 ? 'back' : 'fade';
  if (document.startViewTransition) {
    try { document.startViewTransition(() => { mutate(); }); return; } catch (e) { /* fall through */ }
  }
  mutate();
  const v = document.getElementById('view');
  v.classList.remove('vt-in-fwd', 'vt-in-back', 'vt-in-fade');
  void v.offsetWidth;
  v.classList.add('vt-in-' + document.documentElement.dataset.vt);
}
const dirTo = v => { const a = TAB_ORDER.indexOf(state.detail ? 'board' : state.view), b = TAB_ORDER.indexOf(v); return a < 0 || b < 0 ? 0 : Math.sign(b - a); };

/* ---------- sliding pills: segmented controls, tab bar, sidebar ---------- */
const pillPos = new Map();
function slideInto(container, active, key, cls) {
  if (!container) return;
  let pill = container.querySelector(':scope > .' + cls);
  if (!pill) { pill = document.createElement('span'); pill.className = cls; pill.setAttribute('aria-hidden', 'true'); container.prepend(pill); }
  container.classList.add('has-pill');
  if (!active || !active.offsetWidth) { pill.style.opacity = '0'; pillPos.delete(key); return; }
  const to = { x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight };
  const from = pillPos.get(key);
  const set = p => { pill.style.transform = `translate(${p.x}px,${p.y}px)`; pill.style.width = p.w + 'px'; pill.style.height = p.h + 'px'; };
  pill.style.opacity = '1';
  if (from && motionOn() && (from.x !== to.x || from.y !== to.y || from.w !== to.w)) {
    pill.style.transition = 'none'; set(from); void pill.offsetWidth; pill.style.transition = ''; set(to);
  } else { pill.style.transition = 'none'; set(to); void pill.offsetWidth; pill.style.transition = ''; }
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
  try { if (!motionOn() || sessionStorage.getItem('sn-splash')) return; sessionStorage.setItem('sn-splash', '1'); }
  catch (e) { return; } // previews and thumbnails: no storage, no splash
  const el = document.createElement('div');
  el.className = 'splash';
  el.innerHTML = `<div class="splash-in">${logoMark(88)}<b>수행 내비</b><small>공지 사진 한 장으로, 어떻게 · 언제부터</small></div>`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('out'), 950);
  setTimeout(() => el.remove(), 1600);
}

/* ---------- appearance settings section ---------- */
function lookSettingsHtml() {
  const L = state.look;
  const opt = (act, v, cur, title, desc) => `<button class="opt" data-act="${act}" data-arg="${v}" aria-pressed="${cur === v}"><b>${title}</b><small>${desc}</small></button>`;
  const slider = (k, label, lo, hi, unit, note) => `<label class="slider"><span class="sl-top"><b>${label}</b><output id="out-${k}">${L[k]}${unit}</output></span>
    <input type="range" id="look-${k}" data-look="${k}" min="${lo}" max="${hi}" value="${L[k]}" ${L.style === 'simple' && k !== 'round' ? 'disabled' : ''}><small>${note}</small></label>`;
  return `<div class="look-wrap">
    <div class="look-preview" aria-hidden="true"><div class="lp-bg"><i></i><i></i><i></i></div><div class="lp-glass glass">${logoMark(30)}<span><b>수행 내비</b><small>미리 보기</small></span></div></div>
    <div class="stack">
      <div class="opts">${opt('lookStyle', 'liquid', L.style, '리퀴드 글라스', '사이드바와 탭 막대가 뒤를 비춰요')}${opt('lookStyle', 'simple', L.style, '심플', '투명 효과 없이 또렷한 불투명 디자인')}</div>
      <div class="cell pad stack">
        ${slider('glass', '투명도', 0, 100, '%', '높을수록 유리 뒤가 잘 비쳐요')}
        ${slider('blur', '흐림', 0, 40, 'px', '유리 뒤 배경을 얼마나 흐리게 할지')}
        ${slider('round', '모서리 둥글기', 0, 100, '', '모든 카드와 버튼의 모서리')}
      </div>
      <div class="opts">${opt('lookMotion', 'smooth', L.motion, '부드럽게', '탄성 있는 전환과 슬라이딩')}${opt('lookMotion', 'quick', L.motion, '빠르게', '짧고 가벼운 전환')}${opt('lookMotion', 'off', L.motion, '끄기', '움직임 없이 바로')}</div>
      <div class="group">${sw2('lookAmbient', L.ambient, '배경 빛', '유리 뒤에 은은한 색 번짐')}</div>
      ${has('themes') ? `<div><div class="sec-sub">테마 팩</div><div class="opts">${Object.entries(THEMES).map(([k, t]) => `<button class="opt theme-opt" data-act="lookTheme" data-arg="${k}" aria-pressed="${L.theme === k}"><b><i style="background:${t.sun[0]}"></i><i style="background:${t.blue[0]}"></i>${t.name}</b><small>${k === 'sunrise' ? '기본' : '멤버십'}</small></button>`).join('')}</div></div>` : ''}
    </div></div>`;
}
function sw2(act, on, label, desc) {
  return `<div class="gi"><div style="flex:1;min-width:0"><b>${label}</b>${desc ? `<div class="small faint">${desc}</div>` : ''}</div><button class="sw" role="switch" aria-checked="${!!on}" data-act="${act}" aria-label="${label}"></button></div>`;
}
let lookSaveT = null;
const FX_H = {
  lookStyle(v) { state.look.style = v; applyLook(); save(); render(); setupLens(); },
  lookMotion(v) { state.look.motion = v; applyLook(); save(); render(); },
  lookAmbient() { state.look.ambient = !state.look.ambient; applyLook(); save(); render(); },
  lookTheme(v) { if (!has('themes')) return; state.look.theme = v; applyLook(); save(); render(); },
  lookReset() { state.look = { ...DEF_LOOK }; applyLook(); save(); render(); setupLens(); toast('화면 설정을 기본값으로 되돌렸어요'); },
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
