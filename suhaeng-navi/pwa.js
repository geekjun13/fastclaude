'use strict';
/* 수행 내비 — app install and lock-screen reminders.
   Installed from its own address (app.html), a service worker keeps the app working offline and
   shows reminders as system notifications, which reach the phone's lock screen. Wherever the
   app runs, the calendar export hands every deadline and planned block, with alarms, to the
   phone's own calendar, which alerts even while the app is closed. */

const APP_URL = 'https://geekjun13.github.io/fastclaude/suhaeng-navi/app.html';
const inFrame = (() => { try { return window.top !== window.self; } catch (e) { return true; } })();
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const canSW = 'serviceWorker' in navigator && !inFrame && (location.protocol === 'https:' || location.hostname === 'localhost');
let swReg = null, installEvt = null;

if (canSW) {
  navigator.serviceWorker.register('sw.js').then(r => { swReg = r; syncSchedule(true); registerPeriodic(); }).catch(() => { swReg = null; });
  navigator.serviceWorker.addEventListener('message', e => { const d = e.data || {}; if (d.type === 'open' && d.id) NOTI_H.notiOpen(d.id); });
}
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (sheet && sheet.kind === 'install') render(); });
addEventListener('appinstalled', () => { installEvt = null; toast('홈 화면에 수행 내비를 설치했어요'); render(); });

/* the next three days of reminders, kept where the service worker can read them */
let schedSig = '';
function syncSchedule(force) {
  if (!swReg || !('caches' in window)) return;
  const now = Date.now(), t = today();
  const items = notifPlan(t, addDays(t, 3)).filter(n => n.at > now && !state.fired[n.id] && !inQuiet(n.at)).slice(0, 60)
    .map(n => ({ id: n.id, at: n.at, title: n.title, body: n.body }));
  const sig = JSON.stringify(items);
  if (!force && sig === schedSig) return;
  schedSig = sig;
  caches.open('sn-data').then(c => c.put('schedule', new Response(JSON.stringify({ items }), { headers: { 'content-type': 'application/json' } }))).catch(() => {});
}
async function registerPeriodic() {
  try {
    if (!swReg || !('periodicSync' in swReg)) return;
    const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (st.state === 'granted') await swReg.periodicSync.register('sn-check', { minInterval: 3 * 3600e3 });
  } catch (e) { /* not supported here */ }
}
function swNotify(n) {
  const opts = { body: n.body, tag: n.id, icon: 'icon-192.png', badge: 'icon-192.png', data: { id: n.id } };
  if (swReg) return swReg.showNotification(n.title, opts).then(() => true, () => false);
  try { const x = new Notification(n.title, opts); x.onclick = () => { window.focus(); NOTI_H.notiOpen(n.id); x.close(); }; return Promise.resolve(true); } catch (e) { return Promise.resolve(false); }
}

