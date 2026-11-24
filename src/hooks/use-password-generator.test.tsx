/**
 * Integration coverage for the password-generator coordination hook and page.
 *
 * The Node test runner executes this file after esbuild bundles it. React
 * Testing Library renders the hook and page in a JSDOM document; the tests
 * replace browser globals with deterministic settings, Web Crypto, and
 * clipboard adapters so lifecycle and failure cases do not depend on a real
 * browser or operating-system clipboard.
 *
 * The suite verifies the relationship between the UI, `usePasswordGenerator`,
 * and the existing services. It also server-renders a small hook probe to
 * confirm browser APIs are not required during render. Generated values stay
 * in memory, and assertion messages are written to avoid revealing them.
 *
 * Run this suite together with the existing service and generator tests using
 * `npm test`.
 */
import assert from "node:assert/strict";
import {
  after,
  afterEach,
  before,
  beforeEach,
  test,
} from "node:test";
import { JSDOM } from "jsdom";
import { StrictMode, type ReactNode } from "react";
import { renderToString } from "react-dom/server";

import { DEFAULT_CONFIGURATION } from "../features/password-generator/password-generator.constants";
import type { PasswordConfiguration as PasswordConfigurationType } from "../features/password-generator/password-generator.types";
import Home from "../app/page";
import {
  loadSettings,
  SETTINGS_STORAGE_KEY,
  SETTINGS_STORAGE_VERSION,
  type StorageLike,
} from "../services/settings-storage";
import {
  usePasswordGenerator,
  type UsePasswordGeneratorResult,
} from "./use-password-generator";

/** Shared browser-like document; individual test roots are removed by cleanup. */
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://password-generator.test/",
  pretendToBeVisual: true,
});

/** Browser globals Testing Library and the page need while running in Node. */
const browserGlobalNames = [
  "window",
  "self",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "Node",
  "Element",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "MutationObserver",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "IS_REACT_ACT_ENVIRONMENT",
] as const;

/** Host property descriptors retained for server-render and afterEach restoration. */
const originalBrowserGlobalDescriptors = new Map<
  string,
  PropertyDescriptor | undefined
>();
// Preserve host-provided values so each test can restore the process environment.
for (const name of browserGlobalNames) {
  originalBrowserGlobalDescriptors.set(
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  );
}

/** Original Web Crypto descriptor restored after each deterministic test mock. */
const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "crypto",
);
/** Timer descriptors restored after deterministic confirmation-timer tests. */
const originalSetTimeoutDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "setTimeout",
);
const originalClearTimeoutDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "clearTimeout",
);
/** JSDOM descriptors restored so storage and clipboard mocks do not leak. */
const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(
  dom.window,
  "localStorage",
);
const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(
  dom.window.navigator,
  "clipboard",
);

let testingLibrary!: typeof import("@testing-library/react");
let userEvent!: typeof import("@testing-library/user-event").default;
/** Shared observability for service ordering and controlled test operations. */
let events: string[] = [];
/** Per-test storage adapter injected through JSDOM's localStorage property. */
let storage!: TestStorage;
/** Per-test control for deterministic secure-random requests. */
let randomControl!: RandomControl;
/** Captured writes remain in memory so tests can compare the current display. */
let clipboardWrites: string[] = [];
/** Promise factory used to resolve or reject clipboard writes on demand. */
let clipboardWriter: (text: string) => Promise<void>;

/**
 * In-memory implementation of the settings service's storage contract.
 *
 * It records preference reads and writes for ordering and persistence
 * assertions. `failWrites` simulates browser storage denial without using
 * actual local storage.
 */
class TestStorage implements StorageLike {
  /** Serialized settings keyed as the storage service would store them. */
  readonly values = new Map<string, string>();
  /** Number of `getItem` calls observed in the current test. */
  readCount = 0;
  /** Number of `setItem` calls observed in the current test. */
  writeCount = 0;
  /** Makes the next and subsequent `setItem` calls throw. */
  failWrites = false;

  /**
   * Reads a stored preference and records that the settings service accessed it.
   *
   * @param key - Storage key requested by the service.
   * @returns The stored value, or `null` when the key is absent.
   */
  getItem(key: string): string | null {
    this.readCount += 1;
    events.push("settings-read");
    return this.values.get(key) ?? null;
  }

  /**
   * Stores a preference unless the test has enabled simulated write failure.
   *
   * @param key - Storage key supplied by the settings service.
   * @param value - Serialized preference value supplied by the service.
   * @returns Nothing.
   * @throws {Error} When `failWrites` is enabled for the current test.
   */
  setItem(key: string, value: string): void {
    this.writeCount += 1;
    events.push("settings-write");
    if (this.failWrites) {
      throw new Error("Synthetic storage failure.");
    }
    this.values.set(key, value);
  }

  /**
   * Removes a stored preference.
   *
   * @param key - Storage key to remove.
   * @returns Nothing.
   */
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

/** Reads the current validated password length from the test storage adapter. */
function loadLengthFromTestStorage(): number {
  return loadSettings(storage).configuration.length;
}

/**
 * Controls the Web Crypto mock used by password-generation tests.
 *
 * Returning zero-filled samples makes generation deterministic; setting
 * `fail` makes the mock throw so the hook's generic error path can be checked.
 */
interface RandomControl {
  /** Number of secure-random requests made during the current test. */
  calls: number;
  /** Whether the next secure-random request should fail. */
  fail: boolean;
}

/**
 * Installs JSDOM browser globals for React and components that access the DOM.
 *
 * The matching original descriptors are restored in `afterEach` so one test
 * cannot leak browser state into another or alter Node's host environment.
 *
 * @returns Nothing.
 */
function installBrowserGlobals(): void {
  const globalValues: Record<string, unknown> = {
    window: dom.window,
    self: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    HTMLButtonElement: dom.window.HTMLButtonElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Node: dom.window.Node,
    Element: dom.window.Element,
    Event: dom.window.Event,
    MouseEvent: dom.window.MouseEvent,
    KeyboardEvent: dom.window.KeyboardEvent,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };

  for (const [name, value] of Object.entries(globalValues)) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      enumerable: true,
      writable: true,
      value,
    });
  }
}

/**
 * Installs the controllable clipboard adapter used to observe copy requests.
 *
 * `user-event` may provide its own clipboard stub during setup, so page tests
 * reinstall this adapter afterward. Copied text remains in the test's memory
 * and is never printed.
 *
 * @returns Nothing.
 */
