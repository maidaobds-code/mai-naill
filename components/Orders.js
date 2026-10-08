"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { orders as seedOrders } from "../lib/ecommerce/data";
import { useStoreOrders } from "../lib/orderStore";

function money(value) {
  return `JPY ${Number(value || 0).toLocaleString("ja-JP")}`;
}

function normalizeSeedOrder(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customer: order.customer,
    phone: "-",
    email: "-",
    productName: `${order.items} items`,
    total: order.total,
    createdAt: order.createdAt,
    paymentStatus: order.paymentStatus,
    status: order.fulfillmentStatus,
    fulfillmentType: order.source,
    address: "-",
    chat: [],
    unread: false,
  };
}

export default function Orders() {
  const { orders, updateOrder, confirmOrder, markShipped, addChatMessage } = useStoreOrders();
  const [selectedId, setSelectedId] = useState("");
  const [reply, setReply] = useState("");
  const [toast, setToast] = useState("");
  const previousCount = useRef(0);
  const allOrders = useMemo(() => [...orders, ...seedOrders.map(normalizeSeedOrder)], [orders]);
  const selected = allOrders.find((order) => order.id === selectedId) || allOrders[0];
  const revenue = allOrders.reduce((total, order) => total + Number(order.total || 0), 0);
  const unreadCount = orders.filter((order) => order.unread).length;

  useEffect(() => {
    if (!selectedId && allOrders[0]) setSelectedId(allOrders[0].id);
  }, [allOrders, selectedId]);

  useEffect(() => {
    if (previousCount.current && orders.length > previousCount.current) {
      const newest = orders[0];
      setToast(`Co don hang moi: ${newest.orderNumber}`);
      setSelectedId(newest.id);
      const timer = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(timer);
    }
    previousCount.current = orders.length;
  }, [orders]);

  function openOrder(order) {
    setSelectedId(order.id);
    if (order.unread) updateOrder(order.id, { unread: false });
  }

  function sendReply() {
    if (!selected || selected.id.startsWith("order-1") || selected.id.startsWith("order-2")) return;
    addChatMessage(selected.id, reply, "owner");
    setReply("");
  }

  function updateSelected(field, value) {
    if (!selected || !orders.some((order) => order.id === selected.id)) return;
    updateOrder(selected.id, { [field]: value });
  }

  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">ORDERS</p><h1>Orders</h1><p>Hien thi so don khach dat, tinh trang don va tra loi tin nhan truc tiep.</p></div>
        <button className="primary">Export CSV</button>
      </div>
      {toast && <div className="orderToast card"><strong>Thong bao</strong><span>{toast}</span></div>}
      <div className="stats">
        <div className="stat card"><span>Don khach dat</span><strong>{orders.length}</strong><small>{unreadCount} don moi chua xem</small></div>
        <div className="stat card"><span>Tat ca don</span><strong>{allOrders.length}</strong><small>Web + du lieu mau</small></div>
        <div className="stat card"><span>Doanh thu san pham</span><strong>{money(revenue)}</strong><small>Before refunds</small></div>
        <div className="stat card"><span>Can xu ly</span><strong>{allOrders.filter((order) => !["FULFILLED", "Completed", "Delivered"].includes(order.status)).length}</strong><small>Payment / fulfillment</small></div>
      </div>

      <div className="ordersWorkspace">
        <section className="card tableWrap ordersTable">
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Product</th><th>Payment</th><th>Status</th><th>Total</th></tr></thead>
            <tbody>{allOrders.map((order) => (
              <tr key={order.id} className={selected?.id === order.id ? "selectedOrderRow" : ""} onClick={() => openOrder(order)}>
                <td><strong>{order.orderNumber}</strong>{order.unread && <span className="newDot">New</span>}</td>
                <td>{order.customer}<br /><small>{order.phone}</small></td>
                <td>{order.productName}</td>
                <td><span className="pill">{order.paymentStatus}</span></td>
                <td><span className="pill active">{order.status}</span></td>
                <td><strong>{money(order.total)}</strong></td>
              </tr>
            ))}</tbody>
          </table>
        </section>

        {selected && <aside className="card orderDetailPanel">
          <div className="sectionTitle"><div><h2>{selected.orderNumber}</h2><p>{selected.productName}</p></div><span className="pill active">{selected.fulfillmentType}</span></div>
          <div className="orderInfoGrid"><div><span>Khach hang</span><strong>{selected.customer}</strong></div><div><span>Phone</span><strong>{selected.phone}</strong></div><div><span>Gmail</span><strong>{selected.email}</strong></div><div><span>Total</span><strong>{money(selected.total)}</strong></div></div>
          <div className="orderActionBar"><button className="primary" onClick={() => confirmOrder(selected.id, "Admin")}>Nhan vien xac nhan don</button><button className="ghost" onClick={() => markShipped(selected.id)}>Da gui hang cho khach</button></div><div className="orderStatusControls"><label>Tinh trang don<select value={selected.status} onChange={(event) => updateSelected("status", event.target.value)}><option>Waiting payment</option><option>Payment checking</option><option>Preparing</option><option>Ready for pickup</option><option>Shipping</option><option>Delivered</option><option>Completed</option><option>Cancelled</option></select></label><label>Thanh toan<select value={selected.paymentStatus} onChange={(event) => updateSelected("paymentStatus", event.target.value)}><option>Waiting payment</option><option>Payment checking</option><option>Paid</option><option>Pay at store</option><option>Refunded</option></select></label></div>
          {selected.address && selected.address !== "-" && <div className="orderAddress"><span>Dia chi</span><strong>{selected.address}</strong></div>}
          {selected.transferBillUrl && <div className="orderBill"><span>Bill chuyen khoan</span><img src={selected.transferBillUrl} alt="Transfer bill" /></div>}
          {(selected.emailLog || []).length > 0 && <div className="emailLogBox"><h3>Gmail da gui cho khach</h3>{selected.emailLog.map((email) => <p key={email.id}><strong>{email.subject}</strong><span>{email.body}</span><small>{new Date(email.at).toLocaleString("ja-JP")}</small></p>)}</div>}<div className="ownerChatBox"><h3>Chat voi khach</h3><div className="ownerChatMessages">{(selected.chat || []).length ? selected.chat.map((item) => <p key={item.id} className={item.from === "owner" ? "fromOwner" : "fromCustomer"}><strong>{item.from === "owner" ? "Chu quan" : "Khach"}</strong>{item.text}</p>) : <span>Chua co tin nhan.</span>}</div><div className="ownerReply"><input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Tra loi khach hang" /><button className="primary" onClick={sendReply}>Gui</button></div></div>
        </aside>}
      </div>
    </>
  );
}

