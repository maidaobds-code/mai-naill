import { NextResponse } from "next/server";

export async function POST(request) {
  const { to, subject, html, includeOwner = false } = await request.json().catch(() => ({}));
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Mai Beauty Salon <onboarding@resend.dev>";
  if (!apiKey) return NextResponse.json({ ok: false, skipped: true, reason: "RESEND_API_KEY is not configured" }, { status: 200 });
  if (!to || !subject || !html) return NextResponse.json({ ok: false, error: "Missing email fields" }, { status: 400 });
  const recipients = [...(Array.isArray(to) ? to : [to]), ...(includeOwner ? [process.env.OWNER_EMAIL] : [])].filter(Boolean);
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [...new Set(recipients)], subject, html }) });
  const data = await response.json().catch(() => ({}));
  return NextResponse.json({ ok: response.ok, ...data }, { status: response.ok ? 200 : response.status });
}
