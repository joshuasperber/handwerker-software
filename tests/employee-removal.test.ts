import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mustArchiveEmployee } from "../src/lib/employees/removal";

describe("mustArchiveEmployee", () => {
  it("allows deleting an unused employee with only current master-data links", () => {
    assert.equal(
      mustArchiveEmployee(
        { qualifications: 2, workingHours: 5, teamMemberships: 1, assignedVehicles: 1 },
        { auditLogs: 0, sentMessages: 0 }
      ),
      false
    );
  });

  it("archives an employee with operational history", () => {
    assert.equal(mustArchiveEmployee({ timeEntries: 1 }, {}), true);
    assert.equal(mustArchiveEmployee({ orderAssignments: 1 }, {}), true);
  });

  it("archives an employee whose user account has history", () => {
    assert.equal(mustArchiveEmployee({}, { sentMessages: 1 }), true);
  });
});
