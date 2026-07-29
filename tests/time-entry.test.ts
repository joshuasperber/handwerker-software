import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calcLaborCost,
  calcWorkedHours,
  resolveStoredActivity,
  validateTimeEntryInput,
} from "../src/lib/time-entry";
import {
  calcPlannedHours,
  summarizeOrderTimeEntries,
} from "../src/lib/orders/time-summary";

describe("time entry validation", () => {
  it("requires start and end", () => {
    assert.match(
      validateTimeEntryInput({
        startTime: "",
        endTime: "2026-07-25T12:00",
        requireEndTime: true,
      }) ?? "",
      /Startzeit/
    );
    assert.match(
      validateTimeEntryInput({
        startTime: "2026-07-25T08:00",
        endTime: "",
        requireEndTime: true,
      }) ?? "",
      /Endzeit/
    );
  });

  it("rejects end before start", () => {
    assert.match(
      validateTimeEntryInput({
        startTime: "2026-07-25T12:00",
        endTime: "2026-07-25T08:00",
      }) ?? "",
      /vor der Startzeit/
    );
  });

  it("rejects pause longer than work", () => {
    assert.match(
      validateTimeEntryInput({
        startTime: "2026-07-25T08:00",
        endTime: "2026-07-25T09:00",
        breakMinutes: 90,
      }) ?? "",
      /Pause/
    );
  });

  it("requires activity or notes without order", () => {
    assert.match(
      validateTimeEntryInput({
        startTime: "2026-07-25T08:00",
        endTime: "2026-07-25T12:00",
        orderId: null,
      }) ?? "",
      /Tätigkeit oder Notiz/
    );
    assert.equal(
      validateTimeEntryInput({
        startTime: "2026-07-25T08:00",
        endTime: "2026-07-25T12:00",
        orderId: null,
        activity: "Lagerarbeit",
      }),
      null
    );
  });

  it("requires freitext for Sonstiges", () => {
    assert.match(
      validateTimeEntryInput({
        startTime: "2026-07-25T08:00",
        endTime: "2026-07-25T12:00",
        orderId: "abc",
        activity: "Sonstiges",
      }) ?? "",
      /Sonstiges/
    );
    assert.equal(
      validateTimeEntryInput({
        startTime: "2026-07-25T08:00",
        endTime: "2026-07-25T12:00",
        orderId: "abc",
        activity: "Sonstiges",
        activityCustom: "Sonderanfertigung",
      }),
      null
    );
  });

  it("allows entry with order and no activity", () => {
    assert.equal(
      validateTimeEntryInput({
        startTime: "2026-07-25T08:00",
        endTime: "2026-07-25T12:00",
        orderId: "abc",
        breakMinutes: 30,
      }),
      null
    );
  });

  it("calculates worked hours", () => {
    assert.equal(
      calcWorkedHours("2026-07-25T08:00:00", "2026-07-25T12:00:00", 30),
      3.5
    );
  });

  it("resolves Sonstiges activity to custom text", () => {
    assert.equal(resolveStoredActivity("Montage"), "Montage");
    assert.equal(resolveStoredActivity("Sonstiges", "Sonderjob"), "Sonderjob");
  });

  it("calculates labor cost", () => {
    assert.equal(calcLaborCost(4, 30), 120);
    assert.equal(calcLaborCost(3, 28.5), 85.5);
    assert.equal(calcLaborCost(2, null), null);
  });
});

describe("order time summary", () => {
  it("sums hours and costs per employee", () => {
    const summary = summarizeOrderTimeEntries(
      [
        {
          id: "1",
          startTime: "2026-07-25T08:00:00",
          endTime: "2026-07-25T12:00:00",
          breakMinutes: 0,
          activity: "Montage",
          notes: null,
          status: "APPROVED",
          employee: {
            id: "a",
            hourlyWageNet: 30,
            user: { firstName: "A", lastName: "One" },
          },
        },
        {
          id: "2",
          startTime: "2026-07-25T08:00:00",
          endTime: "2026-07-25T11:00:00",
          breakMinutes: 0,
          activity: "Montage",
          notes: null,
          status: "APPROVED",
          employee: {
            id: "b",
            hourlyWageNet: 25,
            user: { firstName: "B", lastName: "Two" },
          },
        },
      ],
      2
    );

    assert.equal(summary.plannedHours, 2);
    assert.equal(summary.actualHours, 7);
    assert.equal(summary.deltaHours, 5);
    assert.equal(summary.laborCostNet, 4 * 30 + 3 * 25);
    assert.equal(summary.byEmployee.length, 2);
  });

  it("uses appointment duration for planned hours", () => {
    const planned = calcPlannedHours({
      appointments: [
        {
          startTime: "2026-07-25T08:00:00",
          endTime: "2026-07-25T10:00:00",
        },
      ],
    });
    assert.equal(planned, 2);
  });
});
