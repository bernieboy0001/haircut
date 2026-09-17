import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  currentSession,
  isWeekend,
  isFridayAfterClose,
  isBeforeMondayOpen,
  etDate,
  nextSessionDate,
} from "../src/clock.js";

const WINDOWS = ["09:30", "09:45"] as const;
const CLOSE = "16:00";

function at(y: number, m: number, d: number, hh: number, mm: number): Date {
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

describe("currentSession", () => {
  it("09:29 → OVERNIGHT (before window)", () => {
    assert.equal(currentSession(WINDOWS, CLOSE, at(2026, 9, 16, 9, 29)), "OVERNIGHT");
  });

  it("09:30 → OPEN_WINDOW", () => {
    assert.equal(currentSession(WINDOWS, CLOSE, at(2026, 9, 16, 9, 30)), "OPEN_WINDOW");
  });

  it("09:44 → OPEN_WINDOW (last minute of window)", () => {
    assert.equal(currentSession(WINDOWS, CLOSE, at(2026, 9, 16, 9, 44)), "OPEN_WINDOW");
  });

  it("09:45 → RTH (window closed)", () => {
    assert.equal(currentSession(WINDOWS, CLOSE, at(2026, 9, 16, 9, 45)), "RTH");
  });

  it("10:00 → RTH (mid-day)", () => {
    assert.equal(currentSession(WINDOWS, CLOSE, at(2026, 9, 16, 10, 0)), "RTH");
  });

  it("15:59 → RTH (last minute before close)", () => {
    assert.equal(currentSession(WINDOWS, CLOSE, at(2026, 9, 16, 15, 59)), "RTH");
  });

  it("16:00 → OVERNIGHT (at exact close boundary)", () => {
    assert.equal(currentSession(WINDOWS, CLOSE, at(2026, 9, 16, 16, 0)), "OVERNIGHT");
  });

  it("17:00 → OVERNIGHT (evening)", () => {
    assert.equal(currentSession(WINDOWS, CLOSE, at(2026, 9, 16, 17, 0)), "OVERNIGHT");
  });

  it("Saturday 12:00 → WEEKEND", () => {
    assert.equal(currentSession(WINDOWS, CLOSE, at(2026, 9, 19, 12, 0)), "WEEKEND");
  });

  it("Sunday 00:00 → WEEKEND", () => {
    assert.equal(currentSession(WINDOWS, CLOSE, at(2026, 9, 20, 0, 0)), "WEEKEND");
  });

  it("Friday after 16:00 → WEEKEND", () => {
    assert.equal(currentSession(WINDOWS, CLOSE, at(2026, 9, 18, 16, 30)), "WEEKEND");
  });

  it("Friday before 16:00 → RTH (weekend hasn't started)", () => {
    assert.equal(currentSession(WINDOWS, CLOSE, at(2026, 9, 18, 15, 0)), "RTH");
  });

  it("Monday 08:00 → WEEKEND (before Monday open)", () => {
    assert.equal(currentSession(WINDOWS, CLOSE, at(2026, 9, 14, 8, 0)), "WEEKEND");
  });

  it("Monday 09:30 → OPEN_WINDOW (week is open)", () => {
    assert.equal(currentSession(WINDOWS, CLOSE, at(2026, 9, 14, 9, 30)), "OPEN_WINDOW");
  });
});

describe("etDate / nextSessionDate", () => {
  it("etDate formats the ET calendar date", () => {
    assert.equal(etDate(new Date("2026-09-17T12:00:00Z")), "2026-09-17");
    assert.equal(etDate(new Date("2026-09-18T02:00:00Z")), "2026-09-17"); // 22:00 ET prev day
  });

  it("Wed → Thu", () => assert.equal(nextSessionDate("2026-09-16"), "2026-09-17"));
  it("Thu → Fri", () => assert.equal(nextSessionDate("2026-09-17"), "2026-09-18"));
  it("Fri → Mon (skips weekend)", () =>
    assert.equal(nextSessionDate("2026-09-18"), "2026-09-21"));
  it("Sat → Mon", () => assert.equal(nextSessionDate("2026-09-19"), "2026-09-21"));
  it("Sun → Mon", () => assert.equal(nextSessionDate("2026-09-20"), "2026-09-21"));
});

describe("helper predicates", () => {
  it("isWeekend Saturday", () => assert.ok(isWeekend(at(2026, 9, 19, 12, 0))));
  it("isWeekend Sunday", () => assert.ok(isWeekend(at(2026, 9, 20, 12, 0))));
  it("isWeekend Wednesday", () => assert.ok(!isWeekend(at(2026, 9, 16, 12, 0))));
  it("isFridayAfterClose true at 16:00", () =>
    assert.ok(isFridayAfterClose(at(2026, 9, 18, 16, 0), CLOSE)));
  it("isFridayAfterClose false at 15:59", () =>
    assert.ok(!isFridayAfterClose(at(2026, 9, 18, 15, 59), CLOSE)));
  it("isFridayAfterClose false on Wednesday", () =>
    assert.ok(!isFridayAfterClose(at(2026, 9, 16, 16, 0), CLOSE)));
  it("isBeforeMondayOpen true at 09:29", () =>
    assert.ok(isBeforeMondayOpen(at(2026, 9, 14, 9, 29), WINDOWS[0])));
  it("isBeforeMondayOpen false at 09:30", () =>
    assert.ok(!isBeforeMondayOpen(at(2026, 9, 14, 9, 30), WINDOWS[0])));
});
