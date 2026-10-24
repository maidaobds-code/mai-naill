"use client";
import { useState } from "react";
import { staff as seedStaff } from "../lib/salonData";
import { useAccountStore } from "../lib/accountStore";
import { useStaffStore } from "../lib/staffStore";
import { tx } from "../lib/i18nClean";

const staffColors = [["Lavender", "#a78bfa"], ["Lilac", "#c084fc"], ["Bubblegum", "#f9a8d4"], ["Hồng neon", "#f472b6"], ["Peach", "#fdba74"], ["Coral", "#fb7185"], ["Lemon", "#fde047"], ["Butter", "#fef08a"], ["Mint", "#86efac"], ["Emerald", "#34d399"], ["Aqua", "#5eead4"], ["Sky", "#7dd3fc"], ["Blue", "#60a5fa"], ["Periwinkle", "#818cf8"], ["Cobalt", "#4f46e5"], ["Teal", "#0d9488"], ["Lime", "#a3e635"], ["Tangerine", "#fb923c"], ["Magenta", "#e879f9"], ["Plum", "#a855f7"]];

function newStaff(nextId) {
  return {
    id: `draft-${nextId}`,
    name: "",
    role: "staff",
    status: "Working",
    color: staffColors[(nextId - 1) % staffColors.length][1],
    external: { hotpepper: "", nailie: "", minimo: "" },
    email: "",
    accountPassword: "",
    credentialStatus: "Not saved",
  };
}

const copy = {
  vi: { eyebrow: "TÀI KHOẢN NHÂN VIÊN", desc: "Thêm, xóa nhân viên, đặt màu lịch và liên kết tài khoản Nailie / Hot Pepper / minimo.", addStaff: "+ Thêm nhân viên", newStaff: "Nhân viên mới", secureNote: "Thông tin đăng nhập được lưu mã hóa phía máy chủ, không lưu dạng chữ thường trên trình duyệt.", name: "Tên", namePlaceholder: "Tên nhân viên", role: "Vai trò", calendarColor: "Màu lịch", loginEmail: "Email đăng nhập", password: "Mật khẩu tài khoản", passwordPlaceholder: "Tạo mật khẩu", staff: "Nhân viên", color: "Màu", login: "Đăng nhập", newPassword: "Mật khẩu mới", owner: "Chủ quán", staffRole: "Nhân viên", customer: "Khách hàng", reset: "Đổi mật khẩu", accountReady: "Tài khoản sẵn sàng", needsPassword: "Cần mật khẩu", passwordReset: "Đã đổi mật khẩu" },
  ja: { eyebrow: "スタッフアカウント", desc: "スタッフの追加・削除、カレンダー色、Nailie / Hot Pepper / minimo の連携を管理します。", addStaff: "+ スタッフ追加", newStaff: "新規スタッフ", secureNote: "ログイン情報はサーバー側で暗号化して保存し、ブラウザに平文では保存しません。", name: "名前", namePlaceholder: "スタッフ名", role: "役割", calendarColor: "カレンダー色", loginEmail: "ログインメール", password: "アカウントパスワード", passwordPlaceholder: "パスワード作成", staff: "スタッフ", color: "色", login: "ログイン", newPassword: "新しいパスワード", owner: "オーナー", staffRole: "スタッフ", customer: "顧客", reset: "パスワード変更", accountReady: "アカウント準備済み", needsPassword: "パスワード未設定", passwordReset: "パスワード変更済み" },
  en: { eyebrow: "STAFF ACCOUNTS", desc: "Add or remove staff, set calendar colors, and link Nailie / Hot Pepper / minimo accounts.", addStaff: "+ Add staff", newStaff: "New staff", secureNote: "Login details are encrypted on the server and are not stored as plain text in the browser.", name: "Name", namePlaceholder: "Staff name", role: "Role", calendarColor: "Calendar color", loginEmail: "Login email", password: "Account password", passwordPlaceholder: "Create password", staff: "Staff", color: "Color", login: "Login", newPassword: "New password", owner: "Owner", staffRole: "Staff", customer: "Customer", reset: "Change password", accountReady: "Account ready", needsPassword: "Needs password", passwordReset: "Password changed" },
};

