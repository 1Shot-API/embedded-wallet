import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
const ASSET_EXT = /\.(svg|png|jpe?g|gif|webp|ico)$/i;

export async function load(url, context, nextLoad) {
  if (ASSET_EXT.test(url)) {
    return {
      format: "module",
      shortCircuit: true,
      source: "export default \\"\\";",
    };
  }
  return nextLoad(url, context);
}
`),
  import.meta.url,
);
