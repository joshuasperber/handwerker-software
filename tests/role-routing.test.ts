import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAppReturnLabel, getRoleHomePath } from "../src/lib/role-routing";

describe("getRoleHomePath", () => {
  it("sends Admin and Büro to the management dashboard", () => {
    assert.equal(getRoleHomePath("ADMIN"), "/dashboard");
    assert.equal(getRoleHomePath("BUERO"), "/dashboard");
    assert.equal(getRoleHomePath("MEISTER"), "/dashboard");
  });

  it("sends Monteur and Teamleiter to the work view", () => {
    assert.equal(getRoleHomePath("MONTEUR"), "/monteur/heute");
    assert.equal(getRoleHomePath("TEAMLEITER"), "/monteur/heute");
    assert.equal(getRoleHomePath("AUSHILFE"), "/monteur/heute");
  });

  it("keeps customer and guest in their portals", () => {
    assert.equal(getRoleHomePath("KUNDE"), "/kunde");
    assert.equal(getRoleHomePath("GAST"), "/portal");
  });

  it("routes password change into the matching view", () => {
    assert.equal(
      getRoleHomePath("ADMIN", { mustChangePassword: true }),
      "/dashboard/profil?changePassword=1"
    );
    assert.equal(
      getRoleHomePath("MONTEUR", { mustChangePassword: true }),
      "/monteur/profil?changePassword=1"
    );
  });
});

describe("getAppReturnLabel", () => {
  it("offers Dashboard for office roles and App for field roles", () => {
    assert.equal(getAppReturnLabel("ADMIN"), "Zum Dashboard");
    assert.equal(getAppReturnLabel("BUERO"), "Zum Dashboard");
    assert.equal(getAppReturnLabel("MONTEUR"), "Zurück zur App");
    assert.equal(getAppReturnLabel("TEAMLEITER"), "Zurück zur App");
  });
});
