import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcWorkedHours, validateTimeEntryInput } from "../src/lib/time-entry";

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
});
