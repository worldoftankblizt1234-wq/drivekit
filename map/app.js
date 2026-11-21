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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const fsdb = getFirestore(app);

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
const signDisplaySettings = JSON.parse(localStorage.getItem('drivekit_sign_display') || 'null') || {
  show: true,
  speedOnly: false,
  size: 'medium'
};

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

function preloadVisibleSignIcons() {
  if (!map || !map.getSource(TRAFFIC_SIGN_SOURCE_ID)) return;
  let features = [];
  try { features = map.querySourceFeatures(TRAFFIC_SIGN_SOURCE_ID, { sourceLayer: 'traffic_sign' }); } catch(e) { return; }
  const codes = new Set();
  features.forEach(f => {
    const p = f.properties || {};
    const v = p.object_value || p.value;
    if (v && typeof v === 'string') codes.add(v);
  });
  codes.forEach(ensureSignIcon);
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
    try {
      const feats = map.querySourceFeatures(TRAFFIC_SIGN_SOURCE_ID, { sourceLayer: 'traffic_sign' });
      feats.forEach(f => {
        const p = f.properties || {};
        const v = p.object_value || p.value;
        if (v && typeof v === 'string') ensureSignIcon(v);
      });
    } catch(err) {}
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
    const r = await fetch(url);
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
  const r = await fetch(url);
  if (!r.ok) {
    let errText = 'Lỗi kết nối máy chủ (HTTP ' + r.status + ')';
    try { const j = await r.json(); if (j.error) errText = j.error; } catch(e){}
    throw new Error(errText);
  }
  const j = await r.json();
  if (!j.routes) throw new Error('Không có tuyến đường trả về');
  return j.routes;
}

async function apiReverseGeocode(lat, lng) {
  try {
    const r = await fetch(`${WORKER_URL}/api/geocode?lat=${lat}&lng=${lng}`);
    if (!r.ok) return '';
    const j = await r.json();
    return j.name || '';
  } catch { return ''; }
}

