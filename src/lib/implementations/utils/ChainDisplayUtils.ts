import { EChainNetworkType } from "../../types/enum/EChainNetworkType";

/** Minimal fields needed to group/sort chain catalog rows for UI. */
export interface IChainCatalogSortable {
  networkType: EChainNetworkType;
  label: string;
  weight: number;
}

/** Group/sort helpers for Mainnet/Testnet chain pickers. */
export class ChainDisplayUtils {
  /** Higher weight first; ties broken alphabetically by label. */
  static compareByWeightThenLabel(
    a: IChainCatalogSortable,
    b: IChainCatalogSortable,
  ): number {
    if (b.weight !== a.weight) {
      return b.weight - a.weight;
    }
    return a.label.localeCompare(b.label);
  }

  static groupByNetworkType<T extends IChainCatalogSortable>(
    chains: readonly T[],
  ): { testnets: T[]; mainnets: T[] } {
    const testnets: T[] = [];
    const mainnets: T[] = [];
    for (const chain of chains) {
      if (chain.networkType === EChainNetworkType.Testnet) {
        testnets.push(chain);
      } else {
        mainnets.push(chain);
      }
    }
    testnets.sort(ChainDisplayUtils.compareByWeightThenLabel);
    mainnets.sort(ChainDisplayUtils.compareByWeightThenLabel);
    return { testnets, mainnets };
  }

  /** Mainnets first (weight/alpha), then testnets (weight/alpha). */
  static sortForDisplay<T extends IChainCatalogSortable>(
    chains: readonly T[],
  ): T[] {
    const { testnets, mainnets } =
      ChainDisplayUtils.groupByNetworkType(chains);
    return [...mainnets, ...testnets];
  }
}
