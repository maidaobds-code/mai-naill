"use client";

import { useState } from "react";
import { emptyService, useServiceCatalog } from "../lib/catalogStore";
import { staff } from "../lib/salonData";

export default function ServiceMenu({ label = "Menu dịch vụ", language = "vi" }) {
  const [services, setServices] = useServiceCatalog();
  const [draft, setDraft] = useState(emptyService);

  function toggleStaff(name) {
    setDraft((current) => ({ ...current, staff: current.staff.includes(name) ? current.staff.filter((item) => item !== name) : [...current.staff, name] }));
  }

  function uploadLocalImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDraft((current) => ({ ...current, imageUrl: reader.result, imageFileName: file.name }));
    reader.readAsDataURL(file);
  }

  function saveService() {
    if (!draft.name.trim()) return;
    const record = { ...draft, id: draft.id || `svc-${Date.now()}` };
    setServices((current) => current.some((item) => item.id === record.id) ? current.map((item) => item.id === record.id ? record : item) : [...current, record]);
    setDraft(emptyService);
  }

  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">SERVICE MENU</p><h1>{label}</h1><p>Ảnh menu sẽ đồng bộ sang form đặt lịch hẹn trên website.</p></div>
        <button className="primary" onClick={saveService}>+ Lưu dịch vụ</button>
      </div>

      <section className="card staffEditor serviceEditorPanel">
        <div className="staffForm">
          <label>Tên dịch vụ<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>Giá<input type="number" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} /></label>
          <label>Thời lượng phút<input type="number" value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: Number(event.target.value) })} /></label>
          <label>Chủ sở hữu<select value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })}><option>Admin</option>{staff.map((member) => <option key={member.id}>{member.name}</option>)}</select></label>
          <label>Ảnh mẫu nail<input type="file" accept="image/*" onChange={uploadLocalImage} /></label>
          <label>Mô tả<input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        </div>

        {draft.imageUrl && <div className="imagePreview"><img src={draft.imageUrl} alt={draft.name || "Nail sample"} /><span>{draft.imageFileName || "Ảnh đã chọn từ máy tính"}</span></div>}
        <div className="staffPicker">{staff.map((member) => <button key={member.id} className={draft.staff.includes(member.name) ? "ghost activeSoft" : "ghost"} onClick={() => toggleStaff(member.name)}>{member.name}</button>)}</div>
      </section>

      <section className="card tableWrap">
        <table>
          <thead><tr><th>Dịch vụ</th><th>Giá</th><th>Thời lượng</th><th>Nhân viên làm được</th><th>Thao tác</th></tr></thead>
          <tbody>{services.map((service) => (
            <tr key={service.id}>
              <td><div className="serviceCell">{service.imageUrl ? <img src={service.imageUrl} alt={service.name} /> : <span className="serviceThumb">NA</span>}<div><strong>{service.name}</strong><br /><small>{service.description}</small></div></div></td>
              <td>JPY {service.price.toLocaleString("ja-JP")}</td>
              <td>{service.duration} phút</td>
              <td>{service.staff.join(", ")}</td>
              <td><button className="ghost" onClick={() => setDraft({ ...emptyService, ...service })}>Sửa</button>{" "}<button className="ghost dangerButton" onClick={() => setServices((current) => current.filter((item) => item.id !== service.id))}>Xóa</button></td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    </>
  );
}

