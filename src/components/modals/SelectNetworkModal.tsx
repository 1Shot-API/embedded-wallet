import { CheckIcon } from "lucide-react";
import type { SupportedChain } from "../../lib/types/domain";
import { ChainDisplayUtils } from "../../lib/implementations/utils/ChainDisplayUtils";
import { useStyle } from "../../style/StyleProvider";
import { Modal } from "../Modal";
import { cn } from "@/lib/utils";

export interface ISelectNetworkModalProps {
  chains: readonly SupportedChain[];
  selectedChainId: string;
  onSelect: (chainId: string) => void;
  onClose: () => void;
}

function ChainRowLabel({ chain }: { chain: SupportedChain }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <img
        src={chain.logoUrl}
        alt=""
        className="size-5 shrink-0 rounded-full object-cover"
      />
      <span className="truncate">{chain.label}</span>
    </span>
  );
}

function NetworkGroup({
  title,
  chains,
  selectedChainId,
  onSelect,
}: {
  title: string;
  chains: readonly SupportedChain[];
  selectedChainId: string;
  onSelect: (chainId: string) => void;
}) {
  if (chains.length === 0) return null;
  return (
    <li className="flex flex-col gap-1">
      <div className="text-muted-foreground px-3 pt-1 text-xs font-medium">
        {title}
      </div>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {chains.map((chain) => {
          const selected =
            String(chain.chainId).toLowerCase() ===
            String(selectedChainId).toLowerCase();
          return (
            <li key={chain.chainId}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                className={cn(
                  "hover:bg-muted/60 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  selected && "bg-muted",
                )}
                onClick={() => onSelect(chain.chainId)}
              >
                <ChainRowLabel chain={chain} />
                {selected ? (
                  <CheckIcon className="text-primary size-4 shrink-0" />
                ) : (
                  <span className="size-4 shrink-0" aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

/**
 * Local modal to pick an active chain from the allowed catalog.
 * Groups Mainnet / Testnet like the host playground chain selector.
 */
export function SelectNetworkModal({
  chains,
  selectedChainId,
  onSelect,
  onClose,
}: ISelectNetworkModalProps) {
  const { style } = useStyle();
  const { account: copy } = style.copy;
  const { testnets, mainnets } = ChainDisplayUtils.groupByNetworkType(chains);

  return (
    <Modal
      title={copy.selectNetworkTitle}
      onBackdropDismiss={onClose}
      actions={[
        {
          label: copy.selectNetworkCancelLabel,
          variant: "secondary",
          onClick: onClose,
        },
      ]}
    >
      <ul className="m-0 flex list-none flex-col gap-3 p-0" role="listbox">
        <NetworkGroup
          title="Mainnet"
          chains={mainnets}
          selectedChainId={selectedChainId}
          onSelect={onSelect}
        />
        <NetworkGroup
          title="Testnet"
          chains={testnets}
          selectedChainId={selectedChainId}
          onSelect={onSelect}
        />
      </ul>
    </Modal>
  );
}
