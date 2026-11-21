/**
 * Browser-independent persistence service for password-generator preferences.
 *
 * This module belongs to the application's browser services layer and is
 * intentionally independent of React and UI components. It reads and writes
 * only the `PasswordConfiguration` fields supported by the password generator,
 * using a versioned JSON wrapper in `localStorage` or any compatible
 * `StorageLike` implementation.
 *
 * Loading is defensive: malformed JSON, unsupported schemas, missing fields,
 * incorrect types, and invalid configurations fall back to
 * `DEFAULT_CONFIGURATION`. Storage access and I/O failures are reported rather
 * than thrown. Generated passwords and unrelated application state are never
 * accepted by this module or included in the stored payload.
 *
 * Typical browser usage:
 * ```ts
 * const loaded = loadSettings();
 * const configuration = loaded.configuration;
 *
 * if (!saveSettings(configuration)) {
 *   // Persistence failed; keep the configuration in memory for this session.
 * }
 * ```
 *
 * The module depends on `PasswordConfiguration`,
 * `DEFAULT_CONFIGURATION`, and `validatePasswordConfiguration` from the
 * password-generator feature. It does not implement password validation or
 * generation rules itself.
 *
 * @see PasswordConfiguration
 * @see SettingsLoadResult
 */
import {
  DEFAULT_CONFIGURATION,
} from "../features/password-generator/password-generator.constants";
import type {
  PasswordConfiguration,
} from "../features/password-generator/password-generator.types";
import {
  validatePasswordConfiguration,
} from "../features/password-generator/password-generator.validation";

/** The single localStorage key used for persisted password-generator preferences. */
export const SETTINGS_STORAGE_KEY = "password-generator.settings";

/** Schema version for the current versioned settings wrapper. */
export const SETTINGS_STORAGE_VERSION = 1;

/**
 * Minimal localStorage-compatible interface used for reads and writes.
 *
 * This small structural interface keeps the service independent from browser
 * globals and allows callers and tests to provide isolated storage objects.
 */
export interface StorageLike {
  /** Returns the value at `key`, or `null` when no value is stored. */
  getItem(key: string): string | null;
  /** Stores `value` at `key`, replacing any existing value. */
  setItem(key: string, value: string): void;
  /** Removes the value at `key` when supported by the implementation. */
  removeItem(key: string): void;
}

/**
 * Result of loading or resetting preferences.
 *
 * `configuration` is always a usable configuration, while
 * `persistenceAvailable` distinguishes missing or invalid saved data from
 * browser-storage access failures.
 */
export interface SettingsLoadResult {
  /** The loaded, reset, or safe default password configuration. */
  configuration: PasswordConfiguration;
  /** Whether browser storage could be accessed for the requested operation. */
  persistenceAvailable: boolean;
}

/**
 * Internal JSON wrapper stored for the current settings schema.
 *
 * Keeping the wrapper separate from `PasswordConfiguration` allows future
 * schema versions to be identified before configuration data is restored.
 */
interface VersionedSettings {
  /** Schema version used to identify compatible settings data. */
  version: number;
  /** Password-generator preferences stored at the current schema version. */
  settings: PasswordConfiguration;
}

/**
 * Creates an independent object copy of the approved default configuration.
 *
 * Spreading the default prevents callers from mutating the exported constant
 * through a result returned by this module.
 *
 * @returns A fresh copy of `DEFAULT_CONFIGURATION`.
 */
function copyDefaults(): PasswordConfiguration {
  return { ...DEFAULT_CONFIGURATION };
}

/**
 * Resolves the storage implementation used by an operation.
 *
 * An explicitly supplied storage object takes precedence. Without one, the
 * browser's `window.localStorage` is inspected defensively because both
 * accessing `window.localStorage` and obtaining that object can throw in
 * restrictive or unavailable browser environments.
 *
 * @param storage - Optional test or application-provided storage implementation.
 * @returns A usable storage implementation, or `null` if browser storage cannot
 *   be safely accessed.
 */
function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) {
    return storage;
  }

  try {
    if (typeof window === "undefined") {
      return null;
    }

    const browserStorage = window.localStorage;
    if (
      typeof browserStorage.getItem !== "function" ||
      typeof browserStorage.setItem !== "function" ||
      typeof browserStorage.removeItem !== "function"
    ) {
      return null;
    }

    return browserStorage;
  } catch {
    return null;
  }
}

/**
 * Converts an untrusted JSON value into a supported password configuration.
 *
 * This function checks object shape and property presence before constructing
 * a new object containing only the seven approved fields. Unknown properties
 * are intentionally discarded, and the resulting value is passed to the shared
 * password-configuration validator before it is returned to callers.
 *
 * @param settings - Parsed value expected to contain persisted settings.
 * @returns A whitelisted configuration, or `null` when the shape or types are
 *   insufficient for restoration.
 */
function constructSettings(settings: unknown): PasswordConfiguration | null {
  if (
    typeof settings !== "object" ||
    settings === null ||
    Array.isArray(settings)
  ) {
    return null;
  }

  const candidate = settings as Record<string, unknown>;
  const supportedKeys = [
    "length",
    "uppercase",
    "lowercase",
    "numbers",
    "symbols",
    "excludeAmbiguous",
    "requireEachCategory",
  ] as const;

  // `hasOwnProperty` avoids accepting inherited properties in an object that
  // has been constructed by JSON parsing or supplied by another implementation.
  if (supportedKeys.some((key) => !Object.prototype.hasOwnProperty.call(candidate, key))) {
    return null;
  }

  if (
    typeof candidate.length !== "number" ||
    typeof candidate.uppercase !== "boolean" ||
    typeof candidate.lowercase !== "boolean" ||
    typeof candidate.numbers !== "boolean" ||
    typeof candidate.symbols !== "boolean" ||
    typeof candidate.excludeAmbiguous !== "boolean" ||
    typeof candidate.requireEachCategory !== "boolean"
  ) {
    return null;
  }

  // Construct a fresh object so values outside the approved configuration
  // allow-list cannot reach application state.
  return {
    length: candidate.length,
    uppercase: candidate.uppercase,
    lowercase: candidate.lowercase,
    numbers: candidate.numbers,
    symbols: candidate.symbols,
    excludeAmbiguous: candidate.excludeAmbiguous,
    requireEachCategory: candidate.requireEachCategory,
  };
}

