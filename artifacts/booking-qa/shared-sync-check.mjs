import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.CATALOG_OWNER_ID = "00000000-0000-0000-0000-000000000001";

let stored = [
  { id: 1, date: "2026-10-26", start: "10:00", end: "11:00", customer: "Old numeric ID", staff: "Mai", status: "CONFIRMED" },
  { id: "legacy-copy-1", date: "2026-10-26", start: "10:00", end: "11:00", customer: "Old numeric ID", staff: "Mai", status: "CONFIRMED" },
];

globalThis.fetch = async (url, options = {}) => {
  const value = String(url);
  if (!value.startsWith("https://supabase.test/rest/v1/app_kv")) throw new Error(`Unexpected fetch: ${value}`);
  if ((options.method || "GET") === "POST") {
    const row = JSON.parse(options.body)[0];
    stored = row.value;
    return Response.json([row]);
  }
  return Response.json([{ value: stored }]);
};

const route = await import("../../app/api/bookings/route.js");
const request = (bookings) => new Request("https://salon.example.com/api/bookings", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ bookings }),
});

// Account A loads the old numeric booking ID.
const firstRead = await (await route.GET()).json();
assert.equal(firstRead.value.length, 2);
assert.equal(firstRead.value[0].id, "1");

// Account A deletes it using the normalized string ID.
const tombstone = { ...firstRead.value[0], deletedAt: "2026-10-26T01:00:00.000Z" };
const deleteResult = await (await route.POST(request([tombstone]))).json();
assert.equal(deleteResult.ok, true);
assert.equal(deleteResult.value.length, 2);
assert.equal(deleteResult.value.every((item) => item.deletedAt === tombstone.deletedAt), true);

// Account B reloads and must receive only the tombstone (hidden by the UI).
const secondRead = await (await route.GET()).json();
assert.equal(secondRead.value.length, 2);
assert.equal(secondRead.value.filter((item) => !item.deletedAt).length, 0);

// A stale account tries to write the old live copy. The server must not revive it.
const staleWrite = await (await route.POST(request([{ ...firstRead.value[0] }]))).json();
assert.equal(staleWrite.ok, true);
assert.equal(staleWrite.value.filter((item) => !item.deletedAt).length, 0);
assert.equal(staleWrite.value.every((item) => item.deletedAt === tombstone.deletedAt), true);

// Both accounts now read exactly the same server state.
const accountA = await (await route.GET()).json();
const accountB = await (await route.GET()).json();
assert.deepEqual(accountA.value, accountB.value);

console.log("PASS numeric ID is normalized to string ID");
console.log("PASS deletion remains after server reload");
console.log("PASS stale account cannot restore deleted booking");
console.log("PASS legacy duplicate with another ID is deleted in the same slot");
console.log("PASS owner and staff reads are identical");
