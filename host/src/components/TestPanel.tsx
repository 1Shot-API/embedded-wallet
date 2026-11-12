import type { EIP1193Provider } from "@1shotapi/ows-provider";

import { SwapsPanelContent } from "./SwapsPanelContent";
import { WalletActions, type IWalletActionsProps } from "./WalletActions";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface ITestPanelProps extends IWalletActionsProps {
  /** Live EIP-1193 provider from the current proxy (null while reconnecting). */
  getEthereumProvider: () => EIP1193Provider | null;
}

/** Test mode: EIP-1193 actions with the branding wallet hidden. */
export function TestPanel({ getEthereumProvider, ...props }: ITestPanelProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-xl">Test</CardTitle>
          <CardDescription>
        Exercise connect (`eth_requestAccounts`), personal_sign, eth_signTypedData_v4,
        SIWE, chain switch, ERC-20 reads, and EIP-7715 delegations.
            The wallet flyout stays hidden until an action needs it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WalletActions {...props} />
        </CardContent>
      </Card>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-xl">Swaps (LI.FI)</CardTitle>
          <CardDescription>
            Same-chain swaps quoted by LI.FI and sent through the wallet with
            <code> eth_sendTransaction</code> (ERC-20 approve first when needed).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SwapsPanelContent
            ready={props.ready}
            account={props.account}
            chainId={props.chainId}
            getEthereumProvider={getEthereumProvider}
          />
        </CardContent>
      </Card>
    </div>
  );
}
