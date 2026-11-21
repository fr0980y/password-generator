/**
 * Active password-generation preferences.
 */
export interface PasswordConfiguration {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
  requireEachCategory: boolean;
}

/**
 * The result of validating a password configuration.
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
