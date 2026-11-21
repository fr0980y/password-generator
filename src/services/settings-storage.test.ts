/**
 * Unit tests for the standalone settings-persistence service.
 *
 * The suite uses an isolated in-memory `MockStorage` for normal cases and
 * temporarily replaces `globalThis.window` only for the browser-storage getter
 * failure test. The mock and descriptor behavior ensure tests do not depend on
 * real localStorage or leak state between cases.
 *
 * Synthetic password-like strings appear only in privacy-regression fixtures;
 * they are assertions of serialized state, not real credentials.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_CONFIGURATION,
} from "../features/password-generator/password-generator.constants";
import type {
  PasswordConfiguration,
} from "../features/password-generator/password-generator.types";
import {
  SETTINGS_STORAGE_KEY,
  SETTINGS_STORAGE_VERSION,
  loadSettings,
  resetSettings,
  saveSettings,
  type StorageLike,
} from "./settings-storage";

/**
 * In-memory implementation of `StorageLike` for isolated persistence tests.
 *
 * Optional error fields simulate exceptions from browser read and write APIs
 * without modifying the real browser storage object.
 */
class MockStorage implements StorageLike {
  /** Values currently held by the mock, keyed exactly as browser storage uses keys. */
  readonly values = new Map<string, string>();
  /** When set, makes `getItem` throw this error. */
  getItemError: Error | null = null;
  /** When set, makes `setItem` throw this error. */
  setItemError: Error | null = null;

  /**
   * Returns a stored value or reports a configured read failure.
   *
   * @param key - Storage key to read.
   * @returns The stored string, or `null` when the key has no value.
   * @throws {Error} When `getItemError` has been configured.
   */
  getItem(key: string): string | null {
    if (this.getItemError) {
      throw this.getItemError;
    }
    return this.values.has(key) ? this.values.get(key)! : null;
  }

  /**
   * Stores a value or reports a configured write failure.
   *
   * @param key - Storage key to replace.
   * @param value - Serialized value to store.
   * @throws {Error} When `setItemError` has been configured.
   */
  setItem(key: string, value: string): void {
    if (this.setItemError) {
      throw this.setItemError;
    }
    this.values.set(key, value);
  }

  /**
   * Removes a value, matching the relevant localStorage API behavior.
   *
   * @param key - Storage key to remove.
   */
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

/**
 * Creates a complete test configuration from the approved defaults.
 *
 * @param overrides - Preference fields to replace for an individual test.
 * @returns A new configuration assembled for that test.
 */
function configuration(
  overrides: Partial<PasswordConfiguration> = {},
): PasswordConfiguration {
  return { ...DEFAULT_CONFIGURATION, ...overrides };
}

test("returns fresh defaults when saved settings are missing", () => {
  const storage = new MockStorage();
  const result = loadSettings(storage);

  assert.equal(result.persistenceAvailable, true);
  assert.deepEqual(result.configuration, DEFAULT_CONFIGURATION);
  assert.notEqual(result.configuration, DEFAULT_CONFIGURATION);
});

test("loads valid saved settings", () => {
  const storage = new MockStorage();
  const saved = configuration({
    length: 32,
    uppercase: false,
    lowercase: true,
    numbers: true,
    symbols: false,
    excludeAmbiguous: true,
    requireEachCategory: false,
  });
  storage.values.set(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      version: SETTINGS_STORAGE_VERSION,
      settings: saved,
    }),
  );

  assert.deepEqual(loadSettings(storage).configuration, saved);
});

test("saves a valid configuration to the named key in the versioned format", () => {
  const storage = new MockStorage();
  const saved = configuration({ length: 24 });

  assert.equal(saveSettings(saved, storage), true);
  assert.equal(storage.values.has(SETTINGS_STORAGE_KEY), true);
  assert.deepEqual(
    JSON.parse(storage.values.get(SETTINGS_STORAGE_KEY)!),
    {
      version: SETTINGS_STORAGE_VERSION,
      settings: saved,
    },
  );
});

test("persists only the seven supported configuration properties", () => {
  const storage = new MockStorage();
  const settingsWithExtraState = {
    ...configuration(),
    generatedPassword: "synthetic-test-password",
    passwordHistory: ["another-synthetic-password"],
    clipboardContents: "clipboard-test-value",
  } as PasswordConfiguration & Record<string, unknown>;

  assert.equal(saveSettings(settingsWithExtraState, storage), true);
  const parsed = JSON.parse(
    storage.values.get(SETTINGS_STORAGE_KEY)!,
  ) as Record<string, unknown>;

  assert.deepEqual(
    Object.keys(parsed.settings as Record<string, unknown>).sort(),
    [
    "excludeAmbiguous",
    "length",
    "lowercase",
    "numbers",
    "requireEachCategory",
    "symbols",
    "uppercase",
    ],
  );
  assert.doesNotMatch(
    storage.values.get(SETTINGS_STORAGE_KEY)!,
    /synthetic-test-password|another-synthetic-password|clipboard-test-value/,
  );
});

test("reset persists fresh default settings", () => {
  const storage = new MockStorage();
  const result = resetSettings(storage);

  assert.equal(result.persistenceAvailable, true);
  assert.deepEqual(result.configuration, DEFAULT_CONFIGURATION);
  assert.notEqual(result.configuration, DEFAULT_CONFIGURATION);
  assert.deepEqual(
    JSON.parse(storage.values.get(SETTINGS_STORAGE_KEY)!),
    {
      version: SETTINGS_STORAGE_VERSION,
      settings: DEFAULT_CONFIGURATION,
    },
  );
});