/* ---------- calendar export: .ics with alarms (zipped where the viewer saves files) ---------- */
const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
const icsDay = d => d.replace(/-/g, '');
const icsAt = (d, m) => `${icsDay(d)}T${pad(Math.floor(m / 60))}${pad(m % 60)}00`;
function buildICS() {
  const t = today(), stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const alarm = (trigger, text) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(text)}`, `TRIGGER:${trigger}`, 'END:VALARM'];
  const ev = [];
  for (const a of state.cards.filter(x => x.due && diffDays(t, x.due) >= 0)) {
    ev.push(['BEGIN:VEVENT', `UID:due-${a.id}-${icsDay(a.due)}@suhaeng-navi`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${icsDay(a.due)}`, `DTEND;VALUE=DATE:${icsDay(addDays(a.due, 1))}`,
      `SUMMARY:${icsEsc(`[마감] ${a.subject} · ${a.title}`)}`, `DESCRIPTION:${icsEsc([a.dueTime && '제출 ' + a.dueTime, a.method, a.materials.length && '준비물 ' + a.materials.join(', ')].filter(Boolean).join('\n'))}`,
      ...alarm('-PT4H', `내일 마감 · ${a.subject} ${a.title}`), ...alarm('PT7H30M', `오늘 마감 · ${a.subject} ${a.title}`), 'END:VEVENT'].join('\r\n'));
  }
  for (const b of allBlocks().filter(x => diffDays(t, x.date) >= 0 && diffDays(x.date, addDays(t, 13)) >= 0)) {
    const a = find(b.aid), s = stepOf(b);
    if (!a || !s || s.done) continue;
    ev.push(['BEGIN:VEVENT', `UID:plan-${b.aid}-${b.step}-${icsDay(b.date)}-${b.start}@suhaeng-navi`, `DTSTAMP:${stamp}`, `DTSTART:${icsAt(b.date, b.start)}`, `DTEND:${icsAt(b.date, b.end)}`,
      `SUMMARY:${icsEsc(`${a.subject} · ${s.name}`)}`, `DESCRIPTION:${icsEsc(`${a.title} 준비 · 수행 내비 역산 계획`)}`, ...alarm('-PT10M', `10분 뒤 ${s.name}`), 'END:VEVENT'].join('\r\n'));
  }
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//suhaeng-navi//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:수행 내비', ...ev, 'END:VCALENDAR'].join('\r\n') + '\r\n';
}
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, 0, 2], [12, 0x21, 2], [14, crc, 4], [18, sz, 4], [22, sz, 4], [26, name.length, 2], [28, 0, 2]]
      .forEach(([o, v, w]) => (w === 4 ? lh.setUint32(o, v, true) : lh.setUint16(o, v, true)));
    parts.push(new Uint8Array(lh.buffer), name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, 0, 2], [14, 0x21, 2], [16, crc, 4], [20, sz, 4], [24, sz, 4], [28, name.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, off, 4]]
      .forEach(([o, v, w]) => (w === 4 ? ch.setUint32(o, v, true) : ch.setUint16(o, v, true)));
    central.push(new Uint8Array(ch.buffer), name);
    off += 30 + name.length + sz;
  }
  const cd = central.reduce((n, p) => n + p.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cd, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
let downloadsCap;
function getDownloads() {
  if (downloadsCap !== undefined) return Promise.resolve(downloadsCap);
  if (!(window.claude && typeof window.claude.use === 'function')) return Promise.resolve(downloadsCap = null);
  return window.claude.use('downloads').then(d => (downloadsCap = d || null), () => (downloadsCap = null));
}
async function exportCalendar() {
  const data = new TextEncoder().encode(buildICS());
  const dl = await getDownloads();
  if (dl) {
    try { await dl.save({ filename: '수행내비-캘린더.zip', data: zipStore([{ name: 'suhaeng-navi.ics', data }]) }); toast('캘린더 파일을 저장했어요. 압축을 풀고 .ics 파일을 열면 돼요'); }
    catch (e) { if (!e || e.code !== 'declined') toast('이 화면에서는 파일을 저장할 수 없어요. 아래 Google 캘린더 버튼을 써 주세요'); }
    return;
  }
  try {
    const url = URL.createObjectURL(new Blob([data], { type: 'text/calendar' })), a = document.createElement('a');
    a.href = url; a.download = 'suhaeng-navi.ics'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('캘린더 파일을 받았어요. 열면 휴대폰 캘린더에 들어가요');
  } catch (e) { toast('이 화면에서는 파일을 받을 수 없어요'); }
}
const gcalUrl = a => `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`[마감] ${a.subject} · ${a.title}`)}&dates=${icsDay(a.due)}/${icsDay(addDays(a.due, 1))}&details=${encodeURIComponent(`수행 내비 · ${a.method || ''}`.trim())}&ctz=Asia/Seoul`;

/* ---------- install & lock-screen sheet ---------- */
function lockPreview() {
  const now = new Date(), t = today();
  let list = notifPlan(t, addDays(t, 2)).filter(n => n.at > Date.now()).slice(0, 3);
  if (!list.length) list = [{ kind: 'due', title: '내일 마감 · 국어', body: '시 낭송과 감상문 · 준비물 시집', at: Date.now() + 3600e3 }];
  const rel = ms => { const m = Math.round((ms - Date.now()) / 60000); return m < 60 ? `${Math.max(1, m)}분 뒤` : m < 1440 ? `${Math.round(m / 60)}시간 뒤` : '내일'; };
  return `<div class="lock" aria-hidden="true"><div class="lk-wall"><i></i><i></i></div>
    <div class="lk-top"><span class="lk-date">${now.getMonth() + 1}월 ${now.getDate()}일 ${WD[now.getDay()]}요일</span><b class="lk-time num">${pad(now.getHours())}:${pad(now.getMinutes())}</b></div>
    <div class="lk-stack">${list.map((n, i) => `<div class="lk-n" style="--i:${i}"><div class="lk-h">${logoMark(18)}<span>수행 내비</span><small>${rel(n.at)}</small></div><b>${esc(n.title)}</b><p>${esc(n.body)}</p></div>`).join('')}</div></div>`;
}
SHEETS.install = () => {
  const perm = (() => { try { return 'Notification' in window ? Notification.permission : 'none'; } catch (e) { return 'none'; } })();
  const installed = standalone();
  const step = (n, ok, title, desc, action) => `<div class="ins-step${ok ? ' ok' : ''}"><span class="ins-n">${ok ? icon('check') : n}</span><div class="ins-c"><b>${title}</b><p class="small muted">${desc}</p>${action ? `<div class="row" style="margin-top:8px">${action}</div>` : ''}</div></div>`;
  let s1;
  if (installed) s1 = step(1, true, '홈 화면 앱으로 설치됨', '아이콘을 눌러 앱처럼 열 수 있어요.');
  else if (installEvt) s1 = step(1, false, '홈 화면에 설치', '설치하면 주소창 없이 앱처럼 열리고, 오프라인에서도 켜져요.', `<button class="btn btn-pri btn-sm" data-act="pwaInstall">${icon('plus')}설치하기</button>`);
  else if (inFrame) s1 = step(1, false, '앱 주소에서 설치', 'Claude 화면 안에서는 설치 버튼이 나오지 않아요. 앱 주소를 휴대폰 브라우저로 열면 설치할 수 있어요.', `<a class="btn btn-pri btn-sm" href="${APP_URL}" target="_blank" rel="noopener">${icon('next')}앱 주소 열기</a><button class="btn btn-line btn-sm" data-act="pwaCopy">${icon('copy')}주소 복사</button>`);
  else if (isIOS) s1 = step(1, false, 'Safari에서 홈 화면에 추가', '아래쪽 공유 버튼을 누르고 <b>홈 화면에 추가</b>를 고르면 앱이 설치돼요.');
  else s1 = step(1, false, '브라우저 메뉴에서 설치', '주소창 옆 설치 아이콘이나 메뉴의 <b>앱 설치</b>를 누르면 돼요.');
  const s2 = perm === 'granted' && state.notif.system
    ? step(2, true, '잠금 화면 알림 켜짐', swReg ? '앱이 백그라운드에 있어도 정시에 시스템 알림으로 알려 줘요.' : '다른 탭에 있어도 시스템 알림으로 알려 줘요.')
    : step(2, false, '잠금 화면 알림 허용', inFrame ? '설치한 앱에서 허용하면 잠금 화면에 알림이 떠요. Claude 화면 안에서는 브라우저가 이 권한을 막아요.' : '허용하면 계획 시작, 마감, 일정 알림이 잠금 화면에 떠요.',
      inFrame || perm === 'denied' || perm === 'none' ? (perm === 'denied' ? '<span class="chip orange">브라우저 설정에서 알림이 꺼져 있어요</span>' : '') : `<button class="btn btn-pri btn-sm" data-act="pwaNotify">${icon('bell')}알림 허용</button>`);
  const ups = state.cards.filter(a => a.due && diffDays(today(), a.due) >= 0).sort(byDue).slice(0, 4);
  const s3 = step(3, false, '휴대폰 캘린더에도 넣기', '마감과 2주치 계획이 알람과 함께 휴대폰 캘린더에 들어가요. 앱을 닫아도 캘린더가 잠금 화면에 알려 줘요.',
    `<button class="btn btn-line btn-sm" data-act="pwaIcs">${icon('calendar')}캘린더 파일 받기</button>`)
    + (ups.length ? `<div class="ins-g">${ups.map(a => `<a class="gi-link" href="${gcalUrl(a)}" target="_blank" rel="noopener"><span class="tag hue" style="${hueVar(a.subject)}">${esc(a.subject)}</span><span>${esc(a.title)}</span><small>${md(a.due)}</small>${icon('plus')}</a>`).join('')}<p class="tiny faint">하나씩 Google 캘린더에 바로 추가할 수도 있어요.</p></div>` : '');
  return { cls: 'wide', html: `<div class="sheet-h"><div class="row">${logoMark(40)}<div><h3>수행 내비 앱</h3><p class="small faint">설치하고 잠금 화면에서 바로 알림 받기</p></div></div><button class="btn btn-soft btn-icon btn-sm" data-act="closeSheet" aria-label="닫기">${icon('x')}</button></div>
    <div class="ins-grid">${lockPreview()}<div class="ins-steps">${s1}${s2}${s3}</div></div>` };
};

const PWA_H = {
  installSheet() { sheet = { kind: 'install' }; render(); },
  async pwaInstall() { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch (e) { /* dismissed */ } installEvt = null; render(); },
  pwaCopy() { copyText(APP_URL); },
  async pwaNotify() {
    let p = 'denied';
    try { p = await Notification.requestPermission(); } catch (e) { p = 'denied'; }
    state.notif.system = p === 'granted'; save(); render();
    if (p === 'granted') { swNotify({ id: 'hello:' + Date.now(), title: '수행 내비 알림이 켜졌어요', body: '계획 시작, 마감, 일정이 다가오면 여기에 알려 줄게요.' }); registerPeriodic(); syncSchedule(true); }
    else toast('알림이 허용되지 않았어요. 캘린더 연결로도 잠금 화면 알림을 받을 수 있어요');
  },
  pwaIcs() { exportCalendar(); }
};
