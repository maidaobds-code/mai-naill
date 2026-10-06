import { hotpepperProvider } from "./hotpepper/provider";
import { internalProvider } from "./internal/provider";
import { minimoProvider } from "./minimo/provider";
import { nailieProvider } from "./nailie/provider";

export const bookingProviders = {
  internal: internalProvider,
  nailie: nailieProvider,
  minimo: minimoProvider,
  hotpepper: hotpepperProvider,
};

export function getBookingProvider(source) {
  return bookingProviders[source] || bookingProviders.internal;
}
