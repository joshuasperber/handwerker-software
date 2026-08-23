import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isNavItemActive,
  navSectionContainsPath,
} from "../src/lib/dashboard-nav";
import {
  DASHBOARD_NAV_CONFIG,
  getDashboardNavItems,
} from "../src/lib/permissions";
import { SETTINGS_NAV_ORDER, SETTINGS_PAGE_INTROS } from "../src/lib/settings-nav";

const BUERO_ITEMS = DASHBOARD_NAV_CONFIG.filter((i) => i.section === "betrieb");
const MATERIAL_ITEMS = DASHBOARD_NAV_CONFIG.filter((i) => i.section === "material");
const FINANZEN_ITEMS = DASHBOARD_NAV_CONFIG.filter((i) => i.section === "finanzen");
const SETTINGS_ITEMS = DASHBOARD_NAV_CONFIG.filter((i) => i.section === "einstellungen");

describe("isNavItemActive", () => {
  it("treats Übersicht /dashboard as exact match only", () => {
    assert.equal(isNavItemActive("/dashboard", "/dashboard"), true);
    assert.equal(isNavItemActive("/dashboard/inventar", "/dashboard"), false);
    assert.equal(isNavItemActive("/dashboard/einkauf", "/dashboard"), false);
    assert.equal(isNavItemActive("/dashboard/finanzuebersicht", "/dashboard"), false);
    assert.equal(isNavItemActive("/dashboard/einstellungen/betrieb", "/dashboard"), false);
  });

  it("activates Inventar only on inventar routes", () => {
    assert.equal(isNavItemActive("/dashboard/inventar", "/dashboard/inventar"), true);
    assert.equal(isNavItemActive("/dashboard/inventar/foo", "/dashboard/inventar"), true);
    assert.equal(isNavItemActive("/dashboard/einkauf", "/dashboard/inventar"), false);
    assert.equal(isNavItemActive("/dashboard/einstellungen/betrieb", "/dashboard/inventar"), false);
  });

  it("activates Einkauf only on einkauf routes", () => {
    assert.equal(isNavItemActive("/dashboard/einkauf", "/dashboard/einkauf"), true);
    assert.equal(isNavItemActive("/dashboard/inventar", "/dashboard/einkauf"), false);
    assert.equal(isNavItemActive("/dashboard/einstellungen/betrieb", "/dashboard/einkauf"), false);
  });

  it("activates Betrieb-Einstellungen only on that settings page", () => {
    assert.equal(
      isNavItemActive("/dashboard/einstellungen/betrieb", "/dashboard/einstellungen/betrieb"),
      true
    );
    assert.equal(isNavItemActive("/dashboard/inventar", "/dashboard/einstellungen/betrieb"), false);
    assert.equal(isNavItemActive("/dashboard/einkauf", "/dashboard/einstellungen/betrieb"), false);
    assert.equal(
      isNavItemActive("/dashboard/finanzuebersicht", "/dashboard/einstellungen/betrieb"),
      false
    );
  });

  it("activates nested kalkulation pages without hitting settings", () => {
    assert.equal(
      isNavItemActive("/dashboard/kalkulation/abc", "/dashboard/kalkulation"),
      true
    );
    assert.equal(
      isNavItemActive("/dashboard/einstellungen/rechnung", "/dashboard/kalkulation"),
      false
    );
  });
});

describe("navSectionContainsPath", () => {
  it("does not treat Inventar or Einkauf as Büro/Betrieb", () => {
    assert.equal(navSectionContainsPath(BUERO_ITEMS, "/dashboard/inventar"), false);
    assert.equal(navSectionContainsPath(BUERO_ITEMS, "/dashboard/einkauf"), false);
    assert.equal(navSectionContainsPath(MATERIAL_ITEMS, "/dashboard/inventar"), true);
    assert.equal(navSectionContainsPath(MATERIAL_ITEMS, "/dashboard/einkauf"), true);
  });

  it("does not treat Finanzen as Büro or Betrieb-Einstellungen", () => {
    assert.equal(navSectionContainsPath(BUERO_ITEMS, "/dashboard/finanzuebersicht"), false);
    assert.equal(navSectionContainsPath(FINANZEN_ITEMS, "/dashboard/finanzuebersicht"), true);
    assert.equal(
      navSectionContainsPath(SETTINGS_ITEMS, "/dashboard/finanzuebersicht"),
      false
    );
  });

  it("opens Einstellungen only for settings routes including Rollen", () => {
    assert.equal(
      navSectionContainsPath(SETTINGS_ITEMS, "/dashboard/einstellungen/betrieb"),
      true
    );
    assert.equal(navSectionContainsPath(SETTINGS_ITEMS, "/dashboard/einstellungen/rollen"), true);
    assert.equal(navSectionContainsPath(SETTINGS_ITEMS, "/dashboard/inventar"), false);
    assert.equal(navSectionContainsPath(BUERO_ITEMS, "/dashboard/einstellungen/betrieb"), false);
  });

  it("opens Büro only on the overview and office routes", () => {
    assert.equal(navSectionContainsPath(BUERO_ITEMS, "/dashboard"), true);
    assert.equal(navSectionContainsPath(BUERO_ITEMS, "/dashboard/auftraege"), true);
    assert.equal(navSectionContainsPath(BUERO_ITEMS, "/dashboard/auftraege/neu"), true);
  });
});

describe("settings nav order", () => {
  it("lists the expected Einstellungen sub-items in order", () => {
    const labels = SETTINGS_ITEMS.map((item) => item.label);
    assert.deepEqual(labels, [
      "Betrieb",
      "Rechnungseinstellungen",
      "Benachrichtigungen",
      "Rollen & Rechte",
      "Sicherheit & Datenschutz",
      "Systemstatus",
      "Betriebsassistent-Einstellungen",
    ]);
  });

  it("places Rollen & Rechte under Einstellungen for ADMIN", () => {
    const rollen = getDashboardNavItems("ADMIN").find(
      (item) => item.href === "/dashboard/einstellungen/rollen"
    );
    assert.equal(rollen?.section, "einstellungen");
    assert.equal(rollen?.label, "Rollen & Rechte");
  });

  it("has an intro text for every Einstellungen sub-item", () => {
    const hrefs = SETTINGS_ITEMS.map((item) => item.href);
    assert.deepEqual(hrefs, [...SETTINGS_NAV_ORDER]);
    for (const href of hrefs) {
      const intro = SETTINGS_PAGE_INTROS[href];
      assert.ok(intro?.title, `missing title for ${href}`);
      assert.ok(intro.description.length > 40, `missing description for ${href}`);
    }
  });

  it("places assistant settings under Einstellungen and keeps the chat separately", () => {
    const settings = getDashboardNavItems("ADMIN").find(
      (item) => item.href === "/dashboard/einstellungen/assistent"
    );
    const chat = getDashboardNavItems("ADMIN").find((item) => item.href === "/dashboard/ki-assistent");
    assert.equal(settings?.section, "einstellungen");
    assert.equal(chat?.section, null);
  });
});
