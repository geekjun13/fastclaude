'use strict';
/* 수행 내비 — 알림: what to remind and when, an in-app banner while the page is open,
   a notification centre, and the settings that shape both. */

const NOTI_KIND = {
  event: { label: '일정', icon: 'calendar', h: 152 },
  plan: { label: '수행 계획', icon: 'route', h: 214 },
  due: { label: '마감', icon: 'flag', h: 8 },
  academy: { label: '학원', icon: 'clock', h: 262 },
  crunch: { label: '몰림 경보', icon: 'flame', h: 20 },
  missed: { label: '놓친 알림', icon: 'bell', h: 44 },
  test: { label: '테스트', icon: 'bell', h: 44 }
};
const STICKY = new Set(['due', 'crunch', 'event', 'missed']); // stay until closed
const atMs = (date, min) => parseYmd(date).getTime() + min * 60000;
function inQuiet(ms) {
  const N = state.notif; if (!N.quiet) return false;
  const d = new Date(ms), m = d.getHours() * 60 + d.getMinutes();
  return N.quietStart > N.quietEnd ? (m >= N.quietStart || m < N.quietEnd) : (m >= N.quietStart && m < N.quietEnd);
}
/* every reminder that falls between two dates */
function notifPlan(from, to) {
  const N = state.notif; if (!N.on) return [];
  const out = [];
  for (const it of itemsFor(addDays(from, -2), addDays(to, 2))) {
    if (it.kind === 'event' && N.events) {
      for (const lead of it.ev.alerts || []) {
        const base = it.allDay ? atMs(it.date, 540) : atMs(it.date, it.start);
        out.push({ id: `ev:${it.ev.id}:${it.date}:${lead}`, at: base - lead * 60000, kind: 'event', title: it.title,
          body: `${mdMid(it.date)} ${it.allDay ? '하루 종일' : hm(it.start) + ' 시작'}${lead > 0 ? ' · ' + alertText(lead) : ''}${it.ev.location ? ' · ' + it.ev.location : ''}`, act: { type: 'cal', arg: it.date } });
      }
    } else if (it.kind === 'plan' && N.step >= 0) {
      out.push({ id: `plan:${it.aid}:${it.step}:${it.date}:${it.start}`, at: atMs(it.date, it.start) - N.step * 60000, kind: 'plan',
        title: `${N.step ? N.step + '분 뒤' : '지금'} ${it.title}`, body: `${it.sub} · ${hm(it.start)}–${hm(it.end)}`, act: { type: 'card', arg: it.aid } });
    } else if (it.kind === 'academy' && N.academy) {
      out.push({ id: `ac:${it.acId}:${it.date}`, at: atMs(it.date, it.start - (it.travel || 0) - 5), kind: 'academy',
        title: `${it.title} 갈 준비`, body: `${hm(it.start)} 시작 · 이동 ${it.travel || 0}분`, act: { type: 'cal', arg: it.date } });
    }
  }
  for (const a of state.cards) {
    if (!a.due) continue;
    if (N.dueEve) out.push({ id: `due-eve:${a.id}:${a.due}`, at: atMs(addDays(a.due, -1), 1200), kind: 'due', title: `내일 마감 · ${a.subject}`, body: `${a.title}${a.dueTime ? ' · ' + a.dueTime : ''}${a.materials.length ? ' · 준비물 ' + a.materials.join(', ') : ''}`, act: { type: 'card', arg: a.id } });
    if (N.dueMorning) out.push({ id: `due-day:${a.id}:${a.due}`, at: atMs(a.due, 450), kind: 'due', title: `오늘 마감 · ${a.subject}`, body: `${a.title}${a.dueTime ? ' · ' + a.dueTime : ''}`, act: { type: 'card', arg: a.id } });
  }
  if (N.crunch) for (const w of crunchWeeks()) {
    out.push({ id: `crunch:${w.monday}`, at: atMs(addDays(w.monday, -14), 450), kind: 'crunch', title: `몰림 경보 · ${mdShort(w.monday)} 주에 ${w.cards.length}개`,
      body: `${w.cards.map(a => a.subject).join(' · ')} — 미리 시작하게 계획했어요`, act: { type: 'view', arg: 'today' } });
  }
  const lo = atMs(from, 0), hi = atMs(addDays(to, 1), 0);
  return out.filter(n => n.at >= lo && n.at < hi).sort((a, b) => a.at - b.at);
}

