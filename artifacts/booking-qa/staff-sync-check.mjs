import assert from "node:assert/strict";
import fs from "node:fs";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.CATALOG_OWNER_ID = "00000000-0000-0000-0000-000000000001";
process.env.ADMIN_USER = "owner@test.local";
process.env.ADMIN_PASS = "test-admin-password";
process.env.ADMIN_SESSION_SECRET = "test-session-secret";

const staff = [{ id: "staff-1", name: "Synced Mai", role: "Nailist", bookingVisible: true }];
let remoteValue = staff;
let accountValue = [];
globalThis.fetch = async (url, options = {}) => {
  assert.match(String(url), /^https:\/\/supabase\.test\/rest\/v1\/app_kv/);
  if ((options.method || "GET") === "POST") {
    const row = JSON.parse(options.body)[0];
    if (row.key === "nail-japan-staff") remoteValue = row.value;
    if (row.key === "nail-japan-accounts-v1") accountValue = row.value;
    return Response.json([]);
  }
  if (String(url).includes("key=eq.nail-japan-accounts-v1")) return Response.json([{ value: accountValue }]);
  return Response.json([{ value: remoteValue }]);
};

const route = await import("../../app/api/staff/route.js");
const { isSeedStaffList } = await import("../../lib/staffStore.js");
const { legacySampleStaff, staff: productionDefaultStaff } = await import("../../lib/salonData.js");
const response = await route.GET(new Request("https://salon.example.com/api/staff?public=1"));
const result = await response.json();
assert.equal(response.status, 200);
assert.equal(result.ok, true);
assert.deepEqual(result.value, staff);
console.log("PASS public staff API reads the shared Supabase list");

const reorderedSeedShape = legacySampleStaff.map((member) => ({ name: member.name, external: member.external, color: member.color, role: member.role, id: member.id, status: member.status }));
assert.equal(isSeedStaffList(reorderedSeedShape), true);
assert.equal(isSeedStaffList([legacySampleStaff[2]]), true);
assert.equal(isSeedStaffList([{ id: "custom-1", name: "mai" }, { id: "custom-2", name: "âd" }, { id: "custom-3", name: "MAI" }]), false);
console.log("PASS seed detection ignores JSON property order");
console.log("PASS custom owner staff list is eligible for automatic Supabase migration");

assert.deepEqual(productionDefaultStaff, []);
remoteValue = legacySampleStaff;
const cleanupResponse = await route.GET(new Request("https://salon.example.com/api/staff?public=1"));
const cleanupResult = await cleanupResponse.json();
assert.deepEqual(cleanupResult.value, []);
assert.deepEqual(remoteValue, []);
console.log("PASS production contains no built-in sample employees");
console.log("PASS legacy sample employees are removed from shared Supabase data");

remoteValue = [legacySampleStaff[2]];
const partialCleanupResponse = await route.GET(new Request("https://salon.example.com/api/staff?public=1"));
const partialCleanupResult = await partialCleanupResponse.json();
assert.deepEqual(partialCleanupResult.value, []);
assert.deepEqual(remoteValue, []);
console.log("PASS exact partial sample remnants are also removed");

remoteValue = [];
accountValue = [
  { id: "staff-real-mai", role: "owner", name: "MAI", staffName: "MAI", email: "info@mainaill.com", passwordHash: "hash" },
  { id: "staff-real-nailist", role: "staff", name: "Nailist thật", email: "nailist@example.com", passwordHash: "hash" },
  { id: "customer-1", role: "customer", name: "Khách", email: "customer@example.com" },
];
const restoreResponse = await route.GET(new Request("https://salon.example.com/api/staff?public=1"));
const restoreResult = await restoreResponse.json();
assert.equal(restoreResult.value.length, 2);
assert.deepEqual(restoreResult.value.map((member) => member.name), ["MAI", "Nailist thật"]);
assert.deepEqual(remoteValue.map((member) => member.id), ["real-mai", "real-nailist"]);
console.log("PASS real owner/staff accounts restore the shared employee list");

