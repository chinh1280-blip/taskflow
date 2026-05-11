// TaskFlow Service Worker — Web Push + Local Notifications
const SW_VERSION = 'taskflow-v2';

self.addEventListener('install', e => {
  console.log('[SW] Install');
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('[SW] Activate');
  e.waitUntil(clients.claim());
});

// Handle web push (when app is closed)
self.addEventListener('push', e => {
  console.log('[SW] Push received');
  if (!e.data) return;
  let data;
  try { data = e.data.json(); } 
  catch { data = { title: '🔔 TaskFlow', body: e.data.text() }; }

  e.waitUntil(
    self.registration.showNotification(data.title || '🔔 TaskFlow Reminder', {
      body:    data.body || '',
      icon:    data.icon || '/taskflow/icon.svg',
      badge:   '/taskflow/icon.svg',
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

// Notification click → open/focus app
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

// Message from app → check reminders and fire local notification
self.addEventListener('message', e => {
  if (e.data?.type !== 'CHECK_REMINDERS') return;
  const reminders = e.data.reminders || [];
  const now = Date.now();
  reminders.forEach(r => {
    if (r.done) return;
    const t = new Date(r.remind_at).getTime();
    if (Math.abs(t - now) < 65000) {   // within 65s of reminder time
      self.registration.showNotification('🔔 ' + r.name, {
        body: '⏰ Đến giờ nhắc nhở!',
        tag:  'reminder-' + r.id,
        requireInteraction: true,
      });
    }
  });
});
