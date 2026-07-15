import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "vite";
import { resolveHttpsOptions, walletIframeUrl } from "./wallet-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const https = resolveHttpsOptions({
  certsDir: path.resolve(__dirname, "certs"),
});

export default defineConfig({
  define: {
    __WALLET_IFRAME_URL__: JSON.stringify(walletIframeUrl()),
  },
  server: {
    port: Number(process.env.HOST_PORT ?? process.env.PORT ?? 5173),
    host: "0.0.0.0",
    allowedHosts: true,
    strictPort: true,
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
    sourcemap: true,
  },
});
