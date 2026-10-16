/* عامل الخدمة — موقع صفة الصلاة (يعمل دون اتصال بالكامل)
 * الاستراتيجيات (مكافئة لما يفعله vite-plugin-pwa / Workbox يدويًا):
 * - الصفحات (التنقل): الشبكة أولًا ثم التخزين المؤقت ثم index.html
 * - الملفات المحلية (خطوط، أيقونات، CSS): التخزين أولًا ثم الشبكة
 * - مسارات تسجيل الدخول وروابط OAuth مستثناة دائمًا (لا تُخزَّن ولا تُعترَض)
 */
const VERSION = 'salat-v1';
const STATIC_CACHE = VERSION + '-static';
const RUNTIME_CACHE = VERSION + '-runtime';

const CORE = [
  './',
  './index.html',
  './quiz.html',
  './manifest.webmanifest',
  './fonts/fonts.css',
  './fonts/Amiri-normal-400-arabic.woff2',
  './fonts/Amiri-normal-400-latin.woff2',
  './fonts/Amiri-normal-400-latin-ext.woff2',
  './fonts/Amiri-normal-700-arabic.woff2',
  './fonts/Amiri-normal-700-latin.woff2',
  './fonts/Amiri-normal-700-latin-ext.woff2',
  './fonts/Amiri-italic-400-arabic.woff2',
  './fonts/Amiri-italic-400-latin.woff2',
  './fonts/Amiri-italic-400-latin-ext.woff2',
  './fonts/Tajawal-normal-400-arabic.woff2',
  './fonts/Tajawal-normal-400-latin.woff2',
  './fonts/Tajawal-normal-500-arabic.woff2',
  './fonts/Tajawal-normal-500-latin.woff2',
  './fonts/Tajawal-normal-700-arabic.woff2',
  './fonts/Tajawal-normal-700-latin.woff2',
  './fonts/Tajawal-normal-800-arabic.woff2',
  './fonts/Tajawal-normal-800-latin.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];

function isAuthPath(url) {
  // استثناء مسارات تسجيل الدخول وروابط OAuth (غير موجودة حاليًا — حماية مستقبلية)
  return /(^|\/)(login|signin|sign-in|signup|sign-up|auth|oauth|account|callback)(\/|$)/i.test(url.pathname) ||
    /oauth/i.test(url.pathname + url.search);
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) { return cache.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k.indexOf('salat-') === 0 && k !== STATIC_CACHE && k !== RUNTIME_CACHE) {
          return caches.delete(k);
        }
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;
  let url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (isAuthPath(url)) return; // تسجيل الدخول و OAuth: شبكة مباشرة دون تخزين

  // 1) الصفحات: الشبكة أولًا
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(function (res) {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then(function (c) { c.put(request, copy); });
        return res;
      }).catch(function () {
        return caches.match(request).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // 2) الملفات المحلية: التخزين أولًا
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(function (hit) {
        if (hit) return hit;
        return fetch(request).then(function (res) {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then(function (c) { c.put(request, copy); });
          return res;
        });
      })
    );
    return;
  }

  // 3) أي مصدر خارجي آخر: شبكة مباشرة دون تخزين
});
