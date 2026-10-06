export const languages = [
  { code: "vi", label: "Tiếng Việt" },
  { code: "ja", label: "日本語" },
  { code: "en", label: "English" },
];

export const dictionary = {
  vi: {
    dashboard: "Tổng quan",
    calendar: "Lịch hẹn",
    customers: "Khách hàng",
    staff: "Nhân viên",
    services: "Menu dịch vụ",
    checkout: "Tính tiền / POS",
    payroll: "Tính lương",
    integrations: "Liên kết ứng dụng",
    reports: "Báo cáo",
    productsInventory: "Sản phẩm & Kho",
    onlineStore: "Web bán hàng",
    orders: "Đơn hàng",
    settings: "Cài đặt",
    salonOs: "Quản lý salon + cửa hàng",
  },
  ja: {
    dashboard: "ダッシュボード",
    calendar: "予約カレンダー",
    customers: "顧客",
    staff: "スタッフ",
    services: "サービスメニュー",
    checkout: "会計 / POS",
    payroll: "給与",
    integrations: "連携アプリ",
    reports: "レポート",
    productsInventory: "商品・在庫",
    onlineStore: "オンラインストア",
    orders: "注文",
    settings: "設定",
    salonOs: "サロン + ストア管理",
  },
  en: {
    dashboard: "Dashboard",
    calendar: "Calendar",
    customers: "Customers",
    staff: "Staff",
    services: "Service Menu",
    checkout: "POS / Checkout",
    payroll: "Payroll",
    integrations: "Integrations",
    reports: "Reports",
    productsInventory: "Products & Inventory",
    onlineStore: "Online Store",
    orders: "Orders",
    settings: "Settings",
    salonOs: "Salon + Store OS",
  },
};

export function t(lang, key) {
  return dictionary[lang]?.[key] || dictionary.vi[key] || key;
}
