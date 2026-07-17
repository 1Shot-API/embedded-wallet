import { MenuIcon } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useStyle } from "../style";
import { hasBackup } from "../storage";
import { useWallet } from "../wallet/WalletProvider";
import { useWalletSessionStore } from "../wallet/sessionStore";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";

/**
 * Top shell bar: brand + lock status + menu (backup / close).
 * Uses shadcn Menubar — https://ui.shadcn.com/docs/components/base/menubar
 */
export function WalletChrome() {
  const { requestHide, openCreateBackup, openRestoreBackup } = useWallet();
  const { style } = useStyle();
  const { unlocked, walletCreated, embedded } = useWalletSessionStore(
    useShallow((state) => ({
      unlocked: state.unlocked,
      walletCreated: state.walletCreated,
      embedded: state.embedded,
    })),
  );
  const canRestore = hasBackup();
  const showOnboarding = embedded && !walletCreated && !unlocked;

  return (
    <header className="border-border shrink-0 border-b" aria-label="Wallet panel">
      <Menubar className="h-auto w-full justify-between gap-2 rounded-none border-0 bg-transparent px-4 py-3 shadow-none">
        <div className="flex min-w-0 items-center gap-2.5">
          {style.copy.logoUrl ? (
            <img
              src={style.copy.logoUrl}
              alt=""
              className="size-6 shrink-0 rounded-sm object-contain"
            />
          ) : (
            <span
              className="bg-primary size-2.5 shrink-0 rounded-full"
              aria-hidden
            />
          )}
          <h2 className="m-0 truncate text-base font-bold tracking-tight">
            {style.copy.productName}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {!showOnboarding ? (
            <div
              className="flex items-center px-1.5"
              title={unlocked ? "Unlocked" : "Locked"}
            >
              <span
                className={`size-2 shrink-0 rounded-full ${unlocked ? "bg-emerald-500" : "bg-red-500"}`}
                aria-label={unlocked ? "Unlocked" : "Locked"}
                role="status"
              />
            </div>
          ) : null}

          <MenubarMenu>
            <MenubarTrigger
              className="gap-1 px-2"
              aria-label="Wallet menu"
            >
              <MenuIcon className="size-4" />
              <span className="sr-only">Menu</span>
            </MenubarTrigger>
            <MenubarContent align="end" className="min-w-44">
              {unlocked || !canRestore ? (
                <MenubarItem
                  onClick={() => {
                    void openCreateBackup().catch((error: unknown) => {
                      console.error("[create-backup] failed", error);
                    });
                  }}
                >
                  Create backup
                </MenubarItem>
              ) : null}
              {!unlocked && canRestore ? (
                <MenubarItem
                  onClick={() => {
                    void openRestoreBackup().catch((error: unknown) => {
                      console.error("[restore-backup] failed", error);
                    });
                  }}
                >
                  Restore backup
                </MenubarItem>
              ) : null}
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
