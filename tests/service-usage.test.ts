import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  summarizeServiceUsage,
  describeServiceUsageBlock,
} from "../src/lib/services/usage";

describe("service usage", () => {
  it("marks unused services as not in use", () => {
    const usage = summarizeServiceUsage({
      orderServices: 0,
      checklistTemplates: 0,
      orderMaterialLines: 0,
    });
    assert.equal(usage.inUse, false);
    assert.equal(usage.total, 0);
    assert.equal(describeServiceUsageBlock(usage), "");
  });

  it("detects order usage and describes block reason", () => {
    const usage = summarizeServiceUsage({
      orderServices: 2,
      checklistTemplates: 0,
      orderMaterialLines: 1,
    });
    assert.equal(usage.inUse, true);
    assert.equal(usage.total, 3);
    const msg = describeServiceUsageBlock(usage);
    assert.match(msg, /deaktiviert/i);
    assert.match(msg, /Auftrag/);
    assert.match(msg, /Materialposition/);
  });

  it("counts checklist templates as usage", () => {
    const usage = summarizeServiceUsage({
      orderServices: 0,
      checklistTemplates: 1,
      orderMaterialLines: 0,
    });
    assert.equal(usage.inUse, true);
    assert.match(describeServiceUsageBlock(usage), /Checklisten/);
  });
});
