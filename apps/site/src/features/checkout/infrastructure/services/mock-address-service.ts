import type { AddressService } from "@/services/interfaces/address-service";

export class MockAddressService implements AddressService {
  async lookup(postalCode: string) {
    const digits = postalCode.replace(/\D/g, "");
    if (digits.length !== 8) return null;

    return {
      city: "São Paulo",
      neighborhood: "Jardins",
      postalCode: digits,
      state: "SP",
      street: "Alameda Veste Bem",
    } as const;
  }
}
