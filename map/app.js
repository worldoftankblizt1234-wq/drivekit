/* =====================================================
   DriveKit — app.js (MapLibre Native + Siêu Tìm Kiếm)
   ===================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, set, get, onValue, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, onSnapshot, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ---------- FIREBASE ---------- */
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

/* ---------- API KEYS ---------- */
const MAPTILER_KEY = 'aEzMCP0ANRz52vd1RvrW';
const MAPTILER_STYLE = `https://api.maptiler.com/maps/streets-v4/style.json?key=${MAPTILER_KEY}`;
const TRACKASIA_KEY = '1792297789c0cf0ddb16e5446d7364580f';
const MAPBOX_KEY = 'pk.eyJ1IjoibWluaGFkb2YyIiwiYSI6ImNtdnMwNDBhdzAwbnozNXExaHczb3Znd2MifQ.iVKGNbnj_pUxT6B_gqazEw';
const TOMTOM_KEY = 'tG84Z1Yh4rauGWjz6pRn98rrWymLjTru';

/* ---------- API HELPERS ---------- */
async function apiReverseGeocode(lat, lng) {
  try {
    const url = `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${MAPTILER_KEY}&language=vi&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    const f = data.features?.[0];
    return f?.place_name_vi || f?.place_name || '';
  } catch (e) { 
    console.warn('reverse-geocode error:', e); 
    return ''; 
  }
}

async function apiSearch(query) {
  let finalResults = [];
  
  // Hàm phụ để xoá các kết quả bị trùng tên hoặc trùng toạ độ
  const addUniqueResults = (newResults) => {
    newResults.forEach(nr => {
      if (!finalResults.some(fr => fr.name === nr.name || (Math.abs(fr.lat - nr.lat) < 0.0001 && Math.abs(fr.lng - nr.lng) < 0.0001))) {
        finalResults.push(nr);
      }
    });
  };

  // Lớp 1: MapTiler (Ưu tiên số 1, chuẩn tiếng Việt)
  try {
    const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${MAPTILER_KEY}&language=vi&limit=20&autocomplete=true&boundary.country=vn`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.features && data.features.length > 0) {
      addUniqueResults(data.features.map(f => ({ 
        name: f.place_name_vi || f.place_name || f.text, 
        lat: f.center[1], lng: f.center[0] 
      })));
    }
  } catch (e) { console.warn('MapTiler search error:', e); }

  // Lớp 2: Mapbox (Fallback nếu MapTiler bị lỗi)
  if (finalResults.length === 0) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_KEY}&language=vi&country=vn&limit=20&autocomplete=true`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        addUniqueResults(data.features.map(f => ({ 
          name: f.place_name, 
          lat: f.center[1], lng: f.center[0] 
        })));
      }
    } catch (e) { console.warn('Mapbox search error:', e); }
  }

  // Lớp 3: TomTom (Fallback cuối cùng)
  if (finalResults.length === 0) {
    try {
      const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${TOMTOM_KEY}&countrySet=VN&language=vi-VN&limit=20`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        addUniqueResults(data.results.map(r => ({ 
          name: r.address.freeformAddress || r.poi.name, 
          lat: r.position.lat, lng: r.position.lon 
        })));
      }
    } catch (e) { console.warn('TomTom search error:', e); }
  }

  return finalResults.slice(0, 20);
}

function mapTomTomManeuver(m) {
  const s = (m || '').toUpperCase();
  if (s.includes('ARRIVE')) return { type: 'arrive', modifier: '' };
  if (s.includes('ROUNDABOUT')) return { type: 'roundabout', modifier: '' };
  if (s.includes('UTURN')) return { type: 'turn', modifier: 'uturn' };
  if (s.includes('SHARP_LEFT')) return { type: 'turn', modifier: 'sharp left' };
  if (s.includes('SHARP_RIGHT')) return { type: 'turn', modifier: 'sharp right' };
  if (s.includes('SLIGHT_LEFT') || s.includes('BEAR_LEFT')) return { type: 'turn', modifier: 'slight left' };
  if (s.includes('SLIGHT_RIGHT') || s.includes('BEAR_RIGHT')) return { type: 'turn', modifier: 'slight right' };
  if (s.includes('LEFT')) return { type: 'turn', modifier: 'left' };
  if (s.includes('RIGHT')) return { type: 'turn', modifier: 'right' };
  return { type: 'continue', modifier: '' };
}

async function apiRouteTrackAsia(origin, dest, mode) {
  const vehicleMap = { driving:'car', hd:'car', truck:'truck', motorcycle:'motorcycle', walking:'pedestrian', bicycle:'bicycle' };
  const vehicle = vehicleMap[mode] || 'car';
  const url = `https://maps.track-asia.com/route/v2/route?key=${TRACKASIA_KEY}&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&vehicle=${vehicle}&alternatives=true&instructions=true`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.routes) throw new Error(data.message || 'TrackAsia không có tuyến');
  return data.routes.map(r => {
    const raw = r.geometry?.coordinates || [];
    const coords = raw.map(c => Math.abs(c[0]) > 90 ? [c[1], c[0]] : [c[0], c[1]]);
    const leg = r.legs?.[0] || {};
    const dist = leg.distance?.value || leg.distance || 0;
    const dur  = leg.duration?.value || leg.duration || 0;
    return {
      geometry: { coordinates: coords },
      distance: dist, duration: dur,
      legs: [{ steps: leg.steps || [] }],
      provider: 'TrackAsia', mode
    };
  });
}

async function apiRouteTomTom(origin, dest, mode) {
  const modeMap = { 'driving-traffic':'car', driving:'car', hd:'car', truck:'truck', motorcycle:'motorcycle', walking:'pedestrian', bicycle:'bicycle' };
  const travelMode = modeMap[mode] || 'car';
  const url = `https://api.tomtom.com/routing/1/calculateRoute/${origin.lat},${origin.lng}:${dest.lat},${dest.lng}/json?key=${TOMTOM_KEY}&travelMode=${travelMode}&traffic=true&routeType=fastest&maxAlternatives=2&instructionsType=text&language=vi-VN`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.routes) throw new Error(data.error?.description || 'TomTom không có tuyến');
  return data.routes.map(r => {
    const coords = [];
    const steps = [];
    (r.legs || []).forEach(leg => {
      (leg.points || []).forEach(p => coords.push([p.latitude, p.longitude]));
      (leg.instructions || []).forEach(ins => {
        const man = mapTomTomManeuver(ins.maneuver);
        steps.push({ maneuver: {
          location: [ins.point?.longitude || 0, ins.point?.latitude || 0],
          type: man.type, modifier: man.modifier,
          instruction: ins.message || ins.instruction || ''
        }});
      });
    });
    return {
      geometry: { coordinates: coords },
      distance: r.summary?.lengthInMeters || 0,
      duration: r.summary?.travelTimeInSeconds || 0,
      legs: [{ steps }],
      provider: 'TomTom', mode
    };
  });
}

async function apiRoute(origin, dest, mode) {
  if (mode === 'driving-traffic') return apiRouteTomTom(origin, dest, mode);
  return apiRouteTrackAsia(origin, dest, mode);
}

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

/* ---------- GLOBAL STATE ---------- */
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
let initialCenter = [21.0285, 105.8542]; // [lat, lng]
let initialZoom = 16;
let lastSnapIndex = 0;
let smoothedSpeed = 0;
let offRouteCount = 0;
let isRerouting = false;
let warnedReports = new Set();
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
let allSavedPlaces = {};
let allHistory = [];
let allSavedRoutes = [];
let _fsRestStops = [], _rtdbRestStops = [];
let _fsCommunityPois = [], _rtdbCommunityPois = [];
let _fsReports = {}, _rtdbReports = {};
let _fsAvoidZones = [], _rtdbAvoidZones = [];
let _fsSavedPlaces = {}, _rtdbSavedPlaces = {};
let _fsHistory = [], _rtdbHistory = [];
let _fsSavedRoutes = [], _rtdbSavedRoutes = [];
let communityPoiMarkers = [];
let restStopMarkers = [];
let reportMarkers = [];
let savedPlacesMarkers = [];
let avoidZoneMarkers = [];
let _unsub = { fsRest:null, rtdbCommunity:null, fsPoi:null, fsReports:null, rtdbReports:null, fsAvoid:null, rtdbAvoid:null, fsSaved:null, rtdbSaved:null, fsHistory:null, rtdbHistory:null, fsRoutes:null, rtdbRoutes:null };
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

/* ---------- LOADING & AUTH SCREEN ---------- */
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
    authScr.classList.add('hidden');
    appUI.classList.remove('hidden');
    if (!_appUIInitialized) {
      _appUIInitialized = true;
      try { initAppUI(); } catch (e) { console.error('[initAppUI] crash:', e); }
    }
  } else {
    appUI.classList.add('hidden');
    authScr.classList.remove('hidden');
  }
}

function updateLoadingProgress(targetPercent, text) {
  if (isAppReadyToShow) return;
  if (targetPercent > loadProgress) loadProgress = targetPercent;
  const pctEl = document.getElementById('loadingPercent');
  if (pctEl) pctEl.textContent = `${Math.floor(loadProgress)}%`;
  if (text) {
    const tEl = document.getElementById('loadingText');
    if (tEl) tEl.textContent = text;
  }
}

