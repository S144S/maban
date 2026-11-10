import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../src/lib/http.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function client(fetch) {
  const context = { exports: {}, fetch, Blob, AbortSignal, DOMException };
  runInNewContext(code, context);
  return context.exports;
}

test("photo transport preserves binary content, session credentials and CSRF header", async () => {
  const file = new Blob([new Uint8Array([0, 255, 128, 13])], { type: "image/png" });
  const { api } = client(async (url, options) => {
    assert.equal(url, "/api/families/f/plants/p/photo");
    assert.equal(options.method, "PUT");
    assert.equal(options.body, file);
    assert.equal(options.headers["Content-Type"], "image/png");
    assert.equal(options.headers["X-Maban-Request"], "1");
    assert.equal(options.credentials, "same-origin");
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ plant: { photo_url: "/private-photo" } });
  });
  assert.equal((await api("/families/f/plants/p/photo", { method: "PUT", body: file })).plant.photo_url, "/private-photo");
});

test("existing JSON requests and photo error responses keep their contracts", async () => {
  const { api } = client(async (_url, options) => {
    assert.equal(options.body, '{"name":"گلدون"}');
    assert.equal(options.headers["Content-Type"], "application/json");
    return Response.json({ ok: true });
  });
  assert.equal((await api("/plants", { method: "POST", body: { name: "گلدون" } })).ok, true);
  const failed = client(async () => Response.json({ detail: "حجم عکس زیاده" }, { status: 413 }));
  await assert.rejects(failed.api("/photo", { method: "PUT", body: new Blob() }), error => error.status === 413 && error.message === "حجم عکس زیاده");
});
