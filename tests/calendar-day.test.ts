import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addCalendarDays,
  businessDateKey,
  businessDayRange,
  startOfIsoWeekDate,
} from "../src/lib/calendar-day";

describe("business calendar days", () => {
  it("uses Berlin midnight independently from the server timezone", () => {
    const summer = businessDayRange("2026-07-29");
    assert.equal(summer.start.toISOString(), "2026-07-28T22:00:00.000Z");
    assert.equal(businessDateKey(summer.start), "2026-07-29");
  });

  it("handles daylight-saving day lengths", () => {
    const spring = businessDayRange("2026-03-29");
    const autumn = businessDayRange("2026-10-25");
    assert.equal(spring.end.getTime() - spring.start.getTime() + 1, 23 * 60 * 60 * 1000);
    assert.equal(autumn.end.getTime() - autumn.start.getTime() + 1, 25 * 60 * 60 * 1000);
  });

  it("computes ISO week boundaries as calendar dates", () => {
    assert.equal(startOfIsoWeekDate("2026-09-25"), "2026-09-21");
    assert.equal(addCalendarDays("2026-09-21", 6), "2026-09-27");
  });
});
