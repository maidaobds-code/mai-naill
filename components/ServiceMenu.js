"use client";

import { useMemo, useState } from "react";
import { emptyService, useServiceCatalog } from "../lib/catalogStore";
import { bookingGroups, fallbackBookingGroup, bookingGroupLabel } from "../lib/bookingMenu";
import { tx } from "../lib/i18nClean";
import { useStaffStore } from "../lib/staffStore";
import { useAccountStore } from "../lib/accountStore";

const copy = {
  zh: { desc: "服务菜单图片将同步到网站预约表单。", save: "+ 保存服务", name: "服务名称", duration: "时长（分钟）", owner: "负责人", image: "美甲图片", selectedImage: "已选择图片", headers: ["服务", "分类", "价格", "时长", "可服务员工", "操作"], minutes: "分钟" },
  ko: { desc: "서비스 메뉴 이미지는 웹 예약 양식에 동기화됩니다.", save: "+ 서비스 저장", name: "서비스 이름", duration: "소요 시간(분)", owner: "담당자", image: "네일 이미지", selectedImage: "선택한 이미지", headers: ["서비스", "그룹", "가격", "시간", "가능한 직원", "작업"], minutes: "분" },
  vi: { desc: "Menu này dùng chung với trang Booking. Mọi thay đổi, giá và ảnh sẽ đồng bộ qua Supabase.", save: "+ Lưu dịch vụ", name: "Tên dịch vụ", duration: "Thời lượng phút", owner: "Chủ sở hữu", image: "Ảnh mẫu nail", selectedImage: "Ảnh đã chọn từ máy tính", headers: ["Dịch vụ", "Nhóm", "Giá", "Thời lượng", "Nhân viên làm được", "Thao tác"], minutes: "phút" },
  ja: { desc: "メニュー画像はWeb予約フォームへ同期されます。", save: "+ サービスを保存", name: "サービス名", duration: "所要時間（分）", owner: "担当者", image: "ネイル画像", selectedImage: "選択済み画像", headers: ["サービス", "分類", "価格", "時間", "対応スタッフ", "操作"], minutes: "分" },
  en: { desc: "Menu images sync to the website booking form.", save: "+ Save service", name: "Service name", duration: "Duration minutes", owner: "Owner", image: "Nail sample image", selectedImage: "Selected image from computer", headers: ["Service", "Group", "Price", "Duration", "Available staff", "Actions"], minutes: "min" },
};

export default function ServiceMenu({ label = "Menu dịch vụ", language = "vi" }) {
  const c = copy[language] || copy.vi;
  const tc = (key) => tx(language, "common", key);
  const { staff: storedStaff } = useStaffStore();
  const { currentAccount } = useAccountStore();
  const staff = (() => {
    const ownName = currentAccount?.role === "staff" ? currentAccount.staffName || currentAccount.name : "";
    if (!ownName || storedStaff.some((member) => member.name === ownName)) return storedStaff;
    return [...storedStaff, { id: `account-${currentAccount.id}`, name: ownName, role: "Nailist", color: "#7c3aed", external: {} }];
  })();
  const [services, setServices] = useServiceCatalog();
  const [draft, setDraft] = useState({ ...emptyService });
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const groups = [...bookingGroups, fallbackBookingGroup];
  const languageKey = language === "ja" ? "ja" : language === "en" ? "en" : "vi";
  const categoryLabel = language === "ja" ? "サービス分類" : language === "en" ? "Service group" : "Nhóm dịch vụ";
  const searchLabel = language === "ja" ? "サービスを検索…" : language === "en" ? "Search services…" : "Tìm dịch vụ…";
  const allGroupsLabel = language === "ja" ? "すべての分類" : language === "en" ? "All groups" : "Tất cả nhóm";
  const visibleServices = useMemo(() => services.filter((service) => {
    const matchesGroup = !groupFilter || (service.category || "existing") === groupFilter;
    const term = query.trim().toLocaleLowerCase();
    return matchesGroup && (!term || [service.name, service.description].some((value) => String(value || "").toLocaleLowerCase().includes(term)));
  }), [services, query, groupFilter]);

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

  async function saveService() {
    if (!draft.name.trim()) return;
    const translate = async (text) => {
      if (!text?.trim()) return {};
      const response = await fetch("/api/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, targets: ["VI", "JA", "EN", "ZH", "KO"] }) });
      const result = await response.json().catch(() => ({}));
      return result.ok ? result.translations : {};
    };
    const [names, descriptions] = await Promise.all([translate(draft.name), translate(draft.description)]);
    const record = { ...draft, id: draft.id || `svc-${Date.now()}`, nameVi: names.VI || draft.name, nameJa: names.JA || draft.name, nameEn: names.EN || draft.name, nameZh: names.ZH || draft.name, nameKo: names.KO || draft.name, descriptionVi: descriptions.VI || draft.description, descriptionJa: descriptions.JA || draft.description, descriptionEn: descriptions.EN || draft.description, descriptionZh: descriptions.ZH || draft.description, descriptionKo: descriptions.KO || draft.description };
    setServices((current) => current.some((item) => item.id === record.id) ? current.map((item) => item.id === record.id ? record : item) : [...current, record]);
    setDraft({ ...emptyService });
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
          <label>{categoryLabel}<select value={draft.category || "existing"} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{groups.map((group) => <option key={group.id} value={group.id}>{group[languageKey]}</option>)}</select></label>
          <label>{tc("price")}<input type="number" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} /></label>
          <label>{c.duration}<input type="number" value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: Number(event.target.value) })} /></label>
          <label>{c.owner}<select value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })}><option>Admin</option>{staff.map((member) => <option key={member.id}>{member.name}</option>)}</select></label>
          <label>{c.image}<input type="file" accept="image/*" onChange={uploadLocalImage} /></label>
          <label>{tc("note")}<input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        </div>

        {draft.imageUrl && <div className="imagePreview"><img src={draft.imageUrl} alt={draft.name || "Nail sample"} /><span>{draft.imageFileName || c.selectedImage}</span></div>}
        <div className="staffPicker">{staff.map((member) => <button type="button" key={member.id} className={draft.staff.includes(member.name) ? "ghost activeSoft" : "ghost"} onClick={() => toggleStaff(member.name)}>{member.name}</button>)}</div>
      </section>

      <div className="serviceCatalogTools">
        <input aria-label={searchLabel} placeholder={searchLabel} value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label={categoryLabel} value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option value="">{allGroupsLabel}</option>{groups.map((group) => <option key={group.id} value={group.id}>{group[languageKey]}</option>)}</select>
        <span>{visibleServices.length} / {services.length}</span>
      </div>

      <section className="card tableWrap">
        <table>
          <thead><tr>{c.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>{visibleServices.map((service) => (
            <tr key={service.id}>
              <td><div className="serviceCell">{service.imageUrl ? <img src={service.imageUrl} alt={service.name} /> : <span className="serviceThumb">NA</span>}<div><strong>{service.name}</strong><br /><small>{service.description}</small></div></div></td>
              <td><span className="serviceGroupBadge">{bookingGroupLabel(service.category, language)}</span></td>
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

