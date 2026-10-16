"use client";

import { useState } from "react";
import { emptyService, useServiceCatalog } from "../lib/catalogStore";
import { tx } from "../lib/i18nClean";
import { useStaffStore } from "../lib/staffStore";

const copy = {
  vi: { desc: "Ảnh menu sẽ đồng bộ sang form đặt lịch hẹn trên website.", save: "+ Lưu dịch vụ", name: "Tên dịch vụ", duration: "Thời lượng phút", owner: "Chủ sở hữu", image: "Ảnh mẫu nail", selectedImage: "Ảnh đã chọn từ máy tính", headers: ["Dịch vụ", "Giá", "Thời lượng", "Nhân viên làm được", "Thao tác"], minutes: "phút" },
  ja: { desc: "メニュー画像はWeb予約フォームへ同期されます。", save: "+ サービスを保存", name: "サービス名", duration: "所要時間（分）", owner: "担当者", image: "ネイル画像", selectedImage: "選択済み画像", headers: ["サービス", "価格", "時間", "対応スタッフ", "操作"], minutes: "分" },
  en: { desc: "Menu images sync to the website booking form.", save: "+ Save service", name: "Service name", duration: "Duration minutes", owner: "Owner", image: "Nail sample image", selectedImage: "Selected image from computer", headers: ["Service", "Price", "Duration", "Available staff", "Actions"], minutes: "min" },
};

export default function ServiceMenu({ label = "Menu dịch vụ", language = "vi" }) {
  const c = copy[language] || copy.vi;
  const tc = (key) => tx(language, "common", key);
  const { staff } = useStaffStore();
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
        <div><p className="eyebrow">SERVICE MENU</p><h1>{label}</h1><p>{c.desc}</p></div>
        <button className="primary" onClick={saveService}>{c.save}</button>
      </div>

      <section className="card staffEditor serviceEditorPanel">
        <div className="staffForm">
          <label>{c.name}<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>{tc("price")}<input type="number" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} /></label>
          <label>{c.duration}<input type="number" value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: Number(event.target.value) })} /></label>
          <label>{c.owner}<select value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })}><option>Admin</option>{staff.map((member) => <option key={member.id}>{member.name}</option>)}</select></label>
          <label>{c.image}<input type="file" accept="image/*" onChange={uploadLocalImage} /></label>
          <label>{tc("note")}<input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        </div>

        {draft.imageUrl && <div className="imagePreview"><img src={draft.imageUrl} alt={draft.name || "Nail sample"} /><span>{draft.imageFileName || c.selectedImage}</span></div>}
        <div className="staffPicker">{staff.map((member) => <button type="button" key={member.id} className={draft.staff.includes(member.name) ? "ghost activeSoft" : "ghost"} onClick={() => toggleStaff(member.name)}>{member.name}</button>)}</div>
      </section>

      <section className="card tableWrap">
        <table>
          <thead><tr>{c.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>{services.map((service) => (
            <tr key={service.id}>
              <td><div className="serviceCell">{service.imageUrl ? <img src={service.imageUrl} alt={service.name} /> : <span className="serviceThumb">NA</span>}<div><strong>{service.name}</strong><br /><small>{service.description}</small></div></div></td>
              <td>JPY {service.price.toLocaleString("ja-JP")}</td>
              <td>{service.duration} {c.minutes}</td>
              <td>{service.staff.join(", ")}</td>
              <td><button className="ghost" onClick={() => setDraft({ ...emptyService, ...service })}>{tc("edit")}</button>{" "}<button className="ghost dangerButton" onClick={() => setServices((current) => current.filter((item) => item.id !== service.id))}>{tc("delete")}</button></td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    </>
  );
}

