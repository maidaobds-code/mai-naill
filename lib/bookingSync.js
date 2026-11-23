const EXTERNAL_PROVIDERS = ["hotpepper", "nailie"];
const ACTIVE_STATUSES = new Set(["pending", "confirmed"]);

function clean(value) {
  return String(value ?? "").trim();
}

function timeMinutes(value) {
  const [hour, minute] = clean(value).split(":").map(Number);
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : -1;
}

function active(booking) {
  return !booking?.deletedAt && ACTIVE_STATUSES.has(clean(booking?.status).toLowerCase());
}

function sameExternalSchedule(left, right) {
  return clean(left?.date) === clean(right?.date)
    && clean(left?.start) === clean(right?.start)
    && clean(left?.end) === clean(right?.end)
    && clean(left?.staffId || left?.staff).toLowerCase() === clean(right?.staffId || right?.staff).toLowerCase()
    && clean(left?.status || "confirmed").toLowerCase() === clean(right?.status || "confirmed").toLowerCase();
}

export function bookingSlotKey(booking) {
  return [clean(booking?.date), clean(booking?.start), clean(booking?.end), clean(booking?.staffId || booking?.staff).toLowerCase()].join("|");
}

export function syncTaskId(task = {}) {
  const match = task.match || task.previousMatch || {};
  const parts=[clean(task.target), clean(task.action), clean(task.bookingId), clean(task.lockOwner), clean(match.date), clean(match.start), clean(match.end), clean(match.staffId || match.staff)];
  if(task.destination) parts.push(clean(task.destination.date),clean(task.destination.start),clean(task.destination.end),clean(task.destination.staffId||task.destination.staff));
  return parts.join("|");
}

export function bookingOverlaps(left, right) {
  const sameDate = clean(left?.date) && clean(left?.date) === clean(right?.date);
  const leftStaff = clean(left?.staffId || left?.staff).toLowerCase();
  const rightStaff = clean(right?.staffId || right?.staff).toLowerCase();
  return Boolean(sameDate && leftStaff && leftStaff === rightStaff && timeMinutes(left.start) < timeMinutes(right.end) && timeMinutes(left.end) > timeMinutes(right.start));
}

export function providerSyncState(booking = {}) {
  const current = booking.providerSync && typeof booking.providerSync === "object" ? booking.providerSync : {};
  return Object.fromEntries(EXTERNAL_PROVIDERS.map((provider) => [provider, {
    status: current[provider]?.status || "pending",
    externalBookingId: clean(current[provider]?.externalBookingId),
    lastSyncAt: current[provider]?.lastSyncAt || null,
    error: current[provider]?.error || "",
  }]));
}

export function overallSyncStatus(providerSync) {
  const states = EXTERNAL_PROVIDERS.map((provider) => providerSync?.[provider]?.status || "pending");
  if (states.includes("conflict") || states.includes("manual_required")) return "manual_required";
  if (states.every((status) => status === "synced")) return "synced";
  if (states.every((status) => status === "error")) return "error";
  return "partial";
}

