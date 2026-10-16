import { adminCookie, createAdminSession } from "../../../lib/serverAuth";

export async function POST(request) {
  const { email = "", password = "" } = await request.json().catch(() => ({}));
  const adminUser = process.env.ADMIN_USER || "";
  const adminPass = process.env.ADMIN_PASS || "";

  if (!adminUser || !adminPass) {
    return Response.json({ ok: false, message: "Chưa cấu hình ADMIN_USER và ADMIN_PASS trên Vercel." }, { status: 503 });
  }

  const userMatches = email.trim().toLowerCase() === adminUser.trim().toLowerCase();
  const passMatches = password === adminPass;
  if (!userMatches || !passMatches) {
    return Response.json({ ok: false, message: "Sai tài khoản hoặc mật khẩu admin." }, { status: 401 });
  }

  const sessionToken = createAdminSession();
  const response = Response.json({
    ok: true,
    account: {
      id: "owner",
      role: "owner",
      name: "Chủ quán",
      email: adminUser,
      phone: "",
      address: "",
      staffName: "",
    },
  });
  response.headers.set("Set-Cookie", adminCookie(sessionToken));
  return response;
}
