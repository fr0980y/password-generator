"use client";

/**
 * Application-layer state coordinator for the password-generator feature.
 *
 * This client hook connects the presentation layer to the existing password
 * generation, configuration validation, and settings-storage modules. It
 * initializes preferences before generating a fresh in-memory password,
 * validates and persists configuration changes, and exposes explicit actions
 * for restoring defaults and generating a password.
 *
 * The hook does not own presentation or implement the Clipboard API itself.
 * Only configuration is passed to the settings service; the displayed password
 * remains in React state and is never persisted. Clipboard writes are delegated
 * to the dedicated clipboard service.
 *
 * Example:
 * ```tsx
 * import { usePasswordGenerator } from "@/hooks/use-password-generator";
 *
 * const {
 *   configuration,
 *   configurationValidation,
 *   password,
 *   isInitialized,
 *   isCopied,
 *   copyError,
 *   settingsWarning,
 *   onConfigurationChange,
 *   onRestoreDefaults,
 *   onGenerate,
 *   onCopy,
 * } = usePasswordGenerator();
 * ```
 *
 * Browser-dependent settings access and password generation run after mount,
 * not during server rendering or render-time state initialization.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_CONFIGURATION,
  STANDARD_MAX_PASSWORD_LENGTH,
} from "../features/password-generator/password-generator.constants";
import { generatePassword } from "../features/password-generator/password-generator";
import type {
  PasswordConfiguration,
  ValidationResult,
  WebCryptoCapability,
} from "../features/password-generator/password-generator.types";
import {
  validatePasswordConfiguration,
} from "../features/password-generator/password-generator.validation";
import {
  loadSettings,
  resetSettings,
  saveSettings,
} from "../services/settings-storage";
import { copyToClipboard } from "../services/clipboard";

/** Safe, user-facing message used when secure password generation fails. */
const GENERATION_ERROR_MESSAGE =
  "Password generation failed. Please try again.";

/** Safe, user-facing fallback shown when the clipboard write fails. */
const COPY_ERROR_MESSAGE =
  "Unable to copy automatically. Select the password and copy it manually.";

/** Duration of the successful clipboard confirmation. */
const COPY_CONFIRMATION_DURATION_MS = 2_000;

/** Existing settings-storage warning shown when preferences cannot be saved. */
const SETTINGS_WARNING_MESSAGE =
  "Settings won't be saved on this device. Your current settings will remain active until you close or reload the application.";

/** Checks Web Crypto access without requesting or consuming a random value. */
function detectWebCryptoCapability(): WebCryptoCapability {
  try {
    const cryptoApi = globalThis.crypto;
    if (
      typeof cryptoApi === "undefined" ||
      typeof cryptoApi.getRandomValues !== "function"
    ) {
      return "unavailable";
    }

    return "available";
  } catch {
    return "unavailable";
  }
}

/**
 * State and callbacks exposed by {@link usePasswordGenerator}.
 */
export interface UsePasswordGeneratorResult {
  /** Whether the browser exposes the Web Crypto random-number API. */
  webCryptoCapability: WebCryptoCapability;
  /** Current complete configuration, including values that may be invalid. */
  configuration: PasswordConfiguration;
  /** Validation result for the current configuration. */
  configurationValidation: ValidationResult;
  /** Currently displayed password, or `null` until generation succeeds. */
  password: string | null;
  /** Whether settings loading and the initial generation attempt have finished. */
  isInitialized: boolean;
  /** Safe user-facing generation error, or `null` when there is no error. */
  generationError: string | null;
  /** Whether the latest copy attempt succeeded for the current displayed password. */
  isCopied: boolean;
  /** Safe manual-copy guidance after a failed clipboard write, or `null`. */
  copyError: string | null;
  /** Preference-persistence warning, or `null` when saving is available. */
  settingsWarning: string | null;
  /**
   * Applies a complete configuration from controlled presentation components.
   * Invalid configurations remain active in memory but are not persisted.
   *
   * @param configuration Complete configuration supplied by the caller.
   */
  onConfigurationChange: (configuration: PasswordConfiguration) => void;
  /** Replaces the configuration with approved defaults without regenerating or changing the password. */
  onRestoreDefaults: () => void;
  /** Generates a password for the current configuration on explicit request. */
  onGenerate: () => void;
  /** Rechecks Web Crypto availability and retries initial generation when available. */
  onRetryWebCrypto: () => void;
  /**
   * Copies the currently displayed password after initialization only when one exists.
   * The returned promise resolves after the clipboard attempt is handled; calls made
   * before initialization or without a password are resolved no-ops.
   */
  onCopy: () => Promise<void>;
}

