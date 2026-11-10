import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, imports = {}) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const context = { exports: {}, require: name => imports[name] ?? require(name) };
  runInNewContext(code, context);
  return context.exports;
}
const calendar = load("../src/lib/persian-date.ts");
const model = load("../src/features/reports/model.ts", { "@/lib/persian-date": calendar });
const { CashflowChart } = load("../src/features/reports/CashflowChart.tsx", { "./model": model });
const render = (income, expense) => renderToStaticMarkup(createElement(CashflowChart, { income, expense }));

test("cashflow lines retain all daily points instead of summing multi-day buckets", () => {
  const income = { start: "2026-11-01", end: "2026-11-19", daily: [{ date: "2026-11-01", total_toman: "9007199254740993" }] };
  const expense = { daily: [{ date: "2026-11-19", total_toman: "100" }] };
  const html = render(income, expense);
  assert.equal((html.match(/<path /g) ?? []).length, 1);
  assert.equal((html.match(/<circle /g) ?? []).length, 19);
  assert.equal((html.match(/class="cashflow-expense-point"/g) ?? []).length, 0);
  assert.doesNotMatch(html, /خط پیوسته|خط‌چین/);
  assert.ok(html.includes(model.money("9007199254740993")));
  assert.match(html, /class="cashflow-axis"/);
  assert.ok(html.includes(`>${model.money("10000000000000000")}</text>`));
  assert.match(html, /tabindex="0"/);
  assert.doesNotMatch(html, /جمع بازه‌های|NaN|Infinity/);
});

test("single-day and zero-transaction charts stay valid and retain the daily table", () => {
  const income = { start: "2026-11-01", end: "2026-11-01", daily: [{ date: "2026-11-01", total_toman: "10" }] };
  const html = render(income, { daily: [] });
  assert.equal((html.match(/<circle /g) ?? []).length, 1);
  assert.doesNotMatch(html, /NaN|Infinity/);
  assert.match(html, /جدول روزانه و مبلغ دقیق/);
  const empty = render({ ...income, daily: [] }, { daily: [] });
  assert.match(empty, /در این بازه دخلی ثبت نشده/);
  assert.doesNotMatch(empty, /<svg/);
});

test("switching to expenses uses their own scale and empty state, preserving the combined table", () => {
  let selected = "income";
  const { CashflowChart: SwitchableChart } = load("../src/features/reports/CashflowChart.tsx", {
    "./model": model,
    react: { ...React, useId: () => "chart-test", useState: () => [selected, value => { selected = value; }] },
  });
  const props = {
    income: { start: "2026-11-01", end: "2026-11-02", daily: [{ date: "2026-11-01", total_toman: "1000000000" }] },
    expense: { daily: [{ date: "2026-11-02", total_toman: "100" }] },
  };
  const buttons = SwitchableChart(props).props.children[0].props.children;
  buttons[1].props.onClick();
  let html = renderToStaticMarkup(createElement(SwitchableChart, props));
  assert.match(html, /aria-pressed="true">خرج/);
  assert.match(html, /cashflow-expense-line/);
  assert.doesNotMatch(html, /cashflow-income-line/);
  assert.equal((html.match(/class="cashflow-expense-point"/g) ?? []).length, 2);
  assert.match(html, /d="M 72 144 L 392 24"/);
  assert.ok(html.includes(`>${model.money(100)}</text>`));
  assert.ok(html.includes(`>${model.money(50)}</text>`));
  assert.match(html, />تومان<\/text>/);
  assert.ok(html.includes(`بالاترین خرج روزانه: ${model.money(100)}`));
  assert.ok(html.includes(model.money(1000000000))); // Combined daily table is retained.
  html = renderToStaticMarkup(createElement(SwitchableChart, { ...props, expense: { daily: [] } }));
  assert.match(html, /در این بازه خرجی ثبت نشده/);
  assert.doesNotMatch(html, /<svg/);
  buttons[0].props.onClick();
  html = renderToStaticMarkup(createElement(SwitchableChart, props));
  assert.match(html, /aria-pressed="true">دخل/);
  assert.match(html, /cashflow-income-line/);
});
