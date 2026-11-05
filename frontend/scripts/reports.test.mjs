import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
function load(path, imports = {}) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, require: name => imports[name] };
  runInNewContext(code, context); return context.exports;
}
const calendar = load("../src/lib/persian-date.ts");
const { dailyRows, money, share, change, shiftDay, presetRange } = load("../src/features/reports/model.ts", { "@/lib/persian-date": calendar });
test("report rows preserve exact large totals and fill missing days", () => {
  const income = { start: "2026-11-04", end: "2026-11-06", daily: [{ date: "2026-11-04", total_toman: "9007199254740993" }] };
  const expense = { daily: [{ date: "2026-11-06", total_toman: "20" }] };
  const rows = dailyRows(income, expense);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].income, 9007199254740993n);
  assert.equal(rows[1].income, 0n);
  assert.equal(rows[2].expense, 20n);
  assert.equal(money("9007199254740993"), 9007199254740993n.toLocaleString("fa-IR"));
  assert.equal(share("1", "0"), 0);
  assert.equal(share("1", "4"), 25);
});
test("comparison does not invent a percentage for a zero baseline", () => {
  assert.equal(change("100", "0"), "دورهٔ قبل مبلغی ثبت نشده");
  assert.equal(change("0", "0"), "بدون تغییر نسبت به دورهٔ قبل");
  assert.match(change("50", "100"), /کمتر/);
  assert.match(change("150", "100"), /بیشتر/);
});
test("ranges stay inclusive across year and leap-day boundaries", () => {
  assert.equal(shiftDay("2024-02-28", 1), "2024-02-29");
  assert.equal(shiftDay("2026-01-01", -1), "2025-12-31");
  const week = presetRange("week");
  assert.equal((Date.parse(week.end) - Date.parse(week.start)) / 86400000, 6);
  const quarter = presetRange("quarter");
  assert.equal((Date.parse(quarter.end) - Date.parse(quarter.start)) / 86400000, 89);
  const month = presetRange("month");
  assert.match(calendar.reminderDateFields(`${month.start}T12:00:00Z`).date, /\/01$/);
});
