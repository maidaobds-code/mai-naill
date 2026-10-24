"use client";
import { staff } from "../lib/salonData";
import { bookings, payments } from "../lib/salonData";
import { getInventoryRows, orders } from "../lib/ecommerce/data";
import { t } from "../lib/i18nClean";

function Stat({ label, value, sub }) {
  return <div className="stat card"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}

const copy = {
  zh: { eyebrow: "今天 · 2026/10/06", title: "沙龙运营中心", desc: "集中查看预约、员工、收银、工资、库存和线上销售。", newBooking: "+ 新预约", bookings: "今日预约", salonRevenue: "沙龙收入", productRevenue: "商品收入", dailyClosing: "日结", bookedServices: "已预约服务", onlineOrders: "{count} 个线上订单", paymentSub: "现金、刷卡、二维码、应用", timeline: "今日时间表", timelineDesc: "每个预约都会在已连接的应用中占用员工时间。", staffAlerts: "员工与提醒", staffDesc: "应用连接、班次和库存不足提醒。", lowStock: "请注意库存不足" },
  ko: { eyebrow: "오늘 · 2026/10/06", title: "살롱 운영 센터", desc: "예약, 직원, 결제, 급여, 재고와 온라인 매출을 한눈에 확인합니다.", newBooking: "+ 새 예약", bookings: "오늘의 예약", salonRevenue: "살롱 매출", productRevenue: "상품 매출", dailyClosing: "일일 마감", bookedServices: "예약 서비스", onlineOrders: "온라인 주문 {count}건", paymentSub: "현금, 카드, QR, 앱", timeline: "오늘의 타임라인", timelineDesc: "각 예약은 연결된 앱에서 직원 시간을 차단합니다.", staffAlerts: "직원 및 알림", staffDesc: "앱 연결, 근무와 재고 부족 알림입니다.", lowStock: "재고 부족 확인" },
  vi: { eyebrow: "HÔM NAY · 2026/10/06", title: "Trung tâm điều hành salon", desc: "Theo dõi lịch hẹn, nhân viên, tính tiền, lương, kho và doanh thu web bán hàng.", newBooking: "+ Lịch mới", bookings: "Lịch hẹn hôm nay", salonRevenue: "Doanh thu salon", productRevenue: "Doanh thu sản phẩm", dailyClosing: "Chốt ngày", bookedServices: "Dịch vụ đã đặt", onlineOrders: "{count} đơn online", paymentSub: "Tiền mặt, thẻ, QR, app", timeline: "Timeline hôm nay", timelineDesc: "Mỗi lịch hẹn chặn thời gian của nhân viên trên các app đã kết nối.", staffAlerts: "Nhân viên & cảnh báo", staffDesc: "Liên kết app, ca làm và cảnh báo tồn kho thấp.", lowStock: "Cần chú ý tồn kho thấp" },
  ja: { eyebrow: "本日 · 2026/10/06", title: "サロン管理センター", desc: "予約、スタッフ、会計、給与、在庫、オンライン売上をまとめて確認します。", newBooking: "+ 新規予約", bookings: "本日の予約", salonRevenue: "サロン売上", productRevenue: "商品売上", dailyClosing: "日次締め", bookedServices: "予約サービス", onlineOrders: "オンライン注文 {count} 件", paymentSub: "現金・カード・QR・アプリ", timeline: "本日のタイムライン", timelineDesc: "予約ごとに担当スタッフの時間を連携アプリ上で確保します。", staffAlerts: "スタッフとアラート", staffDesc: "アプリ連携、シフト、在庫不足の確認。", lowStock: "在庫不足の注意" },
  en: { eyebrow: "TODAY · 2026/10/06", title: "Salon command center", desc: "Track bookings, staff, checkout, payroll, inventory, and online store revenue.", newBooking: "+ New booking", bookings: "Today's bookings", salonRevenue: "Salon revenue", productRevenue: "Product revenue", dailyClosing: "Daily closing", bookedServices: "Booked services", onlineOrders: "{count} online orders", paymentSub: "Cash, card, QR, app", timeline: "Today's timeline", timelineDesc: "Each booking blocks the assigned staff across connected apps.", staffAlerts: "Staff and alerts", staffDesc: "Mappings, shifts, and low-stock attention.", lowStock: "Low stock attention" },
};

export default function DashboardEnhanced({ language = "vi" }) {
  const c = copy[language] || copy.vi;
  const salonRevenue = bookings.reduce((total, booking) => total + booking.price, 0);
  const productRevenue = orders.reduce((total, order) => total + order.total, 0);
  const lowStockRows = getInventoryRows().filter((row) => row.quantityAvailable <= row.threshold);
  const paymentTotal = payments.reduce((total, payment) => total + payment.amount, 0);

  return (
    <>
      <div className="pageHead">
        <div>
          <p className="eyebrow">{c.eyebrow}</p>
          <h1>{c.title}</h1>
          <p>{c.desc}</p>
        </div>
        <button className="primary">{c.newBooking}</button>
      </div>
      <div className="stats">
        <Stat label={c.bookings} value={bookings.length} sub="Nailie / Hot Pepper / minimo" />
        <Stat label={c.salonRevenue} value={`¥${salonRevenue.toLocaleString("ja-JP")}`} sub={c.bookedServices} />
        <Stat label={c.productRevenue} value={`¥${productRevenue.toLocaleString("ja-JP")}`} sub={String(c.onlineOrders || "Online orders {count}").replace("{count}", orders.length)} />
        <Stat label={c.dailyClosing} value={`¥${paymentTotal.toLocaleString("ja-JP")}`} sub={c.paymentSub} />
      </div>
      <div className="grid2">
        <section className="card">
          <div className="sectionTitle"><div><h2>{c.timeline}</h2><p>{c.timelineDesc}</p></div><button className="ghost">{t(language, "calendar")}</button></div>
          <div className="bookingList">
            {bookings.map((booking) => <div className="bookingRow" key={booking.id}>
              <div className="time">{booking.start}</div>
              <div className="grow"><strong>{booking.customer}</strong><span>{booking.phone} · {booking.service}</span></div>
              <span className={"source " + booking.source}>{booking.origin}</span>
              <div className="money">¥{booking.price.toLocaleString("ja-JP")}</div>
            </div>)}
          </div>
        </section>
        <section className="card">
          <div className="sectionTitle"><div><h2>{c.staffAlerts}</h2><p>{c.staffDesc}</p></div></div>
          {staff.map((member) => <div className="staffRow" key={member.id}>
            <div className="avatar" style={{ background: member.color }}>{member.name[0]}</div>
            <div className="grow"><strong>{member.name}</strong><span>{member.role}</span></div>
            <span className="statusDot">{member.status}</span>
          </div>)}
          <div className="stockAlert">
            <strong>{c.lowStock}</strong>
            <span>{lowStockRows.map((row) => `${row.productName} ${row.variantName}`).join(", ")}</span>
          </div>
        </section>
      </div>
    </>
  );
}
