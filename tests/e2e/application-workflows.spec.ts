/**
 * Chromium workflow tests for the password-generator client application.
 *
 * This suite exercises the production static export configured by
 * `playwright.config.ts`, covering initial generation, configuration,
 * clipboard copying, and preference persistence. The application behavior
 * itself is coordinated by `usePasswordGenerator`; these tests interact through
 * accessible page controls rather than adding production test hooks.
 *
 * Helpers read the visible configuration and validate generated output against
 * it. `openApplication` installs test-only Web Crypto instrumentation before
 * application scripts run. The instrumentation counts calls while delegating
 * to the browser's native method; it never mocks randomness or stores password
 * values. Run `npm run test:e2e` to build the export and execute this suite.
 */
import { expect, test, type Page } from "@playwright/test";
import type { PasswordConfiguration } from "../../src/features/password-generator/password-generator.types";

/** Default preferences expected in a fresh Playwright browser context. */
const DEFAULT_CONFIGURATION: PasswordConfiguration = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: false,
  requireEachCategory: true,
};

/** The application's success feedback is configured to clear after two seconds. */
const COPY_CONFIRMATION_DURATION_MS = 2_000;
/** Test-only sessionStorage key; its value is a numeric Web Crypto call count. */
const WEB_CRYPTO_CALL_COUNT_KEY = "__playwright_web_crypto_get_random_values_calls";
/** The static-export server origin; instrumentation is limited to this page. */
const TEST_ORIGIN = "http://127.0.0.1:4173";

/**
 * Character pools used by the test-side output validator.
 *
 * `satisfies` checks that every configurable category is represented while
 * preserving the literal string types for the individual pools.
 */
const CHARACTER_SETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/",
} satisfies Record<
  "uppercase" | "lowercase" | "numbers" | "symbols",
  string
>;

/**
 * Installs test-only Web Crypto instrumentation and opens the exported app.
 *
 * The init script runs before application scripts for the configured origin. It
 * records the existing numeric call count as a window property, then wraps
 * `crypto.getRandomValues()` with a Proxy that forwards the native receiver and
 * arguments unchanged. Calls are counted in sessionStorage so the count
 * remains available after reloads. The helper waits for the initial page
 * controls and password display before returning the pre-initialization count.
 *
 * @param page - Isolated Playwright page on which to open the application.
 * @returns The Web Crypto call count captured before application initialization.
 * @throws {Error} If the init script did not record the pre-initialization count.
 *   Navigation and Playwright assertion errors also propagate to the test.
 */
async function openApplication(page: Page): Promise<number> {
  await page.addInitScript(
    ({ counterKey, testOrigin }) => {
      if (window.location.origin !== testOrigin) {
        return;
      }

      // Register the CSP violation listener before any application script can
      // execute, while keeping the records in page memory for later assertions.
      Object.defineProperty(window, "__playwrightCspViolations", {
        configurable: true,
        value: [],
      });
      document.addEventListener("securitypolicyviolation", (event) => {
        const violations = (
          window as Window & { __playwrightCspViolations?: unknown[] }
        ).__playwrightCspViolations;
        violations?.push({
          directive: event.effectiveDirective,
          blockedURI: event.blockedURI,
          violatedDirective: event.violatedDirective,
        });
      });

      // Capture the prior count before app scripts can generate the initial password.
      const currentCallCount = window.sessionStorage.getItem(counterKey);
      const baselineCallCount = Number(currentCallCount ?? "0");
      Object.defineProperty(window, "__playwrightWebCryptoCallBaseline", {
        configurable: true,
        value: baselineCallCount,
      });

      if (currentCallCount === null) {
        window.sessionStorage.setItem(counterKey, "0");
      }

      const nativeGetRandomValues = window.crypto.getRandomValues;
      // Observe calls while forwarding the original receiver and arguments to the native method.
      const observedGetRandomValues = new Proxy(nativeGetRandomValues, {
        apply(target, thisArgument, argumentsList) {
          // sessionStorage keeps only this numeric counter across document reloads.
          const calls = Number(window.sessionStorage.getItem(counterKey) ?? "0");
          window.sessionStorage.setItem(counterKey, String(calls + 1));

          return Reflect.apply(target, thisArgument, argumentsList);
        },
      });

      Object.defineProperty(window.crypto, "getRandomValues", {
        configurable: true,
        value: observedGetRandomValues,
      });
    },
    { counterKey: WEB_CRYPTO_CALL_COUNT_KEY, testOrigin: TEST_ORIGIN },
  );

  const response = await page.goto("/");
  expect(response?.status() === 200).toBe(true);
  await expect(page.getByRole("button", { name: "Generate Password" })).toBeEnabled();
  await expect(
    page.getByRole("group", { name: "Generated password" }).locator("code"),
  ).toBeVisible();

  return page.evaluate(() => {
    const baseline = (
      window as Window & { __playwrightWebCryptoCallBaseline?: number }
    ).__playwrightWebCryptoCallBaseline;
    if (typeof baseline !== "number") {
      throw new Error("The pre-initialization Web Crypto baseline was not recorded.");
    }

    return baseline;
  });
}