function checkLoadingComplete() {
  if (isUserAuthChecked && loadProgress >= 90 && !isAppReadyToShow) {
    if (loadInterval) { clearInterval(loadInterval); loadInterval = null; }
    if (forceFinishTimer) { clearTimeout(forceFinishTimer); forceFinishTimer = null; }
    let finalProgress = loadProgress;
    const finalPhase = setInterval(() => {
      finalProgress += 5;
      if (finalProgress >= 100) {
        finalProgress = 100;
        clearInterval(finalPhase);
        isAppReadyToShow = true;
        const pctEl = document.getElementById('loadingPercent');
        const tEl = document.getElementById('loadingText');
        if (pctEl) pctEl.textContent = `100%`;
        if (tEl) tEl.textContent = "Hoàn tất!";
        setTimeout(applyScreenState, 300);
      } else {
        const pctEl = document.getElementById('loadingPercent');
        if (pctEl) pctEl.textContent = `${finalProgress}%`;
      }
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

  if (user) {
    const pn = document.getElementById('profileName');
    const pe = document.getElementById('profileEmail');
    const pa = document.getElementById('profileAvatar');
    if (pn) pn.textContent = user.displayName || user.email.split('@')[0];
    if (pe) pe.textContent = user.email;
    if (pa && user.photoURL) pa.innerHTML = `<img src="${user.photoURL}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;

    if (isAppReadyToShow && !wasLoggedIn) {
      applyScreenState();
      return;
    }

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
    } else {
      updateLoadingProgress(95, "Thiết bị không hỗ trợ GPS");
      checkLoadingComplete();
    }
  } else {
    if (isAppReadyToShow && wasLoggedIn) {
      applyScreenState();
      return;
    }
    updateLoadingProgress(95, "Chưa đăng nhập...");
    checkLoadingComplete();
  }
});

/* ---------- APP INIT ---------- */
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
};
setInterval(() => { const c = document.getElementById('profileTime'); if (c) c.textContent = new Date().toLocaleTimeString('vi-VN'); }, 1000);

/* ---------- AUTH UI ---------- */
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
function logout() { if (liveEnabled) stopLiveSession(); signOut(auth); closeMenu(); }

/* ---------- DATA SUBSCRIPTIONS ---------- */
function initDualDataSubscriptions() {
  if (!currentUser) return;
  _unsub.fsRest = onSnapshot(collection(fsdb, 'rest_stops'), snap => {
    _fsRestStops = snap.docs.map(d => ({ id: d.id, _id: d.id, source: 'firestore', ...d.data() }));
    recomputeRestStops();
  }, err => console.warn('FS rest_stops:', err));
  _unsub.rtdbCommunity = onValue(ref(db, 'communityPois'), snap => {
    const data = snap.val() || {};
    const all = Object.entries(data).map(([k, v]) => ({ _id: k, id: k, ...v }));
    _rtdbRestStops = all.filter(p => p.tag === 'rest_stop').map(p => ({ ...p, source: 'rtdb' }));
    _rtdbCommunityPois = all.filter(p => p.tag !== 'rest_stop').map(p => ({ ...p, source: 'rtdb' }));
    recomputeRestStops();
    recomputeCommunityPois();
  }, err => console.warn('RTDB communityPois:', err));
  _unsub.fsPoi = onSnapshot(collection(fsdb, 'community_pois'), snap => {
    _fsCommunityPois = snap.docs.map(d => ({ id: d.id, _id: d.id, source: 'firestore', ...d.data() }));
    recomputeCommunityPois();
  }, err => console.warn('FS community_pois:', err));
  _unsub.fsReports = onSnapshot(collection(fsdb, 'reports'), snap => {
    _fsReports = {};
    snap.docs.forEach(d => { _fsReports[d.id] = { id: d.id, _id: d.id, source: 'firestore', ...d.data() }; });
    recomputeReports();
  }, err => console.warn('FS reports:', err));
  _unsub.rtdbReports = onValue(ref(db, 'reports'), snap => {
    const data = snap.val() || {};
    _rtdbReports = {};
    Object.entries(data).forEach(([k, v]) => { _rtdbReports[k] = { id: k, _id: k, source: 'rtdb', ...v }; });
    recomputeReports();
  }, err => console.warn('RTDB reports:', err));
  _unsub.fsAvoid = onSnapshot(collection(fsdb, 'avoid_zones'), snap => {
    _fsAvoidZones = snap.docs.map(d => ({ id: d.id, _id: d.id, source: 'firestore', ...d.data() }));
    recomputeAvoidZones();
  }, err => console.warn('FS avoid_zones:', err));
  _unsub.rtdbAvoid = onValue(ref(db, 'avoid_zones'), snap => {
    const data = snap.val() || {};
    _rtdbAvoidZones = Object.entries(data).map(([k, v]) => ({ id: k, _id: k, source: 'rtdb', ...v }));
    recomputeAvoidZones();
  }, err => console.warn('RTDB avoid_zones:', err));
  _unsub.fsSaved = onSnapshot(collection(fsdb, `users/${currentUser.uid}/savedPlaces`), snap => {
    _fsSavedPlaces = {};
    snap.docs.forEach(d => { _fsSavedPlaces[d.id] = { id: d.id, _id: d.id, source: 'firestore', ...d.data() }; });
    recomputeSavedPlaces();
  }, err => console.warn('FS savedPlaces:', err));
  _unsub.rtdbSaved = onValue(ref(db, `users/${currentUser.uid}/savedPlaces`), snap => {
    const data = snap.val() || {};
    _rtdbSavedPlaces = {};
    Object.entries(data).forEach(([k, v]) => { _rtdbSavedPlaces[k] = { id: k, _id: k, source: 'rtdb', ...v }; });
    recomputeSavedPlaces();
  }, err => console.warn('RTDB savedPlaces:', err));
  _unsub.fsHistory = onSnapshot(collection(fsdb, `users/${currentUser.uid}/history`), snap => {
    _fsHistory = snap.docs.map(d => ({ id: d.id, _id: d.id, source: 'firestore', ...d.data() }));
    recomputeHistory();
  }, err => console.warn('FS history:', err));
  _unsub.rtdbHistory = onValue(ref(db, `users/${currentUser.uid}/history`), snap => {
    const data = snap.val() || {};
    _rtdbHistory = Object.entries(data).map(([k, v]) => ({ id: k, _id: k, source: 'rtdb', ...v }));
    recomputeHistory();
  }, err => console.warn('RTDB history:', err));
  _unsub.fsRoutes = onSnapshot(collection(fsdb, `users/${currentUser.uid}/savedRoutes`), snap => {
    _fsSavedRoutes = snap.docs.map(d => ({ id: d.id, _id: d.id, source: 'firestore', ...d.data() }));
    recomputeSavedRoutes();
  }, err => console.warn('FS savedRoutes:', err));
  _unsub.rtdbRoutes = onValue(ref(db, `users/${currentUser.uid}/savedRoutes`), snap => {
    const data = snap.val() || {};
    _rtdbSavedRoutes = Object.entries(data).map(([k, v]) => ({ id: k, _id: k, source: 'rtdb', ...v }));
    recomputeSavedRoutes();
  }, err => console.warn('RTDB savedRoutes:', err));
}
function recomputeRestStops() { allRestStops = [..._fsRestStops, ..._rtdbRestStops]; renderCommunityPoisOnMap(); renderRestStopMarkers(); }
function recomputeCommunityPois() { allCommunityPois = [..._fsCommunityPois, ..._rtdbCommunityPois]; renderCommunityPoisOnMap(); }
function recomputeReports() { allReports = { ..._fsReports, ..._rtdbReports }; renderReportsOnMap(); }
function recomputeAvoidZones() { allAvoidZones = [..._fsAvoidZones, ..._rtdbAvoidZones]; renderAvoidZonesOnMap(); }
function recomputeSavedPlaces() { allSavedPlaces = { ..._fsSavedPlaces, ..._rtdbSavedPlaces }; renderSavedPlacesOnMap(); }
function recomputeHistory() { allHistory = [..._fsHistory, ..._rtdbHistory].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); }
function recomputeSavedRoutes() { allSavedRoutes = [..._fsSavedRoutes, ..._rtdbSavedRoutes].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); }

/* ---------- UI STATE ---------- */
function updateUIState() {
  const isNav = document.body.classList.contains('navigating');
  const isDirOpen = document.getElementById('dirSheet').classList.contains('open');
  const isSearchBoxShow = document.getElementById('suggestionsBox').classList.contains('show');
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
  if (isDirOpen || isSearchBoxShow) {
    fabLocate.style.display = 'none'; fabDir.style.display = 'none';
    fabLayers.style.display = 'none'; fabQuickPin.style.display = 'none';
    fabReport.style.display = 'none'; fabRestStop.style.display = 'none';
  } else if (isNav) {
    fabLocate.style.display = 'none'; fabDir.style.display = 'none';
    fabLayers.style.display = 'none'; fabQuickPin.style.display = 'none';
    fabReport.style.display = 'flex'; fabRestStop.style.display = 'none';
  } else {
    fabLocate.style.display = 'flex'; fabDir.style.display = 'flex';
    fabLayers.style.display = 'flex'; fabQuickPin.style.display = 'flex';
    fabReport.style.display = 'flex'; fabRestStop.style.display = 'flex';
  }
}

/* ---------- MAP INIT ---------- */
function initGpsCircleLayer() {
  if (!map.getSource('gps-circle-source')) {
    map.addSource('gps-circle-source', {
      type: 'geojson',
      data: gpsCircleGeoJSON || { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[]] } }
    });
    map.addLayer({
      id: 'gps-circle-layer',
      type: 'fill',
      source: 'gps-circle-source',
      paint: { 'fill-color': '#10b981', 'fill-opacity': 0.15 }
    });
    map.addLayer({
      id: 'gps-circle-outline',
      type: 'line',
      source: 'gps-circle-source',
      paint: { 'line-color': '#10b981', 'line-width': 1, 'line-opacity': 0.5 }
    });
  }
}

function createCircleGeoJSON(lng, lat, radiusInMeters) {
  const points = 64;
  const km = radiusInMeters / 1000;
  const ret = [];
  const distanceX = km / (111.32 * Math.cos(lat * Math.PI / 180));
  const distanceY = km / 110.574;
  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    ret.push([lng + x, lat + y]);
  }
  ret.push(ret[0]);
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ret] } };
}

function drawCurrentRoute() {
  if (map.getLayer('current-route-layer')) map.removeLayer('current-route-layer');
  if (map.getSource('current-route-source')) map.removeSource('current-route-source');
  if (!currentRouteCoords || currentRouteCoords.length === 0) return;
  
  map.addSource('current-route-source', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: currentRouteCoords.map(c => [c[1], c[0]]) }
    }
  });
  
  map.addLayer({
    id: 'current-route-layer',
    type: 'line',
    source: 'current-route-source',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#3b82f6', 'line-width': 8 }
  });
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
window.resetNorth = function() {
  if (!map) return;
  if (Math.abs(map.getBearing() || 0) < 1 && Math.abs(map.getPitch() || 0) < 1) {
    map.easeTo({ bearing: 0, pitch: 0, duration: 300 });
    return;
  }
  map.easeTo({ bearing: 0, pitch: 0, duration: 600 });
};

function initMap() {
  if (map) return;
  
  map = new maplibregl.Map({
    container: 'map',
    style: MAPTILER_STYLE,
    center: [initialCenter[1], initialCenter[0]], // MapLibre dùng [lng, lat]
    zoom: initialZoom,
    pitch: 0,
    bearing: 0,
    attributionControl: true,
    touchZoomRotate: true,
    dragRotate: true
  });

  // Nút La bàn tự chế: kim xoay theo bearing của bản đồ
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
  });

  // Sự kiện khi bấm chuột phải hoặc nhấn giữ (long press) trên mobile
  map.on('contextmenu', (e) => {
    if (document.getElementById('dirSheet').classList.contains('open')) return;
    if (document.getElementById('suggestionsBox').classList.contains('show')) closeSearch();
    showLocationPopup(e.lngLat);
  });

  map.on('click', () => { 
    closeDirections(); 
    if (document.getElementById('suggestionsBox').classList.contains('show')) closeSearch(); 
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

async function showLocationPopup(lngLat) {
  if (touchMarker) touchMarker.remove();
  
  let name = '';
  try { const raw = await apiReverseGeocode(lngLat.lat, lngLat.lng); if (raw) name = raw.split(',').slice(0, 3).join(', '); } catch (e) {}
  const displayName = name || `Tọa độ: ${lngLat.lat.toFixed(5)}, ${lngLat.lng.toFixed(5)}`;

  const popupHtml = `
    <div style="min-width: 180px;">
      <div style="font-weight: 800; font-size: 0.9rem; margin-bottom: 8px; line-height: 1.3; color: var(--text);">${displayName}</div>
      <button onclick="event.stopPropagation(); openSavePlaceModal(${lngLat.lat}, ${lngLat.lng}, '${escapeHtml(displayName).replace(/'/g, "\\'")}')" style="width: 100%; padding: 10px; background: var(--success); color: white; border: none; border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px;"><i class="fas fa-bookmark"></i> Ghim địa điểm</button>
      <button onclick="event.stopPropagation(); openPoiSheet(${lngLat.lat}, ${lngLat.lng}, '${escapeHtml(displayName).replace(/'/g, "\\'")}')" style="width: 100%; padding: 10px; background: linear-gradient(135deg,#10b981,#059669); color: white; border: none; border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px;"><i class="fas fa-plus-circle"></i> Thêm địa điểm mới</button>
      <button onclick="event.stopPropagation(); goToLongPressLocation(${lngLat.lat}, ${lngLat.lng}, '${escapeHtml(displayName).replace(/'/g, "\\'")}')" style="width: 100%; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px;"><i class="fas fa-location-arrow"></i> Tới chỗ này</button>
      <button onclick="event.stopPropagation(); shareLocation(${lngLat.lat}, ${lngLat.lng}, '${escapeHtml(displayName).replace(/'/g, "\\'")}')" style="width: 100%; padding: 10px; background: var(--card-2); color: var(--text); border: 1px solid var(--border); border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"><i class="fas fa-share-alt"></i> Chia sẻ</button>
    </div>`;

  const popup = new maplibregl.Popup({ offset: 10, maxWidth: '300px' })
    .setLngLat([lngLat.lng, lngLat.lat])
    .setHTML(popupHtml);

  const el = document.createElement('div');
  el.style.width = '24px';
  el.style.height = '24px';
  el.style.borderRadius = '50%';
  el.style.background = '#ef4444';
  el.style.border = '3px solid white';
  el.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';

  touchMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
    .setLngLat([lngLat.lng, lngLat.lat])
    .setPopup(popup)
    .addTo(map);
    
  touchMarker.togglePopup();
}

function showSharedLocationMarker(lat, lng, name, isDestination = false) {
  const el = document.createElement('div');
  el.innerHTML = `<div style="position: relative; width: 24px; height: 24px;"><div style="position: absolute; inset: 0; background: #f97316; border-radius: 50%; opacity: 0.5; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div><div style="position: absolute; inset: 4px; background: #f97316; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(249,115,22,0.8);"></div></div>`;
  const label = isDestination ? '📍 Điểm đến được chia sẻ' : '📍 Vị trí được chia sẻ';
  const popup = new maplibregl.Popup().setHTML(`<b>${label}</b><br><small>${name}</small>`);
  
  new maplibregl.Marker({ element: el, anchor: 'center' })
    .setLngLat([lng, lat])
    .setPopup(popup)
    .addTo(map)
    .togglePopup();
    
  map.flyTo({ center: [lng, lat], zoom: 16 });
}

/* ---------- MARKERS RENDERING ---------- */
function createSavedPlacePin(place) {
  const icons = {
    home: { icon: 'fa-home', color: '#10b981' },
    cafe: { icon: 'fa-coffee', color: '#f59e0b' },
    restaurant: { icon: 'fa-utensils', color: '#ef4444' },
    company: { icon: 'fa-building', color: '#3b82f6' },
    school: { icon: 'fa-school', color: '#8b5cf6' },
    other: { icon: 'fa-map-marker-alt', color: '#64748b' }
  };
  const conf = icons[place.type] || icons.other;
  const wrapper = document.createElement('div');
  wrapper.style.width = '30px';
  wrapper.style.height = '30px';
  wrapper.style.position = 'relative';
  wrapper.innerHTML = `<div class="custom-pin" style="width: 30px; height: 30px; background: ${conf.color}; border-color: ${conf.color};"><i class="fas ${conf.icon}" style="color: white;"></i></div><div class="custom-pin-close" onclick="deleteSavedPlace('${place.source}','${place._id}')" title="Xoá"><i class="fas fa-times"></i></div>`;
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
    const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`<b>${(place.address || '').split(',')[0]}</b>`);
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
  apiReverseGeocode(lastUserPos.lat, lastUserPos.lng)
    .then(raw => {
      tempPinName = raw ? raw.split(',').slice(0, 3).join(', ') : `Vị trí GPS (${lastUserPos.lat.toFixed(4)}, ${lastUserPos.lng.toFixed(4)})`;
      document.getElementById('savePlaceAddress').textContent = tempPinName;
    }).catch(() => { tempPinName = `Vị trí GPS`; document.getElementById('savePlaceAddress').textContent = tempPinName; });
};
window.closeSavePlaceModal = function() { document.getElementById('savePlaceModal').classList.remove('open'); };
window.submitSavePlace = async function(type) {
  if (!currentUser || !tempPinLatLng) return;
  closeSavePlaceModal();
  try {
    await addDoc(collection(fsdb, `users/${currentUser.uid}/savedPlaces`), {
      lat: tempPinLatLng.lat, lng: tempPinLatLng.lng, address: tempPinName, type: type, timestamp: Date.now()
    });
    alert('Đã ghim địa điểm cá nhân lên bản đồ!');
  } catch (e) { alert('Lỗi lưu địa điểm: ' + e.message); }
};
window.deleteSavedPlace = async function(source, id) {
  if (!confirm('Bạn có chắc muốn xoá ghim này?')) return;
  try {
    if (source === 'firestore') await deleteDoc(doc(fsdb, `users/${currentUser.uid}/savedPlaces/${id}`));
    else await remove(ref(db, `users/${currentUser.uid}/savedPlaces/${id}`));
  } catch(e) { alert('Lỗi xoá: ' + e.message); }
};

