import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
fs.rmSync(dist, { recursive: true, force: true });
console.log("Removed host/dist/");
