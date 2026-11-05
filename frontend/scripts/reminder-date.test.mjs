import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/persian-date.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const context = { exports: {} };
runInNewContext(code, context);
const { parseReminderDate, reminderDateFields } = context.exports;

test("calendar weeks start on Saturday and Esfand respects leap years", () => {
  const { persianMonthInfo } = context.exports;
  assert.equal(persianMonthInfo(1405, 1).offset, 0);
  assert.equal(persianMonthInfo(1405, 1).days, 31);
  assert.equal(persianMonthInfo(1405, 7).days, 30);
  assert.equal(persianMonthInfo(1403, 12).days, 30);
  assert.equal(persianMonthInfo(1404, 12).days, 29);
  assert.throws(() => persianMonthInfo(1402, 12));
  assert.throws(() => persianMonthInfo(1499, 1));
});

test("Persian reminder dates accept Persian, Arabic and Latin digits with Tehran time", () => {
  for (const date of ["1405/01/01", "۱۴۰۵/۰۱/۰۱", "١٤٠٥/٠١/٠١"]) {
    assert.equal(parseReminderDate(date, "۰۹:۳۰"), "2026-03-21T09:30:00+03:30");
  }
  assert.equal(parseReminderDate("1405/1/1", "0:00"), "2026-03-21T00:00:00+03:30");
  const fields = reminderDateFields("2026-03-20T20:30:00Z");
  assert.equal(fields.date, "1405/01/01");
  assert.equal(fields.time, "00:00");
});

test("leap days and impossible dates are validated without rolling forward", () => {
  assert.equal(parseReminderDate("1403/12/30", "09:00"), "2025-03-20T09:00:00+03:30");
  for (const date of ["1404/12/30", "1405/07/31", "1405/13/01", "1405/01/00", "", "1500/01/01"]) {
    assert.equal(parseReminderDate(date, "09:00"), null, date);
  }
  for (const time of ["24:00", "12:60", "-1:00", "", "9:0"]) {
    assert.equal(parseReminderDate("1405/01/01", time), null, time);
  }
});

test("stored dates round-trip across Persian year and month boundaries", () => {
  for (const date of ["1403/01/01", "1405/06/31", "1405/07/01", "1405/12/29", "1498/12/29"]) {
    const result = parseReminderDate(date, "23:59");
    assert.ok(result, date);
    assert.equal(reminderDateFields(result).date, date);
    assert.equal(reminderDateFields(result).time, "23:59");
  }
});
