import type { AddressService } from "@/services/interfaces/address-service";

export function lookupAddress(postalCode: string, service: AddressService) {
  return service.lookup(postalCode);
}
