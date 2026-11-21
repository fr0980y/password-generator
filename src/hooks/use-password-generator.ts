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
 * The hook does not own presentation, clipboard behavior, or a persistence
 * mechanism of its own. Only configuration is passed to the settings service;
 * the displayed password remains in React state and is never persisted.
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
 *   onConfigurationChange,
 *   onGenerate,
 * } = usePasswordGenerator();
 * ```
 *
 * Browser-dependent settings access and password generation run after mount,
 * not during server rendering or render-time state initialization.
 */
import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_CONFIGURATION,
} from "../features/password-generator/password-generator.constants";
import { generatePassword } from "../features/password-generator/password-generator";
import type {
  PasswordConfiguration,
  ValidationResult,
} from "../features/password-generator/password-generator.types";
import {
  validatePasswordConfiguration,
} from "../features/password-generator/password-generator.validation";
import {
  loadSettings,
  resetSettings,
  saveSettings,
} from "../services/settings-storage";

/** Safe, user-facing message used when secure password generation fails. */
const GENERATION_ERROR_MESSAGE =
  "Password generation failed. Please try again.";

/** Existing settings-storage warning shown when preferences cannot be saved. */
const SETTINGS_WARNING_MESSAGE =
  "Settings won't be saved on this device. Your current settings will remain active until you close or reload the application.";

/**
 * State and callbacks exposed by {@link usePasswordGenerator}.
 */
export interface UsePasswordGeneratorResult {
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
  /** Preference-persistence warning, or `null` when saving is available. */
  settingsWarning: string | null;
  /**
   * Applies a complete configuration from controlled presentation components.
   * Invalid configurations remain active in memory but are not persisted.
   *
   * @param configuration Complete configuration supplied by the caller.
   */
  onConfigurationChange: (configuration: PasswordConfiguration) => void;
  /** Replaces the configuration with saved defaults without regenerating. */
  onRestoreDefaults: () => void;
  /** Generates a password for the current configuration on explicit request. */
  onGenerate: () => void;
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
 * @returns Current application state and the callbacks needed by the page.
 */
export function usePasswordGenerator(): UsePasswordGeneratorResult {
  // Keep the render-time initial value deterministic and safe for server rendering.
  const [configuration, setConfiguration] = useState<PasswordConfiguration>(
    () => ({ ...DEFAULT_CONFIGURATION }),
  );
  const [password, setPassword] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [settingsWarning, setSettingsWarning] = useState<string | null>(null);

  /**
   * Loads saved settings and attempts initial generation after client mount.
   *
   * The cleanup invalidates this setup's queued task. In development Strict
   * Mode, the replayed setup schedules a new task; an actual unmount leaves
   * no active task to perform storage access or update state.
   */
  useEffect(() => {
    // Each setup owns its queued task. Cleanup invalidates that task, while a
    // Strict Mode effect replay runs setup again and schedules a fresh task.
    let effectIsActive = true;

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

      try {
        // The generator returns a complete password or throws; only success
        // updates state, so a failed attempt cannot replace the current value.
        setPassword(generatePassword(loadedSettings.configuration));
      } catch {
        // Do not surface low-level errors or include sensitive values in UI text.
        setGenerationError(GENERATION_ERROR_MESSAGE);
      } finally {
        // Initialization is complete once the initial generation attempt ends.
        setIsInitialized(true);
      }
    });

    return () => {
      // Prevent a queued task from touching storage or state after unmount.
      effectIsActive = false;
    };
  }, []);

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
    [],
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
   * generic error. A successful attempt replaces the password and clears any
   * prior generation error.
   */
  const onGenerate = useCallback(() => {
    try {
      setPassword(generatePassword(configuration));
      setGenerationError(null);
    } catch {
      setGenerationError(GENERATION_ERROR_MESSAGE);
    }
  }, [configuration]);

  return {
    configuration,
    configurationValidation: validatePasswordConfiguration(configuration),
    password,
    isInitialized,
    generationError,
    settingsWarning,
    onConfigurationChange,
    onRestoreDefaults,
    onGenerate,
  };
}
