// ═══════════════════════════════════════════════
// DRIVEKIT — Skeleton (logic mai điền)
// ═══════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getDatabase, ref, set, push, remove, onValue, onDisconnect, get
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import {
  getFirestore, collection, addDoc, getDocs, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { DIR_DICT, NAV_DICT } from './dictionary.js';

// ═══════════════════════════════════════════════
// 1. CONFIG
// ═══════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAYxZYEnoxtzpUMaYfQXYWF3lojUX51R48",
  authDomain: "drivekit-c88ef.firebaseapp.com",
  databaseURL: "https://drivekit-c88ef-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "drivekit-c88ef",
  storageBucket: "drivekit-c88ef.firebasestorage.app",
  messagingSenderId: "1073887619343",
  appId: "1:1073887619343:web:d89a872968bc4ee871f67a"
};

const WORKER_URL = 'https://map-birthday.anhminhadof123.workers.dev';
const TRACKASIA_KEY = '1792297789c0cf0ddb16e5446d7364580f';
const TOMTOM_KEY = '';         // TODO: set key

const MAP_STYLES = {
  trackasia: `https://maps.track-asia.com/styles/v2/streets.json?key=${TRACKASIA_KEY}`,
  trackasiaNight: `https://maps.track-asia.com/styles/v2/night.json?key=${TRACKASIA_KEY}`,
  mapbox: `https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=`, // TODO: mapbox token
  satellite: {
    type: 'raster',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    tileSize: 256
  },
  traffic: {
    type: 'raster',
    tiles: [`${WORKER_URL}/traffic/{z}/{x}/{y}`],
    tileSize: 256
  }
};

// ═══════════════════════════════════════════════
// 2. INIT SDK
// ═══════════════════════════════════════════════

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getDatabase(app);
const fsdb = getFirestore(app);

// ═══════════════════════════════════════════════
// 3. STATE
// ═══════════════════════════════════════════════

const state = {
  // User
  user: null,
  // Map
  map: null,
  currentLayer: 'trackasia',
  is3D: false,
  trafficOn: false,
  theme: localStorage.getItem('theme') || 'dark',
  // Route
  startPoint: null,
  endPoint: null,
  currentRoute: null,         // { coords, distance, duration, steps, mode, provider }
  alternativeRoutes: [],
  // Navigation
  isNavigating: false,
  autoRotate: true,
  userRotated: false,
  voiceEnabled: true,
  voiceSteps: null,
  voiceStepIdx: 0,
  lastSnapIdx: 0,
  tripStartTime: null,
  warnedReports: new Set(),
  // Vehicle / routing
  vehicleMode: 'motorcycle',
  routingProvider: 'mapbox',
  truckParams: { height: 3.5, weight: 10, width: 2.5, length: 8 },
  // GPS
  watchId: null,
  lastUserPos: null,
  lastHeading: 0,
  smoothedSpeed: 0,
  userMarker: null,
  accuracyCircle: null,
  // Search
  searchContext: 'view',
  searchTimer: null,
  // Data caches
  allRestStops: [],
  allCommunityPois: [],
  allReports: {},
  allAvoidZones: [],
  allSavedPlaces: {},
  allHistory: [],
  allSavedRoutes: [],
  // Markers
  communityMarkers: [],
  restStopMarkers: [],
  reportMarkers: [],
  savedPlaceMarkers: [],
  // Live room
  liveEnabled: false,
  liveRoomCode: null,
  isHost: false,
  liveMembers: [],
  liveMemberMarkers: {},
  liveMyMarker: null,
  // MapLibre
  bearing: 0,
  pitch: 0,
};

// ═══════════════════════════════════════════════
// 4. UTILS
// ═══════════════════════════════════════════════

const $ = (id) => document.getElementById(id);
const el = $;

