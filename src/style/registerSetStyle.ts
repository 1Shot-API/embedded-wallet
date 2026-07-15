import { z } from "zod";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import { styleController } from "./styleController";

/** Custom RPC method name — host: `await proxy.rpc("setStyle", options)`. */
export const SET_STYLE_RPC_METHOD = "setStyle";

const themeSchema = z
  .object({
    primary: z.string().optional(),
    primaryForeground: z.string().optional(),
    background: z.string().optional(),
    foreground: z.string().optional(),
    muted: z.string().optional(),
    mutedForeground: z.string().optional(),
    border: z.string().optional(),
    accent: z.string().optional(),
    accentForeground: z.string().optional(),
    radius: z.string().optional(),
    fontSans: z.string().optional(),
  })
  .strict()
  .optional();

const copySchema = z
  .object({
    productName: z.string().optional(),
    tagline: z.string().optional(),
  })
  .strict()
  .optional();

export const setStyleParamsSchema = z
  .object({
    theme: themeSchema,
    copy: copySchema,
    dark: z.boolean().optional(),
  })
  .strict();

export type ISetStyleParams = z.infer<typeof setStyleParamsSchema>;

export function registerSetStyleRpc(wallet: OWSWallet): void {
  wallet.registerRpc(
    SET_STYLE_RPC_METHOD,
    async (params) => {
      const resolved = styleController.merge(params as ISetStyleParams);
      return {
        ok: true as const,
        productName: resolved.copy.productName,
      };
    },
    setStyleParamsSchema,
  );
}
