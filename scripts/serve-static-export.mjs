/**
 * Serves the built Next.js static export for local Playwright tests.
 *
 * The build writes route HTML and browser assets to `out/`. This lightweight
 * Node.js server reads those files directly, without running `next dev` or a
 * Next.js application server. Playwright starts and stops it through the
 * `webServer` setting in `playwright.config.ts`.
 *
 * Routes resolve to the matching asset, a `.html` export, or an `index.html`
 * in a route directory. The module exports no API; running it starts the
 * server. For example, run `npm run build`, then
 * `node scripts/serve-static-export.mjs`.
 *
 * This is test infrastructure, not a production server. It binds only to
 * loopback, serves read-only `GET` and `HEAD` requests, and refuses paths
 * outside `out/`.
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

// Fail before listening if the export has not been built; this avoids serving a stale or empty directory.
await readFile(resolve(exportDirectory, "index.html"));

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

// Exported content is immutable here, so only read-only HTTP methods are needed.
const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  let pathname;
  try {
    // Parse the request target and decode its path; URL parsing excludes query parameters.
    pathname = decodeURIComponent(new URL(request.url ?? "/", `http://${host}`).pathname);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  // Backslashes are path separators on Windows, so reject them before resolving a file path.
  if (pathname.includes("\\") || pathname.includes("\0")) {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  try {
    const file = await readExportFile(pathname);
    if (file) {
      response.writeHead(200, { "Content-Type": file.contentType });
      response.end(request.method === "HEAD" ? undefined : file.body);
      return;
    }

    // Preserve the export's not-found page and HTTP status when no route matches.
    const notFound = await readExportFile("/404.html");
    response.writeHead(404, {
      "Content-Type": notFound?.contentType ?? "text/plain; charset=utf-8",
    });
    response.end(
      request.method === "HEAD" ? undefined : (notFound?.body ?? Buffer.from("Not found")),
    );
  } catch (error) {
    // Unexpected disk errors are visible in the server output and returned as HTTP 500.
    console.error("Unable to read a file from the static export.", error);
    response.writeHead(500);
    response.end("Internal server error");
  }
});

// Binding to loopback prevents this development helper from being exposed to the network.
server.listen(port, host, () => {
  console.log(`Serving ${exportDirectory} at http://${host}:${port}`);
});
