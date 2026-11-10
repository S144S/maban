import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/pwa-updates.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture({ firstInstall = false, failure = false } = {}) {
  let now = 100_000;
  let checks = 0;
  const messages = [];
  const worker = Object.assign(new EventTarget(), {
    state: "installed", postMessage: message => messages.push(message.type),
  });
  const registration = Object.assign(new EventTarget(), {
    active: firstInstall ? null : {}, waiting: worker, installing: null,
    update: async () => { checks++; if (failure) throw new Error("offline"); },
  });
  let options;
  const serviceWorker = Object.assign(new EventTarget(), {
    register: async (url, config) => { options = { url, ...config }; return registration; },
  });
  const timers = new Map();
  let id = 0;
  const view = Object.assign(new EventTarget(), {
    setInterval: callback => { timers.set(++id, callback); return id; },
    clearInterval: id => timers.delete(id),
    setTimeout: callback => { timers.set(++id, callback); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const document = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const navigator = { serviceWorker, onLine: true };
  const context = { exports: {}, window: view, document, navigator, Date: { now: () => now } };
  runInNewContext(code, context);
  return {
    ...context.exports, worker, registration, serviceWorker, view, document, navigator, messages, timers,
    options: () => options, checks: () => checks, advance: () => { now += 60_001; },
  };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

test("existing waiting update is reported without activation; dismissal and other-tab activation never reload", async () => {
  const f = fixture();
  const notices = [];
  const dispose = f.watchPwaUpdates(worker => notices.push(worker));
  await flush();
  assert.equal(f.options().url, "/sw.js");
  assert.equal(f.options().updateViaCache, "none");
  assert.equal(notices.at(-1), f.worker);
  assert.deepEqual(f.messages, []);
  f.registration.waiting = null;
  f.serviceWorker.dispatchEvent(new Event("controllerchange"));
  assert.equal(notices.at(-1), null);
  dispose();
  assert.equal(f.timers.size, 0);
  f.advance();
  f.view.dispatchEvent(new Event("focus"));
  assert.equal(f.checks(), 1);
});

test("first installation stays silent; a later installed update is reported", async () => {
  const f = fixture({ firstInstall: true });
  const notices = [];
  f.watchPwaUpdates(worker => notices.push(worker));
  await flush();
  assert.deepEqual(notices, [null]);
  f.registration.active = {};
  f.registration.installing = f.worker;
  f.registration.dispatchEvent(new Event("updatefound"));
  f.worker.dispatchEvent(new Event("statechange"));
  assert.equal(notices.at(-1), f.worker);
});

test("checks are throttled, pause offline/hidden, and retry after network failure", async () => {
  const f = fixture({ failure: true });
  f.watchPwaUpdates(() => {});
  await flush();
  f.view.dispatchEvent(new Event("focus"));
  assert.equal(f.checks(), 1);
  f.advance();
  f.document.visibilityState = "hidden";
  f.view.dispatchEvent(new Event("focus"));
  f.document.visibilityState = "visible";
  f.navigator.onLine = false;
  f.view.dispatchEvent(new Event("online"));
  assert.equal(f.checks(), 1);
  f.navigator.onLine = true;
  f.view.dispatchEvent(new Event("online"));
  await flush();
  assert.equal(f.checks(), 2);
});

test("consent sends activation and waits for control; timeout can be retried", async () => {
  const f = fixture();
  const activation = f.activatePwaUpdate(f.worker);
  assert.deepEqual(f.messages, ["ACTIVATE_UPDATE"]);
  f.serviceWorker.dispatchEvent(new Event("controllerchange"));
  await activation;
  assert.equal(f.timers.size, 0);
  const failed = f.activatePwaUpdate(f.worker);
  const rejection = assert.rejects(failed, /timed out/);
  [...f.timers.values()][0]();
  await rejection;
  assert.equal(f.timers.size, 0);
  f.worker.state = "activated";
  await f.activatePwaUpdate(f.worker);
});

test("worker waits for explicit activation and keeps navigation network-only", async () => {
  const handlers = new Map();
  let skipped = 0;
  let claimed = 0;
  let requestOptions;
  runInNewContext(readFileSync(new URL("update-worker.js", import.meta.url), "utf8"), {
    self: {
      addEventListener: (name, callback) => handlers.set(name, callback),
      skipWaiting: async () => { skipped++; },
      clients: { claim: async () => { claimed++; } },
    },
    fetch: async (_, options) => { requestOptions = options; return "network"; },
  });
  assert.equal(skipped, 0);
  const pending = [];
  handlers.get("message")({ data: { type: "unknown" } });
  assert.equal(skipped, 0);
  handlers.get("message")({ data: { type: "ACTIVATE_UPDATE" }, waitUntil: p => pending.push(p) });
  handlers.get("activate")({ waitUntil: p => pending.push(p) });
  assert.equal(skipped, 1);
  assert.equal(claimed, 1);
  handlers.get("fetch")({ request: { mode: "navigate" }, respondWith: p => pending.push(p) });
  assert.equal(requestOptions.cache, "no-store");
  // API and asset requests pass through untouched, with no Cache Storage access.
  handlers.get("fetch")({ request: { mode: "cors", url: "/api/private" }, respondWith: () => assert.fail("API intercepted") });
  await Promise.all(pending);
});

test("offline or obsolete workers cannot activate; failed messages clean up for retry", async () => {
  const f = fixture();
  f.navigator.onLine = false;
  await assert.rejects(f.activatePwaUpdate(f.worker), /online connection/);
  assert.deepEqual(f.messages, []);
  f.navigator.onLine = true;
  f.worker.state = "redundant";
  await assert.rejects(f.activatePwaUpdate(f.worker), /no longer available/);
  f.worker.state = "installed";
  f.worker.postMessage = () => { throw new Error("Worker unavailable"); };
  await assert.rejects(f.activatePwaUpdate(f.worker), /Worker unavailable/);
  assert.equal(f.timers.size, 0);
});

test("unmount before registration resolves leaves no listeners, timers or notices", async () => {
  const f = fixture();
  const dispose = f.watchPwaUpdates(() => assert.fail("notified after unmount"));
  dispose();
  await flush();
  f.view.dispatchEvent(new Event("focus"));
  f.registration.dispatchEvent(new Event("updatefound"));
  assert.equal(f.checks(), 0);
  assert.equal(f.timers.size, 0);
});