function showToast(message, type = 'info') {
  // TODO: tạo toast động, append vào #toastContainer
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

async function fetchWorker(path, opts = {}) {
  return fetch(`${WORKER_URL}${path}`, { ...opts, headers: { ...(opts.headers || {}) } });
}

// ═══════════════════════════════════════════════
// 5. LOADING SCREEN
// ═══════════════════════════════════════════════

function setLoadProgress(percent, text) {
  // TODO: cập nhật #loadingPercent width + #loadingText
}

function startLoading() {
  // TODO: fake loading interval, force finish sau 8s
}

function finishLoading() {
  // TODO: ẩn #loadingScreen, show #authScreen hoặc #appUI
}

// ═══════════════════════════════════════════════
// 6. AUTH
// ═══════════════════════════════════════════════

function setupAuthUI() {
  // TODO: gắn listener cho #authToggleBtn, #btnSubmitAuth, #btnGoogleAuth
}

function getAuthError(code) {
  // TODO: return message tiếng Việt
}

function handleAuthStateChange(user) {
  // TODO: update state.user, hiển thị info, gọi initAppUI nếu có user
}

function logout() {
  // TODO: signOut + reload
}

// ═══════════════════════════════════════════════
// 7. MAP — PURE MAPLIBRE
// ═══════════════════════════════════════════════

function initMap() {
  // TODO: new maplibregl.Map({ container:'map', style: MAP_STYLES.trackasia, center, zoom })
  // TODO: gắn listeners 'rotate','pitch' → cập nhật state.bearing/pitch + compass
}

function setMapLayer(layerName, btnEl) {
  // TODO: map.setStyle(...) với layer mới, giữ bearing/pitch
  // TODO: active class cho popup-item
  // TODO: nếu layerName !== trackasia → ẩn #mapRotateControls
}

function toggleTraffic() {
  // TODO: thêm/xoá raster source 'traffic' layer TomTom
}

function toggle3D() {
  // TODO: easeTo pitch 0 ↔ 60, toggle class #btn3D
}

function rotateMap(delta) {
  // TODO: state.bearing += delta, map.easeTo({ bearing })
}

function resetNorth() {
  // TODO: easeTo bearing 0, pitch giữ nguyên
}

function toggleTilt() {
  // TODO: easeTo pitch 0 ↔ 45
}

function updateCompass() {
  // TODO: xoay .compass-arrow theo -state.bearing
}

function centerToLocation() {
  // TODO: flyTo lastUserPos, hoặc gọi GPS
}

// ═══════════════════════════════════════════════
// 8. GPS
// ═══════════════════════════════════════════════

function startGPSWatch() {
  // TODO: navigator.geolocation.watchPosition
  // TODO: update state.lastUserPos, smoothedSpeed, heading
  // TODO: render userMarker + accuracyCircle (dùng maplibregl.Marker)
  // TODO: nếu đang nav → updateNavigation
}

function stopGPSWatch() {
  // TODO: clearWatch, reset state.watchId
}

function updateUserMarker(pos, heading) {
  // TODO: tạo/cập nhật maplibregl.Marker với icon SVG mũi tên
}

// ═══════════════════════════════════════════════
// 9. SEARCH / GEOCODING
// ═══════════════════════════════════════════════

function activateSearch(context) {
  // TODO: set state.searchContext, show #suggestionsBox, focus input
  // TODO: gắn input listener debounce 500ms → doSearch
}

function closeSearch() {
  // TODO: hide #suggestionsBox
}

function doSearch(query) {
  // TODO: nếu là link gmaps → resolveGmaps
  // TODO: gọi ${WORKER_URL}/search?query=...&provider=trackasia
  // TODO: render kết quả vào #suggestionsBox
}

async function selectLocation(lat, lng, name) {
  // TODO: tuỳ context (start/end/view) → set state.startPoint/endPoint hoặc chỉ fly
  // TODO: reverse geocode nếu tên chưa có
  // TODO: closeSearch, update input value
}

function clearPoint(which) {
  // TODO: reset startPoint hoặc endPoint, xoá input, xoá marker
}

function clearTopSearch() {
  // TODO: reset toàn bộ search
}

async function reverseGeocode(lat, lng) {
  // TODO: fetch ${WORKER_URL}/reverse?lat=...&lng=...&provider=tomtom
}

async function resolveGmaps(url) {
  // TODO: fetch ${WORKER_URL}/resolve-gmaps?url=...
}

// ═══════════════════════════════════════════════
// 10. ROUTING
// ═══════════════════════════════════════════════

function setVehicleMode(mode, btnEl) {
  // TODO: state.vehicleMode = mode, active class
  // TODO: nếu truck → show #truckParams
}

function getTruckParams() {
  // TODO: đọc từ #truckHeight, #truckWeight, #truckWidth, #truckLength
}

async function fetchAndShowRoute() {
  // TODO: validate startPoint + endPoint
  // TODO: build query → ${WORKER_URL}/route?origin=..&destination=..&mode=..&provider=..&truck=JSON
  // TODO: parse response → state.alternativeRoutes
  // TODO: vẽ tất cả tuyến lên map (route-source/route-layer trong maplibre, hoặc maplibregl.Marker cho badge)
  // TODO: render danh sách card vào #routeOptionsBody
}

function selectRoute(index) {
  // TODO: state.currentRoute = alternativeRoutes[index]
  // TODO: vẽ route layer chính, xoá layer phụ
  // TODO: startNavigation()
}

function clearRouteLayers() {
  // TODO: xoá source/layer route khỏi map
}

// ═══════════════════════════════════════════════
// 11. NAVIGATION
// ═══════════════════════════════════════════════

function startNavigation() {
  // TODO: ẩn dirSheet, show #hud, class 'navigating' body
  // TODO: state.isNavigating = true, state.tripStartTime = Date.now()
  // TODO: startGPSWatch nếu chưa, startVoice
  // TODO: nếu live host → push navigation data lên RTDB
}

function updateNavigation() {
  // TODO: gọi trong startGPSWatch mỗi lần có GPS mới
  // TODO: snap user vào route, update HUD dist/time/instr
  // TODO: auto-rotate map theo heading nếu state.autoRotate && !state.userRotated
  // TODO: check off-route → autoReroute
  // TODO: check arrival (< 20m) → triggerArrival
}

function updateNextManeuver(lat, lng) {
  // TODO: tìm step gần nhất tiếp theo, update #hudNextArrow, #hudNextDist, #hudNextInstr
}

async function autoReroute(lat, lng) {
  // TODO: gọi /route với origin = vị trí hiện tại
  // TODO: thay route, reset steps index
}

function triggerArrival() {
  // TODO: speak "Đã đến nơi", show toast, mở #endTripModal sau 3s
}

function openEndTripModal() {
  // TODO: tính stats, fill #endTripDist/Time/AvgSpeed/Dest, show sheet
}

function endTrip(save) {
  // TODO: nếu save → addDoc vào Firestore users/{uid}/savedRoutes
  // TODO: cleanup: stopGPS, clear layers, ẩn HUD, reset state
}

function openAlternativeRoutes() {
  // TODO: show list tuyến phụ (đã lưu trong state), cho chọn lại
}

// ═══════════════════════════════════════════════
// 12. VOICE
// ═══════════════════════════════════════════════

function speak(text) {
  // TODO: speechSynthesis với lang='vi-VN'
}

function startVoice() {
  // TODO: speak "Bắt đầu dẫn đường"
}

function toggleVoice() {
  // TODO: state.voiceEnabled = !state.voiceEnabled, update #hudBtnVoice
}

function translateInstruction(instr) {
  // TODO: dùng DIR_DICT + NAV_DICT dịch
}

// ═══════════════════════════════════════════════
// 13. SAVE PLACE
// ═══════════════════════════════════════════════

function openSavePlaceModal(lat, lng, address) {
  // TODO: set state.tempPin, show sheet, fill #savePlaceAddress
}

function closeSavePlaceModal() {
  // TODO: hide sheet
}

async function submitSavePlace(type) {
  // TODO: push vào RTDB users/{uid}/savedPlaces
  // TODO: close sheet, toast success
}

function renderSavedPlaces() {
  // TODO: vẽ marker lên map cho allSavedPlaces
}

async function deleteSavedPlace(id) {
  // TODO: remove RTDB, cập nhật marker
}

// ═══════════════════════════════════════════════
// 14. COMMUNITY POI
// ═══════════════════════════════════════════════

function openPoiSheet(lat, lng, address) {
  // TODO: set state.tempPoi, show sheet, fill #poiCoords
}

function closePoiSheet() {
  // TODO: hide, clear temp
}

function selectPoiTag(tag, btnEl) {
  // TODO: state.tempPoiTag = tag, active class
  // TODO: enable #poiSaveBtn nếu có tên + tag
}

function onPoiNameInput() {
  // TODO: validate tên >= 2 ký tự
}

async function submitCommunityPoi() {
  // TODO: push vào RTDB communityPois
}

function renderCommunityPois() {
  // TODO: vẽ marker theo zoom >= 15
}

function openPoiDetail(id) {
  // TODO: show sheet detail, fill #poiDetailContent
}

// ═══════════════════════════════════════════════
// 15. REPORT
// ═══════════════════════════════════════════════

function openReportMenu() { /* TODO */ }
function closeReportMenu() { /* TODO */ }

async function submitReport(type) {
  // TODO: push vào RTDB reports với TTL theo type
}

function renderReports() {
  // TODO: vẽ marker, xoá marker hết hạn
}

// ═══════════════════════════════════════════════
// 16. HISTORY / SAVED ROUTES
// ═══════════════════════════════════════════════

async function loadHistory() {
  // TODO: đọc từ Firestore users/{uid}/history + RTDB, merge, sort
}

async function loadSavedRoutes() {
  // TODO: đọc từ Firestore users/{uid}/savedRoutes + RTDB, merge
}

async function deleteHistoryItem(source, id) { /* TODO */ }
async function deleteSavedRouteItem(source, id) { /* TODO */ }
async function clearAllHistory() { /* TODO */ }
async function clearAllSavedRoutes() { /* TODO */ }

function reloadSavedRoute(source, id) {
  // TODO: set startPoint/endPoint, vẽ lại coords đã lưu, openDirections
}

// ═══════════════════════════════════════════════
// 17. SHARE LINKS
// ═══════════════════════════════════════════════

function shareRoute() {
  // TODO: build URL ?fromLat=..&toLat=.., navigator.share hoặc copy
}

function shareLocation(lat, lng, name) { /* TODO */ }

function saveSharedLinkToStorage(from, to, url) { /* TODO */ }

function loadSharedLinks() { /* TODO */ }

function deleteSharedLink(idx) { /* TODO */ }
function clearAllSharedLinks() { /* TODO */ }

// ═══════════════════════════════════════════════
// 18. LIVE ROOM
// ═══════════════════════════════════════════════

function toggleLiveSession() {
  // TODO: bật/tắt toàn bộ live feature
}

async function createLiveRoom() {
  // TODO: generate 6-char code, push live_rooms/{code}
  // TODO: onDisconnect cleanup
  // TODO: subscribe members + navigation
  // TODO: start push GPS mỗi 6s
}

async function joinLiveRoom() {
  // TODO: check room exists, join as member
}

async function leaveLiveRoom() {
  // TODO: cleanup + remove member
}

async function pushLivePosition() {
  // TODO: set live_rooms/{code}/members/{uid} với lat/lng/speed/heading
}

function subscribeLiveRoom() {
  // TODO: onValue members → render marker + list
  // TODO: onValue navigation → vẽ route của host
}

function renderLiveMembers() {
  // TODO: vẽ marker thành viên khác + list UI
}

function switchLiveUser(dir) {
  // TODO: di chuyển tới marker thành viên tiếp theo
}

function copyLiveRoomCode() { /* TODO */ }

function initViewerLiveRoom(roomCode) {
  // TODO: chế độ chỉ xem (không phải host), subscribe members + navigation
}

// ═══════════════════════════════════════════════
// 19. MENU / TABS / THEME
// ═══════════════════════════════════════════════

function openMenu() {
  // TODO: show #profileModal, load history/saved/links
}

function closeMenu() {
  // TODO: hide sheet
}

function switchTab(tabName, btnEl) {
  // TODO: active class, show/hide các .tab-panel
}

function toggleTheme() {
  // TODO: body.classList.toggle('light'), lưu localStorage
  // TODO: nếu trackasia → đổi style sáng/tối
}

// ═══════════════════════════════════════════════
// 20. LAYER MENU
// ═══════════════════════════════════════════════

function toggleLayerMenu() {
  // TODO: toggle .show cho #layerMenu, click outside để đóng
}

// ═══════════════════════════════════════════════
// 21. INIT
// ═══════════════════════════════════════════════

function initAppUI() {
  // TODO: initMap, subscribe RTDB data, attach listeners, theme
}

function bindGlobalHandlers() {
  // TODO: window.xxx = function cho tất cả handler trong HTML
}

// ═══════════════════════════════════════════════
// 22. BOOT
// ═══════════════════════════════════════════════

startLoading();
setupAuthUI();
onAuthStateChanged(auth, handleAuthStateChange);

// Expose to window (vì HTML dùng onclick="...")
Object.assign(window, {
  // Auth
  logout,
  // Map
  setMapLayer, toggleLayerMenu, toggleTraffic, toggle3D,
  rotateMap, resetNorth, toggleTilt, centerToLocation,
  // Search
  activateSearch, closeSearch, clearPoint, clearTopSearch,
  // Directions
  openDirections, closeDirections, setVehicleMode, fetchAndShowRoute,
  selectRoute, closeRouteOptions,
  // Navigation
  openEndTripModal, endTrip, openAlternativeRoutes, toggleVoice,
  // POI
  openPoiSheet, closePoiSheet, selectPoiTag, submitCommunityPoi,
  // Report
  openReportMenu, closeReportMenu, submitReport,
  // Save place
  openSavePlaceModal, closeSavePlaceModal, submitSavePlace,
  // History / Saved
  clearAllHistory, clearAllSavedRoutes,
  // Live
  toggleLiveSession, createLiveRoom, joinLiveRoom, leaveLiveRoom,
  copyLiveRoomCode, switchLiveUser,
  // Menu
  openMenu, closeMenu, switchTab, toggleTheme,
  // Links
  clearAllSharedLinks,
});
