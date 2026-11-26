import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const TOKEN = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const OWNER = String(process.env.CATALOG_OWNER_ID || "00000000-0000-0000-0000-000000000001").trim().replace(/^['"]|['"]$/g, "");
const KEY = "nail-japan-bot-credentials";
const platforms = ["salonboard", "nailie"];

function cipherKey() {
  const secret = process.env.AUTOMATION_CREDENTIALS_KEY || process.env.BOOKING_SYNC_SECRET;
  if (!secret || secret.length < 24) throw new Error("Cần cấu hình AUTOMATION_CREDENTIALS_KEY (ít nhất 24 ký tự) trên máy chủ.");
  return createHash("sha256").update(secret).digest();
}

async function rest(path, options = {}) {
  if (!URL || !TOKEN) throw new Error("Supabase chưa được cấu hình.");
  const response = await fetch(`${URL}/rest/v1/${path}`, { ...options, cache: "no-store", headers: { apikey: TOKEN, authorization: `Bearer ${TOKEN}`, "content-type": "application/json", ...(options.headers || {}) } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error("Không thể lưu thông tin bot trên máy chủ.");
  return data;
}

export async function readBotCredentials() {
  const rows = await rest(`app_kv?owner_id=eq.${OWNER}&key=eq.${KEY}&select=value&limit=1`);
  return rows?.[0]?.value || {};
}

function encrypt(password) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cipherKey(), iv);
  const data = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64url")).join(".");
}

function decrypt(value) {
  if (!value) return "";
  const [iv, tag, data] = String(value).split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", cipherKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function botCredentialStatus(record) {
  return Object.fromEntries(platforms.map((platform) => [platform, { username: record?.[platform]?.username || "", hasPassword: Boolean(record?.[platform]?.password) }]));
}

export function botCredentialsForWorker(record) {
  return Object.fromEntries(platforms.map((platform) => [platform, { username: record?.[platform]?.username || "", password: decrypt(record?.[platform]?.password) }]));
}

export async function saveBotCredential(platform, username, password, clearPassword = false) {
  if (!platforms.includes(platform)) throw new Error("Nền tảng không hợp lệ.");
  const current = await readBotCredentials();
  const previous = current[platform] || {};
  const next = { ...current, [platform]: { username: String(username || "").trim(), password: clearPassword ? "" : password ? encrypt(String(password)) : previous.password || "" } };
  await rest("app_kv?on_conflict=owner_id,key", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ owner_id: OWNER, key: KEY, value: next, updated_at: new Date().toISOString() }]) });
  return botCredentialStatus(next);
}