function renderRestStopMarkers() {
  restStopMarkers.forEach(m => m.remove());
  restStopMarkers = [];
  const z = map ? map.getZoom() : 17;
  if (z < ZOOM_CONFIG.restStop) return;
  
  allRestStops.forEach(poi => {
    const el = document.createElement('div');
    el.style.width = '40px';
    el.style.height = '40px';
    el.innerHTML = `<div class="community-poi-pin rest-stop-pin"><i class="fas fa-bed"></i><div class="verified-badge"><i class="fas fa-check"></i></div></div>`;
    const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`<b>${escapeHtml(poi.name || 'Trạm dừng nghỉ')}</b><br><small>Trạm dừng nghỉ</small>`);
    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([poi.lng, poi.lat]).setPopup(popup).addTo(map);
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
    el.style.width = '32px';
    el.style.height = '32px';
    el.innerHTML = `<div class="community-poi-pin"><i class="fas ${conf.icon}"></i><div class="verified-badge"><i class="fas fa-check"></i></div></div>`;
    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([poi.lng, poi.lat]).addTo(map);
    marker.getElement().addEventListener('click', () => openPoiDetail(poi.source, poi._id));
    communityPoiMarkers.push(marker);
  });
}

function renderReportsOnMap() {
  reportMarkers.forEach(m => m.remove());
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
    const el = document.createElement('div');
    el.style.width = '30px';
    el.style.height = '30px';
    el.innerHTML = icons[rep.type] || icons.pothole;
    let title = rep.type === 'police' ? 'CSGT' : rep.type === 'accident' ? 'Tai nạn' : rep.type === 'traffic' ? 'Kẹt xe' : rep.type === 'flood' ? 'Ngập nước' : rep.type === 'bridge_collapse' ? 'Sập cầu' : rep.type === 'road_collapse' ? 'Sập đường' : 'Ổ gà';
    const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`<b>${title}</b><br><small>Báo cáo bởi cộng đồng</small>`);
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
  
  const features = allAvoidZones.filter(z => z.lat1 && z.lng1 && z.lat2 && z.lng2).map(zone => ({
    type: 'Feature',
    properties: { name: zone.name || 'Tuyến đường cấm' },
    geometry: { type: 'LineString', coordinates: [[zone.lng1, zone.lat1], [zone.lng2, zone.lat2]] }
  }));
  
  if (features.length === 0) return;
  
  map.addSource('avoid-zones', { type: 'geojson', data: { type: 'FeatureCollection', features } });
  map.addLayer({
    id: 'avoid-zones-line',
    type: 'line',
    source: 'avoid-zones',
    paint: { 'line-color': '#ef4444', 'line-width': 8, 'line-opacity': 0.85, 'line-dasharray': [2, 2] }
  });
  
  allAvoidZones.forEach(zone => {
    if (!zone.lat1 || !zone.lng1) return;
    const midLat = (zone.lat1 + zone.lat2) / 2;
    const midLng = (zone.lng1 + zone.lng2) / 2;
    const el = document.createElement('div');
    el.className = 'avoid-zone-pin';
    el.innerHTML = `<i class="fas fa-ban"></i>`;
    const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`<b>🚫 ${escapeHtml(zone.name || 'Tuyến đường cấm')}</b>`);
    const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([midLng, midLat]).setPopup(popup).addTo(map);
    avoidZoneMarkers.push(marker);
  });
}

