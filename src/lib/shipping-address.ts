export interface ShippingAddress {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export function shippingAddressIsPopulated(address: ShippingAddress): boolean {
  return Boolean(
    address.firstName.trim()
    || address.lastName.trim()
    || address.address1.trim()
    || address.city.trim()
    || address.postalCode.trim(),
  );
}
