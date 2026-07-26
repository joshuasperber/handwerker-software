import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hasBillingAddress,
  formatBillingAddressOneLine,
  formatSiteAddressOneLine,
  siteDiffersFromBilling,
  propertyMatchesBilling,
} from "../src/lib/addresses/billing-vs-site";

describe("billing vs site address", () => {
  const billing = {
    billingStreet: "Bürostraße 1",
    billingZipCode: "10115",
    billingCity: "Berlin",
  };
  const site = {
    street: "Friedrichstraße 100",
    zipCode: "10117",
    city: "Berlin",
    label: "Baustelle",
  };

  it("detects complete billing address", () => {
    assert.equal(hasBillingAddress(billing), true);
    assert.equal(hasBillingAddress({ billingStreet: "x" }), false);
  });

  it("formats addresses", () => {
    assert.equal(formatBillingAddressOneLine(billing), "Bürostraße 1, 10115 Berlin");
    assert.equal(formatSiteAddressOneLine(site), "Friedrichstraße 100, 10117 Berlin");
  });

  it("detects when site differs from billing", () => {
    assert.equal(siteDiffersFromBilling(billing, site), true);
    assert.equal(
      siteDiffersFromBilling(billing, {
        street: "Bürostraße 1",
        zipCode: "10115",
        city: "Berlin",
      }),
      false
    );
  });

  it("matches property to billing", () => {
    assert.equal(
      propertyMatchesBilling(
        { street: "Bürostraße 1", zipCode: "10115", city: "Berlin" },
        billing
      ),
      true
    );
    assert.equal(propertyMatchesBilling(site, billing), false);
  });
});
