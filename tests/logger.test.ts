import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("logger", () => {
  it("exports info/warn/error without throwing", async () => {
    const { logger } = await import("../src/lib/logger");
    logger.info("test message", { route: "/test" });
    logger.warn("warn", { job: "daily" });
    logger.error("err", { tenantId: "t1" }, new Error("boom"));
    assert.ok(logger);
  });
});
