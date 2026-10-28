import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, set, push, get, onValue, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, onSnapshot, query, where, getDocs, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { DIR_DICT, NAV_DICT } from './dictionary.js';

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

const WORKER_URL = 'https://map-birthday.anhminhadof123.workers.dev';

const MAPLIBRE_STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const MAPLIBRE_STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

async function fetchWorker(path, options = {}) {
  return fetch(`${WORKER_URL}${path}`, { ...options, headers: { ...(options.headers || {}) } });
}

let map = null;
let currentUser = null;
let startPoint = null;
let endPoint = null;
let userMarker = null;
let gpsCircle = null;
let currentRouteLayer = null;
let alternativeLayers = [];
let currentRouteCoords = [];
let currentRouteData = null;
let alternativeRoutesData = [];
let watchId = null;
let lastUserPos = null;
let lastHeading = 0;
let searchContext = 'view';
let currentMapLayer = null;
let initialCenter = [21.0285, 105.8542];
let initialZoom = 17;
let lastSnapIndex = 0;
let smoothedSpeed = 0;
let offRouteCount = 0;
let isRerouting = false;
let lastRerouteTime = 0;
let warnedReports = new Set();
let voiceEnabled = true;
let voiceRouteSteps = null;
let voiceStepIndex = 0;
let voiceCheckTimer = null;
let currentVehicleMode = 'none';
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
let allSavedPlaces = {};

let allHistory = [];
let allSavedRoutes = [];

let _fsHistory = [], _rtdbHistory = [];
let _fsSavedRoutes = [], _rtdbSavedRoutes = [];

let communityPoiMarkers = [];
let restStopMarkers = [];
let reportMarkers = [];
let savedPlacesMarkers = [];
let avoidZoneLayers = [];

let _unsub = { rtdbCommunity:null, rtdbReports:null, rtdbAvoid:null, rtdbSaved:null, rtdbHistory:null, rtdbRoutes:null };

let liveEnabled = false;
let liveRoomCode = null;
let isLiveHost = false;
let liveIsPublic = false;
let liveGpsInterval = null;
let liveHeartbeatInterval = null;
let liveRoomUnsub = null;
let livePublicUnsub = null;
let liveNavUnsub = null;
let liveRoomMembers = [];
let livePublicUsers = [];
let liveMemberMarkers = {};
let liveMyMarker = null;
let liveMyAnimState = null;
let liveMemberAnimStates = {};
let liveNavLayer = null;
let currentLiveNavData = null;
const LIVE_GPS_INTERVAL = 6000;
const LIVE_ANIM_DURATION = 6000;
const LIVE_HEARTBEAT_TIMEOUT = 120000;
let isViewingLiveTrack = false;
let activeLiveUsers = [];
let currentLiveIndex = 0;

let autoRotateWithHeading = false;
let userRotatedMap = false;

const POI_TAG_CONFIG = {
  supermarket: { icon: 'fa-shopping-cart', label: 'Siêu thị', color: '#10b981' },
  rest_stop: { icon: 'fa-bed', label: 'Trạm dừng nghỉ', color: '#3b82f6' },
  gas_station: { icon: 'fa-gas-pump', label: 'Cây xăng', color: '#f59e0b' },
  cafe: { icon: 'fa-coffee', label: 'Cafe', color: '#8b5cf6' },
  restaurant: { icon: 'fa-utensils', label: 'Nhà hàng', color: '#ef4444' },
  pharmacy: { icon: 'fa-prescription-bottle-medical', label: 'Nhà thuốc', color: '#06b6d4' },
  atm: { icon: 'fa-money-bill-wave', label: 'ATM', color: '#ec4899' },
  repair: { icon: 'fa-wrench', label: 'Sửa xe', color: '#64748b' },
  hotel: { icon: 'fa-hotel', label: 'Khách sạn', color: '#dc2626' }
};

const ZOOM_CONFIG = { communityPoi: 15, restStop: 13, savedPlace: 14, report: 14, savedPlaceAlwaysShow: ['home', 'company'] };

let loadProgress = 0;
let loadInterval = null;
let isUserAuthChecked = false;
let isAppReadyToShow = false;
let forceFinishTimer = null;

function updateLoadingProgress(targetPercent, text) {
  if (isAppReadyToShow) return;
  if (targetPercent > loadProgress) loadProgress = targetPercent;
  document.getElementById('loadingPercent').textContent = `${Math.floor(loadProgress)}%`;
  if (text) document.getElementById('loadingText').textContent = text;
}

function checkLoadingComplete() {
  if (isUserAuthChecked && loadProgress >= 90 && !isAppReadyToShow) {
    if (loadInterval) clearInterval(loadInterval);
    if (forceFinishTimer) clearTimeout(forceFinishTimer);
    let finalProgress = loadProgress;
    const finalPhase = setInterval(() => {
      finalProgress += 5;
      if (finalProgress >= 100) {
        finalProgress = 100;
        clearInterval(finalPhase);
        isAppReadyToShow = true;
        document.getElementById('loadingPercent').textContent = `100%`;
        document.getElementById('loadingText').textContent = "Hoàn tất!";
        setTimeout(() => {
          document.getElementById('loadingScreen').classList.add('hidden');
          if (currentUser) { document.getElementById('appUI').classList.remove('hidden'); initAppUI(); }
          else { document.getElementById('authScreen').classList.remove('hidden'); }
        }, 300);
      }
      document.getElementById('loadingPercent').textContent = `${finalProgress}%`;
    }, 40);
  }
}

function startFakeLoading() {
  forceFinishTimer = setTimeout(() => {
    if (!isAppReadyToShow) {
      isAppReadyToShow = true;
      if (loadInterval) clearInterval(loadInterval);
      document.getElementById('loadingPercent').textContent = `100%`;
      document.getElementById('loadingText').textContent = "Đang mở ứng dụng...";
      setTimeout(() => {
        document.getElementById('loadingScreen').classList.add('hidden');
        if (currentUser) { document.getElementById('appUI').classList.remove('hidden'); initAppUI(); }
        else { document.getElementById('authScreen').classList.remove('hidden'); }
      }, 300);
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
  isUserAuthChecked = true;
  if (user) {
    currentUser = user;
    document.getElementById('profileName').textContent = user.displayName || user.email.split('@')[0];
    document.getElementById('profileEmail').textContent = user.email;
    if (user.photoURL) document.getElementById('profileAvatar').innerHTML = `<img src="${user.photoURL}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;

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
    currentUser = null;
    updateLoadingProgress(95, "Chưa đăng nhập...");
    checkLoadingComplete();
  }
});

function initAppUI() {
  initTheme();
  initMap();
  initDualDataSubscriptions();
  loadSharedLinksFromStorage();

  if (lastUserPos) {
    if (!startPoint) {
      startPoint = { lat: lastUserPos.lat, lng: lastUserPos.lng, name: 'Vị trí của tôi' };
      document.getElementById('dirInputStart').value = 'Vị trí của tôi (GPS)';
      document.getElementById('btnClearStart').classList.remove('hidden');
    }
    updateUserMarkerOnMap(lastUserPos, lastHeading);
  } else refreshGPS();

  const params = new URLSearchParams(window.location.search);
  if (params.get('fromLat')) {
    const fromLat = parseFloat(params.get('fromLat'));
    const fromLng = parseFloat(params.get('fromLng'));
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
    setTimeout(() => {
      if (fromLat === toLat && fromLng === toLng) showSharedLocationMarker(fromLat, fromLng, toName, true);
      else showSharedLocationMarker(toLat, toLng, toName, true);
    }, 800);
  }

  const liveRoomParam = params.get('room');
  if (liveRoomParam) {
    setTimeout(() => { initViewerLiveRoom(liveRoomParam); }, 1000);
  }
}

function initTheme() {
  if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-mode');
    document.getElementById('themeToggle').checked = true;
  }
}

window.toggleTheme = function() {
  if (document.getElementById('themeToggle').checked) { document.body.classList.add('light-mode'); localStorage.setItem('theme', 'light'); }
  else { document.body.classList.remove('light-mode'); localStorage.setItem('theme', 'dark'); }
  refreshMapLibreStyle();
};

function refreshMapLibreStyle() {
  if (!currentMapLayer) return;
  if (typeof currentMapLayer.getMaplibreMap === 'function') {
    const ml = currentMapLayer.getMaplibreMap();
    if (ml) {
      const isLight = document.body.classList.contains('light-mode');
      try { ml.setStyle(isLight ? MAPLIBRE_STYLE_LIGHT : MAPLIBRE_STYLE_DARK); } catch(e) {}
    }
  }
}

setInterval(() => { const c = document.getElementById('profileTime'); if (c) c.textContent = new Date().toLocaleTimeString('vi-VN'); }, 1000);

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
    authError.style.display = 'none';
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
    btnSubmitAuth.disabled = true;
    btnSubmitAuth.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    authError.style.display = 'none';
    try {
      if (isRegisterMode) await createUserWithEmailAndPassword(auth, email, pass);
      else await signInWithEmailAndPassword(auth, email, pass);
      window.location.reload();
    } catch (err) { authError.textContent = getAuthErrorMessage(err.code); authError.style.display = 'block'; }
    finally { btnSubmitAuth.disabled = false; btnSubmitAuth.textContent = isRegisterMode ? 'Đăng ký tài khoản' : 'Đăng nhập'; }
  });
}

const btnGoogleAuth = document.getElementById('btnGoogleAuth');
if (btnGoogleAuth) {
  btnGoogleAuth.addEventListener('click', async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      window.location.reload();
    }
    catch (e) { authError.textContent = getAuthErrorMessage(e.code); authError.style.display = 'block'; }
  });
}

async function logout() {
  if (liveEnabled) await stopLiveSession();
  await signOut(auth);
  window.location.reload();
  closeMenu();
}

async function getCachedFirestoreData(collectionName, cacheKey, ttlMs, isUserSub = false) {
  const now = Date.now();
  const cachedStr = localStorage.getItem(cacheKey);
  if (cachedStr) {
    try {
      const cached = JSON.parse(cachedStr);
      const maxTtl = isUserSub ? ttlMs : Infinity;
      if (now - cached.timestamp < maxTtl) return cached.data;
    } catch (e) {}
  }

  try {
    let path = isUserSub ? `users/${currentUser.uid}/${collectionName}` : collectionName;
    const snap = await getDocs(collection(fsdb, path));
    const data = snap.docs.map(d => ({ id: d.id, _id: d.id, source: 'firestore', ...d.data() }));
    localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data }));
    return data;
  } catch (err) {
    return [];
  }
}

window.clearAppCache = function() {
  if (!confirm('Xoá bộ nhớ đệm dữ liệu?')) return;
  const keysToRemove = ['cache_history_' + currentUser.uid, 'cache_saved_routes_' + currentUser.uid];
  keysToRemove.forEach(k => localStorage.removeItem(k));
  alert('Đã xoá cache thành công!');
  window.location.reload();
};

function initDualDataSubscriptions() {
  if (!currentUser) return;

  _unsub.rtdbCommunity = onValue(ref(db, 'communityPois'), snap => {
    const data = snap.val() || {};
    const all = Object.entries(data).map(([k, v]) => ({ _id: k, id: k, source: 'rtdb', ...v }));
    allRestStops = all.filter(p => p.tag === 'rest_stop');
    allCommunityPois = all.filter(p => p.tag !== 'rest_stop');
    renderCommunityPoisOnMap(); renderRestStopMarkers();
  }, err => console.warn('RTDB communityPois:', err));

  _unsub.rtdbReports = onValue(ref(db, 'reports'), snap => {
    const data = snap.val() || {};
    allReports = {};
    Object.entries(data).forEach(([k, v]) => { allReports[k] = { id: k, _id: k, source: 'rtdb', ...v }; });
    renderReportsOnMap();
  }, err => console.warn('RTDB reports:', err));

  _unsub.rtdbAvoid = onValue(ref(db, 'avoid_zones'), snap => {
    const data = snap.val() || {};
    allAvoidZones = Object.entries(data).map(([k, v]) => ({ id: k, _id: k, source: 'rtdb', ...v }));
    renderAvoidZonesOnMap();
  }, err => console.warn('RTDB avoid_zones:', err));

  _unsub.rtdbSaved = onValue(ref(db, `users/${currentUser.uid}/savedPlaces`), snap => {
    const data = snap.val() || {};
    allSavedPlaces = {};
    Object.entries(data).forEach(([k, v]) => { allSavedPlaces[k] = { id: k, _id: k, source: 'rtdb', ...v }; });
    renderSavedPlacesOnMap();
  }, err => console.warn('RTDB savedPlaces:', err));

  getCachedFirestoreData('history', 'cache_history_' + currentUser.uid, 60 * 60 * 1000, true).then(data => { _fsHistory = data; recomputeHistory(); });
  getCachedFirestoreData('savedRoutes', 'cache_saved_routes_' + currentUser.uid, 60 * 60 * 1000, true).then(data => { _fsSavedRoutes = data; recomputeSavedRoutes(); });

  _unsub.rtdbHistory = onValue(ref(db, `users/${currentUser.uid}/history`), snap => {
    const data = snap.val() || {};
    _rtdbHistory = Object.entries(data).map(([k, v]) => ({ id: k, _id: k, source: 'rtdb', ...v }));
    recomputeHistory();
  }, err => console.warn('RTDB history:', err));

  _unsub.rtdbRoutes = onValue(ref(db, `users/${currentUser.uid}/savedRoutes`), snap => {
    const data = snap.val() || {};
    _rtdbSavedRoutes = Object.entries(data).map(([k, v]) => ({ id: k, _id: k, source: 'rtdb', ...v }));
    recomputeSavedRoutes();
  }, err => console.warn('RTDB savedRoutes:', err));
}

function recomputeHistory() { allHistory = [..._fsHistory, ..._rtdbHistory].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); }
function recomputeSavedRoutes() { allSavedRoutes = [..._fsSavedRoutes, ..._rtdbSavedRoutes].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); }

function updateUIState() {
  const isNav = document.body.classList.contains('navigating');
  const isDirOpen = document.getElementById('dirSheet').classList.contains('open');
  const isSearchBoxShow = document.getElementById('suggestionsBox').classList.contains('show');
  const searchBar = document.getElementById('searchBar');
  const mainMenuBtn = document.getElementById('mainMenuBtn');

  if (isNav) {
    searchBar.classList.add('hidden'); mainMenuBtn.classList.add('hidden');
  } else {
    searchBar.classList.remove('hidden'); mainMenuBtn.classList.remove('hidden');
  }

  const fabLocate = document.getElementById('mainLocateBtn');
  const fabDir = document.getElementById('mainDirBtn');
  const fabLayers = document.getElementById('btnLayerMenu');
  const fabQuickPin = document.getElementById('btnQuickPin');
  const fabReport = document.getElementById('btnReport');
  const fabRestStop = document.getElementById('btnRestStopFilter');
  const btnResetBearing = document.getElementById('btnResetBearing');

  if (isDirOpen || isSearchBoxShow) {
    fabLocate.style.display = 'none'; fabDir.style.display = 'none'; fabLayers.style.display = 'none';
    fabQuickPin.style.display = 'none'; fabReport.style.display = 'none'; fabRestStop.style.display = 'none';
    if (btnResetBearing) btnResetBearing.style.display = 'none';
  } else if (isNav) {
    fabLocate.style.display = 'none'; fabDir.style.display = 'none'; fabLayers.style.display = 'none';
    fabQuickPin.style.display = 'none'; fabReport.style.display = 'flex'; fabRestStop.style.display = 'none';
    if (btnResetBearing) btnResetBearing.style.display = 'flex';
  } else {
    fabLocate.style.display = 'flex'; fabDir.style.display = 'flex'; fabLayers.style.display = 'flex';
    fabQuickPin.style.display = 'flex'; fabReport.style.display = 'flex'; fabRestStop.style.display = 'flex';
    if (btnResetBearing) btnResetBearing.style.display = 'flex';
  }
}

function getMaplibreInstance() {
  if (!currentMapLayer) return null;
  if (typeof currentMapLayer.getMaplibreMap === 'function') {
    try { return currentMapLayer.getMaplibreMap(); } catch(e) { return null; }
  }
  return null;
}

function initMap() {
  if (map) return;
  map = L.map('map', { center: initialCenter, zoom: initialZoom, zoomControl: false });
  setTimeout(() => { changeLayer('trackasia', document.querySelector('.layer-option.active')); }, 100);

  let pressTimer = null;
  let touchMarker = null;
  let startX = 0, startY = 0;
  let isDragging = false;
  let isMouseDown = false;

  const pressIndicator = document.createElement('div');
  pressIndicator.style.cssText = `position: fixed; width: 40px; height: 40px; border-radius: 50%; background: rgba(59,130,246,0.4); border: 2px solid #3b82f6; transform: translate(-50%, -50%) scale(0); transition: transform 0.2s, opacity 0.2s; pointer-events: none; z-index: 9999; opacity: 0;`;
  document.body.appendChild(pressIndicator);

  function clearTouchMarker() { if (touchMarker) { map.removeLayer(touchMarker); touchMarker = null; } map.closePopup(); }

  function startPress(e) {
    if (document.getElementById('dirSheet').classList.contains('open')) return;
    if (document.getElementById('suggestionsBox').classList.contains('show')) closeSearch();
    if (e.touches && e.touches.length > 1) return;

    const ml = getMaplibreInstance();
    if (ml) {
      try {
        if (ml.isMoving() || ml.isRotating() || ml.isZooming()) return;
      } catch(err) {}
    }

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startX = clientX; startY = clientY; isDragging = false; isMouseDown = true;

    function checkMove(moveEvent) {
      if (moveEvent.touches && moveEvent.touches.length > 1) { isDragging = true; cancelPress(); return; }
      const moveX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const moveY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
      if (Math.abs(moveX - startX) > 10 || Math.abs(moveY - startY) > 10) {
        isDragging = true; cancelPress();
        map.getContainer().removeEventListener('touchmove', checkMove);
        map.getContainer().removeEventListener('mousemove', checkMove);
      }
    }

    map.getContainer().addEventListener('touchmove', checkMove);
    map.getContainer().addEventListener('mousemove', checkMove);

    const rect = map.getContainer().getBoundingClientRect();
    const latlng = map.containerPointToLatLng([clientX - rect.left, clientY - rect.top]);

    pressIndicator.style.left = clientX + 'px'; pressIndicator.style.top = clientY + 'px';
    pressIndicator.style.transform = 'translate(-50%, -50%) scale(1)'; pressIndicator.style.opacity = '1';

    pressTimer = setTimeout(() => {
      if (isDragging) return;
      cancelPress();
      if (navigator.vibrate) navigator.vibrate(50);
      showLocationPopup(latlng);
    }, e.type === 'touchstart' ? 400 : 300);
  }

  function endPress(e) {
    clearTimeout(pressTimer); cancelPress();
    if (!isDragging && isMouseDown) {
      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
      const rect = map.getContainer().getBoundingClientRect();
      const latlng = map.containerPointToLatLng([clientX - rect.left, clientY - rect.top]);
      showLocationPopup(latlng);
    }
    isMouseDown = false;
  }

  function cancelPress() { clearTimeout(pressTimer); pressIndicator.style.transform = 'translate(-50%, -50%) scale(0)'; pressIndicator.style.opacity = '0'; }

  const mc = map.getContainer();
  mc.addEventListener('mousedown', startPress);
  mc.addEventListener('touchstart', startPress, { passive: true });
  mc.addEventListener('mouseup', endPress);
  mc.addEventListener('touchend', endPress);
  mc.addEventListener('mouseleave', cancelPress);
  mc.addEventListener('touchcancel', cancelPress);

  map.on('dragstart', () => { clearTouchMarker(); });
  map.on('zoomstart', () => { clearTouchMarker(); });
  mc.addEventListener('contextmenu', (e) => { e.preventDefault(); closeDirections(); });
  map.on('click', () => { closeDirections(); if (document.getElementById('suggestionsBox').classList.contains('show')) closeSearch(); });

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

  async function showLocationPopup(latlng) {
    clearTouchMarker();
    const icon = L.divIcon({ html: '<div style="width:24px;height:24px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.5);"></div>', iconSize: [24,24], className: 'custom-touch-marker' });
    touchMarker = L.marker(latlng, { icon }).addTo(map);
    const popupContent = document.createElement('div');
    popupContent.innerHTML = `<div style="text-align:center; padding:5px; color:var(--text);"><i class="fas fa-spinner fa-spin"></i> Đang lấy địa chỉ...</div>`;
    touchMarker.bindPopup(popupContent, { autoClose: false, closeOnClick: false }).openPopup();

    let name = '';
    try { const res = await fetchWorker(`/reverse-geocode?lat=${latlng.lat}&lng=${latlng.lng}`); const data = await res.json(); if (data.display_name) name = data.display_name.split(',').slice(0, 3).join(', '); } catch (e) {}
    const displayName = name || `Tọa độ: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
    if (!touchMarker) return;
    popupContent.innerHTML = `
      <div style="min-width: 180px;">
        <div style="font-weight: 800; font-size: 0.9rem; margin-bottom: 8px; line-height: 1.3; color: var(--text);">${displayName}</div>
        <button onclick="event.stopPropagation(); openSavePlaceModal(${latlng.lat}, ${latlng.lng}, '${escapeHtml(displayName).replace(/'/g, "\\'")}')" style="width: 100%; padding: 10px; background: var(--success); color: white; border: none; border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px;"><i class="fas fa-bookmark"></i> Ghim địa điểm</button>
        <button onclick="event.stopPropagation(); openPoiSheet(${latlng.lat}, ${latlng.lng}, '${escapeHtml(displayName).replace(/'/g, "\\'")}')" style="width: 100%; padding: 10px; background: linear-gradient(135deg,#10b981,#059669); color: white; border: none; border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px;"><i class="fas fa-plus-circle"></i> Thêm địa điểm mới</button>
        <button onclick="event.stopPropagation(); goToLongPressLocation(${latlng.lat}, ${latlng.lng}, '${escapeHtml(displayName).replace(/'/g, "\\'")}')" style="width: 100%; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px;"><i class="fas fa-location-arrow"></i> Tới chỗ này</button>
        <button onclick="event.stopPropagation(); shareLocation(${latlng.lat}, ${latlng.lng}, '${escapeHtml(displayName).replace(/'/g, "\\'")}')" style="width: 100%; padding: 10px; background: var(--card-2); color: var(--text); border: 1px solid var(--border); border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"><i class="fas fa-share-alt"></i> Chia sẻ</button>
      </div>`;
    touchMarker.setPopupContent(popupContent).openPopup();
  }
}

function showSharedLocationMarker(lat, lng, name, isDestination = false) {
  map.eachLayer(layer => { if (layer instanceof L.Marker && layer.options.icon && layer.options.icon.options.className === 'custom-touch-marker') map.removeLayer(layer); });
  const orangeIcon = L.divIcon({
    html: `<div style="position: relative; width: 24px; height: 24px;"><div style="position: absolute; inset: 0; background: #f97316; border-radius: 50%; opacity: 0.5; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div><div style="position: absolute; inset: 4px; background: #f97316; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(249,115,22,0.8);"></div></div>`,
    iconSize: [24, 24], iconAnchor: [12, 12], className: 'custom-touch-marker'
  });
  const marker = L.marker([lat, lng], { icon: orangeIcon }).addTo(map);
  const label = isDestination ? '📍 Điểm đến được chia sẻ' : '📍 Vị trí được chia sẻ';
  marker.bindPopup(`<b>${label}</b><br><small>${name}</small>`).openPopup();
  map.flyTo([lat, lng], 16, { animate: true, duration: 1.5 });
}

