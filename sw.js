// Service Worker for Web Push Notifications — TaskFlow
const CACHE = 'taskflow-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Handle push notification
self.addEventListener('push', e => {
  if (!e.data) return;
  let data;
  try { data = e.data.json(); } catch { data = {title:'TaskFlow', body: e.data.text()}; }
  e.waitUntil(
    self.registration.showNotification(data.title || '🔔 TaskFlow Reminder', {
      body:    data.body  || '',
      icon:    data.icon  || '/taskflow/icon-192.png',
      badge:   data.badge || '/taskflow/icon-192.png',
      tag:     data.tag   || 'taskflow-reminder',
      data:    data.data  || {},
      requireInteraction: true,
      actions: [
        { action: 'view',    title: 'Xem ngay' },
        { action: 'dismiss', title: 'Bỏ qua'   }
      ]
    })
  );
});

// Click notification → open app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  e.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(list => {
      for (const client of list) {
        if (client.url.includes('taskflow') && 'focus' in client) return client.focus();
      }
      return clients.openWindow('https://chinh1280-blip.github.io/taskflow/');
    })
  );
});

// Schedule local push checks (runs every minute when SW active)
self.addEventListener('message', e => {
  if (e.data?.type === 'CHECK_REMINDERS') {
    checkRemindersAndNotify(e.data.reminders);
  }
});

function checkRemindersAndNotify(reminders) {
  if (!reminders?.length) return;
  const now = Date.now();
  reminders.forEach(r => {
    if (r.done) return;
    const t = new Date(r.remind_at).getTime();
    // Within 1 minute of reminder time
    if (Math.abs(t - now) < 60000) {
      self.registration.showNotification('🔔 ' + r.name, {
        body: 'Đến giờ nhắc nhở rồi!',
        tag:  'reminder-' + r.id,
        requireInteraction: true,
      });
    }
  });
}
