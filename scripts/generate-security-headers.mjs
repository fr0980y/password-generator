/**
 * Builds Cloudflare Pages security headers for the completed Next.js export.
 *
 * The build invokes this module after both `next build` and Serwist so the CSP
 * hashes cover the final HTML files. It exports scanner, formatter, and build
 * helpers for the Node.js tests; running `node scripts/generate-security-headers.mjs`
 * generates `out/_headers` relative to this file rather than the caller's
 * working directory.
 *
 * Example:
 *   import { generateSecurityHeaders } from "./generate-security-headers.mjs";
 *   await generateSecurityHeaders("out");
 *
 * The small built-in scanner handles the HTML constructs emitted by the static
 * export without adding a parser dependency. It is not intended as a general
 * purpose HTML parser. Script contents are hashed but never printed.
 *
 * @module generate-security-headers
 */
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Locate the default export independently of the process's current directory. */
const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
const defaultExportDirectory = resolve(scriptDirectory, "../out");
/** Match only actual HTML `script` tag-name boundaries, not names like `script-widget`. */
const scriptElementStart = /<script(?=[\t\n\f\r />])((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
/** HTML treats a valid `</script>` end tag as the end of script text, even inside JS strings. */
const scriptElementEnd = /<\/script(?=[\s/>])[^>]*>/gi;
/** These elements contain text rather than markup, so apparent script tags inside are ignored. */
const rawTextElements = new Set([
  "iframe",
  "noembed",
  "noframes",
  "noscript",
  "plaintext",
  "style",
  "textarea",
  "title",
  "xmp",
]);

/**
 * Finds the end of an opening HTML tag without mistaking a quoted `>` for its
 * delimiter.
 *
 * @param {string} html Full HTML source being scanned.
 * @param {number} startIndex First character after the parsed tag name.
 * @returns {number} Index of the unquoted `>`, or `-1` if the tag is incomplete.
 */
function findTagEnd(html, startIndex) {
  let quote = null;

  for (let index = startIndex; index < html.length; index += 1) {
    const character = html[index];

    if (quote !== null) {
      if (character === quote) {
        quote = null;
      }
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index;
    }
  }

  return -1;
}

/**
 * Checks an opening tag's attribute text while skipping quoted and unquoted
 * values. Attribute names are case-insensitive, and boolean attributes count.
 *
 * @param {string} attributes Text between the tag name and closing `>`.
 * @param {string} requestedName Attribute name to find.
 * @returns {boolean} Whether the opening tag contains the requested attribute.
 */
function hasAttribute(attributes, requestedName) {
  let index = 0;

  while (index < attributes.length) {
    while (
      index < attributes.length &&
      (/[\t\n\f\r ]/.test(attributes[index]) || attributes[index] === "/")
    ) {
      index += 1;
    }

    const nameStart = index;
    while (
      index < attributes.length &&
      !/[\t\n\f\r "'<>/=]/.test(attributes[index])
    ) {
      index += 1;
    }

    if (nameStart === index) {
      index += 1;
      continue;
    }

    const name = attributes.slice(nameStart, index).toLowerCase();
    while (index < attributes.length && /[\t\n\f\r ]/.test(attributes[index])) {
      index += 1;
    }

    if (attributes[index] === "=") {
      index += 1;
      while (index < attributes.length && /[\t\n\f\r ]/.test(attributes[index])) {
        index += 1;
      }

      const quote = attributes[index];
      if (quote === '"' || quote === "'") {
        index += 1;
        while (index < attributes.length && attributes[index] !== quote) {
          index += 1;
        }
        index += 1;
      } else {
        while (index < attributes.length && !/[\t\n\f\r >]/.test(attributes[index])) {
          index += 1;
        }
      }
    }

    if (name === requestedName) {
      return true;
    }
  }

  return false;
}

/**
 * Locates the close of an HTML raw-text element.
 *
 * `plaintext` consumes the rest of the document and therefore has no closing
 * tag for this scanner to find.
 *
 * @param {string} html Full HTML source being scanned.
 * @param {string} tagName Lowercase raw-text tag name.
 * @param {number} startIndex First character after its opening tag.
 * @returns {RegExpExecArray | null} The closing tag match, or `null` if absent.
 */
function findClosingRawTextElement(html, tagName, startIndex) {
  if (tagName === "plaintext") {
    return null;
  }

  const closingTag = new RegExp(`</${tagName}(?=[\\s/>])[^>]*>`, "gi");
  closingTag.lastIndex = startIndex;
  return closingTag.exec(html);
}

/**
 * Extracts SHA-256 hashes for inline script elements in static-export HTML.
 *
 * The scanner skips comments and raw-text elements, recognizes quoted tag
 * attributes, and excludes any script element that has a `src` attribute.
 * Before scanning, it applies the browser's HTML input normalization: CRLF and
 * CR become LF, and null code points become U+FFFD. HTML character references
 * inside script data are intentionally left untouched.
 *
 * @param {string} source HTML document text decoded from the UTF-8 export.
 * @param {string} [sourceName="HTML"] File label used in malformed-script errors.
 * @returns {string[]} Base64 SHA-256 digests, in document order; duplicates are retained.
 * @throws {Error} If an opening script element has no matching end tag.
 */
export function extractInlineScriptHashes(source, sourceName = "HTML") {
  const html = source.replace(/\r\n?/g, "\n").replace(/\0/g, "\uFFFD");
  const hashes = [];
  let index = 0;

  while (index < html.length) {
    const tagStart = html.indexOf("<", index);
    if (tagStart < 0) {
      break;
    }

    if (html.startsWith("<!--", tagStart)) {
      const commentEnd = html.indexOf("-->", tagStart + 4);
      if (commentEnd < 0) {
        break;
      }
      index = commentEnd + 3;
      continue;
    }

    const openingScript = scriptElementStart;
    openingScript.lastIndex = tagStart;
    const scriptMatch = openingScript.exec(html);
    if (scriptMatch?.index === tagStart) {
      const openingTagEnd = openingScript.lastIndex;
      const closingTag = scriptElementEnd;
      closingTag.lastIndex = openingTagEnd;
      const closingMatch = closingTag.exec(html);

      if (!closingMatch) {
        throw new Error(`Unterminated inline script element in ${sourceName}.`);
      }

      if (!hasAttribute(scriptMatch[1], "src")) {
        const content = html.slice(openingTagEnd, closingMatch.index);
        hashes.push(
          createHash("sha256").update(content, "utf8").digest("base64"),
        );
      }

      index = closingTag.lastIndex;
      continue;
    }

    const tagNameMatch = /^<([A-Za-z][A-Za-z0-9:-]*)\b/.exec(html.slice(tagStart));
    if (!tagNameMatch) {
      index = tagStart + 1;
      continue;
    }

    const tagName = tagNameMatch[1].toLowerCase();
    const openingTagEnd = findTagEnd(html, tagStart + tagNameMatch[0].length);
    if (openingTagEnd < 0) {
      break;
    }

    const isClosingTag = html[tagStart + 1] === "/";
    if (!isClosingTag && rawTextElements.has(tagName)) {
      const closingMatch = findClosingRawTextElement(
        html,
        tagName,
        openingTagEnd + 1,
      );
      if (!closingMatch) {
        break;
      }
      index = closingMatch.index + closingMatch[0].length;
      continue;
    }

    index = openingTagEnd + 1;
  }

  return hashes;
}

/**
 * Recursively lists regular `.html` files beneath the export directory.
 *
 * @param {string} directory Directory to inspect.
 * @returns {Promise<string[]>} Absolute paths to discovered HTML files.
 * @throws {Error} If a directory cannot be read; the original filesystem error
 *   is retained as the cause so callers can diagnose the failure.
 */
async function findHtmlFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Unable to read export directory "${directory}".`, {
      cause: error,
    });
  }

  const files = [];
  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findHtmlFiles(entryPath)));
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".html") {
      files.push(entryPath);
    }
  }

  return files;
}

/**
 * Formats the generated CSP and other response headers as a Cloudflare Pages
 * `_headers` file. Hash inputs are bare Base64 digests, not CSP tokens.
 *
 * @param {string[]} scriptHashes Base64 SHA-256 digests from exported HTML.
 * @returns {string} Complete `_headers` contents with one wildcard path rule.
 * @throws {Error} If no script hashes are supplied, since an empty source list
 *   would fail to authorize the generated inline bootstrap scripts.
 */
export function createHeadersContent(scriptHashes) {
  const sortedHashes = [...new Set(scriptHashes)].sort();
  if (sortedHashes.length === 0) {
    throw new Error("Cannot generate the CSP without inline script hashes.");
  }

  const contentSecurityPolicy = [
    "default-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' ${sortedHashes.map((hash) => `'sha256-${hash}'`).join(" ")}`,
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
  ].join("; ");

  return [
    "/*",
    `  Content-Security-Policy: ${contentSecurityPolicy}`,
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: no-referrer",
    "  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-read=(self), clipboard-write=(self)",
    "  X-Frame-Options: DENY",
    "  Strict-Transport-Security: max-age=31536000",
    "",
  ].join("\n");
}

/**
 * Generates `out/_headers` from every HTML file in a completed static export.
 *
 * The build calls this after Next.js and Serwist so the hashes match the final
 * HTML rather than an intermediate export. Tests may pass a temporary export
 * directory; omitting the argument uses `out/` beside this script.
 *
 * @param {string} [exportDirectory=defaultExportDirectory] Export directory to scan.
 * @returns {Promise<{ headersFile: string, htmlFileCount: number, scriptHashCount: number }>}
 *   The generated file path and counts useful for build diagnostics.
 * @throws {Error} If the directory or any HTML file cannot be read, no HTML or
 *   inline scripts are found, or the generated header file cannot be written.
 */
export async function generateSecurityHeaders(
  exportDirectory = defaultExportDirectory,
) {
  const absoluteExportDirectory = resolve(exportDirectory);
  const htmlFiles = await findHtmlFiles(absoluteExportDirectory);

  if (htmlFiles.length === 0) {
    throw new Error(`No exported HTML files were found in "${absoluteExportDirectory}".`);
  }

  htmlFiles.sort();
  const scriptHashes = [];
  for (const htmlFile of htmlFiles) {
    let html;
    try {
      html = await readFile(htmlFile, "utf8");
    } catch (error) {
      throw new Error(`Unable to read exported HTML file "${htmlFile}".`, {
        cause: error,
      });
    }
    scriptHashes.push(...extractInlineScriptHashes(html, htmlFile));
  }

  const uniqueHashes = [...new Set(scriptHashes)].sort();
  if (uniqueHashes.length === 0) {
    throw new Error(
      `No inline scripts were found in the exported HTML under "${absoluteExportDirectory}".`,
    );
  }

  const headersFile = join(absoluteExportDirectory, "_headers");
  try {
    await writeFile(headersFile, createHeadersContent(uniqueHashes), "utf8");
  } catch (error) {
    throw new Error(`Unable to write Cloudflare security headers to "${headersFile}".`, {
      cause: error,
    });
  }

  return { headersFile, htmlFileCount: htmlFiles.length, scriptHashCount: uniqueHashes.length };
}

// Keep imports side-effect-free for tests; perform file generation only when
// this module is the command launched by Node.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await generateSecurityHeaders();
    console.log(
      `Generated ${result.headersFile} from ${result.htmlFileCount} HTML files with ${result.scriptHashCount} unique script hashes.`,
    );
  } catch (error) {
    console.error("Security header generation failed.", error);
    process.exitCode = 1;
  }
}
