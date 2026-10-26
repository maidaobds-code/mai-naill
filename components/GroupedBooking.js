"use client";
import { useState } from "react";
import {
  bookingGroups,
  fallbackBookingGroup,
  japanToday,
  localizedOption,
  localizedService,
} from "../lib/bookingMenu";
const yen = (n) => `¥${Number(n || 0).toLocaleString("ja-JP")}`;
export default function GroupedBooking({
  services,
  draft,
  updateDraft,
  chooseService,
  selectedService,
  options,
  setOptions,
  staff,
  submitBooking,
  message,
  language,
  settings = {},
  bookings = [],
  bookingOptionsCatalog = [],
}) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [consent, setConsent] = useState(false);
  const [search, setSearch] = useState("");
  const [staffOpen, setStaffOpen] = useState(false);
  const lang = ["ja", "vi", "zh", "ko"].includes(language) ? language : "en";
  const copy = (ja, vi, en) => (lang === "ja" ? ja : lang === "vi" ? vi : en);
  const groups = [...bookingGroups, fallbackBookingGroup];
  const eligibleStaff = staff.filter(
    (member) =>
      member.bookingVisible !== false &&
      (!selectedService?.staff?.length ||
        selectedService.staff.includes(member.name)),
  );
  const selectedStaff = eligibleStaff.find(
    (member) => member.name === draft.staff,
  );
  const designationFee = Number(selectedStaff?.designationFee || 0);
  const total =
    Number(selectedService?.price || 0) +
    options.reduce((sum, o) => sum + o.price, 0) +
    designationFee;
  const duration =
    Number(selectedService?.duration || 60) +
    options.reduce((sum, o) => sum + o.duration, 0);
  const steps = [
    copy("メニュー選択", "Chọn dịch vụ", "Services"),
    copy("日時選択", "Chọn thời gian", "Date & time"),
    copy("予約確認", "Xác nhận", "Review"),
    copy("予約完了", "Hoàn tất", "Complete"),
  ];
  function go(next) {
    setStep(next);
    document
      .getElementById("online-booking")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function toggle(option) {
    setOptions((current) =>
      current.some((o) => o.id === option.id)
        ? current.filter((o) => o.id !== option.id)
        : [
            ...current.filter(
              (o) => option.id === "mai-option-1" || o.id === "mai-option-1",
            ),
            option,
          ],
    );
  }
  const toMinutes = (value) => { const [h, m] = String(value || "").split(":").map(Number); return h * 60 + m; };
  const openMinutes = toMinutes(settings.openTime || "09:00");
  const closeMinutes = toMinutes(settings.closeTime || "23:00");
  const closed = (time, end) => (settings.closedPeriods || []).some((period) => {
    const match = String(period).match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    return match && match[1] === draft.date && toMinutes(time) < toMinutes(match[3]) && toMinutes(end) > toMinutes(match[2]);
  });
  const isStaffClosed = (member, time, end) => (settings.staffClosedPeriods || []).some((period) => {
    const match = String(period).match(/^([^\s]+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    return match && member && String(match[1]) === String(member.id) && match[2] === draft.date && toMinutes(time) < toMinutes(match[4]) && toMinutes(end) > toMinutes(match[3]);
  });
  const hasStaffClosureOnDate = (member) => (settings.staffClosedPeriods || []).some((period) => {
    const match = String(period).match(/^([^\s]+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    return match && member && String(match[1]) === String(member.id) && match[2] === draft.date;
  });
  const selectedEnd = draft.time ? `${String(Math.floor((toMinutes(draft.time) + duration) / 60)).padStart(2, "0")}:${String((toMinutes(draft.time) + duration) % 60).padStart(2, "0")}` : "";
  const staffBusy = (member, time, end) => bookings.some((booking) => booking.date === draft.date && String(booking.staffId || booking.staff) === String(member.id || member.name) && !["cancelled", "completed"].includes(String(booking.status).toLowerCase()) && toMinutes(booking.start) < toMinutes(end) && toMinutes(booking.end) > toMinutes(time));
  const times = Array.from({ length: 48 }, (_, i) => {
    const m = openMinutes + i * 30;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  }).filter((time) => {
    const [h, m] = time.split(":").map(Number);
    return (
      h * 60 + m + duration <= closeMinutes &&
      !closed(time, `${String(Math.floor((h * 60 + m + duration) / 60)).padStart(2, "0")}:${String((h * 60 + m + duration) % 60).padStart(2, "0")}`) &&
      !(draft.staff && isStaffClosed(selectedStaff, time, `${String(Math.floor((h * 60 + m + duration) / 60)).padStart(2, "0")}:${String((h * 60 + m + duration) % 60).padStart(2, "0")}`)) &&
      (draft.staff ? !staffBusy(selectedStaff, time, `${String(Math.floor((h * 60 + m + duration) / 60)).padStart(2, "0")}:${String((h * 60 + m + duration) % 60).padStart(2, "0")}`) : eligibleStaff.some((member) => !isStaffClosed(member, time, `${String(Math.floor((h * 60 + m + duration) / 60)).padStart(2, "0")}:${String((h * 60 + m + duration) % 60).padStart(2, "0")}`) && !staffBusy(member, time, `${String(Math.floor((h * 60 + m + duration) / 60)).padStart(2, "0")}:${String((h * 60 + m + duration) % 60).padStart(2, "0")}`))) &&
      !(draft.staff && bookings.some((booking) => booking.date === draft.date && String(booking.staffId || booking.staff) === String(selectedStaff?.id || draft.staff) && !["cancelled", "completed"].includes(String(booking.status).toLowerCase()) && toMinutes(booking.start) < h * 60 + m + duration && toMinutes(booking.end) > h * 60 + m)) &&
      (draft.date !== japanToday() ||
        new Date(`${draft.date}T${time}:00+09:00`) > new Date())
    );
  });
  return (
    <section id="online-booking" className="maiBooking">
      <ol
        className="maiSteps"
        aria-label={copy("予約の流れ", "Các bước đặt lịch", "Booking progress")}
      >
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={(complete ? 3 : step) === index ? "step" : undefined}
            className={(complete ? 3 : step) >= index ? "active" : ""}
          >
            <span>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {complete ? (
        <div className="maiPanel maiDone" role="status">
          <span className="maiDoneIcon">✓</span>
          <h2>
            {copy(
              "予約を受け付けました",
              "Đã tiếp nhận lịch hẹn",
              "Appointment received",
            )}
          </h2>
          <p>{message}</p>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setComplete(false);
              setConsent(false);
              go(0);
            }}
          >
            {copy("メニューに戻る", "Quay lại menu", "Back to menu")}
          </button>
        </div>
      ) : (
        <div className="maiLayout">
          <div className="maiMain">
            {step === 0 && (
              <>
                <div className="maiSectionHead">
                  <div>
                    <p className="eyebrow">SERVICE MENU</p>
                    <h2>
                      {copy(
                        "メニューを選択してください",
                        "Chọn dịch vụ yêu thích",
                        "Find your next nail look",
                      )}
                    </h2>
                    <p>
                      {copy(
                        "表示価格は円です。",
                        "Giá niêm yết bằng Yên Nhật.",
                        "All prices in Japanese yen.",
                      )}
                    </p>
                  </div>
                  <input
                    aria-label={copy(
                      "メニュー検索",
                      "Tìm dịch vụ",
                      "Search services",
                    )}
                    placeholder={copy(
                      "メニュー検索…",
                      "Tìm dịch vụ…",
                      "Search services…",
                    )}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <nav
                  className="maiCategoryNav"
                  aria-label={copy(
                    "サービスカテゴリー",
                    "Nhóm dịch vụ",
                    "Service categories",
                  )}
                >
                  {groups
                    .filter((g) => services.some((s) => s.category === g.id))
                    .map((g) => (
                      <a key={g.id} href={`#mai-${g.id}`}>
                  {g[lang] || g.en}
                      </a>
                    ))}
                </nav>
                {groups.map((group) => {
                  const list = services.filter(
                    (s) =>
                      (s.category || "existing") === group.id &&
                      localizedService(s, lang)
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  );
                  return (
                    list.length > 0 && (
                      <section
                        className="maiPanel maiGroup"
                        id={`mai-${group.id}`}
                        key={group.id}
                      >
                        <h3>
                          <span>{group.mark}</span>
                      {group[lang] || group.en}
                          <small>{list.length}</small>
                        </h3>
                        {list.map((service) => (
                          <button
                            className={`maiService ${selectedService?.id === service.id ? "selected" : ""}`}
                            aria-pressed={selectedService?.id === service.id}
                            key={service.id}
                            type="button"
                            onClick={() => {
                              chooseService(service);
                              setOptions([]);
                            }}
                          >
                            {service.imageUrl ? (
                              <img
                                className="maiServiceImage"
                                src={service.imageUrl}
                                alt=""
                              />
                            ) : (
                              <span className="maiRadio" />
                            )}
                            <span className="maiServiceText">
                              <strong>{localizedService(service, lang)}</strong>
                              {service.description && (
                                <small>
                                  {service[
                                    `description${lang === "ja" ? "Ja" : lang === "en" ? "En" : "Vi"}`
                                  ] || service.description}
                                </small>
                              )}
                              <small>
                                {service.duration}{" "}
                                {copy(
                                  "分（目安）",
                                  "phút (ước tính)",
                                  "min (estimated)",
                                )}
                              </small>
                            </span>
                            <b>{yen(service.price)}</b>
                          </button>
                        ))}
                      </section>
                    )
                  );
                })}
                {!services.some((s) =>
                  s.name.toLowerCase().includes(search.toLowerCase()),
                ) && (
                  <p role="status">
                    {copy(
                      "該当するメニューがありません",
                      "Không tìm thấy dịch vụ",
                      "No services found",
                    )}
                  </p>
                )}
                {selectedService &&
                  !["removal", "repair"].includes(selectedService.category) && (
                    <section className="maiPanel maiOptions">
                      <h3>
                        {copy("オプション", "Dịch vụ bổ sung", "Add-ons")}
                      </h3>
                      <label>
                        <input
                          type="radio"
                          checked={!options.length}
                          onChange={() => setOptions([])}
                        />
                        {copy("なし", "Không thêm", "None")}
                      </label>
                      {bookingOptionsCatalog.map((o) => (
                        <label key={o.id}>
                          <input
                            type="checkbox"
                            checked={options.some((item) => item.id === o.id)}
                            onChange={() => toggle(o)}
                          />
                          <span>{localizedOption(o, lang)}</span>
                          <b>{yen(o.price)}</b>
                        </label>
                      ))}
                    </section>
                  )}
                <p className="maiHint">
                  {copy(
                    "所要時間は目安です。付替オフは1種類選択できます。",
                    "Thời lượng là ước tính. Chọn tối đa một loại tháo móng; có thể thêm đổi gel Para.",
                    "Durations are estimates. Choose one removal type, plus Para gel if desired.",
                  )}
                </p>
              </>
            )}
            {step === 1 && (
              <section className="maiPanel maiDetails">
                <h2>{steps[1]}</h2>
                <div className="maiFields maiScheduleFields">
                  <label>
                    {copy("来店日", "Ngày đến", "Visit date")}
                    <input
                      type="date"
                      required
                      min={japanToday()}
                      value={draft.date}
                      onChange={(e) => {
                        updateDraft("date", e.target.value);
                        updateDraft("time", "");
                      }}
                    />
                  </label>
                  <div className="maiStaffField"><span>{copy("指名するスタッフ", "Chọn nhân viên mong muốn", "Choose a staff member")}</span><button type="button" className="maiStaffBar" onClick={() => setStaffOpen(true)}><span className="maiStaffAvatar noPreference">{draft.staff ? "✓" : "○"}</span><span><strong>{draft.staff || copy("指名なし", "Không chỉ định", "No preference")}</strong><small>{draft.staff ? copy("指名スタッフを選択中", "Đã chọn nhân viên", "Selected artist") : copy("タップしてスタッフを選択", "Chạm để chọn nhân viên", "Tap to choose an artist")}</small></span><b>{draft.staff ? yen(designationFee) : "¥0"}　›</b></button></div>
                </div>
                {staffOpen && <div className="maiStaffPopover" role="dialog" aria-modal="true">
                  <div className="maiStaffPopoverHead"><strong>{copy("指名するスタッフを選択してください。", "Chọn nhân viên mong muốn", "Choose a staff member")}</strong><button type="button" onClick={() => setStaffOpen(false)} aria-label={copy("閉じる", "Đóng", "Close")}>×</button></div>
                  <div className="maiStaffPicker">
                  <button
                    type="button"
                    className={!draft.staff ? "selected" : ""}
                    aria-pressed={!draft.staff}
                    onClick={() => { updateDraft("staff", ""); setStaffOpen(false); }}
                  >
                    <span className="maiStaffAvatar noPreference">○</span>
                    <span>
                      <strong>
                        {copy("指名なし", "Không chỉ định", "No preference")}
                      </strong>
                      <small>
                        {copy(
                          "サロンが担当者を選びます",
                          "Salon sẽ chọn nhân viên",
                          "The salon will assign staff",
                        )}
                      </small>
                    </span>
                    <b>¥0</b>
                  </button>
                  {eligibleStaff.map((member) => {
                    const closedAtSelectedTime = Boolean(draft.time && selectedEnd && isStaffClosed(member, draft.time, selectedEnd));
                    const hasClosure = hasStaffClosureOnDate(member);
                    return (
                    <button
                      type="button"
                      key={member.id}
                      className={`${draft.staff === member.name ? "selected" : ""}${closedAtSelectedTime ? " staffClosedChoice" : ""}`.trim()}
                      aria-pressed={draft.staff === member.name}
                      aria-disabled={closedAtSelectedTime}
                      disabled={closedAtSelectedTime}
                      onClick={() => { updateDraft("staff", member.name); setStaffOpen(false); }}
                    >
                      {member.avatarUrl ? (
                        <img
                          className="maiStaffAvatar"
                          src={member.avatarUrl}
                          alt=""
                        />
                      ) : (
                        <span
                          className="maiStaffAvatar"
                          style={{ background: member.color }}
                        >
                          {(member.displayName || member.name)[0]}
                        </span>
                      )}
                      <span>
                        <strong>{member.displayName || member.name}</strong>
                        <small>
                          {closedAtSelectedTime ? copy("この時間は受付停止中", "Đang đóng lịch trong giờ này", "Closed for this time") : hasClosure ? copy("この日は受付停止時間あり", "Có thời gian đóng lịch trong ngày", "Has closed hours on this date") : member.bookingDescription || member.role || "Nailist"}
                        </small>
                      </span>
                      <b>{closedAtSelectedTime ? copy("受付停止", "Đóng lịch", "Closed") : yen(member.designationFee)}</b>
                    </button>
                  );})}
                  </div>
                </div>}
                <h3>
                  {copy(
                    "来店時間（日本時間）",
                    "Giờ đến (giờ Nhật Bản)",
                    "Visit time (Japan time)",
                  )}
                </h3>
                <div className="maiTimes">
                  {times.map((time) => (
                    <button
                      type="button"
                      key={time}
                      aria-pressed={draft.time === time}
                      className={draft.time === time ? "selected" : ""}
                      onClick={() => updateDraft("time", time)}
                    >
                      {time}
                    </button>
                  ))}
                </div>
                {!times.length && (
                  <p>
                    {copy(
                      "別の日付を選択してください",
                      "Vui lòng chọn ngày khác",
                      "Please choose another date",
                    )}
                  </p>
                )}
                <p className="maiHint">
                  {copy(
                    "予約状況により調整をお願いする場合があります。",
                    "Salon có thể liên hệ điều chỉnh theo tình trạng lịch hẹn.",
                    "The salon may contact you to adjust based on availability.",
                  )}
                </p>
              </section>
            )}
            {step === 2 && (
              <form
                id="mai-confirm"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!consent || submitting) return;
                  if (
                    !times.includes(draft.time) ||
                    draft.date < japanToday()
                  ) {
                    go(1);
                    return;
                  }
                  setSubmitting(true);
                  try {
                    const ok = await submitBooking(event);
                    if (ok) setComplete(true);
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                <section className="maiPanel maiDetails">
                  <h2>
                    {copy("お客様情報", "Thông tin khách hàng", "Your details")}
                  </h2>
                  <div className="maiFields">
                    {[
                      ["customer", copy("お名前", "Họ tên", "Name"), "text"],
                      [
                        "phone",
                        copy("電話番号", "Số điện thoại", "Phone"),
                        "tel",
                      ],
                      [
                        "email",
                        copy("メールアドレス", "Email", "Email"),
                        "email",
                      ],
                    ].map(([field, label, type]) => (
                      <label key={field}>
                        {label}
                        <input
                          required
                          type={type}
                          autoComplete={
                            field === "customer"
                              ? "name"
                              : field === "phone"
                                ? "tel"
                                : "email"
                          }
                          value={draft[field]}
                          onChange={(e) => updateDraft(field, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </section>
                <section className="maiPanel maiDetails">
                  <h2>
                    {copy(
                      "ご来店に際しての注意事項",
                      "Lưu ý khi đến salon",
                      "Before your visit",
                    )}
                  </h2>
                  <div className="maiPolicy" lang={lang}><p style={{ whiteSpace: "pre-line" }}>{settings[`bookingNotice${lang === "ja" ? "Ja" : lang === "zh" ? "Zh" : lang === "ko" ? "Ko" : lang === "en" ? "En" : "Vi"}`] || settings.bookingNotice || copy("予約の変更・キャンセルは前日営業時間内にご連絡ください。", "Vui lòng liên hệ salon trong giờ làm việc trước ngày hẹn nếu cần đổi hoặc hủy lịch.", "Please contact the salon during business hours before your appointment to change or cancel.")}</p></div>
                  <label className="maiConsent">
                    <input
                      type="checkbox"
                      required
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    {copy(
                      "注意事項を確認し、予約内容に同意します",
                      "Tôi đã đọc lưu ý và đồng ý với nội dung đặt lịch",
                      "I have read the policies and agree to the booking details",
                    )}
                  </label>
                  <label className="maiConsent marketingConsent">
                    <span>{copy("お得な情報やイベントのお知らせ", "Nhận email giảm giá và sự kiện", "Discount and event emails")}</span>
                    <span className="marketingChoices"><button type="button" className={draft.marketingConsent === true ? "selected" : ""} onClick={() => updateDraft("marketingConsent", true)}>{copy("はい", "Có", "Yes")}</button><button type="button" className={draft.marketingConsent === false ? "selected" : ""} onClick={() => updateDraft("marketingConsent", false)}>{copy("いいえ", "Không", "No")}</button></span>
                  </label>
                </section>
              </form>
            )}
          </div>
          <aside className="maiSummary">
            <div className="maiPanel maiDetails">
              <p className="eyebrow">YOUR APPOINTMENT</p>
              <h2>
                {copy("予約内容", "Lịch hẹn của bạn", "Your appointment")}
              </h2>
              {selectedService ? (
                <>
                  <strong>{selectedService.name}</strong>
                  <p>{yen(selectedService.price)}</p>
                  {options.map((o) => (
                    <div className="maiSummaryLine" key={o.id}>
                      <span>{o.name}</span>
                      <b>{yen(o.price)}</b>
                    </div>
                  ))}
                  {selectedStaff && (
                    <div className="maiSummaryLine">
                      <span>
                        {copy("指名料", "Phí chỉ định", "Designation fee")} ·{" "}
                        {selectedStaff.displayName || selectedStaff.name}
                      </span>
                      <b>{yen(designationFee)}</b>
                    </div>
                  )}
                  <div className="maiSummaryLine">
                    <span>
                      {copy(
                        "所要時間（目安）",
                        "Thời lượng ước tính",
                        "Estimated duration",
                      )}
                    </span>
                    <b>{duration} min</b>
                  </div>
                  {step > 0 && (
                    <p>
                      {draft.date} · {draft.time || "—"} JST
                      <br />
                      {selectedStaff?.displayName ||
                        draft.staff ||
                        copy("指名なし", "Không chỉ định", "No preference")}
                    </p>
                  )}
                  <div className="maiTotal">
                    <span>{copy("合計", "Tổng cộng", "Total")}</span>
                    <strong>{yen(total)}</strong>
                  </div>
                </>
              ) : (
                <p>
                  {copy(
                    "メニューを選択してください",
                    "Vui lòng chọn dịch vụ",
                    "Choose a service",
                  )}
                </p>
              )}
              {step < 2 ? (
                <button
                  type="button"
                  className="primary"
                  disabled={
                    !selectedService ||
                    (step === 1 &&
                      (!draft.date ||
                        draft.date < japanToday() ||
                        !times.includes(draft.time)))
                  }
                  onClick={() => go(step + 1)}
                >
                  {copy("次へ", "Tiếp tục", "Continue")} →
                </button>
              ) : (
                <button
                  className="primary"
                  type="submit"
                  form="mai-confirm"
                  disabled={!consent || typeof draft.marketingConsent !== "boolean" || submitting}
                >
                  {submitting
                    ? "…"
                    : copy(
                        "同意して予約する",
                        "Đồng ý và đặt lịch",
                        "Agree & book",
                      )}
                </button>
              )}
              {step > 0 && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => go(step - 1)}
                >
                  ← {copy("戻る", "Quay lại", "Back")}
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
      {!complete && message && (
        <p className="maiNotice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
