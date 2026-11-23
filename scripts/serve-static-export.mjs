/**
 * Serves the built Next.js static export for local Playwright tests.
 *
 * The build writes route HTML and browser assets to `out/`. This lightweight
 * Node.js server reads those files directly, without running `next dev` or a
 * Next.js application server. Playwright starts and stops it through the
 * `webServer` setting in `playwright.config.ts`.
 *
 * Routes resolve to the matching asset, a `.html` export, or an `index.html`
 * in a route directory. Security headers come exclusively from the generated
 * `out/_headers` file, using only the small Cloudflare path-rule subset this
 * test server needs. The module exports parser, matcher, and handler factories
 * primarily for focused Node.js tests; running it directly starts the server.
 * For example, run `npm run build`, then
 * `node scripts/serve-static-export.mjs`.
 *
 * This is test infrastructure, not a production server. It binds only to
 * loopback, serves read-only `GET` and `HEAD` requests, and refuses paths
 * outside `out/`. Startup fails explicitly if the export or generated header
 * file cannot be loaded, preventing Playwright from running without the
 * production-like security configuration.
 *
 * @module serve-static-export
 * @example
 * // Production use: run the module directly.
 * // node scripts/serve-static-export.mjs
 * @example
 * // Focused tests: construct the HTTP handler with controlled dependencies.
 * import { createRequestHandler } from "./serve-static-export.mjs";
 * const handler = createRequestHandler({
 *   readExportFile: async () => null,
 *   headerRules: [],
 * });
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute export path derived from this script, independent of the caller's working directory. */
const exportDirectory = resolve(fileURLToPath(new URL("../out/", import.meta.url)));
/** Restricts the development server to the local machine. */
const host = "127.0.0.1";
/** Fixed port shared with the Playwright `baseURL`. */
const port = 4173;
/** Filesystem errors that mean a route candidate is absent or not a regular file. */
const missingFileCodes = new Set(["ENOENT", "ENOTDIR", "EISDIR"]);
/** MIME types needed by the exported page, its assets, and the generated service worker. */
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

/**
 * Parses the subset of Cloudflare Pages `_headers` syntax emitted and consumed
 * by this project's static export: exact path rules and trailing `/*` rules.
 *
 * @param {string} source Complete `_headers` file contents.
 * @returns {{ path: string, headers: Map<string, string> }[]} Ordered path rules.
 * @throws {Error} If a rule or header line is malformed.
 */
export function parseHeadersFile(source) {
  const rules = [];
  let currentRule = null;

  for (const [lineIndex, line] of source.split(/\r?\n/).entries()) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      continue;
    }

    if (!/^\s/.test(line)) {
      if (!line.startsWith("/")) {
        throw new Error(`Malformed _headers path rule on line ${lineIndex + 1}.`);
      }
      const wildcardCount = (line.match(/\*/g) ?? []).length;
      if (
        wildcardCount > 0 &&
        (wildcardCount !== 1 || !line.endsWith("/*"))
      ) {
        throw new Error(`Unsupported _headers wildcard on line ${lineIndex + 1}.`);
      }

      currentRule = { path: line.trim(), headers: new Map() };
      rules.push(currentRule);
      continue;
    }

    if (currentRule === null) {
      throw new Error(`Malformed _headers header on line ${lineIndex + 1}: no path rule.`);
    }

    const separator = line.indexOf(":");
    if (separator < 1) {
      throw new Error(`Malformed _headers header on line ${lineIndex + 1}.`);
    }

    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name) || value === "") {
      throw new Error(`Malformed _headers header on line ${lineIndex + 1}.`);
    }

    currentRule.headers.set(name.toLowerCase(), value);
  }

  if (rules.length === 0) {
    throw new Error("The generated out/_headers file contains no path rules.");
  }

  return rules;
}