async function checkWorkerHealth() {
  try {
    const r = await fetch(`${WORKER_URL}/`, { method: 'GET' });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

/* ========== D1 STATIC WARNINGS ========== */
async function getStaticWarnings(bounds) {
  try {
    const r = await fetch(`${WORKER_URL}/warnings?minLat=${bounds.south}&maxLat=${bounds.north}&minLng=${bounds.west}&maxLng=${bounds.east}`);
    if (!r.ok) return [];
    const j = await r.json();
    return j.warnings || [];
  } catch { return []; }
}
async function saveStaticWarning(type, lat, lng, speed, uid) {
  try {
    const r = await fetch(`${WORKER_URL}/warnings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
let isRerouting = false;
let isSearchDebugMode = localStorage.getItem('drivekit_search_debug') === '1';

let voiceSettings = JSON.parse(localStorage.getItem('drivekit_voice_settings') || 'null') || {
  volume: 100, nav: 'always', warning: 'always', poi: 'vibrate', avoid: 'always'
};
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
};

/* ========== DIRECTIONS SHEET ========== */
window.openDirections = function() {
  document.getElementById('dirSheet').classList.add('open');
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
  document.getElementById('dirSheet').classList.remove('open');
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
    for (let i = 0; i < routeOptionCount; i++) {
      if (map.getLayer('route-opt-layer-' + i)) map.removeLayer('route-opt-layer-' + i);
      if (map.getSource('route-opt-src-' + i)) map.removeSource('route-opt-src-' + i);
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
    bodyEl.innerHTML = `<div style="text-align:center; padding:40px; color:var(--danger);"><i class="fas fa-exclamation-triangle" style="font-size:2rem; margin-bottom:10px;"></i><p>${escapeHtml(e.message || 'Có lỗi xảy ra khi tìm tuyến. Vui lòng thử lại.')}</p></div>`;
  }
};

window.selectRouteOption = function(index) {
  const r = alternativeRoutesData[index];
  if (!r || !r.geometry || !r.geometry.coordinates || !r.geometry.coordinates.length) {
    showCustomToast('Tuyến đường không có dữ liệu!', 'danger');
    return;
  }
  if (!Array.isArray(r.legs) || r.legs.length === 0) r.legs = [{ steps: [] }];
  if (!r.legs[0].steps) r.legs[0].steps = [];
  localStorage.setItem('alternativeRoutes', JSON.stringify(alternativeRoutesData.filter((_, i) => i !== index)));
  currentRouteData = r;
  currentRouteCoords = r.geometry.coordinates;
  clearRouteOptionLayers();
  drawCurrentRoute();
  window.closeRouteOptions();
  startNavigationHUD();
};

function startNavigationHUD() {
  if (!currentRouteData || !currentRouteCoords || currentRouteCoords.length === 0) {
    showCustomToast('Không thể bắt đầu dẫn đường do thiếu dữ liệu tuyến!', 'danger');
    return;
  }
  try {
    document.getElementById('dirSheet').classList.remove('open');
    document.getElementById('suggestionsBox').classList.remove('show');
    document.body.classList.add('navigating');
    document.getElementById('hud').classList.remove('hidden');
    updateUIState();
    voiceRouteSteps = currentRouteData.legs[0].steps;
    voiceStepIndex = 0; lastSnapIndex = 0; offRouteCount = 0;
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
  document.getElementById('nearbySearchPanel').classList.add('open');
  if (lastUserPos && !currentNearbyCenter) {
    currentNearbyCenter = { lat: lastUserPos.lat, lon: lastUserPos.lng };
    updateNearbyCenterMarker(currentNearbyCenter.lat, currentNearbyCenter.lon);
  }
};
window.closeNearbySearchPanel = function() {
  document.getElementById('nearbySearchPanel').classList.remove('open');
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
    document.getElementById('nearbySearchPanel').classList.remove('open');
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
  const btnSearch = event && event.target ? event.target.closest('button') : null;
  const oldText = btnSearch ? btnSearch.innerHTML : '';
  if (btnSearch) { btnSearch.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tìm...'; btnSearch.disabled = true; }
  nearbyResultMarkers.forEach(m => m.remove());
  nearbyResultMarkers = [];
  try {
    const url = `${NEARBY_API_URL}?lat=${currentNearbyCenter.lat}&lon=${currentNearbyCenter.lon}&radius=${radius}&category=${category}`;
    const res = await fetch(url);
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
setInterval(() => { const c = document.getElementById('profileTime'); if (c) c.textContent = new Date().toLocaleTimeString('vi-VN'); }, 1000);

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
      authTitle.textContent = 'Tạo tài khoản 📝';
      authSubtitle.textContent = 'Đăng ký để bắt đầu hành trình';
      btnSubmitAuth.textContent = 'Đăng ký tài khoản';
      authToggleText.textContent = 'Đã có tài khoản?';
      authToggleBtn.textContent = 'Đăng nhập';
    } else {
      authTitle.textContent = 'DriveKit 🚌';
      authSubtitle.textContent = 'Mọi hành trình, một giải pháp';
      btnSubmitAuth.textContent = 'Đăng nhập';
      authToggleText.textContent = 'Chưa có tài khoản?';
      authToggleBtn.textContent = 'Đăng ký ngay';
    }
  });
}
if (btnSubmitAuth) {
  btnSubmitAuth.addEventListener('click', async () => {
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPassword').value;
    if (!email || !pass) { authError.textContent = 'Vui lòng nhập đầy đủ Email và Mật khẩu.'; authError.style.display = 'block'; return; }
    btnSubmitAuth.disabled = true; btnSubmitAuth.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    authError.style.display = 'none';
    try {
      if (isRegisterMode) await createUserWithEmailAndPassword(auth, email, pass);
      else await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) { authError.textContent = getAuthErrorMessage(err.code); authError.style.display = 'block'; }
    finally { btnSubmitAuth.disabled = false; btnSubmitAuth.textContent = isRegisterMode ? 'Đăng ký tài khoản' : 'Đăng nhập'; }
  });
}
const btnGoogleAuth = document.getElementById('btnGoogleAuth');
if (btnGoogleAuth) {
  btnGoogleAuth.addEventListener('click', async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { authError.textContent = getAuthErrorMessage(e.code); authError.style.display = 'block'; }
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
      const p = { lat: routeCoords[i][1], lng: routeCoords[i][0] };
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
  const isDirOpen = document.getElementById('dirSheet').classList.contains('open');
  const isSearchBoxShow = document.getElementById('suggestionsBox').classList.contains('show');
  const isNearbyOpen = document.getElementById('nearbySearchPanel').classList.contains('open') || document.getElementById('nearbyResultsOverlay').style.display === 'block';
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
  if (isDirOpen || isSearchBoxShow || isNearbyOpen) {
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
  if (map.getLayer('current-route-layer')) map.removeLayer('current-route-layer');
  if (map.getSource('current-route-source')) map.removeSource('current-route-source');
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
window.toggleTraffic = function(isChecked) { console.warn('Traffic layer disabled to protect API key.'); };

function initMap() {
  if (map) return;
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
    if (document.getElementById('dirSheet').classList.contains('open')) return;
    if (document.getElementById('suggestionsBox').classList.contains('show')) closeSearch();
    showLocationPopup(e.lngLat);
  });
  map.on('click', (e) => {
    const _inNav = !!(document.body && document.body.classList.contains('google-nav')) || !!isNavigating;
    // Mo lai click khi dang dan duong: bam map van geocoding, chi an nut "Toi cho nay" trong popup
    // Dung follow de popup khong bi camera keo di
    if (_inNav) { try{ navFollowMode = 'free'; _isUserDraggingMap = false; if(map) map.stop(); if(typeof showRecenterBtn === 'function') showRecenterBtn(); }catch(err){} }
    if (isNearbyPickingMode) {
      const lat = e.lngLat.lat, lon = e.lngLat.lng;
      currentNearbyCenter = { lat, lon };
      updateNearbyCenterMarker(lat, lon);
      toggleNearbyPickMode(false);
      document.getElementById('nearbySearchPanel').classList.add('open');
      fetchNearbyPlaces();
      return;
    }
    if (document.getElementById('poiDetailSheet').classList.contains('open')) { closePoiDetail(); return; }
    if (touchMarker) { closePopupSmoothly(touchMarker); touchMarker = null; return; }
    if ((document.getElementById('dirSheet').classList.contains('open') || document.getElementById('suggestionsBox').classList.contains('show'))) {
      closeDirections();
      if (document.getElementById('suggestionsBox').classList.contains('show')) closeSearch();
      return;
    }
    showLocationPopup(e.lngLat);
  });
  map.on('moveend', () => {
    if (map.getZoom() < 13) { staticWarningMarkers.forEach(m => m.remove()); staticWarningMarkers = []; return; }
    if (staticWarningsTimer) clearTimeout(staticWarningsTimer);
    staticWarningsTimer = setTimeout(loadStaticWarnings, 600);
  });
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
  const popup = new maplibregl.Popup({ offset: 10, maxWidth: '300px', closeOnClick: false, closeButton: false }).setLngLat([lngLat.lng, lngLat.lat]).setHTML(loadingHtml);
  const el = createTouchMarkerElement();
  touchMarker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lngLat.lng, lngLat.lat]).setPopup(popup).addTo(map);
  touchMarker.togglePopup();
  const markerRef = touchMarker;
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
function renderRestStopMarkers() {
  restStopMarkers.forEach(m => m.remove());
  restStopMarkers = [];
  const z = map ? map.getZoom() : 17;
  if (z < ZOOM_CONFIG.restStop) return;
  allRestStops.forEach(poi => {
    if (restStopFilterActive && poi.tag !== 'rest_stop' && poi.tag !== 'gas_station') return;
    const el = document.createElement('div');
    el.style.width = '40px'; el.style.height = '40px';
    el.innerHTML = `<div class="community-poi-pin rest-stop-pin"><i class="fas fa-bed"></i><div class="verified-badge"><i class="fas fa-check"></i></div></div>`;
    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([poi.lng, poi.lat]).addTo(map);
    el.addEventListener('click', (ev) => { ev.stopPropagation(); openPoiDetail(poi.source, poi._id); });
    restStopMarkers.push(marker);
  });
}
function renderCommunityPoisOnMap() {
  communityPoiMarkers.forEach(m => m.remove());
  communityPoiMarkers = [];
  const currentZoom = map ? map.getZoom() : 17;
  if (currentZoom < ZOOM_CONFIG.communityPoi) return;
  allCommunityPois.forEach(poi => {
    const conf = POI_TAG_CONFIG[poi.tag] || POI_TAG_CONFIG.supermarket;
    const el = document.createElement('div');
    el.style.width = '32px'; el.style.height = '32px';
    el.innerHTML = `<div class="community-poi-pin"><i class="fas ${conf.icon}"></i><div class="verified-badge"><i class="fas fa-check"></i></div></div>`;
    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([poi.lng, poi.lat]).addTo(map);
    el.addEventListener('click', (ev) => { ev.stopPropagation(); openPoiDetail(poi.source, poi._id); });
    communityPoiMarkers.push(marker);
  });
}
function renderReportsOnMap() {
  reportMarkers.forEach(m => m.remove());
  reportMarkers = [];
  const now = Date.now();
  const currentZoom = map ? map.getZoom() : 17;
  if (currentZoom < ZOOM_CONFIG.report) return;
  for (const key in allReports) {
    const rep = allReports[key];
    if (now > rep.expiresAt) continue;
    if (rep.type === 'speed_limit' || rep.type === 'speed_camera' || rep.type === 'penalty_camera') continue;
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
  closeReportMenu();
  const now = Date.now();
  let ttl = 3600000;
  if (type === 'pothole') ttl = 86400000;
  else if (type === 'flood') ttl = 10800000;
  else if (type === 'traffic') ttl = 1800000;
  else if (type === 'bridge_collapse' || type === 'road_collapse') ttl = 604800000;
  try {
    await set(ref(db, `reports/${now}_${currentUser.uid}`), { lat: lastUserPos.lat, lng: lastUserPos.lng, type, timestamp: now, expiresAt: now + ttl, uid: currentUser.uid });
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
  document.getElementById('suggestionsBox').classList.add('show');
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
  document.getElementById('suggestionsBox').classList.remove('show');
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
  if (touchMarker) touchMarker.remove();
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
  if (touchMarker) touchMarker.remove();
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
      timestamp: Date.now(), upvotes: 0
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
  document.getElementById('poiDetailSheet').classList.add('open');
  if (touchMarker) touchMarker.remove();
};
window.closePoiDetail = function() { document.getElementById('poiDetailSheet').classList.remove('open'); currentDetailPoi = null; };
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
function checkOffRoute(userLat, userLng) {
  if (!currentRouteCoords || currentRouteCoords.length < 2 || isRerouting || arrivalHandled) return;
  // GPS kem (accuracy >60) thi dung reroute - do la GPS nhay, khong phai lac duong
  try{ if(typeof lastUserPos !== 'undefined' && lastUserPos && lastUserPos.accuracy && lastUserPos.accuracy > 60) { offRouteCount = 0; return; } }catch(e){}
  let minDist = Infinity;
  const startScan = Math.max(0, lastSnapIndex - 10);
  const endScan = Math.min(currentRouteCoords.length - 1, lastSnapIndex + 150);
  for (let i = startScan; i < endScan; i++) {
    const pt = getClosestPointOnSegment(
      { lat: userLat, lng: userLng },
      { lat: currentRouteCoords[i][0], lng: currentRouteCoords[i][1] },
      { lat: currentRouteCoords[i+1][0], lng: currentRouteCoords[i+1][1] }
    );
    const d = calcDist(userLat, userLng, pt.lat, pt.lng);
    if (d < minDist) minDist = d;
  }
  if (minDist > 50) {
    offRouteCount++;
    if (offRouteCount >= 3) { offRouteCount = 0; autoReroute(userLat, userLng); }
  } else offRouteCount = 0;
}

// Reroute check avoid zones
async function autoReroute(userLat, userLng, bypassCache = false) {
  if (isRerouting) return;
  isRerouting = true;
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
    voiceStepIndex = 0; lastSnapIndex = 0; offRouteCount = 0;
    currentRouteCoords = r.geometry.coordinates;
    drawCurrentRoute();
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
  finally { isRerouting = false; }
}

window.openAlternativeRoutes = function() {
  const stored = localStorage.getItem('alternativeRoutes');
  if (!stored) return alert('Không có tuyến đường phụ nào được lưu!');
  const routes = JSON.parse(stored);
  if (routes.length === 0) return alert('Không có tuyến đường phụ nào!');
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
  localStorage.setItem('alternativeRoutes', JSON.stringify(otherRoutes));
  currentRouteData = selectedRoute;
  currentRouteCoords = selectedRoute.geometry.coordinates;
  voiceRouteSteps = selectedRoute.legs[0].steps;
  voiceStepIndex = 0; lastSnapIndex = 0; offRouteCount = 0;
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
  if (map.getLayer('current-route-layer')) map.removeLayer('current-route-layer');
  if (map.getSource('current-route-source')) map.removeSource('current-route-source');
  if (window._routeBadges) { window._routeBadges.forEach(m => m.remove()); window._routeBadges = []; }
  alternativeRoutesData.forEach((_, i) => {
    if (map.getLayer(`alt-route-layer-${i}`)) map.removeLayer(`alt-route-layer-${i}`);
    if (map.getSource(`alt-route-source-${i}`)) map.removeSource(`alt-route-source-${i}`);
  });
  currentRouteCoords = []; currentRouteData = null; alternativeRoutesData = []; voiceRouteSteps = null;
  voiceStepIndex = 0; lastSnapIndex = 0; offRouteCount = 0; isRerouting = false;
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

console.log('[DriveKit] Part 2 loaded. Total window functions:', Object.keys(window).filter(k => typeof window[k] === 'function' && (k.startsWith('open') || k.startsWith('close') || k.startsWith('toggle') || k.startsWith('set') || k.startsWith('create') || k.startsWith('share') || k.startsWith('clear') || k.startsWith('init') || k.startsWith('submit') || k.startsWith('select') || k.startsWith('fetch') || k.startsWith('go') || k.startsWith('fly') || k.startsWith('open'))).length);


/* ============================================================
   [MOI] LOGIC BIEN BAO THEO ZOOM + CHI DUONG GOC NHIN 1 + MINIMAP
   Dich % cua ban sang zoom MapLibre (0-22):
   - Zoom <=12  : xa nhat, ban goi la >=20% xa -> CLUSTER +100, +56
   - Zoom 13-15 : ban goi 11-15% -> SO SO, chi bien toc do + cam + canh bao, icon nho
   - Zoom 16-17 : ban goi ~17% gan -> VAI BA CAI, chi bien quan trong
   - Zoom >=18  : ban goi ~10% gan nhat -> HIEN HET
   ============================================================ */

// ---------- 1. BIEN BAO THEO ZOOM ----------
const SIGN_CLUSTER_SOURCE_ID = 'mapillary-cluster-source';
const SIGN_CLUSTER_LAYER_ID = 'mapillary-cluster-circles';
const SIGN_CLUSTER_COUNT_ID = 'mapillary-cluster-count';

function getSignDensityMode(){
  if(!map) return 'all';
  const z = map.getZoom();
  if(z <= 12) return 'cluster';
  if(z <= 15) return 'sparse';
  if(z <= 17) return 'few';
  return 'all';
}

function ensureSignClusterLayers(){
  if(!map || !map.isStyleLoaded()) return;
  if(!map.getSource(SIGN_CLUSTER_SOURCE_ID)){
    map.addSource(SIGN_CLUSTER_SOURCE_ID, { type:'geojson', data:{ type:'FeatureCollection', features:[] } });
  }
  if(!map.getLayer(SIGN_CLUSTER_LAYER_ID)){
    map.addLayer({
      id: SIGN_CLUSTER_LAYER_ID, type:'circle', source: SIGN_CLUSTER_SOURCE_ID,
      paint:{
        'circle-color':['step',['get','point_count'], '#3b82f6', 10, '#f59e0b', 50, '#ef4444'],
        'circle-radius':['step',['get','point_count'], 16, 10, 22, 50, 30],
        'circle-stroke-width':2, 'circle-stroke-color':'#ffffff', 'circle-opacity':0.92
      }
    });
  }
  if(!map.getLayer(SIGN_CLUSTER_COUNT_ID)){
    map.addLayer({
      id: SIGN_CLUSTER_COUNT_ID, type:'symbol', source: SIGN_CLUSTER_SOURCE_ID,
      layout:{ 'text-field':['concat','+', ['to-string',['get','point_count']]], 'text-size':12, 'text-allow-overlap':true },
      paint:{ 'text-color':'#ffffff', 'text-halo-color':'rgba(0,0,0,0.4)', 'text-halo-width':1 }
    });
  }
}

function rebuildSignClusters(){
  if(!map || !map.getSource(SIGN_CLUSTER_SOURCE_ID)) return;
  if(getSignDensityMode() !== 'cluster') return;
  let feats = [];
  try{ feats = map.querySourceFeatures(TRAFFIC_SIGN_SOURCE_ID, { sourceLayer:'traffic_sign' }); }catch(e){ return; }
  if(!feats || feats.length===0) return;
  // Gom theo o luoi 0.006 do (~600m) de ra cum +100, +56
  const cells = new Map();
  feats.forEach(f=>{
    const g = f.geometry;
    if(!g) return;
    let lng, lat;
    if(g.type==='Point'){ lng=g.coordinates[0]; lat=g.coordinates[1]; }
    else if(g.coordinates && g.coordinates[0]){ lng=g.coordinates[0][0]; lat=g.coordinates[0][1]; }
    else return;
    const key = Math.floor(lng/0.006)+'_'+Math.floor(lat/0.006);
    if(!cells.has(key)) cells.set(key, { lng:0, lat:0, n:0 });
    const c = cells.get(key); c.lng+=lng; c.lat+=lat; c.n+=1;
  });
  const fc = { type:'FeatureCollection', features:[...cells.values()].map(c=>({ type:'Feature', geometry:{ type:'Point', coordinates:[c.lng/c.n, c.lat/c.n] }, properties:{ point_count:c.n } })) };
  try{ map.getSource(SIGN_CLUSTER_SOURCE_ID).setData(fc); }catch(e){}
}

function applySignDensity(){
  if(!map || !map.getSource(TRAFFIC_SIGN_SOURCE_ID)) return;
  ensureSignClusterLayers();
  const mode = getSignDensityMode();
  const hasLayer = !!map.getLayer(TRAFFIC_SIGN_LAYER_ID);
  // Cluster: an bien le, hien cum
  const showCluster = (mode==='cluster');
  if(map.getLayer(SIGN_CLUSTER_LAYER_ID)) map.setLayoutProperty(SIGN_CLUSTER_LAYER_ID, 'visibility', showCluster?'visible':'none');
  if(map.getLayer(SIGN_CLUSTER_COUNT_ID)) map.setLayoutProperty(SIGN_CLUSTER_COUNT_ID, 'visibility', showCluster?'visible':'none');
  if(hasLayer){
    map.setLayoutProperty(TRAFFIC_SIGN_LAYER_ID, 'visibility', showCluster?'none':'visible');
    // Filter theo do thua
    try{
      if(mode==='sparse'){
        // 13-15: chi toc do + cam + canh bao, de khong che map
        map.setFilter(TRAFFIC_SIGN_LAYER_ID, ['any',
          ['in','speed',['get','object_value']],
          ['in','regulatory--no-',['get','object_value']],
          ['in','warning--',['get','object_value']]
        ]);
        // Icon nho lai o muc thua
        map.setLayoutProperty(TRAFFIC_SIGN_LAYER_ID, 'icon-size', ['interpolate',['linear'],['zoom'],13,0.28,15,0.45]);
      } else if(mode==='few'){
        // 16-17: vai ba cai quan trong nhat
        map.setFilter(TRAFFIC_SIGN_LAYER_ID, ['any',
          ['in','speed',['get','object_value']],
          ['in','regulatory--stop',['get','object_value']],
          ['in','warning--',['get','object_value']]
        ]);
        map.setLayoutProperty(TRAFFIC_SIGN_LAYER_ID, 'icon-size', ['interpolate',['linear'],['zoom'],16,0.55,17,0.7]);
      } else if(mode==='all'){
        map.setFilter(TRAFFIC_SIGN_LAYER_ID, null);
        const sizeMul = (typeof getSignIconSize==='function') ? getSignIconSize() : 1;
        map.setLayoutProperty(TRAFFIC_SIGN_LAYER_ID, 'icon-size', ['interpolate',['linear'],['zoom'],14,0.4*sizeMul,18,0.9*sizeMul]);
      } else {
        map.setFilter(TRAFFIC_SIGN_LAYER_ID, null);
      }
    }catch(e){}
  }
  if(showCluster) rebuildSignClusters();
}

// Gan hook vao map khi da co map
function hookSignDensity(){
  if(!map) return;
  map.off('zoomend', applySignDensity);
  map.on('zoomend', applySignDensity);
  map.off('moveend', applySignDensity);
  map.on('moveend', ()=>{ setTimeout(applySignDensity, 200); });
  // Khi tile ve thi rebuild cum neu dang o che do cluster
  try{
    map.on('sourcedata', (e)=>{
      if(e.sourceId===TRAFFIC_SIGN_SOURCE_ID && e.isSourceLoaded) setTimeout(applySignDensity, 300);
    });
  }catch(e){}
}
if(typeof map!=='undefined' && map){
  try{ hookSignDensity(); }catch(e){}
  try{ map.on('load', ()=>{ hookSignDensity(); applySignDensity(); }); }catch(e){}
} else {
  const _waitMap = setInterval(()=>{ if(typeof map!=='undefined' && map){ clearInterval(_waitMap); hookSignDensity(); applySignDensity(); } }, 800);
}

// ---------- 2. CHI DUONG: GOC NHIN THU NHAT + MINIMAP ----------
let isNavigating = false;
let navFollowMode = 'first-person'; // 'first-person' | 'free'
let _gpsLastAcceptedAt = 0; // throttle GPS
let _gpsLastAcceptedPos = null; // de loc nhay GPS
let _isUserDraggingMap = false; // user dang keo map -> khong giat camera
let _lastCamAt = 0; // throttle camera
let _markerAnimId = null; // de huy animation cham cu
let navMinimap = null;
let navMinimapMap = null;
let navMinimapVisible = true;
let _origUpdateUserMarker = null;

function ensureNavUI(){
  if(document.getElementById('navControls')) return;
  const div = document.createElement('div');
  div.id = 'navControls';
  div.style.cssText = 'position:fixed;left:12px;bottom:96px;z-index:999;display:flex;flex-direction:column;gap:8px;';
  div.innerHTML = `
    <button id="btnNavStart" style="background:#10b981;color:#fff;border:0;padding:10px 12px;border-radius:999px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,0.25);cursor:pointer;">▶ Chỉ đường • Góc 1</button>
    <button id="btnNavFollow" style="background:#111827;color:#fff;border:0;padding:8px 12px;border-radius:999px;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.25);cursor:pointer;">Góc: Thứ nhất</button>
    <button id="btnNavMini" style="background:#fff;color:#111827;border:0;padding:8px 12px;border-radius:999px;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.25);cursor:pointer;">Minimap: Bật</button>
  `;
  document.body.appendChild(div);
  document.getElementById('btnNavStart').onclick = ()=>{
    if(!isNavigating) startNavigationMode(); else stopNavigationMode();
  };
  document.getElementById('btnNavFollow').onclick = ()=>{
    navFollowMode = (navFollowMode==='first-person') ? 'free' : 'first-person';
    document.getElementById('btnNavFollow').textContent = (navFollowMode==='first-person') ? 'Góc: Thứ nhất' : 'Góc: Tự do';
    if(navFollowMode==='first-person' && lastUserPos) updateNavCamera(lastUserPos, lastUserPos.heading||0);
    else if(map) map.easeTo({ pitch:0, duration:500 });
  };
  document.getElementById('btnNavMini').onclick = ()=>{
    navMinimapVisible = !navMinimapVisible;
    document.getElementById('btnNavMini').textContent = navMinimapVisible ? 'Minimap: Bật' : 'Minimap: Tắt';
    if(navMinimap) navMinimap.style.display = navMinimapVisible ? 'block' : 'none';
    if(navMinimapVisible && isNavigating) ensureNavMinimap();
  };
}
function ensureNavMinimap(){
  if(navMinimapMap) return;
  if(!document.getElementById('navMinimap')){
    const el = document.createElement('div');
    el.id = 'navMinimap';
    el.style.cssText = 'position:fixed;right:12px;bottom:96px;width:190px;height:150px;z-index:998;border-radius:14px;overflow:hidden;border:2px solid #fff;box-shadow:0 8px 20px rgba(0,0,0,0.3);background:#e5e7eb;';
    // Nhan nho de biet day la minimap, bam vao thi van keo tha tu do duoc
    const label = document.createElement('div');
    label.textContent = 'Minimap • kéo để xem tự do';
    label.style.cssText = 'position:absolute;top:4px;left:6px;z-index:2;background:rgba(0,0,0,0.6);color:#fff;font-size:10px;padding:2px 6px;border-radius:999px;';
    el.appendChild(label);
    document.body.appendChild(el);
    navMinimap = el;
  } else {
    navMinimap = document.getElementById('navMinimap');
  }
  navMinimap.style.display = navMinimapVisible ? 'block' : 'none';
  try{
    navMinimapMap = new maplibregl.Map({ container:'navMinimap', style: TRACKASIA_STYLE, center: map ? map.getCenter().toArray() : [105.8542, 21.0285], zoom: 14, pitch:0, bearing:0, attributionControl:false, interactive:true });
    navMinimapMap.on('load', ()=>{ syncRouteToMinimap(); syncUserToMinimap(); });
  }catch(e){}
}
function syncRouteToMinimap(){
  if(!navMinimapMap || !navMinimapMap.isStyleLoaded()) return;
  if(!currentRouteCoords || currentRouteCoords.length===0) return;
  const data = { type:'Feature', geometry:{ type:'LineString', coordinates: currentRouteCoords.map(c=>[c[1], c[0]]) } };
  if(navMinimapMap.getSource('mini-route')){
    navMinimapMap.getSource('mini-route').setData(data);
  } else {
    navMinimapMap.addSource('mini-route', { type:'geojson', data });
    navMinimapMap.addLayer({ id:'mini-route-layer', type:'line', source:'mini-route', layout:{ 'line-join':'round','line-cap':'round' }, paint:{ 'line-color':'#3b82f6','line-width':4 } });
  }
  // Minimap khong tu dong chay theo user, de user keo tu do, chi fit lan dau
  try{
    const b = new maplibregl.LngLatBounds();
    currentRouteCoords.forEach(c=>b.extend([c[1], c[0]]));
    navMinimapMap.fitBounds(b, { padding:18, duration:0 });
  }catch(e){}
}
function syncUserToMinimap(){
  if(!navMinimapMap || !navMinimapMap.isStyleLoaded() || !lastUserPos) return;
  const data = { type:'FeatureCollection', features:[{ type:'Feature', geometry:{ type:'Point', coordinates:[lastUserPos.lng, lastUserPos.lat] }, properties:{} }] };
  if(navMinimapMap.getSource('mini-user')){
    navMinimapMap.getSource('mini-user').setData(data);
  } else {
    navMinimapMap.addSource('mini-user', { type:'geojson', data });
    navMinimapMap.addLayer({ id:'mini-user-layer', type:'circle', source:'mini-user', paint:{ 'circle-radius':7, 'circle-color':'#10b981', 'circle-stroke-width':2, 'circle-stroke-color':'#fff' } });
  }
}
function updateNavCamera(pos, heading){
  if(!isNavigating || navFollowMode!=='first-person' || !map) return;
  if(_isUserDraggingMap) return;
  // Throttle camera: khong ease lien tuc, chi ease khi lech >15m hoac lech bearing >12 do
  try{
    const nowC = Date.now();
    if(nowC - _lastCamAt < 900) return;
    const c = map.getCenter();
    const dC = calcDist(c.lat, c.lng, pos.lat, pos.lng);
    const bDiff = Math.abs(((map.getBearing()||0) - (heading||0) + 540) % 360 - 180);
    if(dC < 15 && bDiff < 12 && map.getPitch() > 40) return;
    _lastCamAt = nowC;
    // essential:false de user van keo duoc map khi camera dang chay
    map.easeTo({ center:[pos.lng, pos.lat], bearing: heading||0, pitch:60, zoom: Math.max(map.getZoom(), 17.5), duration:350, essential:false });
  }catch(e){}
}
window.startNavigationMode = function(){
  if(!currentRouteCoords || currentRouteCoords.length===0){ alert('Chưa có tuyến đường. Hãy chọn điểm đến và bấm Chỉ đường trước.'); return; }
  isNavigating = true;
  navFollowMode = 'first-person';
  ensureNavUI();
  document.getElementById('btnNavStart').textContent = '■ Dừng chỉ đường';
  document.getElementById('btnNavFollow').textContent = 'Góc: Thứ nhất';
  ensureNavMinimap();
  syncRouteToMinimap();
  if(lastUserPos) updateNavCamera(lastUserPos, lastUserPos.heading||0);
};
window.stopNavigationMode = function(){
  isNavigating = false;
  try{ if(map) map.easeTo({ pitch:0, bearing:0, duration:600 }); }catch(e){}
  if(navMinimap) navMinimap.style.display='none';
  const btn = document.getElementById('btnNavStart');
  if(btn) btn.textContent = '▶ Chỉ đường • Góc 1';
};
// Khi ve tuyen moi thi dong bo len minimap luon
const _origDrawRoute = drawCurrentRoute;
drawCurrentRoute = function(){
  _origDrawRoute();
  setTimeout(()=>{ if(isNavigating) syncRouteToMinimap(); }, 300);
};
// Khi user di chuyen thi cap nhat camera goc 1 + cham user tren minimap
if(typeof updateUserMarkerOnMap==='function' && !_origUpdateUserMarker){
  _origUpdateUserMarker = updateUserMarkerOnMap;
  updateUserMarkerOnMap = function(pos, heading){
    _origUpdateUserMarker(pos, heading);
    if(isNavigating){
      updateNavCamera(pos, heading||0);
      syncUserToMinimap();
    }
  };
}
// Hien nut dieu khien ngay khi app load xong
setTimeout(()=>{ try{ ensureNavUI(); }catch(e){} }, 1200);


/* ============================================================
   [MOI V3] BO BANG RE TREN DAU + MUI TEN TRANG TREN DUONG
   - Bo bang xanh "170m Re phai / Sau do" tren dau (HUD top)
   - Giu goc nhin thu nhat + minimap nhu truoc
   - Them mui ten trang tren duong xanh, ngay cho re, giong Google Maps
   ============================================================ */

// 1. An bang re tren dau - chi an phan tren, giu phan duoi (thoi gian / km)
function hideTopTurnBanner(){
  // CSS an toan: an truc tiep cac o HUD top, khong xoa DOM de khoi vo code cu
  let st = document.getElementById('hideTopTurnStyle');
  if(!st){
    st = document.createElement('style');
    st.id = 'hideTopTurnStyle';
    st.textContent = `
      /* An bang re tren dau */
      #hudNextArrow, #hudNextDist, #hudNextInstr, #hudNextStopDist { display:none !important; }
      /* Neu HUD top la 1 khoi rieng, an luon khoi do, giu khoi duoi */
      #hud .hud-top, #hud .hud-next, #hud .hud-maneuver, .turn-banner, #turnBanner { display:none !important; }
      /* HUD chi con phan duoi (thoi gian / km / toc do) */
      #hud { padding-top:6px !important; }
    `;
    document.head.appendChild(st);
  }
  // An them bang cha cua hudNextArrow neu no la 1 card rieng (phong truong hop HTML khac)
  try{
    const arrow = document.getElementById('hudNextArrow');
    if(arrow){
      let p = arrow.parentElement;
      // Leo len 2 cap, neu khoi do chi chua thong tin re thi an
      for(let i=0;i<2 && p;i++){
        if(p.id && (p.id.toLowerCase().includes('next') || p.id.toLowerCase().includes('top'))){ p.style.display='none'; break; }
        p = p.parentElement;
      }
    }
  }catch(e){}
  // Ghi de ham cap nhat HUD top thanh no-op de no khong hien lai
  // (ham goc van chay nhung khong con DOM de hien)
}
hideTopTurnBanner();
setTimeout(hideTopTurnBanner, 1500);

// 2. MUI TEN TRANG TREN DUONG - giong anh Google Maps
let whiteArrowMarker = null;
let whiteArrowAheadMarker = null;

function makeWhiteArrowEl(size, opacity){
  const el = document.createElement('div');
  el.style.cssText = `width:${size}px;height:${size}px;pointer-events:none;filter:drop-shadow(0 3px 4px rgba(0,0,0,0.35));`;
  // Mui ten trang, vien xanh dam, giong mui ten trang tren duong xanh cua Google Maps
  el.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none">
      <path d="M24 4 L40 28 L30 28 L30 44 L18 44 L18 28 L8 28 Z" fill="#ffffff" stroke="#1d4ed8" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M24 10 L32 24 L24 20 L16 24 Z" fill="#ffffff" opacity="0.9"/>
    </svg>`;
  el.style.opacity = opacity || '1';
  return el;
}
function bearingBetween(aLat, aLng, bLat, bLng){
  const dy = (bLng - aLng) * Math.cos((aLat+bLat)/2 * Math.PI/180);
  const dx = bLat - aLat;
  let br = 90 - Math.atan2(dy, dx) * 180/Math.PI;
  // MapLibre bearing: 0 = Bac, 90 = Dong. Cong thuc tren tra ve heading theo Bac.
  // Tinh lai cho chuan: bearing = atan2(E, N)
  const lat1 = aLat*Math.PI/180, lat2 = bLat*Math.PI/180;
  const dLng = (bLng-aLng)*Math.PI/180;
  const y = Math.sin(dLng)*Math.cos(lat2);
  const x = Math.cos(lat1)*Math.sin(lat2) - Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLng);
  let b = Math.atan2(y, x)*180/Math.PI;
  return (b+360)%360;
}
function updateWhiteTurnArrow(){
  if(!map || !isNavigating) return;
  // Tim cho re tiep theo tu voiceRouteSteps
  let nextStep = null;
  if(voiceRouteSteps && voiceRouteSteps.length){
    for(let i=voiceStepIndex; i<voiceRouteSteps.length; i++){
      const s = voiceRouteSteps[i];
      if(s && s.maneuver && s.maneuver.location){ nextStep = s; break; }
    }
  }
  if(!nextStep){
    if(whiteArrowMarker) whiteArrowMarker.remove();
    whiteArrowMarker = null;
    return;
  }
  const loc = nextStep.maneuver.location; // [lng, lat] theo Valhalla
  const turnLng = loc[0], turnLat = loc[1];
  // Huong mui ten = huong duong sau cho re (doan tiep theo)
  let arrowBearing = 0;
  try{
    // Tim doan route gan cho re nhat de lay huong ra
    let bestIdx = 0, bestD = Infinity;
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
    // Neu maneuver la re phai / trai thi xoay them cho ro
    const instr = (nextStep.maneuver.instruction||'').toLowerCase();
    const type = (nextStep.maneuver.type||'').toLowerCase();
    // Khong xoay them, giu theo huong duong that, giong Google Maps
  }catch(e){}
  // Dat mui ten trang ngay cho re, hoi lui lai 1 chut de nam tren duong xanh
  if(!whiteArrowMarker){
    const el = makeWhiteArrowEl(44, '1');
    el.id = 'whiteTurnArrow';
    whiteArrowMarker = new maplibregl.Marker({ element: el, anchor:'center', rotationAlignment:'map' });
    whiteArrowMarker.addTo(map);
  }
  whiteArrowMarker.setLngLat([turnLng, turnLat]);
  // Xoay mui ten theo huong duong, tru di bearing cua map de no dung huong that
  const el = whiteArrowMarker.getElement();
  if(el){
    const mapBearing = map.getBearing()||0;
    el.style.transform = `rotate(${arrowBearing - mapBearing}deg)`;
  }
  // Mui ten trang thu 2: chay truoc user 1 doan tren duong xanh, chi huong di
  if(lastUserPos && currentRouteCoords && currentRouteCoords.length){
    // Tim diem tren route cach user ~35m ve phia truoc
    let ahead = null;
    let bestIdx = 0, bestD = Infinity;
    currentRouteCoords.forEach((c,i)=>{
      const d = (c[0]-lastUserPos.lat)*(c[0]-lastUserPos.lat) + (c[1]-lastUserPos.lng)*(c[1]-lastUserPos.lng);
      if(d<bestD){ bestD=d; bestIdx=i; }
    });
    // Lay diem cach 3-4 diem ve phia truoc
    const aheadIdx = Math.min(currentRouteCoords.length-1, bestIdx+4);
    ahead = currentRouteCoords[aheadIdx];
    const aheadNext = currentRouteCoords[Math.min(currentRouteCoords.length-1, aheadIdx+1)];
    if(ahead && aheadNext){
      const b = bearingBetween(ahead[0], ahead[1], aheadNext[0], aheadNext[1]);
      if(!whiteArrowAheadMarker){
        const el2 = makeWhiteArrowEl(30, '0.95');
        el2.id = 'whiteAheadArrow';
        whiteArrowAheadMarker = new maplibregl.Marker({ element: el2, anchor:'center', rotationAlignment:'map' });
        whiteArrowAheadMarker.addTo(map);
      }
      whiteArrowAheadMarker.setLngLat([ahead[1], ahead[0]]);
      const el2 = whiteArrowAheadMarker.getElement();
      if(el2){
        const mb = map.getBearing()||0;
        el2.style.transform = `rotate(${b - mb}deg)`;
      }
    }
  }
}
// Cap nhat mui ten trang moi khi user di chuyen / doi manoeuver
const _origUpdateUserMarkerV3 = updateUserMarkerOnMap;
updateUserMarkerOnMap = function(pos, heading){
  _origUpdateUserMarkerV3(pos, heading);
  if(isNavigating) setTimeout(updateWhiteTurnArrow, 100);
};
// Khi bat dau chi duong thi an bang + hien mui ten
const _origStartNavV3 = window.startNavigationMode;
window.startNavigationMode = function(){
  _origStartNavV3();
  hideTopTurnBanner();
  setTimeout(updateWhiteTurnArrow, 500);
};
const _origStopNavV3 = window.stopNavigationMode;
window.stopNavigationMode = function(){
  _origStopNavV3();
  if(whiteArrowMarker){ whiteArrowMarker.remove(); whiteArrowMarker=null; }
  if(whiteArrowAheadMarker){ whiteArrowAheadMarker.remove(); whiteArrowAheadMarker=null; }
};
// Khi doi tuyen thi cap nhat lai mui ten
const _origDrawRouteV3 = drawCurrentRoute;
drawCurrentRoute = function(){
  _origDrawRouteV3();
  if(isNavigating) setTimeout(updateWhiteTurnArrow, 400);
};


/* ============================================================
   [MOI V4] FIX NUT XEM TAT CA TUYEN + BO PANEL DIEU KHIEN + TU GOC 1 + MINIMAP CHI DE XEM
   1. Nut "Xem tat ca tuyen duong" bam khong co gi: do ham cu chi doc localStorage,
      neu localStorage rong hoac modal #routeOptionsModal khong co trong HTML thi
      getElementById tra null -> loi am, khong hien gi. Fix: dung du lieu trong RAM,
      tu tao modal neu chua co, luon hien it nhat 1 tuyen.
   2. Bo han panel 3 nut "Duong - Goc 1 / Thu nhat / Minimap: Bat" (navControls).
   3. Khi an Chi duong -> tu quay ve Goc 1 (first-person), khong can bam them nut.
   4. Minimap chi de xem: goc phai duoi, nho, khong nut, khong keo.
   ============================================================ */

// --- 2. BO PANEL DIEU KHIEN CU ---
(function removeOldNavControls(){
  const el = document.getElementById('navControls');
  if(el) el.remove();
  // Ghi de ham tao panel cu thanh rong, de setTimeout cu khong tao lai
  if(typeof ensureNavUI === 'function'){
    // ensureNavUI duoc dinh nghia o V2, ghi de sau khi V2 da chay
    // Dung window de chac chan
    try{ ensureNavUI = function(){}; }catch(e){}
  }
  // An them neu no duoc tao lai sau
  setTimeout(()=>{ const e2=document.getElementById('navControls'); if(e2) e2.remove(); }, 2000);
})();
if(typeof window !== 'undefined'){ window.ensureNavUI = function(){}; }

// --- 4. MINIMAP CHI DE XEM - ghi de ban cu ---
function ensureNavMinimapPassive(){
  // Neu da co minimap cu (interactive) thi xoa di tao lai ban chi-de-xem
  if(navMinimapMap){
    try{ navMinimapMap.remove(); }catch(e){}
    navMinimapMap = null;
  }
  if(navMinimap){ try{ navMinimap.remove(); }catch(e){} navMinimap = null; }
  const el = document.createElement('div');
  el.id = 'navMinimap';
  // Goc phai duoi, nho, chi de xem, khong chan nut ben duoi
  el.style.cssText = 'position:fixed;right:12px;bottom:92px;width:150px;height:110px;z-index:997;border-radius:12px;overflow:hidden;border:2px solid #fff;box-shadow:0 6px 16px rgba(0,0,0,0.3);background:#e5e7eb;pointer-events:none;';
  document.body.appendChild(el);
  navMinimap = el;
  navMinimapVisible = true;
  try{
    // interactive:false = chi de xem, khong keo, khong zoom
    navMinimapMap = new maplibregl.Map({ container:'navMinimap', style: TRACKASIA_STYLE, center: map ? map.getCenter().toArray() : [105.8542, 21.0285], zoom: 13, pitch:0, bearing:0, attributionControl:false, interactive:false });
    navMinimapMap.on('load', ()=>{ syncRouteToMinimap(); syncUserToMinimap(); });
  }catch(e){}
}
// Ghi de ham cu
ensureNavMinimap = ensureNavMinimapPassive;

// --- 1. FIX NUT XEM TAT CA TUYEN DUONG ---
window.openAlternativeRoutes = function(){
  try{
    // Lay tuyen tu RAM truoc, roi moi den localStorage, de khong bi phu thuoc vao localStorage
    let routes = [];
    if(currentRouteData) routes.push(currentRouteData);
    // alternativeRoutesData trong RAM (neu co)
    if(Array.isArray(alternativeRoutesData) && alternativeRoutesData.length){
      alternativeRoutesData.forEach(r=>{ if(r && r!==currentRouteData) routes.push(r); });
    }
    // Them tu localStorage neu co
    try{
      const stored = localStorage.getItem('alternativeRoutes');
      if(stored){
        const parsed = JSON.parse(stored);
        if(Array.isArray(parsed)) parsed.forEach(r=>{ if(r && !routes.includes(r)) routes.push(r); });
      }
    }catch(e){}
    // De-duplicate theo distance + geometry length
    const seen = new Set();
    routes = routes.filter(r=>{
      const k = (r.distance||0)+'_'+(r.duration||0)+'_'+((r.geometry&&r.geometry.coordinates&&r.geometry.coordinates.length)||0);
      if(seen.has(k)) return false; seen.add(k); return true;
    });
    if(routes.length===0){
      if(typeof showCustomToast==='function') showCustomToast('Chưa có tuyến đường nào. Hãy chọn điểm đến trước.', 'warning');
      else alert('Chưa có tuyến đường nào. Hãy chọn điểm đến trước.');
      return;
    }
    alternativeRoutesData = routes;
    let html = '';
    if(routes.length===1){
      html += `<div style="padding:10px 12px;background:#eff6ff;border-radius:10px;font-size:13px;margin-bottom:8px;">Chỉ có 1 tuyến đường cho chặng này.</div>`;
    }
    routes.forEach((r, index)=>{
      const dist = (r.distance/1000).toFixed(1);
      const dur = Math.round(r.duration/60);
      const isCurrent = index===0;
      html += `<div class="route-card ${isCurrent?'active':''}" onclick="switchToRoute(${index})" style="cursor:pointer;"><div class="info"><h3>${isCurrent?'Tuyến hiện tại':'Tuyến gợi ý '+index}</h3><p>🛣️ ${dist} km • 🕐 ${dur} phút ${isCurrent?'(đang chọn)':''}</p></div></div>`;
    });
    // Tu tao modal neu HTML khong co #routeOptionsModal (day la ly do bam khong co gi)
    let modal = document.getElementById('routeOptionsModal');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'routeOptionsModal';
      modal.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:1200;background:#fff;border-radius:18px 18px 0 0;padding:16px;max-height:70vh;overflow:auto;box-shadow:0 -8px 30px rgba(0,0,0,0.25);';
      modal.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;"><b>Tất cả tuyến đường</b><button onclick="closeRouteOptions()" style="border:0;background:#f3f4f6;padding:6px 12px;border-radius:999px;cursor:pointer;">✕ Đóng</button></div><div id="routeOptionsBody" style="margin-top:12px;display:flex;flex-direction:column;gap:10px;"></div>`;
      document.body.appendChild(modal);
    }
    let body = document.getElementById('routeOptionsBody');
    if(!body){
      body = document.createElement('div');
      body.id = 'routeOptionsBody';
      modal.appendChild(body);
    }
    body.innerHTML = html;
    modal.classList.add('open');
    modal.style.display = 'block';
    // Dam bao nut Dong hoat dong ca khi ham goc bi loi
    window.closeRouteOptions = function(){
      const m = document.getElementById('routeOptionsModal');
      if(m){ m.classList.remove('open'); m.style.display='none'; }
    };
  }catch(e){
    console.error('openAlternativeRoutes lỗi:', e);
    alert('Không mở được danh sách tuyến: ' + e.message);
  }
};
// Gan lai nut "Xem tat ca tuyen duong" theo text, phong truong hop onclick trong HTML bi sai / mat
function bindViewAllRoutesBtn(){
  const btns = document.querySelectorAll('button');
  btns.forEach(b=>{
    // Nút trong bảng Chỉ đường đã có onclick riêng (fetchAndShowRouteOptions) -> không ghi đè
    if((b.getAttribute('onclick')||'').includes('fetchAndShowRouteOptions')) return;
    if((b.textContent||'').includes('Xem tất cả tuyến')){
      b.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); window.openAlternativeRoutes(); };
    }
  });
}
setTimeout(bindViewAllRoutesBtn, 1000);
setTimeout(bindViewAllRoutesBtn, 3000);
document.addEventListener('click', (e)=>{
  const t = e.target && e.target.closest ? e.target.closest('button') : null;
  if(t && (t.getAttribute('onclick')||'').includes('fetchAndShowRouteOptions')) return;
  if(t && (t.textContent||'').includes('Xem tất cả tuyến')){
    e.preventDefault();
    window.openAlternativeRoutes();
  }
});

