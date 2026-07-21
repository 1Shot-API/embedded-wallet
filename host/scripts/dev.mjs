/**
 * Start Host Layer Vite (port 5173 by default).
 * Loads NGROK_DOMAIN / WALLET_IFRAME_URL from repo root .env.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import dotenv from "dotenv";
import { resolveHttpsOptions, walletIframeUrl } from "../wallet-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const preferredPort = Number(process.env.HOST_PORT ?? process.env.PORT ?? 5173);

try {
  const viteServer = await createServer({
    configFile: path.join(__dirname, "../vite.config.mjs"),
    server: {
      port: preferredPort,
      strictPort: true,
      host: "0.0.0.0",
    },
  });
  await viteServer.listen();

  const https = resolveHttpsOptions({
    certsDir: path.join(__dirname, "../certs"),
  });
  const scheme = https ? "https" : "http";
  const address = viteServer.httpServer?.address();
  const port =
    address && typeof address === "object" ? address.port : preferredPort;

  console.log(`1Shot Wallet test host: ${scheme}://localhost:${port}`);
  console.log(`  Branding Layer iframe: ${walletIframeUrl()}`);
  if (scheme === "http") {
    console.log(
      "  Tip: for HTTPS wallet (ngrok) + passkeys, serve this host over HTTPS (host/certs + HOST_HTTPS=1).",
    );
  }
} catch (error) {
  console.error("Failed to start host:", error);
  process.exit(1);
}
