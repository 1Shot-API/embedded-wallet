import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export function AppHeader() {
  return (
    <header className="glass-panel border-border sticky top-0 z-40 border-b bg-white/80 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-5" />
        <a href="/" className="flex items-center gap-2.5 no-underline">
          <img
            src="/1Shot-Icon-New.svg"
            alt=""
            width={28}
            height={28}
            className="size-7"
          />
          <div className="leading-tight">
            <p className="font-heading text-primary text-lg font-extrabold tracking-tighter">
              1Shot Wallet
            </p>
            <p className="text-muted-foreground text-[0.7rem] font-medium tracking-wide uppercase">
              Host playground
            </p>
          </div>
        </a>
        <div className="ml-auto hidden sm:block">
          <p className="text-muted-foreground max-w-md text-right text-xs">
            Host Layer → Branding Layer ·{" "}
            <code className="text-[0.7rem]">setStyle</code> + EIP-1193
          </p>
        </div>
      </div>
    </header>
  );
}
