'use strict';
/* 수행 내비 — calendar engine: calendars, events, recurrence, one item list for every view,
   overlap layout, and a small Korean quick-add parser. */

const DEFAULT_CALS = () => [
  { id: 'plan', name: '수행 계획', h: 214, visible: true, system: true, desc: '역산 플래너가 넣은 작업' },
  { id: 'due', name: '수행 마감', h: 8, visible: true, system: true, desc: '수행 카드의 마감일' },
  { id: 'school', name: '학교 시간표', h: 40, visible: true, system: true, desc: '교시별 수업 · 일/주 보기' },
  { id: 'academy', name: '학원', h: 262, visible: true, system: true, desc: '학원과 이동 시간 · 일/주 보기' },
  { id: 'personal', name: '개인', h: 152, visible: true },
  { id: 'family', name: '가족', h: 330, visible: true },
  { id: 'event', name: '학교 행사', h: 196, visible: true }
];
const CAL_HUES = [0, 16, 34, 48, 92, 152, 178, 196, 214, 236, 262, 290, 330];
const REPEAT = { none: '안 함', daily: '매일', weekdays: '평일마다', weekly: '매주', biweekly: '2주마다', monthly: '매월', yearly: '매년' };
const ALERTS = [[-1, '없음'], [0, '일정 시작 시'], [5, '5분 전'], [10, '10분 전'], [15, '15분 전'], [30, '30분 전'], [60, '1시간 전'], [120, '2시간 전'], [1440, '1일 전'], [2880, '2일 전']];
const TRAVEL = [[0, '없음'], [5, '5분'], [15, '15분'], [30, '30분'], [60, '1시간'], [90, '1시간 30분']];
const DEFAULT_SCHOOL = () => ({
  periods: [[540, 585], [595, 640], [650, 695], [705, 750], [810, 855], [865, 910], [920, 965]],
  grid: {
    1: ['국어', '수학', '영어', '과학', '사회', '체육', '미술'],
    2: ['영어', '국어', '수학', '음악', '과학', '역사', '창체'],
    3: ['수학', '과학', '국어', '영어', '체육', '정보', '도덕'],
    4: ['사회', '영어', '국어', '수학', '기술·가정', '과학', ''],
    5: ['과학', '국어', '수학', '영어', '역사', '음악', '동아리']
  }
});
function seedEvents() {
  const t = today(), { W } = anchors();
  let wed = addDays(t, 1); while (dow(wed) !== 3) wed = addDays(wed, 1);
  let sat = addDays(t, 1); while (dow(sat) !== 6) sat = addDays(sat, 1);
  let sun = t; while (dow(sun) !== 0) sun = addDays(sun, 1);
  return [
    { id: 'ev-dent', example: true, title: '치과 정기 검진', cal: 'personal', allDay: false, date: wed, endDate: wed, start: 1000, end: 1050, location: '연세바른치과', notes: '', repeat: { freq: 'none' }, exdates: [], alerts: [30], travel: 15 },
    { id: 'ev-fam', example: true, title: '가족 외식', cal: 'family', allDay: false, date: sat, endDate: sat, start: 1080, end: 1200, location: '', notes: '할머니 생신', repeat: { freq: 'none' }, exdates: [], alerts: [60], travel: 30 },
    { id: 'ev-piano', example: true, title: '피아노 연습', cal: 'personal', allDay: false, date: sun, endDate: sun, start: 600, end: 660, location: '', notes: '', repeat: { freq: 'weekly' }, exdates: [], alerts: [10], travel: 0 },
    { id: 'ev-sports', example: true, title: '체육대회', cal: 'event', allDay: true, date: addDays(W, 8), endDate: addDays(W, 8), start: null, end: null, location: '운동장', notes: '체육복 등교', repeat: { freq: 'none' }, exdates: [], alerts: [1440], travel: 0 }
  ];
}
const calOf = id => state.calendars.find(c => c.id === id) || state.calendars.find(c => c.id === 'personal') || { id, name: '캘린더', h: 220 };
const calVisible = id => { const c = state.calendars.find(x => x.id === id); return !c || c.visible; };
const alertText = m => (ALERTS.find(a => a[0] === m) || [m, `${m}분 전`])[1];
const daysInRange = (from, to) => { const out = []; for (let d = from; diffDays(d, to) >= 0; d = addDays(d, 1)) out.push(d); return out; };

