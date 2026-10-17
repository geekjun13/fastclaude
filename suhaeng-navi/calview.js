'use strict';
/* 수행 내비 — 캘린더 화면: 일 · 주 · 월 · 년 · 목록, mini month, calendar list,
   item popover, event editor, quick add */

const narrowCal = () => innerWidth < 700;
const effView = () => (state.cal.view === 'week' && narrowCal() ? 'day' : state.cal.view);
const HH = () => (narrowCal() ? 46 : 52);
let calScroll = null;      // remembered scrollTop of the time grid
let evDraft = null;        // event being created or edited
const monthStart = d => d.slice(0, 8) + '01';
const addMonths = (d, n) => { const b = parseYmd(d), dt = new Date(b.getFullYear(), b.getMonth() + n, 1); const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate(); return ymd(new Date(dt.getFullYear(), dt.getMonth(), Math.min(b.getDate(), last))); };
const ymLabel = d => { const b = parseYmd(d); return `${b.getFullYear()}년 ${b.getMonth() + 1}월`; };
const timeLabel = it => (it.allDay ? '하루 종일' : `${hm(it.start)} – ${hm(it.end)}`);

function calTitle() {
  const v = effView(), d = state.cal.date;
  if (state.cal.q) return `“${esc(state.cal.q)}” 검색`;
  if (v === 'day') { const b = parseYmd(d); return `${b.getMonth() + 1}월 ${b.getDate()}일 <span class="faint">${WD[b.getDay()]}요일</span>`; }
  if (v === 'week') { const m = mondayOf(d), e = addDays(m, 6), a = parseYmd(m), b = parseYmd(e); return a.getMonth() === b.getMonth() ? ymLabel(m) : `${a.getFullYear()}년 ${a.getMonth() + 1}월 – ${b.getMonth() + 1}월`; }
  if (v === 'year') return `${parseYmd(d).getFullYear()}년`;
  if (v === 'list') return '다가오는 일정';
  return ymLabel(d);
}
function countsFor(from, to) {
  const c = {};
  for (const it of itemsFor(from, to, { foreground: true })) {
    for (let d = it.date; diffDays(d, it.endDate || it.date) >= 0; d = addDays(d, 1)) c[d] = (c[d] || 0) + 1;
  }
  return c;
}

/* ---------- side pieces ---------- */
function miniMonth() {
  const d = state.cal.date, first = monthStart(d), start = mondayOf(first), t = today();
  const counts = countsFor(start, addDays(start, 41));
  const mo = parseYmd(first).getMonth();
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const x = addDays(start, i), out = parseYmd(x).getMonth() !== mo;
    cells += `<button class="mm-d${out ? ' out' : ''}${x === t ? ' today' : ''}${x === d ? ' sel' : ''}" data-act="calPick" data-arg="${x}" aria-label="${mdMid(x)}">${parseYmd(x).getDate()}${counts[x] ? '<i></i>' : ''}</button>`;
  }
  return `<div class="mm"><div class="mm-h"><b>${ymLabel(d)}</b><span class="row"><button class="btn btn-soft btn-icon btn-sm" data-act="calMini" data-arg="-1" aria-label="이전 달">${icon('back')}</button><button class="btn btn-soft btn-icon btn-sm" data-act="calMini" data-arg="1" aria-label="다음 달">${icon('next')}</button></span></div>
    <div class="mm-g">${['월', '화', '수', '목', '금', '토', '일'].map(w => `<span class="mm-w">${w}</span>`).join('')}${cells}</div></div>`;
}
function calList() {
  return `<div class="cl"><div class="cl-h"><b>캘린더</b><button class="btn btn-soft btn-sm" data-act="calNew">${icon('plus')}추가</button></div>
    ${state.calendars.map(c => `<div class="cl-row hue" style="--h:${c.h}">
      <button class="cl-tog" data-act="calToggle" data-arg="${c.id}" role="switch" aria-checked="${c.visible}" aria-label="${esc(c.name)} 보이기"></button>
      <span class="cl-name"><b>${esc(c.name)}</b>${c.desc ? `<small>${esc(c.desc)}</small>` : ''}</span>
      ${c.system || c.id === 'personal' ? '' : `<button class="btn btn-soft btn-icon btn-sm" data-act="calDel" data-arg="${c.id}" aria-label="${esc(c.name)} 삭제" title="${confirmKey === 'cal:' + c.id ? '한 번 더 누르면 삭제' : '삭제'}">${confirmKey === 'cal:' + c.id ? icon('check') : icon('trash')}</button>`}
    </div>`).join('')}</div>`;
}

