/* DriveKit POI Category Library — tách từ bản v3 (app.js, POI_CATEGORY_CODES).
 * Chỉ dữ liệu + hàm tra cứu thuần túy, không DOM, không Firebase, không fetch, không API key.
 * Mỗi key DriveKit map sang mã Overture / TomTom / HERE. Trường null = CHƯA XÁC MINH, không đoán.
 * Nguồn: Overture Maps API, TomTom POI Categories / StandardCategoryID, HERE Places category system.
 * File này hiện là bản tách sẵn, CHƯA nối vào app.js v4 (app.js v4 vẫn giữ bảng inline để tránh xung đột khi đang sửa).
 */
export const POI_CATEGORY_LIBRARY_VERSION = '1.0.0-v3';
export const POI_CATEGORY_SOURCES = [
  'https://www.overturemapsapi.com/docs/guides/profile-a-neighbourhood',
  'https://docs.tomtom.com/maps-sdk-js/api-reference/functions/services.getPOICategoryCodes.html',
  'https://developer.tomtom.com/assets/downloads/tomtom-sdks/ios/api-reference/0.31.0/TomTomSDKSearch/Enums/StandardCategoryID.html',
  'https://docs.here.com/geocoding-and-search/docs/places-category-system-full',
];

export const POI_CATEGORY_CODES = {
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

// Tra xuôi: key DriveKit -> { overture, tomtom, tomtomId, here }. Key lạ -> null, không throw.
export function getPoiCategoryIds(key) {
  try {
    if (!key || typeof key !== 'string') return null;
    const entry = POI_CATEGORY_CODES[key];
    if (!entry) return null;
    return { overture: entry.overture != null ? entry.overture : null, tomtom: entry.tomtom != null ? entry.tomtom : null, tomtomId: entry.tomtomId != null ? entry.tomtomId : null, here: entry.here != null ? entry.here : null };
  } catch (e) { return null; }
}

// Key chính (bỏ alias trùng object) để tra ngược trả về 1 key duy nhất.
const _canonicalKeys = (() => {
  const seen = new Set(); const out = [];
  for (const k of Object.keys(POI_CATEGORY_CODES)) {
    const e = POI_CATEGORY_CODES[k];
    if (!seen.has(e)) { seen.add(e); out.push(k); }
  }
  return out;
})();

export function listPoiKeys() { return [..._canonicalKeys]; }
export function isKnownPoiKey(key) { return typeof key === 'string' && key in POI_CATEGORY_CODES; }
export function normalizePoiKey(key) {
  if (!isKnownPoiKey(key)) return null;
  const entry = POI_CATEGORY_CODES[key];
  return _canonicalKeys.find(k => POI_CATEGORY_CODES[k] === entry) || key;
}

// Tra ngược: mã của 1 bên -> key DriveKit chính, không có -> null.
export function getPoiKeyByOverture(code) {
  if (!code || typeof code !== 'string') return null;
  return _canonicalKeys.find(k => POI_CATEGORY_CODES[k].overture === code) || null;
}
export function getPoiKeyByTomtom(codeOrId) {
  if (codeOrId == null) return null;
  return _canonicalKeys.find(k => POI_CATEGORY_CODES[k].tomtom === codeOrId || POI_CATEGORY_CODES[k].tomtomId === codeOrId) || null;
}
export function getPoiKeyByHere(code) {
  if (!code || typeof code !== 'string') return null;
  return _canonicalKeys.find(k => POI_CATEGORY_CODES[k].here === code) || null;
}

if (typeof window !== 'undefined') {
  window.POI_CATEGORY_CODES = POI_CATEGORY_CODES;
  window.getPoiCategoryIds = getPoiCategoryIds;
}
