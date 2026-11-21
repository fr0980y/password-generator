/**
 * Presentation component for the generated-password display.
 *
 * This module belongs to the password presentation layer. It accepts password
 * text from its parent and provides semantic, selectable, wrapping text. It has
 * no generation, clipboard, state, logging, or persistence responsibilities.
 *
 * @example
 * ```tsx
 * <PasswordDisplay password={currentlyDisplayedPassword} />
 * ```
 */
import styles from "./password-display.module.css";

/**
 * Props accepted by {@link PasswordDisplay}.
 */
export interface PasswordDisplayProps {
  /** The password to present as plain, selectable text, or null when unavailable. */
  password: string | null;
}

/**
 * Presents the currently displayed password in a readable, selectable surface.
 *
 * This component is presentation-only: it does not generate or store a password
 * and does not use browser clipboard APIs. Callers may provide a null or empty
 * value while no password is available.
 *
 * @param props - Password display properties.
 * @returns A labeled password value or a neutral unavailable state.
 */
export function PasswordDisplay({ password }: PasswordDisplayProps) {
  const hasPassword = typeof password === "string" && password.length > 0;

  return (
    <div
      className={styles.passwordDisplay}
      role="group"
      aria-label="Generated password"
    >
      {hasPassword ? (
        <code className={styles.passwordValue}>
          {password}
        </code>
      ) : (
        <p className={styles.unavailable} role="status">
          No password available.
        </p>
      )}
    </div>
  );
}
