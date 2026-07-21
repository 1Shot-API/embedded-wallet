import {
  EChainTechnology,
  type BitcoinAccountAddress,
  type EVMAccountAddress,
  type EVMChainId,
  type SolanaAccountAddress,
} from "@1shotapi/ows-types";

/**
 * Map a selected chain id to the address family shown in the shell.
 * Demo chains today are all EVM; Solana/Bitcoin branches are for future chains.
 */
export function chainTechnologyFor(
  chainId: EVMChainId | string,
): EChainTechnology {
  void chainId;
  return EChainTechnology.Evm;
}

export interface IActiveAddress {
  family: EChainTechnology;
  label: string;
  address: string;
}

export function resolveActiveAddress(input: {
  chainId: EVMChainId | string;
  evmAddress: EVMAccountAddress | string;
  solanaAddress: SolanaAccountAddress | string;
  bitcoinAddress?: BitcoinAccountAddress | string;
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
        label: "Bitcoin",
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
