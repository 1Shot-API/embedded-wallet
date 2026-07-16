import type {
  BitcoinAccountAddress,
  EVMAccountAddress,
  EVMChainId,
  SolanaAccountAddress,
} from "@1shotapi/ows-types";

export enum EChainFamily {
  Evm = "evm",
  Solana = "solana",
  Bitcoin = "bitcoin",
}

/**
 * Map a selected chain id to the address family shown in the shell.
 * Demo chains today are all EVM; Solana/Bitcoin branches are for future chains.
 */
export function chainFamilyFor(chainId: EVMChainId | string): EChainFamily {
  void chainId;
  return EChainFamily.Evm;
}

export function shortenAddress(address: string, left = 6, right = 4): string {
  if (address.length <= left + right + 3) return address;
  return `${address.slice(0, left)}…${address.slice(-right)}`;
}

export interface IActiveAddress {
  family: EChainFamily;
  label: string;
  address: string;
}

export function resolveActiveAddress(input: {
  chainId: EVMChainId | string;
  evmAddress: EVMAccountAddress | string;
  solanaAddress: SolanaAccountAddress | string;
  bitcoinAddress?: BitcoinAccountAddress | string;
}): IActiveAddress {
  const family = chainFamilyFor(input.chainId);
  switch (family) {
    case EChainFamily.Solana:
      return {
        family,
        label: "Solana",
        address: String(input.solanaAddress || "—"),
      };
    case EChainFamily.Bitcoin:
      return {
        family,
        label: "Bitcoin",
        address: String(input.bitcoinAddress || "—"),
      };
    case EChainFamily.Evm:
    default:
      return {
        family: EChainFamily.Evm,
        label: "EVM",
        address: String(input.evmAddress || "—"),
      };
  }
}
