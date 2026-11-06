import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../src/lib/dialog-viewport.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports: {} };
runInNewContext(code, context);
const { trackDialogViewport } = context.exports;

function fixture() {
  const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 });
  const frames = new Map();
  let id = 0;
  const view = Object.assign(new EventTarget(), {
    visualViewport: viewport,
    requestAnimationFrame: callback => { frames.set(++id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  const field = { getBoundingClientRect: () => ({ top: 600, bottom: 650 }) };
  const content = {
    scrollTop: 0,
    contains: element => element === field,
    getBoundingClientRect: () => ({ top: viewport.offsetTop + 16, bottom: viewport.offsetTop + viewport.height }),
  };
  const container = Object.assign(new EventTarget(), {
    style: {}, ownerDocument: { activeElement: field }, querySelector: () => content,
  });
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); };
  return { viewport, view, container, content, field, flush, frames };
}

test("keyboard resize and pan fit the sheet to the visual viewport and reveal its focused field", () => {
  const f = fixture();
  const dispose = trackDialogViewport(f.container, f.view);
  f.viewport.height = 320;
  f.viewport.offsetTop = 80;
  f.viewport.dispatchEvent(new Event("resize"));
  f.viewport.dispatchEvent(new Event("scroll"));
  assert.equal(f.frames.size, 1);
  f.flush();
  assert.equal(f.container.style.height, "320px");
  assert.equal(f.container.style.top, "80px");
  assert.equal(f.content.scrollTop, 262);
  // Keyboard dismissal restores full height without resetting form scroll.
  f.viewport.height = 800;
  f.viewport.offsetTop = 0;
  f.viewport.dispatchEvent(new Event("resize"));
  f.flush();
  assert.equal(f.container.style.height, "800px");
  assert.equal(f.container.style.top, "0px");
  assert.equal(f.content.scrollTop, 262);
  dispose();
});

test("focus above the sheet scrolls back, while viewport panning alone preserves user scroll", () => {
  const f = fixture();
  const dispose = trackDialogViewport(f.container, f.view);
  f.content.scrollTop = 200;
  f.field.getBoundingClientRect = () => ({ top: -40, bottom: 10 });
  f.container.dispatchEvent(new Event("focusin"));
  f.flush();
  assert.equal(f.content.scrollTop, 132);
  f.viewport.offsetTop = 50;
  f.viewport.dispatchEvent(new Event("scroll"));
  f.flush();
  assert.equal(f.container.style.top, "50px");
  assert.equal(f.content.scrollTop, 132);
  dispose();
});

test("closing cancels queued updates and removes every listener; unsupported browsers retain CSS fallback", () => {
  const f = fixture();
  const dispose = trackDialogViewport(f.container, f.view);
  f.viewport.dispatchEvent(new Event("resize"));
  dispose();
  assert.equal(f.frames.size, 0);
  f.viewport.dispatchEvent(new Event("resize"));
  f.viewport.dispatchEvent(new Event("scroll"));
  f.view.dispatchEvent(new Event("resize"));
  f.container.dispatchEvent(new Event("focusin"));
  assert.equal(f.frames.size, 0);
  const fallback = fixture();
  fallback.view.visualViewport = null;
  trackDialogViewport(fallback.container, fallback.view)();
  assert.deepEqual(fallback.container.style, {});
});
