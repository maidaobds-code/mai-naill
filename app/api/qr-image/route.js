const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const SETTINGS_KEY = "nail-japan-settings";
const BUCKET = "mai-beauty-assets";

function objectPath(url) {
  if (!url || typeof url !== "string") return "";
  const markers = [`/storage/v1/object/public/${BUCKET}/`, `/storage/v1/object/sign/${BUCKET}/`, `/storage/v1/object/${BUCKET}/`];
  for (const marker of markers) {
    const index = url.indexOf(marker);
    if (index >= 0) return decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
  }
  return "";
}

export async function GET() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return new Response("Supabase server configuration is missing", { status: 503 });
  const settingsResponse = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?key=eq.${SETTINGS_KEY}&select=value,updated_at&order=updated_at.desc&limit=1`, {
    cache: "no-store",
    headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!settingsResponse.ok) return new Response("Cannot load QR settings", { status: 502 });
  const rows = await settingsResponse.json();
  let path = objectPath(rows?.[0]?.value?.qrImageUrl);
  if (!path) {
    const listResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      cache: "no-store",
      headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ prefix: "public/qr", limit: 1, offset: 0, sortBy: { column: "created_at", order: "desc" } }),
    });
    if (listResponse.ok) {
      const files = await listResponse.json();
      if (files?.[0]?.name) path = `public/qr/${files[0].name}`;
    }
  }
  if (!path) return new Response("QR image is not configured", { status: 404 });
  const imageResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    cache: "no-store",
    headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!imageResponse.ok) return new Response("QR image cannot be loaded", { status: imageResponse.status });
  return new Response(await imageResponse.arrayBuffer(), {
    headers: { "Content-Type": imageResponse.headers.get("content-type") || "image/png", "Cache-Control": "no-store, max-age=0" },
  });
}
