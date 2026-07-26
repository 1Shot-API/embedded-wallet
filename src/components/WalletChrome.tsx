import { MenuIcon } from "lucide-react";
import { useStyle } from "../style/StyleProvider";
import { useWallet } from "../wallet/WalletProvider";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { BrandLogo } from "./BrandLogo";

/**
 * Top shell bar: brand logo + product name + menu (advanced / close).
 * Uses shadcn Menubar — https://ui.shadcn.com/docs/components/base/menubar
 */
export function WalletChrome() {
  const { requestHide, openAdvancedOptions } = useWallet();
  const { style } = useStyle();

  return (
    <header className="border-border shrink-0 border-b" aria-label="Wallet panel">
      <Menubar className="h-auto w-full justify-between gap-2 rounded-none border-0 bg-transparent px-3 py-2.5 shadow-none">
        <div className="flex min-w-0 items-center gap-2">
          <BrandLogo
            logoUrl={style.copy.logoUrl}
            className="size-5"
            alt=""
          />
          <h2 className="m-0 truncate text-[0.9rem] font-semibold tracking-tight">
            {style.copy.productName}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <MenubarMenu>
            <MenubarTrigger
              className="gap-1 px-2"
              aria-label="Wallet menu"
            >
              <MenuIcon className="size-4" />
              <span className="sr-only">Menu</span>
            </MenubarTrigger>
            <MenubarContent align="end" className="min-w-44">
              <MenubarItem
                onClick={() => {
                  void openAdvancedOptions().catch((error: unknown) => {
                    console.error("[advanced-options] failed", error);
                  });
                }}
              >
                {style.copy.advancedOptions.menuLabel}
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                onClick={() => {
                  void requestHide();
                }}
              >
                Close wallet
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </div>
      </Menubar>
    </header>
  );
}
