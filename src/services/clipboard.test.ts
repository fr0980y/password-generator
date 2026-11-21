/**
 * Node unit tests for the standalone Clipboard API service.
 *
 * The suite follows the project's `node:test` and esbuild conventions, so it
 * does not require a browser or a real system clipboard. Each test can replace
 * `navigator` and `document`; `afterEach` restores their original descriptors
 * to avoid leaking mocks into other tests.
 *
 * The import-safety case temporarily removes browser globals before dynamically
 * importing the service. This detects accidental browser API access at module
 * initialization time, which would break server-side rendering.
 */
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

/** Original global descriptors, retained so mocks can be undone exactly. */
const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "navigator",
);
const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "document",
);

/**
 * Restores a global property to its initial descriptor, or deletes the
 * temporary property if that global did not originally exist.
 *
 * @param name - Browser global to restore.
 * @param descriptor - Descriptor captured before tests began.
 */
function restoreGlobalDescriptor(
  name: "navigator" | "document",
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
  } else {
    Reflect.deleteProperty(globalThis, name);
  }
}

/**
 * Replaces a browser global with a configurable test value.
 *
 * @param name - Browser global to mock.
 * @param value - Mock object or value exposed to the service.
 */
function setGlobalValue(name: "navigator" | "document", value: unknown): void {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
}

/** Restore both globals after every case, including cases with failed assertions. */
afterEach(() => {
  restoreGlobalDescriptor("navigator", originalNavigatorDescriptor);
  restoreGlobalDescriptor("document", originalDocumentDescriptor);
});

/** Ensures module initialization does not require browser globals to exist. */
test("can be imported when browser globals are unavailable", async () => {
  setGlobalValue("navigator", undefined);
  setGlobalValue("document", undefined);

  const service = await import("./clipboard");
  assert.equal(typeof service.copyToClipboard, "function");
});

/** Verifies that the service forwards the caller's exact text to the API. */
test("writes the exact supplied string", async () => {
  const writes: string[] = [];
  setGlobalValue("navigator", {
    clipboard: {
      /** Record the write argument so the test can check it remains unchanged. */
      writeText(text: string): Promise<void> {
        writes.push(text);
        return Promise.resolve();
      },
    },
  });

  const text = "synthetic-password-for-clipboard-test";
  const { copyToClipboard } = await import("./clipboard");
  await copyToClipboard(text);

  assert.deepEqual(writes, [text]);
});

/** Empty input must fail before the Clipboard API is touched. */
test("rejects empty input without invoking the clipboard API", async () => {
  let writeCount = 0;
  setGlobalValue("navigator", {
    clipboard: {
      /** Count calls to prove the empty-input guard runs first. */
      writeText(): Promise<void> {
        writeCount += 1;
        return Promise.resolve();
      },
    },
  });

  const { copyToClipboard } = await import("./clipboard");
  await assert.rejects(copyToClipboard(""), {
    message: "Cannot copy empty text.",
  });
  assert.equal(writeCount, 0);
});

/** Covers server or restricted environments without the `navigator` global. */
test("rejects when navigator is unavailable", async () => {
  setGlobalValue("navigator", undefined);

  const { copyToClipboard } = await import("./clipboard");
  await assert.rejects(copyToClipboard("synthetic-test-text"), {
    message: "Clipboard API is unavailable.",
  });
});

/** Covers browsers that expose `navigator` but not its Clipboard API. */
test("rejects when navigator.clipboard is unavailable", async () => {
  setGlobalValue("navigator", {});

  const { copyToClipboard } = await import("./clipboard");
  await assert.rejects(copyToClipboard("synthetic-test-text"), {
    message: "Clipboard API is unavailable.",
  });
});

/** A throwing property getter is normalized just like an unavailable API. */
test("rejects when accessing navigator.clipboard throws", async () => {
  const mockedNavigator = {};
  Object.defineProperty(mockedNavigator, "clipboard", {
    /** Simulate a browser that throws while exposing clipboard capabilities. */
    get() {
      throw new Error("clipboard access denied");
    },
  });
  setGlobalValue("navigator", mockedNavigator);

  const { copyToClipboard } = await import("./clipboard");
  await assert.rejects(copyToClipboard("synthetic-test-text"), {
    message: "Clipboard API is unavailable.",
  });
});

/**
 * Parameterized cases distinguish a missing `writeText` method from a
 * non-callable value while expecting the same public failure.
 */
for (const writeText of [undefined, "not a function"]) {
  test(`rejects when clipboard.writeText is ${String(writeText)}`, async () => {
    setGlobalValue("navigator", {
      clipboard: { writeText },
    });

    const { copyToClipboard } = await import("./clipboard");
    await assert.rejects(copyToClipboard("synthetic-test-text"), {
      message: "Clipboard API is unavailable.",
    });
  });
}

/** Synchronous browser exceptions must not escape with implementation details. */
test("normalizes a synchronous clipboard write exception", async () => {
  setGlobalValue("navigator", {
    clipboard: {
      /** Simulate an exception thrown before the API can return a promise. */
      writeText(): Promise<void> {
        throw new Error("failure details must not reach the caller");
      },
    },
  });

  const { copyToClipboard } = await import("./clipboard");
  await assert.rejects(copyToClipboard("synthetic-test-text"), {
    message: "Clipboard write failed.",
  });
});

/** Permission failures are asynchronous and must use the same generic error. */
test("normalizes a rejected permission-denied clipboard write", async () => {
  setGlobalValue("navigator", {
    clipboard: {
      /** Model the browser's standard permission-denied rejection. */
      writeText(): Promise<void> {
        return Promise.reject(
          new DOMException("Permission denied", "NotAllowedError"),
        );
      },
    },
  });

  const { copyToClipboard } = await import("./clipboard");
  await assert.rejects(copyToClipboard("synthetic-test-text"), {
    message: "Clipboard write failed.",
  });
});

/** Confirms an unavailable API does not trigger a legacy DOM-copy technique. */
test("does not use a DOM fallback when the API is unavailable", async () => {
  let fallbackCallCount = 0;
  setGlobalValue("navigator", {});
  setGlobalValue("document", {
    /** Count common DOM fallback entry points without providing real elements. */
    createElement() {
      fallbackCallCount += 1;
    },
    execCommand() {
      fallbackCallCount += 1;
    },
    getSelection() {
      fallbackCallCount += 1;
    },
  });

  const { copyToClipboard } = await import("./clipboard");
  await assert.rejects(copyToClipboard("synthetic-test-text"));
  assert.equal(fallbackCallCount, 0);
});

/** Confirms a failed Clipboard API write is not retried through the DOM. */
test("does not use a DOM fallback when a clipboard write fails", async () => {
  let fallbackCallCount = 0;
  setGlobalValue("navigator", {
    clipboard: {
      /** Reject to model a browser write failure. */
      writeText(): Promise<void> {
        return Promise.reject(new Error("write denied"));
      },
    },
  });
  setGlobalValue("document", {
    /** Count common DOM fallback entry points without providing real elements. */
    createElement() {
      fallbackCallCount += 1;
    },
    execCommand() {
      fallbackCallCount += 1;
    },
    getSelection() {
      fallbackCallCount += 1;
    },
  });

  const { copyToClipboard } = await import("./clipboard");
  await assert.rejects(copyToClipboard("synthetic-test-text"));
  assert.equal(fallbackCallCount, 0);
});
