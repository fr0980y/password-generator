import type { PasswordConfiguration } from "./password-generator.types";

/** Minimum allowed password length. */
export const MIN_PASSWORD_LENGTH = 8;

/** Maximum allowed password length. */
export const MAX_PASSWORD_LENGTH = 128;

export const UPPERCASE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const LOWERCASE_CHARACTERS = "abcdefghijklmnopqrstuvwxyz";
export const NUMBER_CHARACTERS = "0123456789";
export const SYMBOL_CHARACTERS = "!@#$%^&*()-_=+[]{};:,.?/";

/** Approved default password configuration. */
export const DEFAULT_CONFIGURATION: PasswordConfiguration = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: false,
  requireEachCategory: true,
};

export const AMBIGUOUS_UPPERCASE_CHARACTERS = "IO";
export const AMBIGUOUS_LOWERCASE_CHARACTERS = "l";
export const AMBIGUOUS_NUMBER_CHARACTERS = "01";

/** Returns an uppercase character set with ambiguous characters optionally removed. */
export function getUppercaseCharacters(excludeAmbiguous: boolean): string {
  return excludeAmbiguous
    ? UPPERCASE_CHARACTERS.replace(/[IO]/g, "")
    : UPPERCASE_CHARACTERS;
}

/** Returns a lowercase character set with ambiguous characters optionally removed. */
export function getLowercaseCharacters(excludeAmbiguous: boolean): string {
  return excludeAmbiguous
    ? LOWERCASE_CHARACTERS.replace(/[l]/g, "")
    : LOWERCASE_CHARACTERS;
}

/** Returns a number character set with ambiguous characters optionally removed. */
export function getNumberCharacters(excludeAmbiguous: boolean): string {
  return excludeAmbiguous
    ? NUMBER_CHARACTERS.replace(/[01]/g, "")
    : NUMBER_CHARACTERS;
}