/* ---------- REPORT ---------- */
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
    await addDoc(collection(fsdb, 'reports'), {
      lat: lastUserPos.lat, lng: lastUserPos.lng, type, timestamp: now, expiresAt: now + ttl, uid: currentUser.uid
    });
    alert('Cảm ơn bạn! Báo cáo đã được gửi.');
  } catch (e) { alert('Lỗi: ' + e.message); }
};

/* ---------- VEHICLE MODE ---------- */
window.setVehicleMode = function(mode, btn) {
  currentVehicleMode = mode;
  document.querySelectorAll('.vehicle-mode-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const truckWarning = document.getElementById('truckWarning');
  if (truckWarning) {
    if (mode === 'truck') truckWarning.classList.remove('hidden');
    else truckWarning.classList.add('hidden');
  }
  if (startPoint && endPoint && document.getElementById('routeOptionsModal').classList.contains('open')) fetchAndShowRouteOptions();
};
window.changeSort = function(mode) { currentSortMode = mode; if (startPoint && endPoint) fetchAndShowRouteOptions(); };

/* ---------- ROUTE ---------- */
window.fetchAndShowRouteOptions = async function() {
  if (!startPoint || !endPoint || !startPoint.lat || !endPoint.lat) {
    return alert('Vui lòng chọn đủ Điểm đi và Điểm đến hợp lệ!');
  }
  const modeLabel = currentVehicleMode === 'driving' ? 'ô tô' : currentVehicleMode === 'driving-traffic' ? 'ô tô (kẹt xe)' : currentVehicleMode === 'truck' ? 'xe tải' : currentVehicleMode === 'hd' ? 'xe công nghệ' : currentVehicleMode === 'walking' ? 'đi bộ' : currentVehicleMode === 'bicycle' ? 'xe đạp' : 'xe máy';
  const bodyEl = document.getElementById('routeOptionsBody');
  bodyEl.innerHTML = `<div style="text-align:center; padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:2rem; color:var(--primary);"></i><p style="margin-top:10px; color:var(--text-muted);">Đang tìm tuyến (${modeLabel})...</p></div>`;
  document.getElementById('routeOptionsModal').classList.add('open');
  try {
    let routes = await apiRoute(startPoint, endPoint, currentVehicleMode);
    routes = routes.filter(r => {
      const coords = r.geometry?.coordinates;
      if (!coords || coords.length < 2) return false;
      return coords.every(c => c[0] >= -90 && c[0] <= 90 && c[1] >= -180 && c[1] <= 180 && !(c[0] === 0 && c[1] === 0));
    });
    if (routes.length === 0) {
      bodyEl.innerHTML = `<div style="text-align:center; padding:40px; color:var(--danger);"><i class="fas fa-exclamation-triangle" style="font-size:2rem; margin-bottom:10px;"></i><p>Không tìm được tuyến đường hợp lệ.</p></div>`;
      return;
    }
    routes.sort((a, b) => currentSortMode === 'shortest' ? a.distance - b.distance : a.duration - b.duration);
    routes = routes.slice(0, 5);
    alternativeRoutesData = routes;

    // Xoá các layer tuyến đường cũ
    routes.forEach((_, i) => {
      if (map.getLayer(`alt-route-layer-${i}`)) map.removeLayer(`alt-route-layer-${i}`);
      if (map.getSource(`alt-route-source-${i}`)) map.removeSource(`alt-route-source-${i}`);
    });
    if (window._routeBadges) window._routeBadges.forEach(m => m.remove()); window._routeBadges = [];
    
    const bounds = new maplibregl.LngLatBounds();
    routes.forEach((r, index) => {
      r.geometry.coordinates.forEach(c => bounds.extend([c[1], c[0]])); // c = [lat, lng]
      
      const isBest = index === 0;
      const color = ROUTE_COLORS[index];
      
      map.addSource(`alt-route-source-${index}`, {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: r.geometry.coordinates.map(c => [c[1], c[0]]) } }
      });
      
      map.addLayer({
        id: `alt-route-layer-${index}`,
        type: 'line',
        source: `alt-route-source-${index}`,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': isBest ? color : '#94a3b8',
          'line-width': isBest ? 9 : 5,
          'line-opacity': isBest ? 1 : 0.6,
          'line-dasharray': isBest ? null : [2, 2]
        }
      });
      
      map.on('click', `alt-route-layer-${index}`, () => selectRouteOption(index));
      map.on('mouseenter', `alt-route-layer-${index}`, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', `alt-route-layer-${index}`, () => { map.getCanvas().style.cursor = ''; });
      
      const midIdx = Math.floor(r.geometry.coordinates.length / 2);
      const el = document.createElement('div');
      el.style.background = isBest ? color : 'white';
      el.style.color = isBest ? 'white' : '#334155';
      el.style.border = `3px solid ${isBest ? 'white' : color}`;
      el.style.borderRadius = '50%';
      el.style.width = '32px'; el.style.height = '32px';
      el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.justifyContent = 'center';
      el.style.fontWeight = '900'; el.style.fontSize = '0.9rem';
      el.style.boxShadow = '0 4px 10px rgba(0,0,0,0.4)';
      el.style.cursor = 'pointer';
      el.innerHTML = index + 1;
      el.onclick = () => selectRouteOption(index);
      
      const midCoord = r.geometry.coordinates[midIdx];
      const badge = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([midCoord[1], midCoord[0]]).addTo(map);
      window._routeBadges.push(badge);
    });
    
    map.fitBounds(bounds, { padding: 50, maxZoom: 17 });
    
    let html = `<div class="sort-bar"><button class="sort-chip ${currentSortMode === 'fastest' ? 'active' : ''}" onclick="changeSort('fastest')"><i class="fas fa-bolt"></i> Nhanh nhất</button><button class="sort-chip ${currentSortMode === 'shortest' ? 'active' : ''}" onclick="changeSort('shortest')"><i class="fas fa-route"></i> Ngắn nhất</button></div>`;
    routes.forEach((r, index) => {
      const dist = (r.distance / 1000).toFixed(1);
      const dur = Math.round(r.duration / 60);
      const isBest = index === 0;
      const color = ROUTE_COLORS[index];
      html += `<div class="route-card ${isBest ? 'active' : ''}" onclick="selectRouteOption(${index})" style="border-left: 4px solid ${color}; cursor: pointer;"><div class="info"><h3 style="display:flex; align-items:center; gap:8px;"><span style="background:${color}; color:white; width:24px; height:24px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:900;">${index + 1}</span>Tuyến ${index + 1} ${isBest ? '(Ưu tiên)' : ''} <span style="font-size:0.6rem; background:var(--bg-2); padding:2px 6px; border-radius:4px; color:var(--text-muted);">${r.provider}</span></h3><p><i class="fas fa-road"></i> ${dist} km • <i class="fas fa-clock"></i> ${dur} phút</p></div>${isBest ? '<span class="badge" style="background:linear-gradient(135deg, #f59e0b, #ef4444); color:white; box-shadow:0 2px 8px rgba(245,158,11,0.5);"><i class="fas fa-star"></i> Đề xuất</span>' : ''}</div>`;
    });
    bodyEl.innerHTML = html;
  } catch (error) {
    console.error('Lỗi lấy tuyến:', error);
    bodyEl.innerHTML = `<div style="text-align:center; padding:40px; color:var(--danger);"><i class="fas fa-exclamation-triangle" style="font-size:2rem; margin-bottom:10px;"></i><p>Có lỗi xảy ra khi tìm tuyến. Vui lòng thử lại.</p><div style="font-size:0.8rem; margin-top:12px; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; text-align:left; word-break:break-all;"><b>Lỗi:</b> ${error.message || ''}</div></div>`;
  }
};

