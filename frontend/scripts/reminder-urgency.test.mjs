import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/features/reminders/urgency.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
runInNewContext(code, context);
const { reminderUrgency } = context.exports;

test("home reminder colors advance at each six-hour boundary", () => {
  const due = "2030-03-21T09:00:00+03:30";
  const at = hours => Date.parse(due) - hours * 3_600_000;
  for (const [hours, expected] of [[24, "neutral"], [18.001, "neutral"], [18, "gentle"],
    [12.001, "gentle"], [12, "near"], [6.001, "near"], [6, "urgent"], [0, "urgent"]]) {
    assert.equal(reminderUrgency(due, at(hours)), expected);
  }
  assert.equal(reminderUrgency("2030-03-21T05:30:00Z", at(6)), "urgent");
  assert.equal(reminderUrgency("invalid", at(0)), "neutral");
});