export function ingestExternalBooking(bookings, event, now = new Date().toISOString()) {
  const provider = clean(event?.provider).toLowerCase();
  if (!EXTERNAL_PROVIDERS.includes(provider)) throw new Error("Unsupported booking provider");
  const externalBookingId = clean(event?.externalBookingId);
  if (!externalBookingId) throw new Error("externalBookingId is required");
  const action = clean(event?.action || "upsert").toLowerCase();
  const incoming = { ...(event?.booking || {}), source: provider, externalBookingId };
  if (provider === "nailie") {
    incoming.requestedNailieAccount = clean(event?.account || event?.booking?.nailieAccount || event?.booking?.externalStaff);
    incoming.requestedStaff = "";
    incoming.staff = "";
    incoming.staffId = "";
    incoming.assignmentStatus = "PENDING_ASSIGNMENT";
    incoming.approvalStatus = "OWNER_REVIEW_REQUIRED";
  }
  const list = Array.isArray(bookings) ? bookings.map((item) => ({ ...item })) : [];
  let existingIndex = list.findIndex((item) => clean(item.source).toLowerCase() === provider && clean(item.externalBookingId) === externalBookingId);
  // A Mainaill move changes the schedule fingerprint before the worker can
  // acknowledge the new one. Reconcile that observation with the original
  // booking instead of importing a second HOT reservation.
  if (existingIndex < 0 && provider === "hotpepper" && action === "upsert") {
    const matches = list.map((item, index) => ({ item, index })).filter(({ item }) =>
      clean(item.source).toLowerCase() === "hotpepper" && !item.deletedAt &&
      clean(item.date) === clean(incoming.date) && clean(item.start) === clean(incoming.start) &&
      clean(item.end) === clean(incoming.end) && clean(item.staff) === clean(incoming.staff) &&
      clean(item.customer) === clean(incoming.customer));
    if (matches.length === 1) existingIndex = matches[0].index;
    // HOT can issue a new fingerprint when staff or time changes. If the
    // customer/date pair is unique, reconcile it with the existing booking
    // instead of creating a second card in Mainaill.
    if (existingIndex < 0) {
      const customerKey = clean(incoming.customer).toLowerCase();
      const movedMatches = list.map((item, index) => ({ item, index })).filter(({ item }) =>
        clean(item.source).toLowerCase() === "hotpepper" && !item.deletedAt &&
        clean(item.date) === clean(incoming.date) && customerKey &&
        clean(item.customer).toLowerCase() === customerKey);
      if (movedMatches.length === 1) existingIndex = movedMatches[0].index;
    }
  }
  if (existingIndex < 0 && provider === "nailie" && action === "upsert") {
    const customerKey = clean(incoming.customer).toLowerCase();
    const matches = list.map((item, index) => ({ item, index })).filter(({ item }) =>
      !item.deletedAt && clean(item.date) === clean(incoming.date) && clean(item.start) === clean(incoming.start) &&
      clean(item.end) === clean(incoming.end) && customerKey && clean(item.customer).toLowerCase() === customerKey);
    if (matches.length === 1) existingIndex = matches[0].index;
  }
  const existing = existingIndex >= 0 ? list[existingIndex] : null;
  if (existing && provider === "nailie" && clean(existing.source).toLowerCase() === "hotpepper" && action === "upsert") {
    const sync = providerSyncState(existing);
    sync.nailie = { ...sync.nailie, status: "synced", externalBookingId, lastSyncAt: now, error: "" };
    const preserved = { ...existing, providerSync: sync, syncStatus: overallSyncStatus(sync), updatedAt: now };
    list[existingIndex] = preserved;
    return { bookings: list, result: preserved, tasks: [], duplicatePreserved: true };
  }
  if (existing && provider === "hotpepper" && (existing.pendingSyncActions || []).some((task) => task.target === "hotpepper" && task.action === "update" && task.previousMatch)) {
    return { bookings: list, result: existing, tasks: [], deferredPendingMove: true };
  }
  if (existing?.deletedAt && provider === "nailie" && action !== "cancel") return { bookings: list, result: existing, tasks: [], ignoredOwnerDeletion: true };
  const sameExternalTime = existing && clean(existing.date) === clean(incoming.date) && clean(existing.start) === clean(incoming.start) && clean(existing.end) === clean(incoming.end);
  if (provider === "nailie" && sameExternalTime && existing.assignmentStatus === "ASSIGNED") {
    incoming.staff = existing.staff;
    incoming.staffId = existing.staffId;
    incoming.staffEmail = existing.staffEmail;
    incoming.staffRole = existing.staffRole;
    incoming.assignmentStatus = "ASSIGNED";
    incoming.approvalStatus = existing.approvalStatus;
    incoming.assignedAt = existing.assignedAt;
  }

  if (action === "cancel") {
    if (!existing) return { bookings: list, result: { status: "manual_required", reason: "external booking was not found" }, tasks: [] };
    const sync = providerSyncState(existing);
    sync[provider] = { ...sync[provider], status: "synced", externalBookingId, lastSyncAt: now, error: "" };
    for (const target of EXTERNAL_PROVIDERS.filter((value) => value !== provider)) sync[target] = { ...sync[target], status: "pending", error: "" };
    const updated = { ...existing, status: "CANCELLED", cancelledAt: now, updatedAt: now, providerSync: sync, syncStatus: overallSyncStatus(sync) };
    list[existingIndex] = updated;
    const tasks = provider === "nailie" && existing.assignmentStatus !== "PENDING_ASSIGNMENT" ? [{ target: "hotpepper", action: "cancel", bookingId: updated.id }] : [];
    return { bookings: list, result: updated, tasks };
  }

  if (!incoming.date || !incoming.start || !incoming.end || (provider !== "nailie" && !(incoming.staffId || incoming.staff))) throw new Error("date, start, end and mapped staff are required");
  // Overlapping bookings are intentionally allowed to keep the mapped staff.
  // Mainaill displays the overlap so the owner can see it, but must not turn
  // the records into PENDING_CONFLICT or force a reassignment email.
  const conflict = null;
  if (conflict) {
    const conflictBookingId = existing?.id || `external-${provider}-${externalBookingId}`;
    const conflictGroupId = [clean(conflict.id), conflictBookingId].sort().join("--");
    const sync = providerSyncState(incoming);
    sync[provider] = { ...sync[provider], status: "manual_required", externalBookingId, lastSyncAt: now, error: `Conflicts with ${conflict.id}` };
    const conflictRecord = { ...(existing || {}), ...incoming, id: conflictBookingId, status: incoming.status || "CONFIRMED", assignmentStatus: "PENDING_CONFLICT", syncStatus: "manual_required", providerSync: sync, conflictWith: conflict.id, conflictGroupId, updatedAt: now };
    const conflictingIndex = list.findIndex((item) => clean(item.id) === clean(conflict.id));
    const conflictingSync = providerSyncState(conflict);
    const conflictingSource = clean(conflict.source).toLowerCase();
    if (EXTERNAL_PROVIDERS.includes(conflictingSource)) conflictingSync[conflictingSource] = { ...conflictingSync[conflictingSource], status: "manual_required", error: `Conflicts with ${conflictRecord.id}` };
    list[conflictingIndex] = { ...conflict, assignmentStatus: "PENDING_CONFLICT", syncStatus: "manual_required", providerSync: conflictingSync, conflictWith: conflictRecord.id, conflictGroupId, updatedAt: now };
    if (existingIndex >= 0) list[existingIndex] = conflictRecord;
    else list.push(conflictRecord);
    return { bookings: list, result: conflictRecord, conflicts: [list[conflictingIndex], conflictRecord], tasks: [] };
  }

  const sync = providerSyncState(existing || incoming);
  sync[provider] = { ...sync[provider], status: "synced", externalBookingId, lastSyncAt: now, error: "" };
  if (existing && sameExternalSchedule(existing, incoming)) {
    const unchanged = { ...existing, ...incoming, providerSync: sync, syncStatus: overallSyncStatus(sync), updatedAt: now };
    list[existingIndex] = unchanged;
    return { bookings: list, result: unchanged, tasks: [] };
  }
  for (const target of EXTERNAL_PROVIDERS.filter((value) => value !== provider)) sync[target] = { ...sync[target], status: provider === "nailie" ? "waiting_assignment" : "pending", error: "" };
  const updated = {
    ...(existing || {}),
    ...incoming,
    id: existing?.id || `external-${provider}-${externalBookingId}`,
    status: incoming.status || "CONFIRMED",
    updatedAt: now,
    providerSync: sync,
    syncStatus: overallSyncStatus(sync),
  };
  if (existingIndex >= 0) list[existingIndex] = updated;
  else list.push(updated);
  const tasks = provider === "nailie" && existing?.assignmentStatus === "ASSIGNED" && !sameExternalTime ? [{ target: "hotpepper", action: "cancel", bookingId: updated.id, match: { date: existing.date, start: existing.start, end: existing.end, staffId: existing.staffId || "", staff: existing.staff || "" } }] : [];
  return { bookings: list, result: updated, tasks };
}

