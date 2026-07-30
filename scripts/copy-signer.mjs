import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const siblingSignerSrc = path.join(
  repoRoot,
  "../prf-wallet/packages/ows-signer/src",
);
const siblingSignerHtml = path.join(
  repoRoot,
  "../prf-wallet/packages/ows-signer/html",
);
const npmSignerSrc = path.join(
  repoRoot,
  "node_modules/@1shotapi/ows-signer/src",
);
const npmSignerHtml = path.join(
  repoRoot,
  "node_modules/@1shotapi/ows-signer/html",
);
const signerPkgSrc = fs.existsSync(siblingSignerSrc)
  ? siblingSignerSrc
  : npmSignerSrc;
const signerPkgHtml = fs.existsSync(siblingSignerHtml)
  ? siblingSignerHtml
  : npmSignerHtml;
const signerPublicHtml = path.join(repoRoot, "signer-static/index.html");
const signerPublicCss = path.join(repoRoot, "signer-static/signer.css");
const outSigner = path.join(repoRoot, "dist/signer");

if (!fs.existsSync(signerPkgSrc)) {
  console.error(
    "ows-signer src missing. Run: npm install (or clone prf-wallet beside this repo)",
  );
  process.exit(1);
}

fs.rmSync(outSigner, { recursive: true, force: true });
fs.mkdirSync(path.join(outSigner, "src"), { recursive: true });
fs.cpSync(signerPkgSrc, path.join(outSigner, "src"), { recursive: true });
fs.copyFileSync(signerPublicHtml, path.join(outSigner, "index.html"));

const cssSource = fs.existsSync(path.join(signerPkgHtml, "signer.css"))
  ? path.join(signerPkgHtml, "signer.css")
  : signerPublicCss;
if (!fs.existsSync(cssSource)) {
  console.error("ows-signer signer.css missing");
  process.exit(1);
}
fs.copyFileSync(cssSource, path.join(outSigner, "signer.css"));

console.log(
  `Copied Signing Layer to dist/signer/ (from ${path.relative(repoRoot, signerPkgSrc)})`,
);
