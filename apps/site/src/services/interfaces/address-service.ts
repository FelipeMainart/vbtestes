export type AddressLookup = Readonly<{
  city: string;
  neighborhood: string;
  postalCode: string;
  state: string;
  street: string;
}>;

export interface AddressService {
  lookup(postalCode: string): Promise<AddressLookup | null>;
}