const accountsRoute = await import("../../app/api/accounts/route.js");
const { createAdminSession, adminCookie } = await import("../../lib/serverAuth.js");
accountValue = [
  { id: "owner", role: "owner", name: "Owner", email: "owner@test.local", passwordHash: "hash" },
  { id: "staff-delete-me", role: "staff", name: "Delete Me", email: "reuse@example.com", passwordHash: "hash" },
];
const deleteRequest = new Request("https://salon.example.com/api/accounts", { method: "DELETE", headers: { cookie: adminCookie(createAdminSession()), "content-type": "application/json" }, body: JSON.stringify({ accountId: "staff-delete-me" }) });
const deleteResponse = await accountsRoute.DELETE(deleteRequest);
const deleteResult = await deleteResponse.json();
assert.equal(deleteResponse.status, 200);
assert.equal(deleteResult.ok, true);
assert.deepEqual(accountValue.map((account) => account.id), ["owner"]);
assert.equal(accountValue.some((account) => account.email === "reuse@example.com"), false);
console.log("PASS deleting a staff login removes its Supabase account and releases the email");

accountValue = [{ id: "owner-existing", role: "owner", name: "Old Owner", email: "info@mainaill.com", passwordHash: "old-hash" }];
const ownerAccountRequest = new Request("https://salon.example.com/api/accounts", { method: "POST", headers: { cookie: adminCookie(createAdminSession()), "content-type": "application/json" }, body: JSON.stringify({ account: { id: "staff-new-owner", role: "owner", name: "MAI", staffName: "MAI", email: "info@mainaill.com", passwordHash: "new-hash" } }) });
const ownerAccountResponse = await accountsRoute.POST(ownerAccountRequest);
const ownerAccountResult = await ownerAccountResponse.json();
assert.equal(ownerAccountResponse.status, 200);
assert.equal(ownerAccountResult.ok, true);
assert.equal(accountValue.length, 1);
assert.equal(accountValue[0].id, "staff-new-owner");
assert.equal(accountValue[0].role, "owner");
console.log("PASS a new owner staff account can reuse an email released from the previous account");

remoteValue = [{ id: "current-staff", name: "Current", email: "current@example.com", role: "staff" }];
accountValue = [
  { id: "owner", role: "owner", name: "Owner", email: "owner@test.local", passwordHash: "hash" },
  { id: "staff-current-staff", role: "staff", name: "Current", staffName: "Current", email: "current@example.com", passwordHash: "hash" },
  { id: "staff-old", role: "staff", name: "Old", staffName: "Old", email: "old@example.com", passwordHash: "hash" },
  { id: "customer-keep", role: "customer", name: "Customer", email: "customer@example.com", passwordHash: "hash" },
];
const orphanCleanupRequest = new Request("https://salon.example.com/api/staff", { method: "POST", headers: { cookie: adminCookie(createAdminSession()), "content-type": "application/json" }, body: JSON.stringify({ value: remoteValue }) });
const orphanCleanupResponse = await route.POST(orphanCleanupRequest);
const orphanCleanupResult = await orphanCleanupResponse.json();
assert.equal(orphanCleanupResponse.status, 200);
assert.deepEqual(orphanCleanupResult.removedAccountIds, ["staff-old"]);
assert.deepEqual(accountValue.map((account) => account.id), ["owner", "staff-current-staff", "customer-keep"]);
console.log("PASS saving the authoritative staff list removes every orphan staff account but preserves owner and customer accounts");

const staffManagementSource = fs.readFileSync(new URL("../../components/StaffManagement.js", import.meta.url), "utf8");
assert.match(staffManagementSource, /passwordConfirmation/);
assert.match(staffManagementSource, /draft\.accountPassword !== passwordConfirmation/);
assert.equal((staffManagementSource.match(/passwordVisibilityButton/g) || []).length >= 2, true);
console.log("PASS staff creation requires matching password confirmation and provides visibility buttons");
