import { WalletIcon } from "lucide-react";
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
import { HOST_CHAINS, type IHostChainMeta } from "./hostChains";

export interface IChainSelectorOption {
  value: string;
  label: string;
  isTestnet?: boolean;
  weight?: number;
  logo?: string;
  icon?: "wallet";
  badge?: string;
}

function compareOptions(a: IChainSelectorOption, b: IChainSelectorOption): number {
  const weightDiff = (b.weight ?? 0) - (a.weight ?? 0);
  if (weightDiff !== 0) return weightDiff;
  return a.label.localeCompare(b.label);
}

function ChainMark({
  label,
  logo,
  icon,
  badge,
}: {
  label: string;
  logo?: string;
  icon?: "wallet";
  badge?: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-50">
        {logo ? (
          <img
            src={logo}
            alt=""
            width={24}
            height={24}
            className="size-6 object-cover"
          />
        ) : icon === "wallet" ? (
          <WalletIcon className="text-muted-foreground size-3.5" aria-hidden />
        ) : (
          <span className="bg-muted size-3 rounded-full" />
        )}
      </span>
      <span className="text-foreground flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold">
        <span className="truncate">{label}</span>
        {badge ? (
          <span className="text-muted-foreground shrink-0 text-xs font-medium">
            {badge}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function GroupedItems({
  options,
  testnet,
}: {
  options: readonly IChainSelectorOption[];
  testnet: boolean;
}) {
  const group = options
    .filter((option) => option.isTestnet === testnet)
    .slice()
    .sort(compareOptions);
  if (group.length === 0) return null;
  return (
    <SelectGroup>
      <SelectLabel>{testnet ? "Testnet" : "Mainnet"}</SelectLabel>
      {group.map((option) => (
        <SelectItem
          key={option.value}
          value={option.value}
          textValue={option.label}
        >
          <ChainMark
            label={option.label}
            logo={option.logo}
            icon={option.icon}
            badge={option.badge}
          />
        </SelectItem>
      ))}
    </SelectGroup>
  );
}

function hostChainToOption(chain: IHostChainMeta): IChainSelectorOption {
  return {
    value: chain.value,
    label: chain.label,
    isTestnet: chain.isTestnet,
    weight: chain.weight,
  };
}

export interface IChainSelectorProps {
  id?: string;
  ariaLabel?: string;
  value: string;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  /** Defaults to hardcoded {@link HOST_CHAINS}. */
  options?: readonly IChainSelectorOption[];
  /** Items without isTestnet (e.g. “Session chain”) rendered above groups. */
  leadingOptions?: readonly IChainSelectorOption[];
  triggerClassName?: string;
  contentClassName?: string;
  placeholder?: string;
}

/**
 * Grouped Mainnet/Testnet chain picker matching the website playground.
 */
export function ChainSelector({
  id,
  ariaLabel = "Select chain",
  value,
  disabled,
  onValueChange,
  options,
  leadingOptions = [],
  triggerClassName,
  contentClassName,
  placeholder = "Select chain",
}: IChainSelectorProps) {
  const catalog = options ?? HOST_CHAINS.map(hostChainToOption);
  const known = new Set([
    ...catalog.map((o) => o.value.toLowerCase()),
    ...leadingOptions.map((o) => o.value.toLowerCase()),
  ]);
  const showFallback =
    Boolean(value) && !known.has(value.toLowerCase());

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
        {leadingOptions.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            textValue={option.label}
          >
            <ChainMark
              label={option.label}
              logo={option.logo}
              icon={option.icon}
              badge={option.badge}
            />
          </SelectItem>
        ))}
        <GroupedItems options={catalog} testnet={false} />
        <GroupedItems options={catalog} testnet />
        {showFallback ? (
          <SelectItem value={value} textValue={value}>
            <ChainMark label={value} />
          </SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  );
}
