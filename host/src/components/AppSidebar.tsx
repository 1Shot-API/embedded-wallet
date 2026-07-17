import { FlaskConicalIcon, PaletteIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export type HostMode = "test" | "design";

export interface IAppSidebarProps {
  mode: HostMode;
  onModeChange: (mode: HostMode) => void;
}

const NAV_ITEMS: {
  mode: HostMode;
  label: string;
  description: string;
  icon: typeof FlaskConicalIcon;
}[] = [
  {
    mode: "test",
    label: "Test",
    description: "Sign, switch chain, USDC balance and send",
    icon: FlaskConicalIcon,
  },
  {
    mode: "design",
    label: "Design",
    description: "Live setStyle playground",
    icon: PaletteIcon,
  },
];

export function AppSidebar({ mode, onModeChange }: IAppSidebarProps) {
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="gap-0 border-b border-sidebar-border px-3 py-3">
        <p className="text-sidebar-foreground/70 px-1 text-xs font-semibold tracking-wide uppercase">
          Host
        </p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Modes</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.mode}>
                  <SidebarMenuButton
                    isActive={mode === item.mode}
                    tooltip={item.label}
                    onClick={() => onModeChange(item.mode)}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Hint</SidebarGroupLabel>
          <SidebarGroupContent>
            <p className="text-muted-foreground px-2 text-xs leading-relaxed">
              {mode === "test"
                ? "Wallet stays hidden. Use actions below to exercise EIP-1193."
                : "Configurator on the left; wallet flyout stays open on the right."}
            </p>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
