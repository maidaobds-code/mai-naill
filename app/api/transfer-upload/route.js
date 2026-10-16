const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const BUCKET = "mai-beauty-assets";
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE = 8 * 1024 * 1024;

export async function POST(request) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return Response.json({ ok: false, message: "Supabase server configuration is missing" }, { status: 503 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file.arrayBuffer !== "function") return Response.json({ ok: false, message: "Vui lòng chọn ảnh chuyển khoản." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return Response.json({ ok: false, message: "Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP." }, { status: 400 });
  if (file.size > MAX_SIZE) return Response.json({ ok: false, message: "Ảnh phải nhỏ hơn 8 MB." }, { status: 400 });
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `public/transfers/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: SERVICE_ROLE_KEY, authorization: `Bearer ${SERVICE_ROLE_KEY}`, "content-type": file.type, "x-upsert": "false" },
    body: await file.arrayBuffer(),
  });
  if (!uploadResponse.ok) return Response.json({ ok: false, message: await uploadResponse.text() }, { status: 502 });
  return Response.json({ ok: true, url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}` });
}

