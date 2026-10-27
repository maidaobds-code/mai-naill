import { managementEmails, sendEmail } from "../../../lib/serverEmail.js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const ORDERS_OWNER_ID = process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001";
const ORDERS_KEY = "nail-japan-store-orders";

async function supabaseRest(path, options = {}) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Supabase server configuration is missing");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));
}

async function notifyManagementForOrder(order) {
  const recipients = await managementEmails();
  if (!recipients.length) return { ok: false, skipped: true, reason: "No owner or manager email is configured" };
  const subject = `Mai Beauty Salon · Đơn hàng mới ${order.orderNumber || order.id}`;
  const text = `Có đơn hàng mới.\nMã đơn: ${order.orderNumber || order.id}\nKhách hàng: ${order.customer || "-"}\nSản phẩm: ${order.productName || "-"}\nSố lượng: ${order.quantity || 1}\nTổng tiền: JPY ${Number(order.total || 0).toLocaleString("ja-JP")}\nThanh toán: ${order.paymentMethod || order.paymentStatus || "-"}`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#332936"><h2>Đơn hàng mới từ website</h2><p><strong>Mã đơn:</strong> ${escapeHtml(order.orderNumber || order.id)}</p><p><strong>Khách hàng:</strong> ${escapeHtml(order.customer)}</p><p><strong>Gmail:</strong> ${escapeHtml(order.email)}</p><p><strong>Sản phẩm:</strong> ${escapeHtml(order.productName)} × ${Number(order.quantity || 1)}</p><p><strong>Tổng tiền:</strong> JPY ${Number(order.total || 0).toLocaleString("ja-JP")}</p><p><strong>Thanh toán:</strong> ${escapeHtml(order.paymentMethod || order.paymentStatus)}</p><p><strong>Nhận hàng:</strong> ${escapeHtml(order.fulfillmentType)}</p>${order.address ? `<p><strong>Địa chỉ:</strong> ${escapeHtml(order.address)}</p>` : ""}<p><strong>Ghi chú:</strong> ${escapeHtml(order.note)}</p></div>`;
  return sendEmail({ to: recipients, subject, text, html });
}

export async function GET() {
  try {
    const rows = await supabaseRest(`app_kv?owner_id=eq.${ORDERS_OWNER_ID}&key=eq.${ORDERS_KEY}&select=value&limit=1`);
    return Response.json({ ok: true, value: Array.isArray(rows?.[0]?.value) ? rows[0].value : [] }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch {
    return Response.json({ ok: false, message: "Không thể đọc đơn hàng.", value: [] }, { status: 500 });
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (!Array.isArray(body.orders)) return Response.json({ ok: false, message: "Invalid orders" }, { status: 400 });
  try {
    const currentRows = await supabaseRest(`app_kv?owner_id=eq.${ORDERS_OWNER_ID}&key=eq.${ORDERS_KEY}&select=value&limit=1`);
    const currentOrders = Array.isArray(currentRows?.[0]?.value) ? currentRows[0].value : [];
    const currentIds = new Set(currentOrders.map((order) => order?.id).filter(Boolean));
    const incomingIds = new Set(body.orders.map((order) => order?.id).filter(Boolean));
    const mergedOrders = [
      ...body.orders,
      ...currentOrders.filter((order) => order?.id && !incomingIds.has(order.id)),
    ].sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
    const rows = await supabaseRest("app_kv?on_conflict=owner_id,key", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([{ owner_id: ORDERS_OWNER_ID, key: ORDERS_KEY, value: mergedOrders, updated_at: new Date().toISOString() }]),
    });
    const newOrders = body.orders.filter((order) => order?.id && !currentIds.has(order.id));
    const notifications = await Promise.all(newOrders.map((order) => notifyManagementForOrder(order).catch((error) => ({ ok: false, reason: error.message }))));
    return Response.json({ ok: true, value: rows?.[0]?.value || mergedOrders, managementNotifications: notifications });
  } catch {
    return Response.json({ ok: false, message: "Không thể lưu đơn hàng." }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  if (!id) return Response.json({ ok: false, message: "Order id is required" }, { status: 400 });
  try {
    const currentRows = await supabaseRest(`app_kv?owner_id=eq.${ORDERS_OWNER_ID}&key=eq.${ORDERS_KEY}&select=value&limit=1`);
    const currentOrders = Array.isArray(currentRows?.[0]?.value) ? currentRows[0].value : [];
    const nextOrders = currentOrders.filter((order) => order?.id !== id);
    await supabaseRest("app_kv?on_conflict=owner_id,key", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([{ owner_id: ORDERS_OWNER_ID, key: ORDERS_KEY, value: nextOrders, updated_at: new Date().toISOString() }]),
    });
    return Response.json({ ok: true, value: nextOrders });
  } catch {
    return Response.json({ ok: false, message: "Không thể xóa đơn hàng." }, { status: 500 });
  }
}
