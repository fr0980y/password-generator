/**
 * Browser Clipboard API adapter in the application's services layer.
 *
 * Application coordination code should call `copyToClipboard` after an
 * explicit user action. The service writes the supplied text directly through
 * `navigator.clipboard.writeText()` and does not read, log, retain, or persist
 * it. It has no React dependency and uses no DOM-based fallback.
 *
 * Browser globals are inspected only when the function is invoked, rather
 * than during module initialization, so importing this module is safe during
 * Next.js server rendering.
 *
 * @example
 * ```ts
 * import { copyToClipboard } from "./clipboard";
 *
 * await copyToClipboard(displayedPassword);
 * ```
 */

/**
 * Writes a non-empty string to the operating system clipboard.
 *
 * The Clipboard API may be unavailable, such as in an insecure context, or
 * reject a write because of browser permission policy. No fallback is
 * attempted; failures are normalized so browser error details cannot expose
 * the supplied text.
 *
 * @param text - Exact string to place on the clipboard; an empty string is
 *   rejected without accessing the browser API.
 * @returns A promise that resolves after the browser confirms the write.
 * @throws {Error} If the input is empty, the API is unavailable, or the write
 *   fails. Error messages are generic and never include `text`.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (text.length === 0) {
    throw new Error("Cannot copy empty text.");
  }

  if (typeof navigator === "undefined") {
    throw new Error("Clipboard API is unavailable.");
  }

  let clipboard: Clipboard | undefined;
  let writeTextAvailable = false;
  try {
    clipboard = navigator.clipboard;
    if (clipboard && typeof clipboard.writeText === "function") {
      writeTextAvailable = true;
    }
  } catch {
    throw new Error("Clipboard API is unavailable.");
  }

  if (!clipboard || !writeTextAvailable) {
    throw new Error("Clipboard API is unavailable.");
  }

  // Browsers report permission and secure-context failures differently;
  // replace browser-specific errors with a generic error that cannot contain
  // the copied value.
  try {
    await clipboard.writeText(text);
  } catch {
    throw new Error("Clipboard write failed.");
  }
}
