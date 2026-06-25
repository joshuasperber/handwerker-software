import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isOrderOverdue,
  isAppointmentOverdue,
} from "../src/lib/scheduling/overdue";

describe("isOrderOverdue", () => {
  const now = new Date("2026-06-12T14:00:00.000Z");

  it("marks past scheduled orders as overdue when still active", () => {
    assert.equal(
      isOrderOverdue("2026-06-11T10:00:00.000Z", "EINGEPLANT", now),
      true
    );
  });

  it("includes UNTERWEGS and IN_ARBEIT when date is in the past", () => {
    assert.equal(
      isOrderOverdue("2026-06-11T10:00:00.000Z", "UNTERWEGS", now),
      true
    );
    assert.equal(
      isOrderOverdue("2026-06-11T10:00:00.000Z", "IN_ARBEIT", now),
      true
    );
  });

  it("ignores done orders", () => {
    assert.equal(
      isOrderOverdue("2026-06-11T10:00:00.000Z", "ABGESCHLOSSEN", now),
      false
    );
  });

  it("ignores same-day orders before midnight rollover", () => {
    assert.equal(
      isOrderOverdue("2026-06-12T08:00:00.000Z", "EINGEPLANT", now),
      false
    );
  });
});

describe("isAppointmentOverdue", () => {
  const now = new Date("2026-06-12T14:00:00.000Z");

  it("marks past-day planned appointments as overdue", () => {
    assert.equal(
      isAppointmentOverdue("2026-06-11T10:00:00.000Z", "GEPLANT", now),
      true
    );
  });

  it("marks today GEPLANT appointments after start time as overdue", () => {
    assert.equal(
      isAppointmentOverdue("2026-06-12T08:00:00.000Z", "GEPLANT", now),
      true
    );
  });

  it("marks past-day in-progress appointments as overdue", () => {
    assert.equal(
      isAppointmentOverdue("2026-06-11T10:00:00.000Z", "IN_ARBEIT", now),
      true
    );
  });

  it("does not mark in-progress appointments as overdue on the same day", () => {
    assert.equal(
      isAppointmentOverdue("2026-06-12T08:00:00.000Z", "IN_ARBEIT", now),
      false
    );
    assert.equal(
      isAppointmentOverdue("2026-06-12T08:00:00.000Z", "UNTERWEGS", now),
      false
    );
  });

  it("ignores completed appointments", () => {
    assert.equal(
      isAppointmentOverdue("2026-06-11T10:00:00.000Z", "ABGESCHLOSSEN", now),
      false
    );
  });
});