function installClipboardMock(): void {
  Object.defineProperty(dom.window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText(text: string): Promise<void> {
        clipboardWrites.push(text);
        return clipboardWriter(text);
      },
    },
  });
}

/**
 * Restores a property's original descriptor or removes a test-only property.
 *
 * Restoring descriptors rather than assigning values preserves accessors and
 * read-only host globals exactly as the test found them.
 *
 * @param target - Object whose property should be restored.
 * @param name - Property key to restore or remove.
 * @param descriptor - Original descriptor, or `undefined` if the property was absent.
 * @returns Nothing.
 */
function restoreProperty(
  target: object,
  name: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(target, name, descriptor);
  } else {
    Reflect.deleteProperty(target, name);
  }
}

/**
 * Seeds the storage mock with a versioned settings payload.
 *
 * This bypasses `saveSettings` so initialization tests can model existing user
 * preferences without counting fixture setup as an application write.
 *
 * @param configuration - Valid settings to return from the next load.
 * @returns Nothing.
 */
function seedSettings(configuration: PasswordConfigurationType): void {
  storage.values.set(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      version: SETTINGS_STORAGE_VERSION,
      settings: configuration,
    }),
  );
}

/**
 * Creates a complete configuration fixture from the approved defaults.
 *
 * @param overrides - Fields to replace in the returned fixture.
 * @returns A fresh complete configuration; `DEFAULT_CONFIGURATION` is unchanged.
 */
function configuration(
  overrides: Partial<PasswordConfigurationType> = {},
): PasswordConfigurationType {
  return { ...DEFAULT_CONFIGURATION, ...overrides };
}

/**
 * Flushes the hook's queued initialization work inside React's `act` boundary.
 *
 * The hook starts initialization in a microtask from its effect. Keeping that
 * microtask inside `act` avoids false React warnings while checking the final
 * initialization flag.
 *
 * @param isInitialized - Probe for the hook's current initialization state.
 * @returns A promise that resolves after initialization has been asserted.
 * @throws An assertion error if the hook has not initialized.
 */
async function waitForInitialization(
  isInitialized: () => boolean,
): Promise<void> {
  await testingLibrary.act(async () => {
    await Promise.resolve();
  });
  assert.ok(isInitialized(), "Hook initialization did not complete.");
}

/**
 * Finds a button by its accessible name without dumping password-bearing DOM.
 *
 * @param name - Accessible name expected for the button.
 * @returns The matching native button element.
 * @throws {Error} If no button with the requested accessible name is rendered.
 */
function requireButton(name: string): HTMLButtonElement {
  const button = testingLibrary.screen.queryByRole("button", { name });
  if (!(button instanceof dom.window.HTMLButtonElement)) {
    throw new Error(`Expected an accessible button named "${name}".`);
  }
  return button;
}

/**
 * Reads the current password through a helper to avoid stale TypeScript narrowing.
 *
 * React Testing Library updates the hook result after actions, but TypeScript
 * cannot infer that mutation from an assertion about a previous render.
 *
 * @param result - Current hook result from `renderHook`.
 * @returns The displayed password, or `null` when generation has not succeeded.
 */
function hookPassword(result: UsePasswordGeneratorResult): string | null {
  return result.password;
}

/**
 * Reads the rendered password text for in-memory preservation and copy checks.
 *
 * @returns The displayed text, trimmed for DOM formatting whitespace.
 * @throws An assertion error if the labeled password display is missing.
 */
function displayedPasswordText(): string {
  const display = testingLibrary.screen.queryByRole("group", {
    name: "Generated password",
  });
  assert.ok(display, "Generated-password display was not rendered.");
  return display.textContent?.trim() ?? "";
}

/**
 * Creates a clipboard promise whose completion order the test controls.
 *
 * This lets overlap and unmount tests resolve or reject writes deterministically
 * without timers or real clipboard permissions.
 *
 * @returns The pending promise and its resolve/reject controls.
 */
