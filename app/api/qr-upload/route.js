import { isAdminRequest } from "../../../lib/serverAuth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

export async function POST(request) {
  if (!isAdminRequest(request)) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return Response.json({ ok: false, message: "Supabase server configuration is missing" }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file.arrayBuffer !== "function") return Response.json({ ok: false, message: "QR image is missing" }, { status: 400 });

  const safeName = String(file.name || "qr-code.png").replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `public/qr/${Date.now()}-${safeName}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/mai-beauty-assets/${path}`, {
    method: "POST",
    headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}`, "content-type": file.type || "application/octet-stream", "x-upsert": "true" },
    body: await file.arrayBuffer(),
  });
  if (!response.ok) return Response.json({ ok: false, message: await response.text() }, { status: 502 });
  return Response.json({ ok: true, url: `${SUPABASE_URL}/storage/v1/object/public/mai-beauty-assets/${path}` });
}

