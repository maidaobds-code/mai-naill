"use client";
import { useState } from "react";
import { staff as seedStaff } from "../lib/salonData";
import { useAccountStore } from "../lib/accountStore";
import { useStaffStore } from "../lib/staffStore";
import { normalizeExternalAccounts } from "../lib/staffStore";
import { tx } from "../lib/i18nClean";

const staffColors = [["Lavender", "#a78bfa"], ["Lilac", "#c084fc"], ["Bubblegum", "#f9a8d4"], ["Hồng neon", "#f472b6"], ["Peach", "#fdba74"], ["Coral", "#fb7185"], ["Lemon", "#fde047"], ["Butter", "#fef08a"], ["Mint", "#86efac"], ["Emerald", "#34d399"], ["Aqua", "#5eead4"], ["Sky", "#7dd3fc"], ["Blue", "#60a5fa"], ["Periwinkle", "#818cf8"], ["Cobalt", "#4f46e5"], ["Teal", "#0d9488"], ["Lime", "#a3e635"], ["Tangerine", "#fb923c"], ["Magenta", "#e879f9"], ["Plum", "#a855f7"]];

function newStaff(nextId) {
  return {
    id: `draft-${nextId}`,
    name: "",
    role: "staff",
    status: "Working",
    color: staffColors[(nextId - 1) % staffColors.length][1],
    external: { hotpepper: [], nailie: [], minimo: [] },
    email: "",
    accountPassword: "",
    credentialStatus: "Not saved",
    displayName: "",
    designationFee: 1100,
    bookingDescription: "",
    bookingVisible: true,
    avatarUrl: "",
    avatarFileName: "",
  };
}

const copy = {
  zh: { eyebrow: "员工账户", desc: "添加或删除员工、设置日历颜色并管理外部应用账号。", addStaff: "+ 添加员工", newStaff: "新员工", secureNote: "登录信息在服务器端加密保存，不会以明文保存在浏览器。", name: "姓名", namePlaceholder: "员工姓名", role: "角色", calendarColor: "日历颜色", loginEmail: "登录邮箱", password: "账户密码", passwordPlaceholder: "创建密码", staff: "员工", color: "颜色", login: "登录", newPassword: "新密码", owner: "店主", staffRole: "员工", customer: "客户", reset: "修改密码", accountReady: "账户已准备", needsPassword: "需要密码", passwordReset: "密码已修改" },
  ko: { eyebrow: "직원 계정", desc: "직원을 추가·삭제하고 캘린더 색상과 외부 앱 계정을 관리합니다.", addStaff: "+ 직원 추가", newStaff: "새 직원", secureNote: "로그인 정보는 서버에서 암호화되어 브라우저에 평문으로 저장되지 않습니다.", name: "이름", namePlaceholder: "직원 이름", role: "역할", calendarColor: "캘린더 색상", loginEmail: "로그인 이메일", password: "계정 비밀번호", passwordPlaceholder: "비밀번호 생성", staff: "직원", color: "색상", login: "로그인", newPassword: "새 비밀번호", owner: "점주", staffRole: "직원", customer: "고객", reset: "비밀번호 변경", accountReady: "계정 준비 완료", needsPassword: "비밀번호 필요", passwordReset: "비밀번호 변경 완료" },
  vi: { eyebrow: "TÀI KHOẢN NHÂN VIÊN", desc: "Thêm, xóa nhân viên, đặt màu lịch và liên kết tài khoản Nailie / Hot Pepper / minimo.", addStaff: "+ Thêm nhân viên", newStaff: "Nhân viên mới", secureNote: "Thông tin đăng nhập được lưu mã hóa phía máy chủ, không lưu dạng chữ thường trên trình duyệt.", name: "Tên", namePlaceholder: "Tên nhân viên", role: "Vai trò", calendarColor: "Màu lịch", loginEmail: "Email đăng nhập", password: "Mật khẩu tài khoản", passwordPlaceholder: "Tạo mật khẩu", staff: "Nhân viên", color: "Màu", login: "Đăng nhập", newPassword: "Mật khẩu mới", owner: "Chủ quán", staffRole: "Nhân viên", customer: "Khách hàng", reset: "Đổi mật khẩu", accountReady: "Tài khoản sẵn sàng", needsPassword: "Cần mật khẩu", passwordReset: "Đã đổi mật khẩu" },
  ja: { eyebrow: "スタッフアカウント", desc: "スタッフの追加・削除、カレンダー色、Nailie / Hot Pepper / minimo の連携を管理します。", addStaff: "+ スタッフ追加", newStaff: "新規スタッフ", secureNote: "ログイン情報はサーバー側で暗号化して保存し、ブラウザに平文では保存しません。", name: "名前", namePlaceholder: "スタッフ名", role: "役割", calendarColor: "カレンダー色", loginEmail: "ログインメール", password: "アカウントパスワード", passwordPlaceholder: "パスワード作成", staff: "スタッフ", color: "色", login: "ログイン", newPassword: "新しいパスワード", owner: "オーナー", staffRole: "スタッフ", customer: "顧客", reset: "パスワード変更", accountReady: "アカウント準備済み", needsPassword: "パスワード未設定", passwordReset: "パスワード変更済み" },
  en: { eyebrow: "STAFF ACCOUNTS", desc: "Add or remove staff, set calendar colors, and link Nailie / Hot Pepper / minimo accounts.", addStaff: "+ Add staff", newStaff: "New staff", secureNote: "Login details are encrypted on the server and are not stored as plain text in the browser.", name: "Name", namePlaceholder: "Staff name", role: "Role", calendarColor: "Calendar color", loginEmail: "Login email", password: "Account password", passwordPlaceholder: "Create password", staff: "Staff", color: "Color", login: "Login", newPassword: "New password", owner: "Owner", staffRole: "Staff", customer: "Customer", reset: "Change password", accountReady: "Account ready", needsPassword: "Needs password", passwordReset: "Password changed" },
};

