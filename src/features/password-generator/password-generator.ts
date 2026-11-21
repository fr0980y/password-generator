/**
 * Standalone password-generation engine for the password-generator feature.
 *
 * This module validates a {@link PasswordConfiguration}, builds the enabled
 * character pool from the feature constants, and uses Web Crypto for unbiased
 * character selection and final shuffling. It has no React, storage, or UI
 * dependencies.
 *
 * Import {@link generatePassword} and pass the current configuration to get a
 * complete password synchronously. Invalid configuration or unavailable or
 * failing Web Crypto causes generation to throw; the module never falls back
 * to non-cryptographic randomness.
 */
import {
  getLowercaseCharacters,
  getNumberCharacters,
  getUppercaseCharacters,
  LOWERCASE_CHARACTERS,
  NUMBER_CHARACTERS,
  SYMBOL_CHARACTERS,
  UPPERCASE_CHARACTERS,
} from "./password-generator.constants";
import type { PasswordConfiguration } from "./password-generator.types";
import { validatePasswordConfiguration } from "./password-generator.validation";

/** Number of distinct values represented by one unsigned 32-bit random sample. */
const UINT32_RANGE = 0x1_0000_0000;

/** A category's enabled state and its applicable characters. */
interface CharacterCategory {
  /** Whether this category is selected in the password configuration. */
  enabled: boolean;
  /** Characters available for this category after configured exclusions. */
  characters: string;
}

/** Internal error type for invalid configuration and secure-generation failures. */
class PasswordGenerationError extends Error {
  /**
   * Creates an error with a message that does not contain generated password data.
   *
   * @param message - Safe description of why generation failed.
   */
  constructor(message: string) {
    super(message);
    this.name = "PasswordGenerationError";
  }
}

/**
 * Builds the selected category sets, applying ambiguous-character helpers only
 * to uppercase, lowercase, and number characters; symbols have no exclusions.
 *
 * @param configuration - Validated settings that determine enabled categories
 *   and ambiguous-character exclusion.
 * @returns Enabled categories in the same order used to build the combined pool.
 */
function getEnabledCategories(
  configuration: PasswordConfiguration,
): CharacterCategory[] {
  return [
    {
      enabled: configuration.uppercase,
      characters: configuration.excludeAmbiguous
        ? getUppercaseCharacters(true)
        : UPPERCASE_CHARACTERS,
    },
    {
      enabled: configuration.lowercase,
      characters: configuration.excludeAmbiguous
        ? getLowercaseCharacters(true)
        : LOWERCASE_CHARACTERS,
    },
    {
      enabled: configuration.numbers,
      characters: configuration.excludeAmbiguous
        ? getNumberCharacters(true)
        : NUMBER_CHARACTERS,
    },
    {
      enabled: configuration.symbols,
      characters: SYMBOL_CHARACTERS,
    },
  ].filter((category) => category.enabled);
}

/**
 * Selects an unbiased integer in `[0, upperBound)` using 32-bit Web Crypto
 * samples and rejection sampling.
 *
 * The caller must provide a positive integer (the generator uses non-empty
 * character sets and shuffle ranges). Values from the incomplete tail of the
 * 32-bit range are discarded before modulo reduction, avoiding modulo bias;
 * a bound of 1 is safe and always selects index 0.
 *
 * @param upperBound - Exclusive upper bound for the returned index.
 * @returns A cryptographically selected index below `upperBound`.
 * @throws {PasswordGenerationError} If Web Crypto is unavailable or a random
 *   sample cannot be obtained.
 */
function getSecureRandomIndex(upperBound: number): number {
  const cryptoApi = globalThis.crypto;
  if (
    typeof cryptoApi === "undefined" ||
    typeof cryptoApi.getRandomValues !== "function"
  ) {
    throw new PasswordGenerationError(
      "Secure random generation is unavailable.",
    );
  }

  // Keep the largest complete number of upperBound-sized groups in the sample range.
  const acceptedValueLimit =
    Math.floor(UINT32_RANGE / upperBound) * upperBound;
  // Request one full-range 32-bit sample per draw; Web Crypto fills this typed array.
  const randomValue = new Uint32Array(1);

  while (true) {
    try {
      cryptoApi.getRandomValues(randomValue);
    } catch {
      // Never substitute a weaker source when a secure draw fails.
      throw new PasswordGenerationError(
        "Secure random generation failed.",
      );
    }

    // Reject the uneven tail so every resulting modulo index has equal weight.
    if (randomValue[0] < acceptedValueLimit) {
      return randomValue[0] % upperBound;
    }
  }
}

/**
 * Applies an in-place Fisher–Yates shuffle, choosing each swap index with the
 * same unbiased Web Crypto selection used for character selection.
 *
 * @param characters - Password characters to shuffle.
 * @returns Nothing; the input array is rearranged in place.
 * @throws {PasswordGenerationError} If Web Crypto is unavailable or a random
 *   sample cannot be obtained.
 */
function shuffleCharacters(characters: string[]): void {
  for (let index = characters.length - 1; index > 0; index -= 1) {
    // At this step, every remaining position from 0 through index is equally eligible.
    const swapIndex = getSecureRandomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex],
      characters[index],
    ];
  }
}

/**
 * Generates a complete password that satisfies the supplied configuration.
 *
 * When category enforcement is enabled, one character is first selected from
 * each enabled category; any remaining positions come from the combined pool.
 * The completed characters are shuffled so required-category selections are
 * not left in predictable positions. Every random choice uses Web Crypto.
 *
 * @example
 * ```ts
 * import { DEFAULT_CONFIGURATION } from "./password-generator.constants";
 *
 * const password = generatePassword(DEFAULT_CONFIGURATION);
 * ```
 *
 * @param config - Password length, enabled character categories, and options.
 * @returns A password with exactly the configured length.
 * @throws {PasswordGenerationError} If configuration validation fails or
 *   Web Crypto is unavailable or fails. No partial password is returned.
 */
export function generatePassword(
  config: PasswordConfiguration,
): string {
  const validation = validatePasswordConfiguration(config);
  if (!validation.isValid) {
    throw new PasswordGenerationError(
      `Invalid password configuration: ${validation.errors.join(" ")}`,
    );
  }

  const categories = getEnabledCategories(config);
  const characterPool = categories
    .map((category) => category.characters)
    .join("");
  const passwordCharacters: string[] = [];

  if (config.requireEachCategory) {
    // Seed one character from each enabled category before filling the rest.
    for (const category of categories) {
      const characterIndex = getSecureRandomIndex(category.characters.length);
      passwordCharacters.push(category.characters[characterIndex]);
    }
  }

  // With enforcement disabled, this same loop fills the entire password from the pool.
  while (passwordCharacters.length < config.length) {
    const characterIndex = getSecureRandomIndex(characterPool.length);
    passwordCharacters.push(characterPool[characterIndex]);
  }

  shuffleCharacters(passwordCharacters);
  return passwordCharacters.join("");
}