function renderSavedPlacesOnMap() {
  savedPlacesMarkers.forEach(m => { try { map.removeLayer(m); } catch(e){} });
  savedPlacesMarkers = [];
  const currentZoom = map ? map.getZoom() : 17;
  const icons = {
    home: { icon: 'fa-home', color: '#10b981' }, cafe: { icon: 'fa-coffee', color: '#f59e0b' },
    restaurant: { icon: 'fa-utensils', color: '#ef4444' }, company: { icon: 'fa-building', color: '#3b82f6' },
    school: { icon: 'fa-school', color: '#8b5cf6' }, other: { icon: 'fa-map-marker-alt', color: '#64748b' }
  };
  for (const key in allSavedPlaces) {
    const place = allSavedPlaces[key];
    const conf = icons[place.type] || icons.other;
    const alwaysShow = ZOOM_CONFIG.savedPlaceAlwaysShow.includes(place.type);
    if (!alwaysShow && currentZoom < ZOOM_CONFIG.savedPlace) continue;
    const html = `<div style="position: relative;"><div class="custom-pin" style="width: 30px; height: 30px; background: ${conf.color}; border-color: ${conf.color};"><i class="fas ${conf.icon}" style="color: white;"></i></div><div class="custom-pin-close" onclick="deleteSavedPlace('${place.source}','${place._id}')" title="Xoá"><i class="fas fa-times"></i></div></div>`;
    const customIcon = L.divIcon({ html, className: '', iconSize: [30, 30], iconAnchor: [15, 30] });
    const marker = L.marker([place.lat, place.lng], { icon: customIcon }).addTo(map);
    marker.bindPopup(`<b>${(place.address || '').split(',')[0]}</b>`);
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
  fetchWorker(`/reverse-geocode?lat=${lastUserPos.lat}&lng=${lastUserPos.lng}`)
    .then(r => r.json()).then(data => {
      tempPinName = data.display_name ? data.display_name.split(',').slice(0, 3).join(', ') : `Vị trí GPS (${lastUserPos.lat.toFixed(4)}, ${lastUserPos.lng.toFixed(4)})`;
      document.getElementById('savePlaceAddress').textContent = tempPinName;
    }).catch(() => { tempPinName = `Vị trí GPS`; document.getElementById('savePlaceAddress').textContent = tempPinName; });
};

window.closeSavePlaceModal = function() { document.getElementById('savePlaceModal').classList.remove('open'); };

window.submitSavePlace = async function(type) {
  if (!currentUser || !tempPinLatLng) return;
  closeSavePlaceModal();
  try {
    const newRef = push(ref(db, `users/${currentUser.uid}/savedPlaces`));
    await set(newRef, {
      lat: tempPinLatLng.lat, lng: tempPinLatLng.lng, address: tempPinName, type: type, timestamp: Date.now()
    });
    alert('Đã ghim địa điểm cá nhân lên bản đồ!');
  } catch (e) { alert('Lỗi lưu địa điểm: ' + e.message); }
};

window.deleteSavedPlace = async function(source, id) {
  if (!confirm('Bạn có chắc muốn xoá ghim này?')) return;
  try {
    await remove(ref(db, `users/${currentUser.uid}/savedPlaces/${id}`));
  } catch(e) { alert('Lỗi xoá: ' + e.message); }
};

function renderRestStopMarkers() {
  restStopMarkers.forEach(m => { try { map.removeLayer(m); } catch(e){} });
  restStopMarkers = [];
  const z = map ? map.getZoom() : 17;
  if (z < ZOOM_CONFIG.restStop) return;
  allRestStops.forEach(poi => {
    if (!poi.lat || !poi.lng) return;
    const icon = L.divIcon({
      html: `<div class="community-poi-pin rest-stop-pin"><i class="fas fa-bed"></i><div class="verified-badge"><i class="fas fa-check"></i></div></div>`,
      className: '', iconSize: [40, 40], iconAnchor: [20, 40]
    });
    const marker = L.marker([poi.lat, poi.lng], { icon, zIndexOffset: 500 }).addTo(map);
    marker.bindPopup(`<b>${escapeHtml(poi.name || 'Trạm dừng nghỉ')}</b><br><small>Trạm dừng nghỉ</small>`);
    restStopMarkers.push(marker);
  });
}

function renderCommunityPoisOnMap() {
  communityPoiMarkers.forEach(m => { try { map.removeLayer(m); } catch(e){} });
  communityPoiMarkers = [];
  const currentZoom = map ? map.getZoom() : 17;
  if (currentZoom < ZOOM_CONFIG.communityPoi) return;
  allCommunityPois.forEach(poi => {
    if (!poi.lat || !poi.lng) return;
    const conf = POI_TAG_CONFIG[poi.tag] || POI_TAG_CONFIG.supermarket;
    const icon = L.divIcon({
      html: `<div class="community-poi-pin"><i class="fas ${conf.icon}"></i><div class="verified-badge"><i class="fas fa-check"></i></div></div>`,
      className: '', iconSize: [32, 32], iconAnchor: [16, 32]
    });
    const marker = L.marker([poi.lat, poi.lng], { icon }).addTo(map);
    marker.on('click', () => openPoiDetail(poi.source, poi._id));
    communityPoiMarkers.push(marker);
  });
}

function renderReportsOnMap() {
  reportMarkers.forEach(m => { try { map.removeLayer(m); } catch(e){} });
  reportMarkers = [];
  const now = Date.now();
  const currentZoom = map ? map.getZoom() : 17;
  if (currentZoom < ZOOM_CONFIG.report) return;
  const icons = {
    police: '<div style="background:#3b82f6;color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;"><i class="fas fa-shield-alt"></i></div>',
    accident: '<div style="background:#ef4444;color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;"><i class="fas fa-car-crash"></i></div>',
    traffic: '<div style="background:#ef4444;color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;"><i class="fas fa-traffic-light"></i></div>',
    pothole: '<div style="background:#f59e0b;color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;"><i class="fas fa-exclamation-circle"></i></div>',
    flood: '<div style="background:#06b6d4;color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;"><i class="fas fa-water"></i></div>',
    bridge_collapse: '<div style="background:#dc2626;color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;"><i class="fas fa-road-circle-xmark"></i></div>',
    road_collapse: '<div style="background:#b91c1c;color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;"><i class="fas fa-triangle-exclamation"></i></div>'
  };
  for (const key in allReports) {
    const rep = allReports[key]; if (now > rep.expiresAt) continue;
    const customIcon = L.divIcon({ html: icons[rep.type] || icons.pothole, className: '', iconSize: [30, 30], iconAnchor: [15, 15] });
    const marker = L.marker([rep.lat, rep.lng], { icon: customIcon }).addTo(map);
    let title = rep.type === 'police' ? 'CSGT' : rep.type === 'accident' ? 'Tai nạn' : rep.type === 'traffic' ? 'Kẹt xe' : rep.type === 'flood' ? 'Ngập nước' : rep.type === 'bridge_collapse' ? 'Sập cầu' : rep.type === 'road_collapse' ? 'Sập đường' : 'Ổ gà';
    marker.bindPopup(`<b>${title}</b><br><small>Báo cáo bởi cộng đồng</small>`);
    reportMarkers.push(marker);
  }
}

function renderAvoidZonesOnMap() {
  avoidZoneLayers.forEach(l => { try { map.removeLayer(l); } catch(e){} });
  avoidZoneLayers = [];
  const now = Date.now();
  allAvoidZones.forEach(zone => {
    if (!zone.lat1 || !zone.lng1 || !zone.lat2 || !zone.lng2) return;
    if (zone.startTime || zone.endTime) {
      if (zone.startTime && now < zone.startTime) return;
      if (zone.endTime && now > zone.endTime) return;
    }

    let polylineCoords = [];
    let isMulti = false;

    if (zone.waypoints) {
      try {
        const parsed = typeof zone.waypoints === 'string' ? JSON.parse(zone.waypoints) : zone.waypoints;
        if (Array.isArray(parsed) && parsed.length > 0) {
          isMulti = Array.isArray(parsed[0][0]);
          polylineCoords = parsed;
        }
      } catch (e) {}
    }

    if (polylineCoords.length === 0) {
      polylineCoords = [[zone.lat1, zone.lng1], [zone.lat2, zone.lng2]];
    }

    let line;
    let midLat, midLng;

    if (isMulti) {
      const layers = [];
      polylineCoords.forEach(lineCoords => {
        if (lineCoords.length > 0) {
          layers.push(L.polyline(lineCoords, { color: '#ef4444', weight: 8, opacity: 0.85, dashArray: '12, 12', lineCap: 'round', lineJoin: 'round' }));
        }
      });
      line = L.featureGroup(layers).addTo(map);
      const firstLine = polylineCoords[0];
      const midIdx = Math.floor(firstLine.length / 2);
      midLat = firstLine[midIdx][0];
      midLng = firstLine[midIdx][1];
    } else {
      line = L.polyline(polylineCoords, { color: '#ef4444', weight: 8, opacity: 0.85, dashArray: '12, 12', lineCap: 'round', lineJoin: 'round' }).addTo(map);
      const midIdx = Math.floor(polylineCoords.length / 2);
      midLat = polylineCoords[midIdx][0];
      midLng = polylineCoords[midIdx][1];
    }

    const icon = L.divIcon({ html: `<div class="avoid-zone-pin"><i class="fas fa-ban"></i></div>`, className: '', iconSize: [36, 36], iconAnchor: [18, 18] });
    const marker = L.marker([midLat, midLng], { icon, zIndexOffset: 400 }).addTo(map);
    let detailHtml = '';
    if (zone.startTime || zone.endTime) {
      const s = zone.startTime ? new Date(zone.startTime).toLocaleString('vi-VN', {hour: '2-digit', minute:'2-digit', day: '2-digit', month: '2-digit'}) : '...';
      const e = zone.endTime ? new Date(zone.endTime).toLocaleString('vi-VN', {hour: '2-digit', minute:'2-digit', day: '2-digit', month: '2-digit'}) : '...';
      detailHtml += `<br><small style="color:var(--warning)"><i class="fas fa-clock"></i> Cấm: ${s} - ${e}</small>`;
    }
    if (zone.bannedVehicles && Array.isArray(zone.bannedVehicles) && zone.bannedVehicles.length > 0) {
      const vehicleNames = { 'car': 'Ô tô', 'motorcycle': 'Xe máy', 'truck': 'Xe tải', 'hd': 'Xe CN', 'bicycle': 'Xe đạp', 'walking': 'Đi bộ' };
      const bannedList = zone.bannedVehicles.map(v => vehicleNames[v] || v).join(', ');
      detailHtml += `<br><small style="color:var(--danger); font-weight:bold"><i class="fas fa-car"></i> Cấm: ${bannedList}</small>`;
    }
    marker.bindPopup(`<b>🚫 ${escapeHtml(zone.name || 'Tuyến đường cấm')}</b>${detailHtml}`);
    avoidZoneLayers.push(line); avoidZoneLayers.push(marker);
  });
}

window.openReportMenu = function() { document.getElementById('reportModal').classList.add('open'); };
window.closeReportMenu = function() { document.getElementById('reportModal').classList.remove('open'); };

window.submitReport = async function(type) {
  if (!lastUserPos) return alert('Chưa lấy được vị trí GPS, không thể báo cáo!');
  closeReportMenu(); const now = Date.now(); let ttl = 3600000;
  if (type === 'pothole') ttl = 86400000;
  else if (type === 'flood') ttl = 10800000;
  else if (type === 'traffic') ttl = 1800000;
  else if (type === 'bridge_collapse' || type === 'road_collapse') ttl = 604800000;
  try {
    const newRef = push(ref(db, 'reports'));
    await set(newRef, { lat: lastUserPos.lat, lng: lastUserPos.lng, type, timestamp: now, expiresAt: now + ttl, uid: currentUser.uid, source: 'rtdb' });
    alert('Cảm ơn bạn! Báo cáo đã được gửi.');
  } catch (e) { alert('Lỗi: ' + e.message); }
};

window.setVehicleMode = function(mode, btn) {
  currentVehicleMode = mode;
  document.querySelectorAll('.vehicle-mode-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const truckWarning = document.getElementById('truckWarning');
  if (truckWarning) {
    if (mode === 'truck') truckWarning.classList.remove('hidden');
    else truckWarning.classList.add('hidden');
  }
  if (liveEnabled && liveRoomCode) pushLivePositionToRTDB();
  if (startPoint && endPoint && document.getElementById('routeOptionsModal').classList.contains('open')) fetchAndShowRouteOptions();
};

window.changeSort = function(mode) { currentSortMode = mode; if (startPoint && endPoint) fetchAndShowRouteOptions(); };

window.fetchAndShowRouteOptions = async function() {
  if (!startPoint || !endPoint || !startPoint.lat || !endPoint.lat) return alert('Vui lòng chọn đủ Điểm đi và Điểm đến hợp lệ!');

  const modeToFetch = currentVehicleMode === 'none' ? 'driving' : currentVehicleMode;
  const modeLabel = modeToFetch === 'driving' ? 'ô tô' : modeToFetch === 'driving-traffic' ? 'ô tô (kẹt xe)' : modeToFetch === 'truck' ? 'xe tải' : modeToFetch === 'hd' ? 'xe công nghệ' : modeToFetch === 'walking' ? 'đi bộ' : modeToFetch === 'bicycle' ? 'xe đạp' : 'xe máy';
  const bodyEl = document.getElementById('routeOptionsBody');
  bodyEl.innerHTML = `<div style="text-align:center; padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:2rem; color:var(--primary);"></i><p style="margin-top:10px; color:var(--text-muted);">Đang tìm tuyến (${modeLabel})...</p></div>`;
  document.getElementById('routeOptionsModal').classList.add('open');

  try {
    const res = await fetchWorker(`/trackasia-route?origin=${startPoint.lat},${startPoint.lng}&destination=${endPoint.lat},${endPoint.lng}&mode=${modeToFetch}`);
    const data = await res.json();
    let routes = [];

    if (data.code === 'Ok' || data.status === 'OK') {
      routes = (data.routes || []).map(r => {
        let coords = [];
        if (r.geometry && r.geometry.coordinates) {
          const c0 = r.geometry.coordinates[0];
          if (Math.abs(c0[0]) > 90) coords = r.geometry.coordinates.map(c => [c[1], c[0]]);
          else coords = r.geometry.coordinates.map(c => [c[0], c[1]]);
        }
        let dist = 0, dur = 0, steps = [];
        if (r.legs && r.legs[0]) {
          dist = r.legs[0].distance?.value || r.legs[0].distance || 0;
          dur = r.legs[0].duration?.value || r.legs[0].duration || 0;
          steps = r.legs[0].steps || [];
        } else {
          dist = r.distance || 0;
          dur = r.duration || 0;
        }
        return { ...r, geometry: { coordinates: coords }, distance: dist, duration: dur, legs: [{ steps }], provider: r.provider || 'Worker', mode: modeToFetch };
      });
    }

    routes = routes.filter(r => {
      if (!r.distance || r.distance <= 0) return false;
      const coords = r.geometry?.coordinates;
      if (!coords || coords.length < 2) return false;
      return coords.every(c => c[0] >= -90 && c[0] <= 90 && c[1] >= -180 && c[1] <= 180 && !(c[0] === 0 && c[1] === 0));
    });

    if (routes.length === 0) {
      let errorDetails = data.error || 'Không có dữ liệu trả về';
      if (data.details && Array.isArray(data.details)) {
        errorDetails = data.details.join('<br>• ');
        errorDetails = '• ' + errorDetails;
      }

      bodyEl.innerHTML = `<div style="text-align:center; padding:40px; color:var(--danger);">
        <i class="fas fa-exclamation-triangle" style="font-size:2rem; margin-bottom:10px;"></i>
        <p>Không tìm được tuyến đường hợp lệ.</p>
        <div style="font-size:0.8rem; margin-top:12px; color:var(--text-muted); background:rgba(255,255,255,0.05); padding:12px; border-radius:8px; text-align:left; word-break:break-word;">
          <b>Chi tiết lỗi:</b><br>${errorDetails}
        </div>
      </div>`;
      return;
    }

    routes.sort((a, b) => currentSortMode === 'shortest' ? a.distance - b.distance : a.duration - b.duration);
    routes = routes.slice(0, 5);
    alternativeRoutesData = routes;
    if (currentRouteLayer) { map.removeLayer(currentRouteLayer); currentRouteLayer = null; }
    alternativeLayers.forEach(l => map.removeLayer(l)); alternativeLayers = [];
    if (window._routeBadges) window._routeBadges.forEach(m => map.removeLayer(m)); window._routeBadges = [];
    const allCoords = [];
    routes.forEach((r, index) => {
      const coords = r.geometry.coordinates;
      allCoords.push(...coords);
      const isBest = index === 0;
      const color = ROUTE_COLORS[index];
      const layer = L.polyline(coords, { color: isBest ? color : '#94a3b8', weight: isBest ? 9 : 5, opacity: isBest ? 1 : 0.6, dashArray: isBest ? '' : '10, 10', lineCap: 'round', lineJoin: 'round' }).addTo(map);
      layer.on('click', () => selectRouteOption(index));
      alternativeLayers.push(layer);
      const midIdx = Math.floor(coords.length / 2);
      const badgeHtml = `<div style="background: ${isBest ? color : 'white'}; color: ${isBest ? 'white' : '#334155'}; border: 3px solid ${isBest ? 'white' : color}; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.9rem; box-shadow: 0 4px 10px rgba(0,0,0,0.4); cursor: pointer;" onclick="selectRouteOption(${index})">${index + 1}</div>`;
      const badge = L.marker(coords[midIdx], { icon: L.divIcon({ html: badgeHtml, className: '', iconSize: [32, 32], iconAnchor: [16, 16] }), interactive: true, zIndexOffset: 2000 - index }).addTo(map);
      badge.on('click', () => selectRouteOption(index));
      window._routeBadges.push(badge);
    });
    map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });
    let html = `<div class="sort-bar"><button class="sort-chip ${currentSortMode === 'fastest' ? 'active' : ''}" onclick="changeSort('fastest')"><i class="fas fa-bolt"></i> Nhanh nhất</button><button class="sort-chip ${currentSortMode === 'shortest' ? 'active' : ''}" onclick="changeSort('shortest')"><i class="fas fa-route"></i> Ngắn nhất</button></div>`;
    routes.forEach((r, index) => {
      const dist = (r.distance / 1000).toFixed(1);
      const dur = Math.round(r.duration / 60);
      const isBest = index === 0;
      const color = ROUTE_COLORS[index];
      html += `<div class="route-card ${isBest ? 'active' : ''}" onclick="selectRouteOption(${index})" style="border-left: 4px solid ${color}; cursor: pointer;"><div class="info"><h3 style="display:flex; align-items:center; gap:8px;"><span style="background:${color}; color:white; width:24px; height:24px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:900;">${index + 1}</span>Tuyến ${index + 1} ${isBest ? '(Ưu tiên)' : ''} <span style="font-size:0.6rem; background:var(--bg-2); padding:2px 6px; border-radius:4px; color:var(--text-muted);">${r.provider}</span></h3><p><i class="fas fa-road"></i> ${dist} km • <i class="fas fa-clock"></i> ${dur} phút</p></div>${isBest ? '<span class="badge" style="background:linear-gradient(135deg, #f59e0b, #ef4444); color:white;"><i class="fas fa-star"></i> Đề xuất</span>' : ''}</div>`;
    });
    bodyEl.innerHTML = html;
  } catch (error) {
    bodyEl.innerHTML = `<div style="text-align:center; padding:40px; color:var(--danger);"><p>Có lỗi xảy ra khi tìm tuyến. Vui lòng thử lại.</p></div>`;
  }
};