function deferredClipboardWrite(): {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
} {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

/** A controllable timeout scheduled by the hook during a test. */
interface ScheduledTimer {
  callback: () => void;
  delay: number;
  dueAt: number;
  cleared: boolean;
}

/**
 * Replaces browser timers with a local clock so confirmation expiry is exact
 * and cancelled callbacks can be invoked deliberately to test stale guards.
 */
function installFakeTimers(): {
  timers: ScheduledTimer[];
  activeTimerCount: () => number;
  advanceBy: (duration: number) => void;
  fire: (timer: ScheduledTimer) => void;
} {
  const timers: ScheduledTimer[] = [];
  const timersByHandle = new Map<number, ScheduledTimer>();
  let nextHandle = 0;
  let now = 0;

  const setTimeoutMock = ((callback: () => void, delay = 0) => {
    const timer: ScheduledTimer = {
      callback,
      delay,
      dueAt: now + delay,
      cleared: false,
    };
    const handle = ++nextHandle;
    timers.push(timer);
    timersByHandle.set(handle, timer);
    return handle as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  const clearTimeoutMock = ((handle: ReturnType<typeof setTimeout>) => {
    const timer = timersByHandle.get(Number(handle));
    if (timer) {
      timer.cleared = true;
    }
  }) as typeof clearTimeout;

  Object.defineProperty(globalThis, "setTimeout", {
    configurable: true,
    writable: true,
    value: setTimeoutMock,
  });
  Object.defineProperty(globalThis, "clearTimeout", {
    configurable: true,
    writable: true,
    value: clearTimeoutMock,
  });

  return {
    timers,
    activeTimerCount: () => timers.filter((timer) => !timer.cleared).length,
    advanceBy(duration) {
      const target = now + duration;
      while (true) {
        const nextTimer = timers
          .filter((timer) => !timer.cleared && timer.dueAt <= target)
          .sort((left, right) => left.dueAt - right.dueAt)[0];
        if (!nextTimer) {
          break;
        }

        now = nextTimer.dueAt;
        nextTimer.cleared = true;
        nextTimer.callback();
      }
      now = target;
    },
    fire(timer) {
      timer.cleared = true;
      timer.callback();
    },
  };
}

/**
 * Enables React's development-only effect replay for lifecycle tests.
 *
 * @param children - Hook probe rendered inside `StrictMode`.
 * @returns The children wrapped in a Strict Mode boundary.
 */
function StrictModeWrapper({ children }: { children: ReactNode }) {
  return <StrictMode>{children}</StrictMode>;
}

/**
 * Server-render probe that exposes only non-sensitive hook state as attributes.
 *
 * The output intentionally excludes password text; the test uses it to verify
 * that defaults render without storage, randomness, or other browser APIs.
 *
 * @returns Minimal markup describing the initial, uninitialized hook state.
 */
function ServerRenderedHookProbe() {
  const {
    configuration,
    isInitialized,
    password,
    webCryptoCapability,
  } = usePasswordGenerator();
  return (
    <output
      data-length={configuration.length}
      data-initialized={String(isInitialized)}
      data-password-unavailable={String(password === null)}
      data-web-crypto-capability={webCryptoCapability}
    />
  );
}

before(async () => {
  // Load browser-oriented test helpers only after the DOM globals are available.
  installBrowserGlobals();
  testingLibrary = await import("@testing-library/react");
  userEvent = (await import("@testing-library/user-event")).default;
});

beforeEach(() => {
  // Give each test isolated storage, randomness, event history, and clipboard state.
  installBrowserGlobals();
  events = [];
  storage = new TestStorage();
  Object.defineProperty(dom.window, "localStorage", {
    configurable: true,
    value: storage,
  });

  randomControl = { calls: 0, fail: false };
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: {
      getRandomValues(array: Uint32Array): Uint32Array {
        randomControl.calls += 1;
        events.push("random-sample");
        if (randomControl.fail) {
          throw new Error("Synthetic random-source failure.");
        }
        // A fixed sample exercises the real generator deterministically without logging output.
        array.fill(0);
        return array;
      },
    },
  });

  clipboardWrites = [];
  clipboardWriter = () => Promise.resolve();
  installClipboardMock();
});

afterEach(() => {
  // Remove rendered roots and restore every mutable browser/global fixture.
  testingLibrary.cleanup();
  restoreProperty(globalThis, "setTimeout", originalSetTimeoutDescriptor);
  restoreProperty(globalThis, "clearTimeout", originalClearTimeoutDescriptor);
  restoreProperty(
    dom.window.navigator,
    "clipboard",
    originalClipboardDescriptor,
  );
  restoreProperty(dom.window, "localStorage", originalLocalStorageDescriptor);
  restoreProperty(globalThis, "crypto", originalCryptoDescriptor);

  for (const name of browserGlobalNames) {
    restoreProperty(
      globalThis,
      name,
      originalBrowserGlobalDescriptors.get(name),
    );
  }
});

after(() => {
  // Release JSDOM's window after all tests have finished.
  dom.window.close();
});

test("provides defaults before initialization and loads settings before generation", async () => {
  const savedConfiguration = configuration({
    length: 8,
    uppercase: false,
    numbers: false,
    symbols: false,
    requireEachCategory: false,
  });
  seedSettings(savedConfiguration);

  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());

  assert.deepEqual(result.current.configuration, DEFAULT_CONFIGURATION);
  assert.equal(result.current.isInitialized, false);
  assert.equal(result.current.webCryptoCapability, "unknown");
  assert.equal(storage.readCount, 0);
  assert.equal(randomControl.calls, 0);

  await waitForInitialization(() => result.current.isInitialized);

  assert.deepEqual(result.current.configuration, savedConfiguration);
  assert.equal(result.current.webCryptoCapability, "available");
  assert.equal(storage.readCount, 1);
  assert.equal(events[0], "settings-read");
  assert.equal(randomControl.calls, 15);
});

test("uses defaults and warns when saved settings are unavailable", async () => {
  Object.defineProperty(dom.window, "localStorage", {
    configurable: true,
    get() {
      throw new Error("Synthetic storage access failure.");
    },
  });

  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());

  assert.deepEqual(result.current.configuration, DEFAULT_CONFIGURATION);
  assert.equal(result.current.isInitialized, false);
  await waitForInitialization(() => result.current.isInitialized);

  assert.deepEqual(result.current.configuration, DEFAULT_CONFIGURATION);
  assert.equal(
    result.current.settingsWarning,
    "Settings won't be saved on this device. Your current settings will remain active until you close or reload the application.",
  );
  assert.ok(
    typeof result.current.password === "string" &&
      result.current.password.length === DEFAULT_CONFIGURATION.length,
    "Initial generation did not use the safe defaults.",
  );
});

test("renders the hook without browser APIs or render-time service work", () => {
  // Restore host globals before rendering; effects do not run during SSR.
  for (const name of browserGlobalNames) {
    restoreProperty(
      globalThis,
      name,
      originalBrowserGlobalDescriptors.get(name),
    );
  }
  restoreProperty(globalThis, "crypto", originalCryptoDescriptor);
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: undefined,
  });

  let html: string;
  try {
    html = renderToString(<ServerRenderedHookProbe />);
  } finally {
    // Keep the remaining test hooks usable even if server rendering throws.
    installBrowserGlobals();
  }

  assert.ok(html.includes('data-length="20"'));
  assert.ok(html.includes('data-initialized="false"'));
  assert.ok(html.includes('data-password-unavailable="true"'));
  assert.ok(html.includes('data-web-crypto-capability="unknown"'));
  assert.equal(storage.readCount, 0);
  assert.equal(randomControl.calls, 0);
});

test("reports unavailable when Web Crypto is missing", async () => {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: undefined,
  });

  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());
  assert.equal(result.current.webCryptoCapability, "unknown");

  await waitForInitialization(() => result.current.isInitialized);

  assert.equal(result.current.webCryptoCapability, "unavailable");
  assert.equal(result.current.password, null);
  assert.equal(randomControl.calls, 0);
});

test("reports unavailable when getRandomValues is missing", async () => {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {},
  });

  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());
  await waitForInitialization(() => result.current.isInitialized);

  assert.equal(result.current.webCryptoCapability, "unavailable");
  assert.equal(result.current.password, null);
  assert.equal(randomControl.calls, 0);
});

test("reports unavailable when the Web Crypto property is inaccessible", async () => {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    get() {
      throw new Error("Synthetic capability access failure.");
    },
  });

  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());
  await waitForInitialization(() => result.current.isInitialized);

  assert.equal(result.current.webCryptoCapability, "unavailable");
  assert.equal(result.current.password, null);
  assert.equal(randomControl.calls, 0);
});