/**
 * Reads the test-only count of calls forwarded to native Web Crypto.
 *
 * @param page - Page whose origin owns the counter in sessionStorage.
 * @returns The number of `crypto.getRandomValues()` calls observed.
 */
async function readWebCryptoCallCount(page: Page): Promise<number> {
  return page.evaluate(
    (counterKey) => Number(window.sessionStorage.getItem(counterKey) ?? "0"),
    WEB_CRYPTO_CALL_COUNT_KEY,
  );
}

/**
 * Reads CSP violations captured by the init script installed before application
 * scripts execute. The list remains in page memory only and is used for test
 * assertions without logging generated password values.
 *
 * @param page - Isolated Chromium page whose init script recorded violations.
 * @returns CSP violation records captured in the page, or an empty array.
 */
async function readCspViolations(page: Page): Promise<unknown[]> {
  return page.evaluate(
    () =>
      (
        window as Window & { __playwrightCspViolations?: unknown[] }
      ).__playwrightCspViolations ?? [],
  );
}

/**
 * Reads the currently visible password for in-memory assertions.
 *
 * Password contents are returned only to the calling test and are never
 * written to logs or assertion messages.
 *
 * @param page - Page displaying the generated password.
 * @returns The visible non-empty password string.
 * @throws {Error} If the password display is empty after becoming visible.
 */
async function readDisplayedPassword(page: Page): Promise<string> {
  const passwordValue = page
    .getByRole("group", { name: "Generated password" })
    .locator("code");
  await expect(passwordValue).toBeVisible();

  const password = await passwordValue.textContent();
  if (password === null || password.length === 0) {
    throw new Error("The generated password is not displayed.");
  }

  return password;
}

/**
 * Reads the active preferences from the accessible configuration controls.
 *
 * @param page - Page containing the password configuration form.
 * @returns A `PasswordConfiguration` reflecting the current control values.
 */
async function readConfiguration(page: Page): Promise<PasswordConfiguration> {
  return {
    length: Number(
      await page.getByRole("slider", { name: "Password Length" }).inputValue(),
    ),
    uppercase: await page
      .getByRole("checkbox", { name: "Uppercase letters" })
      .isChecked(),
    lowercase: await page
      .getByRole("checkbox", { name: "Lowercase letters" })
      .isChecked(),
    numbers: await page.getByRole("checkbox", { name: "Numbers" }).isChecked(),
    symbols: await page.getByRole("checkbox", { name: "Symbols" }).isChecked(),
    excludeAmbiguous: await page
      .getByRole("checkbox", { name: "Exclude Ambiguous Characters" })
      .isChecked(),
    requireEachCategory: await page
      .getByRole("checkbox", { name: "Require Every Selected Character Type" })
      .isChecked(),
  };
}

/**
 * Checks that a generated value conforms to the selected preferences.
 *
 * This test-side validator checks exact length, membership in enabled
 * character pools, required representation of each enabled category, and
 * ambiguous-character exclusion when selected.
 *
 * @param password - Generated value held in memory by the test.
 * @param configuration - Preferences against which to validate the value.
 * @returns `true` when every configured constraint is satisfied.
 */
function passwordSatisfiesConfiguration(
  password: string,
  configuration: PasswordConfiguration,
): boolean {
  const enabledCategories = [
    { enabled: configuration.uppercase, characters: CHARACTER_SETS.uppercase },
    { enabled: configuration.lowercase, characters: CHARACTER_SETS.lowercase },
    { enabled: configuration.numbers, characters: CHARACTER_SETS.numbers },
    { enabled: configuration.symbols, characters: CHARACTER_SETS.symbols },
  ].filter((category) => category.enabled);
  const passwordCharacters = Array.from(password);

  return (
    enabledCategories.length > 0 &&
    password.length === configuration.length &&
    passwordCharacters.every((character) =>
      enabledCategories.some((category) =>
        category.characters.includes(character),
      ),
    ) &&
    (!configuration.requireEachCategory ||
      enabledCategories.every((category) =>
        passwordCharacters.some((character) =>
          category.characters.includes(character),
        ),
      )) &&
    (!configuration.excludeAmbiguous || !/[IOl01]/.test(password))
  );
}

