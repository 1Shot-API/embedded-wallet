export type { IStyleOptions, IStyleThemeOptions, IStyleCopyOptions, IResolvedStyle } from "./types";
export { DEFAULT_STYLE } from "./defaults";
export { StyleProvider, useStyle } from "./StyleProvider";
export { styleController } from "./styleController";
export {
  registerSetStyleRpc,
  SET_STYLE_RPC_METHOD,
  setStyleParamsSchema,
  type ISetStyleParams,
} from "./registerSetStyle";
