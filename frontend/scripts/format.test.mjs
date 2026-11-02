import { test } from "node:test";
import assert from "node:assert/strict";
import { todayISO } from "../src/lib/format.js";

// I-200: "today" is the Philippine day, like the server's ph_today(), whatever zone the browser runs in.
test("todayISO is the Manila date, not the UTC date", () => {
  assert.equal(todayISO(new Date("2026-11-02T16:30:00Z")), "2026-11-03"); // 00:30 on Nov 3 in Manila
  assert.equal(todayISO(new Date("2026-11-02T15:00:00Z")), "2026-11-02"); // 23:00 on Nov 2 in Manila
});
