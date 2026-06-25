import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkSmtpConfig } from "../src/lib/system/health-checks";

describe("checkSmtpConfig", () => {
  it("reports skipped when SMTP not configured", () => {
    const prevHost = process.env.SMTP_HOST;
    const prevFrom = process.env.SMTP_FROM;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
    try {
      assert.equal(checkSmtpConfig().status, "skipped");
    } finally {
      if (prevHost) process.env.SMTP_HOST = prevHost;
      if (prevFrom) process.env.SMTP_FROM = prevFrom;
    }
  });
});
