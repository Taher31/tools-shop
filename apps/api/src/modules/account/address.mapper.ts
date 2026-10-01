import type { Address } from '@toolshop/database';
import type { AddressView } from '@toolshop/shared';

export function toAddressView(address: Address): AddressView {
  return {
    id: address.id,
    title: address.title,
    recipientName: address.recipientName,
    recipientMobile: address.recipientMobile,
    province: address.province,
    city: address.city,
    addressLine: address.addressLine,
    plaque: address.plaque,
    unit: address.unit,
    postalCode: address.postalCode,
    isDefault: address.isDefault,
  };
}
