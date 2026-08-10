import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const workerSource = readFileSync("service-worker.js", "utf8");
const cleanupSource = readFileSync("js/v1-browser-lifecycle-cleanup.js", "utf8");
const legacySource = readFileSync("js/legacy-core.js", "utf8");
const indexSource = readFileSync("index.html", "utf8");

assert.match(workerSource, /const CACHE_NAME = "school-v1-cache"/);
assert.match(workerSource, /self\.skipWaiting\(\)/);
assert.match(workerSource, /caches\.delete\(CACHE_NAME\)/);
assert.match(workerSource, /self\.registration\.unregister\(\)/);
assert.doesNotMatch(workerSource, /caches\.keys|caches\.open|caches\.match|addAll/);
assert.doesNotMatch(workerSource, /addEventListener\("fetch"|clients\.claim/);

assert.match(cleanupSource, /const V1_SCOPE_PATH = "\/aozora-school-system-v1\/"/);
assert.match(cleanupSource, /const V1_CACHE_NAME = "school-v1-cache"/);
assert.match(cleanupSource, /getRegistration\(expectedScope\)/);
assert.match(cleanupSource, /registration\?\.scope === expectedScope/);
assert.match(cleanupSource, /registration\.update\(\)/);
assert.match(cleanupSource, /registration\.unregister\(\)/);
assert.match(cleanupSource, /window\.caches\.delete\(V1_CACHE_NAME\)/);
assert.doesNotMatch(cleanupSource, /getRegistrations|caches\.keys|localStorage|sessionStorage|\.clear\(/);
assert.doesNotMatch(cleanupSource, /serviceWorker\.register|location\.(assign|replace)|window\.location\s*=/);

assert.doesNotMatch(legacySource, /serviceWorker\.register|school-v1-cache/);
assert.doesNotMatch(indexSource, /manifest\.json|rel\s*=\s*["']manifest|rel=["']manifest/);
assert.match(indexSource, /v1-browser-lifecycle-cleanup\.js\?v=p1-b2b-v1-cleanup-20260810-1/);

const handlers = new Map();
const deletedCaches = [];
let unregisterCalls = 0;
let skipWaitingCalls = 0;
const context = {
  caches: {
    async delete(name) {
      deletedCaches.push(name);
      return true;
    },
  },
  self: {
    addEventListener(name, handler) {
      handlers.set(name, handler);
    },
    async skipWaiting() {
      skipWaitingCalls += 1;
    },
    registration: {
      async unregister() {
        unregisterCalls += 1;
        return true;
      },
    },
  },
};

vm.runInNewContext(workerSource, context, { filename: "service-worker.js" });
assert.deepEqual([...handlers.keys()].sort(), ["activate", "install"]);

let installPromise;
handlers.get("install")({ waitUntil(promise) { installPromise = promise; } });
await installPromise;
assert.equal(skipWaitingCalls, 1);

let activatePromise;
handlers.get("activate")({ waitUntil(promise) { activatePromise = promise; } });
await activatePromise;
assert.deepEqual(deletedCaches, ["school-v1-cache"]);
assert.equal(unregisterCalls, 1);

console.log("P1_B2B_V1_CLEANUP_STATIC_TEST_PASS");
