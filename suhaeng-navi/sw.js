/* 수행 내비 service worker: keeps the installed app working offline, shows reminders as
   system notifications (they reach the lock screen), and checks for due reminders when the
   browser wakes an installed app in the background. */
const CACHE = 'sn-shell-v5';
const SHELL = ['app.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'base.css', 'views.css', 'cal.css', 'extra.css', 'motion.css',
  'cal.js', 'core.js', 'ai.js', 'ui.js', 'fx.js', 'member.js', 'views1.js', 'views2.js', 'views3.js', 'study.js', 'calview.js', 'notify.js', 'pwa.js', 'main.js'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('sn-shell') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* stale-while-revalidate for the app's own files */
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(c => c.match(e.request, { ignoreSearch: true }).then(hit => {
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  })));
});

const show = n => self.registration.showNotification(n.title, { body: n.body, tag: n.id, icon: 'icon-192.png', badge: 'icon-192.png', data: { id: n.id } });
async function dueNow() {
  const c = await caches.open('sn-data'), r = await c.match('schedule');
  if (!r) return;
  const data = await r.json(), now = Date.now();
  let changed = false;
  for (const n of data.items || []) {
    if (n.shown || n.at > now) continue;
    if (now - n.at < 6 * 3600e3) await show(n);
    n.shown = true; changed = true;
  }
  if (changed) await c.put('schedule', new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } }));
}
self.addEventListener('periodicsync', e => { if (e.tag === 'sn-check') e.waitUntil(dueNow()); });
self.addEventListener('sync', e => { if (e.tag === 'sn-check') e.waitUntil(dueNow()); });
self.addEventListener('push', e => { e.waitUntil(dueNow()); });
self.addEventListener('message', e => { if (e.data && e.data.type === 'check') e.waitUntil(dueNow()); });
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const id = e.notification.data && e.notification.data.id;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) { c.postMessage({ type: 'open', id }); return c.focus(); }
    return self.clients.openWindow('app.html');
  }));
});