// --- 3. AN CHI DUONG -> TU QUAY VE GOC 1 ---
function autoFirstPerson(){
  if(!map) return;
  isNavigating = true;
  navFollowMode = 'first-person';
  // Hien minimap chi-de-xem
  try{ ensureNavMinimapPassive(); syncRouteToMinimap(); }catch(e){}
  if(lastUserPos) updateNavCamera(lastUserPos, lastUserPos.heading||0);
  else if(currentRouteCoords && currentRouteCoords.length){
    // Chua co GPS thi nhin theo diem dau tuyen
    try{ map.easeTo({ center:[currentRouteCoords[0][1], currentRouteCoords[0][0]], pitch:60, zoom:17.5, duration:700 }); }catch(e){}
  }
}
// Khi body them class 'navigating' (app goc bat dau dan duong) thi tu ve Goc 1
try{
  const _navObs = new MutationObserver((muts)=>{
    for(const m of muts){
      if(m.attributeName==='class'){
        const isNav = document.body.classList.contains('navigating');
        if(isNav && !isNavigating){
          setTimeout(autoFirstPerson, 300);
        } else if(!isNav && isNavigating){
          isNavigating = false;
          if(navMinimap){ try{ navMinimap.remove(); }catch(e){} navMinimap=null; navMinimapMap=null; }
          if(whiteArrowMarker){ whiteArrowMarker.remove(); whiteArrowMarker=null; }
          if(whiteArrowAheadMarker){ whiteArrowAheadMarker.remove(); whiteArrowAheadMarker=null; }
        }
      }
    }
  });
  _navObs.observe(document.body, { attributes:true, attributeFilter:['class'] });
}catch(e){}
// Ghi de startNavigationMode cu de khong hien panel nua
window.startNavigationMode = function(){
  autoFirstPerson();
  hideTopTurnBanner();
  setTimeout(updateWhiteTurnArrow, 500);
};
window.stopNavigationMode = function(){
  isNavigating = false;
  try{ if(map) map.easeTo({ pitch:0, bearing:0, duration:600 }); }catch(e){}
  if(navMinimap){ try{ navMinimap.remove(); }catch(e){} navMinimap=null; navMinimapMap=null; }
  if(whiteArrowMarker){ whiteArrowMarker.remove(); whiteArrowMarker=null; }
  if(whiteArrowAheadMarker){ whiteArrowAheadMarker.remove(); whiteArrowAheadMarker=null; }
};


