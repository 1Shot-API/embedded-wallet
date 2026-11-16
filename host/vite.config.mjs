import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";
import { defineConfig } from "vite";

import { resolveHttpsOptions, walletIframeUrl } from "./wallet-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

/**
 * `@1shotapi/wagmi-connector` and `@1shotapi/ows-provider/evm` are not on npm
 * yet; the Wagmi tab resolves them from a built sibling prf-wallet checkout.
 * `@wagmi/core` / `viem` are deduped so the connector shares the host's copies.
 */
const siblingPackages = path.resolve(__dirname, "../../prf-wallet/packages");
const siblingWagmiConnector = path.join(
  siblingPackages,
  "ows-wagmi/dist/index.js",
);
const siblingOwsProviderEvm = path.join(
  siblingPackages,
  "ows-provider/dist/evm.js",
);
const hasSiblingWagmi =
  fs.existsSync(siblingWagmiConnector) && fs.existsSync(siblingOwsProviderEvm);
if (!hasSiblingWagmi) {
  console.warn(
    "[host] ../prf-wallet ows-wagmi / ows-provider dist not found — the Wagmi tab " +
      "will not load. Run `npm run build` in ../prf-wallet.",
  );
}

const https = resolveHttpsOptions({
  certsDir: path.resolve(__dirname, "certs"),
  pathBase: path.resolve(__dirname, ".."),
});

export default defineConfig({
  define: {
    __WALLET_IFRAME_URL__: JSON.stringify(walletIframeUrl()),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      ...(hasSiblingWagmi
        ? [
            {
              find: /^@1shotapi\/wagmi-connector$/,
              replacement: siblingWagmiConnector,
            },
            {
              find: /^@1shotapi\/ows-provider\/evm$/,
              replacement: siblingOwsProviderEvm,
            },
          ]
        : []),
    ],
    dedupe: ["@wagmi/core", "viem"],
  },
  server: {
    port: Number(process.env.HOST_PORT ?? process.env.PORT ?? 5173),
    host: "0.0.0.0",
    allowedHosts: true,
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname, ".."), siblingPackages],
    },
    ...(https ? { https } : {}),
  },
  preview: {
    port: Number(process.env.HOST_PORT ?? process.env.PORT ?? 5173),
    host: "0.0.0.0",
    strictPort: true,
    ...(https ? { https } : {}),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Do not ship source maps to the browser (avoids leaking original sources).
    sourcemap: false,
  },
});
