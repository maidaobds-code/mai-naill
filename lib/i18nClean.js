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
    salonOs: "Quản lý salon và cửa hàng",
    language: "Ngôn ngữ",
  },
  ja: {
    dashboard: "ダッシュボード",
    calendar: "予約カレンダー",
    customers: "顧客",
    staff: "スタッフ",
    services: "サービスメニュー",
    checkout: "会計 / POS",
    payroll: "給与計算",
    integrations: "アプリ連携",
    reports: "レポート",
    productsInventory: "商品・在庫",
    onlineStore: "オンラインストア",
    orders: "注文管理",
    settings: "設定",
    salonOs: "サロン・ストア管理",
    language: "言語",
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
    salonOs: "Salon and store management",
    language: "Language",
  },
};

export const ui = {
  vi: {
    common: { exportCsv: "Xuất CSV", save: "Lưu", add: "Thêm", edit: "Sửa", delete: "Xóa", close: "Đóng", cancel: "Hủy", send: "Gửi", total: "Tổng", status: "Trạng thái", payment: "Thanh toán", customer: "Khách hàng", phone: "Số điện thoại", email: "Gmail", address: "Địa chỉ", note: "Ghi chú", date: "Ngày", time: "Giờ", staff: "Nhân viên", service: "Dịch vụ", price: "Giá", stock: "Tồn kho", action: "Thao tác" },
    brand: { name: "Mai Beauty Salon", foot: "Tokyo · Nhật Bản" },
    online: { heroTitle: "Đặt lịch và mua sản phẩm", heroText: "Chọn dịch vụ, mua sản phẩm và theo dõi đơn hàng trong một trang web nhẹ nhàng.", shopNow: "Mua ngay", bookNail: "Đặt lịch", productsTitle: "Sản phẩm nổi bật", productsText: "Sản phẩm được đồng bộ từ kho của salon.", canBuy: "Còn {stock} trong kho", outOfStock: "Hết hàng", buy: "Mua", viewStatus: "Xem tình trạng", trackerTitle: "Theo dõi đơn hàng", trackerText: "Nhập mã đơn hoặc xem đơn mới nhất, chat trực tiếp với chủ quán.", latestOrder: "Đơn mới nhất", noOrders: "Chưa có đơn hàng nào.", chatPlaceholder: "Nhắn tin cho chủ quán", bookingTitle: "Đặt lịch hẹn nail", bookingText: "Chọn dịch vụ bằng thẻ ảnh. Tên, số điện thoại và Gmail là bắt buộc.", autoStaff: "Tự động chọn", confirmBooking: "Xác nhận đặt lịch", chooseService: "Chọn dịch vụ", checkoutTitle: "Thanh toán sản phẩm", pickup: "Đến cửa hàng lấy", shipping: "Gửi hàng", paymentMethod: "Phương thức thanh toán", deliveryAddress: "Địa chỉ nhận hàng", deliveryNote: "Ghi chú giao hàng", uploadBill: "Tải ảnh bill chuyển khoản", createOrder: "Tạo đơn hàng", requiredInfo: "Vui lòng nhập tên, số điện thoại và Gmail.", requiredAddress: "Phương thức gửi hàng cần địa chỉ nhận hàng.", orderCreated: "Đã tạo đơn {order}. Bạn có thể theo dõi đơn và chat với chủ quán bên dưới.", bookingCreated: "Đã đặt lịch {time} ngày {date}. Lịch hẹn đã tự động cập nhật vào trang Lịch hẹn." },
    orders: { title: "Đơn hàng", desc: "Hiển thị số đơn khách đặt, tình trạng đơn và trả lời tin nhắn trực tiếp.", customerOrders: "Đơn khách đặt", unread: "{count} đơn mới chưa xem", allOrders: "Tất cả đơn", sample: "Web và dữ liệu mẫu", revenue: "Doanh thu sản phẩm", needsAction: "Cần xử lý", detailEmail: "Gmail", confirm: "Nhân viên xác nhận đơn", shipped: "Đã gửi hàng cho khách", orderStatus: "Tình trạng đơn", paymentStatus: "Thanh toán", bill: "Bill chuyển khoản", emailLog: "Gmail đã gửi cho khách", chat: "Chat với khách", noChat: "Chưa có tin nhắn.", replyPlaceholder: "Trả lời khách hàng", owner: "Chủ quán", guest: "Khách", newOrderToast: "Có đơn hàng mới: {order}", notify: "Thông báo" },
    customersPage: { title: "Khách hàng", desc: "Quản lý khách cũ, tạo sự kiện/thông báo và gửi Gmail hàng loạt cho khách đã mua hoặc đặt lịch.", sendNotice: "Gửi thông báo", campaignTitle: "Sự kiện / thông báo cho khách cũ", campaignDesc: "Ví dụ: giảm giá mùa lễ, ưu đãi sinh nhật, lịch nghỉ của cửa hàng.", subject: "Tiêu đề", type: "Loại", target: "Nhóm nhận", message: "Nội dung", promotion: "Giảm giá", event: "Sự kiện", notice: "Thông báo", oldCustomers: "Khách cũ đã mua/đặt lịch", buyers: "Khách đã mua hàng", bookers: "Khách đã đặt lịch", campaignLog: "Nhật ký chiến dịch Gmail", noCampaign: "Chưa gửi thông báo nào.", bookings: "Lịch hẹn", orders: "Đơn hàng", spend: "Tổng chi", typeCol: "Phân loại" },
    settingsPage: { title: "Cài đặt", desc: "Cài đặt cửa hàng, giờ mở cửa, thông báo và thanh toán dùng chung toàn app.", save: "Lưu cài đặt", salonInfo: "Thông tin salon", salonName: "Tên salon", branch: "Chi nhánh", businessHours: "Giờ hoạt động", open: "Giờ mở cửa", close: "Giờ đóng cửa", tax: "Thuế %", cancelLimit: "Giới hạn hủy (giờ)", automation: "Tự động hóa đặt lịch", autoConfirm: "Tự động xác nhận lịch đặt trên web", emailReminder: "Gửi nhắc lịch qua email", lineReminder: "Gửi nhắc lịch qua LINE", deposit: "Yêu cầu đặt cọc trước khi đặt lịch", saved: "Đã lưu cài đặt.", paymentSettings: "Cài đặt thanh toán", paymentDesc: "Mọi chức năng liên quan thanh toán trong app sẽ đọc từ đây.", payAtStore: "Thanh toán tại cửa hàng / lấy tại cửa hàng", bankTransfer: "Chuyển khoản kèm upload bill", card: "Thanh toán thẻ", cod: "Thanh toán khi nhận hàng", bankName: "Tên ngân hàng", bankAccount: "Số tài khoản", holder: "Chủ tài khoản", paymentNote: "Ghi chú thanh toán" },
    payrollPage: { desc: "Chọn nhân viên, cài phần trăm theo từng app, cộng thưởng và trừ bảo hiểm trên một màn hình gọn.", current: "Đang tính lương", sales: "Doanh thu", commission: "Hoa hồng", netPay: "Thực nhận", appRates: "Phần trăm theo app", appRatesDesc: "Mỗi app một tỷ lệ riêng cho {staff}.", additions: "Khoản cộng", additionsDesc: "Thưởng, phụ cấp hoặc điều chỉnh tăng.", deductions: "Khoản trừ", deductionsDesc: "Bảo hiểm, tạm ứng, phạt hoặc điều chỉnh giảm.", addLine: "Thêm", bonus: "Thưởng", insurance: "Bảo hiểm", sale: "Doanh thu", percent: "%", date: "Ngày" },
  },
  ja: {},
  en: {},
};