window.selectRouteOption = function(index) {
  const selectedRoute = alternativeRoutesData[index];
  if (!selectedRoute) return;
  if (!selectedRoute.geometry?.coordinates?.length) return alert('Lỗi: Tuyến đường không có dữ liệu!');
  if (!selectedRoute.legs || !Array.isArray(selectedRoute.legs) || selectedRoute.legs.length === 0) selectedRoute.legs = [{ steps: [] }];
  if (!selectedRoute.legs[0].steps) selectedRoute.legs[0].steps = [];

  const unselectedRoutes = alternativeRoutesData.filter((_, i) => i !== index);
  localStorage.setItem('alternativeRoutes', JSON.stringify(unselectedRoutes));
  alternativeLayers.forEach((l, i) => { if (i === index) l.setStyle({ color: '#3b82f6', weight: 8, opacity: 1, dashArray: '' }); else l.setStyle({ color: '#9ca3af', weight: 5, opacity: 0.5, dashArray: '10, 10' }); });
  alternativeLayers.forEach((l, i) => { if (i !== index) map.removeLayer(l); });
  currentRouteLayer = alternativeLayers[index]; alternativeLayers = [currentRouteLayer];
  currentRouteData = selectedRoute; currentRouteCoords = selectedRoute.geometry.coordinates;
  if (window._routeBadges) { window._routeBadges.forEach(m => map.removeLayer(m)); window._routeBadges = []; }
  closeRouteOptions();
  startNavigationHUD();
};

window.closeRouteOptions = function() { document.getElementById('routeOptionsModal').classList.remove('open'); };

function startNavigationHUD() {
  if (!currentRouteData || !currentRouteCoords || currentRouteCoords.length === 0) {
    alert('Không thể bắt đầu dẫn đường do thiếu dữ liệu tuyến!');
    document.getElementById('hud').classList.add('hidden');
    document.body.classList.remove('navigating');
    return;
  }
  try {
    if (!currentRouteData.legs || !Array.isArray(currentRouteData.legs) || currentRouteData.legs.length === 0) currentRouteData.legs = [{ steps: [] }];
    if (!currentRouteData.legs[0].steps) currentRouteData.legs[0].steps = [];
    document.getElementById('dirSheet').classList.remove('open');
    if (searchContext !== 'view') document.getElementById('suggestionsBox').classList.remove('show');
    document.body.classList.add('navigating');
    document.getElementById('hud').classList.remove('hidden');
    updateUIState();
    voiceRouteSteps = currentRouteData.legs[0].steps;
    voiceStepIndex = 0; lastSnapIndex = 0; tripStartTime = Date.now(); arrivalHandled = false;
    autoRotateWithHeading = true;
    userRotatedMap = false;

    const dist = currentRouteData.legs?.[0]?.distance?.value || currentRouteData.legs?.[0]?.distance || currentRouteData.distance || 0;
    const dur = currentRouteData.legs?.[0]?.duration?.value || currentRouteData.legs?.[0]?.duration || currentRouteData.duration || 0;

    document.getElementById('hudRemainDist').textContent = (dist / 1000).toFixed(1) + ' km';
    document.getElementById('hudRemainTime').textContent = Math.round(dur / 60) + ' phút';
    document.getElementById('hudNextStopName').textContent = endPoint?.name || 'Điểm đến';

    if (lastUserPos) {
      map.setView([lastUserPos.lat, lastUserPos.lng], 18, { animate: true });
    } else if (startPoint) {
      map.setView([startPoint.lat, startPoint.lng], 18, { animate: true });
    }

    startWatching();
    startVoice();
    saveHistoryToFirestore(startPoint, endPoint, dist);
    if (lastUserPos) updateNextManeuverHUD(lastUserPos.lat, lastUserPos.lng);

    if (liveEnabled && liveRoomCode && isLiveHost) {
      set(ref(db, `live_rooms/${liveRoomCode}/navigation`), {
        endLat: endPoint.lat, endLng: endPoint.lng, endName: endPoint.name,
        routeCoords: currentRouteCoords, startTime: Date.now(), hostVehicle: currentVehicleMode
      }).catch(()=>{});
    }
  } catch (err) {
    alert('Lỗi khởi động: ' + err.message);
    document.getElementById('hud').classList.add('hidden');
    document.body.classList.remove('navigating');
    updateUIState();
  }
}