test("reports unavailable when getRandomValues is inaccessible", async () => {
  const inaccessibleCrypto = {};
  Object.defineProperty(inaccessibleCrypto, "getRandomValues", {
    configurable: true,
    get() {
      throw new Error("Synthetic method access failure.");
    },
  });
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: inaccessibleCrypto,
  });

  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());
  await waitForInitialization(() => result.current.isInitialized);

  assert.equal(result.current.webCryptoCapability, "unavailable");
  assert.equal(result.current.password, null);
  assert.equal(randomControl.calls, 0);
});

test("capability retry detects recovery and attempts secure generation", async () => {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: undefined,
  });

  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());
  await waitForInitialization(() => result.current.isInitialized);
  assert.equal(result.current.webCryptoCapability, "unavailable");

  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      getRandomValues(array: Uint32Array): Uint32Array {
        randomControl.calls += 1;
        array.fill(0);
        return array;
      },
    },
  });

  testingLibrary.act(() => {
    result.current.onRetryWebCrypto();
  });

  assert.equal(result.current.webCryptoCapability, "available");
  assert.ok(typeof result.current.password === "string");
  assert.equal(result.current.generationError, null);
});

test("initial detection succeeds but inaccessible Web Crypto before generation becomes unavailable", async () => {
  let cryptoAccessCount = 0;
  const cryptoApi = {
    getRandomValues(array: Uint32Array): Uint32Array {
      array.fill(0);
      return array;
    },
  };

  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    get() {
      cryptoAccessCount += 1;
      if (cryptoAccessCount === 1) {
        return cryptoApi;
      }
      throw new Error("Synthetic Web Crypto became inaccessible.");
    },
  });

  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());
  await waitForInitialization(() => result.current.isInitialized);

  assert.equal(result.current.webCryptoCapability, "unavailable");
  assert.equal(result.current.password, null);
  assert.equal(
    result.current.generationError,
    "Password generation failed. Please try again.",
  );
});

test("Web Crypto becoming inaccessible after detection preserves the password and becomes unavailable", async () => {
  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());
  await waitForInitialization(() => result.current.isInitialized);

  const displayedPassword = result.current.password;
  assert.equal(result.current.webCryptoCapability, "available");

  let cryptoAccessCount = 0;
  const cryptoApi = {
    getRandomValues(array: Uint32Array): Uint32Array {
      randomControl.calls += 1;
      array.fill(0);
      return array;
    },
  };
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    get() {
      cryptoAccessCount += 1;
      if (cryptoAccessCount === 1) {
        return cryptoApi;
      }
      throw new Error("Synthetic Web Crypto became inaccessible.");
    },
  });

  testingLibrary.act(() => {
    result.current.onGenerate();
  });

  assert.equal(result.current.webCryptoCapability, "unavailable");
  assert.equal(result.current.password, displayedPassword);
  assert.equal(
    result.current.generationError,
    "Password generation failed. Please try again.",
  );
});

test("retry remains unavailable when Web Crypto is still inaccessible", async () => {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    get() {
      throw new Error("Synthetic Web Crypto is inaccessible.");
    },
  });

  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());
  await waitForInitialization(() => result.current.isInitialized);
  assert.equal(result.current.webCryptoCapability, "unavailable");

  testingLibrary.act(() => {
    result.current.onRetryWebCrypto();
  });

  assert.equal(result.current.webCryptoCapability, "unavailable");
  assert.equal(result.current.password, null);
  assert.equal(randomControl.calls, 0);
});

test("Strict Mode effect replay initializes and generates only once", async () => {
  const fakeTimers = installFakeTimers();
  // Use one ordinary mount as a baseline instead of hard-coding generator draws.
  const normalRender = testingLibrary.renderHook(() => usePasswordGenerator());
  await waitForInitialization(() => normalRender.result.current.isInitialized);
  const singleInitializationRandomCalls = randomControl.calls;
  assert.ok(singleInitializationRandomCalls > 0);
  normalRender.unmount();

  // Reset only the counters so the Strict Mode mount can be compared independently.
  storage.readCount = 0;
  randomControl.calls = 0;
  events = [];

  const { result } = testingLibrary.renderHook(
    () => usePasswordGenerator(),
    { wrapper: StrictModeWrapper },
  );

  await waitForInitialization(() => result.current.isInitialized);

  assert.equal(storage.readCount, 1);
  assert.equal(randomControl.calls, singleInitializationRandomCalls);

  await testingLibrary.act(async () => {
    await result.current.onCopy();
  });
  assert.equal(fakeTimers.timers.length, 1);
  assert.equal(fakeTimers.activeTimerCount(), 1);
});

test("unmount before the initialization microtask prevents service work", async () => {
  const { unmount } = testingLibrary.renderHook(() => usePasswordGenerator());

  unmount();
  // Allow the effect's queued microtask to run after cleanup has invalidated it.
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(storage.readCount, 0);
  assert.equal(randomControl.calls, 0);
});

test("initial generation failure leaves no password and exposes a generic error", async () => {
  randomControl.fail = true;
  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());

  await waitForInitialization(() => result.current.isInitialized);

  assert.equal(hookPassword(result.current), null);
  assert.equal(result.current.webCryptoCapability, "available");
  assert.equal(
    result.current.generationError,
    "Password generation failed. Please try again.",
  );
  assert.equal(result.current.settingsWarning, null);
});

test("valid changes persist and invalid changes remain in memory without saving", async () => {
  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());
  await waitForInitialization(() => result.current.isInitialized);

  const validConfiguration = configuration({ length: 24 });
  testingLibrary.act(() => {
    result.current.onConfigurationChange(validConfiguration);
  });

  assert.deepEqual(result.current.configuration, validConfiguration);
  assert.equal(storage.writeCount, 1);

  const invalidConfiguration = configuration({
    uppercase: false,
    lowercase: false,
    numbers: false,
    symbols: false,
  });
  testingLibrary.act(() => {
    result.current.onConfigurationChange(invalidConfiguration);
  });

  assert.deepEqual(result.current.configuration, invalidConfiguration);
  assert.equal(result.current.configurationValidation.isValid, false);
  assert.equal(storage.writeCount, 1);
});