ui.en = {
  common: { exportCsv: "Export CSV", save: "Save", add: "Add", edit: "Edit", delete: "Delete", close: "Close", cancel: "Cancel", send: "Send", total: "Total", status: "Status", payment: "Payment", customer: "Customer", phone: "Phone", email: "Email", address: "Address", note: "Note", date: "Date", time: "Time", staff: "Staff", service: "Service", price: "Price", stock: "Stock", action: "Action" },
  brand: { name: "Mai Beauty Salon", foot: "Tokyo · Japan" },
  online: { heroTitle: "Book and shop beauty care", heroText: "Choose services, buy products, and track orders in one soft storefront.", shopNow: "Shop now", bookNail: "Book nail", productsTitle: "Featured Products", productsText: "Products sync from the salon inventory.", canBuy: "{stock} in stock", outOfStock: "Out of stock", buy: "Buy", viewStatus: "View status", trackerTitle: "Order tracking", trackerText: "Enter an order number or open the latest order and chat with the salon.", latestOrder: "Latest order", noOrders: "No orders yet.", chatPlaceholder: "Message the salon owner", bookingTitle: "Book a nail appointment", bookingText: "Choose a service card. Name, phone, and email are required.", autoStaff: "Auto assign", confirmBooking: "Confirm booking", chooseService: "Choose service", checkoutTitle: "Product checkout", pickup: "Pick up at store", shipping: "Ship to address", paymentMethod: "Payment method", deliveryAddress: "Delivery address", deliveryNote: "Delivery note", uploadBill: "Upload transfer receipt", createOrder: "Create order", requiredInfo: "Please enter name, phone, and email.", requiredAddress: "Shipping requires a delivery address.", orderCreated: "Order {order} was created. You can track it and chat below.", bookingCreated: "Booked {time} on {date}. The appointment was added to Calendar." },
  orders: { title: "Orders", desc: "See customer orders, order status, and reply to customer messages directly.", customerOrders: "Customer orders", unread: "{count} new unread", allOrders: "All orders", sample: "Web and sample data", revenue: "Product revenue", needsAction: "Needs action", detailEmail: "Email", confirm: "Staff confirms order", shipped: "Marked as shipped", orderStatus: "Order status", paymentStatus: "Payment", bill: "Transfer receipt", emailLog: "Gmail sent to customer", chat: "Customer chat", noChat: "No messages yet.", replyPlaceholder: "Reply to customer", owner: "Owner", guest: "Customer", newOrderToast: "New order: {order}", notify: "Notification" },
  customersPage: { title: "Customers", desc: "Manage returning customers, create events/notices, and send Gmail campaigns to buyers or bookers.", sendNotice: "Send notice", campaignTitle: "Event / notice for returning customers", campaignDesc: "Examples: holiday discount, birthday offer, salon closing notice.", subject: "Subject", type: "Type", target: "Audience", message: "Message", promotion: "Promotion", event: "Event", notice: "Notice", oldCustomers: "Returning buyers/bookers", buyers: "Product buyers", bookers: "Appointment bookers", campaignLog: "Gmail campaign log", noCampaign: "No campaigns sent yet.", bookings: "Bookings", orders: "Orders", spend: "Total spend", typeCol: "Type" },
  settingsPage: { title: "Settings", desc: "Manage salon info, business hours, notifications, and app-wide payments.", save: "Save settings", salonInfo: "Salon information", salonName: "Salon name", branch: "Branch", businessHours: "Business hours", open: "Open time", close: "Close time", tax: "Tax rate %", cancelLimit: "Cancellation limit (hours)", automation: "Booking automation", autoConfirm: "Auto confirm website bookings", emailReminder: "Send email reminders", lineReminder: "Send LINE reminders", deposit: "Require deposit before booking", saved: "Settings saved.", paymentSettings: "Payment settings", paymentDesc: "Every payment-related feature reads from here.", payAtStore: "Pay at store / pickup", bankTransfer: "Bank transfer with receipt upload", card: "Card payment", cod: "Cash on delivery", bankName: "Bank name", bankAccount: "Bank account", holder: "Account holder", paymentNote: "Payment note" },
  payrollPage: { desc: "Select a staff member, set app rates, additions, and insurance/deductions in one clean screen.", current: "Current payroll", sales: "Sales", commission: "Commission", netPay: "Net pay", appRates: "App percentages", appRatesDesc: "One rate per app for {staff}.", additions: "Additions", additionsDesc: "Bonus, allowance, or positive adjustment.", deductions: "Deductions", deductionsDesc: "Insurance, advance, penalty, or negative adjustment.", addLine: "Add", bonus: "Bonus", insurance: "Insurance", sale: "Sale", percent: "%", date: "Date" },
};

