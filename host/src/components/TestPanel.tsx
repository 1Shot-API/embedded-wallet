import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WalletActions, type IWalletActionsProps } from "./WalletActions";

/** Test mode: EIP-1193 actions with the branding wallet hidden. */
export function TestPanel(props: IWalletActionsProps) {
  return (
    <div className="mx-auto w-full max-w-2xl p-6">
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
    </div>
  );
}
