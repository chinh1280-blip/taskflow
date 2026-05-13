// TaskFlow Service Worker v4 — Scheduled Background Notifications
const SW_VERSION = 'taskflow-v4';

// Store scheduled alarms in SW memory
let scheduledAlarms = [];
let alarmInterval = null;

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(clients.claim()); });

// ── Handle web push (server → device, works when app closed) ──
self.addEventListener('push', e => {
  if (!e.data) return;
  let data;
  try { data = e.data.json(); }
  catch { data = { title: '🔔 TaskFlow', body: e.data.text() }; }
  // Ghép subtitle vào body nếu có (iOS Web Push không support subtitle field riêng)
  const fullBody = data.subtitle
    ? `${data.subtitle}\n${data.body || ''}`
    : (data.body || '')

  e.waitUntil(
    self.registration.showNotification(data.title || '🔔 Reminder', {
      body: fullBody,
      icon: '/taskflow/icon-192.png',
      tag: data.tag || 'taskflow',
      requireInteraction: true,
      data: { url: self.registration.scope },
    })
  );
});

// ── Notification click ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) { c.focus(); return; } }
      return clients.openWindow(e.notification.data?.url || self.registration.scope);
    })
  );
});

// ── Message from app ──
self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE_NOTIFICATIONS') {
    scheduledAlarms = e.data.schedule || [];
    startAlarmTick();
  }
  if (e.data?.type === 'CHECK_REMINDERS') {
    // Legacy check
    checkNow(e.data.reminders || [], e.data.cfg || {});
  }
});

// ── Alarm tick: check every 30s ──
function startAlarmTick() {
  if (alarmInterval) clearInterval(alarmInterval);
  alarmInterval = setInterval(tickAlarms, 30000);
  tickAlarms(); // immediate check
}

function tickAlarms() {
  const now = Date.now();
  const fired = [];
  scheduledAlarms.forEach(alarm => {
    if (alarm.fireAt <= now && alarm.fireAt > now - 90000) {
      fireAlarm(alarm);
      fired.push(alarm.id + (alarm.isEarly ? '-early' : '-due'));
    }
  });
  // Remove fired alarms
  if (fired.length) {
    scheduledAlarms = scheduledAlarms.filter(a =>
      !fired.includes(a.id + (a.isEarly ? '-early' : '-due'))
    );
  }
}

function fireAlarm(alarm) {
  const h = Math.floor((alarm.leadMin||0)/60);
  const m = (alarm.leadMin||0) % 60;
  const leadStr = alarm.leadMin > 0
    ? (h > 0 ? (m > 0 ? `${h}g${m}ph` : `${h}h`) : `${m}ph`) + ' nữa'
    : null;

  const title = alarm.isEarly ? `⏰ ${alarm.name}` : `🔔 ${alarm.name}`;
  const body  = alarm.isEarly
    ? `Còn ${leadStr} — ${alarm.isDaily ? '🔁 Hằng ngày' : '📋 Nhắc nhở'}`
    : `${alarm.isDaily ? '🔁 Hằng ngày' : '📋 Nhắc nhở'} — Đến hạn rồi!`;

  self.registration.showNotification(title, {
    body,
    icon: '/taskflow/icon-192.png',
    tag: `reminder-${alarm.id}-${alarm.isEarly ? 'early' : 'due'}`,
    requireInteraction: true,
    data: { url: self.registration.scope },
    actions: [
      { action: 'done',    title: '✓ Xong' },
      { action: 'dismiss', title: '✕ Bỏ qua' }
    ]
  });
}

// Legacy check
function checkNow(reminders, cfg) {
  if (!cfg.enabled) return;
  const now = Date.now();
  reminders.forEach(r => {
    if (r.done) return;
    if (r.is_daily && !cfg.dailyReminders) return;
    if (!r.is_daily && !cfg.normalReminders) return;
    const stored = new Date(r.remind_at);
    let targetMs;
    if (r.is_daily) {
      const today = new Date();
      today.setHours(stored.getHours(), stored.getMinutes(), 0, 0);
      targetMs = today.getTime();
    } else {
      targetMs = stored.getTime();
    }
    if (Math.abs(targetMs - now) < 90000) {
      self.registration.showNotification(`🔔 ${r.name}`, {
        body: `${r.is_daily ? '🔁 Hằng ngày' : '📋'} — Đến hạn!`,
        tag: `reminder-${r.id}-due`,
        requireInteraction: true,
        icon: '/taskflow/icon-192.png',
      });
    }
  });
}