/* ---------- time grid (day + week) ---------- */
function blockHtml(it, hh) {
  const top = it.start / 60 * hh, h = Math.max(20, (it.end - it.start) / 60 * hh - 2);
  const w = 100 / it.cols, left = it.col * w, short = h < 40;
  const past = diffDays(it.date, today()) > 0 || (it.date === today() && it.end <= nowMin());
  const travel = it.travel ? `<span class="ev-travel" style="top:${(it.start - it.travel) / 60 * hh}px;height:${it.travel / 60 * hh}px;left:calc(${left}% + 2px);width:calc(${w}% - 4px)">${it.travel >= 20 ? `이동 ${it.travel}분` : ''}</span>` : '';
  return `${travel}<button class="ev k-${it.kind} hue${short ? ' short' : ''}${past ? ' past' : ''}" style="--h:${it.h};top:${top}px;height:${h}px;left:calc(${left}% + 2px);width:calc(${w}% - 4px)" data-act="calItem" data-arg="${esc(it.key)}|${it.date}" title="${esc(it.title)} ${hm(it.start)}–${hm(it.end)}">
    <b>${esc(it.title)}</b><span class="t">${hm(it.start)}${short ? '' : ' – ' + hm(it.end)}</span>${!short && it.sub ? `<small>${esc(it.sub)}</small>` : ''}</button>`;
}
function allDayChip(it) {
  return `<button class="adc k-${it.kind} hue" style="--h:${it.h}" data-act="calItem" data-arg="${esc(it.key)}|${it.date}">${it.kind === 'due' ? icon('flag') : ''}<span>${esc(it.title)}${it.kind === 'due' ? ` · ${esc(it.sub)}` : ''}</span></button>`;
}
function timeGrid(days) {
  const t = today(), hh = HH(), items = itemsFor(days[0], days[days.length - 1]);
  const head = days.map(d => { const b = parseYmd(d); return `<button class="tg-day${d === t ? ' today' : ''}${isWeekend(d) ? ' we' : ''}${d === state.cal.date && days.length > 1 ? ' sel' : ''}" data-act="calOpenDay" data-arg="${d}"><small>${WD[b.getDay()]}</small><b>${b.getDate()}</b></button>`; }).join('');
  const allday = days.map(d => {
    const list = items.filter(i => i.allDay && diffDays(i.date, d) >= 0 && diffDays(d, i.endDate || i.date) >= 0);
    return `<div class="tg-ad">${list.map(allDayChip).join('')}</div>`;
  }).join('');
  let axis = '';
  const nm = days.includes(t) ? nowMin() : -999;
  for (let h = 1; h < 24; h++) if (Math.abs(h * 60 - nm) > 14) axis += `<span style="top:${h * hh}px">${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시</span>`;
  const cols = days.map(d => {
    const laid = layoutDay(items.filter(i => i.date === d && !i.allDay));
    const now = d === t ? `<div class="now" style="top:${nowMin() / 60 * hh}px"><i></i></div>` : '';
    return `<div class="tg-col${d === t ? ' today' : ''}${isWeekend(d) ? ' we' : ''}" data-act="calSlot" data-arg="${d}">${laid.map(it => blockHtml(it, hh)).join('')}${now}</div>`;
  }).join('');
  const nowLbl = days.includes(t) ? `<em class="now-lbl" style="top:${nowMin() / 60 * hh}px">${hm(nowMin())}</em>` : '';
  const hasAllDay = items.some(i => i.allDay);
  return `<div class="tg-scroll" id="tg-scroll" style="--hh:${hh}px;--cols:${days.length}">
    <div class="tg-top">${days.length > 1 ? `<div class="tg-row"><span class="tg-corner"></span>${head}</div>` : ''}
      <div class="tg-row tg-adrow${hasAllDay ? '' : ' empty'}"><span class="tg-adl">종일</span>${allday}</div></div>
    <div class="tg-row tg-body"><div class="tg-axis">${axis}${nowLbl}</div>${cols}</div></div>`;
}
function weekStrip() {
  const d = state.cal.date, m = mondayOf(d), t = today(), counts = countsFor(m, addDays(m, 6));
  let html = '';
  for (let i = 0; i < 7; i++) {
    const x = addDays(m, i), b = parseYmd(x);
    html += `<button class="ws-d${x === t ? ' today' : ''}${x === d ? ' sel' : ''}" data-act="calPick" data-arg="${x}"><small>${WD[b.getDay()]}</small><b>${b.getDate()}</b><i${counts[x] ? '' : ' class="none"'}></i></button>`;
  }
  return `<div class="ws">${html}</div>`;
}
function dayAgenda(d) {
  const list = itemsFor(d, d).filter(i => i.kind !== 'school').sort(itemSort);
  const sc = schoolOn(d);
  return `<div class="ag"><div class="ag-h"><b>${mdLong(d)}</b>${sc.length && calVisible('school') ? `<span class="chip">${icon('board')}수업 ${sc.length}교시 · ~${hm(sc[sc.length - 1].end)}</span>` : ''}</div>
    ${list.length ? list.map(agRow).join('') : '<p class="small faint" style="padding:6px 2px">일정이 없어요.</p>'}</div>`;
}
function agRow(it) {
  return `<button class="ag-row hue" style="--h:${it.h}" data-act="calItem" data-arg="${esc(it.key)}|${it.date}"><span class="ag-t">${it.allDay ? '종일' : `${hm(it.start)}<small>${hm(it.end)}</small>`}</span><i class="ag-bar"></i><span class="ag-c"><b>${esc(it.title)}</b><small>${esc([it.sub, calOf(it.cal).name].filter(Boolean).join(' · '))}</small></span></button>`;
}

