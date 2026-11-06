import { useEffect, useState } from "react";

import { useStyle } from "../../style/StyleProvider";
import { useWallet } from "../../wallet/WalletProvider";
import { Modal } from "../Modal";

import { RequestingHostBadge } from "./RequestingHostBadge";

/** Host `eth_requestAccounts` consent. */
export function ConnectModal({
  onResolve,
}: {
  onResolve: (approved: boolean) => void;
}) {
  const { configProvider } = useWallet();
  const { style } = useStyle();
  const { connect } = style.copy;
  const [hostDomain, setHostDomain] = useState("");

  useEffect(() => {
    void configProvider.getConfig().then((config) => {
      setHostDomain(String(config.hostDomain));
    });
  }, [configProvider]);

  return (
    <Modal
      title={connect.title}
      onBackdropDismiss={() => onResolve(false)}
      actions={[
        {
          label: connect.rejectLabel,
          variant: "secondary",
          onClick: () => onResolve(false),
        },
        {
          label: connect.continueLabel,
          variant: "primary",
          autoFocus: true,
          onClick: () => onResolve(true),
        },
      ]}
    >
      <div className="text-foreground flex flex-col gap-4">
        <p className="text-muted-foreground m-0">{connect.body}</p>
        <RequestingHostBadge domain={hostDomain} />
      </div>
    </Modal>
  );
}