/**
 * Coordinates configuration, password generation, and preference persistence.
 *
 * The hook begins with a fresh in-memory copy of the default configuration.
 * After the client effect runs, it loads validated settings (or the storage
 * service's default fallback), then attempts to generate a new password. It
 * never restores a previously generated password.
 *
 * Configuration changes are validated before persistence and do not trigger
 * generation. Restore Defaults also preserves the displayed password. An
 * explicit generation replaces that password only after the generator returns
 * successfully; failures produce a generic message that does not expose
 * password data or generator internals.
 *
 * Copying is also explicit: `onCopy` delegates the current displayed password
 * to the clipboard service only after initialization and only while a password
 * exists. This includes a password generated by a later explicit retry. Copy
 * failures leave the password unchanged and expose generic manual-copy guidance.
 *
 * @returns Current application state and the callbacks needed by the page.
 */
export function usePasswordGenerator(): UsePasswordGeneratorResult {
  // Keep the render-time initial value deterministic and safe for server rendering.
  const [webCryptoCapability, setWebCryptoCapability] =
    useState<WebCryptoCapability>("unknown");
  const [configuration, setConfiguration] = useState<PasswordConfiguration>(
    () => ({ ...DEFAULT_CONFIGURATION }),
  );
  const [password, setPassword] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [settingsWarning, setSettingsWarning] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  // Mount state makes clipboard actions callable only from a live client instance.
  const isMountedRef = useRef(false);
  // Copy attempt IDs prevent older asynchronous writes and unmount cleanup
  // from replacing feedback owned by a newer attempt or a new password.
  const copyAttemptIdRef = useRef(0);
  const copyConfirmationTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCopyConfirmationTimer = useCallback(() => {
    if (copyConfirmationTimeoutRef.current !== null) {
      clearTimeout(copyConfirmationTimeoutRef.current);
      copyConfirmationTimeoutRef.current = null;
    }
  }, []);

  /**
   * Loads saved settings and attempts initial generation after client mount.
   *
   * The cleanup invalidates this setup's queued task. In development Strict
   * Mode, the replayed setup schedules a new task; an actual unmount leaves
   * no active task to perform storage access or update state. It also invalidates
   * pending clipboard completions before they can update hook state.
   */
  useEffect(() => {
    // Each setup owns its queued task. Cleanup invalidates that task, while a
    // Strict Mode effect replay runs setup again and schedules a fresh task.
    let effectIsActive = true;
    isMountedRef.current = true;

    // Defer state updates to a microtask so this effect does not synchronously
    // update React state; this is not a timer or an arbitrary initialization delay.
    void Promise.resolve().then(() => {
      if (!effectIsActive) {
        return;
      }

      const loadedSettings = loadSettings();
      setConfiguration(loadedSettings.configuration);

      if (!loadedSettings.persistenceAvailable) {
        setSettingsWarning(SETTINGS_WARNING_MESSAGE);
      }

      const capability = detectWebCryptoCapability();
      setWebCryptoCapability(capability);
      if (capability === "unavailable") {
        setIsInitialized(true);
        return;
      }

      try {
        // The generator returns a complete password or throws; only success
        // updates state, so a failed attempt cannot replace the current value.
        setPassword(generatePassword(loadedSettings.configuration));
      } catch {
        // Do not surface low-level errors or include sensitive values in UI text.
        setWebCryptoCapability(detectWebCryptoCapability());
        setGenerationError(GENERATION_ERROR_MESSAGE);
      } finally {
        // Initialization is complete once the initial generation attempt ends.
        setIsInitialized(true);
      }
    });

    return () => {
      // Prevent a queued task from touching storage or state after unmount.
      effectIsActive = false;
      isMountedRef.current = false;
      copyAttemptIdRef.current += 1;
      clearCopyConfirmationTimer();
    };
  }, [clearCopyConfirmationTimer]);

  /**
   * Updates in-memory settings and persists only valid configurations.
   *
   * The displayed password is intentionally left unchanged. Successful saves
   * clear a previous storage warning; failed saves surface the established
   * warning while retaining the configuration in memory.
   */
  const onConfigurationChange = useCallback(
    (nextConfiguration: PasswordConfiguration) => {
      const nextState = { ...nextConfiguration };
      if (
        configuration.enableExtendedPasswordLengths &&
        !nextState.enableExtendedPasswordLengths &&
        nextState.length > STANDARD_MAX_PASSWORD_LENGTH
      ) {
        nextState.length = STANDARD_MAX_PASSWORD_LENGTH;
      }
      setConfiguration(nextState);

      const validation = validatePasswordConfiguration(nextState);
      if (!validation.isValid) {
        return;
      }

      if (saveSettings(nextState)) {
        setSettingsWarning(null);
      } else {
        setSettingsWarning(SETTINGS_WARNING_MESSAGE);
      }
    },
    [configuration],
  );

  /**
   * Restores the approved defaults in memory and attempts to persist them.
   * The currently displayed password is left unchanged.
   */
  const onRestoreDefaults = useCallback(() => {
    const result = resetSettings();
    setConfiguration(result.configuration);
    setSettingsWarning(
      result.persistenceAvailable ? null : SETTINGS_WARNING_MESSAGE,
    );
  }, []);

  /**
   * Generates from the latest configuration when explicitly requested.
   *
   * A failed attempt preserves the previously displayed password and sets a
   * generic error. A successful attempt replaces the password, clears any prior
   * generation error, and invalidates copy feedback and pending clipboard writes
   * associated with the previous password.
   */
  const onGenerate = useCallback(() => {
    if (detectWebCryptoCapability() === "unavailable") {
      setWebCryptoCapability("unavailable");
      return;
    }

    setWebCryptoCapability("available");
    try {
      const generatedPassword = generatePassword(configuration);
      copyAttemptIdRef.current += 1;
      clearCopyConfirmationTimer();
      setIsCopied(false);
      setCopyError(null);
      setPassword(generatedPassword);
      setGenerationError(null);
    } catch {
      setWebCryptoCapability(detectWebCryptoCapability());
      setGenerationError(GENERATION_ERROR_MESSAGE);
    }
  }, [clearCopyConfirmationTimer, configuration]);

  /**
   * Rechecks browser capability after an unavailable state.
   *
   * If the API becomes available, it attempts generation once. The generator
   * remains responsible for security and runtime failure handling; a throw
   * leaves the existing password unchanged and does not reclassify the API as
   * permanently unavailable.
   */
  const onRetryWebCrypto = useCallback(() => {
    if (!isMountedRef.current || !isInitialized) {
      return;
    }

    const capability = detectWebCryptoCapability();
    setWebCryptoCapability(capability);
    if (capability === "unavailable") {
      return;
    }

    try {
      const generatedPassword = generatePassword(configuration);
      copyAttemptIdRef.current += 1;
      clearCopyConfirmationTimer();
      setIsCopied(false);
      setCopyError(null);
      setPassword(generatedPassword);
      setGenerationError(null);
    } catch {
      setWebCryptoCapability(detectWebCryptoCapability());
      setGenerationError(GENERATION_ERROR_MESSAGE);
    }
  }, [clearCopyConfirmationTimer, configuration, isInitialized]);

  /**
   * Copies only the password currently displayed when the action is invoked.
   *
   * A monotonically increasing attempt ID makes the newest attempt authoritative:
   * older promises cannot replace newer feedback, and successful password
   * generation or unmount invalidates any copy result still in flight.
   */
  const onCopy = useCallback(async () => {
    if (!isMountedRef.current || !isInitialized || password === null) {
      return;
    }

    const attemptId = copyAttemptIdRef.current + 1;
    copyAttemptIdRef.current = attemptId;
    clearCopyConfirmationTimer();
    setIsCopied(false);
    setCopyError(null);

    try {
      await copyToClipboard(password);
      if (!isMountedRef.current || attemptId !== copyAttemptIdRef.current) {
        return;
      }

      setIsCopied(true);
      copyConfirmationTimeoutRef.current = setTimeout(() => {
        // clearTimeout cannot stop a callback that was already queued.
        if (!isMountedRef.current || attemptId !== copyAttemptIdRef.current) {
          return;
        }

        copyConfirmationTimeoutRef.current = null;
        setIsCopied(false);
      }, COPY_CONFIRMATION_DURATION_MS);
    } catch {
      if (!isMountedRef.current || attemptId !== copyAttemptIdRef.current) {
        return;
      }

      setCopyError(COPY_ERROR_MESSAGE);
    }
  }, [clearCopyConfirmationTimer, isInitialized, password]);

  return {
    webCryptoCapability,
    configuration,
    configurationValidation: validatePasswordConfiguration(configuration),
    password,
    isInitialized,
    generationError,
    isCopied,
    copyError,
    settingsWarning,
    onConfigurationChange,
    onRestoreDefaults,
    onGenerate,
    onRetryWebCrypto,
    onCopy,
  };
}
