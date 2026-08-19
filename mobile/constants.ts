/** Reown Cloud project for the 1Shot Wallet mobile / WalletConnect host. */
export const REOWN_PROJECT_ID = "5ff565827d1b5822cecb7104706521d5";

export const WALLET_METADATA = {
  name: "1Shot Wallet",
  description: "Passkey-native embedded wallet — WalletConnect host",
  url: "https://wallet.1shotapi.com/mobile/",
  icons: ["https://wallet.1shotapi.com/mobile/icons/icon-192.png"],
} as const;

export function walletMetadataForOrigin(origin: string): {
  name: string;
  description: string;
  url: string;
  icons: string[];
} {
  const base = origin.replace(/\/$/, "");
  return {
    name: WALLET_METADATA.name,
    description: WALLET_METADATA.description,
    url: `${base}/mobile/`,
    icons: [`${base}/mobile/icons/icon-192.png`],
  };
}
