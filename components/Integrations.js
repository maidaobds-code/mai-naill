"use client";
import { platforms, staff, syncEvents } from "../lib/salonData";
import { bookingProviders } from "../lib/booking-providers/registry";

export default function Integrations({ label = "Integrations" }) {
  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">CONNECTORS</p><h1>{label}</h1><p>Map external staff accounts into one internal staff profile and monitor sync health.</p></div>
        <button className="primary">Sync now</button>
      </div>
      <div className="syncBanner card">
        <strong>Lịch trung tâm Supabase</strong>
        <span>Mọi booking từ Nailie, minimo, HOT PEPPER và website riêng đều ghi về appointments. Website riêng luôn dùng dữ liệu trung tâm khi tính giờ trống.</span>
      </div>
      <div className="integrationGrid">
        {platforms.filter((platform) => platform.id !== "direct").map((platform) => {
          const provider = bookingProviders[platform.id === "hotpepper" ? "hotpepper" : platform.id];
          return (
          <section className="card integrationCard" key={platform.id}>
            <div className="platformMark" style={{ background: platform.color }}>{platform.name[0]}</div>
            <div><h2>{platform.name}</h2><p>{provider?.status === "manual" ? "Manual / chờ API hợp lệ" : platform.status}</p></div>
            <div className="capabilities">
              <span>Read OK</span>
              <span>Block {provider?.capabilities?.includes("block") ? "OK" : "Manual"}</span>
              <span>Update {provider?.capabilities?.includes("update") ? "OK" : "Manual"}</span>
              <span>Cancel {provider?.capabilities?.includes("cancel") ? "OK" : "Manual"}</span>
            </div>
            {provider?.status === "manual" && <p className="manualNotice">Không giả lập API, không crawl. Khi có OAuth/API chính thức chỉ cần thay adapter provider này.</p>}
          </section>
        )})}
      </div>
      <section className="card tableWrap">
        <table>
          <thead><tr><th>Internal staff</th><th>Hot Pepper</th><th>Nailie</th><th>minimo</th><th>Sync</th></tr></thead>
          <tbody>{staff.map((member) => (
            <tr key={member.id}>
              <td><strong>{member.name}</strong></td>
              <td>{member.external.hotpepper}</td>
              <td>{member.external.nailie}</td>
              <td>{member.external.minimo}</td>
              <td><span className="pill active">Enabled</span></td>
            </tr>
          ))}</tbody>
        </table>
      </section>
      <section className="card syncLog">
        <h2>Latest sync events</h2>
        {syncEvents.map((event) => <div className="syncRow" key={event.id}><span className={`pill ${event.severity.toLowerCase()}`}>{event.severity}</span><strong>{event.title}</strong><p>{event.detail}</p></div>)}
      </section>
    </>
  );
}