test("disabling extended lengths clamps the selected length to 40", async () => {
  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());
  await waitForInitialization(() => result.current.isInitialized);

  testingLibrary.act(() => {
    result.current.onConfigurationChange(
      configuration({
        length: 64,
        enableExtendedPasswordLengths: true,
      }),
    );
  });
  assert.equal(result.current.configuration.length, 64);

  testingLibrary.act(() => {
    result.current.onConfigurationChange(
      configuration({
        length: 64,
        enableExtendedPasswordLengths: false,
      }),
    );
  });

  assert.equal(result.current.configuration.length, 40);
  assert.equal(result.current.configuration.enableExtendedPasswordLengths, false);
  assert.equal(result.current.configurationValidation.isValid, true);
  assert.equal(
    JSON.parse(storage.values.get(SETTINGS_STORAGE_KEY) ?? "null").settings.length,
    40,
  );
});

test("restoring defaults preserves the password and reports persistence status", async () => {
  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());
  await waitForInitialization(() => result.current.isInitialized);

  const displayedPassword = result.current.password;
  const generationCalls = randomControl.calls;

  testingLibrary.act(() => {
    result.current.onRestoreDefaults();
  });

  assert.deepEqual(result.current.configuration, DEFAULT_CONFIGURATION);
  assert.ok(
    result.current.password === displayedPassword,
    "Restore Defaults replaced the displayed password.",
  );
  assert.equal(randomControl.calls, generationCalls);
  assert.equal(result.current.settingsWarning, null);
  assert.deepEqual(
    JSON.parse(storage.values.get(SETTINGS_STORAGE_KEY) ?? "null").settings,
    DEFAULT_CONFIGURATION,
  );

  storage.failWrites = true;
  testingLibrary.act(() => {
    result.current.onRestoreDefaults();
  });

  assert.equal(
    result.current.settingsWarning,
    "Settings won't be saved on this device. Your current settings will remain active until you close or reload the application.",
  );
  assert.ok(
    result.current.password === displayedPassword,
    "A failed defaults save replaced the displayed password.",
  );
  assert.equal(randomControl.calls, generationCalls);
});

test("successful generation replaces the password and clears a previous error", async () => {
  randomControl.fail = true;
  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());
  await waitForInitialization(() => result.current.isInitialized);

  assert.equal(hookPassword(result.current), null);
  randomControl.fail = false;

  await testingLibrary.act(async () => {
    result.current.onGenerate();
  });

  const passwordAfterRetry = hookPassword(result.current);
  assert.ok(
    typeof passwordAfterRetry === "string" && passwordAfterRetry.length > 0,
    "Retry did not produce a password.",
  );
  assert.equal(result.current.generationError, null);
});

test("failed generation preserves the password and does not expose implementation errors", async () => {
  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());
  await waitForInitialization(() => result.current.isInitialized);

  const displayedPassword = result.current.password;
  assert.equal(result.current.webCryptoCapability, "available");
  randomControl.fail = true;
  await testingLibrary.act(async () => {
    result.current.onGenerate();
  });

  assert.ok(
    result.current.password === displayedPassword,
    "A failed generation replaced the displayed password.",
  );
  assert.equal(
    result.current.generationError,
    "Password generation failed. Please try again.",
  );
  assert.ok(
    !result.current.generationError.includes("Synthetic random-source failure"),
    "The underlying random-source error was exposed.",
  );
  assert.equal(
    result.current.webCryptoCapability,
    "available",
    "Runtime random-source failure was incorrectly treated as missing Web Crypto.",
  );
});

test("successful generation clears copy feedback and invalidates pending copy results", async () => {
  const fakeTimers = installFakeTimers();
  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());
  await waitForInitialization(() => result.current.isInitialized);

  let initialCopy!: Promise<void>;
  testingLibrary.act(() => {
    initialCopy = result.current.onCopy();
  });
  await testingLibrary.act(async () => {
    await initialCopy;
  });
  assert.equal(result.current.isCopied, true);
  assert.equal(fakeTimers.activeTimerCount(), 1);

  randomControl.fail = true;
  testingLibrary.act(() => {
    result.current.onGenerate();
  });
  assert.equal(result.current.isCopied, true);
  assert.equal(fakeTimers.activeTimerCount(), 1);
  testingLibrary.act(() => {
    fakeTimers.advanceBy(1_999);
  });
  assert.equal(result.current.isCopied, true);
  testingLibrary.act(() => {
    fakeTimers.advanceBy(1);
  });
  assert.equal(result.current.isCopied, false);

  randomControl.fail = false;
  await testingLibrary.act(async () => {
    await result.current.onCopy();
  });
  assert.equal(result.current.isCopied, true);
  assert.equal(fakeTimers.activeTimerCount(), 1);
  const confirmationTimer = fakeTimers.timers[fakeTimers.timers.length - 1];
  await testingLibrary.act(async () => {
    result.current.onGenerate();
  });
  assert.equal(result.current.isCopied, false);
  assert.equal(result.current.copyError, null);
  assert.equal(fakeTimers.activeTimerCount(), 0);
  testingLibrary.act(() => {
    fakeTimers.fire(confirmationTimer);
  });
  assert.equal(result.current.isCopied, false);

  const pendingWrite = deferredClipboardWrite();
  clipboardWriter = () => pendingWrite.promise;
  let pendingCopy!: Promise<void>;
  await testingLibrary.act(async () => {
    pendingCopy = result.current.onCopy();
    // Let onCopy reach its pending clipboard await before generation invalidates it.
    await Promise.resolve();
  });

  randomControl.fail = false;
  await testingLibrary.act(async () => {
    result.current.onGenerate();
  });
  pendingWrite.resolve();
  await testingLibrary.act(async () => {
    await pendingCopy;
  });

  assert.equal(result.current.isCopied, false);
  assert.equal(result.current.copyError, null);
});

test("copy does nothing before initialization or when no password was generated", async () => {
  randomControl.fail = true;
  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());

  const earlyCopy = result.current.onCopy();
  assert.equal(clipboardWrites.length, 0);

  // Await initialization inside act before awaiting this already-resolved no-op.
  await waitForInitialization(() => result.current.isInitialized);
  await earlyCopy;
  await result.current.onCopy();

  assert.equal(result.current.password, null);
  assert.equal(clipboardWrites.length, 0);
});

