/**
 * Controlled composition of password length and character-selection controls.
 *
 * This module belongs to the presentation layer for password configuration.
 * It combines the existing length and category components and passes complete
 * `PasswordConfiguration` values to the parent integration layer.
 *
 * @example
 * ```tsx
 * <PasswordConfiguration
 *   configuration={configuration}
 *   onConfigurationChange={handleConfigurationChange}
 *   onRestoreDefaults={handleRestoreDefaults}
 * />
 * ```
 */
import type { PasswordConfiguration as PasswordConfigurationType } from "../../features/password-generator/password-generator.types";
import {
  MAX_PASSWORD_LENGTH,
  STANDARD_MAX_PASSWORD_LENGTH,
} from "../../features/password-generator/password-generator.constants";
import { CharacterCategoryControls } from "./character-category-controls";
import { PasswordLengthControl } from "./password-length-control";
import styles from "./password-configuration.module.css";

/**
 * Props accepted by {@link PasswordConfiguration}.
 */
export interface PasswordConfigurationProps {
  /** Complete current configuration controlled by the parent. */
  configuration: PasswordConfigurationType;
  /** Receives a complete updated configuration from any control. */
  onConfigurationChange: (configuration: PasswordConfigurationType) => void;
  /** Called when the user activates Restore Defaults. */
  onRestoreDefaults: () => void;
}

/**
 * Coordinates the password configuration presentation controls.
 *
 * This component has no configuration state of its own. It forwards the
 * complete current configuration to the length and character controls and
 * delegates restore behavior to the parent integration layer.
 *
 * @param props - Current configuration and change/restore callbacks.
 * @returns Password length, character, additional-option, and restore controls.
 */
export function PasswordConfiguration({
  configuration,
  onConfigurationChange,
  onRestoreDefaults,
}: PasswordConfigurationProps) {
  return (
    <div className={styles.configuration}>
      <PasswordLengthControl
        length={configuration.length}
        maxLength={
          configuration.enableExtendedPasswordLengths
            ? MAX_PASSWORD_LENGTH
            : STANDARD_MAX_PASSWORD_LENGTH
        }
        onLengthChange={(length) =>
          onConfigurationChange({
            ...configuration,
            length,
          })
        }
      />

      <CharacterCategoryControls
        configuration={configuration}
        onConfigurationChange={onConfigurationChange}
      />

      <button
        type="button"
        className={styles.restoreButton}
        onClick={onRestoreDefaults}
      >
        Restore Defaults
      </button>
    </div>
  );
}