/**
 * Builds the versioned payload written to storage.
 *
 * @param configuration - Valid configuration whose supported fields should be
 *   serialized.
 * @returns A newly constructed wrapper containing only settings and a schema
 *   version. Passwords and unrelated state are not represented in this type.
 */
function constructPersistedSettings(
  configuration: PasswordConfiguration,
): VersionedSettings {
  return {
    version: SETTINGS_STORAGE_VERSION,
    settings: {
      length: configuration.length,
      uppercase: configuration.uppercase,
      lowercase: configuration.lowercase,
      numbers: configuration.numbers,
      symbols: configuration.symbols,
      excludeAmbiguous: configuration.excludeAmbiguous,
      requireEachCategory: configuration.requireEachCategory,
    },
  };
}

/**
 * Loads and validates persisted password-generator preferences.
 *
 * When storage is missing or accessible, no saved value is present, or saved
 * data is invalid, a fresh copy of `DEFAULT_CONFIGURATION` is returned.
 * Invalid data does not mark storage unavailable; I/O or storage access
 * failures do. Malformed and unsupported values are not automatically
 * overwritten by this function.
 *
 * @param storage - Optional storage implementation; omitted in browser callers
 *   to use `window.localStorage`.
 * @returns The loaded or safe default configuration and storage availability.
 *
 * @example
 * ```ts
 * const { configuration, persistenceAvailable } = loadSettings();
 * ```
 */
export function loadSettings(storage?: StorageLike): SettingsLoadResult {
  const resolvedStorage = resolveStorage(storage);
  if (!resolvedStorage) {
    return {
      configuration: copyDefaults(),
      persistenceAvailable: false,
    };
  }

  let serialized: string | null;
  try {
    serialized = resolvedStorage.getItem(SETTINGS_STORAGE_KEY);
  } catch {
    return {
      configuration: copyDefaults(),
      persistenceAvailable: false,
    };
  }

  if (serialized === null) {
    return {
      configuration: copyDefaults(),
      persistenceAvailable: true,
    };
  }

  // Parsing happens inside a try/catch because malformed input must be a safe
  // fallback rather than an exception exposed to application startup.
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return {
      configuration: copyDefaults(),
      persistenceAvailable: true,
    };
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    return {
      configuration: copyDefaults(),
      persistenceAvailable: true,
    };
  }

  const wrapper = parsed as Record<string, unknown>;
  if (
    wrapper.version !== SETTINGS_STORAGE_VERSION ||
    !Object.prototype.hasOwnProperty.call(wrapper, "settings")
  ) {
    return {
      configuration: copyDefaults(),
      persistenceAvailable: true,
    };
  }

  const configuration = constructSettings(wrapper.settings);
  if (!configuration) {
    return {
      configuration: copyDefaults(),
      persistenceAvailable: true,
    };
  }

  // Stored values are revalidated by the shared rules even though their types
  // have already been checked; this prevents unsafe combinations such as a
  // length shorter than the enabled required categories.
  const validation = validatePasswordConfiguration(configuration);
  if (!validation.isValid) {
    return {
      configuration: copyDefaults(),
      persistenceAvailable: true,
    };
  }

  return {
    configuration,
    persistenceAvailable: true,
  };
}

/**
 * Validates and persists a password-generator configuration.
 *
 * The configuration is checked before storage is resolved or serialization
 * occurs. On success, the payload contains only the seven supported preference
 * fields and the current schema version. Storage access and write exceptions
 * are converted to `false` so callers can continue with in-memory settings.
 *
 * @param configuration - Configuration proposed for local persistence.
 * @param storage - Optional storage implementation; omitted in browser callers
 *   to use `window.localStorage`.
 * @returns `true` only if validation and the storage write both succeed.
 *
 * @example
 * ```ts
 * const saved = saveSettings({
 *   ...DEFAULT_CONFIGURATION,
 *   length: 24,
 * });
 * ```
 */
export function saveSettings(
  configuration: PasswordConfiguration,
  storage?: StorageLike,
): boolean {
  const validation = validatePasswordConfiguration(configuration);
  if (!validation.isValid) {
    return false;
  }

  const resolvedStorage = resolveStorage(storage);
  if (!resolvedStorage) {
    return false;
  }

  try {
    const serialized = JSON.stringify(
      constructPersistedSettings(configuration),
    );
    resolvedStorage.setItem(SETTINGS_STORAGE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

/**
 * Restores the approved defaults and persists them using the current format.
 *
 * A fresh copy of `DEFAULT_CONFIGURATION` is always returned. The returned
 * `persistenceAvailable` value reports whether the reset write succeeded, rather
 * than whether existing invalid data was removed. If persistence fails, callers
 * should retain the returned configuration in memory for the current session.
 *
 * @param storage - Optional storage implementation; omitted in browser callers
 *   to use `window.localStorage`.
 * @returns Fresh defaults and the actual persistence result.
 */
export function resetSettings(storage?: StorageLike): SettingsLoadResult {
  const configuration = copyDefaults();
  const persistenceAvailable = saveSettings(configuration, storage);

  return {
    configuration,
    persistenceAvailable,
  };
}