export default function StaffManagement({ label = "Staff", embedded = false, language = "vi" }) {
  const c = copy[language] || copy.vi;
  const tc = (key) => tx(language, "common", key);
  const { staff, setStaff } = useStaffStore();
  const { accounts, upsertStaffAccount, resetPassword, updateAccountRole } = useAccountStore();
  const [draft, setDraft] = useState(newStaff(seedStaff.length + 1));
  const [resetDraft, setResetDraft] = useState({});
  const [roleDraft, setRoleDraft] = useState({});
  const [accountMessage, setAccountMessage] = useState("");
  const draftChanged = Boolean(draft.name || draft.email || draft.accountPassword || draft.role !== "staff");

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateExternal(platform, value) {
    setDraft((current) => ({ ...current, external: { ...current.external, [platform]: value } }));
  }

  async function addStaff() {
    if (!draft.name.trim() || !draft.email.trim()) return setAccountMessage("Vui lòng nhập tên và email đăng nhập.");
    if (!draft.accountPassword || draft.accountPassword.length < 6) return setAccountMessage("Mật khẩu phải có ít nhất 6 ký tự.");
    const uniqueId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const record = { ...draft, id: uniqueId, credentialStatus: draft.accountPassword ? c.accountReady : c.needsPassword };
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
  }

  async function saveStaffRole(account) {
    if (!account) return;
    const role = roleDraft[account.id] || account.role;
    const result = await updateAccountRole(account.id, role);
    if (result.ok) setStaff((current) => current.map((item) => item.email?.trim().toLowerCase() === account.email?.trim().toLowerCase() ? { ...item, role } : item));
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
        <div className="sectionTitle"><div><h2>{embedded ? label : c.newStaff}</h2><p>{c.secureNote}</p></div>{embedded && <button className="primary" onClick={addStaff}>{c.addStaff}</button>}</div>
        <div className="staffForm">
          <label>{c.name}<input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} placeholder={c.namePlaceholder} /></label>
          <label>{c.role}<select value={draft.role} onChange={(event) => updateDraft("role", event.target.value)}><option value="staff">{c.staffRole}</option><option value="manager">Quản lý</option><option value="owner">{c.owner}</option></select></label>
          <label>{c.calendarColor}<div className="staffColorPicker">{staffColors.map(([name, color]) => <button type="button" key={color} title={name} aria-label={name} className={draft.color === color ? "staffColorChoice active" : "staffColorChoice"} style={{ background: color }} onClick={() => updateDraft("color", color)}><span>{name}</span></button>)}</div></label>
          <label>Hot Pepper account<input value={draft.external.hotpepper} onChange={(event) => updateExternal("hotpepper", event.target.value)} placeholder="HP staff/account id" /></label>
          <label>Nailie account<input value={draft.external.nailie} onChange={(event) => updateExternal("nailie", event.target.value)} placeholder="Nailie staff/account id" /></label>
          <label>minimo account<input value={draft.external.minimo} onChange={(event) => updateExternal("minimo", event.target.value)} placeholder="minimo staff/account id" /></label>
          <label>{c.loginEmail}<input type="email" value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} placeholder="staff@example.com" /></label>
          <label>{c.password}<input type="password" value={draft.accountPassword} onChange={(event) => updateDraft("accountPassword", event.target.value)} placeholder={c.passwordPlaceholder} /></label>
        </div>
        {draftChanged && !accountMessage && <p className="storeNote">Bạn đã thay đổi thông tin. Hãy bấm “{c.addStaff.replace("+ ", "") }” để lưu.</p>}
        {accountMessage && <p className="storeNote">{accountMessage}</p>}
      </section>

      <section className="card tableWrap">
        <table>
          <thead><tr><th>{c.staff}</th><th>{c.color}</th><th>{c.login}</th><th>{tc("action")}</th></tr></thead>
          <tbody>{staff.map((member) => (
            <tr key={member.id}>
	              {(() => {
                const emailMatches = accounts.filter((item) => item.email && member.email && item.email.trim().toLowerCase() === member.email.trim().toLowerCase());
                const account = emailMatches.length === 1 ? emailMatches[0] : accounts.find((item) => item.id === `staff-${member.id}`) || accounts.find((item) => item.name === member.name || item.staffName === member.name) || null;
                const effectiveRole = account?.role || member.role || "staff";
	                return <>
              <td><div className="staffNameCell"><div className="avatar small" style={{ background: member.color }}>{member.name[0]}</div><div><strong>{member.name}</strong><span>{effectiveRole}</span></div></div></td>
              <td><span className="colorSwatch" style={{ background: member.color }} title={staffColors.find((item) => item[1] === member.color)?.[0] || member.color} /></td>
              <td><div className="staffLoginCell"><span className="pill active">{member.credentialStatus}</span><small>{account?.email || member.email || "-"}</small>{account && <select className="staffRoleSelect" value={roleDraft[account.id] || effectiveRole} onChange={(event) => setRoleDraft((current) => ({ ...current, [account.id]: event.target.value }))}><option value="owner">{c.owner}</option><option value="manager">Quản lý</option><option value="staff">{c.staffRole}</option><option value="customer">{c.customer}</option></select>}</div></td>
              <td><div className="staffAccountActions"><input type="password" value={resetDraft[member.id] || ""} onChange={(event) => setResetDraft({ ...resetDraft, [member.id]: event.target.value })} placeholder={c.newPassword} /><button className="ghost" onClick={() => resetStaffPassword(member)}>{c.reset}</button>{account && <button className="ghost" onClick={() => saveStaffRole(account)}>Lưu vai trò</button>}<button className="ghost dangerButton" onClick={() => deleteStaff(member.id)}>{tc("delete")}</button></div></td>
	                </>;
	              })()}
            </tr>
          ))}</tbody>
        </table>
      </section>
    </>
  );
}

