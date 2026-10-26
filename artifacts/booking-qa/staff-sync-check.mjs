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
const response = await route.GET(new Request("https://salon.example.com/api/staff?public=1"));
const result = await response.json();
assert.equal(response.status, 200);
assert.equal(result.ok, true);
assert.deepEqual(result.value, staff);
console.log("PASS public staff API reads the shared Supabase list");