/* ---------- month, year, list ---------- */
function monthView() {
  const d = state.cal.date, first = monthStart(d), start = mondayOf(first), t = today();
  const mo = parseYmd(first).getMonth();
  const lastDay = ymd(new Date(parseYmd(first).getFullYear(), mo + 1, 0));
  const weeks = Math.ceil((diffDays(start, lastDay) + 1) / 7), end = addDays(start, weeks * 7 - 1);
  const items = itemsFor(start, end, { foreground: true }).sort(itemSort);
  const byDay = {};
  for (const it of items) for (let x = it.date; diffDays(x, it.endDate || it.date) >= 0; x = addDays(x, 1)) (byDay[x] = byDay[x] || []).push(it);
  let cells = '';
  for (let i = 0; i < weeks * 7; i++) {
    const x = addDays(start, i), b = parseYmd(x), list = byDay[x] || [], out = b.getMonth() !== mo;
    cells += `<div class="mv-cell${out ? ' out' : ''}${x === t ? ' today' : ''}${x === d ? ' sel' : ''}${isWeekend(x) ? ' we' : ''}" data-act="calPick" data-arg="${x}" data-day="${x}">
      <span class="mv-n">${b.getDate() === 1 ? `${b.getMonth() + 1}월 ` : ''}${b.getDate()}</span>
      <div class="mv-list">${list.slice(0, 3).map(it => it.allDay
        ? `<span class="mv-chip k-${it.kind} hue" style="--h:${it.h}">${esc(it.title)}${it.kind === 'due' ? ' · ' + esc(it.sub) : ''}</span>`
        : `<span class="mv-ev hue" style="--h:${it.h}"><i></i><em>${hm(it.start)}</em>${esc(it.title)}</span>`).join('')}${list.length > 3 ? `<span class="mv-more">+${list.length - 3}개</span>` : ''}</div>
      <div class="mv-dots">${list.slice(0, 4).map(it => `<i class="hue" style="--h:${it.h}"></i>`).join('')}</div></div>`;
  }
  return `<div class="mv" style="--weeks:${weeks}"><div class="mv-head">${['월', '화', '수', '목', '금', '토', '일'].map((w, i) => `<span${i > 4 ? ' class="we"' : ''}>${w}</span>`).join('')}</div><div class="mv-grid">${cells}</div></div>
    ${dayAgenda(d)}`;
}
function yearView() {
  const y = parseYmd(state.cal.date).getFullYear(), t = today();
  const counts = countsFor(`${y}-01-01`, `${y}-12-31`);
  let html = '';
  for (let m = 0; m < 12; m++) {
    const first = ymd(new Date(y, m, 1)), lead = (dow(first) + 6) % 7, n = new Date(y, m + 1, 0).getDate();
    let cells = '<span></span>'.repeat(lead);
    for (let dd = 1; dd <= n; dd++) {
      const x = ymd(new Date(y, m, dd)), c = counts[x] || 0;
      cells += `<button class="yv-d${x === t ? ' today' : ''}${c ? ' has' : ''}" style="--c:${Math.min(c, 4)}" data-act="calOpenDay" data-arg="${x}" aria-label="${mdMid(x)} 일정 ${c}개">${dd}</button>`;
    }
    html += `<div class="yv-m cell"><button class="yv-h${parseYmd(t).getFullYear() === y && parseYmd(t).getMonth() === m ? ' cur' : ''}" data-act="calMonth" data-arg="${first}">${m + 1}월</button><div class="yv-g">${['월', '화', '수', '목', '금', '토', '일'].map(w => `<span class="yv-w">${w}</span>`).join('')}${cells}</div></div>`;
  }
  return `<div class="yv">${html}</div>`;
}
function listView() {
  const q = state.cal.q.trim().toLowerCase(), t = today();
  let items;
  if (q) {
    items = itemsFor(addDays(t, -90), addDays(t, 365), { foreground: true })
      .filter(i => [i.title, i.sub, i.ev && i.ev.location, i.ev && i.ev.notes].join(' ').toLowerCase().includes(q)).sort(itemSort).slice(0, 120);
  } else items = itemsFor(state.cal.date, addDays(state.cal.date, 44), { foreground: true }).sort(itemSort);
  if (!items.length) return `<div class="cell dash empty">${emptyArt()}<b>${q ? '찾는 일정이 없어요' : '앞으로 45일 동안 일정이 없어요'}</b><button class="btn btn-pri btn-sm" data-act="newEvent">${icon('plus')}새 일정</button></div>`;
  const groups = [];
  for (const it of items) { let g = groups[groups.length - 1]; if (!g || g.d !== it.date) groups.push(g = { d: it.date, items: [] }); g.items.push(it); }
  return `<div class="lv">${groups.map(g => `<section class="lv-day"><h3 class="lv-h${g.d === t ? ' today' : ''}">${mdLong(g.d)}${g.d === t ? ' <span class="chip navy">오늘</span>' : ''}</h3><div class="group">${g.items.map(agRow).join('')}</div></section>`).join('')}</div>`;
}

