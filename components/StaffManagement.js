"use client";
import { useState } from "react";
import { staff as seedStaff } from "../lib/salonData";
import { useAccountStore } from "../lib/accountStore";
import { useStaffStore } from "../lib/staffStore";
import { tx } from "../lib/i18nClean";

const staffColors = ["#7c3aed", "#ec4899", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444"];

function newStaff(nextId) {
  return {
    id: nextId,
    name: "",
    role: "Nailist",
    status: "Working",
    color: staffColors[(nextId - 1) % staffColors.length],
    external: { hotpepper: "", nailie: "", minimo: "" },
    email: "",
    accountPassword: "",
    credentialStatus: "Not saved",
  };
}

const copy = {
  vi: { eyebrow: "TÀI KHOẢN NHÂN VIÊN", desc: "Thêm, xóa nhân viên, đặt màu lịch và liên kết tài khoản Nailie / Hot Pepper / minimo.", addStaff: "+ Thêm nhân viên", newStaff: "Nhân viên mới", secureNote: "Thông tin đăng nhập được lưu mã hóa phía máy chủ, không lưu dạng chữ thường trên trình duyệt.", name: "Tên", namePlaceholder: "Tên nhân viên", role: "Vai trò", calendarColor: "Màu lịch", loginEmail: "Email đăng nhập", password: "Mật khẩu tài khoản", passwordPlaceholder: "Tạo mật khẩu", staff: "Nhân viên", color: "Màu", login: "Đăng nhập", newPassword: "Mật khẩu mới", owner: "Chủ quán", staffRole: "Nhân viên", customer: "Khách hàng", reset: "Reset", accountReady: "Tài khoản sẵn sàng", needsPassword: "Cần mật khẩu", passwordReset: "Đã reset mật khẩu" },
  ja: { eyebrow: "スタッフアカウント", desc: "スタッフの追加・削除、カレンダー色、Nailie / Hot Pepper / minimo の連携を管理します。", addStaff: "+ スタッフ追加", newStaff: "新規スタッフ", secureNote: "ログイン情報はサーバー側で暗号化して保存し、ブラウザに平文では保存しません。", name: "名前", namePlaceholder: "スタッフ名", role: "役割", calendarColor: "カレンダー色", loginEmail: "ログインメール", password: "アカウントパスワード", passwordPlaceholder: "パスワード作成", staff: "スタッフ", color: "色", login: "ログイン", newPassword: "新しいパスワード", owner: "オーナー", staffRole: "スタッフ", customer: "顧客", reset: "リセット", accountReady: "アカウント準備済み", needsPassword: "パスワード未設定", passwordReset: "パスワード再設定済み" },
  en: { eyebrow: "STAFF ACCOUNTS", desc: "Add or remove staff, set calendar colors, and link Nailie / Hot Pepper / minimo accounts.", addStaff: "+ Add staff", newStaff: "New staff", secureNote: "Login details are encrypted on the server and are not stored as plain text in the browser.", name: "Name", namePlaceholder: "Staff name", role: "Role", calendarColor: "Calendar color", loginEmail: "Login email", password: "Account password", passwordPlaceholder: "Create password", staff: "Staff", color: "Color", login: "Login", newPassword: "New password", owner: "Owner", staffRole: "Staff", customer: "Customer", reset: "Reset", accountReady: "Account ready", needsPassword: "Needs password", passwordReset: "Password reset" },
};

export default function StaffManagement({ label = "Staff", embedded = false, language = "vi" }) {
  const c = copy[language] || copy.vi;
  const tc = (key) => tx(language, "common", key);
  const { staff, setStaff } = useStaffStore();
  const { accounts, upsertStaffAccount, resetPassword, updateAccountRole } = useAccountStore();
  const [draft, setDraft] = useState(newStaff(seedStaff.length + 1));
  const [resetDraft, setResetDraft] = useState({});

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateExternal(platform, value) {
    setDraft((current) => ({ ...current, external: { ...current.external, [platform]: value } }));
  }

  async function addStaff() {
    if (!draft.name.trim()) return;
    const record = { ...draft, credentialStatus: draft.accountPassword ? c.accountReady : c.needsPassword };
    await upsertStaffAccount(record, draft.accountPassword);
    setStaff((current) => [...current, record]);
    setDraft(newStaff(draft.id + 1));
  }

  async function resetStaffPassword(member) {
    const password = resetDraft[member.id];
    const account = accounts.find((item) => item.id === `staff-${member.id}`);
    if (!password || !account) return;
    await resetPassword(account.id, password);
    setResetDraft((current) => ({ ...current, [member.id]: "" }));
    setStaff((current) => current.map((item) => item.id === member.id ? { ...item, credentialStatus: c.passwordReset } : item));
  }

  function deleteStaff(id) {
    setStaff((current) => current.filter((member) => member.id !== id));
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
        <div className="sectionTitle"><div><h2>{embedded ? label : c.newStaff}</h2><p>{c.secureNote}</p></div>{embedded && <button className="primary" onClick={addStaff}>{c.addStaff}</button>}</div>
        <div className="staffForm">
          <label>{c.name}<input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} placeholder={c.namePlaceholder} /></label>
          <label>{c.role}<input value={draft.role} onChange={(event) => updateDraft("role", event.target.value)} /></label>
          <label>{c.calendarColor}<select value={draft.color} onChange={(event) => updateDraft("color", event.target.value)}>{staffColors.map((color) => <option key={color} value={color}>{color}</option>)}</select></label>
          <label>Hot Pepper account<input value={draft.external.hotpepper} onChange={(event) => updateExternal("hotpepper", event.target.value)} placeholder="HP staff/account id" /></label>
          <label>Nailie account<input value={draft.external.nailie} onChange={(event) => updateExternal("nailie", event.target.value)} placeholder="Nailie staff/account id" /></label>
          <label>minimo account<input value={draft.external.minimo} onChange={(event) => updateExternal("minimo", event.target.value)} placeholder="minimo staff/account id" /></label>
          <label>{c.loginEmail}<input type="email" value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} placeholder="staff@example.com" /></label>
          <label>{c.password}<input type="password" value={draft.accountPassword} onChange={(event) => updateDraft("accountPassword", event.target.value)} placeholder={c.passwordPlaceholder} /></label>
        </div>
      </section>

      <section className="card tableWrap">
        <table>
          <thead><tr><th>{c.staff}</th><th>{c.color}</th><th>Hot Pepper</th><th>Nailie</th><th>minimo</th><th>{c.login}</th><th>{tc("action")}</th></tr></thead>
          <tbody>{staff.map((member) => (
            <tr key={member.id}>
	              {(() => {
	                const account = accounts.find((item) => item.id === `staff-${member.id}` || item.email === member.email);
	                return <>
              <td><div className="staffNameCell"><div className="avatar small" style={{ background: member.color }}>{member.name[0]}</div><div><strong>{member.name}</strong><span>{member.role}</span></div></div></td>
              <td><span className="colorSwatch" style={{ background: member.color }} /></td>
              <td>{member.external.hotpepper || "-"}</td>
              <td>{member.external.nailie || "-"}</td>
              <td>{member.external.minimo || "-"}</td>
	              <td><div className="staffLoginCell"><span className="pill active">{member.credentialStatus}</span><small>{account?.email || member.email || "-"}</small>{account && <select className="staffRoleSelect" value={account.role} onChange={(event) => updateAccountRole(account.id, event.target.value)}><option value="owner">{c.owner}</option><option value="staff">{c.staffRole}</option><option value="customer">{c.customer}</option></select>}</div></td>
              <td><div className="staffAccountActions"><input type="password" value={resetDraft[member.id] || ""} onChange={(event) => setResetDraft({ ...resetDraft, [member.id]: event.target.value })} placeholder={c.newPassword} /><button className="ghost" onClick={() => resetStaffPassword(member)}>{c.reset}</button><button className="ghost dangerButton" onClick={() => deleteStaff(member.id)}>{tc("delete")}</button></div></td>
	                </>;
	              })()}
            </tr>
          ))}</tbody>
        </table>
      </section>
    </>
  );
}