window.openAlternativeRoutes = function() {
  const stored = localStorage.getItem('alternativeRoutes');
  if (!stored) return alert('Không có tuyến phụ nào!');
  const routes = JSON.parse(stored);
  if (routes.length === 0) return alert('Không có tuyến phụ nào!');
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
  if (!selectedRoute) return;
  if (!selectedRoute.geometry?.coordinates?.length) return alert('Lỗi: Tuyến không có dữ liệu!');
  if (!selectedRoute.legs || !Array.isArray(selectedRoute.legs) || selectedRoute.legs.length === 0) selectedRoute.legs = [{ steps: [] }];
  if (!selectedRoute.legs[0].steps) selectedRoute.legs[0].steps = [];
  const otherRoutes = alternativeRoutesData.filter((_, i) => i !== index);
  localStorage.setItem('alternativeRoutes', JSON.stringify(otherRoutes));
  currentRouteData = selectedRoute; currentRouteCoords = selectedRoute.geometry.coordinates;
  voiceRouteSteps = selectedRoute.legs[0].steps; voiceStepIndex = 0; lastSnapIndex = 0;
  if (currentRouteLayer) map.removeLayer(currentRouteLayer);
  currentRouteLayer = L.polyline(currentRouteCoords, { color: '#3b82f6', weight: 8 }).addTo(map);

  if (lastUserPos) {
    map.setView([lastUserPos.lat, lastUserPos.lng], 18, { animate: true });
  }

  document.getElementById('hudRemainDist').textContent = (selectedRoute.distance / 1000).toFixed(1) + ' km';
  document.getElementById('hudRemainTime').textContent = Math.round(selectedRoute.duration / 60) + ' phút';
  closeRouteOptions(); speak('Đã đổi tuyến đường mới.');
};

function translateInstruction(instr) {
  if (!instr) return 'Tiếp tục di chuyển';
  if (!/[a-zA-Z]/.test(instr)) return instr;

  let text = instr;

  text = text.replace(/Head\s+(\w+)/i, function(match, dir) {
     const lowerDir = dir.toLowerCase();
     return `Đi về hướng ${DIR_DICT[lowerDir] || dir}`;
  });

  const sortedKeys = Object.keys(NAV_DICT).sort((a, b) => b.length - a.length);

  sortedKeys.forEach(key => {
    const regex = new RegExp(key, 'gi');
    text = text.replace(regex, NAV_DICT[key]);
  });

  text = text.replace(/\s+/g, ' ').trim();

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function updateNextManeuverHUD(lat, lng) {
  if (!voiceRouteSteps || voiceRouteSteps.length === 0) {
    document.getElementById('hudNextArrow').innerHTML = `<i class="fas fa-arrow-up"></i>`;
    document.getElementById('hudNextDist').textContent = 'Đi thẳng';
    document.getElementById('hudNextInstr').textContent = 'Tiếp tục di chuyển đến đích';
    return;
  }

  let nextStep = null;
  let minDist = Infinity;
  for (let i = Math.max(0, voiceStepIndex); i < Math.min(voiceRouteSteps.length, voiceStepIndex + 5); i++) {
    const step = voiceRouteSteps[i];
    if (!step?.maneuver?.location) continue;
    const d = calcDist(lat, lng, step.maneuver.location[1], step.maneuver.location[0]);
    if (d > 5 && d < minDist) { minDist = d; nextStep = step; }
  }
  if (nextStep) {
    let icon = 'fa-arrow-up'; const type = nextStep.maneuver.type || ''; const modifier = nextStep.maneuver.modifier || '';
    if (type.includes('turn') || type.includes('fork') || type.includes('merge')) {
      if (modifier.includes('left')) icon = 'fa-arrow-left'; else if (modifier.includes('right')) icon = 'fa-arrow-right'; else if (modifier.includes('slight left')) icon = 'fa-share'; else if (modifier.includes('slight right')) icon = 'fa-reply';
    } else if (type.includes('roundabout')) icon = 'fa-sync-alt'; else if (type.includes('arrive')) icon = 'fa-flag-checkered'; else if (type.includes('uturn')) icon = 'fa-undo';
    document.getElementById('hudNextArrow').innerHTML = `<i class="fas ${icon}"></i>`;
    document.getElementById('hudNextDist').textContent = minDist > 1000 ? (minDist / 1000).toFixed(1) + ' km' : Math.round(minDist) + ' m';

    document.getElementById('hudNextInstr').textContent = translateInstruction(nextStep.maneuver.instruction);
  } else {
    document.getElementById('hudNextArrow').innerHTML = `<i class="fas fa-arrow-up"></i>`;
    document.getElementById('hudNextDist').textContent = 'Đi thẳng';
    document.getElementById('hudNextInstr').textContent = 'Tiếp tục di chuyển đến đích';
  }
}

function checkArrival(lat, lng) {
  if (arrivalHandled || !endPoint || !currentRouteCoords.length) return;
  const distToEnd = calcDist(lat, lng, endPoint.lat, endPoint.lng);
  if (distToEnd < ARRIVAL_RADIUS_M) { arrivalHandled = true; triggerArrival(); }
}

function triggerArrival() {
  document.getElementById('hudRemainDist').textContent = '0 m'; document.getElementById('hudRemainTime').textContent = 'Đã đến';
  document.getElementById('hudNextInstr').textContent = 'Đã đến nơi 🎉'; document.getElementById('hudNextDist').textContent = '';
  document.getElementById('hudNextArrow').innerHTML = '🏁'; document.getElementById('hudNextStopDist').textContent = '0 m';
  speak('Bạn đã đến nơi. Chuyến đi kết thúc.'); showArrivalToast();
  setTimeout(() => { if (document.getElementById('hud').classList.contains('hidden')) return; openEndTripModal(); }, 3000);
}

function showArrivalToast() {
  const toast = document.createElement('div'); toast.id = 'arrivalToast';
  toast.style.cssText = `position: fixed; top: calc(80px + var(--safe-top)); left: 50%; transform: translateX(-50%) translateY(-30px); background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 16px 24px; border-radius: 16px; font-weight: 800; font-size: 1rem; z-index: 9999; display: flex; align-items: center; gap: 12px; opacity: 0; transition: all 0.3s ease-out;`;
  toast.innerHTML = `<i class="fas fa-flag-checkered" style="font-size:1.5rem;"></i><span>Đã đến nơi! 🎉</span>`;
  document.body.appendChild(toast); if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
  requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(-50%) translateY(0)'; });
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(-30px)'; setTimeout(() => toast.remove(), 300); }, 2800);
}

function checkOffRoute(userLat, userLng) {
  if (!currentRouteCoords || currentRouteCoords.length < 2 || isRerouting || arrivalHandled) return;

  if (Date.now() - lastRerouteTime < 15000) return;

  let minDist = Infinity;
  const startScan = Math.max(0, lastSnapIndex - 10);
  const endScan = Math.min(currentRouteCoords.length - 1, lastSnapIndex + 150);
  for (let i = startScan; i < endScan; i++) {
    const pt = getClosestPointOnSegment({ lat: userLat, lng: userLng }, { lat: currentRouteCoords[i][0], lng: currentRouteCoords[i][1] }, { lat: currentRouteCoords[i+1][0], lng: currentRouteCoords[i+1][1] });
    const d = calcDist(userLat, userLng, pt.lat, pt.lng);
    if (d < minDist) minDist = d;
  }

  if (minDist > 80) {
    offRouteCount++;
    if (offRouteCount >= 5) {
      offRouteCount = 0;
      autoReroute(userLat, userLng);
    }
  } else {
    offRouteCount = 0;
  }
}

async function autoReroute(userLat, userLng) {
  if (isRerouting) return;
  isRerouting = true;
  lastRerouteTime = Date.now();

  const currentMode = currentRouteData?.mode || (currentVehicleMode === 'none' ? 'driving' : currentVehicleMode);

  try {
    const res = await fetchWorker(`/trackasia-route?origin=${userLat},${userLng}&destination=${endPoint.lat},${endPoint.lng}&mode=${currentMode}`);
    const data = await res.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error(data.error || 'Không tìm thấy đường mới');
    }

    let r = data.routes[0];
    if (!r.legs || !Array.isArray(r.legs) || r.legs.length === 0) r.legs = [{ steps: [] }];
    if (!r.legs[0].steps) r.legs[0].steps = [];

    const dist = r.legs[0]?.distance?.value || r.legs[0]?.distance || r.distance || 0;
    const dur = r.legs[0]?.duration?.value || r.legs[0]?.duration || r.duration || 0;

    if (currentRouteData && currentRouteData.distance > 500) {
      const oldDist = currentRouteData.distance;
      if (dist > oldDist * 1.2) {
        console.log('[Reroute] Bỏ qua tuyến mới vì dài hơn tuyến cũ quá nhiều.');
        isRerouting = false;
        return;
      }
    }

    r.distance = dist;
    r.duration = dur;

    currentRouteData = r;
    voiceRouteSteps = r.legs[0].steps;
    voiceStepIndex = 0; lastSnapIndex = 0; offRouteCount = 0;
    currentRouteCoords = r.geometry.coordinates;

    if (currentRouteLayer) map.removeLayer(currentRouteLayer);
    currentRouteLayer = L.polyline(currentRouteCoords, { color: '#3b82f6', weight: 8, lineCap: 'round', lineJoin: 'round' }).addTo(map);

    document.getElementById('hudRemainDist').textContent = (dist / 1000).toFixed(1) + ' km';
    document.getElementById('hudRemainTime').textContent = Math.round(dur / 60) + ' phút';

    updateNextManeuverHUD(userLat, userLng);
    speak('Đã cập nhật lộ trình.');

  } catch (e) {
    console.error('Lỗi Reroute:', e);
    setTimeout(() => { isRerouting = false; }, 5000);
    return;
  }
  isRerouting = false;
}

window.openEndTripModal = function() {
  if (!currentRouteData) {
    alert('Dữ liệu chuyến đi bị lỗi.');
    document.getElementById('hud').classList.add('hidden');
    document.body.classList.remove('navigating');
    if(watchId) navigator.geolocation.clearWatch(watchId);
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
    const coordsToSave = [...currentRouteCoords];
    const startData = { ...startPoint };
    const endData = { ...endPoint };

    try {
      const compressedCoords = coordsToSave.map(c => [
        parseFloat(c[0].toFixed(5)),
        parseFloat(c[1].toFixed(5))
      ]);

      const routeData = {
        startName: startData.name, startLng: startData.lng, startLat: startData.lat,
        endName: endData.name, endLng: endData.lng, endLat: endData.lat,
        coordsJson: JSON.stringify(compressedCoords),
        timestamp: Date.now()
      };

      const docRef = await addDoc(collection(fsdb, `users/${currentUser.uid}/savedRoutes`), routeData);

      const newRoute = { ...routeData, id: docRef.id, _id: docRef.id, source: 'firestore' };
      _fsSavedRoutes.push(newRoute);
      recomputeSavedRoutes();

      let cachedSaved = JSON.parse(localStorage.getItem('cache_saved_routes_' + currentUser.uid) || '{"timestamp":0,"data":[]}');
      cachedSaved.data.push(newRoute);
      cachedSaved.timestamp = Date.now();
      localStorage.setItem('cache_saved_routes_' + currentUser.uid, JSON.stringify(cachedSaved));

      if (document.getElementById('profileModal').classList.contains('open')) {
        loadSavedRoutes();
      }

      const t = document.createElement('div');
      t.style.cssText = 'position:fixed;top:calc(80px + var(--safe-top));left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#10b981,#059669);color:white;padding:14px 22px;border-radius:14px;font-weight:800;z-index:9999;display:flex;gap:10px;align-items:center;';
      t.innerHTML = '<i class="fas fa-check-circle"></i><span>Đã lưu lộ trình thành công!</span>';
      document.body.appendChild(t); setTimeout(() => t.remove(), 2500);

    } catch (e) {
      console.error("Lỗi lưu Firestore:", e);
      alert('❌ Không thể lưu lộ trình lên Cloud: ' + e.message);

      const localRoutes = JSON.parse(localStorage.getItem('localSavedRoutes') || '[]');
      localRoutes.push({
        startName: startData.name, endName: endData.name,
        coords: coordsToSave, timestamp: Date.now()
      });
      localStorage.setItem('localSavedRoutes', JSON.stringify(localRoutes));
      alert('⚠️ Đã lưu tạm lộ trình vào bộ nhớ máy.');
    }
  }

  if (liveEnabled && liveRoomCode && isLiveHost) {
    remove(ref(db, `live_rooms/${liveRoomCode}/navigation`)).catch(()=>{});
  }
  if (watchId) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  if (voiceCheckTimer) { clearInterval(voiceCheckTimer); voiceCheckTimer = null; }
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (currentRouteLayer) { map.removeLayer(currentRouteLayer); currentRouteLayer = null; }
  alternativeLayers.forEach(l => { try { map.removeLayer(l); } catch (e) {} }); alternativeLayers = [];
  if (window._routeBadges) { window._routeBadges.forEach(m => map.removeLayer(m)); window._routeBadges = []; }

  currentRouteCoords = []; currentRouteData = null; alternativeRoutesData = []; voiceRouteSteps = null; voiceStepIndex = 0; lastSnapIndex = 0; offRouteCount = 0; isRerouting = false; tripStartTime = null; arrivalHandled = false; warnedReports.clear(); localStorage.removeItem('alternativeRoutes');
  autoRotateWithHeading = false; userRotatedMap = false;

  document.body.classList.remove('navigating');
  document.getElementById('hud').classList.add('hidden');
  updateUIState();

  const ml = getMaplibreInstance();
  if (ml) { try { ml.easeTo({ bearing: 0, pitch: 0, duration: 500 }); } catch(e) {} }

  document.getElementById('dirInputEnd').value = ''; document.getElementById('topSearchInput').value = ''; document.getElementById('btnClearEnd').classList.add('hidden'); document.getElementById('searchClearBtn').classList.add('hidden'); endPoint = null;

  if (lastUserPos) map.flyTo([lastUserPos.lat, lastUserPos.lng], 16, { animate: true, duration: 1 });
};

async function saveHistoryToFirestore(start, end, distance) {
  if (!currentUser) return;
  try {
    const histData = {
      startName: start.name, endName: end.name, distance, timestamp: Date.now()
    };

    const docRef = await addDoc(collection(fsdb, `users/${currentUser.uid}/history`), histData);

    const newHist = { ...histData, id: docRef.id, _id: docRef.id, source: 'firestore' };
    _fsHistory.push(newHist);
    recomputeHistory();

    let cachedHist = JSON.parse(localStorage.getItem('cache_history_' + currentUser.uid) || '{"timestamp":0,"data":[]}');
    cachedHist.data.push(newHist);
    cachedHist.timestamp = Date.now();
    localStorage.setItem('cache_history_' + currentUser.uid, JSON.stringify(cachedHist));

  } catch(e) { console.error("Lỗi lưu lịch sử:", e); }
}

window.shareRoute = function() {
  if (!startPoint || !endPoint) return alert('Vui lòng chọn đủ Điểm đi và Điểm đến!');
  const baseUrl = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({ fromLat: startPoint.lat, fromLng: startPoint.lng, fromName: startPoint.name, toLat: endPoint.lat, toLng: endPoint.lng, toName: endPoint.name });
  const shareUrl = `${baseUrl}?${params.toString()}`;
  if (navigator.share) { navigator.share({ title: 'DriveKit - Lộ trình', text: `Lộ trình từ ${startPoint.name} đến ${endPoint.name}`, url: shareUrl }).then(() => { saveSharedLinkToStorage(startPoint.name, endPoint.name, shareUrl); alert('Đã chia sẻ thành công!'); }).catch(() => {}); }
  else { navigator.clipboard.writeText(shareUrl).then(() => { saveSharedLinkToStorage(startPoint.name, endPoint.name, shareUrl); alert('Đã copy link chia sẻ!'); }).catch(() => prompt('Copy link này:', shareUrl)); }
};

