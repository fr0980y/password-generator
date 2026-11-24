/**
 * Controlled native range control for the password length setting.
 *
 * The component reads its minimum from the password-generator constants and
 * receives the active maximum from its parent. Validation and configuration
 * persistence remain outside this presentation component.
 *
 * @example
 * ```tsx
 * <PasswordLengthControl
 *   length={length}
 *   maxLength={maximumLength}
 *   onLengthChange={handleLengthChange}
 * />
 * ```
 */
import { MIN_PASSWORD_LENGTH } from "../../features/password-generator/password-generator.constants";
import styles from "./password-length-control.module.css";

/**
 * Props accepted by {@link PasswordLengthControl}.
 */
export interface PasswordLengthControlProps {
  /** Current password length value controlled by the parent. */
  length: number;
  /** Maximum password length allowed by the active configuration. */
  maxLength: number;
  /** Receives a new integer length when the slider changes. */
  onLengthChange: (length: number) => void;
}

/**
 * Renders the native password-length range control.
 *
 * This presentation component only reports the selected number. The parent
 * owns validation and configuration updates; no separate numeric input is
 * maintained.
 *
 * @param props - Current length and length-change callback.
 * @returns A labeled range slider with an immediately visible numeric value.
 */
export function PasswordLengthControl({
  length,
  maxLength,
  onLengthChange,
}: PasswordLengthControlProps) {
  return (
    <div className={styles.control}>
      <div className={styles.labelRow}>
        <label htmlFor="password-length">Password Length</label>
        <output className={styles.lengthValue} htmlFor="password-length">
          {length}
        </output>
      </div>

      <input
        id="password-length"
        className={styles.range}
        type="range"
        min={MIN_PASSWORD_LENGTH}
        max={maxLength}
        step={1}
        value={length}
        aria-valuetext={`${length} characters`}
        aria-describedby="password-length-hint"
        onChange={(event) => onLengthChange(Number(event.currentTarget.value))}
      />

      <p id="password-length-hint" className={styles.hint}>
        {MIN_PASSWORD_LENGTH} to {maxLength} characters
      </p>
    </div>
  );
}
