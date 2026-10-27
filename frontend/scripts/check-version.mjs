import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const read = (name) =>
  readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const version = read("VERSION").trim();
assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
assert.equal(pkg.version, version);
assert.equal(lock.version, version);
assert.equal(lock.packages[""].version, version);
assert.ok(
  read("CHANGELOG.md").includes(`Current development version: \`${version}\``),
);
console.log(
  `Frontend version ${version}: metadata and changelog are consistent.`,
);