window.shareLocation = function(lat, lng, name) {
  const baseUrl = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({ fromLat: lat, fromLng: lng, fromName: name, toLat: lat, toLng: lng, toName: name });
  const shareUrl = `${baseUrl}?${params.toString()}`;
  if (navigator.share) navigator.share({ title: 'DriveKit - Địa điểm', text: `Địa điểm: ${name}`, url: shareUrl }).catch(() => {});
  else navigator.clipboard.writeText(shareUrl).then(() => alert('Đã copy link địa điểm!')).catch(() => prompt('Copy link này:', shareUrl));
};

function saveSharedLinkToStorage(fromName, toName, url) {
  const links = JSON.parse(localStorage.getItem('sharedLinks') || '[]');
  links.unshift({ fromName, toName, url, timestamp: Date.now() });
  localStorage.setItem('sharedLinks', JSON.stringify(links.slice(0, 50)));
  loadSharedLinksFromStorage();
}

function loadSharedLinksFromStorage() {
  const list = document.getElementById('sharedLinksList'); if (!list) return;
  const links = JSON.parse(localStorage.getItem('sharedLinks') || '[]');
  if (links.length === 0) {
    list.innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:0.85rem;">Chưa có link nào</div>';
    return;
  }
  list.innerHTML = '';
  links.forEach((item, idx) => {
    list.innerHTML += `<div class="history-item"><div class="time">${new Date(item.timestamp).toLocaleString('vi-VN')}</div><div class="route"><i class="fas fa-circle"></i> ${escapeHtml(item.fromName)} <i class="fas fa-arrow-right"></i> ${escapeHtml(item.toName)}</div><div style="display:flex; gap:8px; margin-top:8px;"><button onclick="navigator.clipboard.writeText('${item.url}').then(()=>alert('Đã copy!'))" style="flex:1; padding:6px 12px; background:var(--primary); color:white; border-radius:6px; font-size:0.75rem;"><i class="fas fa-copy"></i> Copy Link</button><button onclick="deleteSharedLink(${idx})" style="padding:6px 12px; background:var(--danger); color:white; border-radius:6px; font-size:0.75rem;"><i class="fas fa-trash"></i></button></div></div>`;
  });
}

window.deleteSharedLink = function(idx) {
  if (!confirm('Xoá link này?')) return;
  const links = JSON.parse(localStorage.getItem('sharedLinks') || '[]');
  links.splice(idx, 1);
  localStorage.setItem('sharedLinks', JSON.stringify(links));
  loadSharedLinksFromStorage();
};

window.clearAllSharedLinks = function() {
  if (!confirm('Xoá TẤT CẢ link?')) return;
  localStorage.removeItem('sharedLinks');
  loadSharedLinksFromStorage();
};

async function loadHistory() {
  const list = document.getElementById('historyList'); if (!list) return;
  if (allHistory.length === 0) {
    list.innerHTML = '<div style="text-align:center; color:var(--text-muted);">Chưa có chuyến đi nào.</div>';
    return;
  }
  list.innerHTML = '';
  allHistory.forEach(item => {
    list.innerHTML += `<div class="history-item"><div class="time">${new Date(item.timestamp).toLocaleString('vi-VN')}</div><div class="route"><i class="fas fa-circle"></i> ${escapeHtml(item.startName || '')}</div><div class="route" style="margin-top:4px;"><i class="fas fa-circle end"></i> ${escapeHtml(item.endName || '')}</div><div style="margin-top:6px; font-size:0.75rem; color:var(--text-muted);">${((item.distance || 0)/1000).toFixed(1)} km</div><button onclick="deleteItem('history','${item.source}','${item._id}')" style="position:absolute; top:10px; right:10px; padding:4px; background:transparent; color:var(--danger);"><i class="fas fa-trash"></i></button></div>`;
  });
}

async function loadSavedRoutes() {
  const list = document.getElementById('savedRoutesList'); if (!list) return;
  if (allSavedRoutes.length === 0) {
    list.innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:0.85rem;">Chưa có lộ trình nào</div>';
    return;
  }
  list.innerHTML = '';
  window._savedRoutesData = allSavedRoutes;
  allSavedRoutes.forEach(item => {
    list.innerHTML += `<div class="history-item"><div class="time">${new Date(item.timestamp).toLocaleString('vi-VN')}</div><div class="route"><i class="fas fa-circle"></i> ${escapeHtml(item.startName || '')}</div><div class="route" style="margin-top:4px;"><i class="fas fa-circle end"></i> ${escapeHtml(item.endName || '')}</div><div style="display:flex; gap:8px; margin-top:8px;"><button onclick="reloadSavedRoute('${item.source}','${item._id}')" style="flex:1; padding:6px 12px; background:var(--primary); color:white; border-radius:6px; font-size:0.75rem;"><i class="fas fa-route"></i> Xem lại</button><button onclick="deleteItem('savedRoutes','${item.source}','${item._id}')" style="padding:6px 12px; background:var(--danger); color:white; border-radius:6px; font-size:0.75rem;"><i class="fas fa-trash"></i></button></div></div>`;
  });
}

window.reloadSavedRoute = function(source, id) {
  const item = window._savedRoutesData.find(i => i._id === id && i.source === source); if (!item) return;
  startPoint = { lat: item.startLat, lng: item.startLng, name: item.startName };
  endPoint = { lat: item.endLat, lng: item.endLng, name: item.endName };
  document.getElementById('dirInputStart').value = startPoint.name; document.getElementById('dirInputEnd').value = endPoint.name;
  document.getElementById('topSearchInput').value = endPoint.name; document.getElementById('btnClearStart').classList.remove('hidden'); document.getElementById('btnClearEnd').classList.remove('hidden'); document.getElementById('searchClearBtn').classList.remove('hidden');

  currentRouteCoords = typeof item.coordsJson === 'string' ? JSON.parse(item.coordsJson) : (item.coords || []);

  lastSnapIndex = 0;
  if (currentRouteLayer) map.removeLayer(currentRouteLayer);
  currentRouteLayer = L.polyline(currentRouteCoords, { color: '#3b82f6', weight: 8, lineCap: 'round', lineJoin: 'round' }).addTo(map);
  map.fitBounds(L.latLngBounds(currentRouteCoords), { padding: [50, 50] });
  closeMenu(); openDirections();
};

window.deleteItem = async function(type, source, id) {
  if (!confirm('Xác nhận xoá?')) return;
  try {
    if (source === 'firestore') await deleteDoc(doc(fsdb, `users/${currentUser.uid}/${type}/${id}`));
    else await remove(ref(db, `users/${currentUser.uid}/${type}/${id}`));

    if (type === 'history') {
      _fsHistory = _fsHistory.filter(h => h._id !== id);
      recomputeHistory();
      let cachedHist = JSON.parse(localStorage.getItem('cache_history_' + currentUser.uid) || '{"timestamp":0,"data":[]}');
      cachedHist.data = cachedHist.data.filter(h => h._id !== id);
      localStorage.setItem('cache_history_' + currentUser.uid, JSON.stringify(cachedHist));
      loadHistory();
    } else if (type === 'savedRoutes') {
      _fsSavedRoutes = _fsSavedRoutes.filter(r => r._id !== id);
      recomputeSavedRoutes();
      let cachedRoutes = JSON.parse(localStorage.getItem('cache_saved_routes_' + currentUser.uid) || '{"timestamp":0,"data":[]}');
      cachedRoutes.data = cachedRoutes.data.filter(r => r._id !== id);
      localStorage.setItem('cache_saved_routes_' + currentUser.uid, JSON.stringify(cachedRoutes));
      loadSavedRoutes();
    }
  } catch (e) { alert('Lỗi xoá: ' + e.message); }
};

window.clearAllHistory = async function() {
  if (!confirm('Xoá TẤT CẢ lịch sử?')) return;
  try {
    const fsSnap = await getDocs(collection(fsdb, `users/${currentUser.uid}/history`));
    for (const d of fsSnap.docs) await deleteDoc(d.ref);
    await remove(ref(db, `users/${currentUser.uid}/history`));

    _fsHistory = []; _rtdbHistory = [];
    recomputeHistory();
    localStorage.removeItem('cache_history_' + currentUser.uid);
    loadHistory();
  } catch(e) {}
};

window.clearAllSavedRoutes = async function() {
  if (!confirm('Xoá TẤT CẢ lộ trình?')) return;
  try {
    const fsSnap = await getDocs(collection(fsdb, `users/${currentUser.uid}/savedRoutes`));
    for (const d of fsSnap.docs) await deleteDoc(d.ref);
    await remove(ref(db, `users/${currentUser.uid}/savedRoutes`));

    _fsSavedRoutes = []; _rtdbSavedRoutes = [];
    recomputeSavedRoutes();
    localStorage.removeItem('cache_saved_routes_' + currentUser.uid);
    loadSavedRoutes();
  } catch(e) {}
};

window.openMenu = function() { document.getElementById('profileModal').classList.add('open'); loadHistory(); loadSavedRoutes(); loadSharedLinksFromStorage(); };
window.closeMenu = function() { document.getElementById('profileModal').classList.remove('open'); };

window.clearPoint = function(type) {
  if (type === 'start') { startPoint = null; document.getElementById('dirInputStart').value = ''; document.getElementById('btnClearStart').classList.add('hidden'); }
  else { endPoint = null; document.getElementById('dirInputEnd').value = ''; document.getElementById('btnClearEnd').classList.add('hidden'); document.getElementById('topSearchInput').value = ''; document.getElementById('searchClearBtn').classList.add('hidden'); }
};

function openDirections() {
  document.getElementById('dirSheet').classList.add('open');
  document.getElementById('dirSheet').style.transform = '';
  updateUIState();
}

function closeDirections() {
  document.getElementById('dirSheet').classList.remove('open');
  document.getElementById('dirSheet').style.transform = '';
  if (searchContext !== 'view') document.getElementById('suggestionsBox').classList.remove('show');
  if (document.getElementById('hud').classList.contains('hidden')) {
    if (currentRouteLayer) { map.removeLayer(currentRouteLayer); currentRouteLayer = null; }
    alternativeLayers.forEach(l => { try { map.removeLayer(l); } catch (e) {} });
    alternativeLayers = [];
    if (window._routeBadges) { window._routeBadges.forEach(m => map.removeLayer(m)); window._routeBadges = []; }
    currentRouteCoords = []; currentRouteData = null;
  }
  updateUIState();
}

function activateSearch(type) {
  searchContext = type;
  if (type !== 'view') document.getElementById('dirSheet').classList.add('open');
  const box = document.getElementById('suggestionsBox');
  box.classList.add('show');
  box.innerHTML = '<div class="sug-item">Nhập địa chỉ hoặc dán link Google Maps...</div>';
  const input = document.getElementById('topSearchInput');
  input.readOnly = false; input.value = ''; input.focus();
  document.getElementById('searchClearBtn').classList.add('hidden');
  input.oninput = (e) => {
    const q = e.target.value.trim();
    if (q.length > 0) document.getElementById('searchClearBtn').classList.remove('hidden');
    else document.getElementById('searchClearBtn').classList.add('hidden');
    if (q.length < 2 && !q.startsWith('http')) return;
    clearTimeout(window._searchTimer);
    window._searchTimer = setTimeout(() => doSearch(q), 500);
  };
  updateUIState();
}

function closeSearch() {
  document.getElementById('suggestionsBox').classList.remove('show');
  document.getElementById('topSearchInput').readOnly = true;
  updateUIState();
}

window.clearTopSearch = function() {
  document.getElementById('topSearchInput').value = '';
  document.getElementById('searchClearBtn').classList.add('hidden');
  clearPoint('end');
  map.eachLayer(layer => { if (layer instanceof L.Marker && layer.options.icon && layer.options.icon.options.className === 'custom-touch-marker') map.removeLayer(layer); });
  closeSearch();
};

