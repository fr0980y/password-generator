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
  enableExtendedPasswordLengths: boolean;
}

/**
 * The result of validating a password configuration.
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Availability of the browser Web Crypto API used for secure password randomness.
 */
export type WebCryptoCapability =
  | "unknown"
  | "available"
  | "unavailable";
