/**
 * Minimal infrastructure smoke test for the production static export.
 *
 * The Chromium project and local static server are configured in
 * `playwright.config.ts`. This test checks the browser project, HTTP response,
 * and stable page title only; it intentionally avoids application workflows
 * and does not inspect or log the generated password. Run
 * `npm run test:e2e` to rebuild `out/` before this test.
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
