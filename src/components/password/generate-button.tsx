/**
 * Presentation component for the password Generate action.
 *
 * This module belongs to the password presentation layer and deliberately has
 * no dependency on the generation engine. The parent integration layer owns
 * validation, randomness, and state changes and supplies an activation callback.
 *
 * @example
 * ```tsx
 * <GenerateButton onGenerate={handleGenerate} disabled={!configurationValid} />
 * ```
 */
import styles from "./action-button.module.css";

/**
 * Props accepted by {@link GenerateButton}.
 */
export interface GenerateButtonProps {
  /** Called once when the user explicitly activates the Generate button. */
  onGenerate: () => void;
  /** Prevents activation while configuration or application state is unavailable. */
  disabled?: boolean;
}

/**
 * Renders the primary password generation action.
 *
 * This component does not invoke the password-generation service. Its callback
 * is controlled by the application integration layer in a later phase.
 *
 * @param props - Generate action callback and disabled state.
 * @returns A semantic, keyboard-accessible Generate button.
 */
export function GenerateButton({
  onGenerate,
  disabled = false,
}: GenerateButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.button} ${styles.primaryButton}`}
      onClick={onGenerate}
      disabled={disabled}
    >
      Generate Password
    </button>
  );
}
