// TaskFlow Service Worker v3 — Web Push + Lead-time Notifications
const SW_VERSION = 'taskflow-v3';

self.addEventListener('install', e => {
  console.log('[SW] Install v3');
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('[SW] Activate v3');
  e.waitUntil(clients.claim());
});

// ── Handle web push (when app is CLOSED) ──
self.addEventListener('push', e => {
  if (!e.data) return;
  let data;
  try { data = e.data.json(); }
  catch { data = { title: '🔔 TaskFlow', body: e.data.text() }; }
  e.waitUntil(
    self.registration.showNotification(data.title || '🔔 TaskFlow Reminder', {
      body:    data.body || '',
      icon:    data.icon || '/taskflow/icon-192.png',
      badge:   '/taskflow/icon-192.png',
      tag:     data.tag  || 'taskflow',
      data:    { url: data.url || self.registration.scope },
      requireInteraction: true,
      actions: [
        { action: 'view',    title: '📋 Xem ngay' },
        { action: 'dismiss', title: '✕ Bỏ qua'   }
      ]
    })
  );
});

// ── Notification click → open/focus app ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const url = e.notification.data?.url || self.registration.scope;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) { c.focus(); return; }
      }
      return clients.openWindow(url);
    })
  );
});

// ── Message from app → schedule local notifications ──
self.addEventListener('message', e => {
  if (e.data?.type !== 'CHECK_REMINDERS') return;
  const reminders = e.data.reminders || [];
  const cfg = e.data.cfg || { enabled:true, normalReminders:true, dailyReminders:true, leadMinutes:0 };
  if (!cfg.enabled) return;
  checkAndFireNotifications(reminders, cfg);
});

function getDailyEffectiveTime(r) {
  if (!r.is_daily) return new Date(r.remind_at).getTime();
  const stored = new Date(r.remind_at);
  const today = new Date();
  today.setHours(stored.getHours(), stored.getMinutes(), 0, 0);
  return today.getTime();
}

function checkAndFireNotifications(reminders, cfg) {
  const now = Date.now();
  const WINDOW = 90000; // 90 seconds window to fire

  reminders.forEach(r => {
    if (r.done) return;
    // Filter by type
    if (r.is_daily && !cfg.dailyReminders) return;
    if (!r.is_daily && !cfg.normalReminders) return;

    const targetMs = getDailyEffectiveTime(r);
    const leadMs = (cfg.leadMinutes || 0) * 60000;

    // Early warning
    if (leadMs > 0) {
      const earlyMs = targetMs - leadMs;
      if (Math.abs(earlyMs - now) < WINDOW) {
        const h = Math.floor(cfg.leadMinutes/60);
        const m = cfg.leadMinutes % 60;
        const leadStr = h > 0 ? (m > 0 ? `${h}g${m}ph` : `${h}h`) : `${m}ph`;
        self.registration.showNotification(`⏰ ${r.name}`, {
          body: `Còn ${leadStr} nữa — ${r.is_daily ? '🔁 Hằng ngày' : '📋 Nhắc nhở'}`,
          tag: `reminder-${r.id}-early`,
          requireInteraction: true,
          icon: '/taskflow/icon-192.png',
        });
      }
    }

    // On-time notification
    if (Math.abs(targetMs - now) < WINDOW) {
      self.registration.showNotification(`🔔 ${r.name}`, {
        body: `${r.is_daily ? '🔁 Hằng ngày' : '📋 Nhắc nhở'} — Đến hạn rồi!`,
        tag: `reminder-${r.id}-due`,
        requireInteraction: true,
        icon: '/taskflow/icon-192.png',
      });
    }
  });
}