async function doSearch(query) {
  const box = document.getElementById('suggestionsBox');
  if (query.startsWith('http://') || query.startsWith('https://')) {
    if (query.includes('google.com/maps') || query.includes('goo.gl/maps')) {
      box.innerHTML = '<div class="sug-item"><i class="fas fa-spinner fa-spin"></i> Đang giải mã link...</div>';
      try {
        const res = await fetchWorker(`/resolve-gmaps?url=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.success && data.coords) {
          box.innerHTML = '';
          const div = document.createElement('div');
          div.className = 'sug-item';
          div.innerHTML = `<i class="fas fa-map-marker-alt"></i><div>${data.placeName || 'Vị trí từ Google Maps'}</div>`;
          div.onclick = () => selectLocation(data.coords.lat, data.coords.lng, data.placeName || 'Vị trí từ Google Maps');
          box.appendChild(div);
        } else box.innerHTML = '<div class="sug-item" style="color:var(--danger)">Không giải mã được link này</div>';
      } catch (e) { box.innerHTML = '<div class="sug-item" style="color:var(--danger)">Lỗi kết nối</div>'; }
      return;
    }
  }
  const q = query.toLowerCase().trim();
  box.innerHTML = '';
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
    const res = await fetchWorker(`/trackasia-search?query=${encodeURIComponent(query)}`);
    const data = await res.json();
    const results = data.results || data.predictions || [];
    loadingDiv.remove();
    if (results.length > 0) {
      const title2 = document.createElement('div');
      title2.className = 'sug-section-title';
      title2.innerHTML = '<i class="fas fa-map-marked-alt"></i> Địa điểm khác';
      box.appendChild(title2);
      results.slice(0, 50).forEach(r => {
        const div = document.createElement('div');
        div.className = 'sug-item';
        const name = r.formatted_address || r.name || 'Không tên';
        const lat = r.geometry?.location?.lat || r.lat;
        const lng = r.geometry?.location?.lng || r.lng || r.lon;
        div.innerHTML = `<i class="fas fa-map-marker-alt"></i><div>${name}</div>`;
        div.onclick = () => selectLocation(lat, lng, name);
        box.appendChild(div);
      });
    } else if (restStopMatches.length === 0 && poiMatches.length === 0) box.innerHTML = '<div class="sug-item">Không tìm thấy kết quả</div>';
  } catch (e) {
    loadingDiv.remove();
    if (restStopMatches.length === 0 && poiMatches.length === 0) box.innerHTML = '<div class="sug-item" style="color:var(--danger)">Lỗi kết nối</div>';
  }
}

async function selectLocation(lat, lng, name) {
  document.getElementById('topSearchInput').value = name;
  document.getElementById('topSearchInput').readOnly = true;
  document.getElementById('searchClearBtn').classList.remove('hidden');
  closeSearch();
  map.flyTo([lat, lng], 16, { animate: true, duration: 1 });
  map.eachLayer(layer => { if (layer instanceof L.Marker && layer.options.icon && layer.options.icon.options.className === 'custom-touch-marker') map.removeLayer(layer); });
  const icon = L.divIcon({ html: '<div style="width:24px;height:24px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.5);"></div>', iconSize: [24,24], className: 'custom-touch-marker' });
  const tempMarker = L.marker([lat, lng], { icon }).addTo(map).bindPopup(`<b>Đang lấy địa chỉ chi tiết...</b>`).openPopup();
  let finalName = name;
  try { const res = await fetchWorker(`/reverse-geocode?lat=${lat}&lng=${lng}`); const data = await res.json(); if (data.display_name) finalName = data.display_name.split(',').slice(0, 3).join(', '); } catch (e) {}
  tempMarker.setPopupContent(`
    <div style="min-width: 180px;">
      <div style="font-weight: 800; font-size: 0.9rem; margin-bottom: 8px; line-height: 1.3; color: var(--text);">${finalName}</div>
      <button onclick="event.stopPropagation(); openSavePlaceModal(${lat}, ${lng}, '${escapeHtml(finalName).replace(/'/g, "\\'")}')" style="width: 100%; padding: 10px; background: var(--success); color: white; border: none; border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px;"><i class="fas fa-bookmark"></i> Ghim địa điểm</button>
      <button onclick="event.stopPropagation(); openPoiSheet(${lat}, ${lng}, '${escapeHtml(finalName).replace(/'/g, "\\'")}')" style="width: 100%; padding: 10px; background: linear-gradient(135deg,#10b981,#059669); color: white; border: none; border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px;"><i class="fas fa-plus-circle"></i> Thêm địa điểm mới</button>
      <button onclick="event.stopPropagation(); goToLongPressLocation(${lat}, ${lng}, '${escapeHtml(finalName).replace(/'/g, "\\'")}')" style="width: 100%; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px;"><i class="fas fa-location-arrow"></i> Tới chỗ này</button>
      <button onclick="event.stopPropagation(); shareLocation(${lat}, ${lng}, '${escapeHtml(finalName).replace(/'/g, "\\'")}')" style="width: 100%; padding: 10px; background: var(--card-2); color: var(--text); border: 1px solid var(--border); border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"><i class="fas fa-share-alt"></i> Chia sẻ</button>
    </div>`).openPopup();
  if (searchContext === 'view') {}
  else if (searchContext === 'start') { startPoint = { lat, lng, name: finalName }; document.getElementById('dirInputStart').value = finalName; document.getElementById('btnClearStart').classList.remove('hidden'); }
  else if (searchContext === 'end') { endPoint = { lat, lng, name: finalName }; document.getElementById('dirInputEnd').value = finalName; document.getElementById('topSearchInput').value = finalName; document.getElementById('btnClearEnd').classList.remove('hidden'); }
}

function refreshGPS() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(pos => {
    startPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, name: 'Vị trí của tôi' }; document.getElementById('dirInputStart').value = 'Vị trí của tôi (GPS)'; document.getElementById('btnClearStart').classList.remove('hidden');
    lastUserPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }; map.flyTo([pos.coords.latitude, pos.coords.longitude], 16, { animate: true, duration: 1.5 }); updateUserMarkerOnMap(lastUserPos, lastHeading);
  }, (err) => { console.warn(err); });
}

function getClosestPointOnSegment(p, a, b) {
  const atob = { x: b.lng - a.lng, y: b.lat - a.lat }; const atop = { x: p.lng - a.lng, y: p.lat - a.lat };
  const len = atob.x * atob.x + atob.y * atob.y; const dot = atop.x * atob.x + atop.y * atob.y;
  const t = Math.min(1, Math.max(0, dot / len)); return { lat: a.lat + atob.y * t, lng: a.lng + atob.x * t };
}

function getUserIcon(heading) {
  const svgIcon = `<div style="transform: rotate(${heading || 0}deg); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L22 20L12 16L2 20L12 2Z" fill="#10b981" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg></div>`;
  return L.divIcon({ html: svgIcon, className: '', iconSize: [40, 40], iconAnchor: [20, 20] });
}

function updateUserMarkerOnMap(pos, heading) {
  if (userMarker) map.removeLayer(userMarker);
  userMarker = L.marker([pos.lat, pos.lng], {
    icon: getUserIcon(heading),
    interactive: false
  }).addTo(map);
  if (gpsCircle) map.removeLayer(gpsCircle);
  gpsCircle = L.circle([pos.lat, pos.lng], {
    radius: pos.accuracy || 10,
    color: '#10b981', fillColor: '#10b981', fillOpacity: 0.15, weight: 1,
    interactive: false
  }).addTo(map);
}

function animateMarkerTo(targetPos) {
  if (!userMarker) { updateUserMarkerOnMap(targetPos, targetPos.heading); return; }

  let snappedLat = targetPos.lat, snappedLng = targetPos.lng, targetHeading = targetPos.heading;

  if (currentRouteCoords && currentRouteCoords.length > 1 && lastSnapIndex < currentRouteCoords.length - 1) {
    let minDist = Infinity, bestPoint = null, bestSegmentIndex = lastSnapIndex;
    const startScan = Math.max(0, lastSnapIndex - 2);
    const endScan = Math.min(currentRouteCoords.length - 1, lastSnapIndex + 100);

    for (let i = startScan; i < endScan; i++) {
      const pt = getClosestPointOnSegment(
        { lat: targetPos.lat, lng: targetPos.lng },
        { lat: currentRouteCoords[i][0], lng: currentRouteCoords[i][1] },
        { lat: currentRouteCoords[i+1][0], lng: currentRouteCoords[i+1][1] }
      );
      const d = calcDist(targetPos.lat, targetPos.lng, pt.lat, pt.lng);
      if (d < minDist) {
        minDist = d;
        bestPoint = pt;
        bestSegmentIndex = i;
      }
    }

    if (bestPoint && minDist < 60) {
      snappedLat = bestPoint.lat;
      snappedLng = bestPoint.lng;

      if (bestSegmentIndex > lastSnapIndex) {
        lastSnapIndex = bestSegmentIndex;
      }

      const p1 = currentRouteCoords[bestSegmentIndex];
      const p2 = currentRouteCoords[bestSegmentIndex + 1];

      if (targetPos.heading && targetPos.speed > 1.5) {
         targetHeading = targetPos.heading;
      } else {
         const angle = Math.atan2(p2[0] - p1[0], p2[1] - p1[1]);
         targetHeading = (angle * 180 / Math.PI) + 90;
      }
    }
  }

  if (currentRouteCoords && currentRouteCoords.length > 0 && lastSnapIndex > 0 && currentRouteLayer) {
    const remaining = currentRouteCoords.slice(lastSnapIndex);
    if (remaining.length > 1) {
      currentRouteLayer.setLatLngs(remaining);
    } else {
      map.removeLayer(currentRouteLayer);
      currentRouteLayer = null;
    }
  }

  const startLat = userMarker.getLatLng().lat, startLng = userMarker.getLatLng().lng;
  const startTime = performance.now(), duration = 1000;

  function step(time) {
    const progress = Math.min((time - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    userMarker.setLatLng([startLat + (snappedLat - startLat) * ease, startLng + (snappedLng - startLng) * ease]);
    userMarker.setIcon(getUserIcon(targetHeading));
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);

  if (gpsCircle) map.removeLayer(gpsCircle);
  gpsCircle = L.circle([snappedLat, snappedLng], {
    radius: targetPos.accuracy || 10,
    color: '#10b981', fillColor: '#10b981', fillOpacity: 0.15, weight: 1,
    interactive: false
  }).addTo(map);
}

function startWatching() {
  if (watchId) navigator.geolocation.clearWatch(watchId);
  let lastPosForSpeed = null; let lastTimeForSpeed = null;
  watchId = navigator.geolocation.watchPosition(pos => {
    const now = Date.now();
    let speed = pos.coords.speed;
    if ((speed === null || isNaN(speed)) && lastPosForSpeed && lastTimeForSpeed) {
      const dist = calcDist(lastPosForSpeed.lat, lastPosForSpeed.lng, pos.coords.latitude, pos.coords.longitude);
      const time = (now - lastTimeForSpeed) / 1000;
      if (time > 0) speed = dist / time;
    }
    lastPosForSpeed = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    lastTimeForSpeed = now;
    const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, speed: speed || 0, accuracy: pos.coords.accuracy || 10, heading: pos.coords.heading };
    smoothedSpeed = (0.2 * newPos.speed) + (0.8 * smoothedSpeed);
    document.getElementById('hudSpeed').textContent = Math.round(smoothedSpeed * 3.6) + ' km/h';
    if (lastUserPos && !newPos.heading) { const dy = newPos.lat - lastUserPos.lat, dx = newPos.lng - lastUserPos.lng; newPos.heading = 90 - (Math.atan2(dy, dx) * 180 / Math.PI); }
    lastUserPos = newPos;

    if (newPos.heading && Math.abs(newPos.heading) > 5) lastHeading = newPos.heading;

    animateMarkerTo(lastUserPos);
    if (map) map.setView([lastUserPos.lat, lastUserPos.lng], map.getZoom(), { animate: false });

    if (autoRotateWithHeading && !userRotatedMap) {
      const ml = getMaplibreInstance();
      if (ml && lastHeading) {
        try { ml.easeTo({ bearing: lastHeading, duration: 800 }); } catch(e) {}
      }
    }

    checkReportProximity(lastUserPos.lat, lastUserPos.lng); checkOffRoute(lastUserPos.lat, lastUserPos.lng); checkArrival(lastUserPos.lat, lastUserPos.lng); updateNextManeuverHUD(lastUserPos.lat, lastUserPos.lng);
  }, null, { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 });
}

function checkReportProximity(lat, lng) {
  if (!voiceEnabled) return; const now = Date.now();
  for (const key in allReports) {
    const rep = allReports[key]; if (now > rep.expiresAt || warnedReports.has(key)) continue;
    if (calcDist(lat, lng, rep.lat, rep.lng) < 300) {
      warnedReports.add(key);
      let msg = 'sự cố';
      if (rep.type === 'police') msg = 'CSGT'; else if (rep.type === 'accident') msg = 'tai nạn'; else if (rep.type === 'traffic') msg = 'kẹt xe'; else if (rep.type === 'flood') msg = 'ngập nước'; else if (rep.type === 'pothole') msg = 'ổ gà';
      speak(`Chú ý, phía trước có báo cáo ${msg}`);
    }
  }
}

function speak(text) {
  if (!voiceEnabled || !window.speechSynthesis) return;
  speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'vi-VN'; speechSynthesis.speak(u);
}

function startVoice() {
  speak('Bắt đầu dẫn đường.'); document.getElementById('hudBtnVoice').classList.add('active');
  voiceCheckTimer = setInterval(() => {
    if (!lastUserPos || !voiceRouteSteps) return;
    for (let i = voiceStepIndex; i < Math.min(voiceRouteSteps.length, voiceStepIndex + 3); i++) {
      const step = voiceRouteSteps[i]; if (!step?.maneuver?.location) continue;
      const d = calcDist(lastUserPos.lat, lastUserPos.lng, step.maneuver.location[1], step.maneuver.location[0]);
      if (d < 50) {
        speak(translateInstruction(step.maneuver.instruction));
        voiceStepIndex = i + 1;
        break;
      }
    }
  }, 3000);
}

function calcDist(lat1, lng1, lat2, lng2) {
  const R = 6371e3; const p1 = lat1 * Math.PI/180, p2 = lat2 * Math.PI/180; const dp = (lat2-lat1) * Math.PI/180, dl = (lng2-lng1) * Math.PI/180;
  const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

window.toggleLayerMenu = function() {
  const menu = document.getElementById('layerMenu');
  if (menu.classList.contains('show')) menu.classList.remove('show');
  else {
    menu.classList.add('show');
    setTimeout(() => {
      const closeHandler = (e) => {
        if (!menu.contains(e.target) && e.target.id !== 'btnLayerMenu' && !e.target.closest('#btnLayerMenu')) {
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
  if (currentMapLayer) { map.removeLayer(currentMapLayer); currentMapLayer = null; }
  document.querySelectorAll('.layer-option').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('layerMenu').classList.remove('show');

  if (type === 'trackasia') {
    try {
      const isLight = document.body.classList.contains('light-mode');
      currentMapLayer = L.maplibreGL({
        style: isLight ? MAPLIBRE_STYLE_LIGHT : MAPLIBRE_STYLE_DARK,
        maxPitch: 85
      }).addTo(map);

      setTimeout(() => {
        const ml = getMaplibreInstance();
        if (ml) {
          try {
            ml.touchZoomRotate.enableRotation();
            ml.touchPitch.enable();
          } catch(e) {}

          ml.on('rotate', () => { userRotatedMap = true; });
          ml.on('pitch', () => { userRotatedMap = true; });

          console.log('[MapLibre] ready');
          console.log('  canvas pointer-events:', getComputedStyle(ml.getCanvas()).pointerEvents);
          console.log('  canvas touch-action:', getComputedStyle(ml.getCanvas()).touchAction);
          console.log('  container pointer-events:', getComputedStyle(ml.getContainer()).pointerEvents);
          console.log('  touchZoomRotate enabled:', ml.touchZoomRotate.isEnabled());
          console.log('  touchPitch enabled:', ml.touchPitch.isEnabled());
          console.log('  maxPitch:', ml.getMaxPitch());
        }
      }, 500);
    } catch (error) {
      console.warn('MapLibre failed, fallback to OSM raster:', error);
      currentMapLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(map);
    }
  }
  else if (type === 'mapbox') {
    currentMapLayer = L.tileLayer(`${WORKER_URL}/mapbox-tiles/{z}/{x}/{y}`, { maxZoom: 19, tileSize: 512, zoomOffset: -1 }).addTo(map);
  }
  else if (type === 'thunderforest') {
    currentMapLayer = L.tileLayer(`${WORKER_URL}/tf-tiles/{z}/{x}/{y}`, { maxZoom: 19 }).addTo(map);
  }
  else if (type === 'satellite') {
    currentMapLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
  }
}

window.resetMapBearing = function() {
  const ml = getMaplibreInstance();
  if (ml) {
    try { ml.easeTo({ bearing: 0, pitch: 0, duration: 500 }); } catch(e) {}
    userRotatedMap = false;
    if (document.body.classList.contains('navigating')) autoRotateWithHeading = true;
    return;
  }
  if (lastUserPos) {
    map.flyTo([lastUserPos.lat, lastUserPos.lng], map.getZoom(), { animate: true });
  }
};

window.goToLongPressLocation = function(lat, lng, name) {
  endPoint = { lat, lng, name };
  document.getElementById('dirInputEnd').value = name; document.getElementById('topSearchInput').value = name;
  document.getElementById('btnClearEnd').classList.remove('hidden'); document.getElementById('searchClearBtn').classList.remove('hidden');
  if (map) map.closePopup();
  map.eachLayer(layer => { if (layer instanceof L.Marker && layer.options.icon && layer.options.icon.options.className === 'custom-touch-marker') map.removeLayer(layer); });
  openDirections(); if (!startPoint) refreshGPS();
};

function escapeHtml(text) { return String(text || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function centerToLocation() { if (lastUserPos) map.flyTo([lastUserPos.lat, lastUserPos.lng], 18, { animate: true, duration: 1.5 }); else refreshGPS(); }

window.openPoiSheet = function(lat, lng, addressHint) {
  if (!currentUser) { alert('Vui lòng đăng nhập để thêm địa điểm!'); return; }
  tempPoiLatLng = { lat, lng }; tempPoiTag = null;
  document.getElementById('poiCoords').textContent = `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}${addressHint ? ' • ' + addressHint : ''}`;
  document.getElementById('poiNameInput').value = '';
  document.getElementById('poiSaveBtn').disabled = true;
  document.querySelectorAll('.poi-tag-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('poiSheet').classList.add('open');
  if (map) map.closePopup();
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
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';
  try {
    const newRef = push(ref(db, 'communityPois'));
    await set(newRef, {
      lat: tempPoiLatLng.lat, lng: tempPoiLatLng.lng, name: name, tag: tempPoiTag,
      uid: currentUser.uid, authorName: currentUser.displayName || currentUser.email.split('@')[0], timestamp: Date.now(), upvotes: 0, source: 'rtdb'
    });
    closePoiSheet();
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:calc(80px + var(--safe-top));left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#10b981,#059669);color:white;padding:14px 22px;border-radius:14px;font-weight:800;z-index:9999;display:flex;gap:10px;align-items:center;';
    t.innerHTML = '<i class="fas fa-check-circle"></i><span>Đã thêm địa điểm!</span>';
    document.body.appendChild(t); setTimeout(() => t.remove(), 2500);
  } catch (e) { alert('Lỗi lưu: ' + e.message); btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Lưu địa điểm'; }
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
      <button onclick="copyPoiCoords()" style="background:transparent; color:var(--primary); font-size:1.1rem; padding:4px;" title="Copy toạ độ"><i class="fas fa-copy"></i></button>
    </div>
    <div class="poi-detail-actions">
      <button class="poi-detail-btn primary" onclick="goToPoiFromDetail()"><i class="fas fa-location-arrow"></i> Tới chỗ này</button>
      <button class="poi-detail-btn share" onclick="sharePoiFromDetail()"><i class="fas fa-share-alt"></i> Chia sẻ</button>
    </div>`;
  document.getElementById('poiDetailSheet').classList.add('open');
  if (map) map.closePopup();
};

