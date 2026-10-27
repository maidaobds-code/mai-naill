# Mai Beauty Salon — bản đồ kiến trúc ứng dụng

Tài liệu này là bản đồ lõi của app. Trước mỗi lần sửa phải đọc phần **Nguồn dữ liệu**, **Luồng lưu**, và **Checklist sửa** để tránh sửa một nơi nhưng bị nguồn khác ghi đè.

## 1. Cây hệ thống

```text
app/
  page.js                 Shell chính: đăng nhập, quyền, sidebar, route bằng activePage
  layout.js               Metadata, CSS global, DynamicFavicon
  icon.svg                Favicon mặc định
  api/                    Server routes; đọc/ghi Supabase bằng service role
components/               UI theo module nghiệp vụ
  AccountAccess           Login, owner/customer session
  StaffManagement         Nhân viên và role tài khoản
  AccountManagement        Quản lý tài khoản
  CalendarResourceTimeline Lịch và phân công
  ServiceMenu              Menu dịch vụ
  ProductInventory         Sản phẩm và kho
  OnlineStore              Web khách đặt/mua
  Checkout                 POS, thanh toán, in hóa đơn
  Orders                   Đơn online, xác nhận, giao hàng, in lại
  Settings                 Cài đặt salon, logo, QR, thanh toán
  Payroll                  Tính lương
lib/
  accountStore.js          Session, accounts, permissions
  staffStore.js            Nhân viên dùng chung
  bookingStore.js          Lịch dùng chung
  catalogStore.js          Service/product catalog
  orderStore.js            Đơn online client + sync
  supabaseBrowser.js       Browser Supabase KV/Storage
  serverAuth.js            Cookie role authentication
  serverEmail.js           Recipient management + Resend
supabase/
  migrations/              Schema/public policy
```

## 2. Luồng render chính

`app/page.js` gọi `useAccountStore()` → `permissionsFor(currentAccount)` → chọn module theo `activePage`.

- `owner/admin/manager`: có quản trị, nhân viên, kho, payroll.
- `staff`: chỉ các module được cấp trong `permissionsFor`.
- `customer`: vào Online Store và profile khách.

## 3. Nguyên tắc nguồn dữ liệu

| Dữ liệu | Client cache | Server/Supabase key hoặc Storage | API chính |
|---|---|---|---|
| Settings/logo/QR | `nail-japan-settings` | `app_kv` key `nail-japan-settings`; ảnh bucket `mai-beauty-assets` | `/api/settings`, `/api/image-upload`, `/api/qr-upload` |
| Accounts/role | `nail-japan-accounts-v1` | `app_kv` key `nail-japan-accounts-v1` | `/api/accounts` |
| Staff | `nail-japan-staff` | `app_kv` key `nail-japan-staff` | `/api/staff` |
| Bookings | browser cache | `app_kv` key `nail-japan-bookings` | `/api/bookings` |
| Orders | `nail-japan-store-orders` | `app_kv` key `nail-japan-store-orders` | `/api/orders` |
| Catalog | `nail-japan-products`, `nail-japan-services`, `nail-japan-booking-options` | `app_kv` qua `/api/catalog` | `/api/catalog` |
| Payroll settings | `payroll-staff-settings-v2` | Supabase KV qua `getKv/saveKv` | browser Supabase KV |

LocalStorage chỉ là cache/khởi tạo UI. Dữ liệu thay đổi phải được ghi server; không dùng localStorage làm nguồn cuối cùng.

## 4. Luồng role tài khoản — điểm dễ sai

1. `StaffManagement` chọn role và gọi `updateAccountRole` trong `lib/accountStore.js`.
2. `updateAccountRole` POST toàn bộ danh sách tới `/api/accounts`.
3. Sau khi API thành công phải ghi tiếp `saveKv(ACCOUNT_KEY, persistedAccounts)` vì `accountStore` lúc reload cũng đọc Supabase KV.
4. UI ghép account với staff theo email duy nhất hoặc `staff-${member.id}`. Không ghép theo tên nếu có nhiều người trùng tên.
5. Role mới phải lấy từ `result.value` của server, không dùng state cũ.

## 5. Luồng upload ảnh

- Logo: `Settings.uploadLogo` → `/api/image-upload` → Storage bucket → `/api/settings` lưu URL → sidebar/favicon đọc public settings.
- QR: `Settings.uploadQr` → `/api/qr-upload` → Storage → `/api/settings` lưu URL.
- API upload phải cho cả `isAdminRequest` và `isOwnerRequest`.
- Không coi việc tên file trong `<input type=file>` đổi là upload thành công; phải kiểm tra response server và URL đã lưu.

## 6. Luồng đơn hàng và email

`OnlineStore.addOrder` → `orderStore.saveStoreOrders` → `/api/orders` → Supabase.

Server `/api/orders` phát hiện ID mới rồi gọi `managementEmails()` + `sendEmail()` trong `lib/serverEmail.js` để gửi owner/manager/admin. Email cần `RESEND_API_KEY` và `RESEND_FROM`/`EMAIL_FROM`.

Email quản lý lấy từ:

- `OWNER_EMAIL`
- Settings salon `email`
- Accounts có role `owner`, `manager`, `admin`

## 7. Logo và in ấn

- Favicon: `components/DynamicFavicon.js` đọc `/api/settings?public=1`; `app/icon.svg` chỉ là fallback.
- Sidebar: `SidebarEnhanced.js` đọc public settings.
- POS mới: `Checkout.js` dùng `settings.logoUrl`.
- In lại: `Orders.js` ưu tiên settings server hiện tại, sau đó mới dùng `storeSnapshot.logoUrl` của đơn cũ.

## 8. Test và quy trình bắt buộc sau mỗi sửa

```powershell
npm run test:booking-sync
npm run test:staff-sync
npm run test:timeline-alignment
npm run build
git diff --check
git add <files>
git commit -m "<message>"
git push origin HEAD
```

Build có thể gặp lỗi môi trường Windows `EPERM` khi Next tạo `.next`; phải báo đúng lỗi này, không ghi là build PASS. Các test PASS cũng phải ghi rõ từng test.

## 9. Cách cập nhật tài liệu sau mỗi thay đổi

- Thêm route/component mới vào cây hệ thống.
- Nếu đổi storage key/API, sửa bảng nguồn dữ liệu.
- Nếu đổi quyền, sửa phần permissions và luồng role.
- Nếu đổi upload/email/in hóa đơn, sửa đúng phần luồng tương ứng.
- Thêm một dòng vào nhật ký bên dưới với commit và test.

## Nhật ký thay đổi kiến trúc

- 2026-10-27: Tạo bản đồ kiến trúc và quy tắc đồng bộ để dùng làm tài liệu tham chiếu sau mỗi lần sửa.
