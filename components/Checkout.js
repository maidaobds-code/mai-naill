"use client";
import { bookings, payments } from "../lib/salonData";
import { getProductSummary } from "../lib/ecommerce/data";

function yen(value) {
  return `¥${value.toLocaleString("ja-JP")}`;
}

export default function Checkout({ label = "POS / Checkout" }) {
  const appointment = bookings[4];
  const product = getProductSummary()[1];
  const serviceTotal = appointment.price;
  const productTotal = product.salePrice || product.basePrice;
  const total = serviceTotal + productTotal;

  return (
    <>
      <div className="pageHead">
        <div><p className="eyebrow">CHECKOUT</p><h1>{label}</h1><p>Service and product sales share payment, revenue, and inventory logic.</p></div>
        <button className="primary">Complete sale</button>
      </div>
      <div className="checkoutLayout">
        <section className="card checkoutPanel">
          <h2>{appointment.customer}</h2>
          <p>{appointment.phone} · {appointment.staff}</p>
          <div className="lineItem"><span>{appointment.service}</span><strong>{yen(serviceTotal)}</strong></div>
          <div className="lineItem"><span>{product.name}</span><strong>{yen(productTotal)}</strong></div>
          <div className="totalLine"><span>Total</span><strong>{yen(total)}</strong></div>
        </section>
        <section className="card checkoutPanel">
          <h2>Payment method</h2>
          <div className="paymentMethods">
            {["Cash", "Card", "QR", "App payment", "Bank transfer"].map((method) => <button className="ghost" key={method}>{method}</button>)}
          </div>
          <h3>Daily closing</h3>
          {payments.map((payment) => <div className="lineItem" key={payment.id}><span>{payment.method}</span><strong>{yen(payment.amount)}</strong></div>)}
          <div className="totalLine"><span>Today revenue</span><strong>{yen(payments.reduce((sum, item) => sum + item.amount, 0))}</strong></div>
        </section>
      </div>
    </>
  );
}
