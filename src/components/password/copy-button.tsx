/**
 * Presentation component for the password Copy action.
 *
 * This module belongs to the password presentation layer. It owns no clipboard
 * API calls or success timer; the parent integration layer supplies callbacks
 * and presentation state so browser behavior remains outside this component.
 *
 * @example
 * ```tsx
 * <CopyButton onCopy={handleCopy} disabled={!password} copied={copySucceeded} />
 * ```
 */
import styles from "./action-button.module.css";

/**
 * Props accepted by {@link CopyButton}.
 */
export interface CopyButtonProps {
  /** Called once when the user explicitly activates the Copy button. */
  onCopy: () => void;
  /** Prevents activation when no password is available to copy. */
  disabled?: boolean;
  /** Allows the integration layer to present brief copy success feedback. */
  copied?: boolean;
}

/**
 * Renders the password Copy action and a presentation-only success state.
 *
 * Clipboard operations and success-state timers belong to the integration
 * layer. This component only invokes `onCopy` and reflects a supplied `copied`
 * state without maintaining internal state.
 *
 * @param props - Copy callback, disabled state, and success presentation state.
 * @returns A semantic, keyboard-accessible Copy button.
 */
export function CopyButton({
  onCopy,
  disabled = false,
  copied = false,
}: CopyButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.button} ${styles.secondaryButton}`}
      onClick={onCopy}
      disabled={disabled}
      aria-label="Copy password"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
