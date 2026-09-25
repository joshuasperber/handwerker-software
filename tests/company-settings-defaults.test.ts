import assert from "node:assert/strict";
import test from "node:test";
import {
  splitStreetAndHouseNumber,
  tenantToCompanyDefaults,
} from "../src/lib/company-settings-defaults";

test("splits a common German street and house number", () => {
  assert.deepEqual(splitStreetAndHouseNumber("Pufendorfstraße 6a"), {
    street: "Pufendorfstraße",
    houseNumber: "6a",
  });
});

test("keeps an address without a recognizable house number as street", () => {
  assert.deepEqual(splitStreetAndHouseNumber("Gewerbepark Nord"), {
    street: "Gewerbepark Nord",
    houseNumber: "",
  });
});

test("maps tenant data to editable invoice defaults", () => {
  assert.deepEqual(
    tenantToCompanyDefaults({
      name: "Musterbetrieb GmbH",
      email: "hallo@example.de",
      phone: "030 1234",
      address: "Werkstraße 12",
      city: "Berlin",
      zipCode: "10115",
      primaryColor: "#123456",
      logoUrl: "/api/tenant/settings/logo?v=1",
    }),
    {
      companyName: "Musterbetrieb GmbH",
      street: "Werkstraße",
      houseNumber: "12",
      postalCode: "10115",
      city: "Berlin",
      phone: "030 1234",
      email: "hallo@example.de",
      invoiceAccentColor: "#123456",
      logoUrl: "/api/tenant/settings/logo?v=1",
    }
  );
});
