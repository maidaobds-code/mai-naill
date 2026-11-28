import assert from "node:assert/strict";
process.env.ADMIN_PASS = "test-only-admin-secret";
process.env.ADMIN_USER = "owner@example.com";
const { createAdminSession, createOwnerSession, createStaffSession, adminCookie, ownerCookie, staffCookie, isAdminRequest, isOwnerRequest, isStaffRequest, clearAuthCookies } = await import("../../lib/serverAuth.js");
const days = 30 * 24 * 60 * 60;
for (const [create, cookie, verify] of [[createAdminSession, adminCookie, isAdminRequest], [() => createOwnerSession("owner-1"), ownerCookie, isOwnerRequest], [() => createStaffSession("staff-1"), staffCookie, isStaffRequest]]) {
  const token = create();
  const header = cookie(token);
  assert.ok(header.includes(`Max-Age=${days}`));
  assert.ok(header.includes("HttpOnly"));
  assert.ok(header.includes("Secure"));
  assert.equal(verify({ headers: new Headers({ cookie: header.split(";")[0] }) }), true);
}
assert.ok(clearAuthCookies().includes("Max-Age=0"));
console.log("PASS signed login sessions survive browser restart for 30 days and explicit logout clears cookies");
