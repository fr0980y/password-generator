/**
 * Regression tests for the static-export CSP hash generator.
 *
 * These tests use Node's built-in `node:test` runner and temporary export
 * directories, so they exercise the same file-generation API as the build
 * without invoking Next.js, Serwist, a browser, or files in the repository.
 * Run with `node --test scripts/generate-security-headers.test.mjs`.
 *
 * @module generate-security-headers.test
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  extractInlineScriptHashes,
  generateSecurityHeaders,
} from "./generate-security-headers.mjs";

/**
 * Produces the expected CSP digest for a script body, excluding its HTML tags.
 *
 * @param {string} source Script text after browser HTML input normalization.
 * @returns {string} Base64-encoded SHA-256 digest.
 */
function hashScript(source) {
  return createHash("sha256").update(source, "utf8").digest("base64");
}

/**
 * Creates an isolated export fixture and registers cleanup with the test
 * context, keeping generated files out of the working tree.
 *
 * @param {import("node:test").TestContext} t Context whose teardown runs after the test.
 * @returns {Promise<string>} Absolute path to the temporary export directory.
 */
async function createTemporaryExport(t) {
  const directory = await mkdtemp(join(tmpdir(), "password-generator-export-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

/** Verify comment, attribute, and raw-text markup is ignored while browser-normalized script bodies are hashed. */
test("hashes browser-normalized inline scripts and ignores non-script markup", async () => {
  const html = [
    "<!-- <script>commented()</script> -->",
    '<div title="<script>attribute()</script>">',
    '<style>.content::after { content: "<script>style()</script>"; }</style>',
    '<SCRIPT data-note="contains > safely">first()\r\nsecond()</script>',
    '<script SRC="/bundle.js">external()</script>',
    "<script src>empty source attribute()</script>",
    "<script>last()\0part</script>",
  ].join("");

  assert.deepEqual(extractInlineScriptHashes(html), [
    hashScript("first()\nsecond()"),
    hashScript("last()\uFFFDpart"),
  ]);
});

/** Guard against custom tag names being mistaken for script elements, including when real scripts follow them. */
test("ignores script-like custom tags and hashes actual scripts that follow them", () => {
  const html = [
    "<script-widget>custom element content</script-widget>",
    "<script>afterWidget()</script>",
    "<script:widget>custom element content</script:widget>",
    "<script>afterColonWidget()</script>",
  ].join("");

  assert.deepEqual(extractInlineScriptHashes(html), [
    hashScript("afterWidget()"),
    hashScript("afterColonWidget()"),
  ]);
});

/** Ensure an incomplete custom element is not reported as an incomplete script element. */
test("does not treat unterminated script-like custom tags as script elements", () => {
  assert.deepEqual(extractInlineScriptHashes("<script-widget"), []);
  assert.deepEqual(extractInlineScriptHashes("<script:widget"), []);
});

/** Exercise recursive discovery, hash deduplication/order, required headers, and repeat-build determinism. */
test("generates one deterministic policy from every nested HTML file", async (t) => {
  const exportDirectory = await createTemporaryExport(t);
  const nestedDirectory = join(exportDirectory, "nested");
  await mkdir(nestedDirectory);
  await writeFile(
    join(exportDirectory, "index.html"),
    "<script>second()</script><script>first()</script>",
  );
  await writeFile(
    join(nestedDirectory, "404.html"),
    "<script>first()</script><script>third()</script>",
  );

  const result = await generateSecurityHeaders(exportDirectory);
  const headers = await readFile(result.headersFile, "utf8");
  const repeatedResult = await generateSecurityHeaders(exportDirectory);
  const repeatedHeaders = await readFile(repeatedResult.headersFile, "utf8");
  const hashes = [hashScript("first()"), hashScript("second()"), hashScript("third()")];

  assert.equal(result.htmlFileCount, 2);
  assert.equal(result.scriptHashCount, 3);
  assert.equal(repeatedHeaders, headers);
  assert.match(headers, /^\/\*\n/);
  const csp = headers.match(/^  Content-Security-Policy: (.+)$/m)?.[1];
  assert.ok(csp);
  const scriptDirective = csp.split("; ").find((directive) => directive.startsWith("script-src "));
  assert.ok(scriptDirective);
  assert.deepEqual(
    scriptDirective.split(" ").slice(2),
    hashes.sort().map((hash) => `'sha256-${hash}'`),
  );
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /Referrer-Policy: no-referrer/);
  assert.match(
    headers,
    /Permissions-Policy: camera=\(\), microphone=\(\), geolocation=\(\), payment=\(\), usb=\(\), clipboard-read=\(self\), clipboard-write=\(self\)/,
  );
  assert.match(headers, /X-Frame-Options: DENY/);
  assert.match(headers, /Strict-Transport-Security: max-age=31536000/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|upgrade-insecure-requests|data:|blob:|\*/i);
});

/** Verify missing build output fails with a useful directory error. */
test("fails when the export directory is missing", async (t) => {
  const exportDirectory = await createTemporaryExport(t);
  await assert.rejects(
    generateSecurityHeaders(join(exportDirectory, "missing")),
    /Unable to read export directory/,
  );
});

/** Ensure an empty export cannot produce a misleading CSP header. */
test("fails when no HTML files exist", async (t) => {
  const exportDirectory = await createTemporaryExport(t);
  await assert.rejects(generateSecurityHeaders(exportDirectory), /No exported HTML files/);
});

/** Ensure an export containing only external scripts cannot silently omit inline-script permissions. */
test("fails when exported HTML contains no inline scripts", async (t) => {
  const exportDirectory = await createTemporaryExport(t);
  await writeFile(join(exportDirectory, "index.html"), '<script src="/app.js"></script>');

  await assert.rejects(
    generateSecurityHeaders(exportDirectory),
    /No inline scripts were found/,
  );
});

/** Ensure filesystem failures while writing the deployment artifact propagate as an explicit error. */
test("reports a failure when the headers file cannot be written", async (t) => {
  const exportDirectory = await createTemporaryExport(t);
  await writeFile(join(exportDirectory, "index.html"), "<script>app()</script>");
  await mkdir(join(exportDirectory, "_headers"));

  await assert.rejects(
    generateSecurityHeaders(exportDirectory),
    /Unable to write Cloudflare security headers/,
  );
});