test("successful copy waits for the service and copies the displayed password", async () => {
  const fakeTimers = installFakeTimers();
  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());
  await waitForInitialization(() => result.current.isInitialized);

  const displayedPassword = result.current.password;
  const pendingWrite = deferredClipboardWrite();
  clipboardWriter = () => pendingWrite.promise;
  let copyPromise!: Promise<void>;
  testingLibrary.act(() => {
    copyPromise = result.current.onCopy();
  });

  assert.equal(result.current.isCopied, false);
  assert.equal(result.current.copyError, null);
  assert.equal(clipboardWrites.length, 1);
  assert.ok(
    clipboardWrites[0] === displayedPassword,
    "The clipboard service did not receive the displayed password.",
  );

  pendingWrite.resolve();
  await testingLibrary.act(async () => {
    await copyPromise;
  });

  assert.equal(result.current.isCopied, true);
  assert.equal(result.current.copyError, null);
  assert.equal(fakeTimers.timers.length, 1);
  assert.equal(fakeTimers.timers[0].delay, 2_000);

  testingLibrary.act(() => {
    fakeTimers.advanceBy(1_999);
  });
  assert.equal(result.current.isCopied, true);
  testingLibrary.act(() => {
    fakeTimers.advanceBy(1);
  });
  assert.equal(result.current.isCopied, false);
  assert.equal(fakeTimers.activeTimerCount(), 0);
});

test("copy failure preserves the password and a new attempt resets its feedback", async () => {
  const fakeTimers = installFakeTimers();
  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());
  await waitForInitialization(() => result.current.isInitialized);

  const displayedPassword = result.current.password;
  clipboardWriter = () =>
    Promise.reject(new Error("Synthetic browser-specific failure."));
  let failedCopy!: Promise<void>;
  testingLibrary.act(() => {
    failedCopy = result.current.onCopy();
  });
  await testingLibrary.act(async () => {
    await failedCopy;
  });

  assert.ok(
    result.current.password === displayedPassword,
    "Copy failure changed the displayed password.",
  );
  assert.equal(
    result.current.copyError,
    "Unable to copy automatically. Select the password and copy it manually.",
  );
  assert.ok(
    !result.current.copyError.includes("Synthetic browser-specific failure"),
    "The underlying clipboard error was exposed.",
  );
  assert.equal(result.current.isCopied, false);
  assert.equal(fakeTimers.timers.length, 0);

  const nextWrite = deferredClipboardWrite();
  clipboardWriter = () => nextWrite.promise;
  let nextCopy!: Promise<void>;
  testingLibrary.act(() => {
    nextCopy = result.current.onCopy();
  });

  assert.equal(result.current.isCopied, false);
  assert.equal(result.current.copyError, null);

  nextWrite.resolve();
  await testingLibrary.act(async () => {
    await nextCopy;
  });
  assert.equal(result.current.isCopied, true);
  assert.equal(fakeTimers.activeTimerCount(), 1);
});

test("a new copy attempt clears its prior timer and stale feedback cannot clear newer success", async () => {
  const fakeTimers = installFakeTimers();
  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());
  await waitForInitialization(() => result.current.isInitialized);

  await testingLibrary.act(async () => {
    await result.current.onCopy();
  });
  const previousTimer = fakeTimers.timers[0];
  assert.equal(result.current.isCopied, true);

  const nextWrite = deferredClipboardWrite();
  clipboardWriter = () => nextWrite.promise;
  let nextCopy!: Promise<void>;
  testingLibrary.act(() => {
    nextCopy = result.current.onCopy();
  });
  assert.equal(previousTimer.cleared, true);
  assert.equal(fakeTimers.activeTimerCount(), 0);
  assert.equal(result.current.isCopied, false);

  nextWrite.resolve();
  await testingLibrary.act(async () => {
    await nextCopy;
  });
  assert.equal(result.current.isCopied, true);
  assert.equal(fakeTimers.activeTimerCount(), 1);

  testingLibrary.act(() => {
    fakeTimers.fire(previousTimer);
  });
  assert.equal(result.current.isCopied, true);
  assert.equal(fakeTimers.activeTimerCount(), 1);
});

test("newer overlapping copy attempts own the final feedback", async () => {
  const { result } = testingLibrary.renderHook(() => usePasswordGenerator());
  await waitForInitialization(() => result.current.isInitialized);

  const firstWrite = deferredClipboardWrite();
  const secondWrite = deferredClipboardWrite();
  const pendingWrites = [firstWrite, secondWrite];
  clipboardWriter = () => {
    const write = pendingWrites.shift();
    assert.ok(write, "Unexpected extra clipboard write.");
    return write.promise;
  };

  let firstCopy!: Promise<void>;
  let secondCopy!: Promise<void>;
  testingLibrary.act(() => {
    firstCopy = result.current.onCopy();
  });
  testingLibrary.act(() => {
    secondCopy = result.current.onCopy();
  });

  secondWrite.resolve();
  await testingLibrary.act(async () => {
    await secondCopy;
  });
  assert.equal(result.current.isCopied, true);

  firstWrite.reject(new Error("Synthetic older write failure."));
  await testingLibrary.act(async () => {
    await firstCopy;
  });

  assert.equal(result.current.isCopied, true);
  assert.equal(result.current.copyError, null);
});

test("a pending clipboard completion after unmount performs no state update", async () => {
  const { result, unmount } = testingLibrary.renderHook(
    () => usePasswordGenerator(),
  );
  await waitForInitialization(() => result.current.isInitialized);

  const pendingWrite = deferredClipboardWrite();
  clipboardWriter = () => pendingWrite.promise;
  let copyPromise!: Promise<void>;
  testingLibrary.act(() => {
    copyPromise = result.current.onCopy();
  });

  unmount();
  pendingWrite.resolve();
  await testingLibrary.act(async () => {
    await copyPromise;
  });
});

test("unmount clears a pending confirmation timer and blocks its callback", async () => {
  const fakeTimers = installFakeTimers();
  let renderCount = 0;
  const { result, unmount } = testingLibrary.renderHook(() => {
    renderCount += 1;
    return usePasswordGenerator();
  });
  await waitForInitialization(() => result.current.isInitialized);

  await testingLibrary.act(async () => {
    await result.current.onCopy();
  });
  const confirmationTimer = fakeTimers.timers[0];
  const rendersBeforeUnmount = renderCount;
  assert.equal(result.current.isCopied, true);
  assert.equal(fakeTimers.activeTimerCount(), 1);

  unmount();
  assert.equal(confirmationTimer.cleared, true);
  assert.equal(fakeTimers.activeTimerCount(), 0);
  testingLibrary.act(() => {
    fakeTimers.fire(confirmationTimer);
  });
  assert.equal(renderCount, rendersBeforeUnmount);
});