window.closePoiDetail = function() { document.getElementById('poiDetailSheet').classList.remove('open'); currentDetailPoi = null; };
window.goToPoiFromDetail = function() { if (!currentDetailPoi) return; const { lat, lng, name } = currentDetailPoi; closePoiDetail(); goToLongPressLocation(lat, lng, name); };
window.sharePoiFromDetail = function() { if (!currentDetailPoi) return; shareLocation(currentDetailPoi.lat, currentDetailPoi.lng, currentDetailPoi.name); };

window.copyPoiCoords = function() {
  if (!currentDetailPoi) return;
  const text = `${currentDetailPoi.lat.toFixed(6)}, ${currentDetailPoi.lng.toFixed(6)}`;
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => showDetailToast('Đã copy toạ độ!'));
  else prompt('Copy toạ độ:', text);
};

function showDetailToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;top:calc(80px + var(--safe-top));left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#10b981,#059669);color:white;padding:12px 20px;border-radius:14px;font-weight:800;z-index:9999;display:flex;gap:10px;align-items:center;font-size:0.85rem;';
  t.innerHTML = `<i class="fas fa-check-circle"></i><span>${msg}</span>`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 2000);
}

function setupSwipeDown(sheetId, handleId, closeFn) {
  const sheet = document.getElementById(sheetId);
  const handle = document.getElementById(handleId);
  if (!sheet || !handle) return;
  let startY = 0, currentY = 0, isDragging = false;
  function onTouchStart(e) { startY = e.touches[0].clientY; currentY = startY; isDragging = true; sheet.style.transition = 'none'; }
  function onTouchMove(e) { if (!isDragging) return; currentY = e.touches[0].clientY; const deltaY = currentY - startY; if (deltaY > 0) sheet.style.transform = `translateY(${deltaY}px)`; }
  function onTouchEnd() {
    if (!isDragging) return; isDragging = false;
    sheet.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    const deltaY = currentY - startY;
    if (deltaY > 100) { sheet.style.transform = ''; closeFn(); } else sheet.style.transform = '';
  }
  handle.addEventListener('touchstart', onTouchStart, { passive: true });
  handle.addEventListener('touchmove', onTouchMove, { passive: true });
  handle.addEventListener('touchend', onTouchEnd);
}

document.addEventListener('DOMContentLoaded', () => {
  setupSwipeDown('poiDetailSheet', 'poiDetailSwipeHandle', () => closePoiDetail());
  setupSwipeDown('poiSheet', 'poiSheetSwipeHandle', () => closePoiSheet());
});

setTimeout(() => {
  setupSwipeDown('poiDetailSheet', 'poiDetailSwipeHandle', () => closePoiDetail());
  setupSwipeDown('poiSheet', 'poiSheetSwipeHandle', () => closePoiSheet());
}, 500);

let zoomHintShown = false;
function showZoomHint() {
  if (zoomHintShown) return; zoomHintShown = true;
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
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;top:calc(80px + var(--safe-top));left:50%;transform:translateX(-50%);background:${restStopFilterActive ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)' : 'linear-gradient(135deg,#64748b,#475569)'};color:white;padding:12px 20px;border-radius:14px;font-weight:800;z-index:9999;display:flex;gap:10px;align-items:center;font-size:0.85rem;`;
  t.innerHTML = restStopFilterActive ? `<i class="fas fa-bed"></i><span>Đang hiện ${restStopMarkers.length} trạm dừng nghỉ</span>` : `<i class="fas fa-eye"></i><span>Đã hiện tất cả địa điểm</span>`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 2000);
};

function liveLerp(a, b, t) { return a + (b - a) * t; }
function liveEase(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }
function liveHaversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function generateLiveRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = ''; for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random()*chars.length)];
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
    if (animState.marker) animState.marker.setLatLng([lat, lng]);
    if (t < 1) animState.animId = requestAnimationFrame(step);
    else { animState.animId = null; if (animState.marker) animState.marker.setLatLng([animState.to.lat, animState.to.lng]); }
  };
  animState.animId = requestAnimationFrame(step);
}

function animateLiveTo(animState, newLat, newLng, duration = LIVE_ANIM_DURATION) {
  if (!animState || !animState.marker) return;
  const cur = animState.marker.getLatLng();
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
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        if (lastUserPos && liveHaversine(lastUserPos.lat, lastUserPos.lng, newPos.lat, newPos.lng) * 1000 < 1) return;
        lastUserPos = newPos;
        if (liveMyAnimState) animateLiveTo(liveMyAnimState, newPos.lat, newPos.lng);
        else updateLiveMyMarker();
        pushLivePositionToRTDB();
      },
      (err) => console.warn('GPS loop err:', err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, LIVE_GPS_INTERVAL);
}

async function stopLiveSession() {
  liveEnabled = false;
  if (liveGpsInterval) { clearInterval(liveGpsInterval); liveGpsInterval = null; }
  if (liveHeartbeatInterval) { clearInterval(liveHeartbeatInterval); liveHeartbeatInterval = null; }
  if (liveRoomUnsub) { liveRoomUnsub(); liveRoomUnsub = null; }
  if (livePublicUnsub) { livePublicUnsub(); livePublicUnsub = null; }
  if (liveNavUnsub) { liveNavUnsub(); liveNavUnsub = null; }

  if (currentUser && liveRoomCode) {
    await remove(ref(db, `live_rooms/${liveRoomCode}/members/${currentUser.uid}`)).catch(()=>{});
    await remove(ref(db, `public_users/${currentUser.uid}`)).catch(()=>{});
    if (isLiveHost) {
      await remove(ref(db, `live_rooms/${liveRoomCode}`)).catch(()=>{});
    }
  }

  Object.values(liveMemberAnimStates).forEach(a => { if (a.animId) cancelAnimationFrame(a.animId); });
  Object.values(liveMemberMarkers).forEach(m => { try { map.removeLayer(m); } catch(e){} });
  liveMemberMarkers = {}; liveMemberAnimStates = {};
  if (liveMyAnimState?.animId) cancelAnimationFrame(liveMyAnimState.animId);
  if (liveMyMarker) { try { map.removeLayer(liveMyMarker); } catch(e){} liveMyMarker = null; }
  if (liveNavLayer) { try { map.removeLayer(liveNavLayer); } catch(e){} liveNavLayer = null; }
  liveMyAnimState = null;

  liveRoomCode = null; liveIsPublic = false; liveRoomMembers = []; livePublicUsers = [];
  isLiveHost = false; currentLiveNavData = null;

  const controls = document.getElementById('liveViewerControls');
  if (controls) controls.style.display = 'none';
  const infoCard = document.getElementById('liveInfoCard');
  if (infoCard) infoCard.classList.remove('show');

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

  if (liveEnabled) {
    badge.textContent = 'LIVE'; badge.classList.add('on'); badge.style.display = 'inline-block';
    features.style.opacity = '1'; features.style.pointerEvents = 'auto';
    overlay.style.display = 'none';
  } else {
    badge.textContent = 'OFF'; badge.classList.remove('on'); badge.style.display = 'none';
    features.style.opacity = '0.4'; features.style.pointerEvents = 'none';
    overlay.style.display = 'flex';
    codeBox.style.display = 'none'; actions.style.display = 'flex';
    publicBox.style.display = 'none'; membersBox.style.display = 'none'; leaveBtn.style.display = 'none';
    return;
  }

  if (liveRoomCode) {
    codeText.textContent = liveRoomCode;
    codeBox.style.display = 'flex'; actions.style.display = 'none';
    publicBox.style.display = 'block'; membersBox.style.display = 'block'; leaveBtn.style.display = 'block';
  } else {
    codeBox.style.display = 'none'; actions.style.display = 'flex';
    publicBox.style.display = 'none'; membersBox.style.display = 'none'; leaveBtn.style.display = 'none';
  }
}

function setupLiveUI() {
  let controls = document.getElementById('liveViewerControls');
  if (!controls) {
    controls = document.createElement('div');
    controls.id = 'liveViewerControls';
    controls.className = 'live-viewer-controls';
    controls.style.display = 'none';
    controls.innerHTML = `
      <div class="live-arrow" onclick="switchLiveUser(-1)"><i class="fas fa-chevron-left"></i></div>
      <div class="live-center-text" id="liveCenterText">
        Click vô 2 bên mũi tên để chuyển<br><span class="sub">user</span>
      </div>
      <div class="live-arrow" onclick="switchLiveUser(1)"><i class="fas fa-chevron-right"></i></div>
    `;
    document.body.appendChild(controls);
  }

  let infoCard = document.getElementById('liveInfoCard');
  if (!infoCard) {
    infoCard = document.createElement('div');
    infoCard.id = 'liveInfoCard';
    infoCard.className = 'live-info-card';
    infoCard.innerHTML = `
      <h3>Thông tin User</h3>
      <div class="live-info-row"><span class="label"><i class="fas fa-user"></i> Tên:</span><span class="value" id="infoName">—</span></div>
      <div class="live-info-row"><span class="label"><i class="fas fa-car"></i> Phương tiện:</span><span class="value" id="infoVehicle">—</span></div>
      <div class="live-info-row"><span class="label"><i class="fas fa-door-open"></i> Mã room:</span><span class="value" id="infoRoom" style="color:var(--success); font-family:var(--font-mono); font-size:1.2rem;"></span></div>
      <button onclick="document.getElementById('liveInfoCard').classList.remove('show')" style="width:100%; margin-top:15px; padding:12px; background:var(--primary); color:white; border:none; border-radius:10px; font-weight:800; cursor:pointer;">Đóng</button>
    `;
    document.body.appendChild(infoCard);
  }
  document.getElementById('infoRoom').textContent = liveRoomCode || '------';
}

window.createLiveRoom = async function(silent) {
  if (!currentUser) return;
  if (liveRoomCode) return alert('Bạn đang ở trong một phòng rồi!');
  const code = generateLiveRoomCode();
  liveRoomCode = code; liveIsPublic = false;
  isLiveHost = true;
  try {
    await set(ref(db, `live_rooms/${code}`), { hostUid: currentUser.uid, hostName: currentUser.displayName || currentUser.email.split('@')[0], isPublic: false, createdAt: Date.now() });
    onDisconnect(ref(db, `live_rooms/${code}`)).remove();
    const memberRef = ref(db, `live_rooms/${code}/members/${currentUser.uid}`);
    onDisconnect(memberRef).remove();
    const publicRef = ref(db, `public_users/${currentUser.uid}`);
    onDisconnect(publicRef).remove();
    if (lastUserPos) await pushLivePositionToRTDB();
    subscribeLiveRoom();
    updateLiveUI();
    setupLiveUI();
    if (liveHeartbeatInterval) clearInterval(liveHeartbeatInterval);
    liveHeartbeatInterval = setInterval(() => { if (liveRoomCode && currentUser) pushLivePositionToRTDB(); }, 15000);
    if (!silent) alert('Đã tạo phòng: ' + code);
  } catch (e) { alert('Lỗi tạo phòng: ' + e.message); }
};

window.joinLiveRoom = async function() {
  if (!currentUser) return alert('Vui lòng đăng nhập!');
  if (liveRoomCode) return alert('Bạn đang ở trong một phòng rồi!');
  const code = document.getElementById('liveJoinCodeInput').value.trim().toUpperCase();
  if (code.length !== 6) return alert('Mã phòng phải 6 ký tự!');
  try {
    const snap = await get(ref(db, `live_rooms/${code}`));
    if (!snap.exists()) return alert('Không tìm thấy phòng: ' + code);
    liveRoomCode = code; liveIsPublic = false;
    isLiveHost = false;
    const memberRef = ref(db, `live_rooms/${code}/members/${currentUser.uid}`);
    onDisconnect(memberRef).remove();
    const publicRef = ref(db, `public_users/${currentUser.uid}`);
    onDisconnect(publicRef).remove();
    document.getElementById('liveJoinCodeInput').value = '';
    if (lastUserPos) await pushLivePositionToRTDB();
    subscribeLiveRoom();
    updateLiveUI();
    setupLiveUI();
    if (liveHeartbeatInterval) clearInterval(liveHeartbeatInterval);
    liveHeartbeatInterval = setInterval(() => { if (liveRoomCode && currentUser) pushLivePositionToRTDB(); }, 15000);
    alert('Đã vào phòng: ' + code);
  } catch (e) { alert('Lỗi: ' + e.message); }
};

window.leaveLiveRoom = async function() {
  if (!confirm('Rời phòng Live?')) return;
  await stopLiveSession();
  document.getElementById('liveToggleSwitch').checked = false;
};

window.copyLiveRoomCode = function() {
  if (!liveRoomCode) return;
  navigator.clipboard.writeText(liveRoomCode).then(() => { alert('Đã copy mã phòng: ' + liveRoomCode); }).catch(() => { prompt('Copy mã phòng:', liveRoomCode); });
};

window.toggleLivePublic = async function() {
  if (!liveRoomCode || !currentUser) return;
  liveIsPublic = document.getElementById('livePublicSwitch').checked;
  if (liveIsPublic) {
    if (lastUserPos) await set(ref(db, `public_users/${currentUser.uid}`), { lat: lastUserPos.lat, lng: lastUserPos.lng, name: currentUser.displayName || currentUser.email.split('@')[0], roomCode: liveRoomCode, lastPing: Date.now() }).catch(()=>{});
    subscribeLivePublic();
  } else {
    await remove(ref(db, `public_users/${currentUser.uid}`)).catch(()=>{});
    if (livePublicUnsub) { livePublicUnsub(); livePublicUnsub = null; }
    livePublicUsers = [];
    renderLiveMembers(); renderLiveMemberMarkers();
  }
};

async function pushLivePositionToRTDB() {
  if (!currentUser || !lastUserPos || !liveRoomCode) return;
  const ts = Date.now();
  const data = {
    lat: lastUserPos.lat, lng: lastUserPos.lng,
    name: currentUser.displayName || currentUser.email.split('@')[0],
    vehicle: currentVehicleMode, isPublic: liveIsPublic, lastPing: ts
  };
  set(ref(db, `live_rooms/${liveRoomCode}/members/${currentUser.uid}`), data).catch(()=>{});
  if (liveIsPublic) set(ref(db, `public_users/${currentUser.uid}`), { ...data, roomCode: liveRoomCode }).catch(()=>{});
}

function updateLivePlayerControls() {
  activeLiveUsers = [...liveRoomMembers];
  const controls = document.getElementById('liveViewerControls');
  if (!controls) return;
  if (activeLiveUsers.length > 1) {
    controls.style.display = 'flex';
    const centerText = document.getElementById('liveCenterText');
    if (centerText) centerText.style.display = 'flex';
  } else {
    controls.style.display = 'none';
    const centerText = document.getElementById('liveCenterText');
    if (centerText) centerText.style.display = 'none';
  }
}

