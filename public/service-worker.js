/* ==========================================================
 * OrbWidget Service Worker
 * 离线缓存 + 应用安装支持 + 后台同步
 * ========================================================== */

const CACHE_VERSION = 'orb-v1.1.0';
const STATIC_CACHE = `orb-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `orb-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/orb.js',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

/* ---------- Install: 预缓存核心资源 ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        cache.addAll(
          PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' }))
        )
      )
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[SW] precache partial fail:', err))
  );
});

/* ---------- Activate: 清理旧版本缓存 ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ---------- Fetch: 缓存优先 + 网络回退 ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // HTML/Navigation: Network First，失败回退到缓存
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then(
            (cached) => cached || caches.match('/index.html')
          )
        )
    );
    return;
  }

  // 同源静态资源（CSS/JS/图片）：Cache First
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            if (!res || res.status !== 200 || res.type === 'opaqueredirect') {
              return res;
            }
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
            return res;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // 跨域资源（未来扩展）：Stale While Revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

/* ---------- Message: 与前端通信（触发更新、跳过低版本等） ---------- */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ---------- Push: 预留推送消息支持（需配置 VAPID） ---------- */
self.addEventListener('push', (event) => {
  let data = { title: '炫彩浮球', body: '有新内容等你查看 ✨' };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (_) {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [80, 40, 80],
      data: { url: data.url || '/' },
      tag: 'orb-widget-notif',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus();
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(event.notification.data.url || '/');
        }
      })
  );
});