test("page supports keyboard workflow, action guards, and accessible feedback", async () => {
  const user = userEvent.setup({ writeToClipboard: false });
  installClipboardMock();
  testingLibrary.render(<Home />);

  const generateButton = requireButton("Generate Password");
  const copyButton = requireButton("Copy password");
  assert.equal(generateButton.disabled, true);
  assert.equal(copyButton.disabled, true);

  await testingLibrary.waitFor(() => {
    assert.ok(!generateButton.disabled, "Generate stayed disabled after initialization.");
    assert.ok(!copyButton.disabled, "Copy stayed disabled after password generation.");
  });

  const passwordRegion = testingLibrary.screen.getByRole("region", {
    name: "Your Password",
  });
  assert.ok(passwordRegion.contains(generateButton));
  assert.ok(passwordRegion.contains(copyButton));
  assert.equal(
    testingLibrary.screen.getAllByRole("button", {
      name: "Generate Password",
    }).length,
    1,
  );

  const extendedLengthsControl = testingLibrary.screen.getByRole("checkbox", {
    name: /^Enable extended password lengths/,
  });
  const lengthInputControl = testingLibrary.screen.getByRole("spinbutton", {
    name: "Password Length",
  });
  const decrementButton = testingLibrary.screen.getByRole("button", {
    name: "Decrease password length",
  });
  const incrementButton = testingLibrary.screen.getByRole("button", {
    name: "Increase password length",
  });
  if (
    !(extendedLengthsControl instanceof dom.window.HTMLInputElement) ||
    !(lengthInputControl instanceof dom.window.HTMLInputElement) ||
    !(decrementButton instanceof dom.window.HTMLButtonElement) ||
    !(incrementButton instanceof dom.window.HTMLButtonElement)
  ) {
    throw new Error("The extended-length checkbox or numeric input is missing.");
  }
  const extendedLengths = extendedLengthsControl;
  const lengthInput = lengthInputControl;
  const initialPassword = displayedPasswordText();
  const randomCallsBeforeLengthChanges = randomControl.calls;

  assert.equal(extendedLengths.checked, false);
  assert.equal(lengthInput.type, "number");
  assert.equal(lengthInput.inputMode, "numeric");
  assert.equal(lengthInput.min, "8");
  assert.equal(lengthInput.max, "40");
  assert.equal(lengthInput.step, "1");
  assert.equal(lengthInput.value, "20");
  assert.ok(testingLibrary.screen.getByText("8 to 40 characters"));

  await user.clear(lengthInput);
  assert.equal(lengthInput.value, "");
  assert.equal(storage.values.has(SETTINGS_STORAGE_KEY), false);
  await user.type(lengthInput, "9");
  testingLibrary.fireEvent.blur(lengthInput);
  assert.equal(lengthInput.value, "9");
  assert.equal(loadLengthFromTestStorage(), 9);

  await user.clear(lengthInput);
  await user.type(lengthInput, "31");
  await user.keyboard("{Enter}");
  assert.equal(lengthInput.value, "31");
  assert.equal(loadLengthFromTestStorage(), 31);

  await user.clear(lengthInput);
  assert.equal(lengthInput.value, "");
  assert.equal(loadLengthFromTestStorage(), 31);
  testingLibrary.fireEvent.blur(lengthInput);
  assert.equal(lengthInput.value, "31");

  await user.clear(lengthInput);
  await user.type(lengthInput, "7");
  assert.equal(lengthInput.getAttribute("aria-invalid"), "true");
  await user.keyboard("{Enter}");
  assert.equal(lengthInput.value, "31");
  assert.equal(loadLengthFromTestStorage(), 31);

  await user.clear(lengthInput);
  await user.type(lengthInput, "41");
  await user.keyboard("{Enter}");
  assert.equal(lengthInput.value, "31");
  assert.equal(loadLengthFromTestStorage(), 31);

  await user.clear(lengthInput);
  await user.type(lengthInput, "32");
  await user.click(incrementButton);
  assert.equal(lengthInput.value, "33");
  await user.click(decrementButton);
  assert.equal(lengthInput.value, "32");
  incrementButton.focus();
  await user.keyboard("{Enter}");
  assert.equal(lengthInput.value, "33");
  decrementButton.focus();
  await user.keyboard(" ");
  assert.equal(lengthInput.value, "32");

  await user.clear(lengthInput);
  await user.type(lengthInput, "8");
  await user.keyboard("{Enter}");
  assert.equal(decrementButton.disabled, true);
  assert.equal(incrementButton.disabled, false);

  await user.clear(lengthInput);
  await user.type(lengthInput, "40");
  await user.keyboard("{Enter}");
  assert.equal(incrementButton.disabled, true);

  await user.click(extendedLengths);
  assert.equal(lengthInput.max, "128");
  assert.ok(testingLibrary.screen.getByText("8 to 128 characters"));
  await user.clear(lengthInput);
  await user.type(lengthInput, "128");
  await user.keyboard("{Enter}");
  assert.equal(lengthInput.value, "128");
  assert.equal(incrementButton.disabled, true);
  assert.equal(decrementButton.disabled, false);

  lengthInput.focus();
  await user.click(extendedLengths);
  assert.equal(extendedLengths.checked, false);
  assert.equal(lengthInput.max, "40");
  assert.equal(lengthInput.value, "40");

  const lengthBeforeRestore = lengthInput.value;
  assert.equal(loadLengthFromTestStorage(), Number(lengthBeforeRestore));
  assert.equal(randomControl.calls, randomCallsBeforeLengthChanges);
  assert.ok(
    displayedPasswordText() === initialPassword,
    "Changing password length replaced the displayed password.",
  );

  await user.click(requireButton("Restore Defaults"));
  assert.equal(extendedLengths.checked, false);
  assert.equal(lengthInput.max, "40");
  assert.equal(lengthInput.value, "20");
  assert.equal(loadLengthFromTestStorage(), DEFAULT_CONFIGURATION.length);

  const feedbackRegion = dom.window.document.querySelector(
    '[aria-label="Application feedback"]',
  );
  assert.ok(feedbackRegion, "The application feedback region is missing.");
  assert.equal(feedbackRegion.getAttribute("aria-live"), "polite");

  await user.clear(lengthInput);
  await user.type(lengthInput, String(DEFAULT_CONFIGURATION.length + 1));
  testingLibrary.fireEvent.blur(lengthInput);
  assert.equal(lengthInput.value, String(DEFAULT_CONFIGURATION.length + 1));
  assert.ok(
    displayedPasswordText() === initialPassword,
    "Changing configuration replaced the displayed password.",
  );

  await user.click(copyButton);
  await testingLibrary.waitFor(() => {
    assert.ok(copyButton.textContent?.trim() === "Copied!", "Copy success was not shown.");
  });
  assert.equal(clipboardWrites.length, 1);
  assert.ok(
    clipboardWrites[0] === initialPassword,
    "The page did not copy the password currently on display.",
  );

  for (const label of [
    "Uppercase letters",
    "Lowercase letters",
    "Numbers",
    "Symbols",
  ]) {
    const checkbox = testingLibrary.screen.queryByRole("checkbox", {
      name: label,
    });
    if (
      !(checkbox instanceof dom.window.HTMLInputElement) ||
      !checkbox.checked
    ) {
      throw new Error(`The checked "${label}" control is missing.`);
    }
    await user.click(checkbox);
  }

  assert.ok(
    testingLibrary.screen.queryByText(
      "Configuration error: Select at least one character category.",
    ),
    "Invalid configuration feedback was not shown.",
  );
  assert.equal(generateButton.disabled, true);
  assert.equal(copyButton.disabled, false);

  const restoreButton = requireButton("Restore Defaults");
  await user.click(restoreButton);
  assert.ok(
    !testingLibrary.screen.queryByText(
      "Configuration error: Select at least one character category.",
    ),
    "Restore Defaults did not clear validation feedback.",
  );
  assert.equal(generateButton.disabled, false);
  assert.ok(
    displayedPasswordText() === initialPassword,
    "Restore Defaults replaced the displayed password.",
  );

  randomControl.fail = true;
  generateButton.focus();
  await user.keyboard("{Enter}");
  assert.ok(
    testingLibrary.screen.queryByText(
      "Password generation failed. Please try again.",
    ),
    "Generation failure feedback was not shown.",
  );
  assert.ok(
    displayedPasswordText() === initialPassword,
    "Generation failure replaced the displayed password.",
  );

  randomControl.fail = false;
  await user.keyboard("{Enter}");
  assert.ok(
    !testingLibrary.screen.queryByText(
      "Password generation failed. Please try again.",
    ),
    "Successful generation did not clear its error.",
  );
  const passwordBeforeCopyError = displayedPasswordText();

  clipboardWriter = () =>
    Promise.reject(new Error("Synthetic browser-specific failure."));
  copyButton.focus();
  await user.keyboard("{Enter}");
  await testingLibrary.waitFor(() => {
    assert.ok(
      testingLibrary.screen.queryByText(
        "Unable to copy automatically. Select the password and copy it manually.",
      ),
      "Clipboard failure feedback was not shown.",
    );
  });
  assert.ok(
    displayedPasswordText() === passwordBeforeCopyError,
    "Clipboard failure replaced the displayed password.",
  );

  clipboardWriter = () => Promise.resolve();
  await user.keyboard("{Enter}");
  await testingLibrary.waitFor(() => {
    assert.ok(
      copyButton.textContent?.trim() === "Copied!",
      "Successful retry did not update the Copy button.",
    );
  });
  assert.ok(
    !testingLibrary.screen.queryByText(
      "Unable to copy automatically. Select the password and copy it manually.",
    ),
    "Successful copy did not clear its previous error.",
  );

  storage.failWrites = true;
  await user.clear(lengthInput);
  await user.type(lengthInput, String(DEFAULT_CONFIGURATION.length + 2));
  await user.keyboard("{Enter}");
  assert.ok(
    testingLibrary.screen.queryByText(
      "Settings won't be saved on this device. Your current settings will remain active until you close or reload the application.",
    ),
    "Settings persistence warning was not shown.",
  );
  assert.ok(
    displayedPasswordText() === passwordBeforeCopyError,
    "Changing settings replaced the displayed password.",
  );
});

