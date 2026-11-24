import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_CONFIGURATION,
  LOWERCASE_CHARACTERS,
  NUMBER_CHARACTERS,
  SYMBOL_CHARACTERS,
  UPPERCASE_CHARACTERS,
  getLowercaseCharacters,
  getNumberCharacters,
  getUppercaseCharacters,
} from "./password-generator.constants";
import type { PasswordConfiguration } from "./password-generator.types";
import { validatePasswordConfiguration } from "./password-generator.validation";

function configuration(
  overrides: Partial<PasswordConfiguration> = {},
): PasswordConfiguration {
  return { ...DEFAULT_CONFIGURATION, ...overrides };
}

test("exports the approved default configuration", () => {
  assert.deepEqual(DEFAULT_CONFIGURATION, {
    length: 20,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeAmbiguous: false,
    requireEachCategory: true,
    enableExtendedPasswordLengths: false,
  });
});

test("accepts valid configurations", () => {
  assert.equal(validatePasswordConfiguration(configuration()).isValid, true);
  assert.equal(validatePasswordConfiguration(configuration({ length: 8 })).isValid, true);
  assert.equal(
    validatePasswordConfiguration(configuration({ length: 40 })).isValid,
    true,
  );
  assert.equal(
    validatePasswordConfiguration(
      configuration({ length: 128, enableExtendedPasswordLengths: true }),
    ).isValid,
    true,
  );
  assert.equal(
    validatePasswordConfiguration(
      configuration({
        length: 8,
        uppercase: false,
        lowercase: false,
        numbers: false,
        symbols: true,
      }),
    ).isValid,
    true,
  );
});

test("enforces the standard and extended password length limits", () => {
  assert.equal(validatePasswordConfiguration(configuration({ length: 7 })).isValid, false);
  assert.equal(validatePasswordConfiguration(configuration({ length: 41 })).isValid, false);
  assert.equal(
    validatePasswordConfiguration(
      configuration({ length: 129, enableExtendedPasswordLengths: true }),
    ).isValid,
    false,
  );
  assert.equal(
    validatePasswordConfiguration(
      configuration({ length: Number.NaN }),
    ).isValid,
    false,
  );
});

test("rejects configurations with no enabled categories", () => {
  for (const enableExtendedPasswordLengths of [false, true]) {
    const result = validatePasswordConfiguration(
      configuration({
        uppercase: false,
        lowercase: false,
        numbers: false,
        symbols: false,
        enableExtendedPasswordLengths,
      }),
    );

    assert.equal(result.isValid, false);
    assert.ok(result.errors.includes("Select at least one character category."));
  }
});

test("rejects invalid category value types", () => {
  const result = validatePasswordConfiguration({
    ...configuration(),
    uppercase: "true",
  } as unknown as PasswordConfiguration);

  assert.equal(result.isValid, false);
  assert.ok(
    result.errors.includes("Character category selections must be boolean values."),
  );
});

test("rejects a non-boolean extended-length setting", () => {
  const result = validatePasswordConfiguration({
    ...configuration(),
    enableExtendedPasswordLengths: "true",
  } as unknown as PasswordConfiguration);

  assert.equal(result.isValid, false);
  assert.ok(result.errors.includes("Configuration options must be boolean values."));
});

test("rejects null configuration input", () => {
  const result = validatePasswordConfiguration(null);

  assert.equal(result.isValid, false);
  assert.deepEqual(result.errors, ["Password configuration is required."]);
});

test("rejects undefined configuration input", () => {
  const result = validatePasswordConfiguration(undefined);

  assert.equal(result.isValid, false);
  assert.deepEqual(result.errors, ["Password configuration is required."]);
});

test("accepts minimum length with all categories required in both length modes", () => {
  for (const enableExtendedPasswordLengths of [false, true]) {
    const result = validatePasswordConfiguration(
      configuration({
        length: 8,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
        requireEachCategory: true,
        enableExtendedPasswordLengths,
      }),
    );

    assert.equal(result.isValid, true);
  }
});

test("does not apply category-count length validation when enforcement is disabled", () => {
  const result = validatePasswordConfiguration(
    configuration({
      length: 8,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true,
      requireEachCategory: false,
    }),
  );

  assert.equal(result.isValid, true);
});

test("exports the approved character sets", () => {
  assert.equal(UPPERCASE_CHARACTERS, "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  assert.equal(LOWERCASE_CHARACTERS, "abcdefghijklmnopqrstuvwxyz");
  assert.equal(NUMBER_CHARACTERS, "0123456789");
  assert.equal(SYMBOL_CHARACTERS, "!@#$%^&*()-_=+[]{};:,.?/");
});

test("excludes only the approved ambiguous characters", () => {
  assert.equal(getUppercaseCharacters(true), "ABCDEFGHJKLMNPQRSTUVWXYZ");
  assert.equal(getLowercaseCharacters(true), "abcdefghijkmnopqrstuvwxyz");
  assert.equal(getNumberCharacters(true), "23456789");
});

test("retains ambiguous characters by default", () => {
  assert.equal(getUppercaseCharacters(false), UPPERCASE_CHARACTERS);
  assert.equal(getLowercaseCharacters(false), LOWERCASE_CHARACTERS);
  assert.equal(getNumberCharacters(false), NUMBER_CHARACTERS);
});
