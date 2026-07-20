import {
  createPublicClient,
  erc20Abi,
  formatUnits,
  http,
  type Address,
} from "viem";
import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import { DEMO_CHAINS } from "../ows/demoChains";
import { EAssetType, type IKnownAsset } from "./types";

/** Stablecoins in the known catalog use 6 decimals; unknowns fall back to 18. */
const STABLE_DECIMALS = 6;
const UNKNOWN_DECIMALS = 18;

export function resolveErc20Decimals(known: IKnownAsset | null): number {
  if (known?.type === EAssetType.Erc20) {
    return STABLE_DECIMALS;
  }
  return UNKNOWN_DECIMALS;
}

/**
 * Read ERC-20 `balanceOf` for `owner` via the demo chain RPC.
 * Returns a formatted string, or `null` when the chain RPC is unknown / call fails.
 */
export async function fetchErc20Balance(options: {
  chainId: EVMChainId;
  tokenAddress: EVMAccountAddress;
  ownerAddress: EVMAccountAddress;
  decimals: number;
}): Promise<string | null> {
  const chain = DEMO_CHAINS.find((c) => c.chainId === options.chainId);
  if (!chain) return null;

  const owner = String(options.ownerAddress);
  if (!owner || owner === "0x0" || owner === "—") return null;

  try {
    const client = createPublicClient({
      transport: http(chain.rpcUrl),
    });
    const raw = await client.readContract({
      address: String(options.tokenAddress) as Address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner as Address],
    });
    return formatUnits(raw, options.decimals);
  } catch (error: unknown) {
    console.warn("[balances] balanceOf failed", error);
    return null;
  }
}