/* ---------- delivery ---------- */
let audioCtx = null;
document.addEventListener('pointerdown', () => { if (!audioCtx && window.AudioContext) { try { audioCtx = new AudioContext(); } catch (e) { audioCtx = null; } } }, { once: true });
function chime() {
  if (!state.notif.sound || !audioCtx) return;
  try {
    const t0 = audioCtx.currentTime;
    [[880, 0], [1320, 0.13]].forEach(([f, d]) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.12, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.35);
      o.connect(g).connect(audioCtx.destination); o.start(t0 + d); o.stop(t0 + d + 0.4);
    });
  } catch (e) { /* sound is optional */ }
}
const banners = [];
function renderBanners() {
  const root = document.getElementById('banners');
  if (!root) return;
  morph(root, banners.map(n => { const k = NOTI_KIND[n.kind] || NOTI_KIND.test; return `<div class="banner glass${STICKY.has(n.kind) ? ' sticky' : ''}${n.leaving ? ' leaving' : ''}" data-key="${esc(n.id)}" role="alert">
    <span class="bn-ico hue" style="--h:${k.h}">${icon(k.icon)}</span>
    <div class="bn-c"><div class="bn-app">${logoMark(15)}<span>수행 내비 · ${esc(k.label)}</span><small>${when(n.at)}</small></div><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p>
      <div class="bn-act"><button class="btn btn-pri btn-sm" data-act="notiOpen" data-arg="${esc(n.id)}">열기</button>${n.kind === 'missed' ? '' : `<button class="btn btn-soft btn-sm" data-act="notiSnooze" data-arg="${esc(n.id)}">5분 뒤</button>`}</div></div>
    <button class="bn-x" data-act="bannerClose" data-arg="${esc(n.id)}" aria-label="닫기">${icon('x')}</button></div>`; }).join(''));
}
function removeBanner(id) {
  const b = banners.find(x => x.id === id);
  if (!b || b.leaving) return;
  const drop = () => { const i = banners.indexOf(b); if (i >= 0) { banners.splice(i, 1); renderBanners(); } };
  if (!motionOn()) { drop(); return; }
  b.leaving = true; renderBanners(); setTimeout(drop, 320 * mo());
}
function dismissLater(n) { setTimeout(() => removeBanner(n.id), 9000); }
function showBanner(n) {
  banners.unshift(n);
  banners.filter(b => !b.leaving).slice(3).forEach(b => removeBanner(b.id));
  renderBanners(); chime();
  if (state.notif.sound && navigator.vibrate) { try { navigator.vibrate([24, 40, 24]); } catch (e) { /* optional */ } }
  if (document.hidden) document.title = `🔔 ${n.title} · 수행 내비`;
  systemNotify(n);
  // important ones stay until closed; others fade 9s after the student can actually see them
  if (!STICKY.has(n.kind)) { if (document.hidden) n.pending = true; else dismissLater(n); }
}
/* the browser's own notification, when this page is allowed to show one (best effort) */
const sysOK = () => { try { return 'Notification' in window && Notification.permission === 'granted'; } catch (e) { return false; } };
function systemNotify(n) {
  if (!state.notif.system || !document.hidden || !sysOK()) return; // visible page: the banner is enough
  swNotify(n);
}
function deliver(n, banner) {
  state.fired[n.id] = n.at;
  state.inbox.unshift({ id: n.id, at: n.at, kind: n.kind, title: n.title, body: n.body, act: n.act, read: false });
  if (state.inbox.length > 60) state.inbox.length = 60;
  if (banner) showBanner(n);
}
let nextT = null, lastTick = 0;
function tickNotifs() {
  const now = Date.now(), t = today();
  let changed = false;
  const missed = [], firstRun = !Object.keys(state.fired).length && !state.inbox.length;
  lastTick = now;
  const due = notifPlan(addDays(t, -1), addDays(t, 1));
  const snoozed = state.snoozes.filter(s => s.at <= now);
  state.snoozes = state.snoozes.filter(s => s.at > now);
  for (const n of [...due, ...snoozed]) {
    if (n.at > now || state.fired[n.id]) continue;
    if (now - n.at > 6 * 3600e3) { state.fired[n.id] = n.at; changed = true; continue; } // too old to be useful
    const fresh = now - n.at < 15 * 60e3;
    deliver(n, fresh && !inQuiet(now));
    if (!fresh) missed.push(n);
    changed = true;
  }
  // came back after the page slept or was closed: one summary instead of a pile of old banners
  if (missed.length && !firstRun && !inQuiet(now)) showBanner({ id: 'missed:' + now, at: now, kind: 'missed', title: `놓친 알림 ${missed.length}개`, body: missed.slice(0, 3).map(n => n.title).join(' · ') + (missed.length > 3 ? ' 외' : ''), act: { type: 'inbox' } });
  const cutoff = now - 8 * 86400e3;
  for (const k of Object.keys(state.fired)) if (state.fired[k] < cutoff) { delete state.fired[k]; changed = true; }
  if (changed || snoozed.length) { save(); renderShell(); if (sheet && sheet.kind === 'notif') renderSheet(); }
  armNext(now);
  syncSchedule();
}
/* wake exactly when the next reminder is due, not just on the 10-second sweep */
function nextNotif(now) {
  const t = today();
  return notifPlan(t, addDays(t, 2)).concat(state.snoozes).filter(n => n.at > now && !state.fired[n.id]).sort((a, b) => a.at - b.at)[0] || null;
}
function armNext(now) {
  clearTimeout(nextT);
  const n = nextNotif(now);
  if (n && n.at - now < 10 * 60e3) nextT = setTimeout(tickNotifs, Math.max(200, n.at - now + 120));
}
function onWake() {
  if (!document.hidden) {
    document.title = unread() ? `(${unread()}) 수행 내비` : '수행 내비';
    banners.filter(b => b.pending).forEach(b => { b.pending = false; dismissLater(b); });
  }
  if (Date.now() - lastTick > 3000) tickNotifs();
}
document.addEventListener('visibilitychange', onWake);
addEventListener('focus', onWake);
addEventListener('pageshow', onWake);
addEventListener('online', onWake);
const unread = () => state.inbox.filter(n => !n.read).length;
function bellBtn(small) {
  const n = unread();
  return `<button class="btn btn-soft btn-icon${small ? ' btn-sm' : ''} bell" data-act="notiCenter" aria-label="알림 ${n ? n + '개 안 읽음' : ''}">${icon('bell')}${n ? `<span class="bell-dot">${n > 9 ? '9+' : n}</span>` : ''}</button>`;
}
function when(ms) {
  const d = new Date(ms), ds = ymd(d), m = d.getHours() * 60 + d.getMinutes(), diff = Date.now() - ms;
  if (diff >= 0 && diff < 60e3) return '방금';
  if (diff >= 0 && diff < 3600e3) return `${Math.floor(diff / 60e3)}분 전`;
  return `${ds === today() ? '오늘' : ds === addDays(today(), 1) ? '내일' : ds === addDays(today(), -1) ? '어제' : md(ds)} ${hm(m)}`;
}
function notiRow(n, upcoming) {
  const k = NOTI_KIND[n.kind] || NOTI_KIND.test;
  return `<button class="nrow${!upcoming && !n.read ? ' unread' : ''}" data-act="notiOpen" data-arg="${esc(n.id)}"${upcoming ? ' data-up="1"' : ''}>
    <span class="bn-ico hue" style="--h:${k.h}">${icon(k.icon)}</span><span class="nrow-c"><span class="nrow-top"><b>${esc(n.title)}</b><small>${when(n.at)}</small></span><small>${esc(n.body)}</small></span></button>`;
}
SHEETS.notif = sh => {
  const tab = sh.tab || 'inbox', now = Date.now();
  const up = notifPlan(today(), addDays(today(), 2)).filter(n => n.at > now && !state.fired[n.id]).slice(0, 30);
  const body = tab === 'up'
    ? (up.length ? `<div class="nlist">${up.map(n => notiRow(n, true)).join('')}</div>` : `<div class="empty">${emptyArt()}<b>앞으로 이틀 동안 예정된 알림이 없어요</b></div>`)
    : (state.inbox.length ? `<div class="nlist">${state.inbox.map(n => notiRow(n, false)).join('')}</div>` : `<div class="empty">${emptyArt()}<b>받은 알림이 없어요</b><p class="small muted">수행 계획, 마감, 일정 알림이 여기에 모여요.</p></div>`);
  return { html: `<div class="sheet-h"><h3>알림</h3><div class="row"><button class="btn btn-soft btn-sm" data-act="go" data-arg="settings">${icon('gear')}설정</button><button class="btn btn-soft btn-icon btn-sm" data-act="closeSheet" aria-label="닫기">${icon('x')}</button></div></div>
    <div class="row-sb"><div class="seg" role="group"><button data-act="notiTab" data-arg="inbox" aria-pressed="${tab === 'inbox'}">받은 알림${unread() ? ` ${unread()}` : ''}</button><button data-act="notiTab" data-arg="up" aria-pressed="${tab === 'up'}">예정 ${up.length}</button></div>
      ${tab === 'inbox' && state.inbox.length ? '<button class="btn btn-soft btn-sm" data-act="notiClear">모두 지우기</button>' : ''}</div>
    ${state.notif.on ? '' : '<p class="err">알림이 꺼져 있어요. 설정에서 켤 수 있어요.</p>'}
    ${body}
    <p class="tiny faint">수행 내비가 열려 있는 동안 정시에 화면 위로 알려 주고, 닫혀 있던 사이에 놓친 알림은 다시 열 때 모아서 알려 줘요.</p>`, side: true };
};

