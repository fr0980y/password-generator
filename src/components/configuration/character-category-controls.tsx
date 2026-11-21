/**
 * Controlled presentation controls for password character categories and
 * additional character-selection options.
 *
 * This module uses native checkboxes and the existing `PasswordConfiguration`
 * type. It reports complete updated configuration objects to the parent, but
 * intentionally does not validate, persist, generate, or log password values.
 *
 * @example
 * ```tsx
 * <CharacterCategoryControls
 *   configuration={configuration}
 *   onConfigurationChange={handleConfigurationChange}
 * />
 * ```
 */
import type { PasswordConfiguration } from "../../features/password-generator/password-generator.types";
import styles from "./character-category-controls.module.css";

/**
 * Props accepted by {@link CharacterCategoryControls}.
 */
export interface CharacterCategoryControlsProps {
  /** Complete current configuration controlled by the parent. */
  configuration: PasswordConfiguration;
  /** Receives a complete configuration after one checkbox changes. */
  onConfigurationChange: (configuration: PasswordConfiguration) => void;
}

/**
 * Renders the character-category and additional password options.
 *
 * Native checkboxes keep the controls keyboard-operable and expose their
 * state to assistive technology. Updating a checkbox creates a new complete
 * configuration object; the component does not validate or persist it.
 *
 * @param props - Current configuration and complete-update callback.
 * @returns Category, ambiguous-character, and category-enforcement controls.
 */
export function CharacterCategoryControls({
  configuration,
  onConfigurationChange,
}: CharacterCategoryControlsProps) {
  /**
   * Returns an updated configuration without mutating the current object.
   *
   * The computed property targets only one of the four category fields.
   *
   * @param field - Character-category property to update.
   * @param checked - New checkbox state.
   * @returns Nothing; the complete updated configuration is passed to the parent.
   */
  const updateCategory = (
    field:
      | "uppercase"
      | "lowercase"
      | "numbers"
      | "symbols",
    checked: boolean,
  ) => {
    onConfigurationChange({
      ...configuration,
      [field]: checked,
    });
  };

  return (
    <div className={styles.controls}>
      <fieldset
        className={styles.fieldset}
        aria-describedby="character-category-hint"
      >
        <legend>Character Types</legend>
        <p id="character-category-hint" className={styles.fieldHint}>
          Choose at least one character category.
        </p>

        <div className={styles.categoryGrid}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={configuration.uppercase}
              onChange={(event) =>
                updateCategory("uppercase", event.currentTarget.checked)
              }
            />
            <span>Uppercase letters</span>
          </label>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={configuration.lowercase}
              onChange={(event) =>
                updateCategory("lowercase", event.currentTarget.checked)
              }
            />
            <span>Lowercase letters</span>
          </label>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={configuration.numbers}
              onChange={(event) =>
                updateCategory("numbers", event.currentTarget.checked)
              }
            />
            <span>Numbers</span>
          </label>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={configuration.symbols}
              onChange={(event) =>
                updateCategory("symbols", event.currentTarget.checked)
              }
            />
            <span>Symbols</span>
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.additionalFieldset}>
        <legend>Additional Options</legend>

        <label className={styles.optionLabel}>
          <input
            type="checkbox"
            checked={configuration.excludeAmbiguous}
            onChange={(event) =>
              onConfigurationChange({
                ...configuration,
                excludeAmbiguous: event.currentTarget.checked,
              })
            }
          />
          <span>
            <strong>Exclude Ambiguous Characters</strong>
            <small>
              Remove characters that can be difficult to distinguish visually.
            </small>
          </span>
        </label>

        <label className={styles.optionLabel}>
          <input
            type="checkbox"
            checked={configuration.requireEachCategory}
            onChange={(event) =>
              onConfigurationChange({
                ...configuration,
                requireEachCategory: event.currentTarget.checked,
              })
            }
          />
          <span>
            <strong>Require Every Selected Character Type</strong>
            <small>
              Ensure at least one character from each selected category appears.
              The password may need to be longer.
            </small>
          </span>
        </label>
      </fieldset>
    </div>
  );
}
