import path from "node:path";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Prefer sibling open-wallet checkout when developing packages locally. */
const siblingSignerSrc = path.resolve(
  __dirname,
  "../prf-wallet/packages/ows-signer/src",
);
const siblingTypesEntry = path.resolve(
  __dirname,
  "../prf-wallet/packages/ows-types/dist/index.js",
);
const siblingSignerUtilsEntry = path.resolve(
  __dirname,
  "../prf-wallet/packages/ows-signer-utils/dist/index.js",
);
const signerPkgSrc = fs.existsSync(siblingSignerSrc)
  ? siblingSignerSrc
  : path.resolve(__dirname, "node_modules/@1shotapi/ows-signer/src");
const signerPublicDir = path.resolve(__dirname, "signer-static");

const localOwsAliases: Record<string, string> = {};
if (fs.existsSync(siblingTypesEntry)) {
  localOwsAliases["@1shotapi/ows-types"] = siblingTypesEntry;
}
if (fs.existsSync(siblingSignerUtilsEntry)) {
  localOwsAliases["@1shotapi/ows-signer-utils"] = siblingSignerUtilsEntry;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

/** Canonical Signing Layer CSP (omit frame-ancestors for permissionless branding embeds). */
const SIGNER_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; child-src 'none'; frame-src 'none'; worker-src 'none'; manifest-src 'none'; base-uri 'none'; form-action 'none'; upgrade-insecure-requests";

function contentType(filePath: string): string {
  return MIME[path.extname(filePath)] ?? "application/octet-stream";
}

function sendFile(res: ServerResponse, filePath: string): void {
  const stream = fs.createReadStream(filePath);
  stream.once("open", () => {
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType(filePath));
    res.setHeader("Content-Security-Policy", SIGNER_CSP);
    stream.pipe(res);
  });
  stream.once("error", (error: NodeJS.ErrnoException) => {
    if (res.headersSent) {
      res.destroy(error);
      return;
    }
    const notFound = error.code === "ENOENT";
    res.statusCode = notFound ? 404 : 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(notFound ? "Not found" : "Internal Server Error");
  });
}

/**
 * Resolve `rel` under `rootDir`, rejecting path traversal (`..`, encoded separators).
 * Returns `undefined` when the result would escape `rootDir`.
 */
function resolveContainedPath(
  rootDir: string,
  urlRelative: string,
): string | undefined {
  let rel: string;
  try {
    rel = decodeURIComponent(urlRelative);
  } catch {
    return undefined;
  }
  if (rel.includes("\0")) {
    return undefined;
  }
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, rel);
  const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (resolved !== root && !resolved.startsWith(rootPrefix)) {
    return undefined;
  }
  return resolved;
}

/** Serve `/signer/` outside Vite `base` so WebAuthn + nest stay same-origin. */
function serveSignerPlugin(): Plugin {
  return {
    name: "ows-serve-signer",
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (!url.startsWith("/signer")) {
          next();
          return;
        }

        if (url === "/signer" || url === "/signer/") {
          sendFile(res, path.join(signerPublicDir, "index.html"));
          return;
        }

        if (url.startsWith("/signer/src/")) {
          const filePath = resolveContainedPath(
            signerPkgSrc,
            url.slice("/signer/src/".length),
          );
          if (!filePath || !fs.existsSync(filePath)) {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }
          sendFile(res, filePath);
          return;
        }

        const filePath = resolveContainedPath(
          signerPublicDir,
          url.slice("/signer/".length),
        );
        if (!filePath || !fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }
        sendFile(res, filePath);
      });
    },
  };
}

export default defineConfig({
  base: "/",
  publicDir: "public",
  plugins: [react(), tailwindcss(), serveSignerPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      ...localOwsAliases,
    },
  },
  server: {
    port: Number(process.env.PORT ?? 5174),
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  preview: {
    port: Number(process.env.PORT ?? 5174),
    strictPort: true,
    host: "0.0.0.0",
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Do not ship source maps to the browser — maps embed original sources
    // (including crypto PEM-header validation strings) and can leak secrets.
    sourcemap: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        create: path.resolve(__dirname, "create/index.html"),
      },
    },
  },
});
