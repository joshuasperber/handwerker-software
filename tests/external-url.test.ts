import assert from "node:assert/strict";
import test from "node:test";
import { normalizeOptionalHttpUrl } from "../src/lib/external-url";

test("normalizes optional legal URLs", () => {
  assert.equal(normalizeOptionalHttpUrl("", "Impressum"), null);
  assert.equal(normalizeOptionalHttpUrl(undefined, "Impressum"), undefined);
  assert.equal(
    normalizeOptionalHttpUrl("https://example.de/datenschutz", "Datenschutz"),
    "https://example.de/datenschutz"
  );
});

test("rejects unsafe or incomplete legal URLs", () => {
  assert.throws(
    () => normalizeOptionalHttpUrl("javascript:alert(1)", "Impressum"),
    /https:\/\//
  );
  assert.throws(
    () => normalizeOptionalHttpUrl("example.de/impressum", "Impressum"),
    /vollständige URL/
  );
});