/* ---------- recurrence ---------- */
const evSpan = ev => (ev.allDay ? Math.max(0, diffDays(ev.date, ev.endDate || ev.date)) : 0);
function occurrences(ev, from, to) {
  const r = ev.repeat || { freq: 'none' }, span = evSpan(ev), out = [];
  const ex = new Set(ev.exdates || []);
  const hit = d => diffDays(from, addDays(d, span)) >= 0 && diffDays(d, to) >= 0;
  if (!r.freq || r.freq === 'none') { if (hit(ev.date)) out.push(ev.date); return out; }
  const until = r.until || null, count = r.count || 0;
  let n = 0, guard = 0;
  if (r.freq === 'monthly' || r.freq === 'yearly') {
    const b = parseYmd(ev.date);
    for (let i = 0; guard++ < 800; i++) {
      const dt = new Date(b.getFullYear() + (r.freq === 'yearly' ? i : 0), b.getMonth() + (r.freq === 'monthly' ? i : 0), b.getDate());
      if (dt.getDate() !== b.getDate()) continue; // that month has no such day
      const d = ymd(dt);
      if ((until && diffDays(d, until) < 0) || (count && n >= count) || diffDays(d, to) < 0) break;
      if (hit(d) && !ex.has(d)) out.push(d);
      n++;
    }
    return out;
  }
  const stepDays = { daily: 1, weekdays: 1, weekly: 7, biweekly: 14 }[r.freq] || 7;
  let d = ev.date;
  const gap = diffDays(ev.date, from) - span;
  if (gap > stepDays && !count && r.freq !== 'weekdays') { const k = Math.floor(gap / stepDays); d = addDays(ev.date, k * stepDays); }
  while (guard++ < 3000) {
    if ((until && diffDays(d, until) < 0) || (count && n >= count) || diffDays(d, to) < 0) break;
    if (!(r.freq === 'weekdays' && isWeekend(d))) { if (hit(d) && !ex.has(d)) out.push(d); n++; }
    d = addDays(d, stepDays);
  }
  return out;
}
function repeatText(ev) {
  const r = ev.repeat || { freq: 'none' };
  if (!r.freq || r.freq === 'none') return '';
  let s = REPEAT[r.freq];
  if (r.freq === 'weekly' || r.freq === 'biweekly') s += ` ${WD[dow(ev.date)]}요일`;
  if (r.freq === 'monthly') s += ` ${parseYmd(ev.date).getDate()}일`;
  if (r.until) s += ` · ${mdMid(r.until)}까지`;
  return s;
}

/* ---------- one item list for every view ---------- */
function evItem(ev, d) {
  return { key: `ev:${ev.id}:${d}`, kind: 'event', cal: ev.cal, title: ev.title || '새로운 일정', sub: ev.location || '', date: d, endDate: addDays(d, evSpan(ev)),
           allDay: !!ev.allDay, start: ev.start, end: ev.end, h: calOf(ev.cal).h, ev, travel: ev.allDay ? 0 : (ev.travel || 0) };
}
function schoolOn(date) {
  const wd = dow(date);
  if (wd < 1 || wd > 5) return [];
  const row = (state.school.grid[wd] || []);
  return state.school.periods.map(([s, e], i) => ({ n: i + 1, start: s, end: e, subject: row[i] || '' })).filter(p => p.subject);
}
/* foreground: only things a student acts on (events, plan, deadlines) — for month, year and list */
function itemsFor(from, to, opts) {
  const fg = opts && opts.foreground, out = [];
  const inRange = d => diffDays(from, d) >= 0 && diffDays(d, to) >= 0;
  for (const ev of state.events) {
    if (!calVisible(ev.cal)) continue;
    for (const d of occurrences(ev, from, to)) out.push(evItem(ev, d));
  }
  if (calVisible('plan')) {
    for (const b of allBlocks()) {
      if (!inRange(b.date)) continue;
      const a = find(b.aid), s = a.steps[b.step];
      out.push({ key: `plan:${a.id}:${b.step}:${b.part}`, kind: 'plan', cal: 'plan', title: s.name + (b.parts > 1 ? ` (${b.part}/${b.parts})` : ''), sub: `${a.subject} · ${a.title}`,
                 date: b.date, start: b.start, end: b.end, h: hueOf(a.subject), aid: a.id, step: b.step, check: s.check });
    }
  }
  if (calVisible('due')) {
    for (const a of state.cards) if (a.due && inRange(a.due)) out.push({ key: `due:${a.id}`, kind: 'due', cal: 'due', allDay: true, title: `${a.subject} 마감`, sub: a.title, date: a.due, endDate: a.due, h: hueOf(a.subject), aid: a.id, dueTime: a.dueTime });
  }
  if (!fg) {
    const days = daysInRange(from, to);
    if (calVisible('school')) for (const d of days) for (const p of schoolOn(d)) out.push({ key: `sc:${d}:${p.n}`, kind: 'school', cal: 'school', title: `${p.n}교시 ${p.subject}`, sub: '', date: d, start: p.start, end: p.end, h: hueOf(p.subject), period: p.n });
    if (calVisible('academy')) for (const d of days) for (const a of state.academies) {
      if (!a.days.includes(dow(d)) || a.end <= a.start) continue;
      out.push({ key: `ac:${a.id}:${d}`, kind: 'academy', cal: 'academy', title: a.label, sub: '', date: d, start: a.start, end: a.end, h: calOf('academy').h, acId: a.id, travel: state.settings.travel });
    }
  }
  return out;
}
const itemSort = (a, b) => a.date.localeCompare(b.date) || (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0) || (a.start || 0) - (b.start || 0);
function findItem(key, date) { return itemsFor(date, date).find(i => i.key === key) || null; }