/* ---------- the page ---------- */
function viewCalendar() {
  const v = effView(), seg = (k, l) => `<button data-act="calView" data-arg="${k}" aria-pressed="${v === k}">${l}</button>`;
  const qp = calQuickPreview();
  let body;
  if (state.cal.q) body = listView();
  else if (v === 'day') body = `${weekStrip()}<div class="dv"><div>${timeGrid([state.cal.date])}</div><aside class="dv-side">${dayAgenda(state.cal.date)}</aside></div>`;
  else if (v === 'week') { const m = mondayOf(state.cal.date); body = timeGrid(daysInRange(m, addDays(m, 6))); }
  else if (v === 'month') body = monthView();
  else if (v === 'year') body = yearView();
  else body = listView();
  return {
    title: '캘린더', sub: calTitle().replace(/<[^>]+>/g, ''),
    actions: `<button class="btn btn-pri btn-sm" data-act="newEvent">${icon('plus')}새 일정</button>`,
    body: `<div class="cal">
      <aside class="cal-side">${miniMonth()}${calList()}</aside>
      <section class="cal-main">
        <div class="cal-bar">
          <div class="row cal-nav"><button class="btn btn-soft btn-icon btn-sm" data-act="calNav" data-arg="-1" aria-label="이전">${icon('back')}</button><button class="btn btn-soft btn-sm" data-act="calNav" data-arg="0">오늘</button><button class="btn btn-soft btn-icon btn-sm" data-act="calNav" data-arg="1" aria-label="다음">${icon('next')}</button><h2 class="cal-title">${calTitle()}</h2></div>
          <div class="row cal-tools"><div class="seg" role="group" aria-label="보기">${seg('day', '일')}${narrowCal() ? '' : seg('week', '주')}${seg('month', '월')}${seg('year', '년')}${seg('list', '목록')}</div>
            <label class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg><input id="cal-q" data-bind="calQ" placeholder="검색" value="${esc(state.cal.q)}" aria-label="일정 검색"></label>
            <button class="btn btn-soft btn-icon btn-sm cal-panel-btn" data-act="calPanel" aria-label="캘린더 목록">${icon('list')}</button></div>
        </div>
        <div class="quick"><span class="q-ico">${icon('spark')}</span><input id="quick-in" data-bind="quick" placeholder="빠른 추가 · 예: 내일 오후 4시 치과 1시간" value="${esc(quickText)}" aria-label="빠른 추가"><span class="q-prev" id="q-prev">${qp}</span><button class="btn btn-pri btn-sm" data-act="quickAdd">추가</button></div>
        <div class="swap" data-swap="${v}:${state.cal.date}">${body}</div>
      </section></div>`,
    after() {
      const sc = document.getElementById('tg-scroll');
      if (!sc) return;
      if (calScroll == null) {
        const hh = HH(), t = today(), days = v === 'day' ? [state.cal.date] : daysInRange(mondayOf(state.cal.date), addDays(mondayOf(state.cal.date), 6));
        const target = days.includes(t) ? Math.max(0, nowMin() - 90) : 7 * 60;
        calScroll = Math.round(target / 60 * hh);
      }
      sc.scrollTop = calScroll;
      sc.onscroll = () => { calScroll = sc.scrollTop; };
    }
  };
}
let quickText = '';
function calQuickPreview() {
  if (!quickText.trim()) return '';
  const p = parseQuick(quickText, state.cal.date || today());
  return `${md(p.date)} ${p.allDay ? '종일' : `${hm(p.start)}–${hm(p.end)}`} · ${esc(p.title)}${p.repeat !== 'none' ? ' · ' + REPEAT[p.repeat] : ''}`;
}

