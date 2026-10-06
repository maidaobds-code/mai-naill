export const languages = [
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "vi", label: "Tiếng Việt" },
];

export const dictionary = {
  en: {
    dashboard: "Dashboard",
    calendar: "Calendar",
    customers: "Customers",
    staff: "Staff",
    checkout: "POS / Checkout",
    payroll: "Payroll",
    integrations: "Integrations",
    reports: "Reports",
    products: "Products",
    inventory: "Inventory",
    onlineStore: "Online Store",
    orders: "Orders",
    settings: "Settings",
    salonOs: "Salon + Store OS",
  },
  ja: {
    dashboard: "ダッシュボード",
    calendar: "予約カレンダー",
    customers: "顧客",
    staff: "スタッフ",
    checkout: "会計",
    payroll: "給与",
    integrations: "連携",
    reports: "レポート",
    products: "商品",
    inventory: "在庫",
    onlineStore: "オンラインストア",
    orders: "注文",
    settings: "設定",
    salonOs: "サロン + ストア管理",
  },
  vi: {
    dashboard: "Tổng quan",
    calendar: "Lịch hẹn",
    customers: "Khách hàng",
    staff: "Nhân viên",
    checkout: "Tính tiền",
    payroll: "Tính lương",
    integrations: "Liên kết app",
    reports: "Báo cáo",
    products: "Sản phẩm",
    inventory: "Tồn kho",
    onlineStore: "Web bán hàng",
    orders: "Đơn hàng",
    settings: "Cài đặt",
    salonOs: "Quản lý salon + cửa hàng",
  },
};

export function t(lang, key) {
  return dictionary[lang]?.[key] || dictionary.en[key] || key;
}
