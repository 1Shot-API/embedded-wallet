/**
 * Refresh vendored @1shotapi/ows-signer from a local open-wallet / prf-wallet clone.
 *
 * Default source: ../prf-wallet/packages/ows-signer
 * Override: OWS_SIGNER_SRC=/path/to/packages/ows-signer
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const defaultSrc = path.resolve(repoRoot, "../prf-wallet/packages/ows-signer");
const srcRoot = process.env.OWS_SIGNER_SRC
  ? path.resolve(process.env.OWS_SIGNER_SRC)
  : defaultSrc;
const destRoot = path.join(repoRoot, "vendor/ows-signer");
const srcDir = path.join(srcRoot, "src");

if (!fs.existsSync(srcDir)) {
  console.error(
    `ows-signer source not found at ${srcDir}\n` +
      `Set OWS_SIGNER_SRC to packages/ows-signer (default: ${defaultSrc})`,
  );
  process.exit(1);
}

fs.rmSync(destRoot, { recursive: true, force: true });
fs.mkdirSync(destRoot, { recursive: true });
fs.cpSync(srcDir, path.join(destRoot, "src"), { recursive: true });

const pkgJson = path.join(srcRoot, "package.json");
if (fs.existsSync(pkgJson)) {
  fs.copyFileSync(pkgJson, path.join(destRoot, "package.json"));
}

console.log(`Synced ows-signer src → vendor/ows-signer/ (from ${srcRoot})`);