/* ---------- popover + editor sheets ---------- */
function itemSheet(sh) {
  const it = findItem(sh.key, sh.date);
  if (!it) return { html: '<p class="small faint">이 일정을 찾을 수 없어요.</p><div class="row-end"><button class="btn btn-soft btn-sm" data-act="closeSheet">닫기</button></div>' };
  const head = `<div class="ip-h hue" style="--h:${it.h}"><i class="ip-dot"></i><div style="flex:1;min-width:0"><b>${esc(it.title)}</b><small>${esc(calOf(it.cal).name)}</small></div><button class="btn btn-soft btn-icon btn-sm" data-act="closeSheet" aria-label="닫기">${icon('x')}</button></div>`;
  const rows = [`<div class="ip-r">${icon('clock')}<span>${mdMid(it.date)}${it.endDate && it.endDate !== it.date ? ` – ${mdMid(it.endDate)}` : ''}<br><b>${timeLabel(it)}</b>${it.kind === 'due' && it.dueTime ? ` · ${esc(it.dueTime)}` : ''}</span></div>`];
  let actions = '';
  if (it.kind === 'event') {
    const ev = it.ev;
    if (repeatText(ev)) rows.push(`<div class="ip-r">${icon('route')}<span>${esc(repeatText(ev))}</span></div>`);
    if (ev.location) rows.push(`<div class="ip-r">${icon('flag')}<span>${esc(ev.location)}${ev.travel ? ` · 이동 ${ev.travel}분` : ''}</span></div>`);
    if ((ev.alerts || []).length) rows.push(`<div class="ip-r">${icon('bell')}<span>${ev.alerts.map(alertText).join(', ')}</span></div>`);
    if (ev.notes) rows.push(`<div class="ip-r">${icon('edit')}<span>${esc(ev.notes)}</span></div>`);
    const rep = ev.repeat && ev.repeat.freq !== 'none';
    actions = `<button class="btn btn-pri btn-sm" data-act="evEdit" data-arg="${esc(ev.id)}|${it.date}">${icon('edit')}편집</button>`
      + (rep ? `<button class="btn btn-danger btn-sm" data-act="evDelete" data-arg="one|${esc(ev.id)}|${it.date}">이 일정만 삭제</button><button class="btn btn-danger btn-sm" data-act="evDelete" data-arg="all|${esc(ev.id)}|${it.date}">${confirmKey === 'evall:' + ev.id ? '한 번 더 누르면 삭제' : '모든 반복 삭제'}</button>`
        : `<button class="btn btn-danger btn-sm" data-act="evDelete" data-arg="all|${esc(ev.id)}|${it.date}">${confirmKey === 'evall:' + ev.id ? '한 번 더 누르면 삭제' : '삭제'}</button>`);
  } else if (it.kind === 'plan') {
    rows.push(`<div class="ip-r">${icon('board')}<span>${esc(it.sub)}</span></div>`, `<div class="ip-r">${icon('check')}<span>완료 기준 · ${esc(it.check || '')}</span></div>`);
    actions = `<button class="btn btn-pri btn-sm" data-act="itemDone" data-arg="${it.aid}:${it.step}">${icon('check')}다 했어요</button><button class="btn btn-line btn-sm" data-act="openPlan" data-arg="${it.aid}">수행 카드 열기</button>`;
  } else if (it.kind === 'due') {
    const a = find(it.aid);
    rows.push(`<div class="ip-r">${icon('board')}<span>${esc(it.sub)}<br><span class="faint">${a ? esc(a.method || '') : ''}</span></span></div>`);
    actions = `<span class="dday ${diffDays(today(), it.date) <= 3 ? 'hot' : ''}">${dday(it.date)}</span><button class="btn btn-pri btn-sm" data-act="open" data-arg="${it.aid}">수행 카드 열기</button>`;
  } else {
    if (it.travel) rows.push(`<div class="ip-r">${icon('route')}<span>앞뒤 이동 ${it.travel}분은 계획에서 비워 둬요</span></div>`);
    actions = `<button class="btn btn-line btn-sm" data-act="go" data-arg="timetable">${icon('clock')}시간표 편집</button>`;
  }
  return { html: `${head}<div class="ip-body">${rows.join('')}</div><div class="row-end ip-act">${actions}</div>`, pop: true };
}
function draftFrom(ev, occDate) {
  return { id: ev.id, occDate, title: ev.title, location: ev.location || '', allDay: !!ev.allDay, date: ev.date, endDate: ev.endDate || ev.date,
           start: ev.start == null ? 540 : ev.start, end: ev.end == null ? 600 : ev.end, freq: (ev.repeat && ev.repeat.freq) || 'none', until: (ev.repeat && ev.repeat.until) || '',
           cal: ev.cal, travel: ev.travel || 0, a1: (ev.alerts || [])[0] ?? -1, a2: (ev.alerts || [])[1] ?? -1, notes: ev.notes || '', err: null };
}
function newDraft(date, start, end, extra) {
  const s = start == null ? Math.min(1380, (Math.floor(nowMin() / 60) + 1) * 60) : start;
  return { id: null, title: '', location: '', allDay: false, date, endDate: date, start: s, end: end == null ? Math.min(1439, s + 60) : end,
           freq: 'none', until: '', cal: 'personal', travel: 0, a1: 10, a2: -1, notes: '', err: null, ...(extra || {}) };
}
function eventSheet() {
  const f = evDraft;
  if (!f) return { html: '' };
  const opt = (list, cur) => list.map(([v, l]) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${l}</option>`).join('');
  const userCals = state.calendars.filter(c => !c.system);
  return { html: `
    <div class="sheet-h"><button class="btn btn-soft btn-sm" data-act="closeSheet">취소</button><h3>${f.id ? '일정 편집' : '새로운 일정'}</h3><button class="btn btn-pri btn-sm" data-act="evSave">${f.id ? '완료' : '추가'}</button></div>
    <div class="fg"><input class="input big" id="evd-title" data-evd="title" placeholder="제목" value="${esc(f.title)}"><input class="input" id="evd-location" data-evd="location" placeholder="위치" value="${esc(f.location)}"></div>
    <div class="fg">
      <div class="fr"><span>하루 종일</span><button class="sw" role="switch" aria-checked="${f.allDay}" data-act="evAllDay" aria-label="하루 종일"></button></div>
      <div class="fr"><span>시작</span><span class="fr-v"><input class="input" type="date" id="evd-date" data-evd="date" value="${f.date}">${f.allDay ? '' : `<input class="input" type="time" id="evd-start" data-evd="start" value="${hm(f.start)}">`}</span></div>
      <div class="fr"><span>종료</span><span class="fr-v">${f.allDay ? `<input class="input" type="date" id="evd-endDate" data-evd="endDate" value="${f.endDate}">` : `<input class="input" type="time" id="evd-end" data-evd="end" value="${hm(f.end)}">`}</span></div>
      ${f.allDay ? '' : `<div class="fr"><span>이동 시간</span><select class="input" id="evd-travel" data-evd="travel">${opt(TRAVEL, f.travel)}</select></div>`}
      <div class="fr"><span>반복</span><select class="input" id="evd-freq" data-evd="freq">${opt(Object.entries(REPEAT), f.freq)}</select></div>
      ${f.freq !== 'none' ? `<div class="fr"><span>반복 종료</span><span class="fr-v"><input class="input" type="date" id="evd-until" data-evd="until" value="${f.until}"><small class="faint">비우면 계속</small></span></div>` : ''}
    </div>
    <div class="fg"><div class="fr"><span>캘린더</span><span class="fr-v pills">${userCals.map(c => `<button class="pill-btn hue" style="--h:${c.h}" data-act="evCal" data-arg="${c.id}" aria-pressed="${f.cal === c.id}"><i style="width:9px;height:9px;border-radius:50%;background:var(--tile-dot)"></i>${esc(c.name)}</button>`).join('')}</span></div></div>
    <div class="fg"><div class="fr"><span>알림</span><select class="input" id="evd-a1" data-evd="a1">${opt(ALERTS, f.a1)}</select></div>${f.a1 >= 0 ? `<div class="fr"><span>두 번째 알림</span><select class="input" id="evd-a2" data-evd="a2">${opt(ALERTS, f.a2)}</select></div>` : ''}</div>
    <div class="fg"><textarea class="input" id="evd-notes" data-evd="notes" rows="3" placeholder="메모">${esc(f.notes)}</textarea></div>
    ${f.err ? `<p class="err">${esc(f.err)}</p>` : ''}
    ${f.freq !== 'none' && f.id ? '<p class="small faint">반복 일정을 고치면 모든 반복 일정에 적용돼요.</p>' : ''}
    <p class="small faint">개인 일정 시간은 역산 플래너가 피해서 계획해요.</p>` };
}
function newCalSheet(sh) {
  return { html: `<div class="sheet-h"><button class="btn btn-soft btn-sm" data-act="closeSheet">취소</button><h3>새 캘린더</h3><button class="btn btn-pri btn-sm" data-act="calCreate">추가</button></div>
    <div class="fg"><input class="input big" id="nc-name" data-bind="ncName" placeholder="캘린더 이름 · 예: 동아리" value="${esc(sh.name || '')}"></div>
    <div class="fg"><div class="fr"><span>색상</span><span class="fr-v pills">${CAL_HUES.map(h => `<button class="swatch hue" style="--h:${h}" data-act="ncHue" data-arg="${h}" aria-pressed="${sh.h === h}" aria-label="색상 ${h}"></button>`).join('')}</span></div></div>` };
}
SHEETS.item = itemSheet;
SHEETS.event = eventSheet;
SHEETS.newcal = newCalSheet;
SHEETS.calpanel = () => ({ html: `<div class="sheet-h"><h3>캘린더</h3><button class="btn btn-soft btn-icon btn-sm" data-act="closeSheet" aria-label="닫기">${icon('x')}</button></div>${miniMonth()}${calList()}` });

/* ---------- handlers ---------- */
function openEditor(draft) { evDraft = draft; sheet = { kind: 'event' }; render(); setTimeout(() => { const el = document.getElementById('evd-title'); if (el && !draft.title) el.focus(); }, 60); }
const CAL_H = {
  calView(v) { state.cal.view = v; state.cal.q = ''; calScroll = null; save(); render(); },
  calNav(n) {
    n = +n; const v = effView(), d = state.cal.date;
    if (n === 0) state.cal.date = today();
    else state.cal.date = v === 'day' ? addDays(d, n) : v === 'week' || v === 'list' ? addDays(d, 7 * n) : v === 'month' ? addMonths(d, n) : addMonths(d, 12 * n);
    calScroll = null; save(); render();
  },
  calPick(d) { state.cal.date = d; if (effView() === 'year') state.cal.view = 'day'; save(); render(); },
  calOpenDay(d) { state.cal.date = d; state.cal.view = 'day'; state.cal.q = ''; calScroll = null; save(); render(); },
  calMonth(d) { state.cal.date = d; state.cal.view = 'month'; save(); render(); },
  calMini(n) { state.cal.date = addMonths(state.cal.date, +n); save(); render(); },
  calToggle(id) { const c = state.calendars.find(x => x.id === id); if (c) { c.visible = !c.visible; save(); render(); } },
  calNew() { sheet = { kind: 'newcal', name: '', h: 178 }; render(); },
  ncHue(h) { if (sheet) { sheet.h = +h; render(); } },
  calCreate() {
    const name = (sheet && sheet.name || '').trim();
    if (!name) { toast('캘린더 이름을 적어 주세요'); return; }
    state.calendars.push({ id: uid('cal'), name, h: sheet.h, visible: true });
    sheet = null; save(); render(); toast(`${name} 캘린더를 추가했어요`);
  },
  calDel(id) {
    if (confirmKey !== 'cal:' + id) { arm('cal:' + id); return; }
    confirmKey = null;
    state.events.forEach(ev => { if (ev.cal === id) ev.cal = 'personal'; });
    state.calendars = state.calendars.filter(c => c.id !== id);
    save(); render(); toast('캘린더를 지웠어요. 일정은 개인 캘린더로 옮겼어요');
  },
  calPanel() { sheet = { kind: 'calpanel' }; render(); },
  calItem(arg, el, e) { const k = arg.lastIndexOf('|'); sheet = { kind: 'item', key: arg.slice(0, k), date: arg.slice(k + 1), x: e.clientX, y: e.clientY }; render(); },
  calSlot(d, el, e) {
    const r = el.getBoundingClientRect(), hh = HH();
    const m = clamp(Math.floor((e.clientY - r.top) / hh * 60 / 15) * 15, 0, 1380);
    openEditor(newDraft(d, m, Math.min(1439, m + 60)));
  },
  newEvent() { openEditor(newDraft(state.view === 'calendar' ? state.cal.date : today())); },
  evEdit(arg) { const [id, d] = arg.split('|'); const ev = state.events.find(x => x.id === id); if (ev) openEditor(draftFrom(ev, d)); },
  evAllDay() { evDraft.allDay = !evDraft.allDay; render(); },
  evCal(id) { evDraft.cal = id; render(); },
  evSave() {
    const f = evDraft; if (!f) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) { f.err = '시작 날짜를 골라 주세요.'; render(); return; }
    if (f.allDay && diffDays(f.date, f.endDate || f.date) < 0) { f.err = '종료 날짜가 시작 날짜보다 빨라요.'; render(); return; }
    if (!f.allDay && f.end <= f.start) { f.err = '종료 시간이 시작 시간보다 늦어야 해요.'; render(); return; }
    const old = f.id && state.events.find(x => x.id === f.id);
    const ev = { id: f.id || uid('ev'), title: f.title.trim() || '새로운 일정', cal: f.cal, allDay: f.allDay, date: f.date, endDate: f.allDay ? (f.endDate || f.date) : f.date,
      start: f.allDay ? null : f.start, end: f.allDay ? null : f.end, location: f.location.trim(), notes: f.notes.trim(),
      repeat: { freq: f.freq, until: f.freq !== 'none' && f.until ? f.until : null }, exdates: old ? (old.exdates || []) : [],
      alerts: [...new Set([+f.a1, +f.a2].filter(x => x >= 0))], travel: f.allDay ? 0 : +f.travel || 0 };
    if (old) Object.assign(old, ev); else state.events.push(ev);
    state.cal.date = ev.date; evDraft = null; sheet = null; calScroll = null;
    save(); render(); toast(old ? '일정을 고쳤어요' : `${md(ev.date)}에 일정을 추가했어요`);
  },
  evDelete(arg) {
    const [mode, id, d] = arg.split('|'); const ev = state.events.find(x => x.id === id); if (!ev) return;
    if (mode === 'one') { ev.exdates = [...(ev.exdates || []), d]; sheet = null; save(); render(); toast('이 날 일정만 지웠어요'); return; }
    if (confirmKey !== 'evall:' + id) { arm('evall:' + id); return; }
    confirmKey = null; state.events = state.events.filter(x => x.id !== id); sheet = null; save(); render(); toast('일정을 삭제했어요');
  },
  itemDone(arg) { sheet = null; H.toggleStep(arg); },
  quickAdd() {
    if (!quickText.trim()) { document.getElementById('quick-in')?.focus(); return; }
    const p = parseQuick(quickText, state.cal.date || today());
    quickText = '';
    openEditor(newDraft(p.date, p.start, p.end, { title: p.title, allDay: p.allDay, endDate: p.date, freq: p.repeat, a1: p.allDay ? 1440 : 10 }));
  }
};
