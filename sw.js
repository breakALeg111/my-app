/* 离线缓存：HTML 走网络优先，静态资源走缓存优先 */
var CACHE = 'dailyhub-v1';
var INDEX = './index.html';

var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/utils.js',
  './js/storage.js',
  './js/store.js',
  './js/ui.js',
  './js/cosync.js',
  './js/diary.js',
  './js/events.js',
  './js/care.js',
  './js/dataio.js',
  './js/settings.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .catch(function (err) { console.warn('预缓存失败', err); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 页面：网络优先，失败回落缓存
  if (req.mode === 'navigation' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(INDEX, copy); });
        return res;
      }).catch(function () {
        return caches.match(INDEX).then(function (r) { return r || caches.match('./'); });
      })
    );
    return;
  }

  // 其他资源：缓存优先
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
