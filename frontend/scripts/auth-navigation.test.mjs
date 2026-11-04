import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../src/features/auth/navigation.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function navigation(href) {
  const context = {exports: {}, URL, URLSearchParams, window: {location: {href}}};
  runInNewContext(code, context);
  return context;
}
test("invitation survives signup switch and an accessibility fragment change", () => {
  const token = "a".repeat(43);
  const state = navigation(`https://maban.example/login#invite=${token}`);
  assert.equal(state.exports.authHref("/signup"), `/signup#invite=${token}`);
  state.window.location.href = "https://maban.example/login#auth-main";
  assert.equal(state.exports.afterAuth(), `/invite#token=${token}`);
});
test("families is an allowlisted return path", () => {
  const state = navigation("https://maban.example/login?next=/families");
  assert.equal(state.exports.authHref("/signup"), "/signup?next=/families");
  assert.equal(state.exports.afterAuth(), "/families");
});
test("external, protocol-relative and encoded return destinations are rejected", () => {
  for (const next of ["https://evil.example", "//evil.example", "%2F%2Fevil.example", "/admin/users", "javascript:alert(1)"]) {
    assert.equal(navigation(`https://maban.example/login?next=${next}`).exports.afterAuth(), "/dashboard");
  }
});
test("invalid invitation tokens never become a redirect or an auth link", () => {
  for (const token of ["short", "a".repeat(44), "https://evil.example", "a".repeat(42)+"%2F"]) {
    const state = navigation(`https://maban.example/login#invite=${token}`);
    assert.equal(state.exports.afterAuth(), "/dashboard");
    assert.equal(state.exports.authHref("/signup"), "/signup");
  }
});
