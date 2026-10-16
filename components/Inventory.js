"use client";
import { getInventoryRows } from "../lib/ecommerce/data";

function money(value) {
  return `¥${value.toLocaleString("ja-JP")}`;
}

export default function Inventory() {
  const rows = getInventoryRows();
  const available = rows.reduce((total, row) => total + row.quantityAvailable, 0);
  const reserved = rows.reduce((total, row) => total + row.quantityReserved, 0);
  const costValue = rows.reduce((total, row) => total + row.valueAtCost, 0);
  const lowStock = rows.filter((row) => row.quantityAvailable <= row.threshold).length;

  return (
    <>
      <div className="pageHead">
        <div>
          <p className="eyebrow">INVENTORY</p>
          <h1>Inventory</h1>
          <p>One stock source for salon POS and the public online store.</p>
        </div>
        <button className="primary">+ Stock Adjustment</button>
      </div>

      <div className="stats">
        <div className="stat card"><span>Available units</span><strong>{available}</strong><small>Across all locations</small></div>
        <div className="stat card"><span>Reserved</span><strong>{reserved}</strong><small>Held for online orders</small></div>
        <div className="stat card"><span>Cost value</span><strong>{money(costValue)}</strong><small>Based on current cost</small></div>
        <div className="stat card"><span>Low stock rows</span><strong>{lowStock}</strong><small>Below threshold</small></div>
      </div>

      <section className="card tableWrap">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Variant</th>
              <th>Location</th>
              <th>Available</th>
              <th>Reserved</th>
              <th>Incoming</th>
              <th>Available to sell</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.sku}</td>
                <td><strong>{row.productName}</strong></td>
                <td>{row.variantName}</td>
                <td>{row.locationName}</td>
                <td><span className={row.quantityAvailable <= row.threshold ? "pill danger" : "pill"}>{row.quantityAvailable}</span></td>
                <td>{row.quantityReserved}</td>
                <td>{row.quantityIncoming}</td>
                <td><strong>{row.availableToSell}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
