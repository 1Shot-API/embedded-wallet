import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const vendorSignerSrc = path.join(repoRoot, "vendor/ows-signer/src");
const signerPublic = path.join(repoRoot, "signer-static/index.html");
const outSigner = path.join(repoRoot, "dist/signer");

if (!fs.existsSync(vendorSignerSrc)) {
  console.error(
    "vendor/ows-signer/src missing. Run: npm run sync:signer",
  );
  process.exit(1);
}

fs.rmSync(outSigner, { recursive: true, force: true });
fs.mkdirSync(path.join(outSigner, "src"), { recursive: true });
fs.cpSync(vendorSignerSrc, path.join(outSigner, "src"), { recursive: true });
fs.copyFileSync(signerPublic, path.join(outSigner, "index.html"));

console.log("Copied Signing Layer to dist/signer/");
