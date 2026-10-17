'use strict';
/* 수행 내비 — icons, shared pieces, app shell and the render loop */

const ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
  board: '<rect x="3.5" y="4" width="7" height="7" rx="2.2"/><rect x="13.5" y="4" width="7" height="7" rx="2.2"/><rect x="3.5" y="14" width="7" height="6" rx="2.2"/><rect x="13.5" y="14" width="7" height="6" rx="2.2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="4"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="9" cy="14.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="14.5" r="1.2" fill="currentColor" stroke="none"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  chart: '<path d="M4 20h16"/><rect x="5.5" y="11" width="3.2" height="6.5" rx="1.4"/><rect x="10.4" y="6.5" width="3.2" height="11" rx="1.4"/><rect x="15.3" y="9" width="3.2" height="8.5" rx="1.4"/>',
  spark: '<path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z"/><path d="M18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M8.5 7.5h7M8.5 11h5"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5l1.6 1.2-1.8 3.2-1.9-.7a7 7 0 0 1-1.8 1l-.3 2h-3.6l-.3-2a7 7 0 0 1-1.8-1l-1.9.7-1.8-3.2 1.6-1.2a7 7 0 0 1 0-3l-1.6-1.2 1.8-3.2 1.9.7a7 7 0 0 1 1.8-1l.3-2h3.6l.3 2a7 7 0 0 1 1.8 1l1.9-.7 1.8 3.2-1.6 1.2a7 7 0 0 1 0 3z"/>',
  camera: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8L10 3.8h4L15.7 6h1.8A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.3" r="3.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5.5 12.5l4.2 4.2 8.8-9.4"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  next: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  flame: '<path d="M12 21c-3.6 0-6.5-2.6-6.5-6.2 0-3.4 2.6-5.3 3.6-8.3.6 1.6 1.6 2.6 2.6 3 .2-2.6 1.6-4.8 3.6-6.5-.2 2.6.8 4.3 2 5.9 1 1.4 1.7 3 1.7 5.6C19 18.4 15.9 21 12 21z"/><path d="M12 21c-1.6 0-2.8-1.2-2.8-2.8 0-1.8 1.6-2.6 2.2-4.2 1.2.9 3.4 2.2 3.4 4.4 0 1.5-1.2 2.6-2.8 2.6z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none"/>',
  route: '<circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="6" r="2.4"/><path d="M8.2 17h6.3a3 3 0 0 0 0-6h-5a3 3 0 0 1 0-6h6.3"/>',
  list: '<path d="M9.5 6.5h10M9.5 12h10M9.5 17.5h10"/><path d="M4 6.5l1 1 2-2M4 12l1 1 2-2M4 17.5l1 1 2-2"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
  chat: '<path d="M5 18.5V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8.5z"/><path d="M9 10.2h6M9 13.2h4"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l.8 12.2A1.8 1.8 0 0 0 9.6 21h4.8a1.8 1.8 0 0 0 1.8-1.8L17 7"/>',
  edit: '<path d="M4.5 19.5l1-4.2L15.8 5a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.7 18.5z"/><path d="M13.5 7.3l3.2 3.2"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17l4.5-4.5 3.5 3.5 2.5-2.5L20 19"/>',
  send: '<path d="M4.5 12.5L19.5 5l-3.7 15-3.6-5.6z"/><path d="M12.2 14.4L19.5 5"/>',
  more: '<circle cx="6" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  flag: '<path d="M6 21V4M6 4.5h10.5l-2 3.8 2 3.7H6"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="3"/><path d="M15.5 8.5V6.5a2.5 2.5 0 0 0-2.5-2.5H6.5A2.5 2.5 0 0 0 4 6.5V13a2.5 2.5 0 0 0 2.5 2.5h2"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2.5"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z"/>'
};
const icon = (n, cls) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${ICONS[n] || ''}</svg>`;
const hueAttr = s => `class="hue" style="--h:${hueOf(s)}"`;
const hueVar = s => `--h:${hueOf(s)}`;
const tile = (s, size) => `<span class="tile hue${size ? ' ' + size : ''}" style="${hueVar(s)}" aria-hidden="true">${esc(String(s || '?').slice(0, 1))}</span>`;
const tag = s => `<span class="tag hue" style="${hueVar(s)}">${esc(s)}</span>`;
function ddayBadge(a) {
  if (!a.due) return '';
  const allDone = a.steps.length && a.steps.every(s => s.done);
  const n = diffDays(today(), a.due);
  const cls = allDone ? 'done' : n < 0 ? '' : n <= 3 ? 'hot' : n <= 7 ? 'warm' : '';
  return `<span class="dday ${cls}">${allDone ? '완료' : dday(a.due)}</span>`;
}
function ring(pct, subject, label) {
  const r = 15, c = 2 * Math.PI * r, off = c * (1 - clamp(pct, 0, 1));
  return `<svg class="ring hue" style="${hueVar(subject)}" viewBox="0 0 38 38" role="img" aria-label="${esc(label || Math.round(pct * 100) + '%')}"><circle class="bg" cx="19" cy="19" r="${r}"/><circle class="fg" cx="19" cy="19" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/><text x="19" y="23" text-anchor="middle">${Math.round(pct * 100)}</text></svg>`;
}
const BUSY_LABEL = { read: 'AI가 공지를 읽는 중', rubric: '채점 기준을 푸는 중', steps: '단계를 나누는 중', coach: '답을 쓰는 중', chat: '답을 쓰는 중', cheer: '응원 메시지를 쓰는 중', timetable: '시간표를 읽는 중' };
const busyRow = key => busy[key]
  ? `<div class="busy"><span class="spin" aria-hidden="true"></span><span>${BUSY_LABEL[key.split(':')[0]]} · <span class="num" data-elapsed="${esc(key)}">0</span>초</span><button class="btn btn-line btn-sm" data-act="stop" data-arg="${esc(key)}">${icon('stop')}멈추기</button></div>` : '';
const errRow = key => (errors[key] ? `<p class="err">${esc(errors[key])}</p>` : '');
const aiNote = () => (aiReady() ? '' : `<p class="small faint">${esc(aiOffText())}</p>`);
function aiBtn(key, label, act, arg, cls, ico) {
  if (busy[key]) return '';
  return `<button class="btn ${cls || 'btn-pri'}" data-act="${act}" data-arg="${esc(arg || '')}" ${aiReady() ? '' : 'disabled'}>${icon(ico || 'spark')}${label}</button>`;
}
const progressOf = a => (a.steps.length ? a.steps.filter(s => s.done).length / a.steps.length : 0);
function checklistCount(a) {
  if (!a.checklist) return null;
  let total = 0, done = 0;
  a.checklist.criteria.forEach((c, i) => c.checks.forEach((x, j) => { total++; if (a.checked[`c${i}-${j}`]) done++; }));
  a.checklist.beforeSubmit.forEach((x, j) => { total++; if (a.checked[`b${j}`]) done++; });
  return { total, done };
}
const emptyArt = () => `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="12" width="44" height="42" rx="6" fill="var(--sun)" transform="rotate(-5 32 33)"/><circle cx="25" cy="32" r="2.6" fill="#3a2e00"/><circle cx="39" cy="31" r="2.6" fill="#3a2e00"/><path d="M26 40c3 2.4 9 2.4 12-.4" stroke="#3a2e00" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;