ui.ja = {
  common: { exportCsv: "CSV出力", save: "保存", add: "追加", edit: "編集", delete: "削除", close: "閉じる", cancel: "キャンセル", send: "送信", total: "合計", status: "ステータス", payment: "支払い", customer: "顧客", phone: "電話番号", email: "メール", address: "住所", note: "メモ", date: "日付", time: "時間", staff: "スタッフ", service: "サービス", price: "価格", stock: "在庫", action: "操作" },
  brand: { name: "Mai Beauty Salon", foot: "東京・日本" },
  online: { heroTitle: "予約と商品購入", heroText: "サービス予約、商品購入、注文追跡をひとつのストアで管理できます。", shopNow: "購入する", bookNail: "予約する", productsTitle: "おすすめ商品", productsText: "商品はサロン在庫から同期されます。", canBuy: "在庫 {stock} 点", outOfStock: "在庫なし", buy: "購入", viewStatus: "状況を見る", trackerTitle: "注文追跡", trackerText: "注文番号を入力、または最新注文を開いてサロンへ連絡できます。", latestOrder: "最新注文", noOrders: "注文はまだありません。", chatPlaceholder: "サロンへメッセージ", bookingTitle: "ネイル予約", bookingText: "写真付きサービスを選択してください。名前・電話・メールは必須です。", autoStaff: "自動選択", confirmBooking: "予約を確定", chooseService: "サービスを選択", checkoutTitle: "商品チェックアウト", pickup: "店舗受け取り", shipping: "配送", paymentMethod: "支払い方法", deliveryAddress: "配送先住所", deliveryNote: "配送メモ", uploadBill: "振込明細をアップロード", createOrder: "注文を作成", requiredInfo: "名前、電話番号、メールを入力してください。", requiredAddress: "配送には住所が必要です。", orderCreated: "注文 {order} を作成しました。下で追跡とチャットができます。", bookingCreated: "{date} {time} の予約を作成しました。カレンダーに追加されました。" },
  orders: { title: "注文管理", desc: "顧客注文、注文状況、顧客メッセージへの返信を管理します。", customerOrders: "顧客注文", unread: "未読 {count} 件", allOrders: "全注文", sample: "Web とサンプルデータ", revenue: "商品売上", needsAction: "要対応", detailEmail: "メール", confirm: "スタッフが注文確認", shipped: "発送済みにする", orderStatus: "注文状況", paymentStatus: "支払い状況", bill: "振込明細", emailLog: "顧客へ送信済みGmail", chat: "顧客チャット", noChat: "メッセージはまだありません。", replyPlaceholder: "顧客へ返信", owner: "店舗", guest: "顧客", newOrderToast: "新しい注文: {order}", notify: "通知" },
  customersPage: { title: "顧客", desc: "既存顧客を管理し、購入・予約履歴のある顧客へGmailでイベントや通知を送信します。", sendNotice: "通知を送信", campaignTitle: "既存顧客向けイベント / 通知", campaignDesc: "例: 祝日セール、誕生日特典、店舗休業のお知らせ。", subject: "件名", type: "種類", target: "送信対象", message: "本文", promotion: "割引", event: "イベント", notice: "通知", oldCustomers: "購入・予約済み顧客", buyers: "購入顧客", bookers: "予約顧客", campaignLog: "Gmail配信履歴", noCampaign: "まだ通知は送信されていません。", bookings: "予約", orders: "注文", spend: "累計支払", typeCol: "分類" },
  settingsPage: { title: "設定", desc: "店舗情報、営業時間、通知、アプリ共通の支払い設定を管理します。", save: "設定を保存", salonInfo: "サロン情報", salonName: "サロン名", branch: "店舗", businessHours: "営業時間", open: "開店時間", close: "閉店時間", tax: "税率 %", cancelLimit: "キャンセル期限（時間）", automation: "予約自動化", autoConfirm: "Web予約を自動確認", emailReminder: "メールリマインダーを送信", lineReminder: "LINEリマインダーを送信", deposit: "予約前にデポジットを要求", saved: "設定を保存しました。", paymentSettings: "支払い設定", paymentDesc: "支払い関連機能はここから設定を読み込みます。", payAtStore: "店舗支払い / 店舗受け取り", bankTransfer: "銀行振込と明細アップロード", card: "カード支払い", cod: "代金引換", bankName: "銀行名", bankAccount: "口座番号", holder: "口座名義", paymentNote: "支払いメモ" },
  payrollPage: { desc: "スタッフを選択し、アプリ別料率、加算、保険などの控除をすっきり管理します。", current: "給与計算中", sales: "売上", commission: "歩合", netPay: "支給額", appRates: "アプリ別パーセント", appRatesDesc: "{staff} のアプリ別料率。", additions: "加算", additionsDesc: "ボーナス、手当、調整加算。", deductions: "控除", deductionsDesc: "保険、前払い、罰金、調整控除。", addLine: "追加", bonus: "ボーナス", insurance: "保険", sale: "売上", percent: "%", date: "日付" },
};

export function t(lang, key) {
  return dictionary[lang]?.[key] || dictionary.vi[key] || key;
}

export function tx(lang, group, key, vars = {}) {
  let value = ui[lang]?.[group]?.[key] || ui.vi[group]?.[key] || key;
  Object.entries(vars).forEach(([name, replacement]) => {
    value = value.replaceAll(`{${name}}`, replacement);
  });
  return value;
}
