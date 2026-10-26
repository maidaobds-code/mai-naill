import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.CATALOG_OWNER_ID = "00000000-0000-0000-0000-000000000001";

const staff = [{ id: "staff-1", name: "Synced Mai", role: "Nailist", bookingVisible: true }];
globalThis.fetch = async (url) => {
  assert.match(String(url), /^https:\/\/supabase\.test\/rest\/v1\/app_kv/);
  return Response.json([{ value: staff }]);
};

const route = await import("../../app/api/staff/route.js");
const { isSeedStaffList } = await import("../../lib/staffStore.js");
const response = await route.GET(new Request("https://salon.example.com/api/staff?public=1"));
const result = await response.json();
assert.equal(response.status, 200);
assert.equal(result.ok, true);
assert.deepEqual(result.value, staff);
console.log("PASS public staff API reads the shared Supabase list");

const reorderedSeedShape = [
  { name: "Mai", id: 1, status: "Working" },
  { name: "Yuki", id: 2, status: "Working" },
  { name: "Linh", id: 3, status: "Working" },
  { name: "Hana", id: 4, status: "Working" },
];
assert.equal(isSeedStaffList(reorderedSeedShape), true);
assert.equal(isSeedStaffList([{ id: "custom-1", name: "mai" }, { id: "custom-2", name: "âd" }, { id: "custom-3", name: "MAI" }]), false);
console.log("PASS seed detection ignores JSON property order");
console.log("PASS custom owner staff list is eligible for automatic Supabase migration");