window.selectRouteOption = function(index) {
  const selectedRoute = alternativeRoutesData[index];
  if (!selectedRoute) return;
  if (!selectedRoute.geometry || !selectedRoute.geometry.coordinates || selectedRoute.geometry.coordinates.length === 0) {
    return alert('Lỗi: Tuyến đường này không có dữ liệu tọa độ. Vui lòng chọn phương tiện khác!');
  }
  if (!selectedRoute.legs || !Array.isArray(selectedRoute.legs) || selectedRoute.legs.length === 0) selectedRoute.legs = [{ steps: [] }];
  if (!selectedRoute.legs[0].steps) selectedRoute.legs[0].steps = [];

  const unselectedRoutes = alternativeRoutesData.filter((_, i) => i !== index);
  localStorage.setItem('alternativeRoutes', JSON.stringify(unselectedRoutes));
  
  // Xoá các tuyến phụ
  alternativeRoutesData.forEach((_, i) => {
    if (i !== index) {
      if (map.getLayer(`alt-route-layer-${i}`)) map.removeLayer(`alt-route-layer-${i}`);
      if (map.getSource(`alt-route-source-${i}`)) map.removeSource(`alt-route-source-${i}`);
    }
  });
  if (window._routeBadges) { window._routeBadges.forEach(m => m.remove()); window._routeBadges = []; }

  currentRouteData = selectedRoute; currentRouteCoords = selectedRoute.geometry.coordinates;
  drawCurrentRoute();
  
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
    const dist = currentRouteData.distance || 0;
    const dur = currentRouteData.duration || 0;

    document.getElementById('hudRemainDist').textContent = (dist / 1000).toFixed(1) + ' km';
    document.getElementById('hudRemainTime').textContent = Math.round(dur / 60) + ' phút';
    document.getElementById('hudNextStopName').textContent = endPoint?.name || 'Điểm đến';

    startWatching();
    startVoice();
    saveHistoryToFirestore(startPoint, endPoint, dist);
    if (lastUserPos) updateNextManeuverHUD(lastUserPos.lat, lastUserPos.lng);
  } catch (err) {
    console.error('Lỗi khởi động dẫn đường:', err);
    alert('Lỗi khởi động dẫn đường: ' + err.message + '. Vui lòng thử tìm tuyến khác!');
    document.getElementById('hud').classList.add('hidden');
    document.body.classList.remove('navigating');
    updateUIState();
  }
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
  if (!selectedRoute) return;
  if (!selectedRoute.geometry || !selectedRoute.geometry.coordinates || selectedRoute.geometry.coordinates.length === 0) {
    return alert('Lỗi: Tuyến đường này không có dữ liệu tọa độ!');
  }
  if (!selectedRoute.legs || !Array.isArray(selectedRoute.legs) || selectedRoute.legs.length === 0) selectedRoute.legs = [{ steps: [] }];
  if (!selectedRoute.legs[0].steps) selectedRoute.legs[0].steps = [];
  const otherRoutes = alternativeRoutesData.filter((_, i) => i !== index);
  localStorage.setItem('alternativeRoutes', JSON.stringify(otherRoutes));
  
  currentRouteData = selectedRoute; currentRouteCoords = selectedRoute.geometry.coordinates;
  voiceRouteSteps = selectedRoute.legs[0].steps; voiceStepIndex = 0; lastSnapIndex = 0;
  
  drawCurrentRoute();
  
  const bounds = new maplibregl.LngLatBounds();
  currentRouteCoords.forEach(c => bounds.extend([c[1], c[0]]));
  map.fitBounds(bounds, { padding: 50, maxZoom: 17 });
  
  document.getElementById('hudRemainDist').textContent = (selectedRoute.distance / 1000).toFixed(1) + ' km';
  document.getElementById('hudRemainTime').textContent = Math.round(selectedRoute.duration / 60) + ' phút';
  closeRouteOptions(); speak('Đã đổi tuyến đường mới.');
};