/**
 * Confirms localStorage contains only the expected versioned preferences.
 *
 * The helper verifies the storage key, wrapper shape, and exact preference
 * values. Malformed JSON, extra keys, or a mismatched payload return `false`;
 * password values are not included in the persisted data being checked.
 *
 * @param page - Page whose localStorage should be inspected.
 * @param expectedConfiguration - Preferences expected in the stored payload.
 * @returns Whether storage contains only the matching preference payload.
 */
async function localStorageContainsOnlyPreferences(
  page: Page,
  expectedConfiguration: PasswordConfiguration,
): Promise<boolean> {
  return page.evaluate((expected) => {
    if (
      localStorage.length !== 1 ||
      localStorage.key(0) !== "password-generator.settings"
    ) {
      return false;
    }

    const serialized = localStorage.getItem("password-generator.settings");
    if (serialized === null) {
      return false;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      return false;
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return false;
    }

    const payload = parsed as Record<string, unknown>;
    if (
      Object.keys(payload).sort().join("|") !== "settings|version" ||
      payload.version !== 1 ||
      typeof payload.settings !== "object" ||
      payload.settings === null ||
      Array.isArray(payload.settings)
    ) {
      return false;
    }

    const storedSettings = payload.settings as Record<string, unknown>;
    const expectedEntries = Object.entries(expected).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    const storedEntries = Object.entries(storedSettings).sort(([left], [right]) =>
      left.localeCompare(right),
    );

    return (
      storedEntries.length === expectedEntries.length &&
      storedEntries.every(
        ([key, value], index) =>
          key === expectedEntries[index][0] &&
          value === expectedEntries[index][1],
      )
    );
  }, expectedConfiguration);
}

/**
 * Verifies first-load defaults, initial generation, and actual browser Web Crypto use.
 *
 * @param fixtures - Playwright's isolated page and selected browser name.
 */
test("initializes with a valid password using browser Web Crypto", async ({
  page,
  browserName,
}) => {
  const baselineWebCryptoCallCount = await openApplication(page);
  expect(browserName === "chromium").toBe(true);

  const secureWebCryptoAvailable = await page.evaluate(
    () =>
      window.isSecureContext &&
      typeof window.crypto.getRandomValues === "function",
  );
  expect(secureWebCryptoAvailable).toBe(true);
  expect(await readConfiguration(page)).toEqual(DEFAULT_CONFIGURATION);
  expect(
    (await readWebCryptoCallCount(page)) > baselineWebCryptoCallCount,
  ).toBe(true);

  const initialPassword = await readDisplayedPassword(page);
  expect(
    passwordSatisfiesConfiguration(initialPassword, DEFAULT_CONFIGURATION),
  ).toBe(true);
});

/**
 * Verifies configuration edits, invalid-state prevention, and later generation.
 *
 * @param page - Isolated Chromium page for this workflow.
 */
test("configuration changes validate without regenerating and govern the next password", async ({
  page,
}) => {
  await openApplication(page);

  const originalPassword = await readDisplayedPassword(page);
  const lengthSlider = page.getByRole("slider", { name: "Password Length" });
  for (let step = 0; step < 4; step += 1) {
    await lengthSlider.press("ArrowRight");
  }
  await page
    .getByRole("checkbox", { name: "Uppercase letters" })
    .uncheck();

  const updatedConfiguration = await readConfiguration(page);
  expect(updatedConfiguration.length).toBe(24);
  expect(updatedConfiguration.uppercase).toBe(false);
  expect((await readDisplayedPassword(page)) === originalPassword).toBe(true);

  const generateButton = page.getByRole("button", {
    name: "Generate Password",
  });
  await expect(generateButton).toBeEnabled();
  const callsBeforeGeneration = await readWebCryptoCallCount(page);
  await generateButton.click();

  await expect
    .poll(async () => (await readWebCryptoCallCount(page)) > callsBeforeGeneration)
    .toBe(true);
  const configuredPassword = await readDisplayedPassword(page);
  expect(
    passwordSatisfiesConfiguration(configuredPassword, updatedConfiguration),
  ).toBe(true);

  const categoryNames = [
    "Uppercase letters",
    "Lowercase letters",
    "Numbers",
    "Symbols",
  ];
  for (const categoryName of categoryNames) {
    await page.getByRole("checkbox", { name: categoryName }).uncheck();
  }

  await expect(generateButton).toBeDisabled();
  await expect(
    page.getByText(
      "Configuration error: Select at least one character category.",
      { exact: true },
    ),
  ).toBeVisible();

  for (const categoryName of ["Lowercase letters", "Numbers", "Symbols"]) {
    await page.getByRole("checkbox", { name: categoryName }).check();
  }

  await expect(generateButton).toBeEnabled();
  await expect(
    page.getByText(
      "Configuration error: Select at least one character category.",
      { exact: true },
    ),
  ).toHaveCount(0);

  const restoredConfiguration = await readConfiguration(page);
  const callsBeforeRestoredGeneration = await readWebCryptoCallCount(page);
  await generateButton.click();
  await expect
    .poll(
      async () =>
        (await readWebCryptoCallCount(page)) > callsBeforeRestoredGeneration,
    )
    .toBe(true);
  expect(
    passwordSatisfiesConfiguration(
      await readDisplayedPassword(page),
      restoredConfiguration,
    ),
  ).toBe(true);
});

