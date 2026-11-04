import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

function load(path) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {} };
  runInNewContext(code, context);
  return context.exports;
}
const { formatMoneyInput } = load("../src/lib/money-input.ts");
const { parseAmount } = load("../src/features/dashboard/model.ts");

test("groups all supported digits without changing submitted amounts", () => {
  for (const [raw, display] of [["1234567", "1٬234٬567"], ["۱۲۳۴۵۶۷", "۱٬۲۳۴٬۵۶۷"], ["١٢٣٤٥٦٧", "١٬٢٣٤٬٥٦٧"], ["1,234,567", "1٬234٬567"], ["1.234.567", "1٬234٬567"]]) {
    assert.equal(formatMoneyInput(raw).value, display);
    assert.equal(parseAmount(display), 1234567);
  }
  assert.equal(parseAmount(formatMoneyInput("1000000000000").value), 1000000000000);
});
test("empty fields, leading zeroes and invalid financial inputs remain safe", () => {
  assert.equal(formatMoneyInput("").value, "");
  assert.equal(formatMoneyInput("0001").value, "0٬001");
  for (const raw of ["-100", "1.5", "۱۲٫۵", "1e6", "12x"]) {
    assert.equal(formatMoneyInput(raw).value, raw);
    assert.equal(parseAmount(raw), null);
  }
});
test("cursor stays anchored to digits when grouping changes", () => {
  assert.equal(formatMoneyInput("1234", 2).caret, 3);
  assert.equal(formatMoneyInput("1٬9234", 3).caret, 2);
  assert.equal(formatMoneyInput("1234", 0).caret, 0);
  assert.equal(formatMoneyInput("1234567").caret, 9);
});