function updateNextManeuverHUD(lat, lng) {
  if (!voiceRouteSteps || voiceRouteSteps.length === 0) return;
  let nextStep = null; let minDist = Infinity;
  for (let i = Math.max(0, voiceStepIndex); i < Math.min(voiceRouteSteps.length, voiceStepIndex + 5); i++) {
    const step = voiceRouteSteps[i];
    if (!step || !step.maneuver || !step.maneuver.location) continue;
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
    document.getElementById('hudNextInstr').textContent = nextStep.maneuver.instruction || 'Tiếp tục di chuyển';
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
  toast.style.cssText = `position: fixed; top: calc(80px + var(--safe-top)); left: 50%; transform: translateX(-50%) translateY(-30px); background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 16px 24px; border-radius: 16px; font-weight: 800; font-size: 1rem; z-index: 9999; box-shadow: 0 10px 40px rgba(16,185,129,0.5); display: flex; align-items: center; gap: 12px; opacity: 0; transition: all 0.3s ease-out; pointer-events: none;`;
  toast.innerHTML = `<i class="fas fa-flag-checkered" style="font-size:1.5rem;"></i><span>Đã đến nơi! 🎉</span>`;
  document.body.appendChild(toast); if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
  requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(-50%) translateY(0)'; });
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(-30px)'; setTimeout(() => toast.remove(), 300); }, 2800);
}

function checkOffRoute(userLat, userLng) {
  if (!currentRouteCoords || currentRouteCoords.length < 2 || isRerouting || arrivalHandled) return;
  let minDist = Infinity; const startScan = Math.max(0, lastSnapIndex - 10); const endScan = Math.min(currentRouteCoords.length - 1, lastSnapIndex + 150);
  for (let i = startScan; i < endScan; i++) {
    const pt = getClosestPointOnSegment({ lat: userLat, lng: userLng }, { lat: currentRouteCoords[i][0], lng: currentRouteCoords[i][1] }, { lat: currentRouteCoords[i+1][0], lng: currentRouteCoords[i+1][1] });
    const d = calcDist(userLat, userLng, pt.lat, pt.lng); if (d < minDist) minDist = d;
  }
  if (minDist > 50) { offRouteCount++; if (offRouteCount >= 3) { offRouteCount = 0; autoReroute(userLat, userLng); } } else offRouteCount = 0;
}

async function autoReroute(userLat, userLng) {
  if (isRerouting) return; isRerouting = true;
  const currentMode = currentRouteData?.mode || 'driving';
  try {
    const altRoutes = await apiRoute({ lat: userLat, lng: userLng }, endPoint, currentMode);
    const r = altRoutes[0];
    if (!r) throw new Error('Không có tuyến thay thế');

    if (!r.legs || !Array.isArray(r.legs) || r.legs.length === 0) r.legs = [{ steps: [] }];
    if (!r.legs[0].steps) r.legs[0].steps = [];

    currentRouteData = r; voiceRouteSteps = r.legs[0].steps; voiceStepIndex = 0; lastSnapIndex = 0; offRouteCount = 0;
    currentRouteCoords = r.geometry.coordinates;
    
    drawCurrentRoute();
    
    const bounds = new maplibregl.LngLatBounds();
    currentRouteCoords.forEach(c => bounds.extend([c[1], c[0]]));
    map.fitBounds(bounds, { padding: 50, maxZoom: 17 });
    
    document.getElementById('hudRemainDist').textContent = (r.distance / 1000).toFixed(1) + ' km';
    document.getElementById('hudRemainTime').textContent = Math.round(r.duration / 60) + ' phút';
  } catch (e) { console.error('Lỗi Reroute:', e); } finally { isRerouting = false; }
}

window.openEndTripModal = function() {
  if (!currentRouteData) {
    alert('Dữ liệu chuyến đi bị lỗi. Hệ thống sẽ đóng chế độ dẫn đường.');
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

  currentRouteCoords = []; currentRouteData = null; alternativeRoutesData = []; voiceRouteSteps = null; voiceStepIndex = 0; lastSnapIndex = 0; offRouteCount = 0; isRerouting = false; tripStartTime = null; arrivalHandled = false; warnedReports.clear(); localStorage.removeItem('alternativeRoutes');
  document.body.classList.remove('navigating');
  document.getElementById('hud').classList.add('hidden');
  updateUIState();
  document.getElementById('dirInputEnd').value = ''; document.getElementById('topSearchInput').value = ''; document.getElementById('btnClearEnd').classList.add('hidden'); document.getElementById('searchClearBtn').classList.add('hidden'); endPoint = null;
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

/* ---------- SHARE ---------- */
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

/* ---------- HISTORY / SAVED ROUTES ---------- */
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
  
  currentRouteCoords = item.coords; lastSnapIndex = 0;
  drawCurrentRoute();
  
  const bounds = new maplibregl.LngLatBounds();
  currentRouteCoords.forEach(c => bounds.extend([c[1], c[0]]));
  map.fitBounds(bounds, { padding: 50, maxZoom: 17 });
  
  closeMenu(); openDirections();
};
window.deleteItem = async function(type, source, id) {
  if (!confirm('Bạn có chắc muốn xoá mục này?')) return;
  try {
    if (source === 'firestore') await deleteDoc(doc(fsdb, `users/${currentUser.uid}/${type}/${id}`));
    else await remove(ref(db, `users/${currentUser.uid}/${type}/${id}`));
  } catch (e) { alert('Lỗi xoá: ' + e.message); }
};
window.clearAllHistory = async function() {
  if (!confirm('Xoá TẤT CẢ lịch sử? (cả 2 nguồn)')) return;
  try {
    const fsSnap = await getDocs(collection(fsdb, `users/${currentUser.uid}/history`));
    for (const d of fsSnap.docs) await deleteDoc(d.ref);
    await remove(ref(db, `users/${currentUser.uid}/history`));
  } catch(e) { console.warn(e); }
};
window.clearAllSavedRoutes = async function() {
  if (!confirm('Xoá TẤT CẢ lộ trình? (cả 2 nguồn)')) return;
  try {
    const fsSnap = await getDocs(collection(fsdb, `users/${currentUser.uid}/savedRoutes`));
    for (const d of fsSnap.docs) await deleteDoc(d.ref);
    await remove(ref(db, `users/${currentUser.uid}/savedRoutes`));
  } catch(e) { console.warn(e); }
};

window.openMenu = function() { document.getElementById('profileModal').classList.add('open'); loadHistory(); loadSavedRoutes(); loadSharedLinksFromStorage(); };
window.closeMenu = function() { document.getElementById('profileModal').classList.remove('open'); };

/* ---------- DIRECTIONS / SEARCH ---------- */
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
    if (map.getLayer('current-route-layer')) map.removeLayer('current-route-layer');
    if (map.getSource('current-route-source')) map.removeSource('current-route-source');
    alternativeRoutesData.forEach((_, i) => {
      if (map.getLayer(`alt-route-layer-${i}`)) map.removeLayer(`alt-route-layer-${i}`);
      if (map.getSource(`alt-route-source-${i}`)) map.removeSource(`alt-route-source-${i}`);
    });
    if (window._routeBadges) { window._routeBadges.forEach(m => m.remove()); window._routeBadges = []; }
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
  if (touchMarker) touchMarker.remove();
  closeSearch();
};

async function doSearch(query) {
  const box = document.getElementById('suggestionsBox');
  if (query.startsWith('http://') || query.startsWith('https://')) {
    if (query.includes('google.com/maps') || query.includes('goo.gl/maps')) {
      const coords = parseGmapsUrl(query);
      if (coords) {
        box.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'sug-item';
        div.innerHTML = `<i class="fas fa-map-marker-alt"></i><div>${coords.name || 'Vị trí từ Google Maps'}</div>`;
        div.onclick = () => selectLocation(coords.lat, coords.lng, coords.name || 'Vị trí từ Google Maps');
        box.appendChild(div);
      } else {
        box.innerHTML = '<div class="sug-item" style="color:var(--danger);line-height:1.4;">Không đọc được toạ độ từ link rút gọn (goo.gl).<br>Mở link → copy toạ độ dạng <b>lat,lng</b> và dán vào đây!</div>';
      }
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
    const results = await apiSearch(query);
    loadingDiv.remove();
    
    // Tính toán số lượng kết quả còn lại được phép hiển thị (tối đa 20)
    const currentCount = restStopMatches.length + poiMatches.length;
    const remainingSlots = Math.max(0, 20 - currentCount);
    const displayResults = results.slice(0, remainingSlots);

    if (displayResults.length > 0) {
      const title2 = document.createElement('div');
      title2.className = 'sug-section-title';
      title2.innerHTML = '<i class="fas fa-map-marked-alt"></i> Địa điểm khác';
      box.appendChild(title2);
      
      displayResults.forEach(r => {
        const div = document.createElement('div');
        div.className = 'sug-item';
        div.innerHTML = `<i class="fas fa-map-marker-alt"></i><div>${escapeHtml(r.name)}</div>`;
        div.onclick = () => selectLocation(r.lat, r.lng, r.name);
        box.appendChild(div);
      });
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
  document.getElementById('topSearchInput').value = name;
  document.getElementById('topSearchInput').readOnly = true;
  document.getElementById('searchClearBtn').classList.remove('hidden');
  closeSearch();
  map.flyTo({ center: [lng, lat], zoom: 16 });
  
  if (touchMarker) touchMarker.remove();
  
  let finalName = name;
  try { const raw = await apiReverseGeocode(lat, lng); if (raw) finalName = raw.split(',').slice(0, 3).join(', '); } catch (e) {}
  
  const popupHtml = `
    <div style="min-width: 180px;">
      <div style="font-weight: 800; font-size: 0.9rem; margin-bottom: 8px; line-height: 1.3; color: var(--text);">${finalName}</div>
      <button onclick="event.stopPropagation(); openSavePlaceModal(${lat}, ${lng}, '${escapeHtml(finalName).replace(/'/g, "\\'")}')" style="width: 100%; padding: 10px; background: var(--success); color: white; border: none; border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px;"><i class="fas fa-bookmark"></i> Ghim địa điểm</button>
      <button onclick="event.stopPropagation(); openPoiSheet(${lat}, ${lng}, '${escapeHtml(finalName).replace(/'/g, "\\'")}')" style="width: 100%; padding: 10px; background: linear-gradient(135deg,#10b981,#059669); color: white; border: none; border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px;"><i class="fas fa-plus-circle"></i> Thêm địa điểm mới</button>
      <button onclick="event.stopPropagation(); goToLongPressLocation(${lat}, ${lng}, '${escapeHtml(finalName).replace(/'/g, "\\'")}')" style="width: 100%; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 6px;"><i class="fas fa-location-arrow"></i> Tới chỗ này</button>
      <button onclick="event.stopPropagation(); shareLocation(${lat}, ${lng}, '${escapeHtml(finalName).replace(/'/g, "\\'")}')" style="width: 100%; padding: 10px; background: var(--card-2); color: var(--text); border: 1px solid var(--border); border-radius: 8px; font-weight: 800; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"><i class="fas fa-share-alt"></i> Chia sẻ</button>
    </div>`;

  const popup = new maplibregl.Popup({ offset: 10, maxWidth: '300px' })
    .setLngLat([lng, lat])
    .setHTML(popupHtml);

  const el = document.createElement('div');
  el.style.width = '24px';
  el.style.height = '24px';
  el.style.borderRadius = '50%';
  el.style.background = '#ef4444';
  el.style.border = '3px solid white';
  el.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';

  touchMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
    .setLngLat([lng, lat])
    .setPopup(popup)
    .addTo(map);
    
  touchMarker.togglePopup();

  if (searchContext === 'view') {}
  else if (searchContext === 'start') { startPoint = { lat, lng, name: finalName }; document.getElementById('dirInputStart').value = finalName; document.getElementById('btnClearStart').classList.remove('hidden'); }
  else if (searchContext === 'end') { endPoint = { lat, lng, name: finalName }; document.getElementById('dirInputEnd').value = finalName; document.getElementById('topSearchInput').value = finalName; document.getElementById('btnClearEnd').classList.remove('hidden'); }
}

function refreshGPS() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(pos => {
    startPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, name: 'Vị trí của tôi' }; document.getElementById('dirInputStart').value = 'Vị trí của tôi (GPS)'; document.getElementById('btnClearStart').classList.remove('hidden');
    lastUserPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }; 
    map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 16 }); 
    updateUserMarkerOnMap(lastUserPos, lastHeading);
  }, (err) => { console.warn(err); });
}

/* ---------- GEO HELPERS ---------- */
function getClosestPointOnSegment(p, a, b) {
  const atob = { x: b.lng - a.lng, y: b.lat - a.lat }; const atop = { x: p.lng - a.lng, y: p.lat - a.lat };
  const len = atob.x * atob.x + atob.y * atob.y; const dot = atop.x * atob.x + atop.y * atob.y;
  const t = Math.min(1, Math.max(0, dot / len)); return { lat: a.lat + atob.y * t, lng: a.lng + atob.x * t };
}

function updateUserMarkerOnMap(pos, heading) {
  const lngLat = [pos.lng, pos.lat];
  if (!userMarker) {
    const el = document.createElement('div');
    el.style.width = '32px';
    el.style.height = '32px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.innerHTML = `<svg class="user-marker-inner" style="transform: rotate(${heading || 0}deg); width: 24px; height: 24px;" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L22 20L12 16L2 20L12 2Z" fill="#10b981" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>`;
    
    userMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat(lngLat)
      .addTo(map);
  } else {
    userMarker.setLngLat(lngLat);
    const inner = userMarker.getElement().querySelector('.user-marker-inner');
    if (inner) inner.style.transform = `rotate(${heading || 0}deg)`;
  }
  
  gpsCircleGeoJSON = createCircleGeoJSON(pos.lng, pos.lat, pos.accuracy || 10);
  if (map.getSource('gps-circle-source')) {
    map.getSource('gps-circle-source').setData(gpsCircleGeoJSON);
  }
}

