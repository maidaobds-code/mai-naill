# Nail Japan MVP

Prototype giao diện cho hệ thống quản lý nail salon tại Nhật.

## Chạy local

```bash
npm install
npm run dev
```

Mở http://localhost:3000

## Module có trong prototype

- Dashboard
- Calendar / Booking
- Khách hàng / CRM
- Nhân viên
- Chấm công
- POS / Thanh toán
- Doanh thu
- Kho
- Booking online
- Cài đặt

## Kiến trúc production đề xuất

- Next.js App Router
- Supabase: Auth + PostgreSQL + Storage + Realtime
- Vercel
- Stripe / Square cho thanh toán
- LINE Messaging API
- Job đồng bộ booking ngoài qua cron/webhook khi nguồn hỗ trợ API
- Multi-tenant: salon_id trên toàn bộ dữ liệu nghiệp vụ

## Database cốt lõi

salons, users, staff, staff_shifts, customers, services, bookings,
booking_sources, payments, pos_orders, commissions, timesheets,
inventory_items, inventory_movements, expenses, payroll_runs,
public_staff_profiles, booking_pages, audit_logs.

## Quy tắc riêng cho Nhật nên có

- 指名 / 指名料
- 新規 / 再来
- HotPepper / Minimo source attribution
- 税込 / 税抜
- 現金 / クレカ / QR
- Cancellation / no-show
- Commission theo nguồn khách, thợ, service và new/repeat
# Mainaill Bot desktop installer

Ứng dụng desktop quản lý hai worker Nailie và SALON BOARD/HOT PEPPER có thể
được đóng gói thành một bộ cài Windows:

```powershell
npm install
npm run package:windows
```

File đầu ra nằm tại `dist/Mainaill-Bot-Setup-<version>.exe`. Sau khi cài, cấu
hình, log và profile trình duyệt được lưu trong thư mục dữ liệu ứng dụng của
Windows, tách khỏi thư mục cài đặt. DRY RUN được bật mặc định cho cả hai worker.
Ứng dụng mặc định đăng ký khởi động cùng Windows và tự chạy cả Nailie lẫn
SALON BOARD sau khi máy bật hoặc khởi động lại. Có thể tắt chế độ này trong
Bot Manager bằng tùy chọn **Tự mở ứng dụng và chạy cả hai bot**.

## Lịch làm/nghỉ và máy in mobile

- Bot Tasks nằm trong Cài đặt → Tác vụ bot. URL /bot-tasks cũ chuyển về đúng mục này.
- Lịch làm/nghỉ cho phép chọn ngày rời rạc hoặc khoảng ngày (kể cả qua tháng).
  Lưu các ngày đã chọn chỉ thay đổi những ngày đó. Mẫu theo thứ là tùy chọn, không
  tự lặp sang tháng khác. Người nghỉ cả ngày được ẩn khỏi hàng lịch; các lịch khách
  mâu thuẫn vẫn được hiển thị riêng để chủ quán xử lý.
- Khi kéo lịch, khối xem trước bám con trỏ và khung nét đứt hiển thị giờ đích;
  dữ liệu chỉ được lưu sau khi thả và server xác nhận.
- Star mPOP POP10 trên iPad/iPhone/Android: dùng Star PassPRNT để chuyển lệnh từ
  Chrome sang ứng dụng Star. Cài Star PassPRNT, chọn/ghép máy in trong ứng dụng
  (iOS dùng Bluetooth), rồi tại app chọn Máy in → In qua Star PassPRNT → In thử.
  Kết nối USB trực tiếp của app dành cho Chrome/Edge trên máy tính. Phương thức
  kết nối và mã thiết bị được lưu riêng từng trình duyệt; logo in dùng chung.
  Mở ứng dụng in chưa đồng nghĩa đã in thành công; thông báo kết quả dựa trên
  callback passprnt_code. Cần kiểm tra giấy in thực tế trên thiết bị salon.

Tài liệu hãng: https://starmicronics.com/technology/passprnt/
Đặc tả URL: https://www.star-m.jp/products/s_print/sdk/passprnt/manual/ios/en/data_specifications.html
Kiểm thử: npm run test:calendar-workflow; npm run test:mobile-printer.
