import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const publicRoot = new URL("../public/", import.meta.url);

test("installation manifest uses local icons with matching PNG dimensions", () => {
  const manifest = JSON.parse(readFileSync(new URL("manifest.webmanifest", publicRoot), "utf8"));
  assert.equal(manifest.display, "standalone");
  const origin = "https://mabanapp.ir";
  const start = new URL(manifest.start_url, origin);
  assert.equal(start.origin, origin);
  assert.ok(start.pathname.startsWith(manifest.scope));
  assert.equal(start.search, "");
  assert.equal(start.hash, "");
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(icon => icon.sizes === `${size}x${size}`);
    assert.ok(icon);
    assert.equal(icon.type, "image/png");
    assert.ok(icon.src.startsWith("/icons/"));
    const png = readFileSync(new URL(icon.src.slice(1), publicRoot));
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  const touch = readFileSync(new URL("icons/apple-touch-icon.png", publicRoot));
  assert.equal(touch.readUInt32BE(16), 180);
  assert.equal(touch.readUInt32BE(20), 180);
});
