// Built by Anointed Coder.
// FCM background service worker for ADMIN phone push. Separate scope
// from the player web-push worker (public/sw.js). Firebase config is
// passed in via the registration query string so env stays the single
// source of truth. Renders data-only messages with sound + vibration
// and routes taps to the admin link.

const FB_SDK_VERSION = '12.14.0';
importScripts(`https://www.gstatic.com/firebasejs/${FB_SDK_VERSION}/firebase-app-compat.js`);
importScripts(`https://www.gstatic.com/firebasejs/${FB_SDK_VERSION}/firebase-messaging-compat.js`);

const params = new URL(self.location).searchParams;
const firebaseConfig = {
  apiKey: params.get('apiKey') || '',
  authDomain: params.get('authDomain') || '',
  projectId: params.get('projectId') || '',
  storageBucket: params.get('storageBucket') || '',
  messagingSenderId: params.get('messagingSenderId') || '',
  appId: params.get('appId') || '',
};

let messaging = null;
try {
  firebase.initializeApp(firebaseConfig);
  messaging = firebase.messaging();
} catch (err) {
  // If config is missing the worker still installs; it just won't
  // render background messages. The enable flow guards against this.
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function showFromData(data) {
  const d = data || {};
  const title = d.title || 'Pasha 9';
  const options = {
    body: d.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: d.kind || undefined,
    renotify: !!d.kind,
    requireInteraction: d.priority === 'high',
    vibrate: [200, 100, 200],
    data: { linkUrl: d.linkUrl || '/admin', kind: d.kind || null, notificationId: d.notificationId || null },
  };
  return self.registration.showNotification(title, options);
}

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    showFromData(payload && payload.data);
  });
}

// Fallback: some platforms (and any non-FCM-wrapped push) deliver a
// raw push event. Render it too, guarding against a double-show when
// onBackgroundMessage already handled an FCM payload.
self.addEventListener('push', (event) => {
  let parsed = null;
  try {
    parsed = event.data ? event.data.json() : null;
  } catch (_e) {
    parsed = null;
  }
  // FCM payloads are handled by onBackgroundMessage; only render here
  // when this is a bare data push not wrapped by FCM.
  if (parsed && parsed.data && !parsed.from) {
    event.waitUntil(showFromData(parsed.data));
  } else if (parsed && parsed.title && !parsed.from) {
    event.waitUntil(showFromData(parsed));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const linkUrl = (event.notification.data && event.notification.data.linkUrl) || '/admin';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const targetUrl = new URL(linkUrl, self.registration.scope).href;
    for (const client of all) {
      if (client.url === targetUrl && 'focus' in client) return client.focus();
    }
    for (const client of all) {
      if ('focus' in client && 'navigate' in client) {
        try { await client.navigate(targetUrl); return client.focus(); } catch (_e) { /* next */ }
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
  })());
});
