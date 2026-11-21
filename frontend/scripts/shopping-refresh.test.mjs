import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../src/features/shopping/ShoppingItems.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const item = { id: "milk", name: "شیر", quantity: "۲ بسته", note: "", purchased: false, version: 1 };
const list = { items: [item], pending_count: 1, purchased_count: 0, has_more: false,
  checkout: { token: "fresh-token", has_expense: false } };

function render({ loading = false, loadedScope = "family:list:0", selected = "family", offset = 0, data = list, busy = false } = {}) {
  let index = 0;
  const states = [{ id: selected, name: "خانواده" }, data, offset, loadedScope, 0, loading, "", "", null, "", false, busy];
  const passthrough = ({ children }) => children;
  const imports = {
    react: { ...React, useState: () => [states[index++], () => {}], useEffect: () => {}, useRef: () => ({ current: null }) },
    "@/components/ui/button": { Button: ({ children, ...props }) => React.createElement("button", props, children) },
    "@/components/ManagementBack": { ManagementBack: () => null },
    "@/components/ui/dialog": Object.fromEntries(["Dialog", "DialogContent", "DialogDescription", "DialogHeader", "DialogTitle"].map(name => [name, name === "Dialog" ? () => null : passthrough])),
    "@/lib/http": {}, "@/lib/persian-date": {},
    "../families/ActiveFamily": { useActiveFamily: () => ({ selected, setSelected: () => {} }) },
    "./PurchaseForm": {}, "./shopping.css": {},
  };
  const context = { exports: {}, require: name => imports[name] ?? require(name) };
  runInNewContext(code, context);
  return renderToStaticMarkup(React.createElement(context.exports.ShoppingItems, {
    listId: "list", listName: "خرید هفتگی", onBack: () => {}, onFamilies: () => {},
  }));
}

test("purchase refresh retains item rows and disables stale actions instead of collapsing the list", () => {
  const before = render();
  const refreshing = render({ loading: true });
  assert.match(before, /class="shopping-item"/);
  assert.match(refreshing, /class="shopping-item"/);
  assert.doesNotMatch(refreshing, /در حال دریافت لیست خرید/);
  assert.match(refreshing, /role="checkbox"[^>]*disabled=""/);
  const after = render({ data: { ...list, items: [{ ...item, purchased: true }], pending_count: 0, purchased_count: 1 } });
  assert.match(after, /role="checkbox" aria-checked="true"/);
  assert.doesNotMatch(after, /role="checkbox"[^>]*disabled/);
});

test("old rows are hidden during family, list or pagination changes", () => {
  for (const options of [{ selected: "other" }, { loadedScope: "family:other:0" }, { offset: 50 }]) {
    const html = render({ ...options, loading: true });
    assert.doesNotMatch(html, /class="shopping-item"/);
    assert.match(html, /در حال دریافت لیست خرید/);
  }
});

test("initial load still has a loading message and no stale item actions", () => {
  const html = render({ data: null, loadedScope: "", loading: true });
  assert.match(html, /در حال دریافت لیست خرید/);
  assert.doesNotMatch(html, /role="checkbox"/);
});
