import {
  isEip1193Method,
  OwsInvalidParamsError,
  OwsRpcError,
  OwsUnimplementedError,
} from "@1shotapi/ows-types";
import {
  getEip1193ParamSchema,
  type OWSWallet,
} from "@1shotapi/ows-wallet-utils";
import { z } from "zod";

import type { IHostOriginProvider } from "../lib/interfaces/utils/IHostOriginProvider";
import { OriginString } from "../lib/types/primitives/OriginString";

import type { Eip1193HandlerRegistry } from "./Eip1193HandlerRegistry";

/**
 * Custom RPC for browser-extension hosts —
 * `await proxy.rpc("forwardEip1193", { origin, method, params })`.
 *
 * The extension side panel embeds the wallet once and serves every tab, so
 * the Postmate handshake only ever names the extension. The extension is also
 * the party the browser tells which page sent each request, so it relays that
 * origin here and the wallet attributes the call (consent badges, analytics,
 * grant scoping) to that page instead of the extension id.
 */
export const FORWARD_EIP1193_RPC_METHOD = "forwardEip1193";

/** EIP-1193 `4100 Unauthorized`: the caller is not an extension host. */
const UNAUTHORIZED_CODE = 4100;

const HTTP_PROTOCOL = /^https?$/;

const forwardEip1193ParamsSchema = z.strictObject({
  origin: z
    .url({ protocol: HTTP_PROTOCOL })
    .refine((value) => new URL(value).origin === value, {
      message: "origin must be scheme://host[:port] with no path",
    })
    .transform((value) => OriginString(value)),
  method: z.string().min(1),
  params: z.unknown().optional(),
});

export type IForwardEip1193Params = z.infer<typeof forwardEip1193ParamsSchema>;

export type RegisterForwardEip1193Options = {
  hostOriginProvider: IHostOriginProvider;
  handlers: Eip1193HandlerRegistry;
};

export function registerForwardEip1193Rpc(
  wallet: OWSWallet,
  options: RegisterForwardEip1193Options,
): void {
  wallet.registerRpc(
    FORWARD_EIP1193_RPC_METHOD,
    async (raw) => {
      const { origin, method, params } = raw as IForwardEip1193Params;
      if (!options.hostOriginProvider.isExtensionHost()) {
        throw new OwsRpcError(
          `${FORWARD_EIP1193_RPC_METHOD} is only available to browser-extension hosts`,
          UNAUTHORIZED_CODE,
        );
      }
      const handler = options.handlers.get(method);
      if (!handler) {
        throw new OwsUnimplementedError(`Unsupported method: ${method}`);
      }
      // Same shape and validation `OWSWallet` sees when the host's
      // `ethereum.request` calls the method directly.
      const requestParams = normalizeEip1193Params(params);
      const parsedParams = isEip1193Method(method)
        ? getEip1193ParamSchema(method).safeParse(requestParams)
        : null;
      if (parsedParams && !parsedParams.success) {
        throw new OwsInvalidParamsError(
          "Invalid params",
          parsedParams.error.flatten(),
        );
      }
      const handlerParams = (
        parsedParams ? parsedParams.data : requestParams
      ) as unknown[];
      return options.hostOriginProvider.runForOrigin(origin, () =>
        handler(handlerParams),
      );
    },
    forwardEip1193ParamsSchema,
  );
}

/** Mirrors `EIP1193Provider` in `@1shotapi/ows-provider`: handlers always get an array. */
function normalizeEip1193Params(params: unknown): unknown[] {
  if (params === undefined) {
    return [];
  }
  return Array.isArray(params) ? [...params] : [params];
}
