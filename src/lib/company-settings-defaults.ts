export type TenantCompanyDefaultsSource = {
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  zipCode: string | null;
  primaryColor: string;
  logoUrl: string | null;
};

export type TenantCompanyDefaults = {
  companyName: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  invoiceAccentColor: string;
  logoUrl: string;
};

export function splitStreetAndHouseNumber(address: string | null | undefined) {
  const value = address?.trim() ?? "";
  const match = value.match(/^(.+?)\s+(\d+[\wÄÖÜäöüß]*(?:\s*[-/]\s*\d+[\wÄÖÜäöüß]*)?)$/u);

  return match
    ? { street: match[1].trim(), houseNumber: match[2].replace(/\s+/g, "") }
    : { street: value, houseNumber: "" };
}

export function tenantToCompanyDefaults(
  tenant: TenantCompanyDefaultsSource
): TenantCompanyDefaults {
  const address = splitStreetAndHouseNumber(tenant.address);

  return {
    companyName: tenant.name,
    street: address.street,
    houseNumber: address.houseNumber,
    postalCode: tenant.zipCode ?? "",
    city: tenant.city ?? "",
    phone: tenant.phone ?? "",
    email: tenant.email,
    invoiceAccentColor: tenant.primaryColor,
    logoUrl: tenant.logoUrl ?? "",
  };
}
