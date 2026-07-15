/**
 * Wallet iframe URL + optional mkcert HTTPS for the Host Layer tester.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function normalizeNgrokDomain(value) {
  const raw = value?.trim();
  if (!raw) return undefined;
  try {
    const url = raw.includes("://") ? raw : `https://${raw}`;
    return new URL(url).hostname;
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  }
}

/** Branding Layer iframe URL. Prefer WALLET_IFRAME_URL, then NGROK_DOMAIN, else local wallet. */
export function walletIframeUrl() {
  const explicit = process.env.WALLET_IFRAME_URL?.trim();
  if (explicit) {
    return explicit.endsWith("/") ? explicit : `${explicit}/`;
  }
  const domain = normalizeNgrokDomain(process.env.NGROK_DOMAIN);
  if (domain) {
    return `https://${domain}/wallet/`;
  }
  const walletPort = process.env.WALLET_PORT?.trim() || "5174";
  return `http://localhost:${walletPort}/wallet/`;
}

/**
 * Optional HTTPS when HOST_HTTPS=1 or host/certs/dev-*.pem exist.
 * Needed when the wallet iframe is on HTTPS (ngrok) for passkey ancestor checks.
 */
export function resolveHttpsOptions({ certsDir }) {
  const flag = process.env.HOST_HTTPS?.trim().toLowerCase();
  const forceOn = flag === "1" || flag === "true" || flag === "yes";
  const forceOff = flag === "0" || flag === "false" || flag === "no";

  const certPath = process.env.HOST_SSL_CERT?.trim()
    ? path.resolve(process.env.HOST_SSL_CERT.trim())
    : path.join(certsDir, "dev-cert.pem");
  const keyPath = process.env.HOST_SSL_KEY?.trim()
    ? path.resolve(process.env.HOST_SSL_KEY.trim())
    : path.join(certsDir, "dev-key.pem");

  const certsPresent = fs.existsSync(certPath) && fs.existsSync(keyPath);
  if (forceOff) return undefined;
  if (!forceOn && !certsPresent) return undefined;
  if (!certsPresent) {
    throw new Error(
      `HOST_HTTPS is set but cert/key missing under ${certsDir}.\n` +
        `Generate: mkcert -install && mkcert -cert-file host/certs/dev-cert.pem -key-file host/certs/dev-key.pem localhost 127.0.0.1`,
    );
  }
  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
}

// silence unused in some tooling
void __dirname;