/**
 * Verifies the real Clipboard API and the two-second success-feedback lifecycle.
 *
 * Clipboard permissions are granted to Chromium for this origin. Playwright's
 * clock advances the application's timer without adding a real-time sleep.
 *
 * @param page - Isolated Chromium page for this workflow.
 */
test("copies through the browser Clipboard API and clears confirmation on time", async ({
  page,
}) => {
  await openApplication(page);
  await page.context().grantPermissions(
    ["clipboard-read", "clipboard-write"],
    { origin: TEST_ORIGIN },
  );

  const passwordValue = page
    .getByRole("group", { name: "Generated password" })
    .locator("code");
  const copyButton = page.getByRole("button", { name: "Copy password" });

  await page.clock.install();
  await copyButton.click();
  await expect(copyButton).toHaveText("Copied!");

  // Read only after success feedback appears, ensuring the UI follows the completed clipboard write.
  const clipboardMatchesDisplayedPassword = await passwordValue.evaluate(
    async (element) => {
      const displayedPassword = element.textContent;
      return (
        displayedPassword !== null &&
        displayedPassword.length > 0 &&
        (await navigator.clipboard.readText()) === displayedPassword
      );
    },
  );
  expect(clipboardMatchesDisplayedPassword).toBe(true);
  expect(await readCspViolations(page)).toEqual([]);

  // Advance the installed test clock instead of waiting two wall-clock seconds.
  await page.clock.fastForward(COPY_CONFIRMATION_DURATION_MS);
  await expect(copyButton).toHaveText("Copy");
});

/**
 * Verifies preferences survive reload and generation runs again.
 *
 * The Web Crypto call count confirms generation runs during reload;
 * localStorage is separately checked to contain preferences only.
 *
 * @param page - Isolated Chromium page for this workflow.
 */
test("restores preferences after reload without restoring a password", async ({
  page,
}) => {
  await openApplication(page);

  const lengthSlider = page.getByRole("slider", { name: "Password Length" });
  for (let step = 0; step < 6; step += 1) {
    await lengthSlider.press("ArrowRight");
  }
  await page.getByRole("checkbox", { name: "Symbols" }).uncheck();
  await page
    .getByRole("checkbox", { name: "Exclude Ambiguous Characters" })
    .check();

  const changedConfiguration = await readConfiguration(page);
  expect(changedConfiguration.length).toBe(26);
  expect(changedConfiguration.symbols).toBe(false);
  expect(changedConfiguration.excludeAmbiguous).toBe(true);
  const displayedPassword = await readDisplayedPassword(page);
  expect(displayedPassword.length).toBe(DEFAULT_CONFIGURATION.length);
  expect(
    await localStorageContainsOnlyPreferences(page, changedConfiguration),
  ).toBe(true);

  const callsBeforeReload = await readWebCryptoCallCount(page);
  await page.reload();
  await expect(lengthSlider).toHaveValue("26");
  await expect(page.getByRole("checkbox", { name: "Symbols" })).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Exclude Ambiguous Characters" }),
  ).toBeChecked();
  await expect
    .poll(async () => (await readWebCryptoCallCount(page)) > callsBeforeReload)
    .toBe(true);

  const restoredConfiguration = await readConfiguration(page);
  const reloadedPassword = await readDisplayedPassword(page);
  expect(restoredConfiguration.length).toBe(26);
  expect(
    passwordSatisfiesConfiguration(reloadedPassword, restoredConfiguration),
  ).toBe(true);
  expect(
    await localStorageContainsOnlyPreferences(page, restoredConfiguration),
  ).toBe(true);
});
