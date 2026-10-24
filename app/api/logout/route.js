import { clearAuthCookies } from "../../../lib/serverAuth";
export async function POST() { const response = Response.json({ ok: true }); response.headers.set("Set-Cookie", clearAuthCookies()); return response; }