/* side-by-side packing of overlapping timed items in one day column */
function layoutDay(items) {
  const list = items.filter(i => !i.allDay).map(i => ({ ...i })).sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const out = [];
  let cluster = [], clusterEnd = -1;
  const flush = () => {
    const cols = [];
    for (const it of cluster) {
      let c = cols.findIndex(end => end <= it.start);
      if (c < 0) { c = cols.length; cols.push(0); }
      cols[c] = Math.max(it.end, it.start + 24);
      it.col = c;
    }
    cluster.forEach(it => { it.cols = cols.length; });
    out.push(...cluster);
    cluster = [];
  };
  for (const it of list) {
    if (cluster.length && it.start >= clusterEnd) { flush(); clusterEnd = -1; }
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end, it.start + 24);
  }
  flush();
  return out;
}

/* ---------- quick add: "내일 오후 3시 치과 1시간" ---------- */
function dowDate(base, wd, weekOffset) {
  if (weekOffset == null) { let d = base; while (dow(d) !== wd) d = addDays(d, 1); return d; }
  return addDays(mondayOf(base), weekOffset * 7 + ((wd + 6) % 7));
}
function parseQuick(text, base) {
  let s = ' ' + String(text || '').trim() + ' ';
  const take = re => { const m = s.match(re); if (m) s = s.replace(m[0], ' '); return m; };
  let date = null, start = null, end = null, dur = null, repeat = 'none', m;
  if (take(/매일/)) repeat = 'daily';
  else if (take(/평일마다/)) repeat = 'weekdays';
  else if (take(/매월|매달/)) repeat = 'monthly';
  else if (take(/매년/)) repeat = 'yearly';
  if ((m = take(/매주\s*([월화수목금토일])요일?/))) { repeat = 'weekly'; date = dowDate(base, WD.indexOf(m[1])); }
  else if (take(/매주/)) repeat = 'weekly';
  if (!date && (m = take(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/))) date = resolveMD(base, +m[1], +m[2]);
  if (!date && (m = take(/(\d{1,2})\s*\/\s*(\d{1,2})/))) date = resolveMD(base, +m[1], +m[2]);
  if (!date && (m = take(/(다다음\s*주|다음\s*주|이번\s*주)?\s*([월화수목금토일])요일/))) {
    const off = !m[1] ? null : /다다음/.test(m[1]) ? 2 : /다음/.test(m[1]) ? 1 : 0;
    date = dowDate(base, WD.indexOf(m[2]), off);
  }
  if (!date && (m = take(/오늘|내일|모레|글피/))) date = addDays(base, { 오늘: 0, 내일: 1, 모레: 2, 글피: 3 }[m[0]]);
  if (!date && (m = take(/(\d{1,2})\s*일(?![간정])/))) date = resolveD(base, +m[1]);
  if ((m = take(/(\d+)\s*시간\s*(?:(\d+)\s*분)?\s*(?:동안)?/))) dur = (+m[1]) * 60 + (+(m[2] || 0));
  else if ((m = take(/(\d+)\s*분\s*동안/))) dur = +m[1];
  const T = '(오전|오후|아침|저녁|밤|낮|새벽)?\\s*(\\d{1,2})(?::(\\d{2})|\\s*시(?:\\s*(\\d{1,2})\\s*분|\\s*(반))?)';
  const toM = (ap, h, mi, half) => {
    h = +h; mi = half ? 30 : +(mi || 0);
    if (/오후|저녁|밤|낮/.test(ap || '') && h < 12) h += 12;
    if (/오전|아침|새벽/.test(ap || '') && h === 12) h = 0;
    if (!ap && h >= 1 && h <= 7) h += 12; // a student's "3시" is in the afternoon
    return clamp(h * 60 + mi, 0, 1439);
  };
  if ((m = take(new RegExp(T + '\\s*(?:~|-|부터)\\s*' + T + '(?:\\s*까지)?')))) {
    start = toM(m[1], m[2], m[3] || m[4], m[5]);
    end = toM(m[6] || m[1], m[7], m[8] || m[9], m[10]);
    if (end <= start && end + 720 <= 1439) end += 720;
  } else if ((m = take(new RegExp(T)))) start = toM(m[1], m[2], m[3] || m[4], m[5]);
  else if (take(/정오/)) start = 720;
  if (start != null && end == null) end = Math.min(1439, start + (dur || 60));
  const title = s.replace(/(^|\s)(에|에서|까지|부터|에는|엔)(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim() || '새로운 일정';
  return { title, date: date || base, allDay: start == null, start, end, repeat };
}
function resolveMD(base, mo, d) {
  const y = parseYmd(base).getFullYear();
  let s = `${y}-${pad(mo)}-${pad(d)}`;
  if (diffDays(s, base) > 60) s = `${y + 1}-${pad(mo)}-${pad(d)}`;
  return s;
}
function resolveD(base, d) {
  const b = parseYmd(base);
  return ymd(new Date(b.getFullYear(), b.getMonth() + (d < b.getDate() ? 1 : 0), d));
}
