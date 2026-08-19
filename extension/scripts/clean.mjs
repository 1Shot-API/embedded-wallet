import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const dir of ["dist", ".output", ".wxt"]) {
  fs.rmSync(path.join(root, dir), { recursive: true, force: true });
}
console.log("Removed extension dist / .output / .wxt");
