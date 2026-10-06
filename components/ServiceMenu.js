"use client";
import { useState } from "react";
import { staff } from "../lib/salonData";

const seedServices = [
  { id: "svc-one", name: "Gel One Color", price: 6500, duration: 75, owner: "Admin", staff: ["Mai", "Yuki"], description: "Màu gel cơ bản", imageUrl: "" },
  { id: "svc-art", name: "Magnet + Art", price: 9800, duration: 90, owner: "Admin", staff: ["Yuki", "Hana"], description: "Mẫu nail art", imageUrl: "" },
];

export default function ServiceMenu({ label = "Menu dịch vụ" }) {
  const [services, setServices] = useState(seedServices);
  const [draft, setDraft] = useState({ id: "", name: "", price: 0, duration: 60, owner: "Admin", staff: [], description: "", imageUrl: "" });

  function toggleStaff(name) {
    setDraft((current) => ({ ...current, staff: current.staff.includes(name) ? current.staff.filter((item) => item !== name) : [...current.staff, name] }));
  }

  function saveService() {
    if (!draft.name.trim()) return;
    const record = { ...draft, id: draft.id || `svc-${Date.now()}` };
    setServices((current) => current.some((item) => item.id === record.id) ? current.map((item) => item.id === record.id ? record : item) : [...current, record]);
    setDraft({ id: "", name: "", price: 0, duration: 60, owner: "Admin", staff: [], description: "", imageUrl: "" });
  }

  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">SERVICE MENU</p><h1>{label}</h1><p>Admin quản lý menu chính; nhân viên có thể có dịch vụ/giá riêng khi được phân quyền.</p></div>
        <button className="primary" onClick={saveService}>+ Lưu dịch vụ</button>
      </div>
      <section className="card staffEditor">
        <div className="staffForm">
          <label>Tên dịch vụ<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>Giá<input type="number" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} /></label>
          <label>Thời lượng phút<input type="number" value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: Number(event.target.value) })} /></label>
          <label>Chủ sở hữu<select value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })}><option>Admin</option>{staff.map((member) => <option key={member.id}>{member.name}</option>)}</select></label>
          <label>Ảnh mẫu nail<input value={draft.imageUrl} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value })} placeholder="Supabase Storage URL" /></label>
          <label>Mô tả<input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        </div>
        <div className="staffPicker">{staff.map((member) => <button key={member.id} className={draft.staff.includes(member.name) ? "ghost activeSoft" : "ghost"} onClick={() => toggleStaff(member.name)}>{member.name}</button>)}</div>
      </section>
      <section className="card tableWrap">
        <table><thead><tr><th>Dịch vụ</th><th>Giá</th><th>Thời lượng</th><th>Nhân viên làm được</th><th>Thao tác</th></tr></thead>
        <tbody>{services.map((service) => <tr key={service.id}><td><strong>{service.name}</strong><br /><small>{service.description}</small></td><td>¥{service.price.toLocaleString("ja-JP")}</td><td>{service.duration} phút</td><td>{service.staff.join(", ")}</td><td><button className="ghost" onClick={() => setDraft(service)}>Sửa</button> <button className="ghost dangerButton" onClick={() => setServices((current) => current.filter((item) => item.id !== service.id))}>Xóa</button></td></tr>)}</tbody></table>
      </section>
    </>
  );
}
