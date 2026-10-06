export const ProviderCapability = {
  READ: "read",
  CREATE: "create",
  UPDATE: "update",
  CANCEL: "cancel",
  BLOCK: "block",
  UNBLOCK: "unblock",
};

export class UnsupportedProviderOperation extends Error {
  constructor(provider, operation) {
    super(`${provider} does not support ${operation}`);
    this.name = "UnsupportedProviderOperation";
  }
}

export function readOnlyProvider(name, status = "manual") {
  const unsupported = (operation) => async () => {
    throw new UnsupportedProviderOperation(name, operation);
  };
  return {
    name,
    status,
    capabilities: [ProviderCapability.READ],
    getBookings: async () => [],
    getAvailability: async () => [],
    createBooking: unsupported("createBooking"),
    updateBooking: unsupported("updateBooking"),
    cancelBooking: unsupported("cancelBooking"),
    blockSlot: unsupported("blockSlot"),
    unblockSlot: unsupported("unblockSlot"),
  };
}
