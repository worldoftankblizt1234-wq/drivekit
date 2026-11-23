/* =====================================================
   DriveKit - app.js FULL - 2026-11-22
   File duy nhat, thay cho viec noi v4 + v5 + v6 + v7 le te
   Gom:
   - Base: off-route popup (lech huong -> hoi doi huong), search pill + hamburger,
     bottom sheet 5 nut premium, top bar + sheet map var(--...) trong styles.css
   - V5: fix Located Me - tra lai nut Vi tri, ngoai bottom sheet
   - V6: fix La ban - tra lai nut #btnCompass, ngoai bottom sheet
   - V7: Sheet noi + Cum FAB dinh lien - La ban + Vi tri vao 1 pill trai (gap 2px),
     Layers + Bao cao + Tram dung vao 1 pill phai, sheet floating bo 28px
   Cach dung:
   - Thay file app.js cu bang file nay (1 file duy nhat)
   - Dung kem styles.css FULL moi nhat (da co V7)
   - KHONG can them v5/v6/v7 rieng nua - da gop san trong nay
   Thu tu chay trong file: Base (v4) -> V5 -> V6 -> V7 (V7 thang, ghi de CSS loi bottom:auto cua v4)
   ===================================================== */
/* =====================================================
   CLEANUP QUY MO LON - 2026-11-22
   Tu 9.894 -> con ~7.100 dong (giam ~2.800 dong, ~28%)
   Nguyen tac: GIU BAN CUOI CUNG THANG, XOA BAN CU BI GHI DE.
   - Minimap: da bo, chi giu 1 stub return null (xoa 3 bo ensureNavMinimap/Passive/WithControls + frame + keo + X)
   - White-arrow: chi giu ban moi nhat (cong theo goc re, fill trang), xoa V2/V3 cu
   - Doi tuyen: chi giu V8 preview 1-2-3 (Bam Chi duong -> preview -> chon -> Bat dau), xoa block "BO doi tuyen thu cong" xung dot V8
   - Top bar + Bottom sheet: chi giu FINAL v3 Premium + v4 map styles.css, xoa FINAL v2 + migration cu
   - FAB / La ban / Vi tri: chi giu V5 + V6 + V7 cluster, xoa watchdog + fix FAB mat cu
   - Recenter / Free map / Dark mode: chi giu V6/V7 + styles.css, xoa 4-5 ban fix trung nhau
   - Khong doi ten ham, khong doi thu tu chay: Core (Part 1+2) -> Google Nav -> White-arrow moi -> EndTrip -> Guard -> FINAL v3/v4 -> V5/V6/V7/V8
   Da xoa:
- L8243-8660 (418 dong): FINAL v2 Top bar + Bottom sheet cu - FINAL v3 Premium thay the, giu v3
- L7901-8242 (342 dong): BO doi tuyen thu cong + FIX mat nut + BO nut nga 3 + FIX 2 LOI - XUNG DOT V8, V8 cho chon tay trong preview
- L7560-7725 (166 dong): FIX bo han Minimap + map tu do - V6/V7 thay the
- L7406-7559 (154 dong): FIX FAB mat + Dark mode search - V7 cluster + styles.css thay the
- L7308-7405 (98 dong): FIX sau ket thuc tuyen banner + minimap frame - FINAL thay the
- L7120-7307 (188 dong): FIX banner + minimap goc duoi-trai - Minimap da bo, banner da co o Google Nav
- L6912-7119 (208 dong): FIX 4 LOI minimap keo + doi tuyen - V6/V7/V8 thay the
- L6545-6770 (226 dong): Migration La ban / bottom sheet / layer popup cu - FINAL v3/v4 thay the
- L5665-5910 (246 dong): Khoi phuc HUD + giu Minimap - Minimap da bo
- L4194-4332 (139 dong): Patch Claude sync input + openAlternativeRoutes cu - V8 fetchPreview thay the
- L4039-4193 (155 dong): V4 Xem tat ca tuyen + Minimap - da co V8 preview 1-2-3
- L3644-4038 (395 dong): Minimap V1/V2 + white-arrow V3 cu - da co white-arrow moi o 5911
   Giua lai 1 dong quan trong tu patch Claude bi xoa:
   - VEHICLE_TYPE_MAP['hd'] = 'car' (Xe CN truoc day bi nham la 'motorcycle')
   ===================================================== */
try{ if (typeof VEHICLE_TYPE_MAP !== 'undefined') VEHICLE_TYPE_MAP['hd'] = 'car'; }catch(e){}
/* Minimap: 1 stub duy nhat, code cu goi khong loi */
function __cleanMinimapStub(){ return null; }
try{ if (typeof ensureNavMinimap === 'undefined') var ensureNavMinimap = __cleanMinimapStub; }catch(e){}
try{ if (typeof window !== 'undefined'){ window.ensureNavMinimap = window.ensureNavMinimap || __cleanMinimapStub; window.ensureNavMinimapPassive = window.ensureNavMinimapPassive || __cleanMinimapStub; window.ensureNavMinimapWithControls = window.ensureNavMinimapWithControls || __cleanMinimapStub; window.syncRouteToMinimap = window.syncRouteToMinimap || function(){}; window.syncUserToMinimap = window.syncUserToMinimap || function(){}; } }catch(e){}

/* =====================================================
   DriveKit — app.js FULL (ĐÃ SYNC DEMO MAPILLARY + FIX)
   Part 1: Config → Route → Navigation
   ===================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, set, get, onValue, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, onSnapshot, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAYxZYEnoxtzpUMaYfQXYWF3lojUX51R48",
  authDomain: "drivekit-c88ef.firebaseapp.com",
  databaseURL: "https://drivekit-c88ef-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "drivekit-c88ef",
  storageBucket: "drivekit-c88ef.firebasestorage.app",
  messagingSenderId: "1073887619343",
  appId: "1:1073887619343:web:d89a872968bc4ee871f67a"
};
/* [V4] Firebase init có guard: nếu initializeApp/getAuth/getFirestore lỗi,
   module vẫn load để bản đồ chạy được, chỉ mất dữ liệu cloud. Các handle
   giữ nguyên tên (app/auth/db/fsdb), chỉ đổi const -> let + null khi lỗi.
   Lỗi ghi vào window.__drivekitFirebaseError để loader/debug xem được. */
let app = null, auth = null, db = null, fsdb = null;
let firebaseInitError = null;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);
  fsdb = getFirestore(app);
} catch (e) {
  firebaseInitError = e;
  try { console.warn('[DriveKit] Firebase init failed, running map-only:', e); } catch (_) {}
  try { window.__drivekitFirebaseError = e; } catch (_) {}
}

/* [V2-Nhom1] Bao mat mang mat / co lai: chi toast, khong doi luong dang nhap hay ban do. */
try {
  window.addEventListener('offline', function(){ try{ if (typeof showCustomToast === 'function') showCustomToast('Mất kết nối mạng. Bản đồ và dẫn đường có thể không cập nhật.', 'warning'); }catch(e){} });
  window.addEventListener('online', function(){ try{ if (typeof showCustomToast === 'function') showCustomToast('Đã có mạng trở lại.', 'success'); }catch(e){} });
} catch(e) {}

/* ========== WORKER CONFIG ========== */
/* ============================================================
   SECURE: MapTiler / TrackAsia keys KHONG con nam o frontend.
   Frontend chi goi Worker: /api/style?provider=...
   Key that o Worker env, khong co trong file nay.
   Neu thay bat ky chuoi key nao o frontend -> la loi, phai xoa ngay.
   ============================================================ */
const WORKER_URL = 'https://map-birthday.anhminhadof123.workers.dev';
const MAPTILER_STYLE = `${WORKER_URL}/api/style?provider=maptiler`;
const TRACKASIA_STYLE = `${WORKER_URL}/api/style?provider=trackasia`;
const NEARBY_API_URL = 'https://potential-space-trout-p7r7pgrjwjvw26g6j-8000.app.github.dev/api/nearby';

/* ========== MAPILLARY SIGNS ========== */
const MAPILLARY_VTP_URL = (z, x, y) => `${WORKER_URL}/api/mapillary-tiles/${z}/${x}/${y}`;
const MAPILLARY_SIGN_BASE = 'https://cdn.jsdelivr.net/gh/worldoftankblizt1234-wq/drivekit@main/map/mapillary_signs';
const TRAFFIC_SIGN_SOURCE_ID = 'mapillary-traffic-signs';
const TRAFFIC_SIGN_LAYER_ID  = 'mapillary-traffic-signs-layer';

// Cache ảnh biển báo + fallback
const _loadingSignIcons = new Map();
let _fallbackSignImageData = null;
let _signPreloadTimer = null;

// Cài đặt hiển thị biển (persist)
function safeParse(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch (e) { return fallback; } }
const signDisplaySettings = safeParse('drivekit_sign_display', {
  show: true,
  speedOnly: false,
  size: 'medium'
});

function getSignIconSize() {
  if (signDisplaySettings.size === 'small') return 0.7;
  if (signDisplaySettings.size === 'large') return 1.4;
  return 1.0;
}

function getFallbackSignImageData() {
  if (_fallbackSignImageData) return _fallbackSignImageData;
  const size = 32;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ef4444';
  ctx.beginPath(); ctx.arc(size/2, size/2, size/2 - 2, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('?', size/2, size/2);
  _fallbackSignImageData = ctx.getImageData(0, 0, size, size);
  return _fallbackSignImageData;
}

/* ========== [SYNC DEMO] ICON LOADER — rasterize SVG → RGBA ========== */
const DEFAULT_SIGN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
  '<circle cx="16" cy="16" r="14" fill="#e63946" stroke="#ffffff" stroke-width="2.5"/></svg>';

const CATEGORY_COLORS = {
  regulatory: '#d62828', warning: '#fcbf49',
  information: '#003049', complementary: '#003049'
};

function svgToDataUri(svg) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
function makeFallbackSvg(v) {
  const cat = (v || '').split('--')[0] || 'regulatory';
  const color = CATEGORY_COLORS[cat] || '#e63946';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
    `<circle cx="16" cy="16" r="14" fill="${color}" stroke="#fff" stroke-width="2.5"/>` +
    '<circle cx="16" cy="16" r="8" fill="#fff" fill-opacity="0.25"/></svg>';
}

function loadSvgAsImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`load fail: ${url}`));
    img.src = url;
  });
}

async function rasterizeSvg(url, size = 48) {
  const img = await loadSvgAsImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size);
  return { width: size, height: size, data: new Uint8Array(data.data.buffer) };
}

async function ensureSignIcon(code) {
  if (!code || typeof code !== 'string') return null;
  if (map.hasImage(code)) return code;
  if (_loadingSignIcons.has(code)) return _loadingSignIcons.get(code);

  const promise = (async () => {
    try {
      const raster = await rasterizeSvg(`${MAPILLARY_SIGN_BASE}/${code}.svg`, 48);
      if (!map.hasImage(code)) map.addImage(code, raster, { sdf: false });
      return code;
    } catch (err) {
      try {
        const fbUrl = svgToDataUri(makeFallbackSvg(code));
        const raster = await rasterizeSvg(fbUrl, 48);
        if (!map.hasImage(code)) map.addImage(code, raster, { sdf: false });
        return code;
      } catch (e2) {
        if (!map.hasImage('sign-fallback')) {
          try { map.addImage('sign-fallback', getFallbackSignImageData()); } catch(e) {}
        }
        return 'sign-fallback';
      }
    } finally {
      _loadingSignIcons.delete(code);
    }
  })();

  _loadingSignIcons.set(code, promise);
  return promise;
}

let _drivekitSignPreloadLast = 0;
function preloadVisibleSignIcons() {
  if (!map || !map.getSource(TRAFFIC_SIGN_SOURCE_ID)) return;
  /* [V2-Nhom3] Chi preload khi zoom >= 14 (minzoom cua source), throttle ~500ms, toi da 40 icon/lan. */
  try { if (map.getZoom && map.getZoom() < 14) return; } catch(e) {}
  const _pn = Date.now(); if (_pn - _drivekitSignPreloadLast < 500) return; _drivekitSignPreloadLast = _pn;
  let features = [];
  try { features = map.querySourceFeatures(TRAFFIC_SIGN_SOURCE_ID, { sourceLayer: 'traffic_sign' }); } catch(e) { return; }
  const codes = new Set();
  features.forEach(f => {
    const p = f.properties || {};
    const v = p.object_value || p.value;
    if (v && typeof v === 'string') codes.add(v);
  });
  Array.from(codes).slice(0, 40).forEach(ensureSignIcon);
}

// [FIX] Add layer NGAY sau addSource — không đợi sourcedata (sourcedata metadata về trước khi tile về,
// querySourceFeatures lúc đó = [] nên bản cũ preload 0 icon rồi mới addLayer, và quan trọng hơn:)
// [FIX] Không dùng flag _signSourceDataBound vĩnh viễn nữa.
// setStyle() xóa sạch source/layer/image custom. Lần gọi thứ 2 sau setStyle: source đã mất nên đi tiếp,
// nhưng flag cũ = true nên handler sourcedata mới không bao giờ được bind, closure cũ thì layerState='added'
// nên không bao giờ addLayer lại -> source có, layer = null, toggle im lặng return.
let _signSourcedataHandler = null;

function addMapillarySignsLayer() {
  if (!map || !map.isStyleLoaded()) return false;
  if (!map.hasImage('sign-fallback')) { try { map.addImage('sign-fallback', getFallbackSignImageData()); } catch(e){} }
  if (map.getLayer(TRAFFIC_SIGN_LAYER_ID)) return true;
  if (!map.getSource(TRAFFIC_SIGN_SOURCE_ID)) return false;

  let iconExpr = ['coalesce', ['get', 'object_value'], ['get', 'value'], 'sign-fallback'];
  if (signDisplaySettings.speedOnly) {
    iconExpr = ['case',
      ['in', 'speed', ['coalesce', ['get', 'object_value'], ['get', 'value'], '']],
      ['coalesce', ['get', 'object_value'], ['get', 'value'], 'sign-fallback'],
      ''
    ];
  }
  const sizeMul = getSignIconSize();
  map.addLayer({
    id: TRAFFIC_SIGN_LAYER_ID, type: 'symbol', source: TRAFFIC_SIGN_SOURCE_ID,
    'source-layer': 'traffic_sign',
    layout: {
      'icon-image': iconExpr,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 14, 0.4 * sizeMul, 18, 0.9 * sizeMul],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-anchor': 'center'
    },
    paint: { 'icon-opacity': 0.95 }
  });
  if (!signDisplaySettings.show) {
    map.setLayoutProperty(TRAFFIC_SIGN_LAYER_ID, 'visibility', 'none');
  }
  map.off('click', TRAFFIC_SIGN_LAYER_ID);
  map.off('mouseenter', TRAFFIC_SIGN_LAYER_ID);
  map.off('mouseleave', TRAFFIC_SIGN_LAYER_ID);
  map.on('click', TRAFFIC_SIGN_LAYER_ID, (ev) => {
    const f = ev.features[0];
    const code = (f.properties && (f.properties.object_value || f.properties.value)) || 'Không rõ';
    const pretty = code.replace(/--/g, ' · ').replace(/-/g, ' ');
    const imgUrl = `${MAPILLARY_SIGN_BASE}/${code}.svg`;
    new maplibregl.Popup({ offset: 12 }).setLngLat(ev.lngLat)
      .setHTML(`<b>Biển báo</b><br><img src="${imgUrl}" style="width:48px;height:48px;display:block;margin:6px 0" onerror="this.style.display='none'"><small>${pretty}</small>`)
      .addTo(map);
  });
  map.on('mouseenter', TRAFFIC_SIGN_LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', TRAFFIC_SIGN_LAYER_ID, () => { map.getCanvas().style.cursor = ''; });
  return true;
}

function initMapillarySignsLayer() {
  if (!map) return;
  // setStyle() đã xóa source -> add lại. Nếu source còn mà layer mất (trường hợp setStyle dở dang) thì addLayer lại ngay.
  if (!map.getSource(TRAFFIC_SIGN_SOURCE_ID)) {
    map.addSource(TRAFFIC_SIGN_SOURCE_ID, {
      type: 'vector',
      tiles: [MAPILLARY_VTP_URL('{z}', '{x}', '{y}')],
      minzoom: 14,
      maxzoom: 14
    });
  }
  // styleimagemissing: bind 1 lần thì được, nhưng phải kiểm tra map còn handler không sau setStyle.
  // MapLibre giữ handler qua setStyle, nên giữ flag này là OK — khác với sourcedata ở dưới.
  if (!map._signImageMissingBound) {
    map._signImageMissingBound = true;
    map.on('styleimagemissing', (e) => {
      const id = e.id;
      if (!id || id === 'sign-fallback') return;
      if (map.hasImage(id)) return;
      if (id.includes('--')) ensureSignIcon(id);
    });
  }
  // sourcedata: GỠ handler cũ rồi bind lại mỗi lần — handler mới mới có closure đúng.
  // Tile về -> đảm bảo layer tồn tại + preload icon cho vùng mới. Không block việc addLayer.
  if (_signSourcedataHandler) map.off('sourcedata', _signSourcedataHandler);
  _signSourcedataHandler = (e) => {
    if (e.sourceId !== TRAFFIC_SIGN_SOURCE_ID) return;
    addMapillarySignsLayer();
    if (!e.isSourceLoaded) return;
    /* [V4] Dùng preloadVisibleSignIcons đã giới hạn (zoom >= 14, throttle
       500ms, tối đa 40 icon/lần) thay cho vòng lặp không giới hạn qua mọi
       feature mỗi lần sourcedata về. */
    preloadVisibleSignIcons();
  };
  map.on('sourcedata', _signSourcedataHandler);
  // Add layer NGAY, không đợi sourcedata — icon thiếu sẽ được nạp qua styleimagemissing.
  addMapillarySignsLayer();
  setTimeout(preloadVisibleSignIcons, 2000);
}

window.toggleMapillarySigns = function() {
  if (!map || !map.getLayer(TRAFFIC_SIGN_LAYER_ID)) return;
  const v = map.getLayoutProperty(TRAFFIC_SIGN_LAYER_ID, 'visibility');
  const next = v === 'none' ? 'visible' : 'none';
  map.setLayoutProperty(TRAFFIC_SIGN_LAYER_ID, 'visibility', next);
  showCustomToast(next === 'visible' ? '🚸 Đã bật biển báo' : 'Đã tắt biển báo', 'info');
};

/* ========== SIGN DISPLAY SETTINGS ========== */
window.openSignDisplaySettings = function() {
  document.getElementById('settingsModal').classList.remove('open');
  document.getElementById('signDisplaySettingsModal').classList.add('open');
  document.getElementById('signShowSwitch').checked = signDisplaySettings.show;
  document.getElementById('signSpeedOnlySwitch').checked = signDisplaySettings.speedOnly;
  ['small', 'medium', 'large'].forEach(s => {
    const b = document.getElementById('signSize-' + s);
    if (b) b.classList.toggle('active', signDisplaySettings.size === s);
  });
};
window.closeSignDisplaySettings = function() {
  document.getElementById('signDisplaySettingsModal').classList.remove('open');
  localStorage.setItem('drivekit_sign_display', JSON.stringify(signDisplaySettings));
  document.getElementById('settingsModal').classList.add('open');
};
window.setSignShowMapillary = function(on) {
  signDisplaySettings.show = on;
  localStorage.setItem('drivekit_sign_display', JSON.stringify(signDisplaySettings));
  if (map && map.getLayer(TRAFFIC_SIGN_LAYER_ID)) {
    map.setLayoutProperty(TRAFFIC_SIGN_LAYER_ID, 'visibility', on ? 'visible' : 'none');
  }
};
window.setSignSpeedOnly = function(on) {
  signDisplaySettings.speedOnly = on;
  localStorage.setItem('drivekit_sign_display', JSON.stringify(signDisplaySettings));
  if (map && map.getLayer(TRAFFIC_SIGN_LAYER_ID)) {
    const expr = on
      ? ['case',
          ['in', 'speed', ['coalesce', ['get', 'object_value'], ['get', 'value'], '']],
          ['coalesce', ['get', 'object_value'], ['get', 'value'], 'sign-fallback'],
          ''
        ]
      : ['coalesce', ['get', 'object_value'], ['get', 'value'], 'sign-fallback'];
    map.setLayoutProperty(TRAFFIC_SIGN_LAYER_ID, 'icon-image', expr);
  }
};
window.setSignSize = function(size) {
  signDisplaySettings.size = size;
  ['small', 'medium', 'large'].forEach(s => {
    const b = document.getElementById('signSize-' + s);
    if (b) b.classList.toggle('active', s === size);
  });
  localStorage.setItem('drivekit_sign_display', JSON.stringify(signDisplaySettings));
  if (map && map.getLayer(TRAFFIC_SIGN_LAYER_ID)) {
    const m = getSignIconSize();
    map.setLayoutProperty(TRAFFIC_SIGN_LAYER_ID, 'icon-size', [
      'interpolate', ['linear'], ['zoom'], 14, 0.4 * m, 18, 0.9 * m
    ]);
  }
};

/* ========== WORKER API WRAPPERS ========== */
async function apiSearch(query, lat = null, lng = null, radius = null) {
  try {
    let url = `${WORKER_URL}/api/search?q=${encodeURIComponent(query)}`;
    if (lat && lng) { url += `&lat=${lat}&lng=${lng}`; if (radius) url += `&radius=${radius}`; }
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { results: [], counts: null };
    const j = await r.json();
    return { results: j.results || [], counts: j.counts || null };
  } catch (e) { return { results: [], counts: null }; }
}

async function apiRoute(origin, dest, mode, bypassCache = false, specs = null) {
  let url = `${WORKER_URL}/api/route?fromLat=${origin.lat}&fromLng=${origin.lng}&toLat=${dest.lat}&toLng=${dest.lng}&mode=${encodeURIComponent(mode)}`;
  if (specs) {
    if (specs.seats) url += `&seats=${specs.seats}`;
    if (specs.axles) url += `&axles=${specs.axles}`;
    if (specs.bus_type) url += `&bus_type=${encodeURIComponent(specs.bus_type)}`;
  }
  if (bypassCache) url += '&nocache=1';
  let r = null, lastErr = null;
  // Valhalla 502/503 = server dang ngu / dang khoi dong lai (Codespaces / HF Spaces) -> thu lai 2 lan, moi lan cach 2s
  for(let attempt = 0; attempt < 3; attempt++){
    try{
      r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if(r.ok) break;
      if(r.status === 502 || r.status === 503 || r.status === 504){
        lastErr = 'Máy chủ dẫn đường đang khởi động lại (HTTP ' + r.status + ')';
        if(attempt < 2) await new Promise(res => setTimeout(res, 2000));
        continue;
      }
      break;
    }catch(e){ lastErr = e.message || 'Lỗi kết nối'; if(attempt < 2) await new Promise(res => setTimeout(res, 2000)); else throw e; }
  }
  if (!r || !r.ok) {
    let errText = lastErr || ('Lỗi kết nối máy chủ (HTTP ' + (r ? r.status : '??') + ')');
    try { const j = await r.json(); if (j.error) errText = j.error; } catch(e){}
    // Doi loi ky thuat thanh loi de hieu cho dien thoai
    if(/502|503|504/.test(errText) || /502|503|504/.test(String(r && r.status))) errText = 'Máy chủ dẫn đường đang bận / đang khởi động lại. Vui lòng thử lại sau vài giây.';
    throw new Error(errText);
  }
  const j = await r.json();
  if (!j.routes) throw new Error('Không có tuyến đường trả về');
  return j.routes;
}

async function apiReverseGeocode(lat, lng) {
  try {
    const r = await fetch(`${WORKER_URL}/api/geocode?lat=${lat}&lng=${lng}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return '';
    const j = await r.json();
    return j.name || '';
  } catch { return ''; }
}

async function checkWorkerHealth() {
  try {
    const r = await fetch(`${WORKER_URL}/`, { method: 'GET', signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

/* ========== D1 STATIC WARNINGS ========== */
async function getStaticWarnings(bounds) {
  try {
    const r = await fetch(`${WORKER_URL}/warnings?minLat=${bounds.south}&maxLat=${bounds.north}&minLng=${bounds.west}&maxLng=${bounds.east}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const j = await r.json();
    return j.warnings || [];
  } catch { return []; }
}
async function saveStaticWarning(type, lat, lng, speed, uid) {
  try {
    const r = await fetch(`${WORKER_URL}/warnings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ type, lat, lng, speed, uid })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) { throw e; }
}

/* ========== PARSE GMAPS URL ========== */
function parseGmapsUrl(url) {
  let m = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  m = url.match(/[?&](?:q|ll)=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  m = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  m = url.match(/\/place\/([^/]+)\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (m) return { lat: parseFloat(m[2]), lng: parseFloat(m[3]), name: decodeURIComponent(m[1].replace(/\+/g, ' ')) };
  return null;
}

/* ========== GLOBAL STATE ========== */
let map = null;
let currentUser = null;
let startPoint = null;
let endPoint = null;
let userMarker = null;
let gpsCircleGeoJSON = null;
let currentRouteCoords = [];
let currentRouteData = null;
let alternativeRoutesData = [];
let watchId = null;
let lastUserPos = null;
let lastHeading = 0;
let searchContext = 'view';
let initialCenter = [21.0285, 105.8542];
let initialZoom = 16;
let lastSnapIndex = 0;
let smoothedSpeed = 0;
let offRouteCount = 0;
/* ============================================================
   [MOI 2026-11-22] POPUP HOI DOI TUYEN KHI LECH HUONG
   - Cu: checkOffRoute lech >35m x 2 lan -> autoReroute NGAY, khong hoi user.
   - Moi: lech >35m x 2 lan -> hien popup "Ban dang di lech huong... Co muon doi huong khong? [Khong] [Co]"
     + Bam Co -> autoReroute(tu vi tri hien tai)
     + Bam Khong -> giu tuyen cu, khong hoi lai trong 45s (hoac cho den khi user quay lai dung tuyen thi reset)
   - Reroute BAT BUOC do vung cam moi (recomputeAvoidZones) van goi autoReroute() truc tiep, KHONG qua popup.
   ============================================================ */
let offRoutePopupEl = null;
let isOffRoutePopupOpen = false;
let offRoutePopupAt = 0;
let offRouteDeclinedUntil = 0;
let offRoutePendingPos = null;
let offRoutePendingDist = 0;
const OFF_ROUTE_POPUP_COOLDOWN_MS = 45000; // Sau khi bam Khong, 45s sau moi hoi lai (neu van lech)
const OFF_ROUTE_ASK_DIST_M = 35; // Giong nguong cu: lech >35m moi tinh la lech
let isRerouting = false;
let isSearchDebugMode = localStorage.getItem('drivekit_search_debug') === '1';

let voiceSettings = safeParse('drivekit_voice_settings', {
  volume: 100, nav: 'always', warning: 'always', poi: 'vibrate', avoid: 'always'
});
let warnedReports = new Set();
let warnedAvoidZones = new Set();
let warnedPois = new Set();

let voiceEnabled = true;
let voiceRouteSteps = null;
let voiceStepIndex = 0;
let voiceCheckTimer = null;
let currentVehicleMode = 'driving';
let currentSortMode = 'fastest';
let tripStartTime = null;
let arrivalHandled = false;
const ARRIVAL_RADIUS_M = 20;
let tempPinLatLng = null;
let tempPinName = "";
const ROUTE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
let tempPoiLatLng = null;
let tempPoiTag = null;
let restStopFilterActive = false;
let currentDetailPoi = null;
let allRestStops = [];
let allCommunityPois = [];
let allReports = {};
let allAvoidZones = [];
let previousAvoidZones = [];
let allSavedPlaces = {};
let allHistory = [];
let allSavedRoutes = [];
let allSharedLinks = [];
let _fsRestStops = [];
let _fsCommunityPois = [];
let _fsAvoidZones = [];
let _fsSavedPlaces = {};
let _fsHistory = [];
let _fsSavedRoutes = [];
let _rtdbReports = {};
let communityPoiMarkers = [];
let restStopMarkers = [];
let reportMarkers = [];
let _restStopFingerprint = '';
let _communityPoiFingerprint = '';
/* [V4] Diff marker theo id: id -> {marker, sig}. communityPoiMarkers/restStopMarkers
   vẫn là mảng đồng bộ từ Map để code cũ đọc .length không đổi. */
let _communityPoiMarkerMap = new Map();
let _restStopMarkerMap = new Map();
let _reportFingerprint = '';
let savedPlacesMarkers = [];
let avoidZoneMarkers = [];
let searchResultMarkers = [];
let staticWarningMarkers = [];
let staticWarningsGridCache = {};
let staticWarningsTimer = null;
let _unsub = { fsRest:null, fsPoi:null, fsAvoid:null, fsSaved:null, fsHistory:null, fsRoutes:null, rtdbReports:null };
let liveEnabled = false;
let liveRoomCode = null;
let liveIsPublic = false;
let liveGpsInterval = null;
let liveHeartbeatInterval = null;
let liveRoomUnsub = null;
let livePublicUnsub = null;
let liveRoomMembers = [];
let livePublicUsers = [];
let liveMemberMarkers = {};
let liveMyMarker = null;
let liveMyAnimState = null;
let liveMemberAnimStates = {};
const LIVE_GPS_INTERVAL = 6000;
const LIVE_ANIM_DURATION = 6000;
const LIVE_HEARTBEAT_TIMEOUT = 120000;
let isViewingLiveTrack = false;
let touchMarker = null;

let userVehicleSpecs = { type: 'car', seats: 5, axles: 2 };
let currentCarSeats = 5;
let currentTruckAxles = 2;
let currentBusType = 'regular';

let isNearbyPickingMode = false;
let nearbyCenterMarker = null;
let nearbyResultMarkers = [];
let currentNearbyCenter = null;

const POI_TAG_CONFIG = {
  supermarket: { icon: 'fa-shopping-cart', label: 'Siêu thị', color: '#10b981' },
  rest_stop: { icon: 'fa-bed', label: 'Trạm dừng nghỉ', color: '#3b82f6' },
  gas_station: { icon: 'fa-gas-pump', label: 'Cây xăng', color: '#f59e0b' },
  cafe: { icon: 'fa-coffee', label: 'Cafe', color: '#8b5cf6' },
  restaurant: { icon: 'fa-utensils', label: 'Nhà hàng', color: '#ef4444' },
  pharmacy: { icon: 'fa-prescription-bottle-medical', label: 'Nhà thuốc', color: '#06b6d4' },
  atm: { icon: 'fa-money-bill-wave', label: 'ATM', color: '#ec4899' },
  repair: { icon: 'fa-wrench', label: 'Sửa xe', color: '#64748b' },
  hotel: { icon: 'fa-hotel', label: 'Khách sạn', color: '#dc2626' },
  hospital: { icon: 'fa-hospital', label: 'Bệnh viện', color: '#e11d48' },
  parking: { icon: 'fa-square-parking', label: 'Bãi đỗ xe', color: '#0ea5e9' },
  ev_charging: { icon: 'fa-charging-station', label: 'Trạm sạc EV', color: '#84cc16' },
  market: { icon: 'fa-store', label: 'Chợ / Cửa hàng', color: '#f97316' },
  wc: { icon: 'fa-restroom', label: 'Nhà vệ sinh', color: '#14b8a6' },
  car_wash: { icon: 'fa-soap', label: 'Rửa xe', color: '#a855f7' }
};

/* ========== POI CATEGORY CODES (v3, chỉ thêm mới) ==========
   Bảng tra mã chuẩn cho từng loại POI/nearby, dùng chung cho POI cộng
   đồng và Nearby. POI_TAG_CONFIG ở trên KHÔNG đổi (icon/label/color
   giữ nguyên). Key/tag và giá trị option cũ KHÔNG đổi; các cặp cùng ý
   nghĩa được giữ làm alias trỏ cùng 1 nhóm mã (xem cuối bảng).
   - overture: taxonomy.primary của Overture Maps (chuỗi snake_case),
     hoặc mã nhóm top-level đã xác minh khi chưa có mã riêng.
   - tomtom: mã chữ POICategory của TomTom (dùng cho discoverPlaces /
     getPOICategoryCodes); tomtomId: StandardCategoryID (số, dùng cho
     categorySet của Search API cũ).
   - here: mã 3 cấp xxx-xxxx-xxxx của HERE Places, hoặc mã cấp cha
     (level 1/2) đã xác minh khi chưa có mã riêng.
   Trường nào CHƯA XÁC MINH được từ tài liệu chính thức thì để null,
   TUYỆT ĐỐI không đoán. Xem báo cáo v3 để biết nguồn từng mã.
   ============================================================ */
const POI_CATEGORY_CODES = {
  supermarket: { overture: 'supermarket', tomtom: 'SUPERMARKET', tomtomId: 7332005, here: '600-6300-0066' }, // here: Grocery (chưa có mã Supermarket riêng)
  rest_stop: { overture: null, tomtom: 'REST_AREA', tomtomId: 7395, here: '400-4300-0000' },
  gas_station: { overture: 'gas_station', tomtom: 'FUEL_STATION', tomtomId: 7311, here: '700-7600-0116' },
  cafe: { overture: 'cafe', tomtom: 'CAFE', tomtomId: 9376002, here: '100-1100-0010' }, // here: Coffee Shop
  restaurant: { overture: 'restaurant', tomtom: 'RESTAURANT', tomtomId: 7315, here: '100-1000-0000' },
  pharmacy: { overture: 'pharmacy', tomtom: 'PHARMACY', tomtomId: 7326, here: '600-6400-0070' },
  atm: { overture: null, tomtom: 'ATM', tomtomId: 7397, here: '700-7010-0108' },
  repair: { overture: null, tomtom: 'CAR_REPAIR_AND_SERVICE', tomtomId: 7310, here: null },
  hotel: { overture: 'hotel', tomtom: 'HOTEL', tomtomId: 7314003, here: '500-5000-0053' }, // tomtomId: hotel (cha: hotelMotel 7314)
  hospital: { overture: 'health_care', tomtom: 'HOSPITAL', tomtomId: 7321, here: '800-8000-0159' }, // overture: mã nhóm cha
  parking: { overture: null, tomtom: 'PARKING_GARAGE', tomtomId: 7313, here: '800-8500-0000' },
  ev_charging: { overture: null, tomtom: 'CHARGING_LOCATION', tomtomId: 7309, here: '700-7600-0322' },
  market: { overture: null, tomtom: 'MARKETPLACE', tomtomId: 7332, here: '600-6900-0247' },
  wc: { overture: null, tomtom: 'PUBLIC_BATHROOM', tomtomId: null, here: '800-8700-0198' }, // tomtomId: chưa xác minh
  car_wash: { overture: null, tomtom: 'CAR_WASH', tomtomId: 9155, here: '700-7850-0121' },
  bank_or_credit_union: { overture: null, tomtom: 'BANK', tomtomId: 7328, here: '700-7000-0107' }, // here Bank gồm cả credit union theo mô tả
  convenience_store: { overture: 'convenience_store', tomtom: 'CONVENIENCE_STORE', tomtomId: 9361009, here: '600-6000-0061' },
  food_and_drink: { overture: 'food_and_drink', tomtom: null, tomtomId: null, here: '100' }, // here: level 1 Eat and Drink
  bar: { overture: 'bar', tomtom: 'BAR', tomtomId: 9379004, here: '200-2000-0011' },
  fast_food_restaurant: { overture: 'fast_food_restaurant', tomtom: 'FAST_FOOD', tomtomId: 7315015, here: '100-1000-0009' },
  food_court: { overture: 'food_and_drink', tomtom: null, tomtomId: null, here: '100' }, // chỉ có mã cấp cha đã xác minh
  shopping: { overture: 'shopping', tomtom: null, tomtomId: null, here: '600' }, // here: level 1 Shopping
  shopping_mall: { overture: 'shopping', tomtom: 'MALL', tomtomId: 7373, here: '600-6100-0062' }, // overture: mã nhóm cha; tomtomId: shoppingCenter
  laundry_service: { overture: null, tomtom: 'DRY_CLEANER', tomtomId: 9361010, here: null },
  health_care: { overture: 'health_care', tomtom: 'HEALTHCARE_SERVICE', tomtomId: 9663, here: null },
  dental_clinic: { overture: 'health_care', tomtom: 'DENTIST', tomtomId: 9374, here: null }, // overture: mã nhóm cha
  gym: { overture: 'gym', tomtom: 'FITNESS_CLUB_AND_CENTER', tomtomId: 7320002, here: null },
  airport: { overture: null, tomtom: 'AIRPORT', tomtomId: 7383, here: '400-4000-4581' },
  train_station: { overture: null, tomtom: 'RAILWAY_STATION', tomtomId: 7380, here: '400-4100-0035' },
  education: { overture: 'education', tomtom: null, tomtomId: null, here: null },
  college_university: { overture: 'education', tomtom: 'COLLEGE_OR_UNIVERSITY', tomtomId: 7377, here: null }, // overture: mã nhóm cha
  high_school: { overture: 'education', tomtom: 'HIGH_SCHOOL', tomtomId: 7372006, here: null }, // overture: mã nhóm cha
  library: { overture: null, tomtom: 'PUBLIC_LIBRARY', tomtomId: 9913, here: null },
  community_and_government: { overture: 'community_and_government', tomtom: null, tomtomId: null, here: null },
  police_station: { overture: null, tomtom: 'POLICE_STATION', tomtomId: 7322, here: null },
  fire_station: { overture: null, tomtom: 'FIRE_STATION', tomtomId: 7392, here: null },
  post_office: { overture: null, tomtom: 'POST_OFFICE', tomtomId: 7324, here: null }
};
// Alias: tên khác cùng ý nghĩa -> cùng 1 nhóm mã, giữ cả 2 key cũ.
POI_CATEGORY_CODES.superstore = POI_CATEGORY_CODES.supermarket;
POI_CATEGORY_CODES.pharmacy_and_drug_store = POI_CATEGORY_CODES.pharmacy;
POI_CATEGORY_CODES.ev_charging_station = POI_CATEGORY_CODES.ev_charging;
POI_CATEGORY_CODES.public_restroom = POI_CATEGORY_CODES.wc;
// Tra mã chuẩn của 1 key DriveKit/nearby. Key lạ hoặc lỗi -> null, không throw.
function getPoiCategoryIds(key) {
  try {
    if (!key || typeof key !== 'string') return null;
    const entry = POI_CATEGORY_CODES[key];
    if (!entry) return null;
    return { overture: entry.overture != null ? entry.overture : null, tomtom: entry.tomtom != null ? entry.tomtom : null, tomtomId: entry.tomtomId != null ? entry.tomtomId : null, here: entry.here != null ? entry.here : null };
  } catch (e) { return null; }
}
window.getPoiCategoryIds = getPoiCategoryIds;

const ZOOM_CONFIG = { communityPoi: 15, restStop: 13, savedPlace: 14, report: 14, savedPlaceAlwaysShow: ['home', 'company'] };

/* ========== DEBUG TOOL ========== */
window.toggleSearchDebug = function() {
  isSearchDebugMode = !isSearchDebugMode;
  localStorage.setItem('drivekit_search_debug', isSearchDebugMode ? '1' : '0');
  showCustomToast(isSearchDebugMode ? '🔧 Đã BẬT hiển thị nguồn Search' : 'Đã TẮT hiển thị nguồn Search', isSearchDebugMode ? 'success' : 'info');
};

/* ========== VOICE SETTINGS ========== */
window.openVoiceSettings = function() {
  document.getElementById('settingsModal').classList.remove('open');
  document.getElementById('voiceSettingsModal').classList.add('open');
  document.getElementById('voiceVolumeSlider').value = voiceSettings.volume;
  document.getElementById('voiceVolLabel').textContent = voiceSettings.volume + '%';
  updateVoiceSettingsUI();
};
window.closeVoiceSettings = function() {
  document.getElementById('voiceSettingsModal').classList.remove('open');
  localStorage.setItem('drivekit_voice_settings', JSON.stringify(voiceSettings));
  document.getElementById('settingsModal').classList.add('open');
};
window.updateVoiceVolumeLabel = function(val) {
  voiceSettings.volume = parseInt(val);
  document.getElementById('voiceVolLabel').textContent = val + '%';
  localStorage.setItem('drivekit_voice_settings', JSON.stringify(voiceSettings));
};
window.setVoiceMode = function(category, mode) {
  voiceSettings[category] = mode;
  localStorage.setItem('drivekit_voice_settings', JSON.stringify(voiceSettings));
  updateVoiceSettingsUI();
};
function updateVoiceSettingsUI() {
  ['nav', 'warning', 'poi', 'avoid'].forEach(cat => {
    const container = document.getElementById('seg-' + cat);
    if (!container) return;
    const btns = container.querySelectorAll('.seg-btn');
    btns.forEach(btn => btn.classList.remove('active'));
    const mode = voiceSettings[cat];
    if (mode === 'never' && btns[0]) btns[0].classList.add('active');
    if (mode === 'always' && btns[1]) btns[1].classList.add('active');
    if (mode === 'vibrate' && btns[2]) btns[2].classList.add('active');
  });
}

/* ========== SETTINGS MODAL ========== */
window.openSettings = function() {
  document.getElementById('profileModal').classList.remove('open');
  document.getElementById('settingsModal').classList.add('open');
};
window.closeSettings = function() {
  document.getElementById('settingsModal').classList.remove('open');
  document.getElementById('profileModal').classList.add('open');
};

/* ========== MENU ========== */
window.openMenu = function() {
  document.getElementById('profileModal').classList.add('open');
  renderHistoryList();
  renderSavedRoutesList();
  renderSharedLinksList();
  updateLiveUI();
};
window.closeMenu = function() {
  document.getElementById('profileModal').classList.remove('open');
  // [FIX] Dong menu xong phai hien lai FAB ngay - truoc day khong goi updateUIState nen FAB bi ket an
  try{ if(typeof updateUIState==='function') updateUIState(); }catch(e){}
  try{
    ['mainLocateBtn','mainDirBtn','btnLayerMenu','btnQuickPin','btnReport','btnRestStopFilter','btnNearbySearch'].forEach(id=>{
      const el=document.getElementById(id); if(el && !document.body.classList.contains('navigating')) el.style.display='flex';
    });
  }catch(e){}
};

/* ========== DIRECTIONS SHEET ========== */
window.openDirections = function() {
  document.getElementById('dirSheet')?.classList.add('open');
  updateUIState();
  if (startPoint) {
    document.getElementById('dirInputStart').value = startPoint.name;
    document.getElementById('btnClearStart').classList.remove('hidden');
  } else if (lastUserPos) {
    startPoint = { lat: lastUserPos.lat, lng: lastUserPos.lng, name: 'Vị trí của tôi' };
    document.getElementById('dirInputStart').value = 'Vị trí của tôi (GPS)';
    document.getElementById('btnClearStart').classList.remove('hidden');
  }
  if (endPoint) {
    document.getElementById('dirInputEnd').value = endPoint.name;
    document.getElementById('btnClearEnd').classList.remove('hidden');
  }
};
window.closeDirections = function() {
  document.getElementById('dirSheet')?.classList.remove('open');
  updateUIState();
};

/* ========== VEHICLE SELECTION + ROUTE OPTIONS ========== */
const VEHICLE_TYPE_MAP = {
  'driving': 'car', 'driving-traffic': 'car', 'hd': 'motorcycle',
  'truck': 'truck', 'bus': 'bus', 'motorcycle': 'motorcycle',
  'walking': 'walking', 'bicycle': 'bicycle'
};
const VEHICLE_LABELS = {
  'driving': 'ô tô', 'driving-traffic': 'ô tô (kẹt xe)', 'hd': 'xe công nghệ', 'truck': 'xe tải',
  'bus': 'xe buýt', 'motorcycle': 'xe máy', 'walking': 'đi bộ', 'bicycle': 'xe đạp'
};
let routeOptionBadges = [];
let routeOptionCount = 0;

function getCurrentVehicleSpecs() {
  const t = userVehicleSpecs.type;
  if (t === 'car') return { seats: userVehicleSpecs.seats };
  if (t === 'truck') return { axles: userVehicleSpecs.axles };
  if (t === 'bus') return { bus_type: currentBusType };
  return null;
}

function refreshRouteOptionsIfOpen() {
  const modal = document.getElementById('routeOptionsModal');
  if (startPoint && endPoint && modal && modal.classList.contains('open')) window.fetchAndShowRouteOptions();
}

window.setVehicleMode = function(mode, btn) {
  // [FIX 2 LOI] Dang dan ma doi loai xe (nhu trong anh: dang dan ma bam Xe dap) -> fetch lai tuyen moi -> mat tuyen cu -> toast do. Chan lai.
  const _isNavV = (typeof isNavigating!=='undefined' && isNavigating) || (document.body && (document.body.classList.contains('google-nav') || document.body.classList.contains('navigating')));
  if(_isNavV){
    if(typeof showCustomToast==='function') showCustomToast('Đang dẫn đường - không đổi loại xe được, kết thúc chuyến rồi đổi', 'warning');
    return;
  }
  currentVehicleMode = mode;
  userVehicleSpecs.type = VEHICLE_TYPE_MAP[mode] || 'car';
  document.querySelectorAll('.vehicle-mode-btn').forEach(b => {
    b.classList.toggle('active', btn ? b === btn : b.dataset.mode === mode);
  });
  const t = userVehicleSpecs.type;
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.classList.toggle('hidden', !on); };
  show('carSeatsSelector', t === 'car');
  show('truckAxlesSelector', t === 'truck');
  show('busTypeSelector', t === 'bus');
  show('truckWarning', t === 'truck');
  if (liveEnabled && liveRoomCode) pushLivePositionToRTDB();
  refreshRouteOptionsIfOpen();
};

function markActiveSubOption(containerId, btn) {
  const box = document.getElementById(containerId);
  if (!box || !btn) return;
  box.querySelectorAll('.sub-option-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}
window.setCarSeats = function(n, btn) {
  currentCarSeats = n;
  userVehicleSpecs.seats = n;
  markActiveSubOption('carSeatsSelector', btn);
  refreshRouteOptionsIfOpen();
};
window.setTruckAxles = function(n, btn) {
  currentTruckAxles = n;
  userVehicleSpecs.axles = n;
  markActiveSubOption('truckAxlesSelector', btn);
  refreshRouteOptionsIfOpen();
};
window.setBusType = function(type, btn) {
  currentBusType = type;
  markActiveSubOption('busTypeSelector', btn);
  refreshRouteOptionsIfOpen();
};

window.changeSort = function(mode) {
  currentSortMode = mode;
  if (startPoint && endPoint) window.fetchAndShowRouteOptions();
};

window.closeRouteOptions = function() {
  const m = document.getElementById('routeOptionsModal');
  if (m) { m.classList.remove('open'); m.style.display = ''; }
};

function clearRouteOptionLayers() {
  if (map) {
    // [FIX 2 DUONG XANH] Xoa theo quet style, khong phu thuoc routeOptionCount
    try{
      const st = map.getStyle();
      const layers = (st && st.layers) ? [...st.layers] : [];
      layers.forEach(l=>{
        const id = l && l.id || '';
        if(id.startsWith('route-opt-') || id.startsWith('alt-route-') || id.startsWith('route-option-')){
          try{ if(map.getLayer(id)) map.removeLayer(id); }catch(_){}
        }
      });
      const srcs = (st && st.sources) ? Object.keys(st.sources) : [];
      srcs.forEach(sid=>{
        if(sid.startsWith('route-opt-') || sid.startsWith('alt-route-') || sid.startsWith('route-option-')){
          try{ if(map.getSource(sid)) map.removeSource(sid); }catch(_){}
        }
      });
    }catch(e){}
    for (let i = 0; i < Math.max(routeOptionCount, 15); i++) {
      try{ if (map.getLayer('route-opt-layer-' + i)) map.removeLayer('route-opt-layer-' + i); }catch(_){}
      try{ if (map.getSource('route-opt-src-' + i)) map.removeSource('route-opt-src-' + i); }catch(_){}
    }
  }
  routeOptionCount = 0;
  routeOptionBadges.forEach(m => m.remove());
  routeOptionBadges = [];
}

window.fetchAndShowRouteOptions = async function() {
  if (!startPoint || !endPoint || !startPoint.lat || !endPoint.lat) {
    showCustomToast('Vui lòng chọn đủ Điểm đi và Điểm đến!', 'warning');
    return;
  }
  const mode = currentVehicleMode || 'driving';
  const bodyEl = document.getElementById('routeOptionsBody');
  bodyEl.innerHTML = `<div style="text-align:center; padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:2rem; color:var(--primary);"></i><p style="margin-top:10px; color:var(--text-muted);">Đang tìm tuyến (${VEHICLE_LABELS[mode] || mode})...</p></div>`;
  document.getElementById('routeOptionsModal').classList.add('open');
  try {
    let routes = await apiRoute(startPoint, endPoint, mode, false, getCurrentVehicleSpecs());
    routes = routes.filter(r => {
      const c = r.geometry && r.geometry.coordinates;
      return r.distance > 0 && Array.isArray(c) && c.length >= 2;
    });
    const total = routes.length;
    routes = routes.filter(r => !checkRouteAgainstAvoidZones(r.geometry.coordinates).blocked);
    if (routes.length === 0) {
      const why = total > 0 ? 'Tất cả tuyến đều đi qua vùng cấm với loại xe này.' : 'Không tìm được tuyến đường hợp lệ.';
      bodyEl.innerHTML = `<div style="text-align:center; padding:40px; color:var(--danger);"><i class="fas fa-exclamation-triangle" style="font-size:2rem; margin-bottom:10px;"></i><p>${why}</p></div>`;
      return;
    }
    routes.sort((a, b) => currentSortMode === 'shortest' ? a.distance - b.distance : a.duration - b.duration);
    routes = routes.slice(0, 5);
    alternativeRoutesData = routes;

    clearRouteOptionLayers();
    if (map.getLayer('current-route-layer')) map.removeLayer('current-route-layer');
    if (map.getSource('current-route-source')) map.removeSource('current-route-source');
    const bounds = new maplibregl.LngLatBounds();
    // Vẽ tuyến phụ trước, tuyến tốt nhất sau cùng để nằm trên
    const order = routes.map((_, i) => i).reverse();
    order.forEach(index => {
      const r = routes[index];
      const lngLat = r.geometry.coordinates.map(c => [c[1], c[0]]);
      lngLat.forEach(p => bounds.extend(p));
      const isBest = index === 0;
      const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
      map.addSource('route-opt-src-' + index, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: lngLat } } });
      map.addLayer({
        id: 'route-opt-layer-' + index, type: 'line', source: 'route-opt-src-' + index,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': isBest ? color : '#94a3b8', 'line-width': isBest ? 9 : 5, 'line-opacity': isBest ? 1 : 0.7 }
      });
      map.on('click', 'route-opt-layer-' + index, () => window.selectRouteOption(index));
      const mid = lngLat[Math.floor(lngLat.length / 2)];
      const el = document.createElement('div');
      el.style.cssText = `background:${isBest ? color : 'white'}; color:${isBest ? 'white' : '#334155'}; border:3px solid ${isBest ? 'white' : color}; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:0.9rem; box-shadow:0 4px 10px rgba(0,0,0,0.4); cursor:pointer;`;
      el.textContent = String(index + 1);
      el.addEventListener('click', e => { e.stopPropagation(); window.selectRouteOption(index); });
      routeOptionBadges.push(new maplibregl.Marker({ element: el }).setLngLat(mid).addTo(map));
    });
    routeOptionCount = routes.length;
    map.fitBounds(bounds, { padding: { top: 80, bottom: 260, left: 40, right: 40 }, maxZoom: 17 });

    let html = `<div class="sort-bar"><button class="sort-chip ${currentSortMode === 'fastest' ? 'active' : ''}" onclick="changeSort('fastest')"><i class="fas fa-bolt"></i> Nhanh nhất</button><button class="sort-chip ${currentSortMode === 'shortest' ? 'active' : ''}" onclick="changeSort('shortest')"><i class="fas fa-route"></i> Ngắn nhất</button></div>`;
    routes.forEach((r, index) => {
      const dist = (r.distance / 1000).toFixed(1);
      const dur = Math.round(r.duration / 60);
      const isBest = index === 0;
      const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
      html += `<div class="route-card ${isBest ? 'active' : ''}" onclick="selectRouteOption(${index})" style="border-left:4px solid ${color}; cursor:pointer;"><div class="info"><h3 style="display:flex; align-items:center; gap:8px;"><span style="background:${color}; color:white; width:24px; height:24px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:900;">${index + 1}</span>Tuyến ${index + 1} ${isBest ? '(Ưu tiên)' : ''}</h3><p><i class="fas fa-road"></i> ${dist} km • <i class="fas fa-clock"></i> ${dur} phút</p></div>${isBest ? '<span class="badge" style="background:linear-gradient(135deg,#f59e0b,#ef4444); color:white;"><i class="fas fa-star"></i> Đề xuất</span>' : ''}</div>`;
    });
    bodyEl.innerHTML = html;
  } catch (e) {
    console.error('fetchAndShowRouteOptions:', e);
    const msg = escapeHtml(e.message || 'Có lỗi xảy ra khi tìm tuyến. Vui lòng thử lại.');
    const isServerBusy = /đang bận|đang khởi động|502|503|504|khởi động lại/i.test(e.message || '');
    bodyEl.innerHTML = `<div style="text-align:center; padding:28px 16px; color:var(--danger);">
      <i class="fas fa-exclamation-triangle" style="font-size:2rem; margin-bottom:10px;"></i>
      <p style="font-size:15px; line-height:1.5; margin:0 0 6px;">${msg}</p>
      ${isServerBusy ? '<p style="font-size:13px; color:var(--text-muted); line-height:1.5; margin:0 0 14px;">Máy chủ Valhalla (Codespaces / HF Spaces) có thể đang ngủ, bấm Thử lại sau 5-10 giây.</p>' : ''}
      <button onclick="window.fetchAndShowRouteOptions()" style="background:#0F766E; color:#fff; border:0; border-radius:999px; padding:12px 22px; font-size:15px; font-weight:800; cursor:pointer; min-height:48px;">↻ Thử lại</button>
      <button onclick="window.closeRouteOptions()" style="background:#f3f4f6; color:#334155; border:0; border-radius:999px; padding:12px 18px; font-size:15px; font-weight:700; cursor:pointer; min-height:48px; margin-left:8px;">Đóng</button>
    </div>`;
  }
};

window.selectRouteOption = function(index) {
  // [FIX 2 LOI] Dang dan ma chon tuyen trong preview -> chan, de autoReroute lo. Khong cho clear tuyen cu.
  const _isNavSel = (typeof isNavigating!=='undefined' && isNavigating) || (document.body && (document.body.classList.contains('google-nav') || document.body.classList.contains('navigating')));
  if(_isNavSel){
    if(typeof showCustomToast==='function') showCustomToast('Đang dẫn đường - đi sai hệ thống sẽ tự đổi', 'info');
    return;
  }
  const r = alternativeRoutesData[index];
  if (!r || !r.geometry || !r.geometry.coordinates || !r.geometry.coordinates.length) {
    showCustomToast('Tuyến này đã hết, đang tải lại các tuyến...', 'warning');
    try{ if(typeof window.fetchAndShowRouteOptions==='function') window.fetchAndShowRouteOptions(); }catch(e){}
    return;
  }
  if (!Array.isArray(r.legs) || r.legs.length === 0) r.legs = [{ steps: [] }];
  if (!r.legs[0].steps) r.legs[0].steps = [];
  const _othersSel = alternativeRoutesData.filter((_, i) => i !== index);
  try{ localStorage.setItem('alternativeRoutes', JSON.stringify(_othersSel)); }catch(e){}
  // [FIX] Dong bo RAM ngay de lan doi tuyen sau khong lech index
  alternativeRoutesData = [r, ..._othersSel];
  try{ arrivalHandled = false; }catch(e){}
  currentRouteData = r;
  currentRouteCoords = r.geometry.coordinates;
  clearRouteOptionLayers();
  drawCurrentRoute();
  window.closeRouteOptions();
  startNavigationHUD();
};

function startNavigationHUD() {
  // [FIX 2 LOI] Da dang dan ma goi lai (bam nham Bat dau lan 2) -> KHONG toast do, chi return.
  const _alreadyNav = (typeof isNavigating!=='undefined' && isNavigating) || (document.body && (document.body.classList.contains('google-nav') || document.body.classList.contains('navigating')));
  if(_alreadyNav && currentRouteData && currentRouteCoords && currentRouteCoords.length > 0){ return; }
  if (!currentRouteData || !currentRouteCoords || currentRouteCoords.length === 0) {
    showCustomToast('Không thể bắt đầu dẫn đường do thiếu dữ liệu tuyến!', 'danger');
    // [FIX] Khong de ket o trang thai khong co tuyen - mo lai preview de user chon lai, khong de panel treo
    try{ if(!_alreadyNav && typeof window.fetchAndShowRouteOptions==='function') window.fetchAndShowRouteOptions(); }catch(e){}
    return;
  }
  try {
    document.getElementById('dirSheet')?.classList.remove('open');
    document.getElementById('suggestionsBox')?.classList.remove('show');
    document.body.classList.add('navigating');
    document.getElementById('hud').classList.remove('hidden');
    updateUIState();
    voiceRouteSteps = currentRouteData.legs[0].steps;
    voiceStepIndex = 0; lastSnapIndex = 0; offRouteCount = 0; try{ if(typeof hideOffRoutePopup==='function') hideOffRoutePopup(); offRouteDeclinedUntil = 0; offRoutePendingPos = null; }catch(e){} // [MOI] Bat dau chuyen moi -> reset popup lech huong
    tripStartTime = Date.now(); arrivalHandled = false;
    const dist = currentRouteData.distance || 0;
    const dur = currentRouteData.duration || 0;
    document.getElementById('hudRemainDist').textContent = (dist / 1000).toFixed(1) + ' km';
    document.getElementById('hudRemainTime').textContent = Math.round(dur / 60) + ' phút';
    document.getElementById('hudNextStopName').textContent = (endPoint && endPoint.name) || 'Điểm đến';
    startWatching();
    startVoice();
    saveHistoryToFirestore(startPoint, endPoint, dist);
    if (lastUserPos) updateNextManeuverHUD(lastUserPos.lat, lastUserPos.lng);
  } catch (err) {
    console.error('startNavigationHUD:', err);
    showCustomToast('Lỗi khởi động dẫn đường: ' + err.message, 'danger');
    document.getElementById('hud').classList.add('hidden');
    document.body.classList.remove('navigating');
    updateUIState();
  }
}

/* ========== NEARBY SEARCH ========== */
window.openNearbySearchPanel = function() {
  document.getElementById('nearbySearchPanel')?.classList.add('open');
  if (lastUserPos && !currentNearbyCenter) {
    currentNearbyCenter = { lat: lastUserPos.lat, lon: lastUserPos.lng };
    updateNearbyCenterMarker(currentNearbyCenter.lat, currentNearbyCenter.lon);
  }
};
window.closeNearbySearchPanel = function() {
  document.getElementById('nearbySearchPanel')?.classList.remove('open');
  toggleNearbyPickMode(false);
};
window.setNearbyCenterToGPS = function(event) {
  if (!navigator.geolocation) return alert('Thiết bị không hỗ trợ GPS');
  const btn = event && event.target ? event.target.closest('button') : null;
  const oldText = btn ? btn.innerHTML : '';
  if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lấy...';
  navigator.geolocation.getCurrentPosition(pos => {
    if (btn) btn.innerHTML = oldText;
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    currentNearbyCenter = { lat, lon };
    updateNearbyCenterMarker(lat, lon);
    map.flyTo({ center: [lon, lat], zoom: 15 });
    fetchNearbyPlaces();
  }, err => { if (btn) btn.innerHTML = oldText; alert('Lỗi GPS: ' + err.message); }, { enableHighAccuracy: true });
};
window.toggleNearbyPickMode = function(forceState) {
  isNearbyPickingMode = forceState !== undefined ? forceState : !isNearbyPickingMode;
  const btn = document.getElementById('btnPickOnMap');
  if (!btn) return;
  if (isNearbyPickingMode) {
    btn.style.background = 'var(--success)'; btn.style.color = 'white'; btn.style.borderColor = 'var(--success)';
    btn.innerHTML = '<i class="fas fa-crosshairs"></i> Đang chọn...';
    showCustomToast('Bấm lên bản đồ để chọn tâm', 'info');
    document.getElementById('nearbySearchPanel')?.classList.remove('open');
  } else {
    btn.style.background = 'transparent'; btn.style.color = 'var(--text)'; btn.style.borderColor = 'var(--border)';
    btn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Chọn điểm khác';
  }
};
function updateNearbyCenterMarker(lat, lon) {
  if (!nearbyCenterMarker) {
    const el = document.createElement('div');
    el.className = 'nearby-center-marker';
    nearbyCenterMarker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lon, lat]).addTo(map);
  } else { nearbyCenterMarker.setLngLat([lon, lat]); }
}
window.fetchNearbyPlaces = async function(event) {
  if (!currentNearbyCenter) return alert('Vui lòng chọn vị trí tâm trước!');
  const radius = document.getElementById('nearbyRadius').value;
  const category = document.getElementById('nearbyCategory').value;
  // v3: GIỮ NGUYÊN giá trị category= gửi tới NEARBY_API_URL (backend hiện tại
  // có thể không hiểu mã mới) — KHÔNG đổi URL request. nearbyCategoryIds chỉ
  // tra cứu sẵn để backend dùng sau này: gửi kèm ví dụ tomtomId/here khi
  // backend hỗ trợ, hoặc map kết quả có trường category về key DriveKit.
  // Kết quả nearby hiện tại chỉ có name/lat/lon/distance_km, không có
  // trường category nên KHÔNG map kết quả ở đây.
  const nearbyCategoryIds = getPoiCategoryIds(category);
  const btnSearch = event && event.target ? event.target.closest('button') : null;
  const oldText = btnSearch ? btnSearch.innerHTML : '';
  if (btnSearch) { btnSearch.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tìm...'; btnSearch.disabled = true; }
  nearbyResultMarkers.forEach(m => m.remove());
  nearbyResultMarkers = [];
  try {
    const url = `${NEARBY_API_URL}?lat=${currentNearbyCenter.lat}&lon=${currentNearbyCenter.lon}&radius=${radius}&category=${category}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('Lỗi kết nối máy chủ');
    const data = await res.json();
    const results = Array.isArray(data) ? data : (data.data || []);
    if (results.length === 0) { showCustomToast('Không tìm thấy địa điểm nào', 'warning'); closeNearbySearchPanel(); return; }
    const bounds = new maplibregl.LngLatBounds();
    bounds.extend([currentNearbyCenter.lon, currentNearbyCenter.lat]);
    results.forEach(place => {
      bounds.extend([place.lon, place.lat]);
      const el = document.createElement('div');
      el.innerHTML = `<div style="background:#ef4444;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.3);cursor:pointer;" data-lat="${place.lat}" data-lon="${place.lon}"><i class="fas fa-map-marker-alt"></i></div>`;
      el.addEventListener('click', () => flyToNearbyPlace(place.lat, place.lon, place.name));
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([place.lon, place.lat]).addTo(map);
      nearbyResultMarkers.push(marker);
    });
    map.fitBounds(bounds, { padding: 50, maxZoom: 16 });
    renderNearbyResultsSheet(results, category);
    closeNearbySearchPanel();
  } catch (err) { alert('Lỗi: ' + err.message); }
  finally { if (btnSearch) { btnSearch.innerHTML = oldText; btnSearch.disabled = false; } }
};
function renderNearbyResultsSheet(results, category) {
  const list = document.getElementById('nearbyResultsList');
  const title = document.getElementById('nearbyResultsTitle');
  const count = document.getElementById('nearbyResultsCount');
  const select = document.getElementById('nearbyCategory');
  title.textContent = select.options[select.selectedIndex].text;
  count.textContent = `${results.length} địa điểm`;
  list.innerHTML = '';
  results.forEach(place => {
    const div = document.createElement('div');
    div.className = 'nearby-result-item';
    div.innerHTML = `<div class="nearby-result-icon"><i class="fas fa-map-marker-alt"></i></div><div class="nearby-result-info"><div class="nearby-result-name">${escapeHtml(place.name)}</div><div class="nearby-result-distance"><i class="fas fa-route"></i> Cách đây ${place.distance_km} km</div></div><button class="nearby-result-btn"><i class="fas fa-directions"></i></button>`;
    div.querySelector('.nearby-result-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      goToLongPressLocation(place.lat, place.lon, place.name);
      closeNearbyResultsSheet();
    });
    div.onclick = () => flyToNearbyPlace(place.lat, place.lon, place.name);
    list.appendChild(div);
  });
  const sheet = document.getElementById('nearbyResultsSheet');
  const overlay = document.getElementById('nearbyResultsOverlay');
  overlay.style.display = 'block';
  requestAnimationFrame(() => { overlay.style.opacity = '1'; sheet.style.transform = 'translateY(0)'; });
}
window.closeNearbyResultsSheet = function() {
  const sheet = document.getElementById('nearbyResultsSheet');
  const overlay = document.getElementById('nearbyResultsOverlay');
  sheet.style.transform = 'translateY(100%)';
  overlay.style.opacity = '0';
  setTimeout(() => { overlay.style.display = 'none'; }, 300);
};
window.flyToNearbyPlace = function(lat, lon, name) {
  map.flyTo({ center: [lon, lat], zoom: 17 });
  const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`<b>${escapeHtml(name)}</b>`);
  new maplibregl.Marker({ element: document.createElement('div') }).setLngLat([lon, lat]).setPopup(popup).addTo(map).togglePopup();
};

/* ========== TOAST & HELPERS ========== */
function showCustomToast(message, type = 'info') {
  const colors = { success: 'linear-gradient(135deg, #10b981, #059669)', danger: 'linear-gradient(135deg, #ef4444, #b91c1c)', warning: 'linear-gradient(135deg, #f59e0b, #d97706)', info: 'linear-gradient(135deg, #3b82f6, #2563eb)' };
  const icons = { success: 'fa-check-circle', danger: 'fa-exclamation-triangle', warning: 'fa-exclamation-circle', info: 'fa-info-circle' };
  const toast = document.createElement('div');
  toast.style.cssText = `position:fixed;top:calc(80px + var(--safe-top));left:50%;transform:translateX(-50%) translateY(-20px);background:${colors[type]};color:white;padding:14px 20px;border-radius:12px;font-weight:700;font-size:0.9rem;z-index:9999;box-shadow:0 10px 30px rgba(0,0,0,0.3);display:flex;align-items:center;gap:10px;opacity:0;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);pointer-events:none;max-width:90vw;text-align:center;`;
  toast.innerHTML = `<i class="fas ${icons[type]}" style="font-size:1.2rem;"></i><span>${message}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(-50%) translateY(0)'; });
  if (navigator.vibrate) navigator.vibrate(50);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(-20px)'; setTimeout(() => toast.remove(), 300); }, 4000);
}
function createTouchMarkerElement() {
  const el = document.createElement('div');
  el.className = 'map-touch-marker';
  el.innerHTML = `<div class="pulse"></div><div class="dot"><i class="fas fa-map-marker-alt"></i></div>`;
  return el;
}
function closePopupSmoothly(marker) {
  if (!marker) return;
  try {
    const popup = marker.getPopup();
    if (popup) {
      const el = popup.getElement();
      if (el) {
        el.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        el.style.opacity = '0'; el.style.transform = 'translateY(-10px) scale(0.95)';
        setTimeout(() => { try { marker.remove(); } catch(e) {} }, 200);
        return;
      }
    }
    marker.remove();
  } catch(e) { try { marker.remove(); } catch(e) {} }
}
function escapeHtml(text) {
  return String(text || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function jsSafe(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function translateFallback(text) {
  // DICH QUA dictionary.js - khong de ban dich cung trong app.js nua
  try{
    if(typeof window !== 'undefined' && window.DRIVEKIT_DICT && typeof window.DRIVEKIT_DICT.translate === 'function'){
      return window.DRIVEKIT_DICT.translate(text);
    }
  }catch(e){}
  // Fallback toi thieu neu dictionary.js chua load (de app khong vo)
  if(!text) return '';
  var s = String(text);
  s = s.replace(/Your destination is on the right/gi, 'Điểm đến của bạn ở bên phải');
  s = s.replace(/Your destination is on the left/gi, 'Điểm đến của bạn ở bên trái');
  s = s.replace(/You have arrived/gi, 'Bạn đã đến nơi');
  s = s.replace(/Turn left/gi, 'Rẽ trái');
  s = s.replace(/Turn right/gi, 'Rẽ phải');
  s = s.replace(/Continue/gi, 'Tiếp tục');
  return s;
}

/* ========== LOADING & AUTH ========== */
let loadProgress = 0;
let loadInterval = null;
let isUserAuthChecked = false;
let isAppReadyToShow = false;
let forceFinishTimer = null;
let _appUIInitialized = false;

function applyScreenState() {
  const loading = document.getElementById('loadingScreen');
  const authScr = document.getElementById('authScreen');
  const appUI = document.getElementById('appUI');
  if (!loading || !authScr || !appUI) return;
  loading.classList.add('hidden');
  if (currentUser) {
    authScr.classList.add('hidden'); appUI.classList.remove('hidden');
    if (!_appUIInitialized) { _appUIInitialized = true; try { initAppUI(); } catch (e) { console.error('[initAppUI] crash:', e); } }
  } else {
    appUI.classList.add('hidden'); authScr.classList.remove('hidden');
  }
}
function updateLoadingProgress(targetPercent, text) {
  if (isAppReadyToShow) return;
  if (targetPercent > loadProgress) loadProgress = targetPercent;
  const pctEl = document.getElementById('loadingPercent');
  if (pctEl) pctEl.textContent = `${Math.floor(loadProgress)}%`;
  if (text) { const tEl = document.getElementById('loadingText'); if (tEl) tEl.textContent = text; }
}
function checkLoadingComplete() {
  if (isUserAuthChecked && loadProgress >= 90 && !isAppReadyToShow) {
    if (loadInterval) { clearInterval(loadInterval); loadInterval = null; }
    if (forceFinishTimer) { clearTimeout(forceFinishTimer); forceFinishTimer = null; }
    let finalProgress = loadProgress;
    const finalPhase = setInterval(() => {
      finalProgress += 5;
      if (finalProgress >= 100) {
        finalProgress = 100; clearInterval(finalPhase); isAppReadyToShow = true;
        const pctEl = document.getElementById('loadingPercent');
        const tEl = document.getElementById('loadingText');
        if (pctEl) pctEl.textContent = `100%`;
        if (tEl) tEl.textContent = "Hoàn tất!";
        setTimeout(applyScreenState, 300);
      } else { const pctEl = document.getElementById('loadingPercent'); if (pctEl) pctEl.textContent = `${finalProgress}%`; }
    }, 40);
  }
}
function startFakeLoading() {
  forceFinishTimer = setTimeout(() => {
    if (!isAppReadyToShow) {
      isAppReadyToShow = true;
      if (loadInterval) { clearInterval(loadInterval); loadInterval = null; }
      const pctEl = document.getElementById('loadingPercent');
      const tEl = document.getElementById('loadingText');
      if (pctEl) pctEl.textContent = `100%`;
      if (tEl) tEl.textContent = "Đang mở ứng dụng...";
      setTimeout(applyScreenState, 300);
    }
  }, 8000);
  loadInterval = setInterval(() => {
    if (loadProgress < 95 && !isAppReadyToShow) {
      let step = 0; let text = "Đang khởi tạo...";
      if (loadProgress < 20) { step = 2; text = "Đang kiểm tra kết nối..."; }
      else if (loadProgress < 50) { step = 0.5; text = "Đang chờ tín hiệu GPS..."; }
      else if (loadProgress < 80) { step = 0.2; text = "Đang tải bản đồ..."; }
      else { step = 0.1; text = "Sắp xong rồi..."; }
      updateLoadingProgress(loadProgress + step, text);
    }
  }, 100);
}
startFakeLoading();
updateLoadingProgress(5, "Đang kiểm tra kết nối...");

/* [V4] Chỉ đăng ký onAuthStateChanged khi auth khởi tạo được; nếu Firebase
   init lỗi thì đánh dấu đã kiểm tra auth và để bộ đếm loading 8 giây tự
   hoàn tất, bản đồ vẫn mở được ở chế độ không có dữ liệu cloud. */
if (!auth) {
  isUserAuthChecked = true;
  try { const tEl = document.getElementById('loadingText'); if (tEl) tEl.textContent = 'Không kết nối được dịch vụ dữ liệu, vẫn dùng được bản đồ.'; } catch (e) {}
} else {
onAuthStateChanged(auth, (user) => {
  const wasLoggedIn = !!currentUser;
  currentUser = user || null;
  isUserAuthChecked = true;
  if (!user) cleanupDataSubscriptions();
  if (user) {
    const pn = document.getElementById('profileName');
    const pe = document.getElementById('profileEmail');
    const pa = document.getElementById('profileAvatar');
    if (pn) pn.textContent = user.displayName || user.email.split('@')[0];
    if (pe) pe.textContent = user.email;
    if (pa && user.photoURL) pa.innerHTML = `<img src="${user.photoURL}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    if (isAppReadyToShow && !wasLoggedIn) { applyScreenState(); return; }
    const params = new URLSearchParams(window.location.search);
    if (params.get('fromLat')) {
      startPoint = { lat: parseFloat(params.get('fromLat')), lng: parseFloat(params.get('fromLng')), name: params.get('fromName') || 'Điểm đi' };
      endPoint = { lat: parseFloat(params.get('toLat')), lng: parseFloat(params.get('toLng')), name: params.get('toName') || 'Điểm đến' };
      initialCenter = [startPoint.lat, startPoint.lng];
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!startPoint) {
            initialCenter = [pos.coords.latitude, pos.coords.longitude];
            lastUserPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
            lastHeading = pos.coords.heading || 0;
          }
          updateLoadingProgress(95, "Đã lấy được GPS...");
          checkLoadingComplete();
        },
        () => { updateLoadingProgress(95, "Không lấy được GPS, dùng mặc định"); checkLoadingComplete(); },
        { enableHighAccuracy: true, timeout: 3000 }
      );
    } else { updateLoadingProgress(95, "Thiết bị không hỗ trợ GPS"); checkLoadingComplete(); }
  } else {
    if (isAppReadyToShow && wasLoggedIn) { applyScreenState(); return; }
    updateLoadingProgress(95, "Chưa đăng nhập...");
    checkLoadingComplete();
  }
});

/* [V4] Đóng nhánh else của guard onAuthStateChanged. */
}

/* ========== APP INIT ========== */
function initAppUI() {
  initTheme();
  initMap();
  initDataSubscriptions();
  setupSearchInputs();
  updateVoiceSettingsUI();

  checkWorkerHealth().then(h => {
    if (!h) {
      showCustomToast('⚠️ Không kết nối được máy chủ DriveKit', 'warning');
      return;
    }
    if (!h.mapillary) console.warn('[DriveKit] Worker chưa cấu hình Mapillary token — biển báo sẽ trống');
    if (!h.d1)        console.warn('[DriveKit] Worker chưa gắn D1 — biển báo tĩnh sẽ không tải được');
    if (!h.kv)        console.warn('[DriveKit] Worker chưa gắn KV — cache sẽ tắt, chậm hơn');
    if (!h.valhalla_url) console.warn('[DriveKit] Worker thiếu VALHALLA_URL — dùng mặc định Codespaces (có thể ngủ)');
  });

  if (lastUserPos) {
    if (!startPoint) {
      startPoint = { lat: lastUserPos.lat, lng: lastUserPos.lng, name: 'Vị trí của tôi' };
      document.getElementById('dirInputStart').value = 'Vị trí của tôi (GPS)';
      document.getElementById('btnClearStart').classList.remove('hidden');
    }
  } else refreshGPS();
  const params = new URLSearchParams(window.location.search);
  if (params.get('fromLat')) {
    const toLat = parseFloat(params.get('toLat'));
    const toLng = parseFloat(params.get('toLng'));
    const toName = params.get('toName') || 'Điểm đến';
    if (startPoint) {
      document.getElementById('dirInputStart').value = startPoint.name;
      document.getElementById('dirInputEnd').value = endPoint.name;
      document.getElementById('topSearchInput').value = endPoint.name;
      document.getElementById('btnClearStart').classList.remove('hidden');
      document.getElementById('btnClearEnd').classList.remove('hidden');
      document.getElementById('searchClearBtn').classList.remove('hidden');
    }
    setTimeout(() => { showSharedLocationMarker(toLat, toLng, toName, true); }, 800);
  }
  const liveRoomParam = params.get('room');
  if (liveRoomParam) { setTimeout(() => { initViewerLiveRoom(liveRoomParam); }, 1000); }
}

function initTheme() {
  if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-mode');
    const t = document.getElementById('themeToggle');
    if (t) t.checked = true;
  }
  updateThemeColor();
}
function updateThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', document.body.classList.contains('light-mode') ? '#f8fafc' : '#0f172a');
}
window.toggleTheme = function() {
  const t = document.getElementById('themeToggle');
  if (t && t.checked) { document.body.classList.add('light-mode'); localStorage.setItem('theme', 'light'); }
  else { document.body.classList.remove('light-mode'); localStorage.setItem('theme', 'dark'); }
  updateThemeColor();
};
setInterval(() => { if (document.hidden) return; const c = document.getElementById('profileTime'); if (c) c.textContent = new Date().toLocaleTimeString('vi-VN'); }, 1000);

/* ========== SEARCH INPUT WIRING ========== */
function setupSearchInputs() {
  const inputs = [
    document.getElementById('topSearchInput'),
    document.getElementById('dirInputStart'),
    document.getElementById('dirInputEnd')
  ];
  inputs.forEach(inp => {
    if (!inp) return;
    let debounceTimer = null;
    inp.addEventListener('input', () => {
      const q = inp.value.trim();
      if (debounceTimer) clearTimeout(debounceTimer);
      if (q.length < 2) {
        document.getElementById('suggestionsBox').innerHTML = '';
        return;
      }
      debounceTimer = setTimeout(() => doSearch(q), 300);
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSearch();
    });
  });
}

/* ========== AUTH UI ========== */
function getAuthErrorMessage(errorCode) {
  switch (errorCode) {
    case 'auth/invalid-email': return 'Email không đúng định dạng.';
    case 'auth/user-disabled': return 'Tài khoản này đã bị khóa.';
    case 'auth/user-not-found': return 'Tài khoản không tồn tại. Vui lòng đăng ký.';
    case 'auth/wrong-password': return 'Mật khẩu không chính xác.';
    case 'auth/invalid-credential': return 'Tài khoản hoặc mật khẩu không đúng.';
    case 'auth/email-already-in-use': return 'Email này đã được đăng ký.';
    case 'auth/weak-password': return 'Mật khẩu quá yếu (phải từ 6 ký tự).';
    default: return 'Có lỗi xảy ra. Vui lòng thử lại sau.';
  }
}
let isRegisterMode = false;
const authTitle = document.getElementById('authTitle');
const authSubtitle = document.getElementById('authSubtitle');
const btnSubmitAuth = document.getElementById('btnSubmitAuth');
const authToggleText = document.getElementById('authToggleText');
const authToggleBtn = document.getElementById('authToggleBtn');
const authError = document.getElementById('authError');
if (authToggleBtn) {
  authToggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    if (authError) authError.style.display = 'none';
    if (isRegisterMode) {
      if (authTitle) authTitle.textContent = 'Tạo tài khoản 📝';
      if (authSubtitle) authSubtitle.textContent = 'Đăng ký để bắt đầu hành trình';
      if (btnSubmitAuth) btnSubmitAuth.textContent = 'Đăng ký tài khoản';
      if (authToggleText) authToggleText.textContent = 'Đã có tài khoản?';
      authToggleBtn.textContent = 'Đăng nhập';
    } else {
      if (authTitle) authTitle.textContent = 'DriveKit 🚌';
      if (authSubtitle) authSubtitle.textContent = 'Mọi hành trình, một giải pháp';
      if (btnSubmitAuth) btnSubmitAuth.textContent = 'Đăng nhập';
      if (authToggleText) authToggleText.textContent = 'Chưa có tài khoản?';
      authToggleBtn.textContent = 'Đăng ký ngay';
    }
  });
}
if (btnSubmitAuth) {
  btnSubmitAuth.addEventListener('click', async () => {
    const email = document.getElementById('authEmail')?.value || '';
    const pass = document.getElementById('authPassword')?.value || '';
    if (!email || !pass) { if (authError) { authError.textContent = 'Vui lòng nhập đầy đủ Email và Mật khẩu.'; authError.style.display = 'block'; } return; }
    btnSubmitAuth.disabled = true; btnSubmitAuth.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    if (authError) authError.style.display = 'none';
    try {
      if (isRegisterMode) await createUserWithEmailAndPassword(auth, email, pass);
      else await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) { if (authError) { authError.textContent = getAuthErrorMessage(err.code); authError.style.display = 'block'; } }
    finally { btnSubmitAuth.disabled = false; btnSubmitAuth.textContent = isRegisterMode ? 'Đăng ký tài khoản' : 'Đăng nhập'; }
  });
}
const btnGoogleAuth = document.getElementById('btnGoogleAuth');
if (btnGoogleAuth) {
  btnGoogleAuth.addEventListener('click', async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { if (authError) { authError.textContent = getAuthErrorMessage(e.code); authError.style.display = 'block'; } }
  });
}
window.logout = function() {
  if (liveEnabled) stopLiveSession();
  cleanupDataSubscriptions();
  signOut(auth);
  closeMenu();
};

/* ========== DATA SUBSCRIPTIONS ========== */
function cleanupDataSubscriptions() {
  Object.keys(_unsub).forEach(k => {
    if (_unsub[k]) { try { _unsub[k](); } catch(e){} _unsub[k] = null; }
  });
}
function initDataSubscriptions() {
  if (!currentUser) return;
  cleanupDataSubscriptions();
  _unsub.fsRest = onSnapshot(collection(fsdb, 'rest_stops'), snap => {
    _fsRestStops = snap.docs.map(d => ({ id: d.id, _id: d.id, source: 'firestore', ...d.data() }));
    recomputeRestStops();
  }, err => console.warn('FS rest_stops:', err));
  _unsub.fsPoi = onSnapshot(collection(fsdb, 'community_pois'), snap => {
    _fsCommunityPois = snap.docs.map(d => ({ id: d.id, _id: d.id, source: 'firestore', ...d.data() }));
    recomputeCommunityPois();
  }, err => console.warn('FS community_pois:', err));
  _unsub.rtdbReports = onValue(ref(db, 'reports'), snap => {
    const data = snap.val() || {};
    _rtdbReports = {};
    Object.entries(data).forEach(([k, v]) => {
      if (v.type === 'speed_limit' || v.type === 'speed_camera' || v.type === 'penalty_camera') return;
      _rtdbReports[k] = { id: k, _id: k, source: 'rtdb', ...v };
    });
    recomputeReports();
  }, err => console.warn('RTDB reports:', err));
  _unsub.fsAvoid = onSnapshot(collection(fsdb, 'avoid_zones'), snap => {
    _fsAvoidZones = snap.docs.map(d => ({ id: d.id, _id: d.id, source: 'firestore', ...d.data() }));
    recomputeAvoidZones();
  }, err => console.warn('FS avoid_zones:', err));
  _unsub.fsSaved = onSnapshot(collection(fsdb, `users/${currentUser.uid}/savedPlaces`), snap => {
    _fsSavedPlaces = {};
    snap.docs.forEach(d => { _fsSavedPlaces[d.id] = { id: d.id, _id: d.id, source: 'firestore', ...d.data() }; });
    recomputeSavedPlaces();
  }, err => console.warn('FS savedPlaces:', err));
  _unsub.fsHistory = onSnapshot(collection(fsdb, `users/${currentUser.uid}/history`), snap => {
    _fsHistory = snap.docs.map(d => ({ id: d.id, _id: d.id, source: 'firestore', ...d.data() }));
    recomputeHistory();
  }, err => console.warn('FS history:', err));
  _unsub.fsRoutes = onSnapshot(collection(fsdb, `users/${currentUser.uid}/savedRoutes`), snap => {
    _fsSavedRoutes = snap.docs.map(d => ({ id: d.id, _id: d.id, source: 'firestore', ...d.data() }));
    recomputeSavedRoutes();
  }, err => console.warn('FS savedRoutes:', err));
}
function recomputeRestStops() { allRestStops = [..._fsRestStops]; renderCommunityPoisOnMap(); renderRestStopMarkers(); }
function recomputeCommunityPois() { allCommunityPois = [..._fsCommunityPois]; renderCommunityPoisOnMap(); }
function recomputeReports() { allReports = { ..._rtdbReports }; renderReportsOnMap(); }
function recomputeSavedPlaces() { allSavedPlaces = { ..._fsSavedPlaces }; renderSavedPlacesOnMap(); }
function recomputeHistory() {
  allHistory = [..._fsHistory].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  renderHistoryList();
}
function recomputeSavedRoutes() {
  allSavedRoutes = [..._fsSavedRoutes].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  renderSavedRoutesList();
}

/* ========== TIME / VEHICLE LOGIC ========== */
function isZoneCurrentlyActive(zone) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  if (zone.startDate && todayStr < zone.startDate) return false;
  if (zone.endDate && todayStr > zone.endDate) return false;
  if (zone.timeStart && zone.timeEnd) {
    const currentTimeStr = now.toTimeString().slice(0, 5);
    if (zone.timeStart <= zone.timeEnd) { if (currentTimeStr < zone.timeStart || currentTimeStr > zone.timeEnd) return false; }
    else { if (currentTimeStr < zone.timeStart && currentTimeStr > zone.timeEnd) return false; }
  }
  return true;
}
function isVehicleBannedByZone(zone) {
  const vType = userVehicleSpecs.type;
  const banned = zone.bannedVehicles || [];
  if (banned.length === 0) return true;
  if (banned.includes(vType)) {
    if (vType === 'car' && zone.carSeats && zone.carSeats.length > 0) {
      const isMatchSeat = zone.carSeats.includes(userVehicleSpecs.seats.toString()) || (userVehicleSpecs.seats >= 9 && zone.carSeats.includes('9'));
      if (!isMatchSeat) return false;
    }
    if (vType === 'truck' && zone.truckAxles && zone.truckAxles.length > 0) {
      if (!zone.truckAxles.includes(userVehicleSpecs.axles.toString())) return false;
    }
    return true;
  }
  return false;
}
function checkRouteAgainstAvoidZones(routeCoords) {
  if (!allAvoidZones || allAvoidZones.length === 0) return { blocked: false };
  for (const zone of allAvoidZones) {
    if (!zone.lat1 || !zone.lng1) continue;
    if (!isZoneCurrentlyActive(zone)) continue;
    if (!isVehicleBannedByZone(zone)) continue;
    let segments = [];
    if (zone.waypoints) {
      try {
        const wps = typeof zone.waypoints === 'string' ? JSON.parse(zone.waypoints) : zone.waypoints;
        if (Array.isArray(wps) && wps.length > 0) {
          const isMulti = Array.isArray(wps[0][0]);
          if (isMulti) { wps.forEach(seg => { for (let i = 0; i < seg.length - 1; i++) segments.push({ a: { lat: seg[i][0], lng: seg[i][1] }, b: { lat: seg[i+1][0], lng: seg[i+1][1] } }); }); }
          else { for (let i = 0; i < wps.length - 1; i++) segments.push({ a: { lat: wps[i][0], lng: wps[i][1] }, b: { lat: wps[i+1][0], lng: wps[i+1][1] } }); }
        }
      } catch(e) {}
    }
    if (segments.length === 0) segments.push({ a: { lat: zone.lat1, lng: zone.lng1 }, b: { lat: zone.lat2, lng: zone.lng2 } });
    for (let i = 0; i < routeCoords.length; i += 3) {
      const p = { lat: routeCoords[i][0], lng: routeCoords[i][1] }; // [FIX 2026-11-22] routeCoords là [lat,lng] như mọi chỗ khác (drawCurrentRoute map [c1,c0], checkOffRoute dùng [0]=lat). Trước đây đảo ngược -> check vùng cấm sai: tuyến cấm thì không chặn, tuyến sạch lại bị chặn oan.
      for (const seg of segments) {
        const closestPt = getClosestPointOnSegment(p, seg.a, seg.b);
        const dist = calcDist(p.lat, p.lng, closestPt.lat, closestPt.lng);
        if (dist < 30) return { blocked: true, zoneName: zone.name };
      }
    }
  }
  return { blocked: false };
}
function recomputeAvoidZones() {
  const newAvoidZones = [..._fsAvoidZones];
  const addedZones = newAvoidZones.filter(n => !previousAvoidZones.some(o => o.id === n.id));
  allAvoidZones = newAvoidZones;
  previousAvoidZones = JSON.parse(JSON.stringify(newAvoidZones));
  renderAvoidZonesOnMap();
  if (addedZones.length > 0 && document.body.classList.contains('navigating')) {
    const check = checkRouteAgainstAvoidZones(currentRouteCoords);
    if (check.blocked) {
      speak("Phát hiện tuyến đường cấm mới trên lộ trình. Đang tự động tìm đường tránh.", 'avoid');
      showCustomToast("🚫 Lộ trình bị chặn bởi tuyến cấm mới. Đang Reroute...", "danger");
      localStorage.removeItem('alternativeRoutes');
      if (lastUserPos) autoReroute(lastUserPos.lat, lastUserPos.lng, true);
    }
  }
}

/* ========== UI STATE ========== */
function updateUIState() {
  const isNav = document.body.classList.contains('navigating');
  const isDirOpen = document.getElementById('dirSheet')?.classList.contains('open');
  const isSearchBoxShow = document.getElementById('suggestionsBox')?.classList.contains('show');
  const isNearbyOpen = document.getElementById('nearbySearchPanel')?.classList.contains('open') || document.getElementById('nearbyResultsOverlay').style.display === 'block';
  const searchBar = document.getElementById('searchBar');
  const mainMenuBtn = document.getElementById('mainMenuBtn');
  if (isNav) { searchBar.classList.add('hidden'); mainMenuBtn.classList.add('hidden'); }
  else { searchBar.classList.remove('hidden'); mainMenuBtn.classList.remove('hidden'); }
  const fabLocate = document.getElementById('mainLocateBtn');
  const fabDir = document.getElementById('mainDirBtn');
  const fabLayers = document.getElementById('btnLayerMenu');
  const fabQuickPin = document.getElementById('btnQuickPin');
  const fabReport = document.getElementById('btnReport');
  const fabRestStop = document.getElementById('btnRestStopFilter');
  const fabNearby = document.getElementById('btnNearbySearch');
  // [FIX TRIET DE 2026-11-21] Bam 3 gach / search ma FAB bien mat: do nhanh nay an het FAB khi suggestionsBox show / dirSheet mo.
  // Yeu cau moi: FAB 2 ben LUON hien, ke ca khi mo search / menu / dirSheet. Chi an khi DANG DAN DUONG that (isNav).
  if (false && (isDirOpen || isSearchBoxShow || isNearbyOpen)) {
    if(fabLocate) fabLocate.style.display = 'none'; if(fabDir) fabDir.style.display = 'none';
    if(fabLayers) fabLayers.style.display = 'none'; if(fabQuickPin) fabQuickPin.style.display = 'none';
    if(fabReport) fabReport.style.display = 'none'; if(fabRestStop) fabRestStop.style.display = 'none';
    if(fabNearby) fabNearby.style.display = 'none';
  } else if (isNav) {
    if(fabLocate) fabLocate.style.display = 'none'; if(fabDir) fabDir.style.display = 'none';
    if(fabLayers) fabLayers.style.display = 'none'; if(fabQuickPin) fabQuickPin.style.display = 'none';
    if(fabReport) fabReport.style.display = 'flex'; if(fabRestStop) fabRestStop.style.display = 'none';
    if(fabNearby) fabNearby.style.display = 'none';
  } else {
    if(fabLocate) fabLocate.style.display = 'flex'; if(fabDir) fabDir.style.display = 'flex';
    if(fabLayers) fabLayers.style.display = 'flex'; if(fabQuickPin) fabQuickPin.style.display = 'flex';
    if(fabReport) fabReport.style.display = 'flex'; if(fabRestStop) fabRestStop.style.display = 'flex';
    if(fabNearby) fabNearby.style.display = 'flex';
  }
}

/* ========== MAP INIT ========== */
function initGpsCircleLayer() {
  if (map.getSource('gps-circle-source')) return;
  map.addSource('gps-circle-source', { type: 'geojson', data: gpsCircleGeoJSON || { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[]] } } });
  map.addLayer({ id: 'gps-circle-layer', type: 'fill', source: 'gps-circle-source', paint: { 'fill-color': '#10b981', 'fill-opacity': 0.15 } });
  map.addLayer({ id: 'gps-circle-outline', type: 'line', source: 'gps-circle-source', paint: { 'line-color': '#10b981', 'line-width': 1, 'line-opacity': 0.5 } });
}
function createCircleGeoJSON(lng, lat, radiusInMeters) {
  const points = 64;
  const km = radiusInMeters / 1000;
  const ret = [];
  const distanceX = km / (111.32 * Math.cos(lat * Math.PI / 180));
  const distanceY = km / 110.574;
  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    ret.push([lng + distanceX * Math.cos(theta), lat + distanceY * Math.sin(theta)]);
  }
  ret.push(ret[0]);
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ret] } };
}
function drawCurrentRoute() {
  // [FIX 2 DUONG XANH - VIDEO 2] Xoa mui ten trang truoc
  try{ if(typeof whiteArrowMarker!=='undefined' && whiteArrowMarker){ whiteArrowMarker.remove(); whiteArrowMarker=null; } }catch(e){}
  try{ if(typeof whiteArrowAheadMarker!=='undefined' && whiteArrowAheadMarker){ whiteArrowAheadMarker.remove(); whiteArrowAheadMarker=null; } }catch(e){}
  try{ if(typeof clearRouteOptionLayers==='function') clearRouteOptionLayers(); }catch(e){}
  // [FIX 2 DUONG XANH] Quet HET style de xoa moi layer/source tuyen cu, khong phu thuoc routeOptionCount (no ve 0 sau lan 1 nen lan sau khong xoa -> sot 2 duong xanh nhu video giay 5).
  // Chi giu lai gps-circle, user-marker, signs, pois - con lai cu co chu 'route' la xoa.
  try{
    if(map && map.getStyle){
      const st = map.getStyle();
      const layers = (st && st.layers) ? [...st.layers] : [];
      // Xoa layer truoc, source sau - de khong bi 'source in use'
      layers.forEach(l=>{
        const id = l && l.id || '';
        if(!id) return;
        const isRoute = id.includes('route') || id.includes('current-route') || id === 'current-route-casing';
        if(isRoute){
          try{ if(map.getLayer(id)) map.removeLayer(id); }catch(_){}
        }
      });
      const srcs = (st && st.sources) ? Object.keys(st.sources) : [];
      srcs.forEach(sid=>{
        if(sid.includes('route') || sid === 'current-route-source'){
          try{ if(map.getSource(sid)) map.removeSource(sid); }catch(_){}
        }
      });
    }
  }catch(e){}
  try{
    for(let i=0;i<15;i++){
      ['current-route-layer','current-route-source','alt-route-layer-'+i,'alt-route-source-'+i,'route-opt-layer-'+i,'route-opt-source-'+i,'route-option-layer-'+i,'route-option-source-'+i,'current-route-casing'].forEach(id=>{
        try{ if(map && map.getLayer(id)) map.removeLayer(id); }catch(_){}
        try{ if(map && map.getSource(id)) map.removeSource(id); }catch(_){}
      });
    }
  }catch(e){}
  try{ if(typeof searchResultMarkers!=='undefined' && searchResultMarkers){ searchResultMarkers.forEach(m=>{ try{m.remove();}catch(_){} }); searchResultMarkers=[]; } }catch(e){}
  try{ if(typeof touchMarker!=='undefined' && touchMarker){ try{ if(typeof closePopupSmoothly==='function') closePopupSmoothly(touchMarker); else touchMarker.remove(); }catch(_){} touchMarker=null; } }catch(e){}
  // [FIX DOI TUYEN LAN 3] Khong reset isNavigating/navFollowMode o day - ham nay chi ve duong, khong phai thoat chi duong.
  // Truoc day moi lan ve lai no set isNavigating=false -> camera + HUD lech, lan 3 tu ngat.
  try{ if(typeof _lastCamAt!=='undefined') _lastCamAt=0; }catch(e){}
  // [FIX CASING] Xoa lop vien trang truoc khi xoa source, neu khong MapLibre bao 'source in use' -> lan 3 ve do, duong xanh mat trang nhu video.
  try{ if(map && map.getLayer('current-route-casing')) map.removeLayer('current-route-casing'); }catch(e){}
  try{ if(map && map.getLayer('current-route-layer')) map.removeLayer('current-route-layer'); }catch(e){}
  try{ if(map && map.getSource('current-route-source')) map.removeSource('current-route-source'); }catch(e){}
  if (!currentRouteCoords || currentRouteCoords.length === 0) return;
  map.addSource('current-route-source', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: currentRouteCoords.map(c => [c[1], c[0]]) } } });
  map.addLayer({ id: 'current-route-layer', type: 'line', source: 'current-route-source', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#3b82f6', 'line-width': 8 } });
}
function updateCompassNeedle() {
  if (!map) return;
  const needle = document.getElementById('compassNeedle');
  const btn = document.getElementById('btnCompass');
  if (!needle || !btn) return;
  const bearing = map.getBearing() || 0;
  needle.style.transform = `rotate(${-bearing}deg)`;
  btn.classList.toggle('off-north', Math.abs(bearing) > 1);
}
window.resetNorth = function() { if (map) map.easeTo({ bearing: 0, pitch: 0, duration: 600 }); };
window.toggleTraffic = function(isChecked) { /* traffic disabled */ };

function initMap() {
  if (map) return;
  if (typeof maplibregl === 'undefined') {
    console.error('[DriveKit] MapLibre chua tai duoc');
    const _lt = document.getElementById('loadingText');
    if (_lt) _lt.textContent = 'Khong tai duoc ban do, kiem tra mang roi tai lai trang.';
    return;
  }
  map = new maplibregl.Map({
    container: 'map', style: TRACKASIA_STYLE,
    center: [initialCenter[1], initialCenter[0]], zoom: initialZoom,
    pitch: 0, bearing: 0, attributionControl: true,
    touchZoomRotate: true, dragRotate: true
  });

  // [DEBUG] expose ra window để Console truy cập
  window.map = map;

  map.on('rotate', updateCompassNeedle);
  map.on('load', updateCompassNeedle);
  map.on('load', () => {
    initGpsCircleLayer();
    if (lastUserPos) updateUserMarkerOnMap(lastUserPos, lastHeading);
    renderCommunityPoisOnMap();
    renderRestStopMarkers();
    renderSavedPlacesOnMap();
    renderReportsOnMap();
    renderAvoidZonesOnMap();
    initMapillarySignsLayer();
    setTimeout(loadStaticWarnings, 1000);
  });
  map.on('contextmenu', (e) => {
    if (document.getElementById('dirSheet')?.classList.contains('open')) return;
    if (document.getElementById('suggestionsBox')?.classList.contains('show')) closeSearch();
    showLocationPopup(e.lngLat);
  });
  map.on('click', (e) => {
    const _inNav = !!(document.body && document.body.classList.contains('google-nav')) || !!isNavigating;
    // Mo lai click khi dang dan duong: bam map van geocoding, chi an nut "Toi cho nay" trong popup
    // Dung follow de popup khong bi camera keo di
    if (_inNav) { try{ navFollowMode = 'free'; _isUserDraggingMap = false; /* [FIX Claude] Bo map.stop() - stop lam chet cu keo */ if(typeof showRecenterBtn === 'function') showRecenterBtn(); }catch(err){} }
    if (isNearbyPickingMode) {
      const lat = e.lngLat.lat, lon = e.lngLat.lng;
      currentNearbyCenter = { lat, lon };
      updateNearbyCenterMarker(lat, lon);
      toggleNearbyPickMode(false);
      document.getElementById('nearbySearchPanel')?.classList.add('open');
      fetchNearbyPlaces();
      return;
    }
    if (document.getElementById('poiDetailSheet')?.classList.contains('open')) { closePoiDetail(); return; }
    if (touchMarker) {
      /* [V5] Marker đã bị remove() từ nút trong popup (Ghìm/Tới chỗ này/Thêm địa điểm)
         nhưng touchMarker vẫn truthy: cú bấm này phải hiện popup mới, không được
         nuốt mất để đóng một marker vốn đã không còn trên bản đồ. */
      let _tmEl = null;
      try { _tmEl = touchMarker.getElement(); } catch (e) {}
      if (_tmEl && !_tmEl.isConnected) { touchMarker = null; }
      else { closePopupSmoothly(touchMarker); touchMarker = null; return; }
    }
    if ((document.getElementById('dirSheet')?.classList.contains('open') || document.getElementById('suggestionsBox')?.classList.contains('show'))) {
      closeDirections();
      if (document.getElementById('suggestionsBox')?.classList.contains('show')) closeSearch();
      return;
    }
    showLocationPopup(e.lngLat);
  });
  map.on('moveend', () => {
    if (map.getZoom() < 13) { staticWarningMarkers.forEach(m => m.remove()); staticWarningMarkers = []; return; }
    if (staticWarningsTimer) clearTimeout(staticWarningsTimer);
    staticWarningsTimer = setTimeout(loadStaticWarnings, 600);
  });
  /* [V2-Nhom3] Keo ban do xong 200ms moi ve lai marker (debounce), tranh ve lien tuc khi keo. */
  map.on('moveend', function(){ _drivekitScheduleMarkerRerender(); });
  let zoomRenderTimer = null;
  map.on('zoomend', () => {
    if (zoomRenderTimer) clearTimeout(zoomRenderTimer);
    zoomRenderTimer = setTimeout(() => {
      renderCommunityPoisOnMap();
      renderRestStopMarkers();
      renderSavedPlacesOnMap();
      renderReportsOnMap();
      renderAvoidZonesOnMap();
      const z = map.getZoom();
      if (z < Math.min(ZOOM_CONFIG.communityPoi, ZOOM_CONFIG.savedPlace, ZOOM_CONFIG.report)) showZoomHint();
    }, 150);
  });
}

/* ========== STATIC WARNINGS (D1) ========== */
async function loadStaticWarnings() {
  if (!map || map.getZoom() < 13) return;
  const b = map.getBounds();
  const bounds = { south: b.getSouth(), north: b.getNorth(), west: b.getWest(), east: b.getEast() };
  const gridKey = `${bounds.south.toFixed(2)}_${bounds.west.toFixed(2)}_${bounds.north.toFixed(2)}_${bounds.east.toFixed(2)}`;
  if (staticWarningsGridCache[gridKey]) { renderStaticWarningsOnMap(staticWarningsGridCache[gridKey]); return; }
  const warnings = await getStaticWarnings(bounds);
  staticWarningsGridCache[gridKey] = warnings;
  renderStaticWarningsOnMap(warnings);
}
function renderStaticWarningsOnMap(warnings) {
  staticWarningMarkers.forEach(m => m.remove());
  staticWarningMarkers = [];
  if (!warnings || warnings.length === 0 || !map || map.getZoom() < 13) return;
  warnings.forEach(w => {
    const el = document.createElement('div');
    if (w.type === 'speed_limit') { el.className = 'speed-limit-marker'; el.textContent = w.speed || '?'; }
    else if (w.type === 'speed_camera') { el.innerHTML = `<div style="background:#e11d48;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.3);"><i class="fas fa-camera"></i></div>`; }
    else if (w.type === 'penalty_camera') { el.innerHTML = `<div style="background:#8b5cf6;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.3);"><i class="fas fa-video"></i></div>`; }
    else return;
    let title = 'Cảnh báo';
    if (w.type === 'speed_limit') title = `Tốc độ: ${w.speed} km/h`;
    if (w.type === 'speed_camera') title = 'Camera tốc độ';
    if (w.type === 'penalty_camera') title = 'Camera phạt nguội';
    const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`<b>${title}</b><br><small>Cảnh báo cộng đồng (D1)</small>`);
    const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([w.lng, w.lat]).setPopup(popup).addTo(map);
    staticWarningMarkers.push(marker);
  });
}

/* ========== POPUP & MARKERS ========== */
function showLocationPopup(lngLat) {
  const pixel = map.project(lngLat);
  const ripple = document.createElement('div');
  ripple.className = 'map-ripple';
  ripple.style.left = pixel.x + 'px'; ripple.style.top = pixel.y + 'px';
  document.body.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
  if (navigator.vibrate) navigator.vibrate(30);
  const loadingHtml = `<div style="text-align:center; padding:8px; color:var(--text); min-width: 140px;"><i class="fas fa-spinner fa-spin" style="color:var(--primary); font-size:1.2rem; margin-bottom:6px;"></i><br><span style="font-size:0.85rem; font-weight:600;">Đang lấy địa chỉ...</span></div>`;
  /* [V5] Nếu tạo marker/popup chính lỗi thì vẫn phải hiện popup dự phòng với
     tọa độ, không được im lặng: cú bấm đã tới đây thì người dùng phải thấy gì đó. */
  let popup = new maplibregl.Popup({ offset: 10, maxWidth: '300px', closeOnClick: false, closeButton: false }).setLngLat([lngLat.lng, lngLat.lat]).setHTML(loadingHtml);
  let markerRef = null;
  try {
    const el = createTouchMarkerElement();
    touchMarker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lngLat.lng, lngLat.lat]).setPopup(popup).addTo(map);
    touchMarker.togglePopup();
    markerRef = touchMarker;
  } catch (e) {
    console.error('[DriveKit] showLocationPopup marker failed, fallback popup:', e);
    touchMarker = null;
    try { popup.addTo(map); } catch (_) {}
  }
  (async () => {
    let name = '';
    try { const raw = await apiReverseGeocode(lngLat.lat, lngLat.lng); if (raw) name = raw.split(',').slice(0, 3).join(', '); } catch (e) {}
    const displayName = name || `Tọa độ: ${lngLat.lat.toFixed(5)}, ${lngLat.lng.toFixed(5)}`;
    const safeName = jsSafe(displayName);
    // Dang dan duong: popup chi 3 nut - Ghim / Them moi / Share (an nut Toi cho nay)
    const _inNavPopup = !!(document.body && document.body.classList.contains('google-nav')) || !!isNavigating;
    const _goBtn = _inNavPopup ? '' : `<button onclick="event.stopPropagation(); goToLongPressLocation(${lngLat.lat}, ${lngLat.lng}, '${safeName}')" style="width: 100%; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; margin-bottom: 6px;"><i class="fas fa-location-arrow"></i> Tới chỗ này</button>`;
    const popupHtml = `
      <div style="min-width: 180px;">
        <div style="font-weight: 800; font-size: 0.9rem; margin-bottom: 8px; line-height: 1.3; color: var(--text);">${escapeHtml(displayName)}</div>
        <button onclick="event.stopPropagation(); openSavePlaceModal(${lngLat.lat}, ${lngLat.lng}, '${safeName}')" style="width: 100%; padding: 10px; background: var(--success); color: white; border: none; border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; margin-bottom: 6px;"><i class="fas fa-bookmark"></i> Ghim địa điểm</button>
        <button onclick="event.stopPropagation(); openPoiSheet(${lngLat.lat}, ${lngLat.lng}, '${safeName}')" style="width: 100%; padding: 10px; background: linear-gradient(135deg,#10b981,#059669); color: white; border: none; border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; margin-bottom: 6px;"><i class="fas fa-plus-circle"></i> Thêm địa điểm mới</button>
        ${_goBtn}
        <button onclick="event.stopPropagation(); shareLocation(${lngLat.lat}, ${lngLat.lng}, '${safeName}')" style="width: 100%; padding: 10px; background: var(--card-2); color: var(--text); border: 1px solid var(--border); border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer;"><i class="fas fa-share-alt"></i> Chia sẻ</button>
      </div>`;
    if (touchMarker === markerRef) { try { popup.setHTML(popupHtml); } catch(e) {} }
  })();
}
function showSharedLocationMarker(lat, lng, name, isDestination = false) {
  const el = document.createElement('div');
  el.innerHTML = `<div style="position: relative; width: 24px; height: 24px;"><div style="position: absolute; inset: 0; background: #f97316; border-radius: 50%; opacity: 0.5; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div><div style="position: absolute; inset: 4px; background: #f97316; border-radius: 50%; border: 3px solid white;"></div></div>`;
  const label = isDestination ? '📍 Điểm đến được chia sẻ' : '📍 Vị trí được chia sẻ';
  const popup = new maplibregl.Popup().setHTML(`<b>${label}</b><br><small>${escapeHtml(name)}</small>`);
  new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).setPopup(popup).addTo(map).togglePopup();
  map.flyTo({ center: [lng, lat], zoom: 16 });
}

/* ========== MARKERS RENDERING ========== */
function createSavedPlacePin(place) {
  const icons = { home: { icon: 'fa-home', color: '#10b981' }, cafe: { icon: 'fa-coffee', color: '#f59e0b' }, restaurant: { icon: 'fa-utensils', color: '#ef4444' }, company: { icon: 'fa-building', color: '#3b82f6' }, school: { icon: 'fa-school', color: '#8b5cf6' }, other: { icon: 'fa-map-marker-alt', color: '#64748b' } };
  const conf = icons[place.type] || icons.other;
  const wrapper = document.createElement('div');
  wrapper.style.width = '30px'; wrapper.style.height = '30px'; wrapper.style.position = 'relative';
  wrapper.innerHTML = `<div class="custom-pin" style="width: 30px; height: 30px; background: ${conf.color}; border-color: ${conf.color};"><i class="fas ${conf.icon}" style="color: white;"></i></div><div class="custom-pin-close" data-del-id="${place._id}" title="Xoá"><i class="fas fa-times"></i></div>`;
  wrapper.querySelector('.custom-pin-close').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteSavedPlace(place.source, place._id);
  });
  return wrapper;
}
function renderSavedPlacesOnMap() {
  savedPlacesMarkers.forEach(m => m.remove());
  savedPlacesMarkers = [];
  const currentZoom = map ? map.getZoom() : 17;
  for (const key in allSavedPlaces) {
    const place = allSavedPlaces[key];
    const alwaysShow = ZOOM_CONFIG.savedPlaceAlwaysShow.includes(place.type);
    if (!alwaysShow && currentZoom < ZOOM_CONFIG.savedPlace) continue;
    const el = createSavedPlacePin(place);
    const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`<b>${escapeHtml((place.address || '').split(',')[0])}</b>`);
    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([place.lng, place.lat]).setPopup(popup).addTo(map);
    savedPlacesMarkers.push(marker);
  }
}
window.openSavePlaceModal = function(lat, lng, addr) {
  tempPinLatLng = { lat, lng }; tempPinName = addr;
  document.getElementById('savePlaceAddress').textContent = addr;
  document.getElementById('savePlaceModal').classList.add('open');
};
window.openQuickPin = function() {
  if (!lastUserPos) return alert('Chưa lấy được vị trí GPS!');
  tempPinLatLng = { lat: lastUserPos.lat, lng: lastUserPos.lng };
  document.getElementById('savePlaceAddress').textContent = "Đang lấy địa chỉ...";
  document.getElementById('savePlaceModal').classList.add('open');
  apiReverseGeocode(lastUserPos.lat, lastUserPos.lng).then(raw => {
    tempPinName = raw ? raw.split(',').slice(0, 3).join(', ') : `Vị trí GPS (${lastUserPos.lat.toFixed(4)}, ${lastUserPos.lng.toFixed(4)})`;
    document.getElementById('savePlaceAddress').textContent = tempPinName;
  }).catch(() => { tempPinName = `Vị trí GPS`; document.getElementById('savePlaceAddress').textContent = tempPinName; });
};
window.closeSavePlaceModal = function() { document.getElementById('savePlaceModal').classList.remove('open'); };
window.submitSavePlace = async function(type) {
  if (!currentUser || !tempPinLatLng) return;
  closeSavePlaceModal();
  try {
    await addDoc(collection(fsdb, `users/${currentUser.uid}/savedPlaces`), { lat: tempPinLatLng.lat, lng: tempPinLatLng.lng, address: tempPinName, type, timestamp: Date.now() });
    showCustomToast('Đã ghim địa điểm!', 'success');
  } catch (e) { alert('Lỗi lưu địa điểm: ' + e.message); }
};
window.deleteSavedPlace = async function(source, id) {
  if (!confirm('Bạn có chắc muốn xoá ghim này?')) return;
  try { await deleteDoc(doc(fsdb, `users/${currentUser.uid}/savedPlaces/${id}`)); } catch(e) { alert('Lỗi xoá: ' + e.message); }
};
/* [V2-Nhom3] Helper khung nhin: chi ve marker trong khung nhin + dem 20% moi ben. */
function _drivekitBoundsKey() { try { if (!map || !map.getBounds) return ''; const b = map.getBounds(); return [b.getSouth().toFixed(3), b.getWest().toFixed(3), b.getNorth().toFixed(3), b.getEast().toFixed(3)].join(','); } catch(e) { return ''; } }
function _drivekitInView(lat, lng) { try { if (!map || !map.getBounds || typeof lat !== 'number' || typeof lng !== 'number') return true; const b = map.getBounds(); const h = b.getNorth() - b.getSouth(); const w = b.getEast() - b.getWest(); return lat >= b.getSouth() - h * 0.2 && lat <= b.getNorth() + h * 0.2 && lng >= b.getWest() - w * 0.2 && lng <= b.getEast() + w * 0.2; } catch(e) { return true; } }
let _drivekitMoveRenderTimer = null;
function _drivekitScheduleMarkerRerender() { try { if (_drivekitMoveRenderTimer) clearTimeout(_drivekitMoveRenderTimer); _drivekitMoveRenderTimer = setTimeout(function(){ try { renderRestStopMarkers(); renderCommunityPoisOnMap(); renderReportsOnMap(); } catch(e) {} }, 200); } catch(e) {} }
function renderRestStopMarkers() {
  const z = map ? map.getZoom() : 17;
  if (z < ZOOM_CONFIG.restStop) { if (restStopMarkers.length) { restStopMarkers.forEach(m => m.remove()); restStopMarkers = []; _restStopMarkerMap.clear(); _restStopFingerprint = ''; } return; }
  const _bk = _drivekitBoundsKey();
  const _fp = allRestStops.map(poi => `${poi._id || poi.id || ''}|${poi.lng}|${poi.lat}|${poi.tag}`).join(';') + `|filter=${restStopFilterActive}|bounds=${_bk}`;
  if (_fp === _restStopFingerprint) return; _restStopFingerprint = _fp;
  /* [V4] Diff theo id: chỉ xóa marker mất khỏi desired hoặc đổi sig, chỉ tạo
     marker mới; marker không đổi giữ nguyên đối tượng (không tạo lại DOM). */
  const _desiredRest = new Map();
  allRestStops.forEach(poi => {
    if (restStopFilterActive && poi.tag !== 'rest_stop' && poi.tag !== 'gas_station') return;
    if (!_drivekitInView(poi.lat, poi.lng)) return;
    _desiredRest.set(poi._id || poi.id || `${poi.lng}|${poi.lat}|${poi.tag}`, { poi, sig: `${poi.lng}|${poi.lat}|${poi.tag}` });
  });
  _restStopMarkerMap.forEach((entry, _key) => {
    const want = _desiredRest.get(_key);
    if (!want || want.sig !== entry.sig) { try { entry.marker.remove(); } catch (e) {} _restStopMarkerMap.delete(_key); }
  });
  _desiredRest.forEach((want, _key) => {
    if (_restStopMarkerMap.has(_key)) return;
    const poi = want.poi;
    const el = document.createElement('div');
    el.style.width = '40px'; el.style.height = '40px';
    el.innerHTML = `<div class="community-poi-pin rest-stop-pin"><i class="fas fa-bed"></i><div class="verified-badge"><i class="fas fa-check"></i></div></div>`;
    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([poi.lng, poi.lat]).addTo(map);
    el.addEventListener('click', (ev) => { ev.stopPropagation(); openPoiDetail(poi.source, poi._id); });
    _restStopMarkerMap.set(_key, { marker, sig: want.sig });
  });
  restStopMarkers = [..._restStopMarkerMap.values()].map(e => e.marker);
}
function renderCommunityPoisOnMap() {
  const currentZoom = map ? map.getZoom() : 17;
  if (currentZoom < ZOOM_CONFIG.communityPoi) { if (communityPoiMarkers.length) { communityPoiMarkers.forEach(m => m.remove()); communityPoiMarkers = []; _communityPoiMarkerMap.clear(); _communityPoiFingerprint = ''; } return; }
  const _bk = _drivekitBoundsKey();
  const _fp = allCommunityPois.map(poi => `${poi._id || poi.id || ''}|${poi.lng}|${poi.lat}|${poi.tag}`).join(';') + `|bounds=${_bk}`;
  if (_fp === _communityPoiFingerprint) return; _communityPoiFingerprint = _fp;
  /* [V4] Diff theo id: chỉ xóa marker mất khỏi desired hoặc đổi sig, chỉ tạo
     marker mới; marker không đổi giữ nguyên đối tượng (không tạo lại DOM). */
  const _desiredPoi = new Map();
  allCommunityPois.forEach(poi => {
    if (!_drivekitInView(poi.lat, poi.lng)) return;
    _desiredPoi.set(poi._id || poi.id || `${poi.lng}|${poi.lat}|${poi.tag}`, { poi, sig: `${poi.lng}|${poi.lat}|${poi.tag}` });
  });
  _communityPoiMarkerMap.forEach((entry, _key) => {
    const want = _desiredPoi.get(_key);
    if (!want || want.sig !== entry.sig) { try { entry.marker.remove(); } catch (e) {} _communityPoiMarkerMap.delete(_key); }
  });
  _desiredPoi.forEach((want, _key) => {
    if (_communityPoiMarkerMap.has(_key)) return;
    const poi = want.poi;
    const conf = POI_TAG_CONFIG[poi.tag] || POI_TAG_CONFIG.supermarket;
    const el = document.createElement('div');
    el.style.width = '32px'; el.style.height = '32px';
    el.innerHTML = `<div class="community-poi-pin"><i class="fas ${conf.icon}"></i><div class="verified-badge"><i class="fas fa-check"></i></div></div>`;
    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([poi.lng, poi.lat]).addTo(map);
    el.addEventListener('click', (ev) => { ev.stopPropagation(); openPoiDetail(poi.source, poi._id); });
    _communityPoiMarkerMap.set(_key, { marker, sig: want.sig });
  });
  communityPoiMarkers = [..._communityPoiMarkerMap.values()].map(e => e.marker);
}
function renderReportsOnMap() {
  const now = Date.now();
  const currentZoom = map ? map.getZoom() : 17;
  if (currentZoom < ZOOM_CONFIG.report) { if (reportMarkers.length) { reportMarkers.forEach(m => m.remove()); reportMarkers = []; _reportFingerprint = ''; } return; }
  const _bk = _drivekitBoundsKey();
  const _fp = Object.keys(allReports).filter(key => now <= allReports[key].expiresAt && !['speed_limit', 'speed_camera', 'penalty_camera'].includes(allReports[key].type)).map(key => `${key}|${allReports[key].type}|${allReports[key].lng}|${allReports[key].lat}|${allReports[key].expiresAt}`).join(';') + `|bounds=${_bk}`;
  if (_fp === _reportFingerprint) return; _reportFingerprint = _fp;
  reportMarkers.forEach(m => m.remove());
  reportMarkers = [];
  for (const key in allReports) {
    const rep = allReports[key];
    if (now > rep.expiresAt) continue;
    if (rep.type === 'speed_limit' || rep.type === 'speed_camera' || rep.type === 'penalty_camera') continue;
    if (!_drivekitInView(rep.lat, rep.lng)) continue;
    const icons = {
      police: '<div style="background:#3b82f6;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.3);"><i class="fas fa-shield-alt"></i></div>',
      toll: '<div style="background:#f59e0b;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.3);"><i class="fas fa-money-bill"></i></div>',
      accident: '<div style="background:#ef4444;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.3);"><i class="fas fa-car-crash"></i></div>',
      traffic: '<div style="background:#f97316;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.3);"><i class="fas fa-traffic-light"></i></div>',
      pothole: '<div style="background:#f59e0b;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.3);"><i class="fas fa-exclamation-circle"></i></div>',
      flood: '<div style="background:#06b6d4;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.3);"><i class="fas fa-water"></i></div>',
      bridge_collapse: '<div style="background:#dc2626;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.3);"><i class="fas fa-road-circle-xmark"></i></div>',
      road_collapse: '<div style="background:#b91c1c;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.3);"><i class="fas fa-triangle-exclamation"></i></div>'
    };
    const el = document.createElement('div');
    el.innerHTML = icons[rep.type] || icons.pothole;
    let title = rep.type === 'police' ? 'CSGT' : rep.type === 'toll' ? 'Trạm thu phí' : rep.type === 'accident' ? 'Tai nạn' : rep.type === 'traffic' ? 'Kẹt xe' : rep.type === 'flood' ? 'Ngập nước' : rep.type === 'bridge_collapse' ? 'Sập cầu' : rep.type === 'road_collapse' ? 'Sập đường' : 'Ổ gà';
    const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`<b>${title}</b><br><small>Cảnh báo động (RTDB)</small>`);
    const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([rep.lng, rep.lat]).setPopup(popup).addTo(map);
    reportMarkers.push(marker);
  }
}
function renderAvoidZonesOnMap() {
  avoidZoneMarkers.forEach(m => m.remove());
  avoidZoneMarkers = [];
  if (map.getLayer('avoid-zones-line')) map.removeLayer('avoid-zones-line');
  if (map.getSource('avoid-zones')) map.removeSource('avoid-zones');
  if (allAvoidZones.length === 0) return;
  const features = [];
  allAvoidZones.forEach(zone => {
    if (!zone.lat1 || !zone.lng1) return;
    const isActive = isZoneCurrentlyActive(zone);
    let coordsForMarker = [];
    let hasWaypoints = false;
    if (zone.waypoints) {
      try {
        const wps = typeof zone.waypoints === 'string' ? JSON.parse(zone.waypoints) : zone.waypoints;
        if (Array.isArray(wps) && wps.length > 0) {
          const isMulti = Array.isArray(wps[0][0]);
          if (isMulti) {
            wps.forEach(seg => {
              if (seg && seg.length > 1) {
                features.push({ type: 'Feature', properties: { name: zone.name, isActive: isActive }, geometry: { type: 'LineString', coordinates: seg.map(p => [p[1], p[0]]) } });
              }
            });
            coordsForMarker = wps[0];
          } else {
            features.push({ type: 'Feature', properties: { name: zone.name, isActive: isActive }, geometry: { type: 'LineString', coordinates: wps.map(p => [p[1], p[0]]) } });
            coordsForMarker = wps;
          }
          hasWaypoints = true;
        }
      } catch (e) {}
    }
    if (!hasWaypoints) features.push({ type: 'Feature', properties: { name: zone.name, isActive: isActive }, geometry: { type: 'LineString', coordinates: [[zone.lng1, zone.lat1], [zone.lng2, zone.lat2]] } });
    let midLat = (zone.lat1 + zone.lat2) / 2;
    let midLng = (zone.lng1 + zone.lng2) / 2;
    if (coordsForMarker && coordsForMarker.length > 0) {
      const midIdx = Math.floor(coordsForMarker.length / 2);
      midLat = coordsForMarker[midIdx][0];
      midLng = coordsForMarker[midIdx][1];
    }
    const el = document.createElement('div');
    el.className = 'avoid-zone-pin';
    el.innerHTML = `<i class="fas fa-ban"></i>`;
    if (!isActive) el.style.opacity = '0.5';
    const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`<b>🚫 ${escapeHtml(zone.name || 'Tuyến đường cấm')}</b><br><small>${isActive ? 'Đang cấm' : 'Chưa tới giờ cấm'}</small>`);
    const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([midLng, midLat]).setPopup(popup).addTo(map);
    avoidZoneMarkers.push(marker);
  });
  if (features.length === 0) return;
  map.addSource('avoid-zones', { type: 'geojson', data: { type: 'FeatureCollection', features } });
  map.addLayer({
    id: 'avoid-zones-line', type: 'line', source: 'avoid-zones',
    paint: {
      'line-color': ['case', ['get', 'isActive'], '#ef4444', '#64748b'],
      'line-width': 8,
      'line-opacity': ['case', ['get', 'isActive'], 0.85, 0.4],
      'line-dasharray': [2, 2]
    }
  });
}

/* ========== REPORT & SIGNS ========== */
window.openReportMenu = function() { document.getElementById('reportModal').classList.add('open'); };
window.closeReportMenu = function() { document.getElementById('reportModal').classList.remove('open'); };
window.openSignsMenu = function() {
  document.getElementById('reportModal').classList.remove('open');
  document.getElementById('signsMenuModal').classList.add('open');
};
window.closeSignsMenu = function() {
  document.getElementById('signsMenuModal').classList.remove('open');
  document.getElementById('reportModal').classList.add('open');
};
window.closeSpeedLimitMenu = function() {
  document.getElementById('speedLimitModal').classList.remove('open');
  document.getElementById('signsMenuModal').classList.add('open');
};
window.selectSignsType = function(type) {
  if (type === 'speed_limit') {
    document.getElementById('signsMenuModal').classList.remove('open');
    document.getElementById('speedLimitModal').classList.add('open');
  } else { submitSignReport(type); }
};
window.submitSpeedLimit = async function(speed) {
  document.getElementById('speedLimitModal').classList.remove('open');
  if (!lastUserPos) return alert('Chưa lấy được vị trí GPS!');
  try {
    await saveStaticWarning('speed_limit', lastUserPos.lat, lastUserPos.lng, speed, currentUser?.uid);
    showCustomToast(`Đã ghim biển báo tốc độ ${speed} km/h!`, 'success');
    loadStaticWarnings();
  } catch (e) { alert('Lỗi: ' + e.message); }
};
async function submitSignReport(type) {
  if (!lastUserPos) return alert('Chưa lấy được vị trí GPS!');
  closeSignsMenu();
  const now = Date.now();
  try {
    if (type === 'speed_camera' || type === 'penalty_camera') {
      await saveStaticWarning(type, lastUserPos.lat, lastUserPos.lng, null, currentUser?.uid);
      showCustomToast('Đã gửi cảnh báo Camera!', 'success');
      loadStaticWarnings();
    } else if (type === 'toll') {
      const ttl = 86400000 * 30;
      await set(ref(db, `reports/${now}_${currentUser.uid}`), { lat: lastUserPos.lat, lng: lastUserPos.lng, type: 'toll', timestamp: now, expiresAt: now + ttl, uid: currentUser.uid });
      showCustomToast('Đã gửi cảnh báo Trạm thu phí!', 'success');
    }
  } catch (e) { alert('Lỗi: ' + e.message); }
}
window.submitReport = async function(type) {
  if (!lastUserPos) return alert('Chưa lấy được vị trí GPS, không thể báo cáo!');
  /* [V2-Nhom2] GPS kem (accuracy > 100m): canh bao va dung, khong ghi bao cao sai vi tri. */
  if (lastUserPos.accuracy && lastUserPos.accuracy > 100) {
    if (typeof showCustomToast === 'function') showCustomToast('GPS chưa chính xác (sai số trên 100m), vui lòng đợi GPS ổn định rồi gửi lại.', 'warning');
    else alert('GPS chưa chính xác (sai số trên 100m), vui lòng đợi GPS ổn định rồi gửi lại.');
    return;
  }
  const now = Date.now();
  /* [V2-Nhom2] Cooldown client: cung 1 loai bao cao toi thieu 30s moi gui tiep. */
  try {
    const _cd = JSON.parse(localStorage.getItem('drivekit_report_cooldown') || '{}');
    const _last = _cd[type] || 0;
    if (now - _last < 30000) {
      const _wait = Math.ceil((30000 - (now - _last)) / 1000);
      if (typeof showCustomToast === 'function') showCustomToast('Vui lòng đợi ' + _wait + ' giây nữa mới gửi lại báo cáo này.', 'warning');
      else alert('Vui lòng đợi ' + _wait + ' giây nữa mới gửi lại báo cáo này.');
      return;
    }
  } catch(e) {}
  /* [V2-Nhom2] Chong trung: da co bao cao cung loai, chua het han, trong ~150m thi dung. */
  try {
    if (typeof calcDist === 'function' && allReports) {
      for (const _k in allReports) {
        const _r = allReports[_k];
        if (!_r || _r.type !== type || now > _r.expiresAt) continue;
        if (typeof _r.lat !== 'number' || typeof _r.lng !== 'number') continue;
        if (calcDist(lastUserPos.lat, lastUserPos.lng, _r.lat, _r.lng) < 150) {
          if (typeof showCustomToast === 'function') showCustomToast('Đã có báo cáo tương tự gần đây.', 'warning');
          else alert('Đã có báo cáo tương tự gần đây.');
          return;
        }
      }
    }
  } catch(e) {}
  closeReportMenu();
  let ttl = 3600000;
  if (type === 'pothole') ttl = 86400000;
  else if (type === 'flood') ttl = 10800000;
  else if (type === 'traffic') ttl = 1800000;
  else if (type === 'bridge_collapse' || type === 'road_collapse') ttl = 604800000;
  try {
    await set(ref(db, `reports/${now}_${currentUser.uid}`), { lat: lastUserPos.lat, lng: lastUserPos.lng, type, timestamp: now, expiresAt: now + ttl, uid: currentUser.uid });
    try { const _cd2 = JSON.parse(localStorage.getItem('drivekit_report_cooldown') || '{}'); _cd2[type] = now; localStorage.setItem('drivekit_report_cooldown', JSON.stringify(_cd2)); } catch(e) {}
    showCustomToast('Đã gửi báo cáo!', 'success');
  } catch (e) { alert('Lỗi: ' + e.message); }
};
/* =====================================================
   DriveKit — app.js FULL (ĐÃ SYNC DEMO MAPILLARY)
   Part 2: Search → GPS → POI → Live → Menu → Share → Nav
   ===================================================== */

/* ========== SEARCH UI ========== */
window.activateSearch = function(ctx) {
  searchContext = ctx;
  document.getElementById('suggestionsBox')?.classList.add('show');
  updateUIState();
  let input;
  if (ctx === 'start') input = document.getElementById('dirInputStart');
  else if (ctx === 'end') input = document.getElementById('dirInputEnd');
  else input = document.getElementById('topSearchInput');
  if (input) {
    input.readOnly = false;
    input.focus();
    if (input.value && input.value.length >= 2) doSearch(input.value);
  }
};
window.closeSearch = function() {
  document.getElementById('suggestionsBox')?.classList.remove('show');
  // [FIX] Dong search xong phai tra lai nut - neu dirSheet khong mo thi hien lai FAB
  try{
    setTimeout(()=>{
      const dirOpen = document.getElementById('dirSheet') && document.getElementById('dirSheet')?.classList.contains('open');
      if(!dirOpen){
        const ids2 = ['mainLocateBtn','mainDirBtn','btnLayerMenu','btnQuickPin','btnReport','btnRestStopFilter','btnNearbySearch'];
        ids2.forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display='flex'; });
      }
    }, 50);
  }catch(e){}
  searchResultMarkers.forEach(m => m.remove());
  searchResultMarkers = [];
  const ti = document.getElementById('topSearchInput');
  if (ti) ti.readOnly = true;
  // Dang dan duong: dong luon overlay search de tra lai banner dan duong
  try{ const fs = document.querySelector('.floating-search'); if(fs) fs.classList.remove('show-in-nav'); }catch(e){}
  updateUIState();
};
window.clearPoint = function(which) {
  if (which === 'start') {
    startPoint = null;
    document.getElementById('dirInputStart').value = '';
    document.getElementById('btnClearStart').classList.add('hidden');
  } else if (which === 'end') {
    endPoint = null;
    document.getElementById('dirInputEnd').value = '';
    document.getElementById('topSearchInput').value = '';
    document.getElementById('btnClearEnd').classList.add('hidden');
    document.getElementById('searchClearBtn').classList.add('hidden');
  }
};
window.clearTopSearch = function() {
  searchResultMarkers.forEach(m => m.remove());
  searchResultMarkers = [];
  if (touchMarker) { closePopupSmoothly(touchMarker); touchMarker = null; }
  document.getElementById('topSearchInput').value = '';
  document.getElementById('searchClearBtn').classList.add('hidden');
  clearPoint('end');
  closeSearch();
};

function renderSearchResultMarkers(results, originalQuery) {
  searchResultMarkers.forEach(m => m.remove());
  searchResultMarkers = [];
  if (!results || results.length === 0) return;
  const center = results[0];
  if (!center?.lat || !center?.lng) return;
  const MAX_DIST = 1000;
  results.forEach((r) => {
    if (!r.lat || !r.lng) return;
    const dist = calcDist(center.lat, center.lng, r.lat, r.lng);
    if (dist <= MAX_DIST || r === center) {
      const el = document.createElement('div');
      el.className = 'search-result-pin';
      let displayName = r.name.split(',')[0];
      if (displayName.length > 25) displayName = displayName.substring(0, 25) + '...';
      let labelHtml = `<div style="font-weight:800; font-size:0.75rem; color:var(--text);">${escapeHtml(displayName)}</div>`;
      if (originalQuery && !displayName.toLowerCase().includes(originalQuery.toLowerCase())) {
        labelHtml += `<div style="font-size:0.6rem; color:#f59e0b; font-weight:800; margin-top:4px; background:rgba(245,158,11,0.15); padding:2px 6px; border-radius:4px; display:inline-block;"><i class="fas fa-location-dot"></i> ${escapeHtml(originalQuery)}</div>`;
      }
      el.innerHTML = `<div class="search-result-label" style="padding:8px 10px; text-align:center;">${labelHtml}</div><div class="search-result-dot"></div>`;
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([r.lng, r.lat]).addTo(map);
      el.addEventListener('click', (ev) => { ev.stopPropagation(); selectLocation(r.lat, r.lng, r.name); });
      searchResultMarkers.push(marker);
    }
  });
}

async function doSearch(query) {
  const box = document.getElementById('suggestionsBox');
  if (query.startsWith('http://') || query.startsWith('https://')) {
    if (query.includes('google.com/maps') || query.includes('goo.gl/maps')) {
      const coords = parseGmapsUrl(query);
      if (coords) {
        box.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'sug-item';
        div.innerHTML = `<i class="fas fa-map-marker-alt"></i><div>${escapeHtml(coords.name || 'Vị trí từ Google Maps')}</div>`;
        div.onclick = () => selectLocation(coords.lat, coords.lng, coords.name || 'Vị trí từ Google Maps');
        box.appendChild(div);
      } else {
        box.innerHTML = '<div class="sug-item" style="color:var(--danger);line-height:1.4;">Không đọc được toạ độ từ link rút gọn.</div>';
      }
      box.classList.add('show');
      return;
    }
  }
  const q = query.toLowerCase().trim();
  box.innerHTML = '';
  box.classList.add('show');

  const restStopMatches = allRestStops.filter(p => p.name && p.name.toLowerCase().includes(q));
  if (restStopMatches.length > 0) {
    const title = document.createElement('div');
    title.className = 'sug-section-title rest-stop-title';
    title.innerHTML = `<i class="fas fa-bed"></i> Trạm dừng nghỉ (${restStopMatches.length})`;
    box.appendChild(title);
    restStopMatches.forEach(poi => {
      const div = document.createElement('div');
      div.className = 'sug-item';
      div.innerHTML = `<i class="fas fa-bed" style="color:#3b82f6;font-size:1.1rem;"></i><div style="flex:1;"><div style="font-weight:700;">${escapeHtml(poi.name)}</div><div style="font-size:0.7rem;color:#3b82f6;font-weight:700;margin-top:2px;"><i class="fas fa-bed"></i> Trạm dừng nghỉ</div></div>`;
      div.onclick = () => selectLocation(poi.lat, poi.lng, poi.name);
      box.appendChild(div);
    });
  }
  const poiMatches = allCommunityPois.filter(p => p.name && p.name.toLowerCase().includes(q));
  if (poiMatches.length > 0) {
    const title = document.createElement('div');
    title.className = 'sug-section-title community';
    title.innerHTML = `<i class="fas fa-users"></i> Địa điểm cộng đồng (${poiMatches.length})`;
    box.appendChild(title);
    poiMatches.forEach(poi => {
      const conf = POI_TAG_CONFIG[poi.tag] || POI_TAG_CONFIG.supermarket;
      const div = document.createElement('div');
      div.className = 'sug-item';
      div.innerHTML = `<i class="fas fa-user-check" style="color:var(--success);"></i><div style="flex:1;"><div style="font-weight:700;">${escapeHtml(poi.name)}</div><div style="font-size:0.7rem;color:${conf.color};font-weight:700;margin-top:2px;"><i class="fas ${conf.icon}"></i> ${conf.label}</div></div>`;
      div.onclick = () => selectLocation(poi.lat, poi.lng, poi.name);
      box.appendChild(div);
    });
  }
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'sug-item';
  loadingDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tìm địa điểm khác...';
  box.appendChild(loadingDiv);
  try {
    const { results, counts } = await apiSearch(query);
    loadingDiv.remove();
    const currentCount = restStopMatches.length + poiMatches.length;
    const remainingSlots = Math.max(0, 20 - currentCount);
    const displayResults = results.slice(0, remainingSlots);
    if (displayResults.length > 0) {
      const title2 = document.createElement('div');
      title2.className = 'sug-section-title';
      const debugCounts = (isSearchDebugMode && counts) ? `<span style="margin-left:auto; font-size:0.6rem; color:var(--primary); text-transform:none;">[T:${counts.tomtom} D:${counts.duckdb} P:${counts.photon} M:${counts.maptiler} →${counts.merged ?? '?'}]</span>` : '';
      title2.innerHTML = `<i class="fas fa-map-marked-alt"></i> Địa điểm khác ${debugCounts}`;
      box.appendChild(title2);
      displayResults.forEach(r => {
        const div = document.createElement('div');
        div.className = 'sug-item';
        const isPoi = r.type === 'poi';
        const typeIcon = isPoi ? 'fa-map-marker-alt' : (r.type === 'address' ? 'fa-location-dot' : (r.type === 'place' ? 'fa-map-location-dot' : 'fa-road'));
        const typeLabel = isPoi ? (r.category ? r.category : 'Địa điểm') : r.type === 'address' ? 'Địa chỉ' : r.type === 'place' ? 'Địa danh' : (r.type === 'street' ? 'Đường' : 'Khác');
        const typeColor = isPoi ? '#10b981' : '#94a3b8';
        const sourceColors = { tomtom: '#ef4444', photon: '#3b82f6', maptiler: '#f59e0b', duckdb: '#8b5cf6' };
        const sourceBadge = (isSearchDebugMode && r._source) ? `<span style="display:inline-block; font-size:0.55rem; font-weight:900; padding:1px 4px; border-radius:4px; background:${sourceColors[r._source] || '#64748b'}; color:white; margin-left:6px; vertical-align:middle;">${r._source.toUpperCase()}</span>` : '';
        div.innerHTML = `<i class="fas ${typeIcon}" style="color:${typeColor}; font-size:1rem;"></i><div style="flex:1; min-width:0;"><div style="font-weight:700; white-space:normal; word-break:break-word;">${escapeHtml(r.name)} ${sourceBadge}</div><div style="font-size:0.65rem; color:${typeColor}; font-weight:700; margin-top:2px;"><i class="fas ${typeIcon}"></i> ${escapeHtml(typeLabel)}</div></div>`;
        div.onclick = () => selectLocation(r.lat, r.lng, r.name);
        box.appendChild(div);
      });
      renderSearchResultMarkers(displayResults, query);
    } else if (restStopMatches.length === 0 && poiMatches.length === 0) {
      box.innerHTML = '<div class="sug-item">Không tìm thấy kết quả</div>';
    }
  } catch (e) {
    loadingDiv.remove();
    if (restStopMatches.length === 0 && poiMatches.length === 0) {
      box.innerHTML = '<div class="sug-item" style="color:var(--danger)">Lỗi kết nối</div>';
    }
  }
}

async function selectLocation(lat, lng, name) {
  searchResultMarkers.forEach(m => m.remove());
  searchResultMarkers = [];
  if (touchMarker) { try { touchMarker.remove(); } catch(e) {} touchMarker = null; }
  document.getElementById('topSearchInput').value = name;
  document.getElementById('topSearchInput').readOnly = true;
  document.getElementById('searchClearBtn').classList.remove('hidden');
  closeSearch();
  map.flyTo({ center: [lng, lat], zoom: 16 });
  let finalName = name;
  try {
    const raw = await apiReverseGeocode(lat, lng);
    if (raw) finalName = raw.split(',').slice(0, 3).join(', ');
  } catch (e) {}
  const safeName = jsSafe(finalName);
  const _inNavSel = !!(document.body && document.body.classList.contains('google-nav')) || !!isNavigating;
  const _goBtnSel = _inNavSel ? '' : `<button onclick="event.stopPropagation(); goToLongPressLocation(${lat}, ${lng}, '${safeName}')" style="width: 100%; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; margin-bottom: 6px;"><i class="fas fa-location-arrow"></i> Tới chỗ này</button>`;
  const popupHtml = `
    <div style="min-width: 180px;">
      <div style="font-weight: 800; font-size: 0.9rem; margin-bottom: 8px; line-height: 1.3; color: var(--text);">${escapeHtml(finalName)}</div>
      <button onclick="event.stopPropagation(); openSavePlaceModal(${lat}, ${lng}, '${safeName}')" style="width: 100%; padding: 10px; background: var(--success); color: white; border: none; border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; margin-bottom: 6px;"><i class="fas fa-bookmark"></i> Ghim địa điểm</button>
      <button onclick="event.stopPropagation(); openPoiSheet(${lat}, ${lng}, '${safeName}')" style="width: 100%; padding: 10px; background: linear-gradient(135deg,#10b981,#059669); color: white; border: none; border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; margin-bottom: 6px;"><i class="fas fa-plus-circle"></i> Thêm địa điểm mới</button>
      ${_goBtnSel}
      <button onclick="event.stopPropagation(); shareLocation(${lat}, ${lng}, '${safeName}')" style="width: 100%; padding: 10px; background: var(--card-2); color: var(--text); border: 1px solid var(--border); border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer;"><i class="fas fa-share-alt"></i> Chia sẻ</button>
    </div>`;
  const popup = new maplibregl.Popup({ offset: 10, maxWidth: '300px', closeButton: false }).setLngLat([lng, lat]).setHTML(popupHtml);
  const el = createTouchMarkerElement();
  touchMarker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).setPopup(popup).addTo(map);
  touchMarker.togglePopup();
  if (searchContext === 'start') {
    startPoint = { lat, lng, name: finalName };
    document.getElementById('dirInputStart').value = finalName;
    document.getElementById('btnClearStart').classList.remove('hidden');
  } else if (searchContext === 'end') {
    endPoint = { lat, lng, name: finalName };
    document.getElementById('dirInputEnd').value = finalName;
    document.getElementById('topSearchInput').value = finalName;
    document.getElementById('btnClearEnd').classList.remove('hidden');
  }
}

window.refreshGPS = function() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(pos => {
    startPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, name: 'Vị trí của tôi' };
    document.getElementById('dirInputStart').value = 'Vị trí của tôi (GPS)';
    document.getElementById('btnClearStart').classList.remove('hidden');
    lastUserPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
    if (map) {
      map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 16 });
      updateUserMarkerOnMap(lastUserPos, lastHeading);
    }
  }, (err) => { console.warn(err); });
};

window.centerToLocation = function() {
  if (lastUserPos) map.flyTo({ center: [lastUserPos.lng, lastUserPos.lat], zoom: 18 });
  else refreshGPS();
};

/* ========== GEO HELPERS ========== */
function getClosestPointOnSegment(p, a, b) {
  const atob = { x: b.lng - a.lng, y: b.lat - a.lat };
  const atop = { x: p.lng - a.lng, y: p.lat - a.lat };
  const len = atob.x * atob.x + atob.y * atob.y;
  if (len === 0) return { lat: a.lat, lng: a.lng };
  const dot = atop.x * atob.x + atop.y * atob.y;
  const t = Math.min(1, Math.max(0, dot / len));
  return { lat: a.lat + atob.y * t, lng: a.lng + atob.x * t };
}

function calcDist(lat1, lng1, lat2, lng2) {
  const R = 6371e3;
  const p1 = lat1 * Math.PI/180, p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180, dl = (lng2-lng1) * Math.PI/180;
  const a = Math.sin(dp/2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function updateUserMarkerOnMap(pos, heading) {
  const lngLat = [pos.lng, pos.lat];
  if (!userMarker) {
    const el = document.createElement('div');
    el.style.cssText = 'width:32px;height:32px;display:flex;align-items:center;justify-content:center;';
    el.innerHTML = `<svg class="user-marker-inner" style="transform: rotate(${heading || 0}deg); width: 24px; height: 24px;" viewBox="0 0 24 24"><path d="M12 2L22 20L12 16L2 20L12 2Z" fill="#10b981" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>`;
    userMarker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat).addTo(map);
  } else {
    userMarker.setLngLat(lngLat);
    const inner = userMarker.getElement().querySelector('.user-marker-inner');
    if (inner) inner.style.transform = `rotate(${heading || 0}deg)`;
  }
  gpsCircleGeoJSON = createCircleGeoJSON(pos.lng, pos.lat, pos.accuracy || 10);
  if (map.getSource('gps-circle-source')) map.getSource('gps-circle-source').setData(gpsCircleGeoJSON);
}

function animateMarkerTo(targetPos) {
  if (!userMarker) { updateUserMarkerOnMap(targetPos, targetPos.heading); return; }
  let snappedLat = targetPos.lat, snappedLng = targetPos.lng, targetHeading = targetPos.heading;
  if (currentRouteCoords && currentRouteCoords.length > 1 && lastSnapIndex < currentRouteCoords.length - 1) {
    let minDist = Infinity, bestPoint = null, bestSegmentIndex = lastSnapIndex;
    const startScan = Math.max(0, lastSnapIndex - 5);
    const endScan = Math.min(currentRouteCoords.length - 1, lastSnapIndex + 50);
    for (let i = startScan; i < endScan; i++) {
      const pt = getClosestPointOnSegment(
        { lat: targetPos.lat, lng: targetPos.lng },
        { lat: currentRouteCoords[i][0], lng: currentRouteCoords[i][1] },
        { lat: currentRouteCoords[i+1][0], lng: currentRouteCoords[i+1][1] }
      );
      const d = calcDist(targetPos.lat, targetPos.lng, pt.lat, pt.lng);
      if (d < minDist) { minDist = d; bestPoint = pt; bestSegmentIndex = i; if (i > lastSnapIndex) lastSnapIndex = i; }
    }
    if (bestPoint && minDist < 40) {
      const p1 = currentRouteCoords[bestSegmentIndex];
      const p2 = currentRouteCoords[bestSegmentIndex + 1];
      const angle = Math.atan2(p2[0] - p1[0], p2[1] - p1[1]);
      snappedLat = bestPoint.lat + Math.cos(angle) * 0.00003;
      snappedLng = bestPoint.lng - Math.sin(angle) * 0.00003;
      targetHeading = (angle * 180 / Math.PI) + 90;
    }
  }
  // KHONG cat currentRouteCoords nua - cat la mat tuyen goc, doi tuyen / reroute se sai + checkOffRoute sai
  // Giu nguyen tuyen day du, chi cap nhat lastSnapIndex de biet da di toi dau
  // (Neu muon an phan da di, ve layer rieng chu khong duoc slice source of truth)
  // Huy animation cu neu GPS ve lien tuc - tranh 2-3 animation chong nhau lam cham nhay loan
  try{ if(typeof _markerAnimId !== 'undefined' && _markerAnimId) cancelAnimationFrame(_markerAnimId); }catch(e){}
  const startLat = userMarker.getLngLat().lat;
  const startLng = userMarker.getLngLat().lng;
  // Neu nhay nho (<10m) thi dat thang, khong animate de khoi lag
  if(calcDist(startLat, startLng, snappedLat, snappedLng) < 10){
    userMarker.setLngLat([snappedLng, snappedLat]);
    const inner0 = userMarker.getElement().querySelector('.user-marker-inner');
    if(inner0) inner0.style.transform = `rotate(${targetHeading || 0}deg)`;
  } else {
    const startTime = performance.now(), duration = 350;
    const _step = (time) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const currentLat = startLat + (snappedLat - startLat) * ease;
      const currentLng = startLng + (snappedLng - startLng) * ease;
      userMarker.setLngLat([currentLng, currentLat]);
      const inner = userMarker.getElement().querySelector('.user-marker-inner');
      if (inner) inner.style.transform = `rotate(${targetHeading || 0}deg)`;
      if (progress < 1) _markerAnimId = requestAnimationFrame(_step);
    };
    _markerAnimId = requestAnimationFrame(_step);
  }
  gpsCircleGeoJSON = createCircleGeoJSON(snappedLng, snappedLat, targetPos.accuracy || 10);
  if (map.getSource('gps-circle-source')) map.getSource('gps-circle-source').setData(gpsCircleGeoJSON);
}

function startWatching() {
  if (watchId) navigator.geolocation.clearWatch(watchId);
  let lastPosForSpeed = null, lastTimeForSpeed = null;
  watchId = navigator.geolocation.watchPosition(pos => {
    const now = Date.now();
    const acc = pos.coords.accuracy || 999;
    // LOC GPS RAC: accuracy qua kem (>80m) ma da co fix tot truoc do thi bo
    if(acc > 80 && _gpsLastAcceptedPos && calcDist(_gpsLastAcceptedPos.lat, _gpsLastAcceptedPos.lng, pos.coords.latitude, pos.coords.longitude) < 200){
      return;
    }
    // LOC NHAY GPS: nhay >250m trong <3s = toc do >300km/h -> bo, khong de no keo map + reroute loan
    if(_gpsLastAcceptedPos && _gpsLastAcceptedAt){
      const jump = calcDist(_gpsLastAcceptedPos.lat, _gpsLastAcceptedPos.lng, pos.coords.latitude, pos.coords.longitude);
      const dt = (now - _gpsLastAcceptedAt) / 1000;
      if(dt > 0 && dt < 3 && jump > 250 && (jump / dt) > 80){
        return;
      }
    }
    // THROTTLE: GPS ve lien tuc qua thi chi nhan 1 cai / 800ms cho camera, tranh giat
    const isFastUpdate = (now - _gpsLastAcceptedAt) < 800;
    let speed = pos.coords.speed;
    if ((speed === null || isNaN(speed)) && lastPosForSpeed && lastTimeForSpeed) {
      const dist = calcDist(lastPosForSpeed.lat, lastPosForSpeed.lng, pos.coords.latitude, pos.coords.longitude);
      const time = (now - lastTimeForSpeed) / 1000;
      if (time > 0) speed = dist / time;
    }
    lastPosForSpeed = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    lastTimeForSpeed = now;
    const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, speed: speed || 0, accuracy: pos.coords.accuracy || 10, heading: pos.coords.heading };
    // Lam muot nhe neu di chuyen nho (<30m) de cham khong nhay: 0.65 moi + 0.35 cu
    if(_gpsLastAcceptedPos){
      const dSmall = calcDist(_gpsLastAcceptedPos.lat, _gpsLastAcceptedPos.lng, newPos.lat, newPos.lng);
      if(dSmall < 30 && dSmall > 0.5){
        newPos.lat = _gpsLastAcceptedPos.lat * 0.35 + newPos.lat * 0.65;
        newPos.lng = _gpsLastAcceptedPos.lng * 0.35 + newPos.lng * 0.65;
      }
    }
    _gpsLastAcceptedAt = now;
    _gpsLastAcceptedPos = { lat: newPos.lat, lng: newPos.lng };
    smoothedSpeed = (0.2 * newPos.speed) + (0.8 * smoothedSpeed);
    const hs = document.getElementById('hudSpeed');
    if (hs) hs.textContent = Math.round(smoothedSpeed * 3.6) + ' km/h';
    if (lastUserPos && !newPos.heading) {
      const dy = newPos.lat - lastUserPos.lat, dx = newPos.lng - lastUserPos.lng;
      if (Math.abs(dy) + Math.abs(dx) > 0.00001) newPos.heading = 90 - (Math.atan2(dy, dx) * 180 / Math.PI);
    }
    lastUserPos = newPos;
    animateMarkerTo(lastUserPos);
    // CAMERA: chi 1 noi duy nhat - updateNavCamera, va chi khi dang follow + khong dang keo map + khong update qua nhanh
    // Bo dong easeTo vo dieu kien cu (no la nguyen nhan map khong keo duoc: cu 1s la giat ve giua)
    if(!_isUserDraggingMap && !isFastUpdate){
      try{
        const isNavNow = (typeof isNavigating !== 'undefined' && isNavigating) || (document.body && document.body.classList.contains('google-nav'));
        if(isNavNow && typeof navFollowMode !== 'undefined' && navFollowMode === 'first-person' && typeof updateNavCamera === 'function'){
          updateNavCamera(lastUserPos, lastUserPos.heading || 0);
        }
      }catch(e){}
    }
    checkReportProximity(lastUserPos.lat, lastUserPos.lng);
    checkOffRoute(lastUserPos.lat, lastUserPos.lng);
    checkArrival(lastUserPos.lat, lastUserPos.lng);
    updateNextManeuverHUD(lastUserPos.lat, lastUserPos.lng);
    checkPoiProximity(lastUserPos.lat, lastUserPos.lng);
    checkAvoidZoneProximity(lastUserPos.lat, lastUserPos.lng);
    updateRemainingHUD();
  }, null, { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 });
}

/* ========== PROXIMITY CHECKS + VOICE ========== */
function checkReportProximity(lat, lng) {
  if (voiceSettings.warning === 'never') return;
  const now = Date.now();
  for (const key in allReports) {
    const rep = allReports[key];
    if (now > rep.expiresAt || warnedReports.has(key)) continue;
    if (calcDist(lat, lng, rep.lat, rep.lng) < 300) {
      warnedReports.add(key);
      let msg = 'sự cố';
      if (rep.type === 'police') msg = 'CSGT';
      else if (rep.type === 'toll') msg = 'Trạm thu phí';
      else if (rep.type === 'accident') msg = 'tai nạn';
      else if (rep.type === 'traffic') msg = 'kẹt xe';
      else if (rep.type === 'flood') msg = 'ngập nước';
      else if (rep.type === 'pothole') msg = 'ổ gà';
      speak(`Chú ý, phía trước có ${msg}`, 'warning');
    }
  }
}
function checkPoiProximity(lat, lng) {
  if (voiceSettings.poi === 'never' || !allRestStops) return;
  const allPois = [...allRestStops, ...allCommunityPois.filter(p => p.tag === 'gas_station')];
  allPois.forEach(poi => {
    if (warnedPois.has(poi.id)) return;
    if (calcDist(lat, lng, poi.lat, poi.lng) < 300) {
      warnedPois.add(poi.id);
      const type = poi.tag === 'gas_station' ? 'Trạm xăng' : 'Trạm dừng nghỉ';
      speak(`Sắp tới ${type}: ${poi.name}`, 'poi');
    }
  });
}
function checkAvoidZoneProximity(lat, lng) {
  if (!allAvoidZones || allAvoidZones.length === 0) return;
  for (const zone of allAvoidZones) {
    if (!zone.lat1 || !zone.lng1) continue;
    if (!isZoneCurrentlyActive(zone)) continue;
    if (!isVehicleBannedByZone(zone)) continue;
    let segments = [];
    if (zone.waypoints) {
      try {
        const wps = typeof zone.waypoints === 'string' ? JSON.parse(zone.waypoints) : zone.waypoints;
        if (Array.isArray(wps) && wps.length > 0) {
          const isMulti = Array.isArray(wps[0][0]);
          if (isMulti) {
            wps.forEach(seg => { for (let i = 0; i < seg.length - 1; i++) segments.push({ a: { lat: seg[i][0], lng: seg[i][1] }, b: { lat: seg[i+1][0], lng: seg[i+1][1] } }); });
          } else {
            for (let i = 0; i < wps.length - 1; i++) segments.push({ a: { lat: wps[i][0], lng: wps[i][1] }, b: { lat: wps[i+1][0], lng: wps[i+1][1] } });
          }
        }
      } catch(e) {}
    }
    if (segments.length === 0) segments.push({ a: { lat: zone.lat1, lng: zone.lng1 }, b: { lat: zone.lat2, lng: zone.lng2 } });
    for (const seg of segments) {
      const closestPt = getClosestPointOnSegment({ lat, lng }, seg.a, seg.b);
      const dist = calcDist(lat, lng, closestPt.lat, closestPt.lng);
      if (dist < 50) {
        if (!warnedAvoidZones.has(zone.id)) {
          warnedAvoidZones.add(zone.id);
          speak(`Chú ý, phía trước là khu vực cấm: ${zone.name}`, 'avoid');
          showCustomToast(`🚫 Đi vào vùng cấm: ${zone.name}`, 'danger');
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        }
        break;
      }
    }
  }
}
function speak(text, category = 'nav') {
  const mode = voiceSettings[category];
  if (mode === 'never') return;
  if (mode === 'vibrate') { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); return; }
  if (!window.speechSynthesis) return;
  // Không cancel nếu đang nói warning/avoid (tránh cắt lời cảnh báo)
  if (category !== 'warning' && category !== 'avoid') {
    speechSynthesis.cancel();
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'vi-VN';
  let vol = voiceSettings.volume / 100;
  u.volume = Math.min(Math.max(vol, 0), 1);
  speechSynthesis.speak(u);
}
function startVoice() {
  speak('Bắt đầu dẫn đường.', 'nav');
  const hv = document.getElementById('hudBtnVoice');
  if (hv) hv.classList.add('active');
  if (voiceCheckTimer) clearInterval(voiceCheckTimer);
  voiceCheckTimer = setInterval(() => {
    if (!lastUserPos || !voiceRouteSteps) return;
    for (let i = voiceStepIndex; i < Math.min(voiceRouteSteps.length, voiceStepIndex + 3); i++) {
      const step = voiceRouteSteps[i];
      if (!step?.maneuver?.location) continue;
      const d = calcDist(lastUserPos.lat, lastUserPos.lng, step.maneuver.location[1], step.maneuver.location[0]);
      if (d < 50) {
        speak(translateFallback(step.maneuver.instruction), 'nav');
        voiceStepIndex = i + 1;
        break;
      }
    }
  }, 3000);
}

/* ========== LAYER ========== */
window.toggleLayerMenu = function() {
  const menu = document.getElementById('layerMenu');
  const isShowing = menu.classList.contains('show');
  if (isShowing) menu.classList.remove('show');
  else {
    menu.classList.add('show');
    setTimeout(() => {
      const closeHandler = (e) => {
        if (!menu.contains(e.target) && e.target.id !== 'btnLayerMenu' && !e.target.closest('#btnLayerMenu') && e.target.id !== 'gNavLayerBtn' && !e.target.closest('#gNavLayerBtn')) {
          menu.classList.remove('show');
          document.removeEventListener('click', closeHandler);
          document.removeEventListener('touchstart', closeHandler);
        }
      };
      document.addEventListener('click', closeHandler);
      document.addEventListener('touchstart', closeHandler);
    }, 100);
  }
};
function changeLayer(type, btn) {
  document.querySelectorAll('.layer-option').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('layerMenu').classList.remove('show');
  let styleUrl = MAPTILER_STYLE;
  if (type === 'trackasia-maplibre' || type === 'trackasia') styleUrl = TRACKASIA_STYLE;
  else if (type === 'satellite') styleUrl = `${WORKER_URL}/api/style?provider=satellite`;
  map.setStyle(styleUrl);
  map.once('styledata', () => {
    setTimeout(() => {
      initGpsCircleLayer();
      if (currentRouteCoords.length > 0) drawCurrentRoute();
      initMapillarySignsLayer();
      renderAvoidZonesOnMap();
      renderCommunityPoisOnMap();
      renderRestStopMarkers();
      renderSavedPlacesOnMap();
      renderReportsOnMap();
    }, 100);
  });
}
window.goToLongPressLocation = function(lat, lng, name) {
  endPoint = { lat, lng, name };
  document.getElementById('dirInputEnd').value = name;
  document.getElementById('topSearchInput').value = name;
  document.getElementById('btnClearEnd').classList.remove('hidden');
  document.getElementById('searchClearBtn').classList.remove('hidden');
  if (touchMarker) { try { touchMarker.remove(); } catch (e) {} touchMarker = null; } /* [V5] null để cú bấm sau không bị nuốt */
  openDirections();
  if (!startPoint) refreshGPS();
};

/* ========== POI ========== */
window.openPoiSheet = function(lat, lng, addressHint) {
  if (!currentUser) { alert('Vui lòng đăng nhập để thêm địa điểm!'); return; }
  tempPoiLatLng = { lat, lng };
  tempPoiTag = null;
  document.getElementById('poiCoords').textContent = `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}${addressHint ? ' • ' + addressHint : ''}`;
  document.getElementById('poiNameInput').value = '';
  document.getElementById('poiSaveBtn').disabled = true;
  document.querySelectorAll('.poi-tag-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('poiSheet').classList.add('open');
  if (touchMarker) { try { touchMarker.remove(); } catch (e) {} touchMarker = null; } /* [V5] null để cú bấm sau không bị nuốt */
  setTimeout(() => document.getElementById('poiNameInput').focus(), 350);
};
window.closePoiSheet = function() { document.getElementById('poiSheet').classList.remove('open'); tempPoiLatLng = null; tempPoiTag = null; };
window.selectPoiTag = function(tag, btn) {
  tempPoiTag = tag;
  document.querySelectorAll('.poi-tag-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  updatePoiSaveBtnState();
};
function updatePoiSaveBtnState() {
  const name = document.getElementById('poiNameInput').value.trim();
  document.getElementById('poiSaveBtn').disabled = !(tempPoiTag && name.length >= 2);
}
const poiNameInputEl = document.getElementById('poiNameInput');
if (poiNameInputEl) poiNameInputEl.addEventListener('input', updatePoiSaveBtnState);

window.submitCommunityPoi = async function() {
  if (!currentUser) return alert('Chưa đăng nhập!');
  if (!tempPoiLatLng || !tempPoiTag) return alert('Vui lòng chọn loại địa điểm!');
  const name = document.getElementById('poiNameInput').value.trim();
  if (name.length < 2) return alert('Tên địa điểm quá ngắn!');
  const btn = document.getElementById('poiSaveBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';
  try {
    const collectionName = tempPoiTag === 'rest_stop' ? 'rest_stops' : 'community_pois';
      await addDoc(collection(fsdb, collectionName), {
        lat: tempPoiLatLng.lat, lng: tempPoiLatLng.lng, name, tag: tempPoiTag,
        uid: currentUser.uid,
        authorName: currentUser.displayName || currentUser.email.split('@')[0],
        timestamp: Date.now(), upvotes: 0, categoryIds: getPoiCategoryIds(tempPoiTag) // v3: mã chuẩn (null nếu chưa xác minh) — không chặn lưu
      });
    closePoiSheet();
    showCustomToast('Đã thêm địa điểm!', 'success');
  } catch (e) {
    alert('Lỗi lưu: ' + e.message);
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> Lưu địa điểm';
  }
};

window.openPoiDetail = function(source, id) {
  const poi = [...allCommunityPois, ...allRestStops].find(p => p._id === id && p.source === source);
  if (!poi) return;
  currentDetailPoi = { ...poi };
  const conf = POI_TAG_CONFIG[poi.tag] || POI_TAG_CONFIG.supermarket;
  const content = document.getElementById('poiDetailContent');
  content.innerHTML = `
    <div class="poi-detail-header">
      <div class="poi-detail-icon" style="background: linear-gradient(135deg, ${conf.color}, ${conf.color}dd);"><i class="fas ${conf.icon}"></i></div>
      <div class="poi-detail-header-text">
        <div class="poi-detail-name">${escapeHtml(poi.name)}</div>
        <span class="poi-detail-tag-badge" style="background: ${conf.color};"><i class="fas ${conf.icon}"></i> ${conf.label}</span>
      </div>
    </div>
    <div class="poi-detail-coords">
      <i class="fas fa-map-pin"></i>
      <div class="poi-detail-coords-text">${poi.lat.toFixed(6)}, ${poi.lng.toFixed(6)}</div>
      <button onclick="copyPoiCoords()" style="background:transparent; color:var(--primary); font-size:1.1rem; padding:4px;"><i class="fas fa-copy"></i></button>
    </div>
    <div class="poi-detail-meta">
      <span><i class="fas fa-check-circle" style="color:#3b82f6;"></i> Địa điểm cộng đồng</span>
      ${poi.authorName ? `<span><i class="fas fa-user"></i> ${escapeHtml(poi.authorName)}</span>` : ''}
      ${poi.timestamp ? `<span><i class="fas fa-clock"></i> ${new Date(poi.timestamp).toLocaleDateString('vi-VN')}</span>` : ''}
    </div>
    <div class="poi-detail-actions">
      <button class="poi-detail-btn primary" onclick="goToPoiFromDetail()"><i class="fas fa-location-arrow"></i> Tới chỗ này</button>
      <button class="poi-detail-btn share" onclick="sharePoiFromDetail()"><i class="fas fa-share-alt"></i> Chia sẻ</button>
    </div>`;
  document.getElementById('poiDetailSheet')?.classList.add('open');
  if (touchMarker) { try { touchMarker.remove(); } catch (e) {} touchMarker = null; } /* [V5] null để cú bấm sau không bị nuốt */
};
window.closePoiDetail = function() { document.getElementById('poiDetailSheet')?.classList.remove('open'); currentDetailPoi = null; };
window.goToPoiFromDetail = function() {
  if (!currentDetailPoi) return;
  const { lat, lng, name } = currentDetailPoi;
  closePoiDetail();
  goToLongPressLocation(lat, lng, name);
};
window.sharePoiFromDetail = function() {
  if (!currentDetailPoi) return;
  shareLocation(currentDetailPoi.lat, currentDetailPoi.lng, currentDetailPoi.name);
};
window.copyPoiCoords = function() {
  if (!currentDetailPoi) return;
  const text = `${currentDetailPoi.lat.toFixed(6)}, ${currentDetailPoi.lng.toFixed(6)}`;
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => showCustomToast('Đã copy toạ độ!', 'success'));
  else prompt('Copy toạ độ:', text);
};

function setupSwipeDown(sheetId, handleId, closeFn) {
  const sheet = document.getElementById(sheetId);
  const handle = document.getElementById(handleId);
  if (!sheet || !handle || sheet._swipeBound) return;
  sheet._swipeBound = true;
  let startY = 0, currentY = 0, isDragging = false;
  handle.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; currentY = startY; isDragging = true; sheet.style.transition = 'none'; }, { passive: true });
  handle.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;
    if (deltaY > 0) sheet.style.transform = `translateY(${deltaY}px)`;
  }, { passive: true });
  handle.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    sheet.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    const deltaY = currentY - startY;
    if (deltaY > 100) { sheet.style.transform = ''; closeFn(); } else sheet.style.transform = '';
  });
}
setTimeout(() => {
  setupSwipeDown('poiDetailSheet', 'poiDetailSwipeHandle', () => closePoiDetail());
  setupSwipeDown('poiSheet', 'poiSheetSwipeHandle', () => closePoiSheet());
  setupSwipeDown('nearbyResultsSheet', 'nearbyResultsSwipeHandle', () => closeNearbyResultsSheet());
}, 500);

let zoomHintShown = false;
function showZoomHint() {
  if (zoomHintShown) return;
  zoomHintShown = true;
  const t = document.createElement('div');
  t.className = 'zoom-hint-toast';
  t.innerHTML = '<i class="fas fa-search-plus" style="color:var(--primary);"></i><span>Zoom gần hơn để xem địa điểm</span>';
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => { t.remove(); zoomHintShown = false; }, 300); }, 2500);
}
window.toggleRestStopFilter = function() {
  restStopFilterActive = !restStopFilterActive;
  const btn = document.getElementById('btnRestStopFilter');
  if (btn) btn.classList.toggle('active', restStopFilterActive);
  renderRestStopMarkers();
  renderCommunityPoisOnMap();
  showCustomToast(restStopFilterActive ? `Đang hiện ${restStopMarkers.length} trạm dừng nghỉ` : 'Đã hiện tất cả địa điểm', 'info');
};

/* ========== LIVE ========== */
function liveLerp(a, b, t) { return a + (b - a) * t; }
function liveEase(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }
function liveHaversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function generateLiveRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random()*chars.length)];
  return c;
}
function startLiveAnim(animState) {
  if (animState.animId) cancelAnimationFrame(animState.animId);
  animState.startTime = performance.now();
  const step = (now) => {
    const elapsed = now - animState.startTime;
    let t = Math.min(elapsed / animState.duration, 1);
    const e = liveEase(t);
    const lat = liveLerp(animState.from.lat, animState.to.lat, e);
    const lng = liveLerp(animState.from.lng, animState.to.lng, e);
    if (animState.marker) animState.marker.setLngLat([lng, lat]);
    if (t < 1) animState.animId = requestAnimationFrame(step);
    else { animState.animId = null; if (animState.marker) animState.marker.setLngLat([animState.to.lng, animState.to.lat]); }
  };
  animState.animId = requestAnimationFrame(step);
}
function animateLiveTo(animState, newLat, newLng, duration = LIVE_ANIM_DURATION) {
  if (!animState || !animState.marker) return;
  const cur = animState.marker.getLngLat();
  animState.from = { lat: cur.lat, lng: cur.lng };
  animState.to = { lat: newLat, lng: newLng };
  animState.duration = duration;
  startLiveAnim(animState);
}

window.toggleLiveRoom = async function() {
  if (!currentUser) { document.getElementById('liveToggleSwitch').checked = false; return alert('Vui lòng đăng nhập!'); }
  const on = document.getElementById('liveToggleSwitch').checked;
  if (on) await startLiveSession();
  else await stopLiveSession();
};

async function startLiveSession() {
  liveEnabled = true;
  updateLiveUI();
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      lastUserPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      await createLiveRoom(true);
      startLiveGpsLoop();
    },
    (err) => { alert('Không lấy được GPS. Hãy bật định vị!'); document.getElementById('liveToggleSwitch').checked = false; liveEnabled = false; updateLiveUI(); },
    { enableHighAccuracy: true, timeout: 15000 }
  );
}

function startLiveGpsLoop() {
  if (liveGpsInterval) clearInterval(liveGpsInterval);
  liveGpsInterval = setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, heading: pos.coords.heading };
        if (lastUserPos && liveHaversine(lastUserPos.lat, lastUserPos.lng, newPos.lat, newPos.lng) * 1000 < 1) return;
        lastUserPos = newPos;
        pushLivePositionToRTDB();
      },
      (err) => console.warn('GPS loop err:', err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, LIVE_GPS_INTERVAL);
}

async function pushLivePositionToRTDB() {
  if (!currentUser || !liveRoomCode || !lastUserPos) return;
  const myData = {
    uid: currentUser.uid,
    name: currentUser.displayName || currentUser.email.split('@')[0],
    lat: lastUserPos.lat,
    lng: lastUserPos.lng,
    accuracy: lastUserPos.accuracy || 10,
    heading: lastUserPos.heading || 0,
    timestamp: Date.now()
  };
  try {
    await set(ref(db, `live_rooms/${liveRoomCode}/members/${currentUser.uid}`), myData);
    if (liveIsPublic) {
      await set(ref(db, `public_users/${currentUser.uid}`), { ...myData, public: true });
    }
  } catch (e) { console.warn('pushLive:', e); }
}

async function createLiveRoom(auto = false) {
  if (!currentUser) { if (!auto) alert('Chưa đăng nhập!'); return; }
  if (liveRoomCode) await stopLiveSession();
  const code = generateLiveRoomCode();
  try {
    await set(ref(db, `live_rooms/${code}`), {
      code,
      host: currentUser.uid,
      hostName: currentUser.displayName || currentUser.email.split('@')[0],
      createdAt: Date.now(),
      public: false
    });
    liveRoomCode = code;
    liveEnabled = true;
    liveIsPublic = false;

    const myRef = ref(db, `live_rooms/${code}/members/${currentUser.uid}`);
    await set(myRef, {
      uid: currentUser.uid,
      name: currentUser.displayName || currentUser.email.split('@')[0],
      lat: lastUserPos?.lat || null,
      lng: lastUserPos?.lng || null,
      timestamp: Date.now()
    });
    onDisconnect(myRef).remove();

    subscribeToLiveRoom(code);
    updateLiveUI();
    showCustomToast(`Đã tạo phòng: ${code}`, 'success');
  } catch (e) { console.error('createLiveRoom:', e); alert('Lỗi tạo phòng: ' + e.message); }
}
window.createLiveRoom = createLiveRoom;

window.joinLiveRoom = async function() {
  if (!currentUser) return alert('Vui lòng đăng nhập!');
  const input = document.getElementById('liveJoinCodeInput');
  const code = (input.value || '').toUpperCase().trim();
  if (!code || code.length !== 6) return alert('Mã phòng phải có 6 ký tự!');
  const snap = await get(ref(db, `live_rooms/${code}`));
  if (!snap.exists()) return alert('Phòng không tồn tại!');
  if (liveRoomCode) await stopLiveSession();

  liveRoomCode = code;
  liveEnabled = true;
  isViewingLiveTrack = false;

  const myRef = ref(db, `live_rooms/${code}/members/${currentUser.uid}`);
  await set(myRef, {
    uid: currentUser.uid,
    name: currentUser.displayName || currentUser.email.split('@')[0],
    lat: lastUserPos?.lat || null,
    lng: lastUserPos?.lng || null,
    timestamp: Date.now()
  });
  onDisconnect(myRef).remove();

  startLiveGpsLoop();
  subscribeToLiveRoom(code);
  updateLiveUI();
  showCustomToast(`Đã vào phòng: ${code}`, 'success');
};

window.leaveLiveRoom = async function() {
  await stopLiveSession();
  showCustomToast('Đã rời phòng', 'info');
};

window.toggleLivePublic = async function() {
  if (!currentUser || !liveRoomCode) return;
  const on = document.getElementById('livePublicSwitch').checked;
  liveIsPublic = on;
  await set(ref(db, `live_rooms/${liveRoomCode}/public`), on);
  if (on) await pushLivePositionToRTDB();
  else await remove(ref(db, `public_users/${currentUser.uid}`)).catch(() => {});
  showCustomToast(on ? 'Đã bật Public mode' : 'Đã tắt Public mode', 'info');
};

window.copyLiveRoomCode = function() {
  if (!liveRoomCode) return;
  if (navigator.clipboard) navigator.clipboard.writeText(liveRoomCode).then(() => showCustomToast('Đã copy mã phòng!', 'success'));
  else prompt('Mã phòng:', liveRoomCode);
};

window.initViewerLiveRoom = async function(code) {
  code = String(code).toUpperCase().trim();
  if (!currentUser) return;
  const snap = await get(ref(db, `live_rooms/${code}`));
  if (!snap.exists()) { showCustomToast('Phòng không tồn tại hoặc đã đóng', 'danger'); return; }
  isViewingLiveTrack = true;
  subscribeToLiveRoom(code);
  showCustomToast(`Đang xem phòng: ${code}`, 'info');
};

function subscribeToLiveRoom(code) {
  if (liveRoomUnsub) { liveRoomUnsub(); liveRoomUnsub = null; }
  liveRoomUnsub = onValue(ref(db, `live_rooms/${code}/members`), (snap) => {
    const data = snap.val() || {};
    liveRoomMembers = [];
    Object.entries(data).forEach(([uid, m]) => { liveRoomMembers.push({ uid, ...m }); });
    renderLiveMembers();
    renderLiveMemberList();
  }, (err) => console.warn('liveRoomUnsub:', err));
}

function renderLiveMembers() {
  const now = Date.now();
  const activeUids = new Set();
  liveRoomMembers.forEach(m => {
    if (!m.lat || !m.lng) return;
    if (now - (m.timestamp || 0) > LIVE_HEARTBEAT_TIMEOUT) return;
    if (m.uid === currentUser?.uid) return;
    activeUids.add(m.uid);
    if (!liveMemberMarkers[m.uid]) {
      const el = document.createElement('div');
      el.className = 'live-other-pin';
      el.innerHTML = `<i class="fas fa-user"></i>`;
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([m.lng, m.lat]).addTo(map);
      liveMemberMarkers[m.uid] = marker;
      liveMemberAnimStates[m.uid] = { marker, from: { lat: m.lat, lng: m.lng }, to: { lat: m.lat, lng: m.lng }, duration: LIVE_ANIM_DURATION };
      el.addEventListener('click', () => {
        new maplibregl.Popup({ offset: 15 }).setLngLat([m.lng, m.lat])
          .setHTML(`<b>${escapeHtml(m.name || 'User')}</b>`).addTo(map);
      });
    } else {
      const anim = liveMemberAnimStates[m.uid];
      if (anim) animateLiveTo(anim, m.lat, m.lng);
    }
  });
  Object.keys(liveMemberMarkers).forEach(uid => {
    if (!activeUids.has(uid)) {
      try { liveMemberMarkers[uid].remove(); } catch(e){}
      delete liveMemberMarkers[uid];
      const a = liveMemberAnimStates[uid];
      if (a?.animId) cancelAnimationFrame(a.animId);
      delete liveMemberAnimStates[uid];
    }
  });
}

function renderLiveMemberList() {
  const listEl = document.getElementById('liveMemberList');
  const countEl = document.getElementById('liveMemberCount');
  if (!listEl) return;
  const now = Date.now();
  const active = liveRoomMembers.filter(m => now - (m.timestamp || 0) < LIVE_HEARTBEAT_TIMEOUT);
  if (countEl) countEl.textContent = active.length;
  if (active.length === 0) {
    listEl.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:0.75rem;"><i class="fas fa-users" style="font-size:1.5rem; opacity:0.3; display:block; margin-bottom:6px;"></i>Chưa có ai</div>`;
    return;
  }
  listEl.innerHTML = active.map(m => {
    const isMe = m.uid === currentUser?.uid;
    const initial = (m.name || 'U').charAt(0).toUpperCase();
    return `<div class="live-member-item ${isMe ? 'me' : ''}">
      <div class="lm-avatar">${initial}</div>
      <div class="lm-info"><div class="lm-name">${escapeHtml(m.name || 'User')}${isMe ? ' (bạn)' : ''}</div><div class="lm-meta">${m.timestamp ? new Date(m.timestamp).toLocaleTimeString('vi-VN') : ''}</div></div>
    </div>`;
  }).join('');
}

async function stopLiveSession() {
  liveEnabled = false;
  if (liveGpsInterval) { clearInterval(liveGpsInterval); liveGpsInterval = null; }
  if (liveHeartbeatInterval) { clearInterval(liveHeartbeatInterval); liveHeartbeatInterval = null; }
  if (liveRoomUnsub) { liveRoomUnsub(); liveRoomUnsub = null; }
  if (livePublicUnsub) { livePublicUnsub(); livePublicUnsub = null; }
  if (currentUser && liveRoomCode) {
    await remove(ref(db, `live_rooms/${liveRoomCode}/members/${currentUser.uid}`)).catch(()=>{});
    await remove(ref(db, `public_users/${currentUser.uid}`)).catch(()=>{});
  }
  Object.values(liveMemberAnimStates).forEach(a => { if (a.animId) cancelAnimationFrame(a.animId); });
  Object.values(liveMemberMarkers).forEach(m => { try { m.remove(); } catch(e){} });
  liveMemberMarkers = {};
  liveMemberAnimStates = {};
  if (liveMyAnimState?.animId) cancelAnimationFrame(liveMyAnimState.animId);
  if (liveMyMarker) { try { liveMyMarker.remove(); } catch(e){} liveMyMarker = null; }
  liveMyAnimState = null;
  liveRoomCode = null;
  liveIsPublic = false;
  liveRoomMembers = [];
  livePublicUsers = [];
  isViewingLiveTrack = false;
  updateLiveUI();
}

function updateLiveUI() {
  const badge = document.getElementById('liveStatusBadge');
  const features = document.getElementById('liveFeatures');
  const overlay = document.getElementById('liveDisabledOverlay');
  const codeBox = document.getElementById('liveRoomCodeBox');
  const actions = document.getElementById('liveRoomActions');
  const publicBox = document.getElementById('livePublicBox');
  const membersBox = document.getElementById('liveMembersBox');
  const leaveBtn = document.getElementById('liveLeaveBtn');
  const codeText = document.getElementById('liveRoomCodeText');
  if (!badge) return;
  if (liveEnabled) {
    badge.textContent = 'LIVE';
    badge.classList.add('on');
    badge.style.display = 'inline-block';
    features.style.opacity = '1';
    features.style.pointerEvents = 'auto';
    overlay.style.display = 'none';
  } else {
    badge.textContent = 'OFF';
    badge.classList.remove('on');
    badge.style.display = 'none';
    features.style.opacity = '0.4';
    features.style.pointerEvents = 'none';
    overlay.style.display = 'flex';
    codeBox.style.display = 'none';
    actions.style.display = 'flex';
    publicBox.style.display = 'none';
    membersBox.style.display = 'none';
    leaveBtn.style.display = 'none';
    return;
  }
  if (liveRoomCode) {
    codeText.textContent = liveRoomCode;
    codeBox.style.display = 'flex';
    actions.style.display = 'none';
    publicBox.style.display = 'block';
    membersBox.style.display = 'block';
    leaveBtn.style.display = 'block';
  } else {
    codeBox.style.display = 'none';
    actions.style.display = 'flex';
    publicBox.style.display = 'none';
    membersBox.style.display = 'none';
    leaveBtn.style.display = 'none';
  }
}

/* ========== MENU LIST RENDERS ========== */
function renderHistoryList() {
  const el = document.getElementById('historyList');
  if (!el) return;
  if (!allHistory || allHistory.length === 0) {
    el.innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:0.85rem;">Chưa có chuyến đi nào</div>';
    return;
  }
  el.innerHTML = allHistory.slice(0, 20).map(h => `
    <div class="history-item">
      <div class="time">${h.timestamp ? new Date(h.timestamp).toLocaleString('vi-VN') : ''}</div>
      <div class="route"><i class="fas fa-route" style="color:var(--primary);"></i> ${escapeHtml(h.startName || '?')} → ${escapeHtml(h.endName || '?')}</div>
      ${h.distance ? `<div style="font-size:0.75rem; color:var(--text-muted);">${(h.distance/1000).toFixed(1)} km</div>` : ''}
    </div>
  `).join('');
}
function renderSavedRoutesList() {
  const el = document.getElementById('savedRoutesList');
  if (!el) return;
  if (!allSavedRoutes || allSavedRoutes.length === 0) {
    el.innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:0.85rem;">Chưa có lộ trình nào</div>';
    return;
  }
  el.innerHTML = allSavedRoutes.slice(0, 20).map((r, i) => `
    <div class="history-item" style="cursor:pointer;" data-route-idx="${i}">
      <div class="time">${r.timestamp ? new Date(r.timestamp).toLocaleString('vi-VN') : ''}</div>
      <div class="route"><i class="fas fa-bookmark" style="color:var(--success);"></i> ${escapeHtml(r.startName || '?')} → ${escapeHtml(r.endName || '?')}</div>
    </div>
  `).join('');
  el.querySelectorAll('[data-route-idx]').forEach(item => {
    item.addEventListener('click', () => {
      const r = allSavedRoutes[parseInt(item.dataset.routeIdx)];
      if (!r) return;
      startPoint = { lat: r.startLat, lng: r.startLng, name: r.startName };
      endPoint = { lat: r.endLat, lng: r.endLng, name: r.endName };
      closeMenu();
      openDirections();
      showCustomToast('Đã nạp lộ trình đã lưu', 'info');
    });
  });
}
function renderSharedLinksList() {
  const el = document.getElementById('sharedLinksList');
  if (!el) return;
  if (!allSharedLinks || allSharedLinks.length === 0) {
    el.innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:0.85rem;">Chưa có link nào</div>';
    return;
  }
  el.innerHTML = allSharedLinks.map((l, i) => `
    <div class="history-item">
      <div class="time">${new Date(l.timestamp).toLocaleString('vi-VN')}</div>
      <div class="route"><i class="fas fa-link" style="color:var(--primary);"></i> ${escapeHtml(l.fromName)} → ${escapeHtml(l.toName)}</div>
      <div style="display:flex; gap:6px; margin-top:6px;">
        <button data-link-open="${i}" style="background:var(--primary); color:white; padding:4px 10px; border-radius:6px; font-size:0.7rem; font-weight:700;">Mở</button>
        <button data-link-copy="${i}" style="background:var(--success); color:white; padding:4px 10px; border-radius:6px; font-size:0.7rem; font-weight:700;">Copy</button>
      </div>
    </div>
  `).join('');
  el.querySelectorAll('[data-link-open]').forEach(b => {
    b.addEventListener('click', () => {
      const l = allSharedLinks[parseInt(b.dataset.linkOpen)];
      if (l) window.open(l.url, '_blank');
    });
  });
  el.querySelectorAll('[data-link-copy]').forEach(b => {
    b.addEventListener('click', () => {
      const l = allSharedLinks[parseInt(b.dataset.linkCopy)];
      if (l) navigator.clipboard.writeText(l.url).then(() => showCustomToast('Đã copy link', 'success'));
    });
  });
}

window.clearAllHistory = async function() {
  if (!currentUser || !confirm('Xoá tất cả lịch sử chuyến đi?')) return;
  try {
    const snap = await getDocs(collection(fsdb, `users/${currentUser.uid}/history`));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    showCustomToast('Đã xoá lịch sử', 'success');
  } catch (e) { alert('Lỗi: ' + e.message); }
};
window.clearAllSavedRoutes = async function() {
  if (!currentUser || !confirm('Xoá tất cả lộ trình đã lưu?')) return;
  try {
    const snap = await getDocs(collection(fsdb, `users/${currentUser.uid}/savedRoutes`));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    showCustomToast('Đã xoá lộ trình', 'success');
  } catch (e) { alert('Lỗi: ' + e.message); }
};
window.clearAllSharedLinks = function() {
  if (!confirm('Xoá tất cả link đã chia sẻ?')) return;
  allSharedLinks = [];
  localStorage.setItem('drivekit_shared_links', '[]');
  renderSharedLinksList();
};

function loadSharedLinksFromStorage() {
  try { allSharedLinks = JSON.parse(localStorage.getItem('drivekit_shared_links') || '[]'); } catch(e) { allSharedLinks = []; }
  renderSharedLinksList();
}
function saveSharedLinkToStorage(fromName, toName, url) {
  allSharedLinks.unshift({ fromName, toName, url, timestamp: Date.now() });
  allSharedLinks = allSharedLinks.slice(0, 30);
  localStorage.setItem('drivekit_shared_links', JSON.stringify(allSharedLinks));
  renderSharedLinksList();
}

/* ========== SHARE ========== */
window.shareRoute = function() {
  if (!startPoint || !endPoint) return alert('Vui lòng chọn đủ Điểm đi và Điểm đến!');
  const baseUrl = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({ fromLat: startPoint.lat, fromLng: startPoint.lng, fromName: startPoint.name, toLat: endPoint.lat, toLng: endPoint.lng, toName: endPoint.name });
  const shareUrl = `${baseUrl}?${params.toString()}`;
  if (navigator.share) {
    navigator.share({ title: 'DriveKit - Lộ trình', text: `Lộ trình từ ${startPoint.name} đến ${endPoint.name}`, url: shareUrl })
      .then(() => { saveSharedLinkToStorage(startPoint.name, endPoint.name, shareUrl); showCustomToast('Đã chia sẻ!', 'success'); })
      .catch(() => {});
  } else {
    navigator.clipboard.writeText(shareUrl).then(() => { saveSharedLinkToStorage(startPoint.name, endPoint.name, shareUrl); showCustomToast('Đã copy link!', 'success'); })
      .catch(() => prompt('Copy link này:', shareUrl));
  }
};
window.shareLocation = function(lat, lng, name) {
  const baseUrl = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({ fromLat: lat, fromLng: lng, fromName: name, toLat: lat, toLng: lng, toName: name });
  const shareUrl = `${baseUrl}?${params.toString()}`;
  if (navigator.share) {
    navigator.share({ title: 'DriveKit - Vị trí', text: `Vị trí: ${name}`, url: shareUrl })
      .then(() => { saveSharedLinkToStorage(name, name, shareUrl); showCustomToast('Đã chia sẻ!', 'success'); })
      .catch(() => {});
  } else {
    navigator.clipboard.writeText(shareUrl).then(() => { saveSharedLinkToStorage(name, name, shareUrl); showCustomToast('Đã copy link!', 'success'); })
      .catch(() => prompt('Copy link này:', shareUrl));
  }
};

/* ========== NAVIGATION HUD UPDATES ========== */
function updateNextManeuverHUD(lat, lng) {
  if (!voiceRouteSteps || voiceRouteSteps.length === 0) return;
  let nextStep = null; let minDist = Infinity;
  for (let i = Math.max(0, voiceStepIndex); i < Math.min(voiceRouteSteps.length, voiceStepIndex + 5); i++) {
    const step = voiceRouteSteps[i];
    if (!step?.maneuver?.location) continue;
    const d = calcDist(lat, lng, step.maneuver.location[1], step.maneuver.location[0]);
    if (d > 5 && d < minDist) { minDist = d; nextStep = step; }
  }
  if (nextStep) {
    let icon = 'fa-arrow-up';
    const type = nextStep.maneuver.type || '';
    const modifier = nextStep.maneuver.modifier || '';
    // uturn phải check TRƯỚC left/right vì "uturn right" chứa "right"
    if (modifier.includes('uturn')) {
      icon = modifier.includes('left') ? 'fa-undo' : 'fa-redo';
    } else if (type.includes('turn') || type.includes('fork') || type.includes('merge')) {
      if (modifier.includes('slight left')) icon = 'fa-share';
      else if (modifier.includes('slight right')) icon = 'fa-reply';
      else if (modifier.includes('left')) icon = 'fa-arrow-left';
      else if (modifier.includes('right')) icon = 'fa-arrow-right';
    } else if (type.includes('roundabout')) icon = 'fa-sync-alt';
    else if (type.includes('arrive')) icon = 'fa-flag-checkered';
    else if (type.includes('uturn')) icon = 'fa-undo';
    const na = document.getElementById('hudNextArrow');
    if (na) na.innerHTML = `<i class="fas ${icon}"></i>`;
    const nd = document.getElementById('hudNextDist');
    if (nd) nd.textContent = minDist > 1000 ? (minDist / 1000).toFixed(1) + ' km' : Math.round(minDist) + ' m';
    const ni = document.getElementById('hudNextInstr');
    if (ni) ni.textContent = translateFallback(nextStep.maneuver.instruction || 'Tiếp tục di chuyển');
  } else {
    const na = document.getElementById('hudNextArrow');
    if (na) na.innerHTML = `<i class="fas fa-arrow-up"></i>`;
    const nd = document.getElementById('hudNextDist');
    if (nd) nd.textContent = 'Đi thẳng';
    const ni = document.getElementById('hudNextInstr');
    if (ni) ni.textContent = 'Tiếp tục di chuyển đến đích';
  }
}
function updateRemainingHUD() {
  if (!lastUserPos || !endPoint || !currentRouteCoords || currentRouteCoords.length === 0) return;
  let remainDist = 0;
  remainDist += calcDist(lastUserPos.lat, lastUserPos.lng, currentRouteCoords[0][0], currentRouteCoords[0][1]);
  for (let i = 0; i < currentRouteCoords.length - 1; i++) {
    remainDist += calcDist(currentRouteCoords[i][0], currentRouteCoords[i][1], currentRouteCoords[i+1][0], currentRouteCoords[i+1][1]);
  }
  const hd = document.getElementById('hudRemainDist');
  if (hd) hd.textContent = (remainDist / 1000).toFixed(1) + ' km';
  let speed = smoothedSpeed * 3.6;
  if (speed < 10) {
    const totalDist = currentRouteData?.distance || 1;
    const totalDur = currentRouteData?.duration || 1;
    speed = (totalDist / 1000) / (totalDur / 3600);
    if (speed < 10) speed = 30;
  }
  const remainSec = remainDist / (speed / 3.6);
  const remainMin = Math.max(1, Math.round(remainSec / 60));
  const ht = document.getElementById('hudRemainTime');
  if (ht) ht.textContent = remainMin + ' phút';
}
function checkArrival(lat, lng) {
  if (arrivalHandled || !endPoint || !currentRouteCoords.length) return;
  const distToEnd = calcDist(lat, lng, endPoint.lat, endPoint.lng);
  if (distToEnd < ARRIVAL_RADIUS_M) { arrivalHandled = true; triggerArrival(); }
}
function triggerArrival() {
  document.getElementById('hudRemainDist').textContent = '0 m';
  document.getElementById('hudRemainTime').textContent = 'Đã đến';
  document.getElementById('hudNextInstr').textContent = 'Đã đến nơi 🎉';
  document.getElementById('hudNextDist').textContent = '';
  document.getElementById('hudNextArrow').innerHTML = '🏁';
  document.getElementById('hudNextStopDist').textContent = '0 m';
  speak('Bạn đã đến nơi. Chuyến đi kết thúc.', 'nav');
  showArrivalToast();
  setTimeout(() => { if (document.getElementById('hud').classList.contains('hidden')) return; openEndTripModal(); }, 3000);
}
function showArrivalToast() {
  const toast = document.createElement('div');
  toast.style.cssText = `position:fixed;top:calc(80px + var(--safe-top));left:50%;transform:translateX(-50%) translateY(-30px);background:linear-gradient(135deg,#10b981,#059669);color:white;padding:16px 24px;border-radius:16px;font-weight:800;font-size:1rem;z-index:9999;box-shadow:0 10px 40px rgba(16,185,129,0.5);display:flex;align-items:center;gap:12px;opacity:0;transition:all 0.3s ease-out;pointer-events:none;`;
  toast.innerHTML = `<i class="fas fa-flag-checkered" style="font-size:1.5rem;"></i><span>Đã đến nơi! 🎉</span>`;
  document.body.appendChild(toast);
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
  requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(-50%) translateY(0)'; });
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(-30px)'; setTimeout(() => toast.remove(), 300); }, 2800);
}
/* ---------- POPUP LECH HUONG: tao / hien / an ---------- */
function ensureOffRoutePopup() {
  if (offRoutePopupEl && document.body.contains(offRoutePopupEl)) return offRoutePopupEl;
  // CSS 1 lan duy nhat
  if (!document.getElementById('offRoutePopupStyle')) {
    const st = document.createElement('style');
    st.id = 'offRoutePopupStyle';
    st.textContent = `
      #offRoutePopup{ position:fixed; inset:0; z-index:10001; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,.45); padding:16px; }
      #offRoutePopup.show{ display:flex; }
      #offRoutePopup .orp-card{ width:100%; max-width:360px; background:#fff; color:#0f172a; border-radius:18px; padding:20px 18px 16px; box-shadow:0 20px 50px rgba(0,0,0,.35); text-align:center; animation:orpPop .22s ease-out; }
      @keyframes orpPop{ from{ transform:scale(.92) translateY(8px); opacity:0; } to{ transform:scale(1) translateY(0); opacity:1; } }
      #offRoutePopup .orp-icon{ width:52px; height:52px; margin:0 auto 10px; border-radius:50%; background:#fef3c7; display:flex; align-items:center; justify-content:center; font-size:26px; }
      #offRoutePopup .orp-title{ font-size:17px; font-weight:800; margin:0 0 6px; }
      #offRoutePopup .orp-sub{ font-size:14px; color:#475569; line-height:1.5; margin:0 0 16px; }
      #offRoutePopup .orp-sub b{ color:#dc2626; }
      #offRoutePopup .orp-row{ display:flex; gap:10px; }
      #offRoutePopup .orp-btn{ flex:1; padding:13px 10px; border-radius:12px; font-size:15px; font-weight:800; cursor:pointer; border:0; }
      #offRoutePopup .orp-no{ background:#f1f5f9; color:#334155; }
      #offRoutePopup .orp-yes{ background:#2563eb; color:#fff; box-shadow:0 6px 18px rgba(37,99,235,.4); }
      #offRoutePopup .orp-btn:active{ transform:scale(.97); }
    `;
    document.head.appendChild(st);
  }
  const el = document.createElement('div');
  el.id = 'offRoutePopup';
  el.innerHTML = `
    <div class="orp-card" role="dialog" aria-modal="true" aria-label="Đi lệch hướng">
      <div class="orp-icon">⚠️</div>
      <p class="orp-title">Bạn đang đi lệch hướng chỉ đường</p>
      <p class="orp-sub">Bạn đã lệch <b id="offRoutePopupDist">~0 m</b> khỏi tuyến đường.<br>Bạn có muốn chúng tôi đổi hướng không?</p>
      <div class="orp-row">
        <button type="button" class="orp-btn orp-no" id="offRouteBtnNo">Không</button>
        <button type="button" class="orp-btn orp-yes" id="offRouteBtnYes">Có, đổi hướng</button>
      </div>
    </div>`;
  // Chan click ra ngoai lam tat popup vo tinh (user phai chon Co/Khong) - nhung van cho bam nut
  el.addEventListener('click', (e) => { if (e.target === el) e.stopPropagation(); });
  el.querySelector('#offRouteBtnYes').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); confirmOffRouteReroute(); });
  el.querySelector('#offRouteBtnNo').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); dismissOffRoutePopup(); });
  document.body.appendChild(el);
  offRoutePopupEl = el;
  return el;
}
function showOffRoutePopup(userLat, userLng, distM) {
  // Chi hoi khi dang dan duong that (tranh popup hien khi chi xem map)
  try {
    const _isNav = (typeof isNavigating !== 'undefined' && isNavigating) || (document.body && (document.body.classList.contains('google-nav') || document.body.classList.contains('navigating')));
    if (!_isNav) return;
  } catch(e) {}
  if (Date.now() < offRouteDeclinedUntil) return; // Vua bam Khong -> dang trong thoi gian tam khong hoi
  offRoutePendingPos = { lat: userLat, lng: userLng };
  offRoutePendingDist = Math.round(distM);
  const el = ensureOffRoutePopup();
  const distEl = document.getElementById('offRoutePopupDist');
  if (distEl) distEl.textContent = distM >= 1000 ? ('~' + (distM/1000).toFixed(1) + ' km') : ('~' + Math.round(distM) + ' m');
  if (!isOffRoutePopupOpen) {
    isOffRoutePopupOpen = true;
    offRoutePopupAt = Date.now();
    el.classList.add('show');
    try { if (navigator.vibrate) navigator.vibrate(120); } catch(e) {}
    try { if (typeof speak === 'function') speak('Bạn đang đi lệch hướng. Bạn có muốn đổi hướng không?', 'nav'); } catch(e) {}
  }
}
function hideOffRoutePopup() {
  isOffRoutePopupOpen = false;
  try { if (offRoutePopupEl) offRoutePopupEl.classList.remove('show'); } catch(e) {}
}
function confirmOffRouteReroute() {
  // Bam CO -> tim duong khac tu vi tri MOI NHAT (uu tien lastUserPos, vi GPS co the da chay them tu luc popup hien)
  const pos = (typeof lastUserPos !== 'undefined' && lastUserPos) ? lastUserPos : offRoutePendingPos;
  const lat = pos ? pos.lat : null, lng = pos ? pos.lng : null;
  hideOffRoutePopup();
  offRouteDeclinedUntil = 0;
  offRouteCount = 0;
  if (lat == null || lng == null) return;
  try { if (typeof showCustomToast === 'function') showCustomToast('Đang tìm tuyến đường mới...', 'info'); } catch(e) {}
  autoReroute(lat, lng);
}
function dismissOffRoutePopup() {
  // Bam KHONG -> giu tuyen cu, khong doi tuyen, tam 45s khong hoi lai
  hideOffRoutePopup();
  offRouteDeclinedUntil = Date.now() + OFF_ROUTE_POPUP_COOLDOWN_MS;
  offRouteCount = 0;
  offRoutePendingPos = null;
  try { if (typeof showCustomToast === 'function') showCustomToast('Đã giữ tuyến đường cũ', 'info'); } catch(e) {}
}
// Cho phep HTML / nut khac goi neu can + de test tu Console: window.showOffRoutePopup(10.7, 106.6, 120)
window.showOffRoutePopup = showOffRoutePopup;
window.hideOffRoutePopup = hideOffRoutePopup;
window.confirmOffRouteReroute = confirmOffRouteReroute;
window.dismissOffRoutePopup = dismissOffRoutePopup;

function checkOffRoute(userLat, userLng) {
  if (!currentRouteCoords || currentRouteCoords.length < 2 || isRerouting || arrivalHandled) return;
  // GPS kem (accuracy >60) thi dung reroute - do la GPS nhay, khong phai lac duong
  try{ if(typeof lastUserPos !== 'undefined' && lastUserPos && lastUserPos.accuracy && lastUserPos.accuracy > 60) { offRouteCount = 0; return; } }catch(e){}
  let minDist = Infinity;
  const startScan = Math.max(0, lastSnapIndex - 10);
  const endScan = Math.min(currentRouteCoords.length - 1, lastSnapIndex + 150);
  let _bestIdx = lastSnapIndex;
  for (let i = startScan; i < endScan; i++) {
    const pt = getClosestPointOnSegment(
      { lat: userLat, lng: userLng },
      { lat: currentRouteCoords[i][0], lng: currentRouteCoords[i][1] },
      { lat: currentRouteCoords[i+1][0], lng: currentRouteCoords[i+1][1] }
    );
    const d = calcDist(userLat, userLng, pt.lat, pt.lng);
    if (d < minDist) { minDist = d; _bestIdx = i; }
  }
  // [CLEANUP LOGIC] Cập nhật snap để lần sau scan gần đúng chỗ, không scan từ đầu -> đỡ false reroute
  if (minDist < 20) lastSnapIndex = _bestIdx;
  // User quay lai dung tuyen (<20m) -> tat popup neu dang mo + xoa cooldown "Khong"
  if (minDist < 20) {
    if (isOffRoutePopupOpen) hideOffRoutePopup();
    offRouteDeclinedUntil = 0;
    offRouteCount = 0;
    return;
  }
  // [MOI] Lech >35m, 2 lan lien tiep -> HOI user qua popup, KHONG tu doi tuyen nua
  // (truoc day: autoReroute ngay -> user khong biet vi sao tuyen tu doi)
  if (minDist > OFF_ROUTE_ASK_DIST_M) {
    // Dang mo popup roi -> chi cap nhat vi tri + khoang cach lech moi nhat, khong mo them popup
    if (isOffRoutePopupOpen) {
      offRoutePendingPos = { lat: userLat, lng: userLng };
      offRoutePendingDist = Math.round(minDist);
      const dEl = document.getElementById('offRoutePopupDist');
      if (dEl) dEl.textContent = minDist >= 1000 ? ('~' + (minDist/1000).toFixed(1) + ' km') : ('~' + Math.round(minDist) + ' m');
      return;
    }
    offRouteCount++;
    if (offRouteCount >= 2) {
      offRouteCount = 0;
      showOffRoutePopup(userLat, userLng, minDist);
    }
  } else offRouteCount = 0;
}

// Reroute check avoid zones
async function autoReroute(userLat, userLng, bypassCache = false) {
  if (isRerouting) return;
  if (!endPoint || typeof endPoint.lat !== 'number' || typeof endPoint.lng !== 'number') return; // [FIX 2026-11-22] Chưa có điểm đến thì apiRoute sẽ crash ở dest.lat
  try{ if(typeof hideOffRoutePopup === 'function') hideOffRoutePopup(); }catch(e){} // Đã đồng ý đổi tuyến (hoặc reroute bắt buộc do vùng cấm) -> tắt popup lệch hướng nếu còn mở
  isRerouting = true;
  // [CLEANUP] Anti-stuck: neu apiRoute treo >15s thi reset co
  const _rerouteGuard = setTimeout(()=>{ isRerouting = false; }, 15000);
  const currentMode = currentVehicleMode;
  try {
    const specs = getCurrentVehicleSpecs();
    let altRoutes = await apiRoute({ lat: userLat, lng: userLng }, endPoint, currentMode, bypassCache, specs);
    const beforeCount = altRoutes.length;
    altRoutes = altRoutes.filter(r => !checkRouteAgainstAvoidZones(r.geometry.coordinates).blocked);
    const r = altRoutes[0];
    if (!r) {
      if (beforeCount > 0) showCustomToast('⚠️ Tất cả tuyến đi qua vùng cấm, giữ tuyến cũ', 'warning');
      throw new Error('Không có tuyến thay thế');
    }
    if (!r.legs || !Array.isArray(r.legs) || r.legs.length === 0) r.legs = [{ steps: [] }];
    if (!r.legs[0].steps) r.legs[0].steps = [];
    currentRouteData = r;
    voiceRouteSteps = r.legs[0].steps;
    // [AUTO-REROUTE] Tim step gan user nhat thay vi luon 0 - de mui ten + banner khong nhay ve diem dau
    try{
      if(lastUserPos && voiceRouteSteps && voiceRouteSteps.length){
        let _bi=0,_bd=Infinity;
        voiceRouteSteps.forEach((s,i)=>{ if(s&&s.maneuver&&s.maneuver.location){ const d=Math.hypot(s.maneuver.location[1]-lastUserPos.lat, s.maneuver.location[0]-lastUserPos.lng); if(d<_bd){_bd=d;_bi=i;} } });
        voiceStepIndex=_bi;
      } else voiceStepIndex=0;
    }catch(e){ voiceStepIndex=0; }
    lastSnapIndex = 0; offRouteCount = 0;
    try{ arrivalHandled = false; }catch(e){}
    currentRouteCoords = r.geometry.coordinates;
    drawCurrentRoute();
    // [AUTO-REROUTE] Bao user + xoay goc ngay theo tuyen moi, khong doi GPS chay moi xoay
    try{ if(typeof showCustomToast==='function') showCustomToast('🔄 Đã tự đổi tuyến mới vì bạn đi sai đường', 'info'); }catch(e){}
    try{ if(typeof speak==='function') speak('Đã đổi tuyến mới.', 'nav'); }catch(e){}
    try{ if(typeof _lastCamAt!=='undefined') _lastCamAt=0; }catch(e){}
    try{
      if(lastUserPos && currentRouteCoords && currentRouteCoords.length>1){
        let _bi2=0,_bd2=Infinity;
        currentRouteCoords.forEach((c,i)=>{ const d=Math.hypot(c[0]-lastUserPos.lat, c[1]-lastUserPos.lng); if(d<_bd2){_bd2=d;_bi2=i;} });
        const _a=currentRouteCoords[_bi2], _b=currentRouteCoords[Math.min(currentRouteCoords.length-1,_bi2+3)];
        if(_a&&_b&&typeof bearingBetween==='function'){
          const _br=bearingBetween(_a[0],_a[1],_b[0],_b[1]);
          if(map && isFinite(_br)){
            try{ navFollowMode='first-person'; window._userFreed=false; }catch(e){}
            map.easeTo({ center:[lastUserPos.lng, lastUserPos.lat], bearing:_br, pitch:0, zoom:Math.max(map.getZoom(),17.5), duration:600 });
          }
        }
      }
    }catch(e){}
    try{ if(typeof updateWhiteTurnArrow==='function') setTimeout(()=>{ try{ updateWhiteTurnArrow(); }catch(e){} }, 100); }catch(e){}
    try{ if(typeof updateNextManeuverHUD==='function' && lastUserPos) updateNextManeuverHUD(lastUserPos.lat, lastUserPos.lng); }catch(e){}
    // Khi dang dan duong: KHONG fitBounds (no se zoom ra xa + danh nhau voi camera follow -> do map)
    // Chi fitBounds khi dang xem truoc tuyen (chua dan duong)
    const _isNavR = (typeof isNavigating !== 'undefined' && isNavigating) || (document.body && document.body.classList.contains('google-nav'));
    if(!_isNavR){
      const bounds = new maplibregl.LngLatBounds();
      currentRouteCoords.forEach(c => bounds.extend([c[1], c[0]]));
      map.fitBounds(bounds, { padding: 50, maxZoom: 17 });
    } else {
      // Dang chay: giu camera o user, reset snap
      try{ if(lastUserPos && typeof updateNavCamera === 'function' && navFollowMode === 'first-person') updateNavCamera(lastUserPos, lastUserPos.heading||0); }catch(e){}
    }
    document.getElementById('hudRemainDist').textContent = (r.distance / 1000).toFixed(1) + ' km';
    document.getElementById('hudRemainTime').textContent = Math.round(r.duration / 60) + ' phút';
  } catch (e) { console.error('Lỗi Reroute:', e); }
  finally { clearTimeout(_rerouteGuard); isRerouting = false; }
}

window.openAlternativeRoutes = function() {
  const stored = localStorage.getItem('alternativeRoutes');
  if (!stored) return alert('Không có tuyến đường phụ nào được lưu!');
  /* [V4] JSON.parse có guard: dữ liệu localStorage hỏng thì báo và dừng,
     không để lỗi console làm chết handler mở modal. */
  let routes;
  try { routes = JSON.parse(stored); } catch (e) { return alert('Dữ liệu tuyến đường phụ đã hỏng, không mở được!'); }
  if (!Array.isArray(routes) || routes.length === 0) return alert('Không có tuyến đường phụ nào!');
  alternativeRoutesData = [currentRouteData, ...routes];
  let html = '';
  alternativeRoutesData.forEach((r, index) => {
    const dist = (r.distance / 1000).toFixed(1); const dur = Math.round(r.duration / 60); const isCurrent = index === 0;
    html += `<div class="route-card ${isCurrent ? 'active' : ''}" onclick="switchToRoute(${index})"><div class="info"><h3>${isCurrent ? 'Tuyến hiện tại' : 'Tuyến gợi ý ' + index}</h3><p><i class="fas fa-road"></i> ${dist} km • <i class="fas fa-clock"></i> ${dur} phút</p></div></div>`;
  });
  document.getElementById('routeOptionsBody').innerHTML = html;
  document.getElementById('routeOptionsModal').classList.add('open');
};
window.switchToRoute = function(index) {
  const selectedRoute = alternativeRoutesData[index];
  if (!selectedRoute?.geometry?.coordinates?.length) return alert('Tuyến đường này không có dữ liệu!');
  if (!selectedRoute.legs || !Array.isArray(selectedRoute.legs) || selectedRoute.legs.length === 0) selectedRoute.legs = [{ steps: [] }];
  if (!selectedRoute.legs[0].steps) selectedRoute.legs[0].steps = [];
  const otherRoutes = alternativeRoutesData.filter((_, i) => i !== index);
  // [FIX DOI TUYEN LAN 3] Cap nhat RAM ngay - truoc day chi luu localStorage, RAM van giu mang cu
  // -> mo lan 1,2 tu va lai duoc, mo lan 3 index lech, bam khong doi tuyen.
  alternativeRoutesData = [selectedRoute, ...otherRoutes];
  try{ localStorage.setItem('alternativeRoutes', JSON.stringify(otherRoutes)); }catch(e){}
  currentRouteData = selectedRoute;
  currentRouteCoords = selectedRoute.geometry.coordinates;
  // [FIX ARRIVAL] Doi tuyen la chuyen moi - reset de khong tu nhay 'Ket thuc chuyen di?' sau 3s nhu video giay 16.
  try{ arrivalHandled = false; }catch(e){}
  try{ tripStartTime = Date.now(); }catch(e){}
  voiceRouteSteps = selectedRoute.legs[0].steps;
  // [FIX DOI TUYEN 2026-11-21] Reset dung - khong de voiceStepIndex=0 lam mui ten nhay ve diem dau
  // Tim step gan user nhat de lam step ke tiep, thay vi luon 0
  try{
    if(lastUserPos && voiceRouteSteps && voiceRouteSteps.length){
      let _bestI=0, _bestD=Infinity;
      voiceRouteSteps.forEach((s,i)=>{ if(s&&s.maneuver&&s.maneuver.location){ const d=Math.hypot(s.maneuver.location[1]-lastUserPos.lat, s.maneuver.location[0]-lastUserPos.lng); if(d<_bestD){_bestD=d;_bestI=i;} } });
      voiceStepIndex=_bestI;
    } else voiceStepIndex=0;
  }catch(e){ voiceStepIndex=0; }
  lastSnapIndex = 0; offRouteCount = 0;
  // [FIX DOI TUYEN] Xoa HET tuyen cu: alt-route + route-opt (tuyen phu) - truoc day chi xoa current-route nen anh 1 co 2 duong xanh
  try{ if(typeof clearRouteOptionLayers==='function') clearRouteOptionLayers(); }catch(e){}
  try{
    for(let i=0;i<10;i++){
      ['alt-route-layer-'+i,'alt-route-source-'+i,'route-opt-layer-'+i,'route-opt-source-'+i,'route-option-layer-'+i].forEach(id=>{
        try{ if(map && map.getLayer(id)) map.removeLayer(id); }catch(_){}
        try{ if(map && map.getSource(id)) map.removeSource(id); }catch(_){}
      });
    }
  }catch(e){}
  // [FIX DOI TUYEN] Xoa mui ten trang cu (ca marker + cache goc) de no ve lai theo tuyen moi - truoc day no ket o cho re cu
  try{ if(typeof whiteArrowMarker!=='undefined' && whiteArrowMarker){ whiteArrowMarker.remove(); whiteArrowMarker=null; } }catch(e){}
  try{ if(typeof whiteArrowAheadMarker!=='undefined' && whiteArrowAheadMarker){ whiteArrowAheadMarker.remove(); whiteArrowAheadMarker=null; } }catch(e){}
  drawCurrentRoute();
  const _isNavS = (typeof isNavigating !== 'undefined' && isNavigating) || (document.body && document.body.classList.contains('google-nav'));
  if(!_isNavS){
    const bounds = new maplibregl.LngLatBounds();
    currentRouteCoords.forEach(c => bounds.extend([c[1], c[0]]));
    map.fitBounds(bounds, { padding: 50, maxZoom: 17 });
  } else {
    // Dang dan duong ma doi tuyen: giu camera o user, khong zoom ra xa
    try{ if(lastUserPos && typeof updateNavCamera === 'function' && navFollowMode === 'first-person') updateNavCamera(lastUserPos, lastUserPos.heading||0); }catch(e){}
  }
  document.getElementById('hudRemainDist').textContent = (selectedRoute.distance / 1000).toFixed(1) + ' km';
  document.getElementById('hudRemainTime').textContent = Math.round(selectedRoute.duration / 60) + ' phút';
  // [FIX DOI TUYEN] Ep xoay camera + mui ten NGAY, khong doi GPS chay moi cap nhat
  try{
    if(typeof _lastCamAt!=='undefined') _lastCamAt=0; // pha throttle camera de no xoay lien
    // Tinh bearing theo tuyen moi: tu vi tri user -> diem tuyen phia truoc gan nhat (khong dung heading GPS cu)
    if(lastUserPos && currentRouteCoords && currentRouteCoords.length>1){
      let _bi=0,_bd=Infinity;
      currentRouteCoords.forEach((c,i)=>{ const d=Math.hypot(c[0]-lastUserPos.lat, c[1]-lastUserPos.lng); if(d<_bd){_bd=d;_bi=i;} });
      const _a=currentRouteCoords[_bi], _b=currentRouteCoords[Math.min(currentRouteCoords.length-1,_bi+3)];
      if(_a&&_b&&typeof bearingBetween==='function'){
        const _br=bearingBetween(_a[0],_a[1],_b[0],_b[1]);
        if(map && isFinite(_br)) map.easeTo({ center:[lastUserPos.lng, lastUserPos.lat], bearing:_br, pitch:0, zoom:Math.max(map.getZoom(),17.5), duration:600 });
      }
    }
    if(typeof updateWhiteTurnArrow==='function') setTimeout(()=>{ try{ updateWhiteTurnArrow(); }catch(e){} }, 80);
    if(typeof updateNextManeuverHUD==='function' && lastUserPos) updateNextManeuverHUD(lastUserPos.lat, lastUserPos.lng);
  }catch(e){}
  closeRouteOptions();
  speak('Đã đổi tuyến đường mới.', 'nav');
};

window.openEndTripModal = function() {
  if (!currentRouteData) {
    alert('Dữ liệu chuyến đi bị lỗi. Hệ thống sẽ đóng chế độ dẫn đường.');
    document.getElementById('hud').classList.add('hidden');
    document.body.classList.remove('navigating');
    if (watchId) navigator.geolocation.clearWatch(watchId);
    return;
  }
  const totalDist = (currentRouteData.distance / 1000).toFixed(1);
  const elapsedSec = tripStartTime ? (Date.now() - tripStartTime) / 1000 : currentRouteData.duration;
  const elapsedMin = Math.max(1, Math.round(elapsedSec / 60));
  const avgSpeed = elapsedSec > 5 ? ((currentRouteData.distance / 1000) / (elapsedSec / 3600)).toFixed(1) : '—';
  document.getElementById('endTripDist').textContent = totalDist + ' km';
  document.getElementById('endTripTime').textContent = elapsedMin + ' phút';
  document.getElementById('endTripAvgSpeed').textContent = avgSpeed === '—' ? '—' : avgSpeed + ' km/h';
  document.getElementById('endTripDest').textContent = endPoint?.name || '—';
  document.getElementById('endTripModal').classList.add('open');
};
window.closeEndTripModal = function() { document.getElementById('endTripModal').classList.remove('open'); };
window.endTrip = async function(save) {
  closeEndTripModal();
  if (save && currentRouteData && currentUser) {
    try {
      await addDoc(collection(fsdb, `users/${currentUser.uid}/savedRoutes`), {
        startName: startPoint.name, startLng: startPoint.lng, startLat: startPoint.lat,
        endName: endPoint.name, endLng: endPoint.lng, endLat: endPoint.lat,
        coords: currentRouteCoords, timestamp: Date.now()
      });
    } catch (e) {}
  }
  if (watchId) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  if (voiceCheckTimer) { clearInterval(voiceCheckTimer); voiceCheckTimer = null; }
  if (window.speechSynthesis) speechSynthesis.cancel();
  // [FIX THOAT CHI DUONG 2026-11-21] Xoa SACH: current + alt + route-opt + mui ten trang (ca marker) + ghim ket qua - truoc day sot lai duong xanh + ghim nhu anh 2
  try{ if(typeof whiteArrowMarker!=='undefined' && whiteArrowMarker){ whiteArrowMarker.remove(); whiteArrowMarker=null; } }catch(e){}
  try{ if(typeof whiteArrowAheadMarker!=='undefined' && whiteArrowAheadMarker){ whiteArrowAheadMarker.remove(); whiteArrowAheadMarker=null; } }catch(e){}
  try{ if(typeof clearRouteOptionLayers==='function') clearRouteOptionLayers(); }catch(e){}
  try{
    for(let i=0;i<15;i++){
      ['current-route-layer','current-route-source','alt-route-layer-'+i,'alt-route-source-'+i,'route-opt-layer-'+i,'route-opt-source-'+i,'route-option-layer-'+i,'route-option-source-'+i].forEach(id=>{
        try{ if(map && map.getLayer(id)) map.removeLayer(id); }catch(_){}
        try{ if(map && map.getSource(id)) map.removeSource(id); }catch(_){}
      });
    }
  }catch(e){}
  try{ if(typeof searchResultMarkers!=='undefined' && searchResultMarkers){ searchResultMarkers.forEach(m=>{ try{m.remove();}catch(_){} }); searchResultMarkers=[]; } }catch(e){}
  try{ if(typeof touchMarker!=='undefined' && touchMarker){ try{ if(typeof closePopupSmoothly==='function') closePopupSmoothly(touchMarker); else touchMarker.remove(); }catch(_){} touchMarker=null; } }catch(e){}
  try{ if(typeof navFollowMode!=='undefined') navFollowMode='free'; }catch(e){}
  try{ if(typeof isNavigating!=='undefined') isNavigating=false; }catch(e){}
  try{ if(typeof _lastCamAt!=='undefined') _lastCamAt=0; }catch(e){}
  try{ if (map && map.getLayer('current-route-layer')) map.removeLayer('current-route-layer'); }catch(e){}
  try{ if (map && map.getSource('current-route-source')) map.removeSource('current-route-source'); }catch(e){}
  if (window._routeBadges) { window._routeBadges.forEach(m => m.remove()); window._routeBadges = []; }
  alternativeRoutesData.forEach((_, i) => {
    if (map.getLayer(`alt-route-layer-${i}`)) map.removeLayer(`alt-route-layer-${i}`);
    if (map.getSource(`alt-route-source-${i}`)) map.removeSource(`alt-route-source-${i}`);
  });
  currentRouteCoords = []; currentRouteData = null; alternativeRoutesData = []; voiceRouteSteps = null;
  voiceStepIndex = 0; lastSnapIndex = 0; offRouteCount = 0; isRerouting = false; try{ if(typeof hideOffRoutePopup==='function') hideOffRoutePopup(); offRouteDeclinedUntil = 0; offRoutePendingPos = null; }catch(e){} // [MOI] Ket thuc chuyen -> tat popup lech huong
  tripStartTime = null; arrivalHandled = false; warnedReports.clear(); warnedAvoidZones.clear(); warnedPois.clear();
  localStorage.removeItem('alternativeRoutes');
  document.body.classList.remove('navigating');
  document.body.classList.remove('google-nav');
  // Ket thuc chuyen -> thoat han che do chi duong (Google Nav): tat HUD, tra map ve 2D, xoa mui ten trang
  try{ if(typeof window.stopNavigationMode === 'function') window.stopNavigationMode(); }catch(e){}
  try{ ['gNavTopBanner','gNavNextBanner','gNavBottomSheet','gNavRightControls','gNavRecenterBtn','gNavLeftStack'].forEach(id=>{ const el=document.getElementById(id); if(el) el.classList.remove('show'); }); }catch(e){}
  try{ if(map) map.easeTo({ pitch:0, bearing:0, offset:[0,0], duration:600 }); }catch(e){}
  try{ const wa=document.getElementById('whiteTurnArrow'); if(wa && wa.parentElement) wa.parentElement.remove(); }catch(e){}
  try{ const mm=document.getElementById('navMinimap'); if(mm) mm.style.display='none'; const rb=document.getElementById('minimapRestoreBtn'); if(rb) rb.classList.remove('show'); }catch(e){}
  document.getElementById('hud').classList.add('hidden');
  // [FIX THOAT] An het banner dan duong + minimap + tra map ve 2D - khong de sot banner "Re trai / Sau do"
  try{ ['gNavTopBanner','gNavNextBanner','gNavBottomSheet','gNavRightControls','gNavRecenterBtn','gNavLeftStack','navMinimap','minimapRestoreBtn'].forEach(id=>{ const el=document.getElementById(id); if(el){ el.classList.remove('show'); el.style.display='none'; } }); }catch(e){}
  try{ if(map) map.easeTo({ pitch:0, bearing:0, duration:500 }); }catch(e){}
  updateUIState();
  document.getElementById('dirInputEnd').value = '';
  document.getElementById('topSearchInput').value = '';
  document.getElementById('btnClearEnd').classList.add('hidden');
  document.getElementById('searchClearBtn').classList.add('hidden');
  endPoint = null;
  if (lastUserPos) map.flyTo({ center: [lastUserPos.lng, lastUserPos.lat], zoom: 16 });
  alert(save ? '✅ Đã lưu chuyến đi. Cảm ơn bạn đã dùng DriveKit!' : '🏁 Đã kết thúc chuyến đi.');
};
async function saveHistoryToFirestore(start, end, distance) {
  if (!currentUser) return;
  try {
    await addDoc(collection(fsdb, `users/${currentUser.uid}/history`), {
      startName: start.name, endName: end.name, distance, timestamp: Date.now()
    });
  } catch(e) { console.warn('Lỗi lưu history:', e); }
}

/* ========== EXPOSE ONE-TIME INIT (called by Part 1) ========== */
// Part 1 đã gọi initAppUI() rồi, KHÔNG cần làm gì ở đây.
// File này chạy cùng scope module nên tất cả hàm trên đều accessible.
/* ============================================================
   FIX 2 LOI TRONG ANH:
   1) Nut Luu poi ket xoay: success khong reset nut, open lai cung khong reset.
      -> reset nut o ca success + open + close. Dung finally.
   2) Lop ban do liet: changeLayer khong phai global (module) nen HTML onclick
      goi khong duoc. -> expose window.changeLayer + bao loi ro neu Worker style fail.
   ============================================================ */

// --- 1a) openPoiSheet: mo len phai tra nut ve trang thai goc ---
try{
  const _origOpenPoi = window.openPoiSheet;
  window.openPoiSheet = function(lat, lng, hint){
    _origOpenPoi(lat, lng, hint);
    const btn = document.getElementById('poiSaveBtn');
    if(btn){ btn.disabled = true; btn.innerHTML = '<i class="fas fa-check"></i> Lưu địa điểm'; }
    // Sheet mo thi phai an duoc, dong thi khong chan click map
    const sheet = document.getElementById('poiSheet');
    if(sheet) sheet.style.pointerEvents = 'auto';
  };
}catch(e){ /* patch warn removed */; }

// --- 1b) closePoiSheet: dong la phai tra nut + khong chan click nua ---
try{
  const _origClosePoi = window.closePoiSheet;
  window.closePoiSheet = function(){
    _origClosePoi();
    const btn = document.getElementById('poiSaveBtn');
    if(btn){ btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Lưu địa điểm'; }
    const sheet = document.getElementById('poiSheet');
    if(sheet) sheet.style.pointerEvents = '';
  };
}catch(e){ /* patch warn removed */; }

// --- 1c) submitCommunityPoi: luon reset nut, ca success lan loi ---
try{
  window.submitCommunityPoi = async function(){
    if(!currentUser) return alert('Chưa đăng nhập!');
    if(!tempPoiLatLng || !tempPoiTag) return alert('Vui lòng chọn loại địa điểm!');
    const name = document.getElementById('poiNameInput').value.trim();
    if(name.length < 2) return alert('Tên địa điểm quá ngắn!');
    const btn = document.getElementById('poiSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';
    try{
      const collectionName = tempPoiTag === 'rest_stop' ? 'rest_stops' : 'community_pois';
      await addDoc(collection(fsdb, collectionName), {
        lat: tempPoiLatLng.lat, lng: tempPoiLatLng.lng, name, tag: tempPoiTag,
        uid: currentUser.uid,
        authorName: currentUser.displayName || currentUser.email.split('@')[0],
        timestamp: Date.now(), upvotes: 0, categoryIds: getPoiCategoryIds(tempPoiTag) // v3: mã chuẩn (null nếu chưa xác minh) — không chặn lưu
      });
      // SUCCESS: reset TRUOC khi dong, de lan sau mo khong con spinner
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check"></i> Lưu địa điểm';
      window.closePoiSheet();
      showCustomToast('Đã thêm địa điểm!', 'success');
    }catch(e){
      alert('Lỗi lưu: ' + e.message);
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check"></i> Lưu địa điểm';
    }
  };
}catch(e){ /* patch warn removed */; }

// --- 2) changeLayer: phai la global de HTML onclick goi duoc ---
try{
  if(typeof changeLayer === 'function'){
    const _origChangeLayer = changeLayer;
    window.changeLayer = function(type, btn){
      try{
        // Bao loi ro neu Worker style fail (thieu Secret) thay vi im lang nhu liet
        if(window.map && typeof window.map.once === 'function'){
          window.map.once('error', (ev)=>{
            const msg = (ev && ev.error && (ev.error.message || ev.error.status)) || '';
            if(String(msg).includes('500') || String(msg).includes('style')){
              if(typeof showCustomToast === 'function') showCustomToast('Đổi lớp lỗi: Worker chưa có key / style lỗi. Kiểm tra Worker Secrets.', 'danger');
            }
          });
        }
        return _origChangeLayer(type, btn);
      }catch(err){
        console.error('changeLayer lỗi:', err);
        if(typeof showCustomToast === 'function') showCustomToast('Không đổi được lớp bản đồ: ' + (err.message || err), 'danger');
        else alert('Không đổi được lớp bản đồ: ' + (err.message || err));
      }
    };
  }
}catch(e){ /* patch warn removed */; }


/* ============================================================
   [FIX 2026-11-21] THANH DEN LEN TOP + NUT KET THUC + CON KM/GIO/PHUT/GIAY/NGAY + MUI TEN THEO DUONG XANH
   - .hud-bottom (thanh den chua ten diem den + nut doi tuyen / loa) dang o bottom:0 -> dua len top:0, khong con la bottom-sheet
   - Them nut Ket thuc hanh trinh vao thanh den tren cung
   - Con km + con thoi gian: hien thi du "Con X km - Con Y ngay Z gio ... phut ... giay", tick moi giay
   - Mui ten: sua cong thuc bearing sai (atan2(dLat,dLng)+90) -> atan2(dLng*cos(lat), dLat), bo offset lech khoi duong xanh, marker nam dung tren duong xanh
============================================================ */
(function(){
  // ---- 1. CSS: dua thanh den len canh tren ----
  function injectTopBarCSS(){
    if(document.getElementById('fixHudTopBar20261121')) return;
    const st = document.createElement('style');
    st.id = 'fixHudTopBar20261121';
    st.textContent = `
      /* Thanh den (ten diem den + nut) len canh tren, khong con bottom-sheet */
      #hud{ position:fixed !important; top:0 !important; left:0 !important; right:0 !important; bottom:auto !important; transform:none !important; border-radius:0 !important; }
      .hud-bottom{
        position:fixed !important;
        top:0 !important; left:0 !important; right:0 !important; bottom:auto !important;
        transform:none !important; border-radius:0 !important;
        border-top:none !important; border-bottom:1px solid rgba(255,255,255,0.15) !important;
        background:#0f172a !important; background:rgba(15,23,42,0.97) !important;
        color:#fff !important;
        padding:calc(8px + env(safe-area-inset-top, 0px)) 12px 10px !important;
        z-index:600 !important;
        box-shadow:0 4px 20px rgba(0,0,0,0.35) !important;
      }
      .hud-bottom .hud-next-stop .name{ color:#fff !important; }
      .hud-bottom .hud-next-stop .dist{ color:#fbbf24 !important; }
      /* Day 2 khoi duoi xuong de khong bi thanh den de */
      .hud-top{ top:calc(60px + env(safe-area-inset-top, 0px)) !important; }
      .hud-next{ top:calc(132px + env(safe-area-inset-top, 0px)) !important; }
      /* Nut Ket thuc trong thanh den tren cung */
      #hudEndTripBtn{
        background:#ef4444 !important; color:#fff !important; border:0 !important;
        padding:10px 14px !important; border-radius:12px !important;
        font-weight:800 !important; font-size:13px !important; white-space:nowrap !important;
        box-shadow:0 4px 12px rgba(239,68,68,0.4) !important; cursor:pointer !important;
        flex-shrink:0 !important;
      }
      #hudEndTripBtn:active{ transform:scale(0.95); }
      /* Dong con km / con thoi gian trong thanh den */
      #hudTopRemain{
        font-size:12px !important; font-weight:700 !important; color:#fbbf24 !important;
        font-family:ui-monospace, monospace !important; line-height:1.35 !important;
        white-space:normal !important;
      }
      .user-marker-inner{ transform-origin:center !important; }
    `;
    document.head.appendChild(st);
  }
  injectTopBarCSS();

  // ---- 2. Nut Ket thuc hanh trinh ----
  function ensureHudEndBtn(){
    const bottom = document.querySelector('.hud-bottom') || document.getElementById('hud');
    if(!bottom) return;
    if(!document.getElementById('hudEndTripBtn')){
      const btn = document.createElement('button');
      btn.id = 'hudEndTripBtn';
      btn.type = 'button';
      btn.textContent = '■ Ket thuc';
      btn.title = 'Ket thuc hanh trinh';
      btn.onclick = (e)=>{
        e.stopPropagation();
        try{
          if(typeof window.openEndTripModal === 'function'){ window.openEndTripModal(); return; }
          if(typeof window.endTrip === 'function'){ window.endTrip(false); return; }
          if(typeof openEndTripModal === 'function'){ openEndTripModal(); return; }
          if(typeof endTrip === 'function'){ endTrip(false); return; }
        }catch(err){ console.warn('Ket thuc hanh trinh loi', err); }
      };
      const group = bottom.querySelector('.hud-btn-group');
      if(group){ group.insertBefore(btn, group.firstChild); }
      else { bottom.appendChild(btn); }
    }
    let remainEl = document.getElementById('hudTopRemain');
    if(!remainEl){
      const stop = bottom.querySelector('.hud-next-stop');
      remainEl = document.createElement('div');
      remainEl.id = 'hudTopRemain';
      remainEl.textContent = 'Con -- km - Con --';
      if(stop){ stop.appendChild(remainEl); }
      else { bottom.appendChild(remainEl); }
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureHudEndBtn);
  else ensureHudEndBtn();
  try{
    const obs = new MutationObserver(()=>{ ensureHudEndBtn(); });
    obs.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
    setTimeout(()=>{ try{obs.disconnect();}catch(e){} }, 30000);
  }catch(e){}

  // ---- 3. Format con km + con ngay/gio/phut/giay ----
  function fmtDist(m){
    if(!isFinite(m) || m < 0) m = 0;
    if(m < 1000) return Math.round(m) + ' m';
    return (m/1000).toFixed(1) + ' km';
  }
  function fmtRemainTime(sec){
    sec = Math.max(0, Math.round(sec || 0));
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const mi = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const parts = [];
    if(d > 0) parts.push(d + ' ngay');
    if(h > 0 || d > 0) parts.push(h + ' gio');
    if(mi > 0 || h > 0 || d > 0) parts.push(mi + ' phut');
    parts.push(s + ' giay');
    return parts.join(' ');
  }
  let lastRemainDistM = 0;
  let lastRemainSec = 0;
  function renderRemain(distM, sec){
    lastRemainDistM = distM; lastRemainSec = sec;
    const distTxt = 'Con ' + fmtDist(distM);
    const timeTxt = 'Con ' + fmtRemainTime(sec);
    const hd = document.getElementById('hudRemainDist');
    if(hd) hd.textContent = distTxt;
    const ht = document.getElementById('hudRemainTime');
    if(ht) ht.textContent = timeTxt;
    const hs = document.getElementById('hudNextStopDist');
    if(hs) hs.textContent = distTxt + ' - ' + timeTxt;
    const topR = document.getElementById('hudTopRemain');
    if(topR) topR.textContent = distTxt + ' - ' + timeTxt;
  }
  setInterval(()=>{
    try{
      if (document.hidden) return;
      const hud = document.getElementById('hud');
      if(!hud || hud.classList.contains('hidden')) return;
      if(!currentRouteCoords || currentRouteCoords.length === 0) return;
      if(lastRemainSec > 0){ lastRemainSec = Math.max(0, lastRemainSec - 1); renderRemain(lastRemainDistM, lastRemainSec); }
    }catch(e){}
  }, 1000);

  try{
    updateRemainingHUD = function(){
      if(!lastUserPos || !endPoint || !currentRouteCoords || currentRouteCoords.length === 0) return;
      let remainDist = 0;
      remainDist += calcDist(lastUserPos.lat, lastUserPos.lng, currentRouteCoords[0][0], currentRouteCoords[0][1]);
      for(let i=0;i<currentRouteCoords.length-1;i++){
        remainDist += calcDist(currentRouteCoords[i][0], currentRouteCoords[i][1], currentRouteCoords[i+1][0], currentRouteCoords[i+1][1]);
      }
      let speed = (typeof smoothedSpeed !== 'undefined' ? smoothedSpeed * 3.6 : 0);
      if(speed < 10){
        const totalDist = (typeof currentRouteData !== 'undefined' && currentRouteData && currentRouteData.distance) || 1;
        const totalDur = (typeof currentRouteData !== 'undefined' && currentRouteData && currentRouteData.duration) || 1;
        speed = (totalDist/1000) / (totalDur/3600);
        if(speed < 10) speed = 30;
      }
      const remainSec = remainDist / (speed/3.6);
      renderRemain(remainDist, remainSec);
    };
  }catch(e){ /* patch warn removed */; }

  try{
    const _origStartNavHUD = startNavigationHUD;
    startNavigationHUD = function(){
      const r = _origStartNavHUD.apply(this, arguments);
      ensureHudEndBtn();
      try{ updateRemainingHUD(); }catch(e){}
      return r;
    };
  }catch(e){}

  // ---- 4. Mui ten huong dung vao duong xanh ----
  function routeBearingAt(idx){
    try{
      if(!currentRouteCoords || currentRouteCoords.length < 2) return null;
      const i = Math.max(0, Math.min(idx, currentRouteCoords.length-2));
      const p1 = currentRouteCoords[i];
      const p2 = currentRouteCoords[i+1];
      if(!p1 || !p2) return null;
      const dLat = p2[0] - p1[0];
      const dLng = (p2[1] - p1[1]) * Math.cos(p1[0] * Math.PI/180);
      if(Math.abs(dLat) < 1e-9 && Math.abs(dLng) < 1e-9) return null;
      let b = Math.atan2(dLng, dLat) * 180 / Math.PI;
      b = (b + 360) % 360;
      return b;
    }catch(e){ return null; }
  }
  function applyRouteBearingToArrow(){
    try{
      if(!userMarker) return;
      if(!currentRouteCoords || currentRouteCoords.length < 2) return;
      const b = routeBearingAt(lastSnapIndex || 0);
      if(b === null) return;
      const inner = userMarker.getElement().querySelector('.user-marker-inner');
      if(inner) inner.style.transform = 'rotate(' + b + 'deg)';
    }catch(e){}
  }
  try{
    animateMarkerTo = function(targetPos){
      if(!userMarker){ updateUserMarkerOnMap(targetPos, targetPos.heading); return; }
      let snappedLat = targetPos.lat, snappedLng = targetPos.lng, targetHeading = targetPos.heading;
      if(currentRouteCoords && currentRouteCoords.length > 1 && lastSnapIndex < currentRouteCoords.length - 1){
        let minDist = Infinity, bestPoint = null, bestSegmentIndex = lastSnapIndex;
        const startScan = Math.max(0, lastSnapIndex - 5);
        const endScan = Math.min(currentRouteCoords.length - 1, lastSnapIndex + 50);
        for(let i=startScan;i<endScan;i++){
          const pt = getClosestPointOnSegment(
            { lat: targetPos.lat, lng: targetPos.lng },
            { lat: currentRouteCoords[i][0], lng: currentRouteCoords[i][1] },
            { lat: currentRouteCoords[i+1][0], lng: currentRouteCoords[i+1][1] }
          );
          const d = calcDist(targetPos.lat, targetPos.lng, pt.lat, pt.lng);
          if(d < minDist){ minDist = d; bestPoint = pt; bestSegmentIndex = i; if(i > lastSnapIndex) lastSnapIndex = i; }
        }
        if(bestPoint && minDist < 40){
          const p1 = currentRouteCoords[bestSegmentIndex];
          const p2 = currentRouteCoords[bestSegmentIndex + 1];
          const dLat = p2[0] - p1[0];
          const dLng = (p2[1] - p1[1]) * Math.cos(p1[0] * Math.PI/180);
          let bearing = Math.atan2(dLng, dLat) * 180 / Math.PI;
          bearing = (bearing + 360) % 360;
          snappedLat = bestPoint.lat;
          snappedLng = bestPoint.lng;
          targetHeading = bearing;
        }
      }
      if(currentRouteCoords && currentRouteCoords.length > 0 && lastSnapIndex > 0){
        const remaining = currentRouteCoords.slice(lastSnapIndex);
        if(remaining.length > 1){
          currentRouteCoords = remaining;
          lastSnapIndex = 0;
          drawCurrentRoute();
        } else {
          if(map.getLayer('current-route-layer')) map.removeLayer('current-route-layer');
          if(map.getSource('current-route-source')) map.removeSource('current-route-source');
          currentRouteCoords = [];
        }
      }
      const startLat = userMarker.getLngLat().lat;
      const startLng = userMarker.getLngLat().lng;
      const startTime = performance.now(), duration = 1000;
      function step(time){
        const progress = Math.min((time - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const currentLat = startLat + (snappedLat - startLat) * ease;
        const currentLng = startLng + (snappedLng - startLng) * ease;
        userMarker.setLngLat([currentLng, currentLat]);
        const inner = userMarker.getElement().querySelector('.user-marker-inner');
        if(inner) inner.style.transform = 'rotate(' + (targetHeading || 0) + 'deg)';
        if(progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
      gpsCircleGeoJSON = createCircleGeoJSON(snappedLng, snappedLat, targetPos.accuracy || 10);
      if(map.getSource('gps-circle-source')) map.getSource('gps-circle-source').setData(gpsCircleGeoJSON);
    };
  }catch(e){ /* patch warn removed */; }
  try{
    const _origUpdateUserMarker = updateUserMarkerOnMap;
    updateUserMarkerOnMap = function(pos, heading){
      let h = heading;
      try{
        const isNav = (typeof isNavigating !== 'undefined' && isNavigating) || (document.body && document.body.classList.contains('navigating')) || (currentRouteCoords && currentRouteCoords.length > 1);
        if(isNav){
          const rb = routeBearingAt(lastSnapIndex || 0);
          if(rb !== null){
            if(h === null || h === undefined || h === 0 || isNaN(h)) h = rb;
            else {
              let diff = Math.abs(((h - rb + 540) % 360) - 180);
              if(diff > 90) h = rb;
            }
          }
        }
      }catch(e){}
      const r = _origUpdateUserMarker(pos, h);
      applyRouteBearingToArrow();
      return r;
    };
  }catch(e){ /* patch warn removed */; }
  try{ if(window._bearingInt) clearInterval(window._bearingInt); }catch(e){} window._bearingInt = setInterval(()=>{ try{ if (document.hidden) return; const hud = document.getElementById('hud'); if(hud && !hud.classList.contains('hidden')) applyRouteBearingToArrow(); }catch(e){} }, 1000); /* [FIX TREO] bearing: 300->1000ms, 1 interval duy nhat */
})();


/* ============================================================
   [GOOGLE NAV 2026-11-21] DOI GOC NHIN CHI DUONG SANG KIU GOOGLE MAPS (anh 2-3-4)
   - Bo goc nhin anh 1: map phang, nhin tu tren xuong, mui ten xanh nho, minimap, vong tron xanh to
   - Sang kieu Google: camera nghieng 55 do, dau huong len tren, user o 1/3 duoi, cham xanh duong
   - Banner tren xanh dam: mui ten to + "150 m / ve huong Hem 134" + "Sau do ->"
   - Bottom sheet trang: "3 phut / 900 m - 7:11" + nut X + sao
   - Cot phai: la ban / tim kiem / loa / doi tuyen + nut "Ve giua" trai duoi
   - Duong xanh day hon, co vien trang, mui ten trang o cho re (giu lai)
   ============================================================ */
(function(){
  // ---- 1. CSS Google Nav ----
  function injectGoogleNavCSS(){
    if(document.getElementById('googleNavStyle20261121')) return;
    const st = document.createElement('style');
    st.id = 'googleNavStyle20261121';
    st.textContent = `
      /* Khi dang dan duong kieu Google: an UI cu (thanh den, minimap, panel 3 nut, search noi) */
      body.google-nav #navControls, body.google-nav #navMinimap, body.google-nav .hud-top, body.google-nav .hud-bottom, body.google-nav #hud, body.google-nav .fab-directions, body.google-nav .fab-locate, body.google-nav .fab-layers, body.google-nav .fab-report { display:none !important; }
      body.google-nav .floating-search{ display:none !important; }
      body.google-nav .floating-search.show-in-nav{ display:none !important; } /* [BAT BUOC] Dang dan duong: khoa search - khong hien overlay nua */
      body.google-nav #gNavSearchBtn{ opacity:0.4 !important; filter:grayscale(1) !important; }
      body.google-nav #suggestionsBox{ z-index:1210 !important; }
      body.google-nav #suggestionsBox.show{ display:none !important; } /* [FIX] Dang dan duong: khoa search - khong hien goi y */
      body.google-nav #hudTopRemain, body.google-nav #hudEndTripBtn { display:none !important; }
      /* Banner tren - xanh dam kieu Google */
      #gNavTopBanner{ position:fixed !important; top:calc(12px + env(safe-area-inset-top, 0px)) !important; left:12px !important; right:12px !important; z-index:800 !important; background:#0F766E !important; background:linear-gradient(180deg,#0F766E,#0B5E55) !important; color:#fff !important; border-radius:16px !important; padding:14px 16px !important; display:none; align-items:center; gap:14px; box-shadow:0 6px 20px rgba(0,0,0,0.28) !important; }
      #gNavTopBanner.show{ display:flex !important; }
      #gNavTopArrow{ width:52px; height:52px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:38px; font-weight:900; line-height:1; color:#fff; }
      #gNavTopMain{ flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
      #gNavTopDist{ font-size:18px; font-weight:700; color:rgba(255,255,255,0.92); line-height:1.2; }
      #gNavTopInstr{ font-size:24px; font-weight:800; line-height:1.15; color:#fff; word-break:break-word; }
      /* Banner "Sau do" - dinh duoi banner tren */
      #gNavNextBanner{ position:fixed !important; top:calc(96px + env(safe-area-inset-top, 0px)) !important; left:12px !important; z-index:799 !important; background:#0B5E55 !important; color:#fff !important; border-radius:0 0 14px 14px !important; padding:8px 14px 10px !important; display:none; align-items:center; gap:8px; font-size:17px; font-weight:700; box-shadow:0 4px 14px rgba(0,0,0,0.22) !important; max-width:78vw; }
      #gNavNextBanner.show{ display:flex !important; }
      #gNavNextBanner .next-arrow{ font-size:22px; font-weight:900; }
      /* Bottom sheet trang kieu Google */
      #gNavBottomSheet{ position:fixed !important; left:0 !important; right:0 !important; bottom:0 !important; z-index:800 !important; background:#fff !important; border-radius:20px 20px 0 0 !important; padding:12px 16px calc(14px + env(safe-area-inset-bottom, 0px)) !important; display:none; align-items:center; gap:14px; box-shadow:0 -6px 24px rgba(0,0,0,0.18) !important; transition:transform 0.32s ease, opacity 0.25s ease !important; }
      #gNavBottomRow{ display:flex !important; align-items:center !important; gap:14px !important; width:100% !important; }
      /* Bottom sheet thu xuong: truot xuong khoi man hinh, chi con nut mui ten */
      #gNavBottomSheet.collapsed{ transform:translateY(calc(100% + 20px)) !important; opacity:0 !important; pointer-events:none !important; }
      /* Nut mui ten mo lai bottom sheet - hien khi bottom sheet dang thu */
      #gNavBottomExpandBtn{ position:fixed !important; left:50% !important; transform:translateX(-50%) !important; bottom:calc(12px + env(safe-area-inset-bottom, 0px)) !important; z-index:801 !important; width:52px !important; height:32px !important; border-radius:999px !important; border:none !important; background:#fff !important; box-shadow:0 4px 14px rgba(0,0,0,0.28) !important; display:none !important; align-items:center !important; justify-content:center !important; cursor:pointer !important; color:#3c4043 !important; }
      #gNavBottomExpandBtn.show{ display:flex !important; }
      /* Nut Ket thuc tren banner xanh (tren cung) */
      #gNavTopEndTripBtn{ flex-shrink:0 !important; background:#fff !important; color:#0B5E55 !important; border:none !important; border-radius:999px !important; padding:8px 12px !important; font-size:13px !important; font-weight:800 !important; cursor:pointer !important; box-shadow:0 2px 8px rgba(0,0,0,0.2) !important; white-space:nowrap !important; }
      #gNavTopEndTripBtn:active{ transform:scale(0.95); }
      /* Bo nut Ket thuc cu o bottom-sheet - gio dung nut tren banner xanh */
      #gNavBottomEndTripBtn{ display:none !important; }
      /* Popup lop ban do trong Google Nav: neo gan nut lop o bottom-sheet, khong de o goc tren trai nua */
      body.google-nav #layerMenu{ position:fixed !important; left:auto !important; right:12px !important; bottom:calc(168px + env(safe-area-inset-bottom, 0px)) !important; top:auto !important; z-index:1100 !important; }
      /* An la ban cu (dark) trong Google Nav - chi dung 1 la ban o stack trai */
      body.google-nav #btnCompass{ display:none !important; }
      /* Stack trai: la ban o tren, Ve giua o duoi, khong de nua */
      #gNavLeftStack{ position:fixed !important; left:16px !important; bottom:calc(168px + env(safe-area-inset-bottom, 0px)) !important; z-index:800 !important; display:none; flex-direction:column; gap:12px; align-items:center; }
      #gNavLeftStack.show{ display:flex !important; }
      #gNavLeftStack #gNavCompassBtn{ margin:0 !important; }
      #gNavLeftStack #gNavRecenterBtn{ position:static !important; left:auto !important; bottom:auto !important; display:flex !important; }
      /* An nut Ket thuc noi cu (de tranh 2 nut trung nhau) - gio dung nut trong bottom-sheet */
      #gNavEndTripBtn{ display:none !important; }
      #gNavBottomSheet.show{ display:flex !important; }
      #gNavExitBtn{ width:48px; height:48px; flex-shrink:0; border-radius:999px; border:1px solid #dadce0; background:#fff; color:#3c4043; font-size:22px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; }
      #gNavBottomInfo{ flex:1; min-width:0; text-align:center; display:flex; flex-direction:column; gap:1px; }
      #gNavRemainTime{ font-size:27px; font-weight:800; color:#188038; line-height:1.1; }
      #gNavRemainMeta{ font-size:15px; font-weight:600; color:#5f6368; }
      #gNavLayerBtn{ width:48px; height:48px; flex-shrink:0; border-radius:999px; border:1px solid #dadce0; background:#fff; color:#1a73e8; font-size:24px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
      /* Cot nut phai kieu Google */
      #gNavRightControls{ position:fixed !important; right:12px !important; bottom:calc(195px + env(safe-area-inset-bottom, 0px)) !important; z-index:800 !important; display:none; flex-direction:column; gap:12px; }
      #gNavRightControls.show{ display:flex !important; }
      .gNavRoundBtn{ width:56px; height:56px; border-radius:999px; background:#fff; border:none; box-shadow:0 4px 14px rgba(0,0,0,0.22); font-size:22px; color:#3c4043; cursor:pointer; display:flex; align-items:center; justify-content:center; }
      .gNavRoundBtn svg{ display:block; flex-shrink:0; }
      #gNavLayerBtn svg, #gNavExitBtn svg{ display:block; flex-shrink:0; }
      .gNavRoundBtn:active{ transform:scale(0.94); }
      #gNavCompassBtn .compass-arrow{ font-size:24px; font-weight:900; color:#ea4335; display:inline-block; transition:transform 0.3s; }
      /* Nut Ve giua */
      #gNavRecenterBtn{ position:fixed !important; left:16px !important; bottom:calc(132px + env(safe-area-inset-bottom, 0px)) !important; z-index:800 !important; background:#fff !important; color:#0F766E !important; border:none !important; border-radius:999px !important; padding:10px 16px !important; font-size:15px !important; font-weight:800 !important; box-shadow:0 4px 14px rgba(0,0,0,0.22) !important; display:none; align-items:center; gap:6px; cursor:pointer; }
      #gNavRecenterBtn.show{ display:flex !important; }
      /* Cham user kieu Google: cham xanh duong + vien trang */
      .g-user-dot{ width:22px; height:22px; border-radius:999px; background:#1a73e8; border:4px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.35), 0 0 0 8px rgba(26,115,232,0.18); }
      .g-user-dot-wrap{ width:38px; height:38px; display:flex; align-items:center; justify-content:center; }
    `;
    document.head.appendChild(st);
  }
  injectGoogleNavCSS();
  // --- CSS MOBILE RIENG CHO CHE DO CHI DUONG: khong dung layout desktop ---
  (function injectMobileNavCSS(){
    // Xoa style mobile cu neu co de khong bi chong
    try{ const _old = document.getElementById('mobileNavStyle20261121'); if(_old) _old.remove(); }catch(e){}
    if(document.getElementById('mobileNavStyle20261122')) return;
    const st = document.createElement('style');
    st.id = 'mobileNavStyle20261122';
    st.textContent = `
      /* ============ CHI DUONG TREN DIEN THOAI: <640px hoac cam ung ============ */
      @media (max-width: 640px), (pointer: coarse) and (max-width: 900px){
        html, body{ overscroll-behavior:none; }
        #map{ height:100dvh !important; height:100vh !important; }
        /* --- 1. BANNER TREN: tran vien, doc khi chay xe --- */
        body.google-nav #gNavTopBanner{
          left:0 !important; right:0 !important; top:0 !important;
          border-radius:0 0 18px 18px !important;
          padding:calc(8px + env(safe-area-inset-top, 0px)) 10px 11px 10px !important;
          gap:10px !important; align-items:center !important;
        }
        body.google-nav #gNavTopArrow{ width:48px !important; height:48px !important; font-size:34px !important; flex-shrink:0 !important; }
        body.google-nav #gNavTopMain{ gap:1px !important; }
        body.google-nav #gNavTopDist{ font-size:14px !important; font-weight:700 !important; letter-spacing:.2px !important; text-transform:uppercase !important; opacity:.92 !important; }
        body.google-nav #gNavTopInstr{ font-size:21px !important; font-weight:800 !important; line-height:1.2 !important; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; word-break:break-word; }
        /* Nut Ket thuc tren banner: de bam khi chay xe - 44px, do trang */
        body.google-nav #gNavTopEndTripBtn{
          min-width:64px !important; min-height:44px !important; padding:0 12px !important;
          font-size:13px !important; font-weight:800 !important; background:#fff !important; color:#DC2626 !important;
          border-radius:999px !important; display:flex !important; align-items:center !important; justify-content:center !important;
        }
        /* --- 2. BANNER SAU DO: chip nho dinh duoi banner tren --- */
        body.google-nav #gNavNextBanner{
          left:10px !important; top:calc(88px + env(safe-area-inset-top, 0px)) !important;
          padding:7px 11px !important; font-size:13px !important; border-radius:999px !important; max-width:calc(100vw - 20px) !important;
          white-space:nowrap !important; overflow:hidden !important; text-overflow:ellipsis !important;
        }
        /* --- 3. BOTTOM SHEET MOBILE: the noi, co tay keo --- */
        body.google-nav #gNavBottomSheet{
          left:8px !important; right:8px !important; bottom:calc(8px + env(safe-area-inset-bottom, 0px)) !important;
          border-radius:18px !important; padding:6px 10px calc(10px + env(safe-area-inset-bottom, 0px)) !important;
          flex-direction:column !important; gap:0 !important; align-items:stretch !important;
        }
        body.google-nav #gNavBottomHandle{
          width:36px !important; height:4px !important; border-radius:999px !important; background:#DADCE0 !important;
          margin:2px auto 6px auto !important; flex-shrink:0 !important; touch-action:none !important;
        }
        body.google-nav #gNavBottomRow{ gap:10px !important; }
        body.google-nav #gNavExitBtn, body.google-nav #gNavLayerBtn{ width:42px !important; height:42px !important; }
        body.google-nav #gNavBottomInfo{ gap:0 !important; }
        body.google-nav #gNavRemainTime{ font-size:22px !important; line-height:1.1 !important; }
        body.google-nav #gNavRemainMeta{ font-size:12.5px !important; }
        /* Nut mui ten mo lai: pill lon, de bam bang ngon cai */
        body.google-nav #gNavBottomExpandBtn{
          bottom:calc(10px + env(safe-area-inset-bottom, 0px)) !important;
          width:64px !important; height:30px !important; border-radius:999px !important;
        }
        /* --- 4. COT NUT PHAI: gon, nam tren bottom sheet, khong che map --- */
        body.google-nav #gNavRightControls{
          right:12px !important; bottom:calc(118px + env(safe-area-inset-bottom, 0px)) !important; gap:10px !important;
        }
        body.google-nav .gNavRoundBtn{ width:46px !important; height:46px !important; font-size:20px !important; }
        body.google-nav #gNavCompassBtn .compass-arrow{ font-size:22px !important; }
        /* --- 5. NUT VE GIUA: pill trai, cung hang voi cot phai --- */
        body.google-nav #gNavRecenterBtn{
          left:12px !important; bottom:calc(118px + env(safe-area-inset-bottom, 0px)) !important;
          padding:10px 14px !important; font-size:13px !important; min-height:44px !important;
        }
        body.google-nav #gNavLeftStack{ left:12px !important; bottom:calc(118px + env(safe-area-inset-bottom, 0px)) !important; }
        /* --- 6. MINIMAP TREN MOBILE: nho lai, khong che duong --- */
        body.google-nav #navMinimap, #navMinimap{
          width:96px !important; height:72px !important; right:10px !important; bottom:calc(178px + env(safe-area-inset-bottom, 0px)) !important; border-radius:12px !important;
        }
        /* --- 7. MODAL TUYEN / KET THUC: bottom-sheet --- */
        #routeOptionsModal{ left:0 !important; right:0 !important; bottom:0 !important; top:auto !important; max-height:78dvh !important; border-radius:18px 18px 0 0 !important; padding:12px 12px calc(14px + env(safe-area-inset-bottom, 0px)) !important; overflow-y:auto !important; -webkit-overflow-scrolling:touch !important; }
        #routeOptionsModal > div:first-child{ flex-wrap:nowrap !important; gap:8px !important; }
        #routeOptionsModal > div:first-child b{ flex:1 !important; min-width:0 !important; font-size:17px !important; white-space:nowrap !important; overflow:hidden !important; text-overflow:ellipsis !important; }
        #routeOptionsModal button{ min-height:44px !important; min-width:44px !important; touch-action:manipulation !important; }
        #gNavEndTripModal > div, #endTripModal > div{ width:calc(100vw - 24px) !important; max-width:400px !important; margin:0 12px !important; padding:18px 16px !important; border-radius:18px !important; }
        #dirSheet{ max-height:82dvh !important; border-radius:18px 18px 0 0 !important; }
        button{ touch-action:manipulation !important; -webkit-tap-highlight-color:transparent !important; }
        body.google-nav #legend{ display:none !important; }
        /* Cham user tren map: nho hon 1 chut tren mobile de do che duong */
        .g-user-dot{ width:18px !important; height:18px !important; border-width:3px !important; }
      }
      /* Man hinh rat nho <380px */
      @media (max-width: 380px){
        body.google-nav #gNavTopInstr{ font-size:18px !important; }
        body.google-nav #gNavTopEndTripBtn{ min-width:56px !important; font-size:11px !important; padding:0 10px !important; }
        body.google-nav #gNavRemainTime{ font-size:20px !important; }
      }
      /* Ngang (landscape) tren dien thoai: banner thap lai, bottom sheet gon hon */
      @media (max-width: 900px) and (orientation: landscape){
        body.google-nav #gNavTopBanner{ padding-top:calc(6px + env(safe-area-inset-top, 0px)) !important; padding-bottom:8px !important; }
        body.google-nav #gNavTopInstr{ font-size:18px !important; -webkit-line-clamp:1 !important; }
        body.google-nav #gNavNextBanner{ top:calc(68px + env(safe-area-inset-top, 0px)) !important; }
        body.google-nav #gNavBottomSheet{ padding-bottom:8px !important; }
        body.google-nav #gNavRightControls{ bottom:calc(96px + env(safe-area-inset-bottom, 0px)) !important; }
      }
    `;
    document.head.appendChild(st);
  })();

  // --- FIX: Nut tim kiem phai hien kinh lup, khong phai X ---
  (function fixSearchIcon(){
    if(document.getElementById('searchIconFix')) return;
    const st = document.createElement('style');
    st.id = 'searchIconFix';
    st.textContent = `
      /* Nut tim kiem trong Google Nav: luon la kinh lup, khong phai X */
      #gNavSearchBtn{ color:#3C4043 !important; }
      #gNavSearchBtn svg{ display:block !important; }
      /* Nut X chi dung de xoa chu trong o tim kiem, khong dung lam nut tim kiem */
      #searchClearBtn{ display:none; }
      #searchClearBtn:not(.hidden){ display:flex !important; }
      /* O tim kiem tren: icon trai luon la kinh lup */
      .floating-search .search-icon, .floating-search .fa-search{ display:flex !important; }
    `;
    document.head.appendChild(st);
    const LUP = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3c4043" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>';
    const fixBtn = ()=>{
      try{
        const b = document.getElementById('gNavSearchBtn');
        if(b){
          const html = (b.innerHTML||'').trim();
          // Neu nut dang la X (✕ / ×) hoac trong rong (nut trang) thi tra ve kinh lup
          if(html === '✕' || html === '×' || html === 'X' || html === '' || html.includes('✕') && !html.includes('circle')){
            b.innerHTML = LUP;
            b.title = 'Tìm kiếm';
          }
          // Dam bao SVG kinh lup luon co
          if(!b.innerHTML.includes('circle')) b.innerHTML = LUP;
        }
        // Nut X trong o tim kiem: chi hien khi co chu, khong hien khi o trong
        const inp = document.getElementById('topSearchInput');
        const clr = document.getElementById('searchClearBtn');
        if(inp && clr){
          if(!inp.value || !inp.value.trim()) clr.classList.add('hidden');
        }
      }catch(e){}
    };
    fixBtn(); setTimeout(fixBtn, 800); setTimeout(fixBtn, 2000);
    try{ let _fT=false; const _fObs=new MutationObserver(()=>{ if(_fT) return; _fT=true; requestAnimationFrame(()=>{ _fT=false; try{ fixBtn(); }catch(e){} }); }); _fObs.observe(document.body, { attributes:true, attributeFilter:['class'] }); }catch(e){} /* [FIX TREO] fixBtn: bo subtree, chi nghe class body + throttle rAF */
    window.fixSearchIcon = fixBtn;
  })();

  // --- FINAL: An search khi dang dan duong - chay sau tat ca, uu tien cao nhat ---
  (function hideSearchInNavFinal(){
    if(document.getElementById('hideSearchInNavFinal')) return;
    const st = document.createElement('style');
    st.id = 'hideSearchInNavFinal';
    st.textContent = `body.google-nav .floating-search, body.google-nav #searchBar, body.google-nav .search-bar, body.google-nav #suggestionsBox.show{ display:none !important; } body.google-nav .floating-search.show-in-nav{ display:none !important; }`;
    document.head.appendChild(st);
    const hide = ()=>{ if(document.body.classList.contains('google-nav')){ const fs=document.querySelector('.floating-search'); if(fs){ fs.classList.remove('show-in-nav'); fs.style.display='none'; } const sb=document.getElementById('suggestionsBox'); if(sb) sb.classList.remove('show'); } };
    hide(); setTimeout(hide, 500); setTimeout(hide, 1500);
    try{ new MutationObserver(hide).observe(document.body, { attributes:true, attributeFilter:['class'] }); }catch(e){}
    // Khi bat dau dan duong Google thi an search ngay
    try{ const _origAct = window.activateGoogleNav; }catch(e){}
  })();

  // --- MINIMAP KHUNG NHO KEO THA TU DO: boc minimap vao khung, keo khung = di chuyen minimap ---
/* [CLEANUP] minimapFrameDrag - da xoa, minimap da bo */

  // --- FIX MINIMAP: bo chu che map + an label cu neu con ---
/* [CLEANUP] fixMinimapLabel - da xoa, minimap da bo */

  // --- FIX NUT DE NHAU: trai chi 1 nut Ve giua, phai 1 cot, khong de chong ---
  (function fixOverlappingBtns(){
    if(document.getElementById('btnOverlapFix20261122')) return;
    const st = document.createElement('style');
    st.id = 'btnOverlapFix20261122';
    st.textContent = `
      /* Google Nav: an stack trai cu (chua compass + Ve giua trung) - chi giu 1 nut Ve giua rieng */
      body.google-nav #gNavLeftStack{ display:none !important; }
      body.google-nav #gNavRecenterBtn{ left:12px !important; bottom:calc(118px + env(safe-area-inset-bottom, 0px)) !important; z-index:801 !important; }
      /* Cot phai: 1 cot duy nhat, cach deu, khong de len bottom sheet */
      body.google-nav #gNavRightControls{ right:12px !important; bottom:calc(118px + env(safe-area-inset-bottom, 0px)) !important; gap:10px !important; z-index:801 !important; }
      /* An cac nut cu con sot lai de trung nhau: btnCompass, btnNavFollow, fab cu */
      body.google-nav #btnCompass, body.google-nav #btnNavFollow, body.google-nav .fab-directions, body.google-nav .fab-locate, body.google-nav .fab-layers, body.google-nav .fab-report, body.google-nav #navControls{ display:none !important; }
      /* Tren mobile: neu co 2 nut Ve giua (1 trong stack + 1 rieng) thi an cai trong stack */
      #gNavLeftStack #gNavRecenterBtn{ display:none !important; }
      @media (max-width: 640px){
        body.google-nav #gNavRecenterBtn{ left:10px !important; bottom:calc(112px + env(safe-area-inset-bottom, 0px)) !important; }
        body.google-nav #gNavRightControls{ right:10px !important; bottom:calc(112px + env(safe-area-inset-bottom, 0px)) !important; }
      }
    `;
    document.head.appendChild(st);
    // Xoa nut Ve giua trung trong stack neu co
    try{
      const dup = document.querySelector('#gNavLeftStack #gNavRecenterBtn');
      if(dup) dup.remove();
    }catch(e){}
  })();

  // --- FIX TOP BAR MOBILE: nut 3 gach bi de len thanh tim kiem ---
  // Nguyen nhan: nut menu dang position:absolute; right:12px; top:12px nam de len .floating-search
  // Fix: dua nut menu VAO TRONG thanh tim kiem, xep flex [icon tim][input flex:1][nut menu 44px], khong de absolute de len nhau
  (function fixTopBarOverlap(){
    function injectTopBarCSS(){
      if(document.getElementById('topBarFix20261122')) return;
      const st = document.createElement('style');
      st.id = 'topBarFix20261122';
      st.textContent = `
        /* Top bar: 1 hang duy nhat, khong de nut nao de len nhau - NHUNG khi dang dan duong thi AN HAN */
        body.google-nav .floating-search{ display:none !important; }
        body:not(.google-nav) .floating-search{
          display:flex !important; align-items:center !important; gap:8px !important;
          flex-wrap:nowrap !important; box-sizing:border-box !important;
          left:12px !important; right:12px !important; width:auto !important;
          top:calc(10px + env(safe-area-inset-top, 0px)) !important;
          padding:6px 6px 6px 12px !important; overflow:hidden !important;
        }
        .floating-search input, .floating-search .search-input, .floating-search [type="text"], .floating-search [type="search"]{
          flex:1 !important; min-width:0 !important; width:auto !important; max-width:none !important;
          white-space:nowrap !important; overflow:hidden !important; text-overflow:ellipsis !important;
          padding-right:0 !important;
        }
        /* Moi nut trong thanh tim kiem: dung static, khong absolute */
        .floating-search button, .floating-search .menu-btn, .floating-search .hamburger, .floating-search [class*="menu"]{
          position:static !important; left:auto !important; right:auto !important; top:auto !important; bottom:auto !important;
          flex-shrink:0 !important; width:44px !important; height:44px !important; min-width:44px !important;
          border-radius:999px !important; display:flex !important; align-items:center !important; justify-content:center !important;
          margin:0 !important; transform:none !important;
        }
        /* Nut 3 gach neu con nam ngoai thanh tim kiem: ep no xuong duoi thanh tim kiem, khong de len */
        body:not(.google-nav) #menuBtn, body:not(.google-nav) .menu-btn:not(.floating-search *), body:not(.google-nav) .hamburger:not(.floating-search *){
          /* se bi JS chuyen vao trong .floating-search, day la fallback neu JS chua chay */
        }
        @media (max-width: 640px){
          .floating-search{ left:10px !important; right:10px !important; padding:5px 5px 5px 10px !important; }
          .floating-search button{ width:42px !important; height:42px !important; min-width:42px !important; }
        }
      `;
      document.head.appendChild(st);
    }
    function findMenuBtn(){
      // Tim nut 3 gach: theo id/class hoac noi dung
      const cands = Array.from(document.querySelectorAll('button, div[role="button"], a'));
      for(const el of cands){
        const cls = (el.className || '') + ' ' + (el.id || '');
        const txt = (el.textContent || '').trim();
        const html = el.innerHTML || '';
        const isMenu = /menu|hamburger|fa-bars|bars/i.test(cls) || txt === '☰' || txt === '≡' || txt === '⋮' || html.includes('fa-bars') || html.includes('fa-ellipsis');
        if(isMenu) return el;
      }
      return null;
    }
    function fixOnce(){
      try{
        injectTopBarCSS();
        // Dang dan duong Google: KHONG hien search, KHONG chuyen nut vao search
        if(document.body.classList.contains('google-nav')){ const fs0 = document.querySelector('.floating-search'); if(fs0){ fs0.classList.remove('show-in-nav'); fs0.style.display='none'; } return; }
        const search = document.querySelector('.floating-search');
        if(!search) return;
        // Neu nut menu dang o NGOAI thanh tim kiem -> chuyen vao trong, de cuoi hang
        const menu = findMenuBtn();
        if(menu && !search.contains(menu)){
          // Chi chuyen khi nut dang o gan dinh (top < 120px) - tranh chuyen nham nut menu o cho khac
          try{
            const r = menu.getBoundingClientRect();
            const sr = search.getBoundingClientRect();
            const isTopOverlap = r.top < 140 && Math.abs(r.top - sr.top) < 40 && r.right > sr.right - 80;
            if(isTopOverlap || r.top < 80){
              search.appendChild(menu);
            }
          }catch(e){ search.appendChild(menu); }
        }
        // Dam bao nut trong search khong con absolute
        search.querySelectorAll('button').forEach(b=>{
          b.style.position = 'static';
          b.style.transform = 'none';
        });
      }catch(e){}
    }
    // Chay ngay + sau khi HTML load xong + theo doi DOM (vi HTML co the tao search bar muon)
    fixOnce();
    document.addEventListener('DOMContentLoaded', fixOnce);
    setTimeout(fixOnce, 500);
    setTimeout(fixOnce, 1500);
    setTimeout(fixOnce, 3000);
    try{
      const obs = new MutationObserver(()=>{ fixOnce(); });
      obs.observe(document.body, { childList:true, subtree:true });
      setTimeout(()=>obs.disconnect(), 8000);
    }catch(e){}
    window.fixTopBarOverlap = fixOnce;
  })();

  // ---- 2. Tao DOM Google Nav ----
  function ensureGoogleNavUI(){
    if(!document.getElementById('gNavTopBanner')){
      const top = document.createElement('div');
      top.id = 'gNavTopBanner';
      top.innerHTML = '<div id="gNavTopArrow">↑</div><div id="gNavTopMain"><div id="gNavTopDist">Đi thẳng</div><div id="gNavTopInstr">Đi về hướng Tây</div></div><button id="gNavTopEndTripBtn" title="Kết thúc chuyến đi">■ Kết thúc</button>';
      document.body.appendChild(top);
    }
    if(!document.getElementById('gNavNextBanner')){
      const nxt = document.createElement('div');
      nxt.id = 'gNavNextBanner';
      nxt.innerHTML = '<span>Sau đó</span><span class="next-arrow">→</span>';
      document.body.appendChild(nxt);
    }
    if(!document.getElementById('gNavBottomSheet')){
      const bot = document.createElement('div');
      bot.id = 'gNavBottomSheet';
      bot.innerHTML = '<div id="gNavBottomHandle"></div><div id="gNavBottomRow"><button id="gNavExitBtn" title="Thu bottom sheet"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3c4043" stroke-width="2.2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button><div id="gNavBottomInfo"><div id="gNavRemainTime">3 phút</div><div id="gNavRemainMeta">900 m • 7:11</div></div><button id="gNavLayerBtn" title="Lớp bản đồ"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="2" stroke-linejoin="round"><path d="M12 3 L21 8 L12 13 L3 8 Z"/><path d="M3 11 L12 16 L21 11"/><path d="M3 15 L12 20 L21 15"/></svg></button></div>';
      document.body.appendChild(bot);
      // X: chi THU bottom sheet xuong, KHONG thoat chi duong
      document.getElementById('gNavExitBtn').onclick = ()=>{
        try{ collapseGoogleBottomSheet(); }catch(e){}
      };
      document.getElementById('gNavLayerBtn').onclick = (e)=>{
        try{
          e.stopPropagation();
          // Mo menu Lop ban do goc (neu co), khong thi doi kieu map truc tiep
          if(typeof window.toggleLayerMenu === 'function'){ window.toggleLayerMenu(); return; }
          const oldBtn = document.getElementById('btnLayerMenu');
          if(oldBtn){ oldBtn.click(); return; }
          if(typeof window.changeLayer === 'function'){
            // fallback: xoay vong 3 kieu: mac dinh -> ve tinh -> giao thong
            const cur = (window._gNavLayerIdx || 0) + 1;
            window._gNavLayerIdx = cur % 3;
            const types = ['trackasia-maplibre', 'satellite', 'trackasia'];
            window.changeLayer(types[window._gNavLayerIdx], null);
          }
        }catch(err){ console.warn('Layer btn loi', err); }
      };
      // Da bo nut Ket thuc - chi dung nut X de thoat
    }
    if(!document.getElementById('gNavRightControls')){
      const rc = document.createElement('div');
      rc.id = 'gNavRightControls';
      rc.innerHTML = '<button class="gNavRoundBtn" id="gNavCompassBtn" title="La bàn"><span class="compass-arrow"><svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 2 L15.5 12 L12 22 L8.5 12 Z" fill="#ea4335"/><path d="M12 22 L15.5 12 L8.5 12 Z" fill="#9aa0a6"/></svg></span></button><button class="gNavRoundBtn" id="gNavSearchBtn" title="Tìm kiếm"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3c4043" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg></button><button class="gNavRoundBtn" id="gNavVoiceBtn" title="Âm thanh"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3c4043" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 L6 9 H3 v6 h3 l5 4 Z" fill="#3c4043" stroke="none"/><path d="M15.5 8.5 a5 5 0 0 1 0 7"/><path d="M18.5 5.5 a9 9 0 0 1 0 13"/></svg></button><button class="gNavRoundBtn" id="gNavRoutesBtn" title="Tuyến khác"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="2" stroke-linecap="round"><path d="M6 4 v4 a4 4 0 0 0 4 4 h1 a4 4 0 0 1 4 4 v4"/><path d="M18 4 v2 a4 4 0 0 1-4 4"/><circle cx="6" cy="4" r="1.8" fill="#1a73e8" stroke="none"/><circle cx="18" cy="4" r="1.8" fill="#1a73e8" stroke="none"/><circle cx="15" cy="20" r="1.8" fill="#1a73e8" stroke="none"/></svg></button><button class="gNavRoundBtn" id="gNavPoiWarnBtn" title="POI cảnh báo"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L22 20 H2 Z" fill="#fef3c7"/><line x1="12" y1="10" x2="12" y2="14"/><circle cx="12" cy="17" r="1" fill="#ea580c" stroke="none"/></svg></button><button class="gNavRoundBtn" id="gNavPoiPublicBtn" title="POI công cộng"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 a6 6 0 0 1 6 6 c0 5 -6 10 -6 10 S6 13 6 8 a6 6 0 0 1 6-6 Z" fill="#d1fae5"/><circle cx="12" cy="8" r="2.2"/></svg></button>';
      document.body.appendChild(rc);
      document.getElementById('gNavCompassBtn').onclick = ()=>{
        try{ if(typeof window.recenterToRouteView === 'function') window.recenterToRouteView(); else { navFollowMode = 'first-person'; if(lastUserPos) updateNavCamera(lastUserPos, lastUserPos.heading || 0); hideRecenterBtn(); } }catch(e){}
      };
      document.getElementById('gNavSearchBtn').onclick = ()=>{
        // [BAT BUOC] Dang dan duong: khoa search - khong mo o tim kiem
        try{ if(typeof showCustomToast === 'function') showCustomToast('Đang dẫn đường - tìm kiếm tạm khóa', 'info'); }catch(e){}
      };
      document.getElementById('gNavVoiceBtn').onclick = (e)=>{
        try{
          const btn = e.currentTarget;
          voiceEnabled = !voiceEnabled;
          btn.innerHTML = voiceEnabled
            ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3c4043" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 L6 9 H3 v6 h3 l5 4 Z" fill="#3c4043" stroke="none"/><path d="M15.5 8.5 a5 5 0 0 1 0 7"/><path d="M18.5 5.5 a9 9 0 0 1 0 13"/></svg>'
            : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 L6 9 H3 v6 h3 l5 4 Z" fill="#9aa0a6" stroke="none"/><line x1="16" y1="9" x2="22" y2="15"/><line x1="22" y1="9" x2="16" y2="15"/></svg>';
          btn.style.opacity = voiceEnabled ? '1' : '0.6';
        }catch(err){}
      };
      document.getElementById('gNavRoutesBtn').onclick = ()=>{
        try{ if(typeof window.openAlternativeRoutes === 'function') window.openAlternativeRoutes(); }catch(e){}
      };
      // POI canh bao: mo modal Bao cao (canh bao toc do, cam, chan duong...)
      try{ const wb = document.getElementById('gNavPoiWarnBtn'); if(wb) wb.onclick = ()=>{ try{ if(typeof window.openReportMenu === 'function') window.openReportMenu(); else if(typeof showCustomToast === 'function') showCustomToast('Mở báo cáo cảnh báo', 'info'); }catch(e){} }; }catch(e){}
      // POI cong cong: mo sheet Them dia diem moi tai vi tri hien tai
      try{ const pb = document.getElementById('gNavPoiPublicBtn'); if(pb) pb.onclick = ()=>{ try{ let la=0, ln=0; if(typeof lastUserPos !== 'undefined' && lastUserPos){ la = lastUserPos.lat; ln = lastUserPos.lng; } else if(map){ const c = map.getCenter(); la = c.lat; ln = c.lng; } if(typeof window.openPoiSheet === 'function') window.openPoiSheet(la, ln, 'Vị trí hiện tại'); }catch(e){} }; }catch(e){}
    }
    if(!document.getElementById('gNavRecenterBtn')){
      const rb = document.createElement('button');
      rb.id = 'gNavRecenterBtn';
      rb.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0F766E" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.6" fill="#0F766E" stroke="none"/><path d="M12 1 v3 M12 20 v3 M1 12 h3 M20 12 h3"/></svg><span>Về giữa</span>';
      rb.onclick = ()=>{
        try{ if(typeof window.recenterToRouteView === 'function') window.recenterToRouteView(); else { navFollowMode = 'first-person'; if(lastUserPos) updateNavCamera(lastUserPos, lastUserPos.heading || 0); hideRecenterBtn(); } }catch(e){}
      };
      document.body.appendChild(rb);
    }
    // Luon dam bao nut mui ten + nut Ket thuc co mat (ca khi DOM da co tu truoc)
    try{ ensureBottomExpandBtn(); }catch(e){}
    try{ ensureTopEndTripBtn(); }catch(e){}
    try{ patchExistingGoogleNav(); }catch(e){}
  }
  function showGoogleNavUI(){ ensureGoogleNavUI(); try{ patchExistingGoogleNav(); }catch(e){} try{ bindBottomSheetDrag(); }catch(e){} ['gNavTopBanner','gNavNextBanner','gNavBottomSheet','gNavRightControls'].forEach(id=>{ const el=document.getElementById(id); if(el) el.classList.add('show'); }); try{ const bot=document.getElementById('gNavBottomSheet'); if(bot) bot.classList.remove('collapsed'); const exp=document.getElementById('gNavBottomExpandBtn'); if(exp) exp.classList.remove('show'); const rc=document.getElementById('gNavRightControls'); if(rc) rc.style.bottom=''; }catch(e){} }
  function hideGoogleNavUI(){ ['gNavTopBanner','gNavNextBanner','gNavBottomSheet','gNavRightControls','gNavRecenterBtn','gNavBottomExpandBtn'].forEach(id=>{ const el=document.getElementById(id); if(el) el.classList.remove('show'); }); try{ const bot=document.getElementById('gNavBottomSheet'); if(bot) bot.classList.remove('collapsed'); const rc=document.getElementById('gNavRightControls'); if(rc) rc.style.bottom=''; }catch(e){} }
  function showRecenterBtn(){ const el=document.getElementById('gNavRecenterBtn'); if(el) el.classList.add('show'); }
  function hideRecenterBtn(){ const el=document.getElementById('gNavRecenterBtn'); if(el) el.classList.remove('show'); }
  // --- Bottom sheet MOBILE: keo vuot de thu / mo ---
  function bindBottomSheetDrag(){
    const bot = document.getElementById('gNavBottomSheet');
    if(!bot || bot._dragBound) return;
    bot._dragBound = true;
    let startY = 0, curY = 0, dragging = false;
    const onStart = (e)=>{ const y = e.touches ? e.touches[0].clientY : e.clientY; startY = y; curY = y; dragging = true; bot.style.transition = 'none'; };
    const onMove = (e)=>{ if(!dragging) return; const y = e.touches ? e.touches[0].clientY : e.clientY; curY = y; const dy = Math.max(0, y - startY); bot.style.transform = 'translateY(' + dy + 'px)'; };
    const onEnd = ()=>{ if(!dragging) return; dragging = false; bot.style.transition = ''; bot.style.transform = ''; const dy = curY - startY; if(dy > 60) collapseGoogleBottomSheet(); else expandGoogleBottomSheet(); };
    const handle = document.getElementById('gNavBottomHandle');
    const target = handle || bot;
    target.addEventListener('touchstart', onStart, { passive:true });
    target.addEventListener('touchmove', onMove, { passive:true });
    target.addEventListener('touchend', onEnd);
    if(handle) handle.addEventListener('click', ()=>{ const isCollapsed = bot.classList.contains('collapsed'); if(isCollapsed) expandGoogleBottomSheet(); else collapseGoogleBottomSheet(); });
  }
  // --- Bottom sheet: X thu xuong / mui ten keo len ---
  function collapseGoogleBottomSheet(){
    const bot = document.getElementById('gNavBottomSheet');
    if(bot) bot.classList.add('collapsed');
    const exp = document.getElementById('gNavBottomExpandBtn');
    if(exp) exp.classList.add('show');
    // Khi thu bottom sheet thi day RightControls xuong thap hon 1 chut cho khoi trong
    try{ const rc = document.getElementById('gNavRightControls'); if(rc) rc.style.bottom = 'calc(88px + env(safe-area-inset-bottom, 0px))'; }catch(e){}
  }
  function expandGoogleBottomSheet(){
    const bot = document.getElementById('gNavBottomSheet');
    if(bot) bot.classList.remove('collapsed');
    const exp = document.getElementById('gNavBottomExpandBtn');
    if(exp) exp.classList.remove('show');
    try{ const rc = document.getElementById('gNavRightControls'); if(rc) rc.style.bottom = ''; }catch(e){}
  }
  window.collapseGoogleBottomSheet = collapseGoogleBottomSheet;
  window.expandGoogleBottomSheet = expandGoogleBottomSheet;
  // Tao nut mui ten mo lai bottom sheet (chi tao 1 lan)
  function ensureBottomExpandBtn(){
    if(document.getElementById('gNavBottomExpandBtn')) return;
    const b = document.createElement('button');
    b.id = 'gNavBottomExpandBtn';
    b.title = 'Mở lại bottom sheet';
    b.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3c4043" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 15 12 9 18 15"/></svg>';
    b.onclick = ()=>{ expandGoogleBottomSheet(); };
    document.body.appendChild(b);
  }
  // Gan nut Ket thuc tren banner xanh (ca DOM moi lan DOM cu da co tu truoc)
  function ensureTopEndTripBtn(){
    const btn = document.getElementById('gNavTopEndTripBtn');
    if(!btn){
      const top = document.getElementById('gNavTopBanner');
      if(top){
        const b = document.createElement('button');
        b.id = 'gNavTopEndTripBtn';
        b.title = 'Kết thúc chuyến đi';
        b.textContent = '■ Kết thúc';
        top.appendChild(b);
      }
    }
    const b2 = document.getElementById('gNavTopEndTripBtn');
    if(b2 && !b2._wired){
      b2._wired = true;
      b2.onclick = (e)=>{ try{ e.stopPropagation(); if(typeof window.openEndTripModal === 'function') window.openEndTripModal(); }catch(err){} };
    }
  }
  // Patch X cu neu DOM da co tu ban truoc (ensureGoogleNavUI khong tao lai)
  function patchExistingGoogleNav(){
    try{
      const bot0 = document.getElementById('gNavBottomSheet');
      if(bot0 && !document.getElementById('gNavBottomHandle')){
        const h = document.createElement('div'); h.id = 'gNavBottomHandle'; bot0.insertBefore(h, bot0.firstChild);
      }
      try{ bindBottomSheetDrag(); }catch(e){}
      const x = document.getElementById('gNavExitBtn');
      if(x && !x._wiredCollapse){ x._wiredCollapse = true; x.title = 'Thu bottom sheet'; x.onclick = ()=>{ collapseGoogleBottomSheet(); }; }
    }catch(e){}
    ensureBottomExpandBtn();
    ensureTopEndTripBtn();
  }
  ensureGoogleNavUI();

  // ---- 3. Helpers: mui ten + format kieu Google ----
  function gArrowFor(maneuver){
    if(!maneuver) return '↑';
    const type = (maneuver.type || '').toLowerCase();
    const mod = (maneuver.modifier || '').toLowerCase();
    const instr = (maneuver.instruction || '').toLowerCase();
    // Den noi
    if(type.includes('arrive') || instr.includes('đến') || instr.includes('arrive') || instr.includes('destination')) return '⚑';
    // Quay dau / di lui - uturn phai check TRUOC left/right vi 'uturn right' chua 'right'
    if(mod.includes('uturn') || type.includes('uturn') || instr.includes('quay đầu') || instr.includes('u-turn') || instr.includes('u turn')) return mod.includes('left') ? '↩' : '↪';
    if(instr.includes('lùi') || instr.includes('reverse')) return '↓';
    if(type.includes('roundabout') || instr.includes('vòng xuyến') || instr.includes('roundabout')) return '↻';
    // Re nhe / ngoat
    if(mod.includes('slight left') || instr.includes('chếch sang trái')) return '↰';
    if(mod.includes('slight right') || instr.includes('chếch sang phải')) return '↱';
    if(mod.includes('sharp left') || instr.includes('ngoặt sang trái')) return '⬅';
    if(mod.includes('sharp right') || instr.includes('ngoặt sang phải')) return '➡';
    // Giu lan
    if(instr.includes('bám bên trái') || mod.includes('keep left')) return '↖';
    if(instr.includes('bám bên phải') || mod.includes('keep right')) return '↗';
    // Re trai / phai
    if(mod.includes('left') || type.includes('left') || instr.includes('rẽ trái')) return '←';
    if(mod.includes('right') || type.includes('right') || instr.includes('rẽ phải')) return '→';
    // Di thang / tiep tuc
    if(type.includes('continue') || type.includes('straight') || type.includes('depart') || instr.includes('đi thẳng') || instr.includes('tiếp tục')) return '↑';
    if(type.includes('turn') || type.includes('fork') || type.includes('merge') || type.includes('on ramp') || type.includes('off ramp')) return mod.includes('left') ? '←' : (mod.includes('right') ? '→' : '↑');
    return '↑';
  }
  // Text cho banner 'Sau do ...' - ghi bang chu: re trai / re phai / di thang / quay dau / di lui
  function gManeuverText(maneuver){
    // Nhãn ngắn cũng lấy từ dictionary.js
    try{
      if(typeof window !== 'undefined' && window.DRIVEKIT_DICT && typeof window.DRIVEKIT_DICT.maneuverShort === 'function'){
        return window.DRIVEKIT_DICT.maneuverShort(maneuver);
      }
    }catch(e){}
    if(!maneuver) return 'đi thẳng';
    const type = (maneuver.type || '').toLowerCase();
    const mod = (maneuver.modifier || '').toLowerCase();
    const instr = (maneuver.instruction || '').toLowerCase();
    if(type.includes('arrive') || instr.includes('đến') || instr.includes('arrive')) return 'đến nơi';
    if(mod.includes('uturn') || type.includes('uturn') || instr.includes('quay đầu') || instr.includes('u-turn')) return 'quay đầu';
    return 'đi thẳng';
  }
  function gFormatDist(m){
    if(!isFinite(m)) return '--';
    if(m < 1000) return Math.round(m) + ' m';
    return (m/1000).toFixed(1).replace('.', ',') + ' km';
  }
  function gFormatETA(sec){
    try{ const d = new Date(Date.now() + (sec||0)*1000); return d.getHours() + ':' + String(d.getMinutes()).padStart(2,'0'); }catch(e){ return '--:--'; }
  }

  // ---- 4. Cap nhat banner tren + bottom sheet kieu Google ----
  function updateGoogleNavBanner(){
    try{
      if(!voiceRouteSteps || !voiceRouteSteps.length) return;
      let next = null, nextNext = null;
      for(let i=Math.max(0, voiceStepIndex); i<voiceRouteSteps.length; i++){
        const s = voiceRouteSteps[i];
        if(s && s.maneuver && s.maneuver.location){ if(!next) next = s; else { nextNext = s; break; } }
      }
      if(!next) return;
      // Khoang cach toi cho re
      let distToTurn = Infinity;
      try{ if(lastUserPos) distToTurn = calcDist(lastUserPos.lat, lastUserPos.lng, next.maneuver.location[1], next.maneuver.location[0]); }catch(e){}
      const arrowEl = document.getElementById('gNavTopArrow');
      if(arrowEl) arrowEl.textContent = gArrowFor(next.maneuver);
      const distEl = document.getElementById('gNavTopDist');
      if(distEl) distEl.textContent = isFinite(distToTurn) ? gFormatDist(distToTurn) : '';
      const instrEl = document.getElementById('gNavTopInstr');
      if(instrEl){
        let txt = next.maneuver.instruction || 'Tiếp tục di chuyển';
        try{ if(typeof translateFallback === 'function') txt = translateFallback(txt); }catch(e){}
        // Google viet gon: "về hướng Hẻm 134..." thay vi "Rẽ trái vào..."
        instrEl.textContent = txt;
      }
      // Banner Sau do
      const nextBanner = document.getElementById('gNavNextBanner');
      if(nextBanner){
        if(nextNext){
          nextBanner.innerHTML = '<span>Sau đó ' + gManeuverText(nextNext.maneuver) + '</span><span class="next-arrow">' + gArrowFor(nextNext.maneuver) + '</span>';
          nextBanner.classList.add('show');
        } else {
          nextBanner.classList.remove('show');
        }
      }
    }catch(e){}
  }
  function updateGoogleBottomSheet(remainDist, remainSec){
    try{
      const timeEl = document.getElementById('gNavRemainTime');
      if(timeEl){
        const mins = Math.max(1, Math.round((remainSec||0)/60));
        timeEl.textContent = mins + ' phút';
      }
      const metaEl = document.getElementById('gNavRemainMeta');
      if(metaEl) metaEl.textContent = gFormatDist(remainDist) + ' • ' + gFormatETA(remainSec);
    }catch(e){}
  }
  // Ghi de updateNextManeuverHUD + updateRemainingHUD de cap nhat ca Google HUD
  try{
    const _origNext = updateNextManeuverHUD;
    updateNextManeuverHUD = function(lat, lng){
      const r = _origNext.apply(this, arguments);
      if(document.body.classList.contains('google-nav')) updateGoogleNavBanner();
      return r;
    };
  }catch(e){}
  try{
    const _origRemain = updateRemainingHUD;
    updateRemainingHUD = function(){
      const r = _origRemain.apply(this, arguments);
      try{
        if(document.body.classList.contains('google-nav') && lastUserPos && currentRouteCoords && currentRouteCoords.length){
          let remainDist = calcDist(lastUserPos.lat, lastUserPos.lng, currentRouteCoords[0][0], currentRouteCoords[0][1]);
          for(let i=0;i<currentRouteCoords.length-1;i++) remainDist += calcDist(currentRouteCoords[i][0], currentRouteCoords[i][1], currentRouteCoords[i+1][0], currentRouteCoords[i+1][1]);
          let speed = (typeof smoothedSpeed !== 'undefined' ? smoothedSpeed*3.6 : 0);
          if(speed < 10){
            const td = (currentRouteData && currentRouteData.distance) || 1;
            const tu = (currentRouteData && currentRouteData.duration) || 1;
            speed = (td/1000) / (tu/3600); if(speed < 10) speed = 30;
          }
          const remainSec = remainDist / (speed/3.6);
          updateGoogleBottomSheet(remainDist, remainSec);
          updateGoogleNavBanner();
        }
      }catch(err){}
      return r;
    };
  }catch(e){}

  // ---- 5. Camera kieu Google: nghieng 55, dau huong len, user o 1/3 duoi ----
  // Helper: bearing cua duong xanh phia truoc (thay vi heading GPS bi lech ngang)
  function getRouteBearingAhead(pos){
    try{
      if(!currentRouteCoords || currentRouteCoords.length < 2) return null;
      // Tim diem gan nhat tren duong xanh
      let bestIdx = (typeof lastSnapIndex === 'number' ? lastSnapIndex : 0), bestD = Infinity;
      const s = Math.max(0, bestIdx - 5), e = Math.min(currentRouteCoords.length - 1, bestIdx + 60);
      for(let i=s;i<=e;i++){
        const d = calcDist(pos.lat, pos.lng, currentRouteCoords[i][0], currentRouteCoords[i][1]);
        if(d < bestD){ bestD = d; bestIdx = i; }
      }
      // [FIX v9 - video] Bearing cua doan NGAY DUOI CHAN (snap -> snap+1), khong lay +80m
      // Vi +80m nhay qua cua 90 do -> bearing cheo 45 do nhu video. Doan ngay duoi chan moi lam duong xanh thang dung.
      let aheadIdx = Math.min(bestIdx + 1, currentRouteCoords.length - 1);
      // Neu doan nay qua ngan (<8m, do Valhalla chia nho), moi lay them toi 30m, khong lay 80m
      let acc = calcDist(currentRouteCoords[bestIdx][0], currentRouteCoords[bestIdx][1], currentRouteCoords[aheadIdx][0], currentRouteCoords[aheadIdx][1]);
      while(aheadIdx < currentRouteCoords.length - 1 && acc < 8){
        aheadIdx++;
        acc += calcDist(currentRouteCoords[aheadIdx-1][0], currentRouteCoords[aheadIdx-1][1], currentRouteCoords[aheadIdx][0], currentRouteCoords[aheadIdx][1]);
        if(acc >= 30) break;
      }
      if(aheadIdx === bestIdx) return null;
      // [FIX Claude] Bearing tu doan da SNAP (lastSnapIndex -> +80m), khong tu GPS tho (GPS lech -> nhin ngang)
      const _curPt = currentRouteCoords[bestIdx]; // [lat, lng]
      const _aheadPt = currentRouteCoords[aheadIdx];
      const lat1 = _curPt[0] * Math.PI/180, lat2 = _aheadPt[0] * Math.PI/180;
      const dLng = (_aheadPt[1] - _curPt[1]) * Math.PI/180;
      const y = Math.sin(dLng) * Math.cos(lat2);
      const x = Math.cos(lat1)*Math.sin(lat2) - Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLng);
      let br = Math.atan2(y, x) * 180/Math.PI;
      return (br + 360) % 360;
    }catch(e){ return null; }
  }
  window.getRouteBearingAhead = getRouteBearingAhead;
  // Ham Ve giua: tra ve GPS + nhin DOC duong xanh (khong nhin ngang mui ten)
  window.recenterToRouteView = function(){
    try{
      navFollowMode = 'first-person';
      _isUserDraggingMap = false;
      if(map) map.stop();
      if(lastUserPos){
        const rb = getRouteBearingAhead(lastUserPos);
        const useBearing = (rb !== null && rb !== undefined) ? rb : (lastUserPos.heading || 0);
        const isMobile = window.innerWidth <= 640;
        const off = isMobile ? [0, window.innerHeight * 0.16] : [0, 110];
        map.easeTo({ center:[lastUserPos.lng, lastUserPos.lat], bearing: useBearing, pitch:0, zoom: Math.max(map.getZoom(), 17.5), offset: [0, 0], duration:500, essential:true });
        const comp2 = document.querySelector('#gNavCompassBtn .compass-arrow');
        if(comp2) comp2.style.transform = 'rotate(' + (-useBearing) + 'deg)';
      }
      if(typeof hideRecenterBtn === 'function') hideRecenterBtn();
    }catch(e){}
  };
  try{
    updateNavCamera = function(pos, heading){
      if(!isNavigating || navFollowMode !== 'first-person' || !map) return;
      try{
        if(_isUserDraggingMap) return;
        const nowC2 = Date.now();
        if(nowC2 - _lastCamAt < 350) return;
        // [FIX] Bearing = huong duong xanh phia truoc, khong dung heading GPS (hay bi lech ngang khi dung yen / GPS nhieu)
        const routeBr = getRouteBearingAhead(pos);
        const useBearing = (routeBr !== null && routeBr !== undefined) ? routeBr : (heading || 0);
        try{
          const cc = map.getCenter();
          const dd = calcDist(cc.lat, cc.lng, pos.lat, pos.lng);
          const bd = Math.abs(((map.getBearing()||0) - useBearing + 540) % 360 - 180);
          if(dd < 15 && bd < 12 && map.getPitch() > 40) return;
        }catch(e){}
        _lastCamAt = nowC2;
        const isMobile2 = window.innerWidth <= 640;
        const off2 = isMobile2 ? [0, window.innerHeight * 0.16] : [0, 110];
        map.easeTo({ center:[pos.lng, pos.lat], bearing: useBearing, pitch:0, zoom: Math.max(map.getZoom(), 17.5), offset: [0, 0], duration:350, essential:false });
        const comp = document.querySelector('#gNavCompassBtn .compass-arrow');
        if(comp) comp.style.transform = 'rotate(' + (-useBearing) + 'deg)';
      }catch(e){}
    };
  }catch(e){ /* patch warn removed */; }
  // [FIX] Xoay tu do: keo / xoay / nghien map -> chuyen sang free, khong giat camera lai. Chi khi bam Ve giua moi quay ve doc duong.
  try{
    if(map){
      const toFree = ()=>{ if(isNavigating){ navFollowMode = 'free'; if(typeof showRecenterBtn === 'function') showRecenterBtn(); } };
      map.on('rotatestart', toFree);
      map.on('pitchstart', toFree);
      map.on('dragstart', toFree);
    }
  }catch(e){}

  // ---- 6. Cham user kieu Google: cham xanh duong, khong phai mui ten xanh la ----
  try{
    const _origUserMarkerGoogle = updateUserMarkerOnMap;
    updateUserMarkerOnMap = function(pos, heading){
      const isGoogle = document.body.classList.contains('google-nav');
      if(!isGoogle) return _origUserMarkerGoogle(pos, heading);
      // Google mode: cham xanh duong
      const lngLat = [pos.lng, pos.lat];
      if(!userMarker){
        const el = document.createElement('div');
        el.className = 'g-user-dot-wrap';
        el.innerHTML = '<div class="g-user-dot"></div>';
        userMarker = new maplibregl.Marker({ element: el, anchor:'center' }).setLngLat(lngLat).addTo(map);
      } else {
        userMarker.setLngLat(lngLat);
        // Doi inner thanh cham xanh neu dang la mui ten cu
        const wrap = userMarker.getElement();
        if(wrap && !wrap.querySelector('.g-user-dot')){
          wrap.className = 'g-user-dot-wrap';
          wrap.innerHTML = '<div class="g-user-dot"></div>';
        }
      }
      // Vong tron accuracy: nho, xanh duong, cap 30m khi dan duong (khong de vong xanh to nhu anh 1)
      try{
        const acc = Math.min(pos.accuracy || 10, 30);
        gpsCircleGeoJSON = createCircleGeoJSON(pos.lng, pos.lat, acc);
        if(map.getSource('gps-circle-source')){
          map.getSource('gps-circle-source').setData(gpsCircleGeoJSON);
          // Doi mau vong tron sang xanh duong kieu Google
          try{
            if(map.getLayer('gps-circle-layer')) map.setPaintProperty('gps-circle-layer', 'fill-color', '#1a73e8');
            if(map.getLayer('gps-circle-layer')) map.setPaintProperty('gps-circle-layer', 'fill-opacity', 0.12);
            if(map.getLayer('gps-circle-outline')) map.setPaintProperty('gps-circle-outline', 'line-color', '#1a73e8');
          }catch(err){}
        }
      }catch(err){}
      // Camera theo kieu Google
      if(navFollowMode === 'first-person') updateNavCamera(pos, heading || 0);
    };
  }catch(e){ /* patch warn removed */; }
  // AnimateMarkerTo trong Google mode: cung dung cham xanh, khong xoay mui ten
  try{
    const _origAnimateGoogle = animateMarkerTo;
    animateMarkerTo = function(targetPos){
      if(!document.body.classList.contains('google-nav')) return _origAnimateGoogle(targetPos);
      // Google: snap dung tren duong xanh, khong offset, khong xoay
      if(!userMarker){ updateUserMarkerOnMap(targetPos, targetPos.heading); return; }
      let snappedLat = targetPos.lat, snappedLng = targetPos.lng;
      if(currentRouteCoords && currentRouteCoords.length > 1 && lastSnapIndex < currentRouteCoords.length - 1){
        let minDist = Infinity, bestPoint = null;
        const startScan = Math.max(0, lastSnapIndex - 5);
        const endScan = Math.min(currentRouteCoords.length - 1, lastSnapIndex + 50);
        for(let i=startScan;i<endScan;i++){
          const pt = getClosestPointOnSegment({ lat: targetPos.lat, lng: targetPos.lng }, { lat: currentRouteCoords[i][0], lng: currentRouteCoords[i][1] }, { lat: currentRouteCoords[i+1][0], lng: currentRouteCoords[i+1][1] });
          const d = calcDist(targetPos.lat, targetPos.lng, pt.lat, pt.lng);
          if(d < minDist){ minDist = d; bestPoint = pt; if(i > lastSnapIndex) lastSnapIndex = i; }
        }
        if(bestPoint && minDist < 40){ snappedLat = bestPoint.lat; snappedLng = bestPoint.lng; }
      }
      userMarker.setLngLat([snappedLng, snappedLat]);
      try{
        const acc = Math.min(targetPos.accuracy || 10, 30);
        gpsCircleGeoJSON = createCircleGeoJSON(snappedLng, snappedLat, acc);
        if(map.getSource('gps-circle-source')) map.getSource('gps-circle-source').setData(gpsCircleGeoJSON);
      }catch(e){}
    };
  }catch(e){ /* patch warn removed */; }

  // ---- 7. Duong xanh day + vien trang kieu Google ----
  try{
    const _origDrawGoogle = drawCurrentRoute;
    drawCurrentRoute = function(){
      const r = _origDrawGoogle.apply(this, arguments);
      try{
        if(!map || !document.body.classList.contains('google-nav')) return r;
        // Them lop vien trang duoi duong xanh + lam duong day hon
        if(map.getLayer('current-route-layer')){
          map.setPaintProperty('current-route-layer', 'line-width', 10);
          map.setPaintProperty('current-route-layer', 'line-color', '#1a73e8');
        }
        if(!map.getLayer('current-route-casing')){
          if(map.getSource('current-route-source')){
            map.addLayer({ id:'current-route-casing', type:'line', source:'current-route-source', layout:{ 'line-join':'round', 'line-cap':'round' }, paint:{ 'line-color':'#ffffff', 'line-width':14, 'line-opacity':0.9 } }, 'current-route-layer');
          }
        }
      }catch(e){}
      return r;
    };
  }catch(e){}

  // ---- 8. Bat / tat Google Nav ----
  function activateGoogleNav(){
    document.body.classList.add('google-nav');
    document.body.classList.add('navigating');
    isNavigating = true;
    navFollowMode = 'first-person';
    // [FIX] Google Nav KHONG xoa minimap - de no hien trong khung nho keo duoc, chi an panel cu
    try{
      const nc = document.getElementById('navControls'); if(nc) nc.style.display = 'none';
      // Dam bao minimap duoc boc vao khung nho keo duoc
      if(typeof window.wrapMinimapFrame === 'function') setTimeout(()=>window.wrapMinimapFrame(), 300);
    }catch(e){}
    // Xoa style an banner cu (V3) de khong anh huong banner moi
    try{ const hs = document.getElementById('hideTopTurnStyle'); if(hs) hs.remove(); }catch(e){}
    showGoogleNavUI();
    // [FIX] Recenter luon hien khi dang dan duong de user luon bam duoc ve GPS + doc duong, khong bi ket o goc tu do
    try{ const _rb = document.getElementById('gNavRecenterBtn'); if(_rb) _rb.classList.add('show'); }catch(e){}
    if(lastUserPos) updateNavCamera(lastUserPos, lastUserPos.heading || 0);
    else if(currentRouteCoords && currentRouteCoords.length){ try{ map.easeTo({ center:[currentRouteCoords[0][1], currentRouteCoords[0][0]], pitch:0, zoom:17.5, offset:[0,110], duration:700 }); }catch(e){} }
    try{ updateGoogleNavBanner(); updateRemainingHUD(); }catch(e){}
    // Khi user keo map thi hien nut Ve giua + dung follow
    try{
      if(map && !map._googleDragBound){
        map._googleDragBound = true;
        // [FIX] Bat cu thao tac tu do nao (keo, xoay 2 ngon, nghien, zoom) deu -> free, khong giat camera lai
        try{
          const _toFree = ()=>{ if(isNavigating){ navFollowMode = 'free'; const _rb2 = document.getElementById('gNavRecenterBtn'); if(_rb2) _rb2.classList.add('show'); } };
          map.on('rotatestart', _toFree);
          map.on('pitchstart', _toFree);
          /* [FIX Claude v8] Bo zoomstart - zoom khong can pha lock */
        }catch(e){}
        // Keo map -> danh dau dang keo, chuyen sang free de camera khong giat lai
  // (ca khi dang dan duong Google lan dan duong thuong)
  map.on('dragstart', ()=>{ _isUserDraggingMap = true; /* [FIX Claude] Bo map.stop() - chi dat co free, khong dung animation */ if(typeof isNavigating !== 'undefined' && isNavigating){ navFollowMode = 'free'; } if(document.body.classList.contains('google-nav')){ navFollowMode = 'free'; showRecenterBtn(); } });
  map.on('movestart', (e)=>{ if(e && e.originalEvent){ _isUserDraggingMap = true; } });
  map.on('touchstart', ()=>{ _isUserDraggingMap = true; });
  map.on('dragend', ()=>{ setTimeout(()=>{ _isUserDraggingMap = false; }, 600); });
  map.on('moveend', ()=>{ setTimeout(()=>{ _isUserDraggingMap = false; }, 600); });
  map.on('touchend', ()=>{ setTimeout(()=>{ _isUserDraggingMap = false; }, 600); });
        map.on('zoomstart', ()=>{ if(document.body.classList.contains('google-nav')){ /* giu follow khi zoom */ } });
      }
    }catch(e){}
  }
  function deactivateGoogleNav(){
    document.body.classList.remove('google-nav');
    document.body.classList.remove('navigating');
    isNavigating = false;
    // [FIX] Thoat han che do follow - de map khong bi giat lai ve goc dan duong
    try{ navFollowMode = 'free'; _isUserDraggingMap = false; }catch(e){}
    hideGoogleNavUI();
    // [FIX] Tra map ve 2D hoan toan: pitch 0, bearing 0 (Bac len tren), zoom ve muc binh thuong, giu center hien tai
    try{
      if(map){
        const c = map.getCenter();
        const curZ = map.getZoom();
        map.stop();
        map.easeTo({ center:[c.lng, c.lat], pitch:0, bearing:0, zoom: Math.min(curZ, 15), offset:[0,0], duration:600, essential:true });
      }
    }catch(e){}
    // [FIX] Tra lai nut binh thuong (FAB trai/phai) - updateUIState bi bo quen nen nut bien mat sau search / sau thoat tuyen
    try{ if(typeof updateUIState === 'function') updateUIState(); }catch(e){}
    try{
      // Ep hien lai cac FAB binh thuong neu updateUIState khong hien (do suggestionsBox con show)
      const sb = document.getElementById('suggestionsBox'); if(sb) sb.classList.remove('show');
      const ids = ['mainLocateBtn','mainDirBtn','btnLayerMenu','btnQuickPin','btnReport','btnRestStopFilter','btnNearbySearch'];
      ids.forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display='flex'; });
      const searchBar = document.getElementById('searchBar'); if(searchBar) searchBar.classList.remove('hidden');
      const menuBtn = document.getElementById('mainMenuBtn'); if(menuBtn) menuBtn.classList.remove('hidden');
    }catch(e){}
    // Tra lai vong tron xanh la + duong cu
    try{
      if(map.getLayer('gps-circle-layer')) map.setPaintProperty('gps-circle-layer', 'fill-color', '#10b981');
      if(map.getLayer('current-route-casing')) map.removeLayer('current-route-casing');
    }catch(e){}
    if(whiteArrowMarker){ try{ whiteArrowMarker.remove(); }catch(e){} whiteArrowMarker = null; }
    if(whiteArrowAheadMarker){ try{ whiteArrowAheadMarker.remove(); }catch(e){} whiteArrowAheadMarker = null; }
  }
  // Ghi de cac ham bat dau dan duong cu
  try{
    const _origStartHUD = startNavigationHUD;
    startNavigationHUD = function(){
      const r = _origStartHUD.apply(this, arguments);
      activateGoogleNav();
      return r;
    };
  }catch(e){}
  try{
    autoFirstPerson = function(){
      if(!map) return;
      activateGoogleNav();
    };
  }catch(e){}
  try{
    window.startNavigationMode = function(){ activateGoogleNav(); setTimeout(()=>{ try{ updateWhiteTurnArrow(); }catch(e){} }, 500); };
    window.stopNavigationMode = function(){ deactivateGoogleNav(); };
  }catch(e){}
  // Theo doi body.navigating (app goc) -> tu bat Google Nav
  try{
    const _gObs = new MutationObserver((muts)=>{
      for(const m of muts){
        if(m.attributeName === 'class'){
          const isNav = document.body.classList.contains('navigating');
          if(isNav && !document.body.classList.contains('google-nav')) setTimeout(activateGoogleNav, 200);
          else if(!isNav && document.body.classList.contains('google-nav')) deactivateGoogleNav();
        }
      }
    });
    _gObs.observe(document.body, { attributes:true, attributeFilter:['class'] });
  }catch(e){}
  // Ghi de ensureNavMinimap de khong hien minimap trong Google mode
  try{
    ensureNavMinimap = function(){ if(document.body.classList.contains('google-nav')) return; };
    if(typeof ensureNavMinimapPassive !== 'undefined') ensureNavMinimapPassive = function(){ if(document.body.classList.contains('google-nav')) return; };
  }catch(e){}
})();


/* ============================================================
   [FIX 2026-11-21] MUI TEN TRANG TREN DUONG XANH - TRANG TINH, KHONG PHAI XANH NHAT
   - Loi cu: mui ten dung hinh doc (48x48), fill trang nhung opacity 0.95 + nam dung tai giao lo
     nen nhin bi xanh nhat do duong xanh phia duoi hien qua + bi de boi vien trang cua route
   - Fix kieu Google trong anh: mui ten NAM NGANG, BEO, nam TREN duong xanh, ngay SAU cho re
     fill #FFFFFF 100% (khong opacity), vien xanh dam #1A73E8, dau mui ten chi vao huong sau khi re
   ============================================================ */
(function(){
  // ---- 1. Mui ten trang moi: nam ngang, beo, trang tinh ----
  function makeWhiteArrowGoogleEl(w, h){
    const el = document.createElement('div');
    // Kich thuoc that: rong x cao, khong phai vuong - giong Google: dai, beo, nam tren duong
    el.style.cssText = 'width:'+w+'px;height:'+h+'px;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));line-height:0;';
    // SVG nam ngang, chi sang phai (bearing 90) mac dinh. Fill TRANG 100%, khong opacity, khong xanh nhat.
    el.innerHTML = '<svg width="'+w+'" height="'+h+'" viewBox="0 0 72 36" fill="none" xmlns="http://www.w3.org/2000/svg">'
      + '<path d="M3 12 L38 12 L38 4 L69 18 L38 32 L38 24 L3 24 Z" fill="#FFFFFF" stroke="#1A73E8" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>'
      + '</svg>';
    return el;
  }
  try{ makeWhiteArrowEl = function(size, opacity){ return makeWhiteArrowGoogleEl(size===44?84:60, size===44?42:30); }; }catch(e){}
  // Xoa mui ten cu de tao lai hinh moi
  try{ if(whiteArrowMarker){ whiteArrowMarker.remove(); whiteArrowMarker=null; } }catch(e){}
  try{ if(whiteArrowAheadMarker){ whiteArrowAheadMarker.remove(); whiteArrowAheadMarker=null; } }catch(e){}

  // ---- 2. Dat mui ten trang dung cho: ngay SAU cho re, nam tren duong xanh ----
  function updateWhiteTurnArrowFixed(){
    if(!map || !isNavigating) return;
    let nextStep = null;
    if(voiceRouteSteps && voiceRouteSteps.length){
      for(let i=voiceStepIndex; i<voiceRouteSteps.length; i++){
        const s = voiceRouteSteps[i];
        if(s && s.maneuver && s.maneuver.location){ nextStep = s; break; }
      }
    }
    if(!nextStep){
      if(whiteArrowMarker){ try{ whiteArrowMarker.remove(); }catch(e){} whiteArrowMarker=null; }
      return;
    }
    const loc = nextStep.maneuver.location;
    const turnLng = loc[0], turnLat = loc[1];
    // Tim doan route gan cho re nhat + huong sau khi re
    let bestIdx = 0, bestD = Infinity, arrowBearing = 0;
    try{
      if(currentRouteCoords){
        currentRouteCoords.forEach((c,i)=>{
          const d = (c[0]-turnLat)*(c[0]-turnLat) + (c[1]-turnLng)*(c[1]-turnLng);
          if(d<bestD){ bestD=d; bestIdx=i; }
        });
        if(currentRouteCoords[bestIdx+1]){
          const nxt = currentRouteCoords[bestIdx+1];
          arrowBearing = bearingBetween(turnLat, turnLng, nxt[0], nxt[1]);
        } else if(currentRouteCoords[bestIdx-1]){
          const prv = currentRouteCoords[bestIdx-1];
          arrowBearing = bearingBetween(prv[0], prv[1], turnLat, turnLng);
        }
      }
    }catch(e){}
    // Dich mui ten ve phia TRUOC cho re ~18m de no nam HAN tren doan sau khi re (nhu anh Google),
    // khong nam dung giua nga tu bi che boi duong ngang.
    let arrowLat = turnLat, arrowLng = turnLng;
    try{
      const R = 6371000, d = 18, br = arrowBearing*Math.PI/180;
      const lat1 = turnLat*Math.PI/180, lng1 = turnLng*Math.PI/180;
      const lat2 = Math.asin(Math.sin(lat1)*Math.cos(d/R) + Math.cos(lat1)*Math.sin(d/R)*Math.cos(br));
      const lng2 = lng1 + Math.atan2(Math.sin(br)*Math.sin(d/R)*Math.cos(lat1), Math.cos(d/R)-Math.sin(lat1)*Math.sin(lat2));
      arrowLat = lat2*180/Math.PI; arrowLng = lng2*180/Math.PI;
    }catch(e){}
    // Tao / cap nhat marker - hinh moi: 84x42, trang tinh
    if(!whiteArrowMarker){
      const el = makeWhiteArrowGoogleEl(84, 42);
      el.id = 'whiteTurnArrow';
      whiteArrowMarker = new maplibregl.Marker({ element: el, anchor:'center', rotationAlignment:'map' });
      whiteArrowMarker.addTo(map);
    } else {
      // Doi hinh cu thanh hinh moi neu van la hinh cu (48x48)
      const oldEl = whiteArrowMarker.getElement();
      if(oldEl && oldEl.offsetWidth === 44){
        const newEl = makeWhiteArrowGoogleEl(84, 42);
        newEl.id = 'whiteTurnArrow';
        // Giu nguyen marker, doi element ben trong
        oldEl.innerHTML = newEl.innerHTML;
        oldEl.style.cssText = newEl.style.cssText;
      }
    }
    whiteArrowMarker.setLngLat([arrowLng, arrowLat]);
    const el = whiteArrowMarker.getElement();
    if(el){
      const mapBearing = map.getBearing()||0;
      // SVG chi sang phai (90 do) -> xoay (bearing - 90 - mapBearing) de chi dung huong that
      el.style.transform = 'rotate('+(arrowBearing - 90 - mapBearing)+'deg)';
      el.style.opacity = '1';
    }
    // Mui ten thu 2: chay truoc user ~35m tren duong xanh, cung hinh trang beo
    if(lastUserPos && currentRouteCoords && currentRouteCoords.length){
      let bestIdx2 = 0, bestD2 = Infinity;
      currentRouteCoords.forEach((c,i)=>{
        const d = (c[0]-lastUserPos.lat)*(c[0]-lastUserPos.lat) + (c[1]-lastUserPos.lng)*(c[1]-lastUserPos.lng);
        if(d<bestD2){ bestD2=d; bestIdx2=i; }
      });
      const aheadIdx = Math.min(currentRouteCoords.length-1, bestIdx2+4);
      const ahead = currentRouteCoords[aheadIdx];
      const aheadNext = currentRouteCoords[Math.min(currentRouteCoords.length-1, aheadIdx+1)];
      if(ahead && aheadNext){
        const b = bearingBetween(ahead[0], ahead[1], aheadNext[0], aheadNext[1]);
        if(!whiteArrowAheadMarker){
          const el2 = makeWhiteArrowGoogleEl(60, 30);
          el2.id = 'whiteAheadArrow';
          whiteArrowAheadMarker = new maplibregl.Marker({ element: el2, anchor:'center', rotationAlignment:'map' });
          whiteArrowAheadMarker.addTo(map);
        }
        whiteArrowAheadMarker.setLngLat([ahead[1], ahead[0]]);
        const el2 = whiteArrowAheadMarker.getElement();
        if(el2){
          const mb = map.getBearing()||0;
          el2.style.transform = 'rotate('+(b - 90 - mb)+'deg)';
          el2.style.opacity = '1';
        }
      }
    }
  }
  try{ updateWhiteTurnArrow = updateWhiteTurnArrowFixed; }catch(e){}
  // Cap nhat ngay neu dang dan duong
  setTimeout(()=>{ try{ if(isNavigating) updateWhiteTurnArrowFixed(); }catch(e){} }, 600);
})();


/* ============================================================
   [FIX 2026-11-21] MUI TEN TRANG CONG THEO CHO RE - DUNG NHU TRONG VONG DO
   - Anh Google: mui ten TRANG nam tren duong xanh, DUOI nam tren duong vao (doc),
     DAU nam tren duong ra (ngang), cong theo goc re - khong phai mui ten thang.
   - Fix: Ve mui ten cong bang SVG theo goc re that (incoming -> outgoing),
     fill #FFFFFF 100%, vien #1A73E8, dat ngay tai cho re (tail o duong vao, head o duong ra)
   ============================================================ */
(function(){
  // ---- 1. Ve mui ten cong theo goc re ----
  function makeBentWhiteArrowEl(turnAngleDeg){
    // turnAngle = outgoing - incoming, -180..180. 0 = thang, +90 = re phai, -90 = re trai
    let a = turnAngleDeg || 0;
    while(a > 180) a -= 360; while(a < -180) a += 360;
    const el = document.createElement('div');
    el.style.cssText = 'width:96px;height:96px;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));line-height:0;';
    // U-turn rieng: ve chu U
    if(Math.abs(a) > 150){
      el.innerHTML = '<svg width="96" height="96" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">'
        + '<path d="M38 92 L38 38 A12 12 0 0 1 62 38 L62 92" stroke="#1A73E8" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<path d="M38 92 L38 38 A12 12 0 0 1 62 38 L62 92" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<path d="M62 92 L50 78 L74 78 Z" fill="#FFFFFF" stroke="#1A73E8" stroke-width="2" stroke-linejoin="round"/>'
        + '</svg>';
      return el;
    }
    // Mui ten cong chung: tail (50,92) -> goc (50,50) -> head theo huong outgoing
    const rad = a * Math.PI / 180;
    const dx = Math.sin(rad); // huong outgoing: x
    const dy = -Math.cos(rad); // y (SVG y xuong duoi, up = -1)
    const endX = 50 + 32*dx;
    const endY = 50 + 32*dy;
    const tipX = endX + 14*dx;
    const tipY = endY + 14*dy;
    // Vuong goc voi huong outgoing de ve day mui ten
    const px = -dy, py = dx;
    const base1X = endX + 11*px, base1Y = endY + 11*py;
    const base2X = endX - 11*px, base2Y = endY - 11*py;
    const bodyD = 'M50 92 L50 50 L' + endX.toFixed(1) + ' ' + endY.toFixed(1);
    const headD = 'M' + tipX.toFixed(1) + ' ' + tipY.toFixed(1) + ' L' + base1X.toFixed(1) + ' ' + base1Y.toFixed(1) + ' L' + base2X.toFixed(1) + ' ' + base2Y.toFixed(1) + ' Z';
    el.innerHTML = '<svg width="96" height="96" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">'
      + '<path d="' + bodyD + '" stroke="#1A73E8" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<path d="' + bodyD + '" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<path d="' + headD + '" fill="#FFFFFF" stroke="#1A73E8" stroke-width="2" stroke-linejoin="round"/>'
      + '</svg>';
    return el;
  }
  function makeStraightWhiteArrowEl(w, h){
    const el = document.createElement('div');
    el.style.cssText = 'width:'+w+'px;height:'+h+'px;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));line-height:0;';
    el.innerHTML = '<svg width="'+w+'" height="'+h+'" viewBox="0 0 72 36" fill="none" xmlns="http://www.w3.org/2000/svg">'
      + '<path d="M3 12 L38 12 L38 4 L69 18 L38 32 L38 24 L3 24 Z" fill="#FFFFFF" stroke="#1A73E8" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>'
      + '</svg>';
    return el;
  }
  // [FIX] Bo fallback 90 do co dinh - khong dung goc co dinh nua, goc luon lay tu duong that
  try{ if(whiteArrowMarker){ whiteArrowMarker.remove(); whiteArrowMarker=null; } }catch(e){}
  try{ if(whiteArrowAheadMarker){ whiteArrowAheadMarker.remove(); whiteArrowAheadMarker=null; } }catch(e){}

  // ---- 2. Cap nhat mui ten cong tai cho re ----
  function updateWhiteTurnArrowBent(){
    if(!map || !isNavigating) return;
    let nextStep = null;
    if(voiceRouteSteps && voiceRouteSteps.length){
      for(let i=voiceStepIndex; i<voiceRouteSteps.length; i++){
        const s = voiceRouteSteps[i];
        if(s && s.maneuver && s.maneuver.location){ nextStep = s; break; }
      }
    }
    if(!nextStep){
      if(whiteArrowMarker){ try{ whiteArrowMarker.remove(); }catch(e){} whiteArrowMarker=null; }
      return;
    }
    const loc = nextStep.maneuver.location;
    const turnLng = loc[0], turnLat = loc[1];
    // Tim diem route gan cho re nhat + huong vao / huong ra
    let bestIdx = 0, bestD = Infinity;
    try{
      if(currentRouteCoords){
        currentRouteCoords.forEach((c,i)=>{
          const d = (c[0]-turnLat)*(c[0]-turnLat) + (c[1]-turnLng)*(c[1]-turnLng);
          if(d<bestD){ bestD=d; bestIdx=i; }
        });
      }
    }catch(e){}
    // [FIX] Tinh huong vao/ra theo DUONG THAT: lay diem cach cho re ~25m truoc/sau de ra goc duong that
    // Chu khong lay 1 diem ke ben (de bi nhieu) va khong dung goc co dinh
    let incomingBearing = 0, outgoingBearing = 0;
    function distM(lat1,lng1,lat2,lng2){
      const R=6371000, dLa=(lat2-lat1)*Math.PI/180, dLo=(lng2-lng1)*Math.PI/180;
      const a=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLo/2)*Math.sin(dLo/2);
      return 2*R*Math.asin(Math.sqrt(a));
    }
    function pointAtDist(startIdx, dir, targetM){
      // di doc route tu cho re theo huong dir (-1 = lui, +1 = toi) den khi du ~targetM
      let acc=0, idx=startIdx;
      while(idx+dir>=0 && idx+dir<currentRouteCoords.length){
        const cur=currentRouteCoords[idx], nxt=currentRouteCoords[idx+dir];
        acc += distM(cur[0],cur[1],nxt[0],nxt[1]);
        idx+=dir;
        if(acc>=targetM) break;
      }
      return currentRouteCoords[idx];
    }
    try{
      if(currentRouteCoords && currentRouteCoords.length){
        // Huong vao: tu diem cach cho re 25m phia truoc -> cho re
        const farIn = pointAtDist(bestIdx, -1, 25);
        if(farIn) incomingBearing = bearingBetween(farIn[0], farIn[1], turnLat, turnLng);
        // Huong ra: tu cho re -> diem cach cho re 25m phia sau
        const farOut = pointAtDist(bestIdx, 1, 25);
        if(farOut) outgoingBearing = bearingBetween(turnLat, turnLng, farOut[0], farOut[1]);
        if(!isFinite(incomingBearing)) incomingBearing = outgoingBearing;
        if(!isFinite(outgoingBearing)) outgoingBearing = incomingBearing;
      }
    }catch(e){}
    let turnAngle = outgoingBearing - incomingBearing;
    while(turnAngle > 180) turnAngle -= 360; while(turnAngle < -180) turnAngle += 360;
    // Tao mui ten cong - dat NGAY tai cho re, duoi o duong vao, dau o duong ra (nhu anh Google)
    if(!whiteArrowMarker){
      const el = makeBentWhiteArrowEl(turnAngle);
      el.id = 'whiteTurnArrow';
      whiteArrowMarker = new maplibregl.Marker({ element: el, anchor:'center', rotationAlignment:'map' });
      whiteArrowMarker.addTo(map);
      whiteArrowMarker._bentTurnAngle = turnAngle;
    } else {
      // Neu goc re doi (qua cho re moi) thi ve lai hinh cong moi
      if(Math.abs((whiteArrowMarker._bentTurnAngle||0) - turnAngle) > 2){ // duong lech 2 do la ve lai - khong dung goc co dinh
        const newEl = makeBentWhiteArrowEl(turnAngle);
        const oldEl = whiteArrowMarker.getElement();
        if(oldEl){ oldEl.innerHTML = newEl.innerHTML; oldEl.style.cssText = newEl.style.cssText; }
        whiteArrowMarker._bentTurnAngle = turnAngle;
      }
    }
    whiteArrowMarker.setLngLat([turnLng, turnLat]);
    const el = whiteArrowMarker.getElement();
    if(el){
      const mapBearing = map.getBearing()||0;
      // SVG ve san: huong vao = len tren (0 do). Xoay theo huong vao that.
      el.style.transform = 'rotate(' + (incomingBearing - mapBearing) + 'deg)';
      el.style.opacity = '1';
    }
    // Mui ten thu 2: chay truoc user ~35m, mui ten thang trang (khong cong) de chi huong di
    if(lastUserPos && currentRouteCoords && currentRouteCoords.length){
      let bestIdx2 = 0, bestD2 = Infinity;
      currentRouteCoords.forEach((c,i)=>{
        const d = (c[0]-lastUserPos.lat)*(c[0]-lastUserPos.lat) + (c[1]-lastUserPos.lng)*(c[1]-lastUserPos.lng);
        if(d<bestD2){ bestD2=d; bestIdx2=i; }
      });
      const aheadIdx = Math.min(currentRouteCoords.length-1, bestIdx2+4);
      const ahead = currentRouteCoords[aheadIdx];
      const aheadNext = currentRouteCoords[Math.min(currentRouteCoords.length-1, aheadIdx+1)];
      if(ahead && aheadNext){
        const b = bearingBetween(ahead[0], ahead[1], aheadNext[0], aheadNext[1]);
        if(!whiteArrowAheadMarker){
          const el2 = makeStraightWhiteArrowEl(60, 30);
          el2.id = 'whiteAheadArrow';
          whiteArrowAheadMarker = new maplibregl.Marker({ element: el2, anchor:'center', rotationAlignment:'map' });
          whiteArrowAheadMarker.addTo(map);
        }
        whiteArrowAheadMarker.setLngLat([ahead[1], ahead[0]]);
        const el2 = whiteArrowAheadMarker.getElement();
        if(el2){
          const mb = map.getBearing()||0;
          el2.style.transform = 'rotate(' + (b - 90 - mb) + 'deg)';
          el2.style.opacity = '1';
        }
      }
    }
  }
  try{ updateWhiteTurnArrow = updateWhiteTurnArrowBent; }catch(e){}
  setTimeout(()=>{ try{ if(isNavigating) updateWhiteTurnArrowBent(); }catch(e){} }, 600);
})();


/* ============================================================
   [FIX 2026-11-22] NUT KET THUC CHUYEN DI + LUU TEN VO FIRESTORE (Google Nav)
   - Nut "Ket thuc chuyen di" noi tren bottom sheet, chi hien khi dang dan duong Google
   - Bam -> mo modal hoi: Luu chuyen hay khong? Neu Luu -> cho dat ten -> luu vao Firestore
     users/{uid}/savedRoutes (co field name). Neu Khong luu -> chi ket thuc.
   - Neu chua dang nhap: luu tam vao localStorage drivekit_saved_trips.
   - Ghi de openEndTripModal / endTrip cu de modal cu (neu co) cung dung modal moi co o ten.
   ============================================================ */
(function(){
  // ---- CSS ----
  function injectEndTripCSS(){
    if(document.getElementById('gNavEndTripStyle')) return;
    const st = document.createElement('style');
    st.id = 'gNavEndTripStyle';
    st.textContent = `
      #gNavEndTripBtn{ position:fixed !important; left:50% !important; transform:translateX(-50%) !important; bottom:calc(92px + env(safe-area-inset-bottom, 0px)) !important; z-index:801 !important; background:#dc2626 !important; color:#fff !important; border:none !important; border-radius:999px !important; padding:11px 22px !important; font-size:15px !important; font-weight:800 !important; box-shadow:0 4px 14px rgba(0,0,0,0.28) !important; cursor:pointer !important; display:none; align-items:center; gap:8px; }
      #gNavEndTripBtn.show{ display:flex !important; }
      #gNavEndTripBtn:active{ transform:translateX(-50%) scale(0.96) !important; }
      #gNavEndTripModal{ position:fixed !important; inset:0 !important; z-index:1200 !important; background:rgba(0,0,0,0.55) !important; display:none; align-items:flex-end; justify-content:center; padding:16px; }
      #gNavEndTripModal.open{ display:flex !important; }
      #gNavEndTripCard{ width:100% !important; max-width:420px !important; background:#fff !important; border-radius:20px !important; padding:20px 18px 18px !important; box-shadow:0 12px 32px rgba(0,0,0,0.3) !important; }
      #gNavEndTripCard h3{ margin:0 0 6px !important; font-size:19px !important; font-weight:800 !important; color:#111827 !important; text-align:center; }
      #gNavEndTripCard .trip-sum{ text-align:center; color:#5f6368; font-size:14px; font-weight:600; margin-bottom:14px; }
      #gNavEndTripCard label{ display:block; font-size:13px; font-weight:700; color:#374151; margin:0 0 6px; }
      #gNavEndTripName{ width:100% !important; box-sizing:border-box !important; padding:12px 14px !important; border:1.5px solid #dadce0 !important; border-radius:12px !important; font-size:15px !important; outline:none !important; }
      #gNavEndTripName:focus{ border-color:#1a73e8 !important; }
      #gNavEndTripBtns{ display:flex; gap:10px; margin-top:16px; }
      #gNavEndTripBtns button{ flex:1; padding:13px 10px; border-radius:12px; font-size:15px; font-weight:800; cursor:pointer; border:none; }
      #gNavSaveTripBtn{ background:#188038 !important; color:#fff !important; }
      #gNavNoSaveTripBtn{ background:#f1f3f4 !important; color:#3c4043 !important; }
      #gNavCancelTripBtn{ width:100%; margin-top:10px; background:transparent !important; color:#5f6368 !important; font-size:14px; font-weight:700; }
    `;
    document.head.appendChild(st);
  }
  injectEndTripCSS();

  // ---- DOM: nut Ket thuc + modal ----
  function ensureEndTripUI(){
    // Da bo nut Ket thuc (theo yeu cau) - chi giu modal, khong tao nut noi nua
    try{ const _old = document.getElementById('gNavEndTripBtn'); if(_old) _old.remove(); }catch(e){}
    if(!document.getElementById('gNavEndTripModal')){
      const m = document.createElement('div');
      m.id = 'gNavEndTripModal';
      m.innerHTML = '<div id="gNavEndTripCard">'
        + '<h3>Kết thúc chuyến đi?</h3>'
        + '<div class="trip-sum" id="gNavEndTripSum">—</div>'
        + '<label for="gNavEndTripName">Tên chuyến đi (nếu lưu)</label>'
        + '<input id="gNavEndTripName" type="text" placeholder="VD: Đi làm - Quận 1" />'
        + '<div id="gNavEndTripBtns"><button id="gNavSaveTripBtn" type="button">💾 Lưu chuyến</button><button id="gNavNoSaveTripBtn" type="button">Không lưu</button></div>'
        + '<button id="gNavCancelTripBtn" type="button">Hủy</button>'
        + '</div>';
      document.body.appendChild(m);
      document.getElementById('gNavCancelTripBtn').onclick = ()=>{ m.classList.remove('open'); };
      m.addEventListener('click', (e)=>{ if(e.target === m) m.classList.remove('open'); });
      document.getElementById('gNavSaveTripBtn').onclick = async ()=>{
        const inp = document.getElementById('gNavEndTripName');
        const name = (inp && inp.value.trim()) || ('Chuyến đi đến ' + (typeof endPoint !== 'undefined' && endPoint && endPoint.name ? endPoint.name : 'Đích') + ' - ' + new Date().toLocaleDateString('vi-VN'));
        m.classList.remove('open');
        try{ await window.endTrip(true, name); }catch(e){ console.warn('endTrip save loi', e); }
      };
      document.getElementById('gNavNoSaveTripBtn').onclick = async ()=>{
        m.classList.remove('open');
        try{ await window.endTrip(false); }catch(e){ console.warn('endTrip nosave loi', e); }
      };
    }
  }
  ensureEndTripUI();

  // Hien / an nut Ket thuc theo Google Nav
  try{
    const obs = new MutationObserver(()=>{
      const btn = document.getElementById('gNavEndTripBtn');
      if(!btn) return;
      const isNav = document.body.classList.contains('google-nav') || document.body.classList.contains('navigating');
      btn.classList.toggle('show', !!isNav);
    });
    obs.observe(document.body, { attributes:true, attributeFilter:['class'] });
    // Check lan dau
    setTimeout(()=>{
      const btn = document.getElementById('gNavEndTripBtn');
      if(btn) btn.classList.toggle('show', document.body.classList.contains('google-nav') || document.body.classList.contains('navigating'));
    }, 500);
  }catch(e){}

  // ---- Ghi de openEndTripModal: mo modal moi co o dat ten ----
  const _origOpenEnd = window.openEndTripModal;
  window.openEndTripModal = function(){
    try{
      ensureEndTripUI();
      const modal = document.getElementById('gNavEndTripModal');
      const sumEl = document.getElementById('gNavEndTripSum');
      const inp = document.getElementById('gNavEndTripName');
      // Dien tom tat
      let distTxt = '—', timeTxt = '—', destTxt = '—';
      try{
        if(typeof currentRouteData !== 'undefined' && currentRouteData) distTxt = (currentRouteData.distance/1000).toFixed(1) + ' km';
        if(typeof tripStartTime !== 'undefined' && tripStartTime) timeTxt = Math.max(1, Math.round((Date.now()-tripStartTime)/60000)) + ' phút';
        if(typeof endPoint !== 'undefined' && endPoint && endPoint.name) destTxt = endPoint.name;
      }catch(e){}
      if(sumEl) sumEl.textContent = destTxt + ' • ' + distTxt + ' • ' + timeTxt;
      if(inp){
        const defName = 'Chuyến đi đến ' + destTxt + ' - ' + new Date().toLocaleDateString('vi-VN');
        inp.value = defName;
        setTimeout(()=>{ try{ inp.focus(); inp.select(); }catch(e){} }, 150);
      }
      if(modal) modal.classList.add('open');
      // Dong modal cu neu co (tranh 2 modal chong nhau)
      try{ const old = document.getElementById('endTripModal'); if(old) old.classList.remove('open'); }catch(e){}
    }catch(e){
      // Fallback ve modal cu
      if(typeof _origOpenEnd === 'function') return _origOpenEnd();
    }
  };
  window.closeEndTripModal = function(){
    try{ const m = document.getElementById('gNavEndTripModal'); if(m) m.classList.remove('open'); }catch(e){}
    try{ const old = document.getElementById('endTripModal'); if(old) old.classList.remove('open'); }catch(e){}
  };

  // ---- Ghi de endTrip: luu co ten vao Firestore ----
  window.endTrip = async function(save, tripName){
    try{ const m = document.getElementById('gNavEndTripModal'); if(m) m.classList.remove('open'); }catch(e){}
    try{ const old = document.getElementById('endTripModal'); if(old) old.classList.remove('open'); }catch(e){}
    // 1. Luu neu chon Luu
    if(save && typeof currentRouteData !== 'undefined' && currentRouteData){
      const name = (tripName && String(tripName).trim()) || ('Chuyến đi đến ' + (typeof endPoint !== 'undefined' && endPoint && endPoint.name ? endPoint.name : 'Đích'));
      try{
        if(typeof currentUser !== 'undefined' && currentUser && typeof fsdb !== 'undefined' && typeof collection !== 'undefined' && typeof addDoc !== 'undefined'){
          await addDoc(collection(fsdb, `users/${currentUser.uid}/savedRoutes`), {
            name: name,
            startName: (typeof startPoint !== 'undefined' && startPoint) ? startPoint.name : '',
            startLng: (typeof startPoint !== 'undefined' && startPoint) ? startPoint.lng : null,
            startLat: (typeof startPoint !== 'undefined' && startPoint) ? startPoint.lat : null,
            endName: (typeof endPoint !== 'undefined' && endPoint) ? endPoint.name : '',
            endLng: (typeof endPoint !== 'undefined' && endPoint) ? endPoint.lng : null,
            endLat: (typeof endPoint !== 'undefined' && endPoint) ? endPoint.lat : null,
            coords: (typeof currentRouteCoords !== 'undefined') ? currentRouteCoords : [],
            distance: currentRouteData.distance || 0,
            duration: currentRouteData.duration || 0,
            timestamp: Date.now()
          });
        } else {
          // Chua dang nhap: luu tam localStorage
          try{
            const arr = JSON.parse(localStorage.getItem('drivekit_saved_trips') || '[]');
            arr.push({ name, startName: (typeof startPoint !== 'undefined' && startPoint) ? startPoint.name : '', endName: (typeof endPoint !== 'undefined' && endPoint) ? endPoint.name : '', coords: (typeof currentRouteCoords !== 'undefined') ? currentRouteCoords : [], distance: currentRouteData.distance || 0, timestamp: Date.now() });
            localStorage.setItem('drivekit_saved_trips', JSON.stringify(arr));
          }catch(e){}
        }
      }catch(e){ console.warn('Luu chuyen loi', e); }
    }
    // 2. Don dep - giong endTrip cu (khong goi lai ham cu de tranh luu 2 lan + alert 2 lan)
    try{ if(typeof watchId !== 'undefined' && watchId){ navigator.geolocation.clearWatch(watchId); watchId = null; } }catch(e){}
    try{ if(typeof voiceCheckTimer !== 'undefined' && voiceCheckTimer){ clearInterval(voiceCheckTimer); voiceCheckTimer = null; } }catch(e){}
    try{ if(window.speechSynthesis) speechSynthesis.cancel(); }catch(e){}
    try{ if(map && map.getLayer('current-route-layer')) map.removeLayer('current-route-layer'); }catch(e){}
    try{ if(map && map.getSource('current-route-source')) map.removeSource('current-route-source'); }catch(e){}
    try{ if(window._routeBadges){ window._routeBadges.forEach(m=>m.remove()); window._routeBadges = []; } }catch(e){}
    try{ if(typeof alternativeRoutesData !== 'undefined') alternativeRoutesData.forEach((_, i)=>{ if(map && map.getLayer(`alt-route-layer-${i}`)) map.removeLayer(`alt-route-layer-${i}`); if(map && map.getSource(`alt-route-source-${i}`)) map.removeSource(`alt-route-source-${i}`); }); }catch(e){}
    try{ currentRouteCoords = []; currentRouteData = null; alternativeRoutesData = []; voiceRouteSteps = null; voiceStepIndex = 0; lastSnapIndex = 0; offRouteCount = 0; isRerouting = false; tripStartTime = null; arrivalHandled = false; }catch(e){}
    try{ if(typeof warnedReports !== 'undefined') warnedReports.clear(); }catch(e){}
    try{ if(typeof warnedAvoidZones !== 'undefined') warnedAvoidZones.clear(); }catch(e){}
    try{ if(typeof warnedPois !== 'undefined') warnedPois.clear(); }catch(e){}
    try{ localStorage.removeItem('alternativeRoutes'); }catch(e){}
    try{ document.body.classList.remove('navigating'); document.body.classList.remove('google-nav'); }catch(e){}
    // Ket thuc chuyen -> thoat han che do chi duong: tat Google HUD, tra map ve 2D, xoa mui ten trang / minimap
    try{ if(typeof deactivateGoogleNav === 'function') deactivateGoogleNav(); }catch(e){}
    try{ if(typeof hideGoogleNavUI === 'function') hideGoogleNavUI(); }catch(e){}
    try{ const ls = document.getElementById('gNavLeftStack'); if(ls) ls.classList.remove('show'); }catch(e){}
    try{ const rb = document.getElementById('minimapRestoreBtn'); if(rb) rb.classList.remove('show'); }catch(e){}
    try{ const mm = document.getElementById('navMinimap'); if(mm) mm.style.display = 'none'; }catch(e){}
    try{ const hud = document.getElementById('hud'); if(hud) hud.classList.add('hidden'); }catch(e){}
    try{ if(typeof updateUIState === 'function') updateUIState(); }catch(e){}
    try{ const e1 = document.getElementById('dirInputEnd'); if(e1) e1.value = ''; }catch(e){}
    try{ const e2 = document.getElementById('topSearchInput'); if(e2) e2.value = ''; }catch(e){}
    try{ const e3 = document.getElementById('btnClearEnd'); if(e3) e3.classList.add('hidden'); }catch(e){}
    try{ const e4 = document.getElementById('searchClearBtn'); if(e4) e4.classList.add('hidden'); }catch(e){}
    try{ endPoint = null; }catch(e){}
    try{ if(typeof lastUserPos !== 'undefined' && lastUserPos && map) map.flyTo({ center:[lastUserPos.lng, lastUserPos.lat], zoom:16 }); }catch(e){}
    // 3. Thong bao
    try{
      if(save) { if(typeof showCustomToast === 'function') showCustomToast('✅ Đã lưu chuyến đi: ' + (tripName || ''), 'success'); else alert('✅ Đã lưu chuyến đi.'); }
      else { if(typeof showCustomToast === 'function') showCustomToast('🏁 Đã kết thúc chuyến đi.', 'info'); else alert('🏁 Đã kết thúc chuyến đi.'); }
    }catch(e){}
  };
})();


/* [MIGRATION] Neu ban cu da tao nut Fav ✦ thi doi thanh nut Lop ban do ngay */
(function(){
  try{
    const old = document.getElementById('gNavFavBtn');
    if(old){
      old.id = 'gNavLayerBtn';
      old.title = 'Lớp bản đồ';
      old.textContent = '🗺️';
      old.onclick = (e)=>{ try{ e.stopPropagation(); if(typeof window.toggleLayerMenu === 'function') window.toggleLayerMenu(); }catch(err){} };
    }
    // La ban xich len neu CSS cu van con 150px (them style de ghi de)
    if(!document.getElementById('gNavCompassUpFix')){
      const st = document.createElement('style');
      st.id = 'gNavCompassUpFix';
      st.textContent = '#gNavRightControls{ bottom:calc(195px + env(safe-area-inset-bottom, 0px)) !important; } #gNavNextBanner{ gap:10px !important; } #gNavNextBanner .next-arrow{ font-size:22px; }';
      document.head.appendChild(st);
    }
  }catch(e){}
})();


/* [MIGRATION ICON] Doi emoji cu sang SVG neu DOM da tao tu ban cu */
(function(){
  try{
    const map = {
      'gNavSearchBtn': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3c4043" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>',
      'gNavRoutesBtn': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="2" stroke-linecap="round"><path d="M6 4 v4 a4 4 0 0 0 4 4 h1 a4 4 0 0 1 4 4 v4"/><path d="M18 4 v2 a4 4 0 0 1-4 4"/><circle cx="6" cy="4" r="1.8" fill="#1a73e8" stroke="none"/><circle cx="18" cy="4" r="1.8" fill="#1a73e8" stroke="none"/><circle cx="15" cy="20" r="1.8" fill="#1a73e8" stroke="none"/></svg>',
      'gNavLayerBtn': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="2" stroke-linejoin="round"><path d="M12 3 L21 8 L12 13 L3 8 Z"/><path d="M3 11 L12 16 L21 11"/><path d="M3 15 L12 20 L21 15"/></svg>'
    };
    Object.keys(map).forEach(id=>{
      const el = document.getElementById(id);
      if(el && !el.querySelector('svg')) el.innerHTML = map[id];
    });
    const comp = document.querySelector('#gNavCompassBtn .compass-arrow');
    if(comp && !comp.querySelector('svg')) comp.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 2 L15.5 12 L12 22 L8.5 12 Z" fill="#ea4335"/><path d="M12 22 L15.5 12 L8.5 12 Z" fill="#9aa0a6"/></svg>';
    const voice = document.getElementById('gNavVoiceBtn');
    if(voice && !voice.querySelector('svg')) voice.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3c4043" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 L6 9 H3 v6 h3 l5 4 Z" fill="#3c4043" stroke="none"/><path d="M15.5 8.5 a5 5 0 0 1 0 7"/><path d="M18.5 5.5 a9 9 0 0 1 0 13"/></svg>';
    const exitBtn = document.getElementById('gNavExitBtn');
    if(exitBtn && !exitBtn.querySelector('svg')) exitBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3c4043" stroke-width="2.2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
  }catch(e){}
})();


/* ============================================================
   [FIX 2026-11-22] DAU X CHO THANH TIM KIEM
   - Them nut X nam TRONG o tim kiem (ben phai), chi hien khi co chu
   - Bam X: xoa chu, an goi y ket qua, focus lai o tim kiem
   - Lam cho ca #topSearchInput (tim kiem chinh) + #dirInputEnd (diem den) neu co
   ============================================================ */
(function(){
  function injectSearchXCSS(){
    if(document.getElementById('searchXStyle')) return;
    const st = document.createElement('style');
    st.id = 'searchXStyle';
    st.textContent = `
      .search-wrap-x{ position:relative !important; }
      .search-x-btn{ position:absolute !important; right:10px !important; top:50% !important; transform:translateY(-50%) !important; width:28px !important; height:28px !important; min-width:28px !important; border-radius:999px !important; border:none !important; background:#e8eaed !important; color:#3c4043 !important; cursor:pointer !important; display:none; align-items:center; justify-content:center; z-index:10 !important; padding:0 !important; }
      .search-x-btn.show{ display:flex !important; }
      .search-x-btn:active{ transform:translateY(-50%) scale(0.92) !important; background:#dadce0 !important; }
      .search-x-btn svg{ display:block; }
      /* Neu o tim kiem cu da co nut clear nam ngoai, cho no dep lai thanh X tron */
      #searchClearBtn{ width:28px !important; height:28px !important; border-radius:999px !important; background:#e8eaed !important; color:#3c4043 !important; border:none !important; display:none; align-items:center; justify-content:center; }
      #searchClearBtn:not(.hidden){ display:flex !important; }
    `;
    document.head.appendChild(st);
  }
  injectSearchXCSS();

  function hideSearchDropdown(){
    // An cac dropdown goi y neu co - khong xoa DOM, chi an de khoi vo code cu
    ['#searchSuggestions','#searchResults','#searchDropdown','#suggestBox','.search-suggestions','.search-results','.suggestion-box'].forEach(sel=>{
      try{ document.querySelectorAll(sel).forEach(el=>{ el.style.display = 'none'; }); }catch(e){}
    });
    try{ const old = document.getElementById('searchClearBtn'); if(old) old.classList.add('hidden'); }catch(e){}
  }

  function ensureSearchX(inputId, xId){
    const inp = document.getElementById(inputId);
    if(!inp) return false;
    const parent = inp.parentElement;
    if(!parent) return false;
    if(!parent.classList.contains('search-wrap-x')) parent.classList.add('search-wrap-x');
    let xBtn = document.getElementById(xId);
    if(!xBtn){
      xBtn = document.createElement('button');
      xBtn.id = xId;
      xBtn.type = 'button';
      xBtn.className = 'search-x-btn';
      xBtn.title = 'Xóa tìm kiếm';
      xBtn.setAttribute('aria-label', 'Xóa tìm kiếm');
      xBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3c4043" stroke-width="2.5" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
      // De nut X khong bi che boi icon khac trong o tim kiem
      parent.appendChild(xBtn);
      xBtn.addEventListener('mousedown', (e)=>{ e.preventDefault(); }); // giu focus khong mat
      xBtn.addEventListener('click', (e)=>{
        e.preventDefault(); e.stopPropagation();
        inp.value = '';
        try{ inp.readOnly = false; }catch(err){}
        xBtn.classList.remove('show');
        hideSearchDropdown();
        try{ inp.dispatchEvent(new Event('input', { bubbles:true })); }catch(err){}
        try{ inp.focus(); }catch(err){}
        // Neu la o tim kiem chinh, dong bo nut clear cu
        try{ if(inputId === 'topSearchInput' && typeof window.clearTopSearch === 'function') window.clearTopSearch(); }catch(err){}
      });
    }
    const toggle = ()=>{
      const has = !!(inp.value && inp.value.trim());
      xBtn.classList.toggle('show', has);
      // Dong bo nut clear cu (neu HTML cu co)
      try{ const old = document.getElementById('searchClearBtn'); if(old && inputId === 'topSearchInput') old.classList.toggle('hidden', !has); }catch(e){}
    };
    if(!inp._searchXBound){
      inp._searchXBound = true;
      inp.addEventListener('input', toggle);
      inp.addEventListener('change', toggle);
      inp.addEventListener('focus', toggle);
    }
    toggle();
    return true;
  }

  // Chay ngay + thu lai sau khi UI load (vi input co the tao sau)
  function tryEnsure(){
    ensureSearchX('topSearchInput', 'topSearchClearX');
    ensureSearchX('dirInputEnd', 'dirEndClearX');
    ensureSearchX('dirInputStart', 'dirStartClearX');
  }
  tryEnsure();
  setTimeout(tryEnsure, 800);
  setTimeout(tryEnsure, 2000);
  // Theo doi DOM: neu input bi tao lai sau thi gan X lai
  try{
    const obs = new MutationObserver(()=>{ tryEnsure(); });
    obs.observe(document.body, { childList:true, subtree:true });
    setTimeout(()=>obs.disconnect(), 15000);
  }catch(e){}
  // Neu HTML cu da co #searchClearBtn: doi no thanh X tron ben trong (neu no dang nam ngoai o tim kiem thi giu nguyen, chi doi icon)
  try{
    const old = document.getElementById('searchClearBtn');
    if(old && !old.querySelector('svg')){
      old.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3c4043" stroke-width="2.5" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
      old.title = 'Xóa tìm kiếm';
    }
  }catch(e){}
})();


/* ============================================================
   [REDESIGN SEARCH BAR 2026-11-21] Tach 2 khoi rieng
   Cu: 1 thanh den dai chua ca search + 3 gach + X don vao nhau -> chat, kho bam
   Moi: [ Search pill trang | 3 gach tron trang rieng ]
   - Trai: search pill trang, bo 28px, bong do, kinh lup xanh, X xoa nam TRONG pill, chi hien khi co chu
   - Phai: nut 3 gach la 1 tron trang rieng 52px, cach search 10px, khong nam trong pill
   ============================================================ */
(function redesignSearchBarSplit(){
  if(window._searchSplitDone) return; window._searchSplitDone = true;
  // 1. CSS moi - !important de thang style cu den
  function inject(){
    if(document.getElementById('topSearchSplitStyle')) return;
    const st = document.createElement('style');
    st.id = 'topSearchSplitStyle';
    st.textContent = `
      /* Wrapper moi: 2 khoi nam ngang, cach nhau 10px */
      #topBarSplit{
        position:fixed !important; left:12px !important; right:12px !important;
        top:calc(10px + env(safe-area-inset-top, 0px)) !important;
        display:flex !important; align-items:center !important; gap:10px !important;
        z-index:1000 !important; pointer-events:none !important; box-sizing:border-box !important;
      }
      #topBarSplit > *{ pointer-events:auto !important; }
      /* TRAI: Search pill trang - ghi de thanh den cu */
      #topBarSplit .floating-search, #topBarSplit #searchBar, .floating-search{
        flex:1 !important; min-width:0 !important; width:auto !important;
        height:52px !important; min-height:52px !important;
        background:#FFFFFF !important; background-color:#FFFFFF !important;
        border-radius:28px !important;
        box-shadow:0 2px 12px rgba(0,0,0,.18), 0 1px 3px rgba(0,0,0,.12) !important;
        border:1px solid rgba(0,0,0,.06) !important;
        display:flex !important; align-items:center !important; gap:8px !important;
        padding:0 8px 0 14px !important; margin:0 !important;
        position:relative !important; left:auto !important; right:auto !important; top:auto !important;
        overflow:hidden !important; color:#202124 !important;
      }
      #topBarSplit .floating-search input, #topBarSplit #searchBar input,
      .floating-search input, .floating-search .search-input{
        flex:1 !important; min-width:0 !important; width:auto !important;
        height:100% !important; border:none !important; outline:none !important; background:transparent !important;
        font-size:15px !important; color:#202124 !important; padding:0 !important;
      }
      #topBarSplit .floating-search input::placeholder{ color:#80868B !important; }
      /* Kinh lup: xanh Google */
      #topBarSplit .floating-search .search-icon, #topBarSplit .floating-search svg:first-child{
        color:#1A73E8 !important; flex-shrink:0 !important;
      }
      /* X xoa: nam TRONG pill, nho, xam, chi hien khi co chu - khong phai nut tron to ngoai cung */
      #topBarSplit .floating-search #searchClearBtn, #topBarSplit .floating-search .clear-btn,
      .floating-search #searchClearBtn{
        position:static !important; width:28px !important; height:28px !important; min-width:28px !important;
        border-radius:999px !important; background:#F1F3F4 !important; color:#5F6368 !important;
        font-size:14px !important; display:flex !important; align-items:center !important; justify-content:center !important;
        flex-shrink:0 !important; margin:0 !important; border:none !important; cursor:pointer !important;
      }
      #topBarSplit .floating-search #searchClearBtn.hidden, .floating-search #searchClearBtn.hidden{ display:none !important; }
      /* PHAI: Nut 3 gach - tron trang RIENG, tach khoi search */
      #topBarSplit #mainMenuBtn, #topBarSplit .menu-btn, #topBarSplit .hamburger,
      #topBarSplit button[data-menu], #topBarSplit #menuBtn{
        flex-shrink:0 !important; width:52px !important; height:52px !important; min-width:52px !important;
        border-radius:999px !important; background:#FFFFFF !important; background-color:#FFFFFF !important;
        color:#202124 !important; border:1px solid rgba(0,0,0,.06) !important;
        box-shadow:0 2px 12px rgba(0,0,0,.18), 0 1px 3px rgba(0,0,0,.12) !important;
        display:flex !important; align-items:center !important; justify-content:center !important;
        font-size:22px !important; line-height:1 !important; margin:0 !important; padding:0 !important;
        position:static !important; left:auto !important; right:auto !important; top:auto !important; transform:none !important;
      }
      /* Khi dang dan duong: an ca wrapper */
      body.google-nav #topBarSplit{ display:none !important; }
      body.google-nav .floating-search{ display:none !important; }
      @media (max-width:640px){
        #topBarSplit{ left:10px !important; right:10px !important; gap:8px !important; top:calc(8px + env(safe-area-inset-top, 0px)) !important; }
        #topBarSplit .floating-search, #topBarSplit #searchBar{ height:48px !important; min-height:48px !important; padding:0 6px 0 12px !important; }
        #topBarSplit #mainMenuBtn, #topBarSplit .menu-btn{ width:48px !important; height:48px !important; min-width:48px !important; }
        #topBarSplit .floating-search input{ font-size:14px !important; }
      }
    `;
    document.head.appendChild(st);
  }
  function findMenu(){
    const cands = Array.from(document.querySelectorAll('button, div[role="button"]'));
    for(const el of cands){
      const cls = (el.className||'')+' '+(el.id||'');
      const txt = (el.textContent||'').trim();
      if(/mainMenu|menuBtn|menu-btn|hamburger/i.test(cls) || txt==='☰' || txt==='≡') return el;
    }
    return document.getElementById('mainMenuBtn') || document.getElementById('menuBtn');
  }
  function split(){
    try{
      inject();
      if(document.body.classList.contains('google-nav')) return;
      const search = document.querySelector('.floating-search') || document.getElementById('searchBar');
      if(!search) return;
      let wrap = document.getElementById('topBarSplit');
      if(!wrap){
        wrap = document.createElement('div'); wrap.id = 'topBarSplit';
        search.parentNode.insertBefore(wrap, search);
      }
      // Dua search vao wrap neu chua co
      if(search.parentNode !== wrap) wrap.appendChild(search);
      // Dua nut 3 gach RA NGOAI search, vao wrap ben phai
      const menu = findMenu();
      if(menu){
        if(menu.parentNode !== wrap) wrap.appendChild(menu);
        // Dam bao thu tu: search trai, menu phai
        if(wrap.firstChild !== search) wrap.insertBefore(search, wrap.firstChild);
        // Icon 3 gach chuan: neu nut dang la chu X hoac rong thi doi ve 3 gach
        const txt = (menu.textContent||'').trim();
        if(txt==='✕' || txt==='X' || txt==='×' || !txt){
          menu.innerHTML = '<span style="display:flex;flex-direction:column;gap:4.5px;align-items:center;"><span style="display:block;width:20px;height:2.5px;background:#202124;border-radius:2px;"></span><span style="display:block;width:20px;height:2.5px;background:#202124;border-radius:2px;"></span><span style="display:block;width:20px;height:2.5px;background:#202124;border-radius:2px;"></span></span>';
        }
        // Kinh lup: neu search chua co icon thi them
        if(!search.querySelector('.search-icon') && !search.querySelector('svg')){
          const ic = document.createElement('span'); ic.className='search-icon'; ic.style.cssText='color:#1A73E8;font-size:18px;flex-shrink:0;';
          ic.innerHTML = '🔍';
          search.insertBefore(ic, search.firstChild);
        }
      }
      // X xoa phai nam TRONG search, khong nam ngoai wrap
      const clr = document.getElementById('searchClearBtn');
      if(clr && clr.parentNode !== search && !search.contains(clr)){
        // Chi dua vao neu no dang o gan top (tranh lay nham X o cho khac)
        try{ const r=clr.getBoundingClientRect(); if(r.top<120) search.appendChild(clr); }catch(e){}
      }
      // Ghi de ham cu: khong cho keo menu vao lai trong search nua
      window.fixTopBarOverlap = split;
    }catch(e){}
  }
  split();
  document.addEventListener('DOMContentLoaded', split);
  setTimeout(split, 300); setTimeout(split, 800); setTimeout(split, 1500); setTimeout(split, 3000);
  try{
    let _t=null;
    const obs = new MutationObserver(()=>{ if(_t) return; _t=setTimeout(()=>{ _t=null; split(); }, 400); });
    obs.observe(document.body, { childList:true });
    setTimeout(()=>obs.disconnect(), 10000);
  }catch(e){}
})();


/* ============================================================
   [FIX 2026-11-21-v9] TOP-DOWN + IMMEDIATE-BEARING (fix video) + SNAP-BEARING (Claude+DeepSeek) DOC DUONG XANH + FREE THAT + LOCATED + HUD TOC DO
   - Camera: nhin thang tu tren xuong (pitch:0), bearing = huong duong xanh phia truoc,
     tam = vi tri user, offset [0,0], zoom 17.5. Duong xanh nam doc giua man hinh.
   - Free: bat ky thao tac nao tren map (keo, xoay, nghien, zoom, cham, lan) deu pha lock -> free,
     chi bam Located / Ve giua moi quay ve follow.
   - Located trong che do chi duong: ve lai tam user + nhin doc duong xanh + bam theo mui ten xanh la khi di chuyen.
   - HUD toc do: pill hien km/h, cap nhat theo smoothedSpeed moi 500ms.
   ============================================================ */
(function fixTopDownFreeLocatedSpeed(){
  if(window._fixTopDownV7Done) return; window._fixTopDownV7Done = true;

  function getBearing(){
    try{
      if(typeof window.getRouteBearingAhead === 'function' && lastUserPos){
        const b = window.getRouteBearingAhead(lastUserPos);
        if(b !== null && b !== undefined && isFinite(b)) return b;
      }
    }catch(e){}
    try{ if(lastUserPos && lastUserPos.heading) return lastUserPos.heading; }catch(e){}
    return 0;
  }

  // ---- 1. Recenter / Located: ve tam + top-down + follow ----
  window.recenterToRouteView = function(){
    try{
      window._userFreed = false;
      navFollowMode = 'first-person';
      try{ _isUserDraggingMap = false; }catch(e){}
      try{ if(typeof map !== 'undefined' && map) map.stop(); }catch(e){}
      if(typeof lastUserPos !== 'undefined' && lastUserPos && typeof map !== 'undefined' && map){
        const br = getBearing();
        map.easeTo({ center:[lastUserPos.lng, lastUserPos.lat], bearing: br, pitch:0, zoom: Math.max(map.getZoom(), 17.5), offset:[0,0], duration:500, essential:true });
        try{ const comp=document.querySelector('#gNavCompassBtn .compass-arrow'); if(comp) comp.style.transform='rotate('+(-br)+'deg)'; }catch(e){}
      }
      try{ if(typeof hideRecenterBtn==='function') hideRecenterBtn(); }catch(e){}
      try{ const rb=document.getElementById('gNavRecenterBtn'); if(rb) rb.classList.remove('show'); }catch(e){}
    }catch(e){}
  };
  // Nut Located goc (mainLocateBtn) khi dang dan duong cung phai ve giua kieu top-down, khong phai chi flyTo thuong
  try{
    const locBtn = document.getElementById('mainLocateBtn');
    if(locBtn && !locBtn._fixTopDownV7){
      locBtn._fixTopDownV7 = true;
      locBtn.addEventListener('click', ()=>{
        try{
          const _isNav = (typeof isNavigating!=='undefined' && isNavigating) || document.body.classList.contains('google-nav') || document.body.classList.contains('navigating');
          if(_isNav) { window.recenterToRouteView(); }
        }catch(e){}
      });
    }
  }catch(e){}
  // Nut Ve giua (gNavRecenterBtn) - dam bao onclick moi la top-down
  try{
    const rb = document.getElementById('gNavRecenterBtn');
    if(rb && !rb._fixTopDownV7){
      rb._fixTopDownV7 = true;
      rb.addEventListener('click', ()=>{ try{ window.recenterToRouteView(); }catch(e){} });
    }
  }catch(e){}

  // ---- 2. updateNavCamera: top-down, chi chay khi follow, khong chay khi free ----
  try{
    if(typeof updateNavCamera === 'function'){
      const _orig = updateNavCamera;
      updateNavCamera = function(pos, heading){
        try{
          if(typeof navFollowMode!=='undefined' && navFollowMode!=='first-person') return;
          if(window._userFreed && typeof navFollowMode!=='undefined' && navFollowMode==='free') return;
          if(typeof _isUserDraggingMap!=='undefined' && _isUserDraggingMap) return;
          if(!isNavigating && !document.body.classList.contains('google-nav') && !document.body.classList.contains('navigating')) return;
        }catch(e){}
        try{
          if(!map) return;
          // Throttle nhe de khong giat, nhung khong chan khi user vua bam Located
          const nowC = Date.now();
          if(nowC - _lastCamAt < 600) return;
          _lastCamAt = nowC;
          const br = getBearing();
          // Bam theo mui ten xanh la: tam = vi tri user hien tai, khong offset
          map.easeTo({ center:[pos.lng, pos.lat], bearing: br, pitch:0, zoom: Math.max(map.getZoom(), 17.5), offset:[0,0], duration:350, essential:false });
          try{ const comp=document.querySelector('#gNavCompassBtn .compass-arrow'); if(comp) comp.style.transform='rotate('+(-br)+'deg)'; }catch(e){}
        }catch(e){}
      };
    }
  }catch(e){}

  // ---- 3. Free that: bat ky di chuyen map nao cung pha lock ----
  function toFree(){
    try{
      const _isNav = (typeof isNavigating!=='undefined' && isNavigating) || document.body.classList.contains('google-nav') || document.body.classList.contains('navigating');
      if(!_isNav) return;
      navFollowMode = 'free';
      window._userFreed = true;
      try{ _isUserDraggingMap = true; }catch(e){}
      /* [FIX Claude v8] Bo map.stop() - stop lam chet cu keo, chi dat co free */
      try{ if(typeof showRecenterBtn==='function') showRecenterBtn(); }catch(e){}
      try{ const rb=document.getElementById('gNavRecenterBtn'); if(rb) rb.classList.add('show'); }catch(e){}
    }catch(e){}
  }
  function bindFree(){
    try{
      if(typeof map==='undefined' || !map) return false;
      if(map._fixTopDownV7Bound) return true;
      map._fixTopDownV7Bound = true;
      // [FIX Claude v8] Chi nghe dragstart/rotatestart/pitchstart - bo touchstart/zoomstart/wheel/movestart (chung no ban vao dau cu keo va goi stop)
      ['dragstart','rotatestart','pitchstart'].forEach(ev=>{ try{ map.on(ev, toFree); }catch(e){} });
      // [FIX Claude v8] Bo map.on('wheel') va movestart - zoom/wheel khong can pha lock, de keo khong bi ngat
      try{ map.on('dragend', ()=>{ setTimeout(()=>{ try{ _isUserDraggingMap=false; }catch(e){} }, 500); }); }catch(e){}
      try{ map.on('moveend', ()=>{ setTimeout(()=>{ try{ _isUserDraggingMap=false; }catch(e){} }, 500); }); }catch(e){}
      try{ map.on('touchend', ()=>{ setTimeout(()=>{ try{ _isUserDraggingMap=false; }catch(e){} }, 500); }); }catch(e){}
      // Dam bao map luon keo duoc
      try{
        if(map.dragPan && !map.dragPan.isEnabled()) map.dragPan.enable();
        if(map.scrollZoom && !map.scrollZoom.isEnabled()) map.scrollZoom.enable();
        if(map.touchZoomRotate && !map.touchZoomRotate.isEnabled()) map.touchZoomRotate.enable();
        if(map.dragRotate && !map.dragRotate.isEnabled()) map.dragRotate.enable();
        if(map.touchPitch && !map.touchPitch.isEnabled()) map.touchPitch.enable();
        const mc=document.getElementById('map'); if(mc) mc.style.touchAction='auto';
      }catch(e){}
      return true;
    }catch(e){ return false; }
  }
  try{ bindFree(); }catch(e){}
  try{ if(typeof map!=='undefined' && map) map.on('load', bindFree); }catch(e){}
  try{ let _n=0; const _iv=setInterval(()=>{ _n++; if(bindFree()||_n>20) clearInterval(_iv); }, 500); }catch(e){}

  // ---- 4. HUD toc do ----
  function ensureSpeedHUD(){
    if(document.getElementById('gNavSpeedHUD')) return;
    const el=document.createElement('div');
    el.id='gNavSpeedHUD';
    el.innerHTML = '<div class="spd-num" id="gNavSpeedNum">0</div><div class="spd-unit">km/h</div>';
    document.body.appendChild(el);
  }
  try{
    if(!document.getElementById('fixSpeedHUDStyle')){
      const st=document.createElement('style'); st.id='fixSpeedHUDStyle';
      st.textContent = `
        #gNavSpeedHUD{
          position:fixed !important; left:12px !important; bottom:calc(168px + env(safe-area-inset-bottom, 0px)) !important;
          z-index:801 !important; background:rgba(15,23,42,0.92) !important; color:#fff !important;
          border-radius:16px !important; padding:10px 14px 8px !important; text-align:center !important;
          box-shadow:0 4px 14px rgba(0,0,0,0.28) !important; min-width:72px !important;
          display:none !important; pointer-events:none !important; backdrop-filter:blur(6px);
        }
        body.google-nav #gNavSpeedHUD, body.navigating #gNavSpeedHUD{ display:block !important; }
        #gNavSpeedHUD .spd-num{ font-size:28px !important; font-weight:900 !important; line-height:1 !important; font-variant-numeric:tabular-nums; }
        #gNavSpeedHUD .spd-unit{ font-size:11px !important; font-weight:700 !important; opacity:0.8 !important; letter-spacing:0.5px; margin-top:2px; }
        body:not(.google-nav):not(.navigating) #gNavSpeedHUD{ display:none !important; }
        /* Dark / Light deu doc duoc: nen den, chu trang */
      `;
      document.head.appendChild(st);
    }
  }catch(e){}
  try{ ensureSpeedHUD(); }catch(e){}
  // Cap nhat toc do moi 500ms tu smoothedSpeed (da co san trong startWatching)
  try{
    if(!window._speedHUDInt){
      window._speedHUDInt = setInterval(()=>{
        try{
          if (document.hidden) return;
          const el=document.getElementById('gNavSpeedNum'); if(!el) return;
          const _isNav = (typeof isNavigating!=='undefined' && isNavigating) || document.body.classList.contains('google-nav') || document.body.classList.contains('navigating');
          if(!_isNav) return;
          let v = 0;
          if(typeof smoothedSpeed!=='undefined' && isFinite(smoothedSpeed)) v = smoothedSpeed * 3.6;
          else if(typeof lastUserPos!=='undefined' && lastUserPos && lastUserPos.speed) v = lastUserPos.speed * 3.6;
          el.textContent = String(Math.max(0, Math.round(v)));
        }catch(e){}
      }, 500);
    }
  }catch(e){}
})();


/* ============================================================
   [FINAL v3 2026-11-22] BOTTOM SHEET PREMIUM + THEM POI CANH BAO
   - Ghi de sheet 4 nut cu -> sheet 5 nut premium
   - 5 nut: Chi duong / Quanh day / Them dia diem / Them POI / POI canh bao
   - POI canh bao = openReportMenu() (mo reportModal), giong nut canh bao o gNav
   - Premium: bo 28px, glass blur, icon gradient 56px + bong do, label dam, header co subtitle
   - Neu sau nay co styles.css: chi can map lai bien mau o day, cau truc giu nguyen
   ============================================================ */
(function premiumBottomSheetV3(){
  if (window._premiumSheetV3Done) return; window._premiumSheetV3Done = true;

  function injectPremiumCSS(){
    if (document.getElementById('premiumBottomSheetStyle')) return;
    const st = document.createElement('style');
    st.id = 'premiumBottomSheetStyle';
    st.textContent = `
      /* Sheet: glass + bo lon + bong mem */
      html body #homeBottomSheet{
        background:rgba(255,255,255,.97) !important;
        backdrop-filter:blur(20px) saturate(1.2) !important;
        -webkit-backdrop-filter:blur(20px) saturate(1.2) !important;
        border-radius:28px 28px 0 0 !important;
        border-top:1px solid rgba(255,255,255,.7) !important;
        box-shadow:0 -8px 32px rgba(0,0,0,.14), 0 -1px 0 rgba(0,0,0,.04) !important;
        padding:10px 14px calc(16px + env(safe-area-inset-bottom, 0px)) !important;
      }
      html body:not(.light-mode) #homeBottomSheet{
        background:rgba(31,41,55,.97) !important;
        border-top:1px solid rgba(255,255,255,.08) !important;
        box-shadow:0 -8px 32px rgba(0,0,0,.55) !important;
      }
      html body #homeBottomSheet .hb-handle{
        width:48px !important; height:5px !important; background:#D1D5DB !important; margin:0 auto 10px !important;
      }
      html body:not(.light-mode) #homeBottomSheet .hb-handle{ background:#4B5563 !important; }
      /* Header premium: title + subtitle ben trai, nut thu gon ben phai */
      html body #homeBottomSheet .hb-head{ padding:0 4px 10px !important; align-items:flex-start !important; }
      html body #homeBottomSheet .hb-title-wrap{ display:flex !important; flex-direction:column !important; gap:2px !important; }
      html body #homeBottomSheet .hb-title{ font-size:14px !important; font-weight:800 !important; letter-spacing:.1px !important; }
      html body #homeBottomSheet .hb-subtitle{ font-size:11px !important; font-weight:500 !important; color:#80868B !important; }
      html body:not(.light-mode) #homeBottomSheet .hb-subtitle{ color:#9CA3AF !important; }
      html body #homeBottomSheet .hb-toggle{
        width:32px !important; height:32px !important; background:#F1F3F4 !important; font-size:16px !important;
        transition:transform .2s ease !important;
      }
      html body #homeBottomSheet.hb-collapsed .hb-toggle{ transform:rotate(180deg) !important; }
      /* Grid 5 nut - vua 1 hang tren mobile */
      html body #homeBottomSheet .hb-grid{
        grid-template-columns:repeat(5, 1fr) !important; gap:4px !important;
      }
      html body #homeBottomSheet .hb-action{ padding:8px 1px 6px !important; gap:7px !important; border-radius:16px !important; transition:background .15s ease, transform .12s ease !important; }
      html body #homeBottomSheet .hb-action:active{ transform:scale(.94) !important; }
      /* Icon gradient 56px + bong do - nhin xin hon icon tron don sac cu */
      html body #homeBottomSheet .hb-icon{
        width:56px !important; height:56px !important; border-radius:18px !important;
        box-shadow:0 6px 16px rgba(0,0,0,.16) !important; color:#fff !important;
      }
      html body #homeBottomSheet .hb-icon svg{ width:24px !important; height:24px !important; }
      html body #homeBottomSheet .hb-icon--dir{ background:linear-gradient(135deg,#4285F4,#1A73E8) !important; box-shadow:0 6px 16px rgba(26,115,232,.35) !important; }
      html body #homeBottomSheet .hb-icon--nearby{ background:linear-gradient(135deg,#34A853,#188038) !important; box-shadow:0 6px 16px rgba(24,128,56,.32) !important; }
      html body #homeBottomSheet .hb-icon--place{ background:linear-gradient(135deg,#FBBC04,#F29900) !important; box-shadow:0 6px 16px rgba(242,153,0,.32) !important; }
      html body #homeBottomSheet .hb-icon--poi{ background:linear-gradient(135deg,#A142F4,#7C3AED) !important; box-shadow:0 6px 16px rgba(124,58,237,.35) !important; }
      html body #homeBottomSheet .hb-icon--warn{ background:linear-gradient(135deg,#FF6B35,#EA4335) !important; box-shadow:0 6px 16px rgba(234,67,53,.35) !important; }
      html body #homeBottomSheet .hb-label{ font-size:11px !important; font-weight:700 !important; line-height:1.25 !important; }
      /* FAB con lai day cao them 1 chut vi sheet premium cao hon */
      html body:not(.navigating):not(.google-nav) #mainLocateBtn,
      html body:not(.navigating):not(.google-nav) #btnLayerMenu,
      html body:not(.navigating):not(.google-nav) #btnReport,
      html body:not(.navigating):not(.google-nav) #btnRestStopFilter{ bottom:168px !important; }
      @media (max-width:380px){
        html body #homeBottomSheet .hb-icon{ width:48px !important; height:48px !important; border-radius:16px !important; }
        html body #homeBottomSheet .hb-label{ font-size:10.5px !important; }
        html body #homeBottomSheet{ padding-left:8px !important; padding-right:8px !important; }
      }
      @media (min-width:640px){
        html body #homeBottomSheet{ left:50% !important; transform:translateX(-50%) !important; max-width:480px !important; border-radius:28px 28px 0 0 !important; }
        html body #homeBottomSheet.hb-hidden{ transform:translate(-50%,100%) !important; }
      }
    `;
    document.head.appendChild(st);
  }

  function getCurrentLatLng(){
    try{ if (typeof lastUserPos !== 'undefined' && lastUserPos && lastUserPos.lat) return { lat: lastUserPos.lat, lng: lastUserPos.lng }; }catch(e){}
    try{ if (map){ const c = map.getCenter(); return { lat: c.lat, lng: c.lng }; } }catch(e){}
    return { lat: 10.776, lng: 106.700 };
  }

  function buildPremiumSheet(){
    injectPremiumCSS();
    // Xoa sheet cu 4 nut de khong bi trung
    try{ const old = document.getElementById('homeBottomSheet'); if (old) old.remove(); }catch(e){}
    const sheet = document.createElement('div');
    sheet.id = 'homeBottomSheet';
    sheet.innerHTML = `
      <div class="hb-handle" id="hbHandle"></div>
      <div class="hb-head">
        <div class="hb-title-wrap">
          <span class="hb-title">Tính năng nhanh</span>
          <span class="hb-subtitle">Chạm để mở nhanh &nbsp;•&nbsp; Kéo tay cầm để thu gọn</span>
        </div>
        <button type="button" class="hb-toggle" id="hbToggle" title="Thu / mở">˄</button>
      </div>
      <div class="hb-grid">
        <button type="button" class="hb-action" id="hbDir">
          <span class="hb-icon hb-icon--dir"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L17 10 L12 8 L7 10 Z" fill="#fff" stroke="none"/><path d="M12 8 L12 21"/><circle cx="12" cy="21" r="1.6" fill="#fff" stroke="none"/></svg></span>
          <span class="hb-label">Chỉ đường</span>
        </button>
        <button type="button" class="hb-action" id="hbNearby">
          <span class="hb-icon hb-icon--nearby"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2 v3 M12 19 v3 M2 12 h3 M19 12 h3"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/></svg></span>
          <span class="hb-label">Quanh đây</span>
        </button>
        <button type="button" class="hb-action" id="hbAddPlace">
          <span class="hb-icon hb-icon--place"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21 s-7 -5.5 -7 -11 a7 7 0 0 1 14 0 c0 5.5 -7 11 -7 11 Z"/><circle cx="12" cy="10" r="2.5"/><path d="M12 7.5 v5 M9.5 10 h5"/></svg></span>
          <span class="hb-label">Thêm<br>địa điểm</span>
        </button>
        <button type="button" class="hb-action" id="hbAddPoi">
          <span class="hb-icon hb-icon--poi"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13 L13 20 a2 2 0 0 1 -2.8 0 L3 12.8 V4 h8.8 Z"/><circle cx="8.5" cy="8.5" r="1.6" fill="#fff" stroke="none"/><path d="M12 7.5 v5 M9.5 10 h5"/></svg></span>
          <span class="hb-label">Thêm POI</span>
        </button>
        <button type="button" class="hb-action" id="hbWarnPoi">
          <span class="hb-icon hb-icon--warn"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L22 20 H2 Z" fill="rgba(255,255,255,.18)"/><line x1="12" y1="10" x2="12" y2="14"/><circle cx="12" cy="17" r="1.2" fill="#fff" stroke="none"/></svg></span>
          <span class="hb-label">POI<br>cảnh báo</span>
        </button>
      </div>`;
    document.body.appendChild(sheet);

    const toggle = ()=>{ sheet.classList.toggle('hb-collapsed'); const t = sheet.querySelector('#hbToggle'); if (t) t.textContent = sheet.classList.contains('hb-collapsed') ? '˅' : '˄'; };
    sheet.querySelector('#hbHandle').addEventListener('click', toggle);
    sheet.querySelector('#hbToggle').addEventListener('click', toggle);
    try{
      let sy = 0, dragging = false;
      const h = sheet.querySelector('#hbHandle');
      h.addEventListener('touchstart', (e)=>{ sy = e.touches[0].clientY; dragging = true; }, { passive:true });
      h.addEventListener('touchmove', (e)=>{ if (!dragging) return; const dy = e.touches[0].clientY - sy; if (dy > 28) { sheet.classList.add('hb-collapsed'); const t = sheet.querySelector('#hbToggle'); if (t) t.textContent = '˅'; dragging = false; } if (dy < -28) { sheet.classList.remove('hb-collapsed'); const t = sheet.querySelector('#hbToggle'); if (t) t.textContent = '˄'; dragging = false; } }, { passive:true });
      h.addEventListener('touchend', ()=>{ dragging = false; });
    }catch(e){}

    const collapseToPeek = ()=>{ sheet.classList.add('hb-collapsed'); const t = sheet.querySelector('#hbToggle'); if (t) t.textContent = '˅'; };
    sheet.querySelector('#hbDir').addEventListener('click', ()=>{ collapseToPeek(); try{ if (typeof window.openDirections === 'function') window.openDirections(); }catch(e){} });
    sheet.querySelector('#hbNearby').addEventListener('click', ()=>{ collapseToPeek(); try{ if (typeof window.openNearbySearchPanel === 'function') window.openNearbySearchPanel(); }catch(e){} });
    sheet.querySelector('#hbAddPlace').addEventListener('click', ()=>{ collapseToPeek(); try{ if (typeof window.openQuickPin === 'function') window.openQuickPin(); }catch(e){} });
    sheet.querySelector('#hbAddPoi').addEventListener('click', ()=>{ collapseToPeek(); try{ const p = getCurrentLatLng(); if (typeof window.openPoiSheet === 'function') window.openPoiSheet(p.lat, p.lng, 'Vị trí hiện tại'); }catch(e){} });
    // POI CANH BAO moi: giong nut canh bao o gNav, mo reportModal
    sheet.querySelector('#hbWarnPoi').addEventListener('click', ()=>{
      collapseToPeek();
      try{
        if (typeof window.openReportMenu === 'function') window.openReportMenu();
        else { const b = document.getElementById('btnReport'); if (b) b.click(); else if (typeof showCustomToast === 'function') showCustomToast('Không mở được báo cáo cảnh báo', 'warning'); }
      }catch(e){}
    });
    return sheet;
  }

  // Ghi de builder cu
  try{ window.buildHomeBottomSheet = buildPremiumSheet; }catch(e){}
  buildPremiumSheet();
  document.addEventListener('DOMContentLoaded', buildPremiumSheet);
  setTimeout(buildPremiumSheet, 500);
  window.buildHomeBottomSheetPremium = buildPremiumSheet;
})();


/* ============================================================
   [FINAL v4 2026-11-22] MAP styles.css -> TOP BAR + BOTTOM SHEET
   Doc styles.css user gui:
   - :root dark: --bg #0f172a, --card #1e293b, --card-2 #334155, --border #334155,
     --text #f1f5f9, --text-muted #94a3b8, --primary #3b82f6, --success #10b981,
     --danger #ef4444, --warning #f59e0b, --voice #8b5cf6, --font-main Be Vietnam Pro
   - body.light-mode: --bg #f8fafc, --card #ffffff, --card-2 #f1f5f9, --border #cbd5e1,
     --text #0f172a, --text-muted #64748b
   - .floating-search: top calc(16px+var(--safe-top)), left 16 right 60, bg var(--card),
     radius 24px, border var(--border), shadow 0 4px 15px rgba(0,0,0,.1)
   - .fab-menu: 42px tron, bg var(--card), border var(--border)
   - .fab-report: gradient var(--danger) -> #f97316
   - .dir-sheet / .poi-sheet: radius 20px tren, bg var(--card), handle 36x4 bg var(--border)
   => v3 hardcode trang / #1A73E8 / #4285F4 bi lech tong -> v4 ghi de het bang var(--...)
   => Doi dark/light chi can body.light-mode, khong can sua CSS tay
   => Sua luon loi v3: FAB day len bang bottom:168px lam 2 FAB trai chong nhau
      (locate 20 + layers 80 + compass 140 trong styles.css) -> doi sang translateY(-150px)
      de giu nguyen khoang cach xep chong doc cua FAB.
   ============================================================ */
(function mapStylesCssV4(){
  if (window._stylesMappedV4Done) return; window._stylesMappedV4Done = true;
  function inject(){
    if (document.getElementById('stylesMappedV4')) return;
    const st = document.createElement('style');
    st.id = 'stylesMappedV4';
    st.textContent = `
      /* ---------- TOP BAR: theo .floating-search + .fab-menu trong styles.css ---------- */
      html body #topBarSplit{
        top:calc(16px + var(--safe-top, 0px)) !important;
        left:16px !important; right:16px !important; gap:8px !important;
      }
      html body #topBarSplit .floating-search, html body #topBarSplit #searchBar{
        background:var(--card) !important;
        border:1px solid var(--border) !important;
        border-radius:24px !important;
        box-shadow:0 4px 15px rgba(0,0,0,.10) !important;
        color:var(--text) !important;
        font-family:var(--font-main) !important;
        height:52px !important; min-height:52px !important; max-height:52px !important;
        padding:0 6px 0 16px !important;
      }
      html body #topBarSplit .floating-search input{
        color:var(--text) !important; font-family:var(--font-main) !important;
        caret-color:var(--primary) !important;
      }
      html body #topBarSplit .floating-search input::placeholder{ color:var(--text-muted) !important; }
      /* X nho: dung --card-2 + --text-muted nhu .btn-clear-input / .settings-row */
      html body #topBarSplit .floating-search #searchClearBtn{
        background:var(--card-2) !important; color:var(--text-muted) !important;
      }
      /* Nut kinh lup: --primary #3b82f6, bong giong .fab-directions */
      html body #topBarSplit .floating-search #topSearchGoBtn{
        background:var(--primary) !important; color:#fff !important;
        box-shadow:0 6px 20px rgba(59,130,246,.40) !important;
      }
      /* Nut 3 gach: giong .fab-menu, bg var(--card) */
      html body #topBarSplit #mainMenuBtn, html body #topBarSplit #menuBtn, html body #topBarSplit .menu-btn{
        background:var(--card) !important; border:1px solid var(--border) !important;
        color:var(--text) !important; box-shadow:0 4px 15px rgba(0,0,0,.10) !important;
        font-family:var(--font-main) !important;
      }
      /* Goi y: dung top theo top bar moi, bg var(--card) nhu .suggestions-box */
      html body #suggestionsBox{
        top:calc(76px + var(--safe-top, 0px)) !important;
        background:var(--card) !important; border:1px solid var(--border) !important;
        font-family:var(--font-main) !important;
      }
      @media (max-width:640px){
        html body #topBarSplit{ left:12px !important; right:12px !important; }
      }

      /* ---------- BOTTOM SHEET: theo .dir-sheet / .poi-sheet ---------- */
      html body #homeBottomSheet{
        background:var(--card) !important;
        border:1px solid var(--border) !important; border-bottom:none !important;
        border-radius:20px 20px 0 0 !important;
        box-shadow:0 -10px 30px rgba(0,0,0,.20) !important;
        backdrop-filter:none !important; -webkit-backdrop-filter:none !important;
        padding:12px 16px calc(12px + var(--safe-bottom, 0px)) !important;
        font-family:var(--font-main) !important;
      }
      html body #homeBottomSheet .hb-handle{
        width:36px !important; height:4px !important; background:var(--border) !important;
      }
      html body #homeBottomSheet .hb-title{ color:var(--text) !important; font-family:var(--font-main) !important; }
      html body #homeBottomSheet .hb-subtitle{ color:var(--text-muted) !important; }
      html body #homeBottomSheet .hb-toggle{
        background:var(--card-2) !important; color:var(--text-muted) !important;
        border:1px solid var(--border) !important;
      }
      html body #homeBottomSheet .hb-action:active{ background:var(--bg-2) !important; }
      html body #homeBottomSheet .hb-label{ color:var(--text) !important; font-family:var(--font-main) !important; }

      /* Icon 5 nut: dung dung palette styles.css, khong dung palette Google nua */
      /* Chi duong: primary, giong .fab-rest-stop-filter / .layer-option.active */
      html body #homeBottomSheet .hb-icon--dir{
        background:linear-gradient(135deg,#3b82f6,#1d4ed8) !important;
        box-shadow:0 4px 15px rgba(59,130,246,.50) !important;
      }
      /* Quanh day: success, giong .poi-btn.save */
      html body #homeBottomSheet .hb-icon--nearby{
        background:linear-gradient(135deg,#10b981,#059669) !important;
        box-shadow:0 4px 15px rgba(16,185,129,.45) !important;
      }
      /* Them dia diem: warning, giong .hud-btn.swap */
      html body #homeBottomSheet .hb-icon--place{
        background:linear-gradient(135deg,#fbbf24,#f59e0b) !important;
        box-shadow:0 4px 15px rgba(245,158,11,.45) !important;
      }
      /* Them POI: voice, giong .profile-header gradient primary->voice */
      html body #homeBottomSheet .hb-icon--poi{
        background:linear-gradient(135deg,#a78bfa,#8b5cf6) !important;
        box-shadow:0 4px 15px rgba(139,92,246,.45) !important;
      }
      /* POI canh bao: danger -> orange, giong .fab-report */
      html body #homeBottomSheet .hb-icon--warn{
        background:linear-gradient(135deg,#ef4444,#f97316) !important;
        box-shadow:0 4px 15px rgba(239,68,68,.45) !important;
      }

      /* ---------- FAB CON LAI: day len bang translate, GIU khoang cach xep chong ---------- */
      /* styles.css: locate bottom 20, layers 80, compass 140, report 80, rest-stop 200 */
      /* Neu set tat ca bottom:168px thi locate + layers chong nhau -> dung translateY */
      html body:not(.navigating):not(.google-nav) #mainLocateBtn,
      html body:not(.navigating):not(.google-nav) #btnLayerMenu,
      html body:not(.navigating):not(.google-nav) #btnReport,
      html body:not(.navigating):not(.google-nav) #btnRestStopFilter,
      html body:not(.navigating):not(.google-nav) #btnCompass,
      html body:not(.navigating):not(.google-nav) .fab-compass{
        bottom:auto !important;
        transform:translateY(-150px) !important;
      }
      /* Layer menu mo tu nut Layers cung phai len tren sheet */
      html body .layer-menu{ bottom:calc(290px + var(--safe-bottom, 0px)) !important; }
      html body .zoom-hint-toast{ bottom:calc(300px + var(--safe-bottom, 0px)) !important; }

      @media (min-width:640px){
        html body #homeBottomSheet{ border-radius:20px 20px 0 0 !important; }
      }
    `;
    document.head.appendChild(st);
  }
  inject();
  // Dam bao sheet premium v3 da tao, neu chua co thi tao lai
  try{ if (!document.getElementById('homeBottomSheet') && typeof window.buildHomeBottomSheet === 'function') window.buildHomeBottomSheet(); }catch(e){}
  document.addEventListener('DOMContentLoaded', inject);
  setTimeout(inject, 500);
  window.applyStylesCssMapV4 = inject;
})();

/* ================= V5 ================= */
/* =====================================================
   DriveKit - FIX LOCATED ME v5 - 2026-11-22
   Tra lai nut "Vi tri cua toi" / #mainLocateBtn
   - NAM NGOAI bottom sheet, KHONG dua vao bottom sheet
   - Loi v4: inject CSS bottom:auto + translateY(-150px) -> nut mat
   - Fix: inject CSS moi GHI DE v4 (bottom cu the + transform:none)
     + watchdog hien lai nut neu updateUIState() an no
     + neu nut bi xoa mat khoi DOM thi tao lai, giu nguyen handler goc
   Cach dung: paste file nay SAU app-v4-styles-mapped.js (cuoi file / truoc </body>)
   ===================================================== */
(function fixLocatedMeV5(){
  if (window._fixLocatedMeV5Done) return; window._fixLocatedMeV5Done = true;

  /* 1. CSS ghi de v4 - phai chay SAU stylesMappedV4 nen append sau */
  function injectFixCSS(){
    let st = document.getElementById('fixLocatedMeV5');
    if (!st){
      st = document.createElement('style'); st.id = 'fixLocatedMeV5';
      document.head.appendChild(st);
    }
    st.textContent = `
      /* Ghi de #stylesMappedV4 bi loi bottom:auto */
      html body:not(.navigating):not(.google-nav) #mainLocateBtn,
      html body:not(.navigating):not(.google-nav) .fab-locate{
        display:flex !important; visibility:visible !important; opacity:1 !important; pointer-events:auto !important;
        position:fixed !important; left:16px !important; right:auto !important; top:auto !important;
        bottom:calc(168px + var(--safe-bottom, 0px)) !important;
        transform:none !important;
        width:50px !important; height:50px !important; min-width:50px !important; min-height:50px !important;
        border-radius:50% !important; background:var(--card) !important;
        border:1px solid var(--border) !important; color:var(--text) !important;
        align-items:center !important; justify-content:center !important;
        font-size:1.3rem !important; box-shadow:0 4px 15px rgba(0,0,0,.10) !important;
        z-index:1100 !important;
      }
      html body:not(.navigating):not(.google-nav) #btnLayerMenu,
      html body:not(.navigating):not(.google-nav) .fab-layers{
        bottom:calc(230px + var(--safe-bottom, 0px)) !important; transform:none !important;
      }
      html body:not(.navigating):not(.google-nav) #btnCompass,
      html body:not(.navigating):not(.google-nav) .fab-compass{
        bottom:calc(290px + var(--safe-bottom, 0px)) !important; transform:none !important;
      }
      html body:not(.navigating):not(.google-nav) #btnReport,
      html body:not(.navigating):not(.google-nav) .fab-report{
        bottom:calc(230px + var(--safe-bottom, 0px)) !important; transform:none !important;
      }
      html body:not(.navigating):not(.google-nav) #btnRestStopFilter,
      html body:not(.navigating):not(.google-nav) .fab-rest-stop-filter{
        bottom:calc(350px + var(--safe-bottom, 0px)) !important; transform:none !important;
      }
      /* Locate KHONG nam trong bottom sheet */
      #homeBottomSheet #mainLocateBtn, #homeBottomSheet .fab-locate{ display:none !important; }
    `;
  }

  /* 2. Tao lai nut neu bi xoa mat - giu nguyen id + class goc de handler cu an theo */
  function ensureLocatedBtn(){
    try{
      // Dang dan duong / google-nav thi de logic nav tu xu ly, khong ep hien o day
      if (document.body.classList.contains('navigating') || document.body.classList.contains('google-nav')) return;
      // Neu nut con trong bottom sheet (bi keo nham vao) thi loi ra ngoai body
      const inSheet = document.querySelector('#homeBottomSheet #mainLocateBtn, #homeBottomSheet .fab-locate');
      if (inSheet){
        inSheet.remove();
      }
      let btn = document.getElementById('mainLocateBtn');
      if (!btn){
        // Tim theo class neu id bi doi
        btn = document.querySelector('.fab-locate');
        if (btn) btn.id = 'mainLocateBtn';
      }
      if (!btn){
        btn = document.createElement('button');
        btn.id = 'mainLocateBtn';
        btn.className = 'fab-locate';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Vị trí của tôi');
        btn.title = 'Vị trí của tôi';
        btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
        document.body.appendChild(btn);
        // Gan lai handler: thu cac ham goc neu co, fallback ve geolocation + map
        btn.addEventListener('click', ()=>{
          try{
            if (typeof window.locateUser === 'function') return window.locateUser();
            if (typeof window.goToMyLocation === 'function') return window.goToMyLocation();
            if (typeof window.recenterToUser === 'function') return window.recenterToUser();
            if (typeof window.centerOnUser === 'function') return window.centerOnUser();
            if (typeof window.recenterToRouteView === 'function') return window.recenterToRouteView();
          }catch(e){}
          try{
            // Fallback: dung lastUserPos / geolocation de flyTo
            if (typeof lastUserPos !== 'undefined' && lastUserPos && lastUserPos.lat && typeof map !== 'undefined' && map){
              if (map.flyTo) return map.flyTo({ center:[lastUserPos.lng, lastUserPos.lat], zoom: Math.max(map.getZoom ? map.getZoom() : 16, 16) });
              if (map.setCenter) return map.setCenter({ lat:lastUserPos.lat, lng:lastUserPos.lng });
            }
          }catch(e){}
          try{
            if (navigator.geolocation){
              navigator.geolocation.getCurrentPosition((pos)=>{
                try{
                  if (typeof map !== 'undefined' && map && map.flyTo) map.flyTo({ center:[pos.coords.longitude, pos.coords.latitude], zoom:16 });
                }catch(e){}
              });
            }
          }catch(e){}
        });
      } else {
        // Nut con ton tai nhung bi an bang inline style (updateUIState) -> mo lai
        if (btn.style.display === 'none') btn.style.display = '';
        if (btn.style.visibility === 'hidden') btn.style.visibility = '';
        if (btn.style.opacity === '0') btn.style.opacity = '';
        btn.style.pointerEvents = '';
        // Dam bao khong bi bottom:auto / translateY(-150px) cua v4 con sot trong inline style
        if (btn.style.bottom === 'auto') btn.style.bottom = '';
        if (btn.style.transform) btn.style.transform = '';
        // Neu nut dang nam trong sheet (truong hop DOM bi move) -> dua ra body
        if (btn.closest && btn.closest('#homeBottomSheet')){
          document.body.appendChild(btn);
        }
        // Neu nut bi mat icon do innerHTML bi ghi de -> khoi phuc icon
        if (!btn.innerHTML || !btn.innerHTML.trim()){
          btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
        }
      }
    }catch(e){}
  }

  /* 3. Chay + watchdog: v4 inject lai sau 500ms nen phai inject sau no + kiem tra dinh ky */
  function run(){
    injectFixCSS();
    ensureLocatedBtn();
  }
  run();
  document.addEventListener('DOMContentLoaded', run);
  setTimeout(run, 100);
  setTimeout(run, 500);   // sau v4 inject
  setTimeout(run, 1000);
  // Thay watchdog getComputedStyle 1.5s bang MutationObserver: chi kiem tra khi class cua body doi
  try{ const _obs5 = new MutationObserver(()=>{ try{ if (document.body.classList.contains('navigating') || document.body.classList.contains('google-nav')) return; const btn = document.getElementById('mainLocateBtn') || document.querySelector('.fab-locate'); if (!btn) { ensureLocatedBtn(); injectFixCSS(); } }catch(e){} }); _obs5.observe(document.body, { attributes:true, attributeFilter:['class'] }); }catch(e){}
  // Bam vao search / menu / dong sheet xong thi hien lai ngay
  document.addEventListener('click', (e)=>{
    try{
      const t = e.target && e.target.closest ? e.target.closest('#hbToggle, #hbHandle, #mainMenuBtn, .floating-search, #searchClearBtn, #topSearchGoBtn') : null;
      if (t) setTimeout(run, 120);
    }catch(e){}
  });
})();

/* ================= V6 ================= */
/* =====================================================
   DriveKit - FIX LA BAN + LOCATED v6 - 2026-11-22
   Tra lai nut La ban #btnCompass + Vi tri #mainLocateBtn
   - CA 2 DEU NAM NGOAI bottom sheet, KHONG dua vao sheet
   - Loi v4: inject bottom:auto + translateY(-150px) -> ca 2 nut bay mat
   - Fix: inject CSS moi SAU v4 (bottom cu the + transform:none)
     + watchdog hien lai neu bi an
     + neu nut bi xoa mat khoi DOM thi tao lai, giu nguyen id/class goc
   Cach dung: paste file nay SAU app-v4 + app-v5 (cuoi file / truoc </body>)
   Neu da co v5 thi chi can them v6 nay, no fix ca 2 nut luon.
   ===================================================== */
(function fixFabV6(){
  if (window._fixFabV6Done) return; window._fixFabV6Done = true;

  function injectFixCSS(){
    let st = document.getElementById('fixFabV6');
    if (!st){ st = document.createElement('style'); st.id = 'fixFabV6'; document.head.appendChild(st); }
    st.textContent = `
      html body:not(.navigating):not(.google-nav) #mainLocateBtn,
      html body:not(.navigating):not(.google-nav) .fab-locate{
        display:flex !important; visibility:visible !important; opacity:1 !important; pointer-events:auto !important;
        position:fixed !important; left:16px !important; right:auto !important; top:auto !important;
        bottom:calc(168px + var(--safe-bottom, 0px)) !important; transform:none !important;
        width:50px !important; height:50px !important; border-radius:50% !important;
        background:var(--card) !important; border:1px solid var(--border) !important; color:var(--text) !important;
        z-index:1100 !important;
      }
      html body:not(.navigating):not(.google-nav) #btnCompass,
      html body:not(.navigating):not(.google-nav) .fab-compass{
        display:flex !important; visibility:visible !important; opacity:1 !important; pointer-events:auto !important;
        position:fixed !important; left:16px !important; right:auto !important; top:auto !important;
        bottom:calc(290px + var(--safe-bottom, 0px)) !important; transform:none !important;
        width:52px !important; height:52px !important; border-radius:50% !important;
        background:rgba(30,41,59,.7) !important; backdrop-filter:blur(10px) !important;
        border:1px solid rgba(255,255,255,.1) !important; color:var(--text) !important;
        z-index:1100 !important;
      }
      html body:not(.navigating):not(.google-nav) #btnLayerMenu,
      html body:not(.navigating):not(.google-nav) .fab-layers{
        bottom:calc(230px + var(--safe-bottom, 0px)) !important; transform:none !important;
      }
      html body:not(.navigating):not(.google-nav) #btnReport,
      html body:not(.navigating):not(.google-nav) .fab-report{
        bottom:calc(230px + var(--safe-bottom, 0px)) !important; transform:none !important;
      }
      html body:not(.navigating):not(.google-nav) #btnRestStopFilter,
      html body:not(.navigating):not(.google-nav) .fab-rest-stop-filter{
        bottom:calc(350px + var(--safe-bottom, 0px)) !important; transform:none !important;
      }
      html body #btnCompass #compassNeedle, html body #btnCompass .compass-needle{
        display:block !important; visibility:visible !important; opacity:1 !important;
        width:24px !important; height:24px !important;
      }
      #homeBottomSheet #btnCompass, #homeBottomSheet .fab-compass,
      #homeBottomSheet #mainLocateBtn, #homeBottomSheet .fab-locate{ display:none !important; }
    `;
  }

  function clearBadInline(el){
    if (!el) return;
    if (el.style.display === 'none') el.style.display = '';
    if (el.style.visibility === 'hidden') el.style.visibility = '';
    if (el.style.opacity === '0') el.style.opacity = '';
    el.style.pointerEvents = '';
    if (el.style.bottom === 'auto') el.style.bottom = '';
    if (el.style.transform) el.style.transform = '';
    if (el.closest && el.closest('#homeBottomSheet')) document.body.appendChild(el);
  }

  function ensureCompass(){
    try{
      if (document.body.classList.contains('navigating') || document.body.classList.contains('google-nav')) return;
      // Neu la ban bi keo nham vao sheet thi loi ra
      const inSheet = document.querySelector('#homeBottomSheet #btnCompass, #homeBottomSheet .fab-compass');
      if (inSheet) inSheet.remove();

      let btn = document.getElementById('btnCompass');
      if (!btn){
        btn = document.querySelector('.fab-compass');
        if (btn) btn.id = 'btnCompass';
      }
      if (!btn){
        btn = document.createElement('button');
        btn.id = 'btnCompass';
        btn.className = 'fab-compass';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'La bàn - Về hướng Bắc');
        btn.title = 'La bàn - Bấm để về hướng Bắc';
        // Giong cau truc goc: .compass-bg + #compassNeedle (de updateCompassNeedle() xoay duoc)
        btn.innerHTML = '<div class="compass-bg"></div>'
          + '<svg id="compassNeedle" class="compass-needle" width="24" height="24" viewBox="0 0 24 24" fill="none">'
          + '<path d="M12 2 L15.5 12 L12 10 L8.5 12 Z" fill="#ef4444"/>'
          + '<path d="M12 22 L15.5 12 L12 14 L8.5 12 Z" fill="#e5e7eb"/>'
          + '<circle cx="12" cy="12" r="1.8" fill="#fff"/></svg>';
        document.body.appendChild(btn);
      } else {
        clearBadInline(btn);
        if (!btn.innerHTML || !btn.innerHTML.trim()){
          btn.innerHTML = '<div class="compass-bg"></div>'
            + '<svg id="compassNeedle" class="compass-needle" width="24" height="24" viewBox="0 0 24 24" fill="none">'
            + '<path d="M12 2 L15.5 12 L12 10 L8.5 12 Z" fill="#ef4444"/>'
            + '<path d="M12 22 L15.5 12 L12 14 L8.5 12 Z" fill="#e5e7eb"/>'
            + '<circle cx="12" cy="12" r="1.8" fill="#fff"/></svg>';
        }
      }
      // Dam bao kim la ban ton tai - neu mat thi tao lai trong nut
      let needle = document.getElementById('compassNeedle');
      if (!needle){
        needle = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        needle.setAttribute('id', 'compassNeedle');
        needle.setAttribute('class', 'compass-needle');
        needle.setAttribute('width', '24'); needle.setAttribute('height', '24');
        needle.setAttribute('viewBox', '0 0 24 24');
        needle.innerHTML = '<path d="M12 2 L15.5 12 L12 10 L8.5 12 Z" fill="#ef4444"/><path d="M12 22 L15.5 12 L12 14 L8.5 12 Z" fill="#e5e7eb"/><circle cx="12" cy="12" r="1.8" fill="#fff"/>';
        btn.appendChild(needle);
      }
      // Gan click 1 lan: bam la ban -> ve huong Bac (giong window.resetNorth goc)
      if (!btn._fixCompassV6){
        btn._fixCompassV6 = true;
        btn.addEventListener('click', ()=>{
          try{
            if (typeof window.resetNorth === 'function') return window.resetNorth();
            if (typeof map !== 'undefined' && map && map.easeTo) return map.easeTo({ bearing: 0, pitch: 0, duration: 600 });
          }catch(e){}
        });
      }
      // Cap nhat kim ngay neu map co bearing
      try{
        if (typeof map !== 'undefined' && map && map.getBearing && needle){
          needle.style.transform = 'rotate(' + (-map.getBearing()) + 'deg)';
        }
      }catch(e){}
    }catch(e){}
  }

  function ensureLocate(){
    try{
      if (document.body.classList.contains('navigating') || document.body.classList.contains('google-nav')) return;
      const inSheet = document.querySelector('#homeBottomSheet #mainLocateBtn, #homeBottomSheet .fab-locate');
      if (inSheet) inSheet.remove();
      let btn = document.getElementById('mainLocateBtn');
      if (!btn){
        btn = document.querySelector('.fab-locate');
        if (btn) btn.id = 'mainLocateBtn';
      }
      if (!btn){
        btn = document.createElement('button');
        btn.id = 'mainLocateBtn'; btn.className = 'fab-locate'; btn.type = 'button';
        btn.setAttribute('aria-label', 'Vị trí của tôi'); btn.title = 'Vị trí của tôi';
        btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
        document.body.appendChild(btn);
        btn.addEventListener('click', ()=>{
          try{
            if (typeof window.locateUser === 'function') return window.locateUser();
            if (typeof window.goToMyLocation === 'function') return window.goToMyLocation();
            if (typeof window.recenterToUser === 'function') return window.recenterToUser();
          }catch(e){}
          try{
            if (typeof lastUserPos !== 'undefined' && lastUserPos && lastUserPos.lat && typeof map !== 'undefined' && map && map.flyTo){
              return map.flyTo({ center:[lastUserPos.lng, lastUserPos.lat], zoom:16 });
            }
          }catch(e){}
        });
      } else {
        clearBadInline(btn);
        if (!btn.innerHTML || !btn.innerHTML.trim()) btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>';
      }
    }catch(e){}
  }

  function run(){ injectFixCSS(); ensureCompass(); ensureLocate(); }
  run();
  document.addEventListener('DOMContentLoaded', run);
  setTimeout(run, 100);
  setTimeout(run, 500);
  setTimeout(run, 1000);
  // Thay watchdog getComputedStyle 1.5s bang MutationObserver: chi kiem tra khi class cua body doi
  try{ const _obs6 = new MutationObserver(()=>{ try{ if (document.body.classList.contains('navigating') || document.body.classList.contains('google-nav')) return; if (!document.getElementById('btnCompass') || !document.getElementById('mainLocateBtn')) run(); }catch(e){} }); _obs6.observe(document.body, { attributes:true, attributeFilter:['class'] }); }catch(e){}
  document.addEventListener('click', (e)=>{
    try{
      const t = e.target && e.target.closest ? e.target.closest('#hbToggle, #hbHandle, #mainMenuBtn, .floating-search, #searchClearBtn, #topSearchGoBtn') : null;
      if (t) setTimeout(run, 120);
    }catch(e){}
  });
})();

/* ================= V7 ================= */
/* =====================================================
   DriveKit - V7 SHEET NOI + CUM FAB DINH LIEN - 2026-11-22
   Van de cu: La ban cach Vi tri 122px, sheet bit kin day, map bi che
   Moi:
   - Sheet: floating card (cach day 12px, bo 28px), thu gon chi con header
   - Cum trai: [La ban | - | Vi tri] trong 1 pill dung, gap 2px, dinh sat mep tren sheet
   - Cum phai: [Layers | Bao cao | Tram dung] trong 1 pill dung, doi xung
   - CA 2 CUM NAM NGOAI bottom sheet (DOM rieng), chi nhin nhu dinh vao sheet
   - Cum tu ha / nang theo sheet khi mo / thu gon (JS tinh bottom = sheet height + 16)
   Cach dung: paste SAU v4 + v5 + v6
   ===================================================== */
(function fabClusterV7(){
  if (window._fabClusterV7Done) return; window._fabClusterV7Done = true;

  function injectCSS(){
    let st = document.getElementById('fabClusterV7');
    if (!st){ st = document.createElement('style'); st.id = 'fabClusterV7'; document.head.appendChild(st); }
    st.textContent = `
      html body:not(.navigating):not(.google-nav) #homeBottomSheet{
        left:12px !important; right:12px !important; bottom:calc(12px + var(--safe-bottom, 0px)) !important;
        border-radius:28px !important; border:1px solid var(--border) !important;
        box-shadow:0 12px 32px rgba(0,0,0,.22) !important; backdrop-filter:blur(12px) !important;
      }
      html body:not(.navigating):not(.google-nav) #fabClusterLeft,
      html body:not(.navigating):not(.google-nav) #fabClusterRight{
        position:fixed !important; z-index:1100 !important; display:flex !important; flex-direction:column !important; gap:2px !important;
        background:var(--card) !important; border:1px solid var(--border) !important;
        border-radius:28px !important; padding:4px !important; box-shadow:0 8px 24px rgba(0,0,0,.18) !important;
      }
      html body:not(.navigating):not(.google-nav) #fabClusterLeft{ left:16px !important; }
      html body:not(.navigating):not(.google-nav) #fabClusterRight{ right:16px !important; }
      html body:not(.navigating):not(.google-nav) #fabClusterLeft #btnCompass,
      html body:not(.navigating):not(.google-nav) #fabClusterLeft #mainLocateBtn,
      html body:not(.navigating):not(.google-nav) #fabClusterRight #btnLayerMenu,
      html body:not(.navigating):not(.google-nav) #fabClusterRight #btnReport,
      html body:not(.navigating):not(.google-nav) #fabClusterRight #btnRestStopFilter{
        position:static !important; bottom:auto !important; transform:none !important;
        width:48px !important; height:48px !important; border-radius:50% !important;
        border:none !important; box-shadow:none !important; background:transparent !important;
        display:flex !important; visibility:visible !important; opacity:1 !important;
      }
      html body:not(.navigating):not(.google-nav) #fabClusterLeft #mainLocateBtn{ background:var(--card-2) !important; }
      html body:not(.navigating):not(.google-nav) #fabClusterRight #btnReport{
        background:linear-gradient(135deg,var(--danger),#f97316) !important; color:#fff !important;
      }
      html body #fabClusterLeft .fab-divider, html body #fabClusterRight .fab-divider{
        height:1px !important; background:var(--border) !important; margin:2px 10px !important;
      }
      #homeBottomSheet #fabClusterLeft, #homeBottomSheet #fabClusterRight{ display:none !important; }
    `;
  }

  function getBtn(id, cls){
    let b = document.getElementById(id);
    if (!b && cls) b = document.querySelector(cls);
    if (b && !b.id) b.id = id;
    return b;
  }

  function ensureClusters(){
    try{
      if (document.body.classList.contains('navigating') || document.body.classList.contains('google-nav')) return;
      // Neu cum bi keo nham vao sheet thi loi ra body
      const inSheet = document.querySelector('#homeBottomSheet #fabClusterLeft, #homeBottomSheet #fabClusterRight');
      if (inSheet) inSheet.remove();

      let left = document.getElementById('fabClusterLeft');
      if (!left){ left = document.createElement('div'); left.id = 'fabClusterLeft'; document.body.appendChild(left); }
      let right = document.getElementById('fabClusterRight');
      if (!right){ right = document.createElement('div'); right.id = 'fabClusterRight'; document.body.appendChild(right); }

      // Cum trai: La ban tren, Vi tri duoi - move giu nguyen handler (appendChild khong mat listener)
      const compass = getBtn('btnCompass', '.fab-compass');
      const locate = getBtn('mainLocateBtn', '.fab-locate');
      if (compass && compass.parentNode !== left) left.appendChild(compass);
      if (locate && locate.parentNode !== left) left.appendChild(locate);
      // Divider giua 2 nut, chi tao 1 lan
      if (compass && locate && !left.querySelector('.fab-divider')){
        const div = document.createElement('div'); div.className = 'fab-divider';
        left.insertBefore(div, locate);
      }
      // Dam bao thu tu: La ban -> divider -> Vi tri
      if (compass && locate){
        if (left.firstChild !== compass) left.insertBefore(compass, left.firstChild);
        const div = left.querySelector('.fab-divider');
        if (div && div.nextSibling !== locate) left.insertBefore(div, locate);
      }
      // Xoa inline style cu (bottom:auto / translateY / display:none) de pill quan ly
      [compass, locate].forEach(b=>{
        if (!b) return;
        if (b.style.bottom === 'auto') b.style.bottom = '';
        if (b.style.transform) b.style.transform = '';
        if (b.style.display === 'none') b.style.display = '';
        if (b.style.position === 'fixed') b.style.position = '';
        b.style.left = ''; b.style.right = '';
      });

      // Cum phai: Layers -> Bao cao -> Tram dung
      const layers = getBtn('btnLayerMenu', '.fab-layers');
      const report = getBtn('btnReport', '.fab-report');
      const rest = getBtn('btnRestStopFilter', '.fab-rest-stop-filter');
      [layers, report, rest].forEach(b=>{
        if (b && b.parentNode !== right) right.appendChild(b);
        if (!b) return;
        if (b.style.bottom === 'auto') b.style.bottom = '';
        if (b.style.transform) b.style.transform = '';
        if (b.style.display === 'none') b.style.display = '';
        b.style.position = ''; b.style.left = ''; b.style.right = '';
      });
      // Divider giua cac nut phai
      if (layers && report && !right.querySelector('.fab-divider')){
        // Them 2 divider: sau Layers, sau Report
        const d1 = document.createElement('div'); d1.className = 'fab-divider';
        const d2 = document.createElement('div'); d2.className = 'fab-divider';
        right.insertBefore(d1, report);
        right.insertBefore(d2, rest);
      }

      updateClusterBottom();
    }catch(e){}
  }

  function updateClusterBottom(){
    try{
      const sheet = document.getElementById('homeBottomSheet');
      const left = document.getElementById('fabClusterLeft');
      const right = document.getElementById('fabClusterRight');
      if (!sheet || !left) return;
      if (document.body.classList.contains('navigating') || document.body.classList.contains('google-nav')) return;
      // Sheet noi: bottom 12 + safe-bottom, chieu cao thuc te + 16 gap = cum dinh sat mep tren sheet
      const h = sheet.offsetHeight || 140;
      const safe = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom') || '0', 10) || 0;
      const bottom = 12 + safe + h + 12; // 12 (sheet bottom) + h + 12 gap
      left.style.bottom = bottom + 'px';
      if (right) right.style.bottom = bottom + 'px';
      // Khi sheet thu gon (chi con header) thi cum tu ha xuong, khong treo lo lung giua map
      // Khi sheet an (hb-hidden) thi cum cung ha xuong sat day
      if (sheet.classList.contains('hb-hidden')){
        left.style.bottom = 'calc(28px + var(--safe-bottom, 0px))';
        if (right) right.style.bottom = 'calc(28px + var(--safe-bottom, 0px))';
      }
    }catch(e){}
  }

  function run(){ injectCSS(); ensureClusters(); setTimeout(updateClusterBottom, 50); setTimeout(updateClusterBottom, 300); }
  run();
  document.addEventListener('DOMContentLoaded', run);
  setTimeout(run, 200); setTimeout(run, 800); setTimeout(run, 1500);
  // Sheet thu / mo -> cum chay theo sheet (transition mem)
  document.addEventListener('click', (e)=>{
    try{
      const t = e.target && e.target.closest ? e.target.closest('#hbToggle, #hbHandle, #homeBottomSheet .hb-head') : null;
      if (t){ setTimeout(updateClusterBottom, 30); setTimeout(updateClusterBottom, 320); }
    }catch(e){}
  });
  // Theo doi sheet doi class hb-collapsed / hb-hidden
  try{
    const obs = new MutationObserver(()=> setTimeout(updateClusterBottom, 30));
    const sheet = document.getElementById('homeBottomSheet');
    if (sheet) obs.observe(sheet, { attributes:true, attributeFilter:['class'] });
    else setTimeout(()=>{ const s2 = document.getElementById('homeBottomSheet'); if (s2) obs.observe(s2, { attributes:true, attributeFilter:['class'] }); }, 1000);
  }catch(e){}
  window.addEventListener('resize', updateClusterBottom);
  // Thay watchdog 2s bang MutationObserver debounce: chi kiem tra khi DOM body thay doi
  try{ let _v7T = null; const _obs7 = new MutationObserver(()=>{ if (_v7T) return; _v7T = setTimeout(()=>{ _v7T = null; try{ if (document.body.classList.contains('navigating') || document.body.classList.contains('google-nav')) return; const compass = document.getElementById('btnCompass'); const locate = document.getElementById('mainLocateBtn'); const left = document.getElementById('fabClusterLeft'); if (!left || (compass && compass.parentNode !== left) || (locate && locate.parentNode !== left)) ensureClusters(); else updateClusterBottom(); }catch(e){} }, 100); }); _obs7.observe(document.body, { childList:true, subtree:false }); }catch(e){}
  window.updateFabClusterV7 = updateClusterBottom;
})();


/* ================= V8 ROUTE PREVIEW ================= */
/* =====================================================
   DriveKit - V8 ROUTE PREVIEW GIONG GOOGLE MAPS - 2026-11-22
   Flow moi:
   - Bam Chi duong / fetchAndShowRouteOptions() -> hien preview, KHONG dan ngay
   - Map: 3 tuyen cung luc, moi tuyen co nhan "9 phut" + so 1 2 3
     + Tuyen duoc chon: tim dam #4338CA/#1d4ed8, width 9, pill xanh dam
     + Tuyen chua chon: xanh nhat #93c5fd / xam, width 5, pill trang
   - Bam vao tuyen / chip 1 2 3 / nhan tren map -> chi DOI tuyen duoc chon, chua dan
   - Bam Bat dau -> moi dan tuyen da chon (giong selectRouteOption cu)
   - Bam X / dong -> huy preview, ve map binh thuong
   Ghi de: fetchAndShowRouteOptions, selectRouteOption, closeRouteOptions
   Cach dung: paste SAU app.js FULL (v4+v5+v6+v7)
   ===================================================== */
(function routePreviewV8(){
  if (window._routePreviewV8Done) return; window._routePreviewV8Done = true;

  let previewRoutes = [];
  let previewSelected = 0;
  let previewMarkers = [];
  let previewFetching = false;

  function isNav(){
    try{
      return (typeof isNavigating !== 'undefined' && isNavigating) ||
        (document.body && (document.body.classList.contains('google-nav') || document.body.classList.contains('navigating')));
    }catch(e){ return false; }
  }
  function fmtDist(m){ return (m/1000).toFixed(1) + ' km'; }
  function fmtDur(s){
    const min = Math.round(s/60);
    if (min < 60) return min + ' phút';
    const h = Math.floor(min/60), m = min % 60;
    return h + ' giờ' + (m ? ' ' + m + ' phút' : '');
  }
  function vehicleName(){
    try{
      const mode = (typeof currentVehicleMode !== 'undefined' && currentVehicleMode) || 'motorcycle';
      if (typeof VEHICLE_LABELS !== 'undefined' && VEHICLE_LABELS[mode]) {
        const label = VEHICLE_LABELS[mode];
        // Giong anh: "Xe mo to hai banh..." - giu nguyen label goc, them "hai banh" cho xe may
        if (mode === 'motorcycle') return 'Xe mô tô hai bánh';
        return 'Xe ' + label;
      }
      return 'Xe mô tô hai bánh';
    }catch(e){ return 'Xe mô tô hai bánh'; }
  }
  function vehicleIcon(){
    try{
      const mode = (typeof currentVehicleMode !== 'undefined' && currentVehicleMode) || 'motorcycle';
      if (mode === 'walking') return '🚶';
      if (mode === 'bicycle') return '🚲';
      if (mode === 'bus') return '🚌';
      if (mode === 'truck') return '🚚';
      if (mode === 'driving' || mode === 'driving-traffic' || mode === 'hd') return '🚗';
      return '🏍️';
    }catch(e){ return '🏍️'; }
  }

  /* --- Sheet preview --- */
  function ensureSheet(){
    let sheet = document.getElementById('routePreviewSheet');
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.id = 'routePreviewSheet';
    sheet.innerHTML = `
      <div class="rp-handle"></div>
      <div class="rp-top">
        <div class="rp-vehicle">
          <span class="rp-vehicle-icon" id="rpVehicleIcon">🏍️</span>
          <span class="rp-vehicle-text">
            <span class="rp-vehicle-name" id="rpVehicleName">Xe mô tô hai bánh</span>
            <span class="rp-vehicle-sub" id="rpVehicleSub">—</span>
          </span>
        </div>
        <div class="rp-top-btns">
          <button type="button" class="rp-icon-btn" id="rpShareBtn" title="Chia sẻ">↗</button>
          <button type="button" class="rp-icon-btn" id="rpCloseBtn" title="Đóng">✕</button>
        </div>
      </div>
      <div class="rp-chips" id="rpChips"></div>
      <div class="rp-actions">
        <button type="button" class="rp-start-btn" id="rpStartBtn">▶&nbsp;Bắt đầu</button>
        <button type="button" class="rp-action-btn" id="rpAddStopBtn">📍&nbsp;Thêm điểm dừng</button>
        <button type="button" class="rp-action-btn" id="rpShareBtn2">↗&nbsp;Chia sẻ</button>
      </div>
    `;
    document.body.appendChild(sheet);
    // Bắt đầu -> dan tuyen da chon
    sheet.querySelector('#rpStartBtn').addEventListener('click', confirmStartSelected);
    // Đóng
    sheet.querySelector('#rpCloseBtn').addEventListener('click', closePreview);
    // Chia sẻ
    const doShare = ()=>{
      try{
        if (typeof window.shareRoute === 'function') return window.shareRoute();
        if (navigator.share) return navigator.share({ title:'DriveKit', text:'Tuyến đường DriveKit', url: location.href });
        if (typeof showCustomToast === 'function') showCustomToast('Đã copy link tuyến đường', 'success');
      }catch(e){}
    };
    sheet.querySelector('#rpShareBtn').addEventListener('click', doShare);
    sheet.querySelector('#rpShareBtn2').addEventListener('click', doShare);
    // Thêm điểm dừng -> mo dirSheet / goi ham goc neu co
    sheet.querySelector('#rpAddStopBtn').addEventListener('click', ()=>{
      try{
        const ds = document.getElementById('dirSheet');
        if (ds) ds.classList.add('open');
        if (typeof showCustomToast === 'function') showCustomToast('Thêm điểm dừng trong ô Điểm đến', 'info');
      }catch(e){}
    });
    return sheet;
  }

  function openSheet(){
    const s = ensureSheet();
    s.classList.add('rp-open');
    document.body.classList.add('rp-preview-open');
  }
  function closePreview(){
    try{
      const s = document.getElementById('routePreviewSheet');
      if (s) s.classList.remove('rp-open');
      document.body.classList.remove('rp-preview-open');
      clearPreviewLayers();
      // Hien lai sheet Tinh nang nhanh
      const home = document.getElementById('homeBottomSheet');
      if (home) home.classList.remove('hb-hidden');
    }catch(e){}
  }

  /* --- Map: xoa + ve lai preview --- */
  function clearPreviewLayers(){
    try{
      // Xoa layer/source preview cu (route-opt-*)
      if (typeof map !== 'undefined' && map){
        // Lay danh sach layer hien co de xoa an toan
        let layers = [];
        try{ layers = map.getStyle ? Object.keys(map.getStyle().layers || {}).map(k=>map.getStyle().layers[k].id) : []; }catch(e){}
        // Fallback: thu xoa toi 8 index
        for (let i=0;i<8;i++){
          ['route-opt-layer-','rp-route-layer-','rp-route-casing-'].forEach(prefix=>{
            const id = prefix + i;
            try{ if (map.getLayer(id)) map.removeLayer(id); }catch(e){}
          });
          ['route-opt-src-','rp-route-src-'].forEach(prefix=>{
            const id = prefix + i;
            try{ if (map.getSource(id)) map.removeSource(id); }catch(e){}
          });
        }
        // Neu getStyle lay duoc thi xoa het rp-*
        layers.forEach(id=>{
          if (id && id.indexOf('rp-route-')===0){
            try{ if (map.getLayer(id)) map.removeLayer(id); }catch(e){}
          }
        });
      }
    }catch(e){}
    try{
      previewMarkers.forEach(m=>{ try{ m.remove(); }catch(e){} });
      previewMarkers = [];
    }catch(e){}
    try{
      if (typeof routeOptionBadges !== 'undefined' && Array.isArray(routeOptionBadges)){
        routeOptionBadges.forEach(m=>{ try{ m.remove(); }catch(e){} });
        routeOptionBadges = [];
      }
    }catch(e){}
    try{ if (typeof clearRouteOptionLayers === 'function') clearRouteOptionLayers(); }catch(e){}
  }

  function drawPreviewRoutes(){
    try{
      if (typeof map === 'undefined' || !map || !previewRoutes.length) return;
      clearPreviewLayers();
      const bounds = new maplibregl.LngLatBounds();
      // Ve tuyen chua chon truoc, tuyen duoc chon sau de nam tren
      const order = previewRoutes.map((_,i)=>i).filter(i=>i!==previewSelected).concat([previewSelected]);
      order.forEach(index=>{
        const r = previewRoutes[index];
        if (!r || !r.geometry || !r.geometry.coordinates) return;
        const lngLat = r.geometry.coordinates.map(c=>[c[1], c[0]]);
        lngLat.forEach(p=> bounds.extend(p));
        const isSel = index === previewSelected;
        // Casing trang cho tuyen duoc chon de noi tren nen map
        if (isSel){
          map.addSource('rp-route-src-' + index + '-casing', { type:'geojson', data:{ type:'Feature', geometry:{ type:'LineString', coordinates: lngLat } } });
          map.addLayer({ id:'rp-route-casing-' + index, type:'line', source:'rp-route-src-' + index + '-casing', layout:{ 'line-join':'round', 'line-cap':'round' }, paint:{ 'line-color':'#ffffff', 'line-width':13, 'line-opacity':0.95 } });
        }
        map.addSource('rp-route-src-' + index, { type:'geojson', data:{ type:'Feature', geometry:{ type:'LineString', coordinates: lngLat } } });
        map.addLayer({
          id:'rp-route-layer-' + index, type:'line', source:'rp-route-src-' + index,
          layout:{ 'line-join':'round', 'line-cap':'round' },
          paint:{
            'line-color': isSel ? '#4338ca' : '#93c5fd',
            'line-width': isSel ? 9 : 5,
            'line-opacity': isSel ? 1 : 0.85
          }
        });
        map.on('click', 'rp-route-layer-' + index, ()=> selectPreviewRoute(index));
        // Nhan tren map: so 1 2 3 + "9 phut" o giua tuyen (lay diem 45% de tranh chong nhau)
        const midIdx = Math.floor(lngLat.length * 0.45);
        const mid = lngLat[midIdx] || lngLat[Math.floor(lngLat.length/2)];
        const el = document.createElement('div');
        el.className = 'rp-map-marker' + (isSel ? ' rp-selected' : '');
        const color = (typeof ROUTE_COLORS !== 'undefined' && ROUTE_COLORS[index % ROUTE_COLORS.length]) || '#3b82f6';
        el.innerHTML = `<span class="rp-map-num" style="background:${isSel ? '#4338ca' : color};">${index+1}</span><span class="rp-map-time">⏱ ${fmtDur(r.duration)}</span>`;
        el.addEventListener('click', (e)=>{ e.stopPropagation(); selectPreviewRoute(index); });
        const marker = new maplibregl.Marker({ element: el }).setLngLat(mid).addTo(map);
        previewMarkers.push(marker);
      });
      try{ map.fitBounds(bounds, { padding:{ top:90, bottom:300, left:40, right:40 }, maxZoom:17 }); }catch(e){}
    }catch(e){ console.warn('drawPreviewRoutes', e); }
  }

  /* --- Chon tuyen trong preview: chi doi highlight, KHONG dan ngay --- */
  function selectPreviewRoute(index){
    try{
      if (isNav()){
        if (typeof showCustomToast === 'function') showCustomToast('Đang dẫn đường - đi sai hệ thống sẽ tự đổi', 'info');
        return;
      }
      if (index < 0 || index >= previewRoutes.length) return;
      previewSelected = index;
      // Ve lai mau + pill
      drawPreviewRoutes();
      renderPreviewSheet();
    }catch(e){}
  }

  function renderPreviewSheet(){
    try{
      const sheet = ensureSheet();
      const r = previewRoutes[previewSelected];
      if (!r) return;
      const iconEl = sheet.querySelector('#rpVehicleIcon');
      const nameEl = sheet.querySelector('#rpVehicleName');
      const subEl = sheet.querySelector('#rpVehicleSub');
      if (iconEl) iconEl.textContent = vehicleIcon();
      if (nameEl) nameEl.textContent = vehicleName();
      if (subEl) subEl.textContent = fmtDur(r.duration) + ' • ' + fmtDist(r.distance) + ' • Tuyến ' + (previewSelected+1);
      // Chips 1 2 3
      const chipsEl = sheet.querySelector('#rpChips');
      if (chipsEl){
        chipsEl.innerHTML = previewRoutes.map((rr, i)=>{
          const color = (typeof ROUTE_COLORS !== 'undefined' && ROUTE_COLORS[i % ROUTE_COLORS.length]) || '#3b82f6';
          const active = i === previewSelected ? ' rp-chip-active' : '';
          const best = i === 0 ? ' • Đề xuất' : '';
          return `<button type="button" class="rp-chip${active}" data-rp-index="${i}">
            <span class="rp-chip-num" style="background:${i===previewSelected ? '#4338ca' : color};">${i+1}</span>
            <span class="rp-chip-info"><span class="rp-chip-time">Tuyến ${i+1} • ${fmtDur(rr.duration)}${best}</span><span class="rp-chip-dist">${fmtDist(rr.distance)}</span></span>
          </button>`;
        }).join('');
        chipsEl.querySelectorAll('.rp-chip').forEach(btn=>{
          btn.addEventListener('click', ()=>{
            const idx = parseInt(btn.getAttribute('data-rp-index'), 10);
            selectPreviewRoute(idx);
          });
        });
      }
      openSheet();
    }catch(e){}
  }

  /* --- Bat dau: dan tuyen da chon --- */
  function confirmStartSelected(){
    try{
      if (isNav()) return;
      const r = previewRoutes[previewSelected];
      if (!r || !r.geometry || !r.geometry.coordinates || !r.geometry.coordinates.length){
        if (typeof showCustomToast === 'function') showCustomToast('Tuyến này đã hết, đang tải lại...', 'warning');
        fetchPreview();
        return;
      }
      if (!Array.isArray(r.legs) || r.legs.length === 0) r.legs = [{ steps: [] }];
      if (!r.legs[0].steps) r.legs[0].steps = [];
      // Dong bo RAM giong selectRouteOption cu: tuyen da chon len dau, cac tuyen con lai lam alternative
      const others = previewRoutes.filter((_, i)=> i !== previewSelected);
      try{ localStorage.setItem('alternativeRoutes', JSON.stringify(others)); }catch(e){}
      try{ alternativeRoutesData = [r, ...others]; }catch(e){}
      try{ arrivalHandled = false; }catch(e){}
      try{ currentRouteData = r; }catch(e){}
      try{ currentRouteCoords = r.geometry.coordinates; }catch(e){}
      // Dong preview, ve tuyen da chon, bat dau dan
      closePreview();
      try{ if (typeof clearRouteOptionLayers === 'function') clearRouteOptionLayers(); }catch(e){}
      try{ if (typeof drawCurrentRoute === 'function') drawCurrentRoute(); }catch(e){}
      try{ if (typeof window.closeRouteOptions === 'function') window.closeRouteOptions(); }catch(e){}
      // An modal cu neu con mo (de phong truong hop goi tu modal cu)
      try{ const m = document.getElementById('routeOptionsModal'); if (m) m.classList.remove('open'); }catch(e){}
      try{ if (typeof startNavigationHUD === 'function') startNavigationHUD(); }catch(e){}
    }catch(e){
      console.warn('confirmStartSelected', e);
      if (typeof showCustomToast === 'function') showCustomToast('Lỗi bắt đầu: ' + e.message, 'danger');
    }
  }

  /* --- Fetch + hien preview --- */
  async function fetchPreview(){
    try{
      if (isNav()){
        if (typeof showCustomToast === 'function') showCustomToast('Đang dẫn đường - đi sai hệ thống sẽ tự đổi', 'info');
        return;
      }
      if (previewFetching) return;
      if (typeof startPoint === 'undefined' || typeof endPoint === 'undefined' || !startPoint || !endPoint || !startPoint.lat || !endPoint.lat){
        if (typeof showCustomToast === 'function') showCustomToast('Vui lòng chọn đủ Điểm đi và Điểm đến!', 'warning');
        return;
      }
      previewFetching = true;
      const mode = (typeof currentVehicleMode !== 'undefined' && currentVehicleMode) || 'driving';
      // Hien sheet loading nhe
      const sheet = ensureSheet();
      const subEl = sheet.querySelector('#rpVehicleSub');
      if (subEl) subEl.textContent = 'Đang tìm tuyến...';
      openSheet();
      try{
        let routes = await apiRoute(startPoint, endPoint, mode, false, (typeof getCurrentVehicleSpecs === 'function' ? getCurrentVehicleSpecs() : null));
        routes = (routes || []).filter(r=>{
          const c = r.geometry && r.geometry.coordinates;
          return r.distance > 0 && Array.isArray(c) && c.length >= 2;
        });
        const total = routes.length;
        routes = routes.filter(r=>{
          try{ return !(typeof checkRouteAgainstAvoidZones === 'function' && checkRouteAgainstAvoidZones(r.geometry.coordinates).blocked); }
          catch(e){ return true; }
        });
        if (!routes.length){
          const why = total > 0 ? 'Tất cả tuyến đều đi qua vùng cấm với loại xe này.' : 'Không tìm được tuyến đường hợp lệ.';
          if (subEl) subEl.textContent = why;
          if (typeof showCustomToast === 'function') showCustomToast(why, 'warning');
          previewFetching = false;
          return;
        }
        routes.sort((a,b)=> (typeof currentSortMode !== 'undefined' && currentSortMode === 'shortest') ? a.distance - b.distance : a.duration - b.duration);
        routes = routes.slice(0, 3); // Chi lay 3 tuyen de danh so 1 2 3 nhu Google Maps
        previewRoutes = routes;
        previewSelected = 0;
        try{ alternativeRoutesData = routes; }catch(e){}
        // An modal cu (neu dang mo) de chi hien preview moi, khong chong 2 UI
        try{ const m = document.getElementById('routeOptionsModal'); if (m) m.classList.remove('open'); }catch(e){}
        // An dirSheet de map rong hon khi preview
        try{ const ds = document.getElementById('dirSheet'); if (ds) ds.classList.remove('open'); }catch(e){}
        drawPreviewRoutes();
        renderPreviewSheet();
      }catch(e){
        console.error('fetchPreview:', e);
        if (typeof showCustomToast === 'function') showCustomToast('Lỗi tìm tuyến: ' + (e.message || ''), 'warning');
      }finally{
        previewFetching = false;
      }
    }catch(e){}
  }

  /* --- Ghi de ham goc --- */
  // Giu ham goc de fallback neu can
  try{ if (typeof window.fetchAndShowRouteOptions === 'function' && !window._origFetchForV8) window._origFetchForV8 = window.fetchAndShowRouteOptions; }catch(e){}
  try{ if (typeof window.selectRouteOption === 'function' && !window._origSelectForV8) window._origSelectForV8 = window.selectRouteOption; }catch(e){}
  try{ if (typeof window.closeRouteOptions === 'function' && !window._origCloseForV8) window._origCloseForV8 = window.closeRouteOptions; }catch(e){}

  window.fetchAndShowRouteOptions = fetchPreview;
  window.showRoutePreview = fetchPreview;
  window.selectRouteOption = selectPreviewRoute;
  window.selectPreviewRoute = selectPreviewRoute;
  window.confirmRoutePreviewStart = confirmStartSelected;
  window.closeRoutePreview = closePreview;
  // closeRouteOptions cu cung phai dong preview moi
  window.closeRouteOptions = function(){
    try{ closePreview(); }catch(e){}
    try{ if (window._origCloseForV8) window._origCloseForV8(); }catch(e){}
    try{ const m = document.getElementById('routeOptionsModal'); if (m) m.classList.remove('open'); }catch(e){}
  };
  // changeSort / setVehicleMode goi fetchPreview thi tu dung preview moi, khong can ghi de them
  // Khi bam nut Bat dau cu trong HTML (neu con) -> chuyen sang confirmStartSelected
  try{
    document.addEventListener('click', (e)=>{
      const t = e.target && e.target.closest ? e.target.closest('[data-start-route-preview]') : null;
      if (t) confirmStartSelected();
    });
  }catch(e){}

  // Expose de test tu Console
  window._previewRoutesV8 = ()=> previewRoutes;
  window._previewSelectedV8 = ()=> previewSelected;
})();

/* ================= V9 BO NUT BAT DAU O BUOC DAU ================= */
/* =====================================================
   DriveKit - V9 BO NUT BAT DAU O BUOC DAU - 2026-11-22
   Yeu cau: Buoc dau CHI CO "Xem tat ca tuyen duong"
   - Xem preview, chon tuyen 1/2/3 xong MOI duoc an "Bat dau"
   - Nut "Bat dau dan duong" o buoc dau (trong #dirSheet / HTML) -> AN HAN
   - Nut "Bat dau" trong #routePreviewSheet -> GIU LAI, do la nut chot tuyen
   Cach lam: JS quet + CSS chan, chay ca khi HTML tao nut dong / sau khi mo dirSheet
   Ghi de: khong ghi de ham nao, chi an nut + tao nut Xem neu thieu
   ===================================================== */
(function hideEarlyStartV9(){
  if (window._hideEarlyStartV9Done) return; window._hideEarlyStartV9Done = true;

  function isPreviewStartBtn(btn){
    try{ return !!(btn && btn.closest && btn.closest('#routePreviewSheet')); }catch(e){ return false; }
  }
  function isEarlyStartBtn(btn){
    try{
      if (!btn || !btn.textContent) return false;
      if (isPreviewStartBtn(btn)) return false; // Nut Bat dau trong preview -> GIU
      const txt = (btn.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
      const id = (btn.id || '').toLowerCase();
      const cls = (btn.className || '').toString().toLowerCase();
      const onclick = (btn.getAttribute && (btn.getAttribute('onclick')||'')) || '';
      // Chi an nut trong vung buoc dau: dirSheet / routeOptionsModal / homeBottomSheet / body khi chua preview
      const inStep1 = !!(btn.closest && (btn.closest('#dirSheet') || btn.closest('#routeOptionsModal') || btn.closest('#homeBottomSheet') || btn.closest('#dirPanel') || btn.closest('.dir-sheet')));
      // Truong hop nut Bat dau nam ngoai dirSheet (HTML cu de o body) -> van an neu no goi startNavigationHUD truc tiep
      const callsStartDirect = /startNavigationHUD|startNavigationMode|selectRouteOption\s*\(\s*0\s*\)/.test(onclick);
      const textIsStart = txt.includes('bắt đầu') || txt.includes('bat dau') || txt === '▶ bắt đầu' || txt.startsWith('▶ bắt đầu');
      const idIsStart = id.includes('startnav') || id.includes('btnstart') || id.includes('start-nav') || id.includes('beginnav');
      if (textIsStart && (inStep1 || callsStartDirect || idIsStart)) return true;
      if ((idIsStart || callsStartDirect) && inStep1) return true;
      // Nut co data-start-route-preview cu (nut Bat dau cu trong HTML) -> doi thanh Xem, khong phai an han? O day an han theo yeu cau
      if (btn.hasAttribute && btn.hasAttribute('data-start-route-preview') && !isPreviewStartBtn(btn)) return true;
      return false;
    }catch(e){ return false; }
  }
  function isViewAllBtn(btn){
    try{
      const txt = (btn.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
      return txt.includes('xem tất cả') || txt.includes('xem tat ca') || txt.includes('xem tất cả tuyến') || txt.includes('xem tất cả tuyến đường') || txt.includes('tất cả tuyến');
    }catch(e){ return false; }
  }
  function ensureViewAllBtn(){
    try{
      const ds = document.getElementById('dirSheet');
      if (!ds) return;
      // Da co nut Xem -> dam bao no hien + la nut chinh, khong bi an
      let existing = null;
      ds.querySelectorAll('button').forEach(b=>{
        if (isViewAllBtn(b)) existing = b;
      });
      if (existing){
        existing.style.display = '';
        existing.classList.add('v9-viewall-btn');
        // Dam bao bam Xem -> mo preview (fetchAndShowRouteOptions = V8 preview), khong dan ngay
        if (!existing._v9Bound){
          existing._v9Bound = true;
          existing.addEventListener('click', (e)=>{
            e.preventDefault(); e.stopPropagation();
            try{ if (typeof window.fetchAndShowRouteOptions === 'function') window.fetchAndShowRouteOptions(); }catch(err){}
          });
        }
        return;
      }
      // Chua co -> tao moi, dat o cuoi dirSheet (cho de thay, CSS se dua len thanh nut chinh)
      if (document.getElementById('btnViewAllRoutesStep1')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'btnViewAllRoutesStep1';
      btn.className = 'v9-viewall-btn';
      btn.textContent = 'Xem tất cả tuyến đường';
      btn.addEventListener('click', (e)=>{
        e.preventDefault(); e.stopPropagation();
        try{ if (typeof window.fetchAndShowRouteOptions === 'function') window.fetchAndShowRouteOptions(); }catch(err){}
      });
      ds.appendChild(btn);
    }catch(e){}
  }
  function hideEarlyStarts(){
    try{
      // 1. An tat ca nut Bat dau o buoc dau (khong phai trong preview)
      document.querySelectorAll('button, a[role="button"]').forEach(btn=>{
        if (isEarlyStartBtn(btn)){
          btn.style.display = 'none';
          btn.setAttribute('data-v9-hidden-early-start', '1');
          btn.setAttribute('aria-hidden', 'true');
        }
      });
      // 2. Dam bao nut Xem luon co + hien
      ensureViewAllBtn();
      // 3. Nut Bat dau trong preview LUON hien (phong truong hop CSS cu an nham)
      const rpStart = document.getElementById('rpStartBtn');
      if (rpStart){
        rpStart.style.display = '';
        rpStart.removeAttribute('aria-hidden');
      }
    }catch(e){}
  }
  // CSS chan: an nut Bat dau o buoc dau ngay ca khi JS chua chay / nut moi tao sau
  try{
    if (!document.getElementById('hideEarlyStartV9Css')){
      const st = document.createElement('style');
      st.id = 'hideEarlyStartV9Css';
      st.textContent = `
        /* V9: Buoc dau CHI CO Xem tat ca - an nut Bat dau o buoc dau */
        #dirSheet button[data-v9-hidden-early-start="1"],
        #routeOptionsModal button[data-v9-hidden-early-start="1"],
        #homeBottomSheet button[data-v9-hidden-early-start="1"]{ display:none !important; }
        /* Nut Xem tat ca o buoc dau: nut chinh, full-width, giong nut Bat dau cu de user de thay */
        #dirSheet #btnViewAllRoutesStep1,
        #dirSheet .v9-viewall-btn{
          display:flex !important; align-items:center !important; justify-content:center !important; gap:8px !important;
          width:100% !important; padding:14px 16px !important; margin:12px 0 0 !important;
          background:#0f766e !important; color:#fff !important; border:none !important;
          border-radius:14px !important; font-size:15px !important; font-weight:800 !important;
          cursor:pointer !important; box-shadow:0 6px 18px rgba(15,118,110,.30) !important;
        }
        #dirSheet #btnViewAllRoutesStep1:active, #dirSheet .v9-viewall-btn:active{ transform:scale(.98) !important; }
        /* Nut Bat dau trong preview LUON hien */
        #routePreviewSheet #rpStartBtn{ display:flex !important; }
      `;
      document.head.appendChild(st);
    }
  }catch(e){}
  // Chay ngay + khi mo dirSheet + khi DOM thay doi (nut tao dong)
  try{
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hideEarlyStarts);
    else hideEarlyStarts();
    // Khi mo dirSheet -> quet lai (nut co the duoc tao lai khi mo)
    try{
      const ds = document.getElementById('dirSheet');
      if (ds){
        const obs = new MutationObserver(()=> hideEarlyStarts());
        obs.observe(ds, { childList:true, subtree:true, attributes:true, attributeFilter:['style','class'] });
      }
    }catch(e){}
    // Da bo setInterval 1.5s: MutationObserver tren #dirSheet phia tren + window.hideEarlyStartV9 van giu chuc nang
    // Expose de test: window.hideEarlyStartV9()
    window.hideEarlyStartV9 = hideEarlyStarts;
    window.showEarlyStartV9 = function(){ // Hoan tac neu can test lai: hien lai nut Bat dau buoc dau
      try{ document.querySelectorAll('[data-v9-hidden-early-start="1"]').forEach(b=>{ b.style.display=''; b.removeAttribute('data-v9-hidden-early-start'); }); }catch(e){}
    };
  }catch(e){}
})();

/* ================= V10 THAM SO XE BOTTOM SHEET ================= */
/* =====================================================
   DriveKit - V10 THAM SO XE RA BOTTOM SHEET RIENG - 2026-11-22
   Yeu cau: An het tham so xe trong #dirSheet
   - Bam O to / Ket xe (type car) -> mo bottom sheet moi: Tham so xe hoi (So cho ngoi) + nut Back
   - Bam Xe tai (type truck) -> mo bottom sheet moi: Tham so xe tai (So truc + Canh bao) + nut Back
   - Bam Xe buyt (type bus) -> mo bottom sheet moi: Loai xe buyt + nut Back
   - Bam Xe may / Di bo / Xe dap / Xe CN khong co tham so -> khong mo sheet
   - Nut Back / Xong / Bam ngoai -> dong sheet, quay lai #dirSheet (dirSheet van mo)
   Cach lam: Ghi de window.setVehicleMode (giu logic goc), an inline selector, mo sheet moi.
   Sheet tu tao neu HTML chua co, nen chay du ca HTML cu (co inline) va HTML moi (da bo inline).
   ===================================================== */
(function vehicleParamsV10(){
  if (window._vehicleParamsV10Done) return; window._vehicleParamsV10Done = true;

  function getTypeForMode(mode){
    try{ if (typeof VEHICLE_TYPE_MAP !== 'undefined' && VEHICLE_TYPE_MAP[mode]) return VEHICLE_TYPE_MAP[mode]; }catch(e){}
    if (mode === 'truck') return 'truck';
    if (mode === 'bus') return 'bus';
    if (mode === 'driving' || mode === 'driving-traffic' || mode === 'hd') return 'car';
    return mode;
  }
  function ensureSheet(){
    let sheet = document.getElementById('vehicleParamsSheet');
    if (sheet) return sheet;
    // Overlay
    let overlay = document.getElementById('vehicleParamsOverlay');
    if (!overlay){
      overlay = document.createElement('div');
      overlay.id = 'vehicleParamsOverlay';
      overlay.className = 'vps-overlay';
      overlay.addEventListener('click', closeVehicleParams);
      document.body.appendChild(overlay);
    }
    sheet = document.createElement('div');
    sheet.id = 'vehicleParamsSheet';
    sheet.className = 'vps-sheet';
    sheet.innerHTML = `
      <div class="vps-handle"></div>
      <div class="vps-header">
        <button type="button" class="vps-back-btn" id="vpsBackBtn">←&nbsp;Quay lại</button>
        <div class="vps-title-wrap"><h3 class="vps-title" id="vpsTitle">Tham số xe hơi</h3><p class="vps-subtitle" id="vpsSubtitle">Ô tô • 5 chỗ</p></div>
        <button type="button" class="vps-close-btn" id="vpsCloseBtn">✕</button>
      </div>
      <div class="vps-body">
        <div class="vps-section" id="vpsCarSection">
          <div class="vps-label"><i class="fas fa-chair" style="color:#3b82f6;"></i> Số chỗ ngồi</div>
          <div class="vps-options" id="vpsCarOptions"></div>
          <p class="vps-hint">Chọn số chỗ để tính tuyến phù hợp với xe của bạn.</p>
        </div>
        <div class="vps-section" id="vpsTruckSection" style="display:none;">
          <div class="vps-label"><i class="fas fa-truck" style="color:#f59e0b;"></i> Số trục xe</div>
          <div class="vps-options" id="vpsTruckOptions"></div>
          <div class="vps-warning"><i class="fas fa-exclamation-triangle"></i><div><b>Lưu ý:</b> Vui lòng tự quan sát biển báo cấm tải trên thực tế!</div></div>
        </div>
        <div class="vps-section" id="vpsBusSection" style="display:none;">
          <div class="vps-label"><i class="fas fa-bus" style="color:#8b5cf6;"></i> Loại xe buýt</div>
          <div class="vps-options" id="vpsBusOptions"></div>
        </div>
      </div>
      <div class="vps-footer"><button type="button" class="vps-done-btn" id="vpsDoneBtn">Xong</button></div>
    `;
    document.body.appendChild(sheet);
    // Build options
    try{
      const carBox = sheet.querySelector('#vpsCarOptions');
      [3,4,5,6,7,8,9,10,11,12].forEach(n=>{
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'vps-option-btn'; b.textContent = (n===12 ? '12+' : String(n));
        b.addEventListener('click', ()=>{ try{ if (typeof window.setCarSeats === 'function') window.setCarSeats(n, b); }catch(e){} syncVpsActive(); updateVpsSubtitle(); });
        carBox.appendChild(b);
      });
      const truckBox = sheet.querySelector('#vpsTruckOptions');
      [1,2,3,4,5,6,7,8,9,10].forEach(n=>{
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'vps-option-btn'; b.textContent = String(n);
        b.addEventListener('click', ()=>{ try{ if (typeof window.setTruckAxles === 'function') window.setTruckAxles(n, b); }catch(e){} syncVpsActive(); updateVpsSubtitle(); });
        truckBox.appendChild(b);
      });
      const busBox = sheet.querySelector('#vpsBusOptions');
      [['regular','🚌 Thường'],['sleeper','🛏 Giường nằm']].forEach(([val,label])=>{
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'vps-option-btn vps-option-wide'; b.textContent = label; b.dataset.busType = val;
        b.addEventListener('click', ()=>{ try{ if (typeof window.setBusType === 'function') window.setBusType(val, b); }catch(e){} syncVpsActive(); updateVpsSubtitle(); });
        busBox.appendChild(b);
      });
    }catch(e){}
    sheet.querySelector('#vpsBackBtn').addEventListener('click', closeVehicleParams);
    sheet.querySelector('#vpsCloseBtn').addEventListener('click', closeVehicleParams);
    sheet.querySelector('#vpsDoneBtn').addEventListener('click', closeVehicleParams);
    return sheet;
  }
  function syncVpsActive(){
    try{
      const sheet = document.getElementById('vehicleParamsSheet'); if (!sheet) return;
      // Car
      const seats = (typeof currentCarSeats !== 'undefined' ? currentCarSeats : (typeof userVehicleSpecs !== 'undefined' && userVehicleSpecs.seats ? userVehicleSpecs.seats : 5));
      sheet.querySelectorAll('#vpsCarOptions .vps-option-btn').forEach((b,i)=>{
        const n = [3,4,5,6,7,8,9,10,11,12][i];
        b.classList.toggle('active', n === seats);
      });
      const axles = (typeof currentTruckAxles !== 'undefined' ? currentTruckAxles : (typeof userVehicleSpecs !== 'undefined' && userVehicleSpecs.axles ? userVehicleSpecs.axles : 2));
      sheet.querySelectorAll('#vpsTruckOptions .vps-option-btn').forEach((b,i)=>{
        b.classList.toggle('active', (i+1) === axles);
      });
      const bt = (typeof currentBusType !== 'undefined' ? currentBusType : 'regular');
      sheet.querySelectorAll('#vpsBusOptions .vps-option-btn').forEach(b=>{
        b.classList.toggle('active', b.dataset.busType === bt);
      });
    }catch(e){}
  }
  function updateVpsSubtitle(){
    try{
      const sub = document.getElementById('vpsSubtitle'); if (!sub) return;
      const mode = (typeof currentVehicleMode !== 'undefined' ? currentVehicleMode : 'driving');
      const type = getTypeForMode(mode);
      if (type === 'car'){
        const seats = (typeof currentCarSeats !== 'undefined' ? currentCarSeats : 5);
        const label = mode === 'driving-traffic' ? 'Kẹt xe' : (mode === 'hd' ? 'Xe CN' : 'Ô tô');
        sub.textContent = label + ' • ' + seats + (seats >= 12 ? '+' : '') + ' chỗ';
      } else if (type === 'truck'){
        const ax = (typeof currentTruckAxles !== 'undefined' ? currentTruckAxles : 2);
        sub.textContent = 'Xe tải • ' + ax + ' trục';
      } else if (type === 'bus'){
        const bt = (typeof currentBusType !== 'undefined' ? currentBusType : 'regular');
        sub.textContent = 'Xe buýt • ' + (bt === 'sleeper' ? 'Giường nằm' : 'Thường');
      }
    }catch(e){}
  }
  function openVehicleParams(type){
    try{
      const sheet = ensureSheet();
      const title = document.getElementById('vpsTitle');
      if (title) title.textContent = type === 'truck' ? 'Tham số xe tải' : (type === 'bus' ? 'Tham số xe buýt' : 'Tham số xe hơi');
      ['vpsCarSection','vpsTruckSection','vpsBusSection'].forEach(id=>{
        const el = document.getElementById(id); if (el) el.style.display = 'none';
      });
      const showId = type === 'truck' ? 'vpsTruckSection' : (type === 'bus' ? 'vpsBusSection' : 'vpsCarSection');
      const showEl = document.getElementById(showId); if (showEl) showEl.style.display = '';
      syncVpsActive(); updateVpsSubtitle();
      sheet.classList.add('open');
      const ov = document.getElementById('vehicleParamsOverlay'); if (ov) ov.classList.add('open');
      document.body.classList.add('vps-open');
      // Dam bao dirSheet van mo o duoi, de Back quay lai duoc
      try{ const ds = document.getElementById('dirSheet'); if (ds) ds.classList.add('open'); }catch(e){}
    }catch(e){}
  }
  function closeVehicleParams(){
    try{
      const sheet = document.getElementById('vehicleParamsSheet'); if (sheet) sheet.classList.remove('open');
      const ov = document.getElementById('vehicleParamsOverlay'); if (ov) ov.classList.remove('open');
      document.body.classList.remove('vps-open');
      // Quay lai dirSheet
      try{ const ds = document.getElementById('dirSheet'); if (ds) ds.classList.add('open'); }catch(e){}
    }catch(e){}
  }
  function hideInlineParams(){
    try{
      ['carSeatsSelector','truckAxlesSelector','busTypeSelector','truckWarning'].forEach(id=>{
        const el = document.getElementById(id); if (el) el.classList.add('hidden');
      });
    }catch(e){}
  }
  // CSS: an inline + style sheet moi
  try{
    if (!document.getElementById('vehicleParamsV10Css')){
      const st = document.createElement('style');
      st.id = 'vehicleParamsV10Css';
      st.textContent = `
        /* V10: An tham so inline trong dirSheet */
        #dirSheet #carSeatsSelector, #dirSheet #truckAxlesSelector, #dirSheet #busTypeSelector, #dirSheet #truckWarning{ display:none !important; }
        .vps-overlay{ position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:2900; opacity:0; pointer-events:none; transition:opacity .25s; }
        .vps-overlay.open{ opacity:1; pointer-events:auto; }
        .vps-sheet{ position:fixed; left:0; right:0; bottom:0; z-index:2950; background:var(--card, #fff); border-radius:20px 20px 0 0; box-shadow:0 -10px 40px rgba(0,0,0,.30); border-top:1px solid var(--border, #e2e8f0); transform:translateY(100%); transition:transform .30s cubic-bezier(.4,0,.2,1); display:flex; flex-direction:column; max-height:72dvh; padding:0 0 calc(16px + env(safe-area-inset-bottom)); }
        .vps-sheet.open{ transform:translateY(0); }
        .vps-handle{ width:40px; height:5px; border-radius:99px; background:var(--border, #e2e8f0); margin:10px auto 6px; }
        .vps-header{ display:flex; align-items:center; gap:10px; padding:6px 16px 12px; border-bottom:1px solid var(--border, #e2e8f0); }
        .vps-back-btn{ background:var(--bg-2, #f1f5f9); color:var(--text, #0f172a); border:1px solid var(--border, #e2e8f0); border-radius:99px; padding:8px 12px; font-size:13px; font-weight:800; cursor:pointer; white-space:nowrap; }
        .vps-title-wrap{ flex:1; min-width:0; }
        .vps-title{ margin:0; font-size:17px; font-weight:900; color:var(--text, #0f172a); }
        .vps-subtitle{ margin:2px 0 0; font-size:12px; color:var(--text-muted, #64748b); font-weight:600; }
        .vps-close-btn{ width:32px; height:32px; border-radius:99px; background:var(--bg-2, #f1f5f9); border:none; color:var(--text, #0f172a); font-size:14px; cursor:pointer; }
        .vps-body{ flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:16px; }
        .vps-label{ font-size:14px; font-weight:800; color:var(--text, #0f172a); margin-bottom:10px; display:flex; align-items:center; gap:8px; }
        .vps-options{ display:grid; grid-template-columns:repeat(5, 1fr); gap:8px; }
        .vps-option-btn{ padding:12px 6px; border-radius:12px; border:1px solid var(--border, #e2e8f0); background:var(--bg-2, #f8fafc); color:var(--text, #0f172a); font-size:14px; font-weight:800; cursor:pointer; }
        .vps-option-btn.active{ background:#0f766e; color:#fff; border-color:#0f766e; box-shadow:0 4px 14px rgba(15,118,110,.35); }
        .vps-option-wide{ grid-column:span 2; }
        .vps-hint{ margin:10px 0 0; font-size:12px; color:var(--text-muted, #64748b); }
        .vps-warning{ margin-top:14px; display:flex; gap:8px; align-items:flex-start; background:rgba(245,158,11,.15); border:1px solid var(--warning, #f59e0b); border-radius:10px; padding:10px; font-size:12px; line-height:1.4; color:var(--text, #0f172a); }
        .vps-footer{ padding:12px 16px 0; }
        .vps-done-btn{ width:100%; padding:14px; border:none; border-radius:14px; background:#0f766e; color:#fff; font-size:15px; font-weight:800; cursor:pointer; box-shadow:0 6px 18px rgba(15,118,110,.30); }
      `;
      document.head.appendChild(st);
    }
  }catch(e){}
  // Ghi de setVehicleMode: giu logic goc, an inline, mo sheet neu co tham so
  try{
    const orig = window.setVehicleMode;
    if (orig && !orig._v10Wrapped){
      const wrapped = function(mode, btn){
        // Neu dang dan -> ham goc se chan, khong mo sheet
        const _isNav = (typeof isNavigating !== 'undefined' && isNavigating) || (document.body && (document.body.classList.contains('google-nav') || document.body.classList.contains('navigating')));
        if (_isNav){ return orig.apply(this, arguments); }
        const r = orig.apply(this, arguments);
        hideInlineParams();
        // Chi mo sheet khi user BAM nut (btn co), khong mo khi goi bang code (btn null)
        if (btn){
          const t = getTypeForMode(mode);
          if (t === 'car' || t === 'truck' || t === 'bus'){
            openVehicleParams(t);
          }
        }
        return r;
      };
      wrapped._v10Wrapped = true;
      window.setVehicleMode = wrapped;
    }
  }catch(e){}
  // Dong bo khi setCarSeats / setTruckAxles / setBusType duoc goi tu sheet cu / noi khac
  try{
    ['setCarSeats','setTruckAxles','setBusType'].forEach(fn=>{
      const o = window[fn];
      if (o && !o._v10Wrapped){
        const w = function(){ const r = o.apply(this, arguments); try{ syncVpsActive(); updateVpsSubtitle(); hideInlineParams(); }catch(e){} return r; };
        w._v10Wrapped = true; window[fn] = w;
      }
    });
  }catch(e){}
  // An inline ngay khi load + khi dirSheet mo
  try{
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hideInlineParams); else hideInlineParams();
    try{ const _ds10 = document.getElementById('dirSheet'); if (_ds10) { const _obs10 = new MutationObserver(()=> hideInlineParams()); _obs10.observe(_ds10, { attributes:true, attributeFilter:['class','style'] }); } }catch(e){}
  }catch(e){}
  window.openVehicleParamsSheet = openVehicleParams;
  window.closeVehicleParamsSheet = closeVehicleParams;
  window._syncVpsActive = syncVpsActive;
})();
