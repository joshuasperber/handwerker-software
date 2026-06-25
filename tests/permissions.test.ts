import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hasPermission,
  isMonteurExcludedDashboardPath,
  getDashboardNavItems,
} from "../src/lib/permissions";

describe("hasPermission", () => {
  it("grants ADMIN orders.write", () => {
    assert.equal(hasPermission("ADMIN", "orders.write"), true);
  });

  it("denies MONTEUR orders.read", () => {
    assert.equal(hasPermission("MONTEUR", "orders.read"), false);
  });

  it("allows MONTEUR monteur.own", () => {
    assert.equal(hasPermission("MONTEUR", "monteur.own"), true);
  });
});

describe("isMonteurExcludedDashboardPath", () => {
  it("blocks inventar for monteur", () => {
    assert.equal(isMonteurExcludedDashboardPath("/dashboard/inventar"), true);
    assert.equal(isMonteurExcludedDashboardPath("/dashboard/inventar/artikel/1"), true);
  });

  it("allows dashboard home", () => {
    assert.equal(isMonteurExcludedDashboardPath("/dashboard"), false);
    assert.equal(isMonteurExcludedDashboardPath("/dashboard/profil"), false);
  });
});

describe("getDashboardNavItems", () => {
  it("hides auftraege from MONTEUR nav", () => {
    const hrefs = getDashboardNavItems("MONTEUR").map((item) => item.href);
    assert.equal(hrefs.includes("/dashboard/auftraege"), false);
    assert.equal(hrefs.includes("/dashboard/nachrichten"), true);
  });
});