function animateMarkerTo(targetPos) {
  if (!userMarker) { updateUserMarkerOnMap(targetPos, targetPos.heading); return; }
  let snappedLat = targetPos.lat, snappedLng = targetPos.lng, targetHeading = targetPos.heading;
  if (currentRouteCoords && currentRouteCoords.length > 1 && lastSnapIndex < currentRouteCoords.length - 1) {
    let minDist = Infinity, bestPoint = null, bestSegmentIndex = lastSnapIndex;
    const startScan = Math.max(0, lastSnapIndex - 5); const endScan = Math.min(currentRouteCoords.length - 1, lastSnapIndex + 50);
    for (let i = startScan; i < endScan; i++) {
      const pt = getClosestPointOnSegment({ lat: targetPos.lat, lng: targetPos.lng }, { lat: currentRouteCoords[i][0], lng: currentRouteCoords[i][1] }, { lat: currentRouteCoords[i+1][0], lng: currentRouteCoords[i+1][1] });
      const d = calcDist(targetPos.lat, targetPos.lng, pt.lat, pt.lng); if (d < minDist) { minDist = d; bestPoint = pt; bestSegmentIndex = i; if (i > lastSnapIndex) lastSnapIndex = i; }
    }
    if (bestPoint && minDist < 40) {
      const p1 = currentRouteCoords[bestSegmentIndex]; const p2 = currentRouteCoords[bestSegmentIndex + 1];
      const angle = Math.atan2(p2[0] - p1[0], p2[1] - p1[1]);
      snappedLat = bestPoint.lat + Math.cos(angle) * 0.00003; snappedLng = bestPoint.lng - Math.sin(angle) * 0.00003; targetHeading = (angle * 180 / Math.PI) + 90;
    }
  }
  
  if (currentRouteCoords && currentRouteCoords.length > 0 && lastSnapIndex > 0) {
    const remaining = currentRouteCoords.slice(lastSnapIndex);
    if (remaining.length > 1) {
      currentRouteCoords = remaining;
      drawCurrentRoute();
    } else {
      if (map.getLayer('current-route-layer')) map.removeLayer('current-route-layer');
      if (map.getSource('current-route-source')) map.removeSource('current-route-source');
      currentRouteCoords = [];
    }
  }
  
  const startLat = userMarker.getLngLat().lat;
  const startLng = userMarker.getLngLat().lng;
  const startTime = performance.now(), duration = 1000;
  
  function step(time) {
    const progress = Math.min((time - startTime) / duration, 1); const ease = 1 - Math.pow(1 - progress, 3);
    const currentLat = startLat + (snappedLat - startLat) * ease;
    const currentLng = startLng + (snappedLng - startLng) * ease;
    
    userMarker.setLngLat([currentLng, currentLat]);
    const inner = userMarker.getElement().querySelector('.user-marker-inner');
    if (inner) inner.style.transform = `rotate(${targetHeading || 0}deg)`;
    
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
  
  gpsCircleGeoJSON = createCircleGeoJSON(snappedLng, snappedLat, targetPos.accuracy || 10);
  if (map.getSource('gps-circle-source')) {
    map.getSource('gps-circle-source').setData(gpsCircleGeoJSON);
  }
}

function startWatching() {
  if (watchId) navigator.geolocation.clearWatch(watchId);
  let lastPosForSpeed = null;
  let lastTimeForSpeed = null;
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
    animateMarkerTo(lastUserPos);
    if (map) map.easeTo({ center: [lastUserPos.lng, lastUserPos.lat], duration: 500 });
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
      if (rep.type === 'police') msg = 'CSGT';
      else if (rep.type === 'accident') msg = 'tai nạn';
      else if (rep.type === 'traffic') msg = 'kẹt xe';
      else if (rep.type === 'flood') msg = 'ngập nước';
      else if (rep.type === 'pothole') msg = 'ổ gà';
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
      const step = voiceRouteSteps[i]; if (!step || !step.maneuver || !step.maneuver.location) continue;
      const d = calcDist(lastUserPos.lat, lastUserPos.lng, step.maneuver.location[1], step.maneuver.location[0]);
      if (d < 50) { speak(step.maneuver.instruction); voiceStepIndex = i + 1; break; }
    }
  }, 3000);
}

