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
