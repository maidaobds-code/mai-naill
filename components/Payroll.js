"use client";

import { useEffect, useMemo, useState } from "react";
import { useBookingStore } from "../lib/bookingStore";
import { payrollRules, platforms, staff } from "../lib/salonData";

function yen(value) {
  return `JPY ${Math.round(value).toLocaleString("ja-JP")}`;
}

function runFormula(formula, sale) {
  const expression = formula.replace(/\bsale\b/g, String(Number(sale) || 0));
  if (!/^[\d\s.+\-*/()%]+$/.test(expression)) return 0;

  try {
    const result = Function(`"use strict"; return (${expression});`)();
    return Number.isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

function buildDefaultAppRules() {
  const bySource = new Map();
  platforms.forEach((platform) => {
    bySource.set(platform.id, {
      id: platform.id,
      source: platform.id,
      app: platform.name,
      color: platform.color,
      formula: "sale * 0.45",
      status: platform.status,
    });
  });
  payrollRules.forEach((rule) => {
    if (rule.source && !bySource.has(rule.source)) {
      bySource.set(rule.source, { id: rule.source, source: rule.source, app: rule.app, color: "#6d28d9", formula: rule.formula, status: "Custom" });
    } else if (rule.source) {
      bySource.set(rule.source, { ...bySource.get(rule.source), formula: rule.formula, app: rule.app || bySource.get(rule.source).app });
    }
  });
  return Array.from(bySource.values());
}

export default function Payroll({ label = "Payroll" }) {
  const { bookings } = useBookingStore();
  const [rules, setRules] = useState(buildDefaultAppRules);
  const [draftApp, setDraftApp] = useState({ app: "", source: "", formula: "sale * 0.45" });

  useEffect(() => {
    const savedRules = window.localStorage.getItem("payroll-app-commission-rules");
    if (savedRules) setRules(JSON.parse(savedRules));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("payroll-app-commission-rules", JSON.stringify(rules));
  }, [rules]);

  const calculatedBookings = useMemo(() => bookings.map((booking) => {
    const rule = rules.find((item) => item.source === booking.source);
    const formula = rule?.formula || "sale * 0.45";
    return { ...booking, payrollFormula: formula, payrollApp: rule?.app || booking.origin, commission: runFormula(formula, booking.price) };
  }), [bookings, rules]);

  const rows = staff.map((member) => {
    const staffBookings = calculatedBookings.filter((booking) => booking.staff === member.name);
    const sales = staffBookings.reduce((total, booking) => total + booking.price, 0);
    const commission = staffBookings.reduce((total, booking) => total + booking.commission, 0);
    return { member, staffBookings, sales, commission };
  });

  function updateRule(ruleId, value) {
    setRules((current) => current.map((rule) => rule.id === ruleId ? { ...rule, formula: value } : rule));
  }

  function addAppRule(event) {
    event.preventDefault();
    const app = draftApp.app.trim();
    const source = (draftApp.source.trim() || app).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!app || !source) return;
    const rule = { id: source, source, app, color: "#6d28d9", formula: draftApp.formula || "sale * 0.45", status: "Custom" };
    setRules((current) => current.some((item) => item.source === source) ? current.map((item) => item.source === source ? rule : item) : [...current, rule]);
    setDraftApp({ app: "", source: "", formula: "sale * 0.45" });
  }

  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">OCTOBER 2026</p><h1>{label}</h1><p>Cong thuc hoa hong duoc cai chung theo tung app. Moi booking tu app do se dung cung mot cach tinh.</p></div>
        <button className="primary">Export CSV</button>
      </div>

      <div className="payrollCards">
        {rows.map((row) => <section className="card payrollCard" key={row.member.id}><div className="avatar" style={{ background: row.member.color }}>{row.member.name[0]}</div><h2>{row.member.name}</h2><span>Sales {yen(row.sales)}</span><strong>{yen(row.commission)}</strong><small>{row.staffBookings.length} bookings</small></section>)}
      </div>

      <section className="card ruleList">
        <div className="sectionTitle"><div><h2>App commission formulas</h2><p>Them app moi va gan cong thuc tinh bang bien sale.</p></div></div>
        <form className="appRuleForm" onSubmit={addAppRule}>
          <input value={draftApp.app} onChange={(event) => setDraftApp({ ...draftApp, app: event.target.value })} placeholder="Ten app" />
          <input value={draftApp.source} onChange={(event) => setDraftApp({ ...draftApp, source: event.target.value })} placeholder="Ma app, vi du instagram" />
          <input value={draftApp.formula} onChange={(event) => setDraftApp({ ...draftApp, formula: event.target.value })} placeholder="sale * 0.45" />
          <button className="primary" type="submit">Them app</button>
        </form>
        <div className="ruleMatrix">
          {rules.map((rule) => <div className="ruleRow" key={rule.id}><strong>{rule.app}</strong><span>{rule.source}</span><label>Formula<input value={rule.formula} onChange={(event) => updateRule(rule.id, event.target.value)} /></label><small>{rule.status}</small></div>)}
        </div>
      </section>

      <section className="card tableWrap">
        <table>
          <thead><tr><th>Date</th><th>Customer</th><th>App</th><th>Staff</th><th>Sale</th><th>Formula</th><th>Commission</th></tr></thead>
          <tbody>{calculatedBookings.map((booking) => <tr key={booking.id}><td>2026/10/{String(booking.day || 6).padStart(2, "0")}</td><td>{booking.customer}</td><td>{booking.payrollApp}</td><td>{booking.staff}</td><td>{yen(booking.price)}</td><td><code>{booking.payrollFormula}</code></td><td><strong>{yen(booking.commission)}</strong></td></tr>)}</tbody>
        </table>
      </section>
    </>
  );
}
