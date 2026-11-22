/**
 * User-facing regression tests for the static About/Privacy disclosure.
 *
 * This component test renders `AboutPrivacy` with React Testing Library under
 * JSDOM, then checks the rendered copy rather than CSS classes or layout. The
 * component is presentation-only, so the fixture needs no application hooks,
 * browser services, network access, or generated password data.
 *
 * JSDOM is installed explicitly because these tests run with Node's built-in
 * test runner instead of a browser test environment. The test script in
 * `package.json` bundles this TSX file and its CSS Module before invoking
 * `node --test`.
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

import { AboutPrivacy } from "./about-privacy";

/** A single isolated DOM window shared by this test file's sequential cases. */
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://password-generator.test/",
  pretendToBeVisual: true,
});

/** Browser globals React DOM reads while rendering in the Node process. */
const browserGlobalNames = [
  "window",
  "self",
  "document",
  "navigator",
  "HTMLElement",
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

/**
 * Original descriptors let each test restore the host process exactly,
 * including removing globals that were absent before JSDOM was installed.
 */
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

/** Loaded after browser globals are installed so DOM-aware helpers initialize consistently. */
let testingLibrary!: typeof import("@testing-library/react");

/**
 * Exposes this file's JSDOM window through the global names React DOM expects.
 *
 * The helper replaces properties as configurable globals so the after-each
 * cleanup can restore their original descriptors even when Node supplied an
 * accessor or no property at all.
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
 * Restores a saved global-property descriptor or removes the temporary property.
 *
 * @param target - Object from which the property was read.
 * @param name - Global property key to restore or remove.
 * @param descriptor - Original property descriptor, or `undefined` if absent.
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

/** Load React Testing Library only after its required DOM globals are available. */
before(async () => {
  installBrowserGlobals();
  testingLibrary = await import("@testing-library/react");
});

/** Reinstall the fixture globals after the previous test restored the host state. */
beforeEach(installBrowserGlobals);

/** Unmount each render, then return the Node process globals to their initial state. */
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

/** Close the JSDOM window after Node has finished running this test file. */
after(() => {
  dom.window.close();
});

/** Verifies that the rendered disclosure distinguishes generation from preference storage. */
test("discloses local password generation and preference storage", () => {
  testingLibrary.render(<AboutPrivacy />);

  const disclosureText = document.body.textContent ?? "";
  assert.ok(testingLibrary.screen.getByText("About / Privacy"));
  assert.match(
    disclosureText,
    /generated locally in your browser using the browser's Web Crypto API/i,
  );
  assert.match(
    disclosureText,
    /does not send passwords to the application server or third parties/i,
  );
  assert.match(
    disclosureText,
    /not saved in application storage.*does not keep password history/i,
  );
  assert.match(
    disclosureText,
    /preferences may be saved in this browser's localStorage.*do not include generated passwords/i,
  );
});

/** Verifies the no-tracking statement, external collection caveat, and device limitations. */
test("explains tracking and local-device privacy limitations", () => {
  testingLibrary.render(<AboutPrivacy />);

  const disclosureText = document.body.textContent ?? "";
  assert.match(
    disclosureText,
    /does not use accounts, analytics, advertising, tracking, or behavioral telemetry/i,
  );
  assert.match(
    disclosureText,
    /browser or hosting provider may collect information outside the application's control/i,
  );
  assert.match(
    disclosureText,
    /malware, malicious browser extensions, compromised browsers or operating systems, keyloggers, or screen capture/i,
  );
  assert.match(
    disclosureText,
    /physical access to an unlocked device may be able to see information displayed/i,
  );
});

/** Verifies that copy and offline-use caveats match the application's boundaries. */
test("sets accurate expectations for copying and offline use", () => {
  testingLibrary.render(<AboutPrivacy />);

  const disclosureText = document.body.textContent ?? "";
  assert.match(disclosureText, /copying a password is an explicit action/i);
  assert.match(
    disclosureText,
    /cannot control clipboard history, synchronization, retention, or access by other applications/i,
  );
  assert.match(
    disclosureText,
    /can work offline after its required resources have been cached/i,
  );
  assert.match(disclosureText, /offline availability depends on your browser/i);
});
