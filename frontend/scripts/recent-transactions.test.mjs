import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/features/dashboard/recent-transactions.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
runInNewContext(code, context);
const { recentTransactions } = context.exports;
const income = (id, created_at) => ({ id, created_at, source: "salary", amount_toman: "1000000000000" });
const expense = (id, created_at) => ({ id, created_at, category_name: "خرید خونه", title: "خرج", amount_toman: 100 });

test("last three transactions combine income and expenses by actual time across timezones", () => {
  const incomes = [income("a", "2030-01-01T12:00:00Z"), income("b", "2030-01-01T10:00:00Z")];
  const expenses = [expense("c", "2030-01-01T16:00:00+03:30"), expense("d", "2030-01-01T11:00:00Z")];
  const before = JSON.stringify([incomes, expenses]);
  const rows = recentTransactions(incomes, expenses);
  assert.equal(rows.map(row => row.id).join(","), "c,a,d");
  assert.equal(rows.map(row => row.kind).join(","), "expense,income,expense");
  assert.equal(rows[0].label, "خرید خونه");
  assert.equal(rows[1].label, "حقوق");
  assert.equal(rows[1].amount_toman, "1000000000000");
  assert.equal(JSON.stringify([incomes, expenses]), before);
});

test("empty, fewer than three, one-sided and simultaneous transactions remain deterministic", () => {
  assert.equal(recentTransactions([], []).length, 0);
  const at = "2030-01-01T12:00:00Z";
  assert.equal(recentTransactions([income("a", at)], []).length, 1);
  const rows = recentTransactions([], [expense("a", at), expense("d", at), expense("c", at), expense("b", at)]);
  assert.equal(rows.map(row => row.id).join(","), "d,c,b");
  assert.ok(rows.every(row => row.kind === "expense"));
  assert.equal(recentTransactions([income("shared", at)], [expense("shared", at)]).length, 2);
});
