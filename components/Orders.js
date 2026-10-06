"use client";
import { orders } from "../lib/ecommerce/data";

function money(value) {
  return `¥${value.toLocaleString("ja-JP")}`;
}

export default function Orders() {
  const revenue = orders.reduce((total, order) => total + order.total, 0);

  return (
    <>
      <div className="pageHead">
        <div>
          <p className="eyebrow">ORDERS</p>
          <h1>Orders</h1>
          <p>Online and pickup orders with payment and fulfillment state.</p>
        </div>
        <button className="primary">Export CSV</button>
      </div>
      <div className="stats">
        <div className="stat card"><span>Orders today</span><strong>{orders.length}</strong><small>Online and pickup</small></div>
        <div className="stat card"><span>Product revenue</span><strong>{money(revenue)}</strong><small>Before refunds</small></div>
        <div className="stat card"><span>Unfulfilled</span><strong>{orders.filter((order) => order.fulfillmentStatus !== "FULFILLED").length}</strong><small>Needs salon action</small></div>
        <div className="stat card"><span>Unpaid</span><strong>{orders.filter((order) => order.paymentStatus === "UNPAID").length}</strong><small>Awaiting payment</small></div>
      </div>
      <section className="card tableWrap">
        <table>
          <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Items</th><th>Payment</th><th>Fulfillment</th><th>Source</th><th>Total</th></tr></thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td><strong>{order.orderNumber}</strong></td>
                <td>{order.customer}</td>
                <td>{order.createdAt}</td>
                <td>{order.items}</td>
                <td><span className="pill">{order.paymentStatus}</span></td>
                <td><span className="pill">{order.fulfillmentStatus}</span></td>
                <td>{order.source}</td>
                <td><strong>{money(order.total)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
