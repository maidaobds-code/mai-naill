import assert from "node:assert/strict";
import { appointmentConfirmationEmail } from "../../lib/appointmentEmail.js";

const booking = { id: "booking-language", date: "2026-11-02", start: "10:00", end: "11:00", customer: "Customer", service: "Gel", staff: "Mai", price: 3900, assignmentStatus: "ASSIGNED" };
const cases = [
  ["vi", "Xác nhận lịch hẹn", "Thông báo thay đổi nhân viên", "Hủy hẹn"],
  ["ja", "ご予約確定のお知らせ", "担当スタッフ変更のお知らせ", "予約をキャンセル"],
  ["en", "Appointment confirmation", "Nail artist change", "Cancel appointment"],
  ["zh", "预约确认", "服务人员变更通知", "取消预约"],
  ["ko", "예약 확정 안내", "담당 직원 변경 안내", "예약 취소"],
];

for (const [language, subject, changeTitle, cancel] of cases) {
  const result = appointmentConfirmationEmail({ booking, language, bookingUrl: "https://salon.example/booking", changeUrl: "https://salon.example/change", cancelUrl: "https://salon.example/cancel", staffChangeReason: "Localized reason" });
  assert.match(result.subject, new RegExp(subject));
  assert.match(result.html, new RegExp(changeTitle));
  assert.match(result.html, new RegExp(cancel));
}

const normal = appointmentConfirmationEmail({ booking, language: "ja", bookingUrl: "https://salon.example/booking" });
assert.doesNotMatch(normal.html, /別のスタッフを選ぶ／指名なし/);
assert.doesNotMatch(normal.html, /予約をキャンセル/);

console.log("PASS customer Gmail follows Vietnamese, Japanese, English, Chinese and Korean");
console.log("PASS email subject, status, labels and action buttons follow customer language");
console.log("PASS change/cancel actions remain conditional on staff replacement");
