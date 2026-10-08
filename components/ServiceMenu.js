"use client";

import { useState } from "react";
import { staff } from "../lib/salonData";

const seedServices = [
  { id: "svc-one", name: "Gel One Color", price: 6500, duration: 75, owner: "Admin", staff: ["Mai", "Yuki"], description: "Mau gel co ban", imageUrl: "" },
  { id: "svc-art", name: "Magnet + Art", price: 9800, duration: 90, owner: "Admin", staff: ["Yuki", "Hana"], description: "Mau nail art", imageUrl: "" },
];

const emptyDraft = { id: "", name: "", price: 0, duration: 60, owner: "Admin", staff: [], description: "", imageUrl: "", imageFileName: "" };

export default function ServiceMenu({ label = "Menu dich vu" }) {
  const [services, setServices] = useState(seedServices);
  const [draft, setDraft] = useState(emptyDraft);

  function toggleStaff(name) {
    setDraft((current) => ({ ...current, staff: current.staff.includes(name) ? current.staff.filter((item) => item !== name) : [...current.staff, name] }));
  }

  function uploadLocalImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setDraft((current) => ({ ...current, imageUrl: reader.result, imageFileName: file.name }));
    };
    reader.readAsDataURL(file);
  }

  function saveService() {
    if (!draft.name.trim()) return;
    const record = { ...draft, id: draft.id || `svc-${Date.now()}` };
    setServices((current) => current.some((item) => item.id === record.id) ? current.map((item) => item.id === record.id ? record : item) : [...current, record]);
    setDraft(emptyDraft);
  }

  return (
    <>
      <div className="pageHead">
        <div>
          <p className="eyebrow">SERVICE MENU</p>
          <h1>{label}</h1>
          <p>Admin quan ly menu chinh; nhan vien co the co dich vu/gia rieng khi duoc phan quyen.</p>
        </div>
        <button className="primary" onClick={saveService}>+ Luu dich vu</button>
      </div>

      <section className="card staffEditor">
        <div className="staffForm">
          <label>Ten dich vu<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>Gia<input type="number" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} /></label>
          <label>Thoi luong phut<input type="number" value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: Number(event.target.value) })} /></label>
          <label>Chu so huu<select value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })}><option>Admin</option>{staff.map((member) => <option key={member.id}>{member.name}</option>)}</select></label>
          <label>Anh mau nail<input type="file" accept="image/*" onChange={uploadLocalImage} /></label>
          <label>Mo ta<input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        </div>

        {draft.imageUrl && (
          <div className="imagePreview">
            <img src={draft.imageUrl} alt={draft.name || "Nail sample"} />
            <span>{draft.imageFileName || "Anh da chon tu may tinh"}</span>
          </div>
        )}

        <div className="staffPicker">
          {staff.map((member) => <button key={member.id} className={draft.staff.includes(member.name) ? "ghost activeSoft" : "ghost"} onClick={() => toggleStaff(member.name)}>{member.name}</button>)}
        </div>
      </section>

      <section className="card tableWrap">
        <table>
          <thead><tr><th>Dich vu</th><th>Gia</th><th>Thoi luong</th><th>Nhan vien lam duoc</th><th>Thao tac</th></tr></thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id}>
                <td>
                  <div className="serviceCell">
                    {service.imageUrl ? <img src={service.imageUrl} alt={service.name} /> : <span className="serviceThumb">NA</span>}
                    <div><strong>{service.name}</strong><br /><small>{service.description}</small></div>
                  </div>
                </td>
                <td>JPY {service.price.toLocaleString("ja-JP")}</td>
                <td>{service.duration} phut</td>
                <td>{service.staff.join(", ")}</td>
                <td>
                  <button className="ghost" onClick={() => setDraft({ ...emptyDraft, ...service })}>Sua</button>{" "}
                  <button className="ghost dangerButton" onClick={() => setServices((current) => current.filter((item) => item.id !== service.id))}>Xoa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
