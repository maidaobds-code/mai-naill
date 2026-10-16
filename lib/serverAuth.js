import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

const COOKIE_NAME = "nail_admin_session";
const MAX_AGE = 60 * 60 * 8;

function secret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASS || "";
}

function sign(value) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createAdminSession() {
  const value = `${Date.now() + MAX_AGE * 1000}.${randomBytes(24).toString("base64url")}`;
  return `${value}.${sign(value)}`;
}

export function isAdminRequest(request) {
  const configured = Boolean(process.env.ADMIN_USER && process.env.ADMIN_PASS && secret());
  if (!configured) return false;
  const cookie = request.headers.get("cookie") || "";
  const token = cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1) || "";
  const parts = token.split(".");
  if (parts.length !== 3 || Number(parts[0]) < Date.now()) return false;
  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`));
  const actual = Buffer.from(parts[2]);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function adminCookie(token) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`;
}

export { COOKIE_NAME };