test("falls back for malformed JSON", () => {
  const storage = new MockStorage();
  storage.values.set(SETTINGS_STORAGE_KEY, "{not-json");

  const result = loadSettings(storage);
  assert.equal(result.persistenceAvailable, true);
  assert.deepEqual(result.configuration, DEFAULT_CONFIGURATION);
});

// Exercise JSON values that are valid JSON but cannot represent a settings
// wrapper. Keeping these in one table avoids repeating identical assertions.
for (const malformed of [null, [], "text", 42, true]) {
  test(`falls back for stored ${JSON.stringify(malformed)} primitives or arrays`, () => {
    const storage = new MockStorage();
    storage.values.set(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(malformed),
    );

    assert.deepEqual(
      loadSettings(storage).configuration,
      DEFAULT_CONFIGURATION,
    );
  });
}

test("falls back for a missing settings object", () => {
  const storage = new MockStorage();
  storage.values.set(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({ version: SETTINGS_STORAGE_VERSION }),
  );

  assert.deepEqual(
    loadSettings(storage).configuration,
    DEFAULT_CONFIGURATION,
  );
});

test("falls back for missing configuration properties", () => {
  const storage = new MockStorage();
  const incomplete = { ...DEFAULT_CONFIGURATION } as Partial<PasswordConfiguration>;
  delete incomplete.symbols;
  storage.values.set(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      version: SETTINGS_STORAGE_VERSION,
      settings: incomplete,
    }),
  );

  assert.deepEqual(
    loadSettings(storage).configuration,
    DEFAULT_CONFIGURATION,
  );
});

test("falls back for incorrect property types", () => {
  const storage = new MockStorage();
  storage.values.set(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      version: SETTINGS_STORAGE_VERSION,
      settings: {
        ...DEFAULT_CONFIGURATION,
        uppercase: "true",
      },
    }),
  );

  assert.deepEqual(
    loadSettings(storage).configuration,
    DEFAULT_CONFIGURATION,
  );
});

test("falls back for invalid length", () => {
  const storage = new MockStorage();
  storage.values.set(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      version: SETTINGS_STORAGE_VERSION,
      settings: {
        ...DEFAULT_CONFIGURATION,
        length: 7,
      },
    }),
  );

  assert.deepEqual(
    loadSettings(storage).configuration,
    DEFAULT_CONFIGURATION,
  );
});

test("falls back for invalid category selections", () => {
  const storage = new MockStorage();
  storage.values.set(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      version: SETTINGS_STORAGE_VERSION,
      settings: {
        ...DEFAULT_CONFIGURATION,
        uppercase: false,
        lowercase: false,
        numbers: false,
        symbols: false,
      },
    }),
  );

  assert.deepEqual(
    loadSettings(storage).configuration,
    DEFAULT_CONFIGURATION,
  );
});

test("falls back for unsupported storage versions", () => {
  const storage = new MockStorage();
  storage.values.set(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      version: SETTINGS_STORAGE_VERSION + 1,
      settings: DEFAULT_CONFIGURATION,
    }),
  );

  const result = loadSettings(storage);
  assert.equal(result.persistenceAvailable, true);
  assert.deepEqual(result.configuration, DEFAULT_CONFIGURATION);
});

test("ignores unknown properties in stored settings", () => {
  const storage = new MockStorage();
  storage.values.set(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      version: SETTINGS_STORAGE_VERSION,
      settings: {
        ...DEFAULT_CONFIGURATION,
        generatedPassword: "synthetic-test-password",
        passwordHistory: ["historical-synthetic-password"],
      },
    }),
  );

  const result = loadSettings(storage);
  assert.deepEqual(result.configuration, DEFAULT_CONFIGURATION);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      result.configuration,
      "generatedPassword",
    ),
    false,
  );
});

test("getItem throwing reports unavailable storage", () => {
  const storage = new MockStorage();
  storage.getItemError = new Error("read denied");

  const result = loadSettings(storage);
  assert.equal(result.persistenceAvailable, false);
  assert.deepEqual(result.configuration, DEFAULT_CONFIGURATION);
});

test("window.localStorage getter throwing returns unavailable defaults", () => {
  // Capture the exact descriptor so the test restores an existing global
  // property or removes the temporary property according to the prior state.
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "window",
  );
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    get() {
      throw new Error("window unavailable");
    },
  });

  try {
    const result = loadSettings();
    assert.equal(result.persistenceAvailable, false);
    assert.deepEqual(result.configuration, DEFAULT_CONFIGURATION);
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, "window", originalDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
});

test("setItem throwing reports failed saves and reset availability", () => {
  const storage = new MockStorage();
  storage.setItemError = new Error("write denied");

  assert.equal(saveSettings(configuration(), storage), false);
  const reset = resetSettings(storage);
  assert.equal(reset.persistenceAvailable, false);
  assert.deepEqual(reset.configuration, DEFAULT_CONFIGURATION);
});

test("rejects invalid configurations passed to saveSettings", () => {
  const storage = new MockStorage();
  const invalid = configuration({ length: 129 });

  assert.equal(saveSettings(invalid, storage), false);
  assert.equal(storage.values.size, 0);
});

test("returned defaults are fresh and cannot mutate DEFAULT_CONFIGURATION", () => {
  const first = loadSettings(new MockStorage()).configuration;
  first.length = 128;

  assert.equal(DEFAULT_CONFIGURATION.length, 20);
  assert.deepEqual(loadSettings(new MockStorage()).configuration, DEFAULT_CONFIGURATION);

  const reset = resetSettings(new MockStorage()).configuration;
  reset.uppercase = false;
  assert.equal(DEFAULT_CONFIGURATION.uppercase, true);
});
