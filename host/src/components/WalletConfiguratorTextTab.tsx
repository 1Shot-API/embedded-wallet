import { WalletConfiguratorTextTabCredentialSections } from "./WalletConfiguratorTextTabCredentialSections";
import { WalletConfiguratorTextTabSigningSections } from "./WalletConfiguratorTextTabSigningSections";
import type { IWalletConfiguratorTextTabSectionProps } from "./walletConfiguratorTextTabTypes";
import { WalletConfiguratorTextTabWalletSections } from "./WalletConfiguratorTextTabWalletSections";

import { Accordion } from "@/components/ui/accordion";
import { TabsContent } from "@/components/ui/tabs";

export type { IWalletConfiguratorTextTabSectionProps as IWalletConfiguratorTextTabProps };

export function WalletConfiguratorTextTab({
  form,
  patch,
}: IWalletConfiguratorTextTabSectionProps) {
  return (
    <TabsContent value="text" className="mt-4">
      <Accordion type="multiple">
        <WalletConfiguratorTextTabSigningSections form={form} patch={patch} />
        <WalletConfiguratorTextTabCredentialSections form={form} patch={patch} />
        <WalletConfiguratorTextTabWalletSections form={form} patch={patch} />
      </Accordion>
    </TabsContent>
  );
}
