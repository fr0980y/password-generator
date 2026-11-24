/**
 * Controlled password-length input with a temporary editing value.
 *
 * The parent owns the validated configuration and persistence. This component
 * lets users edit a number without committing intermediate or invalid input.
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
"use client";

import { useEffect, useRef, useState } from "react";
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
  /** Receives a validated integer length when editing is committed. */
  onLengthChange: (length: number) => void;
}

/**
 * Parses a complete integer length within the active range.
 *
 * @param value - Current editable input string.
 * @param maxLength - Maximum allowed length in the current mode.
 * @returns A valid length, or `null` for empty, incomplete, or out-of-range input.
 */
function parseValidLength(value: string, maxLength: number): number | null {
  if (value.trim() === "") {
    return null;
  }

  const parsedLength = Number(value);
  if (
    !Number.isSafeInteger(parsedLength) ||
    parsedLength < MIN_PASSWORD_LENGTH ||
    parsedLength > maxLength
  ) {
    return null;
  }

  return parsedLength;
}

/**
 * Renders a numeric input and adjacent decrement/increment buttons.
 *
 * The input value is local while the user is editing. A valid value is
 * committed only on Enter or blur; invalid input is restored from the
 * controlled configuration. Step buttons apply one change from the valid
 * draft, if present, or from the current configuration otherwise.
 *
 * @param props - Current length, active maximum, and change callback.
 * @returns A labeled numeric input with accessible step buttons.
 */
export function PasswordLengthControl({
  length,
  maxLength,
  onLengthChange,
}: PasswordLengthControlProps) {
  const [inputValue, setInputValue] = useState(String(length));
  const inputValueRef = useRef(String(length));
  const controlRef = useRef<HTMLDivElement>(null);
  const lastCommittedLengthRef = useRef(length);

  useEffect(() => {
    lastCommittedLengthRef.current = length;
    inputValueRef.current = String(length);
    setInputValue(inputValueRef.current);
  }, [length, maxLength]);

  const commitLength = (value: string) => {
    const parsedLength = parseValidLength(value, maxLength);
    if (parsedLength === null) {
      inputValueRef.current = String(length);
      setInputValue(inputValueRef.current);
      return;
    }

    inputValueRef.current = String(parsedLength);
    setInputValue(inputValueRef.current);
    if (parsedLength !== lastCommittedLengthRef.current) {
      lastCommittedLengthRef.current = parsedLength;
      onLengthChange(parsedLength);
    }
  };

  const stepLength = (direction: -1 | 1) => {
    const baseLength = parseValidLength(inputValueRef.current, maxLength) ?? length;
    const nextLength = baseLength + direction;
    if (
      nextLength < MIN_PASSWORD_LENGTH ||
      nextLength > maxLength
    ) {
      return;
    }

    inputValueRef.current = String(nextLength);
    setInputValue(inputValueRef.current);
    if (nextLength !== lastCommittedLengthRef.current) {
      lastCommittedLengthRef.current = nextLength;
      onLengthChange(nextLength);
    }
  };

  const focusRemainsInControl = (target: EventTarget | null) =>
    target instanceof Node && controlRef.current?.contains(target) === true;

  const stepBase = parseValidLength(inputValue, maxLength) ?? length;

  return (
    <div className={styles.control} ref={controlRef}>
      <label id="password-length-label" htmlFor="password-length">
        Password Length
      </label>

      <div
        className={styles.lengthControl}
        role="group"
        aria-labelledby="password-length-label"
      >
        <button
          type="button"
          className={styles.adjustButton}
          aria-label="Decrease password length"
          disabled={stepBase <= MIN_PASSWORD_LENGTH}
          onClick={() => stepLength(-1)}
          onBlur={(event) => {
            if (!focusRemainsInControl(event.relatedTarget)) {
              commitLength(inputValueRef.current);
            }
          }}
        >
          −
        </button>

        <input
          id="password-length"
          className={styles.numberInput}
          type="number"
          inputMode="numeric"
          min={MIN_PASSWORD_LENGTH}
          max={maxLength}
          step={1}
          value={inputValue}
          aria-describedby="password-length-hint"
          aria-invalid={
            inputValue !== "" && parseValidLength(inputValue, maxLength) === null
          }
          onChange={(event) => {
            inputValueRef.current = event.currentTarget.value;
            setInputValue(inputValueRef.current);
          }}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={(event) => {
            if (!focusRemainsInControl(event.relatedTarget)) {
              commitLength(inputValueRef.current);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitLength(inputValueRef.current);
              event.currentTarget.blur();
            }
          }}
        />

        <button
          type="button"
          className={styles.adjustButton}
          aria-label="Increase password length"
          disabled={stepBase >= maxLength}
          onClick={() => stepLength(1)}
          onBlur={(event) => {
            if (!focusRemainsInControl(event.relatedTarget)) {
              commitLength(inputValueRef.current);
            }
          }}
        >
          +
        </button>
      </div>

      <p id="password-length-hint" className={styles.hint}>
        {MIN_PASSWORD_LENGTH} to {maxLength} characters
      </p>
    </div>
  );
}
