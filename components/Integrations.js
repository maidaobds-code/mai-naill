"use client";
import { platforms, staff, syncEvents } from "../lib/salonData";

export default function Integrations({ label = "Integrations" }) {
  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">CONNECTORS</p><h1>{label}</h1><p>Map external staff accounts into one internal staff profile and monitor sync health.</p></div>
        <button className="primary">Sync now</button>
      </div>
      <div className="integrationGrid">
        {platforms.filter((platform) => platform.id !== "direct").map((platform) => (
          <section className="card integrationCard" key={platform.id}>
            <div className="platformMark" style={{ background: platform.color }}>{platform.name[0]}</div>
            <div><h2>{platform.name}</h2><p>{platform.status}</p></div>
            <div className="capabilities">
              <span>Read {platform.read ? "OK" : "No"}</span>
              <span>Block {platform.block ? "OK" : "No"}</span>
              <span>Update {platform.write ? "OK" : "Manual"}</span>
            </div>
          </section>
        ))}
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
