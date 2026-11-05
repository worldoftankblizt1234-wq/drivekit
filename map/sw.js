/* sw.js - DriveKit Map Tile Cache */
const CACHE_NAME = 'drivekit-map-cache-v1';
const MAP_HOSTS = [
  'api.maptiler.com', 
  'maps.track-asia.com'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Chỉ cache các request lấy bản đồ (tiles) từ MapTiler và TrackAsia
  if (MAP_HOSTS.some(host => url.hostname.includes(host))) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response) {
            // Nếu có trong cache thì trả về luôn (không gọi mạng)
            return response;
          }
          // Nếu chưa có thì gọi mạng, tải xong thì lưu vào cache
          return fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
  }
});
