import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldRedirectOnUnauthorized } from "../src/lib/fetch-json";

describe("shouldRedirectOnUnauthorized", () => {
  it("leitet geschützte APIs bei 401 zur Anmeldung um", () => {
    assert.equal(shouldRedirectOnUnauthorized("/api/orders/1", 401, "/dashboard/auftraege/1"), true);
    assert.equal(shouldRedirectOnUnauthorized("/api/auth/me", 401, "/dashboard"), true);
    assert.equal(shouldRedirectOnUnauthorized("/api/customers?q=a", 401, "/dashboard/kunden"), true);
  });

  it("lässt öffentliche Auth- und Buchungs-APIs unberührt", () => {
    assert.equal(shouldRedirectOnUnauthorized("/api/auth/login", 401, "/login"), false);
    assert.equal(shouldRedirectOnUnauthorized("/api/auth/register", 401, "/registrieren"), false);
    assert.equal(shouldRedirectOnUnauthorized("/api/invitations/accept", 401, "/einladung/abc"), false);
    assert.equal(shouldRedirectOnUnauthorized("/api/public/acme", 401, "/buchen/acme"), false);
    assert.equal(shouldRedirectOnUnauthorized("/api/shared?token=x", 401, "/geteilt/x"), false);
  });

  it("leitet auf öffentlichen Seiten nicht um", () => {
    assert.equal(shouldRedirectOnUnauthorized("/api/orders/1", 401, "/login"), false);
    assert.equal(shouldRedirectOnUnauthorized("/api/orders/1", 401, "/buchen/acme"), false);
  });

  it("reagiert nur auf 401", () => {
    assert.equal(shouldRedirectOnUnauthorized("/api/orders/1", 403, "/dashboard"), false);
    assert.equal(shouldRedirectOnUnauthorized("/api/orders/1", 404, "/dashboard"), false);
  });
});
