import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { persistableImageUrl, storedImageKey, toStoredImageSrc } from "../src/lib/stored-image";
import { toAbsoluteLogoSrc, toInvoiceLogoSrc, toTenantLogoSrc } from "../src/lib/logo";

describe("persistableImageUrl", () => {
  it("keeps public http(s) URLs", () => {
    assert.equal(persistableImageUrl("https://cdn.example/logo.png"), "https://cdn.example/logo.png");
    assert.equal(persistableImageUrl("  http://example/a.jpg  "), "http://example/a.jpg");
  });

  it("ignores proxy and data URLs so form-save cannot overwrite or re-store huge payloads", () => {
    assert.equal(persistableImageUrl("/api/company-settings/logo?v=1"), undefined);
    assert.equal(persistableImageUrl("data:image/png;base64,AAAA"), undefined);
  });

  it("clears empty values and leaves omitted fields untouched", () => {
    assert.equal(persistableImageUrl(""), null);
    assert.equal(persistableImageUrl(null), null);
    assert.equal(persistableImageUrl(undefined), undefined);
  });
});

describe("logo display src", () => {
  it("returns a proxy URL for stored keys and data URLs", () => {
    assert.equal(toInvoiceLogoSrc("logos/t1/invoice/a.png", 99), "/api/company-settings/logo?v=99");
    assert.equal(toTenantLogoSrc("data:image/png;base64,xx"), "/api/tenant/settings/logo");
  });

  it("keeps public URLs as-is", () => {
    assert.equal(toInvoiceLogoSrc("https://cdn.example/logo.png"), "https://cdn.example/logo.png");
  });

  it("absolutizes proxy src for iframe previews", () => {
    assert.equal(
      toAbsoluteLogoSrc("/api/company-settings/logo?v=1", "https://app.example"),
      "https://app.example/api/company-settings/logo?v=1"
    );
    assert.equal(toAbsoluteLogoSrc("https://cdn.example/a.png", "https://app.example"), "https://cdn.example/a.png");
  });

  it("extracts only S3 keys for deletion", () => {
    assert.equal(storedImageKey("logos/t1/a.png"), "logos/t1/a.png");
    assert.equal(storedImageKey("https://cdn.example/a.png"), null);
    assert.equal(storedImageKey("data:image/png;base64,xx"), null);
    assert.equal(storedImageKey("/api/company-settings/logo"), null);
  });

  it("builds cache-busted proxy src from dates", () => {
    const date = new Date("2026-08-01T12:00:00.000Z");
    assert.equal(
      toStoredImageSrc("avatars/t1/a.jpg", "/api/profile/avatar", date),
      `/api/profile/avatar?v=${date.getTime()}`
    );
  });
});
