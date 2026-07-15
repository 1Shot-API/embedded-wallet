import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ModalAction = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  autoFocus?: boolean;
  disabled?: boolean;
};

export type ModalProps = {
  title: string;
  children: ReactNode;
  actions?: ModalAction[];
  /** Escape / overlay dismiss. Omit to lock the dialog until an action. */
  onBackdropDismiss?: () => void;
  /** Extra content after children (e.g. signer slot). */
  footer?: ReactNode;
  wide?: boolean;
};

/**
 * Wallet modal shell — controlled Dialog always mounted `open` while ModalHost
 * keeps this tree rendered. Escape / outside click call `onBackdropDismiss` when set.
 */
export function Modal({
  title,
  children,
  actions,
  onBackdropDismiss,
  footer,
  wide,
}: ModalProps) {
  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onBackdropDismiss?.();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={cn(
          "bg-background text-foreground z-[10000] max-h-[min(85vh,36rem)] gap-3 overflow-y-auto p-5 sm:max-w-md",
          wide && "sm:max-w-lg",
        )}
        onPointerDownOutside={(event) => {
          if (!onBackdropDismiss) {
            event.preventDefault();
          }
        }}
        onEscapeKeyDown={(event) => {
          if (!onBackdropDismiss) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="text-muted-foreground text-[0.95rem]">{children}</div>

        {footer}

        {actions && actions.length > 0 ? (
          <DialogFooter className="bg-background -mx-5 -mb-5 mt-1 border-t-0 sm:justify-end">
            {actions.map((action) => (
              <Button
                key={action.label}
                type="button"
                disabled={action.disabled}
                autoFocus={action.autoFocus}
                variant={
                  action.variant === "primary" ? "default" : "outline"
                }
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
