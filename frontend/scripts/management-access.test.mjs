import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const context = { exports: {}, require: name => name.endsWith(".css") ? {} : require(name) };
  runInNewContext(code, context);
  return context.exports;
}
const { canManageFamily } = load("../src/features/families/management-access.ts");
const { BottomNavigation } = load("../src/components/BottomNavigation.tsx");
const family = { id: "family", owner_id: "owner" };
const members = [
  { user_id: "owner", relationship: null },
  { user_id: "spouse", relationship: "spouse" },
  { user_id: "child", relationship: "child" },
  { user_id: "friend", relationship: "friend" },
];

test("management is visible only to the selected family's creator and spouse", () => {
  for (const [id, expected] of [["owner", true], ["spouse", true], ["child", false], ["friend", false], ["outsider", false]]) {
    assert.equal(canManageFamily(family, members, id), expected);
  }
  assert.equal(canManageFamily(family, [], "owner"), false);
  // Owning another family cannot grant management in this one.
  assert.equal(canManageFamily({ id: "other", owner_id: "someone" }, [{ user_id: "owner", relationship: "friend" }], "owner"), false);
});

test("restricted navigation has only Home and Reports with a selected indicator", () => {
  const html = renderToStaticMarkup(createElement(BottomNavigation, { active: "reports", canManage: false }));
  assert.equal((html.match(/<a /g) ?? []).length, 2);
  assert.doesNotMatch(html, /page=budgets|مدیریت/);
  assert.match(html, /data-management="false"/);
  assert.match(html, /aria-current="page"/);
  const manager = renderToStaticMarkup(createElement(BottomNavigation, { active: "plants", canManage: true }));
  assert.equal((manager.match(/<a /g) ?? []).length, 3);
  assert.match(manager, /page=budgets/);
  assert.match(manager, /data-active="budgets"/);
});
