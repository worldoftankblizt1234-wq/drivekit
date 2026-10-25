// dictionary.js

// 1. Từ điển Hướng (Dùng cho cụm "Head North", "Head East"...)
export const DIR_DICT = {
  "north": "Bắc",
  "south": "Nam",
  "east": "Đông",
  "west": "Tây",
  "northeast": "Đông Bắc",
  "northwest": "Tây Bắc",
  "southeast": "Đông Nam",
  "southwest": "Tây Nam",
  "n": "Bắc",
  "s": "Nam",
  "e": "Đông",
  "w": "Tây"
};

// 2. Từ điển Chỉ dẫn (Dùng để dịch các câu lệnh)
// LƯU Ý: Các key phải viết thường. Hàm translateInstruction sẽ tự động sắp xếp độ dài giảm dần để dịch đúng.
export const NAV_DICT = {
  // --- Rẽ & Đổi hướng (Turns) ---
  "turn sharp left": "Rẽ trái gắt",
  "turn sharp right": "Rẽ phải gắt",
  "turn slight left": "Chếch sang trái",
  "turn slight right": "Chếch sang phải",
  "turn left": "Rẽ trái",
  "turn right": "Rẽ phải",
  "make a u-turn": "Quay đầu",
  "make a uturn": "Quay đầu",
  "u-turn": "Quay đầu",
  "uturn": "Quay đầu",
  "bear left": "Đi chếch sang trái",
  "bear right": "Đi chếch sang phải",
  "keep left": "Giữ bên trái",
  "keep right": "Giữ bên phải",
  
  // --- Đi thẳng & Tiếp tục ---
  "continue straight": "Tiếp tục đi thẳng",
  "continue on": "Tiếp tục trên",
  "go straight": "Đi thẳng",
  "proceed": "Tiếp tục di chuyển",
  "head": "Đi về hướng",
  
  // --- Vòng xuyến (Roundabouts) ---
  "enter the roundabout": "Đi vào vòng xuyến",
  "at the roundabout": "Tại vòng xuyến",
  "take the exit": "Đi theo lối ra",
  "take the 1st exit": "Đi theo lối ra thứ 1",
  "take the 2nd exit": "Đi theo lối ra thứ 2",
  "take the 3rd exit": "Đi theo lối ra thứ 3",
  "take the 4th exit": "Đi theo lối ra thứ 4",
  "exit the roundabout": "Ra khỏi vòng xuyến",
  
  // --- Điểm đến (Destination) ---
  "arrive at your destination": "Đến điểm đến của bạn",
  "arrive at": "Đến",
  "your destination": "điểm đến của bạn",
  "destination is on the left": "Điểm đến ở bên trái",
  "destination is on the right": "Điểm đến ở bên phải",
  "destination will be on the left": "Điểm đến sẽ ở bên trái",
  "destination will be on the right": "Điểm đến sẽ ở bên phải",
  
  // --- Nhập làn & Đường cao tốc (Merge & Highway) ---
  "merge onto": "Nhập làn vào",
  "merge left": "Nhập làn trái",
  "merge right": "Nhập làn phải",
  "take the ramp": "Đi theo đường dốc lên",
  "take the fork": "Đi theo ngã ba",
  "keep straight": "Đi thẳng",
  "highway": "đường cao tốc",
  "freeway": "đường cao tốc",
  
  // --- Giới từ & Vị trí ---
  "straight ahead": "phía trước",
  "on the left": "ở bên trái",
  "on the right": "ở bên phải",
  "the left": "bên trái",
  "the right": "bên phải",
  "on ": "trên ",
  "onto ": "vào ",
  "toward ": "về hướng ",
  "towards ": "về hướng ",
  "via ": "qua ",
  "using ": "sử dụng ",
  "to ": "đến ",
  "at ": "tại "
};
