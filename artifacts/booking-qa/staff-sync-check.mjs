import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.CATALOG_OWNER_ID = "00000000-0000-0000-0000-000000000001";

const staff = [{ id: "staff-1", name: "Synced Mai", role: "Nailist", bookingVisible: true }];
let remoteValue = staff;
let accountValue = [];
globalThis.fetch = async (url, options = {}) => {
  assert.match(String(url), /^https:\/\/supabase\.test\/rest\/v1\/app_kv/);
  if ((options.method || "GET") === "POST") {
    const row = JSON.parse(options.body)[0];
    if (row.key === "nail-japan-staff") remoteValue = row.value;
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