/* ============================================================
   [FIX - PATCH CHO FILE CLAUDE] - append o cuoi file, ghi de ham cu
   Da check file Claude, KHONG phai file v4/v5:
   - Claude DA fix: getCurrentVehicleSpecs() co roi, setVehicleMode/setCarSeats/setTruckAxles co roi.
   - Con 3 loi gay ra "co dich den roi ma bao chua co":
     1) selectLocation('view') khong gan endPoint.
     2) Go text vao o dirInputEnd ma khong bam goi y -> endPoint van null, fetch chi check bien, khong geocode text.
     3) 2 he thong tuyen song song: fetchAndShowRouteOptions() thi co goi API,
        openAlternativeRoutes() (dinh nghia 2 lan, dong 3105 + 3707) thi KHONG BAO GIO goi API,
        chi doc currentRouteData/localStorage, roi bao sai "Hay chon diem den truoc".
        Nut "Xem tat ca tuyen" bi gan vao openAlternativeRoutes nen lan dau luon bao sai.
   Patch nay: dong bo input <-> bien + lam openAlternativeRoutes tu fetch khi chua co tuyen
   + sua VEHICLE_TYPE_MAP['hd'] (Xe CN) tu 'motorcycle' -> 'car'.
   ============================================================ */

// --- Fix phu: Xe CN la o to, khong phai xe may ---
try{ if(typeof VEHICLE_TYPE_MAP !== 'undefined' && VEHICLE_TYPE_MAP) VEHICLE_TYPE_MAP['hd'] = 'car'; }catch(e){}