/**
 * Returns whether a Cloudflare path rule matches a decoded URL pathname.
 *
 * Exact rules must match the entire pathname. A terminal `/*` rule matches a
 * pathname beginning with the rule prefix; path-specific matching is disabled
 * when no pathname is available so callers cannot accidentally invent a route.
 *
 * @param {string} rulePath Cloudflare path rule from the parsed header file.
 * @param {string | undefined} pathname Decoded request pathname, if available.
 * @returns {boolean} Whether the rule should contribute headers.
 */
export function matchesHeaderRule(rulePath, pathname) {
  if (typeof pathname !== "string" || pathname.length === 0) {
    return rulePath === "/*";
  }

  if (rulePath.endsWith("/*")) {
    const prefix = rulePath.slice(0, -1);
    return pathname.startsWith(prefix);
  }

  return rulePath === pathname;
}

/**
 * Applies matching generated headers from most general to most specific.
 *
 * Header values are accumulated in Cloudflare-style precedence order: exact
 * and wildcard rules matching a valid pathname are sorted by path length.
 * If the pathname is unavailable, only the catch-all `/*` rule is considered.
 *
 * @param {{ path: string, headers: Map<string, string> }[]} rules Parsed header rules.
 * @param {string | null | undefined} pathname Decoded request pathname, if available.
 * @returns {Record<string, string>} Header names and values suitable for `response.writeHead`.
 * @throws {never} This function does not throw for missing or invalid pathnames.
 */
export function getResponseHeaders(rules, pathname) {
  const headers = new Map();
  const pathnameIsAvailable =
    typeof pathname === "string" && pathname.length > 0;
  const matchingRules = rules
    .filter((rule) =>
      pathnameIsAvailable
        ? matchesHeaderRule(rule.path, pathname)
        : rule.path === "/*",
    )
    .sort((left, right) => left.path.length - right.path.length);

  for (const rule of matchingRules) {
    for (const [name, value] of rule.headers) {
      headers.set(name, value);
    }
  }

  return Object.fromEntries(
    [...headers].map(([name, value]) => [name, value]),
  );
}

let headerRules = [];

/**
 * Reads the export file that corresponds to a decoded URL pathname.
 *
 * Next static export can represent a route as `route.html` or
 * `route/index.html`; assets such as JavaScript and CSS use their exact path.
 *
 * @param {string} pathname Decoded URL pathname, including its leading slash.
 * @returns {Promise<{ body: Buffer, contentType: string } | null>} The file and MIME type, or `null` when no candidate exists.
 * @throws {Error} Propagates filesystem errors other than missing-path or directory errors.
 */
async function readExportFile(pathname) {
  const routePath = pathname === "/" ? "index.html" : pathname.slice(1);
  // Try the exact asset first, then Next's flat and directory route formats.
  const candidates =
    pathname === "/"
      ? ["index.html"]
      : pathname.endsWith("/")
        ? [`${routePath}index.html`]
        : [routePath, `${routePath}.html`, `${routePath}/index.html`];

  for (const candidate of candidates) {
    const filePath = resolve(exportDirectory, candidate);
    const relativePath = relative(exportDirectory, filePath);

    // Keep decoded URL paths inside the export root, including on Windows.
    if (
      relativePath === ".." ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      return null;
    }

    try {
      return {
        body: await readFile(filePath),
        // Unknown extensions are served as binary data rather than guessed as text.
        contentType: contentTypes.get(extname(filePath)) ?? "application/octet-stream",
      };
    } catch (error) {
      if (missingFileCodes.has(error.code)) {
        continue;
      }

      throw error;
    }
  }

  return null;
}

/**
 * Creates the HTTP request handler used by the local static server.
 *
 * The optional dependencies are a minimal test seam: tests can supply parsed
 * header rules and a file reader that fails deterministically. Normal server
 * startup omits both options and uses the generated `out/_headers` plus the
 * export-directory reader.
 *
 * @param {object} [dependencies] Optional test and startup dependencies.
 * @param {(pathname: string) => Promise<{ body: Buffer, contentType: string } | null>} [dependencies.readExportFile]
 *   Reads a route or asset from the static export.
 * @param {{ path: string, headers: Map<string, string> }[]} [dependencies.headerRules]
 *   Parsed generated header rules.
 * @returns {(request: import("node:http").IncomingMessage, response: import("node:http").ServerResponse) => Promise<void>}
 *   An async Node.js HTTP request handler.
 *
 * @example
 * const handler = createRequestHandler({
 *   readExportFile: async () => null,
 *   headerRules: parseHeadersFile("/*\n  X-Content-Type-Options: nosniff\n"),
 * });
 * const server = createServer(handler);
 */