test("page keeps Copy disabled after initial failure and allows keyboard recovery", async () => {
  randomControl.fail = true;
  const user = userEvent.setup({ writeToClipboard: false });
  installClipboardMock();
  testingLibrary.render(<Home />);

  const generateButton = requireButton("Generate Password");
  const copyButton = requireButton("Copy password");

  await testingLibrary.waitFor(() => {
    assert.ok(!generateButton.disabled, "Generate did not enable after initialization.");
  });
  assert.equal(copyButton.disabled, true);
  assert.ok(
    testingLibrary.screen.queryByText(
      "Password generation failed. Please try again.",
    ),
    "The initial generation error was not shown.",
  );

  randomControl.fail = false;
  generateButton.focus();
  await user.keyboard("{Enter}");
  await testingLibrary.waitFor(() => {
    assert.ok(!copyButton.disabled, "Copy did not enable after successful generation.");
  });
  assert.ok(
    !testingLibrary.screen.queryByText(
      "Password generation failed. Please try again.",
    ),
    "A successful retry did not clear the initial generation error.",
  );

  await user.click(copyButton);
  await testingLibrary.waitFor(() => {
    assert.ok(
      copyButton.textContent?.trim() === "Copied!",
      "Copy did not succeed after password generation recovered.",
    );
  });
});

test("page disables generation and offers capability retry when Web Crypto is unavailable", async () => {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: undefined,
  });

  const user = userEvent.setup({ writeToClipboard: false });
  testingLibrary.render(<Home />);

  const generateButton = requireButton("Generate Password");
  assert.equal(generateButton.disabled, true);

  await testingLibrary.waitFor(() => {
    assert.ok(
      testingLibrary.screen.queryByText(
        "Secure password generation is unavailable in this browser.",
      ),
      "The unavailable capability message was not shown.",
    );
  });

  const retryButton = requireButton("Retry Secure Password Generation");
  assert.equal(generateButton.disabled, true);

  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      getRandomValues(array: Uint32Array): Uint32Array {
        randomControl.calls += 1;
        array.fill(0);
        return array;
      },
    },
  });

  await user.click(retryButton);
  await testingLibrary.waitFor(() => {
    assert.equal(generateButton.disabled, false);
  });
  assert.ok(
    testingLibrary.screen.queryByText(
      "Secure password generation is unavailable in this browser.",
    ) === null,
    "The unavailable capability message remained after recovery.",
  );
  assert.equal(requireButton("Copy password").disabled, false);
});
