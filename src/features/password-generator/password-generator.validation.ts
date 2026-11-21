import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "./password-generator.constants";
import type {
  PasswordConfiguration,
  ValidationResult,
} from "./password-generator.types";

/**
 * Validates a password configuration without relying on React or browser APIs.
 */
export function validatePasswordConfiguration(
  configuration: PasswordConfiguration | null | undefined,
): ValidationResult {
  const errors: string[] = [];

  if (configuration == null) {
    return {
      isValid: false,
      errors: ["Password configuration is required."],
    };
  }

  if (
    typeof configuration.length !== "number" ||
    !Number.isInteger(configuration.length)
  ) {
    errors.push("Password length must be a whole number.");
  } else if (
    configuration.length < MIN_PASSWORD_LENGTH ||
    configuration.length > MAX_PASSWORD_LENGTH
  ) {
    errors.push(
      `Password length must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`,
    );
  }

  const categoryFields = [
    configuration.uppercase,
    configuration.lowercase,
    configuration.numbers,
    configuration.symbols,
  ];
  if (categoryFields.some((value) => typeof value !== "boolean")) {
    errors.push("Character category selections must be boolean values.");
  }
  if (
    typeof configuration.excludeAmbiguous !== "boolean" ||
    typeof configuration.requireEachCategory !== "boolean"
  ) {
    errors.push("Configuration options must be boolean values.");
  }

  const enabledCategoryCount = [
    configuration.uppercase,
    configuration.lowercase,
    configuration.numbers,
    configuration.symbols,
  ].filter((value) => value === true).length;

  if (enabledCategoryCount === 0) {
    errors.push("Select at least one character category.");
  }

  if (
    configuration.requireEachCategory &&
    enabledCategoryCount > 0 &&
    typeof configuration.length === "number" &&
    Number.isInteger(configuration.length) &&
    configuration.length < enabledCategoryCount
  ) {
    errors.push(
      `Password length must be at least ${enabledCategoryCount} characters when requireEachCategory is enabled.`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/** Alias for validatePasswordConfiguration. */
export const validateConfiguration = validatePasswordConfiguration;
