import { test } from "node:test";
import assert from "node:assert/strict";
import { formatClock, formatDate, formatDateTime, formatDay, formatTimeRange, todayISO } from "../src/lib/format.js";

// I-200: "today" is the Philippine day, like the server's ph_today(), whatever zone the browser runs in.
test("todayISO is the Manila date, not the UTC date", () => {
  assert.equal(todayISO(new Date("2026-11-02T16:30:00Z")), "2026-11-03"); // 00:30 on Nov 3 in Manila
  assert.equal(todayISO(new Date("2026-11-02T15:00:00Z")), "2026-11-02"); // 23:00 on Nov 2 in Manila
});

// I-207: one style for every date and time a person reads.
test("formatDate and formatDay read a bare day as that calendar day", () => {
  assert.equal(formatDate("2026-08-19"), "Aug 19, 2026");
  assert.equal(formatDay("2026-08-19"), "Wed, Aug 19, 2026");
  assert.equal(formatDate("2026-08-19T09:00:00"), "Aug 19, 2026");
  assert.equal(formatDate(""), "—");
  assert.equal(formatDate("not a date"), "not a date");
});

test("formatDateTime shows the date, then the 12-hour time", () => {
  assert.match(formatDateTime("2026-08-19T10:46:00"), /^Aug 19, 2026, 10:46\s?AM$/);
  assert.match(formatDateTime("2026-08-19T18:05"), /^Aug 19, 2026, 6:05\s?PM$/);
  assert.equal(formatDateTime(null), "—");
});

test("formatClock accepts a time or a date-time", () => {
  assert.equal(formatClock("18:00"), "6:00 PM");
  assert.equal(formatClock("09:30:00"), "9:30 AM");
  assert.equal(formatClock("2026-11-17T00:05"), "12:05 AM");
  assert.equal(formatClock("12:00"), "12:00 PM");
  assert.equal(formatClock(""), "");
  assert.equal(formatClock("TBA"), "TBA");
});

test("formatTimeRange writes the half of the day once when both ends share it", () => {
  assert.equal(formatTimeRange("18:00", "20:00"), "6:00 – 8:00 PM");
  assert.equal(formatTimeRange("09:00", "10:30"), "9:00 – 10:30 AM");
  assert.equal(formatTimeRange("11:00", "13:00"), "11:00 AM – 1:00 PM");
  assert.equal(formatTimeRange("2026-11-17T18:00", "2026-11-17T20:00"), "6:00 – 8:00 PM");
  assert.equal(formatTimeRange("18:00", ""), "6:00 PM");
  assert.equal(formatTimeRange("", ""), "");
});