// --- Nho lan chon gan nhat de khoi phuc khi bien bi mat ---
let _lastPickedClaude = null;

// --- 1) Patch selectLocation: 'view' cung phai la diem den ---
try{
  const _origSelectClaude = selectLocation;
  selectLocation = async function(lat, lng, name){
    _lastPickedClaude = { lat, lng, name };
    const ret = await _origSelectClaude(lat, lng, name);
    try{
      // Ham goc chi gan khi searchContext === 'start' / 'end'.
      // Tim tu o tren cung (view, mac dinh) -> khong gan gi ca -> endPoint van null.
      if(searchContext === 'view' && !endPoint){
        endPoint = { lat, lng, name };
        const ei = document.getElementById('dirInputEnd');
        if(ei) ei.value = name;
        const be = document.getElementById('btnClearEnd');
        if(be) be.classList.remove('hidden');
      }
    }catch(e){}
    return ret;
  };
}catch(e){ console.warn('patch selectLocation (Claude) fail', e); }

// --- 2) Giai quyet goc: text trong o -> toa do (geocode) truoc khi check endPoint ---
async function resolvePointsFromInputsClaude(){
  // Diem di: neu bien null ma co GPS thi dung GPS (openDirections lam vay, nhung fetch thi khong)
  if(!startPoint || !startPoint.lat){
    if(lastUserPos){
      startPoint = { lat: lastUserPos.lat, lng: lastUserPos.lng, name: 'Vị trí của tôi' };
      const si = document.getElementById('dirInputStart');
      if(si) si.value = 'Vị trí của tôi (GPS)';
    } else {
      const stxt = (document.getElementById('dirInputStart')?.value || '').trim();
      if(stxt && stxt !== 'Vị trí của tôi' && stxt !== 'Vị trí của tôi (GPS)'){
        try{
          const r = await apiSearch(stxt);
          if(r && r.results && r.results.length) startPoint = { lat: r.results[0].lat, lng: r.results[0].lng, name: r.results[0].name || stxt };
        }catch(e){}
      }
    }
    if(startPoint){
      const si = document.getElementById('dirInputStart');
      if(si) si.value = startPoint.name;
      const bs = document.getElementById('btnClearStart');
      if(bs) bs.classList.remove('hidden');
    }
  }
  // Diem den: neu bien null ma o co text -> geocode text do
  if(!endPoint || !endPoint.lat){
    const txt = (document.getElementById('dirInputEnd')?.value || '').trim()
      || (document.getElementById('topSearchInput')?.value || '').trim();
    if(_lastPickedClaude && txt && (txt === _lastPickedClaude.name || txt.includes(_lastPickedClaude.name.split(',')[0]))){
      endPoint = { lat: _lastPickedClaude.lat, lng: _lastPickedClaude.lng, name: _lastPickedClaude.name };
    } else if(txt){
      try{
        const r = await apiSearch(txt, lastUserPos?.lat || null, lastUserPos?.lng || null);
        if(r && r.results && r.results.length){
          endPoint = { lat: r.results[0].lat, lng: r.results[0].lng, name: r.results[0].name || txt };
        }
      }catch(e){ console.warn('resolve endPoint fail', e); }
    }
    if(endPoint){
      const ei = document.getElementById('dirInputEnd');
      if(ei) ei.value = endPoint.name;
      const be = document.getElementById('btnClearEnd');
      if(be) be.classList.remove('hidden');
    }
  }
  return { startPoint, endPoint };
}

