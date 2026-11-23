/**
 * Security and infrastructure coverage for the production static export.
 *
 * The Chromium project and local static server are configured in
 * `playwright.config.ts`. These tests check generated response headers, CSP
 * enforcement, static resources, custom 404 behavior, and the stable page title.
 * Run `npm run test:e2e` to rebuild `out/` before this test.
 */
import { expect, test } from "@playwright/test";

test(
  "loads the production static export in Chromium",
  /**
   * Uses Playwright's built-in fixtures to verify the configured browser and page.
   *
   * @param {object} param0 Playwright test fixtures for this case.
   * @param {import("@playwright/test").Page} param0.page Chromium page used to load the export.
   * @param {string} param0.browserName Name of the selected Playwright browser project.
   * @returns {Promise<void>} Completes after the response and title assertions pass.
   */
  async ({ page, browserName }) => {
    expect(browserName).toBe("chromium");

    // The configured base URL points at the server serving `out/`, not `next dev`.
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("Password Generator");
  },
);

/** Test-only session property key for CSP violation records. */
const CSP_VIOLATIONS_PROPERTY = "__playwrightCspViolations";
/** Static-export server origin. */
const TEST_ORIGIN = "http://127.0.0.1:4173";

/**
 * Installs CSP violation capture before application scripts execute.
 *
 * @param page - Chromium page on which to capture violations.
 * @returns {Promise<void>} Resolves after the init script is registered.
 * @throws {Error} Propagates Playwright init-script registration failures.
 */
async function installCspViolationCapture(page: import("@playwright/test").Page) {
  await page.addInitScript(
    ({ propertyName, testOrigin }) => {
      if (window.location.origin !== testOrigin) {
        return;
      }

      Object.defineProperty(window, propertyName, {
        configurable: true,
        value: [],
      });
      document.addEventListener("securitypolicyviolation", (event) => {
        const violations = (
          window as unknown as { [key: string]: unknown }
        )[propertyName];
        if (Array.isArray(violations)) {
          violations.push({
            directive: event.effectiveDirective,
            blockedURI: event.blockedURI,
            violatedDirective: event.violatedDirective,
          });
        }
      });
    },
    { propertyName: CSP_VIOLATIONS_PROPERTY, testOrigin: TEST_ORIGIN },
  );
}

/**
 * Verifies that successful responses expose the generated policy and headers,
 * and that required scripts, styles, manifest, worker, fonts, and icons are
 * available from same-origin static resources.
 */
