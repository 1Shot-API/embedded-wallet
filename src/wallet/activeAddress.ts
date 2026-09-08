import {
  BITCOIN_MAINNET_CHAIN_ID,
  ChainUtils,
  EChainTechnology,
  type BitcoinSegwitAccountAddress,
  type EVMAccountAddress,
  type OWSChainId,
  type SolanaAccountAddress,
} from "@1shotapi/ows-types";

/**
 * Map a selected chain id to the address family shown in the shell.
 */
export function chainTechnologyFor(chainId: OWSChainId): EChainTechnology {
  return ChainUtils.technologyFor(chainId);
}

export interface IActiveAddress {
  family: EChainTechnology;
  label: string;
  address: string;
}

export function resolveActiveAddress(input: {
  chainId: OWSChainId;
  evmAddress: EVMAccountAddress | string;
  solanaAddress: SolanaAccountAddress | string;
  bitcoinAddress?: BitcoinSegwitAccountAddress | string | null;
}): IActiveAddress {
  const family = chainTechnologyFor(input.chainId);
  switch (family) {
    case EChainTechnology.Solana:
      return {
        family,
        label: "Solana",
        address: input.solanaAddress || "—",
      };
    case EChainTechnology.Bitcoin:
      return {
        family,
        label:
          input.chainId === BITCOIN_MAINNET_CHAIN_ID
            ? "Bitcoin"
            : "Bitcoin Testnet",
        address: input.bitcoinAddress || "—",
      };
    case EChainTechnology.Evm:
    default:
      return {
        family: EChainTechnology.Evm,
        label: "EVM",
        address: input.evmAddress || "—",
      };
  }
}