function calcDist(lat1, lng1, lat2, lng2) {
  const R = 6371e3; const p1 = lat1 * Math.PI/180, p2 = lat2 * Math.PI/180; const dp = (lat2-lat1) * Math.PI/180, dl = (lng2-lng1) * Math.PI/180;
  const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ---------- LAYER ---------- */
window.toggleLayerMenu = function() {
  const menu = document.getElementById('layerMenu');
  const isShowing = menu.classList.contains('show');
  if (isShowing) menu.classList.remove('show');
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
  document.querySelectorAll('.layer-option').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('layerMenu').classList.remove('show');

  let styleUrl = MAPTILER_STYLE;
  if (type === 'trackasia-maplibre' || type === 'trackasia') {
    styleUrl = `https://maps.track-asia.com/styles/v2/streets.json?key=${TRACKASIA_KEY}`;
  } else if (type === 'satellite') {
    styleUrl = `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`;
  }
  
  map.setStyle(styleUrl);
  
  map.once('styledata', () => {
    setTimeout(() => {
      initGpsCircleLayer();
      if (currentRouteCoords.length > 0) drawCurrentRoute();
    }, 100);
  });
}

window.goToLongPressLocation = function(lat, lng, name) {
  endPoint = { lat, lng, name };
  document.getElementById('dirInputEnd').value = name; document.getElementById('topSearchInput').value = name;
  document.getElementById('btnClearEnd').classList.remove('hidden'); document.getElementById('searchClearBtn').classList.remove('hidden');
  if (touchMarker) touchMarker.remove();
  openDirections(); if (!startPoint) refreshGPS();
};

function escapeHtml(text) { return String(text || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function centerToLocation() { if (lastUserPos) map.flyTo({ center: [lastUserPos.lng, lastUserPos.lat], zoom: 18 }); else refreshGPS(); }

/* ---------- POI ---------- */
window.openPoiSheet = function(lat, lng, addressHint) {
  if (!currentUser) { alert('Vui lòng đăng nhập để thêm địa điểm!'); return; }
  tempPoiLatLng = { lat, lng }; tempPoiTag = null;
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
  const btn = document.getElementById('poiSaveBtn');
  btn.disabled = !(tempPoiTag && name.length >= 2);
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
    const collectionName = tempPoiTag === 'rest_stop' ? 'rest_stops' : 'community_pois';
    await addDoc(collection(fsdb, collectionName), {
      lat: tempPoiLatLng.lat, lng: tempPoiLatLng.lng, name: name, tag: tempPoiTag,
      uid: currentUser.uid, authorName: currentUser.displayName || currentUser.email.split('@')[0],
      timestamp: Date.now(), upvotes: 0
    });
    closePoiSheet();
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:calc(80px + var(--safe-top));left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#10b981,#059669);color:white;padding:14px 22px;border-radius:14px;font-weight:800;z-index:9999;box-shadow:0 10px 30px rgba(16,185,129,0.5);display:flex;gap:10px;align-items:center;';
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
  t.style.cssText = 'position:fixed;top:calc(80px + var(--safe-top));left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#10b981,#059669);color:white;padding:12px 20px;border-radius:14px;font-weight:800;z-index:9999;box-shadow:0 10px 30px rgba(16,185,129,0.5);display:flex;gap:10px;align-items:center;font-size:0.85rem;';
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
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;top:calc(80px + var(--safe-top));left:50%;transform:translateX(-50%);background:${restStopFilterActive ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)' : 'linear-gradient(135deg,#64748b,#475569)'};color:white;padding:12px 20px;border-radius:14px;font-weight:800;z-index:9999;box-shadow:0 10px 30px rgba(59,130,246,0.5);display:flex;gap:10px;align-items:center;font-size:0.85rem;`;
  t.innerHTML = restStopFilterActive
    ? `<i class="fas fa-bed"></i><span>Đang hiện ${restStopMarkers.length} trạm dừng nghỉ</span>`
    : `<i class="fas fa-eye"></i><span>Đã hiện tất cả địa điểm</span>`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, 2000);
};

/* ---------- LIVE ---------- */
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
  if (currentUser && liveRoomCode) {
    await remove(ref(db, `live_rooms/${liveRoomCode}/members/${currentUser.uid}`)).catch(()=>{});
    await remove(ref(db, `public_users/${currentUser.uid}`)).catch(()=>{});
  }
  Object.values(liveMemberAnimStates).forEach(a => { if (a.animId) cancelAnimationFrame(a.animId); });
  Object.values(liveMemberMarkers).forEach(m => m.remove());
  liveMemberMarkers = {}; liveMemberAnimStates = {};
  if (liveMyAnimState?.animId) cancelAnimationFrame(liveMyAnimState.animId);
  if (liveMyMarker) { liveMyMarker.remove(); liveMyMarker = null; }
  liveMyAnimState = null;
  liveRoomCode = null; liveIsPublic = false; liveRoomMembers = []; livePublicUsers = [];
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
window.createLiveRoom = async function(silent) {
  if (!currentUser) return;
  const code = generateLiveRoomCode();
  liveRoomCode = code; liveIsPublic = false;
  try {
    await set(ref(db, `live_rooms/${code}`), { hostUid: currentUser.uid, hostName: currentUser.displayName || currentUser.email.split('@')[0], isPublic: false, createdAt: Date.now() });
    const memberRef = ref(db, `live_rooms/${code}/members/${currentUser.uid}`);
    onDisconnect(memberRef).remove();
    const publicRef = ref(db, `public_users/${currentUser.uid}`);
    onDisconnect(publicRef).remove();
    if (lastUserPos) await pushLivePositionToRTDB();
    subscribeLiveRoom();
    updateLiveUI();
    if (liveHeartbeatInterval) clearInterval(liveHeartbeatInterval);
    liveHeartbeatInterval = setInterval(() => { if (liveRoomCode && currentUser) pushLivePositionToRTDB(); }, 15000);
    if (!silent) alert('Đã tạo phòng: ' + code);
  } catch (e) { alert('Lỗi tạo phòng: ' + e.message); }
};
window.joinLiveRoom = async function() {
  if (!currentUser) return alert('Vui lòng đăng nhập!');
  const code = document.getElementById('liveJoinCodeInput').value.trim().toUpperCase();
  if (code.length !== 6) return alert('Mã phòng phải 6 ký tự!');
  try {
    const snap = await get(ref(db, `live_rooms/${code}`));
    if (!snap.exists()) return alert('Không tìm thấy phòng: ' + code);
    liveRoomCode = code; liveIsPublic = false;
    const memberRef = ref(db, `live_rooms/${code}/members/${currentUser.uid}`);
    onDisconnect(memberRef).remove();
    const publicRef = ref(db, `public_users/${currentUser.uid}`);
    onDisconnect(publicRef).remove();
    document.getElementById('liveJoinCodeInput').value = '';
    if (lastUserPos) await pushLivePositionToRTDB();
    subscribeLiveRoom();
    updateLiveUI();
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
  const data = { lat: lastUserPos.lat, lng: lastUserPos.lng, name: currentUser.displayName || currentUser.email.split('@')[0], isPublic: liveIsPublic, lastPing: ts };
  set(ref(db, `live_rooms/${liveRoomCode}/members/${currentUser.uid}`), data).catch(()=>{});
  if (liveIsPublic) set(ref(db, `public_users/${currentUser.uid}`), { ...data, roomCode: liveRoomCode }).catch(()=>{});
}
function subscribeLiveRoom() {
  if (!liveRoomCode) return;
  if (liveRoomUnsub) liveRoomUnsub();
  liveRoomUnsub = onValue(ref(db, `live_rooms/${liveRoomCode}/members`), (snap) => {
    const data = snap.val() || {};
    const now = Date.now();
    liveRoomMembers = Object.entries(data).map(([uid, m]) => ({ uid, ...m })).filter(m => !m.lastPing || (now - m.lastPing) < LIVE_HEARTBEAT_TIMEOUT);
    renderLiveMembers(); renderLiveMemberMarkers();
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
    countEl.textContent = '0';
    return;
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
  const el = document.createElement('div');
  el.className = 'live-me-pin';
  el.innerHTML = '<i class="fas fa-location-arrow"></i>';
  
  if (liveMyMarker) liveMyMarker.setLngLat([lastUserPos.lng, lastUserPos.lat]);
  else {
    liveMyMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lastUserPos.lng, lastUserPos.lat])
      .setPopup(new maplibregl.Popup({ offset: 15 }).setHTML('Vị trí của bạn (Live)'))
      .addTo(map);
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
        const cur = existing.getLngLat();
        if (liveHaversine(cur.lat, cur.lng, m.lat, m.lng) * 1000 > 1) animateLiveTo(a, m.lat, m.lng);
      }
      existing.setPopup(new maplibregl.Popup({ offset: 15 }).setHTML(`<b>${escapeHtml(m.name)}</b><br>${m.distance ? m.distance.toFixed(1)+' km' : ''}`));
    } else {
      const isPub = m.isPublic || m.source === 'public';
      const el = document.createElement('div');
      el.className = `live-other-pin ${isPub ? 'public' : ''}`;
      el.innerHTML = `<i class="fas fa-user"></i>`;
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([m.lng, m.lat]).setPopup(new maplibregl.Popup({ offset: 15 }).setHTML(`<b>${escapeHtml(m.name)}</b><br>${m.distance ? m.distance.toFixed(1)+' km' : ''}`)).addTo(map);
      liveMemberMarkers[m.uid] = marker;
      liveMemberAnimStates[m.uid] = { from: { lat: m.lat, lng: m.lng }, to: { lat: m.lat, lng: m.lng }, startTime: performance.now(), duration: LIVE_ANIM_DURATION, marker: marker, animId: null };
    }
  });
  Object.keys(liveMemberMarkers).forEach(uid => {
    if (!seen.has(uid)) {
      if (liveMemberAnimStates[uid]?.animId) cancelAnimationFrame(liveMemberAnimStates[uid].animId);
      liveMemberMarkers[uid].remove();
      delete liveMemberMarkers[uid]; delete liveMemberAnimStates[uid];
    }
  });
}
async function initViewerLiveRoom(roomCode) {
  isViewingLiveTrack = true;
  map.flyTo({ center: [initialCenter[1], initialCenter[0]], zoom: 15 });
  const hud = document.createElement('div');
  hud.id = 'liveHud';
  hud.style.cssText = 'position:fixed;top:calc(16px + var(--safe-top));left:50%;transform:translateX(-50%);background:var(--card);border:1px solid #10b981;border-radius:20px;padding:8px 16px;z-index:1000;font-weight:800;font-size:0.85rem;color:#10b981;display:flex;gap:8px;align-items:center;box-shadow:0 4px 15px rgba(16,185,129,0.3);';
  hud.innerHTML = `<i class="fas fa-satellite-dish fa-spin"></i> Phòng: ${roomCode}`;
  document.body.appendChild(hud);
  const membersRef = ref(db, `live_rooms/${roomCode}/members`);
  onValue(membersRef, (snap) => {
    const data = snap.val() || {};
    const now = Date.now();
    const members = Object.entries(data).map(([uid, m]) => ({ uid, ...m })).filter(m => !m.lastPing || (now - m.lastPing) < LIVE_HEARTBEAT_TIMEOUT);
    if (members.length === 0) { handleViewerDisconnect(roomCode, false); return; }
    members.forEach(m => {
      const existing = liveMemberMarkers[m.uid];
      if (existing) {
        const a = liveMemberAnimStates[m.uid];
        if (a) animateLiveTo(a, m.lat, m.lng);
      } else {
        const el = document.createElement('div');
        el.className = 'live-me-pin';
        el.innerHTML = '<i class="fas fa-user"></i>';
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([m.lng, m.lat]).setPopup(new maplibregl.Popup({ offset: 15 }).setHTML(`<b>${escapeHtml(m.name)}</b>`)).addTo(map);
        liveMemberMarkers[m.uid] = marker;
        liveMemberAnimStates[m.uid] = { from: { lat: m.lat, lng: m.lng }, to: { lat: m.lat, lng: m.lng }, startTime: performance.now(), duration: LIVE_ANIM_DURATION, marker: marker, animId: null };
        map.flyTo({ center: [m.lng, m.lat], zoom: 16 });
        marker.togglePopup();
      }
    });
    Object.keys(liveMemberMarkers).forEach(uid => {
      if (!members.some(m => m.uid === uid)) {
        if (liveMemberAnimStates[uid]?.animId) cancelAnimationFrame(liveMemberAnimStates[uid].animId);
        liveMemberMarkers[uid].remove();
        delete liveMemberMarkers[uid]; delete liveMemberAnimStates[uid];
      }
    });
  });
}
function handleViewerDisconnect(roomCode, isTimeout) {
  if (!isViewingLiveTrack) return;
  isViewingLiveTrack = false;
  Object.keys(liveMemberMarkers).forEach(uid => {
    if (liveMemberAnimStates[uid]?.animId) cancelAnimationFrame(liveMemberAnimStates[uid].animId);
    try { liveMemberMarkers[uid].remove(); } catch(e){}
  });
  liveMemberMarkers = {}; liveMemberAnimStates = {};
  const hud = document.getElementById('liveHud');
  if (hud) {
    hud.style.borderColor = 'var(--danger)'; hud.style.color = 'var(--danger)';
    hud.innerHTML = isTimeout ? `<i class="fas fa-exclamation-triangle"></i> Mất kết nối` : `<i class="fas fa-times-circle"></i> Phòng đã đóng`;
    setTimeout(() => hud.remove(), 5000);
  }
}

/* ---------- KEYBOARD & EXPORTS ---------- */
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'Esc') closeDirections(); });

window.openDirections = openDirections;
window.activateSearch = activateSearch;
window.refreshGPS = refreshGPS;
window.centerToLocation = centerToLocation;
window.logout = logout;
window.toggleLayerMenu = toggleLayerMenu;
window.changeLayer = changeLayer;
window.shareRoute = shareRoute;
window.shareLocation = shareLocation;
window.submitReport = submitReport;
window.openReportMenu = openReportMenu;
window.closeReportMenu = closeReportMenu;
window.closeDirections = closeDirections;
