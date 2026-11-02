/** On-chain asset standard. ERC-20, Native, and SPL balances are fetched today. */
export enum EAssetType {
  Native = "native",
  Erc20 = "erc20",
  Erc721 = "erc721",
  Erc1155 = "erc1155",
  /** SPL Token / Token-2022 mint (Solana). */
  Spl = "spl",
}
