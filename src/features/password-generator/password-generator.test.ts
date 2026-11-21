/**
 * Deterministic unit tests for the standalone password-generation engine.
 *
 * The tests replace Web Crypto with controlled 32-bit samples to verify
 * rejection sampling and shuffle behavior without relying on statistical
 * randomness. The original global `crypto` property descriptor is restored
 * after each mock is used.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_CONFIGURATION,
  LOWERCASE_CHARACTERS,
  NUMBER_CHARACTERS,
} from "./password-generator.constants";
import { generatePassword } from "./password-generator";
import type { PasswordConfiguration } from "./password-generator.types";

/**
 * Copies the approved defaults and applies test-specific configuration values.
 *
 * @param overrides - Settings that replace corresponding default values.
 * @returns A complete password configuration for a test.
 */
function configuration(
  overrides: Partial<PasswordConfiguration> = {},
): PasswordConfiguration {
  return { ...DEFAULT_CONFIGURATION, ...overrides };
}

/**
 * Runs a synchronous test action with a deterministic `crypto.getRandomValues`
 * double, recording each supplied word and restoring the original global
 * property descriptor even if an assertion fails.
 *
 * @param nextValue - Supplies each successive unsigned word for a crypto call.
 * @param action - Test assertions to run while the mock is installed. It
 *   receives the values supplied to the mock.
 * @returns Nothing; the action runs synchronously with the mock installed.
 */
function withCrypto(
  nextValue: (call: number) => number,
  action: (calls: number[]) => void,
): void {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "crypto",
  );
  const calls: number[] = [];
  let callCount = 0;

  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      /** Fills the requested word array with the next controlled test samples. */
      getRandomValues<T extends ArrayBufferView>(array: T): T {
        assert.ok(array instanceof Uint32Array);
        // The check above narrows the generic view to the generator's requested word array.
        const values = array as Uint32Array;
        for (let index = 0; index < values.length; index += 1) {
          const value = nextValue(callCount++);
          calls.push(value);
          values[index] = value;
        }
        return array;
      },
    },
  });

  try {
    action(calls);
  } finally {
    // Restore the exact previous descriptor so tests do not leak global state.
    if (originalDescriptor) {
      Object.defineProperty(globalThis, "crypto", originalDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "crypto");
    }
  }
}

test("generates exactly the configured password length", () => {
  withCrypto(() => 0, () => {
    const password = generatePassword(configuration({ length: 37 }));
    assert.equal(password.length, 37);
  });
});

test("represents every enabled category when category enforcement is enabled", () => {
  withCrypto(() => 0, () => {
    const password = generatePassword(configuration());
    assert.match(password, /[A-Z]/);
    assert.match(password, /[a-z]/);
    assert.match(password, /[0-9]/);
    assert.match(password, /[!@#$%^&*()\-_=+\[\]{};:,.?/]/);
  });
});

test("does not require category representation when enforcement is disabled", () => {
  withCrypto(() => 0, () => {
    const password = generatePassword(
      configuration({
        uppercase: true,
        lowercase: true,
        numbers: false,
        symbols: false,
        requireEachCategory: false,
      }),
    );

    assert.equal(password, "A".repeat(DEFAULT_CONFIGURATION.length));
  });
});

test("generates only characters from the configured pool", () => {
  withCrypto(() => 0, () => {
    const config = configuration({
      uppercase: false,
      lowercase: true,
      numbers: true,
      symbols: false,
      requireEachCategory: false,
    });
    const password = generatePassword(config);
    const pool = `${LOWERCASE_CHARACTERS}${NUMBER_CHARACTERS}`;

    assert.ok([...password].every((character) => pool.includes(character)));
  });
});

test("excludes ambiguous characters from enabled categories", () => {
  withCrypto(() => 0, () => {
    const password = generatePassword(
      configuration({ excludeAmbiguous: true }),
    );

    assert.doesNotMatch(password, /[IOl01]/);
  });
});

test("rejects invalid configurations before requesting cryptographic randomness", () => {
  withCrypto(
    () => {
      assert.fail("randomness must not be requested for invalid configuration");
    },
    (calls) => {
      assert.throws(
        () =>
          generatePassword(
            configuration({ length: 7 }),
          ),
        /Invalid password configuration/,
      );
      assert.equal(calls.length, 0);
    },
  );
});

test("fails when Web Crypto is unavailable", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "crypto",
  );
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: undefined,
  });

  try {
    assert.throws(
      () => generatePassword(DEFAULT_CONFIGURATION),
      /Secure random generation is unavailable/,
    );
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, "crypto", originalDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "crypto");
    }
  }
});

test("converts cryptographic API failures to a generation error", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "crypto",
  );
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      getRandomValues(): never {
        throw new Error("crypto failed");
      },
    },
  });

  try {
    assert.throws(
      () => generatePassword(DEFAULT_CONFIGURATION),
      /Secure random generation failed/,
    );
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, "crypto", originalDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "crypto");
    }
  }
});

test("rejects out-of-range random values before selecting a character", () => {
  withCrypto(
    (call) => (call % 2 === 0 ? 0xffff_ffff : 0),
    (calls) => {
      const password = generatePassword(
        configuration({
          uppercase: false,
          lowercase: true,
          numbers: false,
          symbols: false,
          requireEachCategory: false,
        }),
      );

      assert.equal(password, "a".repeat(DEFAULT_CONFIGURATION.length));
      assert.ok(calls.includes(0xffff_ffff));
      assert.ok(calls.length > DEFAULT_CONFIGURATION.length);
    },
  );
});

test("Fisher-Yates shuffling uses cryptographic random indexes", () => {
  withCrypto(
    (call) => {
      if (call < 8) {
        return call;
      }

      return 0;
    },
    (calls) => {
      const password = generatePassword(
        configuration({
          uppercase: false,
          lowercase: false,
          numbers: false,
          symbols: true,
          length: 8,
          requireEachCategory: true,
        }),
      );

      assert.equal(password, "@#$%^&*!");
      assert.equal(calls.length, 15);
    },
  );
});