// --- 2b) Patch fetchAndShowRouteOptions: resolve truoc roi moi goi ham goc ---
try{
  const _origFetchClaude = window.fetchAndShowRouteOptions;
  window.fetchAndShowRouteOptions = async function(){
    await resolvePointsFromInputsClaude();
    // Ham goc se check lai endPoint. Neu van null -> luc nay bao "chua co" la DUNG,
    // vi da thu geocode roi ma khong ra.
    return _origFetchClaude();
  };
}catch(e){ console.warn('patch fetchAndShowRouteOptions fail', e); }

// --- 3) Patch openAlternativeRoutes: chua co tuyen thi TU FETCH, khong bao sai ---
try{
  const _origOpenAltClaude = window.openAlternativeRoutes;
  window.openAlternativeRoutes = async function(){
    // Neu chua co tuyen nao duoc fetch -> di fetch truoc, dung bao "hay chon diem den"
    if(!currentRouteData || !currentRouteCoords || !currentRouteCoords.length){
      await window.fetchAndShowRouteOptions();
      return;
    }
    return _origOpenAltClaude();
  };
}catch(e){ console.warn('patch openAlternativeRoutes fail', e); }

// --- 3b) changeSort cung bi chan boi check start/end -> de fetch tu resolve ---
try{
  window.changeSort = function(mode){
    currentSortMode = mode;
    window.fetchAndShowRouteOptions();
  };
}catch(e){}

