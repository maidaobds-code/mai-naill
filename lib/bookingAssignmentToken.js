import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  return process.env.BOOKING_ASSIGN_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
}

function signature(value) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createBookingAssignmentToken(bookingId, maxAgeSeconds = 48 * 60 * 60) {
  if (!secret()) throw new Error("BOOKING_ASSIGN_SECRET is not configured");
  const payload = Buffer.from(JSON.stringify({ bookingId, expiresAt: Date.now() + maxAgeSeconds * 1000 })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function createBookingCancellationToken(bookingId, maxAgeSeconds = 30 * 24 * 60 * 60) {
  if (!secret()) throw new Error("BOOKING_ASSIGN_SECRET is not configured");
  const payload = Buffer.from(JSON.stringify({ bookingId, purpose: "customer-cancel", expiresAt: Date.now() + maxAgeSeconds * 1000 })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

function verifyToken(token) {
  if (!secret() || !token) return null;
  const [payload, supplied] = String(token).split(".");
  if (!payload || !supplied) return null;
  const expected = Buffer.from(signature(payload));
  const actual = Buffer.from(supplied);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return value.bookingId && Number(value.expiresAt) > Date.now() ? value : null;
  } catch { return null; }
}

export function verifyBookingAssignmentToken(token) {
  const value = verifyToken(token);
  return value && !value.purpose ? value : null;
}

export function verifyBookingCancellationToken(token) {
  const value = verifyToken(token);
  return value?.purpose === "customer-cancel" ? value : null;
}
