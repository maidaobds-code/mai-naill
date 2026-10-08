"use client";

import { useEffect, useMemo, useState } from "react";
import { useBookingStore } from "../lib/bookingStore";
import { platforms, staff } from "../lib/salonData";

const PAYROLL_KEY = "payroll-staff-settings-v2";

function yen(value) {
  return `JPY ${Math.round(Number(value || 0)).toLocaleString("ja-JP")}`;
}

function defaultStaffSettings() {
  return staff.reduce((acc, member) => {
    acc[member.name] = {
      appRates: platforms.reduce((rates, platform) => ({ ...rates, [platform.id]: platform.id === "direct" ? 55 : 45 }), {}),
      additions: [{ id: "bonus", label: "Thuong", amount: 0 }],
      deductions: [{ id: "insurance", label: "Bao hiem", amount: 0 }],
    };
    return acc;
  }, {});
}

function sumItems(items) {
  return items.reduce((total, item) => total + Number(item.amount || 0), 0);
}

export default function Payroll({ label = "Payroll" }) {
  const { bookings } = useBookingStore();
  const [selectedStaff, setSelectedStaff] = useState(staff[0]?.name || "");
  const [settings, setSettings] = useState(defaultStaffSettings);

  useEffect(() => {
    const raw = window.localStorage.getItem(PAYROLL_KEY);
    if (raw) setSettings({ ...defaultStaffSettings(), ...JSON.parse(raw) });
  }, []);

  useEffect(() => {
    window.localStorage.setItem(PAYROLL_KEY, JSON.stringify(settings));
  }, [settings]);

  const selectedMember = staff.find((member) => member.name === selectedStaff) || staff[0];
  const selectedSettings = settings[selectedStaff] || defaultStaffSettings()[selectedStaff];
  const staffBookings = useMemo(() => bookings.filter((booking) => booking.staff === selectedStaff), [bookings, selectedStaff]);
  const payrollRows = staffBookings.map((booking) => {
    const rate = Number(selectedSettings.appRates[booking.source] ?? 45);
    const commission = Number(booking.price || 0) * rate / 100;
    return { ...booking, rate, commission, app: platforms.find((platform) => platform.id === booking.source)?.name || booking.origin };
  });
  const sales = payrollRows.reduce((total, booking) => total + Number(booking.price || 0), 0);
  const commission = payrollRows.reduce((total, booking) => total + booking.commission, 0);
  const additions = sumItems(selectedSettings.additions);
  const deductions = sumItems(selectedSettings.deductions);
  const netPay = commission + additions - deductions;

  function updateRate(source, value) {
    setSettings((current) => ({
      ...current,
      [selectedStaff]: {
        ...selectedSettings,
        appRates: { ...selectedSettings.appRates, [source]: Number(value) },
      },
    }));
  }

  function updateLine(type, id, field, value) {
    setSettings((current) => ({
      ...current,
      [selectedStaff]: {
        ...selectedSettings,
        [type]: selectedSettings[type].map((item) => item.id === id ? { ...item, [field]: field === "amount" ? Number(value) : value } : item),
      },
    }));
  }

  function addLine(type) {
    setSettings((current) => ({
      ...current,
      [selectedStaff]: {
        ...selectedSettings,
        [type]: [...selectedSettings[type], { id: `${type}-${Date.now()}`, label: type === "additions" ? "Khoan cong" : "Khoan tru", amount: 0 }],
      },
    }));
  }

  function removeLine(type, id) {
    setSettings((current) => ({
      ...current,
      [selectedStaff]: {
        ...selectedSettings,
        [type]: selectedSettings[type].filter((item) => item.id !== id),
      },
    }));
  }

  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">OCTOBER 2026</p><h1>{label}</h1><p>Chon nhan vien, cai phan tram theo tung app, cong thuong va tru bao hiem tren mot man hinh gon.</p></div>
        <button className="primary">Export CSV</button>
      </div>

      <section className="card payrollStudio">
        <div className="staffSelectRail">
          {staff.map((member) => <button key={member.id} className={selectedStaff === member.name ? "staffChip active" : "staffChip"} onClick={() => setSelectedStaff(member.name)}><span className="avatar small" style={{ background: member.color }}>{member.name[0]}</span><strong>{member.name}</strong><small>{member.role}</small></button>)}
        </div>

        <div className="payrollHeroRow">
          <div className="payrollPerson"><div className="avatar" style={{ background: selectedMember.color }}>{selectedMember.name[0]}</div><div><span>Dang tinh luong</span><h2>{selectedMember.name}</h2><small>{selectedMember.status}</small></div></div>
          <div className="payrollMiniStat"><span>Doanh thu</span><strong>{yen(sales)}</strong></div>
          <div className="payrollMiniStat"><span>Hoa hong</span><strong>{yen(commission)}</strong></div>
          <div className="payrollMiniStat"><span>Thuc nhan</span><strong>{yen(netPay)}</strong></div>
        </div>
      </section>

      <div className="payrollWorkGrid">
        <section className="card payrollPanel">
          <div className="sectionTitle"><div><h2>Phan tram theo app</h2><p>Moi app mot ty le rieng cho {selectedStaff}.</p></div></div>
          <div className="appRateList">
            {platforms.map((platform) => <label key={platform.id} className="appRateRow"><span style={{ background: platform.color }} /><strong>{platform.name}</strong><input type="number" min="0" max="100" value={selectedSettings.appRates[platform.id] ?? 45} onChange={(event) => updateRate(platform.id, event.target.value)} /><small>%</small></label>)}
          </div>
        </section>

        <section className="card payrollPanel">
          <div className="sectionTitle"><div><h2>Khoan cong</h2><p>Thuong, phu cap hoac dieu chinh tang.</p></div><button className="ghost" onClick={() => addLine("additions")}>+ Them</button></div>
          <div className="payrollLineList">{selectedSettings.additions.map((item) => <div className="payrollLine" key={item.id}><input value={item.label} onChange={(event) => updateLine("additions", item.id, "label", event.target.value)} /><input type="number" value={item.amount} onChange={(event) => updateLine("additions", item.id, "amount", event.target.value)} /><button className="ghost dangerButton" onClick={() => removeLine("additions", item.id)}>Xoa</button></div>)}</div>
        </section>

        <section className="card payrollPanel">
          <div className="sectionTitle"><div><h2>Khoan tru</h2><p>Bao hiem, tam ung, phat hoac dieu chinh giam.</p></div><button className="ghost" onClick={() => addLine("deductions")}>+ Them</button></div>
          <div className="payrollLineList">{selectedSettings.deductions.map((item) => <div className="payrollLine" key={item.id}><input value={item.label} onChange={(event) => updateLine("deductions", item.id, "label", event.target.value)} /><input type="number" value={item.amount} onChange={(event) => updateLine("deductions", item.id, "amount", event.target.value)} /><button className="ghost dangerButton" onClick={() => removeLine("deductions", item.id)}>Xoa</button></div>)}</div>
        </section>
      </div>

      <section className="card payrollSummaryPanel">
        <div><span>Hoa hong</span><strong>{yen(commission)}</strong></div>
        <div><span>Cong them</span><strong>{yen(additions)}</strong></div>
        <div><span>Khoan tru</span><strong>{yen(deductions)}</strong></div>
        <div className="netPay"><span>Thuc nhan</span><strong>{yen(netPay)}</strong></div>
      </section>

      <section className="card tableWrap">
        <table>
          <thead><tr><th>Date</th><th>Customer</th><th>App</th><th>Sale</th><th>%</th><th>Commission</th></tr></thead>
          <tbody>{payrollRows.map((booking) => <tr key={booking.id}><td>2026/10/{String(booking.day || 6).padStart(2, "0")}</td><td>{booking.customer}</td><td>{booking.app}</td><td>{yen(booking.price)}</td><td>{booking.rate}%</td><td><strong>{yen(booking.commission)}</strong></td></tr>)}</tbody>
        </table>
      </section>
    </>
  );
}