export default function StaffManagement({ label = "Staff", embedded = false, language = "vi" }) {
  const c = copy[language] || copy.vi;
  const tc = (key) => tx(language, "common", key);
  const { staff, setStaff, syncStatus, syncError } = useStaffStore();
  const { accounts, upsertStaffAccount, resetPassword, updateAccountRole } = useAccountStore();
  const [draft, setDraft] = useState(newStaff(seedStaff.length + 1));
  const [resetDraft, setResetDraft] = useState({});
  const [roleDraft, setRoleDraft] = useState({});
  const [accountMessage, setAccountMessage] = useState("");
  const [bookingDraft, setBookingDraft] = useState(null);
  const [externalDraft, setExternalDraft] = useState(null);
  const bookingCopy = language === "ja" ? { title: "指名設定", edit: "表示設定", displayName: "表示名", fee: "指名料（円）", description: "お客様向け説明", image: "スタッフ画像", visible: "Web予約で表示", save: "指名設定を保存", cancel: "キャンセル" } : language === "en" ? { title: "Booking designation settings", edit: "Display settings", displayName: "Display name", fee: "Designation fee (JPY)", description: "Customer-facing description", image: "Staff image", visible: "Show in online booking", save: "Save designation settings", cancel: "Cancel" } : { title: "Cài đặt chỉ định nhân viên", edit: "Cài đặt hiển thị", displayName: "Tên hiển thị", fee: "Phí chỉ định (JPY)", description: "Mô tả hiển thị cho khách", image: "Ảnh nhân viên", visible: "Hiển thị trên Booking", save: "Lưu cài đặt chỉ định", cancel: "Hủy" };
  const draftChanged = Boolean(draft.name || draft.email || draft.accountPassword || draft.role !== "staff");

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateExternal(platform, value) {
    setDraft((current) => ({ ...current, external: { ...current.external, [platform]: typeof value === "function" ? value(current.external?.[platform] || []) : value } }));
  }

  function addExternalAccount(platform) {
    updateExternal(platform, [...(draft.external?.[platform] || []), ""]);
  }

  function removeExternalAccount(platform, index) {
    updateExternal(platform, (draft.external?.[platform] || []).filter((_, itemIndex) => itemIndex !== index));
  }

  async function addStaff() {
    if (!draft.name.trim() || !draft.email.trim()) return setAccountMessage("Vui lòng nhập tên và email đăng nhập.");
    if (!draft.accountPassword || draft.accountPassword.length < 6) return setAccountMessage("Mật khẩu phải có ít nhất 6 ký tự.");
    const uniqueId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const record = { ...draft, id: uniqueId, external: normalizeExternalAccounts(draft.external), credentialStatus: draft.accountPassword ? c.accountReady : c.needsPassword };
    try {
      await upsertStaffAccount(record, draft.accountPassword);
      setStaff((current) => [...current, record]);
      setDraft(newStaff(Date.now()));
      setAccountMessage("Đã tạo và đồng bộ tài khoản nhân viên.");
    } catch (error) { setAccountMessage(`Không thể tạo tài khoản: ${error.message}`); }
  }

  async function resetStaffPassword(member) {
    const password = resetDraft[member.id];
    if (!password || password.length < 6) return;
    // Re-upsert using the current staff identity so legacy records with duplicate IDs
    // are repaired instead of silently updating the wrong account.
    try {
      await upsertStaffAccount(member, password);
      setResetDraft((current) => ({ ...current, [member.id]: "" }));
      setStaff((current) => current.map((item) => item.id === member.id ? { ...item, credentialStatus: c.passwordReset } : item));
      setAccountMessage("Đã đổi và đồng bộ mật khẩu.");
    } catch (error) { setAccountMessage(`Không thể đổi mật khẩu: ${error.message}`); }
  }

  function deleteStaff(id) {
    setStaff((current) => current.filter((member) => member.id !== id));
    setAccountMessage("Đang xóa và đồng bộ danh sách nhân viên lên server…");
  }

  function editBookingDisplay(member) {
    setBookingDraft({ ...member, displayName: member.displayName || member.name, designationFee: Number(member.designationFee ?? 1100), bookingDescription: member.bookingDescription || "", bookingVisible: member.bookingVisible !== false, avatarUrl: member.avatarUrl || "", avatarFileName: member.avatarFileName || "" });
  }

  function editExternalAccounts(member) {
    const external = normalizeExternalAccounts(member.external);
    setExternalDraft({ id: member.id, name: member.name, external: Object.fromEntries(Object.entries(external).map(([platform, accounts]) => [platform, accounts.length ? accounts : [""]])) });
  }

  function updateExternalDraft(platform, index, value) {
    setExternalDraft((current) => ({ ...current, external: { ...current.external, [platform]: current.external[platform].map((item, itemIndex) => itemIndex === index ? value : item) } }));
  }

  function addExternalDraft(platform) {
    setExternalDraft((current) => ({ ...current, external: { ...current.external, [platform]: [...current.external[platform], ""] } }));
  }

  function removeExternalDraft(platform, index) {
    setExternalDraft((current) => ({ ...current, external: { ...current.external, [platform]: current.external[platform].filter((_, itemIndex) => itemIndex !== index) } }));
  }

  function saveExternalAccounts() {
    if (!externalDraft) return;
    const external = normalizeExternalAccounts(externalDraft.external);
    setStaff((current) => current.map((member) => member.id === externalDraft.id ? { ...member, external } : member));
    setAccountMessage(`Đã lưu liên kết tài khoản cho ${externalDraft.name}.`);
    setExternalDraft(null);
  }

  function uploadBookingAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBookingDraft((current) => ({ ...current, avatarUrl: reader.result, avatarFileName: file.name }));
    reader.readAsDataURL(file);
  }

  function saveBookingDisplay() {
    if (!bookingDraft) return;
    setStaff((current) => current.map((member) => member.id === bookingDraft.id ? { ...member, displayName: bookingDraft.displayName.trim() || member.name, designationFee: Math.max(0, Number(bookingDraft.designationFee || 0)), bookingDescription: bookingDraft.bookingDescription.trim(), bookingVisible: bookingDraft.bookingVisible, avatarUrl: bookingDraft.avatarUrl, avatarFileName: bookingDraft.avatarFileName } : member));
    setAccountMessage(`Đã lưu cài đặt hiển thị cho ${bookingDraft.displayName || bookingDraft.name}.`);
    setBookingDraft(null);
  }

  async function saveStaffRole(account) {
    if (!account) return;
    const role = roleDraft[account.id] || account.role;
    const result = await updateAccountRole(account.id, role);
    if (result.ok) {
      setStaff((current) => current.map((item) => item.email?.trim().toLowerCase() === account.email?.trim().toLowerCase() ? { ...item, role } : item));
      setRoleDraft((current) => { const next = { ...current }; delete next[account.id]; return next; });
    }
    setAccountMessage(result.ok ? "Đã lưu vai trò cho nhân viên." : result.message);
  }

  return (
    <>
      {!embedded && <div className="pageHead">
        <div>
          <p className="eyebrow">{c.eyebrow}</p>
          <h1>{label}</h1>
          <p>{c.desc}</p>
        </div>
        <button className="primary" onClick={addStaff}>{c.addStaff}</button>
      </div>}

      <section className="card staffEditor">
        <div className="sectionTitle"><div><h2>{embedded ? label : c.newStaff}</h2><p>{c.secureNote} Mọi thay đổi được tự động đồng bộ lên server.</p></div>{embedded && <button className="primary" onClick={addStaff}>{c.addStaff}</button>}</div>
        <div className="staffForm">
          <label>{c.name}<input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} placeholder={c.namePlaceholder} /></label>
          <label>{c.role}<select value={draft.role} onChange={(event) => updateDraft("role", event.target.value)}><option value="staff">{c.staffRole}</option><option value="manager">Quản lý</option><option value="owner">{c.owner}</option></select></label>
          <label>{c.calendarColor}<div className="staffColorPicker">{staffColors.map(([name, color]) => <button type="button" key={color} title={name} aria-label={name} className={draft.color === color ? "staffColorChoice active" : "staffColorChoice"} style={{ background: color }} onClick={() => updateDraft("color", color)}><span>{name}</span></button>)}</div></label>
          {[['hotpepper', 'Hot Pepper / SALON BOARD'], ['nailie', 'Nailie'], ['minimo', 'minimo']].map(([platform, title]) => <div className="externalAccountsField" key={platform}><span>{title} accounts</span>{(draft.external?.[platform] || ['']).map((accountId, index) => <div className="externalAccountRow" key={`${platform}-${index}`}><input value={accountId} onChange={(event) => updateExternal(platform, (draft.external?.[platform] || []).map((value, itemIndex) => itemIndex === index ? event.target.value : value))} placeholder={`${title} account ID ${index + 1}`} />{(draft.external?.[platform] || []).length > 1 && <button type="button" className="ghost" onClick={() => removeExternalAccount(platform, index)}>Xóa</button>}</div>)}<button type="button" className="ghost" onClick={() => addExternalAccount(platform)}>+ Thêm tài khoản</button></div>)}
          <label>{c.loginEmail}<input type="email" value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} placeholder="staff@example.com" /></label>
          <label>{c.password}<input type="password" value={draft.accountPassword} onChange={(event) => updateDraft("accountPassword", event.target.value)} placeholder={c.passwordPlaceholder} /></label>
        </div>
        {draftChanged && !accountMessage && <p className="storeNote">Bạn đã thay đổi thông tin. Hãy bấm “{c.addStaff.replace("+ ", "") }” để lưu.</p>}
        {accountMessage && <p className="storeNote">{accountMessage}</p>}
        {syncError && <p className="formError">{syncError} Phiên đăng nhập server có thể đã hết hạn.</p>}
        <p className="storeNote">Trạng thái dữ liệu: {syncStatus === "server" ? "đã đồng bộ server" : "chỉ đang lưu trên máy này"}.</p>
      </section>

      {bookingDraft && <section className="card staffBookingEditor">
        <div className="sectionTitle"><div><p className="eyebrow">ONLINE BOOKING</p><h2>{bookingCopy.title} · {bookingDraft.name}</h2><p>Thay đổi tại đây sẽ đồng bộ sang bước chọn nhân viên của khách.</p></div></div>
        <div className="staffBookingForm">
          <label>{bookingCopy.displayName}<input value={bookingDraft.displayName} onChange={(event) => setBookingDraft({ ...bookingDraft, displayName: event.target.value })} /></label>
          <label>{bookingCopy.fee}<input type="number" min="0" step="100" value={bookingDraft.designationFee} onChange={(event) => setBookingDraft({ ...bookingDraft, designationFee: Number(event.target.value) })} /></label>
          <label className="fullField">{bookingCopy.description}<textarea rows="3" value={bookingDraft.bookingDescription} onChange={(event) => setBookingDraft({ ...bookingDraft, bookingDescription: event.target.value })} placeholder="Ví dụ: Chuyên vẽ design, tư vấn mẫu theo yêu cầu…" /></label>
          <label>{bookingCopy.image}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadBookingAvatar} /></label>
          <label className="staffBookingToggle"><input type="checkbox" checked={bookingDraft.bookingVisible} onChange={(event) => setBookingDraft({ ...bookingDraft, bookingVisible: event.target.checked })} />{bookingCopy.visible}</label>
        </div>
        {bookingDraft.avatarUrl && <div className="staffBookingPreview"><img src={bookingDraft.avatarUrl} alt={bookingDraft.displayName || bookingDraft.name} /><div><strong>{bookingDraft.displayName || bookingDraft.name}</strong><span>Phí chỉ định ¥{Number(bookingDraft.designationFee || 0).toLocaleString("ja-JP")}</span><small>{bookingDraft.bookingDescription}</small></div></div>}
        <div className="staffBookingActions"><button className="ghost" type="button" onClick={() => setBookingDraft(null)}>{bookingCopy.cancel}</button><button className="primary" type="button" onClick={saveBookingDisplay}>{bookingCopy.save}</button></div>
      </section>}

      {externalDraft && <section className="card staffBookingEditor">
        <div className="sectionTitle"><div><p className="eyebrow">EXTERNAL ACCOUNTS</p><h2>Liên kết ứng dụng · {externalDraft.name}</h2><p>Một nhân viên có thể gán một hoặc nhiều tài khoản trên mỗi ứng dụng.</p></div></div>
        <div className="staffBookingForm">
          {[['hotpepper', 'Hot Pepper / SALON BOARD'], ['nailie', 'Nailie'], ['minimo', 'minimo']].map(([platform, title]) => <div className="externalAccountsField" key={platform}><strong>{title}</strong>{externalDraft.external[platform].map((accountId, index) => <div className="externalAccountRow" key={`${platform}-${index}`}><input value={accountId} onChange={(event) => updateExternalDraft(platform, index, event.target.value)} placeholder={`${title} account ID ${index + 1}`} />{externalDraft.external[platform].length > 1 && <button type="button" className="ghost" onClick={() => removeExternalDraft(platform, index)}>Xóa</button>}</div>)}<button type="button" className="ghost" onClick={() => addExternalDraft(platform)}>+ Thêm tài khoản</button></div>)}
        </div>
        <div className="staffBookingActions"><button className="ghost" type="button" onClick={() => setExternalDraft(null)}>Hủy</button><button className="primary" type="button" onClick={saveExternalAccounts}>Lưu liên kết</button></div>
      </section>}

      <section className="card tableWrap">
        <table>
          <thead><tr><th>{c.staff}</th><th>{c.color}</th><th>{c.login}</th><th>{tc("action")}</th></tr></thead>
          <tbody>{staff.map((member) => (
            <tr key={member.id}>
	              {(() => {
                const emailMatches = accounts.filter((item) => item.email && member.email && item.email.trim().toLowerCase() === member.email.trim().toLowerCase());
                const nameMatches = accounts.filter((item) => item.name === member.name || item.staffName === member.name);
                const account = emailMatches.length === 1 ? emailMatches[0] : accounts.find((item) => item.id === `staff-${member.id}`) || (nameMatches.length === 1 ? nameMatches[0] : null);
                const effectiveRole = account?.role || member.role || "staff";
	                return <>
              <td><div className="staffNameCell"><div className="avatar small" style={{ background: member.color }}>{member.name[0]}</div><div><strong>{member.name}</strong><span>{effectiveRole}</span></div></div></td>
              <td><span className="colorSwatch" style={{ background: member.color }} title={staffColors.find((item) => item[1] === member.color)?.[0] || member.color} /></td>
              <td><div className="staffLoginCell"><span className="pill active">{member.credentialStatus}</span><small>{account?.email || member.email || "-"}</small>{account && <select className="staffRoleSelect" value={roleDraft[account.id] || effectiveRole} onChange={(event) => setRoleDraft((current) => ({ ...current, [account.id]: event.target.value }))}><option value="owner">{c.owner}</option><option value="manager">Quản lý</option><option value="staff">{c.staffRole}</option><option value="customer">{c.customer}</option></select>}</div></td>
              <td><div className="staffAccountActions"><button className="ghost" onClick={() => editExternalAccounts(member)}>Hot Pepper / SALON BOARD accounts</button><button className="ghost bookingDisplayButton" onClick={() => editBookingDisplay(member)}>{bookingCopy.edit} · ¥{Number(member.designationFee || 0).toLocaleString("ja-JP")}</button><input type="password" value={resetDraft[member.id] || ""} onChange={(event) => setResetDraft({ ...resetDraft, [member.id]: event.target.value })} placeholder={c.newPassword} /><button className="ghost" onClick={() => resetStaffPassword(member)}>{c.reset}</button>{account && <button className="ghost" onClick={() => saveStaffRole(account)}>Lưu vai trò</button>}<button className="ghost dangerButton" onClick={() => deleteStaff(member.id)}>{tc("delete")}</button></div></td>
	                </>;
	              })()}
            </tr>
          ))}</tbody>
        </table>
      </section>
    </>
  );
}

