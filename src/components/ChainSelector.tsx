import type { ReactNode } from "react";
import type { SupportedChain } from "../lib/types/domain";
import { ChainDisplayUtils } from "../lib/implementations/utils/ChainDisplayUtils";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

function ChainMark({ chain }: { chain: SupportedChain }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-50">
        <img
          src={chain.logoUrl}
          alt=""
          width={24}
          height={24}
          className="size-6 object-cover"
        />
      </span>
      <span className="truncate text-sm font-semibold">{chain.label}</span>
    </span>
  );
}

function GroupedChainItems({
  chains,
  testnet,
}: {
  chains: readonly SupportedChain[];
  testnet: boolean;
}) {
  const { testnets, mainnets } = ChainDisplayUtils.groupByNetworkType(chains);
  const group = testnet ? testnets : mainnets;
  if (group.length === 0) return null;
  return (
    <SelectGroup>
      <SelectLabel>{testnet ? "Testnet" : "Mainnet"}</SelectLabel>
      {group.map((chain) => (
        <SelectItem
          key={String(chain.chainId)}
          value={String(chain.chainId)}
          textValue={chain.label}
        >
          <ChainMark chain={chain} />
        </SelectItem>
      ))}
    </SelectGroup>
  );
}

export interface IChainSelectorProps {
  id?: string;
  ariaLabel?: string;
  value: string;
  chains: readonly SupportedChain[];
  disabled?: boolean;
  placeholder?: string;
  onValueChange: (value: string) => void;
  triggerClassName?: string;
  contentClassName?: string;
  /** Extra items rendered above network groups (e.g. “session chain”). */
  leadingItems?: ReactNode;
}

/**
 * Grouped Mainnet/Testnet chain picker (website playground pattern).
 * Pass chains from {@link IChainRepository.list} (already weight-sorted).
 */
export function ChainSelector({
  id,
  ariaLabel = "Select chain",
  value,
  chains,
  disabled,
  placeholder = "Select chain",
  onValueChange,
  triggerClassName,
  contentClassName,
  leadingItems,
}: IChainSelectorProps) {
  const known = new Set(
    chains.map((chain) => String(chain.chainId).toLowerCase()),
  );
  const showFallback =
    Boolean(value) && !known.has(String(value).toLowerCase());

  return (
    <Select
      value={value || undefined}
      disabled={disabled}
      onValueChange={(next) => {
        if (next) onValueChange(next);
      }}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn("w-full", triggerClassName)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {leadingItems}
        <GroupedChainItems chains={chains} testnet={false} />
        <GroupedChainItems chains={chains} testnet />
        {showFallback ? (
          <SelectItem value={value} textValue={value}>
            {value}
          </SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  );
}