export function createRequestHandler({
  readExportFile: readFileFromExport = readExportFile,
  headerRules: responseHeaderRules = headerRules,
} = {}) {
  return async (request, response) => {
    let pathname;
    let rawPathname;

    // The WHATWG URL parser separates query parameters and provides a stable
    // pathname; malformed targets are retained as unavailable so catch-all
    // headers can still be applied to the 400/405 response.
    try {
      rawPathname = new URL(request.url ?? "/", `http://${host}`).pathname;
    } catch {
      rawPathname = undefined;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      // This branch is reached before URI decoding, so it deliberately uses
      // the raw parsed pathname and falls back safely if parsing produced none.
      response.writeHead(405, {
        Allow: "GET, HEAD",
        ...getResponseHeaders(responseHeaderRules, rawPathname),
      });
      response.end();
      return;
    }

    try {
      // URL parsing above excludes query parameters. decodeURIComponent handles
      // percent escapes but intentionally rejects malformed or incomplete escapes
      // with a controlled 400 rather than interpreting the route as a file.
      pathname = decodeURIComponent(rawPathname ?? "/");
    } catch {
      response.writeHead(400, {
        ...getResponseHeaders(responseHeaderRules, undefined),
      });
      response.end("Bad request");
      return;
    }

    // Backslashes are path separators on Windows, so reject them before resolving a file path.
    if (pathname.includes("\\") || pathname.includes("\0")) {
      // Backslashes are separators on Windows and NUL characters are unsafe
      // filesystem input. Neither is decoded into a route, so catch-all headers
      // are used and no path-specific rule is inferred.
      response.writeHead(400, {
        ...getResponseHeaders(responseHeaderRules, undefined),
      });
      response.end("Bad request");
      return;
    }

    try {
      const file = await readFileFromExport(pathname);
      if (file) {
        response.writeHead(200, {
          "Content-Type": file.contentType,
          ...getResponseHeaders(responseHeaderRules, pathname),
        });
        response.end(request.method === "HEAD" ? undefined : file.body);
        return;
      }

      // Preserve the export's not-found page and HTTP status when no route matches.
      const notFound = await readFileFromExport("/404.html");
      response.writeHead(404, {
        "Content-Type": notFound?.contentType ?? "text/plain; charset=utf-8",
        ...getResponseHeaders(responseHeaderRules, pathname),
      });
      response.end(
        request.method === "HEAD" ? undefined : (notFound?.body ?? Buffer.from("Not found")),
      );
    } catch (error) {
      // Unexpected disk errors are visible in the server output and returned as HTTP 500.
      // Header generation happens before response.end(), so a valid catch-all
      // or exact/wildcard match cannot replace the original 500 status/body.
      console.error("Unable to read a file from the static export.", error);
      response.writeHead(500, {
        ...getResponseHeaders(responseHeaderRules, pathname),
      });
      response.end("Internal server error");
    }
  };
}

// Binding to loopback prevents this development helper from being exposed to the network.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await readFile(resolve(exportDirectory, "index.html"));
    const headersSource = await readFile(resolve(exportDirectory, "_headers"), "utf8");
    headerRules = parseHeadersFile(headersSource);
  } catch (error) {
    throw new Error(
      "Unable to load the generated static export or out/_headers file. Run the build before starting Playwright.",
      { cause: error },
    );
  }

  const server = createServer(createRequestHandler({ headerRules }));
  server.listen(port, host, () => {
    console.log(`Serving ${exportDirectory} at http://${host}:${port}`);
  });
}
