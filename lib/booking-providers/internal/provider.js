export const internalProvider = {
  name: "internal",
  status: "connected",
  capabilities: ["read", "create", "update", "cancel", "block", "unblock"],
  getBookings: async ({ supabase, range }) => supabase?.from("appointments").select("*").gte("start_at", range?.from).lte("end_at", range?.to),
  getAvailability: async () => [],
  createBooking: async ({ supabase, payload }) => supabase?.from("appointments").insert(payload).select().single(),
  updateBooking: async ({ supabase, id, payload }) => supabase?.from("appointments").update(payload).eq("id", id).select().single(),
  cancelBooking: async ({ supabase, id }) => supabase?.from("appointments").update({ status: "cancelled" }).eq("id", id),
  blockSlot: async () => ({ ok: true, provider: "internal" }),
  unblockSlot: async () => ({ ok: true, provider: "internal" }),
};