/* ---------- settings section ---------- */
function sw(key, on, label, desc) {
  return `<div class="gi"><div style="flex:1;min-width:0"><b>${label}</b>${desc ? `<div class="small faint">${desc}</div>` : ''}</div><button class="sw" role="switch" aria-checked="${!!on}" data-act="notiSet" data-arg="${key}" aria-label="${label}"></button></div>`;
}
function notifSettingsHtml() {
  const N = state.notif;
  const stepOpts = [[-1, '끄기'], [0, '시작할 때'], [5, '5분 전'], [10, '10분 전'], [15, '15분 전'], [30, '30분 전']];
  const nx = N.on ? nextNotif(Date.now()) : null;
  const sysState = (() => { try { return 'Notification' in window ? Notification.permission : 'none'; } catch (e) { return 'none'; } })();
  return `<button class="app-card" data-act="installSheet"><span class="ac-ico">${logoMark(40)}</span><span class="ac-t"><b>${standalone() ? '수행 내비 앱 사용 중' : '앱으로 설치하고 잠금 화면 알림 받기'}</b><small>${standalone() ? '잠금 화면 알림과 캘린더 연결을 확인해요' : '홈 화면 설치 · 시스템 알림 · 휴대폰 캘린더 연결'}</small></span>${icon('next')}</button>
  <div class="cell pad noti-status">${logoMark(34)}<div style="flex:1;min-width:0"><span class="eyebrow">${N.on ? '알림 켜짐' : '알림 꺼짐'}</span>
      <b>${nx ? `다음 알림 · ${when(nx.at)}` : N.on ? '이틀 안에 예정된 알림이 없어요' : '알림을 켜면 계획과 마감을 정시에 알려 줘요'}</b>${nx ? `<small>${esc(nx.title)}</small>` : ''}</div>${N.on ? `<span class="chip green">정시 알림</span>` : ''}</div>
  <div class="group">
    ${sw('on', N.on, '알림 받기', '아래 알림을 한꺼번에 켜고 꺼요')}
    ${N.on ? `
    <div class="gi"><div style="flex:1"><b>수행 계획 시작</b><div class="small faint">역산 플래너가 넣은 작업을 미리 알려 줘요</div></div><select class="input" style="width:auto" id="noti-step" data-noti="step">${stepOpts.map(([v, l]) => `<option value="${v}" ${N.step === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    ${sw('dueEve', N.dueEve, '마감 전날 저녁 8시', '준비물까지 같이 알려 줘요')}
    ${sw('dueMorning', N.dueMorning, '마감 당일 아침 7시 30분')}
    ${sw('events', N.events, '내 일정 알림', '일정마다 정한 시간에 알려 줘요')}
    ${sw('academy', N.academy, '학원 갈 준비', '이동 시간보다 5분 먼저')}
    ${sw('crunch', N.crunch, '몰림 경보', '수행평가 3개 이상 몰린 주를 2주 전에')}
    ${sw('quiet', N.quiet, '방해 금지 시간', '이 시간에는 화면 배너 없이 알림함에만 쌓여요')}
    ${N.quiet ? `<div class="gi"><span style="flex:1" class="small muted">방해 금지</span><input class="input" style="width:auto" type="time" id="noti-qs" data-noti="quietStart" value="${hm(N.quietStart)}"><span class="faint">–</span><input class="input" style="width:auto" type="time" id="noti-qe" data-noti="quietEnd" value="${hm(N.quietEnd)}"></div>` : ''}
    ${sw('sound', N.sound, '알림음 · 진동', '배너가 뜰 때 짧게 울리고, 휴대폰은 진동해요')}
    <div class="gi"><div style="flex:1;min-width:0"><b>기기 알림</b><div class="small faint">${sysState === 'granted' ? '다른 탭을 보고 있어도 브라우저 알림으로 알려 줘요' : sysState === 'denied' || sysState === 'none' ? '이 화면에서는 브라우저 알림이 막혀 있어요. 화면 배너와 알림함으로 알려 줘요' : '다른 탭을 보고 있을 때 브라우저 알림으로 알려 줘요'}</div></div><button class="sw" role="switch" aria-checked="${!!(N.system && sysState === 'granted')}" data-act="notiSystem" aria-label="기기 알림" ${sysState === 'denied' || sysState === 'none' ? 'disabled' : ''}></button></div>` : ''}
    <div class="gi"><div style="flex:1"><b>테스트 알림</b><div class="small faint">지금 화면 위에 알림을 하나 띄워 봐요</div></div><button class="btn btn-line btn-sm" data-act="notiTest">${icon('bell')}보내기</button></div>
  </div>
  <p class="small faint">수행 내비가 열려 있는 동안 정시에 알려 줘요. 마감·몰림 경보·일정 배너는 닫을 때까지 남아 있고, 닫혀 있던 사이 놓친 알림은 다시 열 때 한 번에 모아 알려 줘요. 휴대폰 잠금 화면 알림은 앱 설치형 버전에서 지원할 수 있어요.</p>`;
}

/* ---------- handlers ---------- */
const NOTI_H = {
  notiCenter() { sheet = { kind: 'notif', tab: 'inbox' }; state.inbox.forEach(n => { n.read = true; }); save(); render(); },
  notiTab(t) { if (sheet) { sheet.tab = t; render(); } },
  notiClear() { state.inbox = []; save(); render(); },
  notiOpen(id, el) {
    const n = state.inbox.find(x => x.id === id) || banners.find(x => x.id === id) || notifPlan(today(), addDays(today(), 2)).find(x => x.id === id);
    removeBanner(id);
    if (!n || !n.act) { sheet = null; render(); return; }
    if (n.act.type === 'inbox') { NOTI_H.notiCenter(); return; }
    sheet = null;
    if (n.act.type === 'card' && find(n.act.arg)) { state.detail = n.act.arg; state.detailTab = 'plan'; render(); goTop(); return; }
    if (n.act.type === 'cal') { state.view = 'calendar'; state.detail = null; state.cal.date = n.act.arg; state.cal.view = 'day'; calScroll = null; save(); render(); goTop(); return; }
    setView(n.act.arg || 'today');
  },
  notiSnooze(id) {
    const n = banners.find(b => b.id === id);
    if (n) { removeBanner(id); state.snoozes.push({ ...n, id: n.id + ':z' + Date.now(), at: Date.now() + 5 * 60e3 }); save(); toast('5분 뒤에 다시 알려 줄게요'); }
  },
  bannerClose(id) { removeBanner(id); },
  notiSet(k) { state.notif[k] = !state.notif[k]; save(); render(); },
  async notiSystem() {
    if (state.notif.system && sysOK()) { state.notif.system = false; save(); render(); return; }
    let p = 'denied';
    try { p = await Notification.requestPermission(); } catch (e) { p = 'denied'; }
    state.notif.system = p === 'granted'; save(); render();
    if (p === 'granted') { syncSchedule(true); registerPeriodic(); }
    toast(p === 'granted' ? '기기 알림을 켰어요' : '이 화면에서는 기기 알림이 막혀 있어요. 화면 배너와 캘린더 연결로 알려 줄게요');
  },
  notiTest() {
    const n = { id: 'test:' + Date.now(), at: Date.now(), kind: 'test', title: '테스트 알림이에요', body: '수행 계획과 마감이 다가오면 이렇게 알려 줘요.', act: { type: 'view', arg: 'today' } };
    deliver(n, true); save(); renderShell();
  }
};
