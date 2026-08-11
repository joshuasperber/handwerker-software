import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildLaborCustomerLines,
  calcLaborBillingTotal,
  calcLaborInternalCost,
  formatLaborDocumentLabel,
  laborItemsFromTimeSummary,
  resolveLaborInvoiceMode,
  summarizeLaborCostLines,
} from "../src/lib/calculation/labor-costs";
import { canViewEmployeeWages, redactEmployeeWages } from "../src/lib/employees/wage-access";

describe("labor costs", () => {
  it("calculates billing as hours × rate × workers", () => {
    assert.equal(calcLaborBillingTotal({ hours: 4, hourlyRateNet: 68 }), 272);
    assert.equal(
      calcLaborBillingTotal({ hours: 3, hourlyRateNet: 60, quantityWorkers: 2 }),
      360
    );
  });

  it("uses actual hours for internal cost when present", () => {
    assert.equal(
      calcLaborInternalCost({
        hours: 2,
        actualHours: 4,
        internalHourlyWageNet: 30,
      }),
      120
    );
    assert.equal(
      calcLaborInternalCost({
        hours: 2,
        actualHours: null,
        internalHourlyWageNet: 30,
      }),
      60
    );
    assert.equal(
      calcLaborInternalCost({ hours: 2, internalHourlyWageNet: null }),
      null
    );
  });

  it("summarizes planned vs actual hours and cost delta", () => {
    const summary = summarizeLaborCostLines([
      {
        description: "A",
        hours: 2,
        actualHours: 4,
        hourlyRateNet: 68,
        internalHourlyWageNet: 30,
        quantityWorkers: 1,
        totalNet: 136,
        isVisibleToCustomer: true,
      },
      {
        description: "B",
        hours: 0,
        actualHours: 3,
        hourlyRateNet: 68,
        internalHourlyWageNet: 25,
        quantityWorkers: 1,
        totalNet: 0,
        isVisibleToCustomer: true,
      },
    ]);
    assert.equal(summary.plannedHours, 2);
    assert.equal(summary.actualHours, 7);
    assert.equal(summary.deltaHours, 5);
    assert.equal(summary.internalTotal, 4 * 30 + 3 * 25);
    assert.equal(summary.costDelta, 4 * 30 + 3 * 25 - (2 * 30 + 0 * 25));
  });

  it("builds customer lines by invoice mode", () => {
    const items = [
      {
        description: "Montagearbeiten",
        hours: 4,
        totalNet: 272,
        isVisibleToCustomer: true,
        employeeName: "Mitarbeiter A",
      },
      {
        description: "Montagearbeiten",
        hours: 3,
        totalNet: 204,
        isVisibleToCustomer: true,
        employeeName: "Mitarbeiter B",
      },
    ];

    assert.deepEqual(buildLaborCustomerLines("INTERNAL", items), []);
    assert.deepEqual(buildLaborCustomerLines("ITEMIZED", items, { useFixedPrice: true }), []);

    const itemized = buildLaborCustomerLines("ITEMIZED", items);
    assert.equal(itemized.length, 2);
    assert.match(itemized[0].label, /Mitarbeiter A/);
    assert.equal(itemized[0].amount, 272);

    const summarized = buildLaborCustomerLines("SUMMARIZED", items);
    assert.equal(summarized.length, 1);
    assert.match(summarized[0].label, /7/);
    assert.equal(summarized[0].amount, 476);
  });

  it("formats document labels", () => {
    assert.equal(
      formatLaborDocumentLabel({
        description: "Montagearbeiten",
        hours: 4,
        employeeName: "Mitarbeiter A",
      }),
      "Montagearbeiten (Mitarbeiter A) – 4 Std."
    );
  });

  it("maps time summary into labor items", () => {
    const items = laborItemsFromTimeSummary(
      [
        { employeeId: "a", name: "A One", hours: 4, hourlyWageNet: 30 },
        { employeeId: "b", name: "B Two", hours: 3, hourlyWageNet: 25 },
      ],
      {
        billingHourlyRateNet: 68,
        billingRatesByEmployee: { a: 70, b: null },
        defaultActivity: "Montagearbeiten",
      }
    );
    assert.equal(items.length, 2);
    assert.equal(items[0].actualHours, 4);
    assert.equal(items[0].hourlyRateNet, 70);
    assert.equal(items[0].internalHourlyWageNet, 30);
    assert.equal(items[1].hourlyRateNet, 68);
    assert.equal(items[1].description, "Montagearbeiten");
  });

  it("resolves invoice mode safely", () => {
    assert.equal(resolveLaborInvoiceMode("SUMMARIZED"), "SUMMARIZED");
    assert.equal(resolveLaborInvoiceMode("nope"), "ITEMIZED");
  });
});

describe("wage access", () => {
  it("allows office roles and blocks field roles", () => {
    assert.equal(canViewEmployeeWages("ADMIN"), true);
    assert.equal(canViewEmployeeWages("BUERO"), true);
    assert.equal(canViewEmployeeWages("MONTEUR"), false);
    assert.equal(canViewEmployeeWages("TEAMLEITER"), false);
  });

  it("redacts wage fields", () => {
    const redacted = redactEmployeeWages(
      { id: "1", hourlyWageNet: 30, billingHourlyRateNet: 68, name: "x" },
      "MONTEUR"
    );
    assert.equal(redacted.hourlyWageNet, null);
    assert.equal(redacted.billingHourlyRateNet, null);
    assert.equal(redacted.name, "x");
  });
});
