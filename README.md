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
