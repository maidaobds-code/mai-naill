export const staff = [
  { id: 1, name: "Mai", role: "Owner", color: "#7c3aed", status: "Đang làm" },
  { id: 2, name: "Yuki", role: "Nailist", color: "#ec4899", status: "Đang làm" },
  { id: 3, name: "Linh", role: "Nailist", color: "#0ea5e9", status: "Nghỉ 15:00–16:00" },
  { id: 4, name: "Hana", role: "Nailist", color: "#10b981", status: "Đang làm" },
];

export const bookings = [
  { id: 1, time: "10:00", customer: "Nguyễn An", service: "Gel one color", staff: "Mai", source: "LINE", price: 5500, status: "Đã đến" },
  { id: 2, time: "10:30", customer: "佐藤 美咲", service: "定額デザイン", staff: "Yuki", source: "HotPepper", price: 7800, status: "Đã xác nhận" },
  { id: 3, time: "11:00", customer: "Trần Linh", service: "Nail art + off", staff: "Linh", source: "Instagram", price: 8900, status: "Đã xác nhận" },
  { id: 4, time: "13:00", customer: "田中 愛", service: "フットジェル", staff: "Hana", source: "Minimo", price: 6500, status: "Chờ xác nhận" },
  { id: 5, time: "14:30", customer: "Pham Vy", service: "Gel + extension", staff: "Mai", source: "Walk-in", price: 11500, status: "Đã xác nhận" },
  { id: 6, time: "16:00", customer: "鈴木 梨花", service: "持ち込みデザイン", staff: "Yuki", source: "HotPepper", price: 9800, status: "Đã xác nhận" },
];

export const customers = [
  { id: 1, name: "Nguyễn An", phone: "090-1234-5678", visits: 8, lastVisit: "2026-08-20", spend: 48600, tag: "Khách cũ" },
  { id: 2, name: "佐藤 美咲", phone: "080-8765-4321", visits: 3, lastVisit: "2026-08-19", spend: 23100, tag: "Khách cũ" },
  { id: 3, name: "Trần Linh", phone: "070-2233-4455", visits: 1, lastVisit: "2026-08-23", spend: 8900, tag: "Khách mới" },
  { id: 4, name: "田中 愛", phone: "090-9988-1122", visits: 2, lastVisit: "2026-08-17", spend: 13800, tag: "Khách cũ" },
];

export const stock = [
  { id: 1, item: "Base gel", qty: 4, min: 3, unit: "chai" },
  { id: 2, item: "Top gel", qty: 2, min: 3, unit: "chai" },
  { id: 3, item: "Cotton pads", qty: 18, min: 10, unit: "gói" },
  { id: 4, item: "Nail tips", qty: 7, min: 5, unit: "hộp" },
];