function subscribeLiveRoom() {
  if (!liveRoomCode) return;
  if (liveRoomUnsub) liveRoomUnsub();
  liveRoomUnsub = onValue(ref(db, `live_rooms/${liveRoomCode}/members`), (snap) => {
    const data = snap.val() || {};
    const now = Date.now();
    liveRoomMembers = Object.entries(data).map(([uid, m]) => ({ uid, ...m })).filter(m => !m.lastPing || (now - m.lastPing) < LIVE_HEARTBEAT_TIMEOUT);
    renderLiveMembers(); renderLiveMemberMarkers(); updateLivePlayerControls();
  });

  if (liveNavUnsub) liveNavUnsub();
  liveNavUnsub = onValue(ref(db, `live_rooms/${liveRoomCode}/navigation`), (snap) => {
    if (!snap.exists() || isLiveHost) return;
    const navData = snap.val();
    currentLiveNavData = navData;

    if (navData.routeCoords && navData.routeCoords.length > 0) {
      if (liveNavLayer) map.removeLayer(liveNavLayer);
      liveNavLayer = L.polyline(navData.routeCoords, { color: '#8b5cf6', weight: 6, opacity: 0.7, dashArray: '8, 8' }).addTo(map);
      if (navData.endLat && navData.endLng) map.flyTo([navData.endLat, navData.endLng], 14, { animate: true, duration: 1.5 });
    }
    if (currentVehicleMode === 'none' && !document.getElementById('clientVehicleModal').classList.contains('open')) {
      document.getElementById('clientVehicleModal').classList.add('open');
    }
  });
}

function subscribeLivePublic() {
  if (livePublicUnsub) livePublicUnsub();
  livePublicUnsub = onValue(ref(db, 'public_users'), (snap) => {
    const data = snap.val() || {};
    const now = Date.now();
    livePublicUsers = Object.entries(data)
      .map(([uid, u]) => ({ uid, ...u }))
      .filter(u => u.uid !== currentUser?.uid)
      .filter(u => !u.lastPing || (now - u.lastPing) < LIVE_HEARTBEAT_TIMEOUT)
      .filter(u => { if (!lastUserPos) return false; return liveHaversine(lastUserPos.lat, lastUserPos.lng, u.lat, u.lng) <= 10; })
      .map(u => ({ ...u, distance: lastUserPos ? liveHaversine(lastUserPos.lat, lastUserPos.lng, u.lat, u.lng) : null }));
    renderLiveMembers(); renderLiveMemberMarkers();
  });
}

function renderLiveMembers() {
  const listEl = document.getElementById('liveMemberList');
  const countEl = document.getElementById('liveMemberCount');
  if (!listEl) return;
  const all = [
    ...liveRoomMembers.map(m => ({ ...m, source: 'room' })),
    ...livePublicUsers.filter(p => !liveRoomMembers.some(r => r.uid === p.uid)).map(p => ({ ...p, source: 'public' }))
  ];
  if (all.length === 0) {
    listEl.innerHTML = '<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:0.75rem;"><i class="fas fa-users" style="font-size:1.5rem; opacity:0.3; display:block; margin-bottom:6px;"></i>Chưa có ai</div>';
    countEl.textContent = '0'; return;
  }
  countEl.textContent = all.length;
  listEl.innerHTML = all.map(m => {
    const isMe = m.uid === currentUser?.uid;
    const isPub = m.isPublic || m.source === 'public';
    const cls = isMe ? 'me' : (isPub ? 'public' : '');
    const initial = (m.name || 'U')[0].toUpperCase();
    const dist = m.distance ? m.distance.toFixed(1) + ' km' : '';
    const badge = isMe ? '<span style="font-size:0.6rem;color:#10b981;font-weight:800;">BẠN</span>' : (isPub ? '<span style="font-size:0.6rem;color:var(--warning);font-weight:800;">PUBLIC</span>' : '');
    return `<div class="live-member-item ${cls}"><div class="lm-avatar">${initial}</div><div class="lm-info"><div class="lm-name">${escapeHtml(m.name || 'User')} ${badge}</div><div class="lm-meta">${m.lat?.toFixed(4)}, ${m.lng?.toFixed(4)}</div></div><div class="lm-dist">${dist}</div></div>`;
  }).join('');
}

function updateLiveMyMarker() {
  if (!lastUserPos || !map) return;
  const icon = L.divIcon({ html: '<div class="live-me-pin"><i class="fas fa-location-arrow"></i></div>', className: '', iconSize: [40, 40], iconAnchor: [20, 20] });
  if (liveMyMarker) liveMyMarker.setLatLng([lastUserPos.lat, lastUserPos.lng]);
  else {
    liveMyMarker = L.marker([lastUserPos.lat, lastUserPos.lng], { icon, zIndexOffset: 1000, interactive: false }).addTo(map);
    liveMyAnimState = { from: { lat: lastUserPos.lat, lng: lastUserPos.lng }, to: { lat: lastUserPos.lat, lng: lastUserPos.lng }, startTime: performance.now(), duration: LIVE_ANIM_DURATION, marker: liveMyMarker, animId: null };
  }
}

function renderLiveMemberMarkers() {
  const all = [
    ...liveRoomMembers.filter(m => m.uid !== currentUser?.uid),
    ...livePublicUsers.filter(p => !liveRoomMembers.some(r => r.uid === p.uid) && p.uid !== currentUser?.uid)
  ];
  const seen = new Set();
  all.forEach(m => {
    seen.add(m.uid);
    const existing = liveMemberMarkers[m.uid];
    if (existing) {
      const a = liveMemberAnimStates[m.uid];
      if (a) {
        const cur = existing.getLatLng();
        if (liveHaversine(cur.lat, cur.lng, m.lat, m.lng) * 1000 > 1) animateLiveTo(a, m.lat, m.lng);
      }
      existing.setPopupContent(`<b>${escapeHtml(m.name)}</b><br>${m.distance ? m.distance.toFixed(1)+' km' : ''}`);
    } else {
      const isPub = m.isPublic || m.source === 'public';
      const icon = L.divIcon({ html: `<div class="live-other-pin ${isPub ? 'public' : ''}"><i class="fas fa-user"></i></div>`, className: '', iconSize: [34, 34], iconAnchor: [17, 17] });
      const marker = L.marker([m.lat, m.lng], { icon, interactive: false }).addTo(map);
      liveMemberMarkers[m.uid] = marker;
      liveMemberAnimStates[m.uid] = { from: { lat: m.lat, lng: m.lng }, to: { lat: m.lat, lng: m.lng }, startTime: performance.now(), duration: LIVE_ANIM_DURATION, marker: marker, animId: null };
    }
  });
  Object.keys(liveMemberMarkers).forEach(uid => {
    if (!seen.has(uid)) {
      if (liveMemberAnimStates[uid]?.animId) cancelAnimationFrame(liveMemberAnimStates[uid].animId);
      map.removeLayer(liveMemberMarkers[uid]);
      delete liveMemberMarkers[uid]; delete liveMemberAnimStates[uid];
    }
  });
}

async function initViewerLiveRoom(roomCode) {
  isViewingLiveTrack = true;
  map.flyTo(initialCenter, 15);

  const hud = document.createElement('div');
  hud.id = 'liveHud';
  hud.style.cssText = 'position:fixed;top:calc(16px + var(--safe-top));left:50%;transform:translateX(-50%);background:var(--card);border:1px solid #10b981;border-radius:20px;padding:8px 16px;z-index:1000;font-weight:800;font-size:0.85rem;color:#10b981;display:flex;gap:8px;align-items:center;box-shadow:0 4px 15px rgba(16,185,129,0.3);';
  hud.innerHTML = `<i class="fas fa-satellite-dish fa-spin"></i> Phòng: ${roomCode}`;
  document.body.appendChild(hud);

  setupLiveUI();

  const membersRef = ref(db, `live_rooms/${roomCode}/members`);
  onValue(membersRef, (snap) => {
    const data = snap.val() || {};
    const now = Date.now();
    activeLiveUsers = Object.entries(data).map(([uid, m]) => ({ uid, ...m })).filter(m => !m.lastPing || (now - m.lastPing) < LIVE_HEARTBEAT_TIMEOUT);
    if (activeLiveUsers.length === 0) { handleViewerDisconnect(roomCode, false); return; }

    const controls = document.getElementById('liveViewerControls');
    if (activeLiveUsers.length > 1) {
      if (controls) controls.style.display = 'flex';
      const centerText = document.getElementById('liveCenterText');
      if (centerText) centerText.style.display = 'flex';
    } else {
      if (controls) controls.style.display = 'none';
      const centerText = document.getElementById('liveCenterText');
      if (centerText) centerText.style.display = 'none';
      currentLiveIndex = 0;
    }

    activeLiveUsers.forEach(m => {
      const existing = liveMemberMarkers[m.uid];
      if (existing) {
        const a = liveMemberAnimStates[m.uid];
        if (a) animateLiveTo(a, m.lat, m.lng);
      } else {
        const icon = L.divIcon({ html: '<div class="live-me-pin"><i class="fas fa-user"></i></div>', className: '', iconSize: [40, 40], iconAnchor: [20, 20] });
        const marker = L.marker([m.lat, m.lng], { icon, zIndexOffset: 1000, interactive: false }).addTo(map);
        liveMemberMarkers[m.uid] = marker;
        liveMemberAnimStates[m.uid] = { from: { lat: m.lat, lng: m.lng }, to: { lat: m.lat, lng: m.lng }, startTime: performance.now(), duration: LIVE_ANIM_DURATION, marker: marker, animId: null };
      }
    });

    Object.keys(liveMemberMarkers).forEach(uid => {
      if (!activeLiveUsers.some(m => m.uid === uid)) {
        if (liveMemberAnimStates[uid]?.animId) cancelAnimationFrame(liveMemberAnimStates[uid].animId);
        map.removeLayer(liveMemberMarkers[uid]);
        delete liveMemberMarkers[uid]; delete liveMemberAnimStates[uid];
      }
    });

    if (activeLiveUsers.length > 0 && liveMemberMarkers[activeLiveUsers[0].uid]) {
      map.flyTo([activeLiveUsers[0].lat, activeLiveUsers[0].lng], 16, { animate: true, duration: 1.5 });
    }
  });

  onValue(ref(db, `live_rooms/${roomCode}/navigation`), (snap) => {
    if (!snap.exists()) return;
    const navData = snap.val();
    currentLiveNavData = navData;
    if (navData.routeCoords && navData.routeCoords.length > 0) {
      if (liveNavLayer) map.removeLayer(liveNavLayer);
      liveNavLayer = L.polyline(navData.routeCoords, { color: '#8b5cf6', weight: 6, opacity: 0.7, dashArray: '8, 8' }).addTo(map);
    }
    if (navData.endLat && navData.endLng) map.flyTo([navData.endLat, navData.endLng], 14, { animate: true, duration: 1.5 });
    if (currentVehicleMode === 'none' && !document.getElementById('clientVehicleModal').classList.contains('open')) {
      document.getElementById('clientVehicleModal').classList.add('open');
    }
  });
}

window.selectClientVehicle = function(vehicle) {
  currentVehicleMode = vehicle;
  document.getElementById('clientVehicleModal').classList.remove('open');
  if (liveEnabled && liveRoomCode && currentUser) {
    set(ref(db, `live_rooms/${liveRoomCode}/members/${currentUser.uid}/vehicle`), vehicle).catch(()=>{});
  }
  document.querySelectorAll('.vehicle-mode-btn').forEach(b => {
    b.classList.remove('active');
    if (b.getAttribute('data-mode') === vehicle) b.classList.add('active');
  });

  if (currentLiveNavData && currentLiveNavData.routeCoords) {
    if (lastUserPos) {
      startPoint = { lat: lastUserPos.lat, lng: lastUserPos.lng, name: 'Vị trí của tôi' };
    }
    endPoint = { lat: currentLiveNavData.endLat, lng: currentLiveNavData.endLng, name: currentLiveNavData.endName || 'Điểm đến của Host' };
    currentRouteCoords = currentLiveNavData.routeCoords;

    currentRouteData = {
      distance: 0, duration: 0,
      geometry: { coordinates: currentRouteCoords },
      legs: [{ steps: [] }],
      provider: 'live_host', mode: currentVehicleMode
    };

    if (currentRouteLayer) map.removeLayer(currentRouteLayer);
    currentRouteLayer = L.polyline(currentRouteCoords, { color: '#8b5cf6', weight: 8, lineCap: 'round', lineJoin: 'round' }).addTo(map);

    startNavigationHUD();
    alert('Đã bắt đầu dẫn đường theo lộ trình của Host!');
  } else {
    alert('Đã chọn phương tiện: ' + vehicle + '. Vui lòng chờ Host bắt đầu chuyến đi.');
  }
};

window.switchLiveUser = function(dir) {
  if (activeLiveUsers.length <= 1) return;
  currentLiveIndex = (currentLiveIndex + dir + activeLiveUsers.length) % activeLiveUsers.length;
  const targetUser = activeLiveUsers[currentLiveIndex];
  if (liveMemberMarkers[targetUser.uid]) {
    map.flyTo([targetUser.lat, targetUser.lng], 16, { animate: true, duration: 1 });
  }
  showLiveInfoCard(targetUser);
};

function showLiveInfoCard(user) {
  const infoCard = document.getElementById('liveInfoCard');
  if (!infoCard) return;
  document.getElementById('infoName').innerHTML = escapeHtml(user.name || 'Không tên');
  let vehicleLabel = 'Chưa chọn';
  let vIcon = 'fa-question-circle';
  if (user.vehicle === 'driving' || user.vehicle === 'driving-traffic') { vehicleLabel = 'Ô tô'; vIcon = 'fa-car'; }
  else if (user.vehicle === 'motorcycle' || user.vehicle === 'hd') { vehicleLabel = 'Xe máy'; vIcon = 'fa-motorcycle'; }
  else if (user.vehicle === 'truck') { vehicleLabel = 'Xe tải'; vIcon = 'fa-truck'; }
  else if (user.vehicle === 'walking') { vehicleLabel = 'Đi bộ'; vIcon = 'fa-walking'; }
  else if (user.vehicle === 'bicycle') { vehicleLabel = 'Xe đạp'; vIcon = 'fa-bicycle'; }
  document.getElementById('infoVehicle').innerHTML = `<i class="fas ${vIcon}"></i> ${vehicleLabel}`;
  infoCard.classList.add('show');
  clearTimeout(window._infoCardTimer);
  window._infoCardTimer = setTimeout(() => { infoCard.classList.remove('show'); }, 4000);
}

function handleViewerDisconnect(roomCode, isTimeout) {
  if (!isViewingLiveTrack) return;
  isViewingLiveTrack = false;
  Object.keys(liveMemberMarkers).forEach(uid => {
    if (liveMemberAnimStates[uid]?.animId) cancelAnimationFrame(liveMemberAnimStates[uid].animId);
    try { map.removeLayer(liveMemberMarkers[uid]); } catch(e){}
  });
  liveMemberMarkers = {}; liveMemberAnimStates = {}; activeLiveUsers = []; currentLiveNavData = null;
  const hud = document.getElementById('liveHud');
  if (hud) {
    hud.style.borderColor = 'var(--danger)'; hud.style.color = 'var(--danger)';
    hud.innerHTML = isTimeout ? `<i class="fas fa-exclamation-triangle"></i> Mất kết nối` : `<i class="fas fa-times-circle"></i> Phòng đã đóng`;
    setTimeout(() => hud.remove(), 5000);
  }
  const controls = document.getElementById('liveViewerControls');
  if (controls) controls.style.display = 'none';
  const infoCard = document.getElementById('liveInfoCard');
  if (infoCard) infoCard.classList.remove('show');
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'Esc') closeDirections(); });
window.openDirections = openDirections; window.activateSearch = activateSearch; window.refreshGPS = refreshGPS; window.centerToLocation = centerToLocation; window.logout = logout; window.toggleLayerMenu = toggleLayerMenu; window.changeLayer = changeLayer; window.shareRoute = shareRoute; window.shareLocation = shareLocation; window.submitReport = submitReport; window.openReportMenu = openReportMenu; window.closeReportMenu = closeReportMenu; window.closeDirections = closeDirections;