export function acknowledgeProviderSync(bookings, acknowledgement, now = new Date().toISOString()) {
  const provider = clean(acknowledgement?.provider).toLowerCase();
  const bookingId = clean(acknowledgement?.bookingId);
  const status = clean(acknowledgement?.status).toLowerCase();
  if (!EXTERNAL_PROVIDERS.includes(provider) || !bookingId) throw new Error("provider and bookingId are required");
  if (!["synced", "error", "manual_required"].includes(status)) throw new Error("Invalid sync status");
  const list = Array.isArray(bookings) ? bookings.map((item) => ({ ...item })) : [];
  const index = list.findIndex((item) => clean(item.id) === bookingId);
  if (index < 0) throw new Error("Booking was not found");
  const taskId = clean(acknowledgement?.taskId);
  const currentActions = Array.isArray(list[index].pendingSyncActions) ? list[index].pendingSyncActions : [];
  const matchesTask = (action) => taskId ? clean(action.taskId) === taskId : action.target === provider;
  const matchedAction = currentActions.find(matchesTask);
  const failedAction = status === "error" ? matchedAction : null;
  const attempts = failedAction ? Number(failedAction.attempts || 0) + 1 : 0;
  const retryExhausted = Boolean(failedAction && attempts >= 4);
  const effectiveStatus = retryExhausted ? "manual_required" : status;
  const sync = providerSyncState(list[index]);
  sync[provider] = { ...sync[provider], status: effectiveStatus, externalBookingId: clean(acknowledgement.externalBookingId || sync[provider].externalBookingId), lastSyncAt: now, error: clean(acknowledgement.error) };
  const completed = effectiveStatus === "synced" || effectiveStatus === "manual_required";
  const pendingSyncActions = currentActions.flatMap((action) => {
    if (!matchesTask(action)) return [action];
    if (completed) return [];
    return [{ ...action, attempts, lastError: clean(acknowledgement.error), lastAttemptAt: now }];
  });
  if(effectiveStatus === "synced" && pendingSyncActions.some(action=>action.target===provider)) sync[provider].status="pending";
  const history = Array.isArray(list[index].botTaskHistory) ? list[index].botTaskHistory : [];
  const historyEntry = matchedAction ? { ...matchedAction, status: effectiveStatus, attempts, error: clean(acknowledgement.error), updatedAt: now } : null;
  const movedExternalId = effectiveStatus === "synced" && provider === "hotpepper" && clean(list[index].source).toLowerCase() === "hotpepper" && matchedAction?.action === "update" && matchedAction?.previousMatch ? clean(acknowledgement.externalBookingId) : "";
  list[index] = { ...list[index], ...(movedExternalId ? { externalBookingId: movedExternalId } : {}), providerSync: sync, syncStatus: overallSyncStatus(sync), pendingSyncActions, botTaskHistory: historyEntry ? [...history, historyEntry].slice(-100) : history, updatedAt: now };
  return { bookings: list, result: list[index], retryExhausted, failedTask: retryExhausted ? failedAction : null, attempts };
}

