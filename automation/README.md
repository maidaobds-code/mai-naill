# SALON BOARD 24/7 worker

Worker này điều khiển Chrome bằng giao diện SALON BOARD, không dùng API.
Chạy trên máy Windows/VPS luôn bật, với profile Chrome riêng để giữ phiên đăng
nhập. `SALONBOARD_DRY_RUN` mặc định là `true` để không đóng lịch ngoài ý muốn.

## Chuẩn bị

```powershell
npm install
$env:SALONBOARD_STAFF_RULES='{"Mai":{"closeRemaining":true},"Yuki":{"closeRemaining":true}}'
$env:SALONBOARD_DRY_RUN='true'
npm run automation:salonboard
```

Mở Chrome trên máy worker, đăng nhập SALON BOARD bằng tay một lần, sau đó giữ
profile ở `SALONBOARD_PROFILE_DIR`. Nếu gặp đăng xuất hoặc CAPTCHA, worker ghi
`LOGIN_REQUIRED`/lỗi vào log và không tự vượt qua.

## Chạy nền trên Windows

Tạo Scheduled Task chạy khi máy khởi động hoặc khi tài khoản automation đăng
nhập. Không dùng tài khoản cá nhân dùng cho công việc khác. Giới hạn RDP bằng
firewall/VPN và đặt cảnh báo khi process dừng.

Nhánh ghi lịch thật hiện bị khóa có chủ ý. Cần xác nhận các selector của trang
`シフト設定` trên tài khoản thật, kiểm thử từng nhân viên, rồi mới bật logic
block/unblock.

## Nailie worker

Nailie chạy bằng worker riêng để có thể chạy song song với SALON BOARD:

```powershell
$env:NAILIE_STAFF_MAPPING='{"Mai":["nailie-staff-id"],"Yuki":["another-id"]}'
$env:NAILIE_DRY_RUN='true'
npm run automation:nailie
```

Nailie dùng một tài khoản salon chung; mỗi nhân viên Mainaill được mapping với
tên hoặc mã nhân viên tương ứng trên Nailie. Worker đọc trang lịch, đối chiếu
mapping từng nhân viên và tạo kế hoạch đóng
khung đã có booking/mở khung còn lại. `NAILIE_DRY_RUN` mặc định là `true`.
Phần ghi thật chỉ được bật sau khi xác nhận selector ô lịch và nút lưu của
tài khoản Nailie thực tế; worker không vượt CAPTCHA hoặc cơ chế bảo vệ của
website.

Trang mặc định là `mysalon/staff-schedule` với ngày hiện tại. Có thể kiểm thử
một ngày cụ thể bằng `NAILIE_SCHEDULE_URL`, ví dụ:

```powershell
$env:NAILIE_SCHEDULE_URL='https://salon.nailie.jp/mysalon/staff-schedule?page=1&date=2026-11-03&showBooking=true'
```

## Khôi phục đăng nhập HOT PEPPER (Bot 0.1.7)

Trong Bot Manager, nhập ID và mật khẩu trong **Tự đăng nhập lại HOT PEPPER**,
lưu cấu hình rồi dừng/khởi động lại worker SALON BOARD. Mật khẩu được mã hóa
bằng Electron safeStorage của Windows, không được đưa trở lại giao diện.
Để trống mật khẩu khi lưu sẽ giữ nguyên mật khẩu cũ; dùng tùy chọn xóa để bỏ nó.
Bot thử tối đa hai lần mỗi lần mất phiên; CAPTCHA/xác minh cần đăng nhập thủ công.
Khi đăng nhập thành công, số lần thử được đặt lại cho sự cố tiếp theo.

Worker không xử lý task hoặc quét lịch trong lúc đã phát hiện hết phiên.
Cảnh báo được gửi ngay khi phát hiện hết phiên hoặc sau hai phút chờ đăng nhập
ở lần khởi động. Gửi thất bại được thử lại, cách nhau tối thiểu một phút;
chỉ đánh dấu đã báo khi API và dịch vụ email cùng xác nhận thành công.

Server cần BOOKING_SYNC_SECRET (hoặc CRON_SECRET), RESEND_API_KEY, địa chỉ gửi
RESEND_FROM/EMAIL_FROM và ít nhất một email admin trong BOT_ALERT_EMAIL,
ADMIN_EMAIL hoặc ADMIN_USER. Thay đổi API cần được triển khai cùng bản Bot.
Không đưa mật khẩu/khóa bí mật vào log hay Git.

Kiểm thử: `node artifacts/booking-qa/bot-alert-check.mjs` và
`node artifacts/booking-qa/bot-recovery-check.mjs`.

Bot 0.1.8 hỗ trợ nút đăng nhập dạng liên kết `a[onclick*="dologin"]` của SALON BOARD.
Nếu không lưu tài khoản trong Bot Manager, bot có thể bấm đăng nhập khi cả hai ô
đã được Chrome hoặc người dùng điền sẵn; bot không đọc mật khẩu ra log hay lưu lại.
Kiểm thử form bằng trình duyệt thật: `node artifacts/booking-qa/salonboard-login-form-check.mjs`.

Bot 0.1.9 nhận diện thông báo hết phiên cả trên URL có chữ login và khi thông báo
bị xuống dòng. Khi phát hiện, bot quay về form và thử tự đăng nhập ngay trước
khi tiếp tục quét hoặc xử lý task. Giữ phiên cũng kiểm tra lại xác thực sau điều hướng.

## Quét phân tán (Bot 0.1.10)

Không còn quét dồn 93 ngày cuối ngày. Mỗi vòng xử lý task mới/sửa/hủy trước,
sau đó quét đúng một ngày. 31 ngày gần được quét luân phiên; mỗi 10 phút xen
một ngày xa trong ngày thứ 32–93. Một vòng ngày xa mất khoảng 10–11 giờ khi
máy chạy liên tục. Không quét bù dồn sau khi ngủ hoặc mất mạng; ngày quét lỗi
được thử lại, chỉ tăng con trỏ khi cả lịch hẹn và khung đóng đọc thành công.
Ngày lịch được tính theo múi giờ Nhật. Khởi động lại bắt đầu vòng mới.

Cấu hình tùy chọn: SALONBOARD_DAY_SCAN_DAYS (31),
SALONBOARD_SCAN_HORIZON_DAYS (93), SALONBOARD_DISTANT_SCAN_INTERVAL_MS (600000).
Các biến END_OF_DAY cũ không còn được sử dụng. Nailie giữ nguyên chế độ hiện tại.
