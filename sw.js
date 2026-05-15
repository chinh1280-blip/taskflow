// TaskFlow Service Worker v5
// Chỉ nhận push từ Supabase Edge Function (server push)
// Không tự fire local alarms nữa (tránh duplicate)

self.addEventListener('install', e => {
  console.log('[SW] v5 install');
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('[SW] v5 activate');
  e.waitUntil(clients.claim());
});

// ── Push từ server (Supabase Edge Function → Apple APNs → iPhone) ──
self.addEventListener('push', e => {
  if (!e.data) return;
  let data;
  try { data = e.data.json(); }
  catch { data = { title: '🔔 TaskFlow', body: e.data.text() }; }

  // Format: title = "⚠️ Đến hạn rồi", body = "Daily report for boss"
  e.waitUntil(
    self.registration.showNotification(data.title || '🔔 Nhắc nhở', {
      body:             data.body || '',
      icon:             '/taskflow/icon-192.png',
      badge:            '/taskflow/icon-192.png',
      tag:              data.tag  || 'taskflow-reminder',
      requireInteraction: true,
      data:             { url: self.registration.scope },
    })
  );
});

// ── Notification click → mở app ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) { c.focus(); return; }
      }
      return clients.openWindow(e.notification.data?.url || self.registration.scope);
    })
  );
});

// ── Message từ app — chỉ log, không tự fire ──
self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE_NOTIFICATIONS') {
    console.log('[SW] Schedule received:', e.data.schedule?.length, 'alarms (server push only)');
  }
  if (e.data?.type === 'CHECK_REMINDERS') {
    console.log('[SW] Check reminders (server push only, ignored)');
  }
});
