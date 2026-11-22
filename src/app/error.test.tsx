/**
 * Component tests for the App Router error fallback.
 *
 * The Node test runner and JSDOM provide browser globals for React Testing
 * Library. A small React boundary harness activates the same fallback contract
 * that Next.js uses: a child render exception supplies an error and a reset
 * callback. The tests keep exception diagnostics local and replace the browser
 * reload API with an isolated spy so they never navigate the test document.
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
import { Component, type ReactNode } from "react";

import ErrorFallback from "./error";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://password-generator.test/",
  pretendToBeVisual: true,
});

/** Browser globals installed for React DOM and restored after each test. */
const browserGlobalNames = [
  "window",
  "self",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLButtonElement",
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

const originalBrowserGlobalDescriptors = new Map<
  string,
  PropertyDescriptor | undefined
>();
for (const name of browserGlobalNames) {
  originalBrowserGlobalDescriptors.set(
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  );
}

let testingLibrary!: typeof import("@testing-library/react");

/** Error state used by the test-only boundary harness. */
interface ErrorBoundaryState {
  /** The child failure to pass to the route fallback, or null before a failure. */
  error: unknown | null;
}

/**
 * Minimal React boundary used to activate the route fallback in isolation.
 *
 * Next.js owns the production App Router boundary; this harness uses React's
 * standard derived-error lifecycle to verify that a render failure reaches
 * the fallback with the expected props, without requiring a running Next.js
 * server or router.
 */
class ErrorBoundaryHarness extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  /**
   * Saves a descendant render failure so the next render can show the fallback.
   *
   * @param error - Value thrown while rendering a child.
   * @returns State containing that error for the fallback contract.
   */
  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error };
  }

  /** Clears the harness failure state, matching the reset callback contract. */
  reset = () => this.setState({ error: null });

  /**
   * Renders children until one fails, then delegates to the production fallback.
   *
   * @returns The child tree or the error fallback.
   */
  render() {
    if (this.state.error !== null) {
      return <ErrorFallback error={this.state.error} reset={this.reset} />;
    }

    return this.props.children;
  }
}

/**
 * Installs the JSDOM browser APIs required by React Testing Library.
 *
 * This helper changes process globals; test hooks restore their original
 * property descriptors after each case to prevent cross-test contamination.
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
 * Restores a global property exactly, including whether it was an accessor.
 *
 * @param target - Object whose property was replaced for a test.
 * @param name - Property key to restore or remove.
 * @param descriptor - Original descriptor, or undefined if the property was absent.
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

/** Load DOM-aware testing helpers only after their browser globals exist. */
before(async () => {
  installBrowserGlobals();
  testingLibrary = await import("@testing-library/react");
});

/** Reinstall the DOM globals after each test's cleanup restored the host values. */
beforeEach(installBrowserGlobals);

/** Unmount React trees and restore every browser global after each test. */
afterEach(() => {
  testingLibrary.cleanup();
  for (const name of browserGlobalNames) {
    restoreProperty(
      globalThis,
      name,
      originalBrowserGlobalDescriptors.get(name),
    );
  }
});

/** Close the isolated JSDOM window when the Node test file has completed. */
after(() => {
  dom.window.close();
});

/** Verify a real child render exception activates the fallback without leaking details. */
test("renders a generic fallback when the error boundary catches a render failure", () => {
  const internalError = new Error("internal-render-message");
  internalError.stack = "internal-render-stack";
  Object.assign(internalError, {
    digest: "internal-error-digest",
    password: "sensitive-application-state",
  });

  /** Throws during render so React activates the surrounding boundary. */
  function CrashingChild(): React.JSX.Element {
    throw internalError;
  }

  // React reports caught render errors to the console in tests; suppress that
  // diagnostic only while triggering this synthetic failure.
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    testingLibrary.render(
      <ErrorBoundaryHarness>
        <CrashingChild />
      </ErrorBoundaryHarness>,
    );
  } finally {
    console.error = originalConsoleError;
  }

  const { getByRole } = testingLibrary.screen;
  assert.ok(getByRole("main", { name: "Something went wrong" }));
  assert.ok(getByRole("button", { name: "Try again" }));
  assert.ok(getByRole("button", { name: "Reload application" }));

  const fallbackText = document.body.textContent ?? "";
  assert.doesNotMatch(fallbackText, /internal-render-message/);
  assert.doesNotMatch(fallbackText, /internal-render-stack/);
  assert.doesNotMatch(fallbackText, /internal-error-digest/);
  assert.doesNotMatch(fallbackText, /sensitive-application-state/);
});

/** Verify the retry button delegates recovery to the boundary's reset callback. */
test("invokes the supplied reset callback when the user retries", () => {
  let resetCount = 0;
  testingLibrary.render(
    <ErrorFallback error={new Error("private detail")} reset={() => resetCount++} />,
  );

  testingLibrary.screen.getByRole("button", { name: "Try again" }).click();

  assert.equal(resetCount, 1);
});

/** Verify reload behavior using a temporary window stub instead of real navigation. */
test("reload action reloads the application without changing the jsdom location", () => {
  let reloadCount = 0;
  testingLibrary.render(
    <ErrorFallback error={new Error("private detail")} reset={() => undefined} />,
  );

  const originalWindowDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "window",
  );
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        reload() {
          reloadCount += 1;
        },
      },
    },
  });

  try {
    testingLibrary.screen
      .getByRole("button", { name: "Reload application" })
      .click();
  } finally {
    restoreProperty(globalThis, "window", originalWindowDescriptor);
  }

  assert.equal(reloadCount, 1);
});
