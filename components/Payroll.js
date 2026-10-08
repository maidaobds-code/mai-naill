"use client";

import { useEffect, useMemo, useState } from "react";
import { bookings, payrollRules, platforms, staff } from "../lib/salonData";

function yen(value) {
  return `JPY ${Math.round(value).toLocaleString("ja-JP")}`;
}

function fallbackFormula(booking) {
  const rate = Number((booking.commissionRule.match(/(\d+)%/) || [0, 45])[1]);
  return `sale * ${rate / 100}`;
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

function buildDefaultRules() {
  const existing = payrollRules.map((rule) => ({ ...rule }));

  staff.forEach((member) => {
    platforms.forEach((platform) => {
      const hasRule = existing.some((rule) => rule.staff === member.name && rule.source === platform.id);
      if (!hasRule) {
        existing.push({
          id: `${member.id}-${platform.id}`,
          staff: member.name,
          source: platform.id,
          app: platform.name,
          formula: "sale * 0.45",
          base: "Net sale",
        });
      }
    });
  });

  return existing;
}

export default function Payroll({ label = "Payroll" }) {
  const [rules, setRules] = useState(buildDefaultRules);

  useEffect(() => {
    const savedRules = window.localStorage.getItem("payroll-commission-rules");
    if (savedRules) setRules(JSON.parse(savedRules));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("payroll-commission-rules", JSON.stringify(rules));
  }, [rules]);

  const calculatedBookings = useMemo(() => bookings.map((booking) => {
    const rule = rules.find((item) => item.staff === booking.staff && item.source === booking.source);
    const formula = rule?.formula || fallbackFormula(booking);
    return { ...booking, payrollFormula: formula, commission: runFormula(formula, booking.price) };
  }), [rules]);

  const rows = staff.map((member) => {
    const staffBookings = calculatedBookings.filter((booking) => booking.staff === member.name);
    const sales = staffBookings.reduce((total, booking) => total + booking.price, 0);
    const commission = staffBookings.reduce((total, booking) => total + booking.commission, 0);
    return { member, staffBookings, sales, commission };
  });

  function updateRule(ruleId, value) {
    setRules((current) => current.map((rule) => rule.id === ruleId ? { ...rule, formula: value } : rule));
  }

  return (
    <>
      <div className="pageHead">
        <div>
          <p className="eyebrow">OCTOBER 2026</p>
          <h1>{label}</h1>
          <p>Cai cong thuc hoa hong rieng theo tung app va tung nhan vien. Dung bien <code>sale</code> trong cong thuc.</p>
        </div>
        <button className="primary">Export CSV</button>
      </div>
      <div className="payrollCards">
        {rows.map((row) => <section className="card payrollCard" key={row.member.id}><div className="avatar" style={{ background: row.member.color }}>{row.member.name[0]}</div><h2>{row.member.name}</h2><span>Sales {yen(row.sales)}</span><strong>{yen(row.commission)}</strong><small>{row.staffBookings.length} bookings</small></section>)}
      </div>
      <section className="card tableWrap">
        <table>
          <thead><tr><th>Date</th><th>Customer</th><th>Source</th><th>Staff</th><th>Sale</th><th>Formula</th><th>Commission</th></tr></thead>
          <tbody>{calculatedBookings.map((booking) => <tr key={booking.id}><td>2026/10/06</td><td>{booking.customer}</td><td>{booking.origin}</td><td>{booking.staff}</td><td>{yen(booking.price)}</td><td><code>{booking.payrollFormula}</code></td><td><strong>{yen(booking.commission)}</strong></td></tr>)}</tbody>
        </table>
      </section>
      <section className="card ruleList">
        <div className="sectionTitle"><div><h2>Payroll rule engine</h2><p>Moi dong la mot cong thuc rieng cho nhan vien + app.</p></div></div>
        <div className="ruleMatrix">
          {rules.map((rule) => <div className="ruleRow" key={rule.id}><strong>{rule.staff}</strong><span>{rule.app}</span><label>Formula<input value={rule.formula} onChange={(event) => updateRule(rule.id, event.target.value)} /></label><small>{rule.base}</small></div>)}
        </div>
      </section>
    </>
  );
}
