export const staff = [
  { id: 1, name: "Mai", role: "Owner / Nailist", color: "#7c3aed", status: "Working", external: { hotpepper: "HP_MAI_003", nailie: "NL_MAI_312", minimo: "MM_MAI_889" } },
  { id: 2, name: "Yuki", role: "Nailist", color: "#ec4899", status: "Working", external: { hotpepper: "HP_YUKI_011", nailie: "NL_YUKI_147", minimo: "MM_YUKI_221" } },
  { id: 3, name: "Linh", role: "Nailist", color: "#0ea5e9", status: "Break 15:00-16:00", external: { hotpepper: "HP_LINH_006", nailie: "NL_LINH_551", minimo: "MM_LINH_774" } },
  { id: 4, name: "Hana", role: "Nailist", color: "#10b981", status: "Working", external: { hotpepper: "HP_HANA_018", nailie: "NL_HANA_420", minimo: "MM_HANA_101" } },
];

export const platforms = [
  { id: "hotpepper", name: "Hot Pepper Beauty", color: "#ec4899", status: "Connected", read: true, block: true, write: true },
  { id: "nailie", name: "Nailie", color: "#8b5cf6", status: "Connected", read: true, block: true, write: false },
  { id: "minimo", name: "minimo", color: "#0ea5e9", status: "Connected", read: true, block: true, write: true },
  { id: "direct", name: "Direct / Phone", color: "#10b981", status: "Internal", read: true, block: true, write: true },
];

export const bookings = [
  { id: 1, start: "10:00", end: "11:15", customer: "Nguyen An", phone: "090-1234-5678", service: "Gel One Color", staff: "Mai", source: "nailie", price: 6500, status: "CONFIRMED", origin: "Nailie", commissionRule: "Nailie repeat 45%" },
  { id: 2, start: "10:30", end: "12:00", customer: "Aoi Sato", phone: "080-8765-4321", service: "Magnet + Art", staff: "Yuki", source: "hotpepper", price: 9800, status: "CONFIRMED", origin: "Hot Pepper Beauty", commissionRule: "Hot Pepper new 40%" },
  { id: 3, start: "12:30", end: "13:30", customer: "Tran Linh", phone: "070-2233-4455", service: "Removal + Care", staff: "Linh", source: "minimo", price: 7200, status: "CHECKED_IN", origin: "minimo", commissionRule: "minimo 45%" },
  { id: 4, start: "14:00", end: "15:30", customer: "Mika Tanaka", phone: "090-9988-1122", service: "French Design", staff: "Hana", source: "hotpepper", price: 8800, status: "CONFIRMED", origin: "Hot Pepper Beauty", commissionRule: "Hot Pepper repeat 50%" },
  { id: 5, start: "15:00", end: "16:45", customer: "Pham Vy", phone: "080-1111-2222", service: "Extension + Art", staff: "Mai", source: "direct", price: 13500, status: "IN_SERVICE", origin: "Direct", commissionRule: "Direct 55%" },
  { id: 6, start: "17:00", end: "18:00", customer: "Yuna Mori", phone: "070-4444-5555", service: "Foot Care", staff: "Yuki", source: "nailie", price: 7600, status: "PENDING", origin: "Nailie", commissionRule: "Nailie new 45%" },
];

export const syncEvents = [
  { id: 1, title: "New Nailie booking received", detail: "Mai 10:00-11:15 was created internally.", severity: "INFO" },
  { id: 2, title: "Availability blocked", detail: "Hot Pepper and minimo slots closed for Mai.", severity: "INFO" },
  { id: 3, title: "Manual review required", detail: "Nailie does not support reservation update for one account.", severity: "WARNING" },
];

export const payrollRules = [
  { id: 1, staff: "Mai", source: "direct", app: "Direct / Phone", formula: "sale * 0.55", base: "Net sale" },
  { id: 2, staff: "Mai", source: "nailie", app: "Nailie", formula: "sale * 0.45", base: "Net sale" },
  { id: 3, staff: "Yuki", source: "hotpepper", app: "Hot Pepper Beauty", formula: "sale * 0.40", base: "Net sale" },
  { id: 4, staff: "Yuki", source: "nailie", app: "Nailie", formula: "sale * 0.45", base: "Net sale" },
  { id: 5, staff: "Linh", source: "minimo", app: "minimo", formula: "sale * 0.45", base: "Net sale" },
  { id: 6, staff: "Hana", source: "hotpepper", app: "Hot Pepper Beauty", formula: "sale * 0.50", base: "Net sale" },
];

export const payments = [
  { id: 1, method: "Cash", amount: 16500 },
  { id: 2, method: "Card", amount: 18800 },
  { id: 3, method: "QR", amount: 7200 },
  { id: 4, method: "App payment", amount: 17400 },
];

export const customers = [
  { id: 1, name: "Nguyen An", phone: "090-1234-5678", visits: 8, lastVisit: "2026-10-06", spend: 48600, tag: "Repeat", origin: "Nailie" },
  { id: 2, name: "Aoi Sato", phone: "080-8765-4321", visits: 3, lastVisit: "2026-10-06", spend: 23100, tag: "Repeat", origin: "Hot Pepper Beauty" },
  { id: 3, name: "Tran Linh", phone: "070-2233-4455", visits: 1, lastVisit: "2026-10-06", spend: 8900, tag: "New", origin: "minimo" },
  { id: 4, name: "Mika Tanaka", phone: "090-9988-1122", visits: 2, lastVisit: "2026-10-06", spend: 13800, tag: "Repeat", origin: "Hot Pepper Beauty" },
];
