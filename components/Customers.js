"use client";
import { customers } from "../lib/mock";
export default function Customers(){
  return <>
    <div className="pageHead">
      <div><p className="eyebrow">CRM</p><h1>Khách hàng</h1><p>Lịch sử sử dụng, ghi chú, nguồn khách và phân loại khách mới/cũ.</p></div>
      <button className="primary">＋ Thêm khách</button>
    </div>
    <div className="card tableWrap">
      <table><thead><tr><th>Khách</th><th>Điện thoại</th><th>Số lần đến</th><th>Lần gần nhất</th><th>Tổng chi</th><th>Phân loại</th></tr></thead>
      <tbody>{customers.map(c=><tr key={c.id}><td><strong>{c.name}</strong></td><td>{c.phone}</td><td>{c.visits}</td><td>{c.lastVisit}</td><td>¥{c.spend.toLocaleString()}</td><td><span className="pill">{c.tag}</span></td></tr>)}</tbody></table>
    </div>
  </>
}