// --- Enter trong o diem den -> tinh tuyen luon (truoc day go xong khong co nut nao an) ---
try{
  const _endInput = document.getElementById('dirInputEnd');
  if(_endInput){
    _endInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){ e.preventDefault(); window.fetchAndShowRouteOptions(); }
    });
  }
  const _startInput = document.getElementById('dirInputStart');
  if(_startInput){
    _startInput.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){ e.preventDefault(); window.fetchAndShowRouteOptions(); }
    });
  }
}catch(e){}


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
}catch(e){ console.warn('patch openPoiSheet fail', e); }

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
}catch(e){ console.warn('patch closePoiSheet fail', e); }

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
        timestamp: Date.now(), upvotes: 0
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
}catch(e){ console.warn('patch submitCommunityPoi fail', e); }

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
}catch(e){ console.warn('patch changeLayer fail', e); }


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
  }catch(e){ console.warn('patch updateRemainingHUD fail', e); }

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
  }catch(e){ console.warn('patch animateMarkerTo fail', e); }
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
  }catch(e){ console.warn('patch updateUserMarkerOnMap fail', e); }
  setInterval(()=>{ try{ const hud = document.getElementById('hud'); if(hud && !hud.classList.contains('hidden')) applyRouteBearingToArrow(); }catch(e){} }, 300);
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
      body.google-nav #suggestionsBox.show{ display:block !important; }
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
      bot.innerHTML = '<div id="gNavBottomRow"><button id="gNavExitBtn" title="Thoát chỉ đường"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3c4043" stroke-width="2.2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button><div id="gNavBottomInfo"><div id="gNavRemainTime">3 phút</div><div id="gNavRemainMeta">900 m • 7:11</div></div><button id="gNavLayerBtn" title="Lớp bản đồ"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" stroke-width="2" stroke-linejoin="round"><path d="M12 3 L21 8 L12 13 L3 8 Z"/><path d="M3 11 L12 16 L21 11"/><path d="M3 15 L12 20 L21 15"/></svg></button></div>';
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
        try{
          navFollowMode = 'first-person';
          if(lastUserPos) updateNavCamera(lastUserPos, lastUserPos.heading || 0);
          hideRecenterBtn();
        }catch(e){}
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
        try{
          navFollowMode = 'first-person';
          if(lastUserPos) updateNavCamera(lastUserPos, lastUserPos.heading || 0);
          hideRecenterBtn();
        }catch(e){}
      };
      document.body.appendChild(rb);
    }
    // Luon dam bao nut mui ten + nut Ket thuc co mat (ca khi DOM da co tu truoc)
    try{ ensureBottomExpandBtn(); }catch(e){}
    try{ ensureTopEndTripBtn(); }catch(e){}
    try{ patchExistingGoogleNav(); }catch(e){}
  }
  function showGoogleNavUI(){ ensureGoogleNavUI(); try{ patchExistingGoogleNav(); }catch(e){} ['gNavTopBanner','gNavNextBanner','gNavBottomSheet','gNavRightControls'].forEach(id=>{ const el=document.getElementById(id); if(el) el.classList.add('show'); }); try{ const bot=document.getElementById('gNavBottomSheet'); if(bot) bot.classList.remove('collapsed'); const exp=document.getElementById('gNavBottomExpandBtn'); if(exp) exp.classList.remove('show'); const rc=document.getElementById('gNavRightControls'); if(rc) rc.style.bottom=''; }catch(e){} }
  function hideGoogleNavUI(){ ['gNavTopBanner','gNavNextBanner','gNavBottomSheet','gNavRightControls','gNavRecenterBtn','gNavBottomExpandBtn'].forEach(id=>{ const el=document.getElementById(id); if(el) el.classList.remove('show'); }); try{ const bot=document.getElementById('gNavBottomSheet'); if(bot) bot.classList.remove('collapsed'); const rc=document.getElementById('gNavRightControls'); if(rc) rc.style.bottom=''; }catch(e){} }
  function showRecenterBtn(){ const el=document.getElementById('gNavRecenterBtn'); if(el) el.classList.add('show'); }
  function hideRecenterBtn(){ const el=document.getElementById('gNavRecenterBtn'); if(el) el.classList.remove('show'); }
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
  try{
    updateNavCamera = function(pos, heading){
      if(!isNavigating || navFollowMode !== 'first-person' || !map) return;
      try{
        if(_isUserDraggingMap) return;
        const nowC2 = Date.now();
        if(nowC2 - _lastCamAt < 900) return;
        try{
          const cc = map.getCenter();
          const dd = calcDist(cc.lat, cc.lng, pos.lat, pos.lng);
          const bd = Math.abs(((map.getBearing()||0) - (heading||0) + 540) % 360 - 180);
          if(dd < 15 && bd < 12 && map.getPitch() > 40) return;
        }catch(e){}
        _lastCamAt = nowC2;
        // Google: pitch 55, zoom 17.5, bearing = heading, offset day user xuong duoi man hinh
        // essential:false de khong khoa keo map
        map.easeTo({ center:[pos.lng, pos.lat], bearing: heading||0, pitch:55, zoom: Math.max(map.getZoom(), 17.5), offset:[0, 110], duration:350, essential:false });
        // Xoay la ban theo bearing
        const comp = document.querySelector('#gNavCompassBtn .compass-arrow');
        if(comp) comp.style.transform = 'rotate(' + (-(heading||0)) + 'deg)';
      }catch(e){}
    };
  }catch(e){ console.warn('patch updateNavCamera Google fail', e); }

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
  }catch(e){ console.warn('patch userMarker Google fail', e); }
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
  }catch(e){ console.warn('patch animateMarker Google fail', e); }

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
    // Xoa minimap + panel cu (kieu anh 1)
    try{
      const mm = document.getElementById('navMinimap'); if(mm) mm.style.display = 'none';
      if(navMinimapMap){ try{ navMinimapMap.remove(); }catch(e){} navMinimapMap = null; }
      if(navMinimap){ try{ navMinimap.remove(); }catch(e){} navMinimap = null; }
      const nc = document.getElementById('navControls'); if(nc) nc.style.display = 'none';
      navMinimapVisible = false;
    }catch(e){}
    // Xoa style an banner cu (V3) de khong anh huong banner moi
    try{ const hs = document.getElementById('hideTopTurnStyle'); if(hs) hs.remove(); }catch(e){}
    showGoogleNavUI();
    hideRecenterBtn();
    if(lastUserPos) updateNavCamera(lastUserPos, lastUserPos.heading || 0);
    else if(currentRouteCoords && currentRouteCoords.length){ try{ map.easeTo({ center:[currentRouteCoords[0][1], currentRouteCoords[0][0]], pitch:55, zoom:17.5, offset:[0,110], duration:700 }); }catch(e){} }
    try{ updateGoogleNavBanner(); updateRemainingHUD(); }catch(e){}
    // Khi user keo map thi hien nut Ve giua + dung follow
    try{
      if(map && !map._googleDragBound){
        map._googleDragBound = true;
        // Keo map -> danh dau dang keo, chuyen sang free de camera khong giat lai
  // (ca khi dang dan duong Google lan dan duong thuong)
  map.on('dragstart', ()=>{ _isUserDraggingMap = true; try{ if(map) map.stop(); }catch(e){} if(typeof isNavigating !== 'undefined' && isNavigating){ navFollowMode = 'free'; } if(document.body.classList.contains('google-nav')){ navFollowMode = 'free'; showRecenterBtn(); } });
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
    hideGoogleNavUI();
    try{ if(map) map.easeTo({ pitch:0, bearing:0, offset:[0,0], duration:600 }); }catch(e){}
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
   [FIX 2026-11-21] KHOI PHUC HUD + GIU MINIMAP CO NUT X + NUT MUI TEN KEO LAI
   - Loi truoc: Google patch an #hud (display:none) + xoa minimap -> mat luon HUD + mat minimap
   - Fix: Khong an #hud nua, HUD goc hien lai duoi banner Google, banner Google van hien
   - Minimap GIU NGUYEN, them nut X de tat + nut mui ten de keo lai + tay keo de di chuyen minimap
   ============================================================ */
(function(){
  // ---- 1. Sua CSS: xoa rule an #hud / minimap cua Google patch cu ----
  try{
    const old = document.getElementById('googleNavStyle20261121');
    if(old) old.remove();
  }catch(e){}
  function injectFixCSS(){
    if(document.getElementById('googleNavFix20261121')) return;
    const st = document.createElement('style');
    st.id = 'googleNavFix20261121';
    st.textContent = `
      /* Google banner van giu, nhung KHONG an HUD goc nua */
      #gNavTopBanner{ position:fixed !important; top:calc(12px + env(safe-area-inset-top, 0px)) !important; left:12px !important; right:12px !important; z-index:800 !important; background:#0F766E !important; background:linear-gradient(180deg,#0F766E,#0B5E55) !important; color:#fff !important; border-radius:16px !important; padding:14px 16px !important; display:none; align-items:center; gap:14px; box-shadow:0 6px 20px rgba(0,0,0,0.28) !important; }
      #gNavTopBanner.show{ display:flex !important; }
      #gNavTopArrow{ width:52px; height:52px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:38px; font-weight:900; line-height:1; color:#fff; }
      #gNavTopMain{ flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
      #gNavTopDist{ font-size:18px; font-weight:700; color:rgba(255,255,255,0.92); line-height:1.2; }
      #gNavTopInstr{ font-size:24px; font-weight:800; line-height:1.15; color:#fff; word-break:break-word; }
      #gNavNextBanner{ position:fixed !important; top:calc(96px + env(safe-area-inset-top, 0px)) !important; left:12px !important; z-index:799 !important; background:#0B5E55 !important; color:#fff !important; border-radius:0 0 14px 14px !important; padding:8px 14px 10px !important; display:none; align-items:center; gap:8px; font-size:17px; font-weight:700; box-shadow:0 4px 14px rgba(0,0,0,0.22) !important; max-width:78vw; }
      #gNavNextBanner.show{ display:flex !important; }
      #gNavBottomSheet{ position:fixed !important; left:0 !important; right:0 !important; bottom:0 !important; z-index:800 !important; background:#fff !important; border-radius:20px 20px 0 0 !important; padding:12px 16px calc(14px + env(safe-area-inset-bottom, 0px)) !important; display:none; align-items:center; gap:14px; box-shadow:0 -6px 24px rgba(0,0,0,0.18) !important; }
      #gNavBottomRow{ display:flex !important; align-items:center !important; gap:14px !important; width:100% !important; }
      /* Bo nut Ket thuc chuyen di - chi dung nut X de thoat */
      #gNavBottomEndTripBtn, #gNavEndTripBtn{ display:none !important; }
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
      /* Cot nut phai - day len tren de khong de minimap */
      #gNavRightControls{ position:fixed !important; right:12px !important; bottom:calc(270px + env(safe-area-inset-bottom, 0px)) !important; z-index:800 !important; display:none; flex-direction:column; gap:12px; }
      #gNavRightControls.show{ display:flex !important; }
      .gNavRoundBtn{ width:56px; height:56px; border-radius:999px; background:#fff; border:none; box-shadow:0 4px 14px rgba(0,0,0,0.22); font-size:22px; color:#3c4043; cursor:pointer; display:flex; align-items:center; justify-content:center; }
      .gNavRoundBtn svg{ display:block; flex-shrink:0; }
      #gNavLayerBtn svg, #gNavExitBtn svg{ display:block; flex-shrink:0; }
      #gNavCompassBtn .compass-arrow{ font-size:24px; font-weight:900; color:#ea4335; display:inline-block; }
      #gNavRecenterBtn{ position:fixed !important; left:16px !important; bottom:calc(132px + env(safe-area-inset-bottom, 0px)) !important; z-index:800 !important; background:#fff !important; color:#0F766E !important; border:none !important; border-radius:999px !important; padding:10px 16px !important; font-size:15px !important; font-weight:800 !important; box-shadow:0 4px 14px rgba(0,0,0,0.22) !important; display:none; align-items:center; gap:6px; cursor:pointer; }
      #gNavRecenterBtn.show{ display:flex !important; }
      /* HUD goc: HIEN LAI, day xuong duoi banner Google de khong bi de */
      body.google-nav #hud{ display:block !important; visibility:visible !important; opacity:1 !important; }
      body.google-nav #hud.hidden{ display:block !important; }
      body.google-nav .hud-bottom{ top:calc(168px + env(safe-area-inset-top, 0px)) !important; }
      body.google-nav .hud-top{ top:calc(230px + env(safe-area-inset-top, 0px)) !important; }
      body.google-nav .hud-next{ top:calc(290px + env(safe-area-inset-top, 0px)) !important; }
      /* Minimap: giu nguyen, them nut X + tay keo */
      #navMinimap{ touch-action:none; }
      #minimapCloseBtn{ position:absolute; top:6px; right:6px; z-index:10; width:26px; height:26px; border-radius:999px; background:rgba(0,0,0,0.65); color:#fff; border:none; font-size:14px; font-weight:800; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; }
      #minimapDragHandle{ position:absolute; top:6px; left:6px; z-index:10; height:26px; padding:0 8px; border-radius:999px; background:rgba(0,0,0,0.65); color:#fff; border:none; font-size:12px; font-weight:700; cursor:grab; display:flex; align-items:center; gap:4px; }
      #minimapDragHandle:active{ cursor:grabbing; }
      #minimapLabel{ position:absolute; bottom:6px; left:6px; z-index:10; background:rgba(0,0,0,0.6); color:#fff; font-size:10px; padding:2px 6px; border-radius:999px; pointer-events:none; }
      /* Nut mui ten khoi phuc minimap khi da tat */
      /* Nut vuong + mui ten (khoi phuc minimap) - de gan goc duoi-trai HUD, ngay tren bottom-sheet */
      #minimapRestoreBtn{ position:fixed !important; left:12px !important; right:auto !important; bottom:calc(92px + env(safe-area-inset-bottom, 0px)) !important; z-index:801 !important; width:48px; height:48px; border-radius:999px; background:#fff; border:none; box-shadow:0 4px 14px rgba(0,0,0,0.28); font-size:22px; cursor:pointer; display:none; align-items:center; justify-content:center; }
      #minimapRestoreBtn.show{ display:flex !important; }
      body.minimap-closed #navMinimap{ display:none !important; }
      .g-user-dot{ width:22px; height:22px; border-radius:999px; background:#1a73e8; border:4px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.35), 0 0 0 8px rgba(26,115,232,0.18); }
      .g-user-dot-wrap{ width:38px; height:38px; display:flex; align-items:center; justify-content:center; }
    `;
    document.head.appendChild(st);
  }
  injectFixCSS();

  // ---- 2. Minimap: nut X + nut mui ten khoi phuc + keo ----
  function ensureMinimapRestoreBtn(){
    if(!document.getElementById('minimapRestoreBtn')){
      const b = document.createElement('button');
      b.id = 'minimapRestoreBtn';
      b.title = 'Hiện lại minimap';
      b.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3c4043" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="12" height="12" rx="1"/><path d="M14 9l6-6"/><path d="M15 3h5v5"/></svg>';
      b.onclick = ()=>{
        document.body.classList.remove('minimap-closed');
        b.classList.remove('show');
        try{ navMinimapVisible = true; }catch(e){}
        const mm = document.getElementById('navMinimap');
        if(mm) mm.style.display = 'block';
        else { try{ if(typeof ensureNavMinimapWithControls === 'function') ensureNavMinimapWithControls(); }catch(e){} }
      };
      document.body.appendChild(b);
    }
  }
  function ensureMinimapControls(){
    const mm = document.getElementById('navMinimap');
    if(!mm) return;
    // Cho phep tuong tac (patch cu de pointer-events:none nen khong bam duoc X)
    mm.style.pointerEvents = 'auto';
    mm.style.touchAction = 'none';
    if(!document.getElementById('minimapCloseBtn')){
      const x = document.createElement('button');
      x.id = 'minimapCloseBtn';
      x.textContent = '✕';
      x.title = 'Tắt minimap';
      x.onclick = (e)=>{
        e.stopPropagation();
        document.body.classList.add('minimap-closed');
        mm.style.display = 'none';
        try{ navMinimapVisible = false; }catch(err){}
        ensureMinimapRestoreBtn();
        const rb = document.getElementById('minimapRestoreBtn');
        if(rb) rb.classList.add('show');
      };
      mm.appendChild(x);
    }
    if(!document.getElementById('minimapDragHandle')){
      const h = document.createElement('button');
      h.id = 'minimapDragHandle';
      h.title = 'Giữ để kéo minimap';
      h.innerHTML = '↕ Kéo';
      mm.appendChild(h);
      // Keo minimap: giu nut Keo roi keo
      let dragging = false, startX=0, startY=0, startLeft=0, startTop=0;
      h.addEventListener('pointerdown', (e)=>{
        dragging = true;
        h.setPointerCapture(e.pointerId);
        startX = e.clientX; startY = e.clientY;
        const r = mm.getBoundingClientRect();
        startLeft = r.left; startTop = r.top;
        mm.style.right = 'auto'; mm.style.bottom = 'auto';
        mm.style.left = startLeft + 'px'; mm.style.top = startTop + 'px';
      });
      h.addEventListener('pointermove', (e)=>{
        if(!dragging) return;
        const nx = Math.max(8, Math.min(window.innerWidth - 80, startLeft + (e.clientX - startX)));
        const ny = Math.max(8, Math.min(window.innerHeight - 80, startTop + (e.clientY - startY)));
        mm.style.left = nx + 'px'; mm.style.top = ny + 'px';
      });
      const endDrag = ()=>{ dragging = false; };
      h.addEventListener('pointerup', endDrag);
      h.addEventListener('pointercancel', endDrag);
    }
    if(!document.getElementById('minimapLabel')){
      const lb = document.createElement('div');
      lb.id = 'minimapLabel';
      lb.textContent = 'Minimap • X để tắt • ↕ để kéo';
      mm.appendChild(lb);
    }
  }
  function ensureNavMinimapWithControls(){
    // Neu minimap da co thi chi them nut
    const existing = document.getElementById('navMinimap');
    if(existing){
      ensureMinimapControls();
      if(!document.body.classList.contains('minimap-closed')) existing.style.display = 'block';
      return;
    }
    // Chua co -> tao moi kieu cu (interactive:true de keo duoc ban do ben trong)
    try{
      const el = document.createElement('div');
      el.id = 'navMinimap';
      el.style.cssText = 'position:fixed;right:12px;bottom:92px;width:170px;height:120px;z-index:997;border-radius:12px;overflow:hidden;border:2px solid #fff;box-shadow:0 6px 16px rgba(0,0,0,0.3);background:#e5e7eb;';
      document.body.appendChild(el);
      navMinimap = el;
      navMinimapVisible = true;
      try{
        navMinimapMap = new maplibregl.Map({ container:'navMinimap', style: TRACKASIA_STYLE, center: map ? map.getCenter().toArray() : [105.8542, 21.0285], zoom: 13, pitch:0, bearing:0, attributionControl:false, interactive:true });
        navMinimapMap.on('load', ()=>{ try{ syncRouteToMinimap(); syncUserToMinimap(); }catch(e){} });
      }catch(e){}
      ensureMinimapControls();
    }catch(e){}
  }
  // Khoi phuc ham ensureNavMinimap bi Google patch ghi de thanh no-op
  try{
    ensureNavMinimap = function(){ ensureNavMinimapWithControls(); };
    if(typeof ensureNavMinimapPassive !== 'undefined') ensureNavMinimapPassive = function(){ ensureNavMinimapWithControls(); };
    window.ensureNavMinimapWithControls = ensureNavMinimapWithControls;
  }catch(e){}

  // ---- 3. Khoi phuc HUD: dam bao Google HUD + HUD goc deu hien khi dang dan duong ----
  function forceShowHUD(){
    try{
      const isNav = document.body.classList.contains('navigating') || (typeof isNavigating !== 'undefined' && isNavigating);
      if(!isNav) return;
      // Google HUD
      const top = document.getElementById('gNavTopBanner'); if(top) top.classList.add('show');
      const bot = document.getElementById('gNavBottomSheet'); if(bot) bot.classList.add('show');
      const rc = document.getElementById('gNavRightControls'); if(rc) rc.classList.add('show');
      // HUD goc: bo hidden, hien lai
      const hud = document.getElementById('hud');
      if(hud){ hud.classList.remove('hidden'); hud.style.display = 'block'; hud.style.visibility = 'visible'; hud.style.opacity = '1'; }
      // Xoa style an HUD cu neu con
      try{ const hs = document.getElementById('hideTopTurnStyle'); if(hs) hs.remove(); }catch(e){}
      // Minimap: neu user khong tat thi hien lai
      if(!document.body.classList.contains('minimap-closed')){
        const mm = document.getElementById('navMinimap');
        if(mm){ mm.style.display = 'block'; ensureMinimapControls(); }
        else { ensureNavMinimapWithControls(); }
      }
    }catch(e){}
  }
  // Watchdog: cu 800ms kiem tra, neu dang dan duong ma HUD mat thi hien lai
  setInterval(forceShowHUD, 800);

  // Ghi de activate: khong xoa minimap, khong an HUD
  try{
    const _origStartHUD2 = startNavigationHUD;
    startNavigationHUD = function(){
      const r = _origStartHUD2.apply(this, arguments);
      try{
        document.body.classList.add('google-nav');
        forceShowHUD();
        ensureMinimapWithControls();
      }catch(e){}
      return r;
    };
  }catch(e){}
  try{
    autoFirstPerson = function(){
      if(!map) return;
      document.body.classList.add('google-nav');
      document.body.classList.add('navigating');
      isNavigating = true;
      navFollowMode = 'first-person';
      forceShowHUD();
      try{ ensureNavMinimapWithControls(); }catch(e){}
      if(lastUserPos) updateNavCamera(lastUserPos, lastUserPos.heading || 0);
    };
  }catch(e){}
  try{
    window.startNavigationMode = function(){
      document.body.classList.add('google-nav');
      document.body.classList.add('navigating');
      isNavigating = true;
      forceShowHUD();
      try{ ensureNavMinimapWithControls(); }catch(e){}
      setTimeout(()=>{ try{ updateWhiteTurnArrow(); }catch(e){} }, 500);
    };
    const _origStop = window.stopNavigationMode;
    window.stopNavigationMode = function(){
      document.body.classList.remove('google-nav');
      document.body.classList.remove('minimap-closed');
      const rb = document.getElementById('minimapRestoreBtn'); if(rb) rb.classList.remove('show');
      const hud = document.getElementById('hud');
      if(hud){ hud.style.display = ''; }
      try{ if(typeof deactivateGoogleNav === 'function') deactivateGoogleNav(); }catch(e){}
      // Hien lai minimap mac dinh khi dung (de lan sau co san)
      try{ if(map) map.easeTo({ pitch:0, bearing:0, offset:[0,0], duration:600 }); }catch(e){}
      isNavigating = false;
      // An Google HUD
      ['gNavTopBanner','gNavNextBanner','gNavBottomSheet','gNavRightControls','gNavRecenterBtn'].forEach(id=>{ const el=document.getElementById(id); if(el) el.classList.remove('show'); });
    };
  }catch(e){}
  // Khi body them navigating (app goc) thi hien HUD + minimap ngay
  try{
    const _fixObs = new MutationObserver(()=>{
      if(document.body.classList.contains('navigating')) setTimeout(()=>{ forceShowHUD(); ensureMinimapWithControls(); }, 300);
    });
    _fixObs.observe(document.body, { attributes:true, attributeFilter:['class'] });
  }catch(e){}
  // Chay ngay neu dang dan duong
  setTimeout(()=>{ if(document.body.classList.contains('navigating')) forceShowHUD(); }, 500);
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
   [FIX 2026-11-22] LA BAN TREN - VE GIUA DUOI + MIGRATION BOTTOM SHEET + LAYER POPUP
   ============================================================ */
(function(){
  // 1. Tao stack trai: chua la ban (tren) + Ve giua (duoi)
  function ensureLeftStack(){
    let stack = document.getElementById('gNavLeftStack');
    if(!stack){
      stack = document.createElement('div');
      stack.id = 'gNavLeftStack';
      document.body.appendChild(stack);
    }
    const comp = document.getElementById('gNavCompassBtn');
    const rec = document.getElementById('gNavRecenterBtn');
    // Dua la ban tu cot phai sang stack trai (chi lam 1 lan)
    if(comp && comp.parentElement && comp.parentElement.id !== 'gNavLeftStack'){
      stack.appendChild(comp);
    }
    if(rec && rec.parentElement && rec.parentElement.id !== 'gNavLeftStack'){
      stack.appendChild(rec);
    }
    // Dam bao thu tu: la ban tren, Ve giua duoi
    if(comp && rec && stack.contains(comp) && stack.contains(rec)){
      stack.appendChild(comp); // append lai se dua len dau? khong - append dua xuong cuoi, nen can insertBefore
      stack.insertBefore(comp, rec);
    }
    return stack;
  }
  // 2. Migration bottom sheet cu (da tao tu ban cu): them nut Ket thuc neu chua co
  function ensureBottomEndTrip(){
    // Da bo nut Ket thuc - chi xoa neu con sot
    try{ const b = document.getElementById('gNavBottomEndTripBtn'); if(b) b.remove(); const f = document.getElementById('gNavEndTripBtn'); if(f) f.remove(); }catch(e){}
  }
  // 3. Dong bo show/hide stack trai + bottom EndTrip theo Google Nav
  function sync(){
    try{ ensureLeftStack(); ensureBottomEndTrip(); }catch(e){}
    const stack = document.getElementById('gNavLeftStack');
    if(stack){
      const isNav = document.body.classList.contains('google-nav') || document.body.classList.contains('navigating');
      stack.classList.toggle('show', !!isNav);
    }
  }
  sync();
  setTimeout(sync, 600);
  setTimeout(sync, 1500);
  try{
    const obs = new MutationObserver(()=>sync());
    obs.observe(document.body, { attributes:true, attributeFilter:['class'] });
  }catch(e){}
  // Khi Google Nav UI hien (showGoogleNavUI goi), cung sync
  try{
    const _origShow = window.showGoogleNavUI;
    if(typeof _origShow === 'function'){ /* showGoogleNavUI la inner, khong global - dung observer la du */ }
  }catch(e){}
  // Layer popup: khi mo, dam bao no nam gan nut lop (CSS da neo o bottom-right, chi can scroll vao view)
  try{
    const _origToggle = window.toggleLayerMenu;
    if(typeof _origToggle === 'function'){
      window.toggleLayerMenu = function(){
        const r = _origToggle.apply(this, arguments);
        try{
          const menu = document.getElementById('layerMenu');
          if(menu && document.body.classList.contains('google-nav')){
            menu.style.left = 'auto'; menu.style.right = '12px'; menu.style.bottom = 'calc(168px + env(safe-area-inset-bottom, 0px))'; menu.style.top = 'auto';
          }
        }catch(e){}
        return r;
      };
    }
  }catch(e){}
})();


/* ============================================================
   [FIX 2026-11-22] SEARCH + CLICK MAP KHI DANG CHI DUONG - MIGRATION
   - Nut kinh lup trong Google Nav phai mo duoc search that (khong chi focus o an)
   - Bam map khi dang dan duong van geocoding, khong bi dirSheet chan
   ============================================================ */
(function(){
  // [BAT BUOC] Dang dan duong: khoa search - KHONG mo search nua (ghi de migration cu)
  try{
    const btn = document.getElementById('gNavSearchBtn');
    if(btn){
      btn.style.opacity = '0.4'; btn.style.filter = 'grayscale(1)';
      // Chan listener cu neu co: thay bang toast khoa
      btn.addEventListener('click', (e)=>{ e.stopImmediatePropagation(); try{ if(typeof showCustomToast === 'function') showCustomToast('Đang dẫn đường - tìm kiếm tạm khóa', 'info'); }catch(err){} }, true);
    }
  }catch(e){}
  // Neu user bam X tren overlay search -> dong overlay luon
  try{
    const x = document.getElementById('topSearchClearX');
    if(x && !x._navXFixed){
      x._navXFixed = true;
      x.addEventListener('click', ()=>{
        try{ const fs = document.querySelector('.floating-search'); if(fs) fs.classList.remove('show-in-nav'); }catch(e){}
      });
    }
  }catch(e){}
})();


/* ============================================================
   [FIX 2026-11-22b] POPUP 3 NUT + BO NUT DO + MINIMAP TRAI + 2 NUT POI - MIGRATION
   ============================================================ */
(function(){
  // Bo nut Ket thuc (ca noi + trong bottom-sheet) neu DOM cu con
  try{
    const f = document.getElementById('gNavEndTripBtn'); if(f) f.remove();
    const b = document.getElementById('gNavBottomEndTripBtn'); if(b) b.remove();
    const bot = document.getElementById('gNavBottomSheet'); if(bot){ bot.style.flexDirection = ''; }
  }catch(e){}
  // Them 2 nut POI neu cot phai cu chua co
  try{
    const rc = document.getElementById('gNavRightControls');
    if(rc && !document.getElementById('gNavPoiWarnBtn')){
      const wb = document.createElement('button');
      wb.className = 'gNavRoundBtn'; wb.id = 'gNavPoiWarnBtn'; wb.title = 'POI cảnh báo';
      wb.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 L22 20 H2 Z" fill="#fef3c7"/><line x1="12" y1="10" x2="12" y2="14"/><circle cx="12" cy="17" r="1" fill="#ea580c" stroke="none"/></svg>';
      wb.onclick = ()=>{ try{ if(typeof window.openReportMenu === 'function') window.openReportMenu(); }catch(e){} };
      rc.appendChild(wb);
    }
    if(rc && !document.getElementById('gNavPoiPublicBtn')){
      const pb = document.createElement('button');
      pb.className = 'gNavRoundBtn'; pb.id = 'gNavPoiPublicBtn'; pb.title = 'POI công cộng';
      pb.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 a6 6 0 0 1 6 6 c0 5 -6 10 -6 10 S6 13 6 8 a6 6 0 0 1 6-6 Z" fill="#d1fae5"/><circle cx="12" cy="8" r="2.2"/></svg>';
      pb.onclick = ()=>{ try{ let la=0, ln=0; if(typeof lastUserPos !== 'undefined' && lastUserPos){ la = lastUserPos.lat; ln = lastUserPos.lng; } else if(typeof map !== 'undefined' && map){ const c = map.getCenter(); la = c.lat; ln = c.lng; } if(typeof window.openPoiSheet === 'function') window.openPoiSheet(la, ln, 'Vị trí hiện tại'); }catch(e){} };
      rc.appendChild(pb);
    }
  }catch(e){}
  // Dua nut vuong + mui ten ra goc duoi-trai HUD
  try{
    const rb = document.getElementById('minimapRestoreBtn');
    if(rb){ rb.style.left = '12px'; rb.style.right = 'auto'; rb.style.bottom = 'calc(92px + env(safe-area-inset-bottom, 0px))'; }
  }catch(e){}
  // Khoa search khi dan duong van giu: nut kinh lup chi hien toast (khong mo search)
  try{
    const sb = document.getElementById('gNavSearchBtn');
    if(sb){ sb.style.opacity = '0.4'; sb.style.filter = 'grayscale(1)'; }
  }catch(e){}
})();