test("serves the generated security headers for the root and static assets", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  const headers = response?.headers();
  expect(headers).toBeDefined();

  const csp = headers?.["content-security-policy"];
  expect(csp).toBeDefined();
  expect(csp).toContain("default-src 'none'");
  expect(csp).toContain("base-uri 'self'");
  expect(csp).toContain("form-action 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain("'sha256-");
  expect(csp).toContain("style-src 'self'");
  expect(csp).toContain("img-src 'self'");
  expect(csp).toContain("font-src 'self'");
  expect(csp).toContain("connect-src 'self'");
  expect(csp).toContain("manifest-src 'self'");
  expect(csp).toContain("worker-src 'self'");
  expect(csp).not.toContain("'unsafe-inline'");
  expect(csp).not.toContain("'unsafe-eval'");
  expect(csp).not.toContain("*");

  expect(headers?.["x-content-type-options"]).toBe("nosniff");
  expect(headers?.["referrer-policy"]).toBe("no-referrer");
  expect(headers?.["x-frame-options"]).toBe("DENY");
  expect(headers?.["strict-transport-security"]).toBe("max-age=31536000");

  const permissionsPolicy = headers?.["permissions-policy"];
  expect(permissionsPolicy).toContain("camera=()");
  expect(permissionsPolicy).toContain("microphone=()");
  expect(permissionsPolicy).toContain("geolocation=()");
  expect(permissionsPolicy).toContain("payment=()");
  expect(permissionsPolicy).toContain("usb=()");
  expect(permissionsPolicy).toContain("clipboard-read=(self)");
  expect(permissionsPolicy).toContain("clipboard-write=(self)");

  const scripts = await page.locator("script[src]").evaluateAll((elements) =>
    elements.map((element) => (element as HTMLScriptElement).src),
  );
  expect(scripts.length).toBeGreaterThan(0);
  for (const script of scripts) {
    const scriptResponse = await page.request.get(script);
    expect(scriptResponse.status()).toBe(200);
    expect(scriptResponse.headers()["x-content-type-options"]).toBe("nosniff");
  }

  const stylesheets = await page.locator("link[rel='stylesheet']").evaluateAll(
    (elements) =>
      elements.map((element) => (element as HTMLLinkElement).href),
  );
  expect(stylesheets.length).toBeGreaterThan(0);
  for (const stylesheet of stylesheets) {
    const stylesheetResponse = await page.request.get(stylesheet);
    expect(stylesheetResponse.status()).toBe(200);
  }

  const manifestResponse = await page.request.get("/manifest.webmanifest");
  expect(manifestResponse.status()).toBe(200);
  expect(manifestResponse.headers()["content-type"]).toContain("manifest");

  const serviceWorkerResponse = await page.request.get("/sw.js");
  expect(serviceWorkerResponse.status()).toBe(200);
  expect(serviceWorkerResponse.headers()["content-type"]).toContain("javascript");

  const fontAndImageResources = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => ({
        name: entry.name,
        initiatorType: (entry as PerformanceResourceTiming).initiatorType,
      }))
      .filter(
        (entry) =>
          entry.initiatorType === "font" ||
          entry.initiatorType === "img" ||
          entry.initiatorType === "css",
      ),
  );
  for (const resource of fontAndImageResources) {
    const url = new URL(resource.name);
    expect(url.origin).toBe(TEST_ORIGIN);
  }

  const icons = await page.locator("link[rel='icon'], link[rel='apple-touch-icon']").evaluateAll(
    (elements) =>
      elements.map((element) => (element as HTMLLinkElement).href),
  );
  for (const icon of icons) {
    const iconResponse = await page.request.get(icon);
    expect(iconResponse.status()).toBe(200);
  }
});

/**
 * Verifies the exported custom 404 response's status, headers, UI, and absence
 * of CSP violations during browser rendering.
 */
test("serves the custom 404 page with security headers and no CSP violations", async ({
  page,
}) => {
  await installCspViolationCapture(page);
  const response = await page.goto("/definitely-missing-page");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

  expect(response?.headers()["content-security-policy"]).toContain(
    "default-src 'none'",
  );
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["strict-transport-security"]).toBe(
    "max-age=31536000",
  );

  await expect
    .poll(() =>
      page.evaluate(
        (propertyName) =>
          (
            window as unknown as { [key: string]: unknown }
          )[propertyName],
        CSP_VIOLATIONS_PROPERTY,
      ),
    )
    .toEqual([]);
});

/**
 * Verifies normal generation activity produces no third-party request and no
 * CSP violation; this is browser-network and policy coverage, not a test of
 * deployed HTTPS or HSTS enforcement.
 */
test("normal static resources and application requests remain same-origin", async ({
  page,
}) => {
  const thirdPartyRequests: string[] = [];
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (requestUrl.origin !== TEST_ORIGIN) {
      thirdPartyRequests.push(request.url());
    }
  });

  await installCspViolationCapture(page);
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("button", { name: "Generate Password" })).toBeEnabled();

  await page.getByRole("button", { name: "Generate Password" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        (propertyName) =>
          (
            window as unknown as { [key: string]: unknown }
          )[propertyName],
        CSP_VIOLATIONS_PROPERTY,
      ),
    )
    .toEqual([]);
  expect(thirdPartyRequests).toEqual([]);
});

/**
 * Verifies generated headers survive malformed URI and unsupported-method
 * branches, which are handled by the local static server itself.
 */
test("applies generated security headers to 400 and 405 responses", async ({
  request,
}) => {
  const badRequest = await request.get("/%");
  expect(badRequest.status()).toBe(400);
  expect(badRequest.headers()["content-security-policy"]).toContain(
    "default-src 'none'",
  );
  expect(badRequest.headers()["x-content-type-options"]).toBe("nosniff");

  const methodNotAllowed = await request.post("/");
  expect(methodNotAllowed.status()).toBe(405);
  expect(methodNotAllowed.headers()["content-security-policy"]).toContain(
    "default-src 'none'",
  );
  expect(methodNotAllowed.headers()["x-content-type-options"]).toBe("nosniff");
});
