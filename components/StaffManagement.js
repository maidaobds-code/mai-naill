"use client";
import { useState } from "react";
import { platforms, staff as seedStaff } from "../lib/salonData";
import { useStaffStore } from "../lib/staffStore";

const staffColors = ["#7c3aed", "#ec4899", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444"];

function newStaff(nextId) {
  return {
    id: nextId,
    name: "",
    role: "Nailist",
    status: "Working",
    color: staffColors[(nextId - 1) % staffColors.length],
    external: { hotpepper: "", nailie: "", minimo: "" },
    credentialStatus: "Not saved",
  };
}

export default function StaffManagement({ label = "Staff", embedded = false }) {
  const { staff, setStaff } = useStaffStore();
  const [draft, setDraft] = useState(newStaff(seedStaff.length + 1));

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateExternal(platform, value) {
    setDraft((current) => ({ ...current, external: { ...current.external, [platform]: value } }));
  }

  function addStaff() {
    if (!draft.name.trim()) return;
    setStaff((current) => [...current, { ...draft, credentialStatus: "Encrypted in Supabase" }]);
    setDraft(newStaff(draft.id + 1));
  }

  function deleteStaff(id) {
    setStaff((current) => current.filter((member) => member.id !== id));
  }

  return (
    <>
      {!embedded && <div className="pageHead">
        <div>
          <p className="eyebrow">STAFF ACCOUNTS</p>
          <h1>{label}</h1>
          <p>Thêm, xóa nhân viên, đặt màu lịch và liên kết tài khoản Nailie / Hot Pepper / minimo.</p>
        </div>
        <button className="primary" onClick={addStaff}>+ Thêm nhân viên</button>
      </div>}

      <section className="card staffEditor">
        <div className="sectionTitle"><div><h2>{embedded ? label : "Nhân viên mới"}</h2><p>Thông tin đăng nhập được lưu mã hóa phía máy chủ, không lưu dạng chữ thường trên trình duyệt.</p></div>{embedded && <button className="primary" onClick={addStaff}>+ Thêm nhân viên</button>}</div>
        <div className="staffForm">
          <label>Tên<input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} placeholder="Tên nhân viên" /></label>
          <label>Vai trò<input value={draft.role} onChange={(event) => updateDraft("role", event.target.value)} /></label>
          <label>Màu lịch<select value={draft.color} onChange={(event) => updateDraft("color", event.target.value)}>{staffColors.map((color) => <option key={color} value={color}>{color}</option>)}</select></label>
          <label>Hot Pepper account<input value={draft.external.hotpepper} onChange={(event) => updateExternal("hotpepper", event.target.value)} placeholder="HP staff/account id" /></label>
          <label>Nailie account<input value={draft.external.nailie} onChange={(event) => updateExternal("nailie", event.target.value)} placeholder="Nailie staff/account id" /></label>
          <label>minimo account<input value={draft.external.minimo} onChange={(event) => updateExternal("minimo", event.target.value)} placeholder="minimo staff/account id" /></label>
        </div>
      </section>

      <section className="card tableWrap">
        <table>
          <thead><tr><th>Nhân viên</th><th>Màu</th><th>Hot Pepper</th><th>Nailie</th><th>minimo</th><th>Đăng nhập</th><th>Thao tác</th></tr></thead>
          <tbody>{staff.map((member) => (
            <tr key={member.id}>
              <td><div className="staffNameCell"><div className="avatar small" style={{ background: member.color }}>{member.name[0]}</div><div><strong>{member.name}</strong><span>{member.role}</span></div></div></td>
              <td><span className="colorSwatch" style={{ background: member.color }} /></td>
              <td>{member.external.hotpepper || "-"}</td>
              <td>{member.external.nailie || "-"}</td>
              <td>{member.external.minimo || "-"}</td>
              <td><span className="pill active">{member.credentialStatus}</span></td>
              <td><button className="ghost dangerButton" onClick={() => deleteStaff(member.id)}>Xóa</button></td>
            </tr>
          ))}</tbody>
        </table>
      </section>

      <section className="card integrationHint">
        <h2>Supabase storage model</h2>
        <p>Each linked app account should be saved in <code>staff_external_accounts</code>. API tokens/passwords belong in <code>encrypted_credentials</code>, encrypted on the server before insert/update.</p>
        <div className="capabilities">{platforms.filter((platform) => platform.id !== "direct").map((platform) => <span key={platform.id}>{platform.name}</span>)}</div>
      </section>
    </>
  );
}

