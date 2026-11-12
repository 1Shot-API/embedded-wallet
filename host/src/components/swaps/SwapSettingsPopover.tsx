import { EVMChainId } from "@1shotapi/ows-types";
import { Clock, Settings } from "lucide-react";

import { SWAP_MAINNET_CHAINS } from "@/constants/swapTokens";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function SwapSettingsPopover({
  selectedChainId,
  disabled,
  onChainChange,
}: {
  selectedChainId: string;
  disabled?: boolean;
  onChainChange: (chainId: string) => void;
}) {
  return (
    <>
      <button
        type="button"
        disabled
        aria-label="Transaction history (not available)"
        className="flex size-8 items-center justify-center rounded-lg text-neutral-400"
        title="History not available in playground"
      >
        <Clock className="size-4" />
      </button>

      <Popover>
        <PopoverTrigger asChild disabled={disabled}>
          <button
            type="button"
            aria-label="Swap settings"
            className={cn(
              "flex size-8 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100",
              "focus-visible:ring-2 focus-visible:ring-[#2563eb]/20 focus-visible:outline-none",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <Settings className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium text-neutral-900">Network</p>
              <p className="text-xs text-neutral-500">
                Same-chain swaps via LI.FI on wallet mainnet networks.
              </p>
            </div>
            <ul className="flex flex-col gap-0.5">
              {SWAP_MAINNET_CHAINS.map((chain) => (
                <li key={chain.value}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-neutral-100",
                      selectedChainId === chain.value &&
                        "bg-neutral-100 font-medium",
                    )}
                    onClick={() => onChainChange(chain.value)}
                  >
                    <img
                      src={chain.logo}
                      alt=""
                      className="size-5 rounded-full object-cover"
                    />
                    <span>{chain.label}</span>
                    <span className="ml-auto font-mono text-[10px] text-neutral-400">
                      {EVMChainId(chain.value as `0x${string}`)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="border-t border-neutral-200 pt-2 text-xs text-neutral-500">
              Slippage tolerance: 0.5%
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
