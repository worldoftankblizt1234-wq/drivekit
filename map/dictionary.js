/* ============================================================
   dictionary.js — DriveKit: toàn bộ bản dịch Valhalla -> tiếng Việt
   Load TRƯỚC app.js:
     <script src="dictionary.js"></script>
     <script src="app.js"></script>
   app.js sẽ tự dùng DRIVEKIT_DICT.translate thay vì bản dịch cứng.
   Nếu dictionary.js chưa load, app.js vẫn có fallback tối thiểu.
   ============================================================ */
(function(){
  'use strict';

  // --- 1. Cụm dài: phải dịch TRƯỚC khi thay 'on' -> 'trên' ---
  // Thứ tự quan trọng: câu dài / cụ thể trước, câu ngắn / chung sau.
  var NAV_PHRASES = [
    // --- Điểm đến (phải trước 'on' -> 'trên') ---
    { re: /Your destination is on the right side/gi, vi: 'Điểm đến của bạn ở bên phải' },
    { re: /Your destination is on the left side/gi, vi: 'Điểm đến của bạn ở bên trái' },
    { re: /Your destination is on the right/gi, vi: 'Điểm đến của bạn ở bên phải' },
    { re: /Your destination is on the left/gi, vi: 'Điểm đến của bạn ở bên trái' },
    { re: /Your destination is ahead/gi, vi: 'Điểm đến của bạn ở phía trước' },
    { re: /Destination is on the right/gi, vi: 'Điểm đến ở bên phải' },
    { re: /Destination is on the left/gi, vi: 'Điểm đến ở bên trái' },
    { re: /Destination is ahead/gi, vi: 'Điểm đến ở phía trước' },
    { re: /You will arrive at your destination/gi, vi: 'Bạn sẽ đến điểm đến' },
    { re: /You have arrived at your destination/gi, vi: 'Bạn đã đến nơi' },
    { re: /You have arrived/gi, vi: 'Bạn đã đến nơi' },
    { re: /Arrive at your destination/gi, vi: 'Đến nơi' },
    { re: /Arrive at/gi, vi: 'Đến' },

    // --- Khoảng cách còn lại: "In 100 meters, turn left..." ---
    { re: /In (\d+) kilometers?,/gi, vi: 'Còn $1 km,' },
    { re: /In (\d+) meters?,/gi, vi: 'Còn $1 mét,' },
    { re: /In (\d+) feet,/gi, vi: 'Còn $1 feet,' },
    { re: /In (\d+) miles?,/gi, vi: 'Còn $1 dặm,' },

    // --- Vòng xuyến ---
    { re: /At the roundabout, take the (\d+)(st|nd|rd|th)? exit/gi, vi: 'Tại vòng xuyến, đi lối ra thứ $1' },
    { re: /At the roundabout, take the (\d+)/gi, vi: 'Tại vòng xuyến, đi lối ra thứ $1' },
    { re: /Exit the roundabout/gi, vi: 'Ra khỏi vòng xuyến' },
    { re: /Take the roundabout/gi, vi: 'Vào vòng xuyến' },

    // --- Hướng đầu ---
    { re: /Head northeast/gi, vi: 'Đi về hướng đông bắc' },
    { re: /Head northwest/gi, vi: 'Đi về hướng tây bắc' },
    { re: /Head southeast/gi, vi: 'Đi về hướng đông nam' },
    { re: /Head southwest/gi, vi: 'Đi về hướng tây nam' },
    { re: /Head north/gi, vi: 'Đi về hướng bắc' },
    { re: /Head south/gi, vi: 'Đi về hướng nam' },
    { re: /Head east/gi, vi: 'Đi về hướng đông' },
    { re: /Head west/gi, vi: 'Đi về hướng tây' },

    // --- Rẽ / quay đầu ---
    { re: /Make a U-turn/gi, vi: 'Quay đầu' },
    { re: /Turn sharp left/gi, vi: 'Rẽ ngoặt sang trái' },
    { re: /Turn sharp right/gi, vi: 'Rẽ ngoặt sang phải' },
    { re: /Turn slight left/gi, vi: 'Chếch sang trái' },
    { re: /Turn slight right/gi, vi: 'Chếch sang phải' },
    { re: /Bear left/gi, vi: 'Chếch sang trái' },
    { re: /Bear right/gi, vi: 'Chếch sang phải' },
    { re: /Turn left/gi, vi: 'Rẽ trái' },
    { re: /Turn right/gi, vi: 'Rẽ phải' },
    { re: /Go straight/gi, vi: 'Đi thẳng' },
    { re: /Stay in the left lane/gi, vi: 'Giữ làn trái' },
    { re: /Stay in the right lane/gi, vi: 'Giữ làn phải' },
    { re: /Stay on/gi, vi: 'Tiếp tục đi' },
    { re: /Keep left/gi, vi: 'Bám bên trái' },
    { re: /Keep right/gi, vi: 'Bám bên phải' },

    // --- Lên / xuống / nhập làn ---
    { re: /Take the ramp/gi, vi: 'Lên đường dẫn' },
    { re: /Take the exit/gi, vi: 'Đi lối ra' },
    { re: /Take exit/gi, vi: 'Đi lối ra' },
    { re: /Take the ferry/gi, vi: 'Lên phà' },
    { re: /Merge/gi, vi: 'Nhập làn' },
    { re: /Continue for/gi, vi: 'Tiếp tục đi' },
    { re: /Continue/gi, vi: 'Tiếp tục' },
    { re: /Proceed/gi, vi: 'Tiếp tục' },

    // --- Bắt đầu ---
    { re: /Start/gi, vi: 'Bắt đầu' },
    { re: /Depart/gi, vi: 'Khởi hành' },
    { re: /Begin/gi, vi: 'Bắt đầu' }
  ];

  // --- 2. Hàm dịch chính ---
  function translate(text){
    if(!text) return '';
    var t = String(text);
    var i, item;
    for(i = 0; i < NAV_PHRASES.length; i++){
      item = NAV_PHRASES[i];
      // Reset lastIndex vì dùng /g
      item.re.lastIndex = 0;
      t = t.replace(item.re, item.vi);
    }
    // 'onto' trước 'on': "Turn left onto Nguyen Trai" -> "Rẽ trái vào Nguyen Trai"
    t = t.replace(/ onto /gi, ' vào ');
    // 'on' chỉ thay khi là từ riêng, không ăn vào 'destination'
    // và không thay khi là 'on the right / left' (đã dịch ở trên rồi)
    t = t.replace(/\bon\b(?=\s+(?!the\s+(right|left)))/gi, 'trên');
    // 'for' trong "Continue for 2 km" -> "Tiếp tục đi 2 km" (đã xử lý Continue for ở trên, còn sót thì để nguyên)
    return t;
  }

  // --- 3. Nhãn ngắn cho banner "Sau đó ..." / gManeuverText ---
  function maneuverShort(maneuver){
    if(!maneuver) return 'đi thẳng';
    var type = String(maneuver.type || '').toLowerCase();
    var mod = String(maneuver.modifier || '').toLowerCase();
    var instr = String(maneuver.instruction || '').toLowerCase();
    if(type.indexOf('arrive') !== -1 || instr.indexOf('đến') !== -1 || instr.indexOf('arrive') !== -1 || instr.indexOf('destination') !== -1) return 'đến nơi';
    if(mod.indexOf('uturn') !== -1 || type.indexOf('uturn') !== -1 || instr.indexOf('quay đầu') !== -1 || instr.indexOf('u-turn') !== -1 || instr.indexOf('u turn') !== -1) return 'quay đầu';
    if(instr.indexOf('lùi') !== -1 || instr.indexOf('reverse') !== -1) return 'đi lùi';
    if(type.indexOf('roundabout') !== -1 || instr.indexOf('vòng xuyến') !== -1 || instr.indexOf('roundabout') !== -1) return 'vào vòng xuyến';
    if(mod.indexOf('slight left') !== -1 || instr.indexOf('chếch sang trái') !== -1) return 'rẽ nhẹ trái';
    if(mod.indexOf('slight right') !== -1 || instr.indexOf('chếch sang phải') !== -1) return 'rẽ nhẹ phải';
    if(mod.indexOf('sharp left') !== -1 || instr.indexOf('ngoặt sang trái') !== -1) return 'rẽ ngoặt trái';
    if(mod.indexOf('sharp right') !== -1 || instr.indexOf('ngoặt sang phải') !== -1) return 'rẽ ngoặt phải';
    if(instr.indexOf('bám bên trái') !== -1 || mod.indexOf('keep left') !== -1) return 'giữ bên trái';
    if(instr.indexOf('bám bên phải') !== -1 || mod.indexOf('keep right') !== -1) return 'giữ bên phải';
    if(mod.indexOf('left') !== -1 || instr.indexOf('rẽ trái') !== -1) return 'rẽ trái';
    if(mod.indexOf('right') !== -1 || instr.indexOf('rẽ phải') !== -1) return 'rẽ phải';
    if(type.indexOf('continue') !== -1 || type.indexOf('straight') !== -1 || type.indexOf('depart') !== -1 || instr.indexOf('đi thẳng') !== -1 || instr.indexOf('tiếp tục') !== -1) return 'đi thẳng';
    if(type.indexOf('merge') !== -1 || instr.indexOf('nhập làn') !== -1) return 'nhập làn';
    if(type.indexOf('turn') !== -1 || type.indexOf('fork') !== -1) return mod.indexOf('left') !== -1 ? 'rẽ trái' : (mod.indexOf('right') !== -1 ? 'rẽ phải' : 'đi thẳng');
    return 'đi thẳng';
  }

  // --- 4. UI chung (để sau này thêm, app.js dùng nếu cần) ---
  var UI = {
    arriving: 'Bạn đã đến nơi. Chuyến đi kết thúc.',
    arrived: 'Đã đến nơi',
    tripEnded: 'Đã kết thúc chuyến đi.',
    tripSaved: 'Đã lưu chuyến đi.'
  };

  var DICT = {
    version: '1.0.0',
    navPhrases: NAV_PHRASES,
    translate: translate,
    maneuverShort: maneuverShort,
    UI: UI
  };

  // Expose cho app.js (classic script)
  if(typeof window !== 'undefined'){
    window.DRIVEKIT_DICT = DICT;
    // Giữ tên cũ để app.js cũ vẫn chạy
    window.translateFallback = translate;
    window.DK_MANEUVER_SHORT = maneuverShort;
  }
  // Hỗ trợ ES module nếu ai import
  if(typeof module !== 'undefined' && module.exports){
    module.exports = DICT;
  }
})();
