/* sw.js - DriveKit Map Tile Cache (TTL 36h) */
const CACHE_NAME = 'drivekit-map-cache-v2'; // Đổi version để xoá cache cũ
const MAP_HOSTS = [
  'api.maptiler.com', 
  'maps.track-asia.com'
];

// Thời gian sống của cache: 36 giờ tính bằng mili-giây
const MAX_AGE = 36 * 60 * 60 * 1000; 

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
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        
        if (cachedResponse) {
          // Kiểm tra thời gian lưu cache
          const cachedAt = cachedResponse.headers.get('sw-cached-at');
          const now = Date.now();
          
          if (cachedAt && (now - parseInt(cachedAt, 10) < MAX_AGE)) {
            // Nếu chưa quá 36h, trả về cache (không tốn mạng)
            return cachedResponse;
          } else {
            // Nếu quá 36h (hoặc không có thẻ thời gian), xoá khỏi cache
            await cache.delete(event.request);
          }
        }
        
        // Nếu chưa có trong cache hoặc đã hết hạn -> Tải từ mạng
        return fetch(event.request).then((networkResponse) => {
          // Chỉ cache các request thành công
          if (networkResponse.status === 200 || networkResponse.status === 0) {
            // Nhân bản response để thêm header thời gian
            const responseToCache = networkResponse.clone();
            
            // Xử lý header để tránh lỗi giải nén (Content-Encoding)
            const headers = new Headers(responseToCache.headers);
            headers.delete('content-encoding');
            headers.delete('content-length');
            headers.set('sw-cached-at', Date.now().toString()); // Lưu thời điểm tải
            
            const modifiedResponse = new Response(responseToCache.body, {
              status: responseToCache.status,
              statusText: responseToCache.statusText,
              headers: headers
            });

            // Lưu vào cache với thông tin thời gian
            cache.put(event.request, modifiedResponse);
          }
          return networkResponse;
        });
      })
    );
  }
});