function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 3400);
}

/* ---------- shell ---------- */
const NAV = [
  { group: '수행', items: [{ id: 'today', label: '오늘', icon: 'sun', h: 44 }, { id: 'board', label: '수행 보드', icon: 'board', h: 214 }, { id: 'calendar', label: '캘린더', icon: 'calendar', h: 4 }] },
  { group: '내 정보', items: [{ id: 'timetable', label: '시간표', icon: 'clock', h: 262 }, { id: 'progress', label: '진행 기록', icon: 'chart', h: 330 }] },
  { group: 'AI', items: [{ id: 'chat', label: '내비에게 묻기', icon: 'spark', h: 28 }, { id: 'prompts', label: '프롬프트', icon: 'book', h: 196 }] }
];
function navBadge(id) {
  const t = today();
  if (id === 'today') { const n = skippedToday() ? 0 : allBlocks().filter(b => b.date === t).length; return n ? `<span class="ni-badge">${n}</span>` : ''; }
  if (id === 'board') { const n = state.cards.filter(a => a.due && diffDays(t, a.due) >= 0).length; return n ? `<span class="ni-badge">${n}</span>` : ''; }
  if (id === 'calendar') return crunchWeeks().length ? '<span class="ni-badge hot" title="몰림 경보">!</span>' : '';
  return '';
}
const railOn = () => innerWidth >= 861 && (state.rail || innerWidth < 1200);
const currentNav = () => (state.detail ? 'board' : state.view);
function renderShell() {
  const cur = currentNav();
  const rail = railOn();
  document.body.classList.toggle('rail', rail);
  $('#nav').innerHTML = NAV.map(g => `<div class="nav-group"><div class="nav-label">${g.group}</div>${g.items.map(it =>
    `<button class="nav-item" data-act="go" data-arg="${it.id}" ${cur === it.id ? 'aria-current="page"' : ''} title="${it.label}"><span class="ni-ico hue" style="--h:${it.h}">${icon(it.icon)}</span><span class="ni-text">${it.label}</span>${navBadge(it.id)}</button>`).join('')}</div>`).join('');
  const pill = { pending: 'AI 확인 중', ready: 'AI 연결됨', off: 'AI 없음 · 예시 모드', denied: 'AI 꺼짐' }[aiState];
  $('#side-foot').innerHTML = `<div class="row-sb side-meta"><span class="ai-pill ${aiState}" title="${pill}"><i></i><span class="ap-t">${pill}</span></span>${innerWidth >= 1200 ? `<button class="btn btn-soft btn-icon btn-sm" data-act="railToggle" aria-label="${rail ? '사이드바 펼치기' : '사이드바 접기'}" title="${rail ? '펼치기' : '접기'}">${icon(rail ? 'next' : 'back')}</button>` : ''}</div>
    <button class="me" data-act="go" data-arg="settings" ${cur === 'settings' ? 'aria-current="page"' : ''} title="나의 설정"><span class="avatar">${esc((state.settings.name || '나').slice(0, 1))}</span><span class="me-t"><b>${esc(state.settings.name || '나')}</b><small>${esc(state.settings.grade || '나의 설정')}</small></span>${icon('gear')}</button>`;
  document.querySelectorAll('.mt-item').forEach(b => {
    const on = b.dataset.arg === cur || (b.dataset.arg === 'more' && !['today', 'board', 'calendar', 'capture'].includes(cur));
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  $('#tb-bell').innerHTML = bellBtn(false);
  $('#m-bell').innerHTML = bellBtn(true);
}

/* ---------- sheets (glass, modal) ---------- */
let sheet = null, lastSheet = null;
const SHEETS = {
  more() {
    const items = [...NAV[1].items, ...NAV[2].items, { id: 'settings', label: '나의 설정', icon: 'gear', h: 220 }];
    const pill = { pending: 'AI 확인 중', ready: 'AI 연결됨', off: 'AI 없음 · 예시 모드', denied: 'AI 꺼짐' }[aiState];
    return { html: `<div class="sheet-h"><h3>더 보기</h3><button class="btn btn-soft btn-icon btn-sm" data-act="closeSheet" aria-label="닫기">${icon('x')}</button></div>
      <div class="stack-s">${items.map(it => `<button class="nav-item" data-act="go" data-arg="${it.id}"><span class="ni-ico hue" style="--h:${it.h}">${icon(it.icon)}</span><span class="ni-text">${it.label}</span>${icon('next')}</button>`).join('')}</div>
      <span class="ai-pill ${aiState}"><i></i>${pill}</span>` };
  },
  photo(sh) {
    return { cls: 'wide', html: `<div class="sheet-h"><h3>원본 공지 사진</h3><button class="btn btn-soft btn-icon btn-sm" data-act="closeSheet" aria-label="닫기">${icon('x')}</button></div>
      <div class="lightbox"><img data-photo="${esc(sh.id)}" alt="개인정보를 가린 공지 사진"></div><p class="small faint">이름과 학번은 저장하기 전에 가렸어요. 사진은 이 기기에만 있어요.</p>` };
  }
};
function renderSheet() {
  const root = $('#sheet-root');
  if (!sheet || !SHEETS[sheet.kind]) { root.innerHTML = ''; lastSheet = null; return; }
  const r = SHEETS[sheet.kind](sheet);
  const still = lastSheet === sheet.kind ? ' still' : '';
  lastSheet = sheet.kind;
  if (r.pop && innerWidth >= 700 && sheet.x != null) {
    const w = Math.min(360, innerWidth - 24);
    const x = sheet.x + 14 + w > innerWidth - 12 ? Math.max(12, sheet.x - w - 14) : sheet.x + 14;
    root.innerHTML = `<div class="scrim clear${still}" data-act="scrim"><div class="pop glass${still}" role="dialog" aria-modal="true" style="left:${x}px;top:${Math.max(12, sheet.y - 40)}px;width:${w}px">${r.html}</div></div>`;
    const p = root.querySelector('.pop'), rect = p.getBoundingClientRect();
    if (rect.bottom > innerHeight - 12) p.style.top = Math.max(12, innerHeight - 12 - rect.height) + 'px';
    return;
  }
  const side = r.side && innerWidth >= 861;
  root.innerHTML = `<div class="scrim${side ? ' right' : ''}${still}" data-act="scrim"><div class="sheet glass${side ? ' side-panel' : r.cls ? ' ' + r.cls : ''}${still}" role="dialog" aria-modal="true">${r.html}</div></div>`;
}

/* ---------- render loop ---------- */
function hydratePhotos() {
  document.querySelectorAll('img[data-photo]:not([src])').forEach(img => {
    PhotoStore.url(img.dataset.photo).then(u => { if (u) img.src = u; else img.closest('.photo-btn')?.remove(); });
  });
}
function render() {
  const active = document.activeElement;
  const focusId = active && active.id ? active.id : null;
  const sel = focusId && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;

  PLANS = buildPlans();
  if (state.detail && !find(state.detail)) state.detail = null;
  const v = state.detail ? viewDetail(find(state.detail)) : (VIEWS[state.view] || VIEWS.today)();
  $('#view').innerHTML = v.body;
  $('#tb-title').innerHTML = `<h1>${v.title}</h1>${v.sub ? `<p>${v.sub}</p>` : ''}`;
  $('#tb-actions').innerHTML = v.actions || '';
  $('#m-title').innerHTML = v.title;
  document.body.classList.toggle('solid', !!state.settings.solid);
  renderShell();
  renderSheet();
  hydratePhotos();
  if (v.after) v.after();

  if (focusId) {
    const el = document.getElementById(focusId);
    if (el && el !== document.activeElement) {
      el.focus({ preventScroll: true });
      if (sel && 'setSelectionRange' in el) { try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* not a text field */ } }
    }
  }
}
