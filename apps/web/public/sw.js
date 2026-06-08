// Pasha 9 web push service worker.
// Handles incoming `push` events from the VAPID dispatcher and routes
// the visitor to the configured linkUrl on tap. Keeps the surface
// area intentionally small so the worker never throws an unhandled
// error during a push handler.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (_err) {
      try {
        payload = { title: event.data.text() };
      } catch (_inner) {
        payload = {};
      }
    }
  }

  const title = payload.title || 'Pasha 9';
  const body = payload.body || '';
  const icon = payload.iconUrl || '/favicon.svg';
  const image = payload.imageUrl || undefined;
  const linkUrl = payload.linkUrl || '/';
  const tag = payload.notificationId || undefined;

  const options = {
    body,
    icon,
    badge: '/favicon.svg',
    image,
    data: { linkUrl, notificationId: payload.notificationId || null, recipientId: payload.recipientId || null },
    tag,
    renotify: !!tag,
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const linkUrl = data.linkUrl || '/';

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const targetUrl = new URL(linkUrl, self.registration.scope).href;

    for (const client of all) {
      try {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      } catch (_err) {
        // ignore and continue
      }
    }
    for (const client of all) {
      try {
        if ('focus' in client && 'navigate' in client) {
          await client.navigate(targetUrl);
          return client.focus();
        }
      } catch (_err) {
        // ignore and try next
      }
    }
    if (self.clients.openWindow) {
      return self.clients.openWindow(targetUrl);
    }
  })());
});
