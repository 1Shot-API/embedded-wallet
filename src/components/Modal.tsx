import { useEffect, type ReactNode } from "react";
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

export type ModalPresentation = "page" | "overlay";

export type ModalProps = {
  title: string;
  children: ReactNode;
  actions?: ModalAction[];
  /** Escape / overlay dismiss. Omit to lock until an action. */
  onBackdropDismiss?: () => void;
  /** Extra content after children (e.g. signer slot). */
  footer?: ReactNode;
  wide?: boolean;
  /**
   * `page` (default) — full-bleed wallet view, no dimmed backdrop.
   * `overlay` — floating Dialog card (signer-adjacent prompts).
   */
  presentation?: ModalPresentation;
  /** Extra classes on the root shell (e.g. higher z-index for overlays). */
  contentClassName?: string;
};

function ModalActions({
  actions,
  stacked,
}: {
  actions: ModalAction[];
  stacked?: boolean;
}) {
  return (
    <>
      {actions.map((action) => (
        <Button
          key={action.label}
          type="button"
          disabled={action.disabled}
          autoFocus={action.autoFocus}
          className={stacked ? "w-full" : undefined}
          variant={action.variant === "primary" ? "default" : "outline"}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      ))}
    </>
  );
}

function PageModal({
  title,
  children,
  actions,
  onBackdropDismiss,
  footer,
  contentClassName,
}: ModalProps) {
  useEffect(() => {
    if (!onBackdropDismiss) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onBackdropDismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBackdropDismiss]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-page-view-title"
      className={cn(
        "bg-background text-foreground fixed inset-0 z-[10000] flex min-w-0 flex-col overflow-x-hidden",
        contentClassName,
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-5 pt-5">
        <h2
          id="wallet-page-view-title"
          className="m-0 shrink-0 text-lg font-semibold tracking-tight"
        >
          {title}
        </h2>

        <div className="text-muted-foreground mt-3 min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto text-[0.95rem]">
          {children}
        </div>

        {footer ? <div className="shrink-0 pt-3">{footer}</div> : null}
      </div>

      {actions && actions.length > 0 ? (
        <div className="bg-background shrink-0 px-5 py-4">
          <div className="flex flex-col-reverse gap-2">
            <ModalActions actions={actions} stacked />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OverlayModal({
  title,
  children,
  actions,
  onBackdropDismiss,
  footer,
  wide,
  contentClassName,
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
          "bg-background text-foreground z-[10000] max-h-[min(85vh,36rem)] min-w-0 gap-3 overflow-x-hidden overflow-y-auto p-5 sm:max-w-md",
          wide && "sm:max-w-lg",
          contentClassName,
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
        <DialogHeader className="min-w-0">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="text-muted-foreground min-w-0 overflow-x-hidden text-[0.95rem]">
          {children}
        </div>

        {footer}

        {actions && actions.length > 0 ? (
          <DialogFooter className="bg-background -mx-5 -mb-5 mt-1 border-t-0 sm:justify-end">
            <ModalActions actions={actions} />
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Wallet view shell. Default `presentation="page"` fills the iframe.
 * Use `presentation="overlay"` for floating dialogs (e.g. Relayer passkey).
 */
export function Modal({
  presentation = "page",
  ...props
}: ModalProps) {
  if (presentation === "overlay") {
    return <OverlayModal {...props} />;
  }
  return <PageModal {...props} />;
}
