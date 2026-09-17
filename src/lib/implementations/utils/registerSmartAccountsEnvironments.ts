import {
  getSmartAccountsEnvironment,
  PREFERRED_VERSION,
} from "@metamask/smart-accounts-kit";
import { overrideDeployedEnvironment } from "@metamask/smart-accounts-kit/utils";

import { EChain } from "../../types/enum/EChain";

/**
 * `@metamask/delegation-deployments@2.0.0` lists Arc Testnet (5042002) but not
 * Arc mainnet (5042). MetaMask has deployed the same CREATE2 v1.3.0 addresses on
 * Arc (verified on-chain; see Deployments.md). Without this override,
 * `toMetaMaskSmartAccount` / `getSmartAccountsEnvironment(5042)` throw
 * `No contracts found for version 1.3.0 chain 5042` and Send fails.
 *
 * Import this module once at each Branding entrypoint (side effect).
 * Safe to re-run: skips if the kit already knows the chain.
 */
export function registerSmartAccountsEnvironments(): void {
  const arcMainnet = Number(BigInt(EChain.Arc));
  try {
    getSmartAccountsEnvironment(arcMainnet);
    return;
  } catch {
    // Not in the published registry yet — inject Arc Testnet's identical env.
  }

  const template = getSmartAccountsEnvironment(
    Number(BigInt(EChain.ArcTestnet)),
  );
  overrideDeployedEnvironment(arcMainnet, PREFERRED_VERSION, template);
}

registerSmartAccountsEnvironments();
