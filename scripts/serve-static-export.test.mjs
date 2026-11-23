/**
 * Focused Node.js regressions for the static-export HTTP test server.
 *
 * These tests cover `_headers` wildcard parsing, catch-all fallback behavior,
 * and deterministic request-handler failures that are not practical to provoke
 * reliably through Playwright. The module uses Node's built-in test runner,
 * HTTP server, assert library, and Fetch API; it adds no test dependency.
 *
 * @module serve-static-export.test
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import {
  createRequestHandler,
  getResponseHeaders,
  parseHeadersFile,
} from "./serve-static-export.mjs";

/**
 * Verifies both supported rule shapes and their precedence at response time.
 */
test("accepts exact paths and one terminal trailing wildcard", () => {
  const rules = parseHeadersFile(
    "/*\n" +
      "  X-Test: wildcard\n" +
      "/exact\n" +
      "  X-Test: exact\n",
  );

  assert.equal(rules.length, 2);
  assert.equal(rules[0].path, "/*");
  assert.equal(rules[1].path, "/exact");
  assert.equal(getResponseHeaders(rules, "/exact")["x-test"], "exact");
  assert.equal(getResponseHeaders(rules, "/assets/app.css")["x-test"], "wildcard");
});

/**
 * Verifies that malformed wildcard placement and wildcard counts fail parsing.
 */
test("rejects multiple and non-terminal wildcard patterns", () => {
  for (const pathRule of [
    "/foo/**",
    "/foo*/*",
    "/foo/*/bar",
    "/*foo",
    "/foo*",
    "/foo/*bar",
  ]) {
    assert.throws(
      () => parseHeadersFile(`${pathRule}\n  X-Test: invalid\n`),
      /Unsupported _headers wildcard/,
      pathRule,
    );
  }
});

/**
 * Verifies that unavailable pathnames apply catch-all headers only, never
 * inferred path-specific rules.
 */
test("missing pathnames apply only the catch-all rule", () => {
  const rules = parseHeadersFile(
    "/*\n" +
      "  Content-Security-Policy: default-src 'none'\n" +
      "/foo/*\n" +
      "  X-Path-Specific: should-not-apply\n",
  );

  for (const pathname of [undefined, null, "", "/%"]) {
    const headers = getResponseHeaders(rules, pathname);
    assert.equal(headers["content-security-policy"], "default-src 'none'");
    assert.equal(headers["x-path-specific"], undefined);
  }
});

/**
 * Starts a real loopback HTTP server with a controlled file-reader failure.
 * This proves the catch handler preserves its 500 status/body and merges the
 * generated catch-all headers without replacing the original failure result.
 */
test("500 responses keep their body and generated headers after file-read failures", async () => {
  const headerRules = parseHeadersFile(
    "/*\n" +
      "  Content-Security-Policy: default-src 'none'\n" +
      "  X-Content-Type-Options: nosniff\n",
  );
  const server = createServer(
    createRequestHandler({
      headerRules,
      readExportFile: async (pathname) => {
        // The assertion confirms the failure occurs after normal pathname
        // resolution, so it exercises the handler's catch block rather than startup.
        assert.equal(pathname, "/forced-error");
        throw new Error("controlled file-read failure");
      },
    }),
  );

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");

  const originalConsoleError = console.error;
  // Suppress only the expected test-server diagnostic; it is restored below
  // together with the temporary loopback server.
  console.error = () => {};
  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/forced-error`,
    );
    assert.equal(response.status, 500);
    assert.equal(await response.text(), "Internal server error");
    assert.equal(
      response.headers.get("content-security-policy"),
      "default-src 'none'",
    );
    assert.equal(
      response.headers.get("x-content-type-options"),
      "nosniff",
    );
  } finally {
    console.error = originalConsoleError;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
